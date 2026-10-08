/**
 * Хранилище: localStorage + IndexedDB (расписание) + toast-ошибки
 */

import { createEmptySchedule, cloneData } from '../models/schedule.js';

const LS_KEY = 'schedule_app_v1';
const LS_PREV = 'schedule_app_prev_v1';
const LS_FLAGS = 'schedule_app_flags_v1';
const IDB_NAME = 'ScheduleAppDB';
const IDB_STORE = 'schedule';

/**
 * @typedef {Object} AppFlags
 * @property {boolean} demoOffered
 * @property {boolean} installDismissed
 * @property {string[]} highlightedIds
 * @property {boolean} showUpdateBanner
 */

/** @type {((data: import('../models/schedule.js').ScheduleData) => void)[]} */
const listeners = [];

/**
 * Подписка на изменения данных
 * @param {(data: import('../models/schedule.js').ScheduleData) => void} fn
 * @returns {() => void}
 */
export function subscribe(fn) {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

function notify(data) {
  for (const fn of listeners) {
    try {
      fn(data);
    } catch (e) {
      console.error(e);
    }
  }
}

/**
 * Чтение флагов UI
 * @returns {AppFlags}
 */
export function loadFlags() {
  try {
    const raw = localStorage.getItem(LS_FLAGS);
    if (raw) return { demoOffered: false, installDismissed: false, highlightedIds: [], showUpdateBanner: false, ...JSON.parse(raw) };
  } catch (e) {
    console.warn('flags read', e);
  }
  return { demoOffered: false, installDismissed: false, highlightedIds: [], showUpdateBanner: false };
}

/**
 * @param {Partial<AppFlags>} partial
 */
export function saveFlags(partial) {
  try {
    const next = { ...loadFlags(), ...partial };
    localStorage.setItem(LS_FLAGS, JSON.stringify(next));
  } catch (e) {
    console.warn('flags write', e);
  }
}

/**
 * Открыть IndexedDB
 * @returns {Promise<IDBDatabase>}
 */
function openDb() {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Сохранить в IndexedDB (основное хранилище для офлайна)
 * @param {import('../models/schedule.js').ScheduleData} data
 */
async function idbSet(data) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(data, 'current');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * @returns {Promise<import('../models/schedule.js').ScheduleData|null>}
 */
async function idbGet() {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get('current');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * Загрузка расписания (IDB → localStorage → пустое)
 * @returns {Promise<import('../models/schedule.js').ScheduleData>}
 */
export async function loadSchedule() {
  try {
    const fromIdb = await idbGet();
    if (fromIdb && fromIdb.groups) return fromIdb;
  } catch (e) {
    console.warn('IDB load', e);
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.groups) return data;
    }
  } catch (e) {
    console.warn('LS load', e);
  }
  return createEmptySchedule();
}

/**
 * Сохранение с бэкапом предыдущей версии
 * @param {import('../models/schedule.js').ScheduleData} data
 * @param {{ keepPrev?: boolean, detectChanges?: boolean }} [opts]
 * @returns {Promise<{ok:boolean, changedIds: string[], error?: string}>}
 */
export async function saveSchedule(data, opts = {}) {
  const { keepPrev = true, detectChanges = true } = opts;
  try {
    data.updatedAt = new Date().toISOString();
    let changedIds = [];

    if (detectChanges) {
      try {
        const prevRaw = localStorage.getItem(LS_PREV) || localStorage.getItem(LS_KEY);
        if (prevRaw) {
          const prev = JSON.parse(prevRaw);
          const { diffLessons } = await import('../models/schedule.js');
          changedIds = [...diffLessons(prev, data)];
        }
      } catch { /* ignore */ }
    }

    if (keepPrev) {
      try {
        const cur = localStorage.getItem(LS_KEY);
        if (cur) localStorage.setItem(LS_PREV, cur);
      } catch { /* quota */ }
    }

    const json = JSON.stringify(data);
    try {
      localStorage.setItem(LS_KEY, json);
    } catch (e) {
      // Если LS переполнен — только IDB
      console.warn('LS full', e);
    }

    try {
      await idbSet(data);
    } catch (e) {
      console.warn('IDB save', e);
    }

    if (changedIds.length) {
      saveFlags({ highlightedIds: changedIds, showUpdateBanner: true });
    }

    notify(data);
    return { ok: true, changedIds };
  } catch (e) {
    return { ok: false, changedIds: [], error: e?.message || 'Ошибка сохранения' };
  }
}

/**
 * Предыдущая версия для сравнения
 * @returns {import('../models/schedule.js').ScheduleData|null}
 */
export function loadPrevious() {
  try {
    const raw = localStorage.getItem(LS_PREV);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Есть ли хоть одна группа
 * @param {import('../models/schedule.js').ScheduleData} data
 */
export function hasSchedule(data) {
  return data && data.groups && Object.keys(data.groups).length > 0;
}

/**
 * Экспорт сырого JSON
 */
export function exportRawJson(data) {
  return JSON.stringify(data, null, 2);
}

/**
 * Импорт JSON с валидацией
 * @param {string} text
 */
export function importRawJson(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object' || !data.groups) {
    throw new Error('Неверный формат JSON: нет поля groups');
  }
  if (!data.version) data.version = 1;
  if (!data.substitutions) data.substitutions = [];
  if (!data.settings) data.settings = createEmptySchedule().settings;
  if (!data.meta) data.meta = createEmptySchedule().meta;
  if (!data.catalog) data.catalog = { teachers: [], rooms: [] };
  return data;
}

/**
 * Снимок для diff без мутаций
 */
export function snapshot(data) {
  return cloneData(data);
}
