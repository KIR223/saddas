/**
 * Недавние и избранные группы
 */

import { LS } from '../config.js';

function readList(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.map(String);
    }
  } catch { /* ignore */ }
  return [];
}

function writeList(key, arr) {
  try {
    localStorage.setItem(key, JSON.stringify(arr.slice(0, 20)));
  } catch { /* ignore */ }
}

export function getRecentGroups() {
  return readList(LS.recentGroups);
}

export function pushRecentGroup(name) {
  if (!name) return;
  const next = [name, ...getRecentGroups().filter((g) => g !== name)];
  writeList(LS.recentGroups, next);
}

export function getFavoriteGroups() {
  return readList(LS.favoriteGroups);
}

export function toggleFavoriteGroup(name) {
  const fav = getFavoriteGroups();
  const i = fav.indexOf(name);
  if (i >= 0) fav.splice(i, 1);
  else fav.unshift(name);
  writeList(LS.favoriteGroups, fav);
  return fav.includes(name);
}

export function isFavoriteGroup(name) {
  return getFavoriteGroups().includes(name);
}

/**
 * Сортировка: избранные → недавние → остальные
 * @param {string[]} groups
 */
export function sortGroupsForPicker(groups) {
  const fav = new Set(getFavoriteGroups());
  const recent = getRecentGroups();
  const recentSet = new Set(recent);
  const rest = groups.filter((g) => !fav.has(g) && !recentSet.has(g)).sort((a, b) => a.localeCompare(b, 'ru'));
  const favList = groups.filter((g) => fav.has(g));
  const recentList = recent.filter((g) => groups.includes(g) && !fav.has(g));
  return { favorites: favList, recent: recentList, rest, all: [...favList, ...recentList, ...rest] };
}
