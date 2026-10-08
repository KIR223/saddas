/**
 * Поделиться расписанием: hash URL + Web Share API
 */

/**
 * Прочитать группу из hash (#group=ИС-21)
 * @returns {string|null}
 */
export function parseHashGroup() {
  try {
    const hash = location.hash.replace(/^#/, '');
    if (!hash) return null;
    const params = new URLSearchParams(hash.includes('=') ? hash : `group=${hash}`);
    return params.get('group');
  } catch {
    return null;
  }
}

/**
 * Записать группу в hash без перезагрузки
 * @param {string} group
 */
export function setHashGroup(group) {
  const url = new URL(location.href);
  if (!group) {
    url.hash = '';
    history.replaceState(null, '', url);
    return;
  }
  url.hash = `group=${encodeURIComponent(group)}`;
  history.replaceState(null, '', url);
}

/** Очистить выбранную группу из URL */
export function clearHashGroup() {
  setHashGroup('');
}

/**
 * Ссылка на группу
 * @param {string} group
 */
export function groupShareUrl(group) {
  const url = new URL(location.href);
  url.hash = `group=${encodeURIComponent(group)}`;
  return url.toString();
}

/**
 * Поделиться через Web Share или clipboard
 * @param {string} group
 */
export async function shareGroup(group) {
  const url = groupShareUrl(group);
  const title = `Расписание ${group}`;
  const text = `Расписание группы ${group}`;

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return { ok: true, method: 'share' };
    } catch (e) {
      if (e?.name === 'AbortError') return { ok: false, method: 'share', aborted: true };
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return { ok: true, method: 'clipboard' };
  } catch {
    return { ok: false, method: 'none', url };
  }
}
