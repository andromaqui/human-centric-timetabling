from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/lecturers", tags=["lecturers"])


@router.get("/", response_model=list[schemas.LecturerOut])
def list_lecturers(db: Session = Depends(get_db)):
    return db.query(models.Lecturer).all()


@router.get("/{lecturer_id}/constraints", response_model=list[schemas.LecturerConstraintOut])
def list_lecturer_constraints(lecturer_id: str, db: Session = Depends(get_db)):
    if not db.get(models.Lecturer, lecturer_id):
        raise HTTPException(404, "Lecturer not found")
    return (
        db.query(models.LecturerConstraint)
        .filter(models.LecturerConstraint.lecturer_id == lecturer_id)
        .all()
    )


@router.get("/{lecturer_id}/unavailability", response_model=list[schemas.LecturerUnavailabilityOut])
def list_lecturer_unavailability(lecturer_id: str, db: Session = Depends(get_db)):
    if not db.get(models.Lecturer, lecturer_id):
        raise HTTPException(404, "Lecturer not found")
    return (
        db.query(models.LecturerUnavailability)
        .filter(models.LecturerUnavailability.lecturer_id == lecturer_id)
        .all()
    )