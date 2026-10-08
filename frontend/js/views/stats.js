/**
 * Статистика + SVG-график загруженности
 */

import { el, clear } from '../utils/dom.js';
import { calcStats, DAY_SHORT, TYPE_LABELS } from '../models/schedule.js';

/**
 * @param {HTMLElement} root
 * @param {import('../models/schedule.js').ScheduleData} data
 * @param {string} groupName
 */
export function renderStats(root, data, groupName) {
  clear(root);
  const stats = calcStats(data, groupName, 'all');

  const panel = el('section', 'stats-panel');
  panel.setAttribute('aria-label', 'Статистика недели');
  panel.appendChild(el('h2', 'section-title', 'Статистика'));

  const grid = el('div', 'stats-grid');
  const boxes = [
    [String(stats.total), 'Пар / нед'],
    [String(stats.gaps), 'Окон'],
    [String(Object.keys(stats.byType).length), 'Типов'],
  ];
  for (const [v, l] of boxes) {
    const box = el('div', 'stat-box');
    box.appendChild(el('div', 'stat-box__value', v));
    box.appendChild(el('div', 'stat-box__label', l));
    grid.appendChild(box);
  }
  panel.appendChild(grid);

  // SVG bar chart
  const values = [];
  for (let d = 1; d <= 6; d++) values.push(stats.byDay[String(d)] || 0);
  const max = Math.max(...values, 1);
  const W = 360;
  const H = 140;
  const pad = 28;
  const barW = (W - pad * 2) / 6 - 8;

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Загруженность по дням');

  values.forEach((v, i) => {
    const h = ((H - pad * 1.5) * v) / max;
    const x = pad + i * ((W - pad * 2) / 6) + 4;
    const y = H - pad - h;
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(barW));
    rect.setAttribute('height', String(Math.max(h, 2)));
    rect.setAttribute('rx', '4');
    rect.setAttribute('fill', 'var(--accent)');
    svg.appendChild(rect);

    const label = document.createElementNS(ns, 'text');
    label.setAttribute('x', String(x + barW / 2));
    label.setAttribute('y', String(H - 8));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('font-size', '11');
    label.setAttribute('fill', 'var(--text-muted)');
    label.textContent = DAY_SHORT[i + 1];
    svg.appendChild(label);

    const val = document.createElementNS(ns, 'text');
    val.setAttribute('x', String(x + barW / 2));
    val.setAttribute('y', String(y - 4));
    val.setAttribute('text-anchor', 'middle');
    val.setAttribute('font-size', '11');
    val.setAttribute('font-weight', '700');
    val.setAttribute('fill', 'var(--text)');
    val.textContent = String(v);
    svg.appendChild(val);
  });

  const chartWrap = el('div', 'chart-wrap');
  chartWrap.appendChild(svg);
  panel.appendChild(chartWrap);

  // По типам
  if (Object.keys(stats.byType).length) {
    const types = el('div', 'chip-list');
    types.style.marginTop = 'var(--space-4)';
    for (const [t, n] of Object.entries(stats.byType)) {
      types.appendChild(el('span', 'chip', `${TYPE_LABELS[t] || t}: ${n}`));
    }
    panel.appendChild(types);
  }

  root.appendChild(panel);
}
