/**
 * Модель данных расписания
 * Иерархия: группа → день (1–6) → пара → предмет/преподаватель/кабинет/подгруппа
 */

/** @typedef {'lecture'|'practice'|'lab'|'exam'|'consult'|'other'} LessonType */
/** @typedef {'all'|'odd'|'even'} WeekParity */

/**
 * @typedef {Object} Lesson
 * @property {string} id
 * @property {number} pair — номер пары (1…)
 * @property {string} start — HH:MM
 * @property {string} end — HH:MM
 * @property {string} subject
 * @property {string} teacher
 * @property {string} room
 * @property {LessonType} type
 * @property {string|null} subgroup — null | '1' | '2'
 * @property {WeekParity} week
 * @property {boolean} [replaced]
 * @property {Lesson} [original] — исходная пара при замене
 */

/**
 * @typedef {Object} GroupSchedule
 * @property {string} name
 * @property {Record<string, Lesson[]>} days — ключи '1'..'6' (пн–сб)
 */

/**
 * @typedef {Object} ScheduleData
 * @property {number} version
 * @property {string} updatedAt
 * @property {{ institution: string, semester: string, sourceFile: string }} meta
 * @property {Record<string, GroupSchedule>} groups
 * @property {Array<{id:string,group:string,day:string,pair:number,lesson:Lesson,createdAt:string}>} substitutions
 * @property {Object} settings
 */

/**
 * Звонки МелМК: вт–ср–пт (основные дни)
 * Пн/чт — см. PAIR_TIMES_MON_THU (+ «Разговор о важном» 08:00–08:40)
 */
export const DEFAULT_PAIR_TIMES = [
  { pair: 1, start: '08:00', end: '09:00' },
  { pair: 2, start: '09:05', end: '10:05' },
  { pair: 3, start: '10:10', end: '11:10' },
  { pair: 4, start: '11:40', end: '12:40' },
  { pair: 5, start: '12:45', end: '13:45' },
];

/** Звонки пн и чт */
export const PAIR_TIMES_MON_THU = [
  { pair: 1, start: '08:45', end: '09:45' },
  { pair: 2, start: '09:50', end: '10:50' },
  { pair: 3, start: '10:55', end: '11:55' },
  { pair: 4, start: '12:25', end: '13:25' },
  { pair: 5, start: '13:30', end: '14:30' },
];

/**
 * Слоты пар по дню недели (1=пн … 5=пт, 6=сб → как вт–пт)
 * @param {number|string} isoDay
 */
export function getPairTimesForDay(isoDay) {
  const d = Number(isoDay);
  if (d === 1 || d === 4) return PAIR_TIMES_MON_THU;
  return DEFAULT_PAIR_TIMES;
}

export const DAY_NAMES = {
  1: 'Понедельник',
  2: 'Вторник',
  3: 'Среда',
  4: 'Четверг',
  5: 'Пятница',
  6: 'Суббота',
};

export const DAY_SHORT = {
  1: 'Пн',
  2: 'Вт',
  3: 'Ср',
  4: 'Чт',
  5: 'Пт',
  6: 'Сб',
};

export const TYPE_LABELS = {
  lecture: 'Лекция',
  practice: 'Практика',
  lab: 'Лабораторная',
  exam: 'Экзамен',
  consult: 'Консультация',
  other: 'Пара',
};

/**
 * Создаёт пустую структуру расписания
 * @returns {ScheduleData}
 */
export function createEmptySchedule() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    meta: {
      institution: '',
      semester: '',
      sourceFile: '',
    },
    groups: {},
    substitutions: [],
    /** Справочники админки (дополняют данные из пар) */
    catalog: {
      teachers: [],
      rooms: [],
    },
    settings: {
      theme: 'light',
      defaultGroup: '',
      pairTimes: [...DEFAULT_PAIR_TIMES],
      adminUnlocked: false,
      showWeekends: true,
    },
  };
}

/**
 * Нормализация каталога преподавателей/кабинетов
 * @param {ScheduleData} data
 */
export function ensureCatalog(data) {
  if (!data.catalog) data.catalog = { teachers: [], rooms: [] };
  if (!Array.isArray(data.catalog.teachers)) data.catalog.teachers = [];
  if (!Array.isArray(data.catalog.rooms)) data.catalog.rooms = [];
  return data;
}


/**
 * Генерирует уникальный id пары
 * @returns {string}
 */
export function genId() {
  return `l_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Создаёт объект пары с дефолтами
 * @param {Partial<Lesson>} [partial]
 * @returns {Lesson}
 */
export function createLesson(partial = {}) {
  const pair = partial.pair ?? 1;
  const slot = DEFAULT_PAIR_TIMES.find((t) => t.pair === pair) || DEFAULT_PAIR_TIMES[0];
  return {
    id: partial.id || genId(),
    pair,
    start: partial.start || slot.start,
    end: partial.end || slot.end,
    subject: partial.subject || '',
    teacher: partial.teacher || '',
    room: partial.room || '',
    type: partial.type || 'other',
    subgroup: partial.subgroup ?? null,
    week: partial.week || 'all',
    replaced: partial.replaced || false,
    ...(partial.original ? { original: partial.original } : {}),
  };
}

/**
 * День недели ISO: пн=1 … вс=7 (вс → 0 для отображения, в модели 1–6)
 * @param {Date} [date]
 * @returns {number} 1–7
 */
export function getIsoWeekday(date = new Date()) {
  const d = date.getDay();
  return d === 0 ? 7 : d;
}

/**
 * Номер учебной недели (чётная/нечётная от начала года или даты)
 * @param {Date} [date]
 * @returns {'odd'|'even'}
 */
export function getWeekParity(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil((((date - start) / 86400000) + start.getDay() + 1) / 7);
  return week % 2 === 0 ? 'even' : 'odd';
}

/**
 * Фильтр пар по чётности недели
 * @param {Lesson[]} lessons
 * @param {'odd'|'even'|'all'} [parity]
 * @returns {Lesson[]}
 */
export function filterByWeek(lessons, parity = getWeekParity()) {
  return lessons.filter((l) => l.week === 'all' || l.week === parity || parity === 'all');
}

/**
 * Список групп
 * @param {ScheduleData} data
 * @returns {string[]}
 */
export function listGroups(data) {
  return Object.keys(data.groups || {}).sort((a, b) => a.localeCompare(b, 'ru'));
}

/**
 * Все уникальные преподаватели
 * @param {ScheduleData} data
 * @returns {string[]}
 */
export function listTeachers(data) {
  const set = new Set();
  for (const g of Object.values(data.groups || {})) {
    for (const lessons of Object.values(g.days || {})) {
      for (const l of lessons) {
        if (l.teacher) set.add(l.teacher);
      }
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
}

/**
 * Все уникальные кабинеты
 * @param {ScheduleData} data
 * @returns {string[]}
 */
export function listRooms(data) {
  const set = new Set();
  for (const g of Object.values(data.groups || {})) {
    for (const lessons of Object.values(g.days || {})) {
      for (const l of lessons) {
        if (l.room) set.add(l.room);
      }
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
}

/**
 * Преподаватели: каталог + из пар
 * @param {ScheduleData} data
 */
export function listTeachersAll(data) {
  ensureCatalog(data);
  const set = new Set(data.catalog.teachers);
  for (const t of listTeachers(data)) set.add(t);
  return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
}

/**
 * Кабинеты: каталог + из пар
 * @param {ScheduleData} data
 */
export function listRoomsAll(data) {
  ensureCatalog(data);
  const set = new Set(data.catalog.rooms);
  for (const r of listRooms(data)) set.add(r);
  return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
}

/**
 * Пары преподавателя по всем группам
 * @param {ScheduleData} data
 * @param {string} teacher
 * @returns {Array<{group:string,day:string,lesson:Lesson}>}
 */
export function lessonsByTeacher(data, teacher) {
  const out = [];
  const t = teacher.toLowerCase();
  for (const [group, g] of Object.entries(data.groups || {})) {
    for (const [day, lessons] of Object.entries(g.days || {})) {
      for (const lesson of lessons) {
        if (lesson.teacher && lesson.teacher.toLowerCase().includes(t)) {
          out.push({ group, day, lesson });
        }
      }
    }
  }
  return out.sort((a, b) => Number(a.day) - Number(b.day) || a.lesson.pair - b.lesson.pair);
}

/**
 * Пары в кабинете
 * @param {ScheduleData} data
 * @param {string} room
 * @returns {Array<{group:string,day:string,lesson:Lesson}>}
 */
export function lessonsByRoom(data, room) {
  const out = [];
  const r = room.toLowerCase();
  for (const [group, g] of Object.entries(data.groups || {})) {
    for (const [day, lessons] of Object.entries(g.days || {})) {
      for (const lesson of lessons) {
        if (lesson.room && lesson.room.toLowerCase().includes(r)) {
          out.push({ group, day, lesson });
        }
      }
    }
  }
  return out.sort((a, b) => Number(a.day) - Number(b.day) || a.lesson.pair - b.lesson.pair);
}

/**
 * Поиск по предмету / преподавателю / кабинету / группе
 * (е/ё, регистр, пробелы/дефисы; все слова запроса)
 * @param {ScheduleData} data
 * @param {string} query
 * @returns {Array<{group:string,day:string,lesson:Lesson}>}
 */
export function searchLessons(data, query) {
  const raw = String(query || '').trim();
  if (!raw) return [];
  const norm = (s) => String(s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[\s\-–—_/.,;:]+/g, ' ')
    .trim();
  const tokens = norm(raw).split(' ').filter(Boolean);
  if (!tokens.length) return [];
  const out = [];
  for (const [group, g] of Object.entries(data.groups || {})) {
    for (const [day, lessons] of Object.entries(g.days || {})) {
      for (const lesson of lessons) {
        const hay = norm([
          group, lesson.subject, lesson.teacher, lesson.room, lesson.type, lesson.pair,
        ].join(' '));
        if (tokens.every((t) => hay.includes(t))) out.push({ group, day, lesson });
      }
    }
  }
  return out;
}

/**
 * Статистика по группе
 * @param {ScheduleData} data
 * @param {string} groupName
 * @param {'odd'|'even'|'all'} [parity]
 */
export function calcStats(data, groupName, parity = 'all') {
  const g = data.groups[groupName];
  if (!g) {
    return { total: 0, byDay: {}, gaps: 0, byType: {} };
  }
  const byDay = {};
  const byType = {};
  let total = 0;
  let gaps = 0;

  for (let d = 1; d <= 6; d++) {
    const key = String(d);
    let lessons = filterByWeek(g.days[key] || [], parity);
    lessons = [...lessons].sort((a, b) => a.pair - b.pair);
    byDay[key] = lessons.length;
    total += lessons.length;
    for (const l of lessons) {
      byType[l.type] = (byType[l.type] || 0) + 1;
    }
    // Окна: пропуски между первой и последней парой
    if (lessons.length >= 2) {
      const pairs = lessons.map((l) => l.pair);
      const min = Math.min(...pairs);
      const max = Math.max(...pairs);
      const occupied = new Set(pairs);
      for (let p = min; p <= max; p++) {
        if (!occupied.has(p)) gaps += 1;
      }
    }
  }

  return { total, byDay, gaps, byType };
}

/**
 * Глубокое клонирование (для сравнения версий)
 * @template T
 * @param {T} obj
 * @returns {T}
 */
export function cloneData(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Сравнение двух расписаний: возвращает id изменённых пар
 * @param {ScheduleData} prev
 * @param {ScheduleData} next
 * @returns {Set<string>}
 */
export function diffLessons(prev, next) {
  const changed = new Set();
  const prevMap = new Map();
  for (const [gn, g] of Object.entries(prev?.groups || {})) {
    for (const [day, lessons] of Object.entries(g.days || {})) {
      for (const l of lessons) {
        prevMap.set(`${gn}|${day}|${l.pair}|${l.subgroup || ''}|${l.week}`, JSON.stringify({
          subject: l.subject, teacher: l.teacher, room: l.room, type: l.type, start: l.start, end: l.end,
        }));
      }
    }
  }
  for (const [gn, g] of Object.entries(next?.groups || {})) {
    for (const [day, lessons] of Object.entries(g.days || {})) {
      for (const l of lessons) {
        const key = `${gn}|${day}|${l.pair}|${l.subgroup || ''}|${l.week}`;
        const sig = JSON.stringify({
          subject: l.subject, teacher: l.teacher, room: l.room, type: l.type, start: l.start, end: l.end,
        });
        if (!prevMap.has(key) || prevMap.get(key) !== sig) {
          changed.add(l.id);
        }
      }
    }
  }
  return changed;
}
