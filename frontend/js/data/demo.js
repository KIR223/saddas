/**
 * Демо-расписание для первого запуска
 */

import { createEmptySchedule, createLesson, DEFAULT_PAIR_TIMES } from '../models/schedule.js';

/**
 * @returns {import('../models/schedule.js').ScheduleData}
 */
export function createDemoSchedule() {
  const data = createEmptySchedule();
  data.meta = {
    institution: 'Демо-колледж',
    semester: 'Осень 2025',
    sourceFile: 'demo',
  };
  data.settings.defaultGroup = 'ИС-21';
  data.settings.pairTimes = [...DEFAULT_PAIR_TIMES];

  const mk = (partial) => createLesson(partial);

  data.groups['ИС-21'] = {
    name: 'ИС-21',
    days: {
      1: [
        mk({ pair: 1, subject: 'Математический анализ', teacher: 'Иванова А.С.', room: '301', type: 'lecture' }),
        mk({ pair: 2, subject: 'Программирование', teacher: 'Петров В.И.', room: '215', type: 'lab', subgroup: '1' }),
        mk({ pair: 2, subject: 'Программирование', teacher: 'Сидоров К.М.', room: '216', type: 'lab', subgroup: '2' }),
        mk({ pair: 3, subject: 'Английский язык', teacher: 'Brown J.', room: '112', type: 'practice' }),
        mk({ pair: 5, subject: 'Физкультура', teacher: 'Козлов Д.А.', room: 'Спортзал', type: 'practice' }),
      ],
      2: [
        mk({ pair: 1, subject: 'Базы данных', teacher: 'Смирнова Е.В.', room: '401', type: 'lecture' }),
        mk({ pair: 2, subject: 'Базы данных', teacher: 'Смирнова Е.В.', room: '402', type: 'lab' }),
        mk({ pair: 3, subject: 'История', teacher: 'Орлова Н.П.', room: '105', type: 'lecture' }),
        mk({ pair: 4, subject: 'Веб-разработка', teacher: 'Петров В.И.', room: '215', type: 'practice' }),
      ],
      3: [
        mk({ pair: 2, subject: 'Дискретная математика', teacher: 'Иванова А.С.', room: '301', type: 'lecture' }),
        mk({ pair: 3, subject: 'Дискретная математика', teacher: 'Иванова А.С.', room: '303', type: 'practice' }),
        mk({ pair: 4, subject: 'Операционные системы', teacher: 'Волков М.Р.', room: '220', type: 'lecture' }),
        mk({ pair: 5, subject: 'Операционные системы', teacher: 'Волков М.Р.', room: '221', type: 'lab', week: 'odd' }),
        mk({ pair: 5, subject: 'Сети', teacher: 'Волков М.Р.', room: '222', type: 'lab', week: 'even' }),
      ],
      4: [
        mk({ pair: 1, subject: 'Программирование', teacher: 'Петров В.И.', room: '215', type: 'lecture' }),
        mk({ pair: 2, subject: 'Английский язык', teacher: 'Brown J.', room: '112', type: 'practice' }),
        mk({ pair: 3, subject: 'Веб-разработка', teacher: 'Петров В.И.', room: '215', type: 'lab' }),
        mk({ pair: 4, subject: 'Философия', teacher: 'Орлова Н.П.', room: '108', type: 'lecture' }),
      ],
      5: [
        mk({ pair: 1, subject: 'Сети', teacher: 'Волков М.Р.', room: '220', type: 'lecture' }),
        mk({ pair: 2, subject: 'Базы данных', teacher: 'Смирнова Е.В.', room: '401', type: 'practice' }),
        mk({ pair: 3, subject: 'Кураторский час', teacher: 'Петров В.И.', room: '215', type: 'other' }),
      ],
      6: [
        mk({ pair: 1, subject: 'Проектная деятельность', teacher: 'Петров В.И.', room: '215', type: 'practice' }),
        mk({ pair: 2, subject: 'Консультация', teacher: 'Иванова А.С.', room: '301', type: 'consult' }),
      ],
    },
  };

  data.groups['ПО-22'] = {
    name: 'ПО-22',
    days: {
      1: [
        mk({ pair: 2, subject: 'Алгоритмы', teacher: 'Петров В.И.', room: '310', type: 'lecture' }),
        mk({ pair: 3, subject: 'Алгоритмы', teacher: 'Петров В.И.', room: '311', type: 'practice' }),
        mk({ pair: 4, subject: 'UI/UX', teacher: 'Лебедева Т.О.', room: '118', type: 'lab' }),
      ],
      2: [
        mk({ pair: 1, subject: 'Java', teacher: 'Сидоров К.М.', room: '216', type: 'lecture' }),
        mk({ pair: 2, subject: 'Java', teacher: 'Сидоров К.М.', room: '216', type: 'lab' }),
        mk({ pair: 4, subject: 'Математика', teacher: 'Иванова А.С.', room: '301', type: 'lecture' }),
      ],
      3: [
        mk({ pair: 1, subject: 'Тестирование', teacher: 'Лебедева Т.О.', room: '118', type: 'practice' }),
        mk({ pair: 3, subject: 'Сети', teacher: 'Волков М.Р.', room: '220', type: 'lecture' }),
        mk({ pair: 4, subject: 'Физкультура', teacher: 'Козлов Д.А.', room: 'Спортзал', type: 'practice' }),
      ],
      4: [
        mk({ pair: 2, subject: 'Java', teacher: 'Сидоров К.М.', room: '216', type: 'practice' }),
        mk({ pair: 3, subject: 'UI/UX', teacher: 'Лебедева Т.О.', room: '118', type: 'lecture' }),
        mk({ pair: 5, subject: 'Проект', teacher: 'Петров В.И.', room: '310', type: 'other' }),
      ],
      5: [
        mk({ pair: 1, subject: 'Алгоритмы', teacher: 'Петров В.И.', room: '311', type: 'lab' }),
        mk({ pair: 2, subject: 'Английский язык', teacher: 'Brown J.', room: '112', type: 'practice' }),
      ],
      6: [],
    },
  };

  return data;
}
