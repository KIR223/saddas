# Карта проекта MelMK (saddas-main)

Дата разведки: 2026-10-08. Источник требований: `prompt melmk fix v2.pdf`.

## Структура корня

| Путь | Роль |
|------|------|
| `frontend/` | Публичный PWA (статика ES modules), основной UI |
| `frontend/admin/` | Клиентская админка (`/admin/`) |
| `backend/` | FastAPI + SQLite (импорт Excel, API расписания) |
| `docker-compose.yml` | nginx frontend + backend |
| `docs/` | FROZEN, карта, отчёты по шагам |

## Frontend — ключевые файлы

| Файл | Назначение |
|------|------------|
| `frontend/index.html` | Точка входа PWA |
| `frontend/js/app.js` | Store, роутинг вкладок, рендер |
| `frontend/js/api/client.js` | HTTP к API |
| `frontend/js/api/config.js` | `API_ORIGIN` (не менять URL без явной задачи) |
| `frontend/js/models/bells.js` | Звонки + **FROZEN** `getMelmkWeekType` |
| `frontend/js/models/schedule.js` | Нормализация / каталоги |
| `frontend/js/utils/theme.js` | Палитра `mk_theme` + режим `mk_mode` (`data-theme` / `data-mode`) |
| `frontend/js/views/now.js` | «Сейчас / Дальше» + бейдж недели |
| `frontend/js/views/export-sheet.js` | Скачать ICS/CSV/печать |
| `frontend/css/themes.css` | `--mk-theme-*` палитры |
| `frontend/js/utils/auth.js` | PBKDF2-сессия админки (клиент) |
| `frontend/js/views/now.js` | Экран «Сейчас» + бейдж недели |
| `frontend/js/views/day.js`, `week.js`, `month.js` | Режимы расписания |
| `frontend/js/views/bells.js` | Вкладка звонков |
| `frontend/css/melmk-ui.css` | UI + **FROZEN** `.week-badge` |
| `frontend/sw.js` | Service Worker |
| `frontend/admin/admin-app.js` | Админ-приложение |

## Backend

| Файл | Назначение |
|------|------------|
| `backend/app/main.py` | API routes |
| `backend/app/db.py` | SQLite `lessons` + `meta` (`DATABASE_PATH`) |
| `backend/app/week.py` | **FROZEN** тип недели |
| `backend/app/parser.py` | Парсер Excel расписания |
| `backend/tests/` | pytest |

## Стек (факт)

- Frontend: vanilla JS (ES modules), CSS, PWA, без React/Vue
- Backend: FastAPI, SQLite
- Деплой: Docker + nginx; прод API: `https://api.melmksch.fvds.ru`

## БД

- Локально: `DATABASE_PATH` → по умолчанию `data/schedule.db` (создаётся при запуске backend)
- На проде данные живут на сервере API — **подключения и URL в `config.js` / `.env` не менять**
- Миграции: схема в `db.py` через `CREATE TABLE IF NOT EXISTS` (отдельной alembic-папки нет)

## Точки входа UI

1. Публика: `frontend/index.html` → `js/app.js`
2. Админка: `frontend/admin/index.html` → `admin-app.js`
3. API: `backend/app/main.py`

## Зависимости UI ↔ API

- `GET` расписание / группы через `frontend/js/api/client.js`
- Админ-токен: `schedule_admin_token` в localStorage (backend Bearer)
- Клиентская админ-сессия PBKDF2 — отдельно в `utils/auth.js` (локальный gate)
