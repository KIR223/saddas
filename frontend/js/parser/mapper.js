/**
 * Сопоставление колонок Excel → поля модели
 */

export const FIELD_KEYS = [
  { key: 'group', label: 'Группа', required: true },
  { key: 'day', label: 'День недели', required: true },
  { key: 'pair', label: 'Номер пары', required: true },
  { key: 'subject', label: 'Предмет', required: true },
  { key: 'teacher', label: 'Преподаватель', required: false },
  { key: 'room', label: 'Кабинет', required: false },
  { key: 'type', label: 'Тип занятия', required: false },
  { key: 'subgroup', label: 'Подгруппа', required: false },
  { key: 'week', label: 'Чётность', required: false },
  { key: 'start', label: 'Начало', required: false },
  { key: 'end', label: 'Конец', required: false },
];

const ALIASES = {
  group: ['группа', 'group', 'гр', 'групп'],
  day: ['день', 'день недели', 'day', 'weekday'],
  pair: ['пара', 'номер пары', 'pair', '№ пары', 'n пары'],
  subject: ['предмет', 'дисциплина', 'subject', 'название'],
  teacher: ['преподаватель', 'учитель', 'teacher', 'фио', 'препод'],
  room: ['кабинет', 'аудитория', 'ауд', 'room', 'ауд.'],
  type: ['тип', 'вид', 'type', 'вид занятия'],
  subgroup: ['подгруппа', 'п/г', 'subgroup', 'подгр'],
  week: ['неделя', 'чётность', 'week', 'четность'],
  start: ['начало', 'start', 'с'],
  end: ['конец', 'end', 'по', 'окончание'],
};

/**
 * Авто-угадывание маппинга по заголовкам
 * @param {string[]} headers
 * @returns {Record<string, number>} field → column index (-1 если нет)
 */
export function autoMap(headers) {
  const map = {};
  const normalized = headers.map((h) => String(h || '').trim().toLowerCase());
  for (const { key } of FIELD_KEYS) {
    map[key] = -1;
    const aliases = ALIASES[key] || [];
    for (let i = 0; i < normalized.length; i++) {
      if (aliases.some((a) => normalized[i] === a || normalized[i].includes(a))) {
        map[key] = i;
        break;
      }
    }
  }
  return map;
}

const DAY_MAP = {
  понедельник: '1', пн: '1', mon: '1', '1': '1',
  вторник: '2', вт: '2', tue: '2', '2': '2',
  среда: '3', ср: '3', wed: '3', '3': '3',
  четверг: '4', чт: '4', thu: '4', '4': '4',
  пятница: '5', пт: '5', fri: '5', '5': '5',
  суббота: '6', сб: '6', sat: '6', '6': '6',
};

const TYPE_MAP = {
  лекция: 'lecture', лек: 'lecture', lecture: 'lecture', л: 'lecture',
  практика: 'practice', пр: 'practice', practice: 'practice',
  лабораторная: 'lab', лаб: 'lab', lab: 'lab',
  экзамен: 'exam', exam: 'exam',
  консультация: 'consult', consult: 'consult',
};

/**
 * @param {unknown} val
 * @returns {string}
 */
export function normalizeDay(val) {
  const s = String(val ?? '').trim().toLowerCase();
  return DAY_MAP[s] || DAY_MAP[s.slice(0, 2)] || '';
}

/**
 * @param {unknown} val
 * @returns {import('../models/schedule.js').LessonType}
 */
export function normalizeType(val) {
  const s = String(val ?? '').trim().toLowerCase();
  return TYPE_MAP[s] || 'other';
}

/**
 * @param {unknown} val
 * @returns {import('../models/schedule.js').WeekParity}
 */
export function normalizeWeek(val) {
  const s = String(val ?? '').trim().toLowerCase();
  if (!s || s === 'все' || s === 'all' || s === 'каждая') return 'all';
  if (s.includes('неч') || s === 'odd' || s === '1') return 'odd';
  if (s.includes('чёт') || s.includes('чет') || s === 'even' || s === '2') return 'even';
  return 'all';
}

/**
 * Собрать ScheduleData из строк + маппинга
 * @param {unknown[][]} rows — без заголовка
 * @param {Record<string, number>} mapping
 * @param {string} sourceFile
 */
export function rowsToSchedule(rows, mapping, sourceFile = '') {
  /** @type {import('../models/schedule.js').ScheduleData} */
  const data = {
    version: 1,
    updatedAt: new Date().toISOString(),
    meta: { institution: '', semester: '', sourceFile },
    groups: {},
    substitutions: [],
    settings: {
      theme: 'system',
      defaultGroup: '',
      pairTimes: [
        { pair: 1, start: '08:00', end: '09:00' },
        { pair: 2, start: '09:05', end: '10:05' },
        { pair: 3, start: '10:10', end: '11:10' },
        { pair: 4, start: '11:40', end: '12:40' },
        { pair: 5, start: '12:45', end: '13:45' },
      ],
      adminUnlocked: false,
      showWeekends: true,
    },
  };

  const DEFAULT_TIMES = data.settings.pairTimes;
  let idCounter = 0;

  for (const row of rows) {
    if (!row || !row.length) continue;
    const get = (key) => {
      const idx = mapping[key];
      if (idx == null || idx < 0) return '';
      const v = row[idx];
      return v == null ? '' : String(v).trim();
    };

    const group = get('group');
    const day = normalizeDay(get('day'));
    const pair = Number(get('pair')) || 0;
    const subject = get('subject');
    if (!group || !day || !pair || !subject) continue;

    if (!data.groups[group]) {
      data.groups[group] = { name: group, days: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] } };
    }
    if (!data.groups[group].days[day]) data.groups[group].days[day] = [];

    const slot = DEFAULT_TIMES.find((t) => t.pair === pair) || DEFAULT_TIMES[0];
    const subgroupRaw = get('subgroup');
    const lesson = {
      id: `imp_${Date.now().toString(36)}_${idCounter++}`,
      pair,
      start: get('start') || slot.start,
      end: get('end') || slot.end,
      subject,
      teacher: get('teacher'),
      room: get('room'),
      type: normalizeType(get('type')),
      subgroup: subgroupRaw ? String(subgroupRaw) : null,
      week: normalizeWeek(get('week')),
      replaced: false,
    };
    data.groups[group].days[day].push(lesson);
  }

  const groups = Object.keys(data.groups);
  if (groups.length) data.settings.defaultGroup = groups.sort((a, b) => a.localeCompare(b, 'ru'))[0];
  return data;
}

/**
 * CSV/TSV шаблон для скачивания
 */
export function buildTemplateCsv() {
  const header = 'Группа,День,Пара,Предмет,Преподаватель,Кабинет,Тип,Подгруппа,Неделя,Начало,Конец';
  const sample = [
    'ИС-21,Понедельник,1,Математика,Иванова А.С.,301,Лекция,,все,08:30,10:00',
    'ИС-21,Понедельник,2,Программирование,Петров В.И.,215,Лабораторная,1,все,10:10,11:40',
  ];
  return `\uFEFF${header}\n${sample.join('\n')}\n`;
}
