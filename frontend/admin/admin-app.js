/**
 * Панель администратора МелМК — точка входа
 */

import {
  tryLogin, isLoggedIn, logout, touchSession, getAuthLockStatus,
} from '../js/utils/auth.js';
import { initTheme, toggleTheme, syncModeButton, setMode } from '../js/utils/theme.js';
import { loadSchedule, saveSchedule } from '../js/storage/store.js';
import {
  loadBellsConfig, saveBellsConfig, resetBellsConfig, validateBellSlots,
  getMelmkWeekType, weekTypeLabel,
} from '../js/models/bells.js';
import {
  addSubstitution, updateSubstitution, removeSubstitution, clearSubstitutions,
  listSubjects, toDateKey, isSubActive,
} from '../js/models/substitutions.js';
import {
  listGroups, listTeachers, listRooms, DAY_NAMES, createLesson, ensureCatalog,
  createEmptySchedule,
} from '../js/models/schedule.js';
import { pushAudit, loadAudit, clearAudit } from '../js/utils/audit.js';
import { toast } from '../js/utils/toast.js';
import { el, clear, setText } from '../js/utils/dom.js';
import { parseFile } from '../js/parser/excel.js';
import { autoMap, rowsToSchedule } from '../js/parser/mapper.js';
import { exportJson, exportCsv, exportIcs, printSchedule } from '../js/export/export.js';
import { uploadAndSync } from '../js/api/sync.js';
import { getAdminToken } from '../js/api/config.js';
import { LS, APP_NAME } from '../js/config.js';
import {
  renderScheduleEditor, renderTeachersEditor, renderRoomsEditor,
} from './admin-editors.js';

/** @type {import('../js/models/schedule.js').ScheduleData|null} */
let scheduleData = null;

/** @type {'home'|'schedule'|'subs'|'teachers'|'rooms'|'bells'|'data'|'more'} */
let section = 'home';

const SECTION_TITLES = {
  home: 'Главная',
  schedule: 'Расписание',
  subs: 'Замены',
  teachers: 'Преподаватели',
  rooms: 'Кабинеты',
  bells: 'Звонки',
  data: 'Данные',
  more: 'Ещё',
};

const WIZARD_STEPS = ['Группа', 'Пара', 'Преподаватель', 'Детали', 'Проверка'];

const loginScreen = document.getElementById('login-screen');
const adminApp = document.getElementById('admin-app');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const content = document.getElementById('adm-content');
const pageTitle = document.getElementById('adm-page-title');

const fileInputExcel = document.createElement('input');
fileInputExcel.type = 'file';
fileInputExcel.accept = '.xlsx,.xls,.csv';
fileInputExcel.hidden = true;
document.body.appendChild(fileInputExcel);

const fileInputJson = document.createElement('input');
fileInputJson.type = 'file';
fileInputJson.accept = 'application/json,.json';
fileInputJson.hidden = true;
document.body.appendChild(fileInputJson);

/** Черновик мастера замен */
/** @type {object|null} */
let subWizard = null;

let draftSaveTimer = null;
let bellsSaveTimer = null;

/** Тема админки: те же mk_theme / mk_mode + читаемый контраст */
function initAdminTheme() {
  // system на телефоне даёт тёмный текст-токен при белых карточках — стартуем со светлой, если не задано
  try {
    if (!localStorage.getItem('mk_mode')) setMode('light');
  } catch { /* ignore */ }
  initTheme();
  syncModeButton();
  document.getElementById('mood-stylesheet')?.remove();
  document.getElementById('btn-theme')?.addEventListener('click', () => {
    touchSession();
    toggleTheme();
    syncModeButton();
  });
}

/** Toast с кнопкой «Отменить» (5 с) */
function toastUndo(message, onUndo) {
  const root = document.getElementById('toast-root');
  const node = document.createElement('div');
  node.className = 'toast toast--info';
  node.setAttribute('role', 'status');
  const text = document.createElement('span');
  text.textContent = message;
  node.appendChild(text);
  const actions = el('div', 'adm-toast-actions');
  const undoBtn = document.createElement('button');
  undoBtn.type = 'button';
  undoBtn.textContent = 'Отменить';
  let undone = false;
  undoBtn.addEventListener('click', () => {
    if (undone) return;
    undone = true;
    onUndo();
    node.remove();
  });
  actions.appendChild(undoBtn);
  node.appendChild(actions);
  root.appendChild(node);
  requestAnimationFrame(() => node.classList.add('toast--show'));
  setTimeout(() => {
    if (!undone) node.classList.remove('toast--show');
    setTimeout(() => node.remove(), 280);
  }, 5000);
}

function confirmDanger(message) {
  touchSession();
  return window.confirm(message);
}

function bindActivity() {
  const bump = () => {
    if (isLoggedIn()) touchSession();
  };
  ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach((ev) => {
    document.addEventListener(ev, bump, { passive: true });
  });
  setInterval(() => {
    if (adminApp.hidden) return;
    if (!isLoggedIn()) {
      toast('Сессия истекла (20 мин)', 'warn');
      showLogin();
    }
  }, 30000);
}

function setAuthUi(loggedIn) {
  document.body.classList.toggle('adm-state-app', loggedIn);
  document.body.classList.toggle('adm-state-login', !loggedIn);
  if (adminApp) {
    adminApp.hidden = !loggedIn;
    if (loggedIn) adminApp.removeAttribute('hidden');
    else adminApp.setAttribute('hidden', '');
  }
  if (loginScreen) {
    loginScreen.hidden = loggedIn;
    if (loggedIn) loginScreen.setAttribute('hidden', '');
    else loginScreen.removeAttribute('hidden');
  }
  // После входа — к началу страницы, без «листать вниз»
  window.scrollTo(0, 0);
}

function showLogin() {
  logout();
  setAuthUi(false);
}

async function showApp() {
  setAuthUi(true);
  try {
    scheduleData = await loadSchedule();
  } catch (e) {
    console.warn('loadSchedule', e);
    scheduleData = createEmptySchedule();
  }
  ensureCatalog(scheduleData);
  section = parseHashSection();
  setText(pageTitle, SECTION_TITLES[section] || 'Главная');
  document.querySelectorAll('[data-section]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.getAttribute('data-section') === section);
  });
  renderSection();
}

function setSection(next) {
  section = next;
  const hash = `#${next}`;
  if (location.hash !== hash) location.hash = hash;
  document.querySelectorAll('[data-section]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.getAttribute('data-section') === next);
  });
  setText(pageTitle, SECTION_TITLES[next] || next);
  renderSection();
}

function parseHashSection() {
  const h = (location.hash || '#home').replace('#', '');
  if (SECTION_TITLES[h]) return h;
  return 'home';
}

async function persistSchedule(detectChanges = true) {
  if (!scheduleData) return;
  await saveSchedule(scheduleData, { detectChanges, keepPrev: true });
}

function countActiveSubs() {
  return (scheduleData?.substitutions || []).filter((s) => isSubActive(s)).length;
}

function defaultWizardDraft() {
  return {
    step: 0,
    editId: null,
    group: listGroups(scheduleData)[0] || '',
    day: '1',
    lessonId: '',
    pair: 1,
    teacher: '',
    room: '',
    subject: '',
    dateFrom: toDateKey(),
    dateTo: '',
    comment: '',
    cancelled: false,
  };
}

function loadSubDraft() {
  try {
    const raw = localStorage.getItem(LS.subDraft);
    if (raw) return { ...defaultWizardDraft(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultWizardDraft();
}

function scheduleDraftSave() {
  if (!subWizard) return;
  clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(() => {
    try {
      localStorage.setItem(LS.subDraft, JSON.stringify(subWizard));
    } catch { /* ignore */ }
  }, 300);
}

function clearSubDraftStorage() {
  try {
    localStorage.removeItem(LS.subDraft);
  } catch { /* ignore */ }
}

function getOriginalLesson(group, day, lessonId) {
  const g = scheduleData?.groups?.[group];
  if (!g) return null;
  const list = g.days[String(day)] || [];
  return list.find((l) => l.id === lessonId) || null;
}

function editorCtx() {
  return {
    data: scheduleData,
    persist: persistSchedule,
    rerender: () => renderSection(),
  };
}

function renderSection() {
  touchSession();
  if (!scheduleData) return;
  ensureCatalog(scheduleData);
  clear(content);
  switch (section) {
    case 'home':
      renderHome(content);
      break;
    case 'schedule':
      renderScheduleEditor(content, editorCtx());
      break;
    case 'subs':
      renderSubstitutions(content);
      break;
    case 'teachers':
      renderTeachersEditor(content, editorCtx());
      break;
    case 'rooms':
      renderRoomsEditor(content, editorCtx());
      break;
    case 'bells':
      renderBellsEditor(content);
      break;
    case 'data':
      renderData(content);
      break;
    case 'more':
      renderMore(content);
      break;
    default:
      renderHome(content);
  }
}

function countLessons() {
  let n = 0;
  const groups = scheduleData?.groups || {};
  for (const g of Object.values(groups)) {
    for (const day of Object.values(g.days || {})) n += (day || []).length;
  }
  return n;
}

function renderEmptyBlock(root, title, text, actionLabel, onAction) {
  const box = el('div', 'adm-empty');
  box.appendChild(el('p', 'adm-empty__title', title));
  box.appendChild(el('p', 'adm-empty__text', text));
  if (actionLabel && onAction) {
    const b = el('button', 'btn btn--primary', actionLabel);
    b.type = 'button';
    b.addEventListener('click', () => { touchSession(); onAction(); });
    box.appendChild(b);
  }
  root.appendChild(box);
}

/** —— Главная —— */
function renderHome(root) {
  const wrap = el('div', 'adm-section');
  wrap.appendChild(el('h2', 'adm-section__title', 'Дашборд'));

  const weekType = getMelmkWeekType();
  const weekRow = el('div', 'adm-week-row');
  weekRow.appendChild(el('span', 'adm-muted', 'Тип текущей недели:'));
  const badge = el('span', `week-badge week-badge--${weekType}`, weekTypeLabel(weekType));
  badge.title = 'Только отображение (заморожено)';
  weekRow.appendChild(badge);
  wrap.appendChild(weekRow);

  const groupsN = listGroups(scheduleData).length;
  const teachersN = listTeachers(scheduleData).length;
  const lessonsN = countLessons();

  const stats = el('div', 'adm-stat-row');
  [
    [String(groupsN), 'Групп'],
    [String(teachersN), 'Преподавателей'],
    [String(lessonsN), 'Пар'],
    [String(countActiveSubs()), 'Активных замен'],
  ].forEach(([v, label]) => {
    const stat = el('div', 'adm-stat');
    stat.appendChild(el('div', 'adm-stat__value', v));
    stat.appendChild(el('div', 'adm-stat__label', label));
    stats.appendChild(stat);
  });
  wrap.appendChild(stats);

  if (!lessonsN) {
    renderEmptyBlock(
      wrap,
      'Расписание пусто',
      'Загрузите Excel или добавьте первую пару — иначе у студентов нечего смотреть.',
      'Загрузить Excel',
      () => pickExcelUpload()
    );
  }

  wrap.appendChild(el('h3', 'adm-section__title', 'Быстрые действия'));
  const actions = el('div', 'adm-quick-actions');
  const qa = [
    ['Добавить / править пары', () => setSection('schedule')],
    ['Новая замена', () => { subWizard = loadSubDraft(); setSection('subs'); }],
    ['Преподаватели', () => setSection('teachers')],
    ['Кабинеты', () => setSection('rooms')],
    ['Изменить звонки', () => setSection('bells')],
    ['Импорт Excel', () => pickExcelUpload()],
  ];
  for (const [label, fn] of qa) {
    const b = el('button', 'btn btn--outline', label);
    b.type = 'button';
    b.addEventListener('click', () => { touchSession(); fn(); });
    actions.appendChild(b);
  }
  wrap.appendChild(actions);

  wrap.appendChild(el('p', 'adm-muted', `${APP_NAME}: данные в браузере / API. Учётные записи и пароли в БД не менялись.`));
  root.appendChild(wrap);
}

/** —— Замены —— */
function renderSubstitutions(root) {
  if (!subWizard) subWizard = loadSubDraft();

  root.appendChild(renderSubWizard());
  root.appendChild(renderSubList());
}

function renderSubWizard() {
  const box = el('div', 'adm-wizard');
  const stepsBar = el('div', 'adm-wizard__steps');
  subWizard.step = Math.max(0, Math.min(WIZARD_STEPS.length - 1, subWizard.step || 0));
  WIZARD_STEPS.forEach((label, i) => {
    const s = el('button', 'adm-wizard__step', label);
    s.type = 'button';
    if (i < subWizard.step) s.classList.add('is-done');
    if (i === subWizard.step) s.classList.add('is-current');
    stepsBar.appendChild(s);
  });
  box.appendChild(stepsBar);

  const body = el('div', 'adm-wizard__body');
  body.appendChild(renderWizardStepBody());
  box.appendChild(body);

  const nav = el('div', 'adm-wizard__nav');
  if (subWizard.step > 0) {
    const back = el('button', 'btn btn--outline', 'Назад');
    back.type = 'button';
    back.addEventListener('click', () => {
      subWizard.step -= 1;
      scheduleDraftSave();
      renderSection();
    });
    nav.appendChild(back);
  }
  const nextLabel = subWizard.step >= WIZARD_STEPS.length - 1 ? 'Сохранить' : 'Далее';
  const next = el('button', 'btn btn--primary', nextLabel);
  next.type = 'button';
  next.addEventListener('click', () => onWizardNext());
  nav.appendChild(next);
  box.appendChild(nav);

  return box;
}

function renderWizardStepBody() {
  const wrap = el('div', 'adm-form');
  const groups = listGroups(scheduleData);

  if (subWizard.step === 0) {
    const gField = el('div', 'field');
    gField.appendChild(el('label', '', 'Группа'));
    const gSel = document.createElement('select');
    groups.forEach((g) => {
      const o = document.createElement('option');
      o.value = g;
      o.textContent = g;
      if (g === subWizard.group) o.selected = true;
      gSel.appendChild(o);
    });
    gSel.addEventListener('change', () => {
      subWizard.group = gSel.value;
      subWizard.lessonId = '';
      scheduleDraftSave();
    });
    gField.appendChild(gSel);

    const dField = el('div', 'field');
    dField.appendChild(el('label', '', 'День недели'));
    const dSel = document.createElement('select');
    for (let d = 1; d <= 6; d++) {
      const o = document.createElement('option');
      o.value = String(d);
      o.textContent = DAY_NAMES[d];
      if (String(d) === String(subWizard.day)) o.selected = true;
      dSel.appendChild(o);
    }
    dSel.addEventListener('change', () => {
      subWizard.day = dSel.value;
      subWizard.lessonId = '';
      scheduleDraftSave();
    });
    dField.appendChild(dSel);
    wrap.append(gField, dField);
    return wrap;
  }

  if (subWizard.step === 1) {
    const g = scheduleData.groups[subWizard.group];
    const lessons = g?.days[String(subWizard.day)] || [];
    wrap.appendChild(el('p', 'adm-muted', 'Выберите пару для замены или отмены'));
    const pField = el('div', 'field');
    pField.appendChild(el('label', '', 'Пара'));
    const pSel = document.createElement('select');
    if (!lessons.length) {
      const o = document.createElement('option');
      o.value = '';
      o.textContent = 'Нет пар в расписании';
      pSel.appendChild(o);
    } else {
      lessons.forEach((l) => {
        const o = document.createElement('option');
        o.value = l.id;
        o.textContent = `${l.pair}. ${l.subject}`;
        if (l.id === subWizard.lessonId) o.selected = true;
        pSel.appendChild(o);
      });
      if (!subWizard.lessonId && lessons[0]) {
        subWizard.lessonId = lessons[0].id;
        subWizard.pair = lessons[0].pair;
      }
    }
    pSel.addEventListener('change', () => {
      subWizard.lessonId = pSel.value;
      const les = lessons.find((x) => x.id === pSel.value);
      if (les) subWizard.pair = les.pair;
      scheduleDraftSave();
    });
    pField.appendChild(pSel);

    const cancelRow = el('div', 'adm-checkbox-row');
    const cancelCb = document.createElement('input');
    cancelCb.type = 'checkbox';
    cancelCb.id = 'wiz-cancel';
    cancelCb.checked = !!subWizard.cancelled;
    cancelCb.addEventListener('change', () => {
      subWizard.cancelled = cancelCb.checked;
      scheduleDraftSave();
    });
    const cancelLbl = el('label', '', 'Отменить пару (без замены)');
    cancelLbl.htmlFor = 'wiz-cancel';
    cancelRow.append(cancelCb, cancelLbl);
    wrap.append(pField, cancelRow);
    return wrap;
  }

  if (subWizard.step === 2) {
    wrap.appendChild(el('p', 'adm-muted', 'Поиск преподавателя (можно оставить прежнего)'));
    const tField = el('div', 'field');
    tField.appendChild(el('label', '', 'Преподаватель'));
    const tInput = document.createElement('input');
    tInput.type = 'search';
    tInput.value = subWizard.teacher || '';
    tInput.setAttribute('list', 'adm-teachers-list');
    tInput.addEventListener('input', () => {
      subWizard.teacher = tInput.value;
      scheduleDraftSave();
    });
    const dl = document.createElement('datalist');
    dl.id = 'adm-teachers-list';
    listTeachers(scheduleData).forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      dl.appendChild(opt);
    });
    tField.append(tInput, dl);
    wrap.appendChild(tField);
    return wrap;
  }

  if (subWizard.step === 3) {
    const rField = el('div', 'field');
    rField.appendChild(el('label', '', 'Кабинет'));
    const rInput = document.createElement('input');
    rInput.value = subWizard.room || '';
    rInput.setAttribute('list', 'adm-rooms-list');
    rInput.addEventListener('input', () => {
      subWizard.room = rInput.value;
      scheduleDraftSave();
    });
    const dlR = document.createElement('datalist');
    dlR.id = 'adm-rooms-list';
    listRooms(scheduleData).forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      dlR.appendChild(opt);
    });
    rField.append(rInput, dlR);

    const sField = el('div', 'field');
    sField.appendChild(el('label', '', 'Предмет'));
    const sInput = document.createElement('input');
    sInput.value = subWizard.subject || '';
    sInput.setAttribute('list', 'adm-subjects-list');
    sInput.addEventListener('input', () => {
      subWizard.subject = sInput.value;
      scheduleDraftSave();
    });
    const dlS = document.createElement('datalist');
    dlS.id = 'adm-subjects-list';
    listSubjects(scheduleData).forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      dlS.appendChild(opt);
    });
    sField.append(sInput, dlS);

    const df = el('div', 'field');
    df.appendChild(el('label', '', 'Дата с'));
    const dfIn = document.createElement('input');
    dfIn.type = 'date';
    dfIn.value = subWizard.dateFrom || '';
    dfIn.addEventListener('change', () => { subWizard.dateFrom = dfIn.value; scheduleDraftSave(); });
    df.appendChild(dfIn);

    const dt = el('div', 'field');
    dt.appendChild(el('label', '', 'Дата по (необяз.)'));
    const dtIn = document.createElement('input');
    dtIn.type = 'date';
    dtIn.value = subWizard.dateTo || '';
    dtIn.addEventListener('change', () => { subWizard.dateTo = dtIn.value; scheduleDraftSave(); });
    dt.appendChild(dtIn);

    const cField = el('div', 'field');
    cField.appendChild(el('label', '', 'Комментарий'));
    const cTa = document.createElement('textarea');
    cTa.rows = 2;
    cTa.value = subWizard.comment || '';
    cTa.addEventListener('input', () => { subWizard.comment = cTa.value; scheduleDraftSave(); });
    cField.appendChild(cTa);

    wrap.append(rField, sField, df, dt, cField);
    return wrap;
  }

  // Шаг 5 — превью
  const orig = getOriginalLesson(subWizard.group, subWizard.day, subWizard.lessonId);
  const preview = el('div', 'adm-preview');
  const was = el('div', 'adm-preview__box');
  if (orig) {
    was.appendChild(el('strong', '', 'Было'));
    was.appendChild(document.createElement('br'));
    was.appendChild(document.createTextNode(`${orig.subject} · ${orig.teacher} · ${orig.room}`));
  } else {
    was.textContent = 'Исходная пара не найдена';
  }
  preview.appendChild(was);
  preview.appendChild(el('div', 'adm-preview__arrow', '→'));
  const became = el('div', 'adm-preview__box adm-preview__box--new');
  became.appendChild(el('strong', '', 'Стало'));
  became.appendChild(document.createElement('br'));
  if (subWizard.cancelled) {
    became.appendChild(document.createTextNode('Пара отменена'));
  } else {
    const subj = subWizard.subject || orig?.subject || '—';
    const teach = subWizard.teacher || orig?.teacher || '—';
    const room = subWizard.room || orig?.room || '—';
    became.appendChild(document.createTextNode(`${subj} · ${teach} · ${room}`));
  }
  preview.appendChild(became);
  wrap.appendChild(preview);

  const dates = el('p', 'adm-muted', '');
  dates.textContent = `Период: ${subWizard.dateFrom || '—'} — ${subWizard.dateTo || '∞'}`;
  wrap.appendChild(dates);
  if (subWizard.comment) {
    wrap.appendChild(el('p', 'adm-muted', `Комментарий: ${subWizard.comment}`));
  }
  return wrap;
}

async function onWizardNext() {
  touchSession();
  if (subWizard.step === 1 && !subWizard.lessonId) {
    toast('Выберите пару', 'warn');
    return;
  }
  if (subWizard.step < WIZARD_STEPS.length - 1) {
    if (subWizard.step === 1) {
      const orig = getOriginalLesson(subWizard.group, subWizard.day, subWizard.lessonId);
      if (orig && !subWizard.subject) subWizard.subject = orig.subject;
      if (orig && !subWizard.teacher) subWizard.teacher = orig.teacher;
      if (orig && !subWizard.room) subWizard.room = orig.room;
      // При отмене пары пропускаем шаги преподавателя и предмета
      if (subWizard.cancelled) {
        subWizard.step = WIZARD_STEPS.length - 1;
        scheduleDraftSave();
        renderSection();
        return;
      }
    }
    subWizard.step += 1;
    scheduleDraftSave();
    renderSection();
    return;
  }

  const orig = getOriginalLesson(subWizard.group, subWizard.day, subWizard.lessonId);
  if (!orig) {
    toast('Пара не найдена', 'error');
    return;
  }

  const payload = {
    group: subWizard.group,
    day: String(subWizard.day),
    pair: orig.pair,
    cancelled: !!subWizard.cancelled,
    comment: subWizard.comment || '',
    dateFrom: subWizard.dateFrom || undefined,
    dateTo: subWizard.dateTo || undefined,
    original: orig,
    lesson: subWizard.cancelled
      ? { subject: 'Пара отменена', teacher: '', room: '' }
      : createLesson({
        ...orig,
        subject: subWizard.subject.trim() || orig.subject,
        teacher: subWizard.teacher.trim() || orig.teacher,
        room: subWizard.room.trim() || orig.room,
        replaced: true,
        original: orig,
      }),
  };

  if (subWizard.editId) {
    updateSubstitution(scheduleData, subWizard.editId, payload);
    pushAudit('sub_update', `${payload.group} д${payload.day} п${payload.pair}`);
    toast('Замена обновлена', 'success');
  } else {
    addSubstitution(scheduleData, payload);
    pushAudit('sub_add', `${payload.group} д${payload.day} п${payload.pair}`);
    toast('Замена добавлена', 'success');
  }
  await persistSchedule();
  subWizard = defaultWizardDraft();
  clearSubDraftStorage();
  renderSection();
}

function renderSubList() {
  const sec = el('section', 'adm-section');
  sec.appendChild(el('h2', 'adm-section__title', 'Список замен'));

  const toolbar = el('div', 'adm-list-toolbar');
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Поиск: группа, предмет, преподаватель…';
  const filterGroup = document.createElement('select');
  const allOpt = document.createElement('option');
  allOpt.value = '';
  allOpt.textContent = 'Все группы';
  filterGroup.appendChild(allOpt);
  listGroups(scheduleData).forEach((g) => {
    const o = document.createElement('option');
    o.value = g;
    o.textContent = g;
    filterGroup.appendChild(o);
  });
  toolbar.append(search, filterGroup);

  const clearBtn = el('button', 'btn btn--outline', 'Очистить все');
  clearBtn.type = 'button';
  clearBtn.addEventListener('click', async () => {
    if (!confirmDanger('Удалить все замены? Это нельзя отменить кроме импорта JSON.')) return;
    const backup = [...(scheduleData.substitutions || [])];
    clearSubstitutions(scheduleData);
    await persistSchedule();
    pushAudit('sub_clear_all', `${backup.length} записей`);
    toastUndo('Все замены удалены', async () => {
      scheduleData.substitutions = backup;
      await persistSchedule();
      renderSection();
    });
    renderSection();
  });
  toolbar.appendChild(clearBtn);
  sec.appendChild(toolbar);

  const listWrap = el('div', 'adm-card');
  const renderList = () => {
    clear(listWrap);
    const q = search.value.trim().toLowerCase();
    const fg = filterGroup.value;
    let items = [...(scheduleData.substitutions || [])];
    if (fg) items = items.filter((s) => s.group === fg);
    if (q) {
      items = items.filter((s) => {
        const hay = [
          s.group, s.comment, s.lesson?.subject, s.lesson?.teacher, s.lesson?.room,
          DAY_NAMES[s.day],
        ].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      });
    }
    if (!items.length) {
      listWrap.appendChild(el('p', 'adm-muted', 'Замен пока нет'));
      return;
    }
    items.forEach((s) => {
      const row = el('div', 'adm-sub-item');
      const meta = el('div', 'adm-sub-item__meta');
      meta.textContent = `${s.group} · ${DAY_NAMES[s.day] || s.day} · пара ${s.pair}${s.cancelled ? ' · отмена' : ''}${isSubActive(s) ? '' : ' · неактивна'}`;
      row.appendChild(meta);
      const main = el('div', '', '');
      const txt = s.cancelled
        ? (s.comment || 'Отменено')
        : `${s.lesson?.subject || '—'} · ${s.lesson?.teacher || ''} · ${s.lesson?.room || ''}`;
      main.textContent = txt;
      row.appendChild(main);
      if (s.dateFrom || s.dateTo) {
        row.appendChild(el('div', 'adm-sub-item__meta', `${s.dateFrom || '…'} — ${s.dateTo || '…'}`));
      }
      const actions = el('div', 'adm-sub-item__actions');
      const edit = el('button', 'btn btn--outline', 'Изменить');
      edit.type = 'button';
      edit.addEventListener('click', () => {
        const dayLessons = scheduleData.groups[s.group]?.days[String(s.day)] || [];
        const byPair = dayLessons.find((l) => l.pair === s.pair);
        const lessonId = s.original?.id || byPair?.id || '';
        subWizard = {
          ...defaultWizardDraft(),
          editId: s.id,
          group: s.group,
          day: String(s.day),
          pair: s.pair,
          lessonId,
          teacher: s.lesson?.teacher || '',
          room: s.lesson?.room || '',
          subject: s.lesson?.subject || '',
          dateFrom: s.dateFrom || '',
          dateTo: s.dateTo || '',
          comment: s.comment || '',
          cancelled: !!s.cancelled,
          step: 0,
        };
        renderSection();
      });
      const del = el('button', 'btn btn--outline', 'Удалить');
      del.type = 'button';
      del.addEventListener('click', async () => {
        if (!confirmDanger('Удалить эту замену?')) return;
        const copy = { ...s };
        removeSubstitution(scheduleData, s.id);
        await persistSchedule();
        pushAudit('sub_remove', copy.group);
        toastUndo('Замена удалена', async () => {
          scheduleData.substitutions.unshift(copy);
          await persistSchedule();
          renderSection();
        });
        renderSection();
      });
      actions.append(edit, del);
      row.appendChild(actions);
      listWrap.appendChild(row);
    });
  };
  search.addEventListener('input', renderList);
  filterGroup.addEventListener('change', renderList);
  renderList();
  sec.appendChild(listWrap);
  return sec;
}

/** —— Звонки —— */
function renderBellsEditor(root) {
  const cfg = loadBellsConfig();
  const sec = el('section', 'adm-section');
  sec.appendChild(el('h2', 'adm-section__title', 'Расписание звонков'));

  const errBox = el('ul', 'adm-errors');
  errBox.hidden = true;

  const saveLive = (partial) => {
    clearTimeout(bellsSaveTimer);
    bellsSaveTimer = setTimeout(() => {
      const merged = saveBellsConfig(partial);
      validateAndShowErrors(merged, errBox);
      pushAudit('bells_save', 'автосохранение');
    }, 400);
  };

  sec.appendChild(renderBellCard('Вт, ср, пт', 'regular', cfg.regular, saveLive));
  sec.appendChild(renderBellCard('Пн, чт', 'monThu', cfg.monThu, saveLive));
  sec.appendChild(renderBellCard('Сокращённый день', 'shortDay', cfg.shortDay, saveLive));

  const cur = el('div', 'adm-card');
  cur.appendChild(el('h3', 'adm-card__title', 'Кураторский час'));
  const enRow = el('div', 'adm-checkbox-row');
  const enCb = document.createElement('input');
  enCb.type = 'checkbox';
  enCb.checked = cfg.curator.enabled;
  enCb.addEventListener('change', () => saveLive({ curator: { ...cfg.curator, enabled: enCb.checked } }));
  enRow.append(enCb, el('label', '', 'Включить'));
  cur.appendChild(enRow);

  const daysRow = el('div', 'adm-checkbox-row');
  const mon = document.createElement('input');
  mon.type = 'checkbox';
  mon.checked = (cfg.curator.days || []).includes(1);
  const thu = document.createElement('input');
  thu.type = 'checkbox';
  thu.checked = (cfg.curator.days || []).includes(4);
  const updateDays = () => {
    const days = [];
    if (mon.checked) days.push(1);
    if (thu.checked) days.push(4);
    saveLive({ curator: { ...loadBellsConfig().curator, days } });
  };
  mon.addEventListener('change', updateDays);
  thu.addEventListener('change', updateDays);
  daysRow.append(mon, el('label', '', 'Пн'), thu, el('label', '', 'Чт'));
  cur.appendChild(daysRow);

  const tStart = document.createElement('input');
  tStart.type = 'time';
  tStart.value = cfg.curator.start;
  tStart.addEventListener('change', () => saveLive({ curator: { ...loadBellsConfig().curator, start: tStart.value } }));
  const tEnd = document.createElement('input');
  tEnd.type = 'time';
  tEnd.value = cfg.curator.end;
  tEnd.addEventListener('change', () => saveLive({ curator: { ...loadBellsConfig().curator, end: tEnd.value } }));
  const timeGrid = el('div', 'adm-grid-2');
  const f1 = el('div', 'field');
  f1.appendChild(el('label', '', 'Начало'));
  f1.appendChild(tStart);
  const f2 = el('div', 'field');
  f2.appendChild(el('label', '', 'Конец'));
  f2.appendChild(tEnd);
  timeGrid.append(f1, f2);
  cur.appendChild(timeGrid);

  sec.appendChild(cur);
  sec.appendChild(errBox);

  const resetBtn = el('button', 'btn btn--outline', 'Сбросить по умолчанию');
  resetBtn.type = 'button';
  resetBtn.addEventListener('click', () => {
    if (!confirmDanger('Сбросить все звонки к стандартным значениям МелМК?')) return;
    resetBellsConfig();
    pushAudit('bells_reset', '');
    toast('Звонки сброшены', 'success');
    renderSection();
  });
  sec.appendChild(resetBtn);
  root.appendChild(sec);

  validateAndShowErrors(cfg, errBox);
}

function renderBellCard(title, key, slots, onSave) {
  const card = el('div', 'adm-card');
  card.appendChild(el('h3', 'adm-card__title', title));
  slots.forEach((slot, idx) => {
    const row = el('div', 'adm-bell-slot');
    row.appendChild(el('span', '', String(slot.pair)));
    const start = document.createElement('input');
    start.type = 'time';
    start.value = slot.start;
    const end = document.createElement('input');
    end.type = 'time';
    end.value = slot.end;
    const patch = () => {
      const current = loadBellsConfig();
      const next = current[key].map((s, i) => (i === idx ? { ...s, start: start.value, end: end.value } : s));
      onSave({ [key]: next });
    };
    start.addEventListener('change', patch);
    end.addEventListener('change', patch);
    row.append(start, end);
    card.appendChild(row);
  });
  return card;
}

function validateAndShowErrors(cfg, errBox) {
  clear(errBox);
  const allErr = [];
  for (const [name, slots] of [
    ['regular', cfg.regular],
    ['monThu', cfg.monThu],
    ['shortDay', cfg.shortDay],
  ]) {
    const v = validateBellSlots(slots);
    if (!v.ok) v.errors.forEach((e) => allErr.push(`${name}: ${e}`));
  }
  errBox.hidden = !allErr.length;
  allErr.forEach((msg) => {
    const li = document.createElement('li');
    li.textContent = msg;
    errBox.appendChild(li);
  });
}

/** —— Данные —— */
function renderData(root) {
  const sec = el('section', 'adm-section');
  sec.appendChild(el('h2', 'adm-section__title', 'Расписание и импорт'));

  const imp = el('div', 'adm-card');
  imp.appendChild(el('h3', 'adm-card__title', 'Excel'));
  const upBtn = el('button', 'btn btn--primary btn--block', 'Загрузить Excel');
  upBtn.type = 'button';
  upBtn.addEventListener('click', () => pickExcelUpload());
  imp.appendChild(upBtn);
  imp.appendChild(el('p', 'adm-muted', 'При наличии API-токена — загрузка на сервер, иначе локальный разбор.'));
  sec.appendChild(imp);

  const exp = el('div', 'adm-card');
  exp.appendChild(el('h3', 'adm-card__title', 'Экспорт'));
  const expList = [
    ['JSON', () => exportJson(scheduleData)],
    ['CSV (Excel)', () => exportCsv(scheduleData)],
    ['ICS', () => exportIcs(scheduleData)],
    ['Печать', () => printSchedule()],
  ];
  expList.forEach(([label, fn]) => {
    const b = el('button', 'btn btn--outline btn--block', label);
    b.type = 'button';
    b.style.marginBottom = '8px';
    b.addEventListener('click', () => { touchSession(); fn(); pushAudit('export', label); });
    exp.appendChild(b);
  });
  sec.appendChild(exp);

  const jsonCard = el('div', 'adm-card');
  jsonCard.appendChild(el('h3', 'adm-card__title', 'Импорт JSON'));
  const jsonBtn = el('button', 'btn btn--outline btn--block', 'Выбрать файл JSON');
  jsonBtn.type = 'button';
  jsonBtn.addEventListener('click', () => {
    fileInputJson.value = '';
    fileInputJson.click();
  });
  jsonCard.appendChild(jsonBtn);
  sec.appendChild(jsonCard);

  const auditSec = el('div', 'adm-card');
  auditSec.appendChild(el('h3', 'adm-card__title', 'Журнал аудита'));
  const auditList = el('div', '');
  loadAudit().slice(0, 30).forEach((a) => {
    const item = el('div', 'adm-audit-item');
    const t = document.createElement('time');
    t.textContent = new Date(a.at).toLocaleString('ru-RU');
    item.appendChild(t);
    item.appendChild(document.createTextNode(`${a.action}${a.detail ? `: ${a.detail}` : ''}`));
    auditList.appendChild(item);
  });
  if (!auditList.childNodes.length) auditSec.appendChild(el('p', 'adm-muted', 'Записей пока нет'));
  else auditSec.appendChild(auditList);
  sec.appendChild(auditSec);

  root.appendChild(sec);
}

function pickExcelUpload() {
  touchSession();
  fileInputExcel.value = '';
  fileInputExcel.click();
}

async function handleExcelFile(file) {
  const token = getAdminToken();
  try {
    if (token) {
      toast('Загрузка на сервер…', 'info', 2500);
      const { data, upload } = await uploadAndSync(file, token);
      scheduleData = data;
      const roomsN = upload.rooms != null ? `, ${upload.rooms} каб.` : '';
      const teachN = upload.teachers != null ? `, ${upload.teachers} преп.` : '';
      pushAudit('excel_api', `${upload.groups} групп / ${upload.lessons} пар`);
      toast(`Сервер: ${upload.groups} групп, ${upload.lessons} пар${roomsN}${teachN}`, 'success', 4500);
      renderSection();
      return;
    }
    toast('Локальный разбор Excel…', 'info', 2000);
    const parsed = await parseFile(file);
    const mapping = autoMap(parsed.headers);
    const imported = rowsToSchedule(parsed.rows, mapping, parsed.fileName);
    scheduleData = {
      ...imported,
      substitutions: scheduleData?.substitutions || [],
    };
    await persistSchedule(false);
    pushAudit('excel_local', parsed.fileName);
    toast('Расписание импортировано локально', 'success');
    renderSection();
  } catch (e) {
    toast(e.message || 'Ошибка импорта', 'error');
  }
}

async function handleJsonImport(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.groups) throw new Error('Неверный формат: нет groups');
    if (!confirmDanger('Заменить текущее расписание данными из файла?')) return;
    scheduleData = data;
    await persistSchedule(false);
    pushAudit('import_json', file.name);
    toast('JSON импортирован', 'success');
    renderSection();
  } catch (e) {
    toast(e.message || 'Ошибка JSON', 'error');
  }
}

/** —— Ещё —— */
function renderMore(root) {
  const sec = el('section', 'adm-section');
  sec.appendChild(el('h2', 'adm-section__title', 'Ещё'));

  const navCard = el('div', 'adm-card');
  navCard.appendChild(el('h3', 'adm-card__title', 'Разделы'));
  const moreLinks = [
    ['Главная', 'home'],
    ['Звонки', 'bells'],
    ['Кабинеты', 'rooms'],
    ['Данные / Excel', 'data'],
  ];
  const linkRow = el('div', 'adm-quick-actions');
  moreLinks.forEach(([label, id]) => {
    const b = el('button', 'btn btn--outline', label);
    b.type = 'button';
    b.addEventListener('click', () => setSection(id));
    linkRow.appendChild(b);
  });
  navCard.appendChild(linkRow);
  sec.appendChild(navCard);

  const exp = el('div', 'adm-card');
  exp.appendChild(el('h3', 'adm-card__title', 'Экспорт'));
  [
    ['JSON', () => exportJson(scheduleData)],
    ['CSV', () => exportCsv(scheduleData)],
    ['ICS (первая группа)', () => {
      const g = listGroups(scheduleData)[0];
      if (!g) return toast('Нет групп', 'warn');
      exportIcs(scheduleData, g);
    }],
  ].forEach(([label, fn]) => {
    const b = el('button', 'btn btn--outline btn--block', label);
    b.type = 'button';
    b.style.marginBottom = '8px';
    b.addEventListener('click', () => fn());
    exp.appendChild(b);
  });
  sec.appendChild(exp);

  const aud = el('div', 'adm-card');
  aud.appendChild(el('h3', 'adm-card__title', 'Журнал аудита'));
  const clearAud = el('button', 'btn btn--outline', 'Очистить журнал');
  clearAud.type = 'button';
  clearAud.addEventListener('click', () => {
    if (!confirmDanger('Очистить журнал аудита?')) return;
    clearAudit();
    toast('Журнал очищен', 'success');
    renderSection();
  });
  aud.appendChild(clearAud);
  loadAudit().slice(0, 50).forEach((a) => {
    const p = el('p', 'adm-muted', `${new Date(a.at).toLocaleString('ru-RU')} — ${a.action}: ${a.detail}`);
    aud.appendChild(p);
  });
  sec.appendChild(aud);

  const out = el('button', 'btn btn--primary btn--block', 'Выйти');
  out.type = 'button';
  out.addEventListener('click', () => {
    logout();
    toast('Вы вышли', 'info');
    showLogin();
  });
  sec.appendChild(out);
  root.appendChild(sec);
}

function doLogout() {
  logout();
  showLogin();
}

/** —— Инициализация —— */
function wireNav() {
  document.querySelectorAll('[data-section]').forEach((btn) => {
    btn.addEventListener('click', () => {
      touchSession();
      setSection(btn.getAttribute('data-section'));
    });
  });
  document.getElementById('btn-logout-sidebar')?.addEventListener('click', doLogout);
  window.addEventListener('hashchange', () => {
    const h = parseHashSection();
    if (h !== section) {
      section = h;
      document.querySelectorAll('[data-section]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-section') === h);
      });
      setText(pageTitle, SECTION_TITLES[h]);
      renderSection();
    }
  });
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  touchSession();
  const user = document.getElementById('login-user').value;
  const pass = document.getElementById('login-pass').value;
  loginError.hidden = true;
  const lock = getAuthLockStatus();
  if (lock.locked) {
    loginError.textContent = `Заблокировано ещё ${Math.ceil(lock.remainingMs / 60000)} мин`;
    loginError.hidden = false;
    return;
  }
  const submitBtn = document.getElementById('login-submit');
  submitBtn.disabled = true;
  const res = await tryLogin(user, pass);
  submitBtn.disabled = false;
  if (!res.ok) {
    loginError.textContent = res.error || 'Ошибка входа';
    loginError.hidden = false;
    return;
  }
  document.getElementById('login-pass').value = '';
  await showApp();
  toast('Добро пожаловать', 'success');
});

fileInputExcel.addEventListener('change', () => {
  const f = fileInputExcel.files?.[0];
  if (f) handleExcelFile(f);
});

fileInputJson.addEventListener('change', () => {
  const f = fileInputJson.files?.[0];
  if (f) handleJsonImport(f);
});

initAdminTheme();
bindActivity();
wireNav();

if (isLoggedIn()) {
  showApp().then(() => setSection(parseHashSection()));
} else {
  showLogin();
}
