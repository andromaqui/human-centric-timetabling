from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.solver.reschedule import (
    solve_reschedule,
    build_pre_solve_context,
    solve_reschedule_min_perturbation,
    request_is_concrete,
    get_proposed_values,
    diagnose_specific_request, get_session,
)

from app.schemas import (RescheduleRequestIn, MixedRecoveryRequestIn)
from app.solver.mixed_recovery import (solve_reschedule_mixed_recovery,)

router = APIRouter(prefix="/solver", tags=["solver"])


@router.post("/reschedule")
def reschedule(request: RescheduleRequestIn, db: Session = Depends(get_db),):
    print("request")
    print(request)
    return solve_reschedule(request, db)


@router.post("/reschedule/preview-conflicts")
def preview_reschedule_conflicts(request: RescheduleRequestIn, db: Session = Depends(get_db),):
    # Run the same request validation as the actual solver.
    pre_solve = build_pre_solve_context(request, db)

    # Invalid request, missing session, invalid time, etc.
    if pre_solve["status"] == "invalid":
        return {
            "status": "invalid",
            "reason": pre_solve.get("reason"),
            "violations": [],
            "overlapping_sessions": [],
        }

    # This can happen when the requested values are exactly
    # the same as the current session.
    if pre_solve["status"] == "success":
        return {
            "status": "ok",
            "reason": pre_solve.get("reason"),
            "violations": [],
            "overlapping_sessions": [],
        }

    # Conflict preview only works when the final placement
    # is completely deterministic.
    #
    # KEEP     -> concrete
    # SPECIFIC -> concrete
    # FIND     -> not concrete
    if not request_is_concrete(request):
        return {
            "status": "not_concrete",
            "reason": (
                "Conflict preview is only available when "
                "time, room and lecturer are fully determined."
            ),
            "violations": [],
            "overlapping_sessions": [],
        }

    target_session = pre_solve["target_session"]

    (
        proposed_start,
        proposed_room_id,
        proposed_lecturer_id,
    ) = get_proposed_values(
        request,
        target_session,
    )

    diagnostics = diagnose_specific_request(
        db,
        target_session,
        proposed_start,
        proposed_room_id,
        proposed_lecturer_id,
    )

    return {
        "status": "ok",
        "reason": None,
        "violations": diagnostics["violations"],
        "overlapping_sessions": diagnostics["overlapping_sessions"],
    }


@router.post("/diagnose")
def diagnose_reschedule(request: RescheduleRequestIn, db: Session = Depends(get_db)):
    # Force the request to be treated as concrete
    if not request_is_concrete(request):
        return {
            "status": "invalid",
            "reason": "Diagnosis only works when time, room and lecturer are all concrete",
            "diagnostics": None,
        }

    session, error = get_session(db, request.session_id)
    if error:
        return error

    proposed_start, proposed_room_id, proposed_lecturer_id = get_proposed_values(
        request, session
    )

    diagnostics = diagnose_specific_request(
        db,
        session,
        proposed_start,
        proposed_room_id,
        proposed_lecturer_id,
    )

    return {
        "status": "diagnosed",
        "diagnostics": diagnostics,
    }


@router.post("/reschedule/min-perturbation")
def reschedule_min_perturbation(request: RescheduleRequestIn, db: Session = Depends(get_db)):
    return solve_reschedule_min_perturbation(request, db)


@router.post("/reschedule/mixed")
def reschedule_mixed(payload: MixedRecoveryRequestIn, db: Session = Depends(get_db)):
    return solve_reschedule_mixed_recovery(
        request=payload.request,
        max_perturbations=payload.max_perturbations,
        allowed_relaxations=payload.allowed_relaxations,
        db=db,
    )