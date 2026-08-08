from sqlalchemy import String, Integer, ForeignKey, DateTime, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from .database import Base


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
    # comma-separated for now, same tradeoff as Module.required_equipment
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
    day: Mapped[str] = mapped_column(String, nullable=False)   # e.g. "mon"
    hour: Mapped[int] = mapped_column(Integer, nullable=False) # e.g. 9

    lecturer: Mapped["Lecturer"] = relationship(back_populates="unavailability")


class Module(Base):
    __tablename__ = "modules"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    code: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    required_capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # comma-separated for now, e.g. "Projector,Whiteboard" — fine until
    # you need to query "modules that need a Linux lab", at which point
    # normalize into its own table
    required_equipment: Mapped[str | None] = mapped_column(String, nullable=True)


# Sessions have many-to-many relations to programs and cohorts,
# so we need join tables.
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
    stakeholder: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)


class CandidateSolution(Base):
    __tablename__ = "candidate_solutions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    request_id: Mapped[str] = mapped_column(String, nullable=False)
    saved_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    module_code: Mapped[str] = mapped_column(String, nullable=False)
    module_title: Mapped[str] = mapped_column(String, nullable=False)
    request_type: Mapped[str] = mapped_column(String, nullable=False)
    request_summary: Mapped[str] = mapped_column(String, nullable=False)
    discarded: Mapped[bool] = mapped_column(default=False)
    data: Mapped[str] = mapped_column(String, nullable=False)  # JSON string