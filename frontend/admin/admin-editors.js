/**
 * Редакторы админки: пары группы, преподаватели, кабинеты
 */

import { el, clear } from '../js/utils/dom.js';
import {
  listGroups, listTeachersAll, listRoomsAll, ensureCatalog,
  TYPE_LABELS, createLesson,
} from '../js/models/schedule.js';
import { toast } from '../js/utils/toast.js';
import { pushAudit } from '../js/utils/audit.js';
import { getAdminToken, setAdminToken } from '../js/api/config.js';
import { fetchAndMergeDay, saveDatedLesson } from '../js/api/overrides.js';
import { removeDayOverride } from '../js/api/client.js';
import { toDateKey } from '../js/models/substitutions.js';

/**
 * @param {HTMLElement} root
 * @param {object} ctx
 * @param {import('../js/models/schedule.js').ScheduleData} ctx.data
 * @param {(detect?: boolean) => Promise<void>} ctx.persist
 * @param {() => void} ctx.rerender
 */
export function renderScheduleEditor(root, ctx) {
  const { data } = ctx;
  const wrap = el('div', 'adm-section');
  wrap.appendChild(el('h2', 'adm-section__title', 'Редактор расписания'));
  wrap.appendChild(el('p', 'adm-muted', 'Изменения и отмена пар сохраняются на сервере для выбранной группы и даты. Расписание других дней не меняется.'));
  const groups = listGroups(data);
  if (!groups.length) {
    wrap.appendChild(el('p', 'adm-muted', 'Загрузите расписание с сервера в разделе «Данные».'));
    root.appendChild(wrap);
    return;
  }
  const controls = el('div', 'adm-form adm-editor-controls');
  const groupSelect = document.createElement('select');
  for (const group of groups) {
    const option = document.createElement('option');
    option.value = group;
    option.textContent = group;
    option.selected = group === data.settings._adminEditGroup;
    groupSelect.appendChild(option);
  }
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.value = toDateKey();
  for (const [label, input] of [['Группа', groupSelect], ['Дата изменения', dateInput]]) {
    const field = el('div', 'field');
    field.append(el('label', '', label), input);
    controls.appendChild(field);
  }
  wrap.appendChild(controls);
  const tokenField = el('div', 'field');
  const tokenInput = document.createElement('input');
  tokenInput.type = 'password';
  tokenInput.autocomplete = 'off';
  tokenInput.value = getAdminToken();
  tokenInput.placeholder = 'Токен администратора сервера';
  tokenInput.addEventListener('change', () => setAdminToken(tokenInput.value.trim()));
  tokenField.append(el('label', '', 'Токен API'), tokenInput);
  wrap.appendChild(tokenField);
  const status = el('p', 'adm-muted');
  status.setAttribute('role', 'status');
  wrap.appendChild(status);
  const list = el('div', 'adm-lesson-list');
  wrap.appendChild(list);
  let generation = 0;
  let busy = false;
  let lessons = [];

  const action = async (fn) => {
    if (busy) return;
    busy = true;
    groupSelect.disabled = dateInput.disabled = true;
    status.textContent = 'Сохранение на сервере…';
    setAdminToken(tokenInput.value.trim());
    try {
      await fn();
      status.textContent = 'Сохранено на сервере. Изменения доступны всем пользователям.';
      toast('Изменения сохранены на сервере', 'success');
      await paint(false);
    } catch (error) {
      status.textContent = `Не сохранено: ${error.message}`;
      toast(status.textContent, 'error', 6000);
    } finally {
      busy = false;
      groupSelect.disabled = dateInput.disabled = false;
    }
  };
  const card = (lesson, isNew = false) => renderLessonEditorCard(lesson, {
    isNew,
    dated: true,
    onSave: (patch) => action(async () => {
      lessons = await saveDatedLesson(groupSelect.value, dateInput.value, isNew ? patch.pair : lesson.pair, {
        subject: patch.subject, teacher: patch.teacher, room: patch.room, cancelled: false,
      });
      pushAudit('edit_lesson', `${groupSelect.value} · ${dateInput.value} · пара ${patch.pair}`);
    }),
    onDelete: () => {
      if (isNew) { paint(false); return; }
      if (!confirm(`Отменить пару ${lesson.pair} на ${dateInput.value}?`)) return;
      return action(async () => {
        lessons = await saveDatedLesson(groupSelect.value, dateInput.value, lesson.pair, { cancelled: true });
        pushAudit('cancel_lesson', `${groupSelect.value} · ${dateInput.value} · пара ${lesson.pair}`);
      });
    },
  });
  const paint = async (load = true) => {
    const id = ++generation;
    const group = groupSelect.value;
    const dateKey = dateInput.value;
    data.settings._adminEditGroup = group;
    clear(list);
    if (!dateKey) { status.textContent = 'Выберите дату'; return; }
    if (load) {
      status.textContent = 'Загрузка расписания с сервера…';
      try {
        const day = new Date(`${dateKey}T12:00:00`).getDay() || 7;
        const result = await fetchAndMergeDay(group, dateKey, [], day);
        if (id !== generation) return;
        lessons = result.lessons;
        status.textContent = getAdminToken() ? 'Расписание загружено с сервера.' : 'Для сохранения укажите токен API.';
      } catch (error) {
        if (id === generation) status.textContent = `Не удалось загрузить: ${error.message}`;
        return;
      }
    }
    if (!lessons.length) list.appendChild(el('p', 'adm-muted', 'На эту дату пар нет.'));
    lessons.forEach((lesson) => list.appendChild(card(lesson)));
    const add = el('button', 'btn btn--primary', '+ Добавить пару');
    add.type = 'button';
    add.addEventListener('click', () => {
      if (busy) return;
      const nextPair = Array.from({length:12}, (_, i) => i + 1).find((pair) => !lessons.some((l) => l.pair === pair));
      if (!nextPair) return toast('Все 12 номеров пар заняты', 'warn');
      list.insertBefore(card(createLesson({pair:nextPair, subject:''}), true), add);
      add.disabled = true;
    });
    list.appendChild(add);
    const restore = el('button', 'btn btn--outline', 'Восстановить расписание на эту дату');
    restore.type = 'button';
    restore.addEventListener('click', () => {
      if (!confirm('Убрать все изменения и отмены на выбранную дату?')) return;
      action(async () => {
        if (!getAdminToken()) throw new Error('Укажите токен API');
        await removeDayOverride(dateKey, group);
        const day = new Date(`${dateKey}T12:00:00`).getDay() || 7;
        lessons = (await fetchAndMergeDay(group, dateKey, [], day)).lessons;
      });
    });
    list.appendChild(restore);
  };
  groupSelect.addEventListener('change', () => paint());
  dateInput.addEventListener('change', () => paint());
  root.appendChild(wrap);
  paint();
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
    ...(!handlers.dated ? [['start', 'Начало', 'time', lesson.start], ['end', 'Конец', 'time', lesson.end]] : []),
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
    if (type === 'number') { inp.min = '1'; inp.max = '12'; inp.readOnly = !!handlers.dated && !handlers.isNew; }
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
  if (!handlers.dated) form.appendChild(typeField);

  const actions = el('div', 'adm-card__actions');
  const save = el('button', 'btn btn--primary', 'Сохранить');
  save.type = 'button';
  save.addEventListener('click', () => {
    handlers.onSave({
      pair: Number(inputs.pair.value) || lesson.pair,
      start: inputs.start?.value || lesson.start,
      end: inputs.end?.value || lesson.end,
      subject: inputs.subject.value.trim(),
      teacher: inputs.teacher.value.trim(),
      room: inputs.room.value.trim(),
      type: typeSel.value,
    });
  });
  const del = el('button', 'btn btn--ghost', handlers.dated && !handlers.isNew ? 'Отменить пару на эту дату' : 'Удалить');
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


