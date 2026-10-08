import json
import os
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
from pydantic import BaseModel

from app.db import get_meta, get_schedule, init_db, list_groups, replace_schedule
from app.parser import DAY_ORDER, parse_workbook
from app.week import current_week, resolve_week, week_bounds


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
    warnings: list[str]


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
        "warnings": result.warnings,
    }
