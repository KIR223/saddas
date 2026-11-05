import { readSnapshot, writeSnapshot, publicPath, validSnapshot } from '../storage/api-snapshot.js';
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
  // Authentication is an HttpOnly server cookie.
  return headers;
}

/**
 * @param {string} path
 * @param {RequestInit} [init]
 */
export async function request(path, init = {}) {
  const url = `${base()}${path.startsWith('/') ? path : `/${path}`}`;
  const cacheable=(!init.method || init.method==='GET') && publicPath(path);
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),8000);
  let res;
  try {
    if(cacheable && globalThis.navigator?.onLine===false)throw new Error('офлайн');
    res = await fetch(url, {
      ...init,
      signal: init.signal || controller.signal,
      cache: 'no-store',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(init.headers || {}),
      },
    });
  } catch (e) {
    clearTimeout(timeout);
    const saved=cacheable ? await readSnapshot(path) : null;
    if(saved){globalThis.dispatchEvent?.(new CustomEvent('api-cache',{detail:{path,at:saved.at}}));return saved.data;}
    globalThis.dispatchEvent?.(new CustomEvent('api-error',{detail:{message:e.message||'Нет связи'}}));
    throw new Error(`Нет связи с API (${url}): ${e.message || e}`);
  }

  clearTimeout(timeout);
  if (res.status === 204) return null;

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    if(cacheable && res.status>=500){const saved=await readSnapshot(path);if(saved){globalThis.dispatchEvent?.(new CustomEvent('api-cache',{detail:{path,at:saved.at}}));return saved.data;}}
    const detail = data?.detail;
    const msg = typeof detail === 'string'
      ? detail
      : Array.isArray(detail)
        ? detail.map((d) => d.msg || JSON.stringify(d)).join('; ')
        : (data?.message || text || res.statusText);
    globalThis.dispatchEvent?.(new CustomEvent('api-error',{detail:{message:msg||`HTTP ${res.status}`}}));
    throw new Error(msg || `HTTP ${res.status}`);
  }
  if(cacheable && !validSnapshot(path,data)){
    const saved=await readSnapshot(path);
    if(saved){globalThis.dispatchEvent?.(new CustomEvent('api-cache',{detail:{path,at:saved.at}}));return saved.data;}
    throw new Error('Сервер вернул неполные данные');
  }
  if(cacheable){const saved=await writeSnapshot(path,data);globalThis.dispatchEvent?.(new CustomEvent('api-success',{detail:{path,at:saved?.at}}));}
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
export async function uploadScheduleFile(file, token = getAdminToken(), options = null) {
  if (!options) {
    const counts = await request('/api/admin/import-info');
    const choice = prompt(`Замен на сервере: ${counts.overrides_total}, сегодня и позже: ${counts.overrides_future}. Выберите: keep — оставить все, future — снять с сегодняшнего дня, all — снять все.`);
    if (!['keep','future','all'].includes(choice)) throw new Error('Импорт отменён: выберите действие с заменами');
    options = {mode:'replace', overrides_policy:choice};
  }
  const body = new FormData();
  body.append('file', file, file.name);
  body.append('mode',options.mode);
  body.append('overrides_policy',options.overrides_policy);
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


export const login = (login, password) => request("/api/auth/login", {method:"POST", headers:{"Content-Type":"application/json"},body:JSON.stringify({login,password})});
export const me = () => request("/api/auth/me");
export const endSession = () => request("/api/auth/logout", {method:"POST"});
