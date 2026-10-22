// Oberfläche: Tabs, Training, Verlauf, Fortschritt, Plan, Einstellungen.
import * as L from './logic.js';
import { lineChart, barList, columnChart } from './charts.js';
import { loadState, saveState, snapshot, loadBackup, requestPersist } from './store.js';

export const APP_VERSION = '1.0.0'; // bei jedem Release zusammen mit VERSION in sw.js erhöhen

let S = null; // Zustand
const ui = { tab: 'training', progEx: null, progMetric: 'e1rm', progRange: '3M', modal: null, pickerQuery: '', bannerHidden: false };

const $ = (sel, root = document) => root.querySelector(sel);
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const n = L.fmtNum;
const dateLong = (ts) => new Date(ts).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
const timeShort = (ts) => new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const exById = (id) => S.exercises.find((e) => e.id === id);
const MUSCLE_COLORS = { Brust: '#ff6b6b', Rücken: '#4dabf7', Schultern: '#ffa94d', Bizeps: '#b197fc', Trizeps: '#f783ac', Beine: '#51cf66', Gesäß: '#20c997', Waden: '#94d82d', Bauch: '#ffd43b', Sonstiges: '#adb5bd' };

function save() {
  if (ui.noSave) return toast('Daten konnten nicht geladen werden – Speichern ist gesperrt. App neu starten.');
  saveState(S).catch((e) => toast(`Speichern fehlgeschlagen: ${e.message}`));
}

// ---------- Toast mit Rückgängig ----------
let toastTimer = null;
function toast(msg, undo = null) {
  const el = $('#toast');
  el.innerHTML = `<span>${h(msg)}</span>${undo ? '<button data-action="toast-undo">Rückgängig</button>' : ''}`;
  el.hidden = false;
  el._undo = undo;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), undo ? 6000 : 3000);
}

// ---------- Ton & Wake Lock ----------
let audio = null;
function unlockAudio() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch {
    /* Ton ist optional */
  }
}
function beep() {
  if (!S.settings.sound || !audio) return;
  try {
    const t = audio.currentTime;
    [0, 0.25, 0.5].forEach((d, i) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.frequency.value = i === 2 ? 1320 : 880;
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.4, t + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.18);
      o.connect(g).connect(audio.destination);
      o.start(t + d);
      o.stop(t + d + 0.2);
    });
  } catch {
    /* ignorieren */
  }
  navigator.vibrate?.([200, 100, 200]);
}

let wakeLock = null;
let wakeWarned = false;
async function updateWakeLock() {
  const want = S?.active && S.settings.wakeLock && document.visibilityState === 'visible';
  if (want && !wakeLock) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    } catch {
      if (!wakeWarned) {
        wakeWarned = true;
        toast('Bildschirm-wach-halten nicht verfügbar – ggf. „Automatische Sperre“ in iOS verlängern.');
      }
    }
  } else if (!want && wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

// ---------- Pausentimer (zeitstempelbasiert) ----------
function startTimer(sec) {
  if (!(sec > 0)) return;
  S.active.timer = { end: Date.now() + sec * 1000, total: sec, rang: false };
}
function tick() {
  const a = S?.active;
  const bar = $('#timer');
  if (a && $('#elapsed')) $('#elapsed').textContent = L.fmtDuration(Date.now() - a.start);
  if (!a?.timer || ui.tab !== 'training') {
    bar.hidden = true;
    return;
  }
  const left = (a.timer.end - Date.now()) / 1000;
  bar.hidden = false;
  bar.classList.toggle('done', left <= 0);
  $('#timer-clock').textContent = left > 0 ? L.fmtClock(left) : 'Los!';
  $('#timer-fill').style.width = `${Math.max(0, Math.min(1, left / a.timer.total)) * 100}%`;
  if (left <= 0 && !a.timer.rang) {
    a.timer.rang = true;
    save();
    beep();
  }
  if (left < -60) {
    a.timer = null;
    save();
  }
}

// ---------- Rahmen ----------
const ICONS = {
  training: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" />',
  verlauf: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  fortschritt: '<path d="M3 20h18M5 16l4-5 4 3 6-8"/>',
  plan: '<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 2v4M16 2v4M8 11h8M8 15h5"/>',
  einstellungen: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
};
const TAB_NAMES = { training: 'Training', verlauf: 'Verlauf', fortschritt: 'Fortschritt', plan: 'Plan', einstellungen: 'Einstellungen' };

function renderNav() {
  $('#nav').innerHTML = Object.keys(TAB_NAMES)
    .map(
      (t) => `<button data-action="tab" data-tab="${t}" class="${ui.tab === t ? 'active' : ''}" aria-label="${TAB_NAMES[t]}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[t]}</svg><span>${TAB_NAMES[t]}</span></button>`,
    )
    .join('');
}

function banners() {
  let out = '';
  if (!isStandalone() && !ui.bannerHidden) {
    out += `<div class="banner warn"><b>Als App installieren:</b> In Safari „Teilen“ → „Zum Home-Bildschirm“ und nur über das Icon öffnen. Daten im Browser und in der Home-Bildschirm-App sind getrennt.<button class="x" data-action="hide-banner" aria-label="Schließen">✕</button></div>`;
  }
  if (L.needsBackupReminder(S) && !S.active) {
    out += `<div class="banner info">Seit dem letzten Backup: ${S.settings.sessionsSinceExport} Training(s). <button class="link" data-action="export">Jetzt sichern</button></div>`;
  }
  return out;
}

function render() {
  const scroll = window.scrollY;
  renderNav();
  document.documentElement.dataset.theme = S.settings.theme;
  const main = $('#main');
  try {
    main.innerHTML = banners() + VIEWS[ui.tab]();
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="banner warn">Anzeigefehler: ${h(e.message)}. Daten sind gespeichert – bitte Backup exportieren und melden.</div><button class="btn primary wide" data-action="export">Backup exportieren</button>`;
  }
  if (ui.keepScroll) window.scrollTo(0, scroll);
  ui.keepScroll = false;
  tick();
  updateWakeLock();
}
const rerender = () => {
  ui.keepScroll = true;
  render();
};

// ---------- Training ----------
function viewTraining() {
  return S.active ? viewActive() : viewIdle();
}

function viewIdle() {
  const idx = L.nextDayIndex(S.plan, S.sessions);
  const day = S.plan.days[idx];
  const last = L.sortedSessions(S.sessions)[0];
  const week = L.weeklyCounts(S.sessions, 1)[0].count;
  const preview = day
    ? day.items
        .map((it) => {
          const ex = exById(it.exId);
          if (!ex) return '';
          const lp = L.lastPerformance(S.sessions, ex.id);
          return `<li><span>${h(ex.name)}</span><span class="muted">${it.sets} × ${it.repMin}–${it.repMax}${lp ? ` · zuletzt ${h(L.fmtSet(ex.type, lp.sets[0]))}` : ''}</span></li>`;
        })
        .join('')
    : '';
  return `
    <header class="top"><h1>Training</h1><span class="muted">${new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</span></header>
    <div class="stats3">
      <div><b>${week}</b><span>diese Woche</span></div>
      <div><b>${S.sessions.length}</b><span>gesamt</span></div>
      <div><b>${last ? Math.max(0, Math.floor((Date.now() - last.start) / 864e5)) : '–'}</b><span>Tage seit letztem</span></div>
    </div>
    ${
      day
        ? `<section class="card hero">
            <div class="eyebrow">Als Nächstes</div>
            <h2>${h(day.name)}</h2>
            <ul class="preview">${preview || '<li class="muted">Keine Übungen – im Tab „Plan“ hinzufügen.</li>'}</ul>
            <button class="btn primary big" data-action="start-day" data-day="${idx}">Training starten</button>
          </section>`
        : `<section class="card"><p>Noch kein Plan angelegt.</p><button class="btn" data-action="tab" data-tab="plan">Plan anlegen</button></section>`
    }
    <div class="chips">
      ${S.plan.days.map((d, i) => (i === idx ? '' : `<button class="chip" data-action="start-day" data-day="${i}">${h(d.name)}</button>`)).join('')}
      <button class="chip" data-action="start-free">+ Freies Training</button>
    </div>`;
}

function setRow(ex, s, i) {
  const wLabel = ex.type === 'bodyweight' ? '±kg' : 'kg';
  const rMode = ex.type === 'time' ? 'Sek.' : 'Wdh';
  const wMode = ex.type === 'bodyweight' ? 'text' : 'decimal';
  return `<div class="set ${s.done ? 'done' : ''} ${s.warm ? 'warm' : ''}">
    <button class="set-no" data-action="set-warm" data-ex="${h(ex.uid)}" data-set="${i}" title="Aufwärmsatz umschalten">${s.warm ? 'W' : i + 1 - ex.sets.slice(0, i).filter((x) => x.warm).length}</button>
    <input data-field="w" data-ex="${h(ex.uid)}" data-set="${i}" inputmode="${wMode}" enterkeyhint="next" autocomplete="off" aria-label="${wLabel}"
      value="${s.w == null ? '' : n(s.w)}" placeholder="${s.tw == null ? wLabel : n(s.tw)}">
    <span class="x">×</span>
    <input data-field="r" data-ex="${h(ex.uid)}" data-set="${i}" inputmode="numeric" enterkeyhint="done" autocomplete="off" aria-label="${rMode}"
      value="${s.r == null ? '' : s.r}" placeholder="${s.tr == null ? rMode : s.tr}">
    <button class="check" data-action="set-check" data-ex="${h(ex.uid)}" data-set="${i}" aria-label="Satz erledigt">✓</button>
  </div>`;
}

function viewActive() {
  const a = S.active;
  const vol = L.sessionVolume(a);
  const sets = L.sessionSetCount(a);
  const cards = a.exercises
    .map((ex) => {
      const last = ex.lastSets ? ex.lastSets.map((s) => L.fmtSet(ex.type, s)).join(' · ') : 'neu';
      const allDone = ex.sets.length && ex.sets.every((s) => s.done);
      const unit = ex.type === 'time' ? 'Sek.' : 'Wdh';
      return `<section class="card ex ${allDone ? 'complete' : ''}">
        <div class="ex-head">
          <div><h3>${h(ex.name)}</h3><div class="muted small">${h(ex.muscle)}${ex.repMin ? ` · Ziel ${ex.repMin}–${ex.repMax} ${unit}` : ''}</div></div>
          <button class="icon" data-action="ex-menu" data-ex="${h(ex.uid)}" aria-label="Optionen">⋯</button>
        </div>
        <div class="last">Letztes Mal: ${h(last)}${ex.progress ? ' <span class="badge up">↑ steigern</span>' : ''}</div>
        <div class="set-head"><span>Satz</span><span>${ex.type === 'bodyweight' ? '±kg' : 'kg'}</span><span></span><span>${unit}</span><span></span></div>
        ${ex.sets.map((s, i) => setRow(ex, s, i)).join('')}
        <div class="ex-foot"><button class="btn ghost" data-action="set-add" data-ex="${h(ex.uid)}">+ Satz</button><button class="btn ghost" data-action="set-remove" data-ex="${h(ex.uid)}">− Satz</button></div>
      </section>`;
    })
    .join('');
  return `
    <header class="top sticky">
      <div><h1>${h(a.dayName)}</h1><span class="muted"><span id="elapsed">${L.fmtDuration(Date.now() - a.start)}</span> · ${sets} Sätze · ${n(Math.round(vol))} kg</span></div>
      <button class="btn primary" data-action="finish">Fertig</button>
    </header>
    ${cards || '<p class="muted center">Noch keine Übungen.</p>'}
    <button class="btn wide" data-action="add-ex-session">+ Übung hinzufügen</button>
    <label class="field"><span>Notiz</span><textarea data-field="note" rows="2" placeholder="z. B. Schulter zwickt, schlecht geschlafen …">${h(a.note)}</textarea></label>
    <button class="btn danger-ghost wide" data-action="discard">Training verwerfen</button>
    <div class="spacer"></div>`;
}

const findEx = (uid) => S.active?.exercises.find((e) => e.uid === uid);

function startSession(day) {
  unlockAudio();
  S.active = L.createSession(day, S);
  ui.tab = 'training';
  save();
  render();
  window.scrollTo(0, 0);
}

function finishSession(end = Date.now()) {
  const a = S.active;
  const fin = L.finalizeSession(a, end);
  if (!fin.exercises.length) {
    confirmModal('Keine Arbeitssätze abgehakt. Training verwerfen?', 'Verwerfen', () => {
      S.active = null;
      save();
      render();
    });
    return;
  }
  const recs = L.newRecords(fin, S.sessions);
  S.sessions.push(fin);
  S.settings.sessionsSinceExport = (S.settings.sessionsSinceExport || 0) + 1;
  S.active = null;
  save();
  render();
  openModal(() => `
    <h2>Stark! 💪</h2>
    <div class="stats3">
      <div><b>${L.fmtDuration(fin.end - fin.start)}</b><span>Dauer</span></div>
      <div><b>${L.sessionSetCount(fin)}</b><span>Sätze</span></div>
      <div><b>${n(Math.round(L.sessionVolume(fin)))}</b><span>kg Volumen</span></div>
    </div>
    ${recs.length ? `<h3>Neue Rekorde 🏆</h3><ul class="list">${recs.map((r) => `<li><span>${h(r.name)}</span><b>${h(r.kind)}: ${n(Math.round(r.value * 10) / 10)} ${r.unit}</b></li>`).join('')}</ul>` : ''}
    <button class="btn primary wide" data-action="close">OK</button>`);
}

// ---------- Übungsauswahl ----------
function pickerModal(onPick) {
  ui.pickerQuery = '';
  openModal(
    () => `
    <h2>Übung wählen</h2>
    <input class="search" data-field="picker-q" placeholder="Suchen …" value="${h(ui.pickerQuery)}" autocomplete="off">
    <div id="picker-list">${pickerList()}</div>
    <button class="btn wide" data-action="new-exercise">+ Neue Übung anlegen</button>
    <button class="btn ghost wide" data-action="close">Abbrechen</button>`,
    { onPick },
  );
}
function pickerList() {
  const q = ui.pickerQuery.trim().toLowerCase();
  const list = S.exercises.filter((e) => !q || e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q));
  if (!list.length) return '<p class="muted">Nichts gefunden.</p>';
  return L.MUSCLES.map((m) => {
    const items = list.filter((e) => e.muscle === m).sort((a, b) => a.name.localeCompare(b.name, 'de'));
    if (!items.length) return '';
    return `<div class="group"><div class="eyebrow">${h(m)}</div>${items.map((e) => `<button class="row" data-action="pick" data-id="${h(e.id)}">${h(e.name)}<span class="muted small">${L.TYPES[e.type] !== L.TYPES.weight ? h(L.TYPES[e.type]) : ''}</span></button>`).join('')}</div>`;
  }).join('');
}

function exerciseEditModal(ex, onSaved) {
  const isNew = !ex;
  const e = ex ? { ...ex } : { id: '', name: ui.pickerQuery || '', muscle: 'Brust', type: 'weight' };
  openModal(
    () => `
    <h2>${isNew ? 'Neue Übung' : 'Übung bearbeiten'}</h2>
    <label class="field"><span>Name</span><input id="ex-name" value="${h(e.name)}" autocomplete="off"></label>
    <label class="field"><span>Muskelgruppe</span><select id="ex-muscle">${L.MUSCLES.map((m) => `<option ${m === e.muscle ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
    <label class="field"><span>Art</span><select id="ex-type">${Object.entries(L.TYPES).map(([k, v]) => `<option value="${k}" ${k === e.type ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <button class="btn primary wide" data-action="ex-save">Speichern</button>
    ${isNew ? '' : '<button class="btn danger-ghost wide" data-action="ex-delete">Übung löschen</button>'}
    <button class="btn ghost wide" data-action="close">Abbrechen</button>`,
    { exEdit: { ex, onSaved } },
  );
}

// ---------- Verlauf ----------
function viewVerlauf() {
  const list = L.sortedSessions(S.sessions);
  if (!list.length) return `<header class="top"><h1>Verlauf</h1></header><p class="muted center">Noch keine Trainings gespeichert.</p>`;
  let month = '';
  const rows = list
    .map((s) => {
      const m = new Date(s.start).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
      const head = m !== month ? `<div class="eyebrow month">${(month = m)}</div>` : '';
      return `${head}<button class="card row-card" data-action="session-open" data-id="${h(s.id)}">
        <div><b>${h(s.dayName)}</b><div class="muted small">${dateLong(s.start)} · ${timeShort(s.start)}</div></div>
        <div class="right"><b>${n(Math.round(L.sessionVolume(s)))} kg</b><div class="muted small">${L.sessionSetCount(s)} Sätze · ${L.fmtDuration((s.end || s.start) - s.start)}</div></div>
      </button>`;
    })
    .join('');
  return `<header class="top"><h1>Verlauf</h1><span class="muted">${list.length} Trainings</span></header>${rows}`;
}

function previousComparable(s) {
  return L.sortedSessions(S.sessions).find((p) => p.start < s.start && (s.dayId ? p.dayId === s.dayId : p.dayName === s.dayName));
}

function sessionModal(id, editing = false) {
  openModal(() => {
    const s = S.sessions.find((x) => x.id === id);
    if (!s) return '<p>Training nicht gefunden.</p><button class="btn wide" data-action="close">Schließen</button>';
    const prev = previousComparable(s);
    const exs = s.exercises
      .map((ex, ei) => {
        const best = Math.max(0, ...ex.sets.filter(L.isValidSet).map((x) => L.e1rm(x.w, x.r)));
        const pex = prev?.exercises.find((p) => p.exId === ex.exId);
        const pbest = pex ? Math.max(0, ...pex.sets.filter(L.isValidSet).map((x) => L.e1rm(x.w, x.r))) : null;
        const diff = pbest && best ? best - pbest : null;
        const sets = editing
          ? ex.sets
              .map(
                (x, si) => `<div class="set edit"><span class="set-no">${x.warm ? 'W' : si + 1}</span>
                <input data-field="hw" data-ex="${ei}" data-set="${si}" inputmode="${ex.type === 'bodyweight' ? 'text' : 'decimal'}" value="${n(x.w)}">
                <span class="x">×</span><input data-field="hr" data-ex="${ei}" data-set="${si}" inputmode="numeric" value="${x.r}">
                <button class="icon" data-action="hset-del" data-ex="${ei}" data-set="${si}" aria-label="Satz löschen">🗑</button></div>`,
              )
              .join('')
          : `<div class="muted">${ex.sets.map((x) => `${x.warm ? '<i>W</i> ' : ''}${h(L.fmtSet(ex.type, x))}`).join(' · ')}</div>`;
        return `<div class="hist-ex"><div class="ex-head"><b>${h(ex.name)}</b>${
          diff != null && ex.type !== 'time' ? `<span class="badge ${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '+' : ''}${n(Math.round(diff * 10) / 10)} kg 1RM</span>` : ''
        }</div>${sets}</div>`;
      })
      .join('');
    const vol = L.sessionVolume(s);
    const pvol = prev ? L.sessionVolume(prev) : null;
    return `
      <h2>${h(s.dayName)}</h2>
      <div class="muted">${dateLong(s.start)}, ${timeShort(s.start)} · ${L.fmtDuration((s.end || s.start) - s.start)}</div>
      <div class="stats3">
        <div><b>${L.sessionSetCount(s)}</b><span>Sätze</span></div>
        <div><b>${n(Math.round(vol))}</b><span>kg Volumen</span></div>
        <div><b>${pvol != null ? `${vol >= pvol ? '+' : ''}${n(Math.round(((vol - pvol) / (pvol || 1)) * 100))} %` : '–'}</b><span>vs. letztes Mal</span></div>
      </div>
      ${exs}
      ${s.note ? `<p class="note">📝 ${h(s.note)}</p>` : ''}
      ${prev ? `<p class="muted small">Verglichen mit ${dateLong(prev.start)}.</p>` : ''}
      <button class="btn wide" data-action="session-edit" data-id="${h(s.id)}" data-on="${editing ? 0 : 1}">${editing ? 'Bearbeiten beenden' : 'Bearbeiten'}</button>
      <button class="btn danger-ghost wide" data-action="session-delete" data-id="${h(s.id)}">Training löschen</button>
      <button class="btn ghost wide" data-action="close">Schließen</button>`;
  }, { sessionId: id, editing });
}

// ---------- Fortschritt ----------
function viewFortschritt() {
  const used = new Map();
  for (const s of S.sessions) for (const ex of s.exercises) used.set(ex.exId, (used.get(ex.exId) || 0) + 1);
  const options = [...used.keys()].map((id) => ({ id, name: exById(id)?.name || S.sessions.flatMap((s) => s.exercises).find((e) => e.exId === id)?.name || id }));
  options.sort((a, b) => used.get(b.id) - used.get(a.id));
  if (!ui.progEx || !used.has(ui.progEx)) ui.progEx = options[0]?.id ?? null;

  const weekly = L.weeklyMuscleSets(S.sessions);
  const muscleBars = Object.entries(weekly)
    .sort((a, b) => b[1] - a[1])
    .map(([m, v]) => ({ label: m, value: v, color: MUSCLE_COLORS[m] }));
  const bw = [...S.bodyweight].sort((a, b) => a.date - b.date).map((b) => ({ date: b.date, value: b.w }));
  const lastBw = bw[bw.length - 1];

  let main = '<p class="muted">Sobald du Trainings speicherst, erscheinen hier deine Kurven.</p>';
  if (ui.progEx) {
    const exType = S.sessions.flatMap((s) => s.exercises).find((e) => e.exId === ui.progEx)?.type || 'weight';
    const metrics = exType === 'time' ? { reps: 'Längste Zeit' } : { e1rm: '1RM (geschätzt)', top: 'Top-Gewicht', volume: 'Volumen', reps: 'Max. Wdh' };
    if (!metrics[ui.progMetric]) ui.progMetric = Object.keys(metrics)[0];
    const unit = ui.progMetric === 'reps' ? (exType === 'time' ? 's' : 'Wdh') : 'kg';
    const hist = L.exerciseHistory(S.sessions, ui.progEx);
    const pts = L.filterRange(hist, ui.progRange).map((p) => ({ date: p.date, value: Math.round(p[ui.progMetric] * 10) / 10 }));
    const rec = L.records(S.sessions, ui.progEx);
    const first = pts[0]?.value, lastV = pts[pts.length - 1]?.value;
    const delta = pts.length > 1 ? lastV - first : null;
    main = `
      <select class="select" data-change="prog-ex">${options.map((o) => `<option value="${h(o.id)}" ${o.id === ui.progEx ? 'selected' : ''}>${h(o.name)}</option>`).join('')}</select>
      <div class="seg">${Object.entries(metrics).map(([k, v]) => `<button data-action="prog-metric" data-v="${k}" class="${k === ui.progMetric ? 'on' : ''}">${v}</button>`).join('')}</div>
      <div class="chart-wrap">${lineChart(pts, { unit, id: 'gp' })}</div>
      <div class="seg small">${['1M', '3M', '1J', 'Alles'].map((r) => `<button data-action="prog-range" data-v="${r}" class="${r === ui.progRange ? 'on' : ''}">${r}</button>`).join('')}</div>
      ${delta != null ? `<p class="center ${delta >= 0 ? 'pos' : 'neg'}">${delta >= 0 ? '▲' : '▼'} ${n(Math.round(Math.abs(delta) * 10) / 10)} ${unit} im Zeitraum</p>` : ''}
      ${
        rec
          ? `<div class="stats3">
          ${exType === 'time' ? '' : `<div><b>${n(Math.round(rec.e1rm.e1rm * 10) / 10)}</b><span>bestes 1RM (kg)</span></div><div><b>${n(rec.top.top)}</b><span>Top-Gewicht (kg)</span></div>`}
          <div><b>${rec.reps.reps}</b><span>${exType === 'time' ? 'beste Zeit (s)' : 'max. Wdh'}</span></div></div>`
          : ''
      }`;
  }
  return `<header class="top"><h1>Fortschritt</h1></header>
    <section class="card">${main}</section>
    <section class="card"><h3>Sätze je Muskel – diese Woche</h3>${barList(muscleBars)}</section>
    <section class="card"><h3>Trainings pro Woche</h3>${columnChart(L.weeklyCounts(S.sessions, 8))}</section>
    <section class="card"><h3>Körpergewicht</h3>
      ${bw.length > 1 ? lineChart(bw, { unit: 'kg', color: 'var(--accent2)', id: 'gb' }) : ''}
      <div class="inline"><input id="bw-input" inputmode="decimal" placeholder="${lastBw ? n(lastBw.value) : 'kg'}" autocomplete="off"><button class="btn" data-action="bw-add">Eintragen</button></div>
      ${lastBw ? `<p class="muted small">Zuletzt: ${n(lastBw.value)} kg am ${dateLong(lastBw.date)}${bw.length ? ` · <button class="link" data-action="bw-undo">letzten löschen</button>` : ''}</p>` : ''}
    </section>`;
}

// ---------- Plan ----------
function viewPlan() {
  const next = L.nextDayIndex(S.plan, S.sessions);
  const days = S.plan.days
    .map((d, i) => `<section class="card">
      <div class="ex-head"><div><h3>${h(d.name)}${i === next ? ' <span class="badge">als Nächstes</span>' : ''}</h3><div class="muted small">${d.items.length} Übungen</div></div>
        <div class="btns"><button class="icon" data-action="day-move" data-i="${i}" data-d="-1" aria-label="Nach oben">↑</button><button class="icon" data-action="day-move" data-i="${i}" data-d="1" aria-label="Nach unten">↓</button><button class="btn small" data-action="day-edit" data-i="${i}">Bearbeiten</button></div></div>
      <ul class="preview">${d.items.map((it) => `<li><span>${h(exById(it.exId)?.name || '(gelöschte Übung)')}</span><span class="muted">${it.sets} × ${it.repMin}–${it.repMax}</span></li>`).join('')}</ul>
    </section>`)
    .join('');
  return `<header class="top"><h1>Plan</h1><span class="muted">Reihenfolge = Rotation</span></header>
    ${days || '<p class="muted center">Noch keine Trainingstage.</p>'}
    <button class="btn wide" data-action="day-add">+ Trainingstag</button>
    <section class="card"><h3>Vorlage laden</h3><p class="muted small">Ersetzt den aktuellen Plan (Verlauf bleibt erhalten).</p>
      <div class="chips">${Object.keys(L.TEMPLATES).map((t) => `<button class="chip" data-action="template" data-t="${h(t)}">${h(t)}</button>`).join('')}</div></section>
    <section class="card"><h3>Übungen (${S.exercises.length})</h3><p class="muted small">Eigene Übungen anlegen oder Namen, Muskel und Art ändern.</p>
      <button class="btn wide" data-action="lib-open">Übungsliste öffnen</button></section>`;
}

function dayModal(i) {
  openModal(() => {
    const d = S.plan.days[i];
    if (!d) return '<button class="btn wide" data-action="close">Schließen</button>';
    const rows = d.items
      .map((it, k) => {
        const ex = exById(it.exId);
        const u = ex?.type === 'time' ? 'Sek.' : 'Wdh';
        return `<div class="plan-item">
        <div class="ex-head"><b>${h(ex?.name || '(gelöschte Übung)')}</b><div class="btns">
          <button class="icon" data-action="item-move" data-k="${k}" data-d="-1" aria-label="Nach oben">↑</button>
          <button class="icon" data-action="item-move" data-k="${k}" data-d="1" aria-label="Nach unten">↓</button>
          <button class="icon" data-action="item-del" data-k="${k}" aria-label="Entfernen">🗑</button></div></div>
        <div class="grid4">
          <label><span>Sätze</span><input data-field="it-sets" data-k="${k}" inputmode="numeric" value="${it.sets}"></label>
          <label><span>${u} min</span><input data-field="it-repMin" data-k="${k}" inputmode="numeric" value="${it.repMin}"></label>
          <label><span>${u} max</span><input data-field="it-repMax" data-k="${k}" inputmode="numeric" value="${it.repMax}"></label>
          <label><span>Pause s</span><input data-field="it-rest" data-k="${k}" inputmode="numeric" value="${it.rest ?? ''}" placeholder="${S.settings.rest}"></label>
        </div></div>`;
      })
      .join('');
    return `<h2>Trainingstag</h2>
      <label class="field"><span>Name</span><input data-field="day-name" value="${h(d.name)}" autocomplete="off"></label>
      ${rows || '<p class="muted">Noch keine Übungen.</p>'}
      <button class="btn wide" data-action="item-add">+ Übung</button>
      <button class="btn primary wide" data-action="close">Fertig</button>
      <button class="btn danger-ghost wide" data-action="day-del">Tag löschen</button>`;
  }, { dayIndex: i });
}

function libraryModal() {
  openModal(() => `<h2>Übungen</h2>
    ${L.MUSCLES.map((m) => {
      const items = S.exercises.filter((e) => e.muscle === m).sort((a, b) => a.name.localeCompare(b.name, 'de'));
      return items.length ? `<div class="group"><div class="eyebrow">${m}</div>${items.map((e) => `<button class="row" data-action="lib-edit" data-id="${h(e.id)}">${h(e.name)}<span class="muted small">${h(L.TYPES[e.type])}</span></button>`).join('')}</div>` : '';
    }).join('')}
    <button class="btn wide" data-action="lib-new">+ Neue Übung</button>
    <button class="btn ghost wide" data-action="close">Schließen</button>`);
}

// ---------- Einstellungen ----------
function viewEinstellungen() {
  const st = S.settings;
  const lastExp = st.lastExport ? `${dateLong(st.lastExport)}, ${timeShort(st.lastExport)}` : 'noch nie';
  return `<header class="top"><h1>Einstellungen</h1></header>
    <section class="card form">
      <label class="field row2"><span>Gewichtsschritt (kg)</span><input data-setting="step" inputmode="decimal" value="${n(st.step)}"></label>
      <label class="field row2"><span>Standard-Pause (Sek.)</span><input data-setting="rest" inputmode="numeric" value="${st.rest}"></label>
      <label class="switch"><span>Ton am Pausenende</span><input type="checkbox" data-setting="sound" ${st.sound ? 'checked' : ''}></label>
      <label class="switch"><span>Bildschirm im Training wach halten</span><input type="checkbox" data-setting="wakeLock" ${st.wakeLock ? 'checked' : ''}></label>
      <label class="field row2"><span>Design</span><select data-setting="theme">${[['auto', 'System'], ['dark', 'Dunkel'], ['light', 'Hell']].map(([k, v]) => `<option value="${k}" ${st.theme === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    </section>
    <section class="card"><h3>Backup</h3>
      <p class="muted small">Daten liegen nur auf diesem iPhone. Letztes Backup: <b>${lastExp}</b>. Tipp: im Teilen-Menü „In Dateien sichern“ (iCloud Drive) wählen.</p>
      <button class="btn primary wide" data-action="export">Backup exportieren (JSON)</button>
      <label class="btn wide file">Backup importieren<input type="file" accept="application/json,.json" data-change="import" hidden></label>
      <button class="btn wide" data-action="csv">Als CSV exportieren (Excel/Numbers)</button>
      <button class="btn ghost wide" data-action="restore">Stand vor letzter Aktion wiederherstellen</button>
    </section>
    <section class="card"><h3>Info</h3>
      <p class="muted small">Gym-Tracker ${APP_VERSION} · ${S.sessions.length} Trainings · ${isStandalone() ? 'als App installiert' : 'im Browser geöffnet'} · <span id="persist">Speicher wird geprüft …</span></p>
      <button class="btn danger-ghost wide" data-action="reset">Alle Daten löschen</button>
    </section>`;
}

const VIEWS = { training: viewTraining, verlauf: viewVerlauf, fortschritt: viewFortschritt, plan: viewPlan, einstellungen: viewEinstellungen };

// ---------- Backup ----------
async function shareOrDownload(name, text, type) {
  const blob = new Blob([text], { type });
  const file = new File([blob], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false;
      // sonst Download versuchen
    }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

async function doExport() {
  const data = { ...structuredClone(S), exportedAt: new Date().toISOString(), app: 'gym-tracker', appVersion: APP_VERSION };
  const ok = await shareOrDownload(`gym-tracker-backup-${L.isoDate(Date.now())}.json`, JSON.stringify(data, null, 1), 'application/json');
  if (ok) {
    S.settings.lastExport = Date.now();
    S.settings.sessionsSinceExport = 0;
    save();
    rerender();
    toast('Backup erstellt.');
  }
}

async function doImport(file) {
  let parsed;
  try {
    parsed = L.validateState(JSON.parse(await file.text()));
  } catch (e) {
    toast(e instanceof SyntaxError ? 'Datei ist kein gültiges JSON.' : e.message);
    return;
  }
  confirmModal(
    `Aktuelle Daten (${S.sessions.length} Trainings) durch die Datei (${parsed.sessions.length} Trainings) ersetzen? Der jetzige Stand wird vorher gesichert.`,
    'Ersetzen',
    async () => {
      await snapshot(S, 'Import');
      S = parsed;
      save();
      render();
      toast('Backup importiert.');
    },
  );
}

// ---------- Modal ----------
function openModal(renderFn, ctx = {}) {
  ui.modal = { render: renderFn, ...ctx };
  const dlg = $('#modal');
  $('#modal-body').innerHTML = renderFn();
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
}
function refreshModal() {
  if (!ui.modal) return;
  const body = $('#modal-body');
  const st = $('#modal').scrollTop;
  body.innerHTML = ui.modal.render();
  $('#modal').scrollTop = st;
}
function closeModal() {
  ui.modal = null;
  const dlg = $('#modal');
  if (dlg.open) dlg.close();
}
function confirmModal(text, okLabel, onOk) {
  openModal(
    () => `<p class="confirm">${h(text)}</p><button class="btn danger wide" data-action="confirm-ok">${h(okLabel)}</button><button class="btn ghost wide" data-action="close">Abbrechen</button>`,
    { onOk },
  );
}

// ---------- Aktionen ----------
const A = {
  tab: (el) => {
    ui.tab = el.dataset.tab;
    render();
    window.scrollTo(0, 0);
  },
  'hide-banner': () => {
    ui.bannerHidden = true;
    try {
      sessionStorage.setItem('gymtracker-banner', '1');
    } catch {
      /* egal */
    }
    rerender();
  },
  'toast-undo': () => {
    const el = $('#toast');
    el._undo?.();
    el._undo = null;
    el.hidden = true;
  },
  'start-day': (el) => startSession(S.plan.days[+el.dataset.day]),
  'start-free': () => startSession(null),
  'set-check': (el) => {
    unlockAudio();
    const ex = findEx(el.dataset.ex);
    const i = +el.dataset.set;
    const s = ex.sets[i];
    if (s.done) {
      s.done = false;
    } else {
      const f = L.fillFromTarget(s);
      if (f.w == null && ex.type !== 'weight') f.w = 0;
      if (f.w == null || !(f.r > 0)) {
        toast(ex.type === 'time' ? 'Bitte Sekunden eintragen.' : 'Bitte Gewicht und Wiederholungen eintragen.');
        const row = el.closest('.set');
        row.classList.add('invalid');
        setTimeout(() => row.classList.remove('invalid'), 1200);
        return;
      }
      Object.assign(s, f, { done: true });
      S.active.last = Date.now();
      const more = S.active.exercises.some((e) => e.sets.some((x) => !x.done));
      if (more) startTimer(s.warm ? Math.min(60, ex.rest ?? S.settings.rest) : ex.rest ?? S.settings.rest);
    }
    save();
    rerender();
  },
  'set-warm': (el) => {
    const s = findEx(el.dataset.ex).sets[+el.dataset.set];
    s.warm = !s.warm;
    save();
    rerender();
  },
  'set-add': (el) => {
    const ex = findEx(el.dataset.ex);
    const prev = ex.sets[ex.sets.length - 1];
    ex.sets.push({ w: null, r: null, done: false, tw: prev ? prev.w ?? prev.tw : null, tr: prev ? prev.r ?? prev.tr : ex.repMax });
    save();
    rerender();
  },
  'set-remove': (el) => {
    const ex = findEx(el.dataset.ex);
    if (!ex.sets.length) return;
    const removed = ex.sets.pop();
    save();
    rerender();
    toast('Satz entfernt.', () => {
      ex.sets.push(removed);
      save();
      rerender();
    });
  },
  'ex-menu': (el) => {
    const uid = el.dataset.ex;
    const ex = findEx(uid);
    openModal(() => `<h2>${h(ex.name)}</h2>
      <button class="btn wide" data-action="ex-move" data-ex="${h(uid)}" data-d="-1">↑ Nach oben</button>
      <button class="btn wide" data-action="ex-move" data-ex="${h(uid)}" data-d="1">↓ Nach unten</button>
      <button class="btn wide" data-action="ex-swap" data-ex="${h(uid)}">Übung tauschen</button>
      <label class="field row2"><span>Pause (Sek.)</span><input data-field="ex-rest" data-ex="${h(uid)}" inputmode="numeric" value="${ex.rest ?? ''}" placeholder="${S.settings.rest}"></label>
      <button class="btn danger-ghost wide" data-action="ex-remove" data-ex="${h(uid)}">Aus Training entfernen</button>
      <button class="btn ghost wide" data-action="close">Schließen</button>`);
  },
  'ex-move': (el) => {
    const list = S.active.exercises;
    const i = list.findIndex((e) => e.uid === el.dataset.ex);
    const j = i + +el.dataset.d;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    save();
    closeModal();
    rerender();
  },
  'ex-remove': (el) => {
    const list = S.active.exercises;
    const i = list.findIndex((e) => e.uid === el.dataset.ex);
    if (i < 0) return closeModal();
    const [removed] = list.splice(i, 1);
    save();
    closeModal();
    rerender();
    toast(`${removed.name} entfernt.`, () => {
      list.splice(i, 0, removed);
      save();
      rerender();
    });
  },
  'ex-swap': (el) => {
    const old = findEx(el.dataset.ex);
    if (!old) return closeModal();
    const swap = () => pickerModal((ex) => {
      const list = S.active.exercises;
      const i = list.indexOf(old);
      if (i < 0) return;
      const fresh = L.newSessionExercise(ex, { sets: old.sets.length, repMin: old.repMin, repMax: old.repMax, rest: old.rest }, S);
      list.splice(i, 1, fresh);
      save();
      rerender();
      toast(`${old.name} → ${ex.name}`, () => {
        const k = list.indexOf(fresh);
        if (k >= 0) list.splice(k, 1, old);
        save();
        rerender();
      });
    });
    if (old.sets.some((s) => s.done)) confirmModal(`${old.name} hat schon abgehakte Sätze. Trotzdem tauschen?`, 'Tauschen', swap);
    else swap();
  },
  'add-ex-session': () =>
    pickerModal((ex) => {
      S.active.exercises.push(L.newSessionExercise(ex, null, S));
      save();
      rerender();
    }),
  pick: (el) => {
    const ex = exById(el.dataset.id);
    const cb = ui.modal?.onPick;
    closeModal();
    if (ex && cb) cb(ex);
  },
  'new-exercise': () => {
    const cb = ui.modal?.onPick;
    exerciseEditModal(null, (ex) => cb?.(ex));
  },
  'ex-save': () => {
    const { ex, onSaved } = ui.modal.exEdit;
    const name = $('#ex-name').value.trim();
    if (!name) return toast('Bitte einen Namen eingeben.');
    if (S.exercises.some((e) => e.name.toLowerCase() === name.toLowerCase() && e !== ex)) return toast('Eine Übung mit diesem Namen gibt es schon.');
    const data = { name, muscle: $('#ex-muscle').value, type: $('#ex-type').value };
    let target = ex;
    if (ex) Object.assign(ex, data);
    else S.exercises.push((target = { id: L.uid(), ...data }));
    save();
    closeModal();
    onSaved?.(target);
    rerender();
  },
  'ex-delete': () => {
    const { ex } = ui.modal.exEdit;
    if (S.plan.days.some((d) => d.items.some((it) => it.exId === ex.id))) return toast('Übung ist noch im Plan – dort zuerst entfernen.');
    if (S.active?.exercises.some((e) => e.exId === ex.id)) return toast('Übung ist im laufenden Training.');
    const i = S.exercises.indexOf(ex);
    S.exercises.splice(i, 1);
    save();
    libraryModal();
    toast(`${ex.name} gelöscht (Verlauf bleibt).`, () => {
      S.exercises.splice(i, 0, ex);
      save();
      if (ui.modal) refreshModal();
    });
  },
  finish: () => {
    const open = S.active.exercises.reduce((a, e) => a + e.sets.filter((s) => !s.done).length, 0);
    if (open) confirmModal(`${open} Satz/Sätze nicht abgehakt – werden nicht gespeichert. Training beenden?`, 'Beenden', () => finishSession());
    else finishSession();
  },
  discard: () =>
    confirmModal('Training verwerfen? Alle Eingaben dieses Trainings gehen verloren.', 'Verwerfen', () => {
      const old = S.active;
      S.active = null;
      save();
      render();
      toast('Training verworfen.', () => {
        if (S.active) return toast('Es läuft schon ein neues Training.');
        S.active = old;
        save();
        render();
      });
    }),
  'timer-add': (el) => {
    const t = S.active?.timer;
    if (!t) return;
    const d = +el.dataset.d;
    t.end = Math.max(Date.now(), t.end) + d * 1000;
    t.total = Math.max(1, t.total + d);
    t.rang = false;
    save();
    tick();
  },
  'timer-stop': () => {
    if (S.active) S.active.timer = null;
    save();
    tick();
  },
  close: () => closeModal(),
  'confirm-ok': async () => {
    const fn = ui.modal?.onOk;
    closeModal();
    await fn?.();
  },
  'session-open': (el) => sessionModal(el.dataset.id),
  'session-edit': (el) => sessionModal(el.dataset.id, el.dataset.on === '1'),
  'session-delete': (el) => {
    const id = el.dataset.id;
    confirmModal('Dieses Training endgültig löschen?', 'Löschen', () => {
      const i = S.sessions.findIndex((s) => s.id === id);
      if (i < 0) return;
      const [removed] = S.sessions.splice(i, 1);
      save();
      render();
      toast('Training gelöscht.', () => {
        S.sessions.push(removed);
        save();
        render();
      });
    });
  },
  'hset-del': (el) => {
    const s = S.sessions.find((x) => x.id === ui.modal.sessionId);
    const ex = s.exercises[+el.dataset.ex];
    ex.sets.splice(+el.dataset.set, 1);
    if (!ex.sets.length) s.exercises.splice(+el.dataset.ex, 1);
    if (!s.exercises.length) {
      S.sessions.splice(S.sessions.indexOf(s), 1);
      closeModal();
      toast('Letzter Satz gelöscht – Training entfernt.');
    }
    save();
    refreshModal();
    rerender();
  },
  'prog-metric': (el) => {
    ui.progMetric = el.dataset.v;
    rerender();
  },
  'prog-range': (el) => {
    ui.progRange = el.dataset.v;
    rerender();
  },
  'bw-add': () => {
    const v = L.parseNum($('#bw-input').value);
    if (!(v > 20 && v < 400)) return toast('Bitte ein Körpergewicht in kg eingeben.');
    const today = L.isoDate(Date.now());
    S.bodyweight = S.bodyweight.filter((b) => L.isoDate(b.date) !== today);
    S.bodyweight.push({ date: Date.now(), w: v });
    save();
    rerender();
  },
  'bw-undo': () => {
    S.bodyweight.sort((a, b) => a.date - b.date);
    const removed = S.bodyweight.pop();
    save();
    rerender();
    toast('Eintrag gelöscht.', () => {
      S.bodyweight.push(removed);
      save();
      rerender();
    });
  },
  'day-add': () => {
    S.plan.days.push({ id: L.uid(), name: `Training ${String.fromCharCode(65 + (S.plan.days.length % 26))}`, items: [] });
    save();
    rerender();
    dayModal(S.plan.days.length - 1);
  },
  'day-edit': (el) => dayModal(+el.dataset.i),
  'day-move': (el) => {
    const i = +el.dataset.i;
    const j = i + +el.dataset.d;
    const d = S.plan.days;
    if (j < 0 || j >= d.length) return;
    [d[i], d[j]] = [d[j], d[i]];
    save();
    rerender();
  },
  'day-del': () => {
    const i = ui.modal.dayIndex;
    confirmModal(`„${S.plan.days[i].name}“ aus dem Plan löschen? (Verlauf bleibt)`, 'Löschen', () => {
      const [removed] = S.plan.days.splice(i, 1);
      save();
      rerender();
      toast('Trainingstag gelöscht.', () => {
        S.plan.days.splice(i, 0, removed);
        save();
        rerender();
      });
    });
  },
  'item-add': () => {
    const i = ui.modal.dayIndex;
    pickerModal((ex) => {
      const t = ex.type === 'time';
      S.plan.days[i].items.push({ exId: ex.id, sets: 3, repMin: t ? 30 : 8, repMax: t ? 60 : 12, rest: null });
      save();
      rerender();
      dayModal(i);
    });
  },
  'item-move': (el) => {
    const items = S.plan.days[ui.modal.dayIndex].items;
    const k = +el.dataset.k;
    const j = k + +el.dataset.d;
    if (j < 0 || j >= items.length) return;
    [items[k], items[j]] = [items[j], items[k]];
    save();
    refreshModal();
    rerender();
  },
  'item-del': (el) => {
    S.plan.days[ui.modal.dayIndex].items.splice(+el.dataset.k, 1);
    save();
    refreshModal();
    rerender();
  },
  template: (el) => {
    const t = el.dataset.t;
    confirmModal(`Plan durch Vorlage „${t}“ ersetzen?`, 'Ersetzen', async () => {
      await snapshot(S, 'Vorlage');
      S.plan = L.planFromTemplate(t);
      save();
      rerender();
      toast('Vorlage geladen. Tipp: „Stand vor letzter Aktion wiederherstellen“ in den Einstellungen macht das rückgängig.');
    });
  },
  'lib-open': () => libraryModal(),
  'lib-edit': (el) => exerciseEditModal(exById(el.dataset.id), () => libraryModal()),
  'lib-new': () => {
    ui.pickerQuery = '';
    exerciseEditModal(null, () => libraryModal());
  },
  export: () => doExport(),
  csv: async () => {
    if (!S.sessions.length) return toast('Noch keine Trainings zum Exportieren.');
    await shareOrDownload(`gym-tracker-${L.isoDate(Date.now())}.csv`, L.toCSV(S.sessions), 'text/csv');
  },
  restore: async () => {
    const b = await loadBackup();
    if (!b) return toast('Keine Sicherung vorhanden.');
    confirmModal(`Stand vom ${dateLong(b.at)}, ${timeShort(b.at)} (vor: ${b.reason}) wiederherstellen? Der aktuelle Stand wird dabei getauscht.`, 'Wiederherstellen', async () => {
      try {
        const restored = L.validateState(b.data);
        await snapshot(S, 'Wiederherstellung');
        S = restored;
        save();
        render();
        toast('Wiederhergestellt.');
      } catch (e) {
        toast(e.message);
      }
    });
  },
  reset: () =>
    confirmModal('Wirklich ALLE Daten löschen (Trainings, Plan, Einstellungen)? Vorher Backup exportieren!', 'Alles löschen', async () => {
      await snapshot(S, 'Alles löschen');
      S = L.defaultState();
      save();
      render();
      toast('Alles gelöscht. Wiederherstellen ist in den Einstellungen noch möglich.');
    }),
};

// Texteingaben: Zustand sofort aktualisieren, ohne neu zu zeichnen (Fokus bleibt).
function onInput(e) {
  const el = e.target;
  const f = el.dataset.field;
  if (!f) return;
  if (f === 'picker-q') {
    ui.pickerQuery = el.value;
    $('#picker-list').innerHTML = pickerList();
    return;
  }
  if (f === 'note') {
    S.active.note = el.value;
  } else if (f === 'w' || f === 'r') {
    const ex = findEx(el.dataset.ex);
    const s = ex.sets[+el.dataset.set];
    const v = el.value.trim() === '' ? null : f === 'w' ? L.parseNum(el.value, ex.type === 'bodyweight') : L.parseNum(el.value);
    el.classList.toggle('bad', el.value.trim() !== '' && v == null);
    s[f] = f === 'r' && v != null ? Math.round(v) : v;
    if (s.done && !L.isDoneSet(s)) s.done = false;
    S.active.last = Date.now();
  } else if (f === 'ex-rest') {
    findEx(el.dataset.ex).rest = L.parseNum(el.value) || null;
  } else if (f === 'hw' || f === 'hr') {
    const s = S.sessions.find((x) => x.id === ui.modal.sessionId);
    const ex = s.exercises[+el.dataset.ex];
    const v = f === 'hw' ? L.parseNum(el.value, ex.type === 'bodyweight') : L.parseNum(el.value);
    el.classList.toggle('bad', v == null || (f === 'hr' && !(v > 0)));
    if (v == null || (f === 'hr' && !(v > 0))) return;
    ex.sets[+el.dataset.set][f === 'hw' ? 'w' : 'r'] = f === 'hr' ? Math.round(v) : v;
  } else if (f === 'day-name') {
    S.plan.days[ui.modal.dayIndex].name = el.value.trim() || 'Training';
  } else if (f.startsWith('it-')) {
    const key = f.slice(3);
    const it = S.plan.days[ui.modal.dayIndex].items[+el.dataset.k];
    const v = L.parseNum(el.value);
    if (key === 'rest') it.rest = v ? Math.round(v) : null;
    else if (v != null && v > 0) it[key] = Math.round(v);
    else return el.classList.add('bad');
    el.classList.remove('bad');
  } else return;
  save();
}

function onChange(e) {
  const el = e.target;
  if (el.dataset.change === 'prog-ex') {
    ui.progEx = el.value;
    rerender();
  } else if (el.dataset.change === 'import') {
    const file = el.files?.[0];
    el.value = '';
    if (file) doImport(file);
  } else if (el.dataset.setting) {
    const k = el.dataset.setting;
    if (el.type === 'checkbox') S.settings[k] = el.checked;
    else if (k === 'theme') S.settings.theme = el.value;
    else {
      const v = L.parseNum(el.value);
      if (!(v > 0)) {
        toast('Bitte eine positive Zahl eingeben.');
        return rerender();
      }
      S.settings[k] = k === 'rest' ? Math.round(v) : v;
    }
    save();
    rerender();
  } else if (el.dataset.field?.startsWith('it-') || el.dataset.field === 'day-name') {
    // Erst nach der Eingabe (nicht beim Tippen) Min/Max ordnen
    const it = el.dataset.k != null && S.plan.days[ui.modal?.dayIndex]?.items[+el.dataset.k];
    if (it && it.repMin > it.repMax) {
      [it.repMin, it.repMax] = [it.repMax, it.repMin];
      save();
      refreshModal();
    }
    rerender(); // Planübersicht hinter dem Dialog aktualisieren
  } else if (el.dataset.field === 'hw' || el.dataset.field === 'hr') {
    rerender();
  }
}

function onClick(e) {
  unlockAudio();
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = A[el.dataset.action];
  if (fn) {
    e.preventDefault();
    Promise.resolve()
      .then(() => fn(el))
      .catch((err) => {
        console.error(err);
        toast(`Fehler: ${err.message}`);
      });
  }
}

// ---------- Service Worker ----------
function setupSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker
    .register('./sw.js')
    .then((reg) => {
      const offer = (w) => {
        const b = $('#update');
        b.hidden = false;
        b.onclick = () => {
          ui.updating = true;
          w.postMessage('skipWaiting');
        };
      };
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
        });
      });
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reg.update().catch(() => {}));
    })
    .catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Nur nach Tipp auf das Update-Banner neu laden – nicht beim ersten clients.claim()
    if (reloaded || !ui.updating) return;
    reloaded = true;
    location.reload();
  });
}

// ---------- Start ----------
async function init() {
  try {
    ui.bannerHidden = sessionStorage.getItem('gymtracker-banner') === '1';
  } catch {
    /* egal */
  }
  try {
    const res = await loadState();
    S = res.state;
  } catch (e) {
    S = L.defaultState();
    // Beschädigte Daten sind gesichert → neu anfangen ist ok. Bei Lesefehlern nichts überschreiben.
    if (!e.corrupt) ui.noSave = true;
    setTimeout(() => toast(e.message), 300);
  }
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
  $('#modal').addEventListener('close', () => {
    if (!$('#modal').open) ui.modal = null; // close feuert asynchron, evtl. nach erneutem Öffnen
  });
  $('#modal').addEventListener('click', (e) => e.target.id === 'modal' && closeModal()); // Klick auf Hintergrund
  // iOS feuert beforeunload selten → beim Verlassen sofort sichern.
  const flush = () => S && !ui.noSave && saveState(S).catch(() => {});
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
    else {
      tick();
      updateWakeLock();
    }
  });
  render();
  setInterval(tick, 250);
  setupSW();
  requestPersist().then((ok) => {
    const el = $('#persist');
    if (el) el.textContent = ok ? 'Speicher dauerhaft' : 'Speicher nicht garantiert – regelmäßig Backup machen';
  });
  if (S.active && L.isStale(S.active)) {
    const a = S.active;
    openModal(() => `<h2>Offenes Training</h2>
      <p>„${h(a.dayName)}“ vom ${dateLong(a.start)}, ${timeShort(a.start)} wurde nicht beendet.</p>
      <button class="btn primary wide" data-action="stale-finish">Beenden (Ende = letzte Eingabe)</button>
      <button class="btn wide" data-action="close">Weitermachen</button>
      <button class="btn danger-ghost wide" data-action="discard">Verwerfen</button>`);
  }
}
A['stale-finish'] = () => {
  closeModal();
  finishSession(S.active.last ?? S.active.start);
};

init();
