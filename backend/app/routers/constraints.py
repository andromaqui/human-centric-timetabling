from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/constraints", tags=["constraints"])


@router.get("/", response_model=list[schemas.ConstraintOut])
def list_constraints(db: Session = Depends(get_db)):
    return db.query(models.Constraint).all()