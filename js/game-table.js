// Masa məntiqi: oyunçuların real vaxtda oturması, çıxması və yenilənməsi
import { db } from "./firebase-init.js";
import {
  collection, doc, setDoc, getDoc, getDocFromServer, getDocs, query, where, onSnapshot,
  runTransaction, deleteDoc, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { CONFIG } from "./game-config.js";

const seatsCol = collection(db, "seats");
const handlers = {};
const avatarCache = new Map();
let me = null, current = null, unsub = null, beat = null, tick = null, lastSeats = [];

// Telefonların saatları fərqli ola bilər. Ona görə hər kəs SERVER vaxtına görə hesablanır.
let offset = 0; // server vaxtı - bu telefonun vaxtı
const nowServer = () => Date.now() + offset;
const toMs = v => (v == null ? null : (typeof v.toMillis === "function" ? v.toMillis() : Number(v)));
const isFresh = d => {
  if (!d) return false;
  const t = toMs(d.lastSeen);
  if (t === null) return true; // hələ serverə yazılır, deməli təzədir
  return nowServer() - t < CONFIG.staleMs;
};

async function syncClock() {
  try {
    const ref = doc(db, "clocks", String(me.id));
    const t0 = Date.now();
    await setDoc(ref, { t: serverTimestamp() });
    const s = await getDocFromServer(ref);
    const t1 = Date.now();
    const server = toMs(s.data().t);
    if (server) offset = server - (t0 + t1) / 2;
  } catch (e) { console.warn("Saat sinxronu alınmadı", e); }
}

export function on(evt, fn) { handlers[evt] = fn; }
const emit = (evt, data) => handlers[evt] && handlers[evt](data);
const seatKey = (t, s) => `t${t}_s${s}`;

export function setMe(info) { me = info; }
export function getCurrent() { return current; }

function payload(table, seat) {
  return { table, seat, uid: me.id, docId: me.docId, name: me.name, gender: me.gender, vip: me.vip, lastSeen: serverTimestamp() };
}

export async function getAvatar(docId) {
  if (avatarCache.has(docId)) return avatarCache.get(docId);
  let url = CONFIG.defaultAvatar;
  try {
    const s = await getDoc(doc(db, "users", docId));
    if (s.exists() && s.data().avatar) url = s.data().avatar;
  } catch (e) {}
  avatarCache.set(docId, url);
  return url;
}

async function cleanMine() {
  const snap = await getDocs(query(seatsCol, where("uid", "==", me.id)));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
}

// Ən çox oyunçusu olan, dolu olmayan masanı seç; yoxdursa yeni masa aç
async function pickTable(exclude) {
  const cutoff = Timestamp.fromMillis(nowServer() - CONFIG.staleMs);
  const snap = await getDocs(query(seatsCol, where("lastSeen", ">", cutoff)));
  const counts = {};
  snap.forEach(d => { const t = d.data().table; counts[t] = (counts[t] || 0) + 1; });

  let best = null;
  Object.keys(counts).forEach(k => {
    const t = Number(k), c = counts[t];
    if (exclude.has(t) || c >= CONFIG.seatsPerTable) return;
    if (best === null || c > counts[best]) best = t;
  });
  if (best !== null) return best;

  for (let t = CONFIG.firstTableNumber; t < CONFIG.firstTableNumber + CONFIG.maxTables; t++) {
    if (!exclude.has(t) && !counts[t]) return t;
  }
  return null;
}

async function claimSeat(table) {
  const snap = await getDocs(query(seatsCol, where("table", "==", table)));
  const taken = new Set();
  snap.forEach(d => { const x = d.data(); if (isFresh(x)) taken.add(x.seat); });

  const free = [];
  for (let i = 0; i < CONFIG.seatsPerTable; i++) if (!taken.has(i)) free.push(i);
  free.sort(() => Math.random() - 0.5);

  for (const s of free) {
    const ref = doc(db, "seats", seatKey(table, s));
    try {
      const ok = await runTransaction(db, async tx => {
        const cur = await tx.get(ref);
        if (cur.exists() && isFresh(cur.data()) && cur.data().uid !== me.id) return false;
        tx.set(ref, payload(table, s));
        return true;
      });
      if (ok) return s;
    } catch (e) { console.warn("Yer tutula bilmədi", e); }
  }
  return null;
}

function stopListening() {
  if (unsub) { unsub(); unsub = null; }
  if (beat) { clearInterval(beat); beat = null; }
  if (tick) { clearInterval(tick); tick = null; }
}

function publish() { emit("seats", lastSeats.filter(isFresh)); }

function listen(table) {
  unsub = onSnapshot(query(seatsCol, where("table", "==", table)), snap => {
    lastSeats = [];
    snap.forEach(d => lastSeats.push(d.data()));
    publish();
  });
  tick = setInterval(publish, 10000);
}

export async function enter(exclude = new Set()) {
  stopListening();
  await syncClock();
  await cleanMine();
  for (let i = 0; i < 6; i++) {
    const table = await pickTable(exclude);
    if (table === null) break;
    const seat = await claimSeat(table);
    if (seat !== null) {
      current = { table, seat, joinedAt: nowServer() };
      listen(table);
      beat = setInterval(touch, CONFIG.heartbeatMs);
      emit("joined", current);
      return current;
    }
    exclude.add(table);
  }
  emit("failed");
  return null;
}

// "Buradayam" siqnalı. Yerimizi başqası tutubsa, yenidən otururuq.
export async function touch() {
  if (!current || !me) return;
  const ref = doc(db, "seats", seatKey(current.table, current.seat));
  try {
    const ok = await runTransaction(db, async tx => {
      const cur = await tx.get(ref);
      if (cur.exists() && isFresh(cur.data()) && cur.data().uid !== me.id) return false;
      tx.set(ref, payload(current.table, current.seat));
      return true;
    });
    if (!ok) { emit("lost"); await enter(); return; }
  } catch (e) { console.warn(e); }
  publish();
}

export async function resync() { await syncClock(); await touch(); }

export async function leave() {
  const c = current;
  current = null;
  stopListening();
  if (c) {
    try { await deleteDoc(doc(db, "seats", seatKey(c.table, c.seat))); } catch (e) {}
  }
}

export async function change() {
  const ex = new Set(current ? [current.table] : []);
  await leave();
  return enter(ex);
}
