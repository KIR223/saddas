/** Адрес API. Переопределение: window.SCHEDULE_API_BASE */
export const API_ORIGIN = 'https://api.melmksch.fvds.ru';

export function apiOrigin() {
  if (typeof window !== 'undefined' && window.SCHEDULE_API_BASE != null) {
    return String(window.SCHEDULE_API_BASE).replace(/\/$/, '');
  }
  return API_ORIGIN;
}

// Transitional capability flag for existing editors; never a credential.
export function getAdminToken() { return 'server-session'; }
export function setAdminToken() { localStorage.removeItem('schedule_admin_token'); }
