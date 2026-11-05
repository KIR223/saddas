from pydantic import BaseModel, Field


class InfoOut(BaseModel):
    week: str
    week_start: str
    week_end: str
    title: str
    uploaded_at: str | None
    revision: str | None


class GroupsOut(BaseModel):
    groups: list[str]


class PairOut(BaseModel):
    replaced: bool = False
    original: dict | None = None
    pair: int
    subject: str
    teacher: str
    room: str
    start: str | None = None
    end: str | None = None


class DayOut(BaseModel):
    day: str
    pairs: list[PairOut]


class ScheduleOut(BaseModel):
    group: str
    week: str
    days: list[DayOut]
    revision: str | None = None


class UploadOut(BaseModel):
    groups: int
    lessons: int
    rooms: int
    teachers: int
    warnings: list[str]
    diff: dict = Field(default_factory=dict)


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
    curator: dict | None = None
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
    revision: str | None = None
