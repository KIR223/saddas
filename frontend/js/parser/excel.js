/**
 * Загрузка и разбор Excel (валидация + worker + fallback)
 */

import { autoMap, rowsToSchedule, FIELD_KEYS, buildTemplateCsv } from './mapper.js';
import { toast } from '../utils/toast.js';

const MAX_SIZE = 8 * 1024 * 1024; // 8 МБ
const ALLOWED = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
  'text/plain',
  '',
];

/**
 * @param {File} file
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateFile(file) {
  if (!file) return { ok: false, error: 'Файл не выбран' };
  if (file.size > MAX_SIZE) return { ok: false, error: 'Файл больше 8 МБ' };
  const name = file.name.toLowerCase();
  const okExt = name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv');
  if (!okExt) return { ok: false, error: 'Допустимы .xlsx, .xls, .csv' };
  if (file.type && !ALLOWED.includes(file.type) && !okExt) {
    return { ok: false, error: 'Неподдерживаемый тип файла' };
  }
  return { ok: true };
}

/**
 * Парсинг в worker или на главном потоке (CSV)
 * @param {File} file
 * @returns {Promise<{ headers: string[], rows: unknown[][], fileName: string }>}
 */
export function parseFile(file) {
  const check = validateFile(file);
  if (!check.ok) return Promise.reject(new Error(check.error));

  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) {
    return file.text().then((text) => parseCsv(text, file.name));
  }

  return file.arrayBuffer().then((buffer) => parseWithWorker(buffer, file.name));
}

/**
 * @param {string} text
 * @param {string} fileName
 */
function parseCsv(text, fileName) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) throw new Error('Пустой CSV');
  const delim = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  const split = (line) => {
    const out = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        q = !q;
      } else if (ch === delim && !q) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  };
  const headers = split(lines[0]);
  const rows = lines.slice(1).map(split);
  return { headers, rows, fileName };
}

/**
 * @param {ArrayBuffer} buffer
 * @param {string} fileName
 */
function parseWithWorker(buffer, fileName) {
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL('./excel-worker.js', import.meta.url));
    } catch (e) {
      reject(new Error('Web Worker недоступен. Откройте сайт через HTTP-сервер.'));
      return;
    }

    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error('Таймаут разбора файла'));
    }, 60000);

    worker.onmessage = (ev) => {
      clearTimeout(timer);
      worker.terminate();
      if (ev.data.type === 'ok') {
        resolve({
          headers: ev.data.headers,
          rows: ev.data.rows,
          fileName: ev.data.fileName || fileName,
        });
      } else {
        reject(new Error(ev.data.message || 'Ошибка worker'));
      }
    };
    worker.onerror = (err) => {
      clearTimeout(timer);
      worker.terminate();
      reject(new Error(err.message || 'Ошибка worker'));
    };

    worker.postMessage({ type: 'parse', buffer, fileName }, [buffer]);
  });
}

export { autoMap, rowsToSchedule, FIELD_KEYS, buildTemplateCsv };

/**
 * Скачать шаблон CSV
 */
export function downloadTemplate() {
  try {
    const blob = new Blob([buildTemplateCsv()], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'schedule-template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Шаблон скачан', 'success');
  } catch (e) {
    toast(e.message || 'Не удалось скачать шаблон', 'error');
  }
}
