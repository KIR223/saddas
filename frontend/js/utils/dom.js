/**
 * Безопасная работа с DOM (XSS-защита: только textContent)
 */

/**
 * Создать элемент с текстовым содержимым
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
export function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/**
 * Очистить контейнер
 * @param {HTMLElement} node
 */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/**
 * Установить текст безопасно
 * @param {HTMLElement|null} node
 * @param {string} text
 */
export function setText(node, text) {
  if (node) node.textContent = text ?? '';
}

/**
 * Делегирование клика
 * @param {HTMLElement} root
 * @param {string} selector
 * @param {(e: Event, target: Element) => void} handler
 */
export function on(root, selector, handler) {
  root.addEventListener('click', (e) => {
    const t = e.target.closest(selector);
    if (t && root.contains(t)) handler(e, t);
  });
}
