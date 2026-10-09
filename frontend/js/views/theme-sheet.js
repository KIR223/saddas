/**
 * Выбор палитры + режим light/dark/system.
 * Desktop: popover; mobile ≤640: bottom sheet.
 */

import { el, clear } from '../utils/dom.js';
import {
  THEMES, getPalette, setPalette, getModePref, setMode,
} from '../utils/theme.js';

let openPanel = null;
/** @type {HTMLElement|null} */
let lastAnchor = null;

/**
 * @param {HTMLElement} [anchorBtn]
 */
export function openThemeSheet(anchorBtn) {
  closeThemeSheet();
  lastAnchor = anchorBtn || document.getElementById('btn-mood');

  const isMobile = window.matchMedia('(max-width: 640px)').matches;
  const panel = el('div', `theme-panel${isMobile ? ' theme-panel--sheet' : ' theme-panel--popover'}`);
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Тема оформления');

  const scrim = el('button', 'theme-panel__scrim');
  scrim.type = 'button';
  scrim.setAttribute('aria-label', 'Закрыть');

  const card = el('div', 'theme-panel__card');
  const top = el('div', 'theme-panel__top');
  top.appendChild(el('h2', 'theme-panel__title', 'Тема оформления'));
  const closeBtn = el('button', 'theme-panel__close', '×');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Закрыть');
  top.appendChild(closeBtn);
  card.appendChild(top);

  const body = el('div', 'theme-panel__body');
  card.appendChild(body);

  const foot = el('div', 'theme-panel__foot');
  const done = el('button', 'btn btn--primary btn--block', 'Готово');
  done.type = 'button';
  foot.appendChild(done);
  card.appendChild(foot);

  panel.append(scrim, card);
  document.body.appendChild(panel);
  document.body.classList.add('theme-panel-open');
  openPanel = panel;

  const close = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    closeThemeSheet();
    lastAnchor?.focus?.();
  };
  scrim.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  done.addEventListener('click', close);

  const onKey = (e) => {
    if (e.key === 'Escape') close(e);
  };
  document.addEventListener('keydown', onKey);
  panel._onKey = onKey;

  paintBody(body);
  requestAnimationFrame(() => {
    panel.classList.add('is-open');
  });
  setTimeout(() => closeBtn.focus(), 50);
}

export function closeThemeSheet() {
  const panel = openPanel || document.querySelector('.theme-panel');
  if (!panel) return;
  if (panel._onKey) document.removeEventListener('keydown', panel._onKey);
  panel.classList.remove('is-open');
  document.body.classList.remove('theme-panel-open');
  setTimeout(() => panel.remove(), 220);
  openPanel = null;
}

/**
 * @param {HTMLElement} body
 */
function paintBody(body) {
  clear(body);

  body.appendChild(el('p', 'theme-panel__label', 'Палитра'));
  const grid = el('div', 'theme-swatch-grid');
  const current = getPalette();
  THEMES.forEach((t) => {
    const btn = el('button', `theme-swatch${current === t.id ? ' is-active' : ''}`);
    btn.type = 'button';
    btn.setAttribute('aria-pressed', current === t.id ? 'true' : 'false');
    const circle = el('span', 'theme-swatch__circle');
    circle.style.background = `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]})`;
    btn.appendChild(circle);
    btn.appendChild(el('span', 'theme-swatch__name', t.label));
    if (current === t.id) btn.appendChild(el('span', 'theme-swatch__check', '✓'));
    btn.addEventListener('click', () => {
      setPalette(t.id);
      paintBody(body);
    });
    grid.appendChild(btn);
  });
  body.appendChild(grid);

  body.appendChild(el('p', 'theme-panel__label', 'Режим'));
  const modeRow = el('div', 'theme-mode-row');
  const pref = getModePref();
  [
    ['light', 'Светлая'],
    ['dark', 'Тёмная'],
    ['system', 'Как в системе'],
  ].forEach(([id, label]) => {
    const btn = el('button', `theme-mode-btn${pref === id ? ' is-active' : ''}`, label);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      setMode(/** @type {'light'|'dark'|'system'} */ (id));
      paintBody(body);
    });
    modeRow.appendChild(btn);
  });
  body.appendChild(modeRow);
}
