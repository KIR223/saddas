/**
 * Недельная сетка-таблица
 */

import { el, clear } from '../utils/dom.js';
import {
  DAY_SHORT, filterByWeek, getIsoWeekday, DEFAULT_PAIR_TIMES,
} from '../models/schedule.js';
import { findNowNext } from '../utils/time.js';
import { renderWeekLesson } from './lesson.js';
import { loadFlags } from '../storage/store.js';
import { applySubstitutions } from '../models/substitutions.js';
import { getMelmkWeekType } from '../models/bells.js';

/**
 * @param {HTMLElement} root
 * @param {import('../models/schedule.js').ScheduleData} data
 * @param {string} groupName
 */
export function renderWeekView(root, data, groupName) {
  clear(root);
  const g = data.groups[groupName];
  if (!g) {
    root.appendChild(el('p', '', 'Группа не найдена'));
    return;
  }

  const pairTimes = data.settings?.pairTimes?.length ? data.settings.pairTimes : DEFAULT_PAIR_TIMES;
  const parity = getMelmkWeekType() === 'green' ? 'odd' : 'even';
  const today = getIsoWeekday();
  const flags = loadFlags();
  const changed = new Set(flags.highlightedIds || []);

  // Текущие пары по дням для подсветки
  const nowIds = new Set();
  if (today >= 1 && today <= 6) {
    let todayLessons = filterByWeek(g.days[String(today)] || [], parity);
    todayLessons = applySubstitutions(todayLessons, data, groupName, today);
    const { current } = findNowNext(todayLessons);
    if (current) nowIds.add(current.id);
  }

  const scroll = el('div', 'week-scroll');
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', 'Недельное расписание');
  scroll.tabIndex = 0;

  const grid = el('div', 'week-grid');

  // Заголовки
  grid.appendChild(el('div', 'week-grid__corner', 'Пара'));
  for (let d = 1; d <= 6; d++) {
    const head = el('div', 'week-grid__dayhead', DAY_SHORT[d]);
    if (d === today) head.style.color = 'var(--accent)';
    grid.appendChild(head);
  }

  // Строки по номерам пар
  const maxPair = Math.max(
    ...pairTimes.map((p) => p.pair),
    ...Object.values(g.days).flat().map((l) => l.pair),
    1
  );

  for (let pair = 1; pair <= maxPair; pair++) {
    const slot = pairTimes.find((p) => p.pair === pair);
    const timeCell = el('div', 'week-grid__time');
    timeCell.appendChild(el('div', '', String(pair)));
    if (slot) {
      timeCell.appendChild(el('div', '', slot.start));
      timeCell.appendChild(el('div', '', slot.end));
    }
    grid.appendChild(timeCell);

    for (let d = 1; d <= 6; d++) {
      const cell = el('div', 'week-grid__cell');
      let dayLessons = filterByWeek(g.days[String(d)] || [], parity);
      dayLessons = applySubstitutions(dayLessons, data, groupName, d);
      const lessons = dayLessons.filter((l) => l.pair === pair);
      for (const lesson of lessons) {
        cell.appendChild(renderWeekLesson(lesson, {
          isNow: nowIds.has(lesson.id),
          isChanged: changed.has(lesson.id) || lesson.replaced,
        }));
      }
      grid.appendChild(cell);
    }
  }

  scroll.appendChild(grid);
  root.appendChild(scroll);
}
