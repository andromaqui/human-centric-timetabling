from datetime import datetime
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
    models.Cohort(id="ds-y1", name="DS Year 1", program_id="ds"),
    models.Cohort(id="se-y1", name="SE Year 1", program_id="se"),
]
db.add_all(cohorts)

# --- Lecturers ---
lecturers = [
    models.Lecturer(id="lecturer-1", name="Dr. Maria Chen"),
    models.Lecturer(id="lecturer-2", name="Prof. James O'Connor"),
    models.Lecturer(id="lecturer-3", name="Dr. Aisha Khan"),
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
]
db.add_all(modules)

db.commit()

sessions_data = [
    dict(id="session-1", module_id="module-1", lecturer_id="lecturer-1",
         room_id="room-b204", type="lecture",
         start="2026-09-21T09:00:00", end="2026-09-21T11:00:00",
         program_ids=["cs", "ds"], cohort_ids=["cs-y1", "ds-y1"]),
    dict(id="session-2", module_id="module-2", lecturer_id="lecturer-2",
         room_id="lab-3", type="lab",
         start="2026-09-22T13:00:00", end="2026-09-22T15:00:00",
         program_ids=["cs"], cohort_ids=["cs-y2"]),
    dict(id="session-3", module_id="module-3", lecturer_id="lecturer-3",
         room_id="room-a101", type="seminar",
         start="2026-09-23T10:00:00", end="2026-09-23T12:00:00",
         program_ids=["ds"], cohort_ids=["ds-y1"]),
    dict(id="session-4", module_id="module-4", lecturer_id="lecturer-1",
         room_id="room-c302", type="tutorial",
         start="2026-09-24T14:00:00", end="2026-09-24T16:00:00",
         program_ids=["se"], cohort_ids=["se-y1"]),
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
    session.programs = db.query(models.Program).filter(
        models.Program.id.in_(s["program_ids"])
    ).all()
    session.cohorts = db.query(models.Cohort).filter(
        models.Cohort.id.in_(s["cohort_ids"])
    ).all()
    db.add(session)

constraints = [
    models.Constraint(id="lecturer-one-class-at-time",
                       name="Lecturer cannot teach more than 1 class at a time",
                       description="", stakeholder="Lecturer", type="unrelaxable"),
    models.Constraint(id="lecturer-unavailability", name="Lecturer unavailability",
                       description="", stakeholder="Lecturer", type="unrelaxable"),
    models.Constraint(id="room-one-booking-at-time",
                       name="A room can have maximum one booking at a time",
                       description="", stakeholder="Class", type="unrelaxable"),
    models.Constraint(id="lecturer-lunch-break", name="Lecturer lunch break",
                       description="", stakeholder="Lecturer", type="relaxable"),
    models.Constraint(id="lecturer-max-one-hour-per-day",
                       name="Lecturer shall teach maximum 1 hour per day",
                       description="", stakeholder="Lecturer", type="relaxable"),
    models.Constraint(id="cohort-max-teaching-hours-per-day",
                       name="Cohort's maximum teaching hours per day",
                       description="", stakeholder="Cohort", type="relaxable"),
    models.Constraint(id="class-equipment", name="Class equipment",
                       description="", stakeholder="Class", type="relaxable"),
    models.Constraint(id="class-capacity", name="Class capacity",
                       description="", stakeholder="Class", type="relaxable"),
]
db.add_all(constraints)

db.commit()
db.close()

print("Seed complete.")