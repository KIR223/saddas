/**
 * Лист экспорта: ICS / PDF / CSV(XLSX-совместимый)
 */

import { el } from '../utils/dom.js';
import { exportIcs, exportCsv, printSchedule } from '../export/export.js';
import { toast } from '../utils/toast.js';

/**
 * @param {import('../models/schedule.js').ScheduleData} data
 * @param {string} groupName
 */
export function openExportSheet(data, groupName) {
  if (!groupName) {
    toast('Сначала выберите группу', 'warn');
    return;
  }
  document.querySelector('.sheet-backdrop[data-sheet="export"]')?.remove();

  const backdrop = el('div', 'sheet-backdrop sheet-backdrop--export');
  backdrop.dataset.sheet = 'export';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', 'Скачать расписание');

  const sheet = el('div', 'bottom-sheet');
  const head = el('div', 'bottom-sheet__head');
  head.appendChild(el('div', 'bottom-sheet__handle'));
  head.appendChild(el('h2', 'bottom-sheet__title', 'Скачать расписание'));
  sheet.appendChild(head);

  const body = el('div', 'bottom-sheet__body');
  body.appendChild(el('p', 'now-widget__meta', `Группа ${groupName}`));

  const actions = [
    ['Календарь (ICS)', () => { exportIcs(data, groupName); close(); }],
    ['Таблица (CSV / Excel)', () => { exportCsv(data, groupName); close(); }],
    ['PDF / печать', () => { close(); printSchedule(); }],
  ];
  actions.forEach(([label, fn]) => {
    const btn = el('button', 'btn btn--outline btn--block', label);
    btn.type = 'button';
    btn.style.marginTop = '8px';
    btn.addEventListener('click', fn);
    body.appendChild(btn);
  });
  sheet.appendChild(body);

  const close = () => backdrop.remove();
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);
}
