from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/constraints", tags=["constraints"])


@router.get("/", response_model=list[schemas.ConstraintOut])
def list_constraints(db: Session = Depends(get_db)):
    return db.query(models.Constraint).all()


@router.get("/relaxable-instances")
def list_relaxable_constraint_instances(
    db: Session = Depends(get_db),
):
    relaxable_constraints = (
        db.query(models.Constraint)
        .filter(models.Constraint.type == "relaxable")
        .all()
    )

    relaxable_by_id = {
        constraint.id: constraint
        for constraint in relaxable_constraints
    }

    result = {
        "lecturer": [],
        "cohort": [],
        "session": [],
    }

    # ---------------------------------------------------------
    # Lecturer constraint instances
    # ---------------------------------------------------------

    lecturer_instances = (
        db.query(models.LecturerConstraint)
        .filter(
            models.LecturerConstraint.constraint_id.in_(
                relaxable_by_id.keys()
            ),
            models.LecturerConstraint.is_activated.is_(True),
        )
        .all()
    )

    for instance in lecturer_instances:
        constraint = relaxable_by_id[instance.constraint_id]
        lecturer = db.get(models.Lecturer, instance.lecturer_id)

        result["lecturer"].append({
            "instance_id": instance.id,
            "constraint_id": constraint.id,
            "constraint_name": constraint.name,
            "stakeholder_id": instance.lecturer_id,
            "stakeholder_name": lecturer.name if lecturer else instance.lecturer_id,
            "day": instance.day,
        })

    # ---------------------------------------------------------
    # Cohort constraint instances
    # ---------------------------------------------------------

    cohort_instances = (
        db.query(models.CohortConstraint)
        .filter(
            models.CohortConstraint.constraint_id.in_(
                relaxable_by_id.keys()
            ),
            models.CohortConstraint.is_activated.is_(True),
        )
        .all()
    )

    for instance in cohort_instances:
        constraint = relaxable_by_id[instance.constraint_id]
        cohort = db.get(models.Cohort, instance.cohort_id)

        result["cohort"].append({
            "instance_id": instance.id,
            "constraint_id": constraint.id,
            "constraint_name": constraint.name,
            "stakeholder_id": instance.cohort_id,
            "stakeholder_name": cohort.name if cohort else instance.cohort_id,
            "day": instance.day,
        })

    # ---------------------------------------------------------
    # Session constraint instances
    # ---------------------------------------------------------

    session_instances = (
        db.query(models.SessionConstraint)
        .filter(
            models.SessionConstraint.constraint_id.in_(
                relaxable_by_id.keys()
            ),
            models.SessionConstraint.is_activated.is_(True),
        )
        .all()
    )

    for instance in session_instances:
        constraint = relaxable_by_id[instance.constraint_id]
        session = db.get(models.Session, instance.session_id)

        module = (
            db.get(models.Module, session.module_id)
            if session
            else None
        )

        result["session"].append({
            "instance_id": instance.id,
            "constraint_id": constraint.id,
            "constraint_name": constraint.name,
            "stakeholder_id": instance.session_id,
            "stakeholder_name": (
                f"{module.code} · {module.title}"
                if module
                else instance.session_id
            ),
            "day": None,
        })

    return result