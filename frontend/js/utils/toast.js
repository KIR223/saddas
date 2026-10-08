/**
 * Toast-уведомления
 */

let root = null;

function ensureRoot() {
  if (root) return root;
  root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    root.className = 'toast-root';
    root.setAttribute('aria-live', 'polite');
    document.body.appendChild(root);
  }
  return root;
}

/**
 * @param {string} message
 * @param {'info'|'success'|'error'|'warn'} [type]
 * @param {number} [ms]
 */
export function toast(message, type = 'info', ms = 3200) {
  const r = ensureRoot();
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', 'status');
  el.textContent = message;
  r.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast--show'));
  setTimeout(() => {
    el.classList.remove('toast--show');
    setTimeout(() => el.remove(), 280);
  }, ms);
}
