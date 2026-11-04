import zipfile
from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from openpyxl.utils.exceptions import InvalidFileException

from app.db import (
    delete_day_overrides,
    delete_pair_override,
    delete_short_bells,
    get_regular_bells,
    get_short_bells,
    list_rooms,
    list_teachers,
    replace_day_overrides,
    replace_regular_bells,
    replace_schedule,
    replace_short_bells,
    template_pairs,
    upsert_pair_override,
)
from app.http import (
    bells_payload,
    day_names,
    day_payload,
    parse_bell_slots,
    parse_iso_date,
    require_group,
    require_pair,
)
from app.parser import parse_workbook
from app.schemas import BellsIn, BellsOut, DayScheduleIn, DayScheduleOut, PairOverrideIn, UploadOut
from app.security import require_admin

router = APIRouter(tags=["admin"], dependencies=[Depends(require_admin)])


@router.post("/api/admin/upload", response_model=UploadOut)
async def upload(
    file: UploadFile = File(..., description="Файл расписания .xlsx"),
):
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


@router.put("/api/admin/bells", response_model=BellsOut)
def save_regular_bells(body: BellsIn):
    slots = parse_bell_slots(body.pairs)
    replace_regular_bells(slots)
    return bells_payload("regular", get_regular_bells())


@router.put("/api/admin/bells/{on_date}", response_model=BellsOut)
def save_short_bells(on_date: str, body: BellsIn):
    on = parse_iso_date(on_date)
    slots = parse_bell_slots(body.pairs)
    replace_short_bells(on.isoformat(), slots)
    return bells_payload("short", get_short_bells(on.isoformat()) or [], on.isoformat())


@router.delete("/api/admin/bells/{on_date}", status_code=204)
def remove_short_bells(on_date: str):
    on = parse_iso_date(on_date)
    delete_short_bells(on.isoformat())


@router.put("/api/admin/schedule/{on_date}/pairs/{pair}", response_model=DayScheduleOut)
def save_pair_override(
    on_date: str,
    pair: int,
    body: PairOverrideIn,
    group: str = Query(..., description="Код группы, например ТМ-261"),
):
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


@router.delete("/api/admin/schedule/{on_date}/pairs/{pair}", status_code=204)
def remove_pair_override(
    on_date: str,
    pair: int,
    group: str = Query(..., description="Код группы, например ТМ-261"),
):
    group = require_group(group)
    on = parse_iso_date(on_date)
    pair = require_pair(pair)
    delete_pair_override(group, on.isoformat(), pair)


@router.put("/api/admin/schedule/{on_date}", response_model=DayScheduleOut)
def save_day_override(
    on_date: str,
    body: DayScheduleIn,
    group: str = Query(..., description="Код группы, например ТМ-261"),
):
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


@router.delete("/api/admin/schedule/{on_date}", status_code=204)
def remove_day_override(
    on_date: str,
    group: str = Query(..., description="Код группы, например ТМ-261"),
):
    group = require_group(group)
    on = parse_iso_date(on_date)
    delete_day_overrides(group, on.isoformat())
