# ЗАМОРОЖЕННЫЕ элементы (prompt melmk fix v2)

**Правило: эти файлы / фрагменты НЕ изменять.** Разрешено только вызывать функции и читать результат. Смена цветовой темы не должна перекрашивать бейдж.

## (а) Бейдж типа недели «Зелёная» / «Красная»

| Что | Путь |
|-----|------|
| Разметка / создание | `frontend/js/views/now.js` — `el('span', 'week-badge week-badge--…')` |
| Также используется | `frontend/js/views/bells.js` |
| Стили бейджа | `frontend/css/melmk-ui.css` — блоки `.week-badge`, `.week-badge--green`, `.week-badge--red` и тёмные варианты |

Запрещено менять: компонент бейджа, текст («Зелёная» / «Красная»), цвета, форму, источник данных.

Разрешено: править только CSS **контейнера-обёртки** приветствия (перенос строк на 320px), без правок самого `.week-badge`.

## (б) Функция типа недели

| Среда | Путь | Сигнатура | Логика |
|-------|------|-----------|--------|
| Frontend | `frontend/js/models/bells.js` | `getMelmkWeekType(date = new Date()) → 'green'\|'red'` | ISO-неделя: нечётная → green, чётная → red |
| Frontend | `frontend/js/models/bells.js` | `getIsoWeekNumber(date)`, `weekTypeLabel(type)` | Вспомогательные; label: Зелёная / Красная |
| Backend | `backend/app/week.py` | `current_week(day=None) → "green"\|"red"` | То же: `isocalendar().week % 2` |

Умеет считать для произвольной даты: **да** (принимает `date` / `Date`).

## (в) Кто импортирует

- `frontend/js/views/now.js` → `getMelmkWeekType`, `weekTypeLabel`
- `frontend/js/views/bells.js` → `getMelmkWeekType`, `weekTypeLabel`
- `backend/app/main.py` (и тесты) → `week.py`

## Не путать с темами оформления

В названиях **цветовых тем** запрещены слова «Зелёная» и «Белая». Тип недели — отдельная сущность.
