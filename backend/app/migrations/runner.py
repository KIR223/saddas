from datetime import datetime, timezone
from pathlib import Path

VERSIONS_DIR = Path(__file__).resolve().parent / "versions"

REGISTRY_SQL = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
);
"""


def available_migrations() -> list[tuple[int, Path]]:
    found: dict[int, Path] = {}
    for path in sorted(VERSIONS_DIR.glob("*.sql")):
        prefix = path.name.split("_", 1)[0]
        if not prefix.isdigit():
            raise ValueError(f"имя миграции должно начинаться с номера: {path.name}")
        version = int(prefix)
        if version in found:
            raise ValueError(f"дублируется версия {version}: {found[version].name} и {path.name}")
        found[version] = path
    return sorted(found.items())


def _ensure_registry(conn) -> None:
    conn.executescript(REGISTRY_SQL)


def list_applied(conn) -> list[tuple[int, str, str]]:
    _ensure_registry(conn)
    rows = conn.execute(
        "SELECT version, name, applied_at FROM schema_migrations ORDER BY version"
    ).fetchall()
    return [(int(row[0]), str(row[1]), str(row[2])) for row in rows]


def current_version(conn) -> int:
    applied = list_applied(conn)
    return applied[-1][0] if applied else 0


def apply_migrations(conn) -> list[int]:
    _ensure_registry(conn)
    applied = {version for version, _name, _at in list_applied(conn)}
    newly: list[int] = []
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    for version, path in available_migrations():
        if version in applied:
            continue
        conn.executescript(path.read_text(encoding="utf-8"))
        conn.execute(
            "INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)",
            (version, path.name, now),
        )
        conn.commit()
        newly.append(version)
    return newly
