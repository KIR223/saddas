import json
import re
from datetime import date

from fastapi import HTTPException
from fastapi.responses import JSONResponse

from app.db import list_groups, resolve_day
from app.parser import DAY_ORDER
from app.schemas import BellSlotIn
from app.week import current_week

TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


class UTF8JSONResponse(JSONResponse):
    def render(self, content) -> bytes:
        return json.dumps(content, ensure_ascii=False).encode("utf-8")


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
