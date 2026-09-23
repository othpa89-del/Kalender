// ===========================================================================
//  views.jsx – Tag / Woche / Monat / Agenda / Dashboard
// ===========================================================================
import React from "react";
import {
  WEEKDAYS, WEEKDAYS_LONG,
  toISODate, parseISODate, addDays, startOfWeek, monthGrid, todayISO, isoWeek,
  timeToMin, fmtDateLong, priorityById, occTimeLabel,
  MONTHS, occurrencesInRange, WORK_CATEGORIES, workCategoryOf, fmtWeekTitle,
} from "./data.js";
import { EventChip, hexA, UserAvatar, ParticipantDots, DateNav, Btn } from "./components.jsx";

// Leeransicht
function Empty({ t, text }) {
  return (
    <div style={{ textAlign: "center", color: t.faint, padding: "40px 16px", fontSize: 14 }}>
      <div style={{ fontSize: 30, marginBottom: 8 }}>📅</div>{text}
    </div>
  );
}

// Einfache Spuren-Berechnung für überlappende Termine (Tagesansicht)
// Cluster-basiertes Layout: nur zusammenhängend überlappende Termine teilen
// sich die Breite (jeweils eigene Spalte). Eigenständige Termine bleiben breit.
// conflict = der Termin liegt in einem Cluster mit ≥2 Terminen (Überschneidung).
function layoutDay(items) {
  const sorted = items.slice().sort((a, b) =>
    timeToMin(a.start) - timeToMin(b.start) || timeToMin(a.end) - timeToMin(b.end));
  const placed = [];
  let cluster = [], clusterEnd = -1;

  const flush = () => {
    if (!cluster.length) return;
    const lanes = []; // Endzeit je Spalte
    const cols = [];
    for (const ev of cluster) {
      const s = timeToMin(ev.start), e = Math.max(timeToMin(ev.end), s + 15);
      let lane = lanes.findIndex((end) => end <= s);
      if (lane === -1) { lane = lanes.length; lanes.push(e); } else lanes[lane] = e;
      cols.push({ ev, lane, s, e });
    }
    const colCount = Math.max(1, lanes.length);
    // Ganztägige Termine belegen keine konkrete Zeit -> sie erzeugen keine
    // Überschneidung. Nur wenn sich mind. 2 Termine MIT Uhrzeit treffen.
    const conflict = cluster.filter((e) => !e.allDay).length > 1;
    for (const c of cols) placed.push({ ...c, colCount, conflict: conflict && !c.ev.allDay });
    cluster = []; clusterEnd = -1;
  };

  for (const ev of sorted) {
    const s = timeToMin(ev.start), e = Math.max(timeToMin(ev.end), s + 15);
    if (cluster.length && s < clusterEnd) { cluster.push(ev); clusterEnd = Math.max(clusterEnd, e); }
    else { flush(); cluster = [ev]; clusterEnd = e; }
  }
  flush();
  return placed;
}

// ---------------------------------------------------------------------
//  TAGESANSICHT
// ---------------------------------------------------------------------
export function DayView({ t, ctx, dateISO, occ, onSelect }) {
  const gridRef = React.useRef(null);
  // Mehrtägige Termine an diesem Tag auf die Tagesgrenzen zuschneiden,
  // damit sie im Stundenraster sinnvoll positioniert werden.
  const dayItems = occ.filter((e) => e.date === dateISO).map((e) =>
    (e._span && e._span > 1)
      ? { ...e, start: e._spanStart ? e.start : "00:00", end: e._spanEnd ? e.end : "23:59" }
      : e);
  const HOUR = 52;
  const startHour = 0, endHour = 24;
  const placed = layoutDay(dayItems);
  const hasConflict = placed.some((p) => p.conflict);
  const nowMin = todayISO() === dateISO
    ? new Date().getHours() * 60 + new Date().getMinutes() : null;

  // Einmal beim Öffnen dorthin scrollen, wo etwas los ist (erster Termin bzw.
  // „jetzt"). NICHT bei jedem Blättern – sonst ist die ‹ › -Leiste nach jedem
  // Tippen weggescrollt. getBoundingClientRect rechnet den zoom-Faktor bereits
  // mit ein, offsetTop dagegen nicht.
  const didScrollRef = React.useRef(false);
  React.useEffect(() => {
    if (didScrollRef.current) return;
    const el = gridRef.current;
    if (!el) return;
    didScrollRef.current = true;
    const firstMin = dayItems.length
      ? Math.min(...dayItems.map((e) => timeToMin(e.start)))
      : (nowMin != null ? nowMin : 8 * 60);
    const rect = el.getBoundingClientRect();
    const zoomFactor = el.offsetHeight ? rect.height / el.offsetHeight : 1;
    const top = window.scrollY + rect.top + Math.max(0, ((firstMin / 60) * HOUR - 40) * zoomFactor);
    window.scrollTo({ top, behavior: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 10, color: t.text }}>
        {fmtDateLong(dateISO)}
        {/* KW steht bereits im Navigations-Titel oben – hier nicht doppelt. */}
        <span style={{ fontWeight: 600, color: t.muted, fontSize: 13, marginLeft: 8 }}>
          {dayItems.length} {dayItems.length === 1 ? "Termin" : "Termine"}
        </span>
        {hasConflict && (
          <span style={{
            marginLeft: 8, fontSize: 12, fontWeight: 800, color: "#fff", background: "#E53935",
            borderRadius: 7, padding: "2px 8px", whiteSpace: "nowrap",
          }}>⚠️ Überschneidung</span>
        )}
      </div>
      {dayItems.length === 0 && <Empty t={t} text="Keine Termine an diesem Tag." />}
      <div ref={gridRef} style={{ position: "relative", borderTop: `1px solid ${t.border}` }}>
        {Array.from({ length: endHour - startHour }).map((_, i) => {
          const h = startHour + i;
          return (
            <div key={h} style={{ display: "flex", height: HOUR, borderBottom: `1px solid ${t.borderSoft}` }}>
              <div style={{ width: 46, flex: "none", fontSize: 11, color: t.faint, paddingTop: 2, fontWeight: 600 }}>
                {String(h).padStart(2, "0")}:00
              </div>
              <div style={{ flex: 1 }} />
            </div>
          );
        })}
        {/* Jetzt-Linie */}
        {nowMin != null && (
          <div style={{
            position: "absolute", left: 46, right: 0, top: (nowMin / 60) * HOUR,
            height: 2, background: "#E53935", zIndex: 3,
          }}>
            <span style={{ position: "absolute", left: -6, top: -4, width: 8, height: 8, borderRadius: "50%", background: "#E53935" }} />
          </div>
        )}
        {/* Termine */}
        <div style={{ position: "absolute", left: 50, right: 2, top: 0, bottom: 0 }}>
          {placed.map(({ ev, lane, s, e, colCount, conflict }, idx) => {
            const top = (s / 60) * HOUR;
            const height = Math.max(((e - s) / 60) * HOUR - 3, 26);
            const w = 100 / colCount;
            const type = ctx.typeById(ev.typeId);
            const area = ctx.areaById(ev.areaId);
            const prio = ev.priority ? priorityById(ev.priority) : null;
            const creator = ctx.userById(ev.creatorId);
            return (
              <button key={ev.id + idx} onClick={() => onSelect(ev)} style={{
                position: "absolute", top, height, left: `${lane * w}%`, width: `calc(${w}% - 4px)`,
                background: area ? hexA(area.color, t.mode === "dark" ? 0.26 : 0.15) : t.chip,
                borderLeft: `4px solid ${prio ? prio.color : t.borderSoft}`,
                border: conflict ? "2px solid #E53935" : `1px solid ${t.border}`,
                borderRadius: 8, padding: "4px 7px", cursor: "pointer", overflow: "hidden",
                textAlign: "left", fontFamily: "inherit", color: t.text,
                boxShadow: conflict ? "0 0 0 1px #E53935 inset" : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 700 }}>
                  {conflict && <span title="Überschneidung" style={{ fontSize: 11, flex: "none" }}>⚠️</span>}
                  <span style={{ flex: "none" }}>{ev.icon || (type && type.icon) || "📌"}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{ev.title}</span>
                  {ev.locked && <span style={{ fontSize: 10 }}>🔒</span>}
                  <UserAvatar user={creator} size={18} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: t.muted, marginTop: 1 }}>
                  <span>{occTimeLabel(ev)}</span>
                  {ev.participants && ev.participants.length > 0 && <ParticipantDots ev={ev} ctx={ctx} size={9} />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
//  WOCHENANSICHT – 7 Tage nebeneinander im Zeitraster (wie Apple Kalender).
//  Oben ganz-/mehrtägige Termine als Balken, darunter Termine mit Uhrzeit als
//  Blöcke in Höhe ihrer Dauer. Farben wie im Monat (monthBarColor).
//  Tippen auf Block: Termin öffnen. Tippen auf Tageskopf: Tagesansicht.
// ---------------------------------------------------------------------
function weekDays(dateISO) {
  const ws = startOfWeek(parseISODate(dateISO));
  return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
}
function WeekHead({ t, days, onPickDay, cols }) {
  const today = todayISO();
  return (
    <div style={{ display: "grid", gridTemplateColumns: cols, paddingBottom: 4 }}>
      <div />
      {days.map((d) => {
        const iso = toISODate(d), wd = (d.getDay() + 6) % 7, isToday = iso === today;
        return (
          <button key={iso} onClick={() => onPickDay(iso)} aria-label={`${WEEKDAYS_LONG[wd]} ${d.getDate()}. – Tagesansicht`} style={{
            background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "2px 0",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 1, minHeight: 44,
          }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: wd >= 5 ? "#E5739A" : t.muted }}>{WEEKDAYS[wd]}</span>
            <span style={{
              fontSize: 15, fontWeight: 800, width: 26, height: 26, lineHeight: "26px", borderRadius: "50%", textAlign: "center",
              background: isToday ? t.accent : "transparent", color: isToday ? "#fff" : wd >= 5 ? "#E5739A" : t.text,
            }}>{d.getDate()}</span>
          </button>
        );
      })}
    </div>
  );
}

// Heller Block-Stil (wie Apple/Google-Kalender): deckender Pastellton der
// Kategoriefarbe, kräftiger Streifen links, Schrift in dunklerem Ton derselben
// Farbe. Deckend (nicht transparent), damit überlappende Blöcke sauber wirken.
function mixHex(a, b, r) {
  const p = (h) => { const n = h.replace("#", ""); return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)); };
  const x = p(a), y = p(b);
  return "#" + x.map((v, i) => Math.round(v * (1 - r) + y[i] * r).toString(16).padStart(2, "0")).join("");
}
function softBlock(color, t) {
  const dark = t.mode === "dark";
  return {
    bg: mixHex(t.surface, color, dark ? 0.34 : 0.17),
    ink: dark ? mixHex(color, "#FFFFFF", 0.55) : mixHex(color, "#000000", 0.38),
    stripe: color,
  };
}

export function WeekView({ t, ctx, dateISO, occ, onSelect, onPickDay }) {
  const days = weekDays(dateISO);
  const isos = days.map(toISODate);
  const today = todayISO();
  const cols = "30px repeat(7, minmax(0, 1fr))";
  const HOUR = 40;

  // Ganztägige/mehrtägige Termine als Balken oben (je Termin EIN Balken)
  const allDay = [], seen = new Set();
  for (const e of occ) {
    if (!(e.allDay || (e._span || 1) > 1)) continue;
    const k = e.id + "_" + e._occStart;
    if (seen.has(k)) continue; seen.add(k);
    const idxs = isos.map((iso, i) => (occ.some((o) => o.id === e.id && o._occStart === e._occStart && o.date === iso) ? i : -1)).filter((i) => i >= 0);
    allDay.push({ ev: e, start: Math.min(...idxs), end: Math.max(...idxs) });
  }
  allDay.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const laneEnds = [];
  for (const b of allDay) {
    let lane = laneEnds.findIndex((end) => end < b.start);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(b.end); } else laneEnds[lane] = b.end;
    b.lane = lane;
  }

  // Termine mit Uhrzeit je Tag
  const timed = isos.map((iso) => layoutDay(occ.filter((e) => e.date === iso && !e.allDay && !((e._span || 1) > 1))));
  const startH = 0, endH = 24;
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i);
  const nowIdx = isos.indexOf(today);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  // Höhe des Scrollbereichs: bis zum unteren Bildschirmrand (mind. 9 Std.,
  // höchstens der ganze Tag). getBoundingClientRect enthält den zoom-Faktor
  // der App, die Höhe selbst wird in CSS-Pixeln (ungezoomt) gesetzt.
  const scrollRef = React.useRef(null);
  const [gridH, setGridH] = React.useState(HOUR * 13);
  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof window === "undefined") return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const zoom = el.offsetHeight ? r.height / el.offsetHeight : 1;
      const avail = (window.innerHeight - Math.max(0, r.top) - 12) / (zoom || 1);
      setGridH(Math.round(Math.min(HOUR * 24, Math.max(HOUR * 9, avail))));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Beim Öffnen und Blättern an eine sinnvolle Stelle springen: aktuelle Woche
  // -> kurz vor „jetzt“, sonst erster Termin mit Uhrzeit, sonst 07:00.
  const wsISO = isos[0];
  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const starts = timed.flat().map((p) => p.s);
    const target = nowIdx >= 0 ? nowMin - 90 : starts.length ? Math.min(...starts) - 30 : 7 * 60;
    el.scrollTop = Math.max(0, (target / 60) * HOUR);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsISO]);

  return (
    <div>
      <WeekHead t={t} days={days} onPickDay={onPickDay} cols={cols} />
      {allDay.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: cols, gridAutoRows: 22, rowGap: 3, marginBottom: 6 }}>
          {allDay.map((b) => { const sb = softBlock(monthBarColor(b.ev, t), t); return (
            <button key={b.ev.id + b.ev._occStart} onClick={() => onSelect(b.ev)} className="cal-bar" style={{
              gridColumn: `${b.start + 2} / ${b.end + 3}`, gridRow: b.lane + 1,
              background: sb.bg, color: sb.ink, border: "none", borderLeft: `3px solid ${sb.stripe}`, borderRadius: 5,
              fontSize: 11, fontWeight: 700, padding: "0 5px", overflow: "hidden", whiteSpace: "nowrap",
              textOverflow: "ellipsis", cursor: "pointer", fontFamily: "inherit", lineHeight: "22px",
              textAlign: b.end > b.start ? "center" : "left",
            }} title={`${b.ev.title || "(ohne Titel)"} · ${occTimeLabel(b.ev)}`}>
              <span aria-hidden style={{ fontWeight: 400 }}>{b.ev.icon || "📌"}</span> {b.ev.title || "(ohne Titel)"}</button>
          ); })}
        </div>
      )}
      {/* Ganzer Tag (0–24 Uhr), scrollt innerhalb der Ansicht; Tageskopf und
          Ganztags-Balken bleiben oben stehen. */}
      <div ref={scrollRef} style={{
        height: gridH, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch",
        borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`,
      }}>
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: cols }}>
        {/* Stunden */}
        <div>
          {hours.map((h) => (
            <div key={h} style={{ height: HOUR, fontSize: 9.5, color: t.faint, fontWeight: 600, paddingTop: 1 }}>{String(h).padStart(2, "0")}</div>
          ))}
        </div>
        {isos.map((iso, di) => {
          const wd = di;
          return (
            <div key={iso} style={{
              position: "relative", borderLeft: `1px solid ${t.borderSoft}`,
              background: iso === today ? t.todayBg : wd >= 5 ? hexA("#E5739A", t.mode === "dark" ? 0.07 : 0.05) : "transparent",
            }}>
              {hours.map((h) => <div key={h} style={{ height: HOUR, borderBottom: `1px solid ${t.borderSoft}` }} />)}
              {timed[di].map(({ ev, lane, s, e, colCount, conflict }, i) => {
                const top = ((s - startH * 60) / 60) * HOUR;
                const height = Math.max(((e - s) / 60) * HOUR - 2, 18);
                // Überschneidung: nicht die (am iPhone ~45 px schmale) Spalte teilen,
                // sondern spätere Termine eingerückt darüberlegen – wie Apple Kalender.
                const indent = colCount > 1 ? Math.min(28, 60 / (colCount - 1)) : 0;
                const left = lane * indent, w = 100 - left;
                const roomy = height >= 44; // Platz für Zeit, Icon und Titel untereinander
                const sb = softBlock(monthBarColor(ev, t), t);
                return (
                  <button key={ev.id + i} onClick={() => onSelect(ev)}
                    title={`${ev.title || "(ohne Titel)"} · ${occTimeLabel(ev)}`}
                    aria-label={`${ev.title || "(ohne Titel)"}, ${occTimeLabel(ev)}${conflict ? ", Überschneidung" : ""}`} style={{
                    position: "absolute", top, height, left: `calc(${left}% + 1px)`, width: `calc(${w}% - 2px)`,
                    background: sb.bg, color: sb.ink, borderRadius: 5,
                    border: conflict ? "1.5px solid #E53935" : "none",
                    borderLeft: `3px solid ${sb.stripe}`,
                    // heller Rand trennt übereinanderliegende Blöcke
                    boxShadow: lane > 0 ? `0 0 0 1.5px ${t.bg}` : "none",
                    padding: "2px 3px", overflow: "hidden", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                    display: "flex", flexDirection: "column", gap: 1, zIndex: 1 + lane,
                  }}>
                    {roomy ? (
                      <>
                        <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.85, lineHeight: 1.1 }}>{conflict ? "⚠️ " : ""}{ev.start}</span>
                        <span aria-hidden style={{ fontSize: 13, lineHeight: 1 }}>{ev.icon || "📌"}</span>
                        <span lang="de" style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.15, overflowWrap: "anywhere", hyphens: "auto", WebkitHyphens: "auto" }}>{ev.title || "(ohne Titel)"}</span>
                      </>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 700, lineHeight: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        <span aria-hidden style={{ fontWeight: 400 }}>{ev.icon || "📌"}</span> {ev.title || "(ohne Titel)"}
                      </span>
                    )}
                  </button>
                );
              })}
              {di === nowIdx && nowMin >= startH * 60 && nowMin <= endH * 60 && (
                <div style={{ position: "absolute", left: 0, right: 0, top: ((nowMin - startH * 60) / 60) * HOUR, height: 2, background: "#E53935", zIndex: 3 }}>
                  <span style={{ position: "absolute", left: -4, top: -3, width: 8, height: 8, borderRadius: "50%", background: "#E53935" }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
//  MONATSANSICHT – Übersicht mit farbcodierten Balken und Termin-Icon,
//  mehrtägige Termine als durchgehender Balken. Kein Detail, nur Überblick.
//  Tippen auf Balken: Termin öffnen. Tippen auf Tageszahl: Tagesansicht.
// ---------------------------------------------------------------------
const MONTH_MAX_LANES = 4;
// Farbschema der Monatsbalken (Kontrast zu weißer Schrift jeweils geprüft):
const FLIGHT_COLOR = "#C2185B"; // Eurowings & Flug = Magenta
const ALLDAY_COLOR = "#2FA36B"; // Ganztägig/mehrtägig = Grün
const OTHER_COLOR  = "#64748B"; // alles Übrige = Grau
// AAA verwendet weiterhin die Akzentfarbe (Blau) aus dem Theme.

// Emoji ohne Variationsselektor – "\u2708\uFE0F" und "\u2708" sollen gleich zählen.
function baseIcon(s) { return String(s || "").replace(/\uFE0F/g, ""); }

// Reihenfolge ist bewusst: Eurowings/Flug schlägt AAA, AAA schlägt Ganztägig.
export function monthBarColor(ev, t) {
  const icon = baseIcon(ev.icon);
  const title = String(ev.title || "");
  if (icon === "\u{1F6E9}" || icon === "\u2708" || /\b(eurowings|flug)\b/i.test(title)) return FLIGHT_COLOR;
  if (icon === "\u{1F3E2}" || /\bAAA\b/.test(title)) return t.accent;
  if (ev.allDay || (ev._span || 1) > 1) return ALLDAY_COLOR;
  return OTHER_COLOR;
}

export function MonthView({ t, ctx, dateISO, occ, onSelect, onPickDay }) {
  const cur = parseISODate(dateISO);
  const year = cur.getFullYear(), month = cur.getMonth();
  const grid = monthGrid(year, month);
  const today = todayISO();
  const weeks = Math.round(grid.length / 7);

  const byDay = {};
  for (const e of occ) (byDay[e.date] = byDay[e.date] || []).push(e);

  // Termine einer Woche zu Balken (zusammenhängende Tage je Termin) + Spuren.
  function weekBars(weekDays) {
    const isoList = weekDays.map(toISODate);
    const idxOf = {}; isoList.forEach((iso, i) => { idxOf[iso] = i; });
    // Schlüssel je VORKOMMEN (id + Startdatum des Vorkommens): sonst würden die
    // Wiederholungen desselben Termins zu einem einzigen breiten Balken
    // verschmelzen (z. B. ein tägliches Meeting Mo–Fr).
    const perId = {};
    isoList.forEach((iso) => {
      (byDay[iso] || []).forEach((o) => {
        const key = o.id + "|" + (o._occStart || o.date);
        (perId[key] = perId[key] || []).push({ idx: idxOf[iso], o });
      });
    });
    const runs = [];
    Object.values(perId).forEach((arr) => {
      arr.sort((a, b) => a.idx - b.idx);
      let start = null, prev = null, rep = null;
      arr.forEach((c) => {
        if (start === null) { start = prev = c.idx; rep = c.o; }
        else if (c.idx === prev + 1) { prev = c.idx; }
        else { runs.push({ startIdx: start, span: prev - start + 1, ev: rep }); start = prev = c.idx; rep = c.o; }
      });
      if (start !== null) runs.push({ startIdx: start, span: prev - start + 1, ev: rep });
    });
    runs.sort((a, b) => a.startIdx - b.startIdx || b.span - a.span || timeToMin(a.ev.start) - timeToMin(b.ev.start));
    const lanes = []; const placed = []; const overflow = {};
    runs.forEach((r) => {
      const end = r.startIdx + r.span - 1;
      let lane = lanes.findIndex((ranges) => ranges.every(([s, e]) => r.startIdx > e || end < s));
      if (lane === -1) { lane = lanes.length; lanes.push([]); }
      if (lane < MONTH_MAX_LANES) { lanes[lane].push([r.startIdx, end]); placed.push({ ...r, lane }); }
      else { for (let i = r.startIdx; i <= end; i++) overflow[i] = (overflow[i] || 0) + 1; }
    });
    return { placed, overflow };
  }

  const cols = "20px repeat(7,1fr)";
  const weekendTint = t.mode === "dark" ? "rgba(229,115,154,.10)" : "rgba(229,115,154,.08)";
  // KW-Spalte dezent grau hinterlegen, damit sie sich von den Tagen abhebt.
  const kwTint = t.mode === "dark" ? "rgba(255,255,255,.09)" : "rgba(21,34,56,.085)";
  return (
    <div>
      {/* Die KW-Spalte wird als EIN durchgehender Streifen hinterlegt (nicht je
          Woche einzeln), damit sie als zusammenhaengende Spalte wirkt. */}
      <div style={{ position: "relative" }}>
        <div aria-hidden style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 20,
          background: kwTint, borderRadius: 6, pointerEvents: "none",
        }} />
      {/* Wochentagskopf */}
      <div style={{ display: "grid", gridTemplateColumns: cols, gap: 3, marginBottom: 2 }}>
        <div style={{
          textAlign: "center", fontSize: 8.5, fontWeight: 800, color: t.muted,
          alignSelf: "stretch", position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>KW</div>
        {WEEKDAYS.map((w, i) => (
          <div key={w} style={{ textAlign: "center", fontSize: 10, fontWeight: 800, color: i >= 5 ? "#E5739A" : t.muted }}>{w}</div>
        ))}
      </div>

      {Array.from({ length: weeks }).map((_, w) => {
        const weekDays = grid.slice(w * 7, w * 7 + 7);
        const { placed, overflow } = weekBars(weekDays);
        const ofIdx = Object.keys(overflow);
        return (
          <div key={"w" + w} className="cal-week" style={{ position: "relative", borderTop: `1px solid ${t.borderSoft}`, paddingTop: 2, marginBottom: 3 }}>
            {/* Wochenend-Hintergrund (dezent) */}
            <div aria-hidden style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: cols, gap: 3, pointerEvents: "none" }}>
              <div />
              {weekDays.map((d, di) => {
                const wd = (d.getDay() + 6) % 7;
                return <div key={di} style={{ background: wd >= 5 ? weekendTint : "transparent", borderRadius: 4 }} />;
              })}
            </div>
            {/* KW-Zahl: ueber die volle Hoehe der Wochenzeile mittig */}
            <div style={{
              position: "absolute", left: 0, top: 0, bottom: 0, width: 20, zIndex: 2,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 700, color: t.muted, pointerEvents: "none",
            }}>{isoWeek(toISODate(weekDays[0]))}</div>
            <div style={{ position: "relative", zIndex: 1 }}>
            {/* Tageszahlen */}
            <div style={{ display: "grid", gridTemplateColumns: cols, gap: 3, alignItems: "center" }}>
              <div />{/* KW-Zahl wird darueber mittig ueber die ganze Wochenhoehe gesetzt */}
              {weekDays.map((d) => {
                const iso = toISODate(d); const inMonth = d.getMonth() === month; const isToday = iso === today; const wd = (d.getDay() + 6) % 7;
                return (
                  <button key={iso} onClick={() => onPickDay(iso)} title="Tagesansicht öffnen" style={{
                    background: "none", border: "none", cursor: "pointer", padding: "2px 0", fontFamily: "inherit", textAlign: "center",
                  }}>
                    <span className="cal-daynum" style={{
                      display: "inline-block", width: 19, height: 19, lineHeight: "19px", borderRadius: "50%", fontSize: 12,
                      fontWeight: isToday ? 800 : 600, background: isToday ? t.accent : "transparent",
                      color: isToday ? "#fff" : !inMonth ? t.faint : wd >= 5 ? "#E5739A" : t.text, opacity: inMonth ? 1 : 0.55,
                    }}>{d.getDate()}</span>
                  </button>
                );
              })}
            </div>
            {/* Balken */}
            <div className="cal-bars" style={{ display: "grid", gridTemplateColumns: cols, gridAutoRows: 15, gap: 2, padding: "2px 0 1px" }}>
              {placed.map((p, i) => {
                // Farbe nach Kategorie (Flug/AAA/Ganztägig/Sonstiges).
                // WICHTIG: monthBarColor nutzt die echte Termindauer (_span) – p.span ist
                // nur die Länge des Balkens INNERHALB dieser Woche. Sonst bekäme ein
                // über den Wochenwechsel laufender Termin zwei verschiedene Farben.
                const bg = monthBarColor(p.ev, t);
                const type = ctx.typeById(p.ev.typeId);
                // Emoji = wie in der Schnellanlage gewählt (ev.icon), sonst Terminart-Icon
                const icon = p.ev.icon || (type && type.icon) || "📌";
                return (
                  <button key={p.ev.id + "_" + p.startIdx + "_" + i} className="cal-bar" onClick={() => onSelect(p.ev)}
                    title={`${p.ev.title || "(ohne Titel)"} · ${occTimeLabel(p.ev)}`} style={{
                    gridColumn: `${p.startIdx + 2} / span ${p.span}`, gridRow: p.lane + 1,
                    background: bg, color: "#fff", border: "none", borderRadius: 4, fontSize: 9.5, fontWeight: 700,
                    padding: "0 3px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                    cursor: "pointer", fontFamily: "inherit", lineHeight: "15px", textAlign: p.span > 1 ? "center" : "left",
                  }}><span style={{ fontWeight: 400 }}>{icon}</span> {p.ev.title || "(ohne Titel)"}</button>
                );
              })}
              {ofIdx.map((idx) => (
                <button key={"of" + idx} className="cal-more" onClick={() => onPickDay(toISODate(weekDays[Number(idx)]))}
                  title="Alle Termine des Tages öffnen" style={{
                    gridColumn: `${Number(idx) + 2} / span 1`, gridRow: MONTH_MAX_LANES + 1,
                    fontSize: 11, fontWeight: 800, color: t.accentText, textAlign: "center", lineHeight: "20px",
                    background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0,
                  }}>+{overflow[idx]}</button>
              ))}
            </div>
            </div>
          </div>
        );
      })}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: t.faint, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: FLIGHT_COLOR, display: "inline-block" }} />Eurowings/Flug
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: t.accent, display: "inline-block" }} />AAA
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: ALLDAY_COLOR, display: "inline-block" }} />Ganztägig
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: OTHER_COLOR, display: "inline-block" }} />Sonstiges
          </span>
        </div>
        Balken antippen = Termin · Tageszahl antippen = Tagesansicht
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
//  DASHBOARD / STARTSEITE
// ---------------------------------------------------------------------
// Auf Modulebene definiert (NICHT im Render-Body): sonst entsteht bei jedem
// Rendern ein neuer Komponententyp und React baut den Teilbaum komplett neu auf.
function Section({ t, ctx, onSelect, title, items, empty, badge }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: t.text }}>{title}</h3>
        {badge != null && <span style={{ fontSize: 12, fontWeight: 700, color: t.muted }}>({badge})</span>}
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: t.faint, padding: "6px 0" }}>{empty}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((ev, i) => <EventChip key={ev.id + i} t={t} ev={ev} ctx={ctx} onClick={() => onSelect(ev)} showDate />)}
        </div>
      )}
    </div>
  );
}

export function Dashboard({ t, ctx, allEvents, occ7, tasks, gossip = [], onSelect, onOpenTab }) {
  const today = todayISO();
  const tomorrow = toISODate(addDays(parseISODate(today), 1));
  const todays = occ7.filter((e) => e.date === today);
  const tomorrows = occ7.filter((e) => e.date === tomorrow);

  // „Zuletzt hinzugefügt": Termine und Gossip nach createdAt, neueste zuerst.
  const RECENT_DAYS = 2, RECENT_MAX = 8;
  const cutoff = Date.now() - RECENT_DAYS * 86400000;
  const recent = [
    ...allEvents.map((x) => ({ kind: "event", item: x, ts: x.createdAt, title: x.title,
      who: x.creatorId, icon: x.icon || (ctx.typeById(x.typeId)?.icon) || "📅", label: "Termin" })),
    ...gossip.map((x) => ({ kind: "gossip", item: x, ts: x.createdAt, title: x.title,
      who: x.addedBy, icon: "🍵", label: "Gossip" })),
  ].filter((r) => r.ts && r.ts >= cutoff).sort((a, b) => b.ts - a.ts).slice(0, RECENT_MAX);

  function relTime(ts) {
    const min = Math.floor((Date.now() - ts) / 60000);
    if (min < 1) return "gerade eben";
    if (min < 60) return `vor ${min} Min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `vor ${h} Std`;
    const d = Math.floor(h / 24);
    if (d === 1) return "gestern";
    if (d < 7) return `vor ${d} Tagen`;
    const dt = new Date(ts);
    return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.`;
  }
  function openRecent(r) {
    if (r.kind === "event") onSelect(r.item);
    else if (onOpenTab) onOpenTab(r.kind === "task" ? "tasks" : "gossip");
  }

  return (
    <div>
      {/* Zuletzt hinzugefügt */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: t.text }}>🆕 Zuletzt hinzugefügt</h3>
          {recent.length > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: t.muted }}>({recent.length})</span>}
        </div>
        {recent.length === 0 ? (
          <div style={{ fontSize: 13, color: t.faint, padding: "6px 0" }}>Nichts Neues in den letzten 2 Tagen.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recent.map((r, i) => {
              const who = ctx.userById(r.who);
              return (
                <button key={r.kind + (r.item.id || i)} onClick={() => openRecent(r)} style={{
                  display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left",
                  background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10,
                  padding: "8px 11px", cursor: "pointer", fontFamily: "inherit", color: t.text,
                }}>
                  <span style={{ fontSize: 17, flex: "none" }}>{r.icon}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      display: "block", fontWeight: 700, fontSize: 13.5, overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{r.title || "(ohne Titel)"}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, fontSize: 11.5, color: t.muted }}>
                      <span style={{ fontWeight: 700 }}>{r.label}</span>
                      {who && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: who.color }} />
                        {who.name}
                      </span>}
                      <span>· {relTime(r.ts)}</span>
                    </span>
                  </span>
                  <span style={{ flex: "none", fontSize: 15, color: t.faint }}>›</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Section t={t} ctx={ctx} onSelect={onSelect} title="Heute" items={todays} empty="Heute keine Termine." badge={todays.length} />
      <Section t={t} ctx={ctx} onSelect={onSelect} title="Morgen" items={tomorrows} empty="Morgen keine Termine." badge={tomorrows.length} />
    </div>
  );
}

// ---------------------------------------------------------------------
//  ARBEIT – alle Termine der Kategorien AAA, Eurowings, Flug, Meeting und
//  Simulator automatisch gesammelt, nach Monat gruppiert.
// ---------------------------------------------------------------------
const WORK_RANGE_DAYS = 365;

// Mehrtägige Termine liefert occurrencesInRange je Tag – für Listen/Zähler nur EINMAL.
function uniqueOcc(list) {
  const seen = new Set(), out = [];
  for (const o of list) {
    const k = o.id + "_" + o._occStart;
    if (!seen.has(k)) { seen.add(k); out.push(o); }
  }
  return out;
}

// Stand des Arbeit-Tabs beim Wechsel in andere Tabs merken. Bewusst nur im
// Arbeitsspeicher: ein Neustart der App beginnt wieder mit der Woche. Nach
// längerer Pause (App im Hintergrund) ebenfalls frisch starten.
const WORK_MEMORY_MS = 30 * 60 * 1000;
let workMemory = null;

export function WorkView({ t, ctx, events, onSelect, onPickDay, onImport, initialMode = "week" }) {
  const today = todayISO();
  const [mem] = React.useState(() =>
    (workMemory && Date.now() - workMemory.ts < WORK_MEMORY_MS ? workMemory : null));
  const [mode, setMode] = React.useState(mem ? mem.mode : initialMode); // week | month | list – Standard: Woche
  const [cat, setCat] = React.useState(mem ? mem.cat : "all");
  const [past, setPast] = React.useState(mem ? mem.past : false);
  // Gemeinsamer Bezugstag für Woche und Monat (Wechsel behält den Zeitraum bei)
  const [anchorISO, setAnchorISO] = React.useState(mem ? mem.anchorISO : today);
  React.useEffect(() => {
    workMemory = { mode, cat, past, anchorISO, ts: Date.now() };
  }, [mode, cat, past, anchorISO]);
  // Beim Verlassen des Tabs Zeitstempel erneuern (Pause zählt ab hier)
  React.useEffect(() => () => { if (workMemory) workMemory.ts = Date.now(); }, []);

  const work = React.useMemo(
    () => events.filter((e) => workCategoryOf(e)).map((e) => ({ ...e, _cat: workCategoryOf(e).id })),
    [events]);

  // Liste: kommende bzw. vergangene 12 Monate
  const listOcc = React.useMemo(() => {
    if (mode !== "list") return [];
    const base = parseISODate(today);
    const from = past ? toISODate(addDays(base, -WORK_RANGE_DAYS)) : today;
    const to = past ? toISODate(addDays(base, -1)) : toISODate(addDays(base, WORK_RANGE_DAYS));
    const out = uniqueOcc(occurrencesInRange(work, from, to));
    return past ? out.reverse() : out; // Vergangene: neueste zuerst
  }, [work, mode, past, today]);

  // Woche: Mo–So der gewählten Woche (mehrtägige Termine an jedem Tag)
  const anchor = parseISODate(anchorISO);
  const ws = startOfWeek(anchor);
  const wsISO = toISODate(ws), weISO = toISODate(addDays(ws, 6));
  // Monat: komplettes Raster (inkl. Randtage), gezählt wird nur der Monat selbst
  const mY = anchor.getFullYear(), mM = anchor.getMonth();
  const grid = monthGrid(mY, mM);
  const gsISO = toISODate(grid[0]), geISO = toISODate(grid[grid.length - 1]);
  const msISO = toISODate(new Date(mY, mM, 1)), meISO = toISODate(new Date(mY, mM + 1, 0));

  const rangeOcc = React.useMemo(() => {
    if (mode === "week") return occurrencesInRange(work, wsISO, weISO);
    if (mode === "month") return occurrencesInRange(work, gsISO, geISO);
    return [];
  }, [work, mode, wsISO, weISO, gsISO, geISO]);

  const base = mode === "week" ? uniqueOcc(rangeOcc)
    : mode === "month" ? uniqueOcc(rangeOcc.filter((o) => o.date >= msISO && o.date <= meISO))
    : listOcc;
  const counts = {};
  for (const o of base) counts[o._cat] = (counts[o._cat] || 0) + 1;
  const byCat = (o) => cat === "all" || o._cat === cat;
  const shownCount = cat === "all" ? base.length : (counts[cat] || 0);
  const catInfo = WORK_CATEGORIES.find((c) => c.id === cat);

  // Leere Woche/Monat: nächsten passenden Termin danach suchen (Sprung-Knopf)
  const rangeEnd = mode === "week" ? weISO : meISO;
  const nextOcc = React.useMemo(() => {
    if (mode === "list" || shownCount > 0) return null;
    const from = toISODate(addDays(parseISODate(rangeEnd), 1));
    const to = toISODate(addDays(parseISODate(from), WORK_RANGE_DAYS));
    return occurrencesInRange(work.filter((o) => cat === "all" || o._cat === cat), from, to)[0] || null;
  }, [work, mode, shownCount, rangeEnd, cat]);

  // Hierarchie: nur der Ansichts-Umschalter ist vollflächig blau; Unterauswahl
  // (Kommend/Vergangen, Kategorien) ist getönt – sonst konkurrieren drei
  // gleich starke blaue Flächen untereinander.
  const tint = hexA(t.accent, t.mode === "dark" ? 0.28 : 0.12);
  const selText = t.mode === "dark" ? t.accentText : t.navy;
  const seg = (active, sub) => ({
    flex: "1 1 0", border: "none", borderRadius: 8, minHeight: 40, padding: "0 12px", cursor: "pointer",
    fontFamily: "inherit", fontSize: 14, fontWeight: active ? 800 : 700, whiteSpace: "nowrap",
    background: active ? (sub ? tint : t.accent) : "transparent",
    color: active ? (sub ? selText : "#fff") : t.muted,
  });
  const segWrap = (maxWidth) => ({
    display: "flex", gap: 2, width: "100%", maxWidth, background: t.surface,
    border: `1px solid ${t.border}`, borderRadius: 11, padding: 3,
  });
  const chip = (active) => ({
    display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44, padding: "0 12px",
    borderRadius: 22, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: active ? 800 : 700,
    whiteSpace: "nowrap", flex: "none", border: `1.5px solid ${active ? t.accent : t.border}`,
    background: active ? tint : t.surface, color: active ? selText : t.text,
  });
  const countBadge = (n, active) => (
    <span style={{
      minWidth: 20, padding: "1px 6px", borderRadius: 10, textAlign: "center",
      fontSize: 11.5, fontWeight: 800, lineHeight: 1.45,
      background: active ? t.accent : t.chip,
      color: active ? "#fff" : n ? t.text : t.faint,
    }}>{n || 0}</span>
  );
  const stepWeek = (dir) => setAnchorISO(toISODate(addDays(ws, dir * 7)));
  const stepMonth = (dir) => setAnchorISO(toISODate(new Date(mY, mM + dir, 1)));
  const periodText = mode === "week" ? "in dieser Woche" : "in diesem Monat";

  return (
    <div>
      {/* 1) Ansicht: Woche | Monat | Liste – volle Breite am Handy */}
      <div style={{ ...segWrap(440), marginBottom: 10 }}>
        <button onClick={() => setMode("week")} aria-pressed={mode === "week"} style={seg(mode === "week")}>Woche</button>
        <button onClick={() => setMode("month")} aria-pressed={mode === "month"} style={seg(mode === "month")}>Monat</button>
        <button onClick={() => setMode("list")} aria-pressed={mode === "list"} style={seg(mode === "list")}>Liste</button>
      </div>

      {/* 2) Zeitraum: ‹ Heute › + Titel (wie in Tag/Woche/Monat) bzw. Kommend/Vergangen in der Liste */}
      {mode !== "list" ? (
        <DateNav t={t} style={{ marginBottom: 10 }}
          title={mode === "week" ? fmtWeekTitle(wsISO) : `${MONTHS[mM]} ${mY}`}
          onPrev={() => (mode === "week" ? stepWeek(-1) : stepMonth(-1))}
          onNext={() => (mode === "week" ? stepWeek(1) : stepMonth(1))}
          onToday={() => setAnchorISO(today)}
          prevLabel={mode === "week" ? "Vorige Woche" : "Voriger Monat"}
          nextLabel={mode === "week" ? "Nächste Woche" : "Nächster Monat"} />
      ) : (
        <div style={{ ...segWrap(300), marginBottom: 10 }}>
          <button onClick={() => setPast(false)} aria-pressed={!past} style={seg(!past, true)}>Kommend</button>
          <button onClick={() => setPast(true)} aria-pressed={past} style={seg(past, true)}>Vergangen</button>
        </div>
      )}

      {/* 3) Kategorien – eine waagrecht scrollbare Zeile statt zwei umbrechender
          (Anzahl bezieht sich auf die aktuelle Ansicht) */}
      <div className="tab-scroll" style={{ overflowX: "auto", margin: "0 -12px 12px", padding: "0 12px" }}>
        <div style={{ display: "inline-flex", gap: 6 }}>
          <button onClick={() => setCat("all")} aria-pressed={cat === "all"} style={chip(cat === "all")}>Alle {countBadge(base.length, cat === "all")}</button>
          {WORK_CATEGORIES.map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)} aria-pressed={cat === c.id} style={chip(cat === c.id)}>
              <span aria-hidden style={{ fontWeight: 400 }}>{c.icon}</span>{c.label} {countBadge(counts[c.id], cat === c.id)}
            </button>
          ))}
        </div>
      </div>

      {/* Leerzustand für Woche/Monat (die Tage/das Raster bleiben darunter sichtbar) */}
      {mode !== "list" && shownCount === 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12,
          background: t.surface, border: `1px dashed ${t.border}`, borderRadius: 12, padding: "8px 8px 8px 14px",
          fontSize: 13.5, color: t.muted,
        }}>
          <span style={{ flex: "1 1 180px", minWidth: 0, padding: "6px 0" }}>
            {catInfo ? `Keine ${catInfo.label}-Termine ${periodText}.` : `Keine Arbeitstermine ${periodText}.`}
          </span>
          {nextOcc && (
            <Btn t={t} kind="soft" onClick={() => setAnchorISO(nextOcc.date)} style={{ flex: "none", color: t.accentText }}>
              Nächster: {nextOcc.date.slice(8, 10)}.{nextOcc.date.slice(5, 7)}.{nextOcc.date.slice(0, 4) !== today.slice(0, 4) ? nextOcc.date.slice(0, 4) : ""} ›
            </Btn>
          )}
        </div>
      )}

      {mode === "week" && <WeekView t={t} ctx={ctx} dateISO={wsISO} occ={rangeOcc.filter(byCat)} onSelect={onSelect} onPickDay={onPickDay || (() => {})} />}
      {mode === "month" && <MonthView t={t} ctx={ctx} dateISO={msISO} occ={rangeOcc.filter(byCat)} onSelect={onSelect} onPickDay={onPickDay || (() => {})} />}
      {mode === "list" && <WorkList t={t} ctx={ctx} items={listOcc.filter(byCat)} past={past} today={today} catLabel={catInfo && catInfo.label} onSelect={onSelect} />}

      {onImport && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
          <Btn t={t} kind="soft" onClick={onImport}>📥 Dienstplan importieren (ICS)</Btn>
        </div>
      )}
    </div>
  );
}

function WorkList({ t, ctx, items, past, today, catLabel, onSelect }) {
  // Nach Monat gruppieren (Reihenfolge bleibt erhalten)
  const groups = [];
  for (const o of items) {
    const key = o.date.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) { g = { key, items: [] }; groups.push(g); }
    g.items.push(o);
  }
  if (groups.length === 0) {
    const what = catLabel ? `${catLabel}-Termine` : "Arbeitstermine";
    return <Empty t={t} text={past ? `Keine vergangenen ${what} im letzten Jahr.` : `Keine kommenden ${what} in den nächsten 12 Monaten.`} />;
  }
  return groups.map((g) => {
    const [y, m] = g.key.split("-").map(Number);
    return (
      <div key={g.key} style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: t.text }}>{MONTHS[m - 1]} {y}</h3>
          <span style={{ fontSize: 12, fontWeight: 700, color: t.muted }}>({g.items.length})</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {g.items.map((ev) => (
            <div key={ev.id + "_" + ev._occStart} style={{ position: "relative" }}>
              {ev.date === today && (
                <span style={{ position: "absolute", top: -6, right: 8, zIndex: 1, background: t.accent, color: "#fff",
                  fontSize: 10, fontWeight: 800, borderRadius: 6, padding: "1px 6px" }}>HEUTE</span>
              )}
              <EventChip t={t} ev={ev} ctx={ctx} onClick={() => onSelect(ev)} showDate />
            </div>
          ))}
        </div>
      </div>
    );
  });
}
