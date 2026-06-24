// ===========================================================================
//  Gossip.jsx – Tratsch-Einträge: Überschrift, Notiz, Level, Area + Kommentare.
//  Cloud-synchron über alle Geräte.
// ===========================================================================
import React, { useState } from "react";
import { uid } from "./data.js";
import { Field, inputStyle, Btn, Dot } from "./components.jsx";

// Level = bewusste Steigerung (keine Alphabet-Sortierung); Leer-Option oben.
export const GOSSIP_LEVELS = [
  { id: "",                name: "– kein Level –",              emoji: "",   color: "#9DB0CE" },
  { id: "jeder",           name: "das weiß jeder",              emoji: "🤷", color: "#78909C" },
  { id: "ohaaaaa",         name: "ohaaaaa",                     emoji: "😮", color: "#43A047" },
  { id: "glaubst",         name: "das glaubst du nie",          emoji: "🤯", color: "#FB8C00" },
  { id: "staatsgeheimnis", name: "Staatsgeheimnis",             emoji: "🤫", color: "#E53935" },
  { id: "wieder",          name: "sie/er hat es wieder getan",  emoji: "🔁", color: "#8E24AA" },
];
const levelById = (id) => GOSSIP_LEVELS.find((l) => l.id === id);

// Area = alphabetisch, Leer-Option immer ganz oben.
export const GOSSIP_AREAS = [
  { id: "",          name: "– keine Area –", icon: "" },
  { id: "business",  name: "Business",  icon: "💼" },
  { id: "celebrity", name: "Celebrity", icon: "🌟" },
  { id: "others",    name: "Others",    icon: "🔖" },
  { id: "privat",    name: "Privat",    icon: "🏠" },
  { id: "worldwide", name: "Worldwide", icon: "🌍" },
];
const areaById = (id) => GOSSIP_AREAS.find((a) => a.id === id);

export function Gossip({ t, ctx, items, setItems }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [level, setLevel] = useState("");
  const [area, setArea] = useState("");
  const [editId, setEditId] = useState(null);
  const [cDraft, setCDraft] = useState({}); // Kommentar-Entwurf je Eintrag-ID
  const sel = inputStyle(t);

  function reset() { setTitle(""); setText(""); setLevel(""); setArea(""); setEditId(null); }
  function save() {
    if (!title.trim() && !text.trim()) return;
    if (editId) {
      setItems(items.map((x) => (x.id === editId ? { ...x, title: title.trim(), text: text.trim(), level, area } : x)));
    } else {
      setItems([{ id: uid("gossip"), title: title.trim(), text: text.trim(), level, area, comments: [], addedBy: ctx.activeUserId, createdAt: Date.now() }, ...items]);
    }
    reset();
  }
  function edit(x) { setTitle(x.title || ""); setText(x.text || ""); setLevel(x.level || ""); setArea(x.area || ""); setEditId(x.id); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function remove(id) { setItems(items.filter((x) => x.id !== id)); if (editId === id) reset(); }

  function addComment(id) {
    const v = (cDraft[id] || "").trim();
    if (!v) return;
    setItems(items.map((x) => (x.id === id
      ? { ...x, comments: [...(x.comments || []), { id: uid("c"), text: v, addedBy: ctx.activeUserId, createdAt: Date.now() }] }
      : x)));
    setCDraft((d) => ({ ...d, [id]: "" }));
  }
  function removeComment(id, cid) {
    setItems(items.map((x) => (x.id === id ? { ...x, comments: (x.comments || []).filter((c) => c.id !== cid) } : x)));
  }

  return (
    <div>
      <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: t.text }}>🍵 Gossip</h2>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: t.muted }}>
        Wer, was, wie heiß – kurz festhalten, einstufen und kommentieren.
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
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 150px", minWidth: 0 }}>
            <Field t={t} label="Level">
              <select style={sel} value={level} onChange={(e) => setLevel(e.target.value)}>
                {GOSSIP_LEVELS.map((l) => (
                  <option key={l.id || "none"} value={l.id}>{l.emoji ? `${l.emoji} ` : ""}{l.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <div style={{ flex: "1 1 150px", minWidth: 0 }}>
            <Field t={t} label="Area (optional)">
              <select style={sel} value={area} onChange={(e) => setArea(e.target.value)}>
                {GOSSIP_AREAS.map((a) => (
                  <option key={a.id || "none"} value={a.id}>{a.icon ? `${a.icon} ` : ""}{a.name}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>
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
            const ar = areaById(x.area);
            const who = ctx.userById && ctx.userById(x.addedBy);
            const comments = x.comments || [];
            return (
              <div key={x.id} style={{ background: t.surface, border: `1px solid ${t.border}`, borderLeft: `4px solid ${lv && lv.id ? lv.color : t.border}`, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {x.title && <div style={{ fontWeight: 800, fontSize: 15, color: t.text, wordBreak: "break-word" }}>{x.title}</div>}
                    {x.text && <div style={{ fontSize: 14, color: t.muted, marginTop: x.title ? 4 : 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{x.text}</div>}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: (x.title || x.text) ? 8 : 0 }}>
                      {lv && lv.id && (
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", background: lv.color, borderRadius: 20, padding: "3px 10px" }}>{lv.emoji} {lv.name}</span>
                      )}
                      {ar && ar.id && (
                        <span style={{ fontSize: 12, fontWeight: 700, color: t.text, background: t.chip, border: `1px solid ${t.borderSoft}`, borderRadius: 20, padding: "3px 10px" }}>{ar.icon} {ar.name}</span>
                      )}
                      {who && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: t.muted }}>
                          <Dot color={who.color} size={9} /> {who.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4, flex: "none" }}>
                    <button onClick={() => edit(x)} title="Bearbeiten" style={iconBtn}>✏️</button>
                    <button onClick={() => remove(x.id)} title="Löschen" style={iconBtn}>🗑️</button>
                  </div>
                </div>

                {/* Kommentare */}
                <div style={{ marginTop: 10, borderTop: `1px solid ${t.borderSoft}`, paddingTop: 8 }}>
                  {comments.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                      {comments.map((c) => {
                        const cWho = ctx.userById && ctx.userById(c.addedBy);
                        return (
                          <div key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 13, color: t.text }}>
                            {cWho
                              ? <span title={cWho.name} style={{ flex: "none", marginTop: 3 }}><Dot color={cWho.color} size={9} /></span>
                              : <span style={{ color: t.faint, flex: "none" }}>💬</span>}
                            <span style={{ flex: 1, minWidth: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{c.text}</span>
                            <button onClick={() => removeComment(x.id, c.id)} aria-label="Kommentar löschen"
                              style={{ background: "none", border: "none", color: t.faint, cursor: "pointer", fontSize: 15, flex: "none", lineHeight: 1 }}>×</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6 }}>
                    <input style={{ ...sel, flex: 1, padding: "7px 10px" }} value={cDraft[x.id] || ""}
                      onChange={(e) => setCDraft((d) => ({ ...d, [x.id]: e.target.value }))}
                      placeholder="Kommentar hinzufügen …"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addComment(x.id); } }} />
                    <Btn t={t} kind="soft" onClick={() => addComment(x.id)} style={{ flex: "none" }}>＋</Btn>
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
