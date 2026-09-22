// ===========================================================================
//  components.jsx – wiederverwendbare UI-Bausteine
// ===========================================================================
import React from "react";
import { priorityById, timeToMin, occTimeLabel } from "./data.js";

// --- Scroll-Sperre hinter Dialogen ---------------------------------------
// iOS Safari ignoriert overflow:hidden am body – daher body fixieren und die
// Scrollposition merken. Zähler, weil Dialoge verschachtelt sein können
// (z. B. Löschen-Rückfrage über dem Termin-Editor).
let scrollLocks = 0, lockedY = 0;
function lockScroll() {
  if (scrollLocks++ > 0) return;
  lockedY = window.scrollY || 0;
  const b = document.body.style;
  b.position = "fixed"; b.top = `-${lockedY}px`; b.left = "0"; b.right = "0"; b.width = "100%";
}
function unlockScroll() {
  if (scrollLocks === 0 || --scrollLocks > 0) return;
  const b = document.body.style;
  b.position = ""; b.top = ""; b.left = ""; b.right = ""; b.width = "";
  window.scrollTo(0, lockedY);
}
export function useScrollLock(active = true) {
  React.useLayoutEffect(() => {
    if (!active) return;
    lockScroll();
    return unlockScroll;
  }, [active]);
}

// --- Modal -------------------------------------------------------------
export function Modal({ t, title, onClose, children, footer, wide, hasChanges }) {
  // Bei ungespeicherten Eingaben erst nachfragen – und zwar auf JEDEM Weg nach
  // draussen: Hintergrundklick, "x" oben und der Schliessen-Knopf im Fuss.
  function requestClose() {
    if (hasChanges && hasChanges()) {
      if (typeof window !== "undefined" && !window.confirm("Änderungen verwerfen?")) return;
    }
    onClose();
  }
  useScrollLock();
  // Tastatur: Esc schließt (gleicher Weg wie der ×-Knopf, inkl. Rückfrage)
  const closeRef = React.useRef(requestClose);
  closeRef.current = requestClose;
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div onClick={requestClose} style={{
      position: "fixed", inset: 0, background: "rgba(5,10,22,.62)", zIndex: 200,
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "max(16px, env(safe-area-inset-top)) 12px 24px", overflowY: "auto",
    }}>
      <div role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}
        onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: wide ? 720 : 540, background: t.surface, color: t.text,
        borderRadius: 16, border: `1px solid ${t.border}`, boxShadow: t.shadow,
        marginTop: 24, overflow: "hidden",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", background: t.navy, color: "#fff",
        }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
          <button onClick={requestClose} aria-label="Schließen" style={{
            background: "rgba(255,255,255,.12)", color: "#fff", border: "none",
            borderRadius: 8, width: 44, height: 44, fontSize: 20, cursor: "pointer", lineHeight: 1,
            display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none",
          }}>×</button>
        </div>
        <div style={{ padding: 18 }}>{children}</div>
        {(typeof footer === "function" ? footer(requestClose) : footer) && (
          <div style={{
            padding: "12px 18px", borderTop: `1px solid ${t.border}`, background: t.surface2,
            display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap",
          }}>{typeof footer === "function" ? footer(requestClose) : footer}</div>
        )}
      </div>
    </div>
  );
}

// --- Formularfeld ------------------------------------------------------
// group = als <div role="group"> statt <label>: nötig, wenn das Feld Buttons
// enthält – ein <label> würde sonst beim Tippen auf Überschrift/Hinweis den
// ersten Button darin auslösen.
export function Field({ t, label, children, required, hint, dense, group }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag role={group ? "group" : undefined} aria-label={group && typeof label === "string" ? label : undefined}
      style={{ display: "block", marginBottom: dense ? 8 : 12 }}>
      <div style={{ fontSize: dense ? 11.5 : 12, fontWeight: 700, color: t.muted, marginBottom: dense ? 3 : 5 }}>
        {label}{required && <span style={{ color: "#E53935" }}> *</span>}
      </div>
      {children}
      {hint && <div style={{ fontSize: 11, color: t.faint, marginTop: 4 }}>{hint}</div>}
    </Tag>
  );
}

// dense = kompaktere Höhe (weniger Padding). Schrift bleibt 16px -> iOS zoomt nicht.
export function inputStyle(t, dense) {
  return {
    width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box",
    padding: dense ? "8px 11px" : "10px 12px", border: `1px solid ${t.border}`, borderRadius: 9,
    fontSize: 16, fontFamily: "inherit", background: t.input, color: t.text, outline: "none",
  };
}

export function Btn({ t, kind = "ghost", children, ...rest }) {
  // minHeight 44 = Apple-Mindestgröße für Touch-Ziele; gleich hoch wie Eingabefelder.
  const base = {
    padding: "10px 14px", borderRadius: 9, fontSize: 14, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit", border: "1px solid transparent", lineHeight: 1.1,
    minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
  };
  const styles = {
    primary: { ...base, background: t.accent, color: "#fff" },
    navy: { ...base, background: t.navy, color: "#fff" },
    ghost: { ...base, background: "transparent", color: t.text, border: `1px solid ${t.border}` },
    danger: { ...base, background: "#E53935", color: "#fff" },
    soft: { ...base, background: t.chip, color: t.text, border: `1px solid ${t.borderSoft}` },
  };
  return <button {...rest} style={{ ...(styles[kind] || styles.ghost), ...(rest.style || {}) }}>{children}</button>;
}

// --- Datums-Navigation ‹ Heute › + Titel -------------------------------
// Gemeinsam für Tag/Woche/Monat (App.jsx) und den Tab „Arbeit", damit beide
// gleich aussehen und sich gleich bedienen lassen.
export function DateNav({ t, title, onPrev, onNext, onToday, prevLabel = "Zurück", nextLabel = "Weiter", style }) {
  const arrow = { minWidth: 44, padding: "0 12px", fontSize: 20, fontWeight: 800 };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, rowGap: 6, flexWrap: "wrap", ...(style || {}) }}>
      <div style={{ display: "inline-flex", gap: 6, flex: "none" }}>
        <Btn t={t} kind="soft" onClick={onPrev} aria-label={prevLabel} title={prevLabel} style={arrow}>‹</Btn>
        <Btn t={t} kind="soft" onClick={onToday}>Heute</Btn>
        <Btn t={t} kind="soft" onClick={onNext} aria-label={nextLabel} title={nextLabel} style={arrow}>›</Btn>
      </div>
      <span aria-live="polite" style={{ fontWeight: 800, fontSize: 15, color: t.text, minWidth: 0 }}>{title}</span>
    </div>
  );
}

// --- Segmented Control -------------------------------------------------
export function Segmented({ t, options, value, onChange, small }) {
  return (
    <div style={{
      display: "inline-flex", background: t.chip, borderRadius: 10, padding: 3,
      border: `1px solid ${t.borderSoft}`, flexWrap: "wrap", gap: 2,
    }}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button key={o.id} onClick={() => onChange(o.id)} style={{
            border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
            padding: small ? "5px 9px" : "7px 13px", fontSize: small ? 12 : 13, fontWeight: 700,
            background: active ? t.accent : "transparent", color: active ? "#fff" : t.muted,
            whiteSpace: "nowrap",
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

// --- Toast -------------------------------------------------------------
export function Toast({ t, toast }) {
  if (!toast) return null;
  const bg = toast.kind === "error" ? "#E53935" : toast.kind === "warn" ? "#FB8C00" : t.navy;
  return (
    <div role={toast.kind === "error" ? "alert" : "status"} style={{
      position: "fixed", left: "50%", transform: "translateX(-50%)",
      bottom: "calc(92px + env(safe-area-inset-bottom))", zIndex: 400,
      background: bg, color: "#fff", padding: "11px 18px", borderRadius: 12,
      fontSize: 14, fontWeight: 700, boxShadow: "0 8px 24px rgba(0,0,0,.35)", maxWidth: "90vw",
    }}>{toast.msg}</div>
  );
}

// --- Suchtreffer anspringen -------------------------------------------
// Scrollt zu dem Eintrag mit der ID und hebt ihn kurz hervor. Die Listen-Module
// setzen dazu id={"hl-" + x.id} auf ihre Zeile.
export function useHighlight(highlightId, onDone, notFoundMsg) {
  React.useEffect(() => {
    if (!highlightId) return;
    // Ein Frame warten: das Modul setzt beim Öffnen ggf. noch Filter zurück,
    // damit der Treffer überhaupt gerendert wird.
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById("hl-" + highlightId);
      if (!el) { if (notFoundMsg) notFoundMsg(); if (onDone) onDone(); return; }
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const prev = el.style.boxShadow;
      el.style.transition = "box-shadow .25s ease";
      el.style.boxShadow = "0 0 0 3px #2E5BFF";
      setTimeout(() => { el.style.boxShadow = prev; }, 2200);
      // Freigeben, damit derselbe Treffer erneut angesprungen werden kann.
      if (onDone) onDone();
    });
    return () => cancelAnimationFrame(raf);
  }, [highlightId]);
}

// --- Farbpunkt ---------------------------------------------------------
export function Dot({ color, size = 10 }) {
  return <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: color, flex: "none" }} />;
}

// --- Benutzer-Avatar (farbiger Kreis mit Initiale = wer hat es eingetragen) ---
export function initials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
}
export function UserAvatar({ user, size = 22, title }) {
  if (!user) return null;
  return (
    <span title={title || `Erstellt von ${user.name}`} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: size, height: size, borderRadius: "50%", background: user.color,
      color: "#fff", fontSize: Math.round(size * 0.46), fontWeight: 800,
      flex: "none", border: "1.5px solid rgba(255,255,255,.85)", lineHeight: 1,
      boxShadow: "0 1px 3px rgba(0,0,0,.35)",
    }}>{user.avatar ? user.avatar : initials(user.name)}</span>
  );
}

// --- Teilnehmer-Punkte (wer muss dabei sein – farbige Punkte je Person) ---
export function ParticipantDots({ ev, ctx, size = 11, max = 4 }) {
  const ids = ev.participants || [];
  if (!ids.length) return null;
  const users = ids.map((id) => ctx.userById(id)).filter(Boolean).slice(0, max);
  if (!users.length) return null;
  return (
    <span title={"Dabei: " + users.map((u) => u.name).join(", ")}
      style={{ display: "inline-flex", alignItems: "center", gap: -2, flex: "none" }}>
      {users.map((u, i) => (
        <span key={u.id} style={{
          display: "inline-block", width: size, height: size, borderRadius: "50%",
          background: u.color, border: "1.5px solid rgba(255,255,255,.9)",
          marginLeft: i === 0 ? 0 : -3, boxShadow: "0 1px 2px rgba(0,0,0,.3)",
        }} />
      ))}
    </span>
  );
}

// =====================================================================
//  EventChip – kompakte Termin-Darstellung (in allen Ansichten genutzt)
// =====================================================================
export function EventChip({ t, ev, ctx, onClick, showDate, dense, conflict }) {
  const type = ctx.typeById(ev.typeId);
  // Emoji = wie in der Schnellanlage gewählt (ev.icon), sonst Terminart-Icon
  const icon = ev.icon || (type && type.icon) || "📌";
  const area = ctx.areaById(ev.areaId);
  const creator = ctx.userById(ev.creatorId);
  const prio = ev.priority ? priorityById(ev.priority) : null;
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "stretch", gap: 0, width: "100%", textAlign: "left",
      background: t.surface, border: conflict ? "1.5px solid #E53935" : `1px solid ${t.border}`, borderRadius: 10,
      cursor: "pointer", overflow: "hidden", fontFamily: "inherit", color: t.text,
      marginBottom: dense ? 4 : 0,
    }}>
      <span style={{ width: 5, background: area ? area.color : t.faint, flex: "none" }} />
      <span style={{ flex: 1, minWidth: 0, padding: dense ? "6px 9px" : "9px 11px" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          {conflict && <span title="Überschneidung" style={{ flex: "none", fontSize: dense ? 12 : 13 }}>⚠️</span>}
          <span style={{ fontSize: dense ? 14 : 16, flex: "none" }}>{icon}</span>
          <span style={{
            fontWeight: 700, fontSize: dense ? 13 : 14, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0,
          }}>{ev.title || "(ohne Titel)"}</span>
          {ev.locked && <span title="Gesperrt" style={{ flex: "none" }}>🔒</span>}
          {prio && <span title={prio.name} style={{ flex: "none", fontSize: 11 }}>{prio.dot}</span>}
          <UserAvatar user={creator} size={dense ? 20 : 24} />
        </span>
        <span style={{
          display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap",
          fontSize: 11.5, color: t.muted,
        }}>
          <span style={{ fontWeight: 700, color: t.text }}>
            {showDate ? `${ev.date.slice(8, 10)}.${ev.date.slice(5, 7)}. · ` : ""}
            {occTimeLabel(ev)}
          </span>
          {area && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Dot color={area.color} size={8} />{area.name}
          </span>}
          {creator && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{
              display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: creator.color,
            }} />{creator.name}</span>}
          {ev.participants && ev.participants.length > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10 }}>👥</span><ParticipantDots ev={ev} ctx={ctx} size={12} />
            </span>
          )}
          {ev.recurrence && ev.recurrence.freq && ev.recurrence.freq !== "none" && <span title="Wiederkehrend">🔄</span>}
          {(ev.attachments && ev.attachments.length > 0) && <span title="Anhang">📎</span>}
        </span>
      </span>
    </button>
  );
}

// Hex + Alpha -> rgba
export function hexA(hex, a) {
  const h = (hex || "#000000").replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
