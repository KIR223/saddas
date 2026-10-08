/**
 * Экспорт: JSON, ICS, CSV (Excel), печать
 */

import { DAY_NAMES, filterByWeek } from '../models/schedule.js';
import { getMelmkWeekType } from '../models/bells.js';
import { toast } from '../utils/toast.js';

/**
 * @param {string} filename
 * @param {Blob} blob
 */
function downloadBlob(filename, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * @param {import('../models/schedule.js').ScheduleData} data
 */
export function exportJson(data) {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(`schedule-${Date.now()}.json`, blob);
    toast('JSON сохранён', 'success');
  } catch (e) {
    toast(e.message || 'Ошибка экспорта JSON', 'error');
  }
}

/**
 * CSV для Excel
 * @param {import('../models/schedule.js').ScheduleData} data
 * @param {string} [groupFilter]
 */
export function exportCsv(data, groupFilter) {
  try {
    const lines = ['Группа,День,Пара,Предмет,Преподаватель,Кабинет,Тип,Подгруппа,Неделя,Начало,Конец'];
    const groups = groupFilter ? [groupFilter] : Object.keys(data.groups);
    for (const gn of groups) {
      const g = data.groups[gn];
      if (!g) continue;
      for (const [day, lessons] of Object.entries(g.days || {})) {
        for (const l of lessons) {
          const row = [
            gn,
            DAY_NAMES[day] || day,
            l.pair,
            l.subject,
            l.teacher,
            l.room,
            l.type,
            l.subgroup || '',
            l.week,
            l.start,
            l.end,
          ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
          lines.push(row.join(','));
        }
      }
    }
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    downloadBlob(`schedule-${groupFilter || 'all'}.csv`, blob);
    toast('CSV сохранён (откройте в Excel)', 'success');
  } catch (e) {
    toast(e.message || 'Ошибка экспорта CSV', 'error');
  }
}

/**
 * ICS календарь для группы (на 8 недель вперёд от текущего понедельника)
 * @param {import('../models/schedule.js').ScheduleData} data
 * @param {string} groupName
 */
export function exportIcs(data, groupName) {
  try {
    const g = data.groups[groupName];
    if (!g) throw new Error('Группа не найдена');

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ScheduleApp//RU',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];

    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() + (day === 0 ? -6 : 1 - day));
    monday.setHours(0, 0, 0, 0);

    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

    for (let week = 0; week < 8; week++) {
      for (let d = 1; d <= 6; d++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + week * 7 + (d - 1));
        const weekType = getMelmkWeekType(date);
        const parity = weekType === 'green' ? 'odd' : 'even';
        const lessons = filterByWeek(g.days[String(d)] || [], parity);
        for (const l of lessons) {
          const [sh, sm] = (l.start || '08:30').split(':').map(Number);
          const [eh, em] = (l.end || '10:00').split(':').map(Number);
          const start = new Date(date);
          start.setHours(sh || 0, sm || 0, 0, 0);
          const end = new Date(date);
          end.setHours(eh || 0, em || 0, 0, 0);

          const uid = `${l.id || `${groupName}-${d}-${l.pair}`}-w${week}@melmk`;
          const summary = String(l.subject || '').replace(/[,;\\]/g, ' ');
          const loc = String(l.room || '').replace(/[,;\\]/g, ' ');
          const desc = [l.teacher, l.type, groupName, weekTypeLabelSafe(weekType)].filter(Boolean).join(' · ');

          lines.push(
            'BEGIN:VEVENT',
            `UID:${uid}`,
            `DTSTAMP:${fmt(now)}`,
            `DTSTART:${fmt(start)}`,
            `DTEND:${fmt(end)}`,
            `SUMMARY:${summary}`,
            `LOCATION:${loc}`,
            `DESCRIPTION:${desc}`,
            'BEGIN:VALARM',
            'TRIGGER:-PT15M',
            'ACTION:DISPLAY',
            `DESCRIPTION:${summary}`,
            'END:VALARM',
            'END:VEVENT'
          );
        }
      }
    }

    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    downloadBlob(`schedule-${groupName}.ics`, blob);
    toast('Календарь ICS сохранён', 'success');
  } catch (e) {
    toast(e.message || 'Ошибка ICS', 'error');
  }
}

function weekTypeLabelSafe(type) {
  return type === 'green' ? 'Зелёная' : type === 'red' ? 'Красная' : '';
}

export function printSchedule() {
  window.print();
}
