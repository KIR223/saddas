# API

Реализация: `backend/app/main.py`. Живая схема и «Try it out»: `{origin}/docs` (Swagger FastAPI). Отдельного `openapi.json` в репозитории нет.

Клиент: `frontend/js/api/client.js`. База на проде: `https://api.melmksch.fvds.ru`.

Админ-мутации: заголовок `X-Admin-Token`. Ошибка 401: `неверный токен`.

## Публичные

### `GET /api/info`

Текущий цвет недели, `week_start` / `week_end` (пн–вс), `title`, `uploaded_at`.

### `GET /api/groups`

`{ "groups": ["ТМ-261", ...] }` — сортировка как в SQL `ORDER BY group_name`.

### `GET /api/schedule?group=&week=`

`week`: `current` (по умолчанию), `green`, `red`. 404 если группы нет, 400 если week иной.

Ответ: `{ group, week, days: [{ day, pairs: [{ pair, subject, teacher, room }] }] }`. Дни в порядке `DAY_ORDER` (пн–вс), затем неизвестные имена, если попались. **Overrides не применяются** — только шаблон.

### `GET /api/schedule/day?group=&date=`

`date` — `YYYY-MM-DD`. Шаблон дня недели + цвет этой даты + overrides. Поля: `group`, `date`, `day`, `week`, `custom`, `pairs`.

### `GET /api/rooms`, `GET /api/teachers`

Справочники последней загрузки.

### `GET /api/bells`, `GET /api/bells?date=`

Без даты — `kind: "regular"`. С датой — `short`, если дата помечена, иначе regular с полем `date`.

## Админские

### `POST /api/admin/upload`

`multipart/form-data`, поле `file`. Только `.xlsx`. Ответ: `groups`, `lessons`, `rooms`, `teachers`, `warnings`. Занятие на две недели считается двумя `lessons`.

### `PUT /api/admin/bells`

Тело `{ "pairs": [{ "pair", "start", "end" }] }`. Пары 1–12, уникальные номера, `HH:MM`, конец позже начала, слоты по времени не пересекаются. Заменяет всю регулярную сетку.

### `PUT /api/admin/bells/{date}`, `DELETE /api/admin/bells/{date}`

Сокращённый день. DELETE возвращает дату к regular (204).

### `PUT /api/admin/schedule/{date}/pairs/{pair}?group=`

Тело: `{ subject, teacher, room }` или `{ "cancelled": true }`. Без предмета при не-отмене — 400. Ответ — тот же день, что у `GET /api/schedule/day`.

### `DELETE /api/admin/schedule/{date}/pairs/{pair}?group=`

Убрать override пары (вернуть шаблон). 204.

### `PUT /api/admin/schedule/{date}?group=`

Замена дня целиком: `{ "pairs": [{ pair, subject, teacher, room }] }`. Пары шаблона, которых нет в списке, на эту дату отменяются. 400 при пустом subject или дубликате pair.

### `DELETE /api/admin/schedule/{date}?group=`

Все overrides группы на дату. 204.

Группа всегда query-параметр: в коде группы бывает `/`.
