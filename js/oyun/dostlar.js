import { rtdb, fsdb } from "../core/firebase.js";
import { MASA_NOMRESI } from "../core/config.js";
import { cariOyuncu } from "./yardimci.js";
import { ref, get, set, onValue, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { doc, getDoc, getDocs, collection, query, where } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const cari = cariOyuncu() || {};
const HEFTE = 7 * 86400000;
const DOST_SAHELERI = ["friends", "dostlar", "friendList"];

// ---------- Prezans: kim hansi masadadır ----------
const adHazir = cari.docId
  ? getDoc(doc(fsdb, "users", cari.docId)).then((s) => (s.data() || {}).username || "Oyunçu").catch(() => "Oyunçu")
  : Promise.resolve("Oyunçu");
let bagli = false;
async function prezansYaz() {
  const r = ref(rtdb, "prezans/" + cari.docId);
  set(r, { masa: MASA_NOMRESI, ad: await adHazir, t: serverTimestamp() });
}
if (cari.docId) {
  onValue(ref(rtdb, ".info/connected"), async (s) => {
    bagli = !!s.val();
    if (!bagli) return;
    await onDisconnect(ref(rtdb, "prezans/" + cari.docId)).remove();
    prezansYaz();
  });
  setInterval(() => { if (bagli) prezansYaz(); }, 30000);
}

// ---------- Tanışlar ----------
export function tanisElaveEt(a, b) {
  if (!a || !b || a === b) return;
  set(ref(rtdb, `tanis/${a}/${b}`), Date.now());
  set(ref(rtdb, `tanis/${b}/${a}`), Date.now());
}
export async function tanisYaz(metn, men) {
  try {
    const hamisi = (await get(ref(rtdb, `masalar/${MASA_NOMRESI}/oturacaqlar`))).val() || {};
    const m = String(metn).toLowerCase();
    Object.values(hamisi).filter(Boolean).forEach((o) => {
      const n = String(o.ad || "").toLowerCase();
      if (o.uid !== men && n.length >= 3 && m.includes(n)) tanisElaveEt(men, o.uid);
    });
  } catch (e) {}
}

// ---------- Dostlar ----------
const av = {};
const avatar = (u) => av[u] || (av[u] = getDoc(doc(fsdb, "users", u)).then((s) => (s.data() || {}).avatar || "").catch(() => ""));

async function dostlarim() {
  const ids = new Set();
  try {
    const p = (await getDoc(doc(fsdb, "users", cari.docId))).data() || {};
    DOST_SAHELERI.forEach((k) => (Array.isArray(p[k]) ? p[k] : []).forEach((x) => {
      const v = x && typeof x === "object" ? (x.docId || x.uid || x.id) : x;
      if (v) ids.add(String(v));
    }));
  } catch (e) {}
  try {
    (await getDocs(collection(fsdb, "users", cari.docId, "friends"))).forEach((d) => {
      const x = d.data() || {};
      ids.add(String(x.docId || x.uid || d.id));
    });
  } catch (e) {}
  const out = [];
  for (const x of ids) { // rəqəmli id olarsa sənəd nömrəsinə çevir
    if (/^\d{1,9}$/.test(x)) {
      try {
        const q = await getDocs(query(collection(fsdb, "users"), where("id", "in", [Number(x), x])));
        q.forEach((d) => out.push(d.id));
        continue;
      } catch (e) {}
    }
    out.push(x);
  }
  return out;
}

export function dostBolmesi(box, gir, IK_O, IK_Q) {
  let dost = [], tanis = {}, pre = {}, olu = false;
  const subs = [];

  function ciz() {
    if (olu) return;
    const hamisi = new Set([...dost, ...Object.keys(tanis).filter((k) => Date.now() - tanis[k] < HEFTE)]);
    const siya = [...hamisi].filter((u) => u !== cari.docId && pre[u]);
    box.innerHTML = "";
    if (!siya.length) { box.innerHTML = '<div class="bos">Hazırda oyunda dost və ya tanış yoxdur</div>'; return; }
    siya.forEach((u) => {
      const p = pre[u];
      const r = document.createElement("div"); r.className = "sira";
      r.innerHTML = `<div class="dfoto"></div><div class="mad"></div><div class="say"><span>${IK_O}<b class="so">0</b></span><span>${IK_Q}<b class="sq">0</b></span></div>`;
      r.querySelector(".mad").textContent = p.ad;
      r.onclick = () => gir(p.masa);
      box.appendChild(r);
      avatar(u).then((a) => { if (a) r.querySelector(".dfoto").style.backgroundImage = `url("${String(a).replace(/"/g, "%22")}")`; });
      get(ref(rtdb, `masalar/${p.masa}/oturacaqlar`)).then((s) => {
        const v = Object.values(s.val() || {}).filter(Boolean);
        r.querySelector(".sq").textContent = v.filter((x) => x.cins === "q").length;
        r.querySelector(".so").textContent = v.filter((x) => x.cins !== "q").length;
      });
    });
  }

  dostlarim().then((d) => { dost = d; ciz(); });
  subs.push(onValue(ref(rtdb, "tanis/" + cari.docId), (s) => { tanis = s.val() || {}; ciz(); }));
  subs.push(onValue(ref(rtdb, "prezans"), (s) => { pre = s.val() || {}; ciz(); }));
  return () => { olu = true; subs.forEach((f) => f()); };
}
