from datetime import datetime

from app import models
from app.constraint_logic import (
    attach_session_constraints,
    attach_lecturer_constraints,
    attach_cohort_constraints,
    attach_room_constraints,
)
from app.database import SessionLocal, engine


# ============================================================
# ANY / FIND EXPLAINABILITY STUDY SEED
#
# Purpose:
# Deterministic examples for three infeasible FIND requests:
#
# A — Room = ANY
# B — Time = ANY
# C — Room = ANY + Time = ANY
#
# Run against an EMPTY / RESET study database.
# ============================================================

models.Base.metadata.create_all(bind=engine)
db = SessionLocal()


# ------------------------------------------------------------
# Program
# ------------------------------------------------------------

program = models.Program(
    id="any-study-cs",
    code="CS",
    name="Computer Science",
)
db.add(program)


# ------------------------------------------------------------
# Cohorts
# ------------------------------------------------------------

cohorts = [
    models.Cohort(
        id="any-room-cohort",
        name="CS Year 3 – Group A",
        program_id="any-study-cs",
    ),
    models.Cohort(
        id="any-time-cohort",
        name="CS Year 3 – Group B",
        program_id="any-study-cs",
    ),
    models.Cohort(
        id="any-both-cohort",
        name="CS Year 4 – Group A",
        program_id="any-study-cs",
    ),
    # Background cohorts for a more realistic populated timetable.
    models.Cohort(id="bg-cohort-01", name="CS Background Group 1", program_id="any-study-cs"),
    models.Cohort(id="bg-cohort-02", name="CS Background Group 2", program_id="any-study-cs"),
    models.Cohort(id="bg-cohort-03", name="CS Background Group 3", program_id="any-study-cs"),
    models.Cohort(id="bg-cohort-04", name="CS Background Group 4", program_id="any-study-cs"),
    models.Cohort(id="bg-cohort-05", name="CS Background Group 5", program_id="any-study-cs"),
    models.Cohort(id="bg-cohort-06", name="CS Background Group 6", program_id="any-study-cs"),
    models.Cohort(id="bg-cohort-07", name="CS Background Group 7", program_id="any-study-cs"),
    models.Cohort(id="bg-cohort-08", name="CS Background Group 8", program_id="any-study-cs"),
    models.Cohort(id="bg-cohort-09", name="CS Background Group 9", program_id="any-study-cs"),
    models.Cohort(id="bg-cohort-10", name="CS Background Group 10", program_id="any-study-cs"),

]

db.add_all(cohorts)


# ------------------------------------------------------------
# Lecturers
# ------------------------------------------------------------

lecturers = [
    models.Lecturer(
        id="any-room-lect",
        name="Dr. Emily Walsh",
    ),
    models.Lecturer(
        id="any-time-lect",
        name="Dr. Daniel Hughes",
    ),
    models.Lecturer(
        id="any-both-lect",
        name="Dr. Rachel Brennan",
    ),
    models.Lecturer(
        id="any-anchor-lect",
        name="Dr. Michael Doyle",
    ),
    models.Lecturer(id="any-c-fri-lect-1", name="Dr. Laura Byrne"),
    models.Lecturer(id="any-c-fri-lect-2", name="Dr. Kevin O'Shea"),
    models.Lecturer(id="any-c-fri-lect-3", name="Dr. Sarah Flynn"),
    # Lecturers used only by background sessions.
    models.Lecturer(id="bg-lect-01", name="Dr. Aoife Murphy"),
    models.Lecturer(id="bg-lect-02", name="Dr. Cian O’Brien"),
    models.Lecturer(id="bg-lect-03", name="Dr. Niamh Ryan"),
    models.Lecturer(id="bg-lect-04", name="Dr. Conor Hayes"),
    models.Lecturer(id="bg-lect-05", name="Dr. Orla Kennedy"),
    models.Lecturer(id="bg-lect-06", name="Dr. Eoin Gallagher"),
    models.Lecturer(id="bg-lect-07", name="Dr. Maeve Collins"),
    models.Lecturer(id="bg-lect-08", name="Dr. Sean Fitzpatrick"),
    models.Lecturer(id="bg-lect-09", name="Dr. Ciara Murray"),
    models.Lecturer(id="bg-lect-10", name="Dr. Patrick Quinn"),

]

db.add_all(lecturers)


# ------------------------------------------------------------
# Rooms
# ------------------------------------------------------------

rooms = [
    models.Room(
        id="any-room-a",
        name="ENG 1.01",
        capacity=60,
        equipment="Projector,Whiteboard",
    ),
    models.Room(
        id="any-room-b",
        name="ENG 1.02",
        capacity=60,
        equipment="Projector,Whiteboard",
    ),
    models.Room(
        id="any-room-c",
        name="ENG 1.03",
        capacity=60,
        equipment="Projector,Whiteboard",
    ),
    models.Room(
        id="any-small-room",
        name="ENG 2.12",
        capacity=20,
        equipment="Projector",
    ),
    # Separate rooms used only by background sessions.
    models.Room(id="bg-room-01", name="SCI 1.10", capacity=70, equipment="Projector,Whiteboard"),
    models.Room(id="bg-room-02", name="SCI 1.12", capacity=70, equipment="Projector,Whiteboard"),
    models.Room(id="bg-room-03", name="SCI 2.01", capacity=70, equipment="Projector,Whiteboard"),
    models.Room(id="bg-room-04", name="SCI 2.03", capacity=70, equipment="Projector,Whiteboard"),
    models.Room(id="bg-room-05", name="SCI 2.05", capacity=70, equipment="Projector,Whiteboard"),
    models.Room(id="bg-room-06", name="SCI 3.02", capacity=70, equipment="Projector,Whiteboard"),
    models.Room(id="bg-room-07", name="SCI 3.04", capacity=70, equipment="Projector,Whiteboard"),
    models.Room(id="bg-room-08", name="TECH 1.20", capacity=70, equipment="Projector,Whiteboard"),
    models.Room(id="bg-room-09", name="TECH 2.18", capacity=70, equipment="Projector,Whiteboard"),
    models.Room(id="bg-room-10", name="TECH 2.20", capacity=70, equipment="Projector,Whiteboard"),

]

db.add_all(rooms)


# ------------------------------------------------------------
# Modules
# ------------------------------------------------------------

modules = [
    models.Module(
        id="any-mod-room",
        code="CS311",
        title="Human-Computer Interaction",
        required_capacity=30,
        required_equipment="Projector",
    ),
    models.Module(
        id="any-mod-time",
        code="CS312",
        title="Cloud Computing",
        required_capacity=50,
        required_equipment="Projector",
    ),
    models.Module(
        id="any-mod-both",
        code="CS411",
        title="Distributed Systems",
        required_capacity=30,
        required_equipment="Projector",
    ),
    models.Module(
        id="any-mod-anchor",
        code="CS310",
        title="Web Application Development",
        required_capacity=30,
        required_equipment="Projector",
    ),
    # Scenario C Friday cohort-load modules.
    models.Module(
        id="any-c-fri-mod-1",
        code="CS421",
        title="Advanced Software Engineering",
        required_capacity=30,
        required_equipment="Projector",
    ),
    models.Module(
        id="any-c-fri-mod-2",
        code="CS422",
        title="Data Visualisation",
        required_capacity=30,
        required_equipment="Projector",
    ),
    models.Module(
        id="any-c-fri-mod-3",
        code="CS423",
        title="Enterprise Computing",
        required_capacity=30,
        required_equipment="Projector",
    ),
    # Modules used only by background sessions.
    models.Module(id="bg-mod-01", code="CS101", title="Programming Fundamentals", required_capacity=30, required_equipment="Projector"),
    models.Module(id="bg-mod-02", code="CS102", title="Computer Systems", required_capacity=30, required_equipment="Projector"),
    models.Module(id="bg-mod-03", code="CS201", title="Object-Oriented Programming", required_capacity=30, required_equipment="Projector"),
    models.Module(id="bg-mod-04", code="CS202", title="Discrete Mathematics", required_capacity=30, required_equipment="Projector"),
    models.Module(id="bg-mod-05", code="CS203", title="Database Fundamentals", required_capacity=30, required_equipment="Projector"),
    models.Module(id="bg-mod-06", code="CS204", title="Software Testing", required_capacity=30, required_equipment="Projector"),
    models.Module(id="bg-mod-07", code="CS301", title="Computer Networks", required_capacity=30, required_equipment="Projector"),
    models.Module(id="bg-mod-08", code="CS302", title="Operating Systems", required_capacity=30, required_equipment="Projector"),
    models.Module(id="bg-mod-09", code="CS401", title="Machine Learning", required_capacity=30, required_equipment="Projector"),
    models.Module(id="bg-mod-10", code="CS402", title="Information Security", required_capacity=30, required_equipment="Projector"),

]

db.add_all(modules)


# ------------------------------------------------------------
# Constraint catalogue
# Same nine constraint IDs/types as the concrete explanation
# study seed.
# ------------------------------------------------------------

constraints = [
    models.Constraint(
        id="lecturer-one-class-at-time",
        name="Lecturer cannot teach more than 1 class at a time",
        description=(
            "A lecturer can never be scheduled to teach two sessions "
            "that overlap in time."
        ),
        stakeholder="Lecturer",
        type="unrelaxable",
    ),
    models.Constraint(
        id="lecturer-unavailability",
        name="Lecturer unavailability",
        description=(
            "Sessions are never scheduled during days and hours "
            "a lecturer has marked as unavailable."
        ),
        stakeholder="Lecturer",
        type="unrelaxable",
    ),
    models.Constraint(
        id="room-one-booking-at-time",
        name="A room can have maximum one booking at a time",
        description=(
            "A room can never host two sessions that overlap in time."
        ),
        stakeholder="Room",
        type="unrelaxable",
    ),
    models.Constraint(
        id="lecturer-lunch-break",
        name="Lecturer lunch break",
        description=(
            "Lecturers are given a protected one-hour lunch break "
            "between 12:00 and 14:00."
        ),
        stakeholder="Lecturer",
        type="relaxable",
    ),
    models.Constraint(
        id="lecturer-max-one-hour-per-day",
        name="Lecturer shall teach maximum 4 hour per day",
        description=(
            "Caps how many hours a lecturer can be scheduled to teach "
            "on a single day."
        ),
        stakeholder="Lecturer",
        type="relaxable",
    ),
    models.Constraint(
        id="cohort-one-class-at-time",
        name="Cohort cannot attend more than 1 class at a time",
        description=(
            "A cohort can never be scheduled to attend two sessions "
            "that overlap in time."
        ),
        stakeholder="Cohort",
        type="unrelaxable",
    ),
    models.Constraint(
        id="cohort-max-teaching-hours-per-day",
        name="Cohort's maximum teaching hours per day",
        description=(
            "Caps how many hours a cohort can be scheduled for classes "
            "on a single day."
        ),
        stakeholder="Cohort",
        type="relaxable",
    ),
    models.Constraint(
        id="class-equipment",
        name="Class equipment",
        description=(
            "A session is only scheduled in a room that has the "
            "equipment its module requires."
        ),
        stakeholder="Session",
        type="relaxable",
    ),
    models.Constraint(
        id="class-capacity",
        name="Class capacity",
        description=(
            "A session is only scheduled in a room with enough seats "
            "for the expected class size."
        ),
        stakeholder="Session",
        type="relaxable",
    ),
]

db.add_all(constraints)
db.commit()


# ------------------------------------------------------------
# Attach stakeholder-level constraints
# ------------------------------------------------------------

for lecturer in lecturers:
    attach_lecturer_constraints(db, lecturer.id)

for cohort in cohorts:
    attach_cohort_constraints(db, cohort.id)

for room in rooms:
    attach_room_constraints(db, room.id)

db.commit()


# ------------------------------------------------------------
# Scenario C setup
#
# Dr. Rachel Brennan is unavailable in every teaching hour from
# Monday to Thursday, except the target session's original
# Monday 14:00–16:00 position. She is fully available on Friday.
#
# Friday is deliberately left available for Rachel so that the
# explanation is not dominated by a single lecturer constraint.
# Instead, Friday alternatives will fail because CS Year 4 –
# Group A already has 3 teaching hours on Friday; adding the
# 2-hour CS411 session would take the cohort to 5 hours, above
# its 4-hour daily limit.
#
# This assumes FIND/ANY is a relocation operation and does not
# accept the unchanged original placement as the answer.
# ------------------------------------------------------------

for day in ["mon", "tue", "wed", "thu"]:
    for hour in range(9, 18):
        if (day, hour) in {
            ("mon", 14),
            ("mon", 15),
        }:
            continue

        db.add(
            models.LecturerUnavailability(
                lecturer_id="any-both-lect",
                day=day,
                hour=hour,
            )
        )

db.commit()


# ------------------------------------------------------------
# Sessions
# ------------------------------------------------------------

sessions = [

    # ========================================================
    # SCENARIO A — ROOM = ANY
    #
    # CS311 Human-Computer Interaction currently takes place
    # Monday 09:00–11:00.
    #
    # Study request:
    # Move CS311 to Tuesday 09:00, allowing the system to find
    # any suitable room.
    #
    # CS Year 3 – Group A already attends CS310 at that time,
    # so every candidate room fails because of the cohort clash.
    # ========================================================

    dict(
        id="any-session-room",
        module_id="any-mod-room",
        lecturer_id="any-room-lect",
        room_id="any-room-a",
        start="2026-09-21T09:00:00",
        end="2026-09-21T11:00:00",
        cohort="any-room-cohort",
    ),

    dict(
        id="any-room-anchor",
        module_id="any-mod-anchor",
        lecturer_id="any-anchor-lect",
        room_id="any-room-b",
        start="2026-09-22T09:00:00",
        end="2026-09-22T11:00:00",
        cohort="any-room-cohort",
    ),


    # ========================================================
    # SCENARIO B — TIME = ANY
    #
    # CS312 Cloud Computing currently takes place
    # Monday 11:00–13:00 in ENG 1.02.
    #
    # Study request:
    # Move CS312 to ENG 2.12, allowing the system to find any
    # suitable time.
    #
    # CS312 requires capacity for 50 students.
    # ENG 2.12 has capacity for only 20 students.
    # Therefore every candidate time fails.
    # ========================================================

    dict(
        id="any-session-time",
        module_id="any-mod-time",
        lecturer_id="any-time-lect",
        room_id="any-room-b",
        start="2026-09-21T11:00:00",
        end="2026-09-21T13:00:00",
        cohort="any-time-cohort",
    ),


    # ========================================================
    # SCENARIO C — ROOM = ANY + TIME = ANY
    #
    # CS411 Distributed Systems currently takes place
    # Monday 14:00–16:00 in ENG 1.03.
    #
    # Study request:
    # Reschedule CS411, allowing the system to find both a
    # suitable room and a suitable time.
    #
    # Monday–Thursday alternatives fail because Dr. Rachel Brennan
    # is unavailable. Rachel is fully available on Friday, but
    # CS Year 4 – Group A already has 3 teaching hours that day.
    # Adding this 2-hour session would exceed the cohort's 4-hour
    # daily teaching limit.
    # ========================================================

    dict(
        id="any-session-both",
        module_id="any-mod-both",
        lecturer_id="any-both-lect",
        room_id="any-room-c",
        start="2026-09-21T14:00:00",
        end="2026-09-21T16:00:00",
        cohort="any-both-cohort",
    ),

    # Scenario C: CS Year 4 – Group A already has 3 hours on Friday.
    # These are deliberately separated so that there are still
    # non-overlapping 2-hour windows for CS411. Those windows fail
    # because of the cohort daily-hours limit, not cohort overlap.
    dict(
        id="any-c-fri-session-1",
        module_id="any-c-fri-mod-1",
        lecturer_id="any-c-fri-lect-1",
        room_id="any-room-a",
        start="2026-09-25T09:00:00",
        end="2026-09-25T10:00:00",
        cohort="any-both-cohort",
    ),
    dict(
        id="any-c-fri-session-2",
        module_id="any-c-fri-mod-2",
        lecturer_id="any-c-fri-lect-2",
        room_id="any-room-b",
        start="2026-09-25T12:00:00",
        end="2026-09-25T13:00:00",
        cohort="any-both-cohort",
    ),
    dict(
        id="any-c-fri-session-3",
        module_id="any-c-fri-mod-3",
        lecturer_id="any-c-fri-lect-3",
        room_id="any-room-c",
        start="2026-09-25T16:00:00",
        end="2026-09-25T17:00:00",
        cohort="any-both-cohort",
    ),
]


# ------------------------------------------------------------
# Background timetable: 10 cohorts × 6 classes = 60 sessions.
# Uses only separate bg-* rooms and lecturers.
# ------------------------------------------------------------
background_sessions = [
    dict(id="bg-session-01-01", module_id="bg-mod-01", lecturer_id="bg-lect-01", room_id="bg-room-01", start="2026-09-21T09:00:00", end="2026-09-21T10:00:00", cohort="bg-cohort-01"),
    dict(id="bg-session-01-02", module_id="bg-mod-01", lecturer_id="bg-lect-01", room_id="bg-room-01", start="2026-09-21T11:00:00", end="2026-09-21T12:00:00", cohort="bg-cohort-01"),
    dict(id="bg-session-01-03", module_id="bg-mod-01", lecturer_id="bg-lect-01", room_id="bg-room-01", start="2026-09-22T13:00:00", end="2026-09-22T14:00:00", cohort="bg-cohort-01"),
    dict(id="bg-session-01-04", module_id="bg-mod-01", lecturer_id="bg-lect-01", room_id="bg-room-01", start="2026-09-23T10:00:00", end="2026-09-23T11:00:00", cohort="bg-cohort-01"),
    dict(id="bg-session-01-05", module_id="bg-mod-01", lecturer_id="bg-lect-01", room_id="bg-room-01", start="2026-09-24T15:00:00", end="2026-09-24T16:00:00", cohort="bg-cohort-01"),
    dict(id="bg-session-01-06", module_id="bg-mod-01", lecturer_id="bg-lect-01", room_id="bg-room-01", start="2026-09-25T09:00:00", end="2026-09-25T10:00:00", cohort="bg-cohort-01"),
    dict(id="bg-session-02-01", module_id="bg-mod-02", lecturer_id="bg-lect-02", room_id="bg-room-02", start="2026-09-21T09:00:00", end="2026-09-21T10:00:00", cohort="bg-cohort-02"),
    dict(id="bg-session-02-02", module_id="bg-mod-02", lecturer_id="bg-lect-02", room_id="bg-room-02", start="2026-09-21T11:00:00", end="2026-09-21T12:00:00", cohort="bg-cohort-02"),
    dict(id="bg-session-02-03", module_id="bg-mod-02", lecturer_id="bg-lect-02", room_id="bg-room-02", start="2026-09-22T13:00:00", end="2026-09-22T14:00:00", cohort="bg-cohort-02"),
    dict(id="bg-session-02-04", module_id="bg-mod-02", lecturer_id="bg-lect-02", room_id="bg-room-02", start="2026-09-23T10:00:00", end="2026-09-23T11:00:00", cohort="bg-cohort-02"),
    dict(id="bg-session-02-05", module_id="bg-mod-02", lecturer_id="bg-lect-02", room_id="bg-room-02", start="2026-09-24T15:00:00", end="2026-09-24T16:00:00", cohort="bg-cohort-02"),
    dict(id="bg-session-02-06", module_id="bg-mod-02", lecturer_id="bg-lect-02", room_id="bg-room-02", start="2026-09-25T09:00:00", end="2026-09-25T10:00:00", cohort="bg-cohort-02"),
    dict(id="bg-session-03-01", module_id="bg-mod-03", lecturer_id="bg-lect-03", room_id="bg-room-03", start="2026-09-21T09:00:00", end="2026-09-21T10:00:00", cohort="bg-cohort-03"),
    dict(id="bg-session-03-02", module_id="bg-mod-03", lecturer_id="bg-lect-03", room_id="bg-room-03", start="2026-09-21T11:00:00", end="2026-09-21T12:00:00", cohort="bg-cohort-03"),
    dict(id="bg-session-03-03", module_id="bg-mod-03", lecturer_id="bg-lect-03", room_id="bg-room-03", start="2026-09-22T13:00:00", end="2026-09-22T14:00:00", cohort="bg-cohort-03"),
    dict(id="bg-session-03-04", module_id="bg-mod-03", lecturer_id="bg-lect-03", room_id="bg-room-03", start="2026-09-23T10:00:00", end="2026-09-23T11:00:00", cohort="bg-cohort-03"),
    dict(id="bg-session-03-05", module_id="bg-mod-03", lecturer_id="bg-lect-03", room_id="bg-room-03", start="2026-09-24T15:00:00", end="2026-09-24T16:00:00", cohort="bg-cohort-03"),
    dict(id="bg-session-03-06", module_id="bg-mod-03", lecturer_id="bg-lect-03", room_id="bg-room-03", start="2026-09-25T09:00:00", end="2026-09-25T10:00:00", cohort="bg-cohort-03"),
    dict(id="bg-session-04-01", module_id="bg-mod-04", lecturer_id="bg-lect-04", room_id="bg-room-04", start="2026-09-21T09:00:00", end="2026-09-21T10:00:00", cohort="bg-cohort-04"),
    dict(id="bg-session-04-02", module_id="bg-mod-04", lecturer_id="bg-lect-04", room_id="bg-room-04", start="2026-09-21T11:00:00", end="2026-09-21T12:00:00", cohort="bg-cohort-04"),
    dict(id="bg-session-04-03", module_id="bg-mod-04", lecturer_id="bg-lect-04", room_id="bg-room-04", start="2026-09-22T13:00:00", end="2026-09-22T14:00:00", cohort="bg-cohort-04"),
    dict(id="bg-session-04-04", module_id="bg-mod-04", lecturer_id="bg-lect-04", room_id="bg-room-04", start="2026-09-23T10:00:00", end="2026-09-23T11:00:00", cohort="bg-cohort-04"),
    dict(id="bg-session-04-05", module_id="bg-mod-04", lecturer_id="bg-lect-04", room_id="bg-room-04", start="2026-09-24T15:00:00", end="2026-09-24T16:00:00", cohort="bg-cohort-04"),
    dict(id="bg-session-04-06", module_id="bg-mod-04", lecturer_id="bg-lect-04", room_id="bg-room-04", start="2026-09-25T09:00:00", end="2026-09-25T10:00:00", cohort="bg-cohort-04"),
    dict(id="bg-session-05-01", module_id="bg-mod-05", lecturer_id="bg-lect-05", room_id="bg-room-05", start="2026-09-21T09:00:00", end="2026-09-21T10:00:00", cohort="bg-cohort-05"),
    dict(id="bg-session-05-02", module_id="bg-mod-05", lecturer_id="bg-lect-05", room_id="bg-room-05", start="2026-09-21T11:00:00", end="2026-09-21T12:00:00", cohort="bg-cohort-05"),
    dict(id="bg-session-05-03", module_id="bg-mod-05", lecturer_id="bg-lect-05", room_id="bg-room-05", start="2026-09-22T13:00:00", end="2026-09-22T14:00:00", cohort="bg-cohort-05"),
    dict(id="bg-session-05-04", module_id="bg-mod-05", lecturer_id="bg-lect-05", room_id="bg-room-05", start="2026-09-23T10:00:00", end="2026-09-23T11:00:00", cohort="bg-cohort-05"),
    dict(id="bg-session-05-05", module_id="bg-mod-05", lecturer_id="bg-lect-05", room_id="bg-room-05", start="2026-09-24T15:00:00", end="2026-09-24T16:00:00", cohort="bg-cohort-05"),
    dict(id="bg-session-05-06", module_id="bg-mod-05", lecturer_id="bg-lect-05", room_id="bg-room-05", start="2026-09-25T09:00:00", end="2026-09-25T10:00:00", cohort="bg-cohort-05"),
    dict(id="bg-session-06-01", module_id="bg-mod-06", lecturer_id="bg-lect-06", room_id="bg-room-06", start="2026-09-21T09:00:00", end="2026-09-21T10:00:00", cohort="bg-cohort-06"),
    dict(id="bg-session-06-02", module_id="bg-mod-06", lecturer_id="bg-lect-06", room_id="bg-room-06", start="2026-09-21T11:00:00", end="2026-09-21T12:00:00", cohort="bg-cohort-06"),
    dict(id="bg-session-06-03", module_id="bg-mod-06", lecturer_id="bg-lect-06", room_id="bg-room-06", start="2026-09-22T13:00:00", end="2026-09-22T14:00:00", cohort="bg-cohort-06"),
    dict(id="bg-session-06-04", module_id="bg-mod-06", lecturer_id="bg-lect-06", room_id="bg-room-06", start="2026-09-23T10:00:00", end="2026-09-23T11:00:00", cohort="bg-cohort-06"),
    dict(id="bg-session-06-05", module_id="bg-mod-06", lecturer_id="bg-lect-06", room_id="bg-room-06", start="2026-09-24T15:00:00", end="2026-09-24T16:00:00", cohort="bg-cohort-06"),
    dict(id="bg-session-06-06", module_id="bg-mod-06", lecturer_id="bg-lect-06", room_id="bg-room-06", start="2026-09-25T09:00:00", end="2026-09-25T10:00:00", cohort="bg-cohort-06"),
    dict(id="bg-session-07-01", module_id="bg-mod-07", lecturer_id="bg-lect-07", room_id="bg-room-07", start="2026-09-21T09:00:00", end="2026-09-21T10:00:00", cohort="bg-cohort-07"),
    dict(id="bg-session-07-02", module_id="bg-mod-07", lecturer_id="bg-lect-07", room_id="bg-room-07", start="2026-09-21T11:00:00", end="2026-09-21T12:00:00", cohort="bg-cohort-07"),
    dict(id="bg-session-07-03", module_id="bg-mod-07", lecturer_id="bg-lect-07", room_id="bg-room-07", start="2026-09-22T13:00:00", end="2026-09-22T14:00:00", cohort="bg-cohort-07"),
    dict(id="bg-session-07-04", module_id="bg-mod-07", lecturer_id="bg-lect-07", room_id="bg-room-07", start="2026-09-23T10:00:00", end="2026-09-23T11:00:00", cohort="bg-cohort-07"),
    dict(id="bg-session-07-05", module_id="bg-mod-07", lecturer_id="bg-lect-07", room_id="bg-room-07", start="2026-09-24T15:00:00", end="2026-09-24T16:00:00", cohort="bg-cohort-07"),
    dict(id="bg-session-07-06", module_id="bg-mod-07", lecturer_id="bg-lect-07", room_id="bg-room-07", start="2026-09-25T09:00:00", end="2026-09-25T10:00:00", cohort="bg-cohort-07"),
    dict(id="bg-session-08-01", module_id="bg-mod-08", lecturer_id="bg-lect-08", room_id="bg-room-08", start="2026-09-21T09:00:00", end="2026-09-21T10:00:00", cohort="bg-cohort-08"),
    dict(id="bg-session-08-02", module_id="bg-mod-08", lecturer_id="bg-lect-08", room_id="bg-room-08", start="2026-09-21T11:00:00", end="2026-09-21T12:00:00", cohort="bg-cohort-08"),
    dict(id="bg-session-08-03", module_id="bg-mod-08", lecturer_id="bg-lect-08", room_id="bg-room-08", start="2026-09-22T13:00:00", end="2026-09-22T14:00:00", cohort="bg-cohort-08"),
    dict(id="bg-session-08-04", module_id="bg-mod-08", lecturer_id="bg-lect-08", room_id="bg-room-08", start="2026-09-23T10:00:00", end="2026-09-23T11:00:00", cohort="bg-cohort-08"),
    dict(id="bg-session-08-05", module_id="bg-mod-08", lecturer_id="bg-lect-08", room_id="bg-room-08", start="2026-09-24T15:00:00", end="2026-09-24T16:00:00", cohort="bg-cohort-08"),
    dict(id="bg-session-08-06", module_id="bg-mod-08", lecturer_id="bg-lect-08", room_id="bg-room-08", start="2026-09-25T09:00:00", end="2026-09-25T10:00:00", cohort="bg-cohort-08"),
    dict(id="bg-session-09-01", module_id="bg-mod-09", lecturer_id="bg-lect-09", room_id="bg-room-09", start="2026-09-21T09:00:00", end="2026-09-21T10:00:00", cohort="bg-cohort-09"),
    dict(id="bg-session-09-02", module_id="bg-mod-09", lecturer_id="bg-lect-09", room_id="bg-room-09", start="2026-09-21T11:00:00", end="2026-09-21T12:00:00", cohort="bg-cohort-09"),
    dict(id="bg-session-09-03", module_id="bg-mod-09", lecturer_id="bg-lect-09", room_id="bg-room-09", start="2026-09-22T13:00:00", end="2026-09-22T14:00:00", cohort="bg-cohort-09"),
    dict(id="bg-session-09-04", module_id="bg-mod-09", lecturer_id="bg-lect-09", room_id="bg-room-09", start="2026-09-23T10:00:00", end="2026-09-23T11:00:00", cohort="bg-cohort-09"),
    dict(id="bg-session-09-05", module_id="bg-mod-09", lecturer_id="bg-lect-09", room_id="bg-room-09", start="2026-09-24T15:00:00", end="2026-09-24T16:00:00", cohort="bg-cohort-09"),
    dict(id="bg-session-09-06", module_id="bg-mod-09", lecturer_id="bg-lect-09", room_id="bg-room-09", start="2026-09-25T09:00:00", end="2026-09-25T10:00:00", cohort="bg-cohort-09"),
    dict(id="bg-session-10-01", module_id="bg-mod-10", lecturer_id="bg-lect-10", room_id="bg-room-10", start="2026-09-21T09:00:00", end="2026-09-21T10:00:00", cohort="bg-cohort-10"),
    dict(id="bg-session-10-02", module_id="bg-mod-10", lecturer_id="bg-lect-10", room_id="bg-room-10", start="2026-09-21T11:00:00", end="2026-09-21T12:00:00", cohort="bg-cohort-10"),
    dict(id="bg-session-10-03", module_id="bg-mod-10", lecturer_id="bg-lect-10", room_id="bg-room-10", start="2026-09-22T13:00:00", end="2026-09-22T14:00:00", cohort="bg-cohort-10"),
    dict(id="bg-session-10-04", module_id="bg-mod-10", lecturer_id="bg-lect-10", room_id="bg-room-10", start="2026-09-23T10:00:00", end="2026-09-23T11:00:00", cohort="bg-cohort-10"),
    dict(id="bg-session-10-05", module_id="bg-mod-10", lecturer_id="bg-lect-10", room_id="bg-room-10", start="2026-09-24T15:00:00", end="2026-09-24T16:00:00", cohort="bg-cohort-10"),
    dict(id="bg-session-10-06", module_id="bg-mod-10", lecturer_id="bg-lect-10", room_id="bg-room-10", start="2026-09-25T09:00:00", end="2026-09-25T10:00:00", cohort="bg-cohort-10"),
]

sessions.extend(background_sessions)


# ------------------------------------------------------------
# Create sessions and attach session-level constraints
# ------------------------------------------------------------

for s in sessions:
    session = models.Session(
        id=s["id"],
        module_id=s["module_id"],
        lecturer_id=s["lecturer_id"],
        room_id=s["room_id"],
        type="lecture",
        start=datetime.fromisoformat(s["start"]),
        end=datetime.fromisoformat(s["end"]),
    )

    session.programs = (
        db.query(models.Program)
        .filter(models.Program.id == "any-study-cs")
        .all()
    )

    session.cohorts = (
        db.query(models.Cohort)
        .filter(models.Cohort.id == s["cohort"])
        .all()
    )

    db.add(session)
    db.flush()

    attach_session_constraints(db, session.id)


db.commit()
db.close()


# ------------------------------------------------------------
# Developer reference
# ------------------------------------------------------------

print("ANY / FIND explainability study seed complete.")
print("Background timetable: 10 additional cohorts × 6 classes = 60 sessions.")
print(
    "1) CS311 Human-Computer Interaction: "
    "Time=Tue 09:00, Room=ANY, Lecturer=KEEP"
)
print(
    "2) CS312 Cloud Computing: "
    "Time=ANY, Room=ENG 2.12, Lecturer=KEEP"
)
print(
    "3) CS411 Distributed Systems: "
    "Time=ANY, Room=ANY, Lecturer=KEEP"
)
