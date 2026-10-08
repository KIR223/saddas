/**
 * Запись/чтение серверных замен (OpenAPI: /api/admin/schedule/... и /api/schedule/day)
 */

import {
  savePairOverride,
  removePairOverride,
  fetchScheduleDay,
} from './client.js';
import { getAdminToken } from './config.js';
import { toDateKey, setServerDay } from '../models/substitutions.js';
import { createLesson, getPairTimesForDay, getIsoWeekday } from '../models/schedule.js';

/**
 * Есть ли реальные отличия от базового недельного расписания
 * @param {object} dayOut
 * @param {import('../models/schedule.js').Lesson[]} merged
 */
function shouldCacheDayOverride(dayOut, merged) {
  if (dayOut?.custom) return true;
  return (merged || []).some((l) => l.replaced || l.cancelled);
}

/**
 * Список дат YYYY-MM-DD от from до to включительно (макс. 120 дней)
 * @param {string} [from]
 * @param {string} [to]
 * @returns {string[]}
 */
export function expandDateRange(from, to) {
  const start = from || toDateKey();
  const end = to || from || toDateKey();
  const a = start <= end ? start : end;
  const b = start <= end ? end : start;
  const out = [];
  const cur = new Date(`${a}T12:00:00`);
  const last = new Date(`${b}T12:00:00`);
  let guard = 0;
  while (cur <= last && guard < 120) {
    out.push(toDateKey(cur));
    cur.setDate(cur.getDate() + 1);
    guard += 1;
  }
  if (!out.length) out.push(toDateKey());
  return out;
}

/**
 * Даты для записи замены: явный период или ближайшие 16 недель того же дня недели
 * @param {{ day?: string|number, dateFrom?: string, dateTo?: string }} sub
 * @returns {string[]}
 */
export function expandDatesForSub(sub) {
  if (sub.dateFrom || sub.dateTo) {
    const all = expandDateRange(sub.dateFrom, sub.dateTo);
    const dow = Number(sub.day);
    if (dow >= 1 && dow <= 7) {
      return all.filter((k) => getIsoWeekday(new Date(`${k}T12:00:00`)) === dow);
    }
    return all;
  }
  const dow = Number(sub.day) || getIsoWeekday();
  const out = [];
  const cur = new Date();
  cur.setHours(12, 0, 0, 0);
  // ближайший нужный день недели (включая сегодня)
  while (getIsoWeekday(cur) !== dow) cur.setDate(cur.getDate() + 1);
  for (let i = 0; i < 16; i++) {
    out.push(toDateKey(cur));
    cur.setDate(cur.getDate() + 7);
  }
  return out;
}

/**
 * YYYY-MM-DD для ISO-дня недели в текущей (или указанной) неделе
 * @param {number} isoDay 1..7
 * @param {Date} [ref]
 */
export function dateKeyForIsoWeekday(isoDay, ref = new Date()) {
  const cur = getIsoWeekday(ref);
  const d = new Date(ref);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + (isoDay - cur));
  return toDateKey(d);
}

/**
 * Сохранить замену в БД через API на все даты периода
 * @param {{
 *   group: string,
 *   pair: number,
 *   cancelled?: boolean,
 *   dateFrom?: string,
 *   dateTo?: string,
 *   lesson?: { subject?: string, teacher?: string, room?: string }
 * }} sub
 * @param {string} [token]
 * @returns {Promise<{ ok: boolean, dates: string[], last?: object, error?: string, summary: string }>}
 */
export async function pushSubstitutionToApi(sub, token = getAdminToken()) {
  if (!token) {
    return {
      ok: false,
      dates: [],
      error: 'Нет токена API (x-admin-token). Укажите его в разделе «Данные».',
      summary: '',
    };
  }
  const dates = expandDatesForSub(sub);
  const body = sub.cancelled
    ? { subject: '', teacher: '', room: '', cancelled: true }
    : {
      subject: String(sub.lesson?.subject || '').trim(),
      teacher: String(sub.lesson?.teacher || '').trim(),
      room: String(sub.lesson?.room || '').trim(),
      cancelled: false,
    };

  let last = null;
  try {
    for (const onDate of dates) {
      last = await savePairOverride(onDate, sub.pair, sub.group, body, token);
    }
  } catch (e) {
    return {
      ok: false,
      dates,
      error: e.message || String(e),
      summary: '',
    };
  }

  const summary = sub.cancelled
    ? `отмена пары ${sub.pair}, дат: ${dates.length}`
    : `преподаватель ${body.teacher || '—'}, ауд. ${body.room || '—'}, «${body.subject}»; дат: ${dates.length}`;

  return { ok: true, dates, last, summary };
}

/**
 * Удалить серверный override на даты
 * @param {{ group: string, pair: number, day?: string|number, dateFrom?: string, dateTo?: string }} sub
 * @param {string} [token]
 */
export async function removeSubstitutionFromApi(sub, token = getAdminToken()) {
  if (!token) throw new Error('Нет токена API');
  const dates = expandDatesForSub(sub);
  for (const onDate of dates) {
    await removePairOverride(onDate, sub.pair, sub.group, token);
  }
  return dates;
}

/**
 * DayScheduleOut → уроки с флагом replaced при custom / отличии от базы
 * @param {object} dayOut
 * @param {import('../models/schedule.js').Lesson[]} [baseLessons]
 * @param {number} [dayKey]
 */
export function mergeDayScheduleOut(dayOut, baseLessons = [], dayKey = 1) {
  const slots = getPairTimesForDay(dayKey);
  const baseByPair = new Map(baseLessons.map((l) => [l.pair, l]));
  const custom = !!dayOut?.custom;
  const out = [];

  for (const p of dayOut?.pairs || []) {
    const pair = Number(p.pair) || 0;
    if (!pair) continue;
    const base = baseByPair.get(pair);
    const slot = slots.find((s) => s.pair === pair) || slots[0];
    const subject = String(p.subject || '').trim();
    const teacher = String(p.teacher || '').trim();
    const room = String(p.room || '').trim();
    const cancelled = /отмен/i.test(subject) || subject === '';
    const changed = custom
      || !base
      || base.subject !== subject
      || base.teacher !== teacher
      || base.room !== room;

    out.push(createLesson({
      ...(base || {}),
      pair,
      start: base?.start || slot.start,
      end: base?.end || slot.end,
      subject: cancelled ? 'Пара отменена' : subject,
      teacher: cancelled ? '' : teacher,
      room: cancelled ? '' : room,
      id: base?.id,
      replaced: changed,
      cancelled: cancelled || undefined,
      original: changed && base ? { ...base } : undefined,
    }));
  }

  return out.sort((a, b) => a.pair - b.pair);
}

/**
 * Подтянуть день с сервера и слить с локальным списком; положить в кэш публичного UI
 * @param {string} group
 * @param {string} dateKey
 * @param {import('../models/schedule.js').Lesson[]} baseLessons
 * @param {number} dayKey
 */
export async function fetchAndMergeDay(group, dateKey, baseLessons, dayKey) {
  const dayOut = await fetchScheduleDay(group, dateKey);
  const lessons = mergeDayScheduleOut(dayOut, baseLessons, dayKey);
  // Без custom/замен не перекрываем недельное расписание с /api/schedule
  if (shouldCacheDayOverride(dayOut, lessons)) {
    setServerDay(group, dateKey, lessons, dayKey);
  }
  return { dayOut, lessons };
}
