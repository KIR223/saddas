# API расписания МелМК

FastAPI + SQLite; интерфейс находится в `../frontend`. Публичное расписание доступно без входа. Изменения требуют серверную сессию admin, кабинет преподавателя — сессию teacher.

## Запуск

Из `backend`: скопировать `.env.example` в `.env`, задать bootstrap-логин и пароль, для локального HTTP установить `COOKIE_SECURE=false`, затем `make dev`. Swagger: http://127.0.0.1:8000/docs. `make test` запускает unittest. `make migrate` применяет миграции; старт приложения делает то же автоматически.

Из корня: `docker compose up -d --build`. База сохраняется в `backend/data`. Миграции: `docker compose exec backend python -m app.migrate`. Перед обновлением production сделать резервную копию SQLite.

## Настройки

| Переменная | Значение по умолчанию | Назначение |
| --- | --- | --- |
| DATABASE_PATH | data/schedule.db | Файл SQLite |
| BOOTSTRAP_ADMIN_LOGIN | нет | Логин первого администратора |
| BOOTSTRAP_ADMIN_PASSWORD | нет | Пароль 12–256 символов; не хранить в Git |
| APP_ENV | development | production включает проверку настроек |
| ALLOWED_ORIGINS | https://melmksch.fvds.ru и локальные HTTP origin | Точные origin интерфейса через запятую |
| COOKIE_SECURE | true | На production обязательно true; false только для локального HTTP |

Bootstrap выполняется только при пустой users и не меняет существующие пароли. После создания первого admin bootstrap-пароль можно удалить из env. Без пользователей изменения закрыты. ADMIN_TOKEN и X-Admin-Token не дают доступа.

Production: APP_ENV=production, ALLOWED_ORIGINS с явным HTTPS origin сайта, COOKIE_SECURE=true. Сайт и API должны находиться на одном site (поддомены допустимы); иначе используйте reverse proxy под доменом сайта. Cookie HttpOnly, Secure, SameSite=Lax. Мутации с чужим Origin запрещены. Вход ограничен по логину и IP. Секреты и cookies не коммитить.

## API

| Путь | Назначение |
| --- | --- |
| GET /api/info | Тип недели, даты, заголовок, revision |
| GET /api/groups, /rooms, /teachers | Публичные справочники |
| GET /api/schedule?group=&week=green/red/current | Шаблон недели |
| GET /api/schedule/day?group=&date=YYYY-MM-DD | День с заменами и серверным временем пар |
| GET /api/bells?date=YYYY-MM-DD | Сетка на дату и кураторский час |
| GET /api/bells/config | Все профили и исключения для публичного кэша |
| POST /api/auth/login | JSON login/password; выдаёт HttpOnly cookie |
| GET /api/auth/me, POST /api/auth/logout | Проверка / завершение сессии |
| GET /api/teacher/schedule?date=&days=1..7 | Только пары текущего преподавателя |
| /api/admin/users | Список, создание, PATCH статуса/пароля/привязки |
| /api/admin/groups | Создание, список, архивирование, удаление пустых |
| GET/PUT /api/admin/template?group=&day=1..7&week=green/red | Повторяющийся шаблон, пары 1–12 |
| POST /api/admin/upload | Excel + mode + обязательный overrides_policy |
| GET /api/admin/import-info | Число замен до импорта |
| GET/PUT /api/admin/bell-config | Полная конфигурация звонков одной транзакцией |
| GET /api/admin/overrides | Выборка замен с фильтрами |
| POST /api/admin/overrides/bulk | Одной транзакцией до 120 дней или 16 недель |
| /api/admin/catalog/teachers, /rooms | CRUD справочников |
| GET /api/admin/audit | Серверный журнал, пагинация before/limit |

Существующие ручки `/api/admin/schedule/{date}` и `/pairs/{pair}` также требуют сессию. Полный контракт доступен в Swagger. Пользователи и аудит не содержат хэши в API-ответах. Смена пароля/отключение отзывают сессии. Последнего активного admin отключить нельзя.

## Excel и данные

Парсер openpyxl: зелёная/красная заливка определяет цвет недели; без заливки предмет и преподаватель занимают две строки. Правила находятся в `app/parser.py`. Клиентского импортера нет.

mode=replace заменяет шаблон целиком; mode=missing добавляет только отсутствующие группы. Справочники всегда сливаются, ручные записи сохраняются. overrides_policy обязателен: keep / future (сегодня и позже, Москва) / all. Изменение замен и шаблона выполняется атомарно. Ответ содержит warnings и diff с числами созданных/удалённых пар, групп и замен.

Группы существуют независимо от уроков. Переименование преподавателя обновляет его привязки и упоминания в парах; используемые записи защищены от удаления. Аудит записывается в той же транзакции, что и изменение. Revision меняется при изменениях расписания, справочников и звонков.

Недели чередуются по ISO-номеру: нечётная зелёная, чётная красная. Даты и «сегодня» — Москва.
