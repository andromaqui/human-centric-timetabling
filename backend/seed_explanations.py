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
# CONCRETE EXPLAINABILITY STUDY SEED
#
# Purpose:
# Deterministic examples for all 9 encoded constraint families.
#
# This file intentionally contains NO recovery, ANY/FIND,
# mixed-recovery, candidate-solution, or historical-impact
# study data.
#
# Run against an empty/reset study database.
# ============================================================

models.Base.metadata.create_all(bind=engine)
db = SessionLocal()


# ------------------------------------------------------------
# Program
# ------------------------------------------------------------

programs = [
    models.Program(
        id="exp-cs",
        code="CS",
        name="Computer Science",
    ),
]

db.add_all(programs)


# ------------------------------------------------------------
# Cohorts
#
# Separate cohorts are used internally to keep the individual
# study scenarios isolated from one another.
# ------------------------------------------------------------

cohorts = [
    models.Cohort(
        id="exp-cohort-room",
        name="CS Year 4 – Group A",
        program_id="exp-cs",
    ),
    models.Cohort(
        id="exp-cohort-lect",
        name="CS Year 4 – Group B",
        program_id="exp-cs",
    ),
    models.Cohort(
        id="exp-cohort-overlap",
        name="CS Year 3 – Group A",
        program_id="exp-cs",
    ),
    models.Cohort(
        id="exp-cohort-unavail",
        name="CS Year 3 – Group B",
        program_id="exp-cs",
    ),
    models.Cohort(
        id="exp-cohort-cap",
        name="CS Year 2 – Group A",
        program_id="exp-cs",
    ),
    models.Cohort(
        id="exp-cohort-equip",
        name="CS Year 2 – Group B",
        program_id="exp-cs",
    ),
    models.Cohort(
        id="exp-cohort-hours",
        name="CS Year 3 – Group C",
        program_id="exp-cs",
    ),
    models.Cohort(
        id="exp-cohort-lect-hours",
        name="CS Year 4 – Group C",
        program_id="exp-cs",
    ),
    models.Cohort(
        id="exp-cohort-lunch",
        name="CS Year 2 – Group C",
        program_id="exp-cs",
    ),
    models.Cohort(
        id="exp-cohort-multi",
        name="CS Year 4 – Group D",
        program_id="exp-cs",
    ),

    models.Cohort(id="exp-cohort-k", name="CS Year 4 – Group E", program_id="exp-cs"),
    models.Cohort(id="exp-cohort-l", name="CS Year 3 – Group D", program_id="exp-cs"),
    models.Cohort(id="exp-cohort-m", name="CS Year 4 – Group F", program_id="exp-cs"),

    # Separate cohorts for supporting sessions that must not
    # introduce unintended cohort clashes.
    models.Cohort(
        id="exp-anchor-cohort-room",
        name="CS Year 1 – Group A",
        program_id="exp-cs",
    ),
    models.Cohort(
        id="exp-anchor-cohort-lect",
        name="CS Year 1 – Group B",
        program_id="exp-cs",
    ),
    models.Cohort(
        id="exp-anchor-cohort-lhours",
        name="CS Year 1 – Group C",
        program_id="exp-cs",
    ),
]

db.add_all(cohorts)


# ------------------------------------------------------------
# Lecturers
# ------------------------------------------------------------

lecturers = [
    models.Lecturer(id="exp-lect-1", name="Dr. Nora Blake"),
    models.Lecturer(id="exp-lect-2", name="Dr. Owen Kelly"),
    models.Lecturer(id="exp-lect-3", name="Dr. Priya Shah"),
    models.Lecturer(id="exp-lect-4", name="Dr. Liam Foster"),
    models.Lecturer(id="exp-lect-5", name="Dr. Ava Byrne"),
    models.Lecturer(id="exp-lect-6", name="Dr. Noah Clarke"),
    models.Lecturer(id="exp-lect-7", name="Dr. Ella Martin"),
    models.Lecturer(id="exp-lect-8", name="Dr. Jack Nolan"),
    models.Lecturer(id="exp-lect-9", name="Dr. Sophie Reid"),
    models.Lecturer(id="exp-lect-10", name="Dr. Maya Chen"),
    models.Lecturer(id="exp-lect-11", name="Dr. Daniel Walsh"),
    models.Lecturer(id="exp-lect-12", name="Dr. Rachel Murphy"),
    models.Lecturer(id="exp-lect-13", name="Dr. Thomas Greene"),
    models.Lecturer(id="exp-lect-anchor-m", name="Dr. Sarah Doyle"),

    # Lecturers used by supporting timetable sessions.
    models.Lecturer(id="exp-lect-anchor-room", name="Dr. Ben Carter"),
    models.Lecturer(id="exp-lect-anchor-cohort", name="Dr. Grace Flynn"),
]

db.add_all(lecturers)


# ------------------------------------------------------------
# Lecturer availability
#
# Dr. Liam Foster is unavailable Tuesday 14:00–16:00.
# ------------------------------------------------------------

unavailability = [
    # Scenario L: Dr. Rachel Murphy is unavailable Thursday 14:00–16:00.
    models.LecturerUnavailability(lecturer_id="exp-lect-12", day="thu", hour=14),
    models.LecturerUnavailability(lecturer_id="exp-lect-12", day="thu", hour=15),
    models.LecturerUnavailability(
        lecturer_id="exp-lect-4",
        day="tue",
        hour=14,
    ),
    models.LecturerUnavailability(
        lecturer_id="exp-lect-4",
        day="tue",
        hour=15,
    ),
]

db.add_all(unavailability)


# ------------------------------------------------------------
# Rooms
#
# Unique home rooms keep the baseline timetable clash-free.
# ------------------------------------------------------------

rooms = [
    models.Room(
        id="exp-room-a",
        name="ENG 1.01",
        capacity=60,
        equipment="Projector,Whiteboard",
    ),
    models.Room(
        id="exp-room-b",
        name="ENG 1.02",
        capacity=60,
        equipment="Projector,Whiteboard",
    ),
    models.Room(
        id="exp-room-c",
        name="ENG 1.03",
        capacity=60,
        equipment="Projector,Whiteboard",
    ),
    models.Room(
        id="exp-room-d",
        name="ENG 1.04",
        capacity=60,
        equipment="Projector,Whiteboard",
    ),
    models.Room(
        id="exp-room-e",
        name="ENG 1.05",
        capacity=60,
        equipment="Projector,Whiteboard",
    ),
    models.Room(
        id="exp-room-f",
        name="ENG 1.06",
        capacity=60,
        equipment="Projector,Whiteboard",
    ),
    models.Room(
        id="exp-room-g",
        name="ENG 1.07",
        capacity=60,
        equipment="Projector,Whiteboard",
    ),
    models.Room(
        id="exp-room-h",
        name="ENG 1.08",
        capacity=60,
        equipment="Projector,Whiteboard",
    ),
    models.Room(
        id="exp-room-i",
        name="ENG 1.09",
        capacity=60,
        equipment="Projector,Whiteboard",
    ),
    models.Room(
        id="exp-room-small",
        name="ENG 2.12",
        capacity=20,
        equipment="Projector",
    ),
    models.Room(
        id="exp-room-standard",
        name="ENG 2.14",
        capacity=60,
        equipment="Projector,Whiteboard",
    ),
    models.Room(
        id="exp-room-lab",
        name="Computing Lab 1",
        capacity=60,
        equipment="Projector,Linux lab",
    ),
    models.Room(
        id="exp-room-multi",
        name="ENG 2.16",
        capacity=20,
        equipment="Projector,Whiteboard",
    ),
    models.Room(id="exp-room-k", name="ENG 1.10", capacity=60, equipment="Projector,Whiteboard"),
    models.Room(id="exp-room-l", name="ENG 1.11", capacity=60, equipment="Projector,Whiteboard"),
    models.Room(id="exp-room-m", name="ENG 1.12", capacity=60, equipment="Projector,Whiteboard"),
    models.Room(id="exp-room-anchor", name="ENG 1.13", capacity=60, equipment="Projector,Whiteboard"),
]

db.add_all(rooms)


# ------------------------------------------------------------
# Modules
# ------------------------------------------------------------

modules = [
    # Target study modules.
    models.Module(
        id="exp-mod-room",
        code="CS401",
        title="Research Methods in Computing",
        required_capacity=30,
        required_equipment="Projector",
    ),
    models.Module(
        id="exp-mod-lect",
        code="CS402",
        title="Data Ethics and Governance",
        required_capacity=30,
        required_equipment="Projector",
    ),
    models.Module(
        id="exp-mod-cohort",
        code="CS403",
        title="Applied Data Analytics",
        required_capacity=30,
        required_equipment="Projector",
    ),
    models.Module(
        id="exp-mod-unavail",
        code="CS404",
        title="Computer Security",
        required_capacity=30,
        required_equipment="Projector",
    ),
    models.Module(
        id="exp-mod-cap",
        code="CS405",
        title="Software Architecture",
        required_capacity=50,
        required_equipment="Projector",
    ),
    models.Module(
        id="exp-mod-equip",
        code="CS406",
        title="Systems Programming",
        required_capacity=30,
        required_equipment="Projector,Whiteboard,Linux lab,Dual monitors",
    ),
    models.Module(
        id="exp-mod-chours",
        code="CS407",
        title="Software Engineering Project",
        required_capacity=30,
        required_equipment="Projector",
    ),
    models.Module(
        id="exp-mod-lhours",
        code="CS408",
        title="Advanced Database Systems",
        required_capacity=30,
        required_equipment="Projector",
    ),
    models.Module(
        id="exp-mod-lunch",
        code="CS409",
        title="Professional Practice in Computing",
        required_capacity=30,
        required_equipment="Projector",
    ),
    models.Module(
        id="exp-mod-multi",
        code="CS410",
        title="Machine Learning Applications",
        required_capacity=50,
        required_equipment="Projector,GPU workstations",
    ),

    models.Module(id="exp-mod-k", code="CS411", title="Cloud Computing", required_capacity=30, required_equipment="Projector"),
    models.Module(id="exp-mod-l", code="CS412", title="Human-Computer Interaction", required_capacity=30, required_equipment="Projector"),
    models.Module(id="exp-mod-m", code="CS413", title="Distributed Systems", required_capacity=30, required_equipment="Projector"),

    # Ordinary timetable modules used to create the surrounding
    # scheduling conditions required by the study scenarios.
    models.Module(
        id="exp-mod-anchor-room",
        code="CS310",
        title="Web Application Development",
        required_capacity=30,
        required_equipment="Projector",
    ),
    models.Module(
        id="exp-mod-anchor-lect",
        code="CS320",
        title="Algorithms and Data Structures",
        required_capacity=30,
        required_equipment="Projector",
    ),
    models.Module(
        id="exp-mod-anchor-cohort",
        code="CS330",
        title="Operating Systems",
        required_capacity=30,
        required_equipment="Projector",
    ),
    models.Module(
        id="exp-mod-anchor-hours",
        code="CS340",
        title="Computer Networks",
        required_capacity=30,
        required_equipment="Projector",
    ),
]

db.add_all(modules)


# ------------------------------------------------------------
# Constraint catalogue
#
# Exactly the 9 constraint families under evaluation.
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
# Attach stakeholder-level constraints using the application's
# existing attachment logic.
# ------------------------------------------------------------

for lecturer in lecturers:
    attach_lecturer_constraints(db, lecturer.id)

for cohort in cohorts:
    attach_cohort_constraints(db, cohort.id)

for room in rooms:
    attach_room_constraints(db, room.id)

db.commit()


# ------------------------------------------------------------
# Sessions
#
# All target sessions begin in valid, mutually non-conflicting
# positions.
#
# Each study request intentionally makes one constraint family
# salient.
# ------------------------------------------------------------

sessions_data = [

    # ========================================================
    # A — ROOM OVERLAP
    #
    # Study request:
    # Move CS401 Research Methods in Computing from
    # Friday 14:00–16:00 to Tuesday 09:00–11:00,
    # keeping ENG 1.01.
    #
    # ENG 1.01 is already occupied by CS310 Web Application
    # Development at that time.
    # ========================================================

    dict(
        id="exp-session-room",
        module_id="exp-mod-room",
        lecturer_id="exp-lect-1",
        room_id="exp-room-a",
        type="lecture",
        start="2026-09-25T14:00:00",
        end="2026-09-25T16:00:00",
        cohort_ids=["exp-cohort-room"],
    ),

    dict(
        id="exp-anchor-room",
        module_id="exp-mod-anchor-room",
        lecturer_id="exp-lect-anchor-room",
        room_id="exp-room-a",
        type="lecture",
        start="2026-09-22T09:00:00",
        end="2026-09-22T11:00:00",
        cohort_ids=["exp-anchor-cohort-room"],
    ),


    # ========================================================
    # B — LECTURER OVERLAP
    #
    # Study request:
    # Move CS402 Data Ethics and Governance from
    # Friday 14:00–16:00 to Wednesday 09:00–11:00,
    # keeping Dr. Owen Kelly.
    #
    # Dr. Owen Kelly already teaches CS320 Algorithms and
    # Data Structures at that time.
    # ========================================================

    dict(
        id="exp-session-lect",
        module_id="exp-mod-lect",
        lecturer_id="exp-lect-2",
        room_id="exp-room-b",
        type="lecture",
        start="2026-09-25T14:00:00",
        end="2026-09-25T16:00:00",
        cohort_ids=["exp-cohort-lect"],
    ),

    dict(
        id="exp-anchor-lect",
        module_id="exp-mod-anchor-lect",
        lecturer_id="exp-lect-2",
        room_id="exp-room-c",
        type="lecture",
        start="2026-09-23T09:00:00",
        end="2026-09-23T11:00:00",
        cohort_ids=["exp-anchor-cohort-lect"],
    ),


    # ========================================================
    # C — COHORT OVERLAP
    #
    # Study request:
    # Move CS403 Applied Data Analytics from
    # Friday 14:00–16:00 to Thursday 09:00–11:00.
    #
    # CS Year 3 – Group A already attends CS330 Operating
    # Systems at that time.
    # ========================================================

    dict(
        id="exp-session-cohort",
        module_id="exp-mod-cohort",
        lecturer_id="exp-lect-3",
        room_id="exp-room-c",
        type="lecture",
        start="2026-09-25T14:00:00",
        end="2026-09-25T16:00:00",
        cohort_ids=["exp-cohort-overlap"],
    ),

    dict(
        id="exp-anchor-cohort",
        module_id="exp-mod-anchor-cohort",
        lecturer_id="exp-lect-anchor-cohort",
        room_id="exp-room-d",
        type="lecture",
        start="2026-09-24T09:00:00",
        end="2026-09-24T11:00:00",
        cohort_ids=["exp-cohort-overlap"],
    ),


    # ========================================================
    # D — LECTURER UNAVAILABLE
    #
    # Study request:
    # Move CS404 Computer Security from Friday 14:00–16:00
    # to Tuesday 14:00–16:00.
    #
    # Dr. Liam Foster is unavailable during the requested time.
    # ========================================================

    dict(
        id="exp-session-unavail",
        module_id="exp-mod-unavail",
        lecturer_id="exp-lect-4",
        room_id="exp-room-d",
        type="lecture",
        start="2026-09-25T14:00:00",
        end="2026-09-25T16:00:00",
        cohort_ids=["exp-cohort-unavail"],
    ),


    # ========================================================
    # E — ROOM CAPACITY
    #
    # Study request:
    # Move CS405 Software Architecture to ENG 2.12,
    # keeping its existing Friday 09:00–11:00 time.
    #
    # CS405 requires capacity for 50 students.
    # ENG 2.12 has capacity for 20.
    # ========================================================

    dict(
        id="exp-session-cap",
        module_id="exp-mod-cap",
        lecturer_id="exp-lect-5",
        room_id="exp-room-e",
        type="lecture",
        start="2026-09-25T09:00:00",
        end="2026-09-25T11:00:00",
        cohort_ids=["exp-cohort-cap"],
    ),


    # ========================================================
    # F — ROOM EQUIPMENT
    #
    # Study request:
    # Move CS406 Systems Programming to ENG 2.14,
    # keeping its existing Friday 11:00–13:00 time.
    #
    # CS406 requires a Linux lab.
    # ENG 2.14 does not provide one.
    # ========================================================

    dict(
        id="exp-session-equip",
        module_id="exp-mod-equip",
        lecturer_id="exp-lect-6",
        room_id="exp-room-lab",
        type="lab",
        start="2026-09-25T11:00:00",
        end="2026-09-25T13:00:00",
        cohort_ids=["exp-cohort-equip"],
    ),


    # ========================================================
    # G — COHORT DAILY HOURS
    #
    # Study request:
    # Move CS407 Software Engineering Project from
    # Friday 14:00–16:00 to Monday 14:00–16:00.
    #
    # CS Year 3 – Group C already has four scheduled hours
    # on Monday, so the requested move would increase the
    # cohort's total to six hours.
    # ========================================================

    dict(
        id="exp-session-chours",
        module_id="exp-mod-chours",
        lecturer_id="exp-lect-7",
        room_id="exp-room-g",
        type="lecture",
        start="2026-09-25T14:00:00",
        end="2026-09-25T16:00:00",
        cohort_ids=["exp-cohort-hours"],
    ),

    dict(
        id="exp-anchor-chours",
        module_id="exp-mod-anchor-hours",
        lecturer_id="exp-lect-anchor-cohort",
        room_id="exp-room-h",
        type="lecture",
        start="2026-09-21T09:00:00",
        end="2026-09-21T13:00:00",
        cohort_ids=["exp-cohort-hours"],
    ),


    # ========================================================
    # H — LECTURER DAILY HOURS
    #
    # Study request:
    # Move CS408 Advanced Database Systems from
    # Friday 14:00–16:00 to Tuesday 14:00–16:00.
    #
    # Dr. Jack Nolan already teaches for four hours on Tuesday,
    # so the requested move would increase his total to six.
    # ========================================================

    dict(
        id="exp-session-lhours",
        module_id="exp-mod-lhours",
        lecturer_id="exp-lect-8",
        room_id="exp-room-h",
        type="lecture",
        start="2026-09-25T14:00:00",
        end="2026-09-25T16:00:00",
        cohort_ids=["exp-cohort-lect-hours"],
    ),

    dict(
        id="exp-anchor-lhours",
        module_id="exp-mod-anchor-hours",
        lecturer_id="exp-lect-8",
        room_id="exp-room-i",
        type="lecture",
        start="2026-09-22T09:00:00",
        end="2026-09-22T13:00:00",
        cohort_ids=["exp-anchor-cohort-lhours"],
    ),


    # ========================================================
    # I — LECTURER LUNCH BREAK
    #
    # Study request:
    # Move CS409 Professional Practice in Computing from
    # Friday 14:00–16:00 to Wednesday 12:00–14:00.
    #
    # This occupies the protected lunch window.
    # ========================================================

    dict(
        id="exp-session-lunch",
        module_id="exp-mod-lunch",
        lecturer_id="exp-lect-9",
        room_id="exp-room-i",
        type="lecture",
        start="2026-09-25T14:00:00",
        end="2026-09-25T16:00:00",
        cohort_ids=["exp-cohort-lunch"],
    ),

    # ========================================================
    # J — ROOM CAPACITY + EQUIPMENT
    # Move CS410 Machine Learning Applications to ENG 2.16,
    # keeping its existing Friday 09:00–11:00 time.
    # ========================================================
    dict(id="exp-session-multi", module_id="exp-mod-multi", lecturer_id="exp-lect-10", room_id="exp-room-lab", type="lab", start="2026-09-25T09:00:00", end="2026-09-25T11:00:00", cohort_ids=["exp-cohort-multi"]),

    # ========================================================
    # K — LECTURER OVERLAP + COHORT OVERLAP
    # Move CS411 Cloud Computing from Friday 14:00–16:00 to Monday 09:00–11:00.
    # ========================================================
    dict(id="exp-session-k", module_id="exp-mod-k", lecturer_id="exp-lect-11", room_id="exp-room-k", type="lecture", start="2026-09-25T14:00:00", end="2026-09-25T16:00:00", cohort_ids=["exp-cohort-k"]),
    dict(id="exp-anchor-k-lect", module_id="exp-mod-anchor-lect", lecturer_id="exp-lect-11", room_id="exp-room-anchor", type="lecture", start="2026-09-21T09:00:00", end="2026-09-21T11:00:00", cohort_ids=["exp-anchor-cohort-lect"]),
    dict(id="exp-anchor-k-cohort", module_id="exp-mod-anchor-cohort", lecturer_id="exp-lect-anchor-cohort", room_id="exp-room-d", type="lecture", start="2026-09-21T09:00:00", end="2026-09-21T11:00:00", cohort_ids=["exp-cohort-k"]),

    # ========================================================
    # L — ROOM OVERLAP + LECTURER UNAVAILABLE + COHORT OVERLAP
    # Move CS412 Human-Computer Interaction from Friday 14:00–16:00
    # to Thursday 14:00–16:00, keeping ENG 1.11.
    # ========================================================
    dict(id="exp-session-l", module_id="exp-mod-l", lecturer_id="exp-lect-12", room_id="exp-room-l", type="lecture", start="2026-09-25T14:00:00", end="2026-09-25T16:00:00", cohort_ids=["exp-cohort-l"]),
    dict(id="exp-anchor-l-room-cohort", module_id="exp-mod-anchor-room", lecturer_id="exp-lect-anchor-room", room_id="exp-room-l", type="lecture", start="2026-09-24T14:00:00", end="2026-09-24T16:00:00", cohort_ids=["exp-cohort-l"]),

    # ========================================================
    # M — FOUR SIMULTANEOUS FAILURES
    # Move CS413 Distributed Systems from Friday 14:00–16:00 to
    # Wednesday 14:00–16:00, keeping ENG 1.12 and Dr. Thomas Greene.
    # Failures: room overlap + lecturer overlap + cohort overlap + lecturer daily hours.
    # ========================================================
    dict(id="exp-session-m", module_id="exp-mod-m", lecturer_id="exp-lect-13", room_id="exp-room-m", type="lecture", start="2026-09-25T14:00:00", end="2026-09-25T16:00:00", cohort_ids=["exp-cohort-m"]),
    dict(id="exp-anchor-m-hours", module_id="exp-mod-anchor-hours", lecturer_id="exp-lect-13", room_id="exp-room-anchor", type="lecture", start="2026-09-23T09:00:00", end="2026-09-23T13:00:00", cohort_ids=["exp-anchor-cohort-lhours"]),
    dict(id="exp-anchor-m-lect", module_id="exp-mod-anchor-lect", lecturer_id="exp-lect-13", room_id="exp-room-anchor", type="lecture", start="2026-09-23T14:00:00", end="2026-09-23T16:00:00", cohort_ids=["exp-anchor-cohort-lect"]),
    dict(id="exp-anchor-m-room-cohort", module_id="exp-mod-anchor-cohort", lecturer_id="exp-lect-anchor-m", room_id="exp-room-m", type="lecture", start="2026-09-23T14:00:00", end="2026-09-23T16:00:00", cohort_ids=["exp-cohort-m"]),

]


# ------------------------------------------------------------
# Create sessions and attach session-level constraints
# ------------------------------------------------------------

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
        .filter(models.Program.id == "exp-cs")
        .all()
    )

    session.cohorts = (
        db.query(models.Cohort)
        .filter(models.Cohort.id.in_(s["cohort_ids"]))
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

print("Concrete explainability study seed complete.")
print(
    "A) CS401 Research Methods in Computing: "
    "Fri 14:00 -> Tue 09:00, keep room"
)
print(
    "B) CS402 Data Ethics and Governance: "
    "Fri 14:00 -> Wed 09:00, keep lecturer"
)
print(
    "C) CS403 Applied Data Analytics: "
    "Fri 14:00 -> Thu 09:00"
)
print(
    "D) CS404 Computer Security: "
    "Fri 14:00 -> Tue 14:00"
)
print(
    "E) CS405 Software Architecture: "
    "change room to ENG 2.12, keep time"
)
print(
    "F) CS406 Systems Programming: "
    "change room to ENG 2.14, keep time"
)
print(
    "G) CS407 Software Engineering Project: "
    "Fri 14:00 -> Mon 14:00"
)
print(
    "H) CS408 Advanced Database Systems: "
    "Fri 14:00 -> Tue 14:00"
)
print(
    "I) CS409 Professional Practice in Computing: "
    "Fri 14:00 -> Wed 12:00"
)
print("J) CS410 Machine Learning Applications: change room to ENG 2.16, keep time — capacity + equipment")
print("K) CS411 Cloud Computing: Fri 14:00 -> Mon 09:00 — lecturer overlap + cohort overlap")
print("L) CS412 Human-Computer Interaction: Fri 14:00 -> Thu 14:00, keep room — room overlap + lecturer unavailable + cohort overlap")
print("M) CS413 Distributed Systems: Fri 14:00 -> Wed 14:00, keep room + lecturer — room overlap + lecturer overlap + cohort overlap + lecturer daily hours")
