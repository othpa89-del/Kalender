// ===========================================================================
//  ics.js – ICS-Dateien einlesen (Dienstplan-Import)
//  Reine Hilfsfunktionen (kein JSX). Liefert Termine in lokaler Gerätezeit.
// ===========================================================================
import { pad2, toISODate, parseISODate, addDays, WORK_CATEGORIES, workCategoryOf } from "./data.js";

// --- Zeilen & Eigenschaften -------------------------------------------
// Gefaltete Zeilen (Fortsetzung beginnt mit Leerzeichen/Tab) zusammenführen.
function unfold(text) {
  return String(text || "").replace(/\r\n|\r/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

// "DTSTART;TZID=Europe/Vienna:20261005T061000" -> { name, params, value }
// Doppelpunkte in "…"-Parametern (z. B. TZID) zählen nicht als Trenner.
function parseLine(line) {
  let inQuote = false, split = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuote = !inQuote;
    else if (c === ":" && !inQuote) { split = i; break; }
  }
  if (split < 0) return null;
  const [name, ...rawParams] = line.slice(0, split).split(";");
  const params = {};
  for (const p of rawParams) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value: line.slice(split + 1) };
}

function unescapeText(s) {
  return String(s || "").replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();
}

// --- Zeitzonen -----------------------------------------------------------
// Häufige Windows-Namen (Outlook-Export) auf IANA abbilden.
const WIN_TZ = {
  "W. Europe Standard Time": "Europe/Berlin",
  "Central Europe Standard Time": "Europe/Budapest",
  "Central European Standard Time": "Europe/Warsaw",
  "Romance Standard Time": "Europe/Paris",
  "GMT Standard Time": "Europe/London",
  "UTC": "UTC",
};

// Versatz einer Zeitzone zu UTC in Minuten zu einem Zeitpunkt.
function tzOffsetMin(tz, utcMs) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = {};
  for (const x of f.formatToParts(new Date(utcMs))) p[x.type] = x.value;
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - utcMs) / 60000;
}
// Wanduhrzeit in einer Zeitzone -> UTC-Millisekunden (inkl. Sommerzeit-Wechsel).
function wallToUtc(y, mo, d, h, mi, s, tz) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const off = tzOffsetMin(tz, guess);
  let utc = guess - off * 60000;
  const off2 = tzOffsetMin(tz, utc);
  if (off2 !== off) utc = guess - off2 * 60000;
  return utc;
}

// Datum/Zeit-Wert -> { date: "YYYY-MM-DD", time: "HH:MM" | null } in Gerätezeit.
function parseDateValue(prop) {
  if (!prop) return null;
  const v = prop.value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s = "00", z] = m;
  if (h == null || prop.params.VALUE === "DATE") return { date: `${y}-${mo}-${d}`, time: null };
  let local;
  if (z) {
    local = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  } else if (prop.params.TZID) {
    const tz = WIN_TZ[prop.params.TZID] || prop.params.TZID;
    try { local = new Date(wallToUtc(+y, +mo, +d, +h, +mi, +s, tz)); }
    catch { return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}` }; } // unbekannte Zone: wie angegeben
  } else {
    return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}` }; // "floating": Gerätezeit
  }
  return { date: toISODate(local), time: `${pad2(local.getHours())}:${pad2(local.getMinutes())}` };
}

// DURATION wie "PT2H30M" / "P1D" -> Minuten
function durationMin(v) {
  const m = String(v || "").match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  return (+(m[2] || 0)) * 10080 + (+(m[3] || 0)) * 1440 + (+(m[4] || 0)) * 60 + (+(m[5] || 0));
}

// --- Parser --------------------------------------------------------------
// Liefert eine Liste von Einträgen:
// { uid, title, location, description, allDay, date, endDate, start, end, cancelled, recurring }
export function parseICS(text) {
  const out = [];
  let cur = null, depth = 0; // depth: verschachtelte Blöcke (VALARM) im VEVENT ignorieren
  for (const line of unfold(text)) {
    if (!line.trim()) continue;
    const p = parseLine(line);
    if (!p) continue;
    if (p.name === "BEGIN") {
      if (p.value.toUpperCase() === "VEVENT" && !cur) { cur = { props: {} }; depth = 0; }
      else if (cur) depth++;
      continue;
    }
    if (p.name === "END") {
      if (cur && depth > 0) { depth--; continue; }
      if (cur && p.value.toUpperCase() === "VEVENT") { const ev = buildEntry(cur.props); if (ev) out.push(ev); cur = null; }
      continue;
    }
    if (cur && depth === 0 && !(p.name in cur.props)) cur.props[p.name] = p;
  }
  out.sort((a, b) => (a.date + (a.start || "")).localeCompare(b.date + (b.start || "")));
  return out;
}

function buildEntry(props) {
  const s = parseDateValue(props.DTSTART);
  if (!s) return null;
  let e = parseDateValue(props.DTEND);
  const allDay = s.time == null;
  if (!e && props.DURATION) {
    const mins = durationMin(props.DURATION.value);
    if (allDay) e = { date: toISODate(addDays(parseISODate(s.date), Math.max(1, Math.round(mins / 1440)))), time: null };
    else {
      const [h, m] = s.time.split(":").map(Number);
      const d = new Date(parseISODate(s.date)); d.setHours(h, m + mins, 0, 0);
      e = { date: toISODate(d), time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}` };
    }
  }
  let endDate, end;
  if (allDay) {
    // DTEND ist bei Datumswerten exklusiv -> letzter Tag = DTEND - 1
    endDate = e && e.date > s.date ? toISODate(addDays(parseISODate(e.date), -1)) : s.date;
    end = "23:59";
  } else {
    endDate = e && e.date >= s.date ? e.date : s.date;
    end = e && e.time ? e.time : s.time;
  }
  return {
    uid: props.UID ? props.UID.value.trim() : "",
    title: unescapeText(props.SUMMARY && props.SUMMARY.value) || "(ohne Titel)",
    location: unescapeText(props.LOCATION && props.LOCATION.value),
    description: unescapeText(props.DESCRIPTION && props.DESCRIPTION.value),
    allDay, date: s.date, endDate, start: allDay ? "00:00" : s.time, end,
    cancelled: !!props.STATUS && props.STATUS.value.trim().toUpperCase() === "CANCELLED",
    recurring: !!props.RRULE,
  };
}

// --- Dienstplan-Kategorien --------------------------------------------------
// Zuerst die normalen Regeln (Titel-Wörter), dann typische Crew-Kürzel.
const SIM_RE = /\b(SIM|FFS|FTD|LPC|OPC|LOFT|ZFTT|SIMULATOR)\b/i;
const EW_RE = /\b(eurowings|EW[GLE]?\s?\d{2,4}|4U\s?\d{2,4})\b/i;
const FLIGHT_RE = /\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?\d{2,4}[A-Z]?\b|\b[A-Z]{3}\s?(?:-|–|>|\/)\s?[A-Z]{3}\b|\b(DH|DHD|deadhead)\b/;
// Tage ohne Dienst – standardmäßig nicht importieren
const OFF_RE = /^\s*(OFF|FREI|FREE|X|RDO|VAC|URLAUB)\b/i;

export function rosterCategory(entry) {
  const text = `${entry.title} ${entry.description || ""}`;
  const direct = workCategoryOf({ title: entry.title });
  if (direct) return direct.id;
  if (SIM_RE.test(text)) return "simulator";
  if (EW_RE.test(text)) return "eurowings";
  if (FLIGHT_RE.test(entry.title)) return "flug";
  return null;
}
export function isOffDay(entry) { return OFF_RE.test(entry.title); }

export function categoryById(id) { return WORK_CATEGORIES.find((c) => c.id === id) || null; }
