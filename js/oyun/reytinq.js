/* reytinq.js - Reytinqlər pəncərəsi (ayrıca fayl, real vaxt, ilk 50)
   Panel faylına yaz:  import "./reytinq.js";
   (bu fayl panel faylı ilə eyni qovluqda olmalıdır) */
import { fsdb } from "../core/firebase.js";
import { cariOyuncu } from "./yardimci.js";
import {
  collection, query, orderBy, limit, where, onSnapshot, doc, getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/* ====== BURANI ÖZ FIELD ADLARINA GÖRƏ DÜZƏLT ======
   users sənədində hər bölmənin xalını saxlayan field adı.
   Field yoxdursa o bölmə boş görünür. */
const KOLLEKSIYA = "users";
const AD_FIELD = "name";        // oyunçunun adı
const SEKIL_FIELD = "photo";    // oyunçunun şəkli (url)
const XAL_FIELD = {
  kiss:   "kisses",   // öpüş sayı
  music:  "music",    // mahnı xalı
  heart:  "likes",    // ürək/bəyənmə
  hearts: "couples",  // cütlük
  smile:  "smiles",   // smaylik
  crown:  "gifts",    // hədiyyə
  time:   "playTime"  // oyun vaxtı
};
const LIMIT = 50;

const TABS = [
  { id: "kiss",   icon: "💋", title: "Ən çox öpülən" },
  { id: "music",  icon: "🎵", title: "Ən çox mahnı" },
  { id: "heart",  icon: "💙", title: "Ən çox bəyənilən" },
  { id: "hearts", icon: "💞", title: "Ən çox cütlük" },
  { id: "smile",  icon: "😄", title: "Ən çox smaylik" },
  { id: "crown",  icon: "👑", title: "Ən çox hədiyyə" },
  { id: "time",   icon: "🕒", title: "Ən çox oyun vaxtı" }
];

const state = { tab: "kiss" };
let root, unsubList = null, unsubMe = null, meData = null, listDocs = [];

function fmt(n) { return Number(n || 0).toLocaleString("fr-FR"); }

function sira(place, ad, sekil, xal, mine) {
  const t = TABS.find(x => x.id === state.tab);
  const d = document.createElement("div");
  d.className = "rtq-row" + (mine ? " mine" : "");
  const img = document.createElement("img");
  img.alt = ""; img.src = sekil || "";
  img.onerror = () => { img.style.visibility = "hidden"; };
  const pl = document.createElement("div"); pl.className = "rtq-place"; pl.textContent = place + ".";
  const nm = document.createElement("div"); nm.className = "rtq-name"; nm.textContent = ad || "";
  const sc = document.createElement("div"); sc.className = "rtq-score";
  sc.innerHTML = '<span class="ic">' + t.icon + "</span><span></span>";
  sc.lastChild.textContent = fmt(xal);
  d.append(img, pl, nm, sc);
  return d;
}

function cizList() {
  const list = root.querySelector("#rtq-list");
  const st = list.scrollTop;
  list.innerHTML = "";
  const f = XAL_FIELD[state.tab];
  listDocs.forEach((s, i) => {
    const p = s.data();
    list.appendChild(sira(i + 1, p[AD_FIELD], p[SEKIL_FIELD], p[f], false));
  });
  list.scrollTop = st;
}

async function cizMe() {
  const box = root.querySelector("#rtq-me");
  if (!meData) { box.innerHTML = ""; return; }
  const f = XAL_FIELD[state.tab];
  const xal = Number(meData[f] || 0);
  let yer = "-";
  try {
    const c = await getCountFromServer(
      query(collection(fsdb, KOLLEKSIYA), where(f, ">", xal)));
    yer = c.data().count + 1;
  } catch (e) {}
  box.innerHTML = "";
  box.appendChild(sira(yer, meData[AD_FIELD], meData[SEKIL_FIELD], xal, true));
}

function dinle() {
  if (unsubList) unsubList();
  if (unsubMe) unsubMe();
  const f = XAL_FIELD[state.tab];
  root.querySelector("#rtq-title").textContent = TABS.find(t => t.id === state.tab).title;
  root.querySelectorAll(".rtq-tab").forEach(el =>
    el.classList.toggle("active", el.dataset.id === state.tab));
  root.querySelector("#rtq-list").scrollTop = 0;

  unsubList = onSnapshot(
    query(collection(fsdb, KOLLEKSIYA), orderBy(f, "desc"), limit(LIMIT)),
    (snap) => { listDocs = snap.docs; cizList(); cizMe(); },
    (err) => console.error("reytinq:", err)
  );

  const cari = cariOyuncu();
  if (cari && cari.docId) {
    unsubMe = onSnapshot(doc(fsdb, KOLLEKSIYA, cari.docId), (s) => {
      meData = s.data() || null; cizMe();
    });
  }
}

function qur() {
  root = document.createElement("div");
  root.id = "rtq-overlay";
  root.innerHTML =
    '<div id="rtq-box">' +
      '<button id="rtq-close" type="button">×</button>' +
      '<div id="rtq-head">' +
        '<div id="rtq-tabs">' +
          TABS.map(t => '<span class="rtq-tab" data-id="' + t.id + '">' + t.icon + "</span>").join("") +
        "</div>" +
        '<div id="rtq-sub"><span id="rtq-title"></span>' +
          '<select id="rtq-period"><option>hər zaman</option></select></div>' +
      "</div>" +
      '<div id="rtq-list"></div>' +
      '<div id="rtq-me"></div>' +
    "</div>";
  document.body.appendChild(root);
  root.querySelector("#rtq-close").onclick = bagla;
  root.addEventListener("click", (e) => { if (e.target === root) bagla(); });
  root.querySelectorAll(".rtq-tab").forEach(el =>
    el.onclick = () => { state.tab = el.dataset.id; dinle(); });
}

function ac() {
  if (!root) qur();
  root.classList.add("open");
  dinle();
}
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
