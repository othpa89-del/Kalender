# Kalender – Familie & Business

Gemeinsamer **Familien- und Business-Kalender** mit Terminen und Aufgaben und
**Echtzeit-Synchronisation** über Supabase. Dieselben Daten auf iPhone, iPad und
Laptops – live. Läuft als installierbare Web-App (PWA) auf iOS, Android und im Browser.

## ✨ Funktionen

- **Benutzer** Patrick (Administrator) & Katharina (Benutzer) – Namen, Farben und
  Rollen frei änderbar; oben wird der aktive Benutzer (Ersteller) gewählt.
- **Ansichten:** Tag, Woche, Monat, Agenda und Dashboard mit Schnellstatistik.
- **Termine** mit Pflichtfeldern (Titel, Datum, Start/Ende, Ersteller, Bereich,
  Priorität, Terminart) und optionalen Feldern (Beschreibung, Ort, Adresse,
  Notizen, Link, Anhänge, Erinnerung).
- **Bereiche/Firmen** (Firma A/B/C, Privat) mit frei wählbaren Farben.
- **Prioritäten** Kritisch/Hoch/Normal/Niedrig mit Farbcodierung und Filter.
- **Terminarten mit Icons** inkl. Aviation-Kategorien (Flight, Simulator, Examiner,
  Instructor, Line Training, Check Flight, Recurrent, Medical, Layover …); eigene
  Terminarten mit eigenen Icons.
- **Schnellanlage**, **Sperren** (🔒), **wiederkehrende Termine**, **Aufgaben-Modul**,
  **Anhänge & Links**, **Standortnavigation** (Google/Apple Maps), **Konflikterkennung**,
  **Filter & Volltextsuche**, **Benachrichtigungen**, **ICS-Export** (Outlook/Google/Apple).
- **Dark Mode** (Standard) + Light Mode; Hauptfarbe Dunkelblau.

## Tech-Stack
React 18 + Vite 5 · PWA (`vite-plugin-pwa`) · Supabase (Postgres `kv` + Realtime, RLS je `user_id`).

## Einrichtung

### 1) Supabase (neues Projekt)
1. Auf **supabase.com** ein **New project** anlegen (Region z. B. Frankfurt).
2. **SQL Editor** öffnen → Inhalt von `supabase-setup.sql` einfügen → **RUN**.
3. *(optional, empfohlen)* **Authentication → Providers → Email** → „Confirm email" ausschalten.
4. **Project Settings → API**: **Project URL** und **anon public** kopieren.

### 2) Schlüssel eintragen
Datei **`src/config.js`** öffnen und die zwei Platzhalter ersetzen:
```js
export const SUPABASE_URL = "https://deinprojekt.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

### 3) Lokale Entwicklung
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # Produktions-Build nach dist/
```

### 4) Veröffentlichen (GitHub Pages)
1. Dateien ins neue Repo laden (Branch **main**).
2. **Settings → Pages → Source: „GitHub Actions"**.
3. Der Workflow `.github/workflows/deploy.yml` baut automatisch und setzt die
   Pages-Basis auf den Repo-Namen. Danach live unter
   `https://<benutzername>.github.io/<repo-name>/`.

## Nutzung
1. Seite öffnen → **Konto erstellen** (E-Mail + Passwort) → anmelden.
2. Auf **jedem Gerät dasselbe Konto** verwenden → überall dieselben Daten, live.
3. Installieren: iPhone/iPad (Safari) → Teilen → „Zum Home-Bildschirm"; Desktop
   (Chrome/Edge) → Installations-Symbol in der Adressleiste.

## Hinweise / Grenzen
- Echte Zwei-Wege-Synchronisation mit Outlook/Google/Apple sowie native
  System-Push-Mitteilungen brauchen zusätzliche Dienst-/Server-Anbindung. Hier sind
  **ICS-Export** und **Browser-Benachrichtigungen** (bei geöffneter App) umgesetzt.
- Anhänge sind aus Sync-Gründen auf **800 KB/Datei** begrenzt.
