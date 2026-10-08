# ШАГИ 1–6 — Мобильная вёрстка, шапка, темы, Сейчас/Дальше, нав, главный экран

**Что сделано:**
1. Safe-area / dvh / `--page-pad` / z-index переменные; контейнер max-width 1120px; защита от overflow.
2. Шапка sticky + `padding-top: safe-top`; ResizeObserver → `--header-h`; плотный фон 92%.
3. Две разные кнопки: палитра (`btn-mood`) и light/dark (`btn-theme`); `data-theme` + `data-mode`; FOUC-скрипт; `mk_theme`/`mk_mode`; 6 палитр без «Зелёная/Белая».
4. «Сейчас/Дальше»: одна колонка ≤640px; преподаватель виден; таймер с единицами; прогресс `lessonProgress`; фильтр недели через `getMelmkWeekType`.
5. Нижняя панель плотнее; padding-bottom; на ≥1024px скрыта; подписи «Препод.» ≤340px.
6. Убрана отдельная «Сменить группу»; дата «8 октября»; дни равной ширины без scale; `?view=&day=&tab=` в URL; кнопка скачать.

**Изменённые файлы:** `frontend/index.html`, `css/variables|base|layout|themes|week-badge-mode|melmk-ui|effects.css`, `js/utils/theme|time.js`, `js/views/now|theme-sheet|day|week|month|export-sheet.js`, `js/app.js`, `js/export/export.js`, `admin/admin-app.js`.

**Замороженные элементы не тронуты:** да (блок `.week-badge` в melmk-ui и `getMelmkWeekType` без правок; добавлен только `week-badge-mode.css`).

**Данные и подключения не тронуты:** да

**Открытые вопросы / риски:**
- `getWeekParity` в schedule.js ещё со старым алгоритмом; публичные виды переведены на `getMelmkWeekType`.
- PDF/XLSX нативные библиотеки не подключены: PDF = печать, Excel = CSV UTF-8.
- Скриншоты «до/после» — проверить на устройстве владельца.
