from pydantic import BaseModel, Field
from datetime import datetime

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


class ProgramOut(BaseModel):
    id: str
    code: str
    name: str

    class Config:
        from_attributes = True