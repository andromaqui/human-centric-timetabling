from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/cohorts", tags=["cohorts"])


@router.get("/", response_model=list[schemas.CohortOut])
def list_cohorts(db: Session = Depends(get_db)):
    return db.query(models.Cohort).all()


@router.get("/{cohort_id}/constraints", response_model=list[schemas.CohortConstraintOut])
def list_cohort_constraints(cohort_id: str, db: Session = Depends(get_db)):
    if not db.get(models.Cohort, cohort_id):
        raise HTTPException(404, "Cohort not found")
    return (
        db.query(models.CohortConstraint)
        .filter(models.CohortConstraint.cohort_id == cohort_id)
        .all()
    )