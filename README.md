# Kalender – Familie & Business

Gemeinsamer **Familien- und Business-Kalender** mit Terminen und Aufgaben und
**Echtzeit-Synchronisation** über Supabase. Dieselben Daten auf iPhone, iPad und
Laptops – live. Läuft als installierbare Web-App (PWA) auf iOS, Android und im Browser.

## ✨ Funktionen

- **Tabs:** Start (Dashboard) · Tag · Woche · Monat · Aufgaben · Einkauf ·
  Nice to know · Gossip.
- **Benutzer** Patrick (Administrator) & Nadja (Benutzer) – Namen, Farben und
  Rollen frei änderbar; oben wird der aktive Benutzer (Ersteller) gewählt.
- **Kalender-Ansichten** (jeweils mit **Kalenderwoche „KW xx"**):
  - **Tag** mit Stundenraster, **Woche** als gut lesbare Tagesliste,
    **Monat** als Balken-Übersicht (einheitliche Farbe) mit **Termin-Icon** je
    Balken, KW-Spalte und durchgehenden Balken für mehrtägige Termine.
- **Termine** mit Titel, Beginn-/Ende-**Datum** (mehrtägige Termine möglich) und
  **Uhrzeiten** oder **Ganztägig**-Schalter; Ersteller und Bereich. **Priorität**
  und **Terminart** sind optional. Optional außerdem Beschreibung, Ort, Adresse,
  Notizen, Link, Anhänge, Erinnerung, Teilnehmer, Sperre, Wiederholung.
- **Schnellanlage**: Kacheln (alphabetisch) setzen Titel **und Icon** des Termins;
  das Icon erscheint anschließend am Termin im Kalender.
- **Bereiche/Firmen** (Firma A/B/C, Privat) mit frei wählbaren Farben; Standard
  neuer Termine: **Privat**.
- **Aufgaben-Modul** (Titel, Verantwortlich, Fällig am, Priorität).
- **🛒 Einkaufsliste:** mehrere **benennbare Listen** (z. B. je Geschäft) zum
  Umschalten; häufige Artikel als Schnell-Buttons (mit fester Rubrik möglich),
  **wählbare/automatische Kategorien**, abhaken/bearbeiten, „Alle abhaken /
  Erledigte entfernen / Liste leeren", Farbpunkt „wer hat hinzugefügt".
- **💡 Nice to know:** einfache Notizen (Überschrift + Notiz) mit optionaler
  **Rubrik**; nach Rubrik **filterbar** und sortierbar (Neueste / A–Z / Rubrik).
- **🍵 Gossip:** Überschrift + Notiz + **Level** (Steigerung) + optionale **Area**
  sowie **Kommentare** je Eintrag; nach Level/Area **filterbar** und sortierbar.
- **Ersteller sichtbar:** In allen Bereichen zeigt ein **farbiger Punkt** (Patrick/
  Nadja), wer den Eintrag erstellt hat – auch bei Gossip-Kommentaren.
- **Benachrichtigungen:** Termin-Erinnerungen sowie eine Hinweis-Meldung, wenn
  per Live-Sync ein **neuer Eintrag von der anderen Person** ankommt (Termin,
  Aufgabe, Gossip) – zu aktivieren über „🔔 Benachrichtigungen aktivieren" im
  Menü. Hinweis: erscheint, solange die App/PWA geöffnet bzw. im Hintergrund
  aktiv ist (keine Push bei vollständig geschlossener App).
- **Weiteres:** Sperren (🔒), wiederkehrende Termine, Anhänge & Links,
  Standortnavigation (Google/Apple Maps), Konflikterkennung, Filter &
  Volltextsuche, ICS-Export (Outlook/Google/Apple).
- **Dark Mode** (Standard) + Light Mode; Hauptfarbe Dunkelblau. Kompakte,
  platzsparende Darstellung; „Neuer Termin"-Button unten mittig.
- **Auswahllisten** sind alphabetisch sortiert; eine Leer-Option steht immer oben.

> Alle Listen (Termine, Aufgaben, Einkauf, Nice to know, Gossip) liegen pro Konto
> in der Cloud und **synchronisieren live über alle Geräte** (gleicher Account).

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
