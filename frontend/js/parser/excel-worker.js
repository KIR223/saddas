/**
 * Web Worker: парсинг Excel через SheetJS (CDN importScripts)
 * Сообщения: { type: 'parse', buffer, fileName }
 * Ответ: { type: 'ok', headers, rows, fileName } | { type: 'error', message }
 */

/* eslint-disable no-restricted-globals */
try {
  importScripts('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js');
} catch (e) {
  // fallback — сообщит при parse
}

self.onmessage = (ev) => {
  const msg = ev.data || {};
  if (msg.type !== 'parse') return;

  try {
    if (typeof XLSX === 'undefined') {
      self.postMessage({ type: 'error', message: 'Не удалось загрузить библиотеку XLSX. Проверьте интернет.' });
      return;
    }

    const data = new Uint8Array(msg.buffer);
    const wb = XLSX.read(data, { type: 'array', cellDates: false });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      self.postMessage({ type: 'error', message: 'В файле нет листов' });
      return;
    }
    const sheet = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });

    if (!aoa.length) {
      self.postMessage({ type: 'error', message: 'Пустой лист' });
      return;
    }

    const headers = (aoa[0] || []).map((h) => String(h ?? '').trim());
    const rows = aoa.slice(1).filter((r) => r && r.some((c) => String(c ?? '').trim() !== ''));

    // Чанковая отправка для очень больших файлов — здесь одним сообщением (уже вне UI-потока)
    self.postMessage({
      type: 'ok',
      headers,
      rows,
      fileName: msg.fileName || '',
      sheetName,
    });
  } catch (e) {
    self.postMessage({ type: 'error', message: e?.message || 'Ошибка разбора Excel' });
  }
};
