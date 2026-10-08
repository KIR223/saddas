/**
 * Конфиг МелМК (фронтенд-only)
 * Пароль админки НЕ хранится в открытом виде — только соль и PBKDF2-хэш.
 */

export const APP_NAME = 'МелМК';
export const APP_VERSION = '2.0.0';

/** Глобальный флаг: выключить все анимации (темы + UI) */
export const ANIMATIONS_ENABLED = true;

/** Фоновые анимации настроений по умолчанию */
export const MOOD_BG_DEFAULT = true;

/** PBKDF2: SHA-256, 200000 итераций, 32 байта */
export const AUTH = {
  iterations: 200000,
  /** Логин: melmk_admin */
  loginSalt: 'Tmfk7JYAZjBYaESmD7z6qQ==',
  loginHash: 'bbP0L71ZiCMGLqTkgly/gRlxnQtYAgSY9ONOKuj5mr4=',
  /** Пароль задан при сборке; в исходниках только хэш */
  passSalt: 'NAG4RUZWyJzJknsGjZDsdw==',
  passHash: 'ifhQyh/ilD9W3r3g+IXkln5q8L/wBmGZBarj2oQRSjc=',
  maxAttempts: 5,
  lockMinutes: 5,
  sessionIdleMs: 20 * 60 * 1000,
  storageKey: 'melmk_admin_auth_v1',
  sessionKey: 'melmk_admin_session_v1',
};

/** Ключи localStorage */
export const LS = {
  theme: 'melmk_theme',
  mood: 'melmk_mood',
  moodBg: 'melmk_mood_bg',
  recentGroups: 'melmk_recent_groups',
  favoriteGroups: 'melmk_favorite_groups',
  bells: 'melmk_bells_v2',
  curator: 'melmk_curator_v1',
  audit: 'melmk_audit_v1',
  subDraft: 'melmk_sub_draft_v1',
};

export const MOODS = [
  { id: 'indigo', label: 'Индиго', darkOnly: false },
  { id: 'sky', label: 'Небо', darkOnly: false },
  { id: 'coral', label: 'Коралл', darkOnly: false },
  { id: 'bordeaux', label: 'Бордо', darkOnly: false },
  { id: 'mint', label: 'Мята', darkOnly: false },
  { id: 'lavender', label: 'Лаванда', darkOnly: false },
  { id: 'ocean', label: 'Океан', darkOnly: false },
  { id: 'sand', label: 'Песок', darkOnly: false },
  { id: 'graphite', label: 'Графит', darkOnly: false },
  { id: 'dusk', label: 'Сумерки', darkOnly: true },
];

export const DEFAULT_MOOD = 'indigo';
export const DEFAULT_THEME = 'light';
