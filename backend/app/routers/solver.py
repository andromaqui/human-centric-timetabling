from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.solver.reschedule import (
    solve_reschedule,
    build_pre_solve_context,
    solve_reschedule_min_perturbation,
    request_is_concrete,
    get_proposed_values,
    diagnose_specific_request,
    get_session,
)
from app.solver.perturbation_alternatives import (
    find_perturbation_alternatives,
)
from app.schemas import RescheduleRequestIn, MixedRecoveryRequestIn
from app.solver.mixed_recovery import (
    solve_reschedule_mixed_recovery,
    analyse_mixed_recovery_guidance,
)

router = APIRouter(prefix="/solver", tags=["solver"])


@router.post("/reschedule")
def reschedule(request: RescheduleRequestIn, db: Session = Depends(get_db)):
    print("request")
    print(request)
    return solve_reschedule(request, db)


@router.post("/reschedule/preview-conflicts")
def preview_reschedule_conflicts(
    request: RescheduleRequestIn,
    db: Session = Depends(get_db),
):
    pre_solve = build_pre_solve_context(request, db)

    if pre_solve["status"] == "invalid":
        return {
            "status": "invalid",
            "reason": pre_solve.get("reason"),
            "violations": [],
            "overlapping_sessions": [],
        }

    if pre_solve["status"] == "success":
        return {
            "status": "ok",
            "reason": pre_solve.get("reason"),
            "violations": [],
            "overlapping_sessions": [],
        }

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
    proposed_start, proposed_room_id, proposed_lecturer_id = get_proposed_values(
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
def diagnose_reschedule(
    request: RescheduleRequestIn,
    db: Session = Depends(get_db),
):
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
        request,
        session,
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
def reschedule_min_perturbation(
    request: RescheduleRequestIn,
    db: Session = Depends(get_db),
):
    return solve_reschedule_min_perturbation(request, db)


@router.post("/reschedule/mixed/guidance")
def reschedule_mixed_guidance(
    payload: MixedRecoveryRequestIn,
    db: Session = Depends(get_db),
):
    """
    Analyse the recovery space under the user's CURRENT protected constraints.

    max_perturbations from MixedRecoveryRequestIn is intentionally ignored here:
    this endpoint computes the useful starting budget rather than consuming one.
    Reusing the existing payload keeps this change schema-compatible for now.
    """
    return analyse_mixed_recovery_guidance(
        request=payload.request,
        protected_constraints=payload.protected_constraints,
        db=db,
    )


@router.post("/reschedule/mixed")
def reschedule_mixed(
    payload: MixedRecoveryRequestIn,
    db: Session = Depends(get_db),
):
    return solve_reschedule_mixed_recovery(
        request=payload.request,
        max_perturbations=payload.max_perturbations,
        protected_constraints=payload.protected_constraints,
        db=db,
    )


@router.post("/reschedule/perturbation-alternatives")
def reschedule_perturbation_alternatives(
    request: RescheduleRequestIn,
    db: Session = Depends(get_db),
):
    return find_perturbation_alternatives(
        request=request,
        db=db,
        max_solutions=3,
    )
