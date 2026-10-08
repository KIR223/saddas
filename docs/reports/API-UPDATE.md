# Обновление API-клиента

Источник: `docs/openapi.json` (OpenAPI 3.1 «Расписание колледжа»).

## Эндпоинты в `frontend/js/api/client.js`

| Метод | Путь |
|-------|------|
| GET | `/api/info` |
| GET | `/api/groups` |
| GET | `/api/rooms` |
| GET | `/api/teachers` |
| GET | `/api/schedule` |
| GET | `/api/schedule/day` |
| GET | `/api/bells` |
| POST | `/api/admin/upload` |
| PUT | `/api/admin/bells` |
| PUT/DELETE | `/api/admin/bells/{on_date}` |
| PUT/DELETE | `/api/admin/schedule/{on_date}` |
| PUT/DELETE | `/api/admin/schedule/{on_date}/pairs/{pair}` |

Sync подтягивает rooms/teachers/bells при bootstrap/full. Базовый URL не менялся (`api.melmksch.fvds.ru`).
