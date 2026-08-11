from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/constraint-instances", tags=["constraint-instances"])

INSTANCE_MODEL_MAP = {
    "session": models.SessionConstraint,
    "lecturer": models.LecturerConstraint,
    "cohort": models.CohortConstraint,
    "room": models.RoomConstraint,
}

#TODO: I think this whole file should be in relaxations, modules, sessions
@router.patch("/{instance_type}/{instance_id}/deactivate", response_model=schemas.InstanceOut)
def deactivate_instance(instance_type: str, instance_id: str, db: Session = Depends(get_db)):
    if instance_type not in schemas.INSTANCE_TYPES:
        raise HTTPException(400, "invalid instance_type")
    instance = db.get(INSTANCE_MODEL_MAP[instance_type], instance_id)
    if not instance:
        raise HTTPException(404, "Instance not found")
    instance.is_activated = False
    db.query(models.ConstraintRelaxation).filter(
        models.ConstraintRelaxation.instance_type == instance_type,
        models.ConstraintRelaxation.instance_id == instance_id,
    ).delete()
    db.commit()
    db.refresh(instance)
    return instance


@router.patch("/{instance_type}/{instance_id}/activate", response_model=schemas.InstanceOut)
def activate_instance(instance_type: str, instance_id: str, db: Session = Depends(get_db)):
    if instance_type not in schemas.INSTANCE_TYPES:
        raise HTTPException(400, "invalid instance_type")
    instance = db.get(INSTANCE_MODEL_MAP[instance_type], instance_id)
    if not instance:
        raise HTTPException(404, "Instance not found")
    instance.is_activated = True
    db.commit()
    db.refresh(instance)
    return instance