// ===========================================================================
//  NiceToKnow.jsx – einfache Notizen ("Dinge, die man sich merken sollte")
//  Überschrift + Notizfeld + optionale Rubrik. Cloud-synchron.
// ===========================================================================
import React, { useState } from "react";
import { uid } from "./data.js";
import { Field, inputStyle, Btn, Dot } from "./components.jsx";

// Rubriken: alphabetisch, Leer-Option immer ganz oben.
export const NTK_RUBRIKEN = [
  { id: "",           name: "– keine Rubrik –", icon: "" },
  { id: "auto",       name: "Auto",        icon: "🚗" },
  { id: "diverses",   name: "Diverses",    icon: "🗂️" },
  { id: "elektronik", name: "Elektronik",  icon: "🔌" },
  { id: "event",      name: "Event",       icon: "🎉" },
  { id: "garten",     name: "Garten",      icon: "🌳" },
  { id: "haus",       name: "Haus",        icon: "🏠" },
  { id: "hotel",      name: "Hotel",       icon: "🏨" },
  { id: "kinder",     name: "Kinder",      icon: "🧸" },
  { id: "ort",        name: "Land/Ort",    icon: "📍" },
  { id: "restaurant", name: "Restaurant",  icon: "🍽️" },
  { id: "schoenheit", name: "Schönheit",   icon: "💄" },
];
const rubrikById = (id) => NTK_RUBRIKEN.find((r) => r.id === id);

export function NiceToKnow({ t, ctx, items, setItems }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [rubrik, setRubrik] = useState("");
  const [editId, setEditId] = useState(null);
  const sel = inputStyle(t);

  function reset() { setTitle(""); setText(""); setRubrik(""); setEditId(null); }
  function save() {
    if (!title.trim() && !text.trim()) return;
    if (editId) {
      setItems(items.map((x) => (x.id === editId ? { ...x, title: title.trim(), text: text.trim(), rubrik } : x)));
    } else {
      setItems([{ id: uid("note"), title: title.trim(), text: text.trim(), rubrik, addedBy: ctx.activeUserId, createdAt: Date.now() }, ...items]);
    }
    reset();
  }
  function edit(x) { setTitle(x.title || ""); setText(x.text || ""); setRubrik(x.rubrik || ""); setEditId(x.id); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function remove(id) { setItems(items.filter((x) => x.id !== id)); if (editId === id) reset(); }

  return (
    <div>
      <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: t.text }}>💡 Nice to know</h2>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: t.muted }}>
        Dinge, die man sich merken sollte – einfach notieren.
      </p>

      {/* Eingabe */}
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 14, marginBottom: 18 }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10, color: t.text }}>{editId ? "Notiz bearbeiten" : "Neue Notiz"}</div>
        <Field t={t} label="Überschrift">
          <input style={sel} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. WLAN-Passwort" />
        </Field>
        <Field t={t} label="Notiz">
          <textarea style={{ ...sel, minHeight: 90, resize: "vertical" }} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Was möchtest du dir merken?" />
        </Field>
        <Field t={t} label="Rubrik (optional)">
          <select style={sel} value={rubrik} onChange={(e) => setRubrik(e.target.value)}>
            {NTK_RUBRIKEN.map((r) => (
              <option key={r.id || "none"} value={r.id}>{r.icon ? `${r.icon} ` : ""}{r.name}</option>
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
          <div style={{ fontSize: 30, marginBottom: 8 }}>💡</div>
          Noch keine Notizen. Oben etwas eintragen.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((x) => {
            const r = rubrikById(x.rubrik);
            const who = ctx.userById && ctx.userById(x.addedBy);
            return (
              <div key={x.id} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {x.title && <div style={{ fontWeight: 800, fontSize: 15, color: t.text, wordBreak: "break-word" }}>{x.title}</div>}
                    {x.text && <div style={{ fontSize: 14, color: t.muted, marginTop: x.title ? 4 : 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{x.text}</div>}
                    {r && r.id && (
                      <span style={{ display: "inline-block", marginTop: 8, fontSize: 12, fontWeight: 700, color: t.text, background: t.chip, border: `1px solid ${t.borderSoft}`, borderRadius: 20, padding: "3px 10px" }}>
                        {r.icon} {r.name}
                      </span>
                    )}
                    {who && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8, fontSize: 12, color: t.muted }}>
                        <Dot color={who.color} size={9} /> {who.name}
                      </div>
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
