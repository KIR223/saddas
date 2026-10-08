/**
 * HTTP-клиент к https://api.melmksch.fvds.ru
 */

import { apiOrigin, getAdminToken } from './config.js';

/**
 * @returns {string}
 */
function base() {
  return apiOrigin();
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

/** GET /api/info */
export function fetchInfo() {
  return request('/api/info');
}

/** GET /api/groups */
export function fetchGroups() {
  return request('/api/groups');
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
 * POST /api/admin/upload (multipart)
 * @param {File} file
 * @param {string} [token]
 */
export async function uploadScheduleFile(file, token = getAdminToken()) {
  const body = new FormData();
  body.append('file', file, file.name);

  /** @type {Record<string, string>} */
  const headers = {};
  if (token) headers['x-admin-token'] = token;

  return request('/api/admin/upload', {
    method: 'POST',
    headers,
    body,
  });
}
