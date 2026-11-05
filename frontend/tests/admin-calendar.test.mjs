import { defaultBellsConfig } from '../js/models/bells.js';
import { installBellState } from '../js/models/bell-state.js';
installBellState({...defaultBellsConfig(),curators:[],exceptions:{}});
import assert from 'node:assert/strict';
import { fetchCalendarSchedule } from '../js/api/sync.js';
import { buildFromApi } from '../js/api/adapt.js';
import { fetchAndMergeDay, saveDatedLesson } from '../js/api/overrides.js';
import { applySubstitutions, clearServerDayCache } from '../js/models/substitutions.js';
import { filterByWeek } from '../js/models/schedule.js';
import { getMelmkWeekType } from '../js/models/bells.js';
import { renderMonthView } from '../js/views/month.js';
import { renderDayView } from '../js/views/day.js';
import { renderScheduleEditor } from '../admin/admin-editors.js';
import { setAdminToken } from '../js/api/config.js';

// Minimal DOM for exercising the actual editor and calendar event handlers in Node.
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.events = {}; this.style = {}; this.dataset = {}; this.className = ''; this._text = ''; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(' '); }
  set textContent(value) { this._text = value; this.children = []; }
  get value() { return this._value ?? (this.tag === 'select' ? (this.children.find((c) => c.selected) || this.children[0])?.value : '') ?? ''; }
  set value(value) { this._value = value; }
  get firstChild() { return this.children[0]; }
  get classList() { return { add: (...names) => { this.className += ' ' + names.join(' '); }, remove: (name) => { this.className = this.className.split(' ').filter((x) => x !== name).join(' '); } }; }
  appendChild(child) { child.parent = this; this.children.push(child); return child; }
  append(...children) { children.forEach((c) => this.appendChild(c)); }
  removeChild(child) { this.children.splice(this.children.indexOf(child), 1); }
  remove() { this.parent?.removeChild(this); }
  insertBefore(child, before) { child.parent = this; this.children.splice(this.children.indexOf(before), 0, child); }
  setAttribute(key, value) { this[key] = value; }
  addEventListener(event, fn) { (this.events[event] ||= []).push(fn); }
  async fire(event = 'click') { if (!this.disabled) await Promise.all((this.events[event] || []).map((fn) => fn())); await settle(); }
  all(predicate) { return this.children.flatMap((c) => [...(predicate(c) ? [c] : []), ...c.all(predicate)]); }
  querySelector(selector) { return this.all((c) => selector.startsWith('.') ? c.className.split(' ').includes(selector.slice(1)) : c.tag === selector)[0] || null; }
}
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(setImmediate); };
globalThis.document = { createElement: (tag) => new Element(tag), body: new Element('body'), getElementById: () => null };
globalThis.requestAnimationFrame = (fn) => fn();
globalThis.confirm = () => true;
const memory = new Map();
globalThis.localStorage = { getItem: (key) => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: (key) => memory.delete(key) };
const templates = {
  green: [1,2,3].map((pair) => ({ pair, subject: `Зелёный предмет ${pair}`, teacher: 'Учитель', room: '101' })),
  red: [{pair:1, subject:'Красный предмет', teacher:'Учитель', room:'202'}],
};
const overrides = new Map();
const writes = [];
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url);
  const reply = (data, status = 200) => new Response(JSON.stringify(data), { status });
  if (u.pathname === '/api/schedule') {
    const week = u.searchParams.get('week');
    return reply({group:'Группа',week,days:[{day:'Вторник',pairs:templates[week]}]});
  }
  const match = u.pathname.match(/^\/api\/admin\/schedule\/([\d-]+)\/pairs\/(\d+)$/);
  const date = match?.[1] || u.searchParams.get('date');
  if (match) {
    writes.push({ date, pair:Number(match[2]), init });
    if (init.headers['x-admin-token'] !== 'test-only') return reply({detail:'неверный токен'}, 401);
    overrides.set(`${date}:${match[2]}`, JSON.parse(init.body));
  }
  const week = getMelmkWeekType(new Date(`${date}T12:00:00`));
  const pairs = new Map(templates[week].map((p) => [p.pair, {...p}]));
  for (const [key, patch] of overrides) {
    if (!key.startsWith(`${date}:`)) continue;
    const pair = Number(key.split(':')[1]);
    if (patch.cancelled) pairs.delete(pair); else pairs.set(pair, {pair,...patch});
  }
  return reply({ group:'Группа',date,day:'Вторник',week,custom:[...overrides.keys()].some((k) => k.startsWith(`${date}:`)),pairs:[...pairs.values()] });
};

const full = await fetchCalendarSchedule('Группа');
const data = buildFromApi(['Группа'], [full]);
const tuesday = data.groups['Группа'].days[2];
assert.equal(filterByWeek(tuesday,'green').length,3);
assert.equal(filterByWeek(tuesday,'red').length,1);
const monthRoot = new Element('main');
const dayRoot = new Element('main');
let picked;
renderMonthView(monthRoot, data, 'Группа', {year:2026,month:10,onPickDay:(day,date) => {
  picked = date;
  renderDayView(dayRoot, data, 'Группа', day, date);
}});
const dayCell = (n) => monthRoot.all((c) => c.tag === 'button' && c.children[0]?._text === String(n))[0];
assert.match(dayCell(3).textContent, /Зелёная неделя/);
assert.match(dayCell(10).textContent, /Красная неделя/);
await dayCell(10).fire();
assert.equal(picked.getDate(),10);
assert.match(dayRoot.textContent, /Красная неделя/);
assert.match(dayRoot.textContent, /Красный предмет/);
assert.doesNotMatch(dayRoot.textContent, /Зелёный предмет/);
await dayCell(3).fire();
assert.match(dayRoot.textContent,/Зелёный предмет 3/);

// Real UI events: cancel two separate pairs, then read as another viewer.
setAdminToken('test-only');
const editor = new Element('main');
renderScheduleEditor(editor, {data});
await settle();
const dateInput = editor.all((c) => c.type === 'date')[0];
dateInput.value = '2026-11-03';
await dateInput.fire('change');
const cancel = () => editor.all((c) => c.tag === 'button' && c.textContent === 'Отменить пару на эту дату')[0];
await cancel().fire();
await cancel().fire();
assert.deepEqual(writes.map((w) => w.pair), [1,2]);
assert.ok(writes.every((w) => w.date === '2026-11-03' && w.init.method === 'PUT'));
clearServerDayCache();
const otherViewer = await fetchAndMergeDay('Группа','2026-11-03',[],2);
assert.deepEqual(otherViewer.lessons.map((l) => l.pair),[3]);
assert.equal(applySubstitutions(tuesday,data,'Группа',2,new Date(2026,10,3)).length,1);
assert.equal((await fetchAndMergeDay('Группа','2026-11-17',[],2)).lessons.length,3);
await saveDatedLesson('Группа','2026-11-10',1,{subject:'Новый предмет',teacher:'Новый преподаватель',room:'305'});
clearServerDayCache();
const editedViewer = await fetchAndMergeDay('Группа','2026-11-10',[],2);
assert.equal(editedViewer.lessons[0].subject,'Новый предмет');
assert.equal(editedViewer.lessons[0].room,'305');
assert.equal((await fetchAndMergeDay('Группа','2026-11-24',[],2)).lessons[0].subject,'Красный предмет');

// Calendar navigation reports the actual visible month, so hydration follows it.
let visibleMonth;
const navigation = new Element('main');
renderMonthView(navigation,data,'Группа',{year:2026,month:11,onChangeMonth:(year,month) => { visibleMonth = [year,month]; }});
await navigation.all((c) => c['aria-label'] === 'Следующий месяц')[0].fire();
assert.deepEqual(visibleMonth,[2027,0]);
await navigation.all((c) => c['aria-label'] === 'Предыдущий месяц')[0].fire();
assert.deepEqual(visibleMonth,[2026,11]);

// Rejected saves must keep the form and public cache unchanged.
await fetchAndMergeDay('Группа','2026-11-03',[],2);
editor.all((c) => c.type === 'password')[0].value = 'bad-token';
await cancel().fire();
assert.match(editor.textContent,/Не сохранено: неверный токен/);
assert.equal(editor.all((c) => c.tag === 'button' && c.textContent === 'Отменить пару на эту дату').length,1);
setAdminToken('bad-token');
await assert.rejects(saveDatedLesson('Группа','2026-11-03',3,{cancelled:true}), /неверный токен/);
assert.equal(applySubstitutions(tuesday,data,'Группа',2,new Date(2026,10,3)).length,1);
setAdminToken('');
const writesBefore = writes.length;
await assert.rejects(saveDatedLesson('Группа','2026-11-03',3,{cancelled:true}), /токен API/);
assert.equal(writes.length,writesBefore);
setAdminToken('test-only');
await saveDatedLesson('Группа','2026-11-03',3,{cancelled:true});
assert.equal(applySubstitutions(tuesday,data,'Группа',2,new Date(2026,10,3)).length,0);
for (const key of [...overrides.keys()]) if (key.startsWith('2026-11-03:')) overrides.delete(key);
await fetchAndMergeDay('Группа','2026-11-03',[],2);
assert.equal(applySubstitutions(tuesday,data,'Группа',2,new Date(2026,10,3)).length,3);
console.log('admin-calendar.test.mjs: OK');
