import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CalendarDays, Check, ChevronRight, Clock3, Edit3, Flame, Home, LineChart, ListChecks, NotebookPen, Plus, RotateCcw, Save, Sparkles, Trash2, X } from 'lucide-react';
import './styles.css';

const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const timeParts = ['Любое время', 'Утро', 'День', 'Вечер', 'Ночь'];
function displayTimePart(value) {
  return value === 'Любое время' ? 'Любое время суток' : value;
}
let todayISO = toISO(new Date());
let yesterdayISO = toISO(addDays(new Date(), -1));


const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const storageKey = 'habit-tracker-21-data-v1';
const jsDayToApp = [6, 0, 1, 2, 3, 4, 5];

function toISO(date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function parseISODate(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function isScheduledOnDate(habit, iso) {
  if (!habit || !iso) return false;
  if (habit.startDate && iso < habit.startDate) return false;
  if (!isInFirst21ScheduledDays(habit, iso)) return false;
  const date = parseISODate(iso);
  const dayName = days[jsDayToApp[date.getDay()]];
  return (habit.schedule || days).includes(dayName);
}

function getCompletion(habit, iso) {
  return habit.completedDates?.[iso] || null;
}

function getScheduledNumber(habit, iso) {
  if (!habit?.startDate || iso < habit.startDate) return 0;
  let count = 0;
  let current = parseISODate(habit.startDate);
  const end = parseISODate(iso);
  while (current <= end) {
    const currentISO = toISO(current);
    const dayName = days[jsDayToApp[current.getDay()]];
    if ((habit.schedule || days).includes(dayName)) count += 1;
    current = addDays(current, 1);
  }
  return count;
}

function isInFirst21ScheduledDays(habit, iso) {
  const n = getScheduledNumber(habit, iso);
  return n > 0 && n <= 21;
}

function getCalendarCells(year, month, habits) {
  const first = new Date(year, month, 1);
  const blanks = jsDayToApp[first.getDay()];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const list = Array.isArray(habits) ? habits : [habits].filter(Boolean);
  const cells = Array.from({ length: blanks }, () => ({ empty: true }));
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = toISO(new Date(year, month, day));
    const scheduled = list.filter(h => isScheduledOnDate(h, iso));
    const completed = scheduled.filter(h => getCompletion(h, iso));
    let status = 'skip';
    if (scheduled.length && completed.length === scheduled.length) status = 'done';
    else if (scheduled.length && iso <= todayISO) status = 'missed';
    else if (scheduled.length) status = 'planned';
    cells.push({ day, iso, status, scheduled: scheduled.length, completed: completed.length });
  }
  while (cells.length % 7) cells.push({ empty: true });
  return cells;
}

function loadSavedHabits() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.habits) ? parsed.habits.map(h => ({
      ...h,
      schedule: h.schedule?.length ? h.schedule : days,
      broken: h.broken || [],
      diaryEntries: h.diaryEntries || [],
      completedDates: h.completedDates || {}
    })) : [];
  } catch {
    return [];
  }
}

function makeEmptyHabit() {
  return {
    title: '',
    schedule: days,
    startDate: todayISO,
    time: 'Любое время',
    hour: '',
    diary: false,
    valueLabel: 'число'
  };
}

function ProgressRing({ done, total, size = 86 }) {
  const ratio = total ? done / total : 0;
  const r = 36;
  const c = 2 * Math.PI * r;
  return <div className="ring" style={{ width: size, height: size }}>
    <svg viewBox="0 0 88 88">
      <circle className="ring-bg" cx="44" cy="44" r={r} />
      <circle className="ring-fg" cx="44" cy="44" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - ratio)} />
    </svg>
    <div className="ring-text"><b>{done}</b><span>из {total}</span></div>
  </div>;
}

function PhoneFrame({ children }) {
  return <main className="phone-shell">
    <div className="phone-top"><span></span><i></i></div>
    <section className="phone-screen">{children}</section>
  </main>;
}

function Header({ setTab, yesterdayCount }) {
  return <header className="app-header">
    <div>
      <p className="eyebrow">21 выполнение подряд</p>
      <h1>Мой ритм</h1>
    </div>
    {yesterdayCount > 0 && <button className="yesterday-badge" onClick={() => setTab('yesterday')}>
      <span>Вчера</span><b>{yesterdayCount}</b>
    </button>}
  </header>;
}

function EmptyState({ title, text, buttonText, onAction }) {
  return <section className="empty-state">
    <div className="empty-icon"><NotebookPen size={30} /></div>
    <h3>{title}</h3>
    <p>{text}</p>
    {buttonText && <button className="add-button" onClick={onAction}><Plus size={20} /> {buttonText}</button>}
  </section>;
}

function Today({ habits, markDone, setTab, openCreate, yesterdayCount }) {
  const todaysHabits = habits.filter(h => isScheduledOnDate(h, todayISO));
  const planned = todaysHabits.length;
  const done = todaysHabits.filter(h => getCompletion(h, todayISO)).length;
  const todo = todaysHabits.filter(h => !getCompletion(h, todayISO));
  const completed = todaysHabits.filter(h => getCompletion(h, todayISO));
  const groups = timeParts;

  return <>
    <Header setTab={setTab} yesterdayCount={yesterdayCount} />
    <section className="hero-card">
      <div>
        <p>План на сегодня</p>
        <h2>{done} из {planned} сделано</h2>
        <span>{planned ? 'Отмечайте привычки одной кнопкой. Несделанное всегда сверху.' : 'Пока привычек нет. Добавьте первую в разделе «Привычки».'}</span>
      </div>
      <ProgressRing done={done} total={planned} />
    </section>

    {!planned && <EmptyState title="Сегодня свободно" text="Создайте привычку, выберите дни недели и время выполнения — она появится в плане дня." buttonText="Добавить привычку" onAction={openCreate} />}

    {!!planned && <>
      <div className="section-title"><h3>Нужно выполнить</h3><span>{todo.length}</span></div>
      {groups.map(group => {
        const items = todo.filter(h => h.time === group);
        if (!items.length) return null;
        return <div key={group} className="time-group">
          <div className="time-label"><Clock3 size={15} />{displayTimePart(group)}</div>
          {items.map(h => <HabitCard key={h.id} habit={h} onDone={markDone} />)}
        </div>;
      })}
      {!todo.length && <div className="soft-note">Все привычки на сегодня выполнены. Отличный темп.</div>}
      <div className="section-title muted"><h3>Сделано сегодня</h3><span>{completed.length}</span></div>
      {completed.map(h => <DoneCard key={h.id} habit={h} />)}
    </>}
  </>;
}

function HabitCard({ habit, onDone }) {
  const [val, setVal] = useState(habit.value || '');
  const [completing, setCompleting] = useState(false);
  const [warning, setWarning] = useState('');
  const cleanValue = String(val).replace(',', '.').trim();
  const hasDiaryValue = cleanValue !== '' && !Number.isNaN(Number(cleanValue));
  const finish = () => {
    if (completing) return;
    if (habit.diary && !hasDiaryValue) {
      setWarning(`Введите ${habit.valueLabel || 'число'} для дневника изменений`);
      return;
    }
    setCompleting(true);
    window.setTimeout(() => onDone(habit.id, habit.diary ? cleanValue : ''), 260);
  };
  return <article className={`habit-card today-card today-three-part ${completing ? 'completing' : ''} ${warning ? 'needs-value' : ''}`}>
    <div className="today-left">
      <h4>{habit.title}</h4>
      <p>{displayTimePart(habit.time)}{habit.hour ? ` · ${habit.hour}` : ' · без точного времени'}</p>
      <span>{habit.progress} из 21</span>
    </div>
    <div className="today-middle">
      {habit.diary ? <label className="diary-number-field">
        <span>{habit.valueLabel || 'число'}</span>
        <input
          value={val}
          onChange={e => { setVal(e.target.value); if (warning) setWarning(''); }}
          inputMode="decimal"
          placeholder="0"
          aria-label={`Введите ${habit.valueLabel || 'число'} для ${habit.title}`}
        />
      </label> : <span className="no-diary-mark">Без дневника</span>}
    </div>
    <button
      className={`circle-done-button ${habit.diary && !hasDiaryValue ? 'blocked' : ''}`}
      disabled={completing}
      onClick={finish}
      aria-label={`Выполнено: ${habit.title}`}
      title={habit.diary && !hasDiaryValue ? `Введите ${habit.valueLabel || 'число'}` : 'Выполнено'}
    ><Check size={21} /></button>
    {warning && <div className="value-warning">{warning}</div>}
  </article>;
}

function ProgressDots({ progress }) {
  const filled = Math.max(0, Math.min(21, Number(progress) || 0));
  return <div className="progress-dots" aria-label={`Прогресс ${filled} из 21`}>
    {Array.from({ length: 21 }, (_, index) => <i key={index} className={index < filled ? 'filled' : ''} />)}
  </div>;
}

function DoneCard({ habit }) {
  return <article className="done-card">
    <span><Check size={16} /></span>
    <div><h4>{habit.title}</h4><ProgressDots progress={habit.progress} /></div>
  </article>;
}

function Yesterday({ habits, markDone, setTab }) {
  const missed = habits.filter(h => isScheduledOnDate(h, yesterdayISO) && !getCompletion(h, yesterdayISO));
  return <>
    <ScreenTop title="Вчера" subtitle="Только привычки, которые остались без отметки после 0:00" />
    <button className="back-today" onClick={() => setTab('today')}>‹ Вернуться на экран «Сегодня»</button>
    <div className="warning-card"><RotateCcw size={20} /><span>Если день был выполнен, отметьте задним числом: серия продолжится, а история обновится.</span></div>
    {!missed.length && <EmptyState title="Вчерашних пропусков нет" text="Все запланированные на вчера привычки отмечены или вчера ничего не было запланировано." />}
    {missed.map(h => <article className="habit-card compact" key={h.id}>
      <div className="habit-main"><div className="habit-icon blue"><Clock3 size={20} /></div><div className="habit-text"><h4>{h.title}</h4><p>Вчера · было {h.progress} из 21</p></div></div>
      <button className="done-button" onClick={() => { markDone(h.id, '', yesterdayISO); setTab('today'); }}><Check size={19} /> Сделано вчера</button>
    </article>)}
  </>;
}

function HabitForm({ initial, onSave, onCancel, mode }) {
  const [form, setForm] = useState(initial ? { ...initial } : makeEmptyHabit());
  const toggleDay = (day) => {
    setForm(prev => {
      const has = prev.schedule.includes(day);
      const schedule = has ? prev.schedule.filter(d => d !== day) : [...prev.schedule, day];
      return { ...prev, schedule };
    });
  };
  const setAllDays = () => setForm(prev => ({ ...prev, schedule: days }));
  const clearHour = () => setForm(prev => ({ ...prev, hour: '' }));
  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave({
      ...form,
      title: form.title.trim(),
      schedule: form.schedule.length ? form.schedule : days,
      valueLabel: form.valueLabel || 'число'
    });
  };

  return <form className="habit-form" onSubmit={submit}>
    <div className="form-head">
      <div><p className="eyebrow">{mode === 'edit' ? 'Редактирование' : 'Новая привычка'}</p><h3>{mode === 'edit' ? 'Настроить привычку' : 'Добавить привычку'}</h3></div>
      <button type="button" className="icon-button" onClick={onCancel}><X size={19} /></button>
    </div>

    <label className="field-label">Название привычки
      <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Например: Утренняя зарядка" />
    </label>

    <div className="field-label">Дни недели
      <div className="days-grid">{days.map(day => <button key={day} type="button" className={form.schedule.includes(day) ? 'selected' : ''} onClick={() => toggleDay(day)}>{day}</button>)}</div>
      <button type="button" className="text-button" onClick={setAllDays}>Выбрать все дни</button>
    </div>

    <label className="field-label">День начала отсчёта
      <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
    </label>

    <label className="field-label">Время суток
      <select value={form.time} onChange={e => setForm({ ...form, time: e.target.value })}>
        {timeParts.map(part => <option key={part} value={part}>{part}</option>)}
      </select>
    </label>

    <label className="field-label">Точное время, необязательно
      <div className="inline-field"><input type="time" value={form.hour} onChange={e => setForm({ ...form, hour: e.target.value })} /><button type="button" onClick={clearHour}>Не устанавливать</button></div>
    </label>

    <label className="switch-row">
      <span><b>Вести дневник изменений</b><small>В плане появится поле для числа</small></span>
      <input type="checkbox" checked={form.diary} onChange={e => setForm({ ...form, diary: e.target.checked })} />
    </label>

    {form.diary && <label className="field-label">Что записывать
      <input value={form.valueLabel} onChange={e => setForm({ ...form, valueLabel: e.target.value })} placeholder="вес, повторы, минуты" />
    </label>}

    <div className="form-actions">
      <button type="button" className="cancel-button" onClick={onCancel}>Отмена</button>
      <button type="submit" className="save-button"><Save size={18} /> Сохранить</button>
    </div>
  </form>;
}

function Habits({ habits, openCreate, openEdit, deleteHabit }) {
  return <>
    <ScreenTop title="Мои привычки" subtitle="Расписание, прогресс и настройка дневника" />
    <button className="add-button" onClick={openCreate}><Plus size={20} /> Добавить привычку</button>
    {!habits.length && <EmptyState title="Список привычек пуст" text="Нажмите «Добавить привычку», заполните название, дни недели, время и сохраните." />}
    {habits.map(h => <article className="habit-row" key={h.id}>
      <div className="habit-row-top"><div><h4>{h.title}</h4><p>{h.schedule.length === 7 ? 'Каждый день' : h.schedule.join(', ')} · {h.hour || h.time}</p></div><b>{h.progress}/21</b></div>
      <div className="wide-progress"><span style={{ width: `${h.progress / 21 * 100}%` }} /></div>
      <div className="row-tags"><span>{displayTimePart(h.time)}</span>{h.diary && <span>Дневник</span>}<span>Старт: {formatDate(h.startDate)}</span></div>
      <div className="row-actions">
        <button onClick={() => openEdit(h)}><Edit3 size={16} /> Редактировать</button>
        <button className="danger" onClick={() => deleteHabit(h.id)}><Trash2 size={16} /> Удалить</button>
      </div>
    </article>)}
  </>;
}

function DiaryChart({ habit, onBack }) {
  const rawSeries = habit.diaryEntries?.length ? habit.diaryEntries : [];
  const series = rawSeries.map((entry, index) => ({ ...entry, n: index + 1 }));
  const firstValue = Number(series[0]?.value) || 0;
  const values = series.map(p => Number(p.value) || 0);
  const topValue = Math.max(firstValue * 2, ...values, 1);
  const xFor = (n) => 34 + ((Math.min(Number(n) || 1, 21) - 1) / 20) * 278;
  const yFor = (value) => 170 - ((Number(value) || 0) / topValue) * 140;
  const points = series.map(p => `${xFor(p.n)},${yFor(p.value)}`).join(' ');
  const xTicks = [1, 5, 10, 15, 21];

  return <article className="diary-focus">
    {onBack && <button className="diary-back" onClick={onBack}>‹ Назад к перечню привычек</button>}
    <div className="habit-row-top"><div><h4>{habit.title}</h4><p>{habit.valueLabel || 'число'} · {series.length} записей</p></div><LineChart size={20} /></div>
    <div className="chart-wrap">
      {series.length ? <svg viewBox="0 0 340 205" className="chart diary-chart-svg">
        <line className="axis" x1="34" y1="170" x2="312" y2="170" />
        <line className="axis" x1="34" y1="30" x2="34" y2="170" />
        <line className="grid-line first-value-line" x1="34" y1={yFor(firstValue)} x2="312" y2={yFor(firstValue)} />
        {xTicks.map(tick => <g key={tick}>
          <line className="tick-line" x1={xFor(tick)} y1="170" x2={xFor(tick)} y2="174" />
          <text className="x-tick" x={xFor(tick)} y="190" textAnchor="middle">{tick}</text>
        </g>)}
        <text className="y-tick" x="30" y={yFor(firstValue) + 4} textAnchor="end">{firstValue}</text>
        <polyline points={points} />
        {series.map(p => <circle key={`${p.date}-${p.n}`} cx={xFor(p.n)} cy={yFor(p.value)} r="4" />)}
      </svg> : <div className="soft-note">Отметьте привычку с числом — здесь появится график.</div>}
    </div>
    {!!series.length && <div className="entry-list diary-entry-list diary-records">{series.slice().reverse().map(p => <div key={`${p.date}-${p.n}`}><span>{p.n}-е выполнение</span><b>{p.value} {habit.valueLabel}</b><em>{formatDate(p.date)}</em></div>)}</div>}
  </article>;
}

function Diary({ habits, onScreenChange }) {
  const diaryHabits = habits.filter(h => h.diary);
  const [selectedId, setSelectedId] = useState(null);
  const selectedHabit = diaryHabits.find(h => h.id === selectedId);

  if (selectedHabit) {
    return <>
      <ScreenTop title="Дневник" subtitle="График выбранной привычки" />
      <DiaryChart habit={selectedHabit} onBack={() => setSelectedId(null)} />
    </>;
  }

  return <>
    <ScreenTop title="Дневник" subtitle="Перечень привычек, в которые вносятся результаты" />
    {!diaryHabits.length && <EmptyState title="Дневник пока выключен" text="Включите «Вести дневник изменений» при создании или редактировании привычки." />}
    {!!diaryHabits.length && <div className="diary-habit-list">
      {diaryHabits.map(habit => {
        const count = habit.diaryEntries?.length || 0;
        const last = habit.diaryEntries?.[count - 1];
        return <button className="diary-habit-card" key={habit.id} onClick={() => { setSelectedId(habit.id); onScreenChange?.(); }}>
          <div>
            <h4>{habit.title}</h4>
            <p>{habit.valueLabel || 'число'} · {count ? `${count} записей` : 'записей пока нет'}</p>
            {last && <small>Последняя запись: {last.value} {habit.valueLabel} · {formatDate(last.date)}</small>}
          </div>
          <ChevronRight size={21} />
        </button>;
      })}
    </div>}
  </>;
}

function HabitCalendar({ habit }) {
  const now = new Date();
  const [viewDate, setViewDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const cells = useMemo(() => getCalendarCells(year, month, habit), [year, month, habit]);
  const monthLabel = `${monthNames[month]} ${year}`;
  const shiftMonth = (amount) => setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + amount, 1));

  return <article className="calendar-card habit-calendar-card">
    <div className="habit-calendar-title">
      <div>
        <h4>{habit.title}</h4>
        <p>{habit.time}{habit.hour ? ` · ${habit.hour}` : ''} · {habit.progress} из 21</p>
      </div>
      <span>{(habit.schedule || days).join(' ')}</span>
    </div>
    <div className="calendar-header habit-month-header">
      <button className="month-button" onClick={() => shiftMonth(-1)} aria-label={`Предыдущий месяц для ${habit.title}`}>‹</button>
      <h4>{monthLabel}</h4>
      <button className="month-button" onClick={() => shiftMonth(1)} aria-label={`Следующий месяц для ${habit.title}`}>›</button>
    </div>
    <div className="weekdays">{days.map(d => <span key={d}>{d}</span>)}</div>
    <div className="calendar-grid">{cells.map((cell, i) => cell.empty
      ? <span key={i} className="empty" />
      : <span key={cell.iso} className={cell.status} title={cell.scheduled ? (cell.completed ? 'выполнено' : 'запланировано') : 'не запланировано'}>{cell.day}</span>
    )}</div>
  </article>;
}

function History({ habits }) {
  const broken = habits.flatMap(h => (h.broken || []).map(b => ({ ...b, title: h.title })));

  return <>
    <ScreenTop title="История" subtitle="У каждой привычки свой календарь и свой месяц" />
    {!habits.length && <EmptyState title="История появится позже" text="Когда вы добавите привычки и начнёте отмечать выполнение, здесь появятся календари и сорванные серии." />}
    {!!habits.length && <section className="history-month-panel per-habit-note">
      <div className="legend calendar-legend"><span><i className="done-dot" /> выполнено</span><span><i className="miss-dot" /> пропуск</span><span><i className="planned-dot" /> запланировано</span><span><i className="skip-dot" /> не запланировано</span></div>
      <p>Месяц переключается отдельно в календаре каждой привычки. Запланированные дни показаны только в пределах первых 21 выполнений по расписанию.</p>
    </section>}
    {habits.map(habit => <HabitCalendar key={habit.id} habit={habit} />)}
    {!!habits.length && <div className="section-title"><h3>Сорванные серии</h3></div>}
    {!!habits.length && !broken.length && <div className="soft-note">Сорванных серий пока нет.</div>}
    {broken.map((b, i) => <article className="break-card" key={i}><div><h4>{b.title}</h4><p>{b.date} · серия оборвалась на {b.at}</p></div><span>сброс</span></article>)}
  </>;
}

function ScreenTop({ title, subtitle }) {
  return <header className="screen-top"><p className="eyebrow">Трекер привычек</p><h2>{title}</h2><span>{subtitle}</span></header>;
}

function Nav({ tab, setTab }) {
  const items = [
    ['today', 'Сегодня', Home], ['habits', 'Привычки', ListChecks], ['diary', 'Дневник', LineChart], ['history', 'История', CalendarDays]
  ];
  return <nav className="bottom-nav">{items.map(([id, label, Icon]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={21} /><span>{label}</span></button>)}</nav>;
}

function LandingIntro() {
  return <aside className="landing-copy">
    <div className="brand"><Sparkles size={22} /> 21 Habit</div>
    <h1>Мобильный трекер привычек, где серия держится только без пропусков</h1>
    <p>Интерактивный прототип под iPhone: пользователь сам добавляет привычки, выбирает расписание, отмечает выполнение, ведёт дневник изменений и смотрит историю.</p>
    <div className="feature-grid">
      <div><b>21</b><span>выполнение по расписанию</span></div>
      <div><b>0</b><span>аккаунтов и регистрации</span></div>
      <div><b>1</b><span>пропуск обнуляет счётчик</span></div>
    </div>
  </aside>;
}

function formatDate(value) {
  if (!value) return 'сегодня';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}.${month}`;
}

function App() {
  const [tab, setTab] = useState('today');
  const [currentDayISO, setCurrentDayISO] = useState(() => toISO(new Date()));
  todayISO = currentDayISO;
  yesterdayISO = toISO(addDays(parseISODate(currentDayISO), -1));
  const [habits, setHabits] = useState(loadSavedHabits);
  const [formMode, setFormMode] = useState(null);
  const [editingHabit, setEditingHabit] = useState(null);
  const [slideClass, setSlideClass] = useState('');
  const swipeStart = useRef(null);
  const scrollAreaRef = useRef(null);
  const mainTabs = ['today', 'habits', 'diary', 'history'];
  const yesterdayMissedCount = habits.filter(h => isScheduledOnDate(h, yesterdayISO) && !getCompletion(h, yesterdayISO)).length;

  const scrollToTop = () => {
    window.requestAnimationFrame(() => {
      scrollAreaRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
  };

  useLayoutEffect(() => {
    scrollToTop();
  }, [tab, formMode]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ habits }));
  }, [habits]);

  useEffect(() => {
    const refreshDay = () => {
      const realToday = toISO(new Date());
      setCurrentDayISO(prev => prev === realToday ? prev : realToday);
    };
    refreshDay();
    const timer = window.setInterval(refreshDay, 30000);
    window.addEventListener('focus', refreshDay);
    document.addEventListener('visibilitychange', refreshDay);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshDay);
      document.removeEventListener('visibilitychange', refreshDay);
    };
  }, []);

  const openCreate = () => { setEditingHabit(null); setFormMode('create'); setTab('habits'); };
  const openEdit = (habit) => { setEditingHabit(habit); setFormMode('edit'); setTab('habits'); };
  const closeForm = () => { setFormMode(null); setEditingHabit(null); };

  const saveHabit = (data) => {
    if (formMode === 'edit' && editingHabit) {
      setHabits(prev => prev.map(h => h.id === editingHabit.id ? { ...h, ...data } : h));
    } else {
      setHabits(prev => [{ ...data, id: Date.now(), progress: 0, done: false, broken: [], diaryEntries: [], completedDates: {} }, ...prev]);
    }
    closeForm();
  };

  const deleteHabit = (id) => {
    if (window.confirm('Удалить привычку? Прогресс и записи дневника будут удалены.')) {
      setHabits(prev => prev.filter(h => h.id !== id));
    }
  };

  const markDone = (id, value, date = todayISO) => setHabits(prev => prev.map(h => {
    if (h.id !== id) return h;
    const alreadyCompleted = Boolean(h.completedDates?.[date]);
    const progress = Math.min(21, h.progress + (alreadyCompleted ? 0 : 1));
    const numericValue = String(value || h.completedDates?.[date]?.value || '').replace(',', '.').trim();
    const hasValue = numericValue !== '' && !Number.isNaN(Number(numericValue));
    const entryExists = (h.diaryEntries || []).some(entry => entry.date === date);
    const diaryEntries = h.diary && hasValue && !entryExists ? [...(h.diaryEntries || []), { n: progress, value: numericValue, date }] : (h.diaryEntries || []);
    return {
      ...h,
      done: date === todayISO ? true : h.done,
      progress,
      diaryEntries,
      completedDates: { ...(h.completedDates || {}), [date]: { date, value: numericValue || '' } }
    };
  }));

  const changeTab = (id, direction = '') => {
    closeForm();
    if (direction) {
      setSlideClass(direction);
      window.setTimeout(() => setSlideClass(''), 340);
    }
    setTab(id);
  };

  const goMainTab = (id) => {
    const currentIndex = mainTabs.indexOf(tab);
    const nextIndex = mainTabs.indexOf(id);
    const direction = currentIndex >= 0 && nextIndex >= 0 && nextIndex !== currentIndex ? (nextIndex > currentIndex ? 'slide-left' : 'slide-right') : '';
    changeTab(id, direction);
  };

  const handleTouchStart = (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    swipeStart.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  };

  const handleTouchEnd = (event) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || formMode) return;
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const duration = Date.now() - start.time;
    const isLongHorizontalSwipe = Math.abs(dx) > 95 && Math.abs(dx) > Math.abs(dy) * 1.35 && duration > 120;
    if (!isLongHorizontalSwipe) return;
    const currentIndex = mainTabs.includes(tab) ? mainTabs.indexOf(tab) : 0;
    const nextIndex = dx < 0 ? Math.min(mainTabs.length - 1, currentIndex + 1) : Math.max(0, currentIndex - 1);
    if (nextIndex !== currentIndex) changeTab(mainTabs[nextIndex], dx < 0 ? 'slide-left' : 'slide-right');
  };

  const screen = useMemo(() => {
    if (formMode) return <HabitForm mode={formMode} initial={editingHabit} onSave={saveHabit} onCancel={closeForm} />;
    if (tab === 'today') return <Today habits={habits} markDone={markDone} setTab={setTab} openCreate={openCreate} yesterdayCount={yesterdayMissedCount} />;
    if (tab === 'yesterday') return <Yesterday habits={habits} markDone={markDone} setTab={setTab} />;
    if (tab === 'habits') return <Habits habits={habits} openCreate={openCreate} openEdit={openEdit} deleteHabit={deleteHabit} />;
    if (tab === 'diary') return <Diary habits={habits} onScreenChange={scrollToTop} />;
    return <History habits={habits} />;
  }, [tab, habits, formMode, editingHabit, yesterdayMissedCount, currentDayISO]);

  return <div className="page"><LandingIntro /><PhoneFrame><div ref={scrollAreaRef} className="scroll-area swipe-area" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}><div key={tab + '-' + formMode} className={`screen-slide ${slideClass}`}>{screen}</div></div><Nav tab={tab} setTab={goMainTab} /></PhoneFrame></div>;
}

createRoot(document.getElementById('root')).render(<App />);
