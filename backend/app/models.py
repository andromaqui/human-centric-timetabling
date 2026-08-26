from sqlalchemy import ForeignKey, Table, Column, String, Integer, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base
from datetime import datetime



class Program(Base):
    __tablename__ = "programs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    code: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)

    cohorts: Mapped[list["Cohort"]] = relationship(back_populates="program")


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    equipment: Mapped[str | None] = mapped_column(String, nullable=True)


class Cohort(Base):
    __tablename__ = "cohorts"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    program_id: Mapped[str] = mapped_column(ForeignKey("programs.id"))

    program: Mapped["Program"] = relationship(back_populates="cohorts")


class Lecturer(Base):
    __tablename__ = "lecturers"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)

    unavailability: Mapped[list["LecturerUnavailability"]] = relationship(
        back_populates="lecturer", cascade="all, delete-orphan"
    )


class LecturerUnavailability(Base):
    __tablename__ = "lecturer_unavailability"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lecturer_id: Mapped[str] = mapped_column(ForeignKey("lecturers.id"))
    day: Mapped[str] = mapped_column(String, nullable=False)
    hour: Mapped[int] = mapped_column(Integer, nullable=False)

    lecturer: Mapped["Lecturer"] = relationship(back_populates="unavailability")


class Module(Base):
    __tablename__ = "modules"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    code: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    required_capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    required_equipment: Mapped[str | None] = mapped_column(String, nullable=True)


session_programs = Table(
    "session_programs",
    Base.metadata,
    Column("session_id", ForeignKey("sessions.id"), primary_key=True),
    Column("program_id", ForeignKey("programs.id"), primary_key=True),
)

session_cohorts = Table(
    "session_cohorts",
    Base.metadata,
    Column("session_id", ForeignKey("sessions.id"), primary_key=True),
    Column("cohort_id", ForeignKey("cohorts.id"), primary_key=True),
)


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    module_id: Mapped[str] = mapped_column(ForeignKey("modules.id"))
    lecturer_id: Mapped[str] = mapped_column(ForeignKey("lecturers.id"))
    start: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    room_id: Mapped[str | None] = mapped_column(ForeignKey("rooms.id"), nullable=True)
    type: Mapped[str] = mapped_column(String, nullable=False)

    module: Mapped["Module"] = relationship()
    lecturer: Mapped["Lecturer"] = relationship()
    room: Mapped["Room"] = relationship()
    programs: Mapped[list["Program"]] = relationship(secondary=session_programs)
    cohorts: Mapped[list["Cohort"]] = relationship(secondary=session_cohorts)


class Constraint(Base):
    __tablename__ = "constraints"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    stakeholder: Mapped[str] = mapped_column(String, nullable=False)  # "Lecturer" | "Cohort" | "Session" | "Room"
    type: Mapped[str] = mapped_column(String, nullable=False)         # "unrelaxable" | "relaxable"


class SessionConstraint(Base):
    __tablename__ = "session_constraints"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"))
    constraint_id: Mapped[str] = mapped_column(ForeignKey("constraints.id"))
    is_activated: Mapped[bool] = mapped_column(default=True)

    session: Mapped["Session"] = relationship()
    constraint: Mapped["Constraint"] = relationship()


class LecturerConstraint(Base):
    __tablename__ = "lecturer_constraints"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    lecturer_id: Mapped[str] = mapped_column(ForeignKey("lecturers.id"))
    constraint_id: Mapped[str] = mapped_column(ForeignKey("constraints.id"))
    day: Mapped[str | None] = mapped_column(String, nullable=True)
    is_activated: Mapped[bool] = mapped_column(default=True)

    lecturer: Mapped["Lecturer"] = relationship()
    constraint: Mapped["Constraint"] = relationship()


class CohortConstraint(Base):
    __tablename__ = "cohort_constraints"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    cohort_id: Mapped[str] = mapped_column(ForeignKey("cohorts.id"))
    constraint_id: Mapped[str] = mapped_column(ForeignKey("constraints.id"))
    day: Mapped[str | None] = mapped_column(String, nullable=True)
    is_activated: Mapped[bool] = mapped_column(default=True)

    cohort: Mapped["Cohort"] = relationship()
    constraint: Mapped["Constraint"] = relationship()


class RoomConstraint(Base):
    __tablename__ = "room_constraints"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    room_id: Mapped[str] = mapped_column(ForeignKey("rooms.id"))
    constraint_id: Mapped[str] = mapped_column(ForeignKey("constraints.id"))
    is_activated: Mapped[bool] = mapped_column(default=True)

    room: Mapped["Room"] = relationship()
    constraint: Mapped["Constraint"] = relationship()


class ConstraintRelaxation(Base):
    __tablename__ = "constraint_relaxations"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    instance_type: Mapped[str] = mapped_column(String, nullable=False)  # "session" | "lecturer" | "cohort" | "room"
    instance_id: Mapped[str] = mapped_column(String, nullable=False)
    relaxation_type: Mapped[str] = mapped_column(String, nullable=False)  # "disable" | "adjust"
    details: Mapped[str | None] = mapped_column(String, nullable=True)
    reason: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class CandidateSolution(Base):
    __tablename__ = "candidate_solutions"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=True)
    status = Column(String, nullable=False, default="saved")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Groups multiple candidate solutions that came from the same request
    request_id = Column(String, nullable=False)
    request_created_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    requested_session_id = Column(String, nullable=False)
    requested_module_id = Column(String, nullable=True)
    request_type = Column(String, nullable=False)

    additional_change_count = Column(Integer, nullable=False, default=0)

    request = Column(JSON, nullable=False)
    additional_changes = Column(JSON, nullable=False, default=list)
    stakeholder_impacts = Column(JSON, nullable=False, default=list)
    affected_stakeholders = Column(JSON, nullable=False, default=list)
    objectives = Column(JSON, nullable=True)
    constraints = Column(JSON, nullable=False)
    resulting_timetable = Column(JSON, nullable=False, default=list)
    solve_settings = Column(JSON, nullable=True)
    solver_metadata = Column(JSON, nullable=True)