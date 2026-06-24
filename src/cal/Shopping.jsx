// ===========================================================================
//  Shopping.jsx – Einkaufsliste (ganz einfach: eintragen, abhaken, löschen)
//  Daten liegen pro Konto in der Cloud (Supabase) und synchronisieren live.
// ===========================================================================
import React, { useState } from "react";
import { uid } from "./data.js";
import { inputStyle, Btn } from "./components.jsx";

export function Shopping({ t, items, setItems }) {
  const [text, setText] = useState("");
  const sel = inputStyle(t);

  function add() {
    const v = text.trim();
    if (!v) return;
    // neuestes oben
    setItems([{ id: uid("shop"), text: v, done: false, createdAt: Date.now() }, ...items]);
    setText("");
  }
  function toggle(id) { setItems(items.map((x) => (x.id === id ? { ...x, done: !x.done } : x))); }
  function remove(id) { setItems(items.filter((x) => x.id !== id)); }
  function clearDone() { setItems(items.filter((x) => !x.done)); }

  const open = items.filter((x) => !x.done);
  const done = items.filter((x) => x.done);

  const Row = ({ x }) => (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, background: t.surface,
      border: `1px solid ${t.border}`, borderRadius: 10, padding: "11px 12px",
    }}>
      <input type="checkbox" checked={x.done} onChange={() => toggle(x.id)}
        style={{ width: 22, height: 22, accentColor: t.accent, flex: "none", cursor: "pointer" }} />
      <span style={{
        flex: 1, minWidth: 0, fontSize: 16, color: t.text, wordBreak: "break-word",
        textDecoration: x.done ? "line-through" : "none", opacity: x.done ? 0.55 : 1,
      }}>{x.text}</span>
      <button onClick={() => remove(x.id)} aria-label="Löschen" style={{
        background: "none", border: "none", color: t.faint, cursor: "pointer", fontSize: 20, flex: "none", lineHeight: 1, padding: 4,
      }}>×</button>
    </div>
  );

  return (
    <div>
      <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 800, color: t.text }}>🛒 Einkaufsliste</h2>

      {/* Eingabe */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input style={{ ...sel, flex: 1 }} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Was wird benötigt?" enterKeyHint="done"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <Btn t={t} kind="primary" onClick={add} style={{ fontSize: 22, padding: "0 18px", flex: "none" }}>+</Btn>
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: "center", color: t.faint, padding: "40px 16px", fontSize: 14 }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>🛒</div>
          Noch nichts auf der Liste. Oben eintragen und „+" tippen.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {open.map((x) => <Row key={x.id} x={x} />)}

          {done.length > 0 && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "12px 2px 2px" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: t.muted, letterSpacing: ".03em" }}>
                  ERLEDIGT ({done.length})
                </span>
                <button onClick={clearDone} style={{
                  background: "none", border: "none", color: t.accent, fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}>Erledigte entfernen</button>
              </div>
              {done.map((x) => <Row key={x.id} x={x} />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
