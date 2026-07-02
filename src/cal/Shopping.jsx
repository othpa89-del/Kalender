// ===========================================================================
//  Shopping.jsx – Einkaufsliste
//  Einfach, aber praktisch: eintragen, Menge, häufige Artikel, automatische
//  Kategorien, abhaken, bearbeiten, „wer hat's eingetragen", Sammel-Aktionen.
//  Cloud-synchron über alle Geräte.
// ===========================================================================
import React, { useState, useRef } from "react";
import { uid } from "./data.js";
import { inputStyle, Btn, Dot } from "./components.jsx";

// Kategorien (alphabetisch). Beim Hinzufügen wählbar; ohne Auswahl wird per
// Stichwort automatisch einsortiert.
const CATEGORIES = [
  { id: "alkohol", name: "Alkohol", icon: "🍷", keys: ["alkohol","bier","wein","sekt","prosecco","schnaps","wodka","vodka","whisky","whiskey","gin","rum","aperol","spritzer","likör","radler","weinbrand","jägermeister"] },
  { id: "backwaren", name: "Backwaren", icon: "🥖", keys: ["brot","brötchen","semmel","baguette","toast","croissant","kuchen","gebäck","mehl","hefe","weckerl","kipferl"] },
  { id: "drogerie", name: "Drogerie & Haushalt", icon: "🧼", keys: ["zahnpasta","zahnbürste","shampoo","duschgel","seife","klopapier","toilettenpapier","windel","waschmittel","spülmittel","putz","müllbeutel","müllsack","taschentücher","taschentuch","creme","deo","rasier","binden","tampon","watte","papier","schwamm","alufolie","frischhalte"] },
  { id: "fleisch", name: "Fleisch & Fisch", icon: "🥩", keys: ["fleisch","hähnchen","huhn","hühn","rind","schwein","hack","faschiert","steak","schnitzel","fisch","lachs","thunfisch","hendl","pute"] },
  { id: "getränke", name: "Getränke", icon: "🥤", keys: ["wasser","saft","cola","limo","limonade","kaffee","tee","sprudel","getränk","spezi","fanta","almdudler","mineral"] },
  { id: "molkerei", name: "Kühlregal & Molkerei", icon: "🥛", keys: ["milch","butter","joghurt","jogurt","quark","sahne","eier","schmand","margarine","pudding","topfen","obers"] },
  { id: "newspaper", name: "Newspaper", icon: "📰", keys: ["newspaper","zeitung","zeitschrift","magazin","krone","kurier","presse"] },
  { id: "obst", name: "Obst & Gemüse", icon: "🥦", keys: ["apfel","äpfel","banane","tomate","gurke","salat","zwiebel","kartoffel","karotte","möhre","paprika","zitrone","orange","beere","erdbeere","traube","birne","brokkoli","spinat","knoblauch","avocado","mango","melone","pilz","champignon","gemüse","obst","zucchini","aubergine","lauch","sellerie","ingwer","zitron","limette","kiwi","pfirsich","kirsche"] },
  { id: "tiefkühl", name: "Tiefkühl", icon: "🧊", keys: ["tiefkühl","pizza","pommes","speiseeis","fischstäbchen"] },
  { id: "vorrat", name: "Vorrat & Trocken", icon: "🥫", keys: ["nudel","pasta","reis","zucker","salz","öl","essig","konserve","dose","tomatenmark","ketchup","senf","mayo","gewürz","müsli","cornflakes","haferflocken","schokolade","schoko","keks","chips","honig","marmelade","nutella","suppe","knödel","pfeffer"] },
  { id: "wurstkaese", name: "Wurst & Käse", icon: "🧀", keys: ["wurst","schinken","salami","leberkäse","frankfurter","speck","aufschnitt","extrawurst","käse","frischkäse","mozzarella","gouda","emmentaler","bergkäse","parmesan","leberwurst","bratwurst"] },
];
const OTHER = { id: "sonstiges", name: "Sonstiges", icon: "🛒" };
const ALL_CATS = [...CATEGORIES, OTHER];
const categoryById = (id) => ALL_CATS.find((c) => c.id === id);

function categorize(text) {
  const s = (text || "").toLowerCase();
  for (const c of CATEGORIES) if (c.keys.some((k) => s.includes(k))) return c;
  return OTHER;
}
// Kategorie eines Artikels: manuell gewählte hat Vorrang, sonst automatisch.
function itemCat(x) {
  if (x.cat) { const c = categoryById(x.cat); if (c) return c; }
  return categorize(x.text);
}

export function Shopping({ t, ctx, items, setItems, favs = [], setFavs, lists = [], setLists }) {
  const [text, setText] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const [manageFavs, setManageFavs] = useState(false);
  const [favText, setFavText] = useState("");
  const [favCat, setFavCat] = useState(""); // Rubrik für einen neuen häufigen Artikel
  const [cat, setCat] = useState(""); // gewählte Rubrik beim einmaligen Hinzufügen ("" = automatisch)
  const [activeList, setActiveList] = useState(""); // aktive Liste (Geschäft)
  const [manageLists, setManageLists] = useState(false);
  const [listText, setListText] = useState("");
  const [renId, setRenId] = useState(null);     // umzubenennende Liste
  const [renText, setRenText] = useState("");
  const sel = inputStyle(t);
  const lastAdd = useRef({ key: "", time: 0 }); // gegen Doppeltipp/Ghost-Click

  // Standardliste beim Öffnen: „Allgemein" (falls vorhanden), sonst die erste.
  const defaultList = lists.find((l) => (l.name || "").trim().toLowerCase() === "allgemein") || lists[0];
  // aktive Liste absichern (z. B. nach Löschen)
  const activeId = lists.some((l) => l.id === activeList) ? activeList : (defaultList ? defaultList.id : "");
  const itemListId = (x) => x.list || (lists[0] ? lists[0].id : ""); // Altartikel -> erste Liste
  const inActive = (x) => itemListId(x) === activeId;

  function addList() {
    const v = listText.trim();
    if (!v) return;
    const nl = { id: uid("list"), name: v };
    setLists([...lists, nl]); setListText(""); setActiveList(nl.id);
  }
  function removeList(id) {
    if (lists.length <= 1) { if (ctx.flash) ctx.flash("Mindestens eine Liste muss bleiben.", "warn"); return; }
    const remaining = lists.filter((l) => l.id !== id);
    const fallback = remaining[0].id;
    // Artikel dieser Liste auf die erste verbleibende Liste verschieben (nichts geht verloren)
    if (items.some((x) => itemListId(x) === id)) {
      setItems(items.map((x) => (itemListId(x) === id ? { ...x, list: fallback } : x)));
    }
    setLists(remaining);
    if (activeList === id) setActiveList(fallback);
  }
  function renameList(id) {
    const v = renText.trim();
    if (v) setLists(lists.map((l) => (l.id === id ? { ...l, name: v } : l)));
    setRenId(null); setRenText("");
  }

  function addFav() {
    const v = favText.trim();
    if (!v) return;
    if (!favs.some((f) => f.text.toLowerCase() === v.toLowerCase())) {
      setFavs([...favs, { id: uid("fav"), text: v, cat: favCat }]);
    }
    setFavText("");
  }
  function removeFav(id) { setFavs(favs.filter((f) => f.id !== id)); }

  function addItem(name, catId = "") {
    const v = (name || "").trim();
    if (!v) return;
    const key = v.toLowerCase();
    const now = Date.now();
    // Doppeltipp/Ghost-Click: pro Liste, damit gleicher Artikel in anderer Liste erlaubt bleibt
    const tapKey = activeId + "|" + key;
    if (lastAdd.current.key === tapKey && now - lastAdd.current.time < 900) return;
    lastAdd.current = { key: tapKey, time: now };
    // Bereits offen auf DIESER Liste? -> nicht doppelt eintragen
    if (items.some((x) => !x.done && inActive(x) && (x.text || "").trim().toLowerCase() === key)) {
      if (ctx.flash) ctx.flash(`„${v}" ist schon auf der Liste.`, "info");
      return;
    }
    setItems([{ id: uid("shop"), text: v, cat: catId, list: activeId, done: false, addedBy: ctx.activeUserId, createdAt: now }, ...items]);
  }
  function addFromInput() { addItem(text, cat); setText(""); }
  function toggle(id) { setItems(items.map((x) => (x.id === id ? { ...x, done: !x.done } : x))); }
  function remove(id) { setItems(items.filter((x) => x.id !== id)); }
  function checkAll() { setItems(items.map((x) => (inActive(x) && !x.done ? { ...x, done: true } : x))); }
  function clearDone() { setItems(items.filter((x) => !(x.done && inActive(x)))); }
  function clearAll() {
    if (typeof window !== "undefined" && !window.confirm("Diese Liste leeren?")) return;
    setItems(items.filter((x) => !inActive(x)));
  }
  function startEdit(x) { setEditId(x.id); setEditText(x.text); }
  function commitEdit() {
    if (editId) {
      const v = editText.trim();
      if (v) setItems(items.map((i) => (i.id === editId ? { ...i, text: v } : i)));
    }
    setEditId(null); setEditText("");
  }

  const byText = (a, b) => (a.text || "").localeCompare(b.text || "", "de");
  const open = items.filter((x) => !x.done && inActive(x));
  const done = items.filter((x) => x.done && inActive(x)).slice().sort(byText);

  // offene Artikel nach Kategorie gruppieren (Kategorien & Artikel alphabetisch)
  const groups = ALL_CATS.map((c) => ({
    cat: c, list: open.filter((x) => itemCat(x).id === c.id).slice().sort(byText),
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

      {/* Listen / Geschäfte – umschaltbar, benennbar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: t.muted, letterSpacing: ".03em" }}>LISTEN</span>
          <button onClick={() => { setManageLists((m) => !m); setRenId(null); }} style={{
            background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit",
            fontSize: 13, fontWeight: 700, color: t.accent,
          }}>{manageLists ? "Fertig" : "Verwalten"}</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {lists.slice().sort((a, b) => (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase(), "de")).map((l) => (manageLists ? (
            renId === l.id ? (
              <span key={l.id} style={{ display: "inline-flex", gap: 4 }}>
                <input autoFocus value={renText} onChange={(e) => setRenText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); renameList(l.id); } }}
                  style={{ ...sel, padding: "5px 9px", width: 130 }} />
                <Btn t={t} kind="soft" onClick={() => renameList(l.id)} style={{ flex: "none" }}>✓</Btn>
              </span>
            ) : (
              <span key={l.id} style={{
                display: "inline-flex", alignItems: "center", gap: 2, background: t.chip, color: t.text,
                border: `1px solid ${t.borderSoft}`, borderRadius: 18, padding: "5px 6px 5px 12px", fontSize: 13, fontWeight: 700,
              }}>
                <button onClick={() => { setRenId(l.id); setRenText(l.name); }} title="Umbenennen" style={{
                  background: "none", border: "none", color: t.text, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, padding: 0,
                }}>{l.name} ✏️</button>
                <button onClick={() => removeList(l.id)} aria-label="Liste löschen" style={{
                  background: "none", border: "none", color: t.faint, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 3px",
                }}>×</button>
              </span>
            )
          ) : (
            <button key={l.id} onClick={() => setActiveList(l.id)} style={{
              background: l.id === activeId ? t.accent : t.chip, color: l.id === activeId ? "#fff" : t.text,
              border: `1px solid ${l.id === activeId ? t.accent : t.borderSoft}`, borderRadius: 18,
              padding: "6px 14px", fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
            }}>{l.name}</button>
          )))}
          {lists.length === 0 && <span style={{ fontSize: 12.5, color: t.faint }}>Keine Liste – über „Verwalten" anlegen.</span>}
        </div>
        {manageLists && (
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input style={{ ...sel, flex: 1, padding: "7px 10px" }} value={listText} onChange={(e) => setListText(e.target.value)}
              placeholder="Neue Liste (z. B. Hofer) …"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addList(); } }} />
            <Btn t={t} kind="soft" onClick={addList} style={{ flex: "none" }}>Hinzufügen</Btn>
          </div>
        )}
      </div>

      {/* Häufige Artikel (frei verwaltbar) */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: t.muted, letterSpacing: ".03em" }}>HÄUFIGE ARTIKEL</span>
          <button onClick={() => setManageFavs((m) => !m)} style={{
            background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit",
            fontSize: 13, fontWeight: 700, color: t.accent,
          }}>{manageFavs ? "Fertig" : "Verwalten"}</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {favs.slice().sort(byText).map((f) => { const fc = f.cat ? categoryById(f.cat) : null; return (manageFavs ? (
            <span key={f.id} style={{
              display: "inline-flex", alignItems: "center", gap: 3, background: t.chip, color: t.text,
              border: `1px solid ${t.borderSoft}`, borderRadius: 16, padding: "3px 5px 3px 10px",
              fontSize: 12.5, fontWeight: 700,
            }}>
              {fc && <span title={fc.name}>{fc.icon}</span>} {f.text}
              <button onClick={() => removeFav(f.id)} aria-label="Entfernen" style={{
                background: "none", border: "none", color: t.faint, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px",
              }}>×</button>
            </span>
          ) : (
            <button key={f.id} onClick={() => addItem(f.text, f.cat || "")} style={{
              background: t.chip, color: t.text, border: `1px solid ${t.borderSoft}`, borderRadius: 16,
              padding: "4px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>+ {f.text}</button>
          )); })}
          {favs.length === 0 && <span style={{ fontSize: 12.5, color: t.faint }}>Keine häufigen Artikel – über „Verwalten" hinzufügen.</span>}
        </div>
        {manageFavs && (
          <div style={{ marginTop: 8 }}>
            <select style={{ ...sel, marginBottom: 6 }} value={favCat} onChange={(e) => setFavCat(e.target.value)}>
              <option value="">Rubrik des Artikels: automatisch</option>
              {ALL_CATS.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
            <div style={{ display: "flex", gap: 6 }}>
              <input style={{ ...sel, flex: 1, padding: "7px 10px" }} value={favText} onChange={(e) => setFavText(e.target.value)}
                placeholder="Neuer häufiger Artikel …"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFav(); } }} />
              <Btn t={t} kind="soft" onClick={addFav} style={{ flex: "none" }}>Hinzufügen</Btn>
            </div>
          </div>
        )}
      </div>

      {/* Eingabe: Rubrik + Artikel */}
      <div style={{ marginBottom: 14 }}>
        <select style={{ ...sel, marginBottom: 8 }} value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Rubrik: automatisch</option>
          {ALL_CATS.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...sel, flex: 1 }} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Was wird benötigt?" enterKeyHint="done"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFromInput(); } }} />
          <Btn t={t} kind="primary" onClick={addFromInput} style={{ fontSize: 22, padding: "0 16px", flex: "none" }}>+</Btn>
        </div>
      </div>

      {/* Sammel-Aktionen */}
      {(open.length + done.length) > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 14 }}>
          {open.length > 0 && <ActionLink t={t} onClick={checkAll}>✓ Alle abhaken</ActionLink>}
          {done.length > 0 && <ActionLink t={t} onClick={clearDone}>Erledigte entfernen ({done.length})</ActionLink>}
          <ActionLink t={t} danger onClick={clearAll}>Liste leeren</ActionLink>
        </div>
      )}

      {(open.length + done.length) === 0 ? (
        <div style={{ textAlign: "center", color: t.faint, padding: "40px 16px", fontSize: 14 }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>🛒</div>
          Diese Liste ist leer. Oben eintragen oder einen häufigen Artikel tippen.
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
