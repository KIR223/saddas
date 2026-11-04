"""Применить миграции SQLite.

Пустая база и уже существующий schedule.db поднимаются одной командой.
Повторный запуск ничего не ломает.

Из каталога backend:

    python -m app.migrate

В контейнере:

    docker compose exec backend python -m app.migrate
"""

from app.db import connect, db_path
from app.migrations import apply_migrations, list_applied


def main() -> None:
    conn = connect(migrate=False)
    try:
        applied_now = apply_migrations(conn)
        rows = list_applied(conn)
    finally:
        conn.close()
    latest = rows[-1][0] if rows else 0
    if applied_now:
        print(f"{db_path()}: применены {applied_now}, текущая версия {latest}")
        return
    print(f"{db_path()}: уже на версии {latest}, новых миграций нет")


if __name__ == "__main__":
    main()
