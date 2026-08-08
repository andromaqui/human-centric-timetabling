from pydantic import BaseModel


class ProgramOut(BaseModel):
    id: str
    code: str
    name: str

    class Config:
        from_attributes = True


class ProgramCreate(BaseModel):
    id: str
    code: str
    name: str


class RoomOut(BaseModel):
    id: str
    name: str
    capacity: int | None = None
    equipment: str | None = None

    class Config:
        from_attributes = True


class RoomCreate(BaseModel):
    id: str
    name: str
    capacity: int | None = None
    equipment: str | None = None


class CohortOut(BaseModel):
    id: str
    name: str
    program_id: str

    class Config:
        from_attributes = True


class CohortCreate(BaseModel):
    id: str
    name: str
    program_id: str


class LecturerOut(BaseModel):
    id: str
    name: str

    class Config:
        from_attributes = True


class LecturerCreate(BaseModel):
    id: str
    name: str


class ModuleOut(BaseModel):
    id: str
    code: str
    title: str
    required_capacity: int | None = None
    required_equipment: str | None = None

    class Config:
        from_attributes = True


class ModuleCreate(BaseModel):
    id: str
    code: str
    title: str
    required_capacity: int | None = None
    required_equipment: str | None = None


class SessionOut(BaseModel):
    id: str
    module_id: str
    lecturer_id: str
    room_id: str | None = None
    type: str
    start: str
    end: str

    class Config:
        from_attributes = True


class SessionCreate(BaseModel):
    id: str
    module_id: str
    lecturer_id: str
    room_id: str | None = None
    type: str
    start: str
    end: str


class ConstraintOut(BaseModel):
    id: str
    name: str
    description: str
    stakeholder: str
    type: str

    class Config:
        from_attributes = True