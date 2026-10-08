import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from app.catalog import room_names, teacher_names

SCHEMA = """
CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY,
    group_name TEXT NOT NULL,
    day TEXT NOT NULL,
    pair INTEGER NOT NULL,
    week TEXT NOT NULL,
    subject TEXT NOT NULL,
    teacher TEXT NOT NULL DEFAULT '',
    room TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_lessons_group_week ON lessons(group_name, week);

CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
    name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS teachers (
    name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS bell_regular (
    pair INTEGER PRIMARY KEY,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bell_short_dates (
    on_date TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS bell_short_days (
    on_date TEXT NOT NULL,
    pair INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    PRIMARY KEY (on_date, pair)
);

CREATE TABLE IF NOT EXISTS lesson_overrides (
    on_date TEXT NOT NULL,
    group_name TEXT NOT NULL,
    pair INTEGER NOT NULL,
    cancelled INTEGER NOT NULL DEFAULT 0,
    subject TEXT NOT NULL DEFAULT '',
    teacher TEXT NOT NULL DEFAULT '',
    room TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (on_date, group_name, pair)
);
"""


def db_path() -> str:
    return os.environ.get("DATABASE_PATH", "data/schedule.db")


def connect() -> sqlite3.Connection:
    path = db_path()
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


@contextmanager
def get_conn():
    conn = connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with get_conn():
        pass


def replace_schedule(lessons, filename: str, title: str) -> None:
    uploaded_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    rooms = room_names(item.room for item in lessons)
    teachers = teacher_names(item.teacher for item in lessons)
    with get_conn() as conn:
        conn.execute("DELETE FROM lessons")
        conn.executemany(
            """
            INSERT INTO lessons (group_name, day, pair, week, subject, teacher, room)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (item.group_name, item.day, item.pair, item.week, item.subject, item.teacher, item.room)
                for item in lessons
            ],
        )
        conn.execute("DELETE FROM rooms")
        conn.execute("DELETE FROM teachers")
        conn.executemany("INSERT INTO rooms(name) VALUES(?)", [(name,) for name in rooms])
        conn.executemany("INSERT INTO teachers(name) VALUES(?)", [(name,) for name in teachers])
        for key, value in (
            ("filename", filename),
            ("uploaded_at", uploaded_at),
            ("title", title),
        ):
            conn.execute(
                """
                INSERT INTO meta(key, value) VALUES(?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """,
                (key, value),
            )


def list_groups() -> list[str]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT DISTINCT group_name FROM lessons ORDER BY group_name"
        ).fetchall()
    return [row["group_name"] for row in rows]


def get_schedule(group_name: str, week: str) -> list[sqlite3.Row]:
    with get_conn() as conn:
        return conn.execute(
            """
            SELECT day, pair, subject, teacher, room
            FROM lessons
            WHERE group_name = ? AND week = ?
            ORDER BY pair, id
            """,
            (group_name, week),
        ).fetchall()


def get_meta() -> dict[str, str]:
    with get_conn() as conn:
        rows = conn.execute("SELECT key, value FROM meta").fetchall()
    return {row["key"]: row["value"] for row in rows}


def list_rooms() -> list[str]:
    with get_conn() as conn:
        rows = conn.execute("SELECT name FROM rooms").fetchall()
    return sorted((row["name"] for row in rows), key=str.casefold)


def list_teachers() -> list[str]:
    with get_conn() as conn:
        rows = conn.execute("SELECT name FROM teachers").fetchall()
    return sorted((row["name"] for row in rows), key=str.casefold)


def _bell_pairs(rows) -> list[dict]:
    return [
        {"pair": row["pair"], "start": row["start_time"], "end": row["end_time"]}
        for row in rows
    ]


def get_regular_bells() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT pair, start_time, end_time FROM bell_regular ORDER BY pair"
        ).fetchall()
    return _bell_pairs(rows)


def replace_regular_bells(slots: list[tuple[int, str, str]]) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM bell_regular")
        conn.executemany(
            "INSERT INTO bell_regular(pair, start_time, end_time) VALUES(?, ?, ?)",
            slots,
        )


def get_short_bells(on_date: str) -> list[dict] | None:
    with get_conn() as conn:
        marked = conn.execute(
            "SELECT 1 FROM bell_short_dates WHERE on_date = ?",
            (on_date,),
        ).fetchone()
        if marked is None:
            return None
        rows = conn.execute(
            """
            SELECT pair, start_time, end_time
            FROM bell_short_days
            WHERE on_date = ?
            ORDER BY pair
            """,
            (on_date,),
        ).fetchall()
    return _bell_pairs(rows)


def replace_short_bells(on_date: str, slots: list[tuple[int, str, str]]) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO bell_short_dates(on_date) VALUES(?) ON CONFLICT(on_date) DO NOTHING",
            (on_date,),
        )
        conn.execute("DELETE FROM bell_short_days WHERE on_date = ?", (on_date,))
        conn.executemany(
            """
            INSERT INTO bell_short_days(on_date, pair, start_time, end_time)
            VALUES(?, ?, ?, ?)
            """,
            [(on_date, pair, start, end) for pair, start, end in slots],
        )


def delete_short_bells(on_date: str) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM bell_short_days WHERE on_date = ?", (on_date,))
        conn.execute("DELETE FROM bell_short_dates WHERE on_date = ?", (on_date,))


def resolve_day(group_name: str, day: str, week: str, on_date: str) -> tuple[list[dict], bool]:
    with get_conn() as conn:
        template = conn.execute(
            """
            SELECT pair, subject, teacher, room
            FROM lessons
            WHERE group_name = ? AND day = ? AND week = ?
            ORDER BY pair, id
            """,
            (group_name, day, week),
        ).fetchall()
        overrides = conn.execute(
            """
            SELECT pair, cancelled, subject, teacher, room
            FROM lesson_overrides
            WHERE group_name = ? AND on_date = ?
            ORDER BY pair
            """,
            (group_name, on_date),
        ).fetchall()
    by_pair = {row["pair"]: row for row in overrides}
    pairs: list[dict] = []
    applied: set[int] = set()
    for row in template:
        pair = row["pair"]
        if pair in by_pair:
            if pair in applied:
                continue
            applied.add(pair)
            change = by_pair[pair]
            if change["cancelled"]:
                continue
            pairs.append(_pair_dict(change))
            continue
        pairs.append(_pair_dict(row))
    for pair, change in by_pair.items():
        if pair in applied or change["cancelled"]:
            continue
        pairs.append(_pair_dict(change))
    pairs.sort(key=lambda item: item["pair"])
    return pairs, bool(overrides)


def template_pairs(group_name: str, day: str, week: str) -> list[int]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT DISTINCT pair
            FROM lessons
            WHERE group_name = ? AND day = ? AND week = ?
            """,
            (group_name, day, week),
        ).fetchall()
    return [row["pair"] for row in rows]


def upsert_pair_override(
    group_name: str,
    on_date: str,
    pair: int,
    cancelled: bool,
    subject: str,
    teacher: str,
    room: str,
) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO lesson_overrides(on_date, group_name, pair, cancelled, subject, teacher, room)
            VALUES(?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(on_date, group_name, pair) DO UPDATE SET
                cancelled = excluded.cancelled,
                subject = excluded.subject,
                teacher = excluded.teacher,
                room = excluded.room
            """,
            (on_date, group_name, pair, int(cancelled), subject, teacher, room),
        )


def delete_pair_override(group_name: str, on_date: str, pair: int) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            DELETE FROM lesson_overrides
            WHERE group_name = ? AND on_date = ? AND pair = ?
            """,
            (group_name, on_date, pair),
        )


def replace_day_overrides(
    group_name: str,
    on_date: str,
    pairs: list[dict],
    template: list[int],
) -> None:
    requested = {item["pair"] for item in pairs}
    with get_conn() as conn:
        conn.execute(
            "DELETE FROM lesson_overrides WHERE group_name = ? AND on_date = ?",
            (group_name, on_date),
        )
        conn.executemany(
            """
            INSERT INTO lesson_overrides(on_date, group_name, pair, cancelled, subject, teacher, room)
            VALUES(?, ?, ?, 0, ?, ?, ?)
            """,
            [
                (on_date, group_name, item["pair"], item["subject"], item["teacher"], item["room"])
                for item in pairs
            ],
        )
        conn.executemany(
            """
            INSERT INTO lesson_overrides(on_date, group_name, pair, cancelled, subject, teacher, room)
            VALUES(?, ?, ?, 1, '', '', '')
            """,
            [(on_date, group_name, pair) for pair in template if pair not in requested],
        )


def delete_day_overrides(group_name: str, on_date: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "DELETE FROM lesson_overrides WHERE group_name = ? AND on_date = ?",
            (group_name, on_date),
        )


def _pair_dict(row) -> dict:
    return {
        "pair": row["pair"],
        "subject": row["subject"],
        "teacher": row["teacher"],
        "room": row["room"],
    }
