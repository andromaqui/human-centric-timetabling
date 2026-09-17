from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum
from typing import Literal
from pydantic import BaseModel


class WorkingSessionMoveIn(BaseModel):
    session_id: str
    new_start: datetime
    new_end: datetime
    new_room_id: str | None = None


class WorkingDayRequestIn(BaseModel):
    day: str
    moves: list[WorkingSessionMoveIn] = Field(default_factory=list)

    
class TemporaryConstraintDeactivation(BaseModel):
    constraint_id: str

    instance_type: Literal[
        "lecturer",
        "cohort",
        "session",
        "room",
    ]

    instance_id: str

    day: str | None = None


class ChangeMode(str, Enum):
    KEEP = "keep"
    SPECIFIC = "specific"
    FIND = "find"


class RescheduleRequestIn(BaseModel):
    session_id: str

    time_mode: ChangeMode
    requested_start: str | None = None

    room_mode: ChangeMode
    requested_room_id: str | None = None

    lecturer_mode: ChangeMode
    requested_lecturer_id: str | None = None

    temporarily_deactivated_constraints: list[
        TemporaryConstraintDeactivation
    ] = Field(default_factory=list)

    max_additional_changes: int | None = None


# TODO: 1 START Add these (reuse pattern from InstanceOut, but scoped so the frontend can group by lecturer/cohort):
class SessionConstraintOut(BaseModel):
    id: str
    session_id: str
    constraint_id: str
    is_activated: bool

    class Config:
        from_attributes = True


class LecturerConstraintOut(BaseModel):
    id: str
    lecturer_id: str
    constraint_id: str
    day: str | None = None
    is_activated: bool

    class Config:
        from_attributes = True


class CohortConstraintOut(BaseModel):
    id: str
    cohort_id: str
    constraint_id: str
    day: str | None = None
    is_activated: bool

    class Config:
        from_attributes = True


class LecturerOut(BaseModel):
    id: str
    name: str

    class Config:
        from_attributes = True


class LecturerUnavailabilityOut(BaseModel):
    id: int
    day: str
    hour: int

    class Config:
        from_attributes = True


class CohortOut(BaseModel):
    id: str
    name: str
    program_id: str

    class Config:
        from_attributes = True
# TODO: 2


class ConstraintOut(BaseModel):
    id: str
    name: str
    description: str
    stakeholder: str
    type: str

    class Config:
        from_attributes = True


class ModuleOut(BaseModel):
    id: str
    code: str
    title: str
    required_capacity: int | None = None
    required_equipment: str | None = None

    class Config:
        from_attributes = True


class EquipmentRelaxationDetails(BaseModel):
    waived_equipment: list[str]


class CapacityRelaxationDetails(BaseModel):
    reduced_capacity: int


class MaxHoursRelaxationDetails(BaseModel):
    max_hours: int


# TODO: WHAT DOES THIS DO?
class LunchBreakRelaxationDetails(BaseModel):
    lunch_hour: int  # e.g. shift lunch from 12 to 13


class UnavailabilityRelaxationDetails(BaseModel):
    overridden_slots: list[dict]  # e.g. [{"day": "fri", "hour": 9}]


RELAXATION_DETAIL_SCHEMAS: dict[str, type[BaseModel]] = {
    "class-equipment": EquipmentRelaxationDetails,
    "class-capacity": CapacityRelaxationDetails,
    "cohort-max-teaching-hours-per-day": MaxHoursRelaxationDetails,
    "lecturer-max-one-hour-per-day": MaxHoursRelaxationDetails,
    "lecturer-lunch-break": LunchBreakRelaxationDetails,
    "lecturer-unavailability": UnavailabilityRelaxationDetails,
}


INSTANCE_TYPES = {"session", "lecturer", "cohort", "room"}


class RoomOut(BaseModel):
    id: str
    name: str
    capacity: int | None = None
    equipment: str | None = None

    class Config:
        from_attributes = True


class RoomConstraintOut(BaseModel):
    id: str
    room_id: str
    constraint_id: str
    is_activated: bool

    class Config:
        from_attributes = True


class RelaxationCreate(BaseModel):
    instance_type: str
    instance_id: str
    relaxation_type: str  # "disable" | "adjust"
    details: dict | None = None
    reason: str


class RelaxationOut(BaseModel):
    id: str
    instance_type: str
    instance_id: str
    relaxation_type: str
    details: dict | None = None
    reason: str
    created_at: datetime

    class Config:
        from_attributes = True


class InstanceOut(BaseModel):
    id: str
    constraint_id: str
    is_activated: bool

    class Config:
        from_attributes = True


class SessionOut(BaseModel):
    id: str
    module_id: str
    lecturer_id: str
    room_id: str | None = None
    room_name: str | None = None
    type: str
    start: datetime
    end: datetime
    program_ids: list[str] = Field(default_factory=list)
    cohort_ids: list[str] = Field(default_factory=list)

    class Config:
        from_attributes = True


class WorkingDayOut(BaseModel):
    sessions: list[SessionOut]
    violations: list[dict]


class ProgramOut(BaseModel):
    id: str
    code: str
    name: str

    class Config:
        from_attributes = True

class CandidateSolutionCreate(BaseModel):
    id: str
    name: str | None = None
    status: str = "saved"

    request_id: str
    request_created_at: datetime

    requested_session_id: str
    requested_module_id: str | None = None
    request_type: str

    request: dict

    additional_changes: list[dict] = Field(default_factory=list)
    affected_stakeholders: list[dict] = Field(default_factory=list)
    stakeholder_impacts: list[dict] = Field(default_factory=list)

    objectives: list[dict] | None = None
    constraints: list[dict] = Field(default_factory=list)
    resulting_timetable: list[dict] = Field(default_factory=list)

    solve_settings: dict | None = None
    solver_metadata: dict | None = None


class AllowedRelaxationIn(BaseModel):
    constraint_id: str
    instance_type: str
    instance_id: str
    day: str | None = None


class MixedRecoveryRequestIn(BaseModel):
    request: RescheduleRequestIn
    max_perturbations: int
    allowed_relaxations: list[AllowedRelaxationIn] = Field(default_factory=list)
