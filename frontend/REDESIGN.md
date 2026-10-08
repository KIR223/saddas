# Отчёт: редизайн МелМК

## Что изменено
- Полностью обновлены CSS (`variables`, `base`, `layout`, `schedule`, `week`)
- Добавлены `css/effects.css` и `js/effects/ui-effects.js` (только UI)
- Локальные шрифты Manrope / JetBrains Mono (woff2) в `fonts/`
- Бренд в шапке: **МелМК**, meta / manifest / theme-color под новую палитру
- Glassmorphism шапки и нижней навигации, индиго–бирюза–розовый акцент
- Карточки пар с градиентной полосой, glow «сейчас», бейджи
- Мобильная нижняя панель-«капсула», дни-пилюли, bottom-sheet модалки
- Анимации: stagger, ripple, nav-pill, progress до конца пары, theme flash
- `prefers-reduced-motion` учитывается

## Что НЕ тронуто
- Логика JS (`app.js`, API, парсер, store, views) — без изменений бизнес-кода
- Существующие CSS-классы, id, `data-*` — сохранены (см. `CLASSES.md`)
- HTML-структура / порядок ключевых узлов — без удаления
- Связка с бэкендом API — без изменений

## Бэкап
- `frontend/backup-css/` — CSS до редизайна

## Проверка классов
- Инвентарь: `frontend/CLASSES.md`
- Новые классы только с префиксом `mm-`
