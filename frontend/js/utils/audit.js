/**
 * Журнал изменений админки
 */

import { LS } from '../config.js';

const MAX = 200;

/**
 * @returns {Array<{ id: string, at: string, action: string, detail: string }>}
 */
export function loadAudit() {
  try {
    const raw = localStorage.getItem(LS.audit);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

/**
 * @param {string} action
 * @param {string} [detail]
 */
export function pushAudit(action, detail = '') {
  const list = loadAudit();
  list.unshift({
    id: `a_${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    action,
    detail,
  });
  try {
    localStorage.setItem(LS.audit, JSON.stringify(list.slice(0, MAX)));
  } catch { /* ignore */ }
  return list;
}

export function clearAudit() {
  try {
    localStorage.removeItem(LS.audit);
  } catch { /* ignore */ }
}
