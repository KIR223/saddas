/**
 * Виджет «Сейчас / Дальше» — одна колонка на телефоне, прогресс из одного источника
 */

import { el, clear } from '../utils/dom.js';
import {
  findNowNext, formatCountdown, lessonProgress, formatRuDate, clamp,
} from '../utils/time.js';
import {
  filterByWeek, getIsoWeekday, DAY_NAMES, TYPE_LABELS,
} from '../models/schedule.js';
import { withCurator, getMelmkWeekType, weekTypeLabel } from '../models/bells.js';
import { applySubstitutions, dateForIsoWeekday } from '../models/substitutions.js';

/**
 * @param {HTMLElement} root
 * @param {import('../models/schedule.js').ScheduleData} data
 * @param {string} groupName
 */
export function renderNowWidget(root, data, groupName) {
  clear(root);
  const g = data.groups[groupName];
  if (!g) return;

  const day = getIsoWeekday();
  const weekType = getMelmkWeekType();
  const greet = el('section', 'home-greet mm-enter');
  const now = new Date();
  const hello = el('div', 'home-greet__hello', greetingByHour(now));
  const dateLine = el('div', 'home-greet__date', formatRuDate(now));
  const badge = el('span', `week-badge week-badge--${weekType}`, weekTypeLabel(weekType));
  badge.title = 'Тип текущей недели';
  const greetRow = el('div', 'home-greet__row');
  greetRow.append(dateLine, badge);
  greet.append(hello, greetRow);
  root.appendChild(greet);

  if (day > 6) {
    const w = el('section', 'now-widget now-widget--hero mm-enter');
    w.appendChild(el('div', 'now-widget__label', 'Сегодня'));
    w.appendChild(el('div', 'now-widget__title', 'Выходной'));
    w.appendChild(el('p', 'now-widget__meta', friendlyWeekendHint(day)));
    root.appendChild(w);
    return;
  }

  const parity = weekType === 'green' ? 'odd' : 'even';
  let lessons = filterByWeek(g.days[String(day)] || [], parity);
  lessons = applySubstitutions(lessons, data, groupName, day, dateForIsoWeekday(day));
  lessons = withCurator(lessons, day);
  const snap = findNowNext(lessons, now);

  const wrap = el('section', 'now-widget now-widget--hero mm-enter');
  wrap.setAttribute('aria-live', 'polite');
  wrap.setAttribute('aria-label', 'Текущая и следующая пара');

  wrap.appendChild(el('p', 'now-widget__friendly', buildFriendlyLine(lessons, snap)));

  const grid = el('div', 'now-next');

  const nowBox = el('div', 'now-panel');
  nowBox.appendChild(el('div', 'now-widget__label', 'Сейчас'));

  const currents = snap.currents?.length ? snap.currents : (snap.current ? [snap.current] : []);

  if (currents.length) {
    currents.forEach((current) => {
      const block = el('div', 'now-panel__lesson');
      const ringWrap = el('div', 'now-ring-wrap');
      const { progress, remainingMs } = lessonProgress(current.start, current.end, now);
      ringWrap.appendChild(buildProgressRing(progress));
      const info = el('div', 'now-panel__info');
      const title = el('div', 'now-widget__title', current.subject);
      title.title = current.subject;
      info.appendChild(title);
      if (current.subgroup) {
        info.appendChild(el('p', 'now-widget__meta', `Подгруппа ${current.subgroup}`));
      }
      const meta = el('div', 'now-meta-chips');
      meta.appendChild(chip(`${current.start}–${current.end}`));
      if (current.room) meta.appendChild(chip(`ауд. ${current.room}`));
      if (current.teacher) meta.appendChild(chip(current.teacher));
      if (current.type && !current.isCurator) {
        meta.appendChild(chip(TYPE_LABELS[current.type] || current.type));
      }
      info.appendChild(meta);
      const timer = el('div', 'now-widget__timer');
      timer.dataset.role = 'ends';
      timer.dataset.seconds = String(Math.round(remainingMs / 1000));
      timer.innerHTML = `<span class="now-widget__timer-label">осталось</span> <span class="now-widget__timer-val" data-seconds-display>${formatCountdown(Math.round(remainingMs / 1000))}</span>`;
      info.appendChild(timer);
      ringWrap.appendChild(info);
      block.appendChild(ringWrap);
      block.appendChild(buildProgressBar(progress));
      nowBox.appendChild(block);
    });
  } else if (snap.status === 'done') {
    nowBox.appendChild(el('div', 'now-widget__title', 'На сегодня всё'));
    nowBox.appendChild(el('p', 'now-widget__meta', DAY_NAMES[day]));
  } else if (snap.status === 'before') {
    nowBox.appendChild(el('div', 'now-widget__title', 'Ещё не началось'));
  } else if (snap.status === 'break') {
    nowBox.appendChild(el('div', 'now-widget__title', 'Перемена'));
  } else {
    nowBox.appendChild(el('div', 'now-widget__title', 'Пар сегодня нет'));
  }

  const nextBox = el('div', 'now-panel');
  nextBox.appendChild(el('div', 'now-widget__label', 'Дальше'));
  if (snap.next) {
    const title = el('div', 'now-widget__title', snap.next.subject);
    title.title = snap.next.subject;
    nextBox.appendChild(title);
    const meta = el('div', 'now-meta-chips');
    meta.appendChild(chip(`${snap.next.start}–${snap.next.end}`));
    if (snap.next.teacher) meta.appendChild(chip(snap.next.teacher));
    if (snap.next.room) meta.appendChild(chip(`ауд. ${snap.next.room}`));
    nextBox.appendChild(meta);
    if (!currents.length && snap.startsIn > 0) {
      const timer = el('div', 'now-widget__timer');
      timer.style.color = 'var(--next)';
      timer.dataset.role = 'starts';
      timer.dataset.seconds = String(snap.startsIn);
      timer.innerHTML = `<span class="now-widget__timer-label">через</span> <span class="now-widget__timer-val" data-seconds-display>${formatCountdown(snap.startsIn)}</span>`;
      nextBox.appendChild(timer);
    }
  } else {
    nextBox.appendChild(el('div', 'now-widget__title', '—'));
    nextBox.appendChild(el('p', 'now-widget__meta', 'Больше пар нет'));
  }

  grid.append(nowBox, nextBox);
  wrap.appendChild(grid);
  root.appendChild(wrap);
}

function chip(text) {
  return el('span', 'now-chip', text);
}

function buildProgressBar(pct) {
  const bar = el('div', 'now-progress');
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-valuenow', String(Math.round(pct * 100)));
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');
  const fill = el('div', 'now-progress__fill');
  fill.style.width = `${clamp(pct) * 100}%`;
  bar.appendChild(fill);
  return bar;
}

function buildProgressRing(pct) {
  const size = 72;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'now-ring');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('aria-hidden', 'true');
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bg.setAttribute('cx', String(size / 2));
  bg.setAttribute('cy', String(size / 2));
  bg.setAttribute('r', String(r));
  bg.setAttribute('fill', 'none');
  bg.setAttribute('stroke', 'var(--bg-muted)');
  bg.setAttribute('stroke-width', String(stroke));
  const fg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  fg.setAttribute('cx', String(size / 2));
  fg.setAttribute('cy', String(size / 2));
  fg.setAttribute('r', String(r));
  fg.setAttribute('fill', 'none');
  fg.setAttribute('stroke', 'var(--accent)');
  fg.setAttribute('stroke-width', String(stroke));
  fg.setAttribute('stroke-linecap', 'round');
  fg.setAttribute('stroke-dasharray', String(c));
  fg.setAttribute('stroke-dashoffset', String(c * (1 - clamp(pct))));
  fg.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`);
  fg.setAttribute('class', 'now-ring__fg');
  svg.append(bg, fg);
  return svg;
}

function greetingByHour(date) {
  const h = date.getHours();
  if (h < 6) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function friendlyWeekendHint(day) {
  if (day === 7) return 'До учёбы 1 день';
  return 'Хороших выходных';
}

function buildFriendlyLine(lessons, snap) {
  if (!lessons.length) return 'Пар сегодня нет';
  if (snap.status === 'done') {
    const last = lessons[lessons.length - 1];
    return last?.end ? `На сегодня всё · закончили в ${last.end}` : 'На сегодня всё';
  }
  if (snap.status === 'before' && snap.next && snap.startsIn > 0) {
    const mins = Math.ceil(snap.startsIn / 60);
    return `Первая пара через ${mins} ${mins === 1 ? 'минуту' : mins < 5 ? 'минуты' : 'мин'}`;
  }
  if (snap.status === 'break' && snap.next && snap.startsIn > 0) {
    const mins = Math.max(1, Math.ceil(snap.startsIn / 60));
    return `Перемена, следующая пара через ${mins} мин`;
  }
  if (snap.current || snap.currents?.length) {
    const last = lessons[lessons.length - 1];
    return last?.end ? `Сегодня закончишь в ${last.end}` : 'Пара идёт';
  }
  return '';
}

/**
 * @param {HTMLElement} root
 */
export function tickNowTimers(root) {
  if (document.hidden) return;
  root.querySelectorAll('[data-seconds]').forEach((node) => {
    let sec = Number(node.dataset.seconds) - 1;
    if (Number.isNaN(sec)) return;
    node.dataset.seconds = String(sec);
    const display = node.querySelector('[data-seconds-display]') || node;
    const role = node.dataset.role;
    const label = role === 'ends' ? 'осталось' : 'через';
    if (node.querySelector('[data-seconds-display]')) {
      const lab = node.querySelector('.now-widget__timer-label');
      if (lab) lab.textContent = label;
      display.textContent = formatCountdown(sec);
    } else {
      node.textContent = `${label} ${formatCountdown(sec)}`;
    }
  });
}
