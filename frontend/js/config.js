/**
 * Конфиг МелМК (фронтенд-only)
 * Учётные записи и пароли проверяет сервер.
 */

export const APP_NAME = 'МелМК';
export const APP_VERSION = '2.0.0';

/** Глобальный флаг: выключить все анимации (темы + UI) */
export const ANIMATIONS_ENABLED = true;

/** Фоновые анимации настроений по умолчанию */
export const MOOD_BG_DEFAULT = true;

/** Ключи localStorage */
export const LS = {
  theme: 'melmk_theme',
  mood: 'melmk_mood',
  moodBg: 'melmk_mood_bg',
  recentGroups: 'melmk_recent_groups',
  favoriteGroups: 'melmk_favorite_groups',
  curator: 'melmk_curator_v1',
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
