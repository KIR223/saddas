/**
 * МелМК — только визуальные эффекты.
 * Не трогает бизнес-логику app.js.
 */
(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const weak = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;

  function syncThemeColor() {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const color = getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim();
    if (color) meta.setAttribute('content', color);
  }

  function ensureHeaderDecor() {
    const header = document.querySelector('.app-header');
    if (!header || header.querySelector('.mm-blobs')) return;
    const wrap = document.createElement('div');
    wrap.className = 'mm-blobs';
    wrap.setAttribute('aria-hidden', 'true');
    ['mm-blob mm-blob--a', 'mm-blob mm-blob--b', 'mm-blob mm-blob--c'].forEach((c) => {
      const b = document.createElement('span');
      b.className = c;
      wrap.appendChild(b);
    });
    header.prepend(wrap);
  }

  function ensureNavPill() {
    const nav = document.querySelector('.bottom-nav');
    if (!nav || nav.querySelector('.mm-nav-pill')) return;
    const pill = document.createElement('div');
    pill.className = 'mm-nav-pill';
    pill.setAttribute('aria-hidden', 'true');
    nav.prepend(pill);
    moveNavPill();
  }

  function moveNavPill() {
    const nav = document.querySelector('.bottom-nav');
    const pill = nav && nav.querySelector('.mm-nav-pill');
    if (!nav || !pill) return;
    const items = [...nav.querySelectorAll('.nav-item')];
    const active = items.find((el) => el.classList.contains('is-active') || el.getAttribute('aria-current') === 'page');
    const idx = Math.max(0, items.indexOf(active));
    const pct = (100 / items.length) * idx;
    pill.style.transform = `translateX(calc(${pct * items.length / 100} * 100% + ${idx * 0}px))`;
    // точнее через ширину
    const w = nav.clientWidth / items.length;
    pill.style.width = `${w - 8}px`;
    pill.style.transform = `translateX(${idx * w + 4}px)`;
  }

  function staggerLessons() {
    const list = document.querySelector('#schedule-root [role="list"], #schedule-root > div');
    if (!list) return;
    list.classList.add('mm-stagger', 'mm-day-enter');
  }

  function bindRipples() {
    if (reduced || weak) return;
    document.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('.btn, .nav-item, .day-chip');
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const ripple = document.createElement('span');
      ripple.className = 'mm-ripple';
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 560);
    }, { passive: true });
  }

  function observeUi() {
    const main = document.getElementById('main');
    if (!main) return;
    const mo = new MutationObserver(() => {
      moveNavPill();
      staggerLessons();
    });
    mo.observe(main, { childList: true, subtree: true });
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.addEventListener('click', () => setTimeout(moveNavPill, 30));
    });
  }

  function init() {
    ensureHeaderDecor();
    ensureNavPill();
    bindRipples();
    observeUi();
    syncThemeColor();
    moveNavPill();
    const obs = new MutationObserver(syncThemeColor);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-mode'] });
    window.addEventListener('resize', moveNavPill);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
