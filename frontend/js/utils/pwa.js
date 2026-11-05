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
    const register = async () => {
      try {
        const reg=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
        const offerUpdate=()=>{
          if(!reg.waiting || mount.querySelector('.sw-update'))return;
          const button=document.createElement('button');button.className='btn sw-update';button.textContent='Доступна новая версия — обновить';
          button.onclick=()=>{navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});reg.waiting.postMessage({type:'SKIP_WAITING'});};mount.prepend(button);
        };
        offerUpdate();reg.addEventListener('updatefound',()=>{reg.installing?.addEventListener('statechange',offerUpdate);});
        reg.update().catch(()=>{});
      }catch(e){console.warn('SW',e);}
    };
    if(document.readyState==='complete')register();else window.addEventListener('load',register,{once:true});
  }

  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(ios && !navigator.standalone && !window.matchMedia('(display-mode: standalone)').matches && !loadFlags().installDismissed)renderInstallBanner(mount);
  window.addEventListener('beforeinstallprompt' , (e) => {
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
  text.textContent = 'Добавьте расписание на экран Домой. После загрузки группы оно доступно офлайн.';

  const installBtn = document.createElement('button');
  installBtn.type = 'button';
  installBtn.className = 'btn btn--primary';
  installBtn.textContent = 'Установить на экран';
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) {
      toast('На iPhone: откройте сайт в Safari → «Поделиться» → «На экран Домой» → «Добавить».', 'info', 8000);
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
