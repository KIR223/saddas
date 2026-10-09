/**
 * Виджет «Сейчас / Дальше» — точный таймер, аккуратная вёрстка на узких экранах
 */

import { el, clear } from '../utils/dom.js';
import {
  findNowNext, formatCountdown, lessonProgress, formatRuDate, clamp, moscowNow, hmToDate,
} from '../utils/time.js';
import {
  filterByWeek, getIsoWeekday, DAY_NAMES, TYPE_LABELS,
} from '../models/schedule.js';
import { withCurator, getMelmkWeekType, weekTypeLabel } from '../models/bells.js';
import { applySubstitutions, dateForIsoWeekday } from '../models/substitutions.js';

const RING_SIZE = 64;
const RING_STROKE = 5;

/**
 * @param {HTMLElement} root
 * @param {import('../models/schedule.js').ScheduleData} data
 * @param {string} groupName
 */
export function renderNowWidget(root, data, groupName) {
  clear(root);
  const g = data.groups[groupName];
  if (!g) return;

  const now = moscowNow();
  const day = getIsoWeekday(now);
  const weekType = getMelmkWeekType(now);
  const greet = el('section', 'home-greet mm-enter');
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

  const friendly = buildFriendlyLine(lessons, snap);
  if (friendly) {
    wrap.appendChild(el('p', 'now-widget__friendly', friendly));
  }

  const grid = el('div', 'now-next');

  const nowBox = el('div', 'now-panel');
  nowBox.appendChild(el('div', 'now-widget__label', 'Сейчас'));

  const currents = snap.currents?.length ? snap.currents : (snap.current ? [snap.current] : []);

  if (currents.length) {
    currents.forEach((current) => {
      const block = el('div', 'now-panel__lesson');
      const ringWrap = el('div', 'now-ring-wrap');
      const { progress, remainingMs } = lessonProgress(current.start, current.end, now);
      const ring = buildProgressRing(progress);
      ring.dataset.startHm = current.start;
      ring.dataset.endHm = current.end;
      ringWrap.appendChild(ring);
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
      const sec = Math.max(0, Math.ceil(remainingMs / 1000));
      const timer = el('div', 'now-widget__timer');
      timer.dataset.role = 'ends';
      timer.dataset.startHm = current.start;
      timer.dataset.endHm = current.end;
      timer.innerHTML = `<span class="now-widget__timer-label">осталось</span> <span class="now-widget__timer-val" data-seconds-display>${formatCountdown(sec)}</span>`;
      info.appendChild(timer);
      ringWrap.appendChild(info);
      block.appendChild(ringWrap);
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
      timer.dataset.targetHm = snap.next.start;
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

function buildProgressRing(pct) {
  const size = RING_SIZE;
  const stroke = RING_STROKE;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'now-ring');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.dataset.circumference = String(c);
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

function setRingProgress(svg, pct) {
  const fg = svg.querySelector('.now-ring__fg');
  if (!fg) return;
  const c = Number(svg.dataset.circumference) || (2 * Math.PI * ((RING_SIZE - RING_STROKE) / 2));
  fg.setAttribute('stroke-dashoffset', String(c * (1 - clamp(pct))));
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

/** Короткий статус без дублирующих countdown-строк (таймер уже в «Дальше») */
function buildFriendlyLine(lessons, snap) {
  if (!lessons.length) return 'Пар сегодня нет';
  if (snap.status === 'done') {
    const last = lessons[lessons.length - 1];
    return last?.end ? `На сегодня всё · закончили в ${last.end}` : 'На сегодня всё';
  }
  return '';
}

/**
 * Обновить таймеры и кольцо по реальному времени (без дрейфа).
 * @param {HTMLElement} root
 * @returns {boolean} true — пора перерисовать виджет (пара/перемена закончилась)
 */
export function tickNowTimers(root) {
  if (document.hidden) return false;
  const now = moscowNow();
  let expired = false;

  root.querySelectorAll('.now-widget__timer[data-role="ends"][data-end-hm]').forEach((node) => {
    const startHm = node.dataset.startHm;
    const endHm = node.dataset.endHm;
    const { progress, remainingMs } = lessonProgress(startHm, endHm, now);
    const sec = Math.max(0, Math.ceil(remainingMs / 1000));
    const display = node.querySelector('[data-seconds-display]');
    if (display) display.textContent = formatCountdown(sec);
    const ring = node.closest('.now-ring-wrap')?.querySelector('.now-ring');
    if (ring) setRingProgress(ring, progress);
    if (sec <= 0) expired = true;
  });

  root.querySelectorAll('.now-widget__timer[data-role="starts"][data-target-hm]').forEach((node) => {
    const target = hmToDate(node.dataset.targetHm, now).getTime();
    const sec = Math.max(0, Math.ceil((target - now.getTime()) / 1000));
    const display = node.querySelector('[data-seconds-display]');
    if (display) display.textContent = formatCountdown(sec);
    if (sec <= 0) expired = true;
  });

  return expired;
}
