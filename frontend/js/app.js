import { mountSyncStatus, setSyncStatus } from './utils/sync-status.js';
import { allSnapshots } from './storage/api-snapshot.js';
import { installBellState } from './models/bell-state.js';
import { setServerDay } from './models/substitutions.js';
import { mergeDayScheduleOut } from './api/overrides.js';
/**
 * МелМК — точка входа. Данные: API (кэш) + локальное хранилище.
 * Группа при входе НЕ выбирается автоматически.
 */

import { initTheme, toggleLightDark, syncModeButton } from './utils/theme.js';
import { toast } from './utils/toast.js';
import { el, clear, setText } from './utils/dom.js';
import {
  loadSchedule, saveSchedule, hasSchedule, subscribe,
} from './storage/store.js';
import { listGroups, getIsoWeekday, DAY_SHORT, createEmptySchedule, filterByWeek } from './models/schedule.js';
import { parseHashGroup, setHashGroup, clearHashGroup } from './utils/share.js';
import { initPwa } from './utils/pwa.js';
import { renderNowWidget, tickNowTimers } from './views/now.js';
import { renderDayView } from './views/day.js';
import { renderWeekView } from './views/week.js';
import { renderMonthView } from './views/month.js';
import { renderEmptyState } from './views/empty.js';
import { renderSearch, renderTeachers } from './views/browse.js';
import { renderBellsView, tickBellsTimers } from './views/bells.js';
import { renderGroupPicker, openGroupSheet } from './views/group-picker.js';
import { openThemeSheet, closeThemeSheet } from './views/theme-sheet.js';
import { pushRecentGroup } from './utils/groups-pref.js';
import {
  syncBootstrap, syncGroup, syncRemainingGroups, syncFullFromApi,
} from './api/sync.js';
import { fetchAndMergeDay, dateKeyForIsoWeekday } from './api/overrides.js';
import { clearServerDayCache, dateForIsoWeekday, toDateKey } from './models/substitutions.js';
import { moscowNow } from './utils/time.js';
import { getMelmkWeekType } from './models/bells.js';
import { openExportSheet } from './views/export-sheet.js';

/** @type {import('./models/schedule.js').ScheduleData} */
let state = null;
/** @type {'home'|'bells'|'teachers'} */
let tab = 'home';
/** @type {'day'|'week'|'month'} */
let scheduleMode = 'day';
let selectedDay = Math.min(getIsoWeekday(), 6) || 1;
if (selectedDay > 6) selectedDay = 1;
/** Пусто при входе — пользователь выбирает сам */
let currentGroup = '';
const apiWeek = 'current';
let selectedDate = dateForIsoWeekday(selectedDay);
let monthYear = moscowNow().getFullYear();
let monthIndex = moscowNow().getMonth();
/** @type {HTMLInputElement|null} */
let searchInputRef = null;
let prefetchStarted = false;
let showSearchPanel = false;
let refreshing = false;
/** @type {string} */
let dayHydrateKey = '';
let dayHydrating = false;

function readUrlState() {
  try {
    const u = new URL(location.href);
    const view = u.searchParams.get('view');
    if (view === 'day' || view === 'week' || view === 'month') scheduleMode = view;
    const day = Number(u.searchParams.get('day'));
    if (day >= 1 && day <= 6) selectedDay = day;
    const dateKey = u.searchParams.get('date');
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey || '')) {
      const date = new Date(`${dateKey}T12:00:00`);
      if (!Number.isNaN(date.getTime()) && toDateKey(date) === dateKey) { selectedDate = date; selectedDay = getIsoWeekday(date); }
    } else selectedDate = dateForIsoWeekday(selectedDay);
    const t = u.searchParams.get('tab');
    if (t === 'home' || t === 'bells' || t === 'teachers') tab = t;
  } catch { /* ignore */ }
}

function writeUrlState() {
  try {
    const u = new URL(location.href);
    u.searchParams.set('view', scheduleMode);
    u.searchParams.set('day', String(selectedDay));
    u.searchParams.set('date', toDateKey(selectedDate));
    u.searchParams.set('tab', tab);
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  } catch { /* ignore */ }
}

readUrlState();

function groupHasLessons(groupName) {
  const g = state?.groups?.[groupName];
  if (!g) return false;
  return Object.values(g.days || {}).some((d) => d && d.length);
}

async function ensureGroupLoaded(groupName) {
  if (!groupName || !state) return;
  if (groupHasLessons(groupName)) return;
  try {
    state = await syncGroup(state, groupName, apiWeek);
  } catch (e) {
    toast(`Не удалось загрузить расписание группы ${groupName}`, 'error');
  }
}

function startPrefetch() {
  if (prefetchStarted || !state) return;
  prefetchStarted = true;
  syncRemainingGroups(state, apiWeek, (partial) => {
    state = partial;
  }).then((data) => {
    state = data;
  }).catch((e) => console.warn('prefetch', e));
}

/**
 * Подтянуть /api/schedule/day для видимых дат (замены из БД)
 */
async function hydrateDayOverrides() {
  if (!state || !currentGroup || dayHydrating) return;
  const g = state.groups[currentGroup];
  if (!g) return;

  const dates = [];
  if (scheduleMode === 'day') {
    dates.push({ day: selectedDay, key: toDateKey(selectedDate) });
    const today = getIsoWeekday();
    if (toDateKey(selectedDate) !== toDateKey() && today >= 1 && today <= 6) {
      dates.push({ day: today, key: dateKeyForIsoWeekday(today) });
    }
  } else if (scheduleMode === 'week') {
    for (let d = 1; d <= 6; d++) {
      dates.push({ day: d, key: dateKeyForIsoWeekday(d, selectedDate) });
    }
  } else {
    const last = new Date(monthYear, monthIndex + 1, 0).getDate();
    for (let d = 1; d <= last; d++) {
      const date = new Date(monthYear, monthIndex, d, 12);
      const day = getIsoWeekday(date);
      if (day <= 6) dates.push({ day, key: toDateKey(date) });
    }
  }

  const stamp = `${currentGroup}|${scheduleMode}|${selectedDay}|${dates.map((x) => x.key).join(',')}`;
  if (stamp === dayHydrateKey) return;
  dayHydrating = true;
  try {
    const group = currentGroup;
    let changed = false;
    await Promise.all(dates.map(async ({ day, key }) => {
      try {
        const week = getMelmkWeekType(new Date(`${key}T12:00:00`));
        const base = filterByWeek(g.days[String(day)] || [], week);
        await fetchAndMergeDay(group, key, base, day);
        changed = true;
      } catch (e) {
        console.warn('day override', key, e);
      }
    }));
    dayHydrateKey = stamp;
    if (changed) render();
  } finally {
    dayHydrating = false;
    hydrateDayOverrides();
  }
}

async function refreshData() {
  if (refreshing) return;
  refreshing = true;
  setSyncStatus({cached:false,error:null});
  const btn = document.getElementById('btn-refresh');
  btn?.classList.add('is-loading');
  btn?.setAttribute('disabled', 'true');
  try {
    toast('Обновление…', 'info', 1500);
    // Keep resolved days if refresh fails; later GETs replace them atomically.
    dayHydrateKey = '';
    const { data } = await syncFullFromApi(apiWeek);
    state = data;
    prefetchStarted = true;
    if (currentGroup && !state.groups[currentGroup]) currentGroup = '';
    render();
  } catch (e) {
    try {
      state = await loadSchedule();
      render();
      toast('Не удалось обновить — показаны сохранённые данные', 'warn', 4000);
    } catch {
      toast('Не удалось обновить расписание', 'error');
    }
  } finally {
    refreshing = false;
    btn?.classList.remove('is-loading');
    btn?.removeAttribute('disabled');
  }
}

async function selectGroup(g) {
  currentGroup = g || '';
  dayHydrateKey = '';
  if (currentGroup) {
    pushRecentGroup(currentGroup);
    setHashGroup(currentGroup);
    await ensureGroupLoaded(currentGroup);
  } else {
    clearHashGroup();
  }
  if (state) {
    state.settings.defaultGroup = currentGroup;
    await saveSchedule(state, { detectChanges: false, keepPrev: false });
  }
  tab = 'home';
  showSearchPanel = false;
  selectedDay = Math.min(getIsoWeekday(), 6) || 1;
  selectedDate = dateForIsoWeekday(selectedDay);
  render();
}

function clearGroup() {
  selectGroup('');
}

function renderModeSwitch(mount) {
  const row = el('div', 'schedule-mode-row no-print');
  const bar = el('div', 'schedule-mode');
  bar.setAttribute('role', 'tablist');
  bar.setAttribute('aria-label', 'Вид расписания');
  const modes = [
    ['day', 'День'],
    ['week', 'Неделя'],
    ['month', 'Месяц'],
  ];
  modes.forEach(([id, label]) => {
    const btn = el('button', `schedule-mode__btn${scheduleMode === id ? ' is-active' : ''}`, label);
    btn.type = 'button';
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', scheduleMode === id ? 'true' : 'false');
    btn.addEventListener('click', () => {
      scheduleMode = /** @type {typeof scheduleMode} */ (id);
      showSearchPanel = false;
      writeUrlState();
      render();
    });
    bar.appendChild(btn);
  });
  const dl = el('button', 'btn btn--icon btn--ghost schedule-download');
  dl.type = 'button';
  dl.setAttribute('aria-label', 'Скачать расписание');
  dl.title = 'Скачать';
  dl.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  dl.addEventListener('click', () => openExportSheet(state, currentGroup));
  row.append(bar, dl);
  mount.appendChild(row);
}

function renderHome(content) {
  if (!hasSchedule(state)) {
    renderEmptyState(content, {
      onDemo: () => refreshData(),
      onUpload: () => refreshData(),
    });
    const title = content.querySelector('.empty-state__title');
    const text = content.querySelector('.empty-state__text');
    const demoBtn = content.querySelector('.empty-state__actions .btn--primary');
    if (title) title.textContent = 'Расписание пока пусто';
    if (text) text.textContent = 'Расписание ещё не опубликовано. Попробуйте обновить позже.';
    if (demoBtn) demoBtn.textContent = 'Обновить данные';
    content.querySelectorAll('.empty-state__actions .btn--outline, .empty-state__actions .btn--ghost').forEach((b) => b.remove());
    return;
  }

  // Выбор группы — всегда первым
  const pickerMount = el('div', 'home-picker no-print');
  content.appendChild(pickerMount);
  renderGroupPicker(pickerMount, state, currentGroup, (g) => { selectGroup(g); });

  if (!currentGroup) {
    const empty = el('div', 'empty-state mm-enter home-pick-group');
    empty.appendChild(el('p', 'empty-state__title', 'Выберите группу'));
    empty.appendChild(el('p', 'empty-state__text', 'Чтобы увидеть расписание, день, неделю или месяц — сначала выберите группу.'));
    const pick = el('button', 'btn btn--primary btn--block', 'Выбрать группу');
    pick.type = 'button';
    pick.addEventListener('click', () => {
      openGroupSheet(state, '', (g) => selectGroup(g));
    });
    empty.appendChild(pick);
    content.appendChild(empty);
    return;
  }

  if (scheduleMode === 'day' && toDateKey(selectedDate) === toDateKey()) {
    const nowRoot = el('div');
    nowRoot.id = 'now-root';
    content.appendChild(nowRoot);
    renderNowWidget(nowRoot, state, currentGroup);
  }

  renderModeSwitch(content);

  // Поиск
  const searchToggle = el('button', 'btn btn--ghost btn--block home-search-toggle no-print', showSearchPanel ? 'Скрыть поиск' : 'Поиск по расписанию');
  searchToggle.type = 'button';
  searchToggle.addEventListener('click', () => {
    showSearchPanel = !showSearchPanel;
    render();
    if (showSearchPanel) setTimeout(() => searchInputRef?.focus(), 80);
  });
  content.appendChild(searchToggle);

  if (showSearchPanel) {
    startPrefetch();
    const searchMount = el('div', 'home-search-panel no-print');
    content.appendChild(searchMount);
    renderSearch(searchMount, state, '', (input) => { searchInputRef = input; }, {
      onOpenGroup: (g) => selectGroup(g),
      onOpenTeacher: () => { tab = 'teachers'; showSearchPanel = false; render(); },
    });
  }

  const scheduleRoot = el('div');
  scheduleRoot.id = 'schedule-root';
  content.appendChild(scheduleRoot);

  if (scheduleMode === 'day') {
    const switcher = el('div', 'day-switcher no-print');
    switcher.setAttribute('role', 'tablist');
    switcher.setAttribute('aria-label', 'День недели');
    const today = getIsoWeekday();
    for (let d = 1; d <= 6; d++) {
      const chip = el('button', 'day-chip', DAY_SHORT[d]);
      chip.type = 'button';
      chip.setAttribute('role', 'tab');
      chip.setAttribute('aria-selected', d === selectedDay ? 'true' : 'false');
      if (d === selectedDay) chip.classList.add('is-active');
      if (d === today && toDateKey(dateForIsoWeekday(d, selectedDate)) === toDateKey()) chip.classList.add('is-today');
      chip.addEventListener('click', () => {
        selectedDay = d;
        selectedDate = dateForIsoWeekday(d, selectedDate);
        showSearchPanel = false;
        writeUrlState();
        render();
      });
      switcher.appendChild(chip);
    }
    scheduleRoot.appendChild(switcher);
    const dayMount = el('div');
    scheduleRoot.appendChild(dayMount);
    renderDayView(dayMount, state, currentGroup, selectedDay, selectedDate);
    requestAnimationFrame(centerActiveDayChip);
  } else if (scheduleMode === 'week') {
    renderWeekView(scheduleRoot, state, currentGroup);
  } else {
    renderMonthView(scheduleRoot, state, currentGroup, {
      year: monthYear,
      month: monthIndex,
      onChangeMonth: (year, month) => {
        monthYear = year;
        monthIndex = month;
        hydrateDayOverrides();
      },
      onPickDay: (isoDay, date) => {
        selectedDay = isoDay;
        selectedDate = date;
        scheduleMode = 'day';
        writeUrlState();
        render();
      },
    });
  }
}

function centerActiveDayChip() {
  const active = document.querySelector('.day-chip.is-active');
  const scroller = active?.closest('.day-switcher');
  if (!active || !scroller) return;
  const left = active.offsetLeft - (scroller.clientWidth - active.offsetWidth) / 2;
  scroller.scrollLeft = Math.max(0, left);
}

function render() {
  const main = document.getElementById('main');
  const brandSub = document.getElementById('brand-sub');
  if (!main || !state) return;

  clear(main);

  // Не подставляем группу автоматически
  if (currentGroup && !state.groups[currentGroup]) {
    currentGroup = '';
  }

  setText(brandSub, currentGroup
    ? `${currentGroup}${state.meta?.institution ? ` · ${state.meta.institution}` : ''}`
    : 'Выберите группу');

  document.querySelectorAll('.nav-item').forEach((item) => {
    const t = item.getAttribute('data-tab');
    const active = t === tab;
    item.classList.toggle('is-active', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });

  writeUrlState();
  if (tab === 'home') {
    renderHome(main);
    if (currentGroup) {
      queueMicrotask(() => { hydrateDayOverrides(); });
    }
  } else if (tab === 'bells') renderBellsView(main);
  else if (tab === 'teachers') {
    startPrefetch();
    renderTeachers(main, state);
  }
  syncNavLabels();
}

function syncNavLabels() {
  const narrow = window.matchMedia('(max-width: 340px)').matches;
  document.querySelectorAll('.nav-item__full').forEach((n) => {
    n.hidden = narrow;
  });
  document.querySelectorAll('.nav-item__short').forEach((n) => {
    n.hidden = !narrow;
  });
}

function setupNav() {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      tab = /** @type {typeof tab} */ (item.getAttribute('data-tab') || 'home');
      showSearchPanel = false;
      if (navigator.vibrate) navigator.vibrate(8);
      writeUrlState();
      render();
    });
  });
  window.addEventListener('resize', syncNavLabels);
}

function setupHeader() {
  document.getElementById('btn-mood')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openThemeSheet(/** @type {HTMLElement} */ (e.currentTarget));
  });
  document.getElementById('btn-refresh')?.addEventListener('click', refreshData);

  const header = document.querySelector('.app-header');
  if (header && typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect?.height;
      if (h) document.documentElement.style.setProperty('--header-h', `${Math.ceil(h)}px`);
    });
    ro.observe(header);
  }
}

function setupHotkeys() {
  document.addEventListener('keydown', (e) => {
    const tag = (e.target && /** @type {HTMLElement} */ (e.target).tagName) || '';
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      || /** @type {HTMLElement} */ (e.target)?.isContentEditable;

    if (e.key === '/' && !typing) {
      e.preventDefault();
      if (!currentGroup) {
        openGroupSheet(state, '', (g) => selectGroup(g));
        return;
      }
      tab = 'home';
      showSearchPanel = true;
      render();
      setTimeout(() => searchInputRef?.focus(), 50);
      return;
    }
    if (e.key === 'Escape' && !typing) {
      closeThemeSheet();
      document.querySelector('.sheet-backdrop')?.remove();
      if (showSearchPanel) {
        showSearchPanel = false;
        render();
      }
    }
    if (typing) return;

    if (e.key === 't' || e.key === 'T' || e.key === 'е' || e.key === 'Е') {
      openThemeSheet(document.getElementById('btn-mood'));
      return;
    }
    if (e.key === 'd' || e.key === 'D' || e.key === 'в' || e.key === 'В') {
      toggleLightDark();
      syncModeButton();
      return;
    }
    if (!currentGroup || scheduleMode !== 'day') return;
    if (e.key === 'ArrowLeft') {
      selectedDay = selectedDay <= 1 ? 6 : selectedDay - 1;
      selectedDate = dateForIsoWeekday(selectedDay, selectedDate);
      tab = 'home';
      showSearchPanel = false;
      render();
    }
    if (e.key === 'ArrowRight') {
      selectedDay = selectedDay >= 6 ? 1 : selectedDay + 1;
      selectedDate = dateForIsoWeekday(selectedDay, selectedDate);
      tab = 'home';
      showSearchPanel = false;
      render();
    }
  });
}

function setupKeyboardNav() {
  if (!window.visualViewport) return;
  const nav = document.querySelector('.bottom-nav');
  if (!nav) return;
  const onResize = () => {
    const covered = window.visualViewport.height < window.innerHeight * 0.75;
    nav.classList.toggle('is-keyboard-hidden', covered);
  };
  window.visualViewport.addEventListener('resize', onResize);
  window.visualViewport.addEventListener('scroll', onResize);
}

async function boot() {
  initTheme();
  mountSyncStatus();
  initPwa(document.getElementById('banner-slot') || document.getElementById('main'));
  setupNav();
  setupHeader();
  setupHotkeys();
  setupKeyboardNav();

  // Hash с группой — только если пользователь явно открыл ссылку; иначе без группы
  const hashGroup = parseHashGroup() || '';
  const main = document.getElementById('main');
  if (main) {
    clear(main);
    main.appendChild(el('p', 'now-widget__meta', 'Загрузка…'));
  }

  // Paint the persisted snapshot before making any network request.
  state=await loadSchedule();
  if(state.settings?.syncedAt)setSyncStatus({lastAt:state.settings.syncedAt});
  if(state.settings?.bellsSnapshot)installBellState(state.settings.bellsSnapshot);
  for(const entry of await allSnapshots()){
    if(entry.path.startsWith('/api/bells/config'))installBellState(entry.data);
    if(entry.path.startsWith('/api/schedule/day?')){
      const out=entry.data,day=getIsoWeekday(new Date(`${out.date}T12:00:00`));
      setServerDay(out.group,out.date,mergeDayScheduleOut(out,[],day),day);
    }
  }
  currentGroup=(hashGroup && state.groups[hashGroup])?hashGroup:(state.settings?.defaultGroup||'');
  if(!state.groups[currentGroup])currentGroup='';
  render();
  try {
    // Не передаём preferred group — bootstrap без автовыбора
    const bootRes = await syncBootstrap(currentGroup, apiWeek);
    state = bootRes.data;
    // При входе группа НЕ выбирается (даже если API вернул первую)
    currentGroup = bootRes.group || '';
    if (hashGroup && state.groups[hashGroup]) {
      // Прямая ссылка #group=… — уважаем, но это не «автовыбор при заходе»
      currentGroup = hashGroup;
      await ensureGroupLoaded(currentGroup);
    } else {
      clearHashGroup();
    }
    startPrefetch();
  } catch (e) {
    console.warn(e);
    setSyncStatus({error:e.message||'Нет связи'});
    try {
      state = await loadSchedule();

    } catch {
      state = createEmptySchedule();
      toast('Не удалось загрузить расписание', 'error');
    }
    currentGroup = (hashGroup && state.groups[hashGroup]) ? hashGroup : '';
    if (!currentGroup) currentGroup=state.settings?.defaultGroup||'';
    if (!currentGroup) clearHashGroup();
  }

  subscribe((data) => { state = data; });
  render();

  let lastTickAt = 0;
  const runPreciseTick = () => {
    if (document.hidden) return;
    const now = Date.now();
    // коррекция дрейфа: не чаще ~1 с, но выравниваем по wall-clock
    if (now - lastTickAt < 900) return;
    lastTickAt = now;
    const nowRoot = document.getElementById('now-root');
    if (nowRoot && currentGroup && tab === 'home') {
      const expired = tickNowTimers(nowRoot);
      if (expired && hasSchedule(state) && !showSearchPanel && scheduleMode === 'day') {
        renderNowWidget(nowRoot, state, currentGroup);
      }
    }
    if (tab === 'bells') {
      const mainEl = document.getElementById('main');
      if (mainEl) tickBellsTimers(mainEl);
    }
  };
  setInterval(runPreciseTick, 1000);

  setInterval(() => {
    if (document.hidden) return;
    dayHydrateKey = '';
    hydrateDayOverrides();
    if (tab === 'home' && currentGroup && hasSchedule(state) && !showSearchPanel && scheduleMode === 'day') {
      const nowRoot = document.getElementById('now-root');
      if (nowRoot) renderNowWidget(nowRoot, state, currentGroup);
    }
  }, 60000);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    dayHydrateKey = '';
    hydrateDayOverrides();
    if (tab === 'home' && currentGroup && scheduleMode === 'day') {
      const nowRoot = document.getElementById('now-root');
      if (nowRoot) renderNowWidget(nowRoot, state, currentGroup);
    }
  });

  window.addEventListener('hashchange', async () => {
    const g = parseHashGroup();
    if (g && state?.groups?.[g] && g !== currentGroup) {
      await selectGroup(g);
    } else if (!g && currentGroup) {
      currentGroup = '';
      render();
    }
  });
}

boot().catch((e) => {
  console.error(e);
  toast('Критическая ошибка запуска', 'error');
});

