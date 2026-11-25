/* reytinq.js - Reytinqlər pəncərəsi (ayrıca fayl, real vaxt, ilk 50, xal dondurma dəstəyi) */
import { fsdb } from "../core/firebase.js";
import { cariOyuncu } from "./yardimci.js";
import {
  collection, query, orderBy, limit, where, onSnapshot, doc, getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/* ====== FIELD ADLARI (users sənədi) ====== */
const KOLLEKSIYA = "users";
const AD_FIELD = "name";
const SEKIL_FIELD = "photo";
const XAL_FIELD = {
  kiss: "kisses", music: "music", heart: "likes", hearts: "couples",
  smile: "smiles", crown: "gifts", time: "playTime"
};
const FREEZE_FIELD_MAP = {
  kisses: "freeze_kisses",
  music: "freeze_music",
  smiles: "freeze_smiles"
};
const AD_ALT = ["name", "ad", "username", "nick", "nickname", "displayName", "login", "isim", "adi"];
const SEKIL_ALT = ["photo", "sekil", "avatar", "photoURL", "photoUrl", "avatarUrl", "img", "image", "imageUrl", "pp", "foto", "pic", "picture", "profilePhoto"];
const LIMIT = 50;
const IMG_QOVLUQ = "images/reytinqler/";

const TABS = [
  { id: "kiss",   emo: "💋", title: "Ən çox öpülən" },
  { id: "music",  emo: "🎵", title: "Ən çox mahnı" },
  { id: "heart",  emo: "💙", title: "Ən çox bəyənilən" },
  { id: "hearts", emo: "💞", title: "Ən çox cütlük" },
  { id: "smile",  emo: "😄", title: "Ən çox smaylik" },
  { id: "crown",  emo: "👑", title: "Ən çox hədiyyə" },
  { id: "time",   emo: "🕒", title: "Ən çox oyun vaxtı" }
];

const state = { tab: "kiss" };
let root, unsubList = null, unsubMe = null, meData = null, listDocs = [], loggedKeys = false;

const fmt = (n) => Number(n || 0).toLocaleString("fr-FR").replace(/\u202f/g, " ");

function vaxtMs(val) {
  if (!val) return 0;
  if (typeof val === "number") return val > 0 && val < 1e12 ? val * 1000 : val;
  if (val && typeof val.toMillis === "function") return val.toMillis();
  if (val && typeof val.seconds === "number") return val.seconds * 1000;
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n < 1e12 ? n * 1000 : n;
}

function donmaBitisVaxti(p, field) {
  if (!p) return 0;
  let maxMs = 0;

  if (p.dondurulmusXallar && p.dondurulmusXallar[field]) {
    maxMs = Math.max(maxMs, vaxtMs(p.dondurulmusXallar[field]));
  }

  const fKey = FREEZE_FIELD_MAP[field];
  if (fKey && p[fKey]) {
    maxMs = Math.max(maxMs, vaxtMs(p[fKey]));
  }

  return maxMs;
}

function xalDondurulubMu(p, field) {
  const bitis = donmaBitisVaxti(p, field);
  return bitis > Date.now();
}

function gorunenXal(p, field) {
  if (!p) return 0;
  if (xalDondurulubMu(p, field)) return 0;
  return Number(p[field] || 0);
}

function ilk(p, secilen, alt) {
  for (const k of [secilen, ...alt]) {
    const v = p[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

function ikon(t) {
  const img = document.createElement("img");
  img.alt = t.title || t.id;
  img.src = IMG_QOVLUQ + t.id + ".png";
  img.onerror = () => {
    const s = document.createElement("span");
    s.className = "emo";
    s.textContent = t.emo;
    img.replaceWith(s);
  };
  return img;
}

function sira(place, p, xal, mine) {
  const t = TABS.find(x => x.id === state.tab);
  const d = document.createElement("div");
  d.className = "rtq-row" + (mine ? " mine" : "");

  const foto = document.createElement("img");
  foto.className = "foto"; foto.alt = "";
  const src = ilk(p, SEKIL_FIELD, SEKIL_ALT);
  if (src) foto.src = src;
  foto.onerror = () => { foto.removeAttribute("src"); };

  const info = document.createElement("div"); info.className = "rtq-info";
  const pl = document.createElement("span"); pl.className = "rtq-place"; pl.textContent = place + ".";
  const nm = document.createElement("span"); nm.className = "rtq-name"; nm.textContent = ilk(p, AD_FIELD, AD_ALT);
  info.append(pl, nm);

  const sc = document.createElement("div"); sc.className = "rtq-score";
  const ic = document.createElement("span"); ic.className = "ic"; ic.appendChild(ikon(t));
  const say = document.createElement("span"); say.className = "say"; say.textContent = fmt(xal);
  sc.append(ic, say);

  d.append(foto, info, sc);
  return d;
}

function aktivSiyahi() {
  const f = XAL_FIELD[state.tab];
  return listDocs.filter(s => {
    const p = s.data();
    if (!p) return false;
    if (donmaBitisVaxti(p, f) > 0) {
      if (xalDondurulubMu(p, f)) return false;
      if (window.Xallar && typeof window.Xallar.donmaYoxla === "function") {
        window.Xallar.donmaYoxla(s.id, p);
      }
    }
    return true;
  }).slice(0, LIMIT);
}

function cizList() {
  const list = root.querySelector("#rtq-list");
  const st = list.scrollTop;
  list.innerHTML = "";
  const f = XAL_FIELD[state.tab];
  const gorunenler = aktivSiyahi();
  gorunenler.forEach((s, i) => {
    const p = s.data();
    list.appendChild(sira(i + 1, p, gorunenXal(p, f), false));
  });
  list.scrollTop = st;
}

async function cizMe() {
  const box = root.querySelector("#rtq-me");
  const cari = cariOyuncu();
  if (!meData) { box.innerHTML = ""; return; }
  const f = XAL_FIELD[state.tab];

  if (xalDondurulubMu(meData, f)) {
    box.innerHTML = "";
    box.appendChild(sira("-", meData, 0, true));
    return;
  }

  const xal = gorunenXal(meData, f);
  let yer = null;
  const gorunenler = aktivSiyahi();
  const idx = cari && cari.docId ? gorunenler.findIndex(s => s.id === cari.docId) : -1;
  if (idx >= 0) yer = idx + 1;
  else {
    try {
      const c = await getCountFromServer(query(collection(fsdb, KOLLEKSIYA), where(f, ">", xal)));
      yer = c.data().count + 1;
    } catch (e) { yer = "-"; }
  }
  box.innerHTML = "";
  box.appendChild(sira(yer, meData, xal, true));
}

function yenileTabGorunusu() {
  if (!root) return;
  const activeTab = TABS.find(t => t.id === state.tab) || TABS[0];
  root.querySelector("#rtq-title").textContent = activeTab.title;
  root.querySelectorAll(".rtq-tab").forEach((el) => {
    const isActive = el.dataset.id === state.tab;
    el.classList.toggle("active", isActive);
    el.setAttribute("aria-selected", isActive ? "true" : "false");
  });
}

function dinle() {
  if (unsubList) unsubList();
  if (unsubMe) unsubMe();
  const f = XAL_FIELD[state.tab];
  yenileTabGorunusu();
  root.querySelector("#rtq-list").scrollTop = 0;

  unsubList = onSnapshot(
    query(collection(fsdb, KOLLEKSIYA), orderBy(f, "desc"), limit(80)),
    (snap) => {
      listDocs = snap.docs;
      if (!loggedKeys && snap.docs[0]) {
        loggedKeys = true;
        console.log("reytinq: users sənədinin field-ləri:", Object.keys(snap.docs[0].data()));
      }
      cizList(); cizMe();
    },
    (err) => console.error("reytinq:", err)
  );

  const cari = cariOyuncu();
  if (cari && cari.docId) {
    unsubMe = onSnapshot(doc(fsdb, KOLLEKSIYA, cari.docId), (s) => {
      meData = s.data() || null;
      if (meData && window.Xallar && typeof window.Xallar.donmaYoxla === "function") {
        window.Xallar.donmaYoxla(cari.docId, meData);
      }
      cizMe();
    });
  }
}

const X_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#2f8cff" stroke-width="3.6" stroke-linecap="round"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>';

function qur() {
  root = document.createElement("div");
  root.id = "rtq-overlay";
  root.innerHTML =
    '<div id="rtq-box">' +
      '<button id="rtq-close" type="button">' + X_SVG + "</button>" +
      '<div id="rtq-head">' +
        '<div id="rtq-tabs" role="tablist"></div>' +
        '<div id="rtq-sub"><span id="rtq-title"></span>' +
          '<select id="rtq-period"><option>hər zaman</option></select></div>' +
      "</div>" +
      '<div id="rtq-list"></div>' +
      '<div id="rtq-me"></div>' +
    "</div>";
  document.body.appendChild(root);

  const tabs = root.querySelector("#rtq-tabs");
  TABS.forEach(t => {
    const el = document.createElement("div");
    el.className = "rtq-tab" + (t.id === state.tab ? " active" : "");
    el.dataset.id = t.id;
    el.setAttribute("role", "tab");
    el.appendChild(ikon(t));
    el.onclick = () => {
      if (state.tab === t.id) return;
      state.tab = t.id;
      yenileTabGorunusu();
      dinle();
    };
    tabs.appendChild(el);
  });

  yenileTabGorunusu();

  root.querySelector("#rtq-close").onclick = bagla;
  root.addEventListener("click", (e) => { if (e.target === root) bagla(); });
}

function ac() { if (!root) qur(); root.classList.add("open"); dinle(); }
function bagla() {
  if (!root) return;
  root.classList.remove("open");
  if (unsubList) { unsubList(); unsubList = null; }
  if (unsubMe) { unsubMe(); unsubMe = null; }
}

window.Reytinq = { ac, bagla };

if (!document.getElementById("rtq-css")) {
  const l = document.createElement("link");
  l.id = "rtq-css"; l.rel = "stylesheet"; l.href = "css/reytinq.css";
  document.head.appendChild(l);
}
document.addEventListener("menyu-sec", (e) => { if (e.detail === "reytinqler") ac(); });
