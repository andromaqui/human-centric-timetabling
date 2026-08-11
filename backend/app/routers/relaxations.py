import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/relaxations", tags=["relaxations"])

# TODO: GLOBAL VAR
INSTANCE_MODEL_MAP = {
    "session": models.SessionConstraint,
    "lecturer": models.LecturerConstraint,
    "cohort": models.CohortConstraint,
    "room": models.RoomConstraint,
}


@router.get("/", response_model=list[schemas.RelaxationOut])
def list_relaxations(instance_type: str | None = None, instance_id: str | None = None,
                      db: Session = Depends(get_db)):
    query = db.query(models.ConstraintRelaxation)
    if instance_type:
        query = query.filter(models.ConstraintRelaxation.instance_type == instance_type)
    if instance_id:
        query = query.filter(models.ConstraintRelaxation.instance_id == instance_id)
    results = query.all()
    return [
        schemas.RelaxationOut(
            id=r.id, instance_type=r.instance_type, instance_id=r.instance_id,
            relaxation_type=r.relaxation_type,
            details=json.loads(r.details) if r.details else None,
            reason=r.reason, created_at=r.created_at,
        )
        for r in results
    ]


@router.post("/", response_model=schemas.RelaxationOut, status_code=201)
def create_relaxation(payload: schemas.RelaxationCreate, db: Session = Depends(get_db)):
    if payload.instance_type not in schemas.INSTANCE_TYPES:
        raise HTTPException(400, f"instance_type must be one of {sorted(schemas.INSTANCE_TYPES)}")

    instance_model = INSTANCE_MODEL_MAP[payload.instance_type]
    instance = db.get(instance_model, payload.instance_id)
    if not instance:
        raise HTTPException(404, "Instance not found")
    if not instance.is_activated:
        raise HTTPException(400, "This constraint is deactivated for this instance")

    constraint = db.get(models.Constraint, instance.constraint_id)
    if constraint.type == "unrelaxable":
        raise HTTPException(400, "This constraint cannot be relaxed")

    if payload.relaxation_type not in ("disable", "adjust"):
        raise HTTPException(400, "relaxation_type must be 'disable' or 'adjust'")

    details_json = None
    if payload.relaxation_type == "adjust":
        schema = schemas.RELAXATION_DETAIL_SCHEMAS.get(constraint.id)
        if not schema:
            raise HTTPException(400, f"No relaxation shape defined for '{constraint.id}'")
        if payload.details is None:
            raise HTTPException(422, "details required for relaxation_type='adjust'")
        try:
            validated = schema(**payload.details)
        except Exception as e:
            raise HTTPException(422, f"Invalid details: {e}")
        details_json = validated.model_dump_json()

    # auto-replace: delete any existing relaxation for this instance first
    db.query(models.ConstraintRelaxation).filter(
        models.ConstraintRelaxation.instance_type == payload.instance_type,
        models.ConstraintRelaxation.instance_id == payload.instance_id,
    ).delete()

    relaxation = models.ConstraintRelaxation(
        id=str(uuid.uuid4()), instance_type=payload.instance_type, instance_id=payload.instance_id,
        relaxation_type=payload.relaxation_type, details=details_json, reason=payload.reason,
        created_at=datetime.now(timezone.utc),
    )
    db.add(relaxation)
    db.commit()
    db.refresh(relaxation)

    return schemas.RelaxationOut(
        id=relaxation.id, instance_type=relaxation.instance_type, instance_id=relaxation.instance_id,
        relaxation_type=relaxation.relaxation_type,
        details=json.loads(relaxation.details) if relaxation.details else None,
        reason=relaxation.reason, created_at=relaxation.created_at,
    )


@router.delete("/{relaxation_id}", status_code=204)
def delete_relaxation(relaxation_id: str, db: Session = Depends(get_db)):
    r = db.get(models.ConstraintRelaxation, relaxation_id)
    if not r:
        raise HTTPException(404, "Relaxation not found")
    db.delete(r)
    db.commit()