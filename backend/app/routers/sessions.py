from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _to_session_out(session: models.Session) -> schemas.SessionOut:
    return schemas.SessionOut(
        id=session.id,
        module_id=session.module_id,
        lecturer_id=session.lecturer_id,
        room_id=session.room_id,
        room_name=session.room.name if session.room else None,
        type=session.type,
        start=session.start,
        end=session.end,
        program_ids=[p.id for p in session.programs],
        cohort_ids=[c.id for c in session.cohorts],
    )


@router.get("/", response_model=list[schemas.SessionOut])
def list_sessions(db: Session = Depends(get_db)):
    sessions = db.query(models.Session).all()
    return [_to_session_out(s) for s in sessions]


@router.get("/{session_id}/constraints", response_model=list[schemas.SessionConstraintOut])
def list_session_constraints(session_id: str, db: Session = Depends(get_db)):
    if not db.get(models.Session, session_id):
        raise HTTPException(404, "Session not found")
    return (
        db.query(models.SessionConstraint)
        .filter(models.SessionConstraint.session_id == session_id)
        .all()
    )