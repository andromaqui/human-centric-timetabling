from datetime import datetime, timedelta
from typing import Any
from ortools.sat.python import cp_model
from app.schemas import ChangeMode, RescheduleRequestIn
from app.models import (
    Session,
    Room,
    Lecturer,
    LecturerUnavailability,
    SessionConstraint,
    CohortConstraint,
    LecturerConstraint,
)


# region Vars

TIME_TO_SLOT = {
    "08:00": 0,
    "09:00": 1,
    "10:00": 2,
    "11:00": 3,
    "12:00": 4,
    "13:00": 5,
    "14:00": 6,
    "15:00": 7,
    "16:00": 8,
    "17:00": 9,
}

SLOT_TO_TIME = {
    0: "08:00",
    1: "09:00",
    2: "10:00",
    3: "11:00",
    4: "12:00",
    5: "13:00",
    6: "14:00",
    7: "15:00",
    8: "16:00",
    9: "17:00",
}

SLOTS_PER_DAY = 9

DAY_TO_INDEX = {
    "mon": 0,
    "monday": 0,
    "tue": 1,
    "tuesday": 1,
    "wed": 2,
    "wednesday": 2,
    "thu": 3,
    "thursday": 3,
    "fri": 4,
    "friday": 4,
}

INDEX_TO_DAY = {
    0: "monday",
    1: "tuesday",
    2: "wednesday",
    3: "thursday",
    4: "friday",
}

COHORT_MAX_HOURS_PER_DAY = 4
LECTURER_MAX_HOURS_PER_DAY = 4

# endregion


# region Time utils

def datetime_to_slot(value):
    day = value.strftime("%A").lower()
    time = value.strftime("%H:%M")
    return day_time_to_slot(day, time)


def day_time_to_slot(day: str, time: str):
    day_index = DAY_TO_INDEX[day.lower()]
    time_slot = TIME_TO_SLOT[time]
    return day_index * SLOTS_PER_DAY + time_slot


def slot_to_day_time(slot: int):
    day_index = slot // SLOTS_PER_DAY
    time_slot = slot % SLOTS_PER_DAY

    return {
        "day": INDEX_TO_DAY[day_index],
        "time": SLOT_TO_TIME[time_slot],
    }


def get_valid_start_slots(duration_slots: int):
    valid_slots = []

    for day in range(5):
        first_slot = day * SLOTS_PER_DAY + 1
        latest_start = first_slot + SLOTS_PER_DAY - duration_slots

        for slot in range(first_slot, latest_start + 1):
            valid_slots.append(slot)

    return valid_slots


def get_duration_slots(session):
    duration = session.end - session.start
    return int(duration.total_seconds() // 3600)

# endregion


# region Mappings

def build_room_mappings(rooms):
    room_id_to_index = {room.id: index for index, room in enumerate(rooms)}
    index_to_room_id = {index: room.id for index, room in enumerate(rooms)}
    return room_id_to_index, index_to_room_id


def build_lecturer_mappings(lecturers):
    lecturer_id_to_index = {lecturer.id: index for index, lecturer in enumerate(lecturers)}
    index_to_lecturer_id = {index: lecturer.id for index, lecturer in enumerate(lecturers)}
    return lecturer_id_to_index, index_to_lecturer_id

# endregion


# region Request / change plan

def validate_request(request: RescheduleRequestIn):
    if request.time_mode == ChangeMode.SPECIFIC and not request.requested_start:
        return "Specific time requires requested_start"

    if request.room_mode == ChangeMode.SPECIFIC and not request.requested_room_id:
        return "Specific room requires requested_room_id"

    if request.lecturer_mode == ChangeMode.SPECIFIC and not request.requested_lecturer_id:
        return "Specific lecturer requires requested_lecturer_id"

    if request.time_mode == ChangeMode.KEEP and request.room_mode == ChangeMode.KEEP and request.lecturer_mode == ChangeMode.KEEP:
        return "Nothing has been requested to change"

    return None


def build_change_plan(session, request: RescheduleRequestIn):
    return {
        "time": {
            "mode": request.time_mode,
            "current_start": session.start,
            "current_end": session.end,
            "target": request.requested_start,
        },
        "room": {
            "mode": request.room_mode,
            "current": session.room_id,
            "target": request.requested_room_id,
        },
        "lecturer": {
            "mode": request.lecturer_mode,
            "current": session.lecturer_id,
            "target": request.requested_lecturer_id,
        },
    }

# endregion


# region Database

def get_lecturers(db):
    return db.query(Lecturer).all()


def get_rooms(db):
    return db.query(Room).all()


def get_all_lecturer_unavailability(db):
    return db.query(LecturerUnavailability).all()


def get_active_class_capacity_sessions(db):
    instances = db.query(SessionConstraint).filter(
        SessionConstraint.constraint_id == "class-capacity",
        SessionConstraint.is_activated == True,
    ).all()

    return {instance.session_id for instance in instances}


def get_active_class_equipment_sessions(db):
    instances = db.query(SessionConstraint).filter(
        SessionConstraint.constraint_id == "class-equipment",
        SessionConstraint.is_activated == True,
    ).all()

    return {instance.session_id for instance in instances}


def get_active_cohort_daily_hour_constraints(db):
    return db.query(CohortConstraint).filter(
        CohortConstraint.constraint_id == "cohort-max-teaching-hours-per-day",
        CohortConstraint.is_activated == True,
    ).all()


def get_active_lecturer_daily_hour_constraints(db):
    return db.query(LecturerConstraint).filter(
        LecturerConstraint.constraint_id == "lecturer-max-one-hour-per-day",
        LecturerConstraint.is_activated == True,
    ).all()


def get_active_lecturer_lunch_constraints(db):
    return db.query(LecturerConstraint).filter(
        LecturerConstraint.constraint_id == "lecturer-lunch-break",
        LecturerConstraint.is_activated == True,
    ).all()


def get_session(db, session_id: str):
    session = db.get(Session, session_id)

    if session is None:
        return None, {
            "status": "invalid",
            "reason": "Session not found",
        }

    return session, None


def get_other_sessions(db, target_session_id: str):
    sessions = db.query(Session).all()
    return [session for session in sessions if session.id != target_session_id]


def specific_room_exists(db, room_id: str):
    return db.get(Room, room_id) is not None


def specific_lecturer_exists(db, lecturer_id: str):
    return db.get(Lecturer, lecturer_id) is not None


def _days_match(left: str | None, right: str | None) -> bool:
    if left is None or right is None:
        return left is None and right is None

    left_key = left.lower()
    right_key = right.lower()

    left_index = DAY_TO_INDEX.get(left_key)
    right_index = DAY_TO_INDEX.get(right_key)

    if left_index is not None and right_index is not None:
        return left_index == right_index

    return left_key == right_key


def is_temporarily_deactivated(
    request: RescheduleRequestIn | None,
    *,
    constraint_id: str,
    instance_type: str,
    instance_id: str,
    day: str | None = None,
) -> bool:
    if request is None:
        return False

    for item in request.temporarily_deactivated_constraints:
        if item.constraint_id != constraint_id:
            continue
        if item.instance_type != instance_type:
            continue
        if item.instance_id != instance_id:
            continue
        if not _days_match(item.day, day):
            continue
        return True

    return False


def apply_temporary_deactivations(
    request: RescheduleRequestIn | None,
    *,
    active_capacity_sessions,
    active_equipment_sessions,
    cohort_daily_constraints,
    lecturer_daily_constraints,
    lecturer_lunch_constraints,
):
    active_capacity_sessions = {
        session_id
        for session_id in active_capacity_sessions
        if not is_temporarily_deactivated(
            request,
            constraint_id="class-capacity",
            instance_type="session",
            instance_id=session_id,
            day=None,
        )
    }

    active_equipment_sessions = {
        session_id
        for session_id in active_equipment_sessions
        if not is_temporarily_deactivated(
            request,
            constraint_id="class-equipment",
            instance_type="session",
            instance_id=session_id,
            day=None,
        )
    }

    cohort_daily_constraints = [
        constraint
        for constraint in cohort_daily_constraints
        if not is_temporarily_deactivated(
            request,
            constraint_id=constraint.constraint_id,
            instance_type="cohort",
            instance_id=constraint.cohort_id,
            day=constraint.day,
        )
    ]

    lecturer_daily_constraints = [
        constraint
        for constraint in lecturer_daily_constraints
        if not is_temporarily_deactivated(
            request,
            constraint_id=constraint.constraint_id,
            instance_type="lecturer",
            instance_id=constraint.lecturer_id,
            day=constraint.day,
        )
    ]

    lecturer_lunch_constraints = [
        constraint
        for constraint in lecturer_lunch_constraints
        if not is_temporarily_deactivated(
            request,
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

# endregion


# region Pre-solve

def parse_requested_start(requested_start: str):
    try:
        return datetime.fromisoformat(requested_start.replace("Z", "+00:00"))
    except ValueError:
        return None


def validate_specific_values(db, request: RescheduleRequestIn):
    if request.room_mode == ChangeMode.SPECIFIC and not specific_room_exists(db, request.requested_room_id):
        return "Requested room does not exist"

    if request.lecturer_mode == ChangeMode.SPECIFIC and not specific_lecturer_exists(db, request.requested_lecturer_id):
        return "Requested lecturer does not exist"

    if request.time_mode == ChangeMode.SPECIFIC:
        requested_start = parse_requested_start(request.requested_start)

        if requested_start is None:
            return "Requested start time is invalid"

        day = requested_start.strftime("%A").lower()
        time = requested_start.strftime("%H:%M")

        if day not in DAY_TO_INDEX:
            return "Requested time must be Monday to Friday"

        if time not in TIME_TO_SLOT or time == "17:00":
            return "Requested time must start between 08:00 and 16:00 on the hour"

    return None


def no_change_required(session, request: RescheduleRequestIn):
    if request.time_mode == ChangeMode.FIND or request.room_mode == ChangeMode.FIND or request.lecturer_mode == ChangeMode.FIND:
        return False

    time_same = True
    room_same = True
    lecturer_same = True

    if request.time_mode == ChangeMode.SPECIFIC:
        time_same = parse_requested_start(request.requested_start) == session.start

    if request.room_mode == ChangeMode.SPECIFIC:
        room_same = request.requested_room_id == session.room_id

    if request.lecturer_mode == ChangeMode.SPECIFIC:
        lecturer_same = request.requested_lecturer_id == session.lecturer_id

    return time_same and room_same and lecturer_same


def build_pre_solve_context(request: RescheduleRequestIn, db) -> dict[str, Any]:
    error = validate_request(request)

    if error:
        return {"status": "invalid", "reason": error}

    session, error = get_session(db, request.session_id)

    if error:
        return error

    if request.room_mode == ChangeMode.KEEP and session.room_id is None:
        return {"status": "invalid", "reason": "Session has no current room to keep"}

    error = validate_specific_values(db, request)

    if error:
        return {"status": "invalid", "reason": error}

    if request.time_mode == ChangeMode.SPECIFIC:
        requested_start = parse_requested_start(request.requested_start)
        requested_slot = datetime_to_slot(requested_start)
        valid_start_slots = get_valid_start_slots(get_duration_slots(session))

        if requested_slot not in valid_start_slots:
            return {
                "status": "invalid",
                "reason": "Requested time would make the class finish after 17:00",
            }

    if no_change_required(session, request):
        return {
            "status": "success",
            "reason": "No changes required",
            "session_id": session.id,
        }

    change_plan = build_change_plan(session, request)
    other_sessions = get_other_sessions(db, session.id)

    return {
        "status": "ready",
        "reason": None,
        "target_session": session,
        "change_plan": change_plan,
        "other_sessions": other_sessions,
    }

# endregion


# region Constraints

def add_room_no_overlap_constraint(model, all_sessions, start_vars, room_vars):
    for i in range(len(all_sessions)):
        for j in range(i + 1, len(all_sessions)):
            a = all_sessions[i]
            b = all_sessions[j]

            a_duration = get_duration_slots(a)
            b_duration = get_duration_slots(b)

            same_room = model.NewBoolVar(f"same_room_{a.id}_{b.id}")
            a_before_b = model.NewBoolVar(f"a_before_b_room_{a.id}_{b.id}")
            b_before_a = model.NewBoolVar(f"b_before_a_room_{a.id}_{b.id}")

            model.Add(room_vars[a.id] == room_vars[b.id]).OnlyEnforceIf(same_room)
            model.Add(room_vars[a.id] != room_vars[b.id]).OnlyEnforceIf(same_room.Not())
            model.Add(start_vars[a.id] + a_duration <= start_vars[b.id]).OnlyEnforceIf(a_before_b)
            model.Add(start_vars[b.id] + b_duration <= start_vars[a.id]).OnlyEnforceIf(b_before_a)

            model.AddBoolOr([same_room.Not(), a_before_b, b_before_a])


def add_lecturer_no_overlap_constraint(model, all_sessions, start_vars, lecturer_vars):
    for i in range(len(all_sessions)):
        for j in range(i + 1, len(all_sessions)):
            a = all_sessions[i]
            b = all_sessions[j]

            a_duration = get_duration_slots(a)
            b_duration = get_duration_slots(b)

            same_lecturer = model.NewBoolVar(f"same_lecturer_{a.id}_{b.id}")
            a_before_b = model.NewBoolVar(f"a_before_b_lecturer_{a.id}_{b.id}")
            b_before_a = model.NewBoolVar(f"b_before_a_lecturer_{a.id}_{b.id}")

            model.Add(lecturer_vars[a.id] == lecturer_vars[b.id]).OnlyEnforceIf(same_lecturer)
            model.Add(lecturer_vars[a.id] != lecturer_vars[b.id]).OnlyEnforceIf(same_lecturer.Not())
            model.Add(start_vars[a.id] + a_duration <= start_vars[b.id]).OnlyEnforceIf(a_before_b)
            model.Add(start_vars[b.id] + b_duration <= start_vars[a.id]).OnlyEnforceIf(b_before_a)

            model.AddBoolOr([same_lecturer.Not(), a_before_b, b_before_a])


def add_lecturer_unavailability_constraint(model, all_sessions, start_vars, lecturer_vars, lecturer_id_to_index, unavailability_rows):
    for row in unavailability_rows:
        if row.lecturer_id not in lecturer_id_to_index:
            continue

        lecturer_index = lecturer_id_to_index[row.lecturer_id]
        blocked_slot = day_time_to_slot(row.day, f"{row.hour:02d}:00")

        for session in all_sessions:
            duration = get_duration_slots(session)

            assigned = model.NewBoolVar(f"assigned_{session.id}_{row.lecturer_id}_{blocked_slot}")
            before = model.NewBoolVar(f"before_unavailable_{session.id}_{row.lecturer_id}_{blocked_slot}")
            after = model.NewBoolVar(f"after_unavailable_{session.id}_{row.lecturer_id}_{blocked_slot}")

            model.Add(lecturer_vars[session.id] == lecturer_index).OnlyEnforceIf(assigned)
            model.Add(lecturer_vars[session.id] != lecturer_index).OnlyEnforceIf(assigned.Not())
            model.Add(start_vars[session.id] + duration <= blocked_slot).OnlyEnforceIf(before)
            model.Add(start_vars[session.id] >= blocked_slot + 1).OnlyEnforceIf(after)

            model.AddBoolOr([assigned.Not(), before, after])


def add_class_capacity_constraint(model, all_sessions, room_vars, rooms, active_capacity_sessions):
    for session in all_sessions:
        if session.id not in active_capacity_sessions:
            continue

        required_capacity = session.module.required_capacity

        if required_capacity is None:
            continue

        allowed_rooms = [
            [index]
            for index, room in enumerate(rooms)
            if room.capacity >= required_capacity
        ]

        model.AddAllowedAssignments([room_vars[session.id]], allowed_rooms)


def add_class_equipment_constraint(model, all_sessions, room_vars, rooms, active_equipment_sessions):
    for session in all_sessions:
        if session.id not in active_equipment_sessions:
            continue

        if not session.module.required_equipment:
            continue

        required = {
            item.strip().lower()
            for item in session.module.required_equipment.split(",")
            if item.strip()
        }

        allowed_rooms = []

        for index, room in enumerate(rooms):
            available = {
                item.strip().lower()
                for item in (room.equipment or "").split(",")
                if item.strip()
            }

            if required.issubset(available):
                allowed_rooms.append([index])

        model.AddAllowedAssignments([room_vars[session.id]], allowed_rooms)


def add_cohort_daily_hours_constraint(model, all_sessions, start_vars, cohort_constraints):
    for constraint in cohort_constraints:
        if constraint.day is None:
            continue

        cohort_id = constraint.cohort_id
        day_index = DAY_TO_INDEX[constraint.day.lower()]
        terms = []

        for session in all_sessions:
            belongs_to_cohort = any(cohort.id == cohort_id for cohort in session.cohorts)

            if not belongs_to_cohort:
                continue

            duration = get_duration_slots(session)
            session_day = model.NewIntVar(0, 4, f"day_{session.id}_{cohort_id}_{constraint.day}")
            is_on_day = model.NewBoolVar(f"is_{session.id}_{cohort_id}_{constraint.day}")

            model.AddDivisionEquality(session_day, start_vars[session.id], SLOTS_PER_DAY)
            model.Add(session_day == day_index).OnlyEnforceIf(is_on_day)
            model.Add(session_day != day_index).OnlyEnforceIf(is_on_day.Not())

            terms.append(duration * is_on_day)

        if terms:
            model.Add(sum(terms) <= COHORT_MAX_HOURS_PER_DAY)


def add_lecturer_daily_hours_constraint(model, all_sessions, start_vars, lecturer_vars, lecturer_id_to_index, lecturer_constraints):
    for constraint in lecturer_constraints:
        if constraint.day is None:
            continue

        if constraint.lecturer_id not in lecturer_id_to_index:
            continue

        lecturer_index = lecturer_id_to_index[constraint.lecturer_id]
        day_index = DAY_TO_INDEX[constraint.day.lower()]
        terms = []

        for session in all_sessions:
            duration = get_duration_slots(session)

            assigned = model.NewBoolVar(f"assigned_daily_{session.id}_{constraint.lecturer_id}_{constraint.day}")
            session_day = model.NewIntVar(0, 4, f"day_daily_{session.id}_{constraint.lecturer_id}_{constraint.day}")
            is_on_day = model.NewBoolVar(f"on_day_{session.id}_{constraint.lecturer_id}_{constraint.day}")
            counts = model.NewBoolVar(f"counts_{session.id}_{constraint.lecturer_id}_{constraint.day}")

            model.Add(lecturer_vars[session.id] == lecturer_index).OnlyEnforceIf(assigned)
            model.Add(lecturer_vars[session.id] != lecturer_index).OnlyEnforceIf(assigned.Not())

            model.AddDivisionEquality(session_day, start_vars[session.id], SLOTS_PER_DAY)
            model.Add(session_day == day_index).OnlyEnforceIf(is_on_day)
            model.Add(session_day != day_index).OnlyEnforceIf(is_on_day.Not())

            model.AddBoolAnd([assigned, is_on_day]).OnlyEnforceIf(counts)
            model.AddBoolOr([assigned.Not(), is_on_day.Not()]).OnlyEnforceIf(counts.Not())

            terms.append(duration * counts)

        if terms:
            model.Add(sum(terms) <= LECTURER_MAX_HOURS_PER_DAY)


def add_lecturer_lunch_break_constraint(model, all_sessions, start_vars, lecturer_vars, lecturer_id_to_index, lunch_constraints):
    for constraint in lunch_constraints:
        if constraint.day is None:
            continue

        if constraint.lecturer_id not in lecturer_id_to_index:
            continue

        lecturer_index = lecturer_id_to_index[constraint.lecturer_id]

        lunch_start_12 = day_time_to_slot(constraint.day, "12:00")
        lunch_start_13 = day_time_to_slot(constraint.day, "13:00")

        lunch_start = model.NewIntVarFromDomain(
            cp_model.Domain.FromValues([lunch_start_12, lunch_start_13]),
            f"lunch_{constraint.lecturer_id}_{constraint.day}",
        )

        lunch_end = model.NewIntVar(
            lunch_start_12 + 1,
            lunch_start_13 + 1,
            f"lunch_end_{constraint.lecturer_id}_{constraint.day}",
        )

        model.Add(lunch_end == lunch_start + 1)

        for session in all_sessions:
            duration = get_duration_slots(session)

            assigned = model.NewBoolVar(f"lunch_assigned_{session.id}_{constraint.lecturer_id}_{constraint.day}")
            before_lunch = model.NewBoolVar(f"before_lunch_{session.id}_{constraint.lecturer_id}_{constraint.day}")
            after_lunch = model.NewBoolVar(f"after_lunch_{session.id}_{constraint.lecturer_id}_{constraint.day}")

            model.Add(lecturer_vars[session.id] == lecturer_index).OnlyEnforceIf(assigned)
            model.Add(lecturer_vars[session.id] != lecturer_index).OnlyEnforceIf(assigned.Not())

            model.Add(start_vars[session.id] + duration <= lunch_start).OnlyEnforceIf(before_lunch)
            model.Add(start_vars[session.id] >= lunch_end).OnlyEnforceIf(after_lunch)

            model.AddBoolOr([
                assigned.Not(),
                before_lunch,
                after_lunch,
            ])

# endregion


# region Build model

def build_solver_model(
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
    max_additional_changes,
):
    model = cp_model.CpModel()
    all_sessions = [*other_sessions, target_session]

    room_id_to_index, index_to_room_id = build_room_mappings(rooms)
    lecturer_id_to_index, index_to_lecturer_id = build_lecturer_mappings(lecturers)

    start_vars = {}
    room_vars = {}
    lecturer_vars = {}

    # region Create variables

    for session in all_sessions:
        duration_slots = get_duration_slots(session)
        valid_start_slots = get_valid_start_slots(duration_slots)

        start_vars[session.id] = model.NewIntVarFromDomain(
            cp_model.Domain.FromValues(valid_start_slots),
            f"start_{session.id}",
        )

        room_vars[session.id] = model.NewIntVar(
            0,
            len(rooms) - 1,
            f"room_{session.id}",
        )

        lecturer_vars[session.id] = model.NewIntVar(
            0,
            len(lecturers) - 1,
            f"lecturer_{session.id}",
        )

    # endregion

    # region Freeze existing timetable
    additional_change_vars = []

    for session in other_sessions:
        session_id = session.id

        current_start = datetime_to_slot(session.start)
        current_room = room_id_to_index[session.room_id]
        current_lecturer = lecturer_id_to_index[session.lecturer_id]

        # Lecturer can NEVER change as part of cascading.
        model.Add(lecturer_vars[session_id] == current_lecturer)

        if max_additional_changes is None:
            # Existing behaviour.
            model.Add(start_vars[session_id] == current_start)
            model.Add(room_vars[session_id] == current_room)
            continue

        time_changed = model.NewBoolVar(f"time_changed_{session_id}")
        room_changed = model.NewBoolVar(f"room_changed_{session_id}")

        # time_changed <=> start != original start
        model.Add(start_vars[session_id] != current_start).OnlyEnforceIf(time_changed)
        model.Add(start_vars[session_id] == current_start).OnlyEnforceIf(time_changed.Not())

        # room_changed <=> room != original room
        model.Add(room_vars[session_id] != current_room).OnlyEnforceIf(room_changed)
        model.Add(room_vars[session_id] == current_room).OnlyEnforceIf(room_changed.Not())
        additional_change_vars.extend([time_changed, room_changed,])

    if max_additional_changes is not None:
        model.Add(sum(additional_change_vars) <= max_additional_changes)
    # endregion

    # region Apply target request

    target_id = target_session.id

    if change_plan["time"]["mode"] == ChangeMode.KEEP:
        model.Add(start_vars[target_id] == datetime_to_slot(target_session.start))

    elif change_plan["time"]["mode"] == ChangeMode.SPECIFIC:
        requested_start = parse_requested_start(change_plan["time"]["target"])
        model.Add(start_vars[target_id] == datetime_to_slot(requested_start))

    elif change_plan["time"]["mode"] == ChangeMode.FIND:
        # "Find" means actually move it — otherwise the solver is free to
        # trivially return the exact slot the class is already in.
        model.Add(start_vars[target_id] != datetime_to_slot(target_session.start))

    if change_plan["room"]["mode"] == ChangeMode.KEEP:
        model.Add(room_vars[target_id] == room_id_to_index[target_session.room_id])

    elif change_plan["room"]["mode"] == ChangeMode.SPECIFIC:
        model.Add(room_vars[target_id] == room_id_to_index[change_plan["room"]["target"]])

    elif change_plan["room"]["mode"] == ChangeMode.FIND and target_session.room_id is not None:
        model.Add(room_vars[target_id] != room_id_to_index[target_session.room_id])

    if change_plan["lecturer"]["mode"] == ChangeMode.KEEP:
        model.Add(lecturer_vars[target_id] == lecturer_id_to_index[target_session.lecturer_id])

    elif change_plan["lecturer"]["mode"] == ChangeMode.SPECIFIC:
        model.Add(lecturer_vars[target_id] == lecturer_id_to_index[change_plan["lecturer"]["target"]])

    elif change_plan["lecturer"]["mode"] == ChangeMode.FIND:
        model.Add(lecturer_vars[target_id] != lecturer_id_to_index[target_session.lecturer_id])

    # endregion

    # region Constraints

    add_room_no_overlap_constraint(model, all_sessions, start_vars, room_vars)

    add_lecturer_no_overlap_constraint(model, all_sessions, start_vars, lecturer_vars)

    add_lecturer_unavailability_constraint(
        model,
        all_sessions,
        start_vars,
        lecturer_vars,
        lecturer_id_to_index,
        unavailability_rows,
    )

    add_class_capacity_constraint(
        model,
        all_sessions,
        room_vars,
        rooms,
        active_capacity_sessions,
    )

    add_class_equipment_constraint(
        model,
        all_sessions,
        room_vars,
        rooms,
        active_equipment_sessions,
    )

    add_cohort_daily_hours_constraint(
        model,
        all_sessions,
        start_vars,
        cohort_daily_constraints,
    )

    add_lecturer_daily_hours_constraint(
        model,
        all_sessions,
        start_vars,
        lecturer_vars,
        lecturer_id_to_index,
        lecturer_daily_constraints,
    )

    add_lecturer_lunch_break_constraint(
        model,
        all_sessions,
        start_vars,
        lecturer_vars,
        lecturer_id_to_index,
        lecturer_lunch_constraints,
    )

    # endregion

    return (
        model,
        start_vars,
        room_vars,
        lecturer_vars,
        index_to_room_id,
        index_to_lecturer_id,
        room_id_to_index,
    )
# endregion


# region Solver
def solve_reschedule(request: RescheduleRequestIn, db):
    pre_solve = build_pre_solve_context(request, db)

    if pre_solve["status"] != "ready":
        return pre_solve

    target_session: Session = pre_solve["target_session"]
    change_plan = pre_solve["change_plan"]
    other_sessions = pre_solve["other_sessions"]

    rooms = get_rooms(db)
    lecturers = get_lecturers(db)
    unavailability_rows = get_all_lecturer_unavailability(db)

    active_capacity_sessions = get_active_class_capacity_sessions(db)
    active_equipment_sessions = get_active_class_equipment_sessions(db)
    cohort_daily_constraints = get_active_cohort_daily_hour_constraints(db)
    lecturer_daily_constraints = get_active_lecturer_daily_hour_constraints(db)
    lecturer_lunch_constraints = get_active_lecturer_lunch_constraints(db)

    (
        active_capacity_sessions,
        active_equipment_sessions,
        cohort_daily_constraints,
        lecturer_daily_constraints,
        lecturer_lunch_constraints,
    ) = apply_temporary_deactivations(
        request,
        active_capacity_sessions=active_capacity_sessions,
        active_equipment_sessions=active_equipment_sessions,
        cohort_daily_constraints=cohort_daily_constraints,
        lecturer_daily_constraints=lecturer_daily_constraints,
        lecturer_lunch_constraints=lecturer_lunch_constraints,
    )

    (
        model,
        start_vars,
        room_vars,
        lecturer_vars,
        index_to_room_id,
        index_to_lecturer_id,
        room_id_to_index
    ) = build_solver_model(
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
        request.max_additional_changes,
    )

    solver = cp_model.CpSolver()
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        print("status")
        print({status})

        if request_is_concrete(request):
            (
                proposed_start,
                proposed_room_id,
                proposed_lecturer_id,
            ) = get_proposed_values(request, target_session)

            diagnostics = diagnose_specific_request(
                db,
                target_session,
                proposed_start,
                proposed_room_id,
                proposed_lecturer_id,
                request=request,
            )

            print("\n===== RESCHEDULE INFEASIBILITY DIAGNOSTICS =====")
            print("Session:", target_session.id)
            print("Proposed time:", proposed_start)
            print("Proposed room:", proposed_room_id)
            print("Proposed lecturer:", proposed_lecturer_id)
            print("Overlapping sessions:", diagnostics["overlapping_sessions"])
            if diagnostics["violations"]:
                for violation in diagnostics["violations"]:
                    print(violation)
            else:
                print("No direct constraint violations found by the diagnostic checker.")
            print("===============================================\n")

            return {
                "status": "infeasible",
                "reason": "No feasible solution found",
                "diagnostics": diagnostics,
            }

        return {
            "status": "infeasible",
            "reason": "No feasible solution found",
            "diagnostics": None,
        }

    target_id = target_session.id

    solved_start_slot = solver.Value(start_vars[target_id])
    solved_time = slot_to_day_time(solved_start_slot)

    additional_changes = []

    for session in other_sessions:
        solved_start = solver.Value(start_vars[session.id])
        solved_room_index = solver.Value(room_vars[session.id])

        original_start = datetime_to_slot(session.start)
        original_room_index = room_id_to_index[session.room_id]

        time_changed = solved_start != original_start
        room_changed = solved_room_index != original_room_index

        if not time_changed and not room_changed:
            continue

        solved_session_time = slot_to_day_time(solved_start)

        additional_changes.append({
            "session_id": session.id,

            "time_changed": time_changed,
            "old_start_slot": original_start,
            "new_start_slot": solved_start,
            "old_day": session.start.strftime("%A").lower(),
            "old_time": session.start.strftime("%H:%M"),
            "new_day": solved_session_time["day"],
            "new_time": solved_session_time["time"],

            "room_changed": room_changed,
            "old_room_id": session.room_id,
            "new_room_id": index_to_room_id[solved_room_index],
        })

    return {
        "status": "feasible",
        "reason": None,
        "session_id": target_id,
        "start_slot": solved_start_slot,
        "day": solved_time["day"],
        "time": solved_time["time"],
        "room_id": index_to_room_id[solver.Value(room_vars[target_id])],
        "lecturer_id": index_to_lecturer_id[
            solver.Value(lecturer_vars[target_id])
        ],
        "additional_changes": additional_changes,
    }
# endregion



# region diagnose


def get_proposed_values(request, target_session):
    """
    Resolve the concrete placement we are trying to diagnose.

    This diagnostic is intended for KEEP / SPECIFIC requests.
    FIND requests do not have a single concrete value to inspect.
    """

    # Time
    if request.time_mode == ChangeMode.SPECIFIC:
        proposed_start = parse_requested_start(request.requested_start)
    else:
        proposed_start = target_session.start

    # Room
    if request.room_mode == ChangeMode.SPECIFIC:
        proposed_room_id = request.requested_room_id
    else:
        proposed_room_id = target_session.room_id

    # Lecturer
    if request.lecturer_mode == ChangeMode.SPECIFIC:
        proposed_lecturer_id = request.requested_lecturer_id
    else:
        proposed_lecturer_id = target_session.lecturer_id

    return (
        proposed_start,
        proposed_room_id,
        proposed_lecturer_id,
    )


def request_is_concrete(request):
    """
    Diagnostics only make sense when every dimension has
    a concrete final value.

    KEEP = concrete
    SPECIFIC = concrete
    FIND = not concrete
    """

    return (
        request.time_mode != ChangeMode.FIND
        and request.room_mode != ChangeMode.FIND
        and request.lecturer_mode != ChangeMode.FIND
    )


def sessions_overlapping(
    db,
    target_session,
    proposed_start,
):
    """
    Return every other session overlapping the proposed time.

    Uses solver slots instead of Python datetime comparisons.
    This avoids timezone-aware vs timezone-naive comparison issues
    and mirrors the CP-SAT timetable representation.
    """

    proposed_start_slot = datetime_to_slot(proposed_start)
    proposed_duration = get_duration_slots(target_session)
    proposed_end_slot = proposed_start_slot + proposed_duration

    other_sessions = [
        session
        for session in db.query(Session).all()
        if session.id != target_session.id
    ]

    overlapping = []

    for session in other_sessions:
        session_start_slot = datetime_to_slot(session.start)
        session_duration = get_duration_slots(session)
        session_end_slot = session_start_slot + session_duration

        if proposed_start_slot < session_end_slot and session_start_slot < proposed_end_slot:
            overlapping.append(session)

    return overlapping


# ------------------------------------------------------------------
# Hard constraints
# ------------------------------------------------------------------


def check_lecturer_overlap(
    proposed_lecturer_id,
    overlapping_sessions,
):
    violations = []

    for session in overlapping_sessions:
        if session.lecturer_id == proposed_lecturer_id:
            violations.append({
                "type": "lecturer_overlap",
                "lecturer_id": proposed_lecturer_id,
                "blocking_session_id": session.id,
            })

    return violations


def check_room_overlap(
    proposed_room_id,
    overlapping_sessions,
):
    violations = []

    for session in overlapping_sessions:
        if session.room_id == proposed_room_id:
            violations.append({
                "type": "room_overlap",
                "room_id": proposed_room_id,
                "blocking_session_id": session.id,
            })

    return violations


def check_lecturer_unavailability(
    target_session,
    proposed_start,
    proposed_lecturer_id,
    unavailability_rows,
):
    violations = []

    proposed_start_slot = datetime_to_slot(proposed_start)
    proposed_duration = get_duration_slots(target_session)
    proposed_end_slot = proposed_start_slot + proposed_duration

    for row in unavailability_rows:
        if row.lecturer_id != proposed_lecturer_id:
            continue

        if row.day is None:
            continue

        row_day = row.day.lower()

        if row_day not in DAY_TO_INDEX:
            continue

        blocked_slot = day_time_to_slot(
            row.day,
            f"{row.hour:02d}:00",
        )

        blocked_end_slot = blocked_slot + 1

        if (
            proposed_start_slot < blocked_end_slot
            and blocked_slot < proposed_end_slot
        ):
            violations.append({
                "type": "lecturer_unavailable",
                "lecturer_id": proposed_lecturer_id,
                "day": row.day,
                "hour": row.hour,
            })

    return violations


# ------------------------------------------------------------------
# Relaxable constraints
# ------------------------------------------------------------------


def check_class_capacity(
    target_session,
    proposed_room_id,
    rooms_by_id,
    active_capacity_sessions,
):
    if target_session.id not in active_capacity_sessions:
        return []

    required_capacity = target_session.module.required_capacity

    if required_capacity is None:
        return []

    room = rooms_by_id.get(proposed_room_id)

    if room is None:
        return []

    if room.capacity >= required_capacity:
        return []

    return [{
        "type": "class_capacity",
        "session_id": target_session.id,
        "room_id": proposed_room_id,
        "required_capacity": required_capacity,
        "room_capacity": room.capacity,
    }]


def check_class_equipment(
    target_session,
    proposed_room_id,
    rooms_by_id,
    active_equipment_sessions,
):
    if target_session.id not in active_equipment_sessions:
        return []

    if not target_session.module.required_equipment:
        return []

    room = rooms_by_id.get(proposed_room_id)

    if room is None:
        return []

    required = {
        item.strip().lower()
        for item in target_session.module.required_equipment.split(",")
        if item.strip()
    }

    available = {
        item.strip().lower()
        for item in (room.equipment or "").split(",")
        if item.strip()
    }

    missing = required - available

    if not missing:
        return []

    return [{
        "type": "class_equipment",
        "session_id": target_session.id,
        "room_id": proposed_room_id,
        "missing_equipment": sorted(missing),
    }]


def check_lecturer_daily_hours(
    target_session,
    proposed_start,
    proposed_lecturer_id,
    all_sessions,
    lecturer_constraints,
):
    proposed_day_name = proposed_start.strftime("%A").lower()
    proposed_day_index = DAY_TO_INDEX[proposed_day_name]

    active = any(
        constraint.lecturer_id == proposed_lecturer_id
        and constraint.day is not None
        and DAY_TO_INDEX.get(
            constraint.day.lower()
        ) == proposed_day_index
        for constraint in lecturer_constraints
    )

    if not active:
        return []

    current_hours = 0
    counted_sessions = []

    for session in all_sessions:
        if session.id == target_session.id:
            continue

        if session.lecturer_id != proposed_lecturer_id:
            continue

        session_day_name = (
            session.start.strftime("%A").lower()
        )

        session_day_index = DAY_TO_INDEX[
            session_day_name
        ]

        if session_day_index != proposed_day_index:
            continue

        duration = get_duration_slots(session)

        current_hours += duration

        counted_sessions.append({
            "session_id": session.id,
            "hours": duration,
        })

    proposed_hours = get_duration_slots(target_session)

    total_hours = (
        current_hours
        + proposed_hours
    )

    if total_hours <= LECTURER_MAX_HOURS_PER_DAY:
        return []

    return [{
        "type": "lecturer_daily_hours",
        "lecturer_id": proposed_lecturer_id,
        "day": proposed_day_name,
        "current_hours": current_hours,
        "proposed_hours": proposed_hours,
        "total_hours": total_hours,
        "limit": LECTURER_MAX_HOURS_PER_DAY,
        "existing_sessions": counted_sessions,
    }]


def check_cohort_daily_hours(
    target_session,
    proposed_start,
    all_sessions,
    cohort_constraints,
):
    violations = []

    proposed_day_name = (
        proposed_start.strftime("%A").lower()
    )

    proposed_day_index = DAY_TO_INDEX[
        proposed_day_name
    ]

    proposed_hours = get_duration_slots(
        target_session
    )

    for cohort in target_session.cohorts:

        active = any(
            constraint.cohort_id == cohort.id
            and constraint.day is not None
            and DAY_TO_INDEX.get(
                constraint.day.lower()
            ) == proposed_day_index
            for constraint in cohort_constraints
        )

        if not active:
            continue

        current_hours = 0
        counted_sessions = []

        for session in all_sessions:
            if session.id == target_session.id:
                continue

            session_day_name = (
                session.start.strftime("%A").lower()
            )

            session_day_index = DAY_TO_INDEX[
                session_day_name
            ]

            if session_day_index != proposed_day_index:
                continue

            belongs_to_cohort = any(
                session_cohort.id == cohort.id
                for session_cohort in session.cohorts
            )

            if not belongs_to_cohort:
                continue

            duration = get_duration_slots(session)

            current_hours += duration

            counted_sessions.append({
                "session_id": session.id,
                "hours": duration,
            })

        total_hours = (
            current_hours
            + proposed_hours
        )

        if total_hours > COHORT_MAX_HOURS_PER_DAY:
            violations.append({
                "type": "cohort_daily_hours",
                "cohort_id": cohort.id,
                "day": proposed_day_name,
                "current_hours": current_hours,
                "proposed_hours": proposed_hours,
                "total_hours": total_hours,
                "limit": COHORT_MAX_HOURS_PER_DAY,
                "existing_sessions": counted_sessions,
            })

    return violations


def check_lecturer_lunch_break(
    target_session,
    proposed_start,
    proposed_lecturer_id,
    all_sessions,
    lunch_constraints,
):
    violations = []

    proposed_day_name = (
        proposed_start.strftime("%A").lower()
    )

    proposed_day_index = DAY_TO_INDEX[
        proposed_day_name
    ]

    matching_constraints = [
        constraint
        for constraint in lunch_constraints
        if (
            constraint.lecturer_id
            == proposed_lecturer_id

            and constraint.day is not None

            and DAY_TO_INDEX.get(
                constraint.day.lower()
            ) == proposed_day_index
        )
    ]

    if not matching_constraints:
        return []

    proposed_start_slot = datetime_to_slot(
        proposed_start
    )

    proposed_duration = get_duration_slots(
        target_session
    )

    proposed_end_slot = (
        proposed_start_slot
        + proposed_duration
    )

    lecturer_intervals = []

    for session in all_sessions:
        if session.id == target_session.id:
            continue

        if session.lecturer_id != proposed_lecturer_id:
            continue

        session_day_name = (
            session.start.strftime("%A").lower()
        )

        session_day_index = DAY_TO_INDEX[
            session_day_name
        ]

        if session_day_index != proposed_day_index:
            continue

        start_slot = datetime_to_slot(
            session.start
        )

        end_slot = (
            start_slot
            + get_duration_slots(session)
        )

        lecturer_intervals.append(
            (start_slot, end_slot)
        )

    # Add the proposed placement.
    lecturer_intervals.append(
        (
            proposed_start_slot,
            proposed_end_slot,
        )
    )

    lunch_12_start = day_time_to_slot(
        proposed_day_name,
        "12:00",
    )
    lunch_12_end = lunch_12_start + 1

    lunch_13_start = day_time_to_slot(
        proposed_day_name,
        "13:00",
    )
    lunch_13_end = lunch_13_start + 1

    def is_free(start_slot, end_slot):
        for (
            session_start,
            session_end,
        ) in lecturer_intervals:

            if (
                session_start < end_slot
                and start_slot < session_end
            ):
                return False

        return True

    lunch_12_free = is_free(
        lunch_12_start,
        lunch_12_end,
    )

    lunch_13_free = is_free(
        lunch_13_start,
        lunch_13_end,
    )

    if not lunch_12_free and not lunch_13_free:
        violations.append({
            "type": "lecturer_lunch_break",
            "lecturer_id": proposed_lecturer_id,
            "day": proposed_day_name,
            "proposed_start": proposed_start.strftime(
                "%Y-%m-%dT%H:%M:%S"
            ),
        })

    return violations


# ------------------------------------------------------------------
# Main diagnostic
# ------------------------------------------------------------------


def diagnose_specific_request(
    db,
    target_session,
    proposed_start,
    proposed_room_id,
    proposed_lecturer_id,
    request: RescheduleRequestIn | None = None,
):
    violations = []

    all_sessions = db.query(Session).all()

    overlapping_sessions = sessions_overlapping(
        db,
        target_session,
        proposed_start,
    )

    # --------------------------------------------------------------
    # Hard constraints
    # --------------------------------------------------------------

    violations.extend(
        check_lecturer_overlap(
            proposed_lecturer_id,
            overlapping_sessions,
        )
    )

    violations.extend(
        check_room_overlap(
            proposed_room_id,
            overlapping_sessions,
        )
    )

    unavailability_rows = (
        get_all_lecturer_unavailability(db)
    )

    violations.extend(
        check_lecturer_unavailability(
            target_session,
            proposed_start,
            proposed_lecturer_id,
            unavailability_rows,
        )
    )

    # --------------------------------------------------------------
    # Relaxable constraints
    # --------------------------------------------------------------

    rooms = get_rooms(db)
    rooms_by_id = {room.id: room for room in rooms}

    active_capacity_sessions = get_active_class_capacity_sessions(db)
    active_equipment_sessions = get_active_class_equipment_sessions(db)
    lecturer_constraints = get_active_lecturer_daily_hour_constraints(db)
    cohort_constraints = get_active_cohort_daily_hour_constraints(db)
    lunch_constraints = get_active_lecturer_lunch_constraints(db)

    (
        active_capacity_sessions,
        active_equipment_sessions,
        cohort_constraints,
        lecturer_constraints,
        lunch_constraints,
    ) = apply_temporary_deactivations(
        request,
        active_capacity_sessions=active_capacity_sessions,
        active_equipment_sessions=active_equipment_sessions,
        cohort_daily_constraints=cohort_constraints,
        lecturer_daily_constraints=lecturer_constraints,
        lecturer_lunch_constraints=lunch_constraints,
    )

    violations.extend(
        check_class_capacity(
            target_session,
            proposed_room_id,
            rooms_by_id,
            active_capacity_sessions,
        )
    )

    violations.extend(
        check_class_equipment(
            target_session,
            proposed_room_id,
            rooms_by_id,
            active_equipment_sessions,
        )
    )

    violations.extend(
        check_lecturer_daily_hours(
            target_session,
            proposed_start,
            proposed_lecturer_id,
            all_sessions,
            lecturer_constraints,
        )
    )

    violations.extend(
        check_cohort_daily_hours(
            target_session,
            proposed_start,
            all_sessions,
            cohort_constraints,
        )
    )

    violations.extend(
        check_lecturer_lunch_break(
            target_session,
            proposed_start,
            proposed_lecturer_id,
            all_sessions,
            lunch_constraints,
        )
    )

    return {
        "violations": violations,
        "overlapping_sessions": [
            session.id
            for session in overlapping_sessions
        ],
    }



def diagnose_working_day(db, day: str, working_sessions,):
    violations = []

    normalized_day = day.lower()

    # Safety: only keep sessions that actually belong to this day
    day_sessions = [
        session
        for session in working_sessions
        if session.start.strftime("%A").lower() == normalized_day
    ]

    # --------------------------------------------------------------
    # 1. Room overlap
    # --------------------------------------------------------------

    for i in range(len(day_sessions)):
        for j in range(i + 1, len(day_sessions)):
            a = day_sessions[i]
            b = day_sessions[j]

            a_start = datetime_to_slot(a.start)
            a_end = a_start + get_duration_slots(a)

            b_start = datetime_to_slot(b.start)
            b_end = b_start + get_duration_slots(b)

            overlaps = (
                a_start < b_end
                and b_start < a_end
            )

            if overlaps and a.room_id == b.room_id:
                violations.append({
                    "type": "room_overlap",
                    "room_id": a.room_id,
                    "session_ids": [
                        a.id,
                        b.id,
                    ],
                })

    # --------------------------------------------------------------
    # 2. Lecturer overlap
    # --------------------------------------------------------------

    for i in range(len(day_sessions)):
        for j in range(i + 1, len(day_sessions)):
            a = day_sessions[i]
            b = day_sessions[j]

            a_start = datetime_to_slot(a.start)
            a_end = a_start + get_duration_slots(a)

            b_start = datetime_to_slot(b.start)
            b_end = b_start + get_duration_slots(b)

            overlaps = (
                a_start < b_end
                and b_start < a_end
            )

            if (
                overlaps
                and a.lecturer_id == b.lecturer_id
            ):
                violations.append({
                    "type": "lecturer_overlap",
                    "lecturer_id": a.lecturer_id,
                    "session_ids": [
                        a.id,
                        b.id,
                    ],
                })

    # --------------------------------------------------------------
    # 3. Lecturer unavailability
    # --------------------------------------------------------------

    unavailability_rows = get_all_lecturer_unavailability(db)
    print("\n===== ALL LECTURER UNAVAILABILITY =====")

    for row in unavailability_rows:
        print(
            "id:", row.id,
            "| lecturer_id:", row.lecturer_id,
            "| day:", row.day,
            "| hour:", row.hour,
        )

    print("=======================================\n")

    for session in day_sessions:
        session_start = datetime_to_slot(session.start)
        session_end = (
            session_start
            + get_duration_slots(session)
        )

        for row in unavailability_rows:
            if row.lecturer_id != session.lecturer_id:
                continue

            if row.day is None:
                continue

            if not _days_match(
                row.day,
                normalized_day,
            ):
                continue

            blocked_start = day_time_to_slot(
                row.day,
                f"{row.hour:02d}:00",
            )

            blocked_end = blocked_start + 1

            overlaps = (
                session_start < blocked_end
                and blocked_start < session_end
            )

            if overlaps:
                violations.append({
                    "type": "lecturer_unavailable",
                    "lecturer_id": session.lecturer_id,
                    "session_ids": [
                        session.id,
                    ],
                    "day": normalized_day,
                    "hour": row.hour,
                })

            if overlaps:
                print("\n===== UNAVAILABILITY VIOLATION =====")
                print("session id:", session.id)
                print("module id:", session.module_id)
                print("session lecturer_id:", session.lecturer_id)
                print("session start:", session.start)
                print("session end:", session.end)

                print("row lecturer_id:", row.lecturer_id)
                print("row day:", row.day)
                print("row hour:", row.hour)

                print("session_start slot:", session_start)
                print("session_end slot:", session_end)
                print("blocked_start slot:", blocked_start)
                print("blocked_end slot:", blocked_end)
                print("overlaps:", overlaps)
                print("====================================\n")

                violations.append({
                    "type": "lecturer_unavailable",
                    "lecturer_id": session.lecturer_id,
                    "session_ids": [
                        session.id,
                    ],
                    "day": normalized_day,
                    "hour": row.hour,
                })



    # --------------------------------------------------------------
    # 4. Lecturer daily hours
    # --------------------------------------------------------------

    lecturer_constraints = (
        get_active_lecturer_daily_hour_constraints(db)
    )

    lecturer_ids = {
        session.lecturer_id
        for session in day_sessions
    }

    for lecturer_id in lecturer_ids:

        active = any(
            constraint.lecturer_id == lecturer_id
            and constraint.day is not None
            and _days_match(
                constraint.day,
                normalized_day,
            )
            for constraint in lecturer_constraints
        )

        if not active:
            continue

        lecturer_sessions = [
            session
            for session in day_sessions
            if session.lecturer_id == lecturer_id
        ]

        total_hours = sum(
            get_duration_slots(session)
            for session in lecturer_sessions
        )

        if total_hours > LECTURER_MAX_HOURS_PER_DAY:
            violations.append({
                "type": "lecturer_daily_hours",
                "lecturer_id": lecturer_id,
                "day": normalized_day,
                "total_hours": total_hours,
                "limit": LECTURER_MAX_HOURS_PER_DAY,
                "session_ids": [
                    session.id
                    for session in lecturer_sessions
                ],
            })

    # --------------------------------------------------------------
    # 5. Cohort daily hours
    # --------------------------------------------------------------

    cohort_constraints = (
        get_active_cohort_daily_hour_constraints(db)
    )

    cohort_ids = {
        cohort.id
        for session in day_sessions
        for cohort in session.cohorts
    }

    for cohort_id in cohort_ids:

        active = any(
            constraint.cohort_id == cohort_id
            and constraint.day is not None
            and _days_match(
                constraint.day,
                normalized_day,
            )
            for constraint in cohort_constraints
        )

        if not active:
            continue

        cohort_sessions = [
            session
            for session in day_sessions
            if any(
                cohort.id == cohort_id
                for cohort in session.cohorts
            )
        ]

        total_hours = sum(
            get_duration_slots(session)
            for session in cohort_sessions
        )

        if total_hours > COHORT_MAX_HOURS_PER_DAY:
            violations.append({
                "type": "cohort_daily_hours",
                "cohort_id": cohort_id,
                "day": normalized_day,
                "total_hours": total_hours,
                "limit": COHORT_MAX_HOURS_PER_DAY,
                "session_ids": [
                    session.id
                    for session in cohort_sessions
                ],
            })

    # --------------------------------------------------------------
    # 6. Lecturer lunch break
    # --------------------------------------------------------------

    lunch_constraints = (
        get_active_lecturer_lunch_constraints(db)
    )

    for lecturer_id in lecturer_ids:

        active = any(
            constraint.lecturer_id == lecturer_id
            and constraint.day is not None
            and _days_match(
                constraint.day,
                normalized_day,
            )
            for constraint in lunch_constraints
        )

        if not active:
            continue

        lecturer_sessions = [
            session
            for session in day_sessions
            if session.lecturer_id == lecturer_id
        ]

        lunch_12_start = day_time_to_slot(
            normalized_day,
            "12:00",
        )
        lunch_12_end = lunch_12_start + 1

        lunch_13_start = day_time_to_slot(
            normalized_day,
            "13:00",
        )
        lunch_13_end = lunch_13_start + 1

        sessions_blocking_12 = []
        sessions_blocking_13 = []

        for session in lecturer_sessions:
            start_slot = datetime_to_slot(session.start)
            end_slot = (
                start_slot
                + get_duration_slots(session)
            )

            if (
                start_slot < lunch_12_end
                and lunch_12_start < end_slot
            ):
                sessions_blocking_12.append(
                    session.id
                )

            if (
                start_slot < lunch_13_end
                and lunch_13_start < end_slot
            ):
                sessions_blocking_13.append(
                    session.id
                )

        if (
            sessions_blocking_12
            and sessions_blocking_13
        ):
            violations.append({
                "type": "lecturer_lunch_break",
                "lecturer_id": lecturer_id,
                "day": normalized_day,
                "session_ids": list(set(
                    sessions_blocking_12
                    + sessions_blocking_13
                )),
                "blocking_12_13": sessions_blocking_12,
                "blocking_13_14": sessions_blocking_13,
            })

    return violations


# endregion