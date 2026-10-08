/**
 * Дневной вид: спокойный список пар на сегодня + кураторский час
 */

import { el, clear } from '../utils/dom.js';
import { filterByWeek, DAY_NAMES, getIsoWeekday } from '../models/schedule.js';
import { findNowNext, toMinutes, nowMinutes } from '../utils/time.js';
import { renderLessonCard } from './lesson.js';
import { loadFlags } from '../storage/store.js';
import { withCurator, getMelmkWeekType } from '../models/bells.js';
import { applySubstitutions, dateForIsoWeekday } from '../models/substitutions.js';

/**
 * @param {HTMLElement} root
 * @param {import('../models/schedule.js').ScheduleData} data
 * @param {string} groupName
 * @param {number} day — 1..6
 */
export function renderDayView(root, data, groupName, day) {
  clear(root);
  const g = data.groups[groupName];
  if (!g) {
    root.appendChild(el('p', '', 'Группа не найдена'));
    return;
  }

  const title = el('h2', 'section-title', DAY_NAMES[day] || `День ${day}`);
  root.appendChild(title);

  const parity = getMelmkWeekType() === 'green' ? 'odd' : 'even';
  let lessons = filterByWeek(g.days[String(day)] || [], parity);
  lessons = applySubstitutions(lessons, data, groupName, day, dateForIsoWeekday(day));
  lessons = [...lessons].sort((a, b) => a.pair - b.pair || String(a.subgroup || '').localeCompare(String(b.subgroup || '')));
  lessons = withCurator(lessons, day);

  if (!lessons.length) {
    const empty = el('div', 'empty-state mm-enter');
    empty.appendChild(el('p', 'empty-state__title', 'Пар нет'));
    empty.appendChild(el('p', 'empty-state__text', 'В этот день занятий не запланировано'));
    root.appendChild(empty);
    return;
  }

  const { current } = findNowNext(lessons);
  const flags = loadFlags();
  const changed = new Set(flags.highlightedIds || []);
  const nm = nowMinutes();
  const today = getIsoWeekday() === day;

  const list = el('div', 'lesson-list');
  list.setAttribute('role', 'list');
  list.setAttribute('aria-label', `Пары: ${DAY_NAMES[day]}`);

  lessons.forEach((lesson, i) => {
    const isPast = today && toMinutes(lesson.end) <= nm;
    const card = renderLessonCard(lesson, {
      isNow: current && (current.id === lesson.id || (current.isCurator && lesson.isCurator)),
      isChanged: changed.has(lesson.id),
      isPast,
    });
    card.style.animationDelay = `${i * 50}ms`;
    card.classList.add('mm-enter');
    list.appendChild(card);
  });

  root.appendChild(list);
}
