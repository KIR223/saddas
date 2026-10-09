/**
 * PWA: установка на экран + регистрация SW
 */

import { loadFlags, saveFlags } from '../storage/store.js';
import { toast } from './toast.js';

/** @type {BeforeInstallPromptEvent|null} */
let deferredPrompt = null;

/**
 * @param {HTMLElement} mount
 */
export function initPwa(mount) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('./sw.js?v=19');
        // Принудительно подтянуть новую версию (иначе телефон держит старый UI)
        reg.update().catch(() => {});
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (sessionStorage.getItem('melmk_sw_reloaded')) return;
          sessionStorage.setItem('melmk_sw_reloaded', '1');
          location.reload();
        });
      } catch (e) {
        console.warn('SW', e);
      }
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const flags = loadFlags();
    if (!flags.installDismissed) renderInstallBanner(mount);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    saveFlags({ installDismissed: true });
    const b = mount.querySelector('.install-banner');
    if (b) b.remove();
    toast('Приложение установлено', 'success');
  });
}

/**
 * @param {HTMLElement} mount
 */
function renderInstallBanner(mount) {
  if (mount.querySelector('.install-banner')) return;
  const banner = document.createElement('div');
  banner.className = 'install-banner no-print';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Установка приложения');

  const text = document.createElement('p');
  text.className = 'banner__text';
  text.textContent = 'Установите расписание на экран — работает офлайн';

  const installBtn = document.createElement('button');
  installBtn.type = 'button';
  installBtn.className = 'btn btn--primary';
  installBtn.textContent = 'Установить на экран';
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) {
      toast('Установка недоступна в этом браузере. Добавьте через меню «На экран Домой».', 'info', 4500);
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (outcome === 'accepted') saveFlags({ installDismissed: true });
    banner.remove();
  });

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'btn btn--ghost';
  dismiss.textContent = 'Позже';
  dismiss.addEventListener('click', () => {
    saveFlags({ installDismissed: true });
    banner.remove();
  });

  banner.append(text, installBtn, dismiss);
  mount.prepend(banner);
}

/**
 * Программный вызов установки
 */
export async function promptInstall() {
  if (!deferredPrompt) {
    toast('Установка недоступна. Используйте меню браузера.', 'info');
    return;
  }
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
}
