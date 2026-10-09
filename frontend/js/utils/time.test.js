/**
 * Проверки прогресса пары и точного countdown.
 */

import { lessonProgress, formatCountdown, clamp } from './time.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** Пара 08:45–09:45, сейчас 09:21:00 → 60%, осталось 24 мин */
{
  const now = new Date();
  now.setHours(9, 21, 0, 0);
  const { progress, remainingMs } = lessonProgress('08:45', '09:45', now);
  assert(Math.abs(progress - 0.6) < 0.02, `progress≈0.6 got ${progress}`);
  assert(Math.abs(remainingMs - 24 * 60 * 1000) < 2000, `remaining≈24min got ${remainingMs}`);
}

/** С секундами: 09:21:30 → осталось 23:30 */
{
  const now = new Date();
  now.setHours(9, 21, 30, 0);
  const { remainingMs } = lessonProgress('08:45', '09:45', now);
  const sec = Math.round(remainingMs / 1000);
  assert(sec === 23 * 60 + 30, `remaining sec got ${sec}`);
}

assert(formatCountdown(45) === '45 сек', 'sec');
assert(formatCountdown(16 * 60 + 42) === '16 мин 42 сек', 'min+sec');
assert(formatCountdown(65 * 60 + 3).includes('ч'), 'hours');
assert(clamp(1.5) === 1 && clamp(-1) === 0, 'clamp');

console.log('time.test.js: OK');
