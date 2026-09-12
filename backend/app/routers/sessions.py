from dataclasses import dataclass
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from app.solver.reschedule import diagnose_working_day


router = APIRouter(
    prefix="/sessions",
    tags=["sessions"],
)


# ============================================================================
# Temporary working-session representation
# ============================================================================

@dataclass
class WorkingSession:
    """
    Temporary hypothetical version of a session.

    This is used by interactive repair so that we can move a session
    without modifying/persisting the SQLAlchemy Session object.
    """

    id: str
    module_id: str
    lecturer_id: str
    room_id: str | None
    type: str

    start: datetime
    end: datetime

    programs: list[Any]
    cohorts: list[Any]

    module: Any
    room: Any


# ============================================================================
# Session conversion helpers
# ============================================================================

def _to_session_out(
    session: models.Session,
) -> schemas.SessionOut:
    return schemas.SessionOut(
        id=session.id,
        module_id=session.module_id,
        lecturer_id=session.lecturer_id,
        room_id=session.room_id,
        room_name=(
            session.room.name
            if session.room
            else None
        ),
        type=session.type,
        start=session.start,
        end=session.end,
        program_ids=[
            program.id
            for program in session.programs
        ],
        cohort_ids=[
            cohort.id
            for cohort in session.cohorts
        ],
    )


def working_session_to_out(
    session: models.Session | WorkingSession,
) -> schemas.SessionOut:
    """
    Converts either a real SQLAlchemy session or a temporary
    WorkingSession into the normal SessionOut API representation.
    """

    return schemas.SessionOut(
        id=session.id,
        module_id=session.module_id,
        lecturer_id=session.lecturer_id,
        room_id=session.room_id,
        room_name=(
            session.room.name
            if session.room
            else None
        ),
        type=session.type,
        start=session.start,
        end=session.end,
        program_ids=[
            program.id
            for program in session.programs
        ],
        cohort_ids=[
            cohort.id
            for cohort in session.cohorts
        ],
    )


# ============================================================================
# Normal session endpoints
# ============================================================================

@router.get(
    "/",
    response_model=list[schemas.SessionOut],
)
def list_sessions(
    db: Session = Depends(get_db),
):
    sessions = db.query(models.Session).all()

    return [
        _to_session_out(session)
        for session in sessions
    ]


# ============================================================================
# Interactive repair
# ============================================================================

@router.post(
    "/day/working",
    response_model=schemas.WorkingDayOut,
)
def list_working_sessions_for_day(
    request: schemas.WorkingDayRequestIn,
    db: Session = Depends(get_db),
):
    """
    Build the hypothetical timetable for one day after applying
    all interactive-repair moves, then diagnose that complete day.

    Nothing is persisted to the database.
    """

    valid_days = {
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
    }

    normalized_day = request.day.strip().lower()

    if normalized_day not in valid_days:
        raise HTTPException(
            status_code=400,
            detail="Day must be Monday to Friday",
        )

    # ------------------------------------------------------------------
    # 1. Load the original timetable
    # ------------------------------------------------------------------

    sessions = db.query(models.Session).all()

    original_day_sessions = [
        session
        for session in sessions
        if (
                session.start.strftime("%A").lower()
                == normalized_day
        )
    ]

    # ------------------------------------------------------------------
    # 2. Determine which sessions have hypothetical moves
    # ------------------------------------------------------------------

    moved_session_ids = {
        move.session_id
        for move in request.moves
    }

    # ------------------------------------------------------------------
    # 3. Add unchanged sessions that are originally on this day
    # ------------------------------------------------------------------

    working_sessions: list[
        models.Session | WorkingSession
    ] = [
        session
        for session in sessions
        if (
            session.start.strftime("%A").lower()
            == normalized_day
            and session.id not in moved_session_ids
        )
    ]

    # ------------------------------------------------------------------
    # 4. Apply all hypothetical moves
    # ------------------------------------------------------------------

    for move in request.moves:
        original_session = db.get(
            models.Session,
            move.session_id,
        )

        if original_session is None:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"Session {move.session_id} "
                    f"not found"
                ),
            )

        new_day = (
            move.new_start
            .strftime("%A")
            .lower()
        )

        # The session was moved somewhere else.
        #
        # Because its ID is already in moved_session_ids,
        # its original placement has been removed above.
        #
        # If its NEW placement is also not on this day,
        # there is nothing to add.
        if new_day != normalized_day:
            continue

        # Create a detached hypothetical representation.
        #
        # IMPORTANT:
        # We do NOT modify original_session.start/end because that
        # SQLAlchemy object belongs to the DB session and could
        # accidentally be flushed/persisted.
        temporary_session = WorkingSession(
            id=original_session.id,
            module_id=original_session.module_id,
            lecturer_id=original_session.lecturer_id,
            room_id=original_session.room_id,
            type=original_session.type,
            start=move.new_start,
            end=move.new_end,
            programs=list(
                original_session.programs
            ),
            cohorts=list(
                original_session.cohorts
            ),
            module=original_session.module,
            room=original_session.room,
        )

        working_sessions.append(
            temporary_session
        )

    # ------------------------------------------------------------------
    # 5. Diagnose the COMPLETE hypothetical day
    # ------------------------------------------------------------------
    """
    print("\n===== WORKING DAY DIAGNOSTICS =====")
    print("Day:", normalized_day)
    print(
        "Moves:",
        [
            {
                "session_id": move.session_id,
                "new_start": move.new_start,
                "new_end": move.new_end,
            }
            for move in request.moves
        ],
    )

    print(
        "Working sessions:",
        [
            {
                "id": session.id,
                "start": session.start,
                "end": session.end,
                "room_id": session.room_id,
                "lecturer_id": session.lecturer_id,
            }
            for session in working_sessions
        ],
    )
    """

    before_violations = diagnose_working_day(
        db=db,
        day=normalized_day,
        working_sessions=original_day_sessions,
    )

    after_violations = diagnose_working_day(
        db=db,
        day=normalized_day,
        working_sessions=working_sessions,
    )

    violations = [
        violation
        for violation in after_violations
        if violation not in before_violations
    ]

    print("\n===== BEFORE =====")
    for violation in before_violations:
        print(violation)

    print("\n===== AFTER =====")
    for violation in after_violations:
        print(violation)

    # ------------------------------------------------------------------
    # 6. Return hypothetical sessions + their violations
    # ------------------------------------------------------------------

    return {
        "sessions": [
            working_session_to_out(session)
            for session in working_sessions
        ],
        "violations": violations,
    }


# ============================================================================
# Session constraint endpoints
# ============================================================================

@router.get(
    "/{session_id}/constraints",
    response_model=list[
        schemas.SessionConstraintOut
    ],
)
def list_session_constraints(
    session_id: str,
    db: Session = Depends(get_db),
):
    if not db.get(
        models.Session,
        session_id,
    ):
        raise HTTPException(
            status_code=404,
            detail="Session not found",
        )

    return (
        db.query(
            models.SessionConstraint
        )
        .filter(
            models.SessionConstraint.session_id
            == session_id
        )
        .all()
    )