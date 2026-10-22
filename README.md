# Gym-Tracker

Schlanker Gym-Tracker als PWA für das iPhone: keine Werbung, kein Konto, keine Rezepte.
Die Startseite enthält alles für die laufende Session. Plan, Verlauf, Fortschritt und Einstellungen liegen in eigenen Tabs.
Alle Daten bleiben lokal auf dem Gerät (IndexedDB).

## Funktionen
- **Training:** Der nächste Trainingstag wird automatisch vorgeschlagen (Rotation). Werte vom letzten Mal stehen als Platzhalter im Feld, ein Haken übernimmt sie. Bei vollem Wdh-Bereich erscheint ein Steigerungs-Hinweis.
- Aufwärmsätze: Satznummer antippen, dann „W“. Sie zählen nicht für Volumen und Rekorde.
- Pausentimer startet automatisch, ±15 s, Ton am Ende. Bildschirm bleibt wach.
- Übungen lassen sich während des Trainings hinzufügen, tauschen, verschieben und entfernen (mit Rückgängig).
- Pro Training gibt es eine Notiz.
- Übungsarten: Gewicht × Wdh, Körpergewicht ± kg (negativ = assistiert), Zeit (Sekunden).
- **Verlauf:** alle Trainings mit Vergleich zum letzten gleichen Tag (Volumen, 1RM je Übung). Nachträglich bearbeiten oder löschen.
- **Fortschritt:**
  - farbiges Diagramm je Übung (1RM geschätzt / Top-Gewicht / Volumen / Wdh) über 1M/3M/1J/alles, dazu Rekorde
  - Sätze je Muskel in der aktuellen Woche
  - Trainings pro Woche
  - Körpergewicht
- **Plan:** Trainingstage mit Sätzen, Wdh-Bereich und Pause je Übung. Vorlagen (Ganzkörper, OK/UK, PPL) und eigene Übungen.
- **Einstellungen:**
  - Gewichtsschritt, Standard-Pause, Ton, Wach halten, Design
  - Backup als JSON-Export/-Import und CSV-Export
  - „Stand vor letzter Aktion wiederherstellen“ (nach Import, Vorlage, Löschen)

## Auf GitHub Pages veröffentlichen
1. Neues GitHub-Repo anlegen (z. B. `gym-tracker`) und den Inhalt dieses Ordners hochladen:
   ```bash
   git remote add origin https://github.com/<user>/gym-tracker.git
   ```
   ```bash
   git push -u origin main
   ```
2. Im Repo unter **Settings → Pages → Build and deployment** als Source „Deploy from a branch“ wählen, dann Branch `main` und Ordner `/ (root)`.
3. Nach 1–2 Minuten ist die App unter `https://<user>.github.io/gym-tracker/` erreichbar.
4. Auf dem iPhone die Seite in **Safari** öffnen, dann **Teilen → Zum Home-Bildschirm**. Danach **nur noch über das Icon** öffnen, denn Safari und die Home-Bildschirm-App haben getrennte Daten.

Alle Pfade sind relativ, die App funktioniert also in jedem Unterordner.

## Update veröffentlichen
1. Dateien ändern.
2. In `sw.js` die Konstante `VERSION` **und** in `js/app.js` die Konstante `APP_VERSION` erhöhen (z. B. `1.0.1`).
3. Committen und pushen.
4. Beim nächsten Öffnen der App erscheint oben „Update verfügbar“. Ein Tipp darauf lädt neu, die Daten bleiben erhalten.

Ohne erhöhte `VERSION` bleibt auf dem iPhone die alte Version im Cache.

## Entwicklung
- Lokal starten mit dem folgenden Befehl, dann `http://localhost:8792` öffnen:
  ```bash
  py -m http.server 8792
  ```
  In Claude Code heißt die Vorschau `gym-tracker`.
- Tests (Node 24, keine Abhängigkeiten):
  ```bash
  node --test tests/logic.test.mjs
  ```
- Icons neu erzeugen:
  ```bash
  py tools/make_icons.py
  ```
- Aufbau: `js/logic.js` (reine Logik, getestet), `js/store.js` (IndexedDB), `js/charts.js` (SVG-Diagramme), `js/app.js` (Oberfläche), `sw.js` (Offline-Cache).
- Das Datenschema hat eine Version (`SCHEMA_VERSION` in `logic.js`). Strukturänderungen bekommen eine Migration in `MIGRATIONS` plus einen Test. Vor jeder Migration legt die App automatisch eine Sicherung an.

## Bekannte Grenzen (iOS)
- Bei gesperrtem Bildschirm läuft kein JavaScript. Der Timer stimmt nach dem Entsperren wieder, denn er rechnet mit Zeitstempeln. Ein Ton im Sperrbildschirm ist ohne Push-Server aber nicht möglich. Deshalb hält die App den Bildschirm wach (ab iOS 18.4 zuverlässig).
- Der Ton kann durch den Stummschalter unterdrückt werden.
- Wird die App vom Home-Bildschirm gelöscht, sind die Daten weg. Deshalb regelmäßig **Backup exportieren** und im Teilen-Menü „In Dateien sichern“ wählen. Die App erinnert nach 7 Tagen bzw. 5 Trainings ohne Backup.

## Testcheckliste echtes iPhone (nach jedem größeren Update)
- [ ] Über das Home-Bildschirm-Icon öffnen, ein Training starten, Sätze abhaken, die App schließen und wieder öffnen: Das Training läuft weiter.
- [ ] Flugmodus an: Die App startet und funktioniert.
- [ ] Pausentimer läuft, Bildschirm sperren, nach 1 min entsperren: Die Restzeit stimmt.
- [ ] Ton am Pausenende hörbar (Stummschalter aus).
- [ ] Backup exportieren → „In Dateien sichern“ → Import dieser Datei klappt.
- [ ] Neue Version pushen: Das Banner „Update verfügbar“ erscheint, ein Tipp lädt neu, die Daten sind noch da.

## Rückweg
- GitHub-Repo löschen oder Pages abschalten.
- App vom Home-Bildschirm entfernen. Das löscht die lokalen Daten, also vorher exportieren.
- Diesen Ordner löschen.
