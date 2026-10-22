// Tests für js/logic.js – Aufruf: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/logic.js';
import * as C from '../js/charts.js';

const DAY = 864e5;
const set = (w, r, extra = {}) => ({ w, r, done: true, ...extra });
const sess = (start, exercises, extra = {}) => ({ id: L.uid(), dayId: 'd1', dayName: 'A', start, end: start + 3600e3, note: '', exercises, ...extra });
const ex = (exId, sets, extra = {}) => ({ exId, name: exId, muscle: 'Brust', type: 'weight', sets, ...extra });

test('parseNum: Komma, Punkt, leer, Text, negativ', () => {
  assert.equal(L.parseNum('82,5'), 82.5);
  assert.equal(L.parseNum(' 100 '), 100);
  assert.equal(L.parseNum('.5'), 0.5);
  assert.equal(L.parseNum(''), null);
  assert.equal(L.parseNum('abc'), null);
  assert.equal(L.parseNum('1,2,3'), null);
  assert.equal(L.parseNum('-10'), null);
  assert.equal(L.parseNum('-10', true), -10);
  assert.equal(L.parseNum(NaN), null);
  assert.equal(L.parseNum(undefined), null);
});

test('fmtNum nutzt Dezimalkomma und rundet', () => {
  assert.equal(L.fmtNum(82.5), '82,5');
  assert.equal(L.fmtNum(1 / 3), '0,33');
  assert.equal(L.fmtNum(null), '');
});

test('fmtSet je Übungstyp', () => {
  assert.equal(L.fmtSet('weight', set(82.5, 8)), '82,5×8');
  assert.equal(L.fmtSet('bodyweight', set(0, 8)), '8 Wdh');
  assert.equal(L.fmtSet('bodyweight', set(10, 8)), '+10×8');
  assert.equal(L.fmtSet('bodyweight', set(-20, 8)), '-20×8');
  assert.equal(L.fmtSet('time', set(0, 45)), '45 s');
  assert.equal(L.fmtSet('time', set(5, 45)), '+5 kg · 45 s');
});

test('isValidSet:Aufwärmsätze und unvollständige zählen nicht', () => {
  assert.ok(L.isValidSet(set(80, 8)));
  assert.ok(L.isValidSet(set(0, 10)));
  assert.ok(L.isValidSet(set(-20, 6)));
  assert.ok(!L.isValidSet(set(40, 10, { warm: true })));
  assert.ok(L.isDoneSet(set(40, 10, { warm: true })));
  assert.ok(!L.isValidSet({ w: 80, r: 8, done: false }));
  assert.ok(!L.isValidSet(set(80, 0)));
  assert.ok(!L.isValidSet(set(null, 8)));
});

test('e1rm nach Epley', () => {
  assert.equal(L.e1rm(100, 1), 100);
  assert.ok(Math.abs(L.e1rm(100, 10) - 133.333) < 0.01);
  assert.equal(L.e1rm(0, 10), 0);
  assert.equal(L.e1rm(-10, 5), 0);
});

test('Volumen ignoriert Aufwärmen, Zeitübungen und negatives Gewicht', () => {
  const s = sess(0, [ex('a', [set(100, 5), set(50, 10, { warm: true })]), ex('p', [set(0, 60)], { type: 'time' }), ex('k', [set(-20, 8)], { type: 'bodyweight' })]);
  assert.equal(L.sessionVolume(s), 500);
  assert.equal(L.sessionSetCount(s), 3);
});

test('lastPerformance nimmt das neueste Training mit Arbeitssätzen', () => {
  const sessions = [sess(1 * DAY, [ex('a', [set(80, 8)])]), sess(3 * DAY, [ex('a', [set(90, 5)])]), sess(5 * DAY, [ex('a', [set(20, 10, { warm: true })])])];
  assert.equal(L.lastPerformance(sessions, 'a').sets[0].w, 90);
  assert.equal(L.lastPerformance(sessions, 'a', 2 * DAY).sets[0].w, 80);
  assert.equal(L.lastPerformance(sessions, 'x'), null);
});

test('suggestSets: Steigerung, wenn alle Sätze am oberen Ende', () => {
  const item = { sets: 3, repMin: 8, repMax: 12 };
  const top = { sets: [set(80, 12), set(80, 12), set(80, 12)] };
  const r = L.suggestSets(item, top, 2.5);
  assert.equal(r.progress, true);
  assert.deepEqual(r.sets.map((s) => [s.tw, s.tr]), [[82.5, 8], [82.5, 8], [82.5, 8]]);
  assert.ok(r.sets.every((s) => s.w === null && !s.done), 'Vorschläge sind nur Platzhalter');

  const notYet = L.suggestSets(item, { sets: [set(80, 12), set(80, 11), set(80, 10)] }, 2.5);
  assert.equal(notYet.progress, false);
  assert.deepEqual(notYet.sets.map((s) => [s.tw, s.tr]), [[80, 12], [80, 11], [80, 10]]);

  const fewer = L.suggestSets(item, { sets: [set(80, 12)] }, 2.5);
  assert.equal(fewer.progress, false, 'weniger Sätze als geplant → keine Steigerung');
  assert.equal(fewer.sets.length, 3);
});

test('suggestSets: Körpergewicht/Zeit steigern über Wdh bzw. Sekunden', () => {
  const bw = L.suggestSets({ sets: 2, repMin: 5, repMax: 8, type: 'bodyweight' }, { sets: [set(0, 8), set(0, 8)] }, 2.5);
  assert.deepEqual(bw.sets.map((s) => [s.tw, s.tr]), [[0, 9], [0, 9]]);
  const assisted = L.suggestSets({ sets: 1, repMin: 5, repMax: 8, type: 'bodyweight' }, { sets: [set(-20, 8)] }, 2.5);
  assert.deepEqual([assisted.sets[0].tw, assisted.sets[0].tr], [-17.5, 5]);
  const time = L.suggestSets({ sets: 1, repMin: 30, repMax: 60, type: 'time' }, { sets: [set(0, 60)] }, 2.5);
  assert.equal(time.sets[0].tr, 65);
  const fresh = L.suggestSets({ sets: 2, repMin: 8, repMax: 12 }, null, 2.5);
  assert.deepEqual(fresh.sets.map((s) => [s.tw, s.tr]), [[null, 12], [null, 12]]);
});

test('roundToStep vermeidet Fließkomma-Reste', () => {
  assert.equal(L.roundToStep(80 + 2.5, 2.5), 82.5);
  assert.equal(L.roundToStep(10.1 + 1.25, 1.25), 11.25);
  assert.equal(L.roundToStep(7, 0), 7);
});

test('nextDayIndex rotiert und überspringt gelöschte Tage', () => {
  const plan = { days: [{ id: 'd1' }, { id: 'd2' }, { id: 'd3' }] };
  assert.equal(L.nextDayIndex(plan, []), 0);
  assert.equal(L.nextDayIndex(plan, [sess(1, [], { dayId: 'd1' })]), 1);
  assert.equal(L.nextDayIndex(plan, [sess(1, [], { dayId: 'd1' }), sess(2, [], { dayId: 'd3' })]), 0);
  assert.equal(L.nextDayIndex(plan, [sess(1, [], { dayId: 'd2' }), sess(2, [], { dayId: 'weg' })]), 2);
  assert.equal(L.nextDayIndex({ days: [] }, []), -1);
});

test('createSession nutzt Plan, überspringt unbekannte Übungen, füllt Vorschläge', () => {
  const st = L.defaultState();
  st.sessions = [sess(1000, [{ ...ex('kniebeuge', [set(100, 8), set(100, 8), set(100, 8)]), muscle: 'Beine' }])];
  const day = { id: 'x', name: 'Test', items: [{ exId: 'kniebeuge', sets: 3, repMin: 5, repMax: 8, rest: 180 }, { exId: 'gibtsnicht', sets: 3, repMin: 8, repMax: 12 }] };
  const a = L.createSession(day, st, 5000);
  assert.equal(a.exercises.length, 1);
  assert.equal(a.exercises[0].progress, true);
  assert.equal(a.exercises[0].sets[0].tw, 102.5);
  assert.equal(a.exercises[0].rest, 180);
  assert.equal(L.createSession(null, st).dayName, 'Freies Training');
});

test('finalizeSession behält nur erledigte Sätze und Übungen mit Arbeitssatz', () => {
  const a = {
    id: 's', dayId: 'd', dayName: 'A', start: 0, note: 'x',
    exercises: [
      { exId: 'a', name: 'A', muscle: 'Brust', type: 'weight', sets: [set(40, 10, { warm: true, tw: 1 }), set(80, 8, { tw: 80, tr: 8 }), { w: 80, r: null, done: false }] },
      { exId: 'b', name: 'B', muscle: 'Brust', type: 'weight', sets: [set(20, 10, { warm: true })] },
      { exId: 'c', name: 'C', muscle: 'Brust', type: 'weight', sets: [{ w: null, r: null, done: false }] },
    ],
  };
  const f = L.finalizeSession(a, 99);
  assert.equal(f.end, 99);
  assert.equal(f.exercises.length, 1);
  assert.deepEqual(f.exercises[0].sets, [{ w: 40, r: 10, done: true, warm: true }, { w: 80, r: 8, done: true }]);
});

test('Historie, Rekorde und neue Rekorde', () => {
  const s1 = sess(1 * DAY, [ex('a', [set(80, 8), set(80, 8)])]);
  const s2 = sess(2 * DAY, [ex('a', [set(85, 5)])]);
  const h = L.exerciseHistory([s2, s1], 'a');
  assert.deepEqual(h.map((p) => p.top), [80, 85]);
  assert.equal(h[0].volume, 1280);
  const rec = L.records([s1, s2], 'a');
  assert.equal(rec.top.top, 85);
  const s3 = sess(3 * DAY, [ex('a', [set(85, 8)])]);
  const nr = L.newRecords(s3, [s1, s2]);
  assert.equal(nr.length, 1);
  assert.equal(nr[0].kind, '1RM (geschätzt)');
  assert.deepEqual(L.newRecords(sess(4 * DAY, [ex('neu', [set(10, 10)])]), [s1]), [], 'erstes Mal ist kein Rekord');
  const t1 = sess(1 * DAY, [ex('p', [set(0, 60)], { type: 'time' })]);
  const t2 = sess(2 * DAY, [ex('p', [set(0, 75)], { type: 'time' })]);
  assert.equal(L.newRecords(t2, [t1])[0].kind, 'Zeit');
});

test('weekStart ist Montag 00:00 und Wochenstatistik zählt richtig', () => {
  const wed = new Date(2026, 9, 21, 18, 30).getTime(); // Mittwoch
  const mon = new Date(2026, 9, 19).getTime();
  assert.equal(L.weekStart(wed), mon);
  assert.equal(L.weekStart(new Date(2026, 9, 25, 23, 59).getTime()), mon, 'Sonntag gehört zur Woche davor');
  const sessions = [sess(wed, [ex('a', [set(80, 8), set(80, 8)]), { ...ex('b', [set(10, 10)]), muscle: 'Beine' }]), sess(mon - DAY, [ex('a', [set(80, 8)])])];
  assert.deepEqual(L.weeklyMuscleSets(sessions, wed), { Brust: 2, Beine: 1 });
  const wc = L.weeklyCounts(sessions, 2, wed);
  assert.deepEqual(wc.map((w) => w.count), [1, 1]);
});

test('filterRange', () => {
  const now = 400 * DAY;
  const pts = [{ date: now - 10 * DAY }, { date: now - 60 * DAY }, { date: now - 200 * DAY }];
  assert.equal(L.filterRange(pts, '1M', now).length, 1);
  assert.equal(L.filterRange(pts, '3M', now).length, 2);
  assert.equal(L.filterRange(pts, 'Alles', now).length, 3);
});

test('toCSV: Semikolon, Dezimalkomma, Escaping', () => {
  const csv = L.toCSV([sess(new Date(2026, 0, 2, 9, 5).getTime(), [ex('a', [set(82.5, 8)], { name: 'Bank; "eng"' })], { note: 'Zeile1\nZeile2' })]);
  assert.ok(csv.startsWith('﻿Datum;'));
  const line = csv.split('\r\n')[1];
  assert.ok(line.startsWith('2026-01-02;09:05;A;"Bank; ""eng""";Brust;1;;82,5;8;'));
  assert.ok(line.endsWith('"Zeile1\nZeile2"'));
});

test('validateState: gültig, ergänzt Felder, verändert Eingabe nicht', () => {
  const st = L.defaultState();
  st.sessions.push(sess(1, [ex('a', [set(1, 1)], { type: undefined })]));
  delete st.settings.rest;
  const json = JSON.parse(JSON.stringify(st));
  const v = L.validateState(json);
  assert.equal(v.settings.rest, 120);
  assert.equal(v.sessions[0].exercises[0].type, 'weight');
  assert.equal(json.sessions[0].exercises[0].type, undefined, 'Eingabe bleibt unverändert');
});

test('validateState: Fehler mit verständlicher Meldung', () => {
  assert.throws(() => L.validateState(null), /keine Gym-Tracker-Daten/);
  assert.throws(() => L.validateState([]), /keine Gym-Tracker-Daten/);
  assert.throws(() => L.validateState({ foo: 1 }), /Trainingsliste/);
  assert.throws(() => L.validateState({ schema: 99, sessions: [] }), /neueren App-Version/);
  assert.throws(() => L.validateState({ sessions: [{ start: 'gestern' }] }), /Ungültiges Training/);
  assert.throws(() => L.validateState({ sessions: [], exercises: [{ name: 'x' }] }), /Ungültige Übung/);
});

test('migrate hebt Daten ohne Version auf aktuelle Version', () => {
  const v = L.validateState({ sessions: [] });
  assert.equal(v.schema, L.SCHEMA_VERSION);
  assert.ok(v.plan.days.length > 0);
});

test('Vorlagen verweisen nur auf existierende Übungen', () => {
  const ids = new Set(L.defaultExercises().map((e) => e.id));
  for (const name of Object.keys(L.TEMPLATES)) {
    for (const d of L.planFromTemplate(name).days) for (const it of d.items) assert.ok(ids.has(it.exId), `${name}: ${it.exId}`);
  }
  assert.throws(() => L.planFromTemplate('gibtsnicht'));
});

test('isStale und Backup-Erinnerung', () => {
  const now = 100 * DAY;
  assert.ok(L.isStale({ start: now - 7 * 3600e3, last: now - 6.5 * 3600e3 }, now));
  assert.ok(!L.isStale({ start: now - 7 * 3600e3, last: now - 3600e3 }, now));
  assert.ok(!L.isStale(null, now));
  const st = L.defaultState();
  assert.equal(L.needsBackupReminder(st, now), false);
  st.sessions = [sess(now - 2 * DAY, [])];
  st.settings.sessionsSinceExport = 1;
  assert.equal(L.needsBackupReminder(st, now), false);
  st.sessions.push(sess(now - 9 * DAY, []));
  assert.equal(L.needsBackupReminder(st, now), true, 'älter als 7 Tage ohne Export');
  st.settings.lastExport = now - DAY;
  assert.equal(L.needsBackupReminder(st, now), false);
  st.settings.sessionsSinceExport = 5;
  assert.equal(L.needsBackupReminder(st, now), true);
});

test('fmtDuration / fmtClock', () => {
  assert.equal(L.fmtDuration(65 * 60000), '1 h 05 min');
  assert.equal(L.fmtDuration(-5), '0 min');
  assert.equal(L.fmtClock(90), '1:30');
  assert.equal(L.fmtClock(0.2), '0:01');
  assert.equal(L.fmtClock(-3), '0:00');
});

// ---------- Randfälle / Robustheit (QA) ----------
test('suggestSets: leere/kaputte Plan-Eingaben ergeben mindestens 1 Satz, Obergrenze 50', () => {
  assert.equal(L.suggestSets({}, null, 2.5).sets.length, 1);
  assert.equal(L.suggestSets({ sets: 0 }, null, 2.5).sets.length, 1);
  assert.equal(L.suggestSets({ sets: -5 }, null, 2.5).sets.length, 1);
  assert.equal(L.suggestSets({ sets: 999999999 }, null, 2.5).sets.length, 50);
});

test('suggestSets: Gewichtsübung mit Gewicht 0 steigert über Wdh', () => {
  const r = L.suggestSets({ sets: 1, repMin: 8, repMax: 12 }, { sets: [set(0, 12)] }, 2.5);
  assert.equal(r.progress, true);
  assert.deepEqual([r.sets[0].tw, r.sets[0].tr], [0, 13]);
});

test('Leere Arrays: Statistikfunktionen werfen nicht', () => {
  assert.equal(L.sessionVolume({ exercises: [] }), 0);
  assert.equal(L.sessionSetCount({ exercises: [] }), 0);
  assert.deepEqual(L.exerciseHistory([], 'a'), []);
  assert.equal(L.records([], 'a'), null);
  assert.deepEqual(L.newRecords(sess(1, []), []), []);
  assert.deepEqual(L.weeklyMuscleSets([]), {});
  assert.deepEqual(L.weeklyCounts([], 0), []);
  assert.equal(L.weeklyCounts([], 3).length, 3);
  assert.equal(L.lastPerformance([], 'a'), null);
  assert.equal(L.nextDayIndex(undefined, []), -1);
  assert.equal(L.nextDayIndex({}, []), -1);
  assert.equal(L.toCSV([]).split('\r\n').length, 1, 'nur Kopfzeile');
  assert.deepEqual(L.filterRange([], '1M'), []);
});

test('NaN/undefined/falsche Typen in Zahlenfunktionen', () => {
  assert.equal(L.parseNum(Infinity), null);
  assert.equal(L.parseNum(null), null);
  assert.equal(L.parseNum({}), null);
  assert.equal(L.parseNum('1e3'), null);
  assert.equal(L.parseNum('   '), null);
  assert.equal(L.parseNum('0,5'), 0.5);
  assert.equal(L.fmtNum(NaN), '');
  assert.equal(L.fmtNum(undefined), '');
  assert.equal(L.fmtNum(Infinity), '');
  assert.equal(L.fmtNum(-0), '0');
  assert.equal(L.e1rm(NaN, 5), 0);
  assert.equal(L.e1rm(100, NaN), 0);
  assert.equal(L.e1rm(undefined, undefined), 0);
  assert.equal(L.roundToStep(7, NaN), 7);
  assert.equal(L.fmtDuration(NaN), '0 min');
  assert.equal(L.fmtClock(NaN), '0:00');
  assert.ok(!L.isDoneSet(null));
  assert.ok(!L.isDoneSet(set(NaN, 5)));
  assert.ok(!L.isDoneSet(set(Infinity, 5)));
  assert.ok(!L.isDoneSet({ w: 5, r: 5, done: 'true' }), 'done muss exakt true sein');
  assert.ok(!L.isDoneSet({ w: '5', r: 5, done: true }), 'Strings zählen nicht');
  assert.ok(!L.isStale({ start: 0, last: NaN }, 1e12), 'NaN → kein Absturz');
});

test('Sonderzeichen/Umlaute: CSV', () => {
  const csv = L.toCSV([sess(new Date(2026, 5, 1, 7, 0).getTime(), [ex('a', [set(60, 10)], { name: 'Rückenstrecker – Übung ä/ö/ü/ß 💪', muscle: 'Rücken' })], { dayName: 'Tag "Ä"; B', note: '' })]);
  const line = csv.split('\r\n')[1];
  assert.ok(line.includes('"Tag ""Ä""; B"'));
  assert.ok(line.includes('Rückenstrecker – Übung ä/ö/ü/ß 💪;Rücken;1;;60;10;'));
  const w = L.toCSV([sess(1, [ex('a', [set(20, 10, { warm: true }), set(60, 10)])])]).split('\r\n');
  assert.ok(w[1].includes(';1;ja;20;10;'));
  assert.ok(w[2].includes(';2;;60;10;'));
});

test('weekStart: Zeitumstellung ergibt immer Montag 00:00 (aussagekräftig mit TZ=Europe/Berlin)', () => {
  for (const [y, m, d] of [[2026, 2, 28], [2026, 2, 29], [2026, 2, 30], [2026, 9, 24], [2026, 9, 25], [2026, 9, 26], [2026, 11, 31], [2027, 0, 1]]) {
    const ws = new Date(L.weekStart(new Date(y, m, d, 0, 30).getTime()));
    assert.equal(ws.getDay(), 1, `${y}-${m + 1}-${d}`);
    assert.equal(ws.getHours(), 0);
    assert.equal(ws.getMinutes(), 0);
  }
  const wc = L.weeklyCounts([], 60, new Date(2026, 3, 5, 12).getTime());
  assert.equal(new Set(wc.map((w) => w.week)).size, 60, 'keine doppelten/übersprungenen Wochen');
  assert.ok(wc.every((w) => new Date(w.week).getDay() === 1 && new Date(w.week).getHours() === 0));
  assert.ok(wc.every((w, i) => i === 0 || w.week > wc[i - 1].week));
});

test('weekStart mit ungültigem Zeitstempel liefert NaN statt Absturz', () => {
  assert.ok(Number.isNaN(L.weekStart(NaN)));
  assert.deepEqual(L.weeklyMuscleSets([sess(NaN, [ex('a', [set(1, 1)])])]), {});
});

test('Große Datenmengen: 2000 Trainings bleiben schnell und korrekt', () => {
  const sessions = [];
  for (let i = 0; i < 2000; i++) sessions.push(sess(i * DAY, [ex('a', [set(50 + (i % 40), 8), set(50, 8), set(40, 10, { warm: true })])]));
  const t0 = Date.now();
  assert.equal(L.exerciseHistory(sessions, 'a').length, 2000);
  assert.equal(L.records(sessions, 'a').top.top, 89);
  assert.equal(L.lastPerformance(sessions, 'a').date, 1999 * DAY);
  assert.equal(L.toCSV(sessions).split('\r\n').length, 1 + 2000 * 3);
  assert.equal(L.weeklyCounts(sessions, 52, 2000 * DAY).length, 52);
  assert.ok(Date.now() - t0 < 3000, 'sollte deutlich unter 3 s bleiben');
  assert.equal(L.sessionVolume(sess(0, [ex('a', Array.from({ length: 5000 }, () => set(100, 10)))])), 5000 * 1000);
  assert.ok(Number.isFinite(L.e1rm(1e6, 1e6)));
  assert.equal(L.fmtNum(1234567.891), '1234567,89');
});

test('Doppelte Übung im selben Training: Volumen zählt beide, Historie nur die erste (bekannte Einschränkung)', () => {
  const s = sess(1, [ex('a', [set(10, 1)]), ex('a', [set(99, 1)])]);
  assert.equal(L.sessionVolume(s), 109);
  assert.equal(L.exerciseHistory([s], 'a')[0].top, 10);
});

test('createSession/newSessionExercise: kaputte Plan-Einträge', () => {
  const st = L.defaultState();
  assert.equal(L.createSession({ id: 'x', name: 'T', items: [{}] }, st).exercises.length, 0, 'Item ohne exId wird übersprungen');
  assert.equal(L.createSession({ id: 'x', name: 'T', items: [{ exId: 'kniebeuge' }] }, st).exercises[0].sets.length, 1, 'Item ohne sets → 1 Satz');
  assert.equal(L.createSession({ id: 'x', name: 'T' }, st).exercises.length, 0, 'Tag ohne items');
  const free = L.newSessionExercise({ id: 'p', name: 'Plank', muscle: 'Bauch', type: 'time' }, null, st);
  assert.equal(free.sets.length, 3);
  assert.equal(free.sets[0].tr, 60);
  assert.equal(free.sets[0].tw, 0);
  assert.equal(L.newSessionExercise({ id: 'z', name: 'Z', muscle: 'Brust' }, null, st).type, 'weight');
});

test('finalizeSession: kaputte Eingaben', () => {
  const f = L.finalizeSession({ id: 's', dayId: null, dayName: 'X', start: 0, note: null, exercises: [{ exId: 'a', sets: [null, undefined, {}, { w: 1, r: 1, done: true }] }] }, 5);
  assert.equal(f.note, '');
  assert.equal(f.exercises[0].type, 'weight');
  assert.equal(f.exercises[0].sets.length, 1);
  assert.deepEqual(L.finalizeSession({ id: 's', exercises: [] }, 1).exercises, []);
  const t = L.finalizeSession({ id: 's', start: 0, exercises: [{ exId: 'p', type: 'time', sets: [set(0, 45)] }] }, 1);
  assert.equal(t.exercises.length, 1);
});

test('validateState: kaputte Importdaten', () => {
  assert.throws(() => L.validateState({ sessions: [{ start: 1 }] }), /Ungültiges Training/);
  assert.throws(() => L.validateState({ sessions: [{ start: 1, exercises: [{ exId: 'a' }] }] }), /Ungültige Übung in einem Training/);
  assert.throws(() => L.validateState({ sessions: [{ start: 1, exercises: [null] }] }), /Ungültige Übung in einem Training/);
  assert.throws(() => L.validateState({ sessions: {} }), /Trainingsliste/);
  assert.throws(() => L.validateState({ sessions: [], plan: { days: [{ id: 'a' }] } }), /Ungültiger Trainingstag/);
  assert.throws(() => L.validateState({ sessions: [], plan: { days: [null] } }), /Ungültiger Trainingstag/);
  assert.throws(() => L.validateState('text'), /keine Gym-Tracker-Daten/);
  assert.throws(() => L.validateState(42), /keine Gym-Tracker-Daten/);
  assert.throws(() => L.validateState(undefined), /keine Gym-Tracker-Daten/);
  const v = L.validateState({ sessions: [], plan: 'kaputt', exercises: 'kaputt', settings: 'kaputt', bodyweight: [null, { date: 'x', w: 1 }, { date: 1, w: 80 }], active: { foo: 1 } });
  assert.ok(v.plan.days.length > 0, 'kaputter Plan → Standardplan');
  assert.ok(v.exercises.length > 10);
  assert.equal(v.settings.rest, 120);
  assert.deepEqual(v.bodyweight, [{ date: 1, w: 80 }]);
  assert.equal(v.active, null);
  const v2 = L.validateState({ sessions: [], exercises: [{ id: 'x', name: 'X', muscle: 'Hals', type: 'quatsch' }], plan: { days: [{ id: 'd', items: [{}] }] } });
  assert.equal(v2.exercises[0].muscle, 'Sonstiges');
  assert.equal(v2.exercises[0].type, 'weight');
  assert.equal(v2.plan.days[0].name, 'Training');
  assert.equal(L.createSession(v2.plan.days[0], v2).exercises.length, 0, 'Plan-Item ohne exId führt nicht zum Absturz');
  const v3 = L.validateState({ sessions: [{ start: 5, exercises: [{ exId: 'a', sets: [{ w: 1, r: 1, done: true }] }] }] });
  assert.deepEqual(L.weeklyMuscleSets(v3.sessions, 5), { Sonstiges: 1 });
  assert.ok(L.toCSV(v3.sessions).includes(';1;;1;1;'));
  assert.equal(L.sessionVolume(v3.sessions[0]), 1);
});

test('validateState: Schema-Version als String und Idempotenz', () => {
  assert.equal(L.validateState({ schema: 1, sessions: [] }).schema, 1);
  assert.equal(L.validateState({ schema: '1', sessions: [] }).schema, 1);
  const once = L.validateState({ sessions: [] });
  assert.deepEqual(L.validateState(once), once, 'erneute Validierung ändert nichts');
});

test('validateState: Sets mit null/Müll werden von Statistiken ignoriert', () => {
  const v = L.validateState({ sessions: [{ start: 1, exercises: [{ exId: 'a', sets: [null, 5, 'x', { w: 1, r: 1, done: true }] }] }] });
  assert.equal(L.sessionSetCount(v.sessions[0]), 1);
  assert.equal(L.sessionVolume(v.sessions[0]), 1);
  assert.equal(L.exerciseHistory(v.sessions, 'a').length, 1);
  assert.equal(L.toCSV(v.sessions).split('\r\n').length, 2);
});

test('needsBackupReminder: Randfälle', () => {
  const st = L.defaultState();
  st.sessions = [sess(1000, [])];
  st.settings.sessionsSinceExport = 0;
  assert.equal(L.needsBackupReminder(st, 1000 + 30 * DAY), false, 'nichts Neues seit Export → keine Erinnerung');
  delete st.settings.sessionsSinceExport;
  assert.equal(L.needsBackupReminder(st, 1000), false);
});

// ---------- Diagramme (charts.js) ----------
test('lineChart: leer, 1 Punkt, identische Werte/Daten, negativ, große Werte', () => {
  assert.ok(C.lineChart([]).includes('empty'));
  const ok = (pts) => {
    const svg = C.lineChart(pts, { unit: 'kg' });
    assert.ok(svg.startsWith('<svg'));
    assert.ok(!/NaN|Infinity|undefined/.test(svg), `ungültige Zahl in SVG für ${JSON.stringify(pts)}`);
    return svg;
  };
  ok([{ date: 1, value: 5 }]);
  ok([{ date: 1, value: 0 }]);
  ok([{ date: 1, value: 5 }, { date: 2, value: 5 }]);
  ok([{ date: 1, value: 0 }, { date: 2, value: 0 }]);
  ok([{ date: 5, value: 1 }, { date: 5, value: 9 }]);
  ok([{ date: 1, value: -20 }, { date: 2, value: -17.5 }]);
  ok([{ date: 1, value: 1e-3 }, { date: 2, value: 2e-3 }]);
  ok([{ date: 1, value: 1e9 }, { date: 2, value: 2e9 }]);
  ok(Array.from({ length: 1000 }, (_, i) => ({ date: i * DAY, value: 50 + (i % 17) })));
  assert.equal((ok([{ date: 1, value: 1 }, { date: 2, value: 9 }, { date: 3, value: 2 }]).match(/var\(--gold\)/g) || []).length, 1, 'genau ein hervorgehobener bester Punkt');
});

test('barList/columnChart: leer, Escaping, 0-Werte', () => {
  assert.ok(C.barList([]).includes('empty'));
  const html = C.barList([{ label: '<img src=x onerror=alert(1)>', value: 3 }, { label: 'A&B', value: 0 }]);
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img') && html.includes('A&amp;B'));
  assert.ok(!/NaN/.test(C.barList([{ label: 'x', value: 0 }])));
  assert.ok(!/NaN|Infinity/.test(C.columnChart([{ week: 0, count: 0 }, { week: DAY, count: 0 }])));
});

// ---------- Vom Tester gefundene Fehler (behoben) ----------
test('behoben: parseNum akzeptiert kein führendes + ("+10" bei Körpergewichtsübungen)', () => {
  assert.equal(L.parseNum('+10', true), 10);
});

test('behoben: validateState meldet kaputte Schema-Zahlen (-1, 0.5) nur als TypeError', () => {
  assert.throws(() => L.validateState({ schema: -1, sessions: [] }), (e) => !/MIGRATIONS/.test(e.message));
});

test('behoben: validateState sortiert Sets-Einträge (null) und Plan-Items (null) aus', () => {
  const v = L.validateState({ sessions: [{ start: 1, exercises: [{ exId: 'a', sets: [null, { w: 'x', r: 5, done: true }] }] }], plan: { days: [{ id: 'a', items: [null, { exId: 'kniebeuge', sets: 'viele' }] }] } });
  assert.equal(v.sessions[0].exercises[0].sets.length, 1);
  assert.equal(v.sessions[0].exercises[0].sets[0].w, null, 'Müll-Gewicht → leer, Satz zählt nicht');
  assert.equal(L.sessionSetCount(v.sessions[0]), 0);
  assert.deepEqual(v.plan.days[0].items.map((i) => [i.exId, i.sets]), [['kniebeuge', 3]]);
  assert.doesNotThrow(() => L.fmtSet('weight', v.sessions[0].exercises[0].sets[0]));
});

test('behoben: validateState prüft settings.step/rest nicht auf Zahl > 0', () => {
  const v = L.validateState({ sessions: [], settings: { step: 'abc', rest: -3 } });
  assert.ok(v.settings.step > 0 && v.settings.rest > 0);
});

test('behoben: suggestSets mit step <= 0 / undefined liefert NaN bzw. sinkende Gewichte', () => {
  const last = { sets: [set(80, 12)] };
  for (const step of [undefined, NaN, -2.5]) {
    const r = L.suggestSets({ sets: 1, repMin: 8, repMax: 12 }, last, step);
    assert.ok(Number.isFinite(r.sets[0].tw) && r.sets[0].tw >= 80, `step=${step} → tw=${r.sets[0].tw}`);
  }
});

test('behoben: weeklyMuscleSets mit Muskel "constructor" (Prototyp-Schlüssel)', () => {
  const r = L.weeklyMuscleSets([sess(5, [ex('a', [set(1, 1)], { muscle: 'constructor' })])], 5);
  assert.equal(r.constructor, 1);
});

test('behoben: validateState lehnt nicht-endliche/ungültige start-Werte (1e20) nicht ab', () => {
  assert.throws(() => L.validateState({ sessions: [{ start: 1e20, exercises: [] }] }), /Ungültig/);
});

test('behoben: lineChart wirft bei Werten, die sich nur um 1 ULP unterscheiden', () => {
  assert.doesNotThrow(() => C.lineChart([{ date: 1, value: 80 }, { date: 2, value: 80 + 1.4e-14 }]));
});

test('behoben: CSV-Export maskiert Formelzeichen (=, +, -, @) am Zellenanfang nicht', () => {
  const csv = L.toCSV([sess(1, [ex('a', [set(1, 1)], { name: '=HYPERLINK("x")' })])]);
  assert.ok(!csv.split('\r\n')[1].split(';')[3].startsWith('='));
});
