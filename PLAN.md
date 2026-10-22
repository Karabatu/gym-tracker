---
status: umgesetzt (2026-10-22) – Kritik (advocatus-diaboli) und Tester-Funde eingearbeitet; Abweichungen siehe README
aktualisiert: 2026-10-22
---
# Gym-Tracker (PWA) – Plan

## Ziel
Schlanker, werbefreier Gym-Tracker als PWA für das iPhone, gehostet auf GitHub Pages.
Startseite = alles für die laufende Session. Andere Tabs = Plan, Verlauf, Fortschritt, Einstellungen.

## Entscheidungen (von Claude getroffen, Nutzer wollte keine Zwischenfragen)
- Vanilla HTML/CSS/JS (ES-Module), **kein Build, keine Abhängigkeiten** → läuft direkt auf GitHub Pages.
- Daten nur lokal: IndexedDB (Fallback localStorage), `navigator.storage.persist()`.
  Laufendes Training wird bei jeder Eingabe gespeichert (App schließen ≠ Datenverlust).
- Backup: Export/Import JSON, CSV-Export. Hinweis in den Einstellungen, wann zuletzt exportiert.
- Einheit kg (lbs umschaltbar), Dezimalkomma erlaubt („82,5“).
- Offline: Service Worker cacht die App-Shell; Update wird beim nächsten Start aktiv (Hinweis-Banner).
- Diagramme selbst als SVG gezeichnet (keine Chart-Bibliothek).
- Tests: Logik in `js/logic.js` (rein, ohne DOM), Tests mit `node --test` (Node 24, eingebaut).

## Tabs
1. **Training (Start)**
   - Nächster Trainingstag des Plans vorgeschlagen (Rotation), andere Tage / freies Training wählbar.
   - Pro Übung: Sätze mit Gewicht × Wdh, Haken zum Abschließen; vorausgefüllt aus dem letzten Mal,
     „Letztes Mal: 80 × 8, 8, 7“ sichtbar; Steigerungs-Hinweis (alle Sätze am oberen Wdh-Ende → +Schritt).
   - Satz hinzufügen/löschen, Übung hinzufügen/entfernen, Notiz pro Training.
   - Pausentimer startet nach Haken automatisch (Zeit aus Plan/Standard), ±15 s, Ton am Ende,
     zeitstempelbasiert (stimmt auch nach Sperrbildschirm). Bildschirm wach halten (Wake Lock).
   - Trainingsdauer, Volumen live. „Training beenden“ → Zusammenfassung mit neuen Rekorden.
2. **Verlauf** – Liste der Trainings (Datum, Tag, Dauer, Volumen), Detailansicht,
   Vergleich mit dem vorherigen gleichen Trainingstag, Löschen.
3. **Fortschritt** – Übung wählen → farbiges Liniendiagramm (geschätztes 1RM / Top-Gewicht / Volumen),
   Zeitraum 1M/3M/1J/alles; Rekorde; Wochenvolumen (Sätze) je Muskelgruppe; Körpergewicht-Verlauf.
4. **Plan** – Trainingstage anlegen/umbenennen/sortieren/löschen; Übungen je Tag mit Sätzen,
   Wdh-Bereich, Pause; Übungsbibliothek mit Muskelgruppe, eigene Übungen. Vorlagen (GK A/B, OK/UK, PPL).
5. **Einstellungen** – Einheit, Gewichtsschritt, Standard-Pause, Ton, Wake Lock, Design (auto/hell/dunkel),
   Export/Import, CSV, Alles löschen (mit Bestätigung), Version.

## Dateien
`index.html`, `manifest.webmanifest`, `sw.js`, `css/app.css`, `js/{app,logic,store,charts}.js`,
`icons/` (PNG, per Python-Skript erzeugt), `tests/logic.test.mjs`, `README.md`.

## Randfälle
- Leerer Plan / keine Historie / Übung gelöscht, aber in Historie → Name in Historie mitspeichern.
- Ungültige Eingaben (leer, negativ, Text) → Satz nicht zählen, rot markieren.
- Import: Schema prüfen, bei Fehler nichts überschreiben; vorher automatisches Backup im Speicher.
- Laufendes Training beim App-Neustart fortsetzen; Training über Mitternacht.
- iOS: Safe Area, kein Zoom bei Eingabe (16 px), Ton erst nach Nutzergeste.

## Rückweg
Ordner löschen bzw. Repo/Pages abschalten; App vom Home-Bildschirm entfernen (löscht lokale Daten – vorher exportieren).
