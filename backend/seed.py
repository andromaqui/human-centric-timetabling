from datetime import datetime

from app.constraint_logic import (
    attach_session_constraints,
    attach_lecturer_constraints,
    attach_cohort_constraints,
    attach_room_constraints,
)
from app.database import SessionLocal, engine
from app import models
from datetime import date


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
    models.Cohort(id="ds-y3", name="DS Year 3", program_id="ds"),
    models.Cohort(id="cohort-x", name="Cohort X", program_id="cs"),
    models.Cohort(id="cohort-y", name="Cohort Y", program_id="cs"),
    # Scenario C cohorts
    models.Cohort(id="cohort-t", name="Cohort T", program_id="cs"),
    models.Cohort(id="cohort-u", name="Cohort U", program_id="cs"),
    models.Cohort(id="cohort-i", name="Cohort I", program_id="cs"),
    models.Cohort(id="cohort-v", name="Cohort V", program_id="cs"),

    # User-study-only cohorts (isolated from existing solver scenarios)
    models.Cohort(id="cohort-lunch-study", name="Lunch Study Cohort", program_id="cs"),
    models.Cohort(id="cohort-z", name="Cohort Z", program_id="cs"),
    models.Cohort(id="cohort-r", name="Cohort R", program_id="cs"),
    # ANY/FIND smart-relaxation test cohort
    models.Cohort(id="cohort-any", name="ANY Recovery Cohort", program_id="cs"),
    models.Cohort(id="cohort-any-extra", name="ANY Tuesday Lecturer Extra Cohort", program_id="cs"),
    models.Cohort(id="cohort-room-xyz", name="Room XYZ Monday Cohort", program_id="cs"),
    # Simple mixed-recovery study scenario
    models.Cohort(id="cohort-mix", name="SE Year 3", program_id="se"),
    models.Cohort(id="cohort-mix-other", name="SE Elective Group", program_id="se"),
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
    models.Lecturer(id="lecturer-7", name="Dr. Sarah Murphy"),
    models.Lecturer(id="lecturer-8", name="Alice Mathematicer"),
    models.Lecturer(id="lecturer-9", name="Bob Optimizer"),

    # Scenario C — isolated lecturers
    models.Lecturer(id="lecturer-10", name="Dr. Maya Walsh"),
    models.Lecturer(id="lecturer-11", name="Dr. Niamh Kelly"),   # fixed specialist lab
    models.Lecturer(id="lecturer-12", name="Dr. Liam Byrne"),   # cascade 1
    models.Lecturer(id="lecturer-13", name="Dr. Aoife Nolan"),  # cascade 2
    models.Lecturer(id="lecturer-14", name="Dr. Cian Doyle"),   # cascade 3
    models.Lecturer(id="lecturer-15", name="Dr. Orla Hayes"),   # cascade 4
    models.Lecturer(id="lecturer-16", name="Dr. Eoin Walsh"),   # cascade 5
    models.Lecturer(id="lecturer-17", name="Dr. Tara Flynn"),   # cascade 6
    models.Lecturer(id="lecturer-18", name="Dr. Sean Murphy"),  # cascade 7
    models.Lecturer(id="lecturer-19", name="Dr. Eva Ryan"),     # cascade 8
    models.Lecturer(id="lecturer-20", name="Dr. Conor Lee"),    # cascade 9
    models.Lecturer(id="lecturer-21", name="Dr. Fiona Burke"),  # cascade 10
    models.Lecturer(id="lecturer-22", name="Dr. Grace OBrien"),  # Cohort V fixed anchor

    # User-study-only lecturers (isolated from all existing scenarios)
    models.Lecturer(id="lecturer-23", name="Dr. Daniel Reed"),
    models.Lecturer(id="lecturer-24", name="Dr. Emma Collins"),
    models.Lecturer(id="lecturer-25", name="Dr. Rachel Morgan"),
    # ANY/FIND smart-relaxation test lecturers
    models.Lecturer(id="lecturer-26", name="Dr. Alex Turner"),
    models.Lecturer(id="lecturer-27", name="Dr. Tuesday Anchor"),
    models.Lecturer(id="lecturer-28", name="Dr. Wednesday Anchor"),
    models.Lecturer(id="lecturer-29", name="Dr. Thursday Anchor"),
    models.Lecturer(id="lecturer-30", name="Dr. Friday Anchor"),
    # Simple mixed-recovery study scenario
    models.Lecturer(id="lecturer-31", name="Dr. Laura Bennett"),
    models.Lecturer(id="lecturer-32", name="Dr. Mark Hughes"),
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
LECTURER_1_FREE_SLOTS = {
    ("mon", 9),
    ("mon", 10),
    ("mon", 12),
    ("mon", 13),
}

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


# -------------------------------------------------
# Dr. Aisha Khan — lecturer-3
#
# CONTROLLED TEST CASE:
# Keep all of Aisha's existing teaching windows available,
# plus exactly ONE alternative 2-hour window for relocating
# DS370/session-15:
#   Wednesday 14:00-16:00
#
# Existing Aisha sessions:
#   session-3:  Monday 14:00-16:00
#   session-10: Thursday 09:00-12:00
#   session-15: Friday 09:00-11:00
# -------------------------------------------------
LECTURER_3_FREE_SLOTS = {
    # Existing session-3
    ("mon", 14),
    ("mon", 15),

    # One alternative relocation window for session-15
    ("wed", 14),
    ("wed", 15),

    # Existing session-10
    ("thu", 9),
    ("thu", 10),
    ("thu", 11),

    # Existing session-15
    ("fri", 9),
    ("fri", 10),
}

for day in TEACHING_DAYS:
    for hour in TEACHING_HOURS:
        if (day, hour) in LECTURER_3_FREE_SLOTS:
            continue
        unavailability.append(
            models.LecturerUnavailability(
                lecturer_id="lecturer-3",
                day=day,
                hour=hour,
            )
        )


# -------------------------------------------------
# Prof. Linda Osei — lecturer-5
#
# TEST CASE: Linda is unavailable for the whole teaching week
# except:
#   - Monday 09:00-11:00       (test alternative for DS380)
#   - Wednesday 09:00-11:00    (test alternative for DS380)
#   - Tuesday 11:00-13:00      (existing session-5)
#   - Thursday 11:00-13:00     (existing session-11)
#   - Friday 11:00-13:00       (existing DS380/session-16)
# -------------------------------------------------
LECTURER_5_FREE_SLOTS = {
    ("mon", 9),
    ("mon", 10),
    ("wed", 9),
    ("wed", 10),
    ("tue", 11),
    ("tue", 12),
    ("thu", 11),
    ("thu", 12),
    ("fri", 11),
    ("fri", 12),
}

for day in TEACHING_DAYS:
    for hour in TEACHING_HOURS:
        if (day, hour) in LECTURER_5_FREE_SLOTS:
            continue
        unavailability.append(
            models.LecturerUnavailability(
                lecturer_id="lecturer-5",
                day=day,
                hour=hour,
            )
        )


# -------------------------------------------------
# Dr. Sarah Murphy — lecturer-7
#
# CONTROLLED TEST CASE:
# Sarah keeps her existing teaching windows available, plus exactly
# ONE alternative 2-hour window for relocating a Friday class:
#   Tuesday 09:00-11:00
#
# Existing Sarah sessions:
#   session-13: Friday 09:00-11:00
#   session-14: Friday 11:00-13:00
#   session-17: Thursday 14:00-16:00
# -------------------------------------------------
LECTURER_7_FREE_SLOTS = {
    # One alternative relocation window
    ("tue", 9),
    ("tue", 10),

    # Existing session-17
    ("thu", 14),
    ("thu", 15),

    # Existing session-13 and session-14, plus requested Friday 15:00-17:00 window
    ("fri", 9),
    ("fri", 10),
    ("fri", 11),
    ("fri", 12),
    ("fri", 15),
    ("fri", 16),
}

for day in TEACHING_DAYS:
    for hour in TEACHING_HOURS:
        if (day, hour) in LECTURER_7_FREE_SLOTS:
            continue
        unavailability.append(
            models.LecturerUnavailability(
                lecturer_id="lecturer-7",
                day=day,
                hour=hour,
            )
        )


# -------------------------------------------------
# Alice Mathematicer — lecturer-8
# External Mathematics teaching: available only Wednesday 09:00-12:00.
# This makes the MA1001 lecture + workshop effectively immovable.
# -------------------------------------------------
LECTURER_8_FREE_SLOTS = {
    ("wed", 9),
    ("wed", 10),
    ("wed", 11),
}

for day in TEACHING_DAYS:
    for hour in TEACHING_HOURS:
        if (day, hour) in LECTURER_8_FREE_SLOTS:
            continue
        unavailability.append(
            models.LecturerUnavailability(
                lecturer_id="lecturer-8",
                day=day,
                hour=hour,
            )
        )

# -------------------------------------------------
# Bob Optimizer — lecturer-9
# Existing Optimization lecture: Tuesday 14:00-16:00.
# Existing Optimization lab: Wednesday 16:00-17:00.
# Requested demo move: lecture -> Wednesday 14:00-16:00, directly before lab.
# Bob is deliberately limited to these teaching windows.
# -------------------------------------------------
LECTURER_9_FREE_SLOTS = {
    # CSADS — existing class
    ("wed", 9),
    ("wed", 10),

    # Optimization lecture — current position
    ("tue", 14),
    ("tue", 15),

    # Optimization requested position + existing lab
    ("wed", 14),
    ("wed", 15),
    ("wed", 16),
}

for day in TEACHING_DAYS:
    for hour in TEACHING_HOURS:
        if (day, hour) in LECTURER_9_FREE_SLOTS:
            continue
        unavailability.append(
            models.LecturerUnavailability(
                lecturer_id="lecturer-9",
                day=day,
                hour=hour,
            )
        )

# -------------------------------------------------
# SCENARIO C — two-stage recovery with a genuine mixed midpoint
#
# Stage 1 (5 perturbations): moving Applied Algorithms starts a five-class
# Room F310 cascade. The fifth class ends in the free Tuesday 14:00-16:00
# slot, repairing Cohort T but creating a Cohort V daily-hours overload.
# Stage 2 (5 more perturbations): preserving Cohort V's daily-hours limit
# moves its first class and starts a separate five-class Room H510 cascade.
# lecturer-10 (Maya) can teach the target in its current Thursday
# slot or the requested Tuesday 14:00-16:00 slot.
# -------------------------------------------------
SCENARIO_C_FREE_SLOTS = {
    "lecturer-10": {("tue", 14), ("tue", 15), ("thu", 14), ("thu", 15)},
    "lecturer-11": {("tue", 9), ("tue", 10)},

    # Stage 1: A -> B -> C -> D -> E -> free Tue 14:00
    "lecturer-12": {("tue", 11), ("tue", 12), ("wed", 9), ("wed", 10)},
    "lecturer-13": {("wed", 9), ("wed", 10), ("wed", 11), ("wed", 12)},
    "lecturer-14": {("wed", 11), ("wed", 12), ("wed", 14), ("wed", 15)},
    "lecturer-15": {("wed", 14), ("wed", 15), ("thu", 9), ("thu", 10)},
    "lecturer-16": {("thu", 9), ("thu", 10), ("tue", 14), ("tue", 15)},

    # Stage 2: F -> G -> H -> I -> J -> free Mon 14:00
    "lecturer-17": {("tue", 9), ("tue", 10), ("wed", 9), ("wed", 10)},
    "lecturer-18": {("wed", 9), ("wed", 10), ("thu", 9), ("thu", 10)},
    "lecturer-19": {("thu", 9), ("thu", 10), ("fri", 9), ("fri", 10)},
    "lecturer-20": {("fri", 9), ("fri", 10), ("mon", 9), ("mon", 10)},
    "lecturer-21": {("mon", 9), ("mon", 10), ("mon", 14), ("mon", 15)},

    # Fixed Cohort V anchor: together with F this gives Cohort V 4h Tuesday.
    "lecturer-22": {("tue", 11), ("tue", 12)},
}

for lecturer_id, free_slots in SCENARIO_C_FREE_SLOTS.items():
    for day in TEACHING_DAYS:
        for hour in TEACHING_HOURS:
            if (day, hour) in free_slots:
                continue
            unavailability.append(
                models.LecturerUnavailability(
                    lecturer_id=lecturer_id,
                    day=day,
                    hour=hour,
                )
            )


# -------------------------------------------------
# User-study relaxation-only scenario — Dr. Rachel Morgan
# Current class: Thursday 09:00-12:00. Requested move: Monday 12:00-15:00.
# Rachel is available only for the current and requested windows, so the
# requested 3-hour class necessarily occupies the full protected lunch window.
# -------------------------------------------------
LECTURER_25_FREE_SLOTS = {
    ("mon", 12), ("mon", 13), ("mon", 14),
    ("thu", 9), ("thu", 10), ("thu", 11),
}

for day in TEACHING_DAYS:
    for hour in TEACHING_HOURS:
        if (day, hour) in LECTURER_25_FREE_SLOTS:
            continue
        unavailability.append(
            models.LecturerUnavailability(
                lecturer_id="lecturer-25",
                day=day,
                hour=hour,
            )
        )

# -------------------------------------------------
# ANY/FIND SMART RELAXATION TEST — Dr. Alex Turner
#
# Target session is Monday 09:00-12:00 (3h).
# On Monday Alex is available ONLY for those three hours.
# Tuesday-Friday Alex is fully available.
# Therefore Time=ANY/FIND cannot use another Monday slot.
# -------------------------------------------------
LECTURER_26_FREE_SLOTS = {
    ("mon", 9), ("mon", 10), ("mon", 11),
}

for hour in TEACHING_HOURS:
    if ("mon", hour) in LECTURER_26_FREE_SLOTS:
        continue
    unavailability.append(
        models.LecturerUnavailability(
            lecturer_id="lecturer-26",
            day="mon",
            hour=hour,
        )
    )


# -------------------------------------------------
# ANY/FIND objective-impact test availability
#
# lecturer-26 (Monday target lecturer): unavailable Thursday + Friday.
# lecturer-27 (Tuesday anchor lecturer): unavailable Thursday + Friday; Monday is available.
# lecturer-28 (Wednesday anchor lecturer): unavailable Thursday + Friday,
# and additionally Wednesday 11:00-13:00. Monday is available.
# -------------------------------------------------
for lecturer_id in ["lecturer-26", "lecturer-27"]:
    for day in ["thu", "fri"]:
        for hour in TEACHING_HOURS:
            unavailability.append(
                models.LecturerUnavailability(
                    lecturer_id=lecturer_id,
                    day=day,
                    hour=hour,
                )
            )

for day in ["mon", "thu", "fri"]:
    for hour in TEACHING_HOURS:
        unavailability.append(
            models.LecturerUnavailability(
                lecturer_id="lecturer-28",
                day=day,
                hour=hour,
            )
        )

for hour in [11, 12]:
    unavailability.append(
        models.LecturerUnavailability(
            lecturer_id="lecturer-28",
            day="wed",
            hour=hour,
        )
    )



# -------------------------------------------------
# SIMPLE MIXED-RECOVERY STUDY SCENARIO
#
# Requested move: session-48 (Laura + SE Year 3)
# Thu 14:00-16:00 -> Tue 14:00-16:00.
#
# Tuesday already contains:
#   - Laura teaching SE Elective Group, 09:00-13:00
#   - SE Year 3 taught by Mark Hughes, 09:00-13:00
#
# The request therefore creates exactly two relaxable daily-hours violations.
# Laura's anchor can move to Wed 09:00-13:00; the cohort anchor can move
# to Thu 09:00-13:00. This gives the intended landscape:
#   0P + 2R, 1P + 1R, or 2P + 0R.
# -------------------------------------------------
MIXED_STUDY_FREE_SLOTS = {
    "lecturer-31": {
        ("tue", 9), ("tue", 10), ("tue", 11), ("tue", 12),
        ("tue", 14), ("tue", 15),
        ("wed", 9), ("wed", 10), ("wed", 11), ("wed", 12),
        ("thu", 14), ("thu", 15),
    },
    "lecturer-32": {
        ("tue", 9), ("tue", 10), ("tue", 11), ("tue", 12),
        ("thu", 9), ("thu", 10), ("thu", 11), ("thu", 12),
    },
}

for lecturer_id, free_slots in MIXED_STUDY_FREE_SLOTS.items():
    for day in TEACHING_DAYS:
        for hour in TEACHING_HOURS:
            if (day, hour) in free_slots:
                continue
            unavailability.append(
                models.LecturerUnavailability(
                    lecturer_id=lecturer_id,
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
    # Scenario C: only this room has the cascade equipment.
    models.Room(
        id="room-f310",
        name="Room F310",
        capacity=40,
        equipment="Whiteboard,Cascade rig",
    ),
    # Scenario C fixed specialist laboratory.
    models.Room(
        id="lab-special",
        name="Specialist Lab",
        capacity=40,
        equipment="Whiteboard,Specialist lab",
    ),
    # Scenario C second-stage cascade room: only this room has the V rig.
    models.Room(
        id="room-h510",
        name="Room H510",
        capacity=40,
        equipment="Whiteboard,V rig",
    ),
    # Scenario C target room: reserved for Advanced Computing only.
    models.Room(
        id="room-g410",
        name="Room G410",
        capacity=40,
        equipment="Projector",
    ),

    # User-study-only rooms so the added sessions do not affect existing scenarios.
    models.Room(id="room-study-lunch", name="Study Room L1", capacity=40, equipment="Projector"),
    models.Room(id="room-study-z1", name="Study Room Z1", capacity=40, equipment="Projector"),
    models.Room(id="room-study-z2", name="Study Room Z2", capacity=40, equipment="Projector"),
    models.Room(id="room-study-z3", name="Study Room Z3", capacity=40, equipment="Projector"),
    models.Room(id="room-study-z4", name="Study Room Z4", capacity=40, equipment="Projector"),
    models.Room(id="room-study-r", name="Study Room R1", capacity=40, equipment="Projector"),
    models.Room(id="room-study-any", name="Study Room ANY", capacity=40, equipment="Projector"),
    models.Room(id="room-xyz", name="Room XYZ", capacity=40, equipment="Projector"),
    # Simple mixed-recovery study scenario
    models.Room(id="room-mix-target", name="Study Room M1", capacity=40, equipment="Projector"),
    models.Room(id="room-mix-laura", name="Study Room M2", capacity=40, equipment="Projector"),
    models.Room(id="room-mix-cohort", name="Study Room M3", capacity=40, equipment="Projector"),
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
        id="module-11",
        code="CS111",
        title="Machine Learning Fundamentals",
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
models.Module(
    id="module-12",
    code="DS310",
    title="Data Engineering",
    required_capacity=40,
    required_equipment="Projector",
),
models.Module(
    id="module-13",
    code="DS320",
    title="Business Intelligence",
    required_capacity=40,
    required_equipment="Projector",
),
models.Module(
    id="module-14",
    code="DS360",
    title="Data Mining",
    required_capacity=40,
    required_equipment="Projector",
),
models.Module(
    id="module-15",
    code="DS370",
    title="Natural Language Processing",
    required_capacity=40,
    required_equipment="Projector",
),
models.Module(
    id="module-16",
    code="DS380",
    title="Advanced Machine Learning",
    required_capacity=40,
    required_equipment="Projector",
),
models.Module(
    id="module-17",
    code="MA1001",
    title="Mathematics",
    required_capacity=40,
    required_equipment="Projector",
),
models.Module(
    id="module-18",
    code="CSOPT",
    title="Optimization",
    required_capacity=40,
    required_equipment="Projector",
),
models.Module(
    id="module-19",
    code="CSADS",
    title="Algorithms and Data Structures",
    required_capacity=40,
    required_equipment="Projector",
),    # Scenario C modules
    models.Module(id="module-20", code="CSLAB", title="Specialist Systems Lab", required_capacity=40, required_equipment="Specialist lab"),
    models.Module(id="module-21", code="CSCAS1", title="Applied Algorithms", required_capacity=40, required_equipment="Cascade rig"),
    models.Module(id="module-22", code="CSREQ", title="Advanced Computing", required_capacity=40, required_equipment="Projector"),
    models.Module(id="module-23", code="CSCAS2", title="Distributed Systems", required_capacity=40, required_equipment="Cascade rig"),
    models.Module(id="module-24", code="CSCAS3", title="Computer Vision", required_capacity=40, required_equipment="Cascade rig"),
    models.Module(id="module-25", code="CSCAS4", title="Information Retrieval", required_capacity=40, required_equipment="Cascade rig"),
    models.Module(id="module-26", code="CSCAS5", title="Cloud Computing", required_capacity=40, required_equipment="Cascade rig"),
    models.Module(id="module-27", code="CSCAS6", title="Parallel Computing", required_capacity=40, required_equipment="V rig"),
    models.Module(id="module-28", code="CSCAS7", title="Data Visualisation", required_capacity=40, required_equipment="V rig"),
    models.Module(id="module-29", code="CSCAS8", title="Software Architecture", required_capacity=40, required_equipment="V rig"),
    models.Module(id="module-30", code="CSCAS9", title="Network Science", required_capacity=40, required_equipment="V rig"),
    models.Module(id="module-31", code="CSCAS10", title="Intelligent Systems", required_capacity=40, required_equipment="V rig"),
    models.Module(id="module-32", code="CSVFIX", title="Cohort V Studio", required_capacity=40, required_equipment="Projector"),

    # User-study-only modules
    models.Module(id="module-33", code="CSLUNCH", title="Lunch Window Seminar", required_capacity=40, required_equipment="Projector"),
    models.Module(id="module-34", code="CSZ1", title="Cohort Z Class 1", required_capacity=40, required_equipment="Projector"),
    models.Module(id="module-35", code="CSZ2", title="Cohort Z Class 2", required_capacity=40, required_equipment="Projector"),
    models.Module(id="module-36", code="CSZ3", title="Cohort Z Class 3", required_capacity=40, required_equipment="Projector"),
    models.Module(id="module-37", code="CSZ4", title="Cohort Z Class 4", required_capacity=40, required_equipment="Projector"),
    models.Module(id="module-38", code="CSHCI", title="Human-Computer Interaction", required_capacity=40, required_equipment="Projector"),
    # ANY/FIND smart-relaxation test modules
    models.Module(id="module-39", code="CSANY", title="ANY Recovery Target", required_capacity=40, required_equipment="Projector"),
    models.Module(id="module-40", code="CSANYT", title="ANY Tuesday Anchor", required_capacity=40, required_equipment="Projector"),
    models.Module(id="module-41", code="CSANYW", title="ANY Wednesday Anchor", required_capacity=40, required_equipment="Projector"),
    models.Module(id="module-42", code="CSANYH", title="ANY Thursday Anchor", required_capacity=40, required_equipment="Projector"),
    models.Module(id="module-43", code="CSANYF", title="ANY Friday Anchor", required_capacity=40, required_equipment="Projector"),
    models.Module(id="module-44", code="CSANYM", title="ANY Tuesday Lecturer Monday Class", required_capacity=40, required_equipment="Projector"),
    models.Module(id="module-45", code="XYZ1", title="Room XYZ Monday Class 1", required_capacity=40, required_equipment="Projector"),
    models.Module(id="module-46", code="XYZ2", title="Room XYZ Monday Class 2", required_capacity=40, required_equipment="Projector"),
    # Simple mixed-recovery study scenario
    models.Module(id="module-47", code="SEMIX", title="Software Engineering Practice", required_capacity=40, required_equipment="Projector"),
    models.Module(id="module-48", code="SELA", title="Applied Software Design", required_capacity=40, required_equipment="Projector"),
    models.Module(id="module-49", code="SECO", title="Software Project Management", required_capacity=40, required_equipment="Projector"),
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
        id="cohort-one-class-at-time",
        name="Cohort cannot attend more than 1 class at a time",
        description=(
            "A cohort can never be scheduled to attend two "
            "sessions that overlap in time."
        ),
        stakeholder="Cohort",
        type="unrelaxable",
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
        "module_id": "module-11",
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
# ============================================================
# CONTROLLED RECOVERY SCENARIO — MINIMUM 2 PERTURBATIONS
#
# Experimental request:
#   Move session-17 (Sarah Murphy + DS Year 3)
#   from Thursday 14:00-16:00 to Friday 14:00-16:00.
#
# Before the request:
#   - Sarah teaches 4h on Friday, but NOT DS Year 3.
#   - DS Year 3 has 4h on Friday, but with OTHER lecturers.
#
# After the request both reach 6h, violating their respective
# relaxable max-hours-per-day constraints.
#
# Crucially, no single existing Friday session belongs to BOTH
# Sarah and DS Year 3. Therefore perturbation-only recovery needs
# at least two moves: one Sarah session + one DS Year 3 session.
# ============================================================

{
    "id": "session-13",
    "module_id": "module-12",
    "lecturer_id": "lecturer-7",
    "room_id": "room-a101",
    "type": "lecture",
    "start": "2026-09-25T09:00:00",
    "end": "2026-09-25T11:00:00",
    "program_ids": ["ds"],
    "cohort_ids": ["ds-y2"],
},
{
    "id": "session-14",
    "module_id": "module-13",
    "lecturer_id": "lecturer-7",
    "room_id": "room-c302",
    "type": "lecture",
    "start": "2026-09-25T11:00:00",
    "end": "2026-09-25T13:00:00",
    "program_ids": ["ds"],
    "cohort_ids": ["ds-y2"],
},
{
    "id": "session-15",
    "module_id": "module-15",
    "lecturer_id": "lecturer-3",
    "room_id": "room-d105",
    "type": "lecture",
    "start": "2026-09-25T09:00:00",
    "end": "2026-09-25T11:00:00",
    "program_ids": ["ds"],
    "cohort_ids": ["ds-y3"],
},
{
    "id": "session-16",
    "module_id": "module-16",
    "lecturer_id": "lecturer-5",
    "room_id": "room-e210",
    "type": "lecture",
    "start": "2026-09-25T11:00:00",
    "end": "2026-09-25T13:00:00",
    "program_ids": ["ds"],
    "cohort_ids": ["ds-y3"],
},
{
    "id": "session-17",
    "module_id": "module-14",
    "lecturer_id": "lecturer-7",
    "room_id": "room-d105",
    "type": "lecture",
    "start": "2026-09-24T14:00:00",
    "end": "2026-09-24T16:00:00",
    "program_ids": ["ds"],
    "cohort_ids": ["ds-y3"],
},

# ============================================================
# CONTROLLED RECOVERY SCENARIO B — COHORT X
#
# Wednesday fixed Mathematics block:
#   MA1001 lecture  09:00-11:00
#   MA1001 workshop 11:00-12:00
# Alice is unavailable outside Wednesday 09:00-12:00.
#
# Optimization:
#   lecture currently Tuesday 14:00-16:00 (target session-20)
#   lab already Wednesday 16:00-17:00
#
# Experimental request:
#   Move Optimization lecture to Wednesday 14:00-16:00,
#   immediately before the lab. Cohort X would then have 6h
#   on Wednesday. The Mathematics block cannot be perturbed away
#   because lecturer availability is unrelaxable.
# ============================================================
{
    "id": "session-18",
    "module_id": "module-17",
    "lecturer_id": "lecturer-8",
    "room_id": "room-c302",
    "type": "lecture",
    "start": "2026-09-23T09:00:00",
    "end": "2026-09-23T11:00:00",
    "program_ids": ["cs"],
    "cohort_ids": ["cohort-x"],
},
{
    "id": "session-19",
    "module_id": "module-17",
    "lecturer_id": "lecturer-8",
    "room_id": "room-c302",
    "type": "workshop",
    "start": "2026-09-23T11:00:00",
    "end": "2026-09-23T12:00:00",
    "program_ids": ["cs"],
    "cohort_ids": ["cohort-x"],
},
{
    "id": "session-20",
    "module_id": "module-18",
    "lecturer_id": "lecturer-9",
    "room_id": "room-d105",
    "type": "lecture",
    "start": "2026-09-22T14:00:00",
    "end": "2026-09-22T16:00:00",
    "program_ids": ["cs"],
    "cohort_ids": ["cohort-x"],
},
{
    "id": "session-21",
    "module_id": "module-18",
    "lecturer_id": "lecturer-9",
    "room_id": "room-d105",
    "type": "lab",
    "start": "2026-09-23T16:00:00",
    "end": "2026-09-23T17:00:00",
    "program_ids": ["cs"],
    "cohort_ids": ["cohort-x"],
},
{
    "id": "session-22",
    "module_id": "module-19",
    "lecturer_id": "lecturer-9",
    "room_id": "room-d105",
    "type": "lecture",
    "start": "2026-09-23T09:00:00",
    "end": "2026-09-23T11:00:00",
    "program_ids": ["cs"],
    "cohort_ids": ["cohort-y"],
},

# ============================================================
# CONTROLLED RECOVERY SCENARIO C — 0P+1R vs 5P+1R vs 10P+0R
#
# Experimental request:
#   Move session-25 (Maya Walsh + Cohort T)
#   from Thursday 14:00-16:00 to Tuesday 14:00-16:00, keeping Room G410.
#
# Cohort T already has 4h Tuesday (session-23 + session-24).
# Requested target makes 6h.
#
# Recovery landscape:
#   0P + 1R  : relax Cohort T max-hours.
#   5P + 1R  : move session-24 through the five-class F310 cascade;
#              Cohort T is repaired, but session-29 lands Tue 14:00-16:00
#              and makes Cohort V exceed 4h Tuesday.
#   10P + 0R : preserve Cohort V too by moving session-30, which triggers
#              the separate five-class H510 cascade.
# ============================================================
{
    "id": "session-23", "module_id": "module-20", "lecturer_id": "lecturer-11",
    "room_id": "lab-special", "type": "lab",
    "start": "2026-09-22T09:00:00", "end": "2026-09-22T11:00:00",
    "program_ids": ["cs"], "cohort_ids": ["cohort-t"],
},
{
    "id": "session-24", "module_id": "module-21", "lecturer_id": "lecturer-12",
    "room_id": "room-f310", "type": "lecture",
    "start": "2026-09-22T11:00:00", "end": "2026-09-22T13:00:00",
    "program_ids": ["cs"], "cohort_ids": ["cohort-t"],
},
{
    "id": "session-25", "module_id": "module-22", "lecturer_id": "lecturer-10",
    "room_id": "room-g410", "type": "lecture",
    "start": "2026-09-24T14:00:00", "end": "2026-09-24T16:00:00",
    "program_ids": ["cs"], "cohort_ids": ["cohort-t"],
},
# Stage 1 — five Room F310 perturbations. session-29 ends at free Tue 14:00.
{
    "id": "session-26", "module_id": "module-23", "lecturer_id": "lecturer-13",
    "room_id": "room-f310", "type": "lecture",
    "start": "2026-09-23T09:00:00", "end": "2026-09-23T11:00:00",
    "program_ids": ["cs"], "cohort_ids": ["cohort-u"],
},
{
    "id": "session-27", "module_id": "module-24", "lecturer_id": "lecturer-14",
    "room_id": "room-f310", "type": "lecture",
    "start": "2026-09-23T11:00:00", "end": "2026-09-23T13:00:00",
    "program_ids": ["cs"], "cohort_ids": ["cohort-i"],
},
{
    "id": "session-28", "module_id": "module-25", "lecturer_id": "lecturer-15",
    "room_id": "room-f310", "type": "lecture",
    "start": "2026-09-23T14:00:00", "end": "2026-09-23T16:00:00",
    "program_ids": ["cs"], "cohort_ids": ["cohort-u"],
},
{
    "id": "session-29", "module_id": "module-26", "lecturer_id": "lecturer-16",
    "room_id": "room-f310", "type": "lecture",
    "start": "2026-09-24T09:00:00", "end": "2026-09-24T11:00:00",
    "program_ids": ["cs"], "cohort_ids": ["cohort-v"],
},
# Stage 2 — Cohort V starts at exactly 4h Tuesday: F + fixed anchor session-35.
# If session-29 arrives Tue 14:00-16:00, Cohort V reaches 6h. Moving F repairs it
# and triggers the five-class H510 cascade.
{
    "id": "session-30", "module_id": "module-27", "lecturer_id": "lecturer-17",
    "room_id": "room-h510", "type": "lecture",
    "start": "2026-09-22T09:00:00", "end": "2026-09-22T11:00:00",
    "program_ids": ["cs"], "cohort_ids": ["cohort-v"],
},
{
    "id": "session-31", "module_id": "module-28", "lecturer_id": "lecturer-18",
    "room_id": "room-h510", "type": "lecture",
    "start": "2026-09-23T09:00:00", "end": "2026-09-23T11:00:00",
    "program_ids": ["cs"], "cohort_ids": ["cohort-v"],
},
{
    "id": "session-32", "module_id": "module-29", "lecturer_id": "lecturer-19",
    "room_id": "room-h510", "type": "lecture",
    "start": "2026-09-24T09:00:00", "end": "2026-09-24T11:00:00",
    "program_ids": ["cs"], "cohort_ids": ["cohort-v"],
},
{
    "id": "session-33", "module_id": "module-30", "lecturer_id": "lecturer-20",
    "room_id": "room-h510", "type": "lecture",
    "start": "2026-09-25T09:00:00", "end": "2026-09-25T11:00:00",
    "program_ids": ["cs"], "cohort_ids": ["cohort-v"],
},
{
    "id": "session-34", "module_id": "module-31", "lecturer_id": "lecturer-21",
    "room_id": "room-h510", "type": "lecture",
    "start": "2026-09-21T09:00:00", "end": "2026-09-21T11:00:00",
    "program_ids": ["cs"], "cohort_ids": ["cohort-v"],
},
{
    "id": "session-35", "module_id": "module-32", "lecturer_id": "lecturer-22",
    "room_id": "room-g410", "type": "seminar",
    "start": "2026-09-22T11:00:00", "end": "2026-09-22T13:00:00",
    "program_ids": ["cs"], "cohort_ids": ["cohort-v"],
},

# ============================================================
# USER STUDY SCENARIOS — isolated from existing solver scenarios
# ============================================================
# Lunch-break recognition: isolated study lecturer teaches continuously Monday 12:00-14:00.
{
    "id": "session-36", "module_id": "module-33", "lecturer_id": "lecturer-24",
    "room_id": "room-study-lunch", "type": "seminar",
    "start": "2026-09-21T12:00:00", "end": "2026-09-21T14:00:00",
    "program_ids": ["cs"], "cohort_ids": ["cohort-lunch-study"],
},
# Missing-constraint recognition: Daniel teaches four consecutive one-hour classes.
{
    "id": "session-37", "module_id": "module-34", "lecturer_id": "lecturer-23",
    "room_id": "room-study-z1", "type": "lecture",
    "start": "2026-09-22T09:00:00", "end": "2026-09-22T10:00:00",
    "program_ids": ["cs"], "cohort_ids": ["cohort-z"],
},
{
    "id": "session-38", "module_id": "module-35", "lecturer_id": "lecturer-23",
    "room_id": "room-study-z2", "type": "lecture",
    "start": "2026-09-22T10:00:00", "end": "2026-09-22T11:00:00",
    "program_ids": ["cs"], "cohort_ids": ["cohort-z"],
},
{
    "id": "session-39", "module_id": "module-36", "lecturer_id": "lecturer-23",
    "room_id": "room-study-z3", "type": "lecture",
    "start": "2026-09-22T11:00:00", "end": "2026-09-22T12:00:00",
    "program_ids": ["cs"], "cohort_ids": ["cohort-z"],
},
{
    "id": "session-40", "module_id": "module-37", "lecturer_id": "lecturer-23",
    "room_id": "room-study-z4", "type": "lecture",
    "start": "2026-09-22T12:00:00", "end": "2026-09-22T13:00:00",
    "program_ids": ["cs"], "cohort_ids": ["cohort-z"],
},

# Relaxation-only recovery scenario: request moving this class to Monday 12:00-15:00.
{
    "id": "session-41", "module_id": "module-38", "lecturer_id": "lecturer-25",
    "room_id": "room-study-r", "type": "lecture",
    "start": "2026-09-24T09:00:00", "end": "2026-09-24T12:00:00",
    "program_ids": ["cs"], "cohort_ids": ["cohort-r"],
},

# ============================================================
# ANY/FIND OBJECTIVE-IMPACT SCENARIO
#
# session-42 is the 3h target, currently Monday 09:00-12:00.
# Cohort ANY has only two anchor classes: Tuesday and Wednesday.
# Thursday and Friday anchor classes have been removed.
# The Tuesday and Wednesday anchors use different rooms.
# Availability is deliberately restricted above to shape FIND/ANY recoveries.
# ============================================================
{
    "id": "session-42", "module_id": "module-39", "lecturer_id": "lecturer-26",
    "room_id": "room-study-any", "type": "lecture",
    "start": "2026-09-21T09:00:00", "end": "2026-09-21T12:00:00",
    "program_ids": ["cs"], "cohort_ids": ["cohort-any"],
},
{
    "id": "session-43", "module_id": "module-40", "lecturer_id": "lecturer-27",
    "room_id": "room-xyz", "type": "lecture",
    "start": "2026-09-22T09:00:00", "end": "2026-09-22T11:00:00",
    "program_ids": ["cs"], "cohort_ids": ["cohort-any"],
},
{
    "id": "session-44", "module_id": "module-41", "lecturer_id": "lecturer-28",
    "room_id": "room-study-z1", "type": "lecture",
    "start": "2026-09-23T09:00:00", "end": "2026-09-23T11:00:00",
    "program_ids": ["cs"], "cohort_ids": ["cohort-any"],
},
{
    "id": "session-45", "module_id": "module-44", "lecturer_id": "lecturer-27",
    "room_id": "room-study-z2", "type": "lecture",
    "start": "2026-09-21T11:00:00", "end": "2026-09-21T13:00:00",
    "program_ids": ["cs"], "cohort_ids": ["cohort-any-extra"],
},
{
    "id": "session-46", "module_id": "module-45", "lecturer_id": "lecturer-29",
    "room_id": "room-xyz", "type": "lecture",
    "start": "2026-09-21T09:00:00", "end": "2026-09-21T11:00:00",
    "program_ids": ["cs"], "cohort_ids": ["cohort-room-xyz"],
},
{
    "id": "session-47", "module_id": "module-46", "lecturer_id": "lecturer-30",
    "room_id": "room-xyz", "type": "lecture",
    "start": "2026-09-21T11:00:00", "end": "2026-09-21T14:00:00",
    "program_ids": ["cs"], "cohort_ids": ["cohort-room-xyz"],
},


# ============================================================
# SIMPLE MIXED-RECOVERY STUDY SCENARIO — 2R vs 1P+1R vs 2P
#
# Experimental request:
#   Move session-48 (Laura Bennett + SE Year 3)
#   from Thursday 14:00-16:00 to Tuesday 14:00-16:00,
#   keeping Study Room M1 and Dr. Laura Bennett.
#
# Before request on Tuesday:
#   Laura teaches session-49 for 4h (SE Elective Group).
#   SE Year 3 attends session-50 for 4h (Mark Hughes).
#
# Requested target makes BOTH Laura and SE Year 3 reach 6h Tuesday.
# Intended recovery landscape:
#   0P + 2R : relax both daily-hours constraints.
#   1P + 1R : move either session-49 or session-50, relax the other constraint.
#   2P + 0R : move both anchor sessions, preserving both constraints.
# ============================================================
{
    "id": "session-48", "module_id": "module-47", "lecturer_id": "lecturer-31",
    "room_id": "room-mix-target", "type": "lecture",
    "start": "2026-09-24T14:00:00", "end": "2026-09-24T16:00:00",
    "program_ids": ["se"], "cohort_ids": ["cohort-mix"],
},
{
    "id": "session-49", "module_id": "module-48", "lecturer_id": "lecturer-31",
    "room_id": "room-mix-laura", "type": "lecture",
    "start": "2026-09-22T09:00:00", "end": "2026-09-22T13:00:00",
    "program_ids": ["se"], "cohort_ids": ["cohort-mix-other"],
},
{
    "id": "session-50", "module_id": "module-49", "lecturer_id": "lecturer-32",
    "room_id": "room-mix-cohort", "type": "lecture",
    "start": "2026-09-22T09:00:00", "end": "2026-09-22T13:00:00",
    "program_ids": ["se"], "cohort_ids": ["cohort-mix"],
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

semesters = [
    models.Semester(
        id="ws-2021-22",
        name="Winter Semester 2021/22",
        start_date=date(2021, 9, 1),
        end_date=date(2022, 1, 31),
    ),
    models.Semester(
        id="ss-2022",
        name="Summer Semester 2022",
        start_date=date(2022, 2, 1),
        end_date=date(2022, 6, 30),
    ),
    models.Semester(
        id="ws-2022-23",
        name="Winter Semester 2022/23",
        start_date=date(2022, 9, 1),
        end_date=date(2023, 1, 31),
    ),
    models.Semester(
        id="ss-2023",
        name="Summer Semester 2023",
        start_date=date(2023, 2, 1),
        end_date=date(2023, 6, 30),
    ),
    models.Semester(
        id="ws-2023-24",
        name="Winter Semester 2023/24",
        start_date=date(2023, 9, 1),
        end_date=date(2024, 1, 31),
    ),
    models.Semester(
        id="ss-2024",
        name="Summer Semester 2024",
        start_date=date(2024, 2, 1),
        end_date=date(2024, 6, 30),
    ),
    models.Semester(
        id="ws-2024-25",
        name="Winter Semester 2024/25",
        start_date=date(2024, 9, 1),
        end_date=date(2025, 1, 31),
    ),
    models.Semester(
        id="ss-2025",
        name="Summer Semester 2025",
        start_date=date(2025, 2, 1),
        end_date=date(2025, 6, 30),
    ),
    models.Semester(
        id="ws-2025-26",
        name="Winter Semester 2025/26",
        start_date=date(2025, 9, 1),
        end_date=date(2026, 1, 31),
    ),
]

db.add_all(semesters)


historical_impacts = [
    # ============================================================
    # LUNCH BREAK — DR. MARIA CHEN
    # ============================================================

    # Winter Semester 2023/24
    models.HistoricalImpact(
        id="impact-1",
        semester_id="ws-2023-24",
        stakeholder_type="lecturer",
        stakeholder_id="lecturer-1",
        constraint_id="lecturer-lunch-break",
        impact_type="lunch-break-reduced",
        occurred_on=date(2023, 10, 9),
        day="mon",
        magnitude_minutes=15,
        details={
            "expected_minutes": 60,
            "received_minutes": 45,
        },
    ),

    models.HistoricalImpact(
        id="impact-2",
        semester_id="ws-2023-24",
        stakeholder_type="lecturer",
        stakeholder_id="lecturer-1",
        constraint_id="lecturer-lunch-break",
        impact_type="lunch-break-reduced",
        occurred_on=date(2023, 11, 14),
        day="tue",
        magnitude_minutes=30,
        details={
            "expected_minutes": 60,
            "received_minutes": 30,
        },
    ),

    # Summer Semester 2024
    models.HistoricalImpact(
        id="impact-5",
        semester_id="ss-2024",
        stakeholder_type="lecturer",
        stakeholder_id="lecturer-1",
        constraint_id="lecturer-lunch-break",
        impact_type="lunch-break-reduced",
        occurred_on=date(2024, 3, 6),
        day="wed",
        magnitude_minutes=20,
        details={
            "expected_minutes": 60,
            "received_minutes": 40,
        },
    ),

    # Winter Semester 2024/25
    models.HistoricalImpact(
        id="impact-6",
        semester_id="ws-2024-25",
        stakeholder_type="lecturer",
        stakeholder_id="lecturer-1",
        constraint_id="lecturer-lunch-break",
        impact_type="lunch-break-reduced",
        occurred_on=date(2024, 10, 7),
        day="mon",
        magnitude_minutes=15,
        details={
            "expected_minutes": 60,
            "received_minutes": 45,
        },
    ),

    models.HistoricalImpact(
        id="impact-7",
        semester_id="ws-2024-25",
        stakeholder_type="lecturer",
        stakeholder_id="lecturer-1",
        constraint_id="lecturer-lunch-break",
        impact_type="lunch-break-reduced",
        occurred_on=date(2024, 11, 12),
        day="tue",
        magnitude_minutes=30,
        details={
            "expected_minutes": 60,
            "received_minutes": 30,
        },
    ),

    models.HistoricalImpact(
        id="impact-8",
        semester_id="ws-2024-25",
        stakeholder_type="lecturer",
        stakeholder_id="lecturer-1",
        constraint_id="lecturer-lunch-break",
        impact_type="lunch-break-reduced",
        occurred_on=date(2024, 12, 5),
        day="thu",
        magnitude_minutes=25,
        details={
            "expected_minutes": 60,
            "received_minutes": 35,
        },
    ),

    # Summer Semester 2025
    models.HistoricalImpact(
        id="impact-9",
        semester_id="ss-2025",
        stakeholder_type="lecturer",
        stakeholder_id="lecturer-1",
        constraint_id="lecturer-lunch-break",
        impact_type="lunch-break-reduced",
        occurred_on=date(2025, 3, 10),
        day="mon",
        magnitude_minutes=30,
        details={
            "expected_minutes": 60,
            "received_minutes": 30,
        },
    ),

    # Winter Semester 2025/26
    models.HistoricalImpact(
        id="impact-10",
        semester_id="ws-2025-26",
        stakeholder_type="lecturer",
        stakeholder_id="lecturer-1",
        constraint_id="lecturer-lunch-break",
        impact_type="lunch-break-reduced",
        occurred_on=date(2025, 10, 6),
        day="mon",
        magnitude_minutes=20,
        details={
            "expected_minutes": 60,
            "received_minutes": 40,
        },
    ),

    models.HistoricalImpact(
        id="impact-11",
        semester_id="ws-2025-26",
        stakeholder_type="lecturer",
        stakeholder_id="lecturer-1",
        constraint_id="lecturer-lunch-break",
        impact_type="lunch-break-reduced",
        occurred_on=date(2025, 11, 18),
        day="tue",
        magnitude_minutes=45,
        details={
            "expected_minutes": 60,
            "received_minutes": 15,
        },
    ),

    # ============================================================
    # LUNCH BREAK — PROF. JAMES O'CONNOR
    # ============================================================

    models.HistoricalImpact(
        id="impact-12",
        semester_id="ws-2023-24",
        stakeholder_type="lecturer",
        stakeholder_id="lecturer-2",
        constraint_id="lecturer-lunch-break",
        impact_type="lunch-break-reduced",
        occurred_on=date(2023, 11, 2),
        day="thu",
        magnitude_minutes=15,
        details={
            "expected_minutes": 60,
            "received_minutes": 45,
        },
    ),

    models.HistoricalImpact(
        id="impact-13",
        semester_id="ws-2024-25",
        stakeholder_type="lecturer",
        stakeholder_id="lecturer-2",
        constraint_id="lecturer-lunch-break",
        impact_type="lunch-break-reduced",
        occurred_on=date(2024, 10, 16),
        day="wed",
        magnitude_minutes=20,
        details={
            "expected_minutes": 60,
            "received_minutes": 40,
        },
    ),

    models.HistoricalImpact(
        id="impact-14",
        semester_id="ws-2024-25",
        stakeholder_type="lecturer",
        stakeholder_id="lecturer-2",
        constraint_id="lecturer-lunch-break",
        impact_type="lunch-break-reduced",
        occurred_on=date(2024, 12, 4),
        day="wed",
        magnitude_minutes=30,
        details={
            "expected_minutes": 60,
            "received_minutes": 30,
        },
    ),

    models.HistoricalImpact(
        id="impact-15",
        semester_id="ss-2025",
        stakeholder_type="lecturer",
        stakeholder_id="lecturer-2",
        constraint_id="lecturer-lunch-break",
        impact_type="lunch-break-reduced",
        occurred_on=date(2025, 4, 3),
        day="thu",
        magnitude_minutes=15,
        details={
            "expected_minutes": 60,
            "received_minutes": 45,
        },
    ),

    # ============================================================
    # LUNCH BREAK — DR. EMMA WALSH
    # ============================================================

    models.HistoricalImpact(
        id="impact-16",
        semester_id="ss-2024",
        stakeholder_type="lecturer",
        stakeholder_id="lecturer-3",
        constraint_id="lecturer-lunch-break",
        impact_type="lunch-break-reduced",
        occurred_on=date(2024, 4, 9),
        day="tue",
        magnitude_minutes=15,
        details={
            "expected_minutes": 60,
            "received_minutes": 45,
        },
    ),

    models.HistoricalImpact(
        id="impact-17",
        semester_id="ws-2024-25",
        stakeholder_type="lecturer",
        stakeholder_id="lecturer-3",
        constraint_id="lecturer-lunch-break",
        impact_type="lunch-break-reduced",
        occurred_on=date(2024, 11, 21),
        day="thu",
        magnitude_minutes=25,
        details={
            "expected_minutes": 60,
            "received_minutes": 35,
        },
    ),

    models.HistoricalImpact(
        id="impact-18",
        semester_id="ws-2025-26",
        stakeholder_type="lecturer",
        stakeholder_id="lecturer-3",
        constraint_id="lecturer-lunch-break",
        impact_type="lunch-break-reduced",
        occurred_on=date(2025, 10, 15),
        day="wed",
        magnitude_minutes=20,
        details={
            "expected_minutes": 60,
            "received_minutes": 40,
        },
    ),

    # ============================================================
    # LUNCH BREAK — PROF. MICHAEL RYAN
    # ============================================================

    models.HistoricalImpact(
        id="impact-19",
        semester_id="ws-2024-25",
        stakeholder_type="lecturer",
        stakeholder_id="lecturer-4",
        constraint_id="lecturer-lunch-break",
        impact_type="lunch-break-reduced",
        occurred_on=date(2024, 10, 18),
        day="fri",
        magnitude_minutes=15,
        details={
            "expected_minutes": 60,
            "received_minutes": 45,
        },
    ),

    # ============================================================
    # EXISTING CONSECUTIVE-TEACHING DATA
    # ============================================================

    models.HistoricalImpact(
        id="impact-3",
        semester_id="ss-2025",
        stakeholder_type="lecturer",
        stakeholder_id="lecturer-2",
        constraint_id="lecturer-max-one-hour-per-day",
        impact_type="consecutive-teaching",
        occurred_on=date(2025, 3, 13),
        day="thu",
        magnitude_minutes=120,
        details={
            "limit_minutes": 240,
            "actual_minutes": 360,
        },
    ),

    models.HistoricalImpact(
        id="impact-4",
        semester_id="ws-2025-26",
        stakeholder_type="cohort",
        stakeholder_id="cs-y2",
        constraint_id="cohort-max-teaching-hours-per-day",
        impact_type="consecutive-teaching",
        occurred_on=date(2025, 11, 10),
        day="mon",
        magnitude_minutes=60,
        details={
            "limit_minutes": 240,
            "actual_minutes": 300,
        },
    ),
]

db.add_all(historical_impacts)
db.commit()

# endregion

db.close()

print("Seed complete.")