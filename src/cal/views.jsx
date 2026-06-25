// ===========================================================================
//  views.jsx – Tag / Woche / Monat / Agenda / Dashboard
// ===========================================================================
import React, { useState } from "react";
import {
  WEEKDAYS, WEEKDAYS_LONG,
  toISODate, parseISODate, addDays, startOfWeek, monthGrid, todayISO, isoWeek,
  timeToMin, fmtDateLong, priorityById, dayConflictSet, occTimeLabel,
} from "./data.js";
import { EventChip, hexA, UserAvatar, ParticipantDots } from "./components.jsx";

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
    const conflict = cluster.length > 1;
    for (const c of cols) placed.push({ ...c, colCount, conflict });
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

  return (
    <div>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 10, color: t.text }}>
        {fmtDateLong(dateISO)}
        <span style={{ fontWeight: 800, color: "#fff", background: t.accent, fontSize: 12, marginLeft: 8, borderRadius: 6, padding: "2px 7px" }}>KW {isoWeek(dateISO)}</span>
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
      <div style={{ position: "relative", borderTop: `1px solid ${t.border}` }}>
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
                  <span style={{ flex: "none" }}>{(type && type.icon) || ev.icon || "📌"}</span>
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
//  WOCHENANSICHT
// ---------------------------------------------------------------------
// Vertikale Tagesliste: jeder Wochentag nimmt die volle Breite ein und zeigt
// seine Termine gut lesbar darunter (mobilfreundlich, nichts wird abgeschnitten).
export function WeekView({ t, ctx, dateISO, occ, onSelect, onPickDay }) {
  const ws = startOfWeek(parseISODate(dateISO));
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const today = todayISO();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ marginBottom: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", background: t.accent, borderRadius: 7, padding: "3px 10px" }}>
          KW {isoWeek(toISODate(ws))}
        </span>
      </div>
      {days.map((d) => {
        const iso = toISODate(d);
        const items = occ.filter((e) => e.date === iso);
        const conflicts = dayConflictSet(items);
        const isToday = iso === today;
        const wd = (d.getDay() + 6) % 7;
        const weekend = wd >= 5;
        return (
          <div key={iso} style={{
            background: isToday ? t.todayBg : t.surface,
            border: `1px solid ${isToday ? t.accent : t.border}`,
            borderRadius: 12, overflow: "hidden",
          }}>
            <button onClick={() => onPickDay(iso)} style={{
              display: "flex", alignItems: "center", gap: 12, width: "100%",
              background: "transparent", border: "none", cursor: "pointer",
              padding: "9px 12px", textAlign: "left", fontFamily: "inherit",
              borderBottom: items.length ? `1px solid ${t.borderSoft}` : "none",
            }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 42, flex: "none" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: isToday ? t.accent : weekend ? "#E5739A" : t.muted }}>{WEEKDAYS[wd]}</span>
                <span style={{ fontSize: 21, fontWeight: 800, color: isToday ? t.accent : t.text, lineHeight: 1.05 }}>{d.getDate()}</span>
              </div>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {WEEKDAYS_LONG[wd]}
              </span>
              {isToday && <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: t.accent, borderRadius: 6, padding: "1px 7px", flex: "none" }}>Heute</span>}
              {conflicts.size > 0 && <span title="Überschneidung" style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: "#E53935", borderRadius: 6, padding: "1px 6px", flex: "none" }}>⚠️</span>}
              <span style={{ fontSize: 12.5, color: t.muted, fontWeight: 700, flex: "none", minWidth: 16, textAlign: "right" }}>
                {items.length || "–"}
              </span>
            </button>
            {items.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 8 }}>
                {items.map((ev, i) => (
                  <EventChip key={ev.id + i} t={t} ev={ev} ctx={ctx} dense conflict={conflicts.has(ev.id)} onClick={() => onSelect(ev)} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------
//  MONATSANSICHT
// ---------------------------------------------------------------------
// Übersichtliches Raster mit farbigen Punkten je Termin + Liste des
// angetippten Tages darunter (Monat im Blick, Details ohne Ansichtswechsel).
export function MonthView({ t, ctx, dateISO, occ, onSelect, onPickDay }) {
  const cur = parseISODate(dateISO);
  const year = cur.getFullYear(), month = cur.getMonth();
  const grid = monthGrid(year, month);
  const today = todayISO();
  const byDay = {};
  for (const e of occ) (byDay[e.date] = byDay[e.date] || []).push(e);

  // Ausgewählter Tag: heute (falls im Monat), sonst der Monatserste.
  const todayD = parseISODate(today);
  const todayInMonth = todayD.getMonth() === month && todayD.getFullYear() === year;
  const firstISO = toISODate(new Date(year, month, 1));
  const [selected, setSelected] = useState(todayInMonth ? today : firstISO);
  // Auswahl an den sichtbaren Monat anpassen, wenn weitergeblättert wird.
  const selInMonth = parseISODate(selected).getMonth() === month && parseISODate(selected).getFullYear() === year;
  const selDay = selInMonth ? selected : (todayInMonth ? today : firstISO);
  const selItems = byDay[selDay] || [];
  const selConf = dayConflictSet(selItems);

  return (
    <div>
      {/* Wochentagskopf (mit KW-Spalte) */}
      <div style={{ display: "grid", gridTemplateColumns: "26px repeat(7,1fr)", gap: 4, marginBottom: 6 }}>
        <div style={{ textAlign: "center", fontSize: 9, fontWeight: 800, color: t.faint, alignSelf: "center" }}>KW</div>
        {WEEKDAYS.map((w, i) => (
          <div key={w} style={{ textAlign: "center", fontSize: 11, fontWeight: 800, color: i >= 5 ? "#E5739A" : t.muted }}>{w}</div>
        ))}
      </div>

      {/* Tagesraster mit Punkten + KW-Spalte */}
      <div style={{ display: "grid", gridTemplateColumns: "26px repeat(7,1fr)", gap: 4 }}>
        {Array.from({ length: grid.length / 7 }).map((_, w) => {
          const weekDays = grid.slice(w * 7, w * 7 + 7);
          return (
            <React.Fragment key={"wk" + w}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: t.faint }}>
                {isoWeek(toISODate(weekDays[0]))}
              </div>
              {weekDays.map((d) => {
                const iso = toISODate(d);
                const inMonth = d.getMonth() === month;
                const isToday = iso === today;
                const isSel = iso === selDay;
                const wd = (d.getDay() + 6) % 7;
                const items = byDay[iso] || [];
                const dots = items.slice(0, 3);
                return (
                  <button key={iso} onClick={() => setSelected(iso)} style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                    minHeight: 50, padding: "5px 2px", cursor: "pointer", overflow: "hidden",
                    fontFamily: "inherit",
                    background: isSel ? hexA(t.accent, t.mode === "dark" ? 0.22 : 0.12) : isToday ? t.todayBg : "transparent",
                    border: `1px solid ${isSel ? t.accent : isToday ? t.accent : "transparent"}`,
                    borderRadius: 10, opacity: inMonth ? 1 : 0.35,
                  }}>
                    <span style={{
                      width: 25, height: 25, lineHeight: "25px", borderRadius: "50%", fontSize: 13, textAlign: "center",
                      fontWeight: isToday || isSel ? 800 : 600,
                      background: isToday ? t.accent : "transparent",
                      color: isToday ? "#fff" : wd >= 5 ? "#E5739A" : t.text,
                    }}>{d.getDate()}</span>
                    <span style={{ display: "flex", gap: 3, alignItems: "center", height: 6 }}>
                      {dots.map((ev, i) => {
                        const area = ctx.areaById(ev.areaId);
                        return <span key={ev.id + i} style={{ width: 6, height: 6, borderRadius: "50%", background: area ? area.color : t.faint }} />;
                      })}
                      {items.length > 3 && <span style={{ fontSize: 8, fontWeight: 800, color: t.muted, lineHeight: "6px" }}>+{items.length - 3}</span>}
                    </span>
                  </button>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>

      {/* Termine des ausgewählten Tages */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: selDay === today ? t.accent : t.text }}>{fmtDateLong(selDay)}</span>
          {selDay === today && <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: t.accent, borderRadius: 6, padding: "1px 7px" }}>Heute</span>}
          <button onClick={() => onPickDay(selDay)} style={{ marginLeft: "auto", background: "none", border: "none", color: t.accent, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Tagesansicht ›</button>
        </div>
        {selItems.length === 0 ? (
          <div style={{ fontSize: 13, color: t.faint, padding: "8px 0" }}>Keine Termine an diesem Tag.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {selItems.map((ev, i) => (
              <EventChip key={ev.id + i} t={t} ev={ev} ctx={ctx} conflict={selConf.has(ev.id)} onClick={() => onSelect(ev)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
//  DASHBOARD / STARTSEITE
// ---------------------------------------------------------------------
export function Dashboard({ t, ctx, allEvents, occ7, tasks, onSelect }) {
  const today = todayISO();
  const todays = occ7.filter((e) => e.date === today);
  const next7 = occ7.filter((e) => e.date > today);
  const privArea = ctx.areas.find((a) => /privat/i.test(a.name));
  const privCount = occ7.filter((e) => privArea && e.areaId === privArea.id).length;
  const bizCount = occ7.length - privCount;
  const tasksOpen = tasks.filter((x) => !x.done).length;
  const tasksDone = tasks.filter((x) => x.done).length;

  const Card = ({ title, count, icon, sub }) => (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 11, padding: "9px 11px", flex: "1 1 110px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 15 }}>{icon}</span>
        <span style={{ fontSize: 21, fontWeight: 800, color: t.text, lineHeight: 1.1 }}>{count}</span>
      </div>
      <div style={{ fontSize: 11.5, color: t.muted, fontWeight: 700, marginTop: 1 }}>{title}</div>
      {sub && <div style={{ fontSize: 10.5, color: t.faint }}>{sub}</div>}
    </div>
  );

  const Section = ({ title, items, empty, badge }) => (
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

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        <Card title="Heute" count={todays.length} icon="📅" />
        <Card title="Nächste 7 Tage" count={next7.length} icon="🗓️" />
        <Card title="Privat" count={privCount} icon="🏠" sub={`Geschäftlich: ${bizCount}`} />
        <Card title="Aufgaben offen" count={tasksOpen} icon="✅" sub={`Erledigt: ${tasksDone}`} />
      </div>

      <Section title="Heute" items={todays} empty="Heute keine Termine." badge={todays.length} />
    </div>
  );
}
