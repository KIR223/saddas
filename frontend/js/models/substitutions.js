/**
 * Замены пар с датами действия.
 * Источник правды для публичной страницы — серверные day-overrides (кэш ниже).
 */

import { createLesson, genId, cloneData, getPairTimesForDay, getIsoWeekday } from './schedule.js';

/**
 * @typedef {Object} Substitution
 * @property {string} id
 * @property {string} group
 * @property {string} day — '1'..'6'
 * @property {number} pair
 * @property {object} lesson — новые данные (или cancelled)
 * @property {boolean} [cancelled]
 * @property {string} [comment]
 * @property {string} [dateFrom] — YYYY-MM-DD
 * @property {string} [dateTo] — YYYY-MM-DD
 * @property {string} createdAt
 * @property {object} [original]
 */

/**
 * @typedef {{ lessons: import('./schedule.js').Lesson[], dayKey: number }} ServerDayEntry
 */

/** @type {Map<string, ServerDayEntry>} */
const serverDayCache = new Map();

/**
 * @param {Date|string} [date]
 * @returns {string} YYYY-MM-DD
 */
export function toDateKey(date = new Date()) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const d = typeof date === 'string' ? new Date(`${date}T12:00:00`) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Дата (в текущей неделе) для ISO-дня 1..7
 * @param {number} isoDay
 * @param {Date} [ref]
 * @returns {Date}
 */
export function dateForIsoWeekday(isoDay, ref = new Date()) {
  const cur = getIsoWeekday(ref);
  const d = new Date(ref);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + (Number(isoDay) - cur));
  return d;
}

/** @param {string} group @param {string} dateKey */
function serverKey(group, dateKey) {
  return `${group}|${dateKey}`;
}

/**
 * Кэш дня с API (уже с учётом замен). dayKey — ISO 1..6, чтобы не подставить чужой день.
 * @param {string} group
 * @param {string} dateKey
 * @param {import('./schedule.js').Lesson[]} lessons
 * @param {number} dayKey
 */
export function setServerDay(group, dateKey, lessons, dayKey) {
  serverDayCache.set(serverKey(group, dateKey), {
    lessons,
    dayKey: Number(dayKey) || getIsoWeekday(new Date(`${dateKey}T12:00:00`)),
  });
}

/**
 * @param {string} group
 * @param {string} dateKey
 * @param {string|number} [forDay] — если задан, вернуть только при совпадении дня недели
 * @returns {import('./schedule.js').Lesson[]|null}
 */
export function getServerDay(group, dateKey, forDay = null) {
  const entry = serverDayCache.get(serverKey(group, dateKey));
  if (!entry) return null;
  if (forDay != null && Number(forDay) !== Number(entry.dayKey)) return null;
  return entry.lessons;
}

/** Сброс кэша дней (после полного refresh) */
export function clearServerDayCache() {
  serverDayCache.clear();
}

/**
 * Активна ли замена на дату
 * @param {Substitution} sub
 * @param {string|Date} [date]
 */
export function isSubActive(sub, date = new Date()) {
  const key = typeof date === 'string' ? date : toDateKey(date);
  if (sub.dateFrom && key < sub.dateFrom) return false;
  if (sub.dateTo && key > sub.dateTo) return false;
  // Если дат нет — считаем «бессрочной» до ручного удаления
  return true;
}

/**
 * Применить активные замены к списку пар дня
 * @param {import('./schedule.js').Lesson[]} lessons
 * @param {import('./schedule.js').ScheduleData} data
 * @param {string} group
 * @param {string|number} day
 * @param {Date} [date]
 */
export function applySubstitutions(lessons, data, group, day, date = null) {
  const dayNum = Number(day);
  const when = date || (dayNum >= 1 && dayNum <= 7 ? dateForIsoWeekday(dayNum) : new Date());
  const dateKey = toDateKey(when);
  // Только если кэш относится к этому дню недели (иначе Чт/Пт/Сб схлопывались в «сегодня»)
  const fromServer = getServerDay(group, dateKey, dayNum);
  if (fromServer) {
    return fromServer.map((l) => ({ ...l }));
  }

  const dayKey = String(day);
  const subs = (data.substitutions || []).filter(
    (s) => s.group === group && String(s.day) === dayKey && isSubActive(s, when)
  );
  if (!subs.length) return lessons.map((l) => ({ ...l }));

  const byPair = new Map(subs.map((s) => [s.pair, s]));
  const out = [];

  for (const lesson of lessons) {
    const sub = byPair.get(lesson.pair);
    if (!sub) {
      out.push(lesson);
      continue;
    }
    byPair.delete(lesson.pair);
    if (sub.cancelled) {
      out.push({
        ...lesson,
        subject: 'Пара отменена',
        teacher: '',
        room: '',
        replaced: true,
        cancelled: true,
        original: cloneData(lesson),
        comment: sub.comment || '',
      });
      continue;
    }
    const merged = createLesson({
      ...lesson,
      ...sub.lesson,
      id: lesson.id,
      pair: lesson.pair,
      start: sub.lesson?.start || lesson.start,
      end: sub.lesson?.end || lesson.end,
      replaced: true,
      original: cloneData(lesson),
    });
    if (sub.comment) merged.comment = sub.comment;
    out.push(merged);
  }

  // Замены на пустые слоты (добавление)
  for (const [, sub] of byPair) {
    if (sub.cancelled) continue;
    const slots = getPairTimesForDay(day);
    const slot = slots.find((s) => s.pair === sub.pair) || slots[0];
    out.push(createLesson({
      ...(sub.lesson || {}),
      pair: sub.pair,
      start: sub.lesson?.start || slot.start,
      end: sub.lesson?.end || slot.end,
      replaced: true,
      original: null,
    }));
  }

  return out.sort((a, b) => a.pair - b.pair);
}

/**
 * @param {import('./schedule.js').ScheduleData} data
 * @param {Omit<Substitution,'id'|'createdAt'>} payload
 */
export function addSubstitution(data, payload) {
  if (!data.substitutions) data.substitutions = [];
  const sub = {
    id: genId(),
    createdAt: new Date().toISOString(),
    ...payload,
  };
  data.substitutions.unshift(sub);
  return sub;
}

/**
 * @param {import('./schedule.js').ScheduleData} data
 * @param {string} id
 * @param {Partial<Substitution>} patch
 */
export function updateSubstitution(data, id, patch) {
  const i = (data.substitutions || []).findIndex((s) => s.id === id);
  if (i < 0) return null;
  data.substitutions[i] = { ...data.substitutions[i], ...patch };
  return data.substitutions[i];
}

/**
 * @param {import('./schedule.js').ScheduleData} data
 * @param {string} id
 */
export function removeSubstitution(data, id) {
  data.substitutions = (data.substitutions || []).filter((s) => s.id !== id);
}

export function clearSubstitutions(data) {
  data.substitutions = [];
}

/**
 * Список предметов из данных
 * @param {import('./schedule.js').ScheduleData} data
 */
export function listSubjects(data) {
  const set = new Set();
  for (const g of Object.values(data.groups || {})) {
    for (const lessons of Object.values(g.days || {})) {
      for (const l of lessons) {
        if (l.subject) set.add(l.subject);
      }
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
}
