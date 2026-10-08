/**
 * Админ: токен API, upload на сервер, экспорт, замены
 */

import { el, clear } from '../utils/dom.js';
import { exportJson, exportCsv, exportIcs, printSchedule } from '../export/export.js';
import { saveSchedule } from '../storage/store.js';
import { createLesson, DAY_NAMES, genId } from '../models/schedule.js';
import { toast } from '../utils/toast.js';
import { promptInstall } from '../utils/pwa.js';
import { getAdminToken, setAdminToken, apiOrigin } from '../api/config.js';

/**
 * @param {HTMLElement} root
 * @param {object} ctx
 * @param {import('../models/schedule.js').ScheduleData} ctx.data
 * @param {string} ctx.group
 * @param {(data: import('../models/schedule.js').ScheduleData) => void} ctx.onData
 * @param {() => void} ctx.onUploadClick
 * @param {() => void} [ctx.onRefresh]
 */
export function renderAdmin(root, ctx) {
  clear(root);
  const { data, group, onData } = ctx;

  root.appendChild(el('h2', 'section-title', 'Админ'));
  root.appendChild(el('p', 'now-widget__meta', `API: ${apiOrigin()}`));

  // Токен
  const tokenSection = el('section', 'stats-panel');
  tokenSection.appendChild(el('h3', 'section-title', 'Токен администратора'));
  const field = el('div', 'field');
  const label = el('label', '', 'x-admin-token');
  label.htmlFor = 'admin-token';
  const input = document.createElement('input');
  input.id = 'admin-token';
  input.type = 'password';
  input.autocomplete = 'off';
  input.placeholder = 'Токен с сервера';
  input.value = getAdminToken();
  field.append(label, input);

  const saveBtn = el('button', 'btn btn--primary btn--block', 'Сохранить токен');
  saveBtn.type = 'button';
  saveBtn.addEventListener('click', () => {
    setAdminToken(input.value.trim());
    data.settings.adminUnlocked = !!input.value.trim();
    saveSchedule(data, { detectChanges: false, keepPrev: false });
    toast(input.value.trim() ? 'Токен сохранён' : 'Токен очищен', 'success');
    renderAdmin(root, ctx);
  });
  tokenSection.append(field, saveBtn);
  root.appendChild(tokenSection);

  if (!getAdminToken()) {
    root.appendChild(el('p', 'now-widget__meta', 'Без токена можно смотреть расписание; загрузка Excel на сервер недоступна.'));
  }

  // Загрузка на API
  const uploadSection = el('section', 'stats-panel');
  uploadSection.appendChild(el('h3', 'section-title', 'Импорт на сервер'));

  const fileBtn = el('button', 'btn btn--primary btn--block', 'Загрузить Excel (.xlsx)');
  fileBtn.type = 'button';
  fileBtn.disabled = !getAdminToken();
  fileBtn.addEventListener('click', () => ctx.onUploadClick());

  const refreshBtn = el('button', 'btn btn--outline btn--block', 'Обновить с сервера');
  refreshBtn.type = 'button';
  refreshBtn.style.marginTop = '8px';
  refreshBtn.addEventListener('click', () => ctx.onRefresh?.());

  uploadSection.append(fileBtn, refreshBtn);
  root.appendChild(uploadSection);

  // Экспорт (локальный снимок)
  const exp = el('section', 'stats-panel');
  exp.appendChild(el('h3', 'section-title', 'Экспорт (локальный кэш)'));
  const actions = [
    ['JSON', () => exportJson(data)],
    ['CSV (Excel)', () => exportCsv(data, group)],
    ['ICS календарь', () => exportIcs(data, group)],
    ['Печать', () => printSchedule()],
    ['Установить PWA', () => promptInstall()],
  ];
  for (const [labelText, fn] of actions) {
    const b = el('button', 'btn btn--outline btn--block', labelText);
    b.type = 'button';
    b.style.marginBottom = '8px';
    b.addEventListener('click', fn);
    exp.appendChild(b);
  }
  root.appendChild(exp);

  root.appendChild(renderSubstitutions(data, group, onData));
}

function renderSubstitutions(data, group, onData) {
  const section = el('section', 'stats-panel');
  section.appendChild(el('h3', 'section-title', 'Замены (локально)'));

  const g = data.groups[group];
  if (!g) {
    section.appendChild(el('p', '', 'Сначала выберите группу'));
    return section;
  }

  const daySel = document.createElement('select');
  for (let d = 1; d <= 6; d++) {
    const o = document.createElement('option');
    o.value = String(d);
    o.textContent = DAY_NAMES[d];
    daySel.appendChild(o);
  }

  const pairSel = document.createElement('select');
  const refreshPairs = () => {
    clear(pairSel);
    const lessons = g.days[daySel.value] || [];
    if (!lessons.length) {
      const o = document.createElement('option');
      o.value = '';
      o.textContent = 'Нет пар';
      pairSel.appendChild(o);
      return;
    }
    lessons.forEach((l) => {
      const o = document.createElement('option');
      o.value = l.id;
      o.textContent = `${l.pair}. ${l.subject}`;
      pairSel.appendChild(o);
    });
  };
  daySel.addEventListener('change', refreshPairs);
  refreshPairs();

  const subj = document.createElement('input');
  subj.placeholder = 'Новый предмет';
  const teacher = document.createElement('input');
  teacher.placeholder = 'Преподаватель';
  const room = document.createElement('input');
  room.placeholder = 'Кабинет';

  const applyBtn = el('button', 'btn btn--primary btn--block', 'Применить замену');
  applyBtn.type = 'button';
  applyBtn.style.marginTop = '8px';
  applyBtn.addEventListener('click', async () => {
    try {
      const id = pairSel.value;
      if (!id) {
        toast('Выберите пару', 'warn');
        return;
      }
      const day = daySel.value;
      const list = g.days[day];
      const idx = list.findIndex((l) => l.id === id);
      if (idx < 0) return;
      const orig = { ...list[idx] };
      const next = createLesson({
        ...orig,
        subject: subj.value.trim() || orig.subject,
        teacher: teacher.value.trim() || orig.teacher,
        room: room.value.trim() || orig.room,
        replaced: true,
        original: orig,
      });
      next.id = orig.id;
      list[idx] = next;
      data.substitutions.push({
        id: genId(),
        group,
        day,
        pair: orig.pair,
        lesson: next,
        createdAt: new Date().toISOString(),
      });
      await saveSchedule(data);
      onData(data);
      toast('Замена сохранена локально', 'success');
    } catch (e) {
      toast(e.message || 'Ошибка замены', 'error');
    }
  });

  const f1 = el('div', 'field');
  f1.append(el('label', '', 'День'), daySel);
  const f2 = el('div', 'field');
  f2.append(el('label', '', 'Пара'), pairSel);
  const f3 = el('div', 'field');
  f3.append(el('label', '', 'Предмет'), subj);
  const f4 = el('div', 'field');
  f4.append(el('label', '', 'Преподаватель'), teacher);
  const f5 = el('div', 'field');
  f5.append(el('label', '', 'Кабинет'), room);

  section.append(f1, f2, f3, f4, f5, applyBtn);
  section.appendChild(el('p', 'now-widget__meta', 'Замены только в кэше браузера, на сервер не уходят.'));
  return section;
}
