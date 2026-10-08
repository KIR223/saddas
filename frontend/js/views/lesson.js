/**
 * Карточка пары: акцент по предмету, раскрытие деталей, замена
 */

import { el } from '../utils/dom.js';
import { TYPE_LABELS } from '../models/schedule.js';

/**
 * Мягкий цвет и иконка по ключевым словам предмета
 * @param {string} subject
 */
export function subjectStyle(subject) {
  const s = String(subject || '').toLowerCase().replace(/ё/g, 'е');
  const rules = [
    { keys: ['матем', 'алгебр', 'геометр'], color: 'subj-math', icon: '∑' },
    { keys: ['информат', 'программ', 'код', 'python', 'java', '1с', '1c'], color: 'subj-it', icon: '</>' },
    { keys: ['физик'], color: 'subj-phys', icon: '⚛' },
    { keys: ['хими'], color: 'subj-chem', icon: '⚗' },
    { keys: ['биолог', 'эколог'], color: 'subj-bio', icon: '🌿' },
    { keys: ['истор', 'общество'], color: 'subj-hist', icon: '📜' },
    { keys: ['русск', 'литерат'], color: 'subj-lang', icon: 'А' },
    { keys: ['англ', 'иностр', 'немец', 'франц'], color: 'subj-eng', icon: 'A' },
    { keys: ['физкульт', 'спорт'], color: 'subj-pe', icon: '⚽' },
    { keys: ['эконом', 'бухг', 'финанс'], color: 'subj-eco', icon: '₽' },
    { keys: ['туриз', 'гостинич'], color: 'subj-tour', icon: '✈' },
    { keys: ['права', 'право', 'юриди'], color: 'subj-law', icon: '§' },
    { keys: ['куратор', 'разговор о важном', 'горизонт'], color: 'subj-curator', icon: '★' },
  ];
  for (const r of rules) {
    if (r.keys.some((k) => s.includes(k))) return r;
  }
  return { color: 'subj-default', icon: '●' };
}

/**
 * @param {import('../models/schedule.js').Lesson} lesson
 * @param {{ isNow?: boolean, isChanged?: boolean, showGroup?: string, isPast?: boolean }} [opts]
 * @returns {HTMLElement}
 */
export function renderLessonCard(lesson, opts = {}) {
  const style = subjectStyle(lesson.subject);
  const card = el('article', `lesson-card ${style.color}`);
  card.setAttribute('role', 'listitem');
  if (opts.isNow) card.classList.add('is-now');
  if (opts.isPast) card.classList.add('is-past');
  if (opts.isChanged || lesson.replaced) card.classList.add('is-changed');
  if (lesson.cancelled) card.classList.add('is-cancelled');
  if (lesson.isCurator) card.classList.add('is-curator');

  const time = el('div', 'lesson-card__time');
  if (!lesson.isCurator) {
    time.appendChild(el('div', 'lesson-card__pair', String(lesson.pair)));
  } else {
    time.appendChild(el('div', 'lesson-card__pair', '★'));
  }
  time.appendChild(el('div', '', lesson.start));
  time.appendChild(el('div', '', lesson.end));

  const body = el('div', 'lesson-card__body');
  const titleRow = el('div', 'lesson-card__title-row');
  titleRow.appendChild(el('span', 'lesson-card__icon', style.icon));
  titleRow.appendChild(el('div', 'lesson-card__subject', lesson.subject || 'Без названия'));
  body.appendChild(titleRow);

  const badges = el('div', 'lesson-card__row');
  if (!lesson.isCurator) {
    badges.appendChild(el('span', `badge badge--${lesson.type}`, TYPE_LABELS[lesson.type] || lesson.type));
  }
  if (lesson.subgroup) badges.appendChild(el('span', 'badge', `Подгр. ${lesson.subgroup}`));
  if (lesson.week === 'odd') badges.appendChild(el('span', 'badge', 'Нечётная'));
  if (lesson.week === 'even') badges.appendChild(el('span', 'badge', 'Чётная'));
  if (lesson.replaced) badges.appendChild(el('span', 'badge badge--replaced', 'Замена'));
  if (lesson.cancelled) badges.appendChild(el('span', 'badge badge--cancelled', 'Отмена'));
  if (lesson.room) badges.appendChild(el('span', 'badge badge--room', lesson.room));
  if (lesson.teacher) badges.appendChild(el('span', 'badge badge--teacher', lesson.teacher));
  body.appendChild(badges);

  if (lesson.replaced && lesson.original) {
    const was = el('div', 'lesson-card__was');
    const parts = [lesson.original.subject, lesson.original.teacher, lesson.original.room]
      .filter(Boolean)
      .join(' · ');
    was.textContent = parts ? `было: ${parts}` : 'было: —';
    body.appendChild(was);
  }

  const details = el('div', 'lesson-card__details');
  details.hidden = true;
  if (lesson.teacher) details.appendChild(el('div', '', `Преподаватель: ${lesson.teacher}`));
  if (lesson.room) details.appendChild(el('div', '', `Кабинет: ${lesson.room}`));
  if (lesson.subgroup) details.appendChild(el('div', '', `Подгруппа: ${lesson.subgroup}`));
  if (lesson.comment) details.appendChild(el('div', '', `Комментарий: ${lesson.comment}`));
  if (opts.showGroup) details.appendChild(el('div', '', `Группа: ${opts.showGroup}`));
  body.appendChild(details);

  card.addEventListener('click', () => {
    const open = details.hidden;
    details.hidden = !open;
    card.classList.toggle('is-open', open);
  });

  card.append(time, body);
  return card;
}

/**
 * Мини-карточка для недельной сетки
 */
export function renderWeekLesson(lesson, opts = {}) {
  const style = subjectStyle(lesson.subject);
  const box = el('div', `week-lesson ${style.color}`);
  if (opts.isNow) box.classList.add('is-now');
  if (opts.isChanged || lesson.replaced) box.classList.add('is-changed');
  box.appendChild(el('div', 'week-lesson__subj', lesson.subject || '—'));
  const metaParts = [lesson.room, lesson.teacher].filter(Boolean).join(' · ');
  if (metaParts) box.appendChild(el('div', 'week-lesson__meta', metaParts));
  if (lesson.subgroup) box.appendChild(el('div', 'week-lesson__meta', `п/г ${lesson.subgroup}`));
  if (lesson.replaced) box.appendChild(el('div', 'week-lesson__meta', 'Замена'));
  return box;
}
