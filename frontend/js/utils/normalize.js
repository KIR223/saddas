/**
 * Нормализация строк для поиска (е/ё, регистр, пробелы, дефисы)
 */

/**
 * @param {string} s
 * @returns {string}
 */
export function normalizeQuery(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[\s\-–—_/.,;:]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Токены запроса (все слова должны совпасть)
 * @param {string} s
 * @returns {string[]}
 */
export function queryTokens(s) {
  const n = normalizeQuery(s);
  if (!n) return [];
  return n.split(' ').filter(Boolean);
}

/**
 * Проверка: все токены есть в haystack
 * @param {string} haystack
 * @param {string[]} tokens
 */
export function matchesTokens(haystack, tokens) {
  if (!tokens.length) return false;
  const h = normalizeQuery(haystack);
  return tokens.every((t) => h.includes(t));
}

/**
 * Подсветка совпадений — возвращает фрагменты {text, hit}
 * @param {string} text
 * @param {string[]} tokens
 * @returns {{ text: string, hit: boolean }[]}
 */
export function highlightParts(text, tokens) {
  const src = String(text || '');
  if (!tokens.length || !src) return [{ text: src, hit: false }];

  // Ищем первое вхождение любого токена (без учёта е/ё)
  const lower = normalizeQuery(src);
  let best = null;
  for (const t of tokens) {
    const idx = lower.indexOf(t);
    if (idx >= 0 && (!best || idx < best.idx)) best = { idx, len: t.length };
  }
  if (!best) return [{ text: src, hit: false }];

  // Сопоставление позиций приблизительно по нормализованной строке —
  // для UI берём срез исходной строки той же длины (кириллица 1:1 после toLowerCase/ё)
  const before = src.slice(0, best.idx);
  const mid = src.slice(best.idx, best.idx + best.len);
  const after = src.slice(best.idx + best.len);
  const parts = [];
  if (before) parts.push({ text: before, hit: false });
  parts.push({ text: mid, hit: true });
  if (after) parts.push(...highlightParts(after, tokens));
  return parts;
}
