import random
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

# --- Programs ---
programs = [
    models.Program(id="cs", code="CS", name="Computer Science"),
    models.Program(id="ds", code="DS", name="Data Science"),
    models.Program(id="se", code="SE", name="Software Engineering"),
]
db.add_all(programs)

# --- Cohorts ---
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

# --- Lecturers ---
# NOTE: original demo data only had 3 lecturers. Added 3 more so 50 classes
# have realistic spread instead of piling onto the same 3 people.
lecturers = [
    models.Lecturer(id="lecturer-1", name="Dr. Maria Chen"),
    models.Lecturer(id="lecturer-2", name="Prof. James O'Connor"),
    models.Lecturer(id="lecturer-3", name="Dr. Aisha Khan"),
    models.Lecturer(id="lecturer-4", name="Dr. Tom Baxter"),
    models.Lecturer(id="lecturer-5", name="Prof. Linda Osei"),
    models.Lecturer(id="lecturer-6", name="Dr. Samuel Ruiz"),
]
db.add_all(lecturers)

unavailability = [
    models.LecturerUnavailability(lecturer_id="lecturer-1", day="fri", hour=9),
    models.LecturerUnavailability(lecturer_id="lecturer-1", day="fri", hour=10),
    models.LecturerUnavailability(lecturer_id="lecturer-1", day="fri", hour=11),
    models.LecturerUnavailability(lecturer_id="lecturer-1", day="fri", hour=12),
    models.LecturerUnavailability(lecturer_id="lecturer-1", day="fri", hour=13),
]
for hour in range(9, 18):
    unavailability.append(
        models.LecturerUnavailability(lecturer_id="lecturer-1", day="tue", hour=hour)
    )
db.add_all(unavailability)

rooms = [
    models.Room(id="room-b204", name="Room B204", capacity=60, equipment="Projector,Linux lab"),
    models.Room(id="lab-3", name="Lab 3", capacity=40, equipment="Whiteboard"),
    models.Room(id="room-a101", name="Room A101", capacity=70, equipment="Projector"),
    models.Room(id="room-c302", name="Room C302", capacity=40, equipment="Whiteboard,Projector"),
    models.Room(id="room-d105", name="Room D105", capacity=50, equipment="Projector"),
    models.Room(id="room-e210", name="Room E210", capacity=30, equipment="Whiteboard"),
]
db.add_all(rooms)

modules = [
    models.Module(id="module-1", code="CS101", title="Programming Fundamentals",
                   required_capacity=50, required_equipment="Projector,Linux lab"),
    models.Module(id="module-2", code="CS204", title="Data Structures",
                   required_capacity=40, required_equipment="Whiteboard"),
    models.Module(id="module-3", code="DS110", title="Intro to Data Science",
                   required_capacity=60, required_equipment="Projector"),
    models.Module(id="module-4", code="SE120", title="Software Design",
                   required_capacity=35, required_equipment="Whiteboard,Projector"),
    models.Module(id="module-5", code="CS310", title="Algorithms",
                   required_capacity=45, required_equipment="Projector"),
    models.Module(id="module-6", code="DS220", title="Machine Learning",
                   required_capacity=50, required_equipment="Projector"),
    models.Module(id="module-7", code="SE210", title="Databases",
                   required_capacity=40, required_equipment="Whiteboard"),
    models.Module(id="module-8", code="CS150", title="Discrete Math",
                   required_capacity=55, required_equipment="Whiteboard"),
    models.Module(id="module-9", code="DS330", title="Statistics for Data Science",
                   required_capacity=45, required_equipment="Projector"),
    models.Module(id="module-10", code="SE305", title="Software Testing",
                   required_capacity=35, required_equipment="Whiteboard,Projector"),
]
db.add_all(modules)

# --- Constraints ---
constraints = [
    models.Constraint(id="lecturer-one-class-at-time",
                       name="Lecturer cannot teach more than 1 class at a time",
                       description="A lecturer can never be scheduled to teach two sessions that overlap in time.",
                       stakeholder="Lecturer", type="unrelaxable"),
    models.Constraint(id="lecturer-unavailability", name="Lecturer unavailability",
                       description="Sessions are never scheduled during the specific days and hours a lecturer has marked as unavailable.",
                       stakeholder="Lecturer", type="relaxable"),
    models.Constraint(id="room-one-booking-at-time",
                       name="A room can have maximum one booking at a time",
                       description="A room can never host two sessions that overlap in time.",
                       stakeholder="Room", type="unrelaxable"),
    models.Constraint(id="lecturer-lunch-break", name="Lecturer lunch break",
                       description="Lecturers are given a protected lunch break each day which lasts 1 hour and can be scheduled between 12:00 to 14:00.",
                       stakeholder="Lecturer", type="relaxable"),
    models.Constraint(id="lecturer-max-one-hour-per-day",
                       name="Lecturer shall teach maximum 4 hour per day",
                       description="Caps how many hours a lecturer can be scheduled to teach on a single day, to prevent overload.",
                       stakeholder="Lecturer", type="relaxable"),
    models.Constraint(id="cohort-max-teaching-hours-per-day",
                       name="Cohort's maximum teaching hours per day",
                       description="Caps how many hours a cohort of students can be scheduled for classes on a single day.",
                       stakeholder="Cohort", type="relaxable"),
    models.Constraint(id="class-equipment", name="Class equipment",
                       description="A session is only scheduled in a room that has the equipment its module requires (e.g. a projector or a lab).",
                       stakeholder="Session", type="relaxable"),
    models.Constraint(id="class-capacity", name="Class capacity",
                       description="A session is only scheduled in a room with enough seats for the module's expected class size.",
                       stakeholder="Session", type="relaxable"),
]
db.add_all(constraints)

db.commit()

# --- Attach lecturer-, cohort-, and room-level constraint instances ---
for lecturer in lecturers:
    attach_lecturer_constraints(db, lecturer.id)
for cohort in cohorts:
    attach_cohort_constraints(db, cohort.id)
for room in rooms:
    attach_room_constraints(db, room.id)

db.commit()

# --- Sessions ---
# Generated: 50 sessions across 3 programs, spread over many cohorts,
# deliberately NOT conflict-checked -> expect overlapping lecturers/rooms/times.
# random.seed(42) makes this reproducible; change/remove the seed for different chaos.
random.seed(42)

days = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"]  # Mon-Fri
lecturer_ids = ["lecturer-1", "lecturer-2", "lecturer-3", "lecturer-4", "lecturer-5", "lecturer-6"]
room_ids = ["room-b204", "lab-3", "room-a101", "room-c302", "room-d105", "room-e210"]
session_types = ["lecture", "lab", "seminar", "tutorial"]

# module_id -> (program_id, cohort_ids that take this module)
module_program_cohorts = {
    "module-1": ("cs", ["cs-y1"]),
    "module-2": ("cs", ["cs-y2"]),
    "module-5": ("cs", ["cs-y3"]),
    "module-8": ("cs", ["cs-y1", "cs-y2"]),
    "module-3": ("ds", ["ds-y1"]),
    "module-6": ("ds", ["ds-y2"]),
    "module-9": ("ds", ["ds-y1", "ds-y2"]),
    "module-4": ("se", ["se-y1"]),
    "module-7": ("se", ["se-y2"]),
    "module-10": ("se", ["se-y1", "se-y2"]),
}

sessions_data = []
for i in range(1, 51):
    module_id = random.choice(list(module_program_cohorts.keys()))
    program_id, cohort_ids = module_program_cohorts[module_id]
    day = random.choice(days)
    start_hour = random.choice(range(8, 18))
    duration = random.choice([1, 2, 3])
    end_hour = min(start_hour + duration, 20)

    sessions_data.append(dict(
        id=f"session-{i}",
        module_id=module_id,
        lecturer_id=random.choice(lecturer_ids),
        room_id=random.choice(room_ids),
        type=random.choice(session_types),
        start=f"{day}T{start_hour:02d}:00:00",
        end=f"{day}T{end_hour:02d}:00:00",
        program_ids=[program_id],
        cohort_ids=cohort_ids,
    ))

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
    session.programs = db.query(models.Program).filter(
        models.Program.id.in_(s["program_ids"])
    ).all()
    session.cohorts = db.query(models.Cohort).filter(
        models.Cohort.id.in_(s["cohort_ids"])
    ).all()
    db.add(session)
    db.flush()
    attach_session_constraints(db, session.id)

db.commit()
db.close()

print("Seed complete.")