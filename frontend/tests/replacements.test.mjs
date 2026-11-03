import assert from 'node:assert/strict';
import { mergeDayScheduleOut } from '../js/api/overrides.js';
import { createLesson } from '../js/models/schedule.js';

const base = [1,2,3,4,5].map((pair) => createLesson({
  pair,subject:`Предмет ${pair}`,teacher:`Учитель ${pair}`,room:String(200+pair),week:'odd',
}));
const pairs = base.slice(0,3).map(({pair,subject,teacher,room}) => ({pair,subject,teacher,room}));

// Cancelling pairs 4 and 5 makes the day custom, but does not replace pairs 1–3.
const afterCancellation = mergeDayScheduleOut({custom:true,pairs},base,2);
assert.deepEqual(afterCancellation.map((l) => l.pair),[1,2,3]);
assert.ok(afterCancellation.every((l) => !l.replaced && !l.original));
assert.deepEqual(afterCancellation.map((l) => l.id),base.slice(0,3).map((l) => l.id));

// One actual edit must mark just that pair, preserving its original details.
const edited = pairs.map((p) => p.pair === 2 ? {...p,teacher:'Другой учитель'} : p);
const afterEdit = mergeDayScheduleOut({custom:true,pairs:edited},base,2);
assert.deepEqual(afterEdit.filter((l) => l.replaced).map((l) => l.pair),[2]);
assert.equal(afterEdit[1].original.teacher,'Учитель 2');
assert.equal(afterEdit[1].teacher,'Другой учитель');

// Newly added slots are replacements; a normal server read without a base is not.
const added = mergeDayScheduleOut({custom:true,pairs:[...pairs,{pair:6,subject:'Дополнительная пара',teacher:'',room:''}]},base,2);
assert.deepEqual(added.filter((l) => l.replaced).map((l) => l.pair),[6]);
assert.ok(mergeDayScheduleOut({custom:false,pairs},[],2).every((l) => !l.replaced));
console.log('replacements.test.mjs: OK');
