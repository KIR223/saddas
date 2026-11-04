from pydantic import BaseModel, Field


class InfoOut(BaseModel):
    week: str
    week_start: str
    week_end: str
    title: str
    uploaded_at: str | None


class GroupsOut(BaseModel):
    groups: list[str]


class PairOut(BaseModel):
    pair: int
    subject: str
    teacher: str
    room: str


class DayOut(BaseModel):
    day: str
    pairs: list[PairOut]


class ScheduleOut(BaseModel):
    group: str
    week: str
    days: list[DayOut]


class UploadOut(BaseModel):
    groups: int
    lessons: int
    rooms: int
    teachers: int
    warnings: list[str]


class RoomsOut(BaseModel):
    rooms: list[str]


class TeachersOut(BaseModel):
    teachers: list[str]


class BellSlotIn(BaseModel):
    pair: int
    start: str
    end: str


class BellSlotOut(BaseModel):
    pair: int
    start: str
    end: str


class BellsIn(BaseModel):
    pairs: list[BellSlotIn]


class BellsOut(BaseModel):
    kind: str
    date: str | None = None
    pairs: list[BellSlotOut]


class PairOverrideIn(BaseModel):
    subject: str = ""
    teacher: str = ""
    room: str = ""
    cancelled: bool = False


class DayPairIn(BaseModel):
    pair: int
    subject: str
    teacher: str = ""
    room: str = ""


class DayScheduleIn(BaseModel):
    pairs: list[DayPairIn] = Field(default_factory=list)


class DayScheduleOut(BaseModel):
    group: str
    date: str
    day: str
    week: str
    custom: bool
    pairs: list[PairOut]
