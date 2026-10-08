/**
 * Замены пар с датами действия
 */

import { createLesson, genId, cloneData, getPairTimesForDay } from './schedule.js';

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
 * @param {Date} [date]
 * @returns {string} YYYY-MM-DD
 */
export function toDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
export function applySubstitutions(lessons, data, group, day, date = new Date()) {
  const dayKey = String(day);
  const subs = (data.substitutions || []).filter(
    (s) => s.group === group && String(s.day) === dayKey && isSubActive(s, date)
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
