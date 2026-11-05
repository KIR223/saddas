import { bellState, installBellState } from './bell-state.js';
/**
 * Единый источник расписания звонков и кураторского часа МелМК
 */

import { LS } from '../config.js';
import { moscowNow } from '../utils/time.js';
import { DEFAULT_PAIR_TIMES, PAIR_TIMES_MON_THU, PAIR_TIMES_THU, LEGACY_PAIR_TIMES, sameBellSlots } from './schedule.js';

/**
 * @typedef {{ pair: number, start: string, end: string }} BellSlot
 * @typedef {{
 *   regular: BellSlot[],
 *   monThu: BellSlot[], // понедельник, прежнее имя для совместимости
 *   thursday: BellSlot[],
 *   shortDay: BellSlot[],
 *   curator: { enabled: boolean, days: number[], start: string, end: string, title: string, byDay: Record<number, {start:string, end:string, title:string}> }
 * }} BellsConfig
 */

/** @returns {BellsConfig} */
export function defaultBellsConfig() {
  return {
    regular: DEFAULT_PAIR_TIMES.map((x) => ({ ...x })),
    monThu: PAIR_TIMES_MON_THU.map((x) => ({ ...x })),
    thursday: PAIR_TIMES_THU.map((x) => ({ ...x })),
    shortDay: [
      { pair: 1, start: '08:00', end: '08:40' },
      { pair: 2, start: '08:45', end: '09:25' },
      { pair: 3, start: '09:30', end: '10:10' },
      { pair: 4, start: '10:15', end: '10:55' },
      { pair: 5, start: '11:00', end: '11:40' },
    ],
    curator: {
      enabled: true,
      days: [1, 4], // пн, чт
      start: '08:00',
      end: '08:40',
      title: 'Разговор о важном',
      byDay: {
        1: { start: '08:00', end: '08:40', title: 'Разговор о важном' },
        4: { start: '08:30', end: '09:10', title: 'Россия — мои горизонты' },
      },
    },
  };
}

/**
 * @returns {BellsConfig}
 */
export function loadBellsConfig() { return bellState(); }
export function saveBellsConfig() { throw new Error('Сохраняйте звонки через серверный редактор'); }
export function resetBellsConfig() { throw new Error('Сброс локальных звонков отключён'); }

/**
 * Слоты пар для дня (без кураторского часа)
 * @param {number} isoDay
 * @param {BellsConfig} [cfg]
 * @param {{ short?: boolean }} [opts]
 */
export function getBellsForDay(isoDay, cfg = loadBellsConfig(), opts = {}) {
  if (opts.short) return cfg.shortDay.map((x) => ({ ...x }));
  const today = moscowNow();
  const key = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  if (Number(isoDay) === (today.getDay()||7) && cfg.exceptions?.[key]) return cfg.exceptions[key].map(x=>({...x}));
  const d = Number(isoDay);
  if (d === 1) return cfg.monThu.map((x) => ({ ...x }));
  if (d === 4) return cfg.thursday.map((x) => ({ ...x }));
  return cfg.regular.map((x) => ({ ...x }));
}

/**
 * Кураторский час для дня (или null)
 * @param {number} isoDay
 * @param {BellsConfig} [cfg]
 */
export function getCuratorForDay(isoDay, cfg = loadBellsConfig()) {
  const today=moscowNow();
  const key=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  if (Number(isoDay)===(today.getDay()||7) && cfg.exceptions?.[key]) return null;
  if (!cfg.curator?.enabled) return null;
  const days = cfg.curator.days || [];
  if (!days.includes(Number(isoDay))) return null;
  const slot = cfg.curator.byDay?.[Number(isoDay)] || cfg.curator;
  return {
    id: 'curator',
    pair: 0,
    start: slot.start,
    end: slot.end,
    subject: slot.title || 'Кураторский час',
    teacher: '',
    room: '',
    type: 'consult',
    subgroup: null,
    week: 'all',
    isCurator: true,
  };
}

/**
 * Пары дня + кураторский час в начале (для «Сейчас» и таймера)
 * @param {import('./schedule.js').Lesson[]} lessons
 * @param {number} isoDay
 * @param {BellsConfig} [cfg]
 */
export function withCurator(lessons, isoDay, cfg = loadBellsConfig()) {
  const curator = getCuratorForDay(isoDay, cfg);
  const sorted = [...lessons].sort((a, b) => a.pair - b.pair);
  if (!curator) return sorted;
  return [curator, ...sorted];
}

/**
 * Перерывы между слотами
 * @param {BellSlot[]} slots
 * @returns {{ afterPair: number, minutes: number }[]}
 */
export function computeBreaks(slots) {
  const sorted = [...slots].sort((a, b) => a.pair - b.pair);
  const out = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const [h1, m1] = sorted[i].end.split(':').map(Number);
    const [h2, m2] = sorted[i + 1].start.split(':').map(Number);
    const minutes = (h2 * 60 + m2) - (h1 * 60 + m1);
    out.push({ afterPair: sorted[i].pair, minutes: Math.max(0, minutes) });
  }
  return out;
}

/**
 * Валидация слотов: конец > начала, нет пересечений
 * @param {BellSlot[]} slots
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateBellSlots(slots) {
  const errors = [];
  const sorted = [...slots].sort((a, b) => a.pair - b.pair);
  for (const s of sorted) {
    const [sh, sm] = s.start.split(':').map(Number);
    const [eh, em] = s.end.split(':').map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    if (!(end > start)) errors.push(`Пара ${s.pair}: конец должен быть позже начала`);
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const [eh, em] = sorted[i].end.split(':').map(Number);
    const [sh, sm] = sorted[i + 1].start.split(':').map(Number);
    if (sh * 60 + sm < eh * 60 + em) {
      errors.push(`Пары ${sorted[i].pair} и ${sorted[i + 1].pair} пересекаются`);
    }
  }
  return { ok: !errors.length, errors };
}

/**
 * Тип недели МелМК: нечётная ISO — зелёная, чётная — красная.
 * Без аргумента — по московскому «сейчас».
 * @param {Date} [date]
 * @returns {'green'|'red'}
 */
export function getMelmkWeekType(date = moscowNow()) {
  const week = getIsoWeekNumber(date);
  return week % 2 === 1 ? 'green' : 'red';
}

/**
 * @param {Date} date
 */
export function getIsoWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export function weekTypeLabel(type) {
  return type === 'green' ? 'Зелёная' : type === 'red' ? 'Красная' : 'Текущая';
}

