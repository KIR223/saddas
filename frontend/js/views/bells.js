/**
 * Вкладка «Звонки» — реальное расписание МелМК (приложение 1)
 */

import { el, clear } from '../utils/dom.js';
import {
  loadBellsConfig, getCuratorForDay, computeBreaks, getMelmkWeekType, weekTypeLabel,
} from '../models/bells.js';
import { getIsoWeekday, DAY_NAMES } from '../models/schedule.js';
import { toMinutes, nowMinutes, formatCountdown } from '../utils/time.js';

/**
 * @param {HTMLElement} root
 */
export function renderBellsView(root) {
  clear(root);
  const cfg = loadBellsConfig();
  const day = getIsoWeekday();
  const viewDay = day > 6 ? 0 : day;
  const weekType = getMelmkWeekType();

  const head = el('div', 'bells-head');
  head.appendChild(el('h2', 'section-title', 'Звонки'));
  head.appendChild(el('span', `week-badge week-badge--${weekType}`, weekTypeLabel(weekType)));
  root.appendChild(head);

  if (viewDay) {
    root.appendChild(el('p', 'now-widget__meta', `Сегодня: ${DAY_NAMES[viewDay]}`));
  } else {
    root.appendChild(el('p', 'now-widget__meta', 'Сегодня выходной'));
  }

  // Пн / Чт
  const monThu = el('section', 'bells-block');
  const monTitle = el('h3', 'bells-block__title', 'Понедельник, четверг');
  if (viewDay === 1 || viewDay === 4) {
    monTitle.appendChild(el('span', 'bells-block__today', ' сегодня'));
  }
  monThu.appendChild(monTitle);
  const curator = getCuratorForDay(1, cfg);
  monThu.appendChild(renderTimeline(cfg.monThu, curator, {
    active: viewDay === 1 || viewDay === 4,
  }));
  root.appendChild(monThu);

  // Вт / Ср / Пт
  const regular = el('section', 'bells-block');
  const regTitle = el('h3', 'bells-block__title', 'Вторник, среда, пятница');
  if (viewDay === 2 || viewDay === 3 || viewDay === 5) {
    regTitle.appendChild(el('span', 'bells-block__today', ' сегодня'));
  }
  regular.appendChild(regTitle);
  regular.appendChild(renderTimeline(cfg.regular, null, {
    active: viewDay === 2 || viewDay === 3 || viewDay === 5,
  }));
  root.appendChild(regular);
}

/**
 * @param {import('../models/bells.js').BellSlot[]} slots
 * @param {object|null} curator
 * @param {{ active?: boolean, muted?: boolean }} [opts]
 */
function renderTimeline(slots, curator, opts = {}) {
  const wrap = el('div', `bells-timeline${opts.active ? ' is-active-day' : ' is-other-day'}`);
  const nm = nowMinutes();
  const breaks = computeBreaks(slots);
  const highlight = !!opts.active;

  if (curator) {
    wrap.appendChild(renderSlotCard({
      label: curator.subject || 'Разговор о важном',
      start: curator.start,
      end: curator.end,
      special: true,
      breakAfter: 5,
    }, highlight ? nm : -1));
  }

  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const br = breaks.find((b) => b.afterPair === s.pair);
    wrap.appendChild(renderSlotCard({
      label: `${s.pair} пара`,
      start: s.start,
      end: s.end,
      pair: s.pair,
      breakAfter: br ? br.minutes : null,
    }, highlight ? nm : -1));
  }

  return wrap;
}

/**
 * @param {{ label: string, start: string, end: string, special?: boolean, pair?: number, breakAfter?: number|null }} item
 * @param {number} nm — минуты сейчас, или -1 без подсветки
 */
function renderSlotCard(item, nm) {
  const start = toMinutes(item.start);
  const end = toMinutes(item.end);
  const isNow = nm >= 0 && nm >= start && nm < end;
  const isPast = nm >= 0 && nm >= end;

  const card = el('article', 'bells-card');
  if (isNow) card.classList.add('is-now');
  if (isPast) card.classList.add('is-past');
  if (item.special) card.classList.add('is-special');

  const time = el('div', 'bells-card__time');
  time.appendChild(el('div', 'bells-card__start', item.start));
  time.appendChild(el('div', 'bells-card__dash', '–'));
  time.appendChild(el('div', 'bells-card__end', item.end));

  const body = el('div', 'bells-card__body');
  body.appendChild(el('div', 'bells-card__label', item.label));

  if (item.breakAfter != null && item.breakAfter > 0) {
    body.appendChild(el('div', 'bells-card__break', `перерыв ${item.breakAfter} мин`));
  } else if (item.breakAfter === 0 || item.breakAfter === null) {
    /* нет перерыва после последней */
  }

  if (isNow) {
    const total = Math.max(1, (end - start) * 60);
    const left = Math.max(0, (end - nm) * 60);
    const pct = Math.min(100, Math.max(0, ((total - left) / total) * 100));
    const bar = el('div', 'bells-progress');
    const fill = el('div', 'bells-progress__fill');
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);
    body.appendChild(bar);
    const timer = el('div', 'bells-card__timer');
    timer.dataset.seconds = String(Math.round(left));
    timer.textContent = `до конца ${formatCountdown(Math.round(left))}`;
    body.appendChild(timer);
  }

  card.append(time, body);
  return card;
}

/**
 * @param {HTMLElement} root
 */
export function tickBellsTimers(root) {
  root.querySelectorAll('.bells-card__timer[data-seconds]').forEach((node) => {
    let sec = Number(node.dataset.seconds) - 1;
    if (Number.isNaN(sec)) return;
    node.dataset.seconds = String(sec);
    node.textContent = `до конца ${formatCountdown(sec)}`;
  });
}
