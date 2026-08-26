from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db


router = APIRouter(
    prefix="/candidate-solutions",
    tags=["candidate-solutions"],
)


def serialize_candidate_solution(
    solution: models.CandidateSolution,
    db: Session,
) -> dict:
    def get_module(module_id: str | None):
        if not module_id:
            return None

        return (
            db.query(models.Module)
            .filter(models.Module.id == module_id)
            .first()
        )

    def get_lecturer_name(lecturer_id: str | None):
        if not lecturer_id:
            return "Unassigned"

        lecturer = (
            db.query(models.Lecturer)
            .filter(models.Lecturer.id == lecturer_id)
            .first()
        )

        return lecturer.name if lecturer else lecturer_id

    def get_room_name(room_id: str | None):
        if not room_id:
            return "Room TBC"

        room = (
            db.query(models.Room)
            .filter(models.Room.id == room_id)
            .first()
        )

        return room.name if room else room_id

    module = get_module(solution.requested_module_id)

    module_code = (
        module.code
        if module
        else solution.requested_module_id or "Unknown"
    )

    module_title = (
        module.title
        if module
        else ""
    )

    request = solution.request or {}
    before = request.get("before", {})
    after = request.get("after", {})

    before_room_id = before.get("room_id")
    after_room_id = after.get("room_id")

    before_lecturer_id = before.get("lecturer_id")
    after_lecturer_id = after.get("lecturer_id")

    # Enrich additional timetable changes for display while preserving
    # the canonical IDs saved in the database.
    additional_changes = []

    for change in solution.additional_changes or []:
        module_id = change.get("module_id")
        changed_module = get_module(module_id)

        change_before = {
            **(change.get("before") or {})
        }

        change_after = {
            **(change.get("after") or {})
        }

        change_before_room_id = change_before.get("room_id")
        change_after_room_id = change_after.get("room_id")

        change_before_lecturer_id = change_before.get("lecturer_id")
        change_after_lecturer_id = change_after.get("lecturer_id")

        change_before["room_name"] = get_room_name(
            change_before_room_id
        )
        change_after["room_name"] = get_room_name(
            change_after_room_id
        )

        change_before["lecturer_name"] = get_lecturer_name(
            change_before_lecturer_id
        )
        change_after["lecturer_name"] = get_lecturer_name(
            change_after_lecturer_id
        )

        additional_changes.append(
            {
                **change,
                "module_code": (
                    changed_module.code
                    if changed_module
                    else module_id or "Unknown"
                ),
                "module_title": (
                    changed_module.title
                    if changed_module
                    else ""
                ),
                "before": change_before,
                "after": change_after,
            }
        )

    return {
        "id": solution.id,
        "requestId": solution.request_id,
        "requestType": solution.request_type,
        "requestCreatedAt": solution.request_created_at.isoformat(),
        "savedAt": solution.created_at.isoformat(),

        "moduleCode": module_code,
        "moduleTitle": module_title,

        "requestSummary": (
            f"Move {module_code} "
            f"from {before.get('day', '—')} {before.get('time', '—')} "
            f"to {after.get('day', '—')} {after.get('time', '—')}"
        ),

        "original": {
            "day": before.get("day"),
            "time": before.get("time"),
            "room": get_room_name(before_room_id),
            "lecturer": get_lecturer_name(before_lecturer_id),
        },

        "result": {
            "day": after.get("day"),
            "time": after.get("time"),
            "room": get_room_name(after_room_id),
            "lecturer": get_lecturer_name(after_lecturer_id),
        },

        "additionalChanges": additional_changes,
        "affectedStakeholders": solution.affected_stakeholders or [],
        "stakeholderImpacts": solution.stakeholder_impacts or [],
        "objectives": solution.objectives or [],
        "constraints": solution.constraints or [],
        "resultingSessions": solution.resulting_timetable or [],

        "solveSettings": solution.solve_settings or {},
        "solverMetadata": solution.solver_metadata or {},
    }


@router.get("/")
def list_candidate_solutions(
    db: Session = Depends(get_db),
):
    solutions = (
        db.query(models.CandidateSolution)
        .order_by(models.CandidateSolution.created_at.desc())
        .all()
    )

    return [
        serialize_candidate_solution(solution, db)
        for solution in solutions
    ]


@router.post("/", status_code=201)
def create_candidate_solution(
    payload: schemas.CandidateSolutionCreate,
    db: Session = Depends(get_db),
):
    existing_solution = (
        db.query(models.CandidateSolution)
        .filter(models.CandidateSolution.id == payload.id)
        .first()
    )

    if existing_solution is not None:
        raise HTTPException(
            status_code=409,
            detail="Candidate solution already exists",
        )

    solution = models.CandidateSolution(
        id=payload.id,
        name=payload.name,
        status=payload.status,

        request_id=payload.request_id,
        request_created_at=payload.request_created_at,

        requested_session_id=payload.requested_session_id,
        requested_module_id=payload.requested_module_id,
        request_type=payload.request_type,

        additional_change_count=len(
            payload.additional_changes
        ),

        request=payload.request,
        additional_changes=payload.additional_changes,
        affected_stakeholders=payload.affected_stakeholders,
        stakeholder_impacts=payload.stakeholder_impacts,
        objectives=payload.objectives,
        constraints=payload.constraints,
        resulting_timetable=payload.resulting_timetable,
        solve_settings=payload.solve_settings,
        solver_metadata=payload.solver_metadata,
    )

    try:
        db.add(solution)
        db.commit()
        db.refresh(solution)
    except Exception as exc:
        db.rollback()
        print("Failed to save candidate solution:", exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to save candidate solution",
        )

    return serialize_candidate_solution(
        solution,
        db,
    )


@router.get("/{solution_id}")
def get_candidate_solution(
    solution_id: str,
    db: Session = Depends(get_db),
):
    solution = (
        db.query(models.CandidateSolution)
        .filter(models.CandidateSolution.id == solution_id)
        .first()
    )

    if solution is None:
        raise HTTPException(
            status_code=404,
            detail="Candidate solution not found",
        )

    return serialize_candidate_solution(solution, db)
