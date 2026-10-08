/**
 * Адаптер ответа API → внутренняя модель ScheduleData
 * Контракт: docs/openapi.json
 */

import {
  createEmptySchedule, createLesson, getPairTimesForDay, ensureCatalog,
} from '../models/schedule.js';
import { normalizeDay } from '../parser/mapper.js';
import { loadBellsConfig, saveBellsConfig } from '../models/bells.js';

/**
 * Одна группа из ScheduleOut
 * @param {import('../models/schedule.js').ScheduleData} data
 * @param {{ group: string, week: string, days: Array<{ day: string, pairs: Array<{pair:number,subject:string,teacher:string,room:string}> }> }} schedule
 * @param {{ title?: string, uploaded_at?: string|null }} [info]
 */
export function mergeApiSchedule(data, schedule, info = {}) {
  const name = schedule.group;
  if (!data.groups[name]) {
    data.groups[name] = {
      name,
      days: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] },
    };
  } else {
    data.groups[name].days = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  }

  for (const dayBlock of schedule.days || []) {
    const dayKey = normalizeDay(dayBlock.day);
    if (!dayKey) continue;
    const daySlots = getPairTimesForDay(dayKey);
    const lessons = [];
    for (const p of dayBlock.pairs || []) {
      const pair = Number(p.pair) || 0;
      if (!pair) continue;
      const slot = daySlots.find((t) => t.pair === pair) || daySlots[0];
      lessons.push(createLesson({
        pair,
        start: slot.start,
        end: slot.end,
        subject: String(p.subject || '').trim(),
        teacher: String(p.teacher || '').trim(),
        room: String(p.room || '').trim(),
        type: 'other',
        subgroup: null,
        week: 'all',
      }));
    }
    data.groups[name].days[dayKey] = lessons;
  }

  if (info.title) data.meta.institution = info.title;
  if (info.uploaded_at) data.updatedAt = info.uploaded_at;
  data.meta.sourceFile = 'api';
  data.settings.apiWeek = schedule.week || data.settings.apiWeek || 'current';
  return data;
}

/**
 * Собрать полное расписание из списка групп
 * @param {string[]} groupNames
 * @param {Array} schedules — ScheduleOut[]
 * @param {object} [info] — InfoOut
 */
export function buildFromApi(groupNames, schedules, info = {}) {
  const data = createEmptySchedule();
  data.meta.institution = info.title || 'Расписание';
  data.meta.semester = [info.week, info.week_start, info.week_end].filter(Boolean).join(' · ');
  data.meta.sourceFile = 'api';
  data.updatedAt = info.uploaded_at || new Date().toISOString();
  data.settings.apiWeek = info.week || 'current';
  data.settings.weekStart = info.week_start || '';
  data.settings.weekEnd = info.week_end || '';

  for (const g of groupNames) {
    data.groups[g] = {
      name: g,
      days: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] },
    };
  }

  for (const sch of schedules) {
    if (sch && sch.group) mergeApiSchedule(data, sch, info);
  }

  if (!data.settings.defaultGroup && groupNames.length) {
    data.settings.defaultGroup = groupNames[0];
  }
  return data;
}

/**
 * Справочники RoomsOut / TeachersOut → catalog
 * @param {import('../models/schedule.js').ScheduleData} data
 * @param {{ rooms?: string[] }|null} roomsRes
 * @param {{ teachers?: string[] }|null} teachersRes
 */
export function mergeCatalogFromApi(data, roomsRes, teachersRes) {
  ensureCatalog(data);
  if (roomsRes?.rooms?.length) {
    const set = new Set([...(data.catalog.rooms || []), ...roomsRes.rooms]);
    data.catalog.rooms = [...set].filter(Boolean).sort((a, b) => a.localeCompare(b, 'ru'));
  }
  if (teachersRes?.teachers?.length) {
    const set = new Set([...(data.catalog.teachers || []), ...teachersRes.teachers]);
    data.catalog.teachers = [...set].filter(Boolean).sort((a, b) => a.localeCompare(b, 'ru'));
  }
  return data;
}

/**
 * BellsOut → локальная сетка звонков (regular)
 * @param {{ kind?: string, date?: string|null, pairs?: Array<{ pair: number, start: string, end: string }> }|null} bells
 */
export function applyApiBells(bells) {
  if (!bells?.pairs?.length) return loadBellsConfig();
  const pairs = bells.pairs
    .map((p) => ({
      pair: Number(p.pair),
      start: String(p.start || ''),
      end: String(p.end || ''),
    }))
    .filter((p) => p.pair && p.start && p.end)
    .sort((a, b) => a.pair - b.pair);

  if (!pairs.length) return loadBellsConfig();

  const cfg = loadBellsConfig();
  // kind: regular | short | …
  if (bells.kind === 'short' || bells.date) {
    return saveBellsConfig({ ...cfg, shortDay: pairs });
  }
  return saveBellsConfig({ ...cfg, regular: pairs, monThu: pairs });
}

/**
 * DayScheduleOut → список уроков на день (для точечного обновления)
 * @param {{ pairs?: Array<{ pair: number, subject: string, teacher: string, room: string }> }} dayOut
 * @param {number} dayKey 1..6
 */
export function lessonsFromDaySchedule(dayOut, dayKey = 1) {
  const daySlots = getPairTimesForDay(dayKey);
  const lessons = [];
  for (const p of dayOut?.pairs || []) {
    const pair = Number(p.pair) || 0;
    if (!pair) continue;
    const slot = daySlots.find((t) => t.pair === pair) || daySlots[0];
    lessons.push(createLesson({
      pair,
      start: slot.start,
      end: slot.end,
      subject: String(p.subject || '').trim(),
      teacher: String(p.teacher || '').trim(),
      room: String(p.room || '').trim(),
      type: 'other',
      subgroup: null,
      week: 'all',
    }));
  }
  return lessons;
}
