// ===========================================================================
//  Gossip.jsx – Tratsch-Notizen mit Überschrift, Notiz und Level-Einstufung.
//  Cloud-synchron über alle Geräte.
// ===========================================================================
import React, { useState } from "react";
import { uid } from "./data.js";
import { Field, inputStyle, Btn } from "./components.jsx";

// Level-Stufen (erste Option = leere Zelle / kein Level)
export const GOSSIP_LEVELS = [
  { id: "",                name: "– kein Level –",              emoji: "",   color: "#9DB0CE" },
  { id: "jeder",           name: "das weiß jeder",              emoji: "🤷", color: "#78909C" },
  { id: "ohaaaaa",         name: "ohaaaaa",                     emoji: "😮", color: "#43A047" },
  { id: "glaubst",         name: "das glaubst du nie",          emoji: "🤯", color: "#FB8C00" },
  { id: "staatsgeheimnis", name: "Staatsgeheimnis",             emoji: "🤫", color: "#E53935" },
  { id: "wieder",          name: "sie/er hat es wieder getan",  emoji: "🔁", color: "#8E24AA" },
];
const levelById = (id) => GOSSIP_LEVELS.find((l) => l.id === id);

export function Gossip({ t, items, setItems }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [level, setLevel] = useState("");
  const [editId, setEditId] = useState(null);
  const sel = inputStyle(t);

  function reset() { setTitle(""); setText(""); setLevel(""); setEditId(null); }
  function save() {
    if (!title.trim() && !text.trim()) return;
    if (editId) {
      setItems(items.map((x) => (x.id === editId ? { ...x, title: title.trim(), text: text.trim(), level } : x)));
    } else {
      setItems([{ id: uid("gossip"), title: title.trim(), text: text.trim(), level, createdAt: Date.now() }, ...items]);
    }
    reset();
  }
  function edit(x) { setTitle(x.title || ""); setText(x.text || ""); setLevel(x.level || ""); setEditId(x.id); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function remove(id) { setItems(items.filter((x) => x.id !== id)); if (editId === id) reset(); }

  return (
    <div>
      <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: t.text }}>🍵 Gossip</h2>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: t.muted }}>
        Wer, was, wie heiß – kurz festhalten und einstufen.
      </p>

      {/* Eingabe */}
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 14, marginBottom: 18 }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10, color: t.text }}>{editId ? "Eintrag bearbeiten" : "Neuer Eintrag"}</div>
        <Field t={t} label="Überschrift">
          <input style={sel} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Worum geht's?" />
        </Field>
        <Field t={t} label="Notiz">
          <textarea style={{ ...sel, minHeight: 80, resize: "vertical" }} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Die Details …" />
        </Field>
        <Field t={t} label="Level">
          <select style={sel} value={level} onChange={(e) => setLevel(e.target.value)}>
            {GOSSIP_LEVELS.map((l) => (
              <option key={l.id || "none"} value={l.id}>{l.emoji ? `${l.emoji} ` : ""}{l.name}</option>
            ))}
          </select>
        </Field>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {editId && <Btn t={t} kind="ghost" onClick={reset}>Abbrechen</Btn>}
          <Btn t={t} kind="primary" onClick={save}>{editId ? "Speichern" : "Hinzufügen"}</Btn>
        </div>
      </div>

      {/* Liste */}
      {items.length === 0 ? (
        <div style={{ textAlign: "center", color: t.faint, padding: "40px 16px", fontSize: 14 }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>🍵</div>
          Noch kein Gossip. Oben eintragen.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((x) => {
            const lv = levelById(x.level);
            return (
              <div key={x.id} style={{ background: t.surface, border: `1px solid ${t.border}`, borderLeft: `4px solid ${lv && lv.id ? lv.color : t.border}`, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {x.title && <div style={{ fontWeight: 800, fontSize: 15, color: t.text, wordBreak: "break-word" }}>{x.title}</div>}
                    {x.text && <div style={{ fontSize: 14, color: t.muted, marginTop: x.title ? 4 : 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{x.text}</div>}
                    {lv && lv.id && (
                      <span style={{
                        display: "inline-block", marginTop: 8, fontSize: 12, fontWeight: 800,
                        color: "#fff", background: lv.color, borderRadius: 20, padding: "3px 10px",
                      }}>{lv.emoji} {lv.name}</span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 4, flex: "none" }}>
                    <button onClick={() => edit(x)} title="Bearbeiten" style={iconBtn}>✏️</button>
                    <button onClick={() => remove(x.id)} title="Löschen" style={iconBtn}>🗑️</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const iconBtn = { background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 3, borderRadius: 6, lineHeight: 1 };
