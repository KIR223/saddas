import json
import re
from datetime import date

from fastapi import HTTPException
from fastapi.responses import JSONResponse

from app.catalog import canonicalize_lesson_teacher, canonicalize_room
from app.db import get_meta, get_regular_bells, get_short_bells, list_groups, resolve_day
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


def snapshot_revision(meta: dict[str, str] | None = None) -> str | None:
    data = meta if meta is not None else get_meta()
    return data.get("revision") or data.get("uploaded_at")


def day_names(on: date) -> tuple[str, str]:
    return DAY_ORDER[on.weekday()], current_week(on)


def _bells_for_date(on: date) -> dict[int, dict]:
    from app.bell_config import for_date
    return {item['pair']:item for item in for_date(on)['pairs']}


def _pair_fields(row) -> dict:
    return {
        "pair": row["pair"],
        "subject": row["subject"],
        "teacher": canonicalize_lesson_teacher(row["teacher"]),
        "room": canonicalize_room(row["room"]),
    }


def day_payload(group: str, on: date) -> dict:
    day_name, week = day_names(on)
    pairs, custom = resolve_day(group, day_name, week, on.isoformat())
    slots = _bells_for_date(on)
    timed = []
    for item in pairs:
        slot = slots.get(item["pair"])
        timed.append(
            {
                **item,
                "start": slot["start"] if slot else None,
                "end": slot["end"] if slot else None,
            }
        )
    return {
        "group": group,
        "date": on.isoformat(),
        "day": day_name,
        "week": week,
        "custom": custom,
        "pairs": timed,
        "revision": snapshot_revision(),
    }


def schedule_payload(group: str, week: str, rows) -> dict:
    by_day: dict[str, list[dict]] = {}
    from app.bell_config import configuration
    cfg = configuration()
    for row in rows:
        kind = 'monThu' if row['day'] == DAY_ORDER[0] else 'thursday' if row['day'] == DAY_ORDER[3] else 'regular'
        slot = next((s for s in cfg[kind] if s['pair']==row['pair']), {})
        by_day.setdefault(row["day"], []).append({**_pair_fields(row), 'start':slot.get('start'), 'end':slot.get('end')})
    days = []
    seen = set()
    for day in DAY_ORDER:
        if day in by_day:
            days.append({"day": day, "pairs": by_day[day]})
            seen.add(day)
    for day, pairs in by_day.items():
        if day not in seen:
            days.append({"day": day, "pairs": pairs})
    return {
        "group": group,
        "week": week,
        "days": days,
        "revision": snapshot_revision(),
    }
