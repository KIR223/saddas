/**
 * Поиск, преподаватели, кабинеты
 */

import { el, clear } from '../utils/dom.js';
import {
  listTeachers, listRooms, lessonsByTeacher, lessonsByRoom, DAY_NAMES,
} from '../models/schedule.js';
import { renderLessonCard } from './lesson.js';
import { globalSearch, highlightParts, queryTokens } from '../utils/search.js';

/**
 * Глобальный поиск с группировкой и клавиатурной навигацией
 * @param {HTMLElement} root
 * @param {import('../models/schedule.js').ScheduleData} data
 * @param {string} [initialQuery]
 * @param {(input: HTMLInputElement) => void} [onReady]
 * @param {{ onOpenGroup?: (g: string) => void, onOpenTeacher?: (t: string) => void, onOpenRoom?: (r: string) => void }} [handlers]
 */
export function renderSearch(root, data, initialQuery = '', onReady, handlers = {}) {
  clear(root);
  root.appendChild(el('h2', 'section-title', 'Поиск'));

  const field = el('div', 'field');
  const label = el('label', '', 'Группы, преподаватели, кабинеты, предметы');
  label.htmlFor = 'search-input';
  const input = document.createElement('input');
  input.id = 'search-input';
  input.type = 'search';
  input.placeholder = 'Например: Тур, 305, ИС-21';
  input.autocomplete = 'off';
  input.value = initialQuery;
  input.style.fontSize = '16px';
  field.append(label, input);
  root.appendChild(field);

  const results = el('div');
  results.id = 'search-results';
  results.setAttribute('role', 'listbox');
  root.appendChild(results);

  /** @type {HTMLElement[]} */
  let focusables = [];
  let focusIdx = -1;

  const paintHighlight = (node, text, tokens) => {
    clear(node);
    highlightParts(text, tokens).forEach((p) => {
      if (p.hit) {
        const mark = el('mark', 'search-hit', p.text);
        node.appendChild(mark);
      } else {
        node.appendChild(document.createTextNode(p.text));
      }
    });
  };

  const run = () => {
    clear(results);
    focusables = [];
    focusIdx = -1;
    const q = input.value.trim();
    if (!q) {
      results.appendChild(el('p', 'empty-state__text', 'Введите запрос — или нажмите /'));
      return;
    }
    const tokens = queryTokens(q);
    const found = globalSearch(data, q);
    const sections = [
      ['Группы', found.groups],
      ['Преподаватели', found.teachers],
      ['Кабинеты', found.rooms],
      ['Предметы', found.subjects],
      ['Пары', found.lessons],
    ];
    let total = 0;
    for (const [, items] of sections) total += items.length;
    if (!total) {
      results.appendChild(el('p', 'empty-state__text', 'Ничего не найдено'));
      return;
    }

    for (const [title, items] of sections) {
      if (!items.length) continue;
      results.appendChild(el('h3', 'search-section-title', `${title} (${items.length})`));
      items.forEach((hit) => {
        const btn = el('button', 'search-result');
        btn.type = 'button';
        btn.setAttribute('role', 'option');
        const titleEl = el('div', 'search-result__title');
        paintHighlight(titleEl, hit.title, tokens);
        btn.appendChild(titleEl);
        if (hit.subtitle) btn.appendChild(el('div', 'search-result__sub', hit.subtitle));
        btn.addEventListener('click', () => {
          if (hit.type === 'group' && handlers.onOpenGroup) handlers.onOpenGroup(hit.title);
          else if (hit.type === 'teacher' && handlers.onOpenTeacher) handlers.onOpenTeacher(hit.title);
          else if (hit.type === 'room' && handlers.onOpenRoom) handlers.onOpenRoom(hit.title);
          else if (hit.group && handlers.onOpenGroup) handlers.onOpenGroup(hit.group);
        });
        results.appendChild(btn);
        focusables.push(btn);
      });
    }
  };

  input.addEventListener('input', run);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      input.value = '';
      run();
      input.blur();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!focusables.length) return;
      focusIdx = Math.min(focusables.length - 1, focusIdx + 1);
      focusables[focusIdx]?.focus({ preventScroll: true });
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!focusables.length) return;
      focusIdx = Math.max(0, focusIdx - 1);
      focusables[focusIdx]?.focus({ preventScroll: true });
    }
  });

  results.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.focus();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (e.key === 'ArrowDown') focusIdx = Math.min(focusables.length - 1, focusIdx + 1);
      else focusIdx = Math.max(0, focusIdx - 1);
      focusables[focusIdx]?.focus({ preventScroll: true });
    }
  });

  run();
  if (onReady) onReady(input);
}

/**
 * @param {HTMLElement} root
 * @param {import('../models/schedule.js').ScheduleData} data
 */
export function renderTeachers(root, data) {
  clear(root);
  root.appendChild(el('h2', 'section-title', 'Преподаватели'));
  const teachers = listTeachers(data);
  if (!teachers.length) {
    root.appendChild(el('p', 'empty-state__text', 'Нет данных'));
    return;
  }

  const filter = document.createElement('input');
  filter.type = 'search';
  filter.className = 'group-picker__search teachers-search';
  filter.placeholder = 'Фильтр по фамилии';
  filter.style.fontSize = '16px';
  root.appendChild(filter);

  const chips = el('div', 'chip-list');
  const detail = el('div');
  let active = teachers[0];
  let visible = teachers;

  const show = (name) => {
    active = name;
    chips.querySelectorAll('.chip').forEach((c) => {
      c.classList.toggle('is-active', c.textContent === name);
    });
    clear(detail);
    detail.appendChild(el('h3', 'section-title', name));
    const items = lessonsByTeacher(data, name);
    if (!items.length) {
      detail.appendChild(el('p', '', 'Пар нет'));
      return;
    }
    items.forEach(({ group, day, lesson }) => {
      const wrap = el('div');
      wrap.appendChild(el('div', 'now-widget__meta', `${group} · ${DAY_NAMES[day]}`));
      wrap.appendChild(renderLessonCard(lesson, { showGroup: group }));
      detail.appendChild(wrap);
    });
  };

  const paintChips = () => {
    clear(chips);
    visible.forEach((t) => {
      const chip = el('button', 'chip', t);
      chip.type = 'button';
      chip.addEventListener('click', () => show(t));
      chips.appendChild(chip);
    });
    if (visible.length) show(visible.includes(active) ? active : visible[0]);
  };

  filter.addEventListener('input', () => {
    const q = filter.value.trim().toLowerCase().replace(/ё/g, 'е');
    visible = q
      ? teachers.filter((t) => t.toLowerCase().replace(/ё/g, 'е').includes(q))
      : teachers;
    paintChips();
  });

  root.append(chips, detail);
  paintChips();
}

/**
 * @param {HTMLElement} root
 * @param {import('../models/schedule.js').ScheduleData} data
 */
export function renderRooms(root, data) {
  clear(root);
  root.appendChild(el('h2', 'section-title', 'Кабинеты'));
  const rooms = listRooms(data);
  if (!rooms.length) {
    root.appendChild(el('p', 'empty-state__text', 'Нет данных'));
    return;
  }

  const filter = document.createElement('input');
  filter.type = 'search';
  filter.className = 'group-picker__search';
  filter.placeholder = 'Номер кабинета';
  filter.style.fontSize = '16px';
  root.appendChild(filter);

  const chips = el('div', 'chip-list');
  const detail = el('div');
  let active = rooms[0];
  let visible = rooms;

  const show = (name) => {
    active = name;
    chips.querySelectorAll('.chip').forEach((c) => {
      c.classList.toggle('is-active', c.textContent === name);
    });
    clear(detail);
    detail.appendChild(el('h3', 'section-title', `Ауд. ${name}`));
    const items = lessonsByRoom(data, name);
    items.forEach(({ group, day, lesson }) => {
      const wrap = el('div');
      wrap.appendChild(el('div', 'now-widget__meta', `${group} · ${DAY_NAMES[day]}`));
      wrap.appendChild(renderLessonCard(lesson, { showGroup: group }));
      detail.appendChild(wrap);
    });
  };

  const paintChips = () => {
    clear(chips);
    visible.forEach((r) => {
      const chip = el('button', 'chip', r);
      chip.type = 'button';
      chip.addEventListener('click', () => show(r));
      chips.appendChild(chip);
    });
    if (visible.length) show(visible.includes(active) ? active : visible[0]);
  };

  filter.addEventListener('input', () => {
    const q = filter.value.trim().toLowerCase();
    visible = q ? rooms.filter((r) => r.toLowerCase().includes(q)) : rooms;
    paintChips();
  });

  root.append(chips, detail);
  paintChips();
}
