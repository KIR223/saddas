import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

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
