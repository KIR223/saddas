/**
 * Тема оформления (палитра) + режим light/dark/system.
 * localStorage: mk_theme, mk_mode. Атрибуты: data-theme, data-mode.
 * Бейдж недели не затрагивается.
 */

export const THEMES = [
  { id: 'teal', label: 'Бирюзовая', swatch: ['#0d9488', '#0891b2'] },
  { id: 'violet', label: 'Фиолетовая', swatch: ['#7c3aed', '#4f46e5'] },
  { id: 'blue', label: 'Синяя', swatch: ['#2563eb', '#0ea5e9'] },
  { id: 'emerald', label: 'Изумрудная', swatch: ['#059669', '#10b981'] },
  { id: 'rose', label: 'Розовая', swatch: ['#e11d48', '#db2777'] },
  { id: 'graphite', label: 'Графитовая', swatch: ['#475569', '#64748b'] },
];

export const DEFAULT_THEME_ID = 'teal';
export const DEFAULT_MODE = 'system';

const LS_THEME = 'mk_theme';
const LS_MODE = 'mk_mode';
const LEGACY_MOOD_MAP = {
  indigo: 'violet',
  sky: 'blue',
  coral: 'rose',
  bordeaux: 'rose',
  mint: 'emerald',
  lavender: 'violet',
  ocean: 'teal',
  sand: 'graphite',
  graphite: 'graphite',
  dusk: 'violet',
};

const THEME_META = {
  teal: '#0d9488',
  violet: '#7c3aed',
  blue: '#2563eb',
  emerald: '#059669',
  rose: '#e11d48',
  graphite: '#475569',
};

/** @deprecated совместимость — алиас палитр */
export const MOODS = THEMES.map((t) => ({ id: t.id, label: t.label, darkOnly: false }));
export const DEFAULT_MOOD = DEFAULT_THEME_ID;
export const DEFAULT_THEME = 'light';

function lsGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch { /* private mode */ }
}

/**
 * @returns {string}
 */
export function getPalette() {
  const raw = lsGet(LS_THEME);
  if (raw && THEMES.some((t) => t.id === raw)) return raw;
  const legacyMood = lsGet('melmk_mood');
  if (legacyMood && LEGACY_MOOD_MAP[legacyMood]) return LEGACY_MOOD_MAP[legacyMood];
  return DEFAULT_THEME_ID;
}

/**
 * @returns {'light'|'dark'|'system'}
 */
export function getModePref() {
  const raw = lsGet(LS_MODE);
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  const legacy = lsGet('melmk_theme');
  if (legacy === 'dark' || legacy === 'light') return legacy;
  return DEFAULT_MODE;
}

/**
 * @returns {'light'|'dark'}
 */
export function resolveMode(pref = getModePref()) {
  if (pref === 'light' || pref === 'dark') return pref;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** @returns {'light'|'dark'} */
export function getTheme() {
  return resolveMode();
}

/** @returns {string} */
export function getMood() {
  return getPalette();
}

export function getMoodBgEnabled() {
  return true;
}

export function setMoodBgEnabled() {
  /* no-op: фоны настроений заменены палитрами */
}

function updateThemeColorMeta(resolvedMode, palette) {
  const color = resolvedMode === 'dark' ? '#0f1720' : (THEME_META[palette] || THEME_META.teal);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  const meta = document.createElement('meta');
  meta.setAttribute('name', 'theme-color');
  meta.setAttribute('content', color);
  document.head.appendChild(meta);
}

/**
 * @param {{ palette?: string, mode?: 'light'|'dark'|'system', animate?: boolean }} [opts]
 */
export function applyAppearance(opts = {}) {
  const palette = opts.palette || getPalette();
  const modePref = opts.mode || getModePref();
  const resolved = resolveMode(modePref);
  const root = document.documentElement;

  const apply = () => {
    root.setAttribute('data-theme', palette);
    root.setAttribute('data-mode', resolved);
    root.removeAttribute('data-mood');
    root.style.colorScheme = resolved;
    updateThemeColorMeta(resolved, palette);
  };

  apply();
}

/**
 * @param {'light'|'dark'|'system'} mode
 */
export function setMode(mode) {
  if (mode !== 'light' && mode !== 'dark' && mode !== 'system') return getModePref();
  lsSet(LS_MODE, mode);
  applyAppearance({ mode });
  syncModeButton();
  return mode;
}

/**
 * @param {string} palette
 */
export function setPalette(palette) {
  if (!THEMES.some((t) => t.id === palette)) return getPalette();
  lsSet(LS_THEME, palette);
  applyAppearance({ palette });
  return palette;
}

/** Короткий тап: light ↔ dark */
export function toggleLightDark() {
  const next = resolveMode() === 'dark' ? 'light' : 'dark';
  return setMode(next);
}

/** @deprecated */
export function setTheme(theme) {
  return setMode(theme === 'dark' ? 'dark' : 'light');
}

/** @deprecated */
export function setMood(mood) {
  return setPalette(mood);
}

export function toggleTheme() {
  return toggleLightDark();
}

export function getThemePref() {
  return getModePref();
}

export function setThemePref(pref) {
  if (pref === 'system') return setMode('system');
  return setMode(pref === 'dark' ? 'dark' : 'light');
}

export function applyTheme() {
  applyAppearance();
}

const ICON_MOON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>`;
const ICON_SUN = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;

export function syncModeButton() {
  const btn = document.getElementById('btn-theme');
  if (!btn) return;
  const dark = resolveMode() === 'dark';
  btn.innerHTML = dark ? ICON_SUN : ICON_MOON;
  btn.setAttribute('aria-label', 'Переключить светлую или тёмную тему');
  btn.setAttribute('title', dark ? 'Светлая тема' : 'Тёмная тема');
  btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
}

let mqlBound = false;

export function initTheme() {
  applyAppearance();
  syncModeButton();

  if (!mqlBound) {
    mqlBound = true;
    try {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => {
        if (getModePref() === 'system') applyAppearance();
        syncModeButton();
      };
      mql.addEventListener?.('change', onChange);
      mql.addListener?.(onChange);
    } catch { /* ignore */ }

    window.addEventListener('storage', (e) => {
      if (e.key === LS_THEME || e.key === LS_MODE) {
        applyAppearance();
        syncModeButton();
      }
    });
  }

  requestAnimationFrame(() => {
    document.documentElement.classList.add('mk-theme-ready');
  });

  document.addEventListener('visibilitychange', () => {
    document.documentElement.setAttribute(
      'data-page-visible',
      document.hidden ? '0' : '1'
    );
  });
  document.documentElement.setAttribute('data-page-visible', '1');
}

export { THEME_META };
