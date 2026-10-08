/** Адрес API. Переопределение: window.SCHEDULE_API_BASE */
export const API_ORIGIN = 'https://api.melmksch.fvds.ru';

export function apiOrigin() {
  if (typeof window !== 'undefined' && window.SCHEDULE_API_BASE != null) {
    return String(window.SCHEDULE_API_BASE).replace(/\/$/, '');
  }
  return API_ORIGIN;
}

export const ADMIN_TOKEN_KEY = 'schedule_admin_token';

export function getAdminToken() {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setAdminToken(token) {
  try {
    if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
    else localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch { /* ignore */ }
}
