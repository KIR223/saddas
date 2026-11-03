import assert from 'node:assert/strict';
import { defaultBellsConfig, getBellsForDay, getCuratorForDay, computeBreaks, loadBellsConfig, saveBellsConfig, validateBellSlots } from './bells.js';
import { getPairTimesForDay, LEGACY_PAIR_TIMES, PAIR_TIMES_MON_THU, migrateScheduleBells } from './schedule.js';
import { applyApiBells, lessonsFromDaySchedule } from '../api/adapt.js';
import { rowsToSchedule } from '../parser/mapper.js';
import { findNowNext } from '../utils/time.js';
import { LS } from '../config.js';

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, value),
};
const expected = {
  1: [['08:45','09:45'],['09:50','10:50'],['10:55','11:55'],['12:25','13:25'],['13:30','14:30']],
  4: [['09:15','10:15'],['10:20','11:20'],['11:25','12:25'],['12:55','13:55'],['14:00','15:00']],
  2: [['08:30','09:30'],['09:35','10:35'],['10:40','11:40'],['12:10','13:10'],['13:15','14:15']],
};
expected[3] = expected[5] = expected[2];
for (const day of [1,2,3,4,5]) {
  const slots = getBellsForDay(day);
  assert.deepEqual(slots.map((s) => [s.start,s.end]), expected[day]);
  assert.deepEqual(getPairTimesForDay(String(day)), slots);
  assert.equal(validateBellSlots(slots).ok, true);
  assert.deepEqual(computeBreaks(slots).map((b) => b.minutes), [5,5,30,5]);
  const lessons = lessonsFromDaySchedule({pairs: slots.map((s) => ({pair:s.pair,subject:'Тест'}))}, day);
  assert.deepEqual(lessons.map((s) => [s.start,s.end]), expected[day]);
  const imported = rowsToSchedule([['Группа',day,1,'Тест']], {group:0,day:1,pair:2,subject:3});
  assert.equal(imported.groups['Группа'].days[day][0].start, slots[0].start);
}
assert.equal(getCuratorForDay(1).subject, 'Разговор о важном');
assert.equal(getCuratorForDay(4).subject, 'Россия — мои горизонты');
assert.equal(getCuratorForDay(4).start, '08:30');
assert.equal(getCuratorForDay(4).end, '09:10');
assert.equal(getCuratorForDay(2), null);
localStorage.setItem(LS.bells, JSON.stringify({regular:LEGACY_PAIR_TIMES,monThu:PAIR_TIMES_MON_THU}));
assert.equal(loadBellsConfig().regular[0].start, '08:30');
assert.equal(loadBellsConfig().thursday[0].start, '09:15');
saveBellsConfig({curator:{enabled:false}});
assert.equal(getCuratorForDay(4), null);
memory.clear();
applyApiBells({kind:'regular',pairs:getPairTimesForDay(2)});
assert.equal(loadBellsConfig().monThu[0].start, '08:45');
assert.equal(loadBellsConfig().thursday[0].start, '09:15');
applyApiBells({kind:'regular',date:'2026-11-05',pairs:getPairTimesForDay(2)});
assert.equal(loadBellsConfig().shortDay[0].end, '08:40');
const data = {groups:{G:{days:{4:[{...PAIR_TIMES_MON_THU[0]},{pair:2,start:'10:30',end:'11:30'}]}}},settings:{pairTimes:LEGACY_PAIR_TIMES}};
migrateScheduleBells(data);
assert.equal(data.groups.G.days[4][0].start, '09:15');
assert.equal(data.groups.G.days[4][1].start, '10:30');
assert.equal(data.settings.pairTimes[0].start, '08:30');
const before = JSON.stringify(data);
migrateScheduleBells(data);
assert.equal(JSON.stringify(data), before);
assert.equal(defaultBellsConfig().thursday[4].end, '15:00');
console.log('bells.test.js: OK');
