from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.get("/", response_model=list[schemas.RoomOut])
def list_rooms(db: Session = Depends(get_db)):
    return db.query(models.Room).all()


@router.get("/{room_id}/constraints", response_model=list[schemas.RoomConstraintOut])
def list_room_constraints(room_id: str, db: Session = Depends(get_db)):
    if not db.get(models.Room, room_id):
        raise HTTPException(404, "Room not found")
    return db.query(models.RoomConstraint).filter(
        models.RoomConstraint.room_id == room_id
    ).all()