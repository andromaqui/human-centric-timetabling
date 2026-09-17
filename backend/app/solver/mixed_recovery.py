"""
Mixed recovery solver.

Semantics:
- The requested target change is forced.
- Other sessions may move in time/room, but their lecturer is frozen.
- At most `max_perturbations` other sessions may be touched.
- Unbreakable constraints are always enforced.
- Breakable constraints are baseline-aware unless the user explicitly
  permits that exact constraint instance to be relaxed.
- The objective minimizes the number of other sessions touched.

This file intentionally duplicates some minimum-perturbation logic so
mixed recovery is self-contained and easy to evolve independently.
"""

from ortools.sat.python import cp_model

from app.schemas import ChangeMode, RescheduleRequestIn
from app.models import Session

# Reuse stable shared utilities/constraint builders from the existing solver.
from app.solver.reschedule import (
    SLOTS_PER_DAY,
    DAY_TO_INDEX,
    COHORT_MAX_HOURS_PER_DAY,
    LECTURER_MAX_HOURS_PER_DAY,
    datetime_to_slot,
    day_time_to_slot,
    slot_to_day_time,
    get_valid_start_slots,
    get_duration_slots,
    build_room_mappings,
    build_lecturer_mappings,
    parse_requested_start,
    build_pre_solve_context,
    get_rooms,
    get_lecturers,
    get_all_lecturer_unavailability,
    get_active_class_capacity_sessions,
    get_active_class_equipment_sessions,
    get_active_cohort_daily_hour_constraints,
    get_active_lecturer_daily_hour_constraints,
    get_active_lecturer_lunch_constraints,
    check_timetable_integrity,
    get_existing_breakable_violations,
    build_baseline_violation_context,
    add_room_no_overlap_constraint,
    add_lecturer_no_overlap_constraint,
    add_lecturer_unavailability_constraint,
    add_baseline_aware_class_capacity_constraint,
    add_baseline_aware_class_equipment_constraint,
    add_baseline_aware_cohort_daily_hours_constraint,
    add_baseline_aware_lecturer_daily_hours_constraint,
    add_baseline_aware_lecturer_lunch_break_constraint,
)


# =====================================================================
# Allowed-relaxation helpers
# =====================================================================

def _value(item, name, default=None):
    """Support either Pydantic objects or plain dictionaries."""
    if isinstance(item, dict):
        return item.get(name, default)
    return getattr(item, name, default)


def _days_match(left, right):
    if left is None or right is None:
        return left is None and right is None

    left_key = left.lower()
    right_key = right.lower()

    left_index = DAY_TO_INDEX.get(left_key)
    right_index = DAY_TO_INDEX.get(right_key)

    if left_index is not None and right_index is not None:
        return left_index == right_index

    return left_key == right_key


def is_relaxation_allowed(
    allowed_relaxations,
    *,
    constraint_id,
    instance_type,
    instance_id,
    day=None,
):
    """
    True only when the user explicitly permitted this exact instance.

    IMPORTANT:
    `instance_id` here is the stakeholder/entity id used by the solver:
      - session id for class capacity/equipment
      - cohort id for cohort daily hours
      - lecturer id for lecturer daily hours/lunch
    """
    for item in allowed_relaxations or []:
        if _value(item, "constraint_id") != constraint_id:
            continue
        if _value(item, "instance_type") != instance_type:
            continue
        if _value(item, "instance_id") != instance_id:
            continue
        if not _days_match(_value(item, "day"), day):
            continue
        return True

    return False


def apply_allowed_relaxations(
    allowed_relaxations,
    *,
    active_capacity_sessions,
    active_equipment_sessions,
    cohort_daily_constraints,
    lecturer_daily_constraints,
    lecturer_lunch_constraints,
):
    """
    Remove ONLY the constraint instances the user has permitted.

    Removing an instance means the mixed CP-SAT model does not enforce
    that instance. It does not mean the final solution must violate it.
    """

    active_capacity_sessions = {
        session_id
        for session_id in active_capacity_sessions
        if not is_relaxation_allowed(
            allowed_relaxations,
            constraint_id="class-capacity",
            instance_type="session",
            instance_id=session_id,
            day=None,
        )
    }

    active_equipment_sessions = {
        session_id
        for session_id in active_equipment_sessions
        if not is_relaxation_allowed(
            allowed_relaxations,
            constraint_id="class-equipment",
            instance_type="session",
            instance_id=session_id,
            day=None,
        )
    }

    cohort_daily_constraints = [
        constraint
        for constraint in cohort_daily_constraints
        if not is_relaxation_allowed(
            allowed_relaxations,
            constraint_id=constraint.constraint_id,
            instance_type="cohort",
            instance_id=constraint.cohort_id,
            day=constraint.day,
        )
    ]

    lecturer_daily_constraints = [
        constraint
        for constraint in lecturer_daily_constraints
        if not is_relaxation_allowed(
            allowed_relaxations,
            constraint_id=constraint.constraint_id,
            instance_type="lecturer",
            instance_id=constraint.lecturer_id,
            day=constraint.day,
        )
    ]

    lecturer_lunch_constraints = [
        constraint
        for constraint in lecturer_lunch_constraints
        if not is_relaxation_allowed(
            allowed_relaxations,
            constraint_id=constraint.constraint_id,
            instance_type="lecturer",
            instance_id=constraint.lecturer_id,
            day=constraint.day,
        )
    ]

    return (
        active_capacity_sessions,
        active_equipment_sessions,
        cohort_daily_constraints,
        lecturer_daily_constraints,
        lecturer_lunch_constraints,
    )


# =====================================================================
# Mixed model
# =====================================================================

def build_mixed_recovery_solver_model(
    target_session,
    change_plan,
    other_sessions,
    rooms,
    lecturers,
    unavailability_rows,
    active_capacity_sessions,
    active_equipment_sessions,
    cohort_daily_constraints,
    lecturer_daily_constraints,
    lecturer_lunch_constraints,
    baseline_context,
    max_perturbations,
):
    if max_perturbations is None:
        raise ValueError("max_perturbations is required")

    if max_perturbations < 0:
        raise ValueError("max_perturbations must be >= 0")

    model = cp_model.CpModel()
    all_sessions = [*other_sessions, target_session]

    room_id_to_index, index_to_room_id = build_room_mappings(rooms)
    lecturer_id_to_index, index_to_lecturer_id = build_lecturer_mappings(
        lecturers
    )

    baseline_violation_keys = baseline_context["keys"]

    start_vars = {}
    room_vars = {}
    lecturer_vars = {}

    # -----------------------------------------------------------------
    # Variables
    # -----------------------------------------------------------------
    for session in all_sessions:
        duration = get_duration_slots(session)
        valid_start_slots = get_valid_start_slots(duration)

        start_vars[session.id] = model.NewIntVarFromDomain(
            cp_model.Domain.FromValues(valid_start_slots),
            f"mixed_start_{session.id}",
        )

        room_vars[session.id] = model.NewIntVar(
            0,
            len(rooms) - 1,
            f"mixed_room_{session.id}",
        )

        lecturer_vars[session.id] = model.NewIntVar(
            0,
            len(lecturers) - 1,
            f"mixed_lecturer_{session.id}",
        )

    # -----------------------------------------------------------------
    # Other sessions may move in time/room.
    # Lecturer is frozen.
    # One touched session = perturbation cost 1.
    # -----------------------------------------------------------------
    session_changed_vars = {}

    for session in other_sessions:
        session_id = session.id

        current_start = datetime_to_slot(session.start)
        current_room = room_id_to_index[session.room_id]
        current_lecturer = lecturer_id_to_index[session.lecturer_id]

        model.Add(
            lecturer_vars[session_id] == current_lecturer
        )

        time_changed = model.NewBoolVar(
            f"mixed_time_changed_{session_id}"
        )
        room_changed = model.NewBoolVar(
            f"mixed_room_changed_{session_id}"
        )
        session_changed = model.NewBoolVar(
            f"mixed_session_changed_{session_id}"
        )

        model.Add(
            start_vars[session_id] != current_start
        ).OnlyEnforceIf(time_changed)
        model.Add(
            start_vars[session_id] == current_start
        ).OnlyEnforceIf(time_changed.Not())

        model.Add(
            room_vars[session_id] != current_room
        ).OnlyEnforceIf(room_changed)
        model.Add(
            room_vars[session_id] == current_room
        ).OnlyEnforceIf(room_changed.Not())

        # session_changed <=> time_changed OR room_changed
        model.AddBoolOr([
            time_changed,
            room_changed,
        ]).OnlyEnforceIf(session_changed)

        model.AddBoolAnd([
            time_changed.Not(),
            room_changed.Not(),
        ]).OnlyEnforceIf(session_changed.Not())

        session_changed_vars[session_id] = session_changed

    # -----------------------------------------------------------------
    # Maximum perturbations selected by the user.
    # -----------------------------------------------------------------
    if session_changed_vars:
        model.Add(
            sum(session_changed_vars.values())
            <= max_perturbations
        )

    # -----------------------------------------------------------------
    # Force target request
    # -----------------------------------------------------------------
    target_id = target_session.id

    # TIME
    if change_plan["time"]["mode"] == ChangeMode.KEEP:
        model.Add(
            start_vars[target_id]
            == datetime_to_slot(target_session.start)
        )

    elif change_plan["time"]["mode"] == ChangeMode.SPECIFIC:
        requested_start = parse_requested_start(
            change_plan["time"]["target"]
        )
        model.Add(
            start_vars[target_id]
            == datetime_to_slot(requested_start)
        )

    elif change_plan["time"]["mode"] == ChangeMode.FIND:
        model.Add(
            start_vars[target_id]
            != datetime_to_slot(target_session.start)
        )

    # ROOM
    if change_plan["room"]["mode"] == ChangeMode.KEEP:
        model.Add(
            room_vars[target_id]
            == room_id_to_index[target_session.room_id]
        )

    elif change_plan["room"]["mode"] == ChangeMode.SPECIFIC:
        model.Add(
            room_vars[target_id]
            == room_id_to_index[change_plan["room"]["target"]]
        )

    elif (
        change_plan["room"]["mode"] == ChangeMode.FIND
        and target_session.room_id is not None
    ):
        model.Add(
            room_vars[target_id]
            != room_id_to_index[target_session.room_id]
        )

    # LECTURER
    if change_plan["lecturer"]["mode"] == ChangeMode.KEEP:
        model.Add(
            lecturer_vars[target_id]
            == lecturer_id_to_index[target_session.lecturer_id]
        )

    elif change_plan["lecturer"]["mode"] == ChangeMode.SPECIFIC:
        model.Add(
            lecturer_vars[target_id]
            == lecturer_id_to_index[
                change_plan["lecturer"]["target"]
            ]
        )

    elif change_plan["lecturer"]["mode"] == ChangeMode.FIND:
        model.Add(
            lecturer_vars[target_id]
            != lecturer_id_to_index[target_session.lecturer_id]
        )

    # -----------------------------------------------------------------
    # UNBREAKABLE constraints: always enforced.
    # -----------------------------------------------------------------
    add_room_no_overlap_constraint(
        model,
        all_sessions,
        start_vars,
        room_vars,
    )

    add_lecturer_no_overlap_constraint(
        model,
        all_sessions,
        start_vars,
        lecturer_vars,
    )

    add_lecturer_unavailability_constraint(
        model,
        all_sessions,
        start_vars,
        lecturer_vars,
        lecturer_id_to_index,
        unavailability_rows,
    )

    # -----------------------------------------------------------------
    # BREAKABLE constraints.
    #
    # The collections passed here have already had user-permitted
    # relaxation instances removed. Everything remaining is enforced
    # with the same baseline-aware semantics as perturbation-only.
    # -----------------------------------------------------------------
    add_baseline_aware_class_capacity_constraint(
        model,
        all_sessions,
        room_vars,
        rooms,
        active_capacity_sessions,
        baseline_violation_keys,
    )

    add_baseline_aware_class_equipment_constraint(
        model,
        all_sessions,
        room_vars,
        rooms,
        active_equipment_sessions,
        baseline_violation_keys,
    )

    add_baseline_aware_cohort_daily_hours_constraint(
        model,
        all_sessions,
        start_vars,
        cohort_daily_constraints,
        baseline_context,
    )

    add_baseline_aware_lecturer_daily_hours_constraint(
        model,
        all_sessions,
        start_vars,
        lecturer_vars,
        lecturer_id_to_index,
        lecturer_daily_constraints,
        baseline_context,
    )

    add_baseline_aware_lecturer_lunch_break_constraint(
        model,
        all_sessions,
        start_vars,
        lecturer_vars,
        lecturer_id_to_index,
        lecturer_lunch_constraints,
        baseline_violation_keys,
    )

    # -----------------------------------------------------------------
    # Objective: minimize number of OTHER sessions touched.
    # -----------------------------------------------------------------
    if session_changed_vars:
        model.Minimize(
            sum(session_changed_vars.values())
        )

    return (
        model,
        start_vars,
        room_vars,
        lecturer_vars,
        index_to_room_id,
        index_to_lecturer_id,
        room_id_to_index,
        session_changed_vars,
    )


# =====================================================================
# Solve
# =====================================================================

def solve_reschedule_mixed_recovery(
    request: RescheduleRequestIn,
    max_perturbations: int,
    allowed_relaxations,
    db,
):
    """
    Solve a mixed recovery request.

    `allowed_relaxations` should contain objects/dicts shaped like:

        {
            "constraint_id": "lecturer-lunch-break",
            "instance_type": "lecturer",
            "instance_id": "lecturer-3",
            "day": "monday"
        }

    NOTE:
    instance_id is the stakeholder/entity id expected by the solver,
    NOT the database constraint-instance row id.
    """

    if max_perturbations is None:
        return {
            "status": "invalid",
            "reason": "max_perturbations is required",
        }

    if max_perturbations < 0:
        return {
            "status": "invalid",
            "reason": "max_perturbations must be >= 0",
        }

    # -----------------------------------------------------------------
    # 1. Normal request validation
    # -----------------------------------------------------------------
    pre_solve = build_pre_solve_context(
        request,
        db,
    )

    if pre_solve["status"] != "ready":
        return pre_solve

    target_session: Session = pre_solve["target_session"]
    change_plan = pre_solve["change_plan"]
    other_sessions = pre_solve["other_sessions"]

    # -----------------------------------------------------------------
    # 2. Existing timetable must satisfy unbreakable constraints.
    # -----------------------------------------------------------------
    corruption = check_timetable_integrity(db)

    if corruption is not None:
        return corruption

    # -----------------------------------------------------------------
    # 3. Snapshot existing breakable violations BEFORE applying the
    #    user's new permissions.
    # -----------------------------------------------------------------
    baseline_violations = get_existing_breakable_violations(db)
    baseline_context = build_baseline_violation_context(
        baseline_violations
    )

    # -----------------------------------------------------------------
    # 4. Load active timetable data/constraints.
    # -----------------------------------------------------------------
    rooms = get_rooms(db)
    lecturers = get_lecturers(db)
    unavailability_rows = get_all_lecturer_unavailability(db)

    active_capacity_sessions = (
        get_active_class_capacity_sessions(db)
    )
    active_equipment_sessions = (
        get_active_class_equipment_sessions(db)
    )
    cohort_daily_constraints = (
        get_active_cohort_daily_hour_constraints(db)
    )
    lecturer_daily_constraints = (
        get_active_lecturer_daily_hour_constraints(db)
    )
    lecturer_lunch_constraints = (
        get_active_lecturer_lunch_constraints(db)
    )

    # -----------------------------------------------------------------
    # 5. Remove only user-permitted relaxation instances.
    # -----------------------------------------------------------------
    (
        active_capacity_sessions,
        active_equipment_sessions,
        cohort_daily_constraints,
        lecturer_daily_constraints,
        lecturer_lunch_constraints,
    ) = apply_allowed_relaxations(
        allowed_relaxations,
        active_capacity_sessions=active_capacity_sessions,
        active_equipment_sessions=active_equipment_sessions,
        cohort_daily_constraints=cohort_daily_constraints,
        lecturer_daily_constraints=lecturer_daily_constraints,
        lecturer_lunch_constraints=lecturer_lunch_constraints,
    )

    # -----------------------------------------------------------------
    # 6. Build mixed model.
    # -----------------------------------------------------------------
    (
        model,
        start_vars,
        room_vars,
        lecturer_vars,
        index_to_room_id,
        index_to_lecturer_id,
        room_id_to_index,
        session_changed_vars,
    ) = build_mixed_recovery_solver_model(
        target_session=target_session,
        change_plan=change_plan,
        other_sessions=other_sessions,
        rooms=rooms,
        lecturers=lecturers,
        unavailability_rows=unavailability_rows,
        active_capacity_sessions=active_capacity_sessions,
        active_equipment_sessions=active_equipment_sessions,
        cohort_daily_constraints=cohort_daily_constraints,
        lecturer_daily_constraints=lecturer_daily_constraints,
        lecturer_lunch_constraints=lecturer_lunch_constraints,
        baseline_context=baseline_context,
        max_perturbations=max_perturbations,
    )

    # -----------------------------------------------------------------
    # 7. Solve.
    # -----------------------------------------------------------------
    solver = cp_model.CpSolver()
    status = solver.Solve(model)

    if status not in (
        cp_model.OPTIMAL,
        cp_model.FEASIBLE,
    ):
        return {
            "status": "infeasible",
            "reason": (
                "No feasible mixed-recovery solution exists within "
                "the selected perturbation limit and permitted "
                "constraint relaxations."
            ),
            "diagnostics": None,
            "max_perturbations": max_perturbations,
            "allowed_relaxations": [
                _relaxation_to_dict(item)
                for item in (allowed_relaxations or [])
            ],
        }

    # -----------------------------------------------------------------
    # 8. Target result.
    # -----------------------------------------------------------------
    target_id = target_session.id
    solved_start_slot = solver.Value(
        start_vars[target_id]
    )
    solved_time = slot_to_day_time(
        solved_start_slot
    )

    # -----------------------------------------------------------------
    # 9. Collect perturbed sessions.
    # -----------------------------------------------------------------
    additional_changes = []

    for session in other_sessions:
        session_id = session.id

        if solver.Value(
            session_changed_vars[session_id]
        ) == 0:
            continue

        solved_start = solver.Value(
            start_vars[session_id]
        )
        solved_room_index = solver.Value(
            room_vars[session_id]
        )

        original_start = datetime_to_slot(
            session.start
        )
        original_room_index = room_id_to_index[
            session.room_id
        ]

        solved_session_time = slot_to_day_time(
            solved_start
        )

        additional_changes.append({
            "session_id": session_id,
            "time_changed": (
                solved_start != original_start
            ),
            "old_start_slot": original_start,
            "new_start_slot": solved_start,
            "old_day": (
                session.start
                .strftime("%A")
                .lower()
            ),
            "old_time": (
                session.start
                .strftime("%H:%M")
            ),
            "new_day": solved_session_time["day"],
            "new_time": solved_session_time["time"],
            "room_changed": (
                solved_room_index
                != original_room_index
            ),
            "old_room_id": session.room_id,
            "new_room_id": index_to_room_id[
                solved_room_index
            ],
        })

    # -----------------------------------------------------------------
    # 10. Work out which permitted relaxations were actually used.
    # -----------------------------------------------------------------
    used_relaxations = get_used_relaxations(
        solver=solver,
        all_sessions=[*other_sessions, target_session],
        rooms=rooms,
        start_vars=start_vars,
        room_vars=room_vars,
        index_to_room_id=index_to_room_id,
        allowed_relaxations=allowed_relaxations,
        baseline_context=baseline_context,
    )

    # -----------------------------------------------------------------
    # 11. Return.
    # -----------------------------------------------------------------
    return {
        "status": "feasible",
        "reason": None,
        "session_id": target_id,
        "start_slot": solved_start_slot,
        "day": solved_time["day"],
        "time": solved_time["time"],
        "room_id": index_to_room_id[
            solver.Value(
                room_vars[target_id]
            )
        ],
        "lecturer_id": index_to_lecturer_id[
            solver.Value(
                lecturer_vars[target_id]
            )
        ],
        "additional_changes": additional_changes,
        "perturbation_count": len(
            additional_changes
        ),
        "max_perturbations": max_perturbations,
        "allowed_relaxations": [
            _relaxation_to_dict(item)
            for item in (allowed_relaxations or [])
        ],
        "used_relaxations": used_relaxations,
        "relaxation_count": len(used_relaxations),
    }



def get_used_relaxations(
    *,
    solver,
    all_sessions,
    rooms,
    start_vars,
    room_vars,
    index_to_room_id,
    allowed_relaxations,
    baseline_context,
):
    """
    Return only permitted relaxations that the final solution actually uses.

    Existing grandfathered violations do NOT count as newly used relaxations.
    """
    if not allowed_relaxations:
        return []

    rooms_by_id = {room.id: room for room in rooms}
    sessions_by_id = {session.id: session for session in all_sessions}
    baseline_keys = baseline_context["keys"]
    lecturer_baseline_limits = baseline_context["lecturer_daily_limits"]
    cohort_baseline_limits = baseline_context["cohort_daily_limits"]

    solved_start = {
        session.id: solver.Value(start_vars[session.id])
        for session in all_sessions
    }
    solved_room_id = {
        session.id: index_to_room_id[solver.Value(room_vars[session.id])]
        for session in all_sessions
    }

    used = []

    for item in allowed_relaxations:
        relaxation = _relaxation_to_dict(item)
        constraint_id = relaxation["constraint_id"]
        instance_type = relaxation["instance_type"]
        instance_id = relaxation["instance_id"]
        day = relaxation["day"]

        actually_used = False

        # -------------------------------------------------------------
        # Session capacity
        # -------------------------------------------------------------
        if (
            constraint_id == "class-capacity"
            and instance_type == "session"
        ):
            session = sessions_by_id.get(instance_id)

            if session is not None:
                room_id = solved_room_id[session.id]
                room = rooms_by_id.get(room_id)
                required_capacity = session.module.required_capacity

                if (
                    room is not None
                    and required_capacity is not None
                    and room.capacity < required_capacity
                ):
                    baseline_key = (
                        "class_capacity",
                        session.id,
                        room_id,
                    )
                    actually_used = baseline_key not in baseline_keys

        # -------------------------------------------------------------
        # Session equipment
        # -------------------------------------------------------------
        elif (
            constraint_id == "class-equipment"
            and instance_type == "session"
        ):
            session = sessions_by_id.get(instance_id)

            if session is not None and session.module.required_equipment:
                room_id = solved_room_id[session.id]
                room = rooms_by_id.get(room_id)

                if room is not None:
                    required = {
                        value.strip().lower()
                        for value in session.module.required_equipment.split(",")
                        if value.strip()
                    }
                    available = {
                        value.strip().lower()
                        for value in (room.equipment or "").split(",")
                        if value.strip()
                    }

                    if required - available:
                        baseline_key = (
                            "class_equipment",
                            session.id,
                            room_id,
                        )
                        actually_used = baseline_key not in baseline_keys

        # -------------------------------------------------------------
        # Cohort daily hours
        # -------------------------------------------------------------
        elif (
            constraint_id == "cohort-max-teaching-hours-per-day"
            and instance_type == "cohort"
            and day is not None
        ):
            day_key = day.lower()
            day_index = DAY_TO_INDEX[day_key]

            total_hours = sum(
                get_duration_slots(session)
                for session in all_sessions
                if (
                    any(
                        cohort.id == instance_id
                        for cohort in session.cohorts
                    )
                    and solved_start[session.id] // SLOTS_PER_DAY == day_index
                )
            )

            allowed_limit = cohort_baseline_limits.get(
                (instance_id, day_key),
                COHORT_MAX_HOURS_PER_DAY,
            )
            actually_used = total_hours > allowed_limit

        # -------------------------------------------------------------
        # Lecturer daily hours
        # -------------------------------------------------------------
        elif (
            constraint_id == "lecturer-max-one-hour-per-day"
            and instance_type == "lecturer"
            and day is not None
        ):
            day_key = day.lower()
            day_index = DAY_TO_INDEX[day_key]

            total_hours = sum(
                get_duration_slots(session)
                for session in all_sessions
                if (
                    session.lecturer_id == instance_id
                    and solved_start[session.id] // SLOTS_PER_DAY == day_index
                )
            )

            allowed_limit = lecturer_baseline_limits.get(
                (instance_id, day_key),
                LECTURER_MAX_HOURS_PER_DAY,
            )
            actually_used = total_hours > allowed_limit

        # -------------------------------------------------------------
        # Lecturer lunch break
        # -------------------------------------------------------------
        elif (
            constraint_id == "lecturer-lunch-break"
            and instance_type == "lecturer"
            and day is not None
        ):
            day_key = day.lower()
            baseline_key = (
                "lecturer_lunch_break",
                instance_id,
                day_key,
            )

            # If this lecturer/day was already grandfathered, the mixed
            # solve did not need the newly permitted relaxation.
            if baseline_key not in baseline_keys:
                lunch_12_start = day_time_to_slot(day_key, "12:00")
                lunch_13_start = day_time_to_slot(day_key, "13:00")

                blocks_12 = False
                blocks_13 = False

                for session in all_sessions:
                    if session.lecturer_id != instance_id:
                        continue

                    start = solved_start[session.id]
                    end = start + get_duration_slots(session)

                    if start < lunch_12_start + 1 and lunch_12_start < end:
                        blocks_12 = True

                    if start < lunch_13_start + 1 and lunch_13_start < end:
                        blocks_13 = True

                actually_used = blocks_12 and blocks_13

        if actually_used:
            used.append(relaxation)

    return used



def _relaxation_to_dict(item):
    return {
        "constraint_id": _value(item, "constraint_id"),
        "instance_type": _value(item, "instance_type"),
        "instance_id": _value(item, "instance_id"),
        "day": _value(item, "day"),
    }

