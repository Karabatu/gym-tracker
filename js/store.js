// Speicherung in IndexedDB. Name mit Präfix, weil alle GitHub-Pages-Repos eines Nutzers denselben Origin teilen.
import { defaultState, validateState } from './logic.js';

const DB_NAME = 'gymtracker-v1';
const STORE = 'kv';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) return reject(new Error('Dieser Browser unterstützt keine lokale Datenbank (IndexedDB).'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => {
      const db = req.result;
      // Verbindung kann von iOS geschlossen werden → beim nächsten Zugriff neu öffnen.
      db.onclose = () => (dbPromise = null);
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error || new Error('Datenbank konnte nicht geöffnet werden.'));
    req.onblocked = () => reject(new Error('Datenbank ist blockiert – bitte andere Tabs der App schließen.'));
  });
  dbPromise.catch(() => (dbPromise = null));
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error || new Error('Speichern fehlgeschlagen.'));
    t.onabort = () => reject(t.error || new Error('Speichern abgebrochen (Speicher voll?).'));
  });
}

export const kvGet = (key) => tx('readonly', (s) => s.get(key));
export const kvSet = (key, val) => tx('readwrite', (s) => s.put(val, key));

/** Lädt den Zustand. Ungültige Daten werden als 'corrupt' gesichert statt verworfen. */
export async function loadState() {
  const raw = await kvGet('state');
  if (raw == null) return { state: defaultState(), fresh: true };
  try {
    const before = raw.schema;
    const state = validateState(raw);
    if (before !== state.schema) await kvSet('backup', { at: Date.now(), reason: 'Migration', data: raw });
    return { state, fresh: false };
  } catch (e) {
    await kvSet('corrupt', { at: Date.now(), data: raw });
    throw Object.assign(new Error(`Gespeicherte Daten sind beschädigt (${e.message}). Sie wurden gesichert; die App startet leer.`), { corrupt: true });
  }
}

// Schreibvorgänge nacheinander; der letzte Stand gewinnt.
let pending = null;
let chain = Promise.resolve();

export function saveState(state) {
  pending = state;
  const run = chain.then(async () => {
    if (!pending) return;
    const snap = structuredClone(pending);
    pending = null;
    await kvSet('state', snap);
  });
  chain = run.catch(() => {}); // Fehler an Aufrufer melden, Kette aber weiterlaufen lassen
  return run;
}

/** Sicherung vor riskanten Aktionen (Import, Löschen). */
export async function snapshot(state, reason) {
  await kvSet('backup', { at: Date.now(), reason, data: structuredClone(state) });
}

export const loadBackup = () => kvGet('backup');

export async function requestPersist() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) return await navigator.storage.persist();
    return true;
  } catch {
    return false;
  }
}
