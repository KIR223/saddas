/**
 * Пустые состояния с SVG-иллюстрациями
 */

import { el, clear } from '../utils/dom.js';

/**
 * SVG-иллюстрация «пустое расписание»
 * @returns {SVGElement}
 */
function emptyArt() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 240 180');
  svg.setAttribute('class', 'empty-state__art');
  svg.setAttribute('aria-hidden', 'true');

  const defs = document.createElementNS(ns, 'defs');
  const grad = document.createElementNS(ns, 'linearGradient');
  grad.setAttribute('id', 'eg');
  grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0');
  grad.setAttribute('x2', '1'); grad.setAttribute('y2', '1');
  const s1 = document.createElementNS(ns, 'stop');
  s1.setAttribute('offset', '0%');
  s1.setAttribute('stop-color', '#0d7a6f');
  s1.setAttribute('stop-opacity', '0.35');
  const s2 = document.createElementNS(ns, 'stop');
  s2.setAttribute('offset', '100%');
  s2.setAttribute('stop-color', '#2c6e9e');
  s2.setAttribute('stop-opacity', '0.2');
  grad.append(s1, s2);
  defs.appendChild(grad);
  svg.appendChild(defs);

  const bg = document.createElementNS(ns, 'rect');
  bg.setAttribute('x', '20'); bg.setAttribute('y', '20');
  bg.setAttribute('width', '200'); bg.setAttribute('height', '140');
  bg.setAttribute('rx', '16');
  bg.setAttribute('fill', 'url(#eg)');
  svg.appendChild(bg);

  // Строки «таблицы»
  for (let i = 0; i < 4; i++) {
    const r = document.createElementNS(ns, 'rect');
    r.setAttribute('x', '40');
    r.setAttribute('y', String(45 + i * 28));
    r.setAttribute('width', '160');
    r.setAttribute('height', '14');
    r.setAttribute('rx', '4');
    r.setAttribute('fill', 'var(--bg-elev)');
    r.setAttribute('opacity', String(0.85 - i * 0.12));
    svg.appendChild(r);
  }

  const circle = document.createElementNS(ns, 'circle');
  circle.setAttribute('cx', '180');
  circle.setAttribute('cy', '48');
  circle.setAttribute('r', '18');
  circle.setAttribute('fill', '#0d7a6f');
  circle.setAttribute('opacity', '0.7');
  svg.appendChild(circle);

  return svg;
}

/**
 * @param {HTMLElement} root
 * @param {{ onDemo: () => void, onUpload: () => void }} actions
 */
export function renderEmptyState(root, actions) {
  clear(root);
  const box = el('div', 'empty-state');
  box.appendChild(emptyArt());
  box.appendChild(el('h2', 'empty-state__title', 'Расписание ещё не загружено'));
  box.appendChild(el(
    'p',
    'empty-state__text',
    'Загрузите Excel-файл с расписанием или попробуйте демо, чтобы сразу увидеть, как всё работает.'
  ));

  const actionsEl = el('div', 'empty-state__actions');
  const demo = el('button', 'btn btn--primary btn--block', 'Загрузить демо-расписание');
  demo.type = 'button';
  demo.addEventListener('click', actions.onDemo);

  const upload = el('button', 'btn btn--outline btn--block', 'Загрузить Excel');
  upload.type = 'button';
  upload.addEventListener('click', actions.onUpload);

  actionsEl.append(demo, upload);
  box.appendChild(actionsEl);
  root.appendChild(box);
}

/**
 * Баннер предложения демо при первом запуске
 * @param {HTMLElement} mount
 * @param {() => void} onDemo
 */
export function renderDemoBanner(mount, onDemo) {
  if (mount.querySelector('.demo-banner')) return;
  const banner = el('div', 'demo-banner no-print');
  banner.setAttribute('role', 'region');
  const text = el('p', 'banner__text', 'Первый запуск: загрузить демо-расписание?');
  const btn = el('button', 'btn btn--primary', 'Загрузить демо');
  btn.type = 'button';
  btn.addEventListener('click', () => {
    banner.remove();
    onDemo();
  });
  const dismiss = el('button', 'btn btn--ghost', 'Нет');
  dismiss.type = 'button';
  dismiss.addEventListener('click', () => banner.remove());
  banner.append(text, btn, dismiss);
  mount.prepend(banner);
}
