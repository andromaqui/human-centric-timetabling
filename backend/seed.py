from datetime import datetime

from app.constraint_logic import (
    attach_session_constraints,
    attach_lecturer_constraints,
    attach_cohort_constraints,
    attach_room_constraints,
)
from app.database import SessionLocal, engine
from app import models


models.Base.metadata.create_all(bind=engine)

db = SessionLocal()


# region Programs

programs = [
    models.Program(id="cs", code="CS", name="Computer Science"),
    models.Program(id="ds", code="DS", name="Data Science"),
    models.Program(id="se", code="SE", name="Software Engineering"),
]

db.add_all(programs)

# endregion


# region Cohorts

cohorts = [
    models.Cohort(id="cs-y1", name="CS Year 1", program_id="cs"),
    models.Cohort(id="cs-y2", name="CS Year 2", program_id="cs"),
    models.Cohort(id="cs-y3", name="CS Year 3", program_id="cs"),
    models.Cohort(id="ds-y1", name="DS Year 1", program_id="ds"),
    models.Cohort(id="ds-y2", name="DS Year 2", program_id="ds"),
    models.Cohort(id="se-y1", name="SE Year 1", program_id="se"),
    models.Cohort(id="se-y2", name="SE Year 2", program_id="se"),
]

db.add_all(cohorts)

# endregion


# region Lecturers

lecturers = [
    models.Lecturer(id="lecturer-1", name="Dr. Maria Chen"),
    models.Lecturer(id="lecturer-2", name="Prof. James O'Connor"),
    models.Lecturer(id="lecturer-3", name="Dr. Aisha Khan"),
    models.Lecturer(id="lecturer-4", name="Dr. Tom Baxter"),
    models.Lecturer(id="lecturer-5", name="Prof. Linda Osei"),
    models.Lecturer(id="lecturer-6", name="Dr. Samuel Ruiz"),
]

db.add_all(lecturers)


# Lecturer unavailability
#
# Each row represents one unavailable hour.
#
# Example:
# day="fri", hour=9
# means Friday 09:00 - 10:00.

unavailability = [
    # -------------------------------------------------
    # Dr. Maria Chen — lecturer-1
    #
    # SPECIAL CASE: she is unavailable every single hour
    # of the teaching week EXCEPT Monday 12:00 - 14:00
    # (hours 12 and 13). This is built separately below
    # via a full-week loop.
    # -------------------------------------------------

    # -------------------------------------------------
    # Prof. James O'Connor — lecturer-2
    # Tuesday 15:00 - 16:00
    # Friday 10:00 - 11:00
    # -------------------------------------------------

    models.LecturerUnavailability(
        lecturer_id="lecturer-2",
        day="tue",
        hour=15,
    ),
    models.LecturerUnavailability(
        lecturer_id="lecturer-2",
        day="fri",
        hour=10,
    ),

    # -------------------------------------------------
    # Dr. Aisha Khan — lecturer-3
    # Tuesday 09:00 - 10:00
    # Wednesday 16:00 - 17:00
    # -------------------------------------------------

    models.LecturerUnavailability(
        lecturer_id="lecturer-3",
        day="tue",
        hour=9,
    ),
    models.LecturerUnavailability(
        lecturer_id="lecturer-3",
        day="wed",
        hour=16,
    ),

    # -------------------------------------------------
    # Dr. Tom Baxter — lecturer-4
    # Monday 08:00 - 09:00
    # Friday 13:00 - 15:00
    # -------------------------------------------------

    models.LecturerUnavailability(
        lecturer_id="lecturer-4",
        day="mon",
        hour=8,
    ),
    models.LecturerUnavailability(
        lecturer_id="lecturer-4",
        day="fri",
        hour=13,
    ),
    models.LecturerUnavailability(
        lecturer_id="lecturer-4",
        day="fri",
        hour=14,
    ),

    # -------------------------------------------------
    # Prof. Linda Osei — lecturer-5
    # Monday 15:00 - 17:00
    # -------------------------------------------------

    models.LecturerUnavailability(
        lecturer_id="lecturer-5",
        day="mon",
        hour=15,
    ),
    models.LecturerUnavailability(
        lecturer_id="lecturer-5",
        day="mon",
        hour=16,
    ),

    # -------------------------------------------------
    # Dr. Samuel Ruiz — lecturer-6
    # Friday 09:00 - 12:00
    # -------------------------------------------------

    models.LecturerUnavailability(
        lecturer_id="lecturer-6",
        day="fri",
        hour=9,
    ),
    models.LecturerUnavailability(
        lecturer_id="lecturer-6",
        day="fri",
        hour=10,
    ),
    models.LecturerUnavailability(
        lecturer_id="lecturer-6",
        day="fri",
        hour=11,
    ),
]


# Dr. Maria Chen (lecturer-1) is unavailable every hour of the
# teaching week EXCEPT Monday 12:00-14:00 (hours 12 and 13).
# This means any session assigned to her can only be scheduled
# within that two-hour Monday window.
TEACHING_DAYS = ["mon", "tue", "wed", "thu", "fri"]
TEACHING_HOURS = range(9, 17)  # 09:00 - 16:00 (last row covers 16:00-17:00)
LECTURER_1_FREE_SLOTS = {("mon", 12), ("mon", 13)}

for day in TEACHING_DAYS:
    for hour in TEACHING_HOURS:
        if (day, hour) in LECTURER_1_FREE_SLOTS:
            continue
        unavailability.append(
            models.LecturerUnavailability(
                lecturer_id="lecturer-1",
                day=day,
                hour=hour,
            )
        )


db.add_all(unavailability)

# endregion


# region Rooms

rooms = [
    models.Room(
        id="room-b204",
        name="Room B204",
        capacity=60,
        equipment="Projector,Linux lab",
    ),
    models.Room(
        id="lab-3",
        name="Lab 3",
        capacity=40,
        equipment="Whiteboard",
    ),
    models.Room(
        id="room-a101",
        name="Room A101",
        capacity=70,
        equipment="Projector",
    ),
    models.Room(
        id="room-c302",
        name="Room C302",
        capacity=40,
        equipment="Whiteboard,Projector",
    ),
    models.Room(
        id="room-d105",
        name="Room D105",
        capacity=50,
        equipment="Projector",
    ),
    models.Room(
        id="room-e210",
        name="Room E210",
        capacity=70,
        equipment="Whiteboard",
    ),
]

db.add_all(rooms)

# endregion


# region Modules

modules = [
    models.Module(
        id="module-1",
        code="CS101",
        title="Programming Fundamentals",
        required_capacity=50,
        required_equipment="Projector,Linux lab",
    ),
    models.Module(
        id="module-2",
        code="CS204",
        title="Data Structures",
        required_capacity=40,
        required_equipment="Whiteboard",
    ),
    models.Module(
        id="module-3",
        code="DS110",
        title="Intro to Data Science",
        required_capacity=60,
        required_equipment="Projector",
    ),
    models.Module(
        id="module-4",
        code="SE120",
        title="Software Design",
        required_capacity=35,
        required_equipment="Whiteboard,Projector",
    ),
    models.Module(
        id="module-5",
        code="CS310",
        title="Algorithms",
        required_capacity=45,
        required_equipment="Projector",
    ),
    models.Module(
        id="module-6",
        code="DS220",
        title="Machine Learning",
        required_capacity=50,
        required_equipment="Projector",
    ),
    models.Module(
        id="module-7",
        code="SE210",
        title="Databases",
        required_capacity=40,
        required_equipment="Whiteboard",
    ),
    models.Module(
        id="module-8",
        code="CS150",
        title="Discrete Math",
        required_capacity=55,
        required_equipment="Whiteboard",
    ),
    models.Module(
        id="module-9",
        code="DS330",
        title="Statistics for Data Science",
        required_capacity=45,
        required_equipment="Projector",
    ),
    models.Module(
        id="module-10",
        code="SE305",
        title="Software Testing",
        required_capacity=35,
        required_equipment="Whiteboard,Projector",
    ),
]

db.add_all(modules)

# endregion


# region Constraints

constraints = [
    models.Constraint(
        id="lecturer-one-class-at-time",
        name="Lecturer cannot teach more than 1 class at a time",
        description=(
            "A lecturer can never be scheduled to teach two "
            "sessions that overlap in time."
        ),
        stakeholder="Lecturer",
        type="unrelaxable",
    ),
    models.Constraint(
        id="lecturer-unavailability",
        name="Lecturer unavailability",
        description=(
            "Sessions are never scheduled during the specific "
            "days and hours a lecturer has marked as unavailable."
        ),
        stakeholder="Lecturer",
        type="unrelaxable",
    ),
    models.Constraint(
        id="room-one-booking-at-time",
        name="A room can have maximum one booking at a time",
        description=(
            "A room can never host two sessions that overlap "
            "in time."
        ),
        stakeholder="Room",
        type="unrelaxable",
    ),
    models.Constraint(
        id="lecturer-lunch-break",
        name="Lecturer lunch break",
        description=(
            "Lecturers are given a protected lunch break each "
            "day which lasts 1 hour and can be scheduled between "
            "12:00 to 14:00."
        ),
        stakeholder="Lecturer",
        type="relaxable",
    ),
    models.Constraint(
        id="lecturer-max-one-hour-per-day",
        name="Lecturer shall teach maximum 4 hour per day",
        description=(
            "Caps how many hours a lecturer can be scheduled to "
            "teach on a single day, to prevent overload."
        ),
        stakeholder="Lecturer",
        type="relaxable",
    ),
    models.Constraint(
        id="cohort-max-teaching-hours-per-day",
        name="Cohort's maximum teaching hours per day",
        description=(
            "Caps how many hours a cohort of students can be "
            "scheduled for classes on a single day."
        ),
        stakeholder="Cohort",
        type="relaxable",
    ),
    models.Constraint(
        id="class-equipment",
        name="Class equipment",
        description=(
            "A session is only scheduled in a room that has the "
            "equipment its module requires "
            "(e.g. a projector or a lab)."
        ),
        stakeholder="Session",
        type="relaxable",
    ),
    models.Constraint(
        id="class-capacity",
        name="Class capacity",
        description=(
            "A session is only scheduled in a room with enough "
            "seats for the module's expected class size."
        ),
        stakeholder="Session",
        type="relaxable",
    ),
]

db.add_all(constraints)
db.commit()

# endregion


# region Attach constraint instances

for lecturer in lecturers:
    attach_lecturer_constraints(db, lecturer.id)

for cohort in cohorts:
    attach_cohort_constraints(db, cohort.id)

for room in rooms:
    attach_room_constraints(db, room.id)

db.commit()

# endregion


# region Sessions

# Small deterministic clash-free timetable.
# Monday–Thursday contain classes.
# Friday is completely empty for solver testing.

sessions_data = [
    {
        "id": "session-1",
        "module_id": "module-1",
        "lecturer_id": "lecturer-1",
        "room_id": "room-b204",
        "type": "lecture",
        "start": "2026-09-21T09:00:00",
        "end": "2026-09-21T11:00:00",
        "program_ids": ["cs"],
        "cohort_ids": ["cs-y1"],
    },
    {
        "id": "session-2",
        "module_id": "module-2",
        "lecturer_id": "lecturer-2",
        "room_id": "lab-3",
        "type": "lecture",
        "start": "2026-09-21T11:00:00",
        "end": "2026-09-21T13:00:00",
        "program_ids": ["cs"],
        "cohort_ids": ["cs-y2"],
    },
    {
        "id": "session-3",
        "module_id": "module-3",
        "lecturer_id": "lecturer-3",
        "room_id": "room-a101",
        "type": "lecture",
        "start": "2026-09-21T14:00:00",
        "end": "2026-09-21T16:00:00",
        "program_ids": ["ds"],
        "cohort_ids": ["ds-y1"],
    },
    {
        "id": "session-4",
        "module_id": "module-4",
        "lecturer_id": "lecturer-4",
        "room_id": "room-c302",
        "type": "seminar",
        "start": "2026-09-22T09:00:00",
        "end": "2026-09-22T11:00:00",
        "program_ids": ["se"],
        "cohort_ids": ["se-y1"],
    },
    {
        "id": "session-5",
        "module_id": "module-5",
        "lecturer_id": "lecturer-5",
        "room_id": "room-d105",
        "type": "lecture",
        "start": "2026-09-22T11:00:00",
        "end": "2026-09-22T13:00:00",
        "program_ids": ["cs"],
        "cohort_ids": ["cs-y3"],
    },
    {
        "id": "session-6",
        "module_id": "module-6",
        "lecturer_id": "lecturer-6",
        "room_id": "room-a101",
        "type": "lab",
        "start": "2026-09-22T14:00:00",
        "end": "2026-09-22T16:00:00",
        "program_ids": ["ds"],
        "cohort_ids": ["ds-y2"],
    },
    {
        "id": "session-7",
        "module_id": "module-8",
        "lecturer_id": "lecturer-2",
        "room_id": "room-e210",
        "type": "tutorial",
        "start": "2026-09-23T09:00:00",
        "end": "2026-09-23T10:00:00",
        "program_ids": ["cs"],
        "cohort_ids": ["cs-y1", "cs-y2"],
    },
    {
        "id": "session-8",
        "module_id": "module-9",
        "lecturer_id": "lecturer-4",
        "room_id": "room-d105",
        "type": "lecture",
        "start": "2026-09-23T11:00:00",
        "end": "2026-09-23T13:00:00",
        "program_ids": ["ds"],
        "cohort_ids": ["ds-y1", "ds-y2"],
    },
    {
        "id": "session-9",
        "module_id": "module-10",
        "lecturer_id": "lecturer-6",
        "room_id": "room-c302",
        "type": "seminar",
        "start": "2026-09-23T14:00:00",
        "end": "2026-09-23T16:00:00",
        "program_ids": ["se"],
        "cohort_ids": ["se-y1", "se-y2"],
    },
    {
        "id": "session-10",
        "module_id": "module-1",
        "lecturer_id": "lecturer-3",
        "room_id": "room-b204",
        "type": "lab",
        "start": "2026-09-24T09:00:00",
        "end": "2026-09-24T12:00:00",
        "program_ids": ["cs"],
        "cohort_ids": ["cs-y1"],
    },
    {
        "id": "session-11",
        "module_id": "module-7",
        "lecturer_id": "lecturer-5",
        "room_id": "lab-3",
        "type": "lecture",
        "start": "2026-09-24T11:00:00",
        "end": "2026-09-24T13:00:00",
        "program_ids": ["se"],
        "cohort_ids": ["se-y2"],
    },
    {
        "id": "session-12",
        "module_id": "module-3",
        "lecturer_id": "lecturer-4",
        "room_id": "room-a101",
        "type": "tutorial",
        "start": "2026-09-24T14:00:00",
        "end": "2026-09-24T15:00:00",
        "program_ids": ["ds"],
        "cohort_ids": ["ds-y1"],
    },
]


for s in sessions_data:
    session = models.Session(
        id=s["id"],
        module_id=s["module_id"],
        lecturer_id=s["lecturer_id"],
        room_id=s["room_id"],
        type=s["type"],
        start=datetime.fromisoformat(s["start"]),
        end=datetime.fromisoformat(s["end"]),
    )

    session.programs = (
        db.query(models.Program)
        .filter(
            models.Program.id.in_(
                s["program_ids"]
            )
        )
        .all()
    )

    session.cohorts = (
        db.query(models.Cohort)
        .filter(
            models.Cohort.id.in_(
                s["cohort_ids"]
            )
        )
        .all()
    )

    db.add(session)
    db.flush()

    attach_session_constraints(
        db,
        session.id,
    )


db.commit()

# endregion

# region Candidate Solutions

candidate_solution = models.CandidateSolution(
    id="candidate-1",
    name="Tuesday morning option",
    status="saved",

    request_id="request-1",
    request_created_at=datetime.utcnow(),

    requested_session_id="session-11",
    requested_module_id="module-7",
    request_type="reschedule-class",

    additional_change_count=1,

    request={
        "session_id": "session-11",
        "module_id": "module-7",
        "before": {
            "day": "thu",
            "time": "11:00",
            "room_id": "lab-3",
            "lecturer_id": "lecturer-5",
        },
        "after": {
            "day": "tue",
            "time": "10:00",
            "room_id": "lab-3",
            "lecturer_id": "lecturer-5",
        },
    },

    additional_changes=[
        {
            "session_id": "session-5",
            "module_id": "module-5",
            "before": {
                "day": "tue",
                "time": "11:00",
                "room_id": "room-d105",
                "lecturer_id": "lecturer-id"
            },
            "after": {
                "day": "mon",
                "time": "13:00",
                "room_id": "room-d105",
                "lecturer_id": "lecturer-id"
            },
        }
    ],

    stakeholder_impacts=[],

    objectives=[],

    constraints=[
        {
            "group": "Lecturer",
            "rule": "Lecturer cannot teach more than 1 class at a time",
            "state": "Enabled",
            "relaxable": False,
        },
        {
            "group": "Lecturer",
            "rule": "Lecturer unavailability",
            "state": "Enabled",
            "relaxable": False,
        },
        {
            "group": "Room",
            "rule": "A room can have maximum one booking at a time",
            "state": "Enabled",
            "relaxable": False,
        },
        {
            "group": "Lecturer",
            "rule": "Lecturer lunch break",
            "state": "Enabled",
            "relaxable": True,
        },
        {
            "group": "Lecturer",
            "rule": "Lecturer shall teach maximum 4 hour per day",
            "state": "Enabled",
            "relaxable": True,
        },
        {
            "group": "Cohort",
            "rule": "Cohort's maximum teaching hours per day",
            "state": "Enabled",
            "relaxable": True,
        },
        {
            "group": "Session",
            "rule": "Class equipment",
            "state": "Enabled",
            "relaxable": True,
        },
        {
            "group": "Session",
            "rule": "Class capacity",
            "state": "Enabled",
            "relaxable": True,
        },
    ],

    resulting_timetable=[],

    solve_settings={
        "mode": "max_additional_changes",
        "max_additional_changes": 1,
    },

    solver_metadata={},
)

db.add(candidate_solution)
db.commit()

# endregion

db.close()

print("Seed complete.")