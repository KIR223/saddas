import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from app.db import connect, db_path, get_conn, init_db
from app.migrations import apply_migrations, current_version, list_applied
from app.migrations.runner import available_migrations

BACKEND_ROOT = Path(__file__).resolve().parents[1]

LEGACY_SCHEMA = """
CREATE TABLE lessons (
    id INTEGER PRIMARY KEY,
    group_name TEXT NOT NULL,
    day TEXT NOT NULL,
    pair INTEGER NOT NULL,
    week TEXT NOT NULL,
    subject TEXT NOT NULL,
    teacher TEXT NOT NULL DEFAULT '',
    room TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_lessons_group_week ON lessons(group_name, week);
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE rooms (name TEXT PRIMARY KEY);
CREATE TABLE teachers (name TEXT PRIMARY KEY);
CREATE TABLE bell_regular (
    pair INTEGER PRIMARY KEY,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL
);
CREATE TABLE bell_short_dates (on_date TEXT PRIMARY KEY);
CREATE TABLE bell_short_days (
    on_date TEXT NOT NULL,
    pair INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    PRIMARY KEY (on_date, pair)
);
CREATE TABLE lesson_overrides (
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

APP_TABLES = {
    "lessons",
    "meta",
    "rooms",
    "teachers",
    "bell_regular",
    "bell_short_dates",
    "bell_short_days",
    "lesson_overrides",
}


def table_names(conn) -> set[str]:
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
    ).fetchall()
    return {row[0] for row in rows}


class MigrationsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["DATABASE_PATH"] = os.path.join(self.tmp.name, "schedule.db")

    def tearDown(self):
        self.tmp.cleanup()

    def test_empty_database_reaches_baseline(self):
        init_db()
        conn = connect(migrate=False)
        try:
            self.assertTrue(APP_TABLES.issubset(table_names(conn)))
            self.assertEqual(current_version(conn), 1)
            self.assertEqual(list_applied(conn)[0][1], "001_initial.sql")
        finally:
            conn.close()

    def test_existing_schedule_db_is_stamped_and_keeps_rows(self):
        path = db_path()
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        raw = sqlite3.connect(path)
        try:
            raw.executescript(LEGACY_SCHEMA)
            raw.execute(
                """
                INSERT INTO lessons (group_name, day, pair, week, subject, teacher, room)
                VALUES ('ТМ-261', 'Понедельник', 1, 'green', 'Физика', 'Курницкая Т.С.', '307')
                """
            )
            raw.commit()
        finally:
            raw.close()

        first = apply_migrations(connect(migrate=False))
        self.assertEqual(first, [1])
        with get_conn() as conn:
            row = conn.execute("SELECT subject FROM lessons").fetchone()
            self.assertEqual(row["subject"], "Физика")
            self.assertEqual(current_version(conn), 1)
            self.assertIn("schema_migrations", table_names(conn))

        second = apply_migrations(connect(migrate=False))
        self.assertEqual(second, [])
        with get_conn() as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) AS n FROM lessons").fetchone()["n"], 1)
            self.assertEqual(current_version(conn), 1)

    def test_cli_is_idempotent(self):
        env = {**os.environ, "DATABASE_PATH": db_path()}
        first = subprocess.run(
            [sys.executable, "-m", "app.migrate"],
            cwd=BACKEND_ROOT,
            env=env,
            check=True,
            capture_output=True,
            text=True,
        )
        second = subprocess.run(
            [sys.executable, "-m", "app.migrate"],
            cwd=BACKEND_ROOT,
            env=env,
            check=True,
            capture_output=True,
            text=True,
        )
        self.assertIn("применены [1]", first.stdout)
        self.assertIn("уже на версии 1", second.stdout)
        self.assertEqual(second.returncode, 0)

    def test_versions_are_numbered_files(self):
        versions = available_migrations()
        self.assertEqual([item[0] for item in versions], [1])
        self.assertEqual(versions[0][1].name, "001_initial.sql")

    def test_db_module_does_not_embed_ddl(self):
        text = (BACKEND_ROOT / "app" / "db.py").read_text(encoding="utf-8")
        self.assertNotIn("CREATE TABLE", text)
        self.assertNotIn("SCHEMA", text)
