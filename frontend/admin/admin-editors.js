/**
 * Редакторы админки: пары группы, преподаватели, кабинеты
 */

import { el, clear } from '../js/utils/dom.js';
import {
  listGroups, listTeachersAll, listRoomsAll, ensureCatalog,
  DAY_NAMES, DAY_SHORT, TYPE_LABELS, createLesson, genId, getPairTimesForDay,
} from '../js/models/schedule.js';
import { toast } from '../js/utils/toast.js';
import { pushAudit } from '../js/utils/audit.js';

/**
 * @param {HTMLElement} root
 * @param {object} ctx
 * @param {import('../js/models/schedule.js').ScheduleData} ctx.data
 * @param {(detect?: boolean) => Promise<void>} ctx.persist
 * @param {() => void} ctx.rerender
 */
export function renderScheduleEditor(root, ctx) {
  const { data, persist, rerender } = ctx;
  ensureCatalog(data);

  const wrap = el('div', 'adm-section');
  wrap.appendChild(el('h2', 'adm-section__title', 'Редактор расписания'));
  wrap.appendChild(el('p', 'adm-muted', 'Меняйте отдельные пары группы без Excel. Изменения сразу в локальном хранилище.'));

  const groups = listGroups(data);
  if (!groups.length) {
    wrap.appendChild(el('p', 'empty-state__text', 'Нет групп. Загрузите Excel во вкладке «Данные» или добавьте группу ниже.'));
    wrap.appendChild(renderAddGroup(data, persist, rerender));
    root.appendChild(wrap);
    return;
  }

  let group = data.settings._adminEditGroup || groups[0];
  if (!data.groups[group]) group = groups[0];
  let day = String(data.settings._adminEditDay || Math.min(new Date().getDay() || 1, 6));

  const controls = el('div', 'adm-form adm-editor-controls');
  const gField = el('div', 'field');
  gField.appendChild(el('label', '', 'Группа'));
  const gSel = document.createElement('select');
  groups.forEach((g) => {
    const o = document.createElement('option');
    o.value = g;
    o.textContent = g;
    if (g === group) o.selected = true;
    gSel.appendChild(o);
  });
  gField.appendChild(gSel);
  controls.appendChild(gField);

  const dField = el('div', 'field');
  dField.appendChild(el('label', '', 'День'));
  const dSel = document.createElement('select');
  for (let d = 1; d <= 6; d++) {
    const o = document.createElement('option');
    o.value = String(d);
    o.textContent = DAY_NAMES[d];
    if (String(d) === day) o.selected = true;
    dSel.appendChild(o);
  }
  dField.appendChild(dSel);
  controls.appendChild(dField);
  wrap.appendChild(controls);
  wrap.appendChild(renderAddGroup(data, persist, rerender));

  const list = el('div', 'adm-lesson-list');
  wrap.appendChild(list);

  const paint = () => {
    group = gSel.value;
    day = dSel.value;
    data.settings._adminEditGroup = group;
    data.settings._adminEditDay = day;
    clear(list);
    const lessons = [...(data.groups[group]?.days?.[day] || [])]
      .sort((a, b) => a.pair - b.pair);
    if (!lessons.length) {
      list.appendChild(el('p', 'adm-muted', 'Пар нет — добавьте первую.'));
    }
    lessons.forEach((lesson) => {
      list.appendChild(renderLessonEditorCard(lesson, {
        onSave: async (patch) => {
          Object.assign(lesson, patch);
          await persist(true);
          pushAudit('edit_lesson', `${group} · ${DAY_SHORT[Number(day)]} · пара ${lesson.pair}`);
          toast('Пара сохранена', 'success');
          paint();
        },
        onDelete: async () => {
          if (!confirm(`Удалить пару «${lesson.subject || lesson.pair}»?`)) return;
          const arr = data.groups[group].days[day];
          const i = arr.findIndex((l) => l.id === lesson.id);
          if (i >= 0) arr.splice(i, 1);
          await persist(true);
          pushAudit('delete_lesson', `${group} · пара ${lesson.pair}`);
          toast('Пара удалена', 'success');
          paint();
        },
      }));
    });

    const addBtn = el('button', 'btn btn--primary btn--block', '+ Добавить пару');
    addBtn.type = 'button';
    addBtn.style.marginTop = '12px';
    addBtn.addEventListener('click', async () => {
      if (!data.groups[group].days[day]) data.groups[group].days[day] = [];
      const pairs = data.groups[group].days[day].map((l) => l.pair);
      const nextPair = pairs.length ? Math.max(...pairs) + 1 : 1;
      const slot = getPairTimesForDay(day).find((s) => s.pair === nextPair)
        || getPairTimesForDay(day)[0]
        || { start: '08:00', end: '09:00' };
      const lesson = createLesson({
        pair: nextPair,
        start: slot.start,
        end: slot.end,
        subject: 'Новая пара',
      });
      data.groups[group].days[day].push(lesson);
      await persist(true);
      pushAudit('add_lesson', `${group} · ${DAY_SHORT[Number(day)]} · пара ${nextPair}`);
      toast('Пара добавлена', 'success');
      paint();
    });
    list.appendChild(addBtn);
  };

  gSel.addEventListener('change', paint);
  dSel.addEventListener('change', paint);
  paint();
  root.appendChild(wrap);
}

function renderAddGroup(data, persist, rerender) {
  const box = el('div', 'adm-inline-add');
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Новая группа, напр. ИС-21';
  input.style.fontSize = '16px';
  const btn = el('button', 'btn btn--outline', 'Добавить группу');
  btn.type = 'button';
  btn.addEventListener('click', async () => {
    const name = input.value.trim();
    if (!name) return toast('Введите название группы', 'warn');
    if (data.groups[name]) return toast('Такая группа уже есть', 'warn');
    data.groups[name] = { name, days: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] } };
    await persist(false);
    pushAudit('add_group', name);
    toast(`Группа ${name} создана`, 'success');
    rerender();
  });
  box.append(input, btn);
  return box;
}

/**
 * @param {import('../js/models/schedule.js').Lesson} lesson
 * @param {{ onSave: (p: object) => void, onDelete: () => void }} handlers
 */
function renderLessonEditorCard(lesson, handlers) {
  const card = el('article', 'adm-card adm-lesson-card');
  card.appendChild(el('div', 'adm-card__title', `Пара ${lesson.pair}`));

  const form = el('div', 'adm-form');
  const fields = [
    ['pair', 'Номер', 'number', lesson.pair],
    ['start', 'Начало', 'time', lesson.start],
    ['end', 'Конец', 'time', lesson.end],
    ['subject', 'Предмет', 'text', lesson.subject],
    ['teacher', 'Преподаватель', 'text', lesson.teacher],
    ['room', 'Кабинет', 'text', lesson.room],
  ];
  /** @type {Record<string, HTMLInputElement|HTMLSelectElement>} */
  const inputs = {};
  fields.forEach(([key, label, type, val]) => {
    const f = el('div', 'field');
    f.appendChild(el('label', '', label));
    const inp = document.createElement('input');
    inp.type = type;
    inp.value = val == null ? '' : String(val);
    inp.style.fontSize = '16px';
    if (type === 'number') inp.min = '1';
    inputs[key] = inp;
    f.appendChild(inp);
    form.appendChild(f);
  });

  const typeField = el('div', 'field');
  typeField.appendChild(el('label', '', 'Тип'));
  const typeSel = document.createElement('select');
  Object.entries(TYPE_LABELS).forEach(([k, lab]) => {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = lab;
    if (k === lesson.type) o.selected = true;
    typeSel.appendChild(o);
  });
  inputs.type = typeSel;
  typeField.appendChild(typeSel);
  form.appendChild(typeField);

  const actions = el('div', 'adm-card__actions');
  const save = el('button', 'btn btn--primary', 'Сохранить');
  save.type = 'button';
  save.addEventListener('click', () => {
    handlers.onSave({
      pair: Number(inputs.pair.value) || lesson.pair,
      start: inputs.start.value,
      end: inputs.end.value,
      subject: inputs.subject.value.trim(),
      teacher: inputs.teacher.value.trim(),
      room: inputs.room.value.trim(),
      type: typeSel.value,
    });
  });
  const del = el('button', 'btn btn--ghost', 'Удалить');
  del.type = 'button';
  del.addEventListener('click', () => handlers.onDelete());
  actions.append(save, del);
  form.appendChild(actions);
  card.appendChild(form);
  return card;
}

/**
 * @param {HTMLElement} root
 * @param {object} ctx
 */
export function renderTeachersEditor(root, ctx) {
  const { data, persist, rerender } = ctx;
  ensureCatalog(data);
  const wrap = el('div', 'adm-section');
  wrap.appendChild(el('h2', 'adm-section__title', 'Преподаватели'));
  wrap.appendChild(el('p', 'adm-muted', 'Справочник + преподаватели из расписания. Удаление из справочника не стирает пары.'));

  const add = el('div', 'adm-inline-add');
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'ФИО преподавателя';
  input.style.fontSize = '16px';
  const btn = el('button', 'btn btn--primary', 'Добавить');
  btn.type = 'button';
  btn.addEventListener('click', async () => {
    const name = input.value.trim();
    if (!name) return toast('Введите ФИО', 'warn');
    if (listTeachersAll(data).includes(name)) return toast('Уже есть', 'warn');
    data.catalog.teachers.push(name);
    await persist(false);
    pushAudit('add_teacher', name);
    toast('Добавлен', 'success');
    rerender();
  });
  add.append(input, btn);
  wrap.appendChild(add);

  const list = el('div', 'adm-chip-edit-list');
  listTeachersAll(data).forEach((name) => {
    const row = el('div', 'adm-chip-row');
    row.appendChild(el('span', 'adm-chip-row__name', name));
    const inCatalog = data.catalog.teachers.includes(name);
    if (inCatalog) {
      const rm = el('button', 'btn btn--ghost', 'Удалить');
      rm.type = 'button';
      rm.addEventListener('click', async () => {
        data.catalog.teachers = data.catalog.teachers.filter((t) => t !== name);
        await persist(false);
        pushAudit('remove_teacher', name);
        toast('Удалён из справочника', 'info');
        rerender();
      });
      row.appendChild(rm);
    } else {
      row.appendChild(el('span', 'adm-muted', 'из расписания'));
    }
    list.appendChild(row);
  });
  wrap.appendChild(list);
  root.appendChild(wrap);
}

/**
 * @param {HTMLElement} root
 * @param {object} ctx
 */
export function renderRoomsEditor(root, ctx) {
  const { data, persist, rerender } = ctx;
  ensureCatalog(data);
  const wrap = el('div', 'adm-section');
  wrap.appendChild(el('h2', 'adm-section__title', 'Кабинеты'));
  wrap.appendChild(el('p', 'adm-muted', 'Справочник аудиторий. Можно добавлять и удалять.'));

  const add = el('div', 'adm-inline-add');
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Номер / название кабинета';
  input.style.fontSize = '16px';
  const btn = el('button', 'btn btn--primary', 'Добавить');
  btn.type = 'button';
  btn.addEventListener('click', async () => {
    const name = input.value.trim();
    if (!name) return toast('Введите кабинет', 'warn');
    if (listRoomsAll(data).includes(name)) return toast('Уже есть', 'warn');
    data.catalog.rooms.push(name);
    await persist(false);
    pushAudit('add_room', name);
    toast('Добавлен', 'success');
    rerender();
  });
  add.append(input, btn);
  wrap.appendChild(add);

  const list = el('div', 'adm-chip-edit-list');
  listRoomsAll(data).forEach((name) => {
    const row = el('div', 'adm-chip-row');
    row.appendChild(el('span', 'adm-chip-row__name', name));
    const inCatalog = data.catalog.rooms.includes(name);
    if (inCatalog) {
      const rm = el('button', 'btn btn--ghost', 'Удалить');
      rm.type = 'button';
      rm.addEventListener('click', async () => {
        data.catalog.rooms = data.catalog.rooms.filter((r) => r !== name);
        await persist(false);
        pushAudit('remove_room', name);
        toast('Удалён из справочника', 'info');
        rerender();
      });
      row.appendChild(rm);
    } else {
      row.appendChild(el('span', 'adm-muted', 'из расписания'));
    }
    list.appendChild(row);
  });
  wrap.appendChild(list);
  root.appendChild(wrap);
}

// suppress unused
void genId;
