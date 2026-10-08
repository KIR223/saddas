/**
 * Месячный вид расписания группы
 */

import { el, clear } from '../utils/dom.js';
import {
  filterByWeek, DAY_NAMES, getIsoWeekday,
} from '../models/schedule.js';
import { applySubstitutions } from '../models/substitutions.js';
import { withCurator, getMelmkWeekType } from '../models/bells.js';

/**
 * @param {HTMLElement} root
 * @param {import('../models/schedule.js').ScheduleData} data
 * @param {string} groupName
 * @param {{ year?: number, month?: number, onPickDay?: (isoDay: number, date: Date) => void }} [opts]
 */
export function renderMonthView(root, data, groupName, opts = {}) {
  clear(root);
  const g = data.groups[groupName];
  if (!g) {
    root.appendChild(el('p', 'empty-state__text', 'Группа не найдена'));
    return;
  }

  const now = new Date();
  let year = opts.year ?? now.getFullYear();
  let month = opts.month ?? now.getMonth();

  const wrap = el('div', 'month-view');
  const nav = el('div', 'month-view__nav');
  const prev = el('button', 'btn btn--ghost month-view__nav-btn', '‹');
  prev.type = 'button';
  prev.setAttribute('aria-label', 'Предыдущий месяц');
  const next = el('button', 'btn btn--ghost month-view__nav-btn', '›');
  next.type = 'button';
  next.setAttribute('aria-label', 'Следующий месяц');
  const title = el('div', 'month-view__title', '');
  nav.append(prev, title, next);
  wrap.appendChild(nav);

  const paint = () => {
    const d = new Date(year, month, 1);
    title.textContent = d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    wrap.querySelector('.month-grid')?.remove();
    wrap.appendChild(buildGrid(g, data, groupName, year, month, opts.onPickDay));
  };

  prev.addEventListener('click', () => {
    month -= 1;
    if (month < 0) { month = 11; year -= 1; }
    paint();
  });
  next.addEventListener('click', () => {
    month += 1;
    if (month > 11) { month = 0; year += 1; }
    paint();
  });

  paint();
  root.appendChild(wrap);
}

/**
 * @param {import('../models/schedule.js').GroupSchedule} g
 * @param {import('../models/schedule.js').ScheduleData} data
 * @param {string} groupName
 * @param {number} year
 * @param {number} month
 * @param {(isoDay: number, date: Date) => void} [onPickDay]
 */
function buildGrid(g, data, groupName, year, month, onPickDay) {
  const grid = el('div', 'month-grid');
  grid.setAttribute('role', 'grid');

  ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].forEach((h) => {
    grid.appendChild(el('div', 'month-grid__head', h));
  });

  const first = new Date(year, month, 1);
  const firstIso = getIsoWeekday(first);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  for (let i = 1; i < firstIso; i++) {
    grid.appendChild(el('div', 'month-grid__cell is-empty'));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const parity = getMelmkWeekType(date) === 'green' ? 'odd' : 'even';
    const iso = getIsoWeekday(date);
    const cell = el('button', 'month-grid__cell');
    cell.type = 'button';

    if (date.toDateString() === today.toDateString()) cell.classList.add('is-today');
    cell.appendChild(el('div', 'month-grid__daynum', String(day)));

    if (iso >= 1 && iso <= 6) {
      let lessons = filterByWeek(g.days[String(iso)] || [], parity);
      lessons = applySubstitutions(lessons, data, groupName, iso, date);
      lessons = withCurator(lessons, iso);
      const count = lessons.filter((l) => !l.isCurator).length + (lessons.some((l) => l.isCurator) ? 1 : 0);
      if (count > 0) {
        cell.classList.add('has-lessons');
        cell.appendChild(el('div', 'month-grid__count', `${count}`));
        const firstSubj = lessons.find((l) => l.subject)?.subject || '';
        if (firstSubj) cell.appendChild(el('div', 'month-grid__subj', firstSubj));
      } else {
        cell.appendChild(el('div', 'month-grid__count is-free', '—'));
      }
      cell.addEventListener('click', () => onPickDay?.(iso, date));
      cell.setAttribute('aria-label', `${day}, ${DAY_NAMES[iso]}, пар: ${count}`);
    } else {
      cell.classList.add('is-weekend');
      cell.appendChild(el('div', 'month-grid__count is-free', 'вых'));
      cell.disabled = true;
    }

    grid.appendChild(cell);
  }

  return grid;
}
