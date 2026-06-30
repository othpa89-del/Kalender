// ===========================================================================
//  views.jsx – Tag / Woche / Monat / Agenda / Dashboard
// ===========================================================================
import React from "react";
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
//  MONATSANSICHT – Übersicht mit Balken (einheitliche Farbe) und Termin-Icon,
//  mehrtägige Termine als durchgehender Balken. Kein Detail, nur Überblick.
//  Tippen auf Balken: Termin öffnen. Tippen auf Tageszahl: Tagesansicht.
// ---------------------------------------------------------------------
const MONTH_MAX_LANES = 4;

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
    const perId = {};
    isoList.forEach((iso) => {
      (byDay[iso] || []).forEach((o) => { (perId[o.id] = perId[o.id] || []).push({ idx: idxOf[iso], o }); });
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
  return (
    <div>
      {/* Wochentagskopf */}
      <div style={{ display: "grid", gridTemplateColumns: cols, gap: 3, marginBottom: 2 }}>
        <div style={{ textAlign: "center", fontSize: 8.5, fontWeight: 800, color: t.faint, alignSelf: "center" }}>KW</div>
        {WEEKDAYS.map((w, i) => (
          <div key={w} style={{ textAlign: "center", fontSize: 10, fontWeight: 800, color: i >= 5 ? "#E5739A" : t.muted }}>{w}</div>
        ))}
      </div>

      {Array.from({ length: weeks }).map((_, w) => {
        const weekDays = grid.slice(w * 7, w * 7 + 7);
        const { placed, overflow } = weekBars(weekDays);
        const ofIdx = Object.keys(overflow);
        return (
          <div key={"w" + w} className="cal-week" style={{ borderTop: `1px solid ${t.borderSoft}`, paddingTop: 2, marginBottom: 3 }}>
            {/* Tageszahlen + KW */}
            <div style={{ display: "grid", gridTemplateColumns: cols, gap: 3, alignItems: "center" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.faint, textAlign: "center" }}>{isoWeek(toISODate(weekDays[0]))}</div>
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
                const bg = t.accent; // einheitliche Balkenfarbe (kein Farbwechsel je Bereich)
                const type = ctx.typeById(p.ev.typeId);
                // Emoji = wie in der Schnellanlage gewählt (ev.icon), sonst Terminart-Icon
                const icon = p.ev.icon || (type && type.icon) || "📌";
                return (
                  <button key={p.ev.id + "_" + p.startIdx + "_" + i} className="cal-bar" onClick={() => onSelect(p.ev)} title={p.ev.title} style={{
                    gridColumn: `${p.startIdx + 2} / span ${p.span}`, gridRow: p.lane + 1,
                    background: bg, color: "#fff", border: "none", borderRadius: 4, fontSize: 9.5, fontWeight: 700,
                    padding: "0 3px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                    cursor: "pointer", fontFamily: "inherit", lineHeight: "15px", textAlign: p.span > 1 ? "center" : "left",
                  }}><span style={{ fontWeight: 400 }}>{icon}</span> {p.ev.title || "(ohne Titel)"}</button>
                );
              })}
              {ofIdx.map((idx) => (
                <div key={"of" + idx} style={{
                  gridColumn: `${Number(idx) + 2} / span 1`, gridRow: MONTH_MAX_LANES + 1,
                  fontSize: 8.5, fontWeight: 800, color: t.muted, textAlign: "center", lineHeight: "12px",
                }}>+{overflow[idx]}</div>
              ))}
            </div>
          </div>
        );
      })}
      <div style={{ marginTop: 8, fontSize: 11, color: t.faint, textAlign: "center" }}>
        Balken antippen = Termin · Tageszahl antippen = Tagesansicht
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
//  DASHBOARD / STARTSEITE
// ---------------------------------------------------------------------
export function Dashboard({ t, ctx, allEvents, occ7, tasks, gossip = [], onSelect, onOpenTab }) {
  const today = todayISO();
  const todays = occ7.filter((e) => e.date === today);
  const next7 = occ7.filter((e) => e.date > today);
  const privArea = ctx.areas.find((a) => /privat/i.test(a.name));
  const privCount = occ7.filter((e) => privArea && e.areaId === privArea.id).length;
  const bizCount = occ7.length - privCount;
  const tasksOpen = tasks.filter((x) => !x.done).length;
  const tasksDone = tasks.filter((x) => x.done).length;

  // „Zuletzt hinzugefügt": Termine und Gossip nach createdAt, neueste zuerst.
  const RECENT_DAYS = 14, RECENT_MAX = 8;
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

      {/* Zuletzt hinzugefügt */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: t.text }}>🆕 Zuletzt hinzugefügt</h3>
          {recent.length > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: t.muted }}>({recent.length})</span>}
        </div>
        {recent.length === 0 ? (
          <div style={{ fontSize: 13, color: t.faint, padding: "6px 0" }}>Nichts Neues in den letzten 14 Tagen.</div>
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

      <Section title="Heute" items={todays} empty="Heute keine Termine." badge={todays.length} />
    </div>
  );
}
