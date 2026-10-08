/**
 * Проверки прогресса пары (шаг 4). Запуск: node --experimental-vm-modules
 * или импорт в браузерной консоли.
 */

import { lessonProgress, formatCountdown, clamp } from './time.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** Пара 08:45–09:45, сейчас 09:21 → ~60% */
{
  const now = new Date();
  now.setHours(9, 21, 0, 0);
  const { progress, remainingMs } = lessonProgress('08:45', '09:45', now);
  assert(Math.abs(progress - 0.6) < 0.02, `progress≈0.6 got ${progress}`);
  assert(Math.abs(remainingMs - 24 * 60 * 1000) < 2000, `remaining≈24min got ${remainingMs}`);
}

assert(formatCountdown(45) === '45 сек', 'sec');
assert(formatCountdown(24 * 60).includes('24'), '24 min');
assert(formatCountdown(65 * 60).includes('ч'), 'hours');
assert(clamp(1.5) === 1 && clamp(-1) === 0, 'clamp');

console.log('time.test.js: OK');
