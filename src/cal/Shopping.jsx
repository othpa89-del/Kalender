// ===========================================================================
//  Shopping.jsx – Einkaufsliste
//  Einfach, aber praktisch: eintragen, Menge, häufige Artikel, automatische
//  Kategorien, abhaken, bearbeiten, „wer hat's eingetragen", Sammel-Aktionen.
//  Cloud-synchron über alle Geräte.
// ===========================================================================
import React, { useState } from "react";
import { uid } from "./data.js";
import { inputStyle, Btn, Dot } from "./components.jsx";

// Häufige Artikel als Schnell-Buttons
const COMMON = ["Milch", "Brot", "Eier", "Butter", "Käse", "Joghurt", "Bananen", "Äpfel", "Tomaten", "Kaffee", "Nudeln", "Klopapier"];

// Automatische Kategorien per Stichwort (Reihenfolge = Anzeigereihenfolge)
const CATEGORIES = [
  { id: "obst", name: "Obst & Gemüse", icon: "🥦", keys: ["apfel","äpfel","banane","tomate","gurke","salat","zwiebel","kartoffel","karotte","möhre","paprika","zitrone","orange","beere","erdbeere","traube","birne","brokkoli","spinat","knoblauch","avocado","mango","melone","pilz","champignon","gemüse","obst","zucchini","aubergine","lauch","sellerie","ingwer","zitron","limette","kiwi","pfirsich","kirsche"] },
  { id: "molkerei", name: "Kühlregal & Molkerei", icon: "🧀", keys: ["milch","butter","käse","joghurt","jogurt","quark","sahne","ei","eier","frischkäse","mozzarella","schmand","margarine","pudding","topfen","obers"] },
  { id: "fleisch", name: "Fleisch & Fisch", icon: "🥩", keys: ["fleisch","wurst","schinken","hähnchen","huhn","hühn","rind","schwein","hack","faschiert","speck","salami","steak","schnitzel","fisch","lachs","thunfisch","leberkäse","frankfurter"] },
  { id: "backwaren", name: "Backwaren", icon: "🥖", keys: ["brot","brötchen","semmel","baguette","toast","croissant","kuchen","gebäck","mehl","hefe","weckerl","kipferl"] },
  { id: "getränke", name: "Getränke", icon: "🥤", keys: ["wasser","saft","cola","limo","limonade","bier","wein","kaffee","tee","sprudel","getränk","spezi","fanta","sekt","almdudler","mineral"] },
  { id: "tiefkühl", name: "Tiefkühl", icon: "🧊", keys: ["tiefkühl","tk","pizza","eis","pommes"] },
  { id: "drogerie", name: "Drogerie & Haushalt", icon: "🧼", keys: ["zahnpasta","zahnbürste","shampoo","duschgel","seife","klopapier","toilettenpapier","windel","waschmittel","spülmittel","putz","müllbeutel","müllsack","taschentücher","taschentuch","creme","deo","rasier","binden","tampon","watte","papier","schwamm","alufolie","frischhalte"] },
  { id: "vorrat", name: "Vorrat & Trocken", icon: "🥫", keys: ["nudel","pasta","reis","zucker","salz","öl","essig","konserve","dose","tomatenmark","ketchup","senf","mayo","gewürz","müsli","cornflakes","haferflocken","schokolade","schoko","keks","chips","honig","marmelade","nutella","suppe","knödel","pfeffer"] },
];
const OTHER = { id: "sonstiges", name: "Sonstiges", icon: "🛒" };

function categorize(text) {
  const s = (text || "").toLowerCase();
  for (const c of CATEGORIES) if (c.keys.some((k) => s.includes(k))) return c;
  return OTHER;
}

export function Shopping({ t, ctx, items, setItems }) {
  const [text, setText] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const sel = inputStyle(t);

  function addItem(name) {
    const v = (name || "").trim();
    if (!v) return;
    setItems([{ id: uid("shop"), text: v, done: false, addedBy: ctx.activeUserId, createdAt: Date.now() }, ...items]);
  }
  function addFromInput() { addItem(text); setText(""); }
  function toggle(id) { setItems(items.map((x) => (x.id === id ? { ...x, done: !x.done } : x))); }
  function remove(id) { setItems(items.filter((x) => x.id !== id)); }
  function checkAll() { setItems(items.map((x) => ({ ...x, done: true }))); }
  function clearDone() { setItems(items.filter((x) => !x.done)); }
  function clearAll() {
    if (typeof window !== "undefined" && !window.confirm("Die ganze Einkaufsliste leeren?")) return;
    setItems([]);
  }
  function startEdit(x) { setEditId(x.id); setEditText(x.text); }
  function commitEdit() {
    if (editId) {
      const v = editText.trim();
      if (v) setItems(items.map((i) => (i.id === editId ? { ...i, text: v } : i)));
    }
    setEditId(null); setEditText("");
  }

  const open = items.filter((x) => !x.done);
  const done = items.filter((x) => x.done);

  // offene Artikel nach Kategorie gruppieren
  const groups = [...CATEGORIES, OTHER].map((c) => ({
    cat: c, list: open.filter((x) => categorize(x.text).id === c.id),
  })).filter((g) => g.list.length);

  const Item = ({ x }) => {
    const who = ctx.userById && ctx.userById(x.addedBy);
    const editing = editId === x.id;
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 10, background: t.surface,
        border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px",
      }}>
        <input type="checkbox" checked={x.done} onChange={() => toggle(x.id)}
          style={{ width: 22, height: 22, accentColor: t.accent, flex: "none", cursor: "pointer" }} />
        {editing ? (
          <input autoFocus value={editText} onChange={(e) => setEditText(e.target.value)}
            onBlur={commitEdit} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitEdit(); } }}
            style={{ ...sel, flex: 1, padding: "6px 9px" }} />
        ) : (
          <span onClick={() => startEdit(x)} style={{
            flex: 1, minWidth: 0, fontSize: 16, color: t.text, cursor: "text", wordBreak: "break-word",
            textDecoration: x.done ? "line-through" : "none", opacity: x.done ? 0.55 : 1,
          }}>{x.text}</span>
        )}
        {who && !editing && <span title={`Hinzugefügt von ${who.name}`} style={{ flex: "none" }}><Dot color={who.color} size={9} /></span>}
        {editing ? (
          <button onClick={commitEdit} aria-label="Fertig" style={{
            background: "none", border: "none", color: t.accent, cursor: "pointer", fontSize: 16, flex: "none", lineHeight: 1, padding: 2,
          }}>✓</button>
        ) : (
          <button onClick={() => startEdit(x)} aria-label="Bearbeiten" style={{
            background: "none", border: "none", cursor: "pointer", fontSize: 15, flex: "none", lineHeight: 1, padding: 2,
          }}>✏️</button>
        )}
        <button onClick={() => remove(x.id)} aria-label="Löschen" style={{
          background: "none", border: "none", color: t.faint, cursor: "pointer", fontSize: 20, flex: "none", lineHeight: 1, padding: 2,
        }}>×</button>
      </div>
    );
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 800, color: t.text }}>🛒 Einkaufsliste</h2>

      {/* Häufige Artikel */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {COMMON.map((c) => (
          <button key={c} onClick={() => addItem(c)} style={{
            background: t.chip, color: t.text, border: `1px solid ${t.borderSoft}`, borderRadius: 18,
            padding: "6px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>+ {c}</button>
        ))}
      </div>

      {/* Eingabe */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input style={{ ...sel, flex: 1 }} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Was wird benötigt?" enterKeyHint="done"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFromInput(); } }} />
        <Btn t={t} kind="primary" onClick={addFromInput} style={{ fontSize: 22, padding: "0 16px", flex: "none" }}>+</Btn>
      </div>

      {/* Sammel-Aktionen */}
      {items.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 14 }}>
          {open.length > 0 && <ActionLink t={t} onClick={checkAll}>✓ Alle abhaken</ActionLink>}
          {done.length > 0 && <ActionLink t={t} onClick={clearDone}>Erledigte entfernen ({done.length})</ActionLink>}
          <ActionLink t={t} danger onClick={clearAll}>Liste leeren</ActionLink>
        </div>
      )}

      {items.length === 0 ? (
        <div style={{ textAlign: "center", color: t.faint, padding: "40px 16px", fontSize: 14 }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>🛒</div>
          Noch nichts auf der Liste. Oben eintragen oder einen häufigen Artikel tippen.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* offene Artikel nach Kategorie */}
          {groups.map((g) => (
            <div key={g.cat.id}>
              <div style={{ fontSize: 12, fontWeight: 800, color: t.muted, letterSpacing: ".02em", marginBottom: 6 }}>
                {g.cat.icon} {g.cat.name.toUpperCase()} ({g.list.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {g.list.map((x) => <Item key={x.id} x={x} />)}
              </div>
            </div>
          ))}

          {/* erledigte Artikel */}
          {done.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: t.muted, letterSpacing: ".02em", marginBottom: 6 }}>
                ERLEDIGT ({done.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {done.map((x) => <Item key={x.id} x={x} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActionLink({ t, children, onClick, danger }) {
  return (
    <button onClick={onClick} style={{
      background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit",
      fontSize: 13, fontWeight: 700, color: danger ? "#E53935" : t.accent,
    }}>{children}</button>
  );
}
