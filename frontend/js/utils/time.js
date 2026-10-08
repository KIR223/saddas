/**
 * Утилиты времени и «сейчас / дальше»
 */

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
 * @param {number} v
 * @param {number} [a]
 * @param {number} [b]
 */
export function clamp(v, a = 0, b = 1) {
  return Math.min(b, Math.max(a, v));
}

/**
 * Прогресс пары 0..1 и остаток в мс (один источник для кольца и полосы)
 * @param {string} startHm
 * @param {string} endHm
 * @param {Date} [now]
 */
export function lessonProgress(startHm, endHm, now = new Date()) {
  const start = toMinutes(startHm);
  const end = toMinutes(endHm);
  const nm = nowMinutes(now);
  const span = Math.max(1e-6, end - start);
  const progress = clamp((nm - start) / span);
  const remainingMs = Math.max(0, (end - nm) * 60 * 1000);
  return { progress, remainingMs };
}

/**
 * Формат оставшегося времени по промту (с единицами)
 * @param {number} totalSec
 * @returns {string}
 */
export function formatCountdown(totalSec) {
  if (totalSec < 0) totalSec = 0;
  if (totalSec < 60) {
    const s = Math.floor(totalSec);
    return `${s} сек`;
  }
  const totalMin = Math.floor(totalSec / 60);
  if (totalMin < 60) {
    return `${totalMin} ${pluralMinutes(totalMin)}`;
  }
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h} ч ${String(m).padStart(2, '0')} мин` : `${h} ч`;
}

function pluralMinutes(n) {
  const abs = Math.abs(n) % 100;
  const d = abs % 10;
  if (abs > 10 && abs < 20) return 'минут';
  if (d === 1) return 'минута';
  if (d >= 2 && d <= 4) return 'минуты';
  return 'минут';
}

/**
 * @param {Date} [now]
 */
export function nowMinutes(now = new Date()) {
  return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
}

/**
 * @param {import('../models/schedule.js').Lesson[]} lessons
 * @param {Date} [now]
 */
export function findNowNext(lessons, now = new Date()) {
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

  const firstStart = toMinutes(sorted[0].start);
  if (nm < firstStart) {
    const startsIn = Math.round((firstStart - nm) * 60);
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
    const startsIn = Math.round((toMinutes(next.start) - nm) * 60);
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
export function startOfWeek(date = new Date()) {
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
 * Дата по-русски: «Четверг, 8 октября»
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
