from __future__ import annotations
from typing import Any, Mapping

from app.solver.reschedule import (
    SLOTS_PER_DAY,
    datetime_to_slot,
    get_duration_slots,
    slot_to_day_time,
)

Assignment = dict[str, Any]
AssignmentMap = Mapping[str, Assignment]


def _weight(weights: Any, name: str) -> int:
    if isinstance(weights, Mapping):
        return int(weights.get(name, 0) or 0)
    return int(getattr(weights, name, 0) or 0)


def _cohort_ids(session: Any) -> list[str]:
    return [c.id for c in getattr(session, "cohorts", [])]


def _required_capacity(session: Any) -> int | None:
    module = getattr(session, "module", None)
    value = getattr(module, "required_capacity", None) if module else None
    return int(value) if value is not None else None


# ==============================================================
# Human-readable timetable context helpers
# ==============================================================

def _slot_context(slot: int) -> dict[str, Any]:
    value = slot_to_day_time(slot)
    return {
        "slot": slot,
        "day": value["day"],
        "time": value["time"],
    }


def _session_context(
    session: Any,
    assignments: AssignmentMap,
) -> dict[str, Any]:
    assignment = assignments[session.id]

    start_slot = int(assignment["start_slot"])
    duration = get_duration_slots(session)
    end_slot = start_slot + duration

    start = slot_to_day_time(start_slot)

    start_hour, start_minute = map(
        int,
        start["time"].split(":"),
    )

    total_minutes = (
        start_hour * 60
        + start_minute
        + duration * 60
    )

    end_hour = total_minutes // 60
    end_minute = total_minutes % 60

    end_time = f"{end_hour:02d}:{end_minute:02d}"

    return {
        "session_id": session.id,
        "day": start["day"],
        "start_time": start["time"],
        "end_time": end_time,
        "start_slot": start_slot,
        "end_slot": end_slot,
        "room_id": assignment.get("room_id"),
        "lecturer_id": assignment.get("lecturer_id"),
    }

def _sessions_on_day(
    sessions: list[Any],
    assignments: AssignmentMap,
    day_index: int,
) -> list[Any]:
    result = []

    for session in sessions:
        start_slot = int(assignments[session.id]["start_slot"])

        if start_slot // SLOTS_PER_DAY == day_index:
            result.append(session)

    return sorted(
        result,
        key=lambda s: int(assignments[s.id]["start_slot"]),
    )


def _build_empty_periods(
    empty_slots_by_day: Mapping[int, list[int]],
    relevant_sessions: list[Any],
    assignments: AssignmentMap,
) -> list[dict[str, Any]]:
    """
    Groups consecutive empty slots into periods and records the
    immediately surrounding sessions.
    """
    periods: list[dict[str, Any]] = []

    for day_index, slots in empty_slots_by_day.items():
        if not slots:
            continue

        sorted_slots = sorted(slots)

        # Group consecutive slots.
        groups: list[list[int]] = []
        current_group = [sorted_slots[0]]

        for slot in sorted_slots[1:]:
            if slot == current_group[-1] + 1:
                current_group.append(slot)
            else:
                groups.append(current_group)
                current_group = [slot]

        groups.append(current_group)

        day_sessions = _sessions_on_day(
            relevant_sessions,
            assignments,
            day_index,
        )

        for group in groups:
            first_empty = group[0]
            last_empty = group[-1]
            period_end_slot = last_empty + 1

            before_candidates = []
            after_candidates = []

            for session in day_sessions:
                context = _session_context(session, assignments)

                if context["end_slot"] <= first_empty:
                    before_candidates.append((session, context))

                if context["start_slot"] >= period_end_slot:
                    after_candidates.append((session, context))

            session_before = (
                max(
                    before_candidates,
                    key=lambda item: item[1]["end_slot"],
                )[0]
                if before_candidates
                else None
            )

            session_after = (
                min(
                    after_candidates,
                    key=lambda item: item[1]["start_slot"],
                )[0]
                if after_candidates
                else None
            )

            start = slot_to_day_time(first_empty)
            end = slot_to_day_time(period_end_slot)

            periods.append({
                "day": start["day"],
                "start_time": start["time"],
                "end_time": end["time"],
                "start_slot": first_empty,
                "end_slot": period_end_slot,
                "slots": list(group),
                "session_before": (
                    _session_context(session_before, assignments)
                    if session_before is not None
                    else None
                ),
                "session_after": (
                    _session_context(session_after, assignments)
                    if session_after is not None
                    else None
                ),
            })

    return periods


# ==============================================================
# Assignment helpers
# ==============================================================

def build_baseline_assignments(
    sessions: list[Any],
) -> dict[str, Assignment]:
    return {
        s.id: {
            "start_slot": datetime_to_slot(s.start),
            "room_id": s.room_id,
            "lecturer_id": s.lecturer_id,
        }
        for s in sessions
    }


def build_complete_assignments(
    sessions: list[Any],
    overrides: AssignmentMap | None = None,
) -> dict[str, Assignment]:
    overrides = overrides or {}
    result = build_baseline_assignments(sessions)

    for session_id, override in overrides.items():
        if session_id in result:
            result[session_id].update({
                key: value
                for key, value in override.items()
                if value is not None
            })

    return result


def _day_slots(day_index: int) -> list[int]:
    first = day_index * SLOTS_PER_DAY + 1
    return list(range(first, first + SLOTS_PER_DAY))


def _occupied(
    sessions: list[Any],
    assignments: AssignmentMap,
) -> set[int]:
    slots: set[int] = set()

    for s in sessions:
        start = int(assignments[s.id]["start_slot"])
        duration = get_duration_slots(s)
        slots.update(range(start, start + duration))

    return slots


def _internal_empty_slots(
    occupied: set[int],
    day_index: int,
) -> list[int]:
    teaching_slots = _day_slots(day_index)
    used = [
        slot
        for slot in teaching_slots
        if slot in occupied
    ]

    if len(used) < 2:
        return []

    first, last = min(used), max(used)

    return [
        slot
        for slot in teaching_slots
        if first < slot < last and slot not in occupied
    ]


# ==============================================================
# Objective 1: room capacity waste
# ==============================================================

def calculate_room_waste(
    sessions: list[Any],
    rooms: list[Any],
    assignments: AssignmentMap,
    active_capacity_sessions: set[str] | None = None,
) -> dict[str, Any]:
    capacities = {
        r.id: int(r.capacity)
        for r in rooms
        if getattr(r, "capacity", None) is not None
    }

    contributions: dict[str, int] = {}
    details: dict[str, Any] = {}

    for s in sessions:
        if (
            active_capacity_sessions is not None
            and s.id not in active_capacity_sessions
        ):
            continue

        required = _required_capacity(s)
        room_id = assignments[s.id]["room_id"]
        capacity = capacities.get(room_id)

        if required is None or capacity is None:
            continue

        waste = max(0, capacity - required)
        contributions[s.id] = waste

        context = _session_context(s, assignments)

        details[s.id] = {
            # Existing numeric information
            "room_id": room_id,
            "room_capacity": capacity,
            "required_capacity": required,
            "unused_capacity": waste,

            # Added timetable context
            "session_id": s.id,
            "day": context["day"],
            "start_time": context["start_time"],
            "end_time": context["end_time"],
            "start_slot": context["start_slot"],
            "end_slot": context["end_slot"],
        }

    return {
        "raw_value": sum(contributions.values()),
        "contributions": contributions,
        "details": details,
    }


# ==============================================================
# Objective 2: cohort gaps
# ==============================================================

def calculate_cohort_gaps(
    sessions: list[Any],
    assignments: AssignmentMap,
) -> dict[str, Any]:
    cohort_ids = sorted({
        cid
        for s in sessions
        for cid in _cohort_ids(s)
    })

    contributions: dict[str, int] = {}
    details: dict[str, Any] = {}

    for cohort_id in cohort_ids:
        relevant = [
            s
            for s in sessions
            if cohort_id in _cohort_ids(s)
        ]

        occupied = _occupied(relevant, assignments)
        by_day: dict[int, list[int]] = {}

        for day in range(5):
            gaps = _internal_empty_slots(occupied, day)

            if gaps:
                by_day[day] = gaps

        all_gaps = [
            slot
            for gaps in by_day.values()
            for slot in gaps
        ]

        contributions[cohort_id] = len(all_gaps)

        details[cohort_id] = {
            # Existing information
            "gap_slots": all_gaps,
            "gaps_by_day": by_day,

            # Added contextual periods
            "periods": _build_empty_periods(
                by_day,
                relevant,
                assignments,
            ),
        }

    return {
        "raw_value": sum(contributions.values()),
        "contributions": contributions,
        "details": details,
    }


# ==============================================================
# Objective 3: lecturer idle time
# ==============================================================

def calculate_lecturer_idle(
    sessions: list[Any],
    assignments: AssignmentMap,
    lunch_slots: Mapping[tuple[str, int], int] | None = None,
) -> dict[str, Any]:
    lecturer_ids = sorted({
        str(assignments[s.id]["lecturer_id"])
        for s in sessions
        if assignments[s.id].get("lecturer_id") is not None
    })

    contributions: dict[str, int] = {}
    details: dict[str, Any] = {}

    for lecturer_id in lecturer_ids:
        relevant = [
            s
            for s in sessions
            if str(assignments[s.id].get("lecturer_id"))
            == lecturer_id
        ]

        occupied = _occupied(relevant, assignments)
        by_day: dict[int, list[int]] = {}

        for day in range(5):
            idle = _internal_empty_slots(occupied, day)

            if lunch_slots is not None:
                lunch = lunch_slots.get((lecturer_id, day))

                if lunch is not None:
                    idle = [
                        slot
                        for slot in idle
                        if slot != lunch
                    ]

            if idle:
                by_day[day] = idle

        all_idle = [
            slot
            for idle in by_day.values()
            for slot in idle
        ]

        contributions[lecturer_id] = len(all_idle)

        details[lecturer_id] = {
            # Existing information
            "idle_slots": all_idle,
            "idle_by_day": by_day,

            # Added contextual periods
            "periods": _build_empty_periods(
                by_day,
                relevant,
                assignments,
            ),
        }

    return {
        "raw_value": sum(contributions.values()),
        "contributions": contributions,
        "details": details,
    }


# ==============================================================
# Objective 4: cohort back-to-back room changes
# ==============================================================

def calculate_cohort_room_changes(
    sessions: list[Any],
    assignments: AssignmentMap,
) -> dict[str, Any]:
    cohort_ids = sorted({
        cid
        for s in sessions
        for cid in _cohort_ids(s)
    })

    contributions: dict[str, int] = {}
    details: dict[str, Any] = {}

    for cohort_id in cohort_ids:
        relevant = [
            s
            for s in sessions
            if cohort_id in _cohort_ids(s)
        ]

        changes: list[dict[str, Any]] = []

        for i in range(len(relevant)):
            for j in range(i + 1, len(relevant)):
                a, b = relevant[i], relevant[j]

                aa = assignments[a.id]
                ba = assignments[b.id]

                a_start = int(aa["start_slot"])
                b_start = int(ba["start_slot"])

                a_duration = get_duration_slots(a)
                b_duration = get_duration_slots(b)

                a_then_b = (
                    b_start == a_start + a_duration
                )

                b_then_a = (
                    a_start == b_start + b_duration
                )

                adjacent = a_then_b or b_then_a

                if (
                    adjacent
                    and aa["room_id"] != ba["room_id"]
                ):
                    # Put sessions in chronological order so the
                    # frontend does not need to work this out.
                    if a_then_b:
                        first_session = a
                        second_session = b
                    else:
                        first_session = b
                        second_session = a

                    first_context = _session_context(
                        first_session,
                        assignments,
                    )

                    second_context = _session_context(
                        second_session,
                        assignments,
                    )

                    changes.append({
                        # Keep the original fields
                        "session_a_id": a.id,
                        "session_b_id": b.id,
                        "room_a_id": aa["room_id"],
                        "room_b_id": ba["room_id"],

                        # Added chronological context
                        "day": first_context["day"],
                        "first_session": first_context,
                        "second_session": second_context,
                    })

        contributions[cohort_id] = len(changes)

        details[cohort_id] = {
            "room_changes": changes,
        }

    return {
        "raw_value": sum(contributions.values()),
        "contributions": contributions,
        "details": details,
    }


# ==============================================================
# Evaluate complete timetable
# ==============================================================

def evaluate_timetable(
    *,
    sessions: list[Any],
    rooms: list[Any],
    assignments: AssignmentMap,
    objective_weights: Any,
    active_capacity_sessions: set[str] | None = None,
    lunch_slots: Mapping[tuple[str, int], int] | None = None,
) -> dict[str, Any]:
    assignments = build_complete_assignments(
        sessions,
        assignments,
    )

    objectives = {
        "room_waste": calculate_room_waste(
            sessions,
            rooms,
            assignments,
            active_capacity_sessions=active_capacity_sessions,
        ),
        "cohort_gaps": calculate_cohort_gaps(
            sessions,
            assignments,
        ),
        "lecturer_idle": calculate_lecturer_idle(
            sessions,
            assignments,
            lunch_slots,
        ),
        "cohort_room_changes":
            calculate_cohort_room_changes(
                sessions,
                assignments,
            ),
    }

    for name, objective in objectives.items():
        weight = _weight(objective_weights, name)
        objective["weight"] = weight
        objective["weighted_value"] = (
            objective["raw_value"] * weight
        )

    return {
        "total_score": sum(
            objective["weighted_value"]
            for objective in objectives.values()
        ),
        "objectives": objectives,
    }


# ==============================================================
# Compare baseline vs proposed
# ==============================================================

def _compare_objective(
    baseline: dict[str, Any],
    proposed: dict[str, Any],
) -> dict[str, Any]:
    before = int(baseline["raw_value"])
    after = int(proposed["raw_value"])

    before_c = baseline.get("contributions", {})
    after_c = proposed.get("contributions", {})

    before_d = baseline.get("details", {})
    after_d = proposed.get("details", {})

    affected = []

    for entity_id in sorted(
        set(before_c) | set(after_c)
    ):
        entity_before = int(
            before_c.get(entity_id, 0)
        )

        entity_after = int(
            after_c.get(entity_id, 0)
        )

        if entity_before == entity_after:
            continue

        affected.append({
            "id": entity_id,
            "before": entity_before,
            "after": entity_after,
            "delta": entity_after - entity_before,
            "before_details":
                before_d.get(entity_id),
            "after_details":
                after_d.get(entity_id),
        })

    weight = int(proposed.get("weight", 0))

    return {
        "before": before,
        "after": after,
        "delta": after - before,
        "weight": weight,
        "weighted_before": before * weight,
        "weighted_after": after * weight,
        "weighted_delta":
            (after - before) * weight,
        "affected": affected,
    }


def compare_timetable_impacts(
    baseline: dict[str, Any],
    proposed: dict[str, Any],
) -> dict[str, Any]:
    names = (
        "room_waste",
        "cohort_gaps",
        "lecturer_idle",
        "cohort_room_changes",
    )

    objectives = {
        name: _compare_objective(
            baseline["objectives"][name],
            proposed["objectives"][name],
        )
        for name in names
    }

    before = int(baseline["total_score"])
    after = int(proposed["total_score"])

    return {
        "baseline_score": before,
        "proposed_score": after,
        "score_delta": after - before,
        "objectives": objectives,
    }


# ==============================================================
# Convenience wrapper
# ==============================================================

def evaluate_timetable_change(
    *,
    sessions: list[Any],
    rooms: list[Any],
    proposed_assignments: AssignmentMap,
    objective_weights: Any,
    active_capacity_sessions: set[str] | None = None,
    lunch_slots: Mapping[tuple[str, int], int] | None = None,
) -> dict[str, Any]:
    baseline = evaluate_timetable(
        sessions=sessions,
        rooms=rooms,
        assignments=build_baseline_assignments(
            sessions
        ),
        objective_weights=objective_weights,
        active_capacity_sessions=
            active_capacity_sessions,
        lunch_slots=lunch_slots,
    )

    proposed = evaluate_timetable(
        sessions=sessions,
        rooms=rooms,
        assignments=proposed_assignments,
        objective_weights=objective_weights,
        active_capacity_sessions=
            active_capacity_sessions,
        lunch_slots=lunch_slots,
    )

    return compare_timetable_impacts(
        baseline,
        proposed,
    )