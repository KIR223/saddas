/**
 * HTTP-клиент к API расписания (контракт: docs/openapi.json)
 * База: https://api.melmksch.fvds.ru
 */

import { apiOrigin, getAdminToken } from './config.js';

/**
 * @returns {string}
 */
function base() {
  return apiOrigin();
}

/**
 * @param {string} [token]
 * @returns {Record<string, string>}
 */
function adminHeaders(token = getAdminToken()) {
  /** @type {Record<string, string>} */
  const headers = {};
  if (token) headers['x-admin-token'] = token;
  return headers;
}

/**
 * @param {string} path
 * @param {RequestInit} [init]
 */
async function request(path, init = {}) {
  const url = `${base()}${path.startsWith('/') ? path : `/${path}`}`;
  let res;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.headers || {}),
      },
    });
  } catch (e) {
    throw new Error(`Нет связи с API (${url}): ${e.message || e}`);
  }

  if (res.status === 204) return null;

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const detail = data?.detail;
    const msg = typeof detail === 'string'
      ? detail
      : Array.isArray(detail)
        ? detail.map((d) => d.msg || JSON.stringify(d)).join('; ')
        : (data?.message || text || res.statusText);
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return data;
}

/** GET /api/info → InfoOut */
export function fetchInfo() {
  return request('/api/info');
}

/** GET /api/groups → GroupsOut */
export function fetchGroups() {
  return request('/api/groups');
}

/** GET /api/rooms → RoomsOut */
export function fetchRooms() {
  return request('/api/rooms');
}

/** GET /api/teachers → TeachersOut */
export function fetchTeachers() {
  return request('/api/teachers');
}

/**
 * GET /api/schedule?group=&week=
 * @param {string} group
 * @param {'current'|'green'|'red'} [week]
 */
export function fetchSchedule(group, week = 'current') {
  const q = new URLSearchParams({ group, week });
  return request(`/api/schedule?${q}`);
}

/**
 * GET /api/schedule/day?group=&date=YYYY-MM-DD → DayScheduleOut
 * @param {string} group
 * @param {string} date
 */
export function fetchScheduleDay(group, date) {
  const q = new URLSearchParams({ group, date });
  return request(`/api/schedule/day?${q}`);
}

/**
 * GET /api/bells?date=YYYY-MM-DD → BellsOut
 * @param {string|null} [date]
 */
export function fetchBells(date = null) {
  const q = new URLSearchParams();
  if (date) q.set('date', date);
  const suffix = q.toString() ? `?${q}` : '';
  return request(`/api/bells${suffix}`);
}

/**
 * POST /api/admin/upload (multipart) → UploadOut
 * @param {File} file
 * @param {string} [token]
 */
export async function uploadScheduleFile(file, token = getAdminToken()) {
  const body = new FormData();
  body.append('file', file, file.name);
  return request('/api/admin/upload', {
    method: 'POST',
    headers: adminHeaders(token),
    body,
  });
}

/**
 * PUT /api/admin/bells — обычная сетка звонков
 * @param {{ pairs: Array<{ pair: number, start: string, end: string }> }} body
 * @param {string} [token]
 */
export function saveRegularBells(body, token = getAdminToken()) {
  return request('/api/admin/bells', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...adminHeaders(token),
    },
    body: JSON.stringify(body),
  });
}

/**
 * PUT /api/admin/bells/{on_date} — сокращённый день
 * @param {string} onDate YYYY-MM-DD
 * @param {{ pairs: Array<{ pair: number, start: string, end: string }> }} body
 * @param {string} [token]
 */
export function saveShortBells(onDate, body, token = getAdminToken()) {
  return request(`/api/admin/bells/${encodeURIComponent(onDate)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...adminHeaders(token),
    },
    body: JSON.stringify(body),
  });
}

/**
 * DELETE /api/admin/bells/{on_date}
 * @param {string} onDate
 * @param {string} [token]
 */
export function removeShortBells(onDate, token = getAdminToken()) {
  return request(`/api/admin/bells/${encodeURIComponent(onDate)}`, {
    method: 'DELETE',
    headers: adminHeaders(token),
  });
}

/**
 * PUT /api/admin/schedule/{on_date}?group= — переопределение дня
 * @param {string} onDate
 * @param {string} group
 * @param {{ pairs?: Array<{ pair: number, subject: string, teacher?: string, room?: string }> }} body
 * @param {string} [token]
 */
export function saveDayOverride(onDate, group, body, token = getAdminToken()) {
  const q = new URLSearchParams({ group });
  return request(`/api/admin/schedule/${encodeURIComponent(onDate)}?${q}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...adminHeaders(token),
    },
    body: JSON.stringify(body || { pairs: [] }),
  });
}

/**
 * DELETE /api/admin/schedule/{on_date}?group=
 * @param {string} onDate
 * @param {string} group
 * @param {string} [token]
 */
export function removeDayOverride(onDate, group, token = getAdminToken()) {
  const q = new URLSearchParams({ group });
  return request(`/api/admin/schedule/${encodeURIComponent(onDate)}?${q}`, {
    method: 'DELETE',
    headers: adminHeaders(token),
  });
}

/**
 * PUT /api/admin/schedule/{on_date}/pairs/{pair}?group=
 * @param {string} onDate
 * @param {number} pair
 * @param {string} group
 * @param {{ subject?: string, teacher?: string, room?: string, cancelled?: boolean }} body
 * @param {string} [token]
 */
export function savePairOverride(onDate, pair, group, body, token = getAdminToken()) {
  const q = new URLSearchParams({ group });
  return request(
    `/api/admin/schedule/${encodeURIComponent(onDate)}/pairs/${encodeURIComponent(String(pair))}?${q}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...adminHeaders(token),
      },
      body: JSON.stringify(body || {}),
    }
  );
}

/**
 * DELETE /api/admin/schedule/{on_date}/pairs/{pair}?group=
 * @param {string} onDate
 * @param {number} pair
 * @param {string} group
 * @param {string} [token]
 */
export function removePairOverride(onDate, pair, group, token = getAdminToken()) {
  const q = new URLSearchParams({ group });
  return request(
    `/api/admin/schedule/${encodeURIComponent(onDate)}/pairs/${encodeURIComponent(String(pair))}?${q}`,
    {
      method: 'DELETE',
      headers: adminHeaders(token),
    }
  );
}
