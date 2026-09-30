from ortools.sat.python import cp_model

from app.schemas import ChangeMode, RescheduleRequestIn
from app.models import Session
from app.solver.timetable_impact import evaluate_timetable_change

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
# Protected-constraint helpers
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


def is_constraint_protected(
    protected_constraints,
    *,
    constraint_id,
    instance_type,
    instance_id,
    day=None,
):
    """True when this exact relaxable constraint instance must stay enforced."""
    for item in protected_constraints or []:
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


def apply_protected_constraints(
    protected_constraints,
    *,
    active_capacity_sessions,
    active_equipment_sessions,
    cohort_daily_constraints,
    lecturer_daily_constraints,
    lecturer_lunch_constraints,
):
    """
    Keep only explicitly protected relaxable instances in the CP-SAT model.
    Unprotected relaxable instances may therefore be violated if necessary.
    """
    active_capacity_sessions = {
        session_id
        for session_id in active_capacity_sessions
        if is_constraint_protected(
            protected_constraints,
            constraint_id="class-capacity",
            instance_type="session",
            instance_id=session_id,
            day=None,
        )
    }

    active_equipment_sessions = {
        session_id
        for session_id in active_equipment_sessions
        if is_constraint_protected(
            protected_constraints,
            constraint_id="class-equipment",
            instance_type="session",
            instance_id=session_id,
            day=None,
        )
    }

    cohort_daily_constraints = [
        constraint
        for constraint in cohort_daily_constraints
        if is_constraint_protected(
            protected_constraints,
            constraint_id=constraint.constraint_id,
            instance_type="cohort",
            instance_id=constraint.cohort_id,
            day=constraint.day,
        )
    ]

    lecturer_daily_constraints = [
        constraint
        for constraint in lecturer_daily_constraints
        if is_constraint_protected(
            protected_constraints,
            constraint_id=constraint.constraint_id,
            instance_type="lecturer",
            instance_id=constraint.lecturer_id,
            day=constraint.day,
        )
    ]

    lecturer_lunch_constraints = [
        constraint
        for constraint in lecturer_lunch_constraints
        if is_constraint_protected(
            protected_constraints,
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

def _relaxation_key(constraint_id, instance_type, instance_id, day=None):
    return (
        constraint_id,
        instance_type,
        instance_id,
        day.lower() if isinstance(day, str) else day,
    )


def _new_relaxation_var(
    model,
    relaxation_vars,
    relaxation_metadata,
    protected_constraints,
    *,
    constraint_id,
    instance_type,
    instance_id,
    day=None,
):
    """
    Create one Boolean per relaxable constraint instance.

    0 = the constraint remains enforced.
    1 = the solver may violate this constraint.

    Protected instances are fixed to 0.
    """
    key = _relaxation_key(
        constraint_id,
        instance_type,
        instance_id,
        day,
    )

    if key in relaxation_vars:
        return relaxation_vars[key]

    safe_day = (day or "all").replace(" ", "_")
    var = model.NewBoolVar(
        "mixed_relax_"
        f"{constraint_id}_{instance_type}_{instance_id}_{safe_day}"
    )

    print(
        "\n[MIXED PROTECTION CHECK]",
        {
            "candidate": {
                "constraint_id": constraint_id,
                "instance_type": instance_type,
                "instance_id": instance_id,
                "day": day,
            },
            "protected_constraints": [
                _constraint_to_dict(p)
                for p in (protected_constraints or [])
            ],
        },
    )

    if is_constraint_protected(
        protected_constraints,
        constraint_id=constraint_id,
        instance_type=instance_type,
        instance_id=instance_id,
        day=day,
    ):
        model.Add(var == 0)

    relaxation_vars[key] = var
    relaxation_metadata[key] = {
        "constraint_id": constraint_id,
        "instance_type": instance_type,
        "instance_id": instance_id,
        "day": day,
    }
    return var


def _add_relaxable_capacity_constraints(
    model,
    all_sessions,
    room_vars,
    rooms,
    active_capacity_sessions,
    baseline_violation_keys,
    protected_constraints,
    relaxation_vars,
    relaxation_metadata,
):
    sessions_by_id = {session.id: session for session in all_sessions}

    for session_id in active_capacity_sessions:
        session = sessions_by_id.get(session_id)
        if session is None:
            continue

        required_capacity = session.module.required_capacity
        if required_capacity is None:
            continue

        relax_var = _new_relaxation_var(
            model,
            relaxation_vars,
            relaxation_metadata,
            protected_constraints,
            constraint_id="class-capacity",
            instance_type="session",
            instance_id=session_id,
            day=None,
        )

        for room_index, room in enumerate(rooms):
            normally_valid = room.capacity >= required_capacity
            baseline_key = ("class_capacity", session_id, room.id)
            grandfathered = baseline_key in baseline_violation_keys

            if normally_valid or grandfathered:
                continue

            # An invalid NEW room assignment is possible only when this
            # exact capacity constraint is relaxed.
            model.Add(
                room_vars[session_id] != room_index
            ).OnlyEnforceIf(relax_var.Not())


def _add_relaxable_equipment_constraints(
    model,
    all_sessions,
    room_vars,
    rooms,
    active_equipment_sessions,
    baseline_violation_keys,
    protected_constraints,
    relaxation_vars,
    relaxation_metadata,
):
    sessions_by_id = {session.id: session for session in all_sessions}

    for session_id in active_equipment_sessions:
        session = sessions_by_id.get(session_id)
        if session is None or not session.module.required_equipment:
            continue

        required = {
            value.strip().lower()
            for value in session.module.required_equipment.split(",")
            if value.strip()
        }

        relax_var = _new_relaxation_var(
            model,
            relaxation_vars,
            relaxation_metadata,
            protected_constraints,
            constraint_id="class-equipment",
            instance_type="session",
            instance_id=session_id,
            day=None,
        )

        for room_index, room in enumerate(rooms):
            available = {
                value.strip().lower()
                for value in (room.equipment or "").split(",")
                if value.strip()
            }

            normally_valid = required.issubset(available)
            baseline_key = ("class_equipment", session_id, room.id)
            grandfathered = baseline_key in baseline_violation_keys

            if normally_valid or grandfathered:
                continue

            model.Add(
                room_vars[session_id] != room_index
            ).OnlyEnforceIf(relax_var.Not())


def _add_relaxable_cohort_daily_constraints(
    model,
    all_sessions,
    start_vars,
    cohort_daily_constraints,
    baseline_context,
    protected_constraints,
    relaxation_vars,
    relaxation_metadata,
):
    baseline_limits = baseline_context["cohort_daily_limits"]

    for constraint in cohort_daily_constraints:
        if constraint.day is None:
            continue

        cohort_id = constraint.cohort_id
        day = constraint.day.lower()
        day_index = DAY_TO_INDEX[day]
        allowed_limit = baseline_limits.get(
            (cohort_id, day),
            COHORT_MAX_HOURS_PER_DAY,
        )

        relax_var = _new_relaxation_var(
            model,
            relaxation_vars,
            relaxation_metadata,
            protected_constraints,
            constraint_id=constraint.constraint_id,
            instance_type="cohort",
            instance_id=cohort_id,
            day=constraint.day,
        )

        terms = []

        for session in all_sessions:
            if not any(
                cohort.id == cohort_id
                for cohort in session.cohorts
            ):
                continue

            session_day = model.NewIntVar(
                0,
                4,
                f"mixed_cohort_day_{session.id}_{cohort_id}_{day}",
            )
            is_on_day = model.NewBoolVar(
                f"mixed_cohort_on_day_{session.id}_{cohort_id}_{day}"
            )

            model.AddDivisionEquality(
                session_day,
                start_vars[session.id],
                SLOTS_PER_DAY,
            )
            model.Add(
                session_day == day_index
            ).OnlyEnforceIf(is_on_day)
            model.Add(
                session_day != day_index
            ).OnlyEnforceIf(is_on_day.Not())

            terms.append(get_duration_slots(session) * is_on_day)

        if terms:
            model.Add(
                sum(terms) <= allowed_limit
            ).OnlyEnforceIf(relax_var.Not())


def _add_relaxable_lecturer_daily_constraints(
    model,
    all_sessions,
    start_vars,
    lecturer_vars,
    lecturer_id_to_index,
    lecturer_daily_constraints,
    baseline_context,
    protected_constraints,
    relaxation_vars,
    relaxation_metadata,
):
    baseline_limits = baseline_context["lecturer_daily_limits"]

    for constraint in lecturer_daily_constraints:
        if constraint.day is None:
            continue

        lecturer_id = constraint.lecturer_id
        if lecturer_id not in lecturer_id_to_index:
            continue

        lecturer_index = lecturer_id_to_index[lecturer_id]
        day = constraint.day.lower()
        day_index = DAY_TO_INDEX[day]
        allowed_limit = baseline_limits.get(
            (lecturer_id, day),
            LECTURER_MAX_HOURS_PER_DAY,
        )

        relax_var = _new_relaxation_var(
            model,
            relaxation_vars,
            relaxation_metadata,
            protected_constraints,
            constraint_id=constraint.constraint_id,
            instance_type="lecturer",
            instance_id=lecturer_id,
            day=constraint.day,
        )

        terms = []

        for session in all_sessions:
            assigned = model.NewBoolVar(
                f"mixed_daily_assigned_{session.id}_{lecturer_id}_{day}"
            )
            session_day = model.NewIntVar(
                0,
                4,
                f"mixed_daily_day_{session.id}_{lecturer_id}_{day}",
            )
            is_on_day = model.NewBoolVar(
                f"mixed_daily_on_day_{session.id}_{lecturer_id}_{day}"
            )
            counts = model.NewBoolVar(
                f"mixed_daily_counts_{session.id}_{lecturer_id}_{day}"
            )

            model.Add(
                lecturer_vars[session.id] == lecturer_index
            ).OnlyEnforceIf(assigned)
            model.Add(
                lecturer_vars[session.id] != lecturer_index
            ).OnlyEnforceIf(assigned.Not())

            model.AddDivisionEquality(
                session_day,
                start_vars[session.id],
                SLOTS_PER_DAY,
            )
            model.Add(
                session_day == day_index
            ).OnlyEnforceIf(is_on_day)
            model.Add(
                session_day != day_index
            ).OnlyEnforceIf(is_on_day.Not())

            model.AddBoolAnd([
                assigned,
                is_on_day,
            ]).OnlyEnforceIf(counts)
            model.AddBoolOr([
                assigned.Not(),
                is_on_day.Not(),
            ]).OnlyEnforceIf(counts.Not())

            terms.append(get_duration_slots(session) * counts)

        if terms:
            model.Add(
                sum(terms) <= allowed_limit
            ).OnlyEnforceIf(relax_var.Not())


def _add_relaxable_lecturer_lunch_constraints(
    model,
    all_sessions,
    start_vars,
    lecturer_vars,
    lecturer_id_to_index,
    lecturer_lunch_constraints,
    baseline_violation_keys,
    protected_constraints,
    relaxation_vars,
    relaxation_metadata,
):
    """
    Preserve the existing baseline-aware lunch semantics:
    an already-existing lunch violation is grandfathered and therefore
    does not count as a new relaxation.

    Otherwise, at least one of 12:00-13:00 or 13:00-14:00 must remain
    free unless the corresponding relaxation variable is activated.
    """
    lunch_vars = {}

    for constraint in lecturer_lunch_constraints:
        if constraint.day is None:
            continue

        lecturer_id = constraint.lecturer_id
        if lecturer_id not in lecturer_id_to_index:
            continue

        day = constraint.day.lower()
        baseline_key = ("lecturer_lunch_break", lecturer_id, day)

        # Existing violation may remain without consuming a new relaxation.
        if baseline_key in baseline_violation_keys:
            continue

        lecturer_index = lecturer_id_to_index[lecturer_id]
        relax_var = _new_relaxation_var(
            model,
            relaxation_vars,
            relaxation_metadata,
            protected_constraints,
            constraint_id=constraint.constraint_id,
            instance_type="lecturer",
            instance_id=lecturer_id,
            day=constraint.day,
        )

        lunch_slots = [
            day_time_to_slot(day, "12:00"),
            day_time_to_slot(day, "13:00"),
        ]
        blocked_vars = []

        for lunch_slot in lunch_slots:
            blockers = []

            for session in all_sessions:
                duration = get_duration_slots(session)

                assigned = model.NewBoolVar(
                    f"mixed_lunch_assigned_{session.id}_{lecturer_id}_{day}_{lunch_slot}"
                )
                model.Add(
                    lecturer_vars[session.id] == lecturer_index
                ).OnlyEnforceIf(assigned)
                model.Add(
                    lecturer_vars[session.id] != lecturer_index
                ).OnlyEnforceIf(assigned.Not())

                possible_starts = [
                    start
                    for start in get_valid_start_slots(duration)
                    if start <= lunch_slot < start + duration
                ]

                if not possible_starts:
                    continue

                overlaps = model.NewBoolVar(
                    f"mixed_lunch_overlap_{session.id}_{day}_{lunch_slot}"
                )
                model.AddAllowedAssignments(
                    [start_vars[session.id]],
                    [[start] for start in possible_starts],
                ).OnlyEnforceIf(overlaps)
                model.AddForbiddenAssignments(
                    [start_vars[session.id]],
                    [[start] for start in possible_starts],
                ).OnlyEnforceIf(overlaps.Not())

                blocks = model.NewBoolVar(
                    f"mixed_lunch_blocks_{session.id}_{lecturer_id}_{day}_{lunch_slot}"
                )
                model.AddBoolAnd([
                    assigned,
                    overlaps,
                ]).OnlyEnforceIf(blocks)
                model.AddBoolOr([
                    assigned.Not(),
                    overlaps.Not(),
                ]).OnlyEnforceIf(blocks.Not())
                blockers.append(blocks)

            blocked = model.NewBoolVar(
                f"mixed_lunch_slot_blocked_{lecturer_id}_{day}_{lunch_slot}"
            )

            if blockers:
                model.AddMaxEquality(blocked, blockers)
            else:
                model.Add(blocked == 0)

            blocked_vars.append(blocked)

        # If not relaxed, both lunch hours may not be blocked.
        model.Add(
            sum(blocked_vars) <= 1
        ).OnlyEnforceIf(relax_var.Not())

        # Keep a lunch-slot variable for the quality objective.
        # When the lunch constraint is enforced, this slot must be free.
        lunch_start = model.NewIntVarFromDomain(
            cp_model.Domain.FromValues(lunch_slots),
            f"mixed_lunch_choice_{lecturer_id}_{day}",
        )

        choose_first = model.NewBoolVar(
            f"mixed_choose_lunch_12_{lecturer_id}_{day}"
        )
        choose_second = model.NewBoolVar(
            f"mixed_choose_lunch_13_{lecturer_id}_{day}"
        )

        model.Add(lunch_start == lunch_slots[0]).OnlyEnforceIf(choose_first)
        model.Add(lunch_start != lunch_slots[0]).OnlyEnforceIf(choose_first.Not())
        model.Add(lunch_start == lunch_slots[1]).OnlyEnforceIf(choose_second)
        model.Add(lunch_start != lunch_slots[1]).OnlyEnforceIf(choose_second.Not())

        # If the lunch constraint is active, the chosen lunch slot must
        # be one of the free lunch hours.
        model.Add(blocked_vars[0] == 0).OnlyEnforceIf(
            [relax_var.Not(), choose_first]
        )
        model.Add(blocked_vars[1] == 0).OnlyEnforceIf(
            [relax_var.Not(), choose_second]
        )

        lunch_vars[(lecturer_id, DAY_TO_INDEX[day])] = (
            lunch_start,
            relax_var,
        )

    return lunch_vars


def add_mixed_quality_objective(
    model,
    target_session,
    change_plan,
    all_sessions,
    rooms,
    start_vars,
    room_vars,
    lecturer_vars,
    lecturer_id_to_index,
    active_capacity_sessions,
    objective_weights,
    lunch_vars,
):
    """Build the four weighted timetable-quality terms for mixed recovery.

    Unlike normal rescheduling, mixed recovery can change OTHER sessions even
    when the target field is KEEP or SPECIFIC, so quality terms are evaluated
    from the final recovered timetable rather than activated by FIND modes.
    """
    target_id = target_session.id
    # ==============================================================
    # ONE weighted objective
    #
    # objective_score =
    #     user room_waste weight * room capacity waste
    #   + user cohort_gaps weight * cohort timetable gaps
    #   + user lecturer_idle weight * lecturer idle time
    #   + user cohort_room_changes weight * cohort back-to-back room changes
    # ==============================================================

    # User-selected soft-objective weights (0-100).
    # Disabled frontend objectives are sent as weight 0.
    ROOM_WASTE_WEIGHT = objective_weights.room_waste
    COHORT_GAP_WEIGHT = objective_weights.cohort_gaps
    LECTURER_IDLE_WEIGHT = objective_weights.lecturer_idle
    COHORT_ROOM_CHANGE_WEIGHT = objective_weights.cohort_room_changes

    objective_terms = []

    # Keep references to the individual objective variables so their
    # solved values can be printed in solve_reschedule().
    objective_debug_vars = {
        "room_waste": None,
        "cohort_gap_penalty": None,
        "lecturer_idle_penalty": None,
        "cohort_room_change_penalty": None,
    }

    # ==============================================================
    # Objective term 1: room capacity waste
    # ==============================================================

    # Mixed recovery can move rooms for OTHER sessions even when the target
    # room is KEEP/SPECIFIC. Therefore room waste must be evaluated from the
    # final recovered timetable, not gated by the target request mode.
    room_waste_vars = []

    for session in all_sessions:
        if session.id not in active_capacity_sessions:
            continue

        required_capacity = session.module.required_capacity
        if required_capacity is None:
            continue

        # Capacity may itself be relaxed in mixed recovery. Clamp at zero so
        # an undersized room is never rewarded as "negative waste".
        room_wastes = [
            max(0, room.capacity - required_capacity)
            for room in rooms
        ]

        room_waste = model.NewIntVar(
            min(room_wastes),
            max(room_wastes),
            f"room_capacity_waste_{session.id}",
        )
        model.AddElement(
            room_vars[session.id],
            room_wastes,
            room_waste,
        )
        room_waste_vars.append(room_waste)

    if room_waste_vars:
        max_total_room_waste = sum(
            max(0, max(room.capacity - session.module.required_capacity for room in rooms))
            for session in all_sessions
            if session.id in active_capacity_sessions
            and session.module.required_capacity is not None
        )
        total_room_waste = model.NewIntVar(
            0,
            max_total_room_waste,
            "mixed_total_room_capacity_waste",
        )
        model.Add(total_room_waste == sum(room_waste_vars))
        objective_debug_vars["room_waste"] = total_room_waste
        objective_terms.append(ROOM_WASTE_WEIGHT * total_room_waste)

    # ==============================================================
    # Objective term 2: cohort timetable gaps
    #
    # A gap is an empty one-hour slot that has:
    #   - at least one class before it that day
    #   - at least one class after it that day
    #
    # We calculate this for every cohort attached to the target
    # session.
    #
    # Because this is built from start_vars, it also remains correct
    # when cascading recovery allows other sessions to move.
    # ==============================================================

    # Mixed recovery may move other sessions even for a SPECIFIC/KEEP target.
    # Always score the final timetable for the target cohort(s).
    cohort_gap_active = True

    if cohort_gap_active:

        target_cohort_ids = {
            cohort.id
            for cohort in target_session.cohorts
        }

        cohort_gap_vars = []

        # Valid teaching slots within a day.
        #
        # Your current model uses:
        #   first_slot = day * SLOTS_PER_DAY + 1
        #
        # so we use the same representation here rather than
        # changing the timetable indexing behaviour.
        for cohort_id in target_cohort_ids:

            cohort_sessions = [
                session
                for session in all_sessions
                if any(
                    cohort.id == cohort_id
                    for cohort in session.cohorts
                )
            ]

            if not cohort_sessions:
                continue

            for day_index in range(5):

                day_first_slot = (
                    day_index * SLOTS_PER_DAY + 1
                )

                day_last_slot = (
                    day_first_slot
                    + SLOTS_PER_DAY
                    - 1
                )

                occupied_vars = {}

                # --------------------------------------------------
                # Determine whether each hour is occupied
                # --------------------------------------------------

                for slot in range(
                    day_first_slot,
                    day_last_slot + 1,
                ):
                    covering_vars = []

                    for session in cohort_sessions:
                        duration = get_duration_slots(session)

                        valid_starts = get_valid_start_slots(
                            duration
                        )

                        starts_covering_slot = [
                            start
                            for start in valid_starts
                            if (
                                start <= slot
                                and slot < start + duration
                                and (
                                    start // SLOTS_PER_DAY
                                    == day_index
                                )
                            )
                        ]

                        if not starts_covering_slot:
                            continue

                        covers_slot = model.NewBoolVar(
                            f"covers_"
                            f"{cohort_id}_"
                            f"{session.id}_"
                            f"{slot}"
                        )

                        # covers_slot is true exactly when the
                        # session starts at one of the positions
                        # that would make it occupy this slot.
                        allowed_rows = [
                            [start, 1]
                            if start in starts_covering_slot
                            else [start, 0]
                            for start in valid_starts
                        ]

                        model.AddAllowedAssignments(
                            [
                                start_vars[session.id],
                                covers_slot,
                            ],
                            allowed_rows,
                        )

                        covering_vars.append(covers_slot)

                    occupied = model.NewBoolVar(
                        f"occupied_{cohort_id}_{slot}"
                    )

                    if covering_vars:
                        # occupied = OR(covering_vars)
                        model.AddBoolOr(
                            covering_vars
                        ).OnlyEnforceIf(occupied)

                        model.AddBoolAnd([
                            var.Not()
                            for var in covering_vars
                        ]).OnlyEnforceIf(
                            occupied.Not()
                        )
                    else:
                        model.Add(occupied == 0)

                    occupied_vars[slot] = occupied

                # --------------------------------------------------
                # Determine which empty slots are genuine gaps
                # --------------------------------------------------

                slots = list(occupied_vars.keys())

                for slot_index, slot in enumerate(slots):

                    # First and last possible slots cannot be
                    # internal gaps unless there are classes on
                    # both sides, which is impossible at the edge.
                    if slot_index == 0:
                        continue

                    if slot_index == len(slots) - 1:
                        continue

                    before_slots = slots[:slot_index]
                    after_slots = slots[slot_index + 1:]

                    has_class_before = model.NewBoolVar(
                        f"has_before_{cohort_id}_{slot}"
                    )

                    has_class_after = model.NewBoolVar(
                        f"has_after_{cohort_id}_{slot}"
                    )

                    # has_class_before =
                    # OR(all occupied slots before this slot)
                    before_vars = [
                        occupied_vars[s]
                        for s in before_slots
                    ]

                    model.AddBoolOr(
                        before_vars
                    ).OnlyEnforceIf(
                        has_class_before
                    )

                    model.AddBoolAnd([
                        var.Not()
                        for var in before_vars
                    ]).OnlyEnforceIf(
                        has_class_before.Not()
                    )

                    # has_class_after =
                    # OR(all occupied slots after this slot)
                    after_vars = [
                        occupied_vars[s]
                        for s in after_slots
                    ]

                    model.AddBoolOr(
                        after_vars
                    ).OnlyEnforceIf(
                        has_class_after
                    )

                    model.AddBoolAnd([
                        var.Not()
                        for var in after_vars
                    ]).OnlyEnforceIf(
                        has_class_after.Not()
                    )

                    gap = model.NewBoolVar(
                        f"gap_{cohort_id}_{slot}"
                    )

                    # gap =
                    #   NOT occupied
                    #   AND class before
                    #   AND class after
                    model.AddBoolAnd([
                        occupied_vars[slot].Not(),
                        has_class_before,
                        has_class_after,
                    ]).OnlyEnforceIf(gap)

                    # Reverse implication:
                    #
                    # if gap is false, at least one of:
                    #   occupied
                    #   no class before
                    #   no class after
                    #
                    # must hold.
                    model.AddBoolOr([
                        occupied_vars[slot],
                        has_class_before.Not(),
                        has_class_after.Not(),
                    ]).OnlyEnforceIf(
                        gap.Not()
                    )

                    cohort_gap_vars.append(gap)

        if cohort_gap_vars:
            cohort_gap_penalty = model.NewIntVar(
                0,
                len(cohort_gap_vars),
                f"cohort_gap_penalty_{target_id}",
            )

            model.Add(
                cohort_gap_penalty
                == sum(cohort_gap_vars)
            )

            objective_debug_vars["cohort_gap_penalty"] = cohort_gap_penalty

            objective_terms.append(
                COHORT_GAP_WEIGHT
                * cohort_gap_penalty
            )

    # ==============================================================
    # Objective term 3: lecturer idle time
    #
    # Empty slots between a lecturer's classes are penalized.
    # If an active lunch-break constraint selected that slot as lunch,
    # the slot is excluded from the idle-time penalty.
    # ==============================================================

    # Cascading time changes can alter lecturer idle time regardless of the
    # target request mode, so always evaluate it in mixed recovery.
    lecturer_idle_active = True

    if lecturer_idle_active:
        lecturer_idle_vars = []

        for lecturer_id, lecturer_index in lecturer_id_to_index.items():
            for day_index in range(5):
                day_first_slot = day_index * SLOTS_PER_DAY + 1
                day_last_slot = day_first_slot + SLOTS_PER_DAY - 1
                occupied_vars = {}

                for slot in range(day_first_slot, day_last_slot + 1):
                    covering_vars = []

                    for session in all_sessions:
                        duration = get_duration_slots(session)
                        valid_starts = get_valid_start_slots(duration)
                        starts_covering_slot = [
                            start for start in valid_starts
                            if start <= slot < start + duration
                            and start // SLOTS_PER_DAY == day_index
                        ]
                        if not starts_covering_slot:
                            continue

                        assigned = model.NewBoolVar(
                            f"idle_assigned_{lecturer_id}_{session.id}_{slot}"
                        )
                        model.Add(
                            lecturer_vars[session.id] == lecturer_index
                        ).OnlyEnforceIf(assigned)
                        model.Add(
                            lecturer_vars[session.id] != lecturer_index
                        ).OnlyEnforceIf(assigned.Not())

                        starts_here = model.NewBoolVar(
                            f"idle_covers_time_{lecturer_id}_{session.id}_{slot}"
                        )
                        model.AddAllowedAssignments(
                            [start_vars[session.id], starts_here],
                            [
                                [start, 1 if start in starts_covering_slot else 0]
                                for start in valid_starts
                            ],
                        )

                        covers = model.NewBoolVar(
                            f"idle_covers_{lecturer_id}_{session.id}_{slot}"
                        )
                        model.AddBoolAnd([assigned, starts_here]).OnlyEnforceIf(covers)
                        model.AddBoolOr(
                            [assigned.Not(), starts_here.Not()]
                        ).OnlyEnforceIf(covers.Not())
                        covering_vars.append(covers)

                    occupied = model.NewBoolVar(
                        f"lecturer_occupied_{lecturer_id}_{slot}"
                    )
                    if covering_vars:
                        model.AddBoolOr(covering_vars).OnlyEnforceIf(occupied)
                        model.AddBoolAnd(
                            [v.Not() for v in covering_vars]
                        ).OnlyEnforceIf(occupied.Not())
                    else:
                        model.Add(occupied == 0)

                    occupied_vars[slot] = occupied

                slots = list(occupied_vars.keys())
                for slot_index, slot in enumerate(slots):
                    if slot_index == 0 or slot_index == len(slots) - 1:
                        continue

                    before_vars = [occupied_vars[s] for s in slots[:slot_index]]
                    after_vars = [occupied_vars[s] for s in slots[slot_index + 1:]]

                    has_before = model.NewBoolVar(
                        f"lecturer_has_before_{lecturer_id}_{slot}"
                    )
                    has_after = model.NewBoolVar(
                        f"lecturer_has_after_{lecturer_id}_{slot}"
                    )

                    model.AddBoolOr(before_vars).OnlyEnforceIf(has_before)
                    model.AddBoolAnd(
                        [v.Not() for v in before_vars]
                    ).OnlyEnforceIf(has_before.Not())

                    model.AddBoolOr(after_vars).OnlyEnforceIf(has_after)
                    model.AddBoolAnd(
                        [v.Not() for v in after_vars]
                    ).OnlyEnforceIf(has_after.Not())

                    is_lunch = model.NewBoolVar(
                        f"is_lunch_{lecturer_id}_{slot}"
                    )
                    lunch_info = lunch_vars.get((lecturer_id, day_index))

                    if lunch_info is None:
                        model.Add(is_lunch == 0)
                    else:
                        lunch_var, lunch_relaxed = lunch_info
                        lunch_matches = model.NewBoolVar(
                            f"mixed_lunch_matches_{lecturer_id}_{slot}"
                        )
                        model.Add(lunch_var == slot).OnlyEnforceIf(lunch_matches)
                        model.Add(lunch_var != slot).OnlyEnforceIf(
                            lunch_matches.Not()
                        )

                        # A relaxed lunch constraint does not create a
                        # protected lunch hour for idle-time scoring.
                        model.AddBoolAnd([
                            lunch_matches,
                            lunch_relaxed.Not(),
                        ]).OnlyEnforceIf(is_lunch)
                        model.AddBoolOr([
                            lunch_matches.Not(),
                            lunch_relaxed,
                        ]).OnlyEnforceIf(is_lunch.Not())

                    idle = model.NewBoolVar(
                        f"lecturer_idle_{lecturer_id}_{slot}"
                    )

                    model.AddBoolAnd([
                        occupied_vars[slot].Not(),
                        has_before,
                        has_after,
                        is_lunch.Not(),
                    ]).OnlyEnforceIf(idle)

                    model.AddBoolOr([
                        occupied_vars[slot],
                        has_before.Not(),
                        has_after.Not(),
                        is_lunch,
                    ]).OnlyEnforceIf(idle.Not())

                    lecturer_idle_vars.append(idle)

        if lecturer_idle_vars:
            lecturer_idle_penalty = model.NewIntVar(
                0,
                len(lecturer_idle_vars),
                f"lecturer_idle_penalty_{target_id}",
            )
            model.Add(
                lecturer_idle_penalty == sum(lecturer_idle_vars)
            )
            objective_debug_vars["lecturer_idle_penalty"] = lecturer_idle_penalty
            objective_terms.append(
                LECTURER_IDLE_WEIGHT * lecturer_idle_penalty
            )

    # ==============================================================
    # Objective term 4: cohort back-to-back room changes
    #
    # If two sessions for the same target cohort are immediately
    # consecutive, using different rooms incurs one penalty. Sessions
    # separated by a timetable gap do not incur this penalty.
    # ==============================================================

    # Cascading time/room changes can alter back-to-back room changes even
    # when the target request itself is SPECIFIC/KEEP.
    cohort_room_change_active = True

    if cohort_room_change_active:
        target_cohort_ids = {
            cohort.id
            for cohort in target_session.cohorts
        }

        cohort_room_change_vars = []

        for cohort_id in target_cohort_ids:
            cohort_sessions = [
                session
                for session in all_sessions
                if any(
                    cohort.id == cohort_id
                    for cohort in session.cohorts
                )
            ]

            for i in range(len(cohort_sessions)):
                for j in range(i + 1, len(cohort_sessions)):
                    a = cohort_sessions[i]
                    b = cohort_sessions[j]
                    a_duration = get_duration_slots(a)
                    b_duration = get_duration_slots(b)

                    a_then_b = model.NewBoolVar(
                        f"cohort_adj_{cohort_id}_{a.id}_{b.id}"
                    )
                    b_then_a = model.NewBoolVar(
                        f"cohort_adj_{cohort_id}_{b.id}_{a.id}"
                    )

                    model.Add(
                        start_vars[b.id] == start_vars[a.id] + a_duration
                    ).OnlyEnforceIf(a_then_b)
                    model.Add(
                        start_vars[b.id] != start_vars[a.id] + a_duration
                    ).OnlyEnforceIf(a_then_b.Not())

                    model.Add(
                        start_vars[a.id] == start_vars[b.id] + b_duration
                    ).OnlyEnforceIf(b_then_a)
                    model.Add(
                        start_vars[a.id] != start_vars[b.id] + b_duration
                    ).OnlyEnforceIf(b_then_a.Not())

                    back_to_back = model.NewBoolVar(
                        f"cohort_back_to_back_{cohort_id}_{a.id}_{b.id}"
                    )
                    model.AddBoolOr([a_then_b, b_then_a]).OnlyEnforceIf(
                        back_to_back
                    )
                    model.AddBoolAnd([
                        a_then_b.Not(),
                        b_then_a.Not(),
                    ]).OnlyEnforceIf(back_to_back.Not())

                    different_room = model.NewBoolVar(
                        f"cohort_different_room_{cohort_id}_{a.id}_{b.id}"
                    )
                    model.Add(
                        room_vars[a.id] != room_vars[b.id]
                    ).OnlyEnforceIf(different_room)
                    model.Add(
                        room_vars[a.id] == room_vars[b.id]
                    ).OnlyEnforceIf(different_room.Not())

                    room_change = model.NewBoolVar(
                        f"cohort_room_change_{cohort_id}_{a.id}_{b.id}"
                    )
                    model.AddBoolAnd([
                        back_to_back,
                        different_room,
                    ]).OnlyEnforceIf(room_change)
                    model.AddBoolOr([
                        back_to_back.Not(),
                        different_room.Not(),
                    ]).OnlyEnforceIf(room_change.Not())

                    cohort_room_change_vars.append(room_change)

        if cohort_room_change_vars:
            cohort_room_change_penalty = model.NewIntVar(
                0,
                len(cohort_room_change_vars),
                f"cohort_room_change_penalty_{target_id}",
            )
            model.Add(
                cohort_room_change_penalty
                == sum(cohort_room_change_vars)
            )
            objective_debug_vars[
                "cohort_room_change_penalty"
            ] = cohort_room_change_penalty
            objective_terms.append(
                COHORT_ROOM_CHANGE_WEIGHT
                * cohort_room_change_penalty
            )

    # ==============================================================
    # Return the quality expression; mixed recovery minimises it only
    # after relaxation and perturbation counts have been fixed.
    # ==============================================================

    quality_expression = sum(objective_terms) if objective_terms else 0
    return quality_expression, objective_debug_vars



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
    protected_constraints,
    objective_weights,
):
    """
    Build the mixed-recovery model.

    Recovery semantics:
      * max_perturbations is an UPPER BOUND, not a target.
      * time and room changes count separately.
      * every relaxable constraint instance has an explicit Boolean.
      * protected relaxations are fixed off.
      * no artificial "at least one perturbation" constraint is added.

    The solve function performs lexicographic optimisation:
      1. minimum relaxations
      2. minimum perturbations
    """
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

    start_vars = {}
    room_vars = {}
    lecturer_vars = {}

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

    # --------------------------------------------------------------
    # Field-level perturbations for OTHER sessions.
    # --------------------------------------------------------------
    session_changed_vars = {}
    perturbation_vars = []

    for session in other_sessions:
        session_id = session.id
        current_start = datetime_to_slot(session.start)
        current_room = room_id_to_index[session.room_id]
        current_lecturer = lecturer_id_to_index[session.lecturer_id]

        # Cascading recovery may alter time/room, never lecturer.
        model.Add(lecturer_vars[session_id] == current_lecturer)

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

        model.AddBoolOr([
            time_changed,
            room_changed,
        ]).OnlyEnforceIf(session_changed)
        model.AddBoolAnd([
            time_changed.Not(),
            room_changed.Not(),
        ]).OnlyEnforceIf(session_changed.Not())

        session_changed_vars[session_id] = session_changed
        perturbation_vars.extend([time_changed, room_changed])

    if perturbation_vars:
        model.Add(
            sum(perturbation_vars) <= max_perturbations
        )
    elif max_perturbations < 0:
        model.Add(0 == 1)

    # --------------------------------------------------------------
    # Force the target request.
    # --------------------------------------------------------------
    target_id = target_session.id

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
            start_vars[target_id] == datetime_to_slot(requested_start)
        )
    elif change_plan["time"]["mode"] == ChangeMode.FIND:
        model.Add(
            start_vars[target_id]
            != datetime_to_slot(target_session.start)
        )

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

    if change_plan["lecturer"]["mode"] == ChangeMode.KEEP:
        model.Add(
            lecturer_vars[target_id]
            == lecturer_id_to_index[target_session.lecturer_id]
        )
    elif change_plan["lecturer"]["mode"] == ChangeMode.SPECIFIC:
        model.Add(
            lecturer_vars[target_id]
            == lecturer_id_to_index[change_plan["lecturer"]["target"]]
        )
    elif change_plan["lecturer"]["mode"] == ChangeMode.FIND:
        model.Add(
            lecturer_vars[target_id]
            != lecturer_id_to_index[target_session.lecturer_id]
        )

    # --------------------------------------------------------------
    # Unbreakable constraints always remain enforced.
    # --------------------------------------------------------------
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

    # --------------------------------------------------------------
    # Explicitly relaxable constraints.
    # --------------------------------------------------------------
    relaxation_vars = {}
    relaxation_metadata = {}
    baseline_violation_keys = baseline_context["keys"]

    _add_relaxable_capacity_constraints(
        model,
        all_sessions,
        room_vars,
        rooms,
        active_capacity_sessions,
        baseline_violation_keys,
        protected_constraints,
        relaxation_vars,
        relaxation_metadata,
    )
    _add_relaxable_equipment_constraints(
        model,
        all_sessions,
        room_vars,
        rooms,
        active_equipment_sessions,
        baseline_violation_keys,
        protected_constraints,
        relaxation_vars,
        relaxation_metadata,
    )
    _add_relaxable_cohort_daily_constraints(
        model,
        all_sessions,
        start_vars,
        cohort_daily_constraints,
        baseline_context,
        protected_constraints,
        relaxation_vars,
        relaxation_metadata,
    )
    _add_relaxable_lecturer_daily_constraints(
        model,
        all_sessions,
        start_vars,
        lecturer_vars,
        lecturer_id_to_index,
        lecturer_daily_constraints,
        baseline_context,
        protected_constraints,
        relaxation_vars,
        relaxation_metadata,
    )
    lunch_vars = _add_relaxable_lecturer_lunch_constraints(
        model,
        all_sessions,
        start_vars,
        lecturer_vars,
        lecturer_id_to_index,
        lecturer_lunch_constraints,
        baseline_violation_keys,
        protected_constraints,
        relaxation_vars,
        relaxation_metadata,
    )

    quality_expression, objective_debug_vars = add_mixed_quality_objective(
        model=model,
        target_session=target_session,
        change_plan=change_plan,
        all_sessions=all_sessions,
        rooms=rooms,
        start_vars=start_vars,
        room_vars=room_vars,
        lecturer_vars=lecturer_vars,
        lecturer_id_to_index=lecturer_id_to_index,
        active_capacity_sessions=active_capacity_sessions,
        objective_weights=objective_weights,
        lunch_vars=lunch_vars,
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
        perturbation_vars,
        relaxation_vars,
        relaxation_metadata,
        quality_expression,
        objective_debug_vars,
    )



# =====================================================================
# Guided recovery analysis
# =====================================================================

def _solve_count_objective(model, expression):
    """Solve one CP-SAT count objective and return (solver, status)."""
    model.Minimize(expression)
    solver = cp_model.CpSolver()
    status = solver.Solve(model)
    return solver, status


def _prepare_mixed_recovery_problem(request, protected_constraints, db, max_perturbations):
    """Build the same mixed model used by the final recovery solve."""
    pre_solve = build_pre_solve_context(request, db)
    if pre_solve["status"] != "ready":
        return None, pre_solve

    target_session: Session = pre_solve["target_session"]
    change_plan = pre_solve["change_plan"]
    other_sessions = pre_solve["other_sessions"]

    corruption = check_timetable_integrity(db)
    if corruption is not None:
        return None, corruption

    baseline_violations = get_existing_breakable_violations(db)
    baseline_context = build_baseline_violation_context(baseline_violations)

    rooms = get_rooms(db)
    lecturers = get_lecturers(db)
    unavailability_rows = get_all_lecturer_unavailability(db)

    built = build_mixed_recovery_solver_model(
        target_session=target_session,
        change_plan=change_plan,
        other_sessions=other_sessions,
        rooms=rooms,
        lecturers=lecturers,
        unavailability_rows=unavailability_rows,
        active_capacity_sessions=get_active_class_capacity_sessions(db),
        active_equipment_sessions=get_active_class_equipment_sessions(db),
        cohort_daily_constraints=get_active_cohort_daily_hour_constraints(db),
        lecturer_daily_constraints=get_active_lecturer_daily_hour_constraints(db),
        lecturer_lunch_constraints=get_active_lecturer_lunch_constraints(db),
        baseline_context=baseline_context,
        max_perturbations=max_perturbations,
        protected_constraints=protected_constraints,
        objective_weights=request.objective_weights,
    )

    return {
        "built": built,
        "target_session": target_session,
        "other_sessions": other_sessions,
    }, None


def analyse_mixed_recovery_guidance(request: RescheduleRequestIn, protected_constraints, db):
    """Analyse the recovery space and suggest the first useful mixed budget.

    The guidance uses the same user-selected protected constraints as the
    interactive mixed solver. It does not invent additional protections.

    If P=0 is feasible, the suggested budget is the minimum number of
    perturbations required to reduce the minimum relaxation count below the
    relaxation-only endpoint. If P=0 is infeasible, the suggested budget is
    the minimum number of perturbations required to restore feasibility.

    The returned suggested solution is then materialised with the normal
    lexicographic mixed objective: min R -> min P -> timetable quality.
    """
    pre_solve = build_pre_solve_context(request, db)
    if pre_solve["status"] != "ready":
        return pre_solve

    max_possible_perturbations = 2 * len(pre_solve["other_sessions"])

    # --------------------------------------------------------------
    # Relaxation-only endpoint: P = 0, minimise R.
    # --------------------------------------------------------------
    prepared, error = _prepare_mixed_recovery_problem(
        request, protected_constraints, db, 0
    )
    if error is not None:
        return error

    built = prepared["built"]
    model = built[0]
    relaxation_vars = built[9]
    relaxation_metadata = built[10]

    relax_expr = sum(relaxation_vars.values()) if relaxation_vars else 0
    relax_solver, relax_status = _solve_count_objective(model, relax_expr)
    relax_only_feasible = relax_status in (cp_model.OPTIMAL, cp_model.FEASIBLE)
    relax_only_count = (
        sum(relax_solver.Value(v) for v in relaxation_vars.values())
        if relax_only_feasible else None
    )

    relax_only_used = []
    if relax_only_feasible:
        relax_only_used = [
            relaxation_metadata[key]
            for key, var in relaxation_vars.items()
            if relax_solver.Value(var) == 1
        ]

    # --------------------------------------------------------------
    # Pure perturbation endpoint: R = 0, minimise P.
    # This is reported for explanation only; it does not determine the
    # suggested mixed budget.
    # --------------------------------------------------------------
    prepared, error = _prepare_mixed_recovery_problem(
        request, protected_constraints, db, max_possible_perturbations
    )
    if error is not None:
        return error

    built = prepared["built"]
    model = built[0]
    perturbation_vars = built[8]
    relaxation_vars = built[9]

    if relaxation_vars:
        model.Add(sum(relaxation_vars.values()) == 0)
    perturb_expr = sum(perturbation_vars) if perturbation_vars else 0
    perturb_solver, perturb_status = _solve_count_objective(model, perturb_expr)
    perturb_only_feasible = perturb_status in (cp_model.OPTIMAL, cp_model.FEASIBLE)
    perturb_only_count = (
        sum(perturb_solver.Value(v) for v in perturbation_vars)
        if perturb_only_feasible else None
    )

    if relax_only_feasible and perturb_only_feasible:
        case = "both_pure_recoveries_feasible"
    elif relax_only_feasible:
        case = "relaxation_only_feasible"
    elif perturb_only_feasible:
        case = "perturbation_only_feasible"
    else:
        case = "neither_pure_recovery_feasible"

    suggested_budget = None
    suggested_relaxations = None
    suggestion_reason = None
    suggested_solution = None

    # --------------------------------------------------------------
    # Find the smallest useful perturbation allowance.
    #
    # If relaxation-only is feasible, "useful" means strictly fewer
    # relaxations than the P=0 endpoint.
    #
    # If relaxation-only is infeasible, "useful" means the first budget
    # at which any recovery becomes feasible.
    # --------------------------------------------------------------
    prepared, error = _prepare_mixed_recovery_problem(
        request, protected_constraints, db, max_possible_perturbations
    )
    if error is not None:
        return error

    built = prepared["built"]
    model = built[0]
    perturbation_vars = built[8]
    relaxation_vars = built[9]

    should_search = not relax_only_feasible or (
        relax_only_count is not None and relax_only_count > 0
    )

    if should_search:
        if relax_only_feasible:
            # Require a strict improvement over relaxation-only.
            if relaxation_vars:
                model.Add(sum(relaxation_vars.values()) <= relax_only_count - 1)
            else:
                # No relaxation variables means R0 can only be zero, which is
                # handled by should_search=False above.
                suggestion_reason = "perturbations_do_not_reduce_relaxations"

        if suggestion_reason is None:
            perturb_expr = sum(perturbation_vars) if perturbation_vars else 0
            guide_solver, guide_status = _solve_count_objective(model, perturb_expr)

            if guide_status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
                suggested_budget = sum(
                    guide_solver.Value(v) for v in perturbation_vars
                )
                suggested_relaxations = sum(
                    guide_solver.Value(v) for v in relaxation_vars.values()
                )
                suggestion_reason = (
                    "first_relaxation_reduction"
                    if relax_only_feasible
                    else "first_feasible_mixed_recovery"
                )

                # At that minimum useful budget, apply the normal mixed
                # lexicographic objective: min R -> min P -> quality.
                suggested_solution = solve_reschedule_mixed_recovery(
                    request=request,
                    max_perturbations=suggested_budget,
                    protected_constraints=protected_constraints,
                    db=db,
                )

                if suggested_solution.get("status") == "feasible":
                    suggested_relaxations = suggested_solution.get(
                        "relaxation_count"
                    )
                else:
                    # The guidance model found feasibility, so this should be
                    # exceptional; do not expose a misleading default budget.
                    suggested_budget = None
                    suggested_relaxations = None
                    suggestion_reason = "suggested_mixed_solution_failed"
            else:
                suggestion_reason = (
                    "perturbations_do_not_reduce_relaxations"
                    if relax_only_feasible
                    else "no_mixed_recovery_within_search_limit"
                )
    else:
        # R0 == 0: relaxation-only already needs no violations, so allowing
        # perturbations cannot improve the primary recovery objective.
        suggestion_reason = "relaxation_only_already_zero_relaxations"

    return {
        "status": "analysed",
        "case": case,
        "relax_only": {
            "feasible": relax_only_feasible,
            "relaxation_count": relax_only_count,
            "perturbation_count": 0 if relax_only_feasible else None,
            "used_relaxations": relax_only_used,
        },
        "perturb_only": {
            "feasible": perturb_only_feasible,
            "relaxation_count": 0 if perturb_only_feasible else None,
            "perturbation_count": perturb_only_count,
        },
        "suggested_mixed": {
            "max_perturbations": suggested_budget,
            "relaxation_count": suggested_relaxations,
            "reason": suggestion_reason,
        },
        "suggested_solution": suggested_solution,
        # Kept for response-schema compatibility. Guidance no longer invents
        # protected constraints; only the user's explicit selections apply.
        "auto_protected_constraint_types": [],
        "auto_protected_constraints": [],
        "protected_constraints": [
            _constraint_to_dict(item) for item in (protected_constraints or [])
        ],
    }

# =====================================================================
# Solve
# =====================================================================

def solve_reschedule_mixed_recovery(
    request: RescheduleRequestIn,
    max_perturbations: int,
    protected_constraints,
    db,
    min_perturbations: int = 0,
):
    """
    Solve a budgeted mixed-recovery request.

    Lexicographic recovery priority:
      1. minimise the number of newly used relaxations;
      2. among those solutions, minimise field-level perturbations.

    The user's perturbation value is an upper bound. The solver is not
    forced to spend the whole budget and is not forced to perturb when
    perturbation does not reduce the required relaxations.
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

    if min_perturbations < 0 or min_perturbations > max_perturbations:
        return {
            "status": "invalid",
            "reason": "min_perturbations must satisfy 0 <= min <= max",
        }

    pre_solve = build_pre_solve_context(request, db)

    if pre_solve["status"] != "ready":
        return pre_solve

    target_session: Session = pre_solve["target_session"]
    change_plan = pre_solve["change_plan"]
    other_sessions = pre_solve["other_sessions"]

    corruption = check_timetable_integrity(db)
    if corruption is not None:
        return corruption

    baseline_violations = get_existing_breakable_violations(db)
    baseline_context = build_baseline_violation_context(
        baseline_violations
    )

    rooms = get_rooms(db)
    lecturers = get_lecturers(db)
    unavailability_rows = get_all_lecturer_unavailability(db)

    all_capacity_sessions = get_active_class_capacity_sessions(db)
    all_equipment_sessions = get_active_class_equipment_sessions(db)
    all_cohort_daily_constraints = get_active_cohort_daily_hour_constraints(db)
    all_lecturer_daily_constraints = get_active_lecturer_daily_hour_constraints(db)
    all_lecturer_lunch_constraints = get_active_lecturer_lunch_constraints(db)

    (
        model,
        start_vars,
        room_vars,
        lecturer_vars,
        index_to_room_id,
        index_to_lecturer_id,
        room_id_to_index,
        session_changed_vars,
        perturbation_vars,
        relaxation_vars,
        relaxation_metadata,
        quality_expression,
        objective_debug_vars,
    ) = build_mixed_recovery_solver_model(
        target_session=target_session,
        change_plan=change_plan,
        other_sessions=other_sessions,
        rooms=rooms,
        lecturers=lecturers,
        unavailability_rows=unavailability_rows,
        active_capacity_sessions=all_capacity_sessions,
        active_equipment_sessions=all_equipment_sessions,
        cohort_daily_constraints=all_cohort_daily_constraints,
        lecturer_daily_constraints=all_lecturer_daily_constraints,
        lecturer_lunch_constraints=all_lecturer_lunch_constraints,
        baseline_context=baseline_context,
        max_perturbations=max_perturbations,
        protected_constraints=protected_constraints,
        objective_weights=request.objective_weights,
    )

    # Guidance can require a genuinely mixed point. Normal user-budget solves
    # leave this at zero, preserving the existing semantics.
    if min_perturbations > 0:
        if not perturbation_vars:
            return {
                "status": "infeasible",
                "reason": "No perturbable fields are available for mixed recovery.",
                "diagnostics": None,
                "max_perturbations": max_perturbations,
            }
        model.Add(sum(perturbation_vars) >= min_perturbations)

    # ==============================================================
    # PASS 1: minimise newly used relaxations.
    # ==============================================================
    if relaxation_vars:
        model.Minimize(sum(relaxation_vars.values()))

    solver = cp_model.CpSolver()
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {
            "status": "infeasible",
            "reason": (
                "No feasible recovery exists within the selected "
                "perturbation limit while keeping the selected "
                "protected constraints enforced."
            ),
            "diagnostics": None,
            "max_perturbations": max_perturbations,
            "protected_constraints": [
                _constraint_to_dict(item)
                for item in (protected_constraints or [])
            ],
        }

    minimum_relaxations = sum(
        solver.Value(var)
        for var in relaxation_vars.values()
    )

    if relaxation_vars:
        model.Add(
            sum(relaxation_vars.values()) == minimum_relaxations
        )

    # ==============================================================
    # PASS 2: with minimum relaxations fixed, minimise perturbations.
    # ==============================================================
    if perturbation_vars:
        model.Minimize(sum(perturbation_vars))

    solver = cp_model.CpSolver()
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {
            "status": "infeasible",
            "reason": (
                "A minimum-relaxation recovery was found, but no "
                "solution remained after applying the perturbation "
                "tie-break."
            ),
            "diagnostics": None,
            "max_perturbations": max_perturbations,
            "protected_constraints": [
                _constraint_to_dict(item)
                for item in (protected_constraints or [])
            ],
        }

    minimum_perturbations = sum(
        solver.Value(var)
        for var in perturbation_vars
    )

    # Lock the recovery class. This makes the returned result stable
    # and prepares the model for a later third pass that can optimise
    # timetable-quality objectives without buying extra relaxations or
    # perturbations.
    if perturbation_vars:
        model.Add(
            sum(perturbation_vars) == minimum_perturbations
        )

    # ==============================================================
    # PASS 3: with recovery cost fixed, optimise timetable quality.
    # ==============================================================
    model.Minimize(quality_expression)

    solver = cp_model.CpSolver()
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {
            "status": "infeasible",
            "reason": "The fixed mixed-recovery solution became infeasible.",
            "diagnostics": None,
            "max_perturbations": max_perturbations,
        }

    target_id = target_session.id
    solved_start_slot = solver.Value(start_vars[target_id])
    solved_time = slot_to_day_time(solved_start_slot)

    additional_changes = []

    for session in other_sessions:
        session_id = session.id

        if solver.Value(session_changed_vars[session_id]) == 0:
            continue

        solved_start = solver.Value(start_vars[session_id])
        solved_room_index = solver.Value(room_vars[session_id])

        original_start = datetime_to_slot(session.start)
        original_room_index = room_id_to_index[session.room_id]
        solved_session_time = slot_to_day_time(solved_start)

        additional_changes.append({
            "session_id": session_id,
            "time_changed": solved_start != original_start,
            "old_start_slot": original_start,
            "new_start_slot": solved_start,
            "old_day": session.start.strftime("%A").lower(),
            "old_time": session.start.strftime("%H:%M"),
            "new_day": solved_session_time["day"],
            "new_time": solved_session_time["time"],
            "room_changed": solved_room_index != original_room_index,
            "old_room_id": session.room_id,
            "new_room_id": index_to_room_id[solved_room_index],
        })

    used_relaxations = [
        relaxation_metadata[key]
        for key, var in relaxation_vars.items()
        if solver.Value(var) == 1
    ]

    perturbation_count = sum(
        int(change["time_changed"])
        + int(change["room_changed"])
        for change in additional_changes
    )

    objective_components = {
        "room_waste": (
            solver.Value(objective_debug_vars["room_waste"])
            if objective_debug_vars["room_waste"] is not None
            else 0
        ),
        "cohort_gaps": (
            solver.Value(objective_debug_vars["cohort_gap_penalty"])
            if objective_debug_vars["cohort_gap_penalty"] is not None
            else 0
        ),
        "lecturer_idle": (
            solver.Value(objective_debug_vars["lecturer_idle_penalty"])
            if objective_debug_vars["lecturer_idle_penalty"] is not None
            else 0
        ),
        "cohort_room_changes": (
            solver.Value(objective_debug_vars["cohort_room_change_penalty"])
            if objective_debug_vars["cohort_room_change_penalty"] is not None
            else 0
        ),
    }

    objective_score = int(round(solver.ObjectiveValue()))

    # --------------------------------------------------------------
    # Human-facing timetable impact.
    #
    # The CP-SAT objective chooses the final timetable; timetable_impact.py
    # separately explains that chosen timetable as a before -> after change.
    # --------------------------------------------------------------
    all_sessions = [*other_sessions, target_session]

    proposed_assignments = {
        session.id: {
            "start_slot": solver.Value(start_vars[session.id]),
            "room_id": index_to_room_id[
                solver.Value(room_vars[session.id])
            ],
            "lecturer_id": index_to_lecturer_id[
                solver.Value(lecturer_vars[session.id])
            ],
        }
        for session in all_sessions
    }

    impact = evaluate_timetable_change(
        sessions=all_sessions,
        rooms=rooms,
        proposed_assignments=proposed_assignments,
        objective_weights=request.objective_weights,
        active_capacity_sessions=set(all_capacity_sessions),
    )

    return {
        "status": "feasible",
        "reason": None,
        "session_id": target_id,
        "start_slot": solved_start_slot,
        "day": solved_time["day"],
        "time": solved_time["time"],
        "room_id": index_to_room_id[
            solver.Value(room_vars[target_id])
        ],
        "lecturer_id": index_to_lecturer_id[
            solver.Value(lecturer_vars[target_id])
        ],
        "additional_changes": additional_changes,
        "perturbation_count": perturbation_count,
        "max_perturbations": max_perturbations,
        "protected_constraints": [
            _constraint_to_dict(item)
            for item in (protected_constraints or [])
        ],
        "used_relaxations": used_relaxations,
        "relaxation_count": len(used_relaxations),
        "minimum_relaxations": minimum_relaxations,
        "minimum_perturbations": minimum_perturbations,
        "objective_score": objective_score,
        "objective_components": objective_components,
        "impact": impact,
    }


def get_used_relaxations(
    *,
    solver,
    all_sessions,
    rooms,
    start_vars,
    room_vars,
    index_to_room_id,
    protected_constraints,
    all_capacity_sessions,
    all_equipment_sessions,
    all_cohort_daily_constraints,
    all_lecturer_daily_constraints,
    all_lecturer_lunch_constraints,
    baseline_context,
):
    """
    Return unprotected relaxable instances actually violated by the solution.
    Existing grandfathered violations do not count as newly used relaxations.
    """
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

    candidates = []

    for session_id in all_capacity_sessions:
        candidates.append({
            "constraint_id": "class-capacity",
            "instance_type": "session",
            "instance_id": session_id,
            "day": None,
        })

    for session_id in all_equipment_sessions:
        candidates.append({
            "constraint_id": "class-equipment",
            "instance_type": "session",
            "instance_id": session_id,
            "day": None,
        })

    for constraint in all_cohort_daily_constraints:
        candidates.append({
            "constraint_id": constraint.constraint_id,
            "instance_type": "cohort",
            "instance_id": constraint.cohort_id,
            "day": constraint.day,
        })

    for constraint in all_lecturer_daily_constraints:
        candidates.append({
            "constraint_id": constraint.constraint_id,
            "instance_type": "lecturer",
            "instance_id": constraint.lecturer_id,
            "day": constraint.day,
        })

    for constraint in all_lecturer_lunch_constraints:
        candidates.append({
            "constraint_id": constraint.constraint_id,
            "instance_type": "lecturer",
            "instance_id": constraint.lecturer_id,
            "day": constraint.day,
        })

    used = []

    for relaxation in candidates:
        constraint_id = relaxation["constraint_id"]
        instance_type = relaxation["instance_type"]
        instance_id = relaxation["instance_id"]
        day = relaxation["day"]

        if is_constraint_protected(
            protected_constraints,
            constraint_id=constraint_id,
            instance_type=instance_type,
            instance_id=instance_id,
            day=day,
        ):
            continue

        actually_used = False

        if constraint_id == "class-capacity" and instance_type == "session":
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
                    baseline_key = ("class_capacity", session.id, room_id)
                    actually_used = baseline_key not in baseline_keys

        elif constraint_id == "class-equipment" and instance_type == "session":
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
                        baseline_key = ("class_equipment", session.id, room_id)
                        actually_used = baseline_key not in baseline_keys

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
                    any(cohort.id == instance_id for cohort in session.cohorts)
                    and solved_start[session.id] // SLOTS_PER_DAY == day_index
                )
            )
            allowed_limit = cohort_baseline_limits.get(
                (instance_id, day_key),
                COHORT_MAX_HOURS_PER_DAY,
            )
            actually_used = total_hours > allowed_limit

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

        elif (
            constraint_id == "lecturer-lunch-break"
            and instance_type == "lecturer"
            and day is not None
        ):
            day_key = day.lower()
            baseline_key = ("lecturer_lunch_break", instance_id, day_key)

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


def _constraint_to_dict(item):
    return {
        "constraint_id": _value(item, "constraint_id"),
        "instance_type": _value(item, "instance_type"),
        "instance_id": _value(item, "instance_id"),
        "day": _value(item, "day"),
    }
