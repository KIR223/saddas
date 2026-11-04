-- Baseline as-is: схема, которая раньше жила в db.SCHEMA и выполнялась при каждом коннекте.
-- Не дополнять этот файл. Новые таблицы и колонки — отдельный sql с следующим номером.

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
