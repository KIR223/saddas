from fastapi import APIRouter, HTTPException, Query

from app.db import get_schedule, list_groups
from app.http import day_payload, parse_iso_date, require_group, schedule_payload
from app.schemas import DayScheduleOut, ScheduleOut
from app.week import resolve_week

router = APIRouter(tags=["schedule"])


@router.get("/api/schedule", response_model=ScheduleOut, response_model_exclude_none=True)
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


@router.get("/api/schedule/day", response_model=DayScheduleOut)
def schedule_day(
    group: str = Query(..., description="Код группы, например ТМ-261"),
    date_value: str = Query(..., alias="date", description="YYYY-MM-DD"),
):
    group = require_group(group)
    on = parse_iso_date(date_value)
    return day_payload(group, on)
