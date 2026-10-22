// Reine Logik ohne DOM – testbar mit `node --test`.
// Gewichte werden immer in kg gespeichert.

export const SCHEMA_VERSION = 1;

export const MUSCLES = ['Brust', 'Rücken', 'Schultern', 'Bizeps', 'Trizeps', 'Beine', 'Gesäß', 'Waden', 'Bauch', 'Sonstiges'];

/** Übungstypen: Gewicht × Wdh, Körpergewicht ± Zusatz-kg (negativ = assistiert), Zeit (Sekunden statt Wdh). */
export const TYPES = { weight: 'Gewicht × Wdh', bodyweight: 'Körpergewicht ± kg', time: 'Zeit (Sek.)' };

const LIBRARY = [
  ['bankdruecken', 'Bankdrücken', 'Brust'],
  ['schraegbank-kh', 'Schrägbankdrücken (KH)', 'Brust'],
  ['brustpresse', 'Brustpresse', 'Brust'],
  ['butterfly', 'Butterfly', 'Brust'],
  ['dips', 'Dips', 'Trizeps', 'bodyweight'],
  ['klimmzuege', 'Klimmzüge', 'Rücken', 'bodyweight'],
  ['latzug', 'Latzug', 'Rücken'],
  ['rudern-lh', 'Langhantelrudern', 'Rücken'],
  ['rudern-kabel', 'Kabelrudern', 'Rücken'],
  ['kreuzheben', 'Kreuzheben', 'Rücken'],
  ['face-pulls', 'Face Pulls', 'Schultern'],
  ['schulterdruecken', 'Schulterdrücken', 'Schultern'],
  ['seitheben', 'Seitheben', 'Schultern'],
  ['bizeps-curls', 'Bizeps-Curls', 'Bizeps'],
  ['hammer-curls', 'Hammer-Curls', 'Bizeps'],
  ['trizeps-kabel', 'Trizepsdrücken am Kabel', 'Trizeps'],
  ['frenchpress', 'French Press', 'Trizeps'],
  ['kniebeuge', 'Kniebeuge', 'Beine'],
  ['beinpresse', 'Beinpresse', 'Beine'],
  ['rum-kreuzheben', 'Rumänisches Kreuzheben', 'Beine'],
  ['beinstrecker', 'Beinstrecker', 'Beine'],
  ['beinbeuger', 'Beinbeuger', 'Beine'],
  ['ausfallschritte', 'Ausfallschritte', 'Beine'],
  ['hip-thrust', 'Hip Thrust', 'Gesäß'],
  ['wadenheben', 'Wadenheben', 'Waden'],
  ['crunches', 'Crunches am Kabel', 'Bauch'],
  ['beinheben', 'Hängendes Beinheben', 'Bauch', 'bodyweight'],
  ['plank', 'Plank', 'Bauch', 'time'],
];

export function defaultExercises() {
  return LIBRARY.map(([id, name, muscle, type = 'weight']) => ({ id, name, muscle, type }));
}

const item = (exId, sets = 3, repMin = 8, repMax = 12, rest = null) => ({ exId, sets, repMin, repMax, rest });

export const TEMPLATES = {
  'Ganzkörper A/B': [
    ['Ganzkörper A', [item('kniebeuge', 3, 5, 8, 180), item('bankdruecken', 3, 5, 8, 180), item('rudern-lh', 3, 6, 10), item('seitheben', 3, 10, 15, 90), item('crunches', 3, 10, 15, 60)]],
    ['Ganzkörper B', [item('kreuzheben', 3, 4, 6, 180), item('schulterdruecken', 3, 6, 10), item('latzug', 3, 8, 12), item('beinpresse', 3, 8, 12), item('bizeps-curls', 2, 10, 12, 60)]],
  ],
  'Oberkörper/Unterkörper': [
    ['Oberkörper', [item('bankdruecken', 3, 5, 8, 180), item('rudern-lh', 3, 6, 10), item('schulterdruecken', 3, 8, 12), item('latzug', 3, 8, 12), item('bizeps-curls', 2, 10, 12, 60), item('trizeps-kabel', 2, 10, 12, 60)]],
    ['Unterkörper', [item('kniebeuge', 3, 5, 8, 180), item('rum-kreuzheben', 3, 6, 10), item('beinpresse', 3, 10, 12), item('beinbeuger', 3, 10, 12, 90), item('wadenheben', 3, 10, 15, 60)]],
  ],
  'Push/Pull/Beine': [
    ['Push', [item('bankdruecken', 3, 5, 8, 180), item('schulterdruecken', 3, 6, 10), item('schraegbank-kh', 3, 8, 12), item('seitheben', 3, 12, 15, 60), item('trizeps-kabel', 3, 10, 12, 60)]],
    ['Pull', [item('klimmzuege', 3, 5, 10, 150), item('rudern-lh', 3, 6, 10), item('rudern-kabel', 3, 10, 12), item('face-pulls', 3, 12, 15, 60), item('bizeps-curls', 3, 10, 12, 60)]],
    ['Beine', [item('kniebeuge', 3, 5, 8, 180), item('rum-kreuzheben', 3, 6, 10, 150), item('beinpresse', 3, 10, 12), item('beinbeuger', 3, 10, 12, 90), item('wadenheben', 4, 10, 15, 60)]],
  ],
};

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function planFromTemplate(name) {
  const t = TEMPLATES[name];
  if (!t) throw new Error(`Unbekannte Vorlage: ${name}`);
  return { days: t.map(([dayName, items]) => ({ id: uid(), name: dayName, items: items.map((i) => ({ ...i })) })) };
}

export function defaultSettings() {
  return { step: 2.5, rest: 120, sound: true, wakeLock: true, theme: 'auto', lastExport: null, sessionsSinceExport: 0 };
}

export function defaultState() {
  return {
    schema: SCHEMA_VERSION,
    settings: defaultSettings(),
    exercises: defaultExercises(),
    plan: planFromTemplate('Ganzkörper A/B'),
    sessions: [],
    bodyweight: [],
    active: null,
  };
}

/** "82,5" → 82.5; leer/ungültig → null; negativ nur mit allowNeg (assistierte Übungen). */
export function parseNum(v, allowNeg = false) {
  if (typeof v === 'number') return Number.isFinite(v) && (allowNeg || v >= 0) ? v : null;
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(',', '.');
  if (!/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || (!allowNeg && n < 0)) return null;
  return n === 0 ? 0 : n; // -0 → 0
}

export function fmtNum(n) {
  if (n == null || !Number.isFinite(n)) return '';
  return (Math.round(n * 100) / 100).toString().replace('.', ',');
}

/** Satz als Text je Übungstyp: "80×8", "+10×8", "8 Wdh", "45 s", "+5 kg · 45 s". */
export function fmtSet(type, s) {
  if (type === 'time') return `${s.w ? `${s.w > 0 ? '+' : ''}${fmtNum(s.w)} kg · ` : ''}${s.r} s`;
  if (type === 'bodyweight') return s.w ? `${s.w > 0 ? '+' : ''}${fmtNum(s.w)}×${s.r}` : `${s.r} Wdh`;
  return `${fmtNum(s.w)}×${s.r}`;
}

/** Erledigt = abgehakt, Wdh/Sek. > 0, Gewicht eine Zahl (0 oder negativ erlaubt). */
export function isDoneSet(s) {
  return !!s && s.done === true && typeof s.r === 'number' && s.r > 0 && typeof s.w === 'number' && Number.isFinite(s.w);
}

/** Arbeitssatz = erledigt und kein Aufwärmsatz; nur diese zählen für Volumen, Rekorde, Statistik. */
export function isValidSet(s) {
  return isDoneSet(s) && !s.warm;
}

/** Geschätztes 1RM nach Epley; bei 1 Wdh = Gewicht. */
export function e1rm(w, r) {
  if (!(w > 0) || !(r > 0)) return 0;
  if (r === 1) return w;
  return w * (1 + r / 30);
}

export function exerciseVolume(ex) {
  if (ex.type === 'time') return 0;
  return ex.sets.filter(isValidSet).reduce((a, s) => a + Math.max(0, s.w) * s.r, 0);
}

export function sessionVolume(session) {
  return session.exercises.reduce((a, ex) => a + exerciseVolume(ex), 0);
}

export function sessionSetCount(session) {
  return session.exercises.reduce((a, ex) => a + ex.sets.filter(isValidSet).length, 0);
}

/** Neueste zuerst. */
export function sortedSessions(sessions) {
  return [...sessions].sort((a, b) => b.start - a.start);
}

/** Arbeitssätze der Übung im letzten Training (optional nur vor Zeitpunkt). */
export function lastPerformance(sessions, exId, before = Infinity) {
  for (const s of sortedSessions(sessions)) {
    if (s.start >= before) continue;
    const ex = s.exercises.find((e) => e.exId === exId);
    if (!ex) continue;
    const sets = ex.sets.filter(isValidSet);
    if (sets.length) return { date: s.start, sets };
  }
  return null;
}

export function roundToStep(w, step) {
  if (!(step > 0)) return w;
  return Math.round(Math.round(w / step) * step * 1000) / 1000;
}

/**
 * Vorschlag (Platzhalter tw/tr) für die Sätze einer Plan-Übung.
 * Steigerung, wenn im letzten Training alle geplanten Sätze das obere Wdh-Ende erreicht haben.
 */
export function suggestSets(planItem, last, step) {
  if (!(step > 0)) step = 2.5;
  const count = Math.min(50, Math.max(1, planItem.sets | 0)); // Obergrenze: Tippfehler im Plan (z. B. 999999999) darf die App nicht einfrieren
  const type = planItem.type || 'weight';
  if (!last) {
    const tw = type === 'weight' ? null : 0;
    return { progress: false, sets: Array.from({ length: count }, () => ({ w: null, r: null, done: false, tw, tr: planItem.repMax ?? null })) };
  }
  const reachedTop =
    planItem.repMax > 0 && last.sets.length >= count && last.sets.slice(0, count).every((s) => s.r >= planItem.repMax);
  // Zeit- und Körpergewichtsübungen ohne Zusatzgewicht steigern über Wdh/Sek., nicht über Gewicht.
  const byWeight = type === 'weight' || last.sets.some((s) => s.w !== 0);
  const sets = Array.from({ length: count }, (_, i) => {
    const ref = last.sets[Math.min(i, last.sets.length - 1)];
    let w = ref.w;
    let r = ref.r;
    if (reachedTop) {
      if (type === 'time') r = ref.r + 5;
      else if (byWeight && w > 0) {
        w = roundToStep(w + step, step);
        r = planItem.repMin ?? ref.r;
      } else if (byWeight && w < 0) {
        w = Math.min(0, roundToStep(w + step, step));
        r = planItem.repMin ?? ref.r;
      } else r = ref.r + 1;
    }
    return { w: null, r: null, done: false, tw: w, tr: r };
  });
  return { progress: reachedTop, sets };
}

/** Index des Trainingstags, der als nächstes dran ist (-1 = kein Plan). */
export function nextDayIndex(plan, sessions) {
  const days = plan?.days ?? [];
  if (!days.length) return -1;
  const last = sortedSessions(sessions).find((s) => days.some((d) => d.id === s.dayId));
  if (!last) return 0;
  const i = days.findIndex((d) => d.id === last.dayId);
  return (i + 1) % days.length;
}

/** Neues aktives Training aus Plantag (oder leer, wenn day == null). */
export function createSession(day, state, now = Date.now()) {
  const exById = new Map(state.exercises.map((e) => [e.id, e]));
  const exercises = (day?.items ?? [])
    .filter((it) => exById.has(it.exId))
    .map((it) => newSessionExercise(exById.get(it.exId), it, state, now));
  return { id: uid(), dayId: day?.id ?? null, dayName: day?.name ?? 'Freies Training', start: now, end: null, last: now, note: '', exercises };
}

export function newSessionExercise(ex, planItem, state, now = Date.now()) {
  const type = ex.type || 'weight';
  const pi = planItem ?? (type === 'time' ? { sets: 3, repMin: 30, repMax: 60, rest: null } : { sets: 3, repMin: 8, repMax: 12, rest: null });
  const last = lastPerformance(state.sessions, ex.id, now);
  const sug = suggestSets({ ...pi, type }, last, state.settings.step);
  return {
    uid: uid(),
    exId: ex.id,
    name: ex.name,
    muscle: ex.muscle,
    type,
    repMin: pi.repMin ?? null,
    repMax: pi.repMax ?? null,
    rest: pi.rest ?? null,
    progress: sug.progress,
    lastSets: last?.sets ?? null,
    sets: sug.sets,
  };
}

/** Übernimmt Platzhalter (tw/tr) als echte Werte, wo das Feld leer ist. */
export function fillFromTarget(set) {
  return { ...set, w: set.w ?? set.tw ?? null, r: set.r ?? set.tr ?? null };
}

/** Bereinigt ein beendetes Training: nur erledigte Sätze; Übungen ohne Arbeitssatz fallen weg. */
export function finalizeSession(session, end = Date.now()) {
  const exercises = session.exercises
    .map((ex) => ({
      exId: ex.exId,
      name: ex.name,
      muscle: ex.muscle,
      type: ex.type || 'weight',
      sets: ex.sets.filter(isDoneSet).map(({ w, r, warm }) => (warm ? { w, r, done: true, warm: true } : { w, r, done: true })),
    }))
    .filter((ex) => ex.sets.some((x) => !x.warm));
  return { id: session.id, dayId: session.dayId, dayName: session.dayName, start: session.start, end, note: session.note || '', exercises };
}

/** Training gilt als vergessen, wenn seit der letzten Eingabe mehr als `hours` vergangen sind. */
export function isStale(session, now = Date.now(), hours = 6) {
  return !!session && now - (session.last ?? session.start) > hours * 3600e3;
}

/** Verlauf pro Training für eine Übung (älteste zuerst). */
export function exerciseHistory(sessions, exId) {
  const out = [];
  for (const s of [...sessions].sort((a, b) => a.start - b.start)) {
    const ex = s.exercises.find((e) => e.exId === exId);
    if (!ex) continue;
    const sets = ex.sets.filter(isValidSet);
    if (!sets.length) continue;
    const time = ex.type === 'time';
    out.push({
      date: s.start,
      e1rm: time ? 0 : Math.max(...sets.map((x) => e1rm(x.w, x.r))),
      top: Math.max(...sets.map((x) => x.w)),
      volume: time ? 0 : sets.reduce((a, x) => a + Math.max(0, x.w) * x.r, 0),
      reps: Math.max(...sets.map((x) => x.r)),
    });
  }
  return out;
}

export function records(sessions, exId) {
  const h = exerciseHistory(sessions, exId);
  if (!h.length) return null;
  const best = (k) => h.reduce((a, b) => (b[k] > a[k] ? b : a));
  return { e1rm: best('e1rm'), top: best('top'), volume: best('volume'), reps: best('reps') };
}

/** Neue Rekorde eines Trainings gegenüber allen früheren. */
export function newRecords(session, previous) {
  const out = [];
  for (const ex of session.exercises) {
    const sets = ex.sets.filter(isValidSet);
    if (!sets.length) continue;
    const before = records(previous.filter((p) => p.start < session.start), ex.exId);
    if (!before) continue;
    const top = Math.max(...sets.map((x) => x.w));
    const reps = Math.max(...sets.map((x) => x.r));
    const best = ex.type === 'time' ? 0 : Math.max(...sets.map((x) => e1rm(x.w, x.r)));
    if (ex.type === 'time') {
      if (reps > before.reps.reps) out.push({ name: ex.name, kind: 'Zeit', value: reps, unit: 's' });
    } else if (top > before.top.top && top > 0) out.push({ name: ex.name, kind: 'Gewicht', value: top, unit: 'kg' });
    else if (best > before.e1rm.e1rm + 1e-9) out.push({ name: ex.name, kind: '1RM (geschätzt)', value: best, unit: 'kg' });
    else if (best === 0 && reps > before.reps.reps) out.push({ name: ex.name, kind: 'Wdh', value: reps, unit: '' });
  }
  return out;
}

/** Montag 00:00 der Woche (lokal). */
export function weekStart(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/** Arbeitssätze je Muskelgruppe in der Woche von `ts`. */
export function weeklyMuscleSets(sessions, ts = Date.now()) {
  const ws = weekStart(ts);
  const out = Object.create(null); // Muskelnamen aus Importen nie als Prototyp-Schlüssel
  for (const s of sessions) {
    if (weekStart(s.start) !== ws) continue;
    for (const ex of s.exercises) {
      const n = ex.sets.filter(isValidSet).length;
      const m = ex.muscle || 'Sonstiges';
      if (n) out[m] = (out[m] || 0) + n;
    }
  }
  return { ...out };
}

/** Anzahl Trainings je Woche der letzten n Wochen (älteste zuerst). */
export function weeklyCounts(sessions, weeks = 8, now = Date.now()) {
  const starts = [];
  let t = weekStart(now);
  for (let i = 0; i < weeks; i++) {
    starts.unshift(t);
    t = weekStart(t - 864e5);
  }
  return starts.map((ws) => ({ week: ws, count: sessions.filter((s) => weekStart(s.start) === ws).length }));
}

export function filterRange(points, range, now = Date.now()) {
  const days = { '1M': 31, '3M': 92, '1J': 366 }[range];
  if (!days) return points;
  const from = now - days * 864e5;
  return points.filter((p) => p.date >= from);
}

/** Text, der in Excel als Formel gelesen würde, mit ' entschärfen. */
const safeText = (v) => (/^[=+\-@\t\r]/.test(String(v ?? '')) ? `'${v}` : v ?? '');

function csvCell(v) {
  const s = String(v ?? '');
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const pad = (n) => String(n).padStart(2, '0');

export function isoDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** CSV (Semikolon, Dezimalkomma, BOM) für Excel/Numbers. */
export function toCSV(sessions) {
  const rows = [['Datum', 'Uhrzeit', 'Training', 'Übung', 'Muskel', 'Satz', 'Aufwärmen', 'Gewicht (kg)', 'Wdh/Sek.', 'Notiz']];
  for (const s of [...sessions].sort((a, b) => a.start - b.start)) {
    const d = new Date(s.start);
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    for (const ex of s.exercises) {
      ex.sets.filter(isDoneSet).forEach((x, i) =>
        rows.push([isoDate(s.start), time, safeText(s.dayName), safeText(ex.name), safeText(ex.muscle), i + 1, x.warm ? 'ja' : '', fmtNum(x.w), x.r, safeText(s.note)]),
      );
    }
  }
  return '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
}

/** Migrationen: Index = Ausgangsversion; jede Funktion hebt den Zustand um genau eine Version an. */
const MIGRATIONS = [
  // 0 → 1: Daten ohne Versionsangabe
  (st) => ({ ...st, schema: 1 }),
];

export function migrate(raw) {
  let st = raw;
  let v = st.schema == null ? 0 : Number(st.schema);
  if (!Number.isInteger(v) || v < 0) throw new Error('Die Daten haben eine ungültige Versionsnummer.');
  while (v < SCHEMA_VERSION) {
    st = MIGRATIONS[v](st);
    v = st.schema;
  }
  return st;
}

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

/**
 * Prüft (importierte oder gespeicherte) Daten, migriert und ergänzt fehlende Felder.
 * Wirft Error mit verständlicher Meldung; verändert `raw` nicht.
 */
export function validateState(input) {
  if (!isObj(input)) throw new Error('Die Datei enthält keine Gym-Tracker-Daten.');
  if (typeof input.schema === 'number' && input.schema > SCHEMA_VERSION) throw new Error('Die Daten stammen aus einer neueren App-Version.');
  const raw = migrate(structuredClone(input));
  const def = defaultState();
  if (!Array.isArray(raw.sessions)) throw new Error('Die Datei enthält keine Trainingsliste („sessions“).');
  const fail = (msg) => {
    throw new Error(msg);
  };
  const ok = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  /** Pflichtzahl: ungültig → Fehler */
  const num = (v, msg, { min = -Infinity, max = Infinity } = {}) => (ok(v, min, max) ? v : fail(msg));
  /** Optionale Zahl: ungültig → Ersatzwert */
  const opt = (v, min, max, fallback = null) => (ok(v, min, max) ? v : fallback);
  const str = (v, fallback) => (typeof v === 'string' ? v : fallback);
  const TS_MAX = 8.64e15; // größter gültiger Date-Wert

  const settings = { ...def.settings, ...(isObj(raw.settings) ? raw.settings : {}) };
  if (!(typeof settings.step === 'number' && settings.step > 0 && settings.step <= 50)) settings.step = def.settings.step;
  if (!(typeof settings.rest === 'number' && settings.rest > 0 && settings.rest <= 3600)) settings.rest = def.settings.rest;
  settings.rest = Math.round(settings.rest);
  for (const k of ['sound', 'wakeLock']) settings[k] = settings[k] !== false;
  if (!['auto', 'light', 'dark'].includes(settings.theme)) settings.theme = 'auto';
  if (!(typeof settings.lastExport === 'number' && Number.isFinite(settings.lastExport))) settings.lastExport = null;
  settings.sessionsSinceExport = Number.isInteger(settings.sessionsSinceExport) && settings.sessionsSinceExport >= 0 ? settings.sessionsSinceExport : 0;

  const exercises = Array.isArray(raw.exercises) ? raw.exercises : def.exercises;
  for (const e of exercises) {
    if (!isObj(e) || typeof e.id !== 'string' || typeof e.name !== 'string') fail('Ungültige Übung in den Daten.');
    if (!MUSCLES.includes(e.muscle)) e.muscle = 'Sonstiges';
    if (!TYPES[e.type]) e.type = 'weight';
  }

  const plan = isObj(raw.plan) && Array.isArray(raw.plan.days) ? raw.plan : def.plan;
  for (const d of plan.days) {
    if (!isObj(d) || typeof d.id !== 'string' || !Array.isArray(d.items)) fail('Ungültiger Trainingstag im Plan.');
    d.name = str(d.name, 'Training');
    // Unbrauchbare Einträge aussortieren statt den ganzen Import abzulehnen
    d.items = d.items.filter((it) => isObj(it) && typeof it.exId === 'string');
    for (const it of d.items) {
      it.sets = Math.round(opt(it.sets, 1, 50, 3));
      it.repMin = Math.round(opt(it.repMin, 0, 10000, 8));
      it.repMax = Math.round(opt(it.repMax, 0, 10000, 12));
      const rest = opt(it.rest, 0, 3600);
      it.rest = rest == null ? null : Math.round(rest);
    }
  }

  const cleanSets = (sets) =>
    sets.filter(isObj).map((x) => {
      const out = { w: opt(x.w, -1000, 10000), r: opt(x.r, 0, 100000), done: x.done === true };
      if (x.warm === true) out.warm = true;
      if (x.tw != null) out.tw = opt(x.tw, -1000, 10000);
      if (x.tr != null) out.tr = opt(x.tr, 0, 100000);
      return out;
    });
  const checkSessionEx = (ex, msg) => {
    if (!isObj(ex) || typeof ex.exId !== 'string' || !Array.isArray(ex.sets)) fail(msg);
    ex.name = str(ex.name, ex.exId);
    if (!MUSCLES.includes(ex.muscle)) ex.muscle = 'Sonstiges';
    if (!TYPES[ex.type]) ex.type = 'weight';
    ex.sets = cleanSets(ex.sets);
  };

  for (const s of raw.sessions) {
    if (!isObj(s) || !Array.isArray(s.exercises)) fail('Ungültiges Training in den Daten.');
    num(s.start, 'Ungültiges Training in den Daten (Startzeit).', { min: 0, max: TS_MAX });
    s.end = opt(s.end, s.start, TS_MAX, s.start);
    if (typeof s.id !== 'string') s.id = uid();
    s.dayId = typeof s.dayId === 'string' ? s.dayId : null;
    s.dayName = str(s.dayName, 'Training');
    s.note = str(s.note, '');
    for (const ex of s.exercises) checkSessionEx(ex, 'Ungültige Übung in einem Training.');
  }

  let active = isObj(raw.active) && Array.isArray(raw.active.exercises) ? raw.active : null;
  if (active) {
    try {
      num(active.start, 'Start', { min: 0, max: TS_MAX });
      if (typeof active.id !== 'string') active.id = uid();
      active.dayId = typeof active.dayId === 'string' ? active.dayId : null;
      active.dayName = str(active.dayName, 'Training');
      active.note = str(active.note, '');
      active.last = opt(active.last, 0, TS_MAX, active.start);
      if (!isObj(active.timer) || !Number.isFinite(active.timer.end) || !(active.timer.total > 0)) active.timer = null;
      for (const ex of active.exercises) {
        checkSessionEx(ex, 'laufendes Training');
        if (typeof ex.uid !== 'string') ex.uid = uid();
        for (const k of ['repMin', 'repMax', 'rest']) ex[k] = opt(ex[k], 0, 100000);
        ex.lastSets = Array.isArray(ex.lastSets) ? cleanSets(ex.lastSets) : null;
      }
    } catch {
      active = null; // laufendes Training ist verzichtbar, der Rest nicht
    }
  }

  const bodyweight = Array.isArray(raw.bodyweight)
    ? raw.bodyweight.filter((x) => isObj(x) && Number.isFinite(x.date) && x.date >= 0 && x.date <= TS_MAX && Number.isFinite(x.w) && x.w > 0)
    : [];

  return { schema: SCHEMA_VERSION, settings, exercises, plan: { days: plan.days }, sessions: raw.sessions, bodyweight, active };
}

export function fmtDuration(ms) {
  const m = Math.max(0, Math.floor(ms / 60000)) || 0; // || 0: NaN → 0
  const h = Math.floor(m / 60);
  return h ? `${h} h ${pad(m % 60)} min` : `${m} min`;
}

export function fmtClock(sec) {
  const s = Math.max(0, Math.ceil(sec)) || 0; // || 0: NaN → 0
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

/** Soll an ein Backup erinnert werden? (nach 7 Tagen oder 5 Trainings ohne Export) */
export function needsBackupReminder(state, now = Date.now()) {
  if (!state.sessions.length) return false;
  const since = state.settings.sessionsSinceExport ?? 0;
  if (since >= 5) return true;
  const ref = state.settings.lastExport ?? Math.min(...state.sessions.map((s) => s.start));
  return since > 0 && now - ref > 7 * 864e5;
}
