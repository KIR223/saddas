from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

MOSCOW = ZoneInfo("Europe/Moscow")


def now_moscow() -> datetime:
    return datetime.now(MOSCOW)


def moscow_today() -> date:
    return now_moscow().date()


def week_bounds(day: date) -> tuple[date, date]:
    monday = day - timedelta(days=day.weekday())
    return monday, monday + timedelta(days=6)


def current_week(day: date | None = None) -> str:
    if day is None:
        day = moscow_today()
    # Нечётная ISO-неделя — зелёная, чётная — красная.
    if day.isocalendar().week % 2 == 1:
        return "green"
    return "red"


def resolve_week(value: str, day: date | None = None) -> str:
    if value == "current":
        return current_week(day)
    if value in ("green", "red"):
        return value
    raise ValueError(value)
