/**
 * Утилиты времени и «сейчас / дальше».
 * Все «сейчас» для расписания — по московскому времени (Europe/Moscow).
 */

export const MOSCOW_TZ = 'Europe/Moscow';

/**
 * Текущий момент в Europe/Moscow.
 * getHours/getDay/getDate и т.п. отражают московское время,
 * независимо от часового пояса устройства.
 * @returns {Date}
 */
export function moscowNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: MOSCOW_TZ }));
}

/**
 * @param {string} hm
 * @returns {number}
 */
export function toMinutes(hm) {
  if (!hm || typeof hm !== 'string') return 0;
  const [h, m] = hm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * HH:MM → Date в тот же календарный день, что и base (московские get*).
 * @param {string} hm
 * @param {Date} [base]
 */
export function hmToDate(hm, base = moscowNow()) {
  const [h, m] = String(hm || '0:0').split(':').map(Number);
  const d = new Date(base);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

/**
 * @param {number} v
 * @param {number} [a]
 * @param {number} [b]
 */
export function clamp(v, a = 0, b = 1) {
  return Math.min(b, Math.max(a, v));
}

/**
 * Прогресс пары 0..1 и остаток в мс (с учётом секунд)
 * @param {string} startHm
 * @param {string} endHm
 * @param {Date} [now]
 */
export function lessonProgress(startHm, endHm, now = moscowNow()) {
  const start = hmToDate(startHm, now).getTime();
  const end = hmToDate(endHm, now).getTime();
  const t = now.getTime();
  const span = Math.max(1, end - start);
  const progress = clamp((t - start) / span);
  const remainingMs = Math.max(0, end - t);
  return { progress, remainingMs };
}

/**
 * Точный countdown: «42 сек» / «16 мин 42 сек» / «1 ч 05 мин»
 * @param {number} totalSec
 * @returns {string}
 */
export function formatCountdown(totalSec) {
  let sec = Math.max(0, Math.floor(totalSec));
  if (sec < 60) return `${sec} сек`;
  const h = Math.floor(sec / 3600);
  sec %= 3600;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (h > 0) {
    return s > 0
      ? `${h} ч ${String(m).padStart(2, '0')} мин ${String(s).padStart(2, '0')} сек`
      : `${h} ч ${String(m).padStart(2, '0')} мин`;
  }
  return `${m} мин ${String(s).padStart(2, '0')} сек`;
}

/**
 * @param {Date} [now]
 */
export function nowMinutes(now = moscowNow()) {
  return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
}

/**
 * @param {import('../models/schedule.js').Lesson[]} lessons
 * @param {Date} [now]
 */
export function findNowNext(lessons, now = moscowNow()) {
  const sorted = [...lessons].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  const nm = nowMinutes(now);

  if (!sorted.length) {
    return { current: null, next: null, status: 'done', endsIn: 0, startsIn: 0, progress: 0 };
  }

  /** @type {import('../models/schedule.js').Lesson[]} */
  const currents = [];
  let next = null;

  for (const l of sorted) {
    const start = toMinutes(l.start);
    const end = toMinutes(l.end);
    if (nm >= start && nm < end) currents.push(l);
    else if (nm < start && !next) next = l;
  }

  if (currents.length) {
    const current = currents[0];
    const { progress, remainingMs } = lessonProgress(current.start, current.end, now);
    return {
      current,
      currents,
      next,
      status: 'now',
      endsIn: Math.round(remainingMs / 1000),
      startsIn: 0,
      progress,
    };
  }

  const firstStartMs = hmToDate(sorted[0].start, now).getTime();
  if (now.getTime() < firstStartMs) {
    const startsIn = Math.max(0, Math.round((firstStartMs - now.getTime()) / 1000));
    return {
      current: null,
      currents: [],
      next: sorted[0],
      status: 'before',
      endsIn: 0,
      startsIn,
      progress: 0,
    };
  }

  if (next) {
    const startsIn = Math.max(0, Math.round((hmToDate(next.start, now).getTime() - now.getTime()) / 1000));
    return {
      current: null,
      currents: [],
      next,
      status: 'break',
      endsIn: 0,
      startsIn,
      progress: 0,
    };
  }

  return {
    current: null,
    currents: [],
    next: null,
    status: 'done',
    endsIn: 0,
    startsIn: 0,
    progress: 0,
  };
}

/**
 * @param {Date} [date]
 */
export function startOfWeek(date = moscowNow()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * @param {number} isoDay
 * @param {Date} [weekStart]
 */
export function dateOfDay(isoDay, weekStart = startOfWeek()) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + (isoDay - 1));
  return d;
}

/**
 * Дата по-русски: «Четверг, 8 октября».
 * @param {Date} date
 */
export function formatRuDate(date) {
  const raw = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
