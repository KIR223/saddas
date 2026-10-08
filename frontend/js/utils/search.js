/**
 * Глобальный поиск: группы, преподаватели, кабинеты, предметы
 */

import {
  listGroups, listTeachers, listRooms, searchLessons, DAY_NAMES,
} from '../models/schedule.js';
import { matchesTokens, queryTokens, highlightParts, normalizeQuery } from './normalize.js';

/**
 * @typedef {{ type: 'group'|'teacher'|'room'|'subject'|'lesson', id: string, title: string, subtitle?: string, group?: string, day?: string, lesson?: object }} SearchHit
 */

/**
 * @param {import('../models/schedule.js').ScheduleData} data
 * @param {string} query
 * @returns {{ groups: SearchHit[], teachers: SearchHit[], rooms: SearchHit[], subjects: SearchHit[], lessons: SearchHit[] }}
 */
export function globalSearch(data, query) {
  const tokens = queryTokens(query);
  const empty = { groups: [], teachers: [], rooms: [], subjects: [], lessons: [] };
  if (!tokens.length) return empty;

  const groups = listGroups(data)
    .filter((g) => matchesTokens(g, tokens))
    .slice(0, 20)
    .map((g) => ({ type: 'group', id: `g:${g}`, title: g, subtitle: 'Группа' }));

  const teachers = listTeachers(data)
    .filter((t) => matchesTokens(t, tokens))
    .slice(0, 20)
    .map((t) => ({ type: 'teacher', id: `t:${t}`, title: t, subtitle: 'Преподаватель' }));

  const rooms = listRooms(data)
    .filter((r) => matchesTokens(r, tokens))
    .slice(0, 20)
    .map((r) => ({ type: 'room', id: `r:${r}`, title: r, subtitle: 'Кабинет' }));

  /** Уникальные предметы */
  const subjSet = new Map();
  for (const [group, g] of Object.entries(data.groups || {})) {
    for (const [day, lessons] of Object.entries(g.days || {})) {
      for (const lesson of lessons) {
        if (!lesson.subject) continue;
        if (!matchesTokens(lesson.subject, tokens)) continue;
        const key = normalizeQuery(lesson.subject);
        if (!subjSet.has(key)) {
          subjSet.set(key, {
            type: 'subject',
            id: `s:${key}`,
            title: lesson.subject,
            subtitle: 'Предмет',
            group,
            day,
            lesson,
          });
        }
      }
    }
  }
  const subjects = [...subjSet.values()].slice(0, 30);

  const lessons = searchLessons(data, query)
    .slice(0, 40)
    .map(({ group, day, lesson }) => ({
      type: 'lesson',
      id: `l:${lesson.id}`,
      title: lesson.subject || 'Пара',
      subtitle: `${group} · ${DAY_NAMES[day] || day} · ${lesson.start || ''}`,
      group,
      day,
      lesson,
    }));

  // Расширенный searchLessons уже есть; дополнительно фильтруем токенами
  const lessonFiltered = lessons.filter((hit) => {
    const hay = [
      hit.group, hit.title, hit.lesson?.teacher, hit.lesson?.room, hit.subtitle,
    ].join(' ');
    return matchesTokens(hay, tokens);
  });

  return { groups, teachers, rooms, subjects, lessons: lessonFiltered };
}

export { highlightParts, queryTokens, normalizeQuery };
