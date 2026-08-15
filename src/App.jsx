// ===========================================================================
//  App.jsx – Familien- & Business-Kalender
//  Daten liegen pro Konto in window.storage (Supabase, Echtzeit-Sync).
// ===========================================================================
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  DEFAULT_USERS, DEFAULT_AREAS, DEFAULT_EVENT_TYPES, QUICK_TEMPLATES, DEFAULT_SHOP_FAVS, DEFAULT_SHOP_STORES, REMINDER_OPTIONS,
  PRIORITIES, theme, uid,
  todayISO, toISODate, parseISODate, addDays, addMonths, startOfWeek, monthGrid, isoWeek,
  fmtDateLong, fmtDateShort, MONTHS, occurrencesInRange, buildICS, downloadFile, timeToMin,
} from "./cal/data.js";
import { Toast, Btn, Dot } from "./cal/components.jsx";
import { DayView, WeekView, MonthView, Dashboard } from "./cal/views.jsx";
import { EventEditor } from "./cal/EventEditor.jsx";
import { Admin } from "./cal/Admin.jsx";
import { Tasks } from "./cal/Tasks.jsx";
import { Shopping } from "./cal/Shopping.jsx";
import { NiceToKnow } from "./cal/NiceToKnow.jsx";
import { Gossip } from "./cal/Gossip.jsx";

// ---- persistente Schlüssel ----------------------------------------------
// Konfiguration als einzelne Blobs (selten/parallel kaum bearbeitet):
const K_USERS = "cal_users", K_AREAS = "cal_areas", K_TYPES = "cal_types",
  K_SETTINGS = "cal_settings";
// Termine & Aufgaben als EINZELNE Zeilen je Element (Präfix) -> robuste
// Mehrgeräte-Sync: gleichzeitige Änderungen an verschiedenen Einträgen
// überschreiben sich NICHT gegenseitig (kein Last-Write-Wins auf der Gesamtliste).
const P_EVENT = "cal_event:", P_TASK = "cal_task:", P_SHOP = "cal_shop:", P_NOTE = "cal_note:", P_GOSSIP = "cal_gossip:", P_SHOPFAV = "cal_shopfav:", P_SHOPSTORE = "cal_shopstore:";
// Legacy-Blobs (frühere Versionen) – werden einmalig migriert:
const K_EVENTS_LEGACY = "cal_events", K_TASKS_LEGACY = "cal_tasks";

async function loadJSON(key, fallback) {
  try { const r = await window.storage.get(key, true); return r && r.value ? JSON.parse(r.value) : fallback; }
  catch { return fallback; }
}
// Meldet Schreibfehler an die App (wird unten gesetzt). Ohne das wuerde ein
// fehlgeschlagener Cloud-Schreibvorgang stumm verschluckt und die App faelschlich
// "gespeichert" melden.
let writeErrorHandler = null;
async function saveJSON(key, val) {
  try { await window.storage.set(key, JSON.stringify(val), true); }
  catch (e) { if (writeErrorHandler) writeErrorHandler(e); }
}

// Sammlung (Termine/Aufgaben) aus den Einzelzeilen laden.
// Bei einem Fehler (Netz/Server) wird NULL geliefert – das unterscheidet
// „konnte nicht laden" von „ist wirklich leer". Sonst würde eine kurze Störung
// die Ansicht leeren, Standarddaten neu aussäen und beim nächsten Sync für
// jeden vorhandenen Eintrag eine „neu"-Benachrichtigung auslösen.
async function loadCollection(prefix) {
  try {
    const r = await window.storage.getAll(prefix);
    const out = [];
    for (const it of r.items || []) {
      try { const o = JSON.parse(it.value); if (o && o.id) out.push(o); } catch {}
    }
    return out;
  } catch { return null; }
}

// Diff-Persistenz: nur geänderte/neue Elemente schreiben, entfernte löschen.
function persistDiff(prefix, prev, next) {
  const prevById = new Map((prev || []).map((x) => [x.id, x]));
  for (const x of next) {
    if (x.id == null) continue;
    const p = prevById.get(x.id);
    if (!p || JSON.stringify(p) !== JSON.stringify(x)) saveJSON(prefix + x.id, x);
    prevById.delete(x.id);
  }
  for (const id of prevById.keys()) { try { window.storage.delete(prefix + id); } catch {} }
}

function blankEvent(ctx) {
  return {
    id: null, title: "", icon: "", allDay: false, date: todayISO(), endDate: todayISO(), start: "09:00", end: "10:00",
    creatorId: ctx.activeUserId || "", areaId: "a_privat",
    priority: "", typeId: "", participants: [], description: "", location: "",
    address: "", notes: "", link: "", attachments: [], reminder: "none",
    locked: false, recurrence: { freq: "none", interval: 1 },
  };
}

export default function App() {
  const [users, setUsers] = useState(DEFAULT_USERS);
  const [areas, setAreas] = useState(DEFAULT_AREAS);
  const [types, setTypes] = useState(DEFAULT_EVENT_TYPES);
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [shopping, setShopping] = useState([]);
  const [notes, setNotes] = useState([]);
  const [gossip, setGossip] = useState([]);
  const [shopFav, setShopFav] = useState([]);
  const [shopStore, setShopStore] = useState([]);
  const [settings, setSettings] = useState({ themeMode: "light", activeUserId: "u_patrick" });
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [view, setView] = useState("dashboard"); // dashboard|day|week|month|tasks|shopping|notes|gossip
  const [cursor, setCursor] = useState(todayISO());

  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [fUser, setFUser] = useState("all");
  const [fArea, setFArea] = useState("all");
  const [fPrio, setFPrio] = useState("all");
  const [fType, setFType] = useState("all");
  const [fPart, setFPart] = useState("all"); // Teilnehmer: all | userId | "both"

  const [editor, setEditor] = useState(null); // {draft, isNew}
  const [adminOpen, setAdminOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [highlightId, setHighlightId] = useState(null); // Suchtreffer hervorheben
  const [confirmDel, setConfirmDel] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [undo, setUndo] = useState(null); // { msg } – „Rückgängig" nach Löschen
  const undoTimer = useRef(null);
  const undoFnRef = useRef(null);         // Wiederherstellung (außerhalb des Renders aufgerufen)
  // letzter persistierter Stand (für Diff-Persistenz pro Element)
  const eventsRef = useRef([]);
  const tasksRef = useRef([]);
  const shoppingRef = useRef([]);
  const notesRef = useRef([]);
  const gossipRef = useRef([]);
  const shopFavRef = useRef([]);
  const shopStoreRef = useRef([]);
  // Für In-App-Benachrichtigungen bei neuen Einträgen (per Live-Sync)
  const notifyReadyRef = useRef(false);     // erst nach dem ersten Laden benachrichtigen
  const activeUserIdRef = useRef(null);     // aktueller Benutzer (frisch, nicht aus Closure)
  const usersRef = useRef([]);
  const fileInputRef = useRef(null);        // versteckter Datei-Input für Backup-Import

  const t = theme(settings.themeMode);
  activeUserIdRef.current = settings.activeUserId;
  usersRef.current = users;

  const flash = useCallback((msg, kind = "info") => {
    setToast({ msg, kind });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  // „Rückgängig"-Hinweis (5 Sek.) nach dem Löschen anzeigen.
  const showUndo = useCallback((msg, fn) => {
    undoFnRef.current = fn;
    setUndo({ msg });
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => { undoFnRef.current = null; setUndo(null); }, 5000);
  }, []);
  // Wichtig: die Wiederherstellung NICHT im State-Updater aufrufen – React ruft
  // Updater in StrictMode doppelt auf, was den Schreibvorgang verdoppeln würde.
  const doUndo = useCallback(() => {
    clearTimeout(undoTimer.current);
    const fn = undoFnRef.current;
    undoFnRef.current = null;
    setUndo(null);
    if (fn) fn();
  }, []);

  // Schreibfehler sichtbar machen: sonst meldet die App "gespeichert", obwohl
  // nichts in der Cloud gelandet ist.
  const writeErrTimer = useRef(null);
  useEffect(() => {
    writeErrorHandler = () => {
      clearTimeout(writeErrTimer.current);
      writeErrTimer.current = setTimeout(() => {
        flash("Nicht gespeichert – keine Verbindung. Bitte 🔄 neu laden.", "error");
      }, 200);
    };
    return () => { writeErrorHandler = null; };
  }, [flash]);

  // ---------- Benachrichtigung bei neuen Einträgen (In-App, App offen) ----------
  // Zeigt eine System-Benachrichtigung, wenn per Live-Sync ein neuer Eintrag
  // ankommt – aber nur für Einträge von ANDEREN (nicht den eigenen, eben
  // angelegten) und nur wenn der Nutzer Benachrichtigungen aktiviert hat.
  const notifyNew = useCallback((oldArr, newArr, label, getCreator) => {
    if (!notifyReadyRef.current) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const oldIds = new Set((oldArr || []).map((x) => x.id));
    const fresh = (newArr || []).filter(
      (x) => x && x.id && !oldIds.has(x.id) && getCreator(x) !== activeUserIdRef.current
    );
    if (!fresh.length) return;
    try {
      if (fresh.length > 2) {
        new Notification(`${label.icon} ${fresh.length} neue ${label.pl}`, { tag: `new-${label.sg}-batch` });
      } else {
        for (const x of fresh) {
          const u = usersRef.current.find((y) => y.id === getCreator(x));
          new Notification(`${label.icon} Neuer Eintrag: ${label.sg}`, {
            body: `${x.title || "(ohne Titel)"}${u ? " · von " + u.name : ""}`,
            tag: `new-${label.sg}-${x.id}`,
          });
        }
      }
    } catch {}
  }, []);

  // ---------- Laden ----------
  useEffect(() => {
    let on = true;
    (async () => {
      const [u, a, ty, st] = await Promise.all([
        loadJSON(K_USERS, null), loadJSON(K_AREAS, null), loadJSON(K_TYPES, null), loadJSON(K_SETTINGS, null),
      ]);
      let ev = await loadCollection(P_EVENT);
      let tk = await loadCollection(P_TASK);
      const sh = await loadCollection(P_SHOP);
      const nt = await loadCollection(P_NOTE);
      const go = await loadCollection(P_GOSSIP);
      let fv = await loadCollection(P_SHOPFAV);
      let stores = await loadCollection(P_SHOPSTORE);
      // Konnte etwas NICHT geladen werden (null), brechen wir ab: lieber den
      // Ladehinweis stehen lassen als leere Listen zeigen und Standarddaten neu
      // aussäen. Ein Tipp auf 🔄 lädt erneut.
      if ([ev, tk, sh, nt, go, fv, stores].some((x) => x === null)) {
        if (!on) return;
        setLoadError(true);
        return;
      }
      // Einmalige Migration aus früheren Einzel-Blobs in Einzelzeilen
      if (ev.length === 0) {
        const legacy = await loadJSON(K_EVENTS_LEGACY, []);
        if (Array.isArray(legacy) && legacy.length) {
          ev = legacy; for (const x of legacy) if (x.id) saveJSON(P_EVENT + x.id, x);
          try { window.storage.delete(K_EVENTS_LEGACY); } catch {}
        }
      }
      if (tk.length === 0) {
        const legacy = await loadJSON(K_TASKS_LEGACY, []);
        if (Array.isArray(legacy) && legacy.length) {
          tk = legacy; for (const x of legacy) if (x.id) saveJSON(P_TASK + x.id, x);
          try { window.storage.delete(K_TASKS_LEGACY); } catch {}
        }
      }
      if (!on) return;
      if (u && u.length) setUsers(u); else saveJSON(K_USERS, DEFAULT_USERS);
      if (a && a.length) setAreas(a); else saveJSON(K_AREAS, DEFAULT_AREAS);
      // Terminarten laden. Fehlende Standardarten (z. B. "Arbeit") werden
      // EINMALIG ergänzt; ein Flag verhindert, dass bewusst gelöschte zurückkehren.
      let stEff = st || {};
      if (ty && ty.length) {
        let typesNext = ty;
        if (!stEff.mergedDefaultTypesV1) {
          const have = new Set(ty.map((x) => x.id));
          const missing = DEFAULT_EVENT_TYPES.filter((d) => !have.has(d.id));
          if (missing.length) { typesNext = [...ty, ...missing]; saveJSON(K_TYPES, typesNext); }
          stEff = { ...stEff, mergedDefaultTypesV1: true };
          saveJSON(K_SETTINGS, stEff);
        }
        setTypes(typesNext);
      } else {
        setTypes(DEFAULT_EVENT_TYPES); saveJSON(K_TYPES, DEFAULT_EVENT_TYPES);
      }
      // Häufige Einkaufs-Artikel: einmalig mit Standardwerten befüllen.
      if (!stEff.seededShopFavV1 && fv.length === 0) {
        fv = DEFAULT_SHOP_FAVS.map((text, i) => ({ id: `fav_${i}_${text}`, text }));
        for (const x of fv) saveJSON(P_SHOPFAV + x.id, x);
        stEff = { ...stEff, seededShopFavV1: true };
        saveJSON(K_SETTINGS, stEff);
      }
      // Geschäfte: einmalig mit Standardwerten befüllen.
      if (!stEff.seededShopStoreV1 && stores.length === 0) {
        stores = DEFAULT_SHOP_STORES.map((name, i) => ({ id: `store_${i}_${name}`, name }));
        for (const x of stores) saveJSON(P_SHOPSTORE + x.id, x);
        stEff = { ...stEff, seededShopStoreV1: true };
        saveJSON(K_SETTINGS, stEff);
      }
      // „Allgemein"-Liste einmalig ergänzen (auch für bestehende Nutzer) – sie ist
      // die Standardliste beim Öffnen. Ganz nach vorne, damit sie zuerst steht.
      if (!stEff.addedAllgemeinListV1) {
        if (!stores.some((s) => (s.name || "").trim().toLowerCase() === "allgemein")) {
          const allg = { id: `store_allgemein`, name: "Allgemein" };
          saveJSON(P_SHOPSTORE + allg.id, allg);
          stores = [allg, ...stores];
        }
        stEff = { ...stEff, addedAllgemeinListV1: true };
        saveJSON(K_SETTINGS, stEff);
      }
      eventsRef.current = ev; setEvents(ev);
      tasksRef.current = tk; setTasks(tk);
      shoppingRef.current = sh; setShopping(sh);
      notesRef.current = nt; setNotes(nt);
      gossipRef.current = go; setGossip(go);
      shopFavRef.current = fv; setShopFav(fv);
      shopStoreRef.current = stores; setShopStore(stores);
      if (Object.keys(stEff).length) setSettings((s) => ({ ...s, ...stEff }));
      setLoaded(true);
      notifyReadyRef.current = true; // ab jetzt bei neuen Einträgen benachrichtigen
    })();
    return () => { on = false; };
  }, []);

  // ---------- Realtime: bei Remote-Änderung neu laden ----------
  useEffect(() => {
    const h = async () => {
      const [u, a, ty, st] = await Promise.all([
        loadJSON(K_USERS, null), loadJSON(K_AREAS, null), loadJSON(K_TYPES, null), loadJSON(K_SETTINGS, null),
      ]);
      const ev = await loadCollection(P_EVENT);
      const tk = await loadCollection(P_TASK);
      const sh = await loadCollection(P_SHOP);
      const nt = await loadCollection(P_NOTE);
      const go = await loadCollection(P_GOSSIP);
      const fv = await loadCollection(P_SHOPFAV);
      const stores = await loadCollection(P_SHOPSTORE);
      // Bei einem Ladefehler (null) nichts übernehmen – sonst würden die Listen
      // geleert und beim nächsten Sync alles als „neu" gemeldet.
      if ([ev, tk, sh, nt, go, fv, stores].some((x) => x === null)) return;
      if (u && u.length) setUsers(u);
      if (a && a.length) setAreas(a);
      if (ty && ty.length) setTypes(ty);
      // Neue Einträge (von anderen) erkennen und benachrichtigen – VOR dem Ref-Update,
      // damit der bisherige Stand noch zum Vergleich vorliegt.
      notifyNew(eventsRef.current, ev, { sg: "Termin", pl: "Termine", icon: "📅" }, (x) => x.creatorId);
      notifyNew(tasksRef.current, tk, { sg: "Aufgabe", pl: "Aufgaben", icon: "✅" }, (x) => x.addedBy);
      notifyNew(gossipRef.current, go, { sg: "Gossip", pl: "Gossip-Einträge", icon: "🍵" }, (x) => x.addedBy);
      eventsRef.current = ev; setEvents(ev);
      tasksRef.current = tk; setTasks(tk);
      shoppingRef.current = sh; setShopping(sh);
      notesRef.current = nt; setNotes(nt);
      gossipRef.current = go; setGossip(go);
      shopFavRef.current = fv; setShopFav(fv);
      shopStoreRef.current = stores; setShopStore(stores);
      if (st) setSettings((s) => ({ ...s, ...st }));
    };
    window.addEventListener("ctc:remote", h);
    return () => window.removeEventListener("ctc:remote", h);
  }, []);

  // ---------- Persistenz-Wrapper ----------
  // Termine & Aufgaben: pro Element eine eigene Zeile (Diff) -> kein Clobbering.
  const persist = {
    users: (next) => { setUsers(next); saveJSON(K_USERS, next); },
    areas: (next) => { setAreas(next); saveJSON(K_AREAS, next); },
    types: (next) => { setTypes(next); saveJSON(K_TYPES, next); },
    events: (next) => { persistDiff(P_EVENT, eventsRef.current, next); eventsRef.current = next; setEvents(next); },
    tasks: (next) => { persistDiff(P_TASK, tasksRef.current, next); tasksRef.current = next; setTasks(next); },
    shopping: (next) => { persistDiff(P_SHOP, shoppingRef.current, next); shoppingRef.current = next; setShopping(next); },
    notes: (next) => { persistDiff(P_NOTE, notesRef.current, next); notesRef.current = next; setNotes(next); },
    gossip: (next) => { persistDiff(P_GOSSIP, gossipRef.current, next); gossipRef.current = next; setGossip(next); },
    shopFav: (next) => { persistDiff(P_SHOPFAV, shopFavRef.current, next); shopFavRef.current = next; setShopFav(next); },
    shopStore: (next) => { persistDiff(P_SHOPSTORE, shopStoreRef.current, next); shopStoreRef.current = next; setShopStore(next); },
    settings: (next) => { setSettings(next); saveJSON(K_SETTINGS, next); },
  };

  // ---------- Löschen mit „Rückgängig" ----------
  // Entfernt ein Element und bietet 5 Sek. lang Wiederherstellung an. Nutzt die
  // Refs (immer aktueller Stand), damit auch zwischenzeitliche Änderungen erhalten bleiben.
  const DEL_KINDS = {
    event:    [eventsRef, persist.events, "Termin"],
    task:     [tasksRef, persist.tasks, "Aufgabe"],
    note:     [notesRef, persist.notes, "Notiz"],
    gossip:   [gossipRef, persist.gossip, "Gossip-Eintrag"],
    shopping: [shoppingRef, persist.shopping, "Artikel"],
  };
  // Mehrere Elemente auf einmal loeschen und zurueckholen. Nutzt die Refs, damit
  // in der Undo-Zeit neu angelegte (oder per Sync eingetroffene) Eintraege NICHT
  // ueberschrieben werden.
  function deleteManyWithUndo(kind, itemsToRemove, msg) {
    const entry = DEL_KINDS[kind]; if (!entry || !itemsToRemove.length) return;
    const [ref, setter] = entry;
    const ids = new Set(itemsToRemove.map((x) => x.id));
    setter(ref.current.filter((x) => !ids.has(x.id)));
    showUndo(msg, () => {
      const have = new Set(ref.current.map((x) => x.id));
      const back = itemsToRemove.filter((x) => !have.has(x.id));
      if (back.length) setter([...ref.current, ...back]);
    });
  }
  function deleteWithUndo(kind, item) {
    const entry = DEL_KINDS[kind]; if (!entry || !item) return;
    const [ref, setter, name] = entry;
    setter(ref.current.filter((x) => x.id !== item.id));
    showUndo(`${name} gelöscht`, () => { if (!ref.current.some((x) => x.id === item.id)) setter([...ref.current, item]); });
  }

  // ---------- Lookups ----------
  const typeById = useCallback((id) => types.find((x) => x.id === id), [types]);
  const areaById = useCallback((id) => areas.find((x) => x.id === id), [areas]);
  const userById = useCallback((id) => users.find((x) => x.id === id), [users]);
  const activeUser = userById(settings.activeUserId) || users[0];
  const isAdmin = activeUser?.role === "admin";

  function canEditEvent(ev) {
    if (!ev || ev.id == null) return true;
    if (!ev.locked) return true;
    return isAdmin || ev.creatorId === settings.activeUserId;
  }

  // ---------- ctx für Kindkomponenten ----------
  const ctx = {
    users, areas, types, events,
    activeUserId: settings.activeUserId,
    quickTemplates: QUICK_TEMPLATES,
    typeById, areaById, userById, flash, deleteWithUndo, deleteManyWithUndo, showUndo, highlightId,
    clearHighlight: () => setHighlightId(null),
    setActiveUserId: (id) => persist.settings({ ...settings, activeUserId: id }),
    setUsers: persist.users, setAreas: persist.areas, setTypes: persist.types,
  };

  // ---------- Filter auf Basis-Termine ----------
  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((ev) => {
      if (fUser !== "all" && ev.creatorId !== fUser) return false;
      if (fArea !== "all" && ev.areaId !== fArea) return false;
      if (fPrio !== "all" && ev.priority !== fPrio) return false;
      if (fType !== "all" && ev.typeId !== fType) return false;
      if (fPart === "both") {
        if (!users.every((u) => (ev.participants || []).includes(u.id))) return false;
      } else if (fPart !== "all" && !(ev.participants || []).includes(fPart)) return false;
      if (q) {
        const hay = `${ev.title} ${ev.description || ""} ${ev.location || ""} ${ev.address || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [events, fUser, fArea, fPrio, fType, fPart, search, users]);

  // ---------- sichtbarer Zeitraum ----------
  const range = useMemo(() => {
    const c = parseISODate(cursor);
    if (view === "day") return [cursor, cursor];
    if (view === "week") { const ws = startOfWeek(c); return [toISODate(ws), toISODate(addDays(ws, 6))]; }
    if (view === "month") { const g = monthGrid(c.getFullYear(), c.getMonth()); return [toISODate(g[0]), toISODate(g[41])]; }
    // dashboard
    return [todayISO(), toISODate(addDays(parseISODate(todayISO()), 6))];
  }, [view, cursor]);

  const occ = useMemo(() => occurrencesInRange(filteredEvents, range[0], range[1]), [filteredEvents, range]);

  // ---------- Erinnerungen (Push, solange App geöffnet) ----------
  const notified = useRef(new Set());
  useEffect(() => {
    if (!("Notification" in window)) return;
    const tick = () => {
      if (Notification.permission !== "granted") return;
      const now = new Date();
      const todays = occurrencesInRange(events, todayISO(), toISODate(addDays(now, 1)));
      for (const ev of todays) {
        const opt = REMINDER_OPTIONS.find((r) => r.id === ev.reminder);
        if (!opt || !opt.minutes) continue;
        const evTime = new Date(`${ev.date}T${ev.start || "00:00"}:00`);
        const fireAt = evTime.getTime() - opt.minutes * 60000;
        const key = `${ev.id}|${ev.date}|${ev.reminder}`;
        if (now.getTime() >= fireAt && now.getTime() < evTime.getTime() && !notified.current.has(key)) {
          notified.current.add(key);
          const ty = typeById(ev.typeId);
          try { new Notification(`${ty ? ty.icon : "📅"} ${ev.title}`, { body: `${ev.start} – ${opt.name}`, tag: key }); } catch {}
        }
      }
    };
    const iv = setInterval(tick, 30000);
    tick();
    return () => clearInterval(iv);
  }, [events, typeById]);

  // ---------- Aktionen ----------
  function openNew(prefill = {}) {
    const base = blankEvent({ areas, types, users, activeUserId: settings.activeUserId });
    setEditor({ draft: { ...base, ...prefill }, isNew: true });
  }
  function openQuick(q) {
    // Titel + Icon vorbelegen (Icon erscheint später am Termin im Kalender).
    // Priorität, Bereich, Terminart wählt man weiterhin selbst.
    openNew({ title: q.label, icon: q.icon });
  }
  function openEvent(ev) {
    // ev kann ein Vorkommen sein -> Basis-Termin laden
    const base = events.find((x) => x.id === ev.id) || ev;
    setEditor({ draft: { ...base }, isNew: false, occDate: ev.date });
  }
  function saveEvent(draft) {
    let next;
    if (draft.id == null) {
      next = [...events, { ...draft, id: uid("ev"), createdAt: Date.now(), updatedAt: Date.now() }];
      flash("Termin erstellt.");
    } else {
      next = events.map((x) => (x.id === draft.id ? { ...draft, updatedAt: Date.now() } : x));
      flash("Termin gespeichert.");
    }
    persist.events(next);
    setEditor(null);
  }
  function deleteEvent(ev) { setConfirmDel(ev); }
  function reallyDelete() {
    deleteWithUndo("event", confirmDel);
    setConfirmDel(null); setEditor(null);
  }

  function changeView(v) { setView(v); setMenuOpen(false); }
  function navStep(dir) {
    const c = parseISODate(cursor);
    if (view === "day") setCursor(toISODate(addDays(c, dir)));
    else if (view === "week") setCursor(toISODate(addDays(c, dir * 7)));
    else if (view === "month") setCursor(toISODate(addMonths(c, dir)));
  }
  function goToday() { setCursor(todayISO()); }

  // Neu laden: neueste App-Version (Service-Worker aktualisieren) + frische Cloud-Daten.
  async function reloadApp() {
    flash("Wird aktualisiert …");
    setMenuOpen(false);
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.update()));
      }
    } catch { /* egal – trotzdem neu laden */ }
    setTimeout(() => window.location.reload(), 250);
  }

  async function requestNotifications() {
    if (!("Notification" in window)) { flash("Benachrichtigungen werden hier nicht unterstützt.", "warn"); return; }
    const p = await Notification.requestPermission();
    flash(p === "granted" ? "Benachrichtigungen aktiviert." : "Benachrichtigungen nicht erlaubt.", p === "granted" ? "info" : "warn");
    setMenuOpen(false);
  }
  function exportICS() {
    if (filteredEvents.length === 0) { flash("Keine Termine zum Export.", "warn"); return; }
    const ics = buildICS(filteredEvents,
      (id) => (typeById(id)?.name || ""), (id) => (areaById(id)?.name || ""), (id) => (userById(id)?.name || ""));
    downloadFile("kalender.ics", ics, "text/calendar");
    flash("ICS-Datei exportiert (Outlook / Google / Apple).");
    setMenuOpen(false);
  }
  function exportJSON() {
    downloadFile("kalender-backup.json", JSON.stringify({ _copyright: "Copyright by Patrick Thorn", users, areas, types, events, tasks, shopping, notes, gossip, shopFav, shopStore, settings }, null, 2), "application/json");
    flash("JSON-Backup exportiert.");
    setMenuOpen(false);
  }
  // JSON-Backup wiederherstellen: liest die Datei, ersetzt alle Sammlungen.
  // persist.* difft gegen den aktuellen Stand -> entfernte Einträge werden gelöscht,
  // vorhandene aktualisiert (robuster Restore über alle Geräte).
  function importJSON(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let d;
      try { d = JSON.parse(reader.result); }
      catch { flash("Backup konnte nicht gelesen werden (kein gültiges JSON).", "error"); return; }
      if (!d || typeof d !== "object") { flash("Ungültige Backup-Datei.", "error"); return; }
      if (typeof window !== "undefined" &&
        !window.confirm("Aktuelle Daten werden durch das Backup ersetzt. Fortfahren?")) return;
      if (Array.isArray(d.users) && d.users.length) persist.users(d.users);
      if (Array.isArray(d.areas) && d.areas.length) persist.areas(d.areas);
      if (Array.isArray(d.types) && d.types.length) persist.types(d.types);
      if (Array.isArray(d.events)) persist.events(d.events);
      if (Array.isArray(d.tasks)) persist.tasks(d.tasks);
      if (Array.isArray(d.shopping)) persist.shopping(d.shopping);
      if (Array.isArray(d.notes)) persist.notes(d.notes);
      if (Array.isArray(d.gossip)) persist.gossip(d.gossip);
      if (Array.isArray(d.shopFav)) persist.shopFav(d.shopFav);
      if (Array.isArray(d.shopStore)) persist.shopStore(d.shopStore);
      if (d.settings && typeof d.settings === "object") persist.settings({ ...settings, ...d.settings });
      flash("Backup wiederhergestellt.");
      setMenuOpen(false);
    };
    reader.onerror = () => flash("Backup konnte nicht gelesen werden.", "error");
    reader.readAsText(file);
  }

  if (loadError) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center", background: t.bg, color: t.text, fontFamily: FONT }}>
        <div style={{ fontSize: 34 }}>⚠️</div>
        <div style={{ fontWeight: 800, fontSize: 17 }}>Daten konnten nicht geladen werden</div>
        <div style={{ fontSize: 14, color: t.muted, maxWidth: 320 }}>
          Bitte Internetverbindung prüfen. Deine Daten sind sicher in der Cloud – es wurde nichts verändert.
        </div>
        <Btn t={t} kind="primary" onClick={() => window.location.reload()}>Erneut versuchen</Btn>
      </div>
    );
  }
  if (!loaded) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: t.bg, color: t.muted, fontFamily: FONT }}>Kalender lädt …</div>;
  }

  const headerTitle = (() => {
    const c = parseISODate(cursor);
    if (view === "day") return `${fmtDateShort(cursor)} · KW ${isoWeek(cursor)}`;
    if (view === "week") { const ws = startOfWeek(c); return `${fmtDateShort(toISODate(ws))} – ${fmtDateShort(toISODate(addDays(ws, 6)))} · KW ${isoWeek(toISODate(ws))}`; }
    if (view === "month") return `${MONTHS[c.getMonth()]} ${c.getFullYear()}`;
    return "Dashboard";
  })();

  const VIEW_TABS = [
    { id: "dashboard", label: "Start" },
    { id: "day", label: "Tag" },
    { id: "week", label: "Woche" },
    { id: "month", label: "Monat" },
    { id: "tasks", label: "Aufgaben" },
    { id: "shopping", label: "Einkauf" },
    { id: "notes", label: "Nice to know" },
    { id: "gossip", label: "Gossip" },
  ];
  // Anzahl aktiver Filter – sonst fehlen Termine scheinbar grundlos, wenn das
  // Filter-Panel zugeklappt ist.
  const activeFilterCount = [fUser, fArea, fPrio, fType, fPart].filter((x) => x !== "all").length;
  const showNav = ["day", "week", "month"].includes(view);
  const isList = ["tasks", "shopping", "notes", "gossip"].includes(view); // eigene Eingabe, kein Termin-Toolbar

  // ---------- Globale Suche über alle Bereiche ----------
  const q = search.trim().toLowerCase();
  const searching = q.length > 0;
  const hay = (...parts) => parts.filter(Boolean).join(" ").toLowerCase();
  const searchResults = !searching ? [] : [
    ...events.filter((x) => hay(x.title, x.description, x.location, x.address, x.notes).includes(q))
      .map((x) => ({ kind: "event", item: x, ts: x.createdAt, title: x.title, who: x.creatorId,
        icon: x.icon || typeById(x.typeId)?.icon || "📅", label: "Termin",
        sub: `${x.date?.slice(8, 10)}.${x.date?.slice(5, 7)}.` })),
    ...tasks.filter((x) => hay(x.title, x.description).includes(q))
      .map((x) => ({ kind: "tasks", item: x, ts: x.createdAt, title: x.title, who: x.addedBy, icon: "✅", label: "Aufgabe" })),
    ...shopping.filter((x) => hay(x.text).includes(q))
      .map((x) => ({ kind: "shopping", item: x, ts: x.createdAt, title: x.text, who: x.addedBy, icon: "🛒", label: "Einkauf" })),
    ...notes.filter((x) => hay(x.title, x.text).includes(q))
      .map((x) => ({ kind: "notes", item: x, ts: x.createdAt, title: x.title || x.text, who: x.addedBy, icon: "💡", label: "Nice to know" })),
    ...gossip.filter((x) => hay(x.title, x.text).includes(q))
      .map((x) => ({ kind: "gossip", item: x, ts: x.createdAt, title: x.title || x.text, who: x.addedBy, icon: "🍵", label: "Gossip" })),
  ].sort((a, b) => (b.ts || 0) - (a.ts || 0));
  function openResult(r) {
    if (r.kind === "event") { openEvent(r.item); return; }
    changeView(r.kind);            // zum passenden Tab wechseln …
    setSearch("");                 // … Suche leeren, damit der Tab erscheint …
    setHighlightId(r.item.id);     // … und den Treffer dort anspringen/hervorheben
  }

  return (
    <div className="app-root" style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: FONT, paddingBottom: 90, zoom: 0.9 }}>
      {/* ===== Header ===== */}
      <header style={{ background: t.navy, color: "#fff", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 12px rgba(0,0,0,.25)" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "max(10px, env(safe-area-inset-top)) 14px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", rowGap: 6 }}>
            <span style={{ fontSize: 20 }}>📅</span>
            <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: "-.01em" }}>Kalender</span>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              {/* aktiver Benutzer (Ersteller neuer Einträge) */}
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,.7)", whiteSpace: "nowrap" }}>Angemeldet als</span>
              <select value={settings.activeUserId} onChange={(e) => persist.settings({ ...settings, activeUserId: e.target.value })}
                title="Aktiver Benutzer" style={{
                  background: "rgba(255,255,255,.12)", color: "#fff", border: "1px solid rgba(255,255,255,.2)",
                  borderRadius: 8, padding: "6px 8px", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
                  maxWidth: 130, minWidth: 0,
                }}>
                {users.map((u) => <option key={u.id} value={u.id} style={{ color: "#111" }}>{u.name}{u.role === "admin" ? " ★" : ""}</option>)}
              </select>
              <button onClick={reloadApp} title="Neu laden (neueste Version & Daten)" style={hBtn}>🔄</button>
              <button onClick={() => persist.settings({ ...settings, themeMode: settings.themeMode === "dark" ? "light" : "dark" })}
                title="Hell/Dunkel" style={hBtn}>{settings.themeMode === "dark" ? "☀️" : "🌙"}</button>
              {isAdmin && <button onClick={() => setAdminOpen(true)} title="Verwaltung" style={hBtn}>⚙️</button>}
              <div style={{ position: "relative" }}>
                <button onClick={() => setMenuOpen((o) => !o)} title="Menü" style={hBtn}>⋯</button>
                {menuOpen && (
                  <div style={{
                    position: "absolute", right: 0, top: 40, background: t.surface, color: t.text,
                    border: `1px solid ${t.border}`, borderRadius: 10, boxShadow: t.shadow, padding: 6, width: 232, zIndex: 130,
                  }}>
                    {[
                      ["🔄 App neu laden", reloadApp],
                      ["🔔 Benachrichtigungen aktivieren", requestNotifications],
                      ["📤 Export ICS (Outlook/Google/Apple)", exportICS],
                      ["💾 JSON-Backup", exportJSON],
                      ["📥 Backup wiederherstellen", () => { setMenuOpen(false); fileInputRef.current?.click(); }],
                    ].map(([label, fn]) => (
                      <button key={label} onClick={fn} style={menuItem(t)}>{label}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Ansicht-Tabs */}
          <div style={{ marginTop: 10, overflowX: "auto", paddingBottom: 2 }}>
            <div style={{ display: "inline-flex", gap: 4 }}>
              {VIEW_TABS.map((v) => (
                <button key={v.id} onClick={() => changeView(v.id)} style={{
                  border: "none", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                  padding: "7px 13px", fontSize: 13.5, fontWeight: 700,
                  background: view === v.id ? "#fff" : "rgba(255,255,255,.10)",
                  color: view === v.id ? t.navy : "#fff",
                }}>{v.label}</button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 980, margin: "0 auto", padding: "14px 12px" }}>
        {/* ===== Schnellanlage (nur auf der Startseite) ===== */}
        {view === "dashboard" && !searching && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: t.muted, letterSpacing: ".03em" }}>SCHNELLANLAGE</span>
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {QUICK_TEMPLATES.map((q) => {
                const icon = q.icon || typeById(q.typeId)?.icon || "📌";
                return (
                  <button key={q.id} onClick={() => openQuick(q)} style={{
                    display: "flex", alignItems: "center", gap: 5, background: t.surface, color: t.text,
                    border: `1px solid ${t.border}`, borderRadius: 20, padding: "6px 11px",
                    fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  }}>{icon} {q.label}</button>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== Suche & Filter ===== */}
        <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Suche über alles (Termine, Aufgaben, Einkauf, Notizen, Gossip)…"
                style={{ flex: 1, padding: "10px 12px", border: `1px solid ${t.border}`, borderRadius: 10, background: t.input, color: t.text, fontSize: 16, fontFamily: "inherit", outline: "none" }} />
              {search && <Btn t={t} kind="ghost" onClick={() => setSearch("")} style={{ flex: "none" }}>✕</Btn>}
              {!isList && (
                <Btn t={t} kind={(showFilters || activeFilterCount > 0) ? "primary" : "ghost"}
                  onClick={() => setShowFilters((o) => !o)} style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  Filter
                  {activeFilterCount > 0 && (
                    <span style={{
                      background: "rgba(255,255,255,.3)", borderRadius: 9, padding: "1px 6px",
                      fontSize: 11, fontWeight: 800, lineHeight: 1.5,
                    }}>{activeFilterCount}</span>
                  )}
                </Btn>
              )}
            </div>
            {!isList && showFilters && (
              <div style={{ marginTop: 10, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 12, display: "flex", flexWrap: "wrap", gap: 12 }}>
                <FilterSelect t={t} label="Benutzer" value={fUser} onChange={setFUser}
                  options={[["all", "Alle"], ...users.map((u) => [u.id, u.name])]} />
                <FilterSelect t={t} label="Bereich" value={fArea} onChange={setFArea}
                  options={[["all", "Alle"], ...areas.map((a) => [a.id, a.name])]} />
                <FilterSelect t={t} label="Priorität" value={fPrio} onChange={setFPrio}
                  options={[["all", "Alle"], ...PRIORITIES.map((p) => [p.id, p.name])]} />
                <FilterSelect t={t} label="Terminart" value={fType} onChange={setFType}
                  options={[["all", "Alle"], ...types.filter((x) => x.active !== false).map((x) => [x.id, `${x.icon} ${x.name}`])]} />
                <FilterSelect t={t} label="Dabei" value={fPart} onChange={setFPart}
                  options={[["all", "Alle"], ["both", "Beide dabei"], ...users.map((u) => [u.id, `${u.name} dabei`])]} />
                {(fUser !== "all" || fArea !== "all" || fPrio !== "all" || fType !== "all" || fPart !== "all") && (
                  <button onClick={() => { setFUser("all"); setFArea("all"); setFPrio("all"); setFType("all"); setFPart("all"); }}
                    style={{ alignSelf: "flex-end", background: "none", border: "none", color: t.accent, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    Zurücksetzen
                  </button>
                )}
              </div>
            )}
          </div>

        {/* ===== Globale Suchergebnisse ===== */}
        {searching && (
          <SearchResults t={t} results={searchResults} userById={userById} onOpen={openResult} query={search} />
        )}

        {/* ===== Datums-Navigation ===== */}
        {showNav && !searching && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <Btn t={t} kind="soft" onClick={() => navStep(-1)}>‹</Btn>
            <Btn t={t} kind="soft" onClick={goToday}>Heute</Btn>
            <Btn t={t} kind="soft" onClick={() => navStep(1)}>›</Btn>
            <span style={{ fontWeight: 800, fontSize: 15, color: t.text }}>{headerTitle}</span>
          </div>
        )}

        {/* ===== Ansicht ===== */}
        {!searching && view === "dashboard" && (
          <Dashboard t={t} ctx={ctx} allEvents={events} occ7={occ} tasks={tasks} gossip={gossip}
            onSelect={openEvent} onOpenTab={changeView} />
        )}
        {!searching && view === "day" && <DayView t={t} ctx={ctx} dateISO={cursor} occ={occ} onSelect={openEvent} />}
        {!searching && view === "week" && <WeekView t={t} ctx={ctx} dateISO={cursor} occ={occ} onSelect={openEvent}
          onPickDay={(iso) => { setCursor(iso); setView("day"); }} />}
        {!searching && view === "month" && <MonthView t={t} ctx={ctx} dateISO={cursor} occ={occ} onSelect={openEvent}
          onPickDay={(iso) => { setCursor(iso); setView("day"); }} />}
        {!searching && view === "tasks" && <Tasks t={t} ctx={ctx} tasks={tasks} setTasks={persist.tasks} />}
        {!searching && view === "shopping" && <Shopping t={t} ctx={ctx} items={shopping} setItems={persist.shopping} favs={shopFav} setFavs={persist.shopFav} lists={shopStore} setLists={persist.shopStore} />}
        {!searching && view === "notes" && <NiceToKnow t={t} ctx={ctx} items={notes} setItems={persist.notes} />}
        {!searching && view === "gossip" && <Gossip t={t} ctx={ctx} items={gossip} setItems={persist.gossip} />}

        {/* ===== Copyright (dezent, erscheint auch beim Drucken/PDF) ===== */}
        <div className="app-copyright" style={{
          marginTop: 24, paddingTop: 10, borderTop: `1px solid ${t.borderSoft}`,
          textAlign: "center", fontSize: 10.5, color: t.faint, fontWeight: 600, letterSpacing: ".02em",
        }}>© Copyright by Patrick Thorn · v{__APP_VERSION__}</div>
      </main>

      {/* Versteckter Datei-Input für „Backup wiederherstellen" */}
      <input ref={fileInputRef} type="file" accept="application/json,.json" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) importJSON(f); e.target.value = ""; }} />

      {/* ===== Neuer-Termin-Button ===== */}
      {!isList && (
        <button onClick={() => openNew()} aria-label="Neuer Termin" style={{
          position: "fixed", left: "50%", transform: "translateX(-50%)",
          bottom: "calc(16px + env(safe-area-inset-bottom))", zIndex: 90,
          width: 58, height: 58, borderRadius: "50%", background: t.accent, color: "#fff",
          border: "none", fontSize: 30, cursor: "pointer", boxShadow: "0 8px 24px rgba(46,91,255,.5)", lineHeight: 1,
        }}>+</button>
      )}

      {/* ===== Modals ===== */}
      {editor && (
        <EventEditor t={t} ctx={ctx} draft={editor.draft} isNew={editor.isNew}
          canEdit={canEditEvent(editor.draft)} onSave={saveEvent} onDelete={deleteEvent} onClose={() => setEditor(null)} />
      )}
      {adminOpen && <Admin t={t} ctx={ctx} onClose={() => setAdminOpen(false)} />}
      {confirmDel && (
        <div onClick={() => setConfirmDel(null)} style={{ position: "fixed", inset: 0, background: "rgba(5,10,22,.62)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: t.surface, color: t.text, borderRadius: 14, border: `1px solid ${t.border}`, padding: 22, maxWidth: 360, width: "100%", boxShadow: t.shadow }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Termin löschen?</div>
            <div style={{ fontSize: 14, color: t.muted, marginBottom: 18 }}>„{confirmDel.title}" wird dauerhaft gelöscht.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Btn t={t} kind="ghost" onClick={() => setConfirmDel(null)}>Abbrechen</Btn>
              <Btn t={t} kind="danger" onClick={reallyDelete}>Löschen</Btn>
            </div>
          </div>
        </div>
      )}

      <Toast t={t} toast={toast} />

      {/* „Rückgängig" nach dem Löschen – sitzt ÜBER dem Toast (gestapelt) */}
      {undo && (
        <div style={{
          position: "fixed", left: "50%", transform: "translateX(-50%)",
          bottom: `calc(${toast ? 148 : 92}px + env(safe-area-inset-bottom))`, zIndex: 440,
          background: t.navy, color: "#fff", borderRadius: 12, padding: "9px 10px 9px 16px",
          display: "flex", alignItems: "center", gap: 14, maxWidth: "92vw",
          boxShadow: "0 10px 30px rgba(0,0,0,.4)",
        }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{undo.msg}</span>
          <button onClick={doUndo} style={{
            background: "rgba(255,255,255,.18)", color: "#fff", border: "none", borderRadius: 8,
            padding: "6px 12px", fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
          }}>Rückgängig</button>
        </div>
      )}

      {menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 110 }} />}
    </div>
  );
}

const FONT = "Mulish, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const hBtn = {
  background: "rgba(255,255,255,.12)", color: "#fff", border: "1px solid rgba(255,255,255,.2)",
  borderRadius: 8, width: 34, height: 34, fontSize: 16, cursor: "pointer", lineHeight: 1,
};
const menuItem = (t) => ({
  display: "block", width: "100%", textAlign: "left", background: "none", border: "none",
  padding: "9px 10px", fontSize: 13.5, fontWeight: 600, color: t.text, cursor: "pointer",
  borderRadius: 7, fontFamily: "inherit",
});

function FilterSelect({ t, label, value, onChange, options }) {
  return (
    <label style={{ display: "block", minWidth: 0, flex: "1 1 130px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: t.muted, marginBottom: 4 }}>{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{
        padding: "8px 10px", border: `1px solid ${t.border}`, borderRadius: 9, background: t.input,
        color: t.text, fontSize: 16, fontFamily: "inherit", width: "100%", maxWidth: "100%", minWidth: 0,
      }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

// Globale Suchergebnisse über alle Bereiche
function SearchResults({ t, results, userById, onOpen, query }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: t.text }}>🔍 Suchergebnisse</h3>
        <span style={{ fontSize: 12, fontWeight: 700, color: t.muted }}>({results.length})</span>
      </div>
      {results.length === 0 ? (
        <div style={{ fontSize: 13, color: t.faint, padding: "6px 0" }}>
          Nichts gefunden für „{query.trim()}".
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {results.map((r, i) => {
            const who = userById && userById(r.who);
            return (
              <button key={r.kind + (r.item.id || i)} onClick={() => onOpen(r)} style={{
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
                    {r.sub && <span>· {r.sub}</span>}
                    {who && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: who.color }} />
                      {who.name}
                    </span>}
                  </span>
                </span>
                <span style={{ flex: "none", fontSize: 15, color: t.faint }}>›</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
