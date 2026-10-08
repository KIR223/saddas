/**
 * Выбор группы: кнопка → bottom-sheet со скроллом списка
 */

import { el, clear } from '../utils/dom.js';
import { listGroups } from '../models/schedule.js';
import { matchesTokens, queryTokens } from '../utils/normalize.js';
import {
  sortGroupsForPicker, pushRecentGroup, toggleFavoriteGroup, isFavoriteGroup,
} from '../utils/groups-pref.js';

/**
 * @param {HTMLElement} mount
 * @param {import('../models/schedule.js').ScheduleData} data
 * @param {string} current
 * @param {(group: string) => void} onSelect
 */
export function renderGroupPicker(mount, data, current, onSelect) {
  const wrap = el('div', 'group-picker');

  const trigger = el('button', 'group-picker__trigger group-picker__trigger--main');
  trigger.type = 'button';
  trigger.setAttribute('aria-haspopup', 'listbox');
  const label = el('span', 'group-picker__value', current || 'Выберите группу');
  const chev = el('span', 'group-picker__chev', '▾');
  trigger.append(label, chev);

  const star = el('button', 'btn btn--icon btn--ghost group-picker__fav');
  star.type = 'button';
  star.setAttribute('aria-label', 'В избранное');
  star.textContent = current && isFavoriteGroup(current) ? '★' : '☆';
  star.disabled = !current;
  star.addEventListener('click', () => {
    if (!current) return;
    const on = toggleFavoriteGroup(current);
    star.textContent = on ? '★' : '☆';
    if (navigator.vibrate) navigator.vibrate(10);
  });

  wrap.append(trigger, star);
  mount.appendChild(wrap);

  trigger.addEventListener('click', () => {
    openGroupSheet(data, current, (g) => {
      pushRecentGroup(g);
      onSelect(g);
    });
  });
}

/**
 * @param {import('../models/schedule.js').ScheduleData} data
 * @param {string} current
 * @param {(g: string) => void} onSelect
 * @param {string} [initialQ]
 */
export function openGroupSheet(data, current, onSelect, initialQ = '') {
  document.querySelector('.sheet-backdrop[data-sheet="group"]')?.remove();

  const groups = listGroups(data);
  const backdrop = el('div', 'sheet-backdrop sheet-backdrop--group');
  backdrop.dataset.sheet = 'group';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', 'Выбор группы');

  const sheet = el('div', 'bottom-sheet bottom-sheet--group');

  const head = el('div', 'bottom-sheet__head');
  const handle = el('div', 'bottom-sheet__handle');
  handle.setAttribute('aria-hidden', 'true');
  head.appendChild(handle);
  head.appendChild(el('h2', 'bottom-sheet__title', 'Группа'));

  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'bottom-sheet__search';
  input.placeholder = 'Найти группу…';
  input.value = initialQ;
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('enterkeyhint', 'search');
  input.style.fontSize = '16px';
  head.appendChild(input);
  sheet.appendChild(head);

  // Именно этот блок прокручивается
  const list = el('div', 'bottom-sheet__list');
  list.setAttribute('role', 'listbox');
  list.tabIndex = 0;
  sheet.appendChild(list);

  const close = () => {
    document.body.classList.remove('sheet-open');
    backdrop.remove();
  };

  const renderList = () => {
    clear(list);
    const tokens = queryTokens(input.value);
    const sorted = sortGroupsForPicker(groups);

    // Поиск — плоский список
    if (tokens.length) {
      const filtered = sorted.all.filter((g) => matchesTokens(g, tokens));
      if (!filtered.length) {
        list.appendChild(el('p', 'empty-state__text', 'Ничего не найдено'));
        return;
      }
      filtered.forEach((g) => list.appendChild(makeItem(g)));
      return;
    }

    const allRest = sorted.rest.length ? sorted.rest : sorted.all.filter(
      (g) => !sorted.favorites.includes(g) && !sorted.recent.includes(g)
    );
    const sections = [
      ['Избранные', sorted.favorites],
      ['Недавние', sorted.recent],
      ['Все группы', allRest.length ? allRest : sorted.all],
    ];

    let any = false;
    for (const [title, items] of sections) {
      if (!items.length) continue;
      any = true;
      list.appendChild(el('div', 'bottom-sheet__section', title));
      items.forEach((g) => list.appendChild(makeItem(g)));
    }
    if (!any) list.appendChild(el('p', 'empty-state__text', 'Нет групп'));
  };

  function makeItem(g) {
    const btn = el('button', `bottom-sheet__item${g === current ? ' is-active' : ''}`, g);
    btn.type = 'button';
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', g === current ? 'true' : 'false');
    btn.addEventListener('click', () => {
      onSelect(g);
      close();
    });
    return btn;
  }

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  input.addEventListener('input', renderList);

  // Свайп вниз только с ручки — не мешает скроллу списка
  let startY = 0;
  handle.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
  }, { passive: true });
  handle.addEventListener('touchend', (e) => {
    if (e.changedTouches[0].clientY - startY > 70) close();
  }, { passive: true });

  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);
  document.body.classList.add('sheet-open');
  renderList();

  // Прокрутить к текущей группе
  requestAnimationFrame(() => {
    const active = list.querySelector('.bottom-sheet__item.is-active');
    if (active) {
      active.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  });
}
