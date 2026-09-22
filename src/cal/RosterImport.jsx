// ===========================================================================
//  RosterImport.jsx – Dienstplan (ICS-Datei) importieren
//  Datei wählen -> Vorschau mit erkannter Kategorie -> ausgewählte übernehmen.
//  Erneuter Import desselben Plans aktualisiert statt zu verdoppeln (UID).
// ===========================================================================
import React, { useMemo, useRef, useState } from "react";
import { Modal, Btn, inputStyle } from "./components.jsx";
import { WEEKDAYS, parseISODate, todayISO, uid, WORK_CATEGORIES, workCategoryOf } from "./data.js";
import { parseICS, rosterCategory, isOffDay, categoryById } from "./ics.js";

const STATUS = {
  neu: { label: "neu", color: "#2FA36B" },
  geaendert: { label: "geändert", color: "#FB8C00" },
  gleich: { label: "vorhanden", color: "#64748B" },
  entfaellt: { label: "entfällt", color: "#E53935" },
};

// Schlüssel eines Eintrags: UID, bei mehrfach vorkommender UID (Serien-
// Ausnahmen) plus Datum; ohne UID aus Titel/Datum/Zeit.
function entryKeys(entries) {
  const count = {};
  for (const e of entries) if (e.uid) count[e.uid] = (count[e.uid] || 0) + 1;
  return entries.map((e) => (e.uid
    ? (count[e.uid] > 1 ? `${e.uid}#${e.date}` : e.uid)
    : `noid:${e.title.toLowerCase()}|${e.date}|${e.start}`));
}

function sameCore(ev, e) {
  return ev.title === e.title && ev.date === e.date && ev.endDate === e.endDate
    && !!ev.allDay === e.allDay && (e.allDay || (ev.start === e.start && ev.end === e.end))
    && (!e.location || ev.location === e.location);
}

export function RosterImport({ t, events, areas, blank, onApply, onClose }) {
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [rows, setRows] = useState(null); // null = noch keine Datei
  const [onlyFuture, setOnlyFuture] = useState(true);
  const [showSame, setShowSame] = useState(false);
  const activeAreas = areas.filter((a) => a.active !== false);
  const [areaId, setAreaId] = useState(() => {
    const ew = activeAreas.find((a) => /eurowings/i.test(a.name));
    return (ew || activeAreas.find((a) => a.id === "a_privat") || activeAreas[0] || {}).id || "a_privat";
  });
  const today = todayISO();

  function readFile(file) {
    if (!file) return;
    setError(""); setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      let entries;
      try { entries = parseICS(String(reader.result || "")); }
      catch { setError("Die Datei konnte nicht gelesen werden."); setRows(null); return; }
      if (!/BEGIN:VCALENDAR/i.test(String(reader.result || ""))) {
        setError("Das ist keine Kalenderdatei (.ics)."); setRows(null); return;
      }
      setRows(buildRows(entries));
    };
    reader.onerror = () => setError("Die Datei konnte nicht gelesen werden.");
    reader.readAsText(file);
  }

  function buildRows(entries) {
    const byUid = new Map();
    for (const ev of events) {
      if (ev.icsUid) byUid.set(ev.icsUid, ev);
      byUid.set(`${ev.id}@kalender-app`, ev); // eigener ICS-Export
    }
    const keys = entryKeys(entries);
    const out = [];
    entries.forEach((e, i) => {
      const key = keys[i];
      let existing = byUid.get(key) || (e.uid && byUid.get(e.uid)) || null;
      // Von Hand eingetragen? Gleicher Titel, Tag und Beginn = derselbe Termin.
      if (!existing) {
        existing = events.find((ev) => ev.date === e.date && (ev.start || "") === (e.start || "")
          && String(ev.title || "").trim().toLowerCase() === e.title.trim().toLowerCase()) || null;
      }
      let status;
      if (e.cancelled) { if (!existing) return; status = "entfaellt"; }
      else status = !existing ? "neu" : sameCore(existing, e) ? "gleich" : "geaendert";
      // Nicht erkannt, aber schon im Kalender? Dann dessen Kategorie übernehmen.
      const known = existing && workCategoryOf(existing);
      const cat = rosterCategory(e) || (known ? known.id : "");
      const off = isOffDay(e);
      out.push({
        key, entry: e, existing, status, cat,
        // Vorauswahl: Neues/Geändertes/Entfallenes, sofern als Dienst erkannt
        selected: status !== "gleich" && (status === "entfaellt" || (!!cat && !off)),
      });
    });
    return out;
  }

  const visible = useMemo(() => (rows || []).filter((r) =>
    (!onlyFuture || r.entry.endDate >= today) && (showSame || r.status !== "gleich")), [rows, onlyFuture, showSame, today]);
  const sameHidden = (rows || []).filter((r) => r.status === "gleich" && (!onlyFuture || r.entry.endDate >= today)).length;
  const chosen = visible.filter((r) => r.selected);

  const setRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const allOn = visible.length > 0 && visible.every((r) => r.selected);
  const toggleAll = () => {
    const keys = new Set(visible.map((r) => r.key));
    setRows((rs) => rs.map((r) => (keys.has(r.key) ? { ...r, selected: !allOn } : r)));
  };

  function apply() {
    const now = Date.now();
    let next = [...events];
    const n = { neu: 0, geaendert: 0, entfaellt: 0 };
    for (const r of chosen) {
      const e = r.entry;
      if (r.status === "entfaellt") { next = next.filter((x) => x.id !== r.existing.id); n.entfaellt++; continue; }
      const cat = categoryById(r.cat);
      const fields = {
        title: e.title, date: e.date, endDate: e.endDate, start: e.start, end: e.end, allDay: e.allDay,
        icsUid: r.key,
        ...(cat ? { icon: cat.icon } : {}),
        ...(e.location ? { location: e.location } : {}),
        ...(e.description ? { description: e.description } : {}),
      };
      if (r.existing) {
        next = next.map((x) => (x.id === r.existing.id ? { ...x, ...fields, updatedAt: now } : x));
        n.geaendert++;
      } else {
        next.push({ ...blank(), ...fields, areaId, id: uid("ev"), createdAt: now, updatedAt: now });
        n.neu++;
      }
    }
    onApply(next, n);
  }

  const sel = inputStyle(t, true);
  const fmtRow = (e) => {
    const d = parseISODate(e.date);
    const wd = WEEKDAYS[(d.getDay() + 6) % 7];
    const dd = `${wd} ${e.date.slice(8, 10)}.${e.date.slice(5, 7)}.`;
    const multi = e.endDate > e.date ? ` – ${e.endDate.slice(8, 10)}.${e.endDate.slice(5, 7)}.` : "";
    const time = e.allDay ? "ganztägig" : `${e.start}–${e.end}`;
    return { dd: dd + multi, time };
  };

  return (
    <Modal t={t} wide title="Dienstplan importieren" onClose={onClose}
      hasChanges={() => chosen.length > 0}
      footer={(close) => (
        <>
          <Btn t={t} kind="ghost" onClick={close}>Abbrechen</Btn>
          <Btn t={t} kind="primary" disabled={!rows || chosen.length === 0} onClick={apply}
            style={{ opacity: !rows || chosen.length === 0 ? 0.5 : 1 }}>
            {chosen.length === 1 ? "1 Eintrag übernehmen" : `${chosen.length} Einträge übernehmen`}
          </Btn>
        </>
      )}>
      <input ref={fileRef} type="file" accept=".ics,text/calendar" style={{ display: "none" }}
        onChange={(e) => { readFile(e.target.files && e.target.files[0]); e.target.value = ""; }} />

      {/* Datei wählen */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <Btn t={t} kind={rows ? "soft" : "primary"} onClick={() => fileRef.current && fileRef.current.click()}>
          📂 {rows ? "Andere Datei" : "ICS-Datei auswählen"}
        </Btn>
        {fileName && <span style={{ fontSize: 13, color: t.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{fileName}</span>}
      </div>
      {!rows && !error && (
        <div style={{ fontSize: 13.5, color: t.muted, lineHeight: 1.5 }}>
          Exportiere deinen Dienstplan aus der Crew-App oder aus Outlook als <b>.ics</b>-Datei
          (oder schick ihn dir per Mail und sichere den Anhang in „Dateien“). Die Einträge werden
          automatisch als <b>Eurowings</b>, <b>Flug</b> oder <b>Simulator</b> erkannt – du siehst vor dem
          Übernehmen eine Vorschau. Ein erneuter Import aktualisiert geänderte Dienste, statt sie doppelt anzulegen.
        </div>
      )}
      {error && <div role="alert" style={{ fontSize: 13.5, color: "#E53935", fontWeight: 700 }}>{error}</div>}

      {rows && (
        <>
          {/* Optionen */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 3, flex: "1 1 160px", minWidth: 0 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: t.muted }}>Bereich für neue Einträge</span>
              <select style={sel} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                {activeAreas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, fontSize: 13.5, fontWeight: 700, color: t.text, cursor: "pointer" }}>
              <input type="checkbox" checked={onlyFuture} onChange={(e) => setOnlyFuture(e.target.checked)} style={{ width: 20, height: 20 }} />
              Nur ab heute
            </label>
          </div>

          {/* Zusammenfassung */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8, fontSize: 13, color: t.muted }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              {visible.length === 0
                ? (rows.length === 0 ? "Keine Termine in der Datei gefunden." : "Nichts Neues – alles schon im Kalender.")
                : `${visible.length} Einträge · ${chosen.length} ausgewählt`}
            </span>
            {visible.length > 0 && (
              <button onClick={toggleAll} style={{ background: "none", border: "none", color: t.accentText || t.accent, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", minHeight: 44, padding: "0 4px" }}>
                {allOn ? "Keine auswählen" : "Alle auswählen"}
              </button>
            )}
          </div>

          {/* Einträge */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {visible.map((r) => {
              const e = r.entry, f = fmtRow(e), st = STATUS[r.status];
              const cat = categoryById(r.cat);
              return (
                <div key={r.key} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "6px 8px 6px 4px",
                  border: `1px solid ${r.selected ? t.accent : t.border}`, borderRadius: 10,
                  background: t.surface, opacity: r.selected ? 1 : 0.7,
                }}>
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, minHeight: 44, flex: "none", cursor: "pointer" }}>
                    <input type="checkbox" checked={r.selected} aria-label={`${e.title} übernehmen`}
                      onChange={(ev) => setRow(r.key, { selected: ev.target.checked })} style={{ width: 20, height: 20 }} />
                  </label>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <span aria-hidden style={{ flex: "none" }}>{cat ? cat.icon : "📌"}</span>
                      <span style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{e.title}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 2, fontSize: 12, color: t.muted }}>
                      <span style={{ fontWeight: 700, color: t.text }}>{f.dd} · {f.time}</span>
                      <span style={{ color: "#fff", background: st.color, borderRadius: 6, padding: "0 6px", fontWeight: 800, fontSize: 11 }}>{st.label}</span>
                      {e.recurring && <span title="Nur der erste Termin der Serie wird übernommen">🔁 nur 1. Termin</span>}
                      {e.location && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>📍 {e.location}</span>}
                    </div>
                  </div>
                  {r.status !== "entfaellt" && (
                    <select value={r.cat} aria-label="Kategorie" onChange={(ev) => setRow(r.key, { cat: ev.target.value })}
                      style={{ ...sel, width: "auto", maxWidth: 130, flex: "none", padding: "8px 6px" }}>
                      {WORK_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      <option value="">Sonstiges</option>
                    </select>
                  )}
                </div>
              );
            })}
          </div>
          {sameHidden > 0 && (
            <button onClick={() => setShowSame((v) => !v)} style={{ marginTop: 8, background: "none", border: "none", color: t.accentText || t.accent, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", minHeight: 44, padding: 0 }}>
              {showSame ? "Vorhandene ausblenden" : `${sameHidden} bereits vorhandene anzeigen`}
            </button>
          )}
        </>
      )}
    </Modal>
  );
}
