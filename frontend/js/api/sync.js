/**
 * Синхронизация с бэкендом (контракт docs/openapi.json)
 */

import {
  fetchInfo,
  fetchGroups,
  fetchSchedule,
  fetchRooms,
  fetchTeachers,
  fetchBells,
  fetchScheduleDay,
  uploadScheduleFile,
  saveRegularBells,
  saveShortBells,
  removeShortBells,
  saveDayOverride,
  removeDayOverride,
  savePairOverride,
  removePairOverride,
} from './client.js';
import { buildFromApi, mergeApiSchedule, mergeCatalogFromApi, applyApiBells } from './adapt.js';
import { saveSchedule, loadSchedule, hasSchedule, snapshot } from '../storage/store.js';
import { createEmptySchedule, listGroups, ensureCatalog } from '../models/schedule.js';

export {
  uploadScheduleFile,
  fetchScheduleDay,
  saveRegularBells,
  saveShortBells,
  removeShortBells,
  saveDayOverride,
  removeDayOverride,
  savePairOverride,
  removePairOverride,
  fetchBells,
  fetchRooms,
  fetchTeachers,
};

/**
 * @template T, R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T, i: number) => Promise<R>} fn
 * @returns {Promise<R[]>}
 */
async function poolMap(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  const n = Math.min(limit, items.length || 1);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

/**
 * Справочники + звонки с API (не блокируют основной sync при ошибке)
 * @param {import('../models/schedule.js').ScheduleData} data
 */
async function enrichFromApiCatalog(data) {
  ensureCatalog(data);
  try {
    const [roomsRes, teachersRes] = await Promise.all([
      fetchRooms().catch(() => null),
      fetchTeachers().catch(() => null),
    ]);
    mergeCatalogFromApi(data, roomsRes, teachersRes);
  } catch (e) {
    console.warn('catalog sync', e);
  }
  try {
    const bells = await fetchBells();
    applyApiBells(bells);
  } catch (e) {
    console.warn('bells sync', e);
  }
  return data;
}

/**
 * Полная загрузка с API (все группы)
 * @param {'current'|'green'|'red'} [week]
 * @param {(done: number, total: number) => void} [onProgress]
 */
export async function syncFullFromApi(week = 'current', onProgress) {
  const [info, groupsRes] = await Promise.all([fetchInfo(), fetchGroups()]);
  const names = groupsRes.groups || [];
  let done = 0;
  const schedules = await poolMap(names, 6, async (g) => {
    try {
      const sch = await fetchSchedule(g, week);
      done += 1;
      if (onProgress) onProgress(done, names.length);
      return sch;
    } catch (e) {
      done += 1;
      if (onProgress) onProgress(done, names.length);
      console.warn('schedule', g, e);
      return null;
    }
  });

  const data = buildFromApi(names, schedules.filter(Boolean), info);
  data.settings.apiWeek = week === 'current' ? (info.week || 'current') : week;
  await enrichFromApiCatalog(data);
  const prev = await loadSchedule().catch(() => null);
  const res = await saveSchedule(data, { detectChanges: !!(prev && hasSchedule(prev)) });
  return { data, info, changedIds: res.changedIds || [] };
}

/**
 * Быстрый старт: info + groups (+ опционально одна группа)
 * @param {string} [preferredGroup]
 * @param {'current'|'green'|'red'} [week]
 */
export async function syncBootstrap(preferredGroup = '', week = 'current') {
  const [info, groupsRes] = await Promise.all([fetchInfo(), fetchGroups()]);
  const names = groupsRes.groups || [];
  const group = (preferredGroup && names.includes(preferredGroup))
    ? preferredGroup
    : '';

  const data = buildFromApi(names, [], info);
  data.settings.apiWeek = week === 'current' ? (info.week || week) : week;
  data.settings.defaultGroup = group;

  if (group) {
    const sch = await fetchSchedule(group, week);
    mergeApiSchedule(data, sch, info);
  }

  await enrichFromApiCatalog(data);
  await saveSchedule(data, { detectChanges: false, keepPrev: true });
  return { data, info, group, groups: names };
}

/**
 * @param {import('../models/schedule.js').ScheduleData} data
 * @param {string} group
 * @param {'current'|'green'|'red'} [week]
 */
export async function syncGroup(data, group, week = 'current') {
  const sch = await fetchSchedule(group, week);
  mergeApiSchedule(data, sch);
  data.settings.defaultGroup = group;
  await saveSchedule(data, { detectChanges: false, keepPrev: false });
  return data;
}

/**
 * @param {import('../models/schedule.js').ScheduleData} data
 * @param {'current'|'green'|'red'} [week]
 * @param {(data: import('../models/schedule.js').ScheduleData) => void} [onUpdate]
 */
export async function syncRemainingGroups(data, week = 'current', onUpdate) {
  const names = listGroups(data);
  const missing = names.filter((g) => {
    const days = data.groups[g]?.days || {};
    return !Object.values(days).some((arr) => arr && arr.length);
  });
  if (!missing.length) return data;

  await poolMap(missing, 6, async (g) => {
    try {
      const sch = await fetchSchedule(g, week);
      mergeApiSchedule(data, sch);
      if (onUpdate) onUpdate(snapshot(data));
    } catch (e) {
      console.warn(e);
    }
  });
  await saveSchedule(data, { detectChanges: false, keepPrev: false });
  return data;
}

/**
 * Расписание на конкретную дату (с учётом overrides на сервере)
 * @param {string} group
 * @param {string} date YYYY-MM-DD
 */
export async function syncScheduleDay(group, date) {
  return fetchScheduleDay(group, date);
}

/**
 * После upload — полная пересинхронизация
 * @param {File} file
 * @param {string} token
 * @param {'current'|'green'|'red'} [week]
 */
export async function uploadAndSync(file, token, week = 'current') {
  const result = await uploadScheduleFile(file, token);
  const { data, info } = await syncFullFromApi(week);
  return { upload: result, data, info };
}

export function emptyState() {
  return createEmptySchedule();
}
