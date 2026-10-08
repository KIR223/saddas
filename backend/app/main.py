import json
import os
import re
import secrets
import zipfile
from contextlib import asynccontextmanager
from datetime import date
from io import BytesIO
from pathlib import Path

from fastapi import FastAPI, File, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from openpyxl.utils.exceptions import InvalidFileException
from pydantic import BaseModel, Field

from app.db import (
    delete_day_overrides,
    delete_pair_override,
    delete_short_bells,
    get_meta,
    get_regular_bells,
    get_schedule,
    get_short_bells,
    init_db,
    list_groups,
    list_rooms,
    list_teachers,
    replace_day_overrides,
    replace_regular_bells,
    replace_schedule,
    replace_short_bells,
    resolve_day,
    template_pairs,
    upsert_pair_override,
)
from app.parser import DAY_ORDER, parse_workbook
from app.week import current_week, resolve_week, week_bounds

TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def load_dotenv(path: str = ".env") -> None:
    env_path = os.environ.get("ENV_FILE", path)
    if not os.path.exists(env_path):
        return
    with open(env_path, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_dotenv()


class UTF8JSONResponse(JSONResponse):
    def render(self, content) -> bytes:
        return json.dumps(content, ensure_ascii=False).encode("utf-8")


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


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Расписание колледжа",
    description="Загрузка Excel-расписания и выдача занятий по группе.",
    version="1.0.0",
    default_response_class=UTF8JSONResponse,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def tokens_match(got: str | None) -> bool:
    expected = os.environ.get("ADMIN_TOKEN", "dev")
    if not got or not expected:
        return False
    return secrets.compare_digest(got, expected)


def require_admin(token: str | None) -> None:
    if not tokens_match(token):
        raise HTTPException(status_code=401, detail="неверный токен")


def parse_iso_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(status_code=400, detail="дата в формате YYYY-MM-DD")


def require_group(group: str) -> str:
    group = group.strip()
    if group not in list_groups():
        raise HTTPException(status_code=404, detail="группа не найдена")
    return group


def require_pair(pair: int) -> int:
    if not 1 <= pair <= 12:
        raise HTTPException(status_code=400, detail="пара должна быть от 1 до 12")
    return pair


def clock_minutes(value: str) -> int:
    hours, minutes = value.split(":")
    return int(hours) * 60 + int(minutes)


def parse_bell_slots(slots: list[BellSlotIn]) -> list[tuple[int, str, str]]:
    parsed: list[tuple[int, str, str, int, int]] = []
    seen: set[int] = set()
    for slot in slots:
        require_pair(slot.pair)
        if slot.pair in seen:
            raise HTTPException(status_code=400, detail="номера пар не должны повторяться")
        if not TIME_RE.fullmatch(slot.start) or not TIME_RE.fullmatch(slot.end):
            raise HTTPException(status_code=400, detail="время в формате HH:MM")
        start = clock_minutes(slot.start)
        end = clock_minutes(slot.end)
        if end <= start:
            raise HTTPException(
                status_code=400,
                detail=f"пара {slot.pair}: конец должен быть позже начала",
            )
        seen.add(slot.pair)
        parsed.append((slot.pair, slot.start, slot.end, start, end))
    ordered = sorted(parsed, key=lambda item: item[3])
    for prev, nxt in zip(ordered, ordered[1:]):
        if nxt[3] < prev[4]:
            raise HTTPException(
                status_code=400,
                detail=f"пары {prev[0]} и {nxt[0]} пересекаются",
            )
    return [(pair, start, end) for pair, start, end, _, _ in sorted(parsed, key=lambda item: item[0])]


def bells_payload(kind: str, pairs: list[dict], on_date: str | None = None) -> dict:
    return {"kind": kind, "date": on_date, "pairs": pairs}


def day_names(on: date) -> tuple[str, str]:
    return DAY_ORDER[on.weekday()], current_week(on)


def day_payload(group: str, on: date) -> dict:
    day_name, week = day_names(on)
    pairs, custom = resolve_day(group, day_name, week, on.isoformat())
    return {
        "group": group,
        "date": on.isoformat(),
        "day": day_name,
        "week": week,
        "custom": custom,
        "pairs": pairs,
    }


def schedule_payload(group: str, week: str, rows) -> dict:
    by_day: dict[str, list[dict]] = {}
    for row in rows:
        by_day.setdefault(row["day"], []).append(
            {
                "pair": row["pair"],
                "subject": row["subject"],
                "teacher": row["teacher"],
                "room": row["room"],
            }
        )
    days = []
    seen = set()
    for day in DAY_ORDER:
        if day in by_day:
            days.append({"day": day, "pairs": by_day[day]})
            seen.add(day)
    for day, pairs in by_day.items():
        if day not in seen:
            days.append({"day": day, "pairs": pairs})
    return {"group": group, "week": week, "days": days}


@app.get("/api/info", response_model=InfoOut)
def info():
    today = date.today()
    start, end = week_bounds(today)
    meta = get_meta()
    return {
        "week": current_week(today),
        "week_start": start.isoformat(),
        "week_end": end.isoformat(),
        "title": meta.get("title", ""),
        "uploaded_at": meta.get("uploaded_at"),
    }


@app.get("/api/groups", response_model=GroupsOut)
def groups():
    return {"groups": list_groups()}


@app.get("/api/schedule", response_model=ScheduleOut)
def schedule(
    group: str = Query(..., description="Код группы, например ТМ-261"),
    week: str = Query("current", description="current, green или red"),
):
    group = group.strip()
    try:
        resolved = resolve_week(week)
    except ValueError:
        raise HTTPException(status_code=400, detail="week должен быть current, green или red")
    if group not in list_groups():
        raise HTTPException(status_code=404, detail="группа не найдена")
    return schedule_payload(group, resolved, get_schedule(group, resolved))


@app.post("/api/admin/upload", response_model=UploadOut)
async def upload(
    file: UploadFile = File(..., description="Файл расписания .xlsx"),
    x_admin_token: str | None = Header(default=None, description="Токен администратора"),
):
    if not tokens_match(x_admin_token):
        raise HTTPException(status_code=401, detail="неверный токен")
    filename = Path(file.filename or "").name
    if not filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="нужен файл .xlsx")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="файл пустой")
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="файл больше 20 МБ")
    try:
        result = parse_workbook(BytesIO(data))
    except (InvalidFileException, zipfile.BadZipFile, OSError):
        raise HTTPException(status_code=400, detail="не удалось прочитать xlsx")
    if not result.lessons:
        raise HTTPException(
            status_code=400,
            detail={"message": "в файле нет занятий", "warnings": result.warnings},
        )
    replace_schedule(result.lessons, filename, result.title)
    group_count = len({item.group_name for item in result.lessons})
    return {
        "groups": group_count,
        "lessons": len(result.lessons),
        "rooms": len(list_rooms()),
        "teachers": len(list_teachers()),
        "warnings": result.warnings,
    }


@app.get("/api/rooms", response_model=RoomsOut)
def rooms():
    return {"rooms": list_rooms()}


@app.get("/api/teachers", response_model=TeachersOut)
def teachers():
    return {"teachers": list_teachers()}


@app.get("/api/bells", response_model=BellsOut)
def bells(date_value: str | None = Query(default=None, alias="date", description="YYYY-MM-DD")):
    if date_value is None:
        return bells_payload("regular", get_regular_bells())
    on = parse_iso_date(date_value)
    short = get_short_bells(on.isoformat())
    if short is None:
        return bells_payload("regular", get_regular_bells(), on.isoformat())
    return bells_payload("short", short, on.isoformat())


@app.put("/api/admin/bells", response_model=BellsOut)
def save_regular_bells(
    body: BellsIn,
    x_admin_token: str | None = Header(default=None, description="Токен администратора"),
):
    require_admin(x_admin_token)
    slots = parse_bell_slots(body.pairs)
    replace_regular_bells(slots)
    return bells_payload("regular", get_regular_bells())


@app.put("/api/admin/bells/{on_date}", response_model=BellsOut)
def save_short_bells(
    on_date: str,
    body: BellsIn,
    x_admin_token: str | None = Header(default=None, description="Токен администратора"),
):
    require_admin(x_admin_token)
    on = parse_iso_date(on_date)
    slots = parse_bell_slots(body.pairs)
    replace_short_bells(on.isoformat(), slots)
    return bells_payload("short", get_short_bells(on.isoformat()) or [], on.isoformat())


@app.delete("/api/admin/bells/{on_date}", status_code=204)
def remove_short_bells(
    on_date: str,
    x_admin_token: str | None = Header(default=None, description="Токен администратора"),
):
    require_admin(x_admin_token)
    on = parse_iso_date(on_date)
    delete_short_bells(on.isoformat())


@app.get("/api/schedule/day", response_model=DayScheduleOut)
def schedule_day(
    group: str = Query(..., description="Код группы, например ТМ-261"),
    date_value: str = Query(..., alias="date", description="YYYY-MM-DD"),
):
    group = require_group(group)
    on = parse_iso_date(date_value)
    return day_payload(group, on)


@app.put("/api/admin/schedule/{on_date}/pairs/{pair}", response_model=DayScheduleOut)
def save_pair_override(
    on_date: str,
    pair: int,
    body: PairOverrideIn,
    group: str = Query(..., description="Код группы, например ТМ-261"),
    x_admin_token: str | None = Header(default=None, description="Токен администратора"),
):
    require_admin(x_admin_token)
    group = require_group(group)
    on = parse_iso_date(on_date)
    pair = require_pair(pair)
    if body.cancelled:
        upsert_pair_override(group, on.isoformat(), pair, True, "", "", "")
    else:
        subject = body.subject.strip()
        if not subject:
            raise HTTPException(status_code=400, detail="нужен предмет")
        upsert_pair_override(
            group,
            on.isoformat(),
            pair,
            False,
            subject,
            body.teacher.strip(),
            body.room.strip(),
        )
    return day_payload(group, on)


@app.delete("/api/admin/schedule/{on_date}/pairs/{pair}", status_code=204)
def remove_pair_override(
    on_date: str,
    pair: int,
    group: str = Query(..., description="Код группы, например ТМ-261"),
    x_admin_token: str | None = Header(default=None, description="Токен администратора"),
):
    require_admin(x_admin_token)
    group = require_group(group)
    on = parse_iso_date(on_date)
    pair = require_pair(pair)
    delete_pair_override(group, on.isoformat(), pair)


@app.put("/api/admin/schedule/{on_date}", response_model=DayScheduleOut)
def save_day_override(
    on_date: str,
    body: DayScheduleIn,
    group: str = Query(..., description="Код группы, например ТМ-261"),
    x_admin_token: str | None = Header(default=None, description="Токен администратора"),
):
    require_admin(x_admin_token)
    group = require_group(group)
    on = parse_iso_date(on_date)
    seen: set[int] = set()
    pairs: list[dict] = []
    for item in body.pairs:
        require_pair(item.pair)
        if item.pair in seen:
            raise HTTPException(status_code=400, detail="номера пар не должны повторяться")
        subject = item.subject.strip()
        if not subject:
            raise HTTPException(status_code=400, detail="нужен предмет")
        seen.add(item.pair)
        pairs.append(
            {
                "pair": item.pair,
                "subject": subject,
                "teacher": item.teacher.strip(),
                "room": item.room.strip(),
            }
        )
    day_name, week = day_names(on)
    replace_day_overrides(group, on.isoformat(), pairs, template_pairs(group, day_name, week))
    return day_payload(group, on)


@app.delete("/api/admin/schedule/{on_date}", status_code=204)
def remove_day_override(
    on_date: str,
    group: str = Query(..., description="Код группы, например ТМ-261"),
    x_admin_token: str | None = Header(default=None, description="Токен администратора"),
):
    require_admin(x_admin_token)
    group = require_group(group)
    on = parse_iso_date(on_date)
    delete_day_overrides(group, on.isoformat())
