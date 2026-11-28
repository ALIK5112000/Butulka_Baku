import { rtdb, fsdb } from "../core/firebase.js";
import { MASA_NOMRESI } from "../core/config.js";
import { cariOyuncu } from "./yardimci.js";
import { ref, get, set, remove, onValue, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { doc, getDoc, getDocs, collection, query, where } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const cari = cariOyuncu() || {};
const HEFTE = 7 * 86400000;
const DOST_SAHELERI = ["friends", "dostlar", "friendList"];

// ---------- Prezans: kim hansi masadadır ----------
const adHazir = cari.docId
  ? getDoc(doc(fsdb, "users", cari.docId)).then((s) => (s.data() || {}).username || "Oyunçu").catch(() => "Oyunçu")
  : Promise.resolve("Oyunçu");
let bagli = false;
let serverOfset = 0;                 // server saatı ilə telefon saatı arasındakı fərq
const PREZANS_OMRU = 80000;          // 30 san-də bir yenilənir; bundan köhnə yazı "oyunda deyil" sayılır
async function prezansYaz() {
  const r = ref(rtdb, "prezans/" + cari.docId);
  set(r, { masa: MASA_NOMRESI, ad: await adHazir, t: serverTimestamp() });
}
function prezansSil() {
  try { remove(ref(rtdb, "prezans/" + cari.docId)); } catch (e) {}
}
// yazı təzədirmi (köhnə qalıb "xəyal" kimi görünməsin)
const prezansTaze = (p) => !p || typeof p.t !== "number" || (Date.now() + serverOfset - p.t) < PREZANS_OMRU;
if (cari.docId) {
  onValue(ref(rtdb, ".info/serverTimeOffset"), (s) => { serverOfset = Number(s.val()) || 0; });
  onValue(ref(rtdb, ".info/connected"), async (s) => {
    bagli = !!s.val();
    if (!bagli) return;
    await onDisconnect(ref(rtdb, "prezans/" + cari.docId)).remove();
    prezansYaz();
  });
  setInterval(() => { if (bagli && !document.hidden) prezansYaz(); }, 30000);   // səhifə arxa plandadırsa yeniləmə (tez yox olsun)
  addEventListener("pagehide", prezansSil);                                    // oyundan çıxanda dərhal sil
  addEventListener("pageshow", () => { if (bagli) prezansYaz(); });            // geri qayıdanda yenidən yaz
  document.addEventListener("visibilitychange", () => { if (!document.hidden && bagli) prezansYaz(); });
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

// ---------- Yaddaş: dost və tanış siyahısı telefonda saxlanır, pəncərə dərhal açılır ----------
const lsOxu = (k, v) => { try { const x = JSON.parse(localStorage.getItem(k)); return x == null ? v : x; } catch (e) { return v; } };
const lsYaz = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const K_DOST = "dostKesh_" + cari.docId, K_TANIS = "tanisKesh_" + cari.docId, K_AV = "dostAvKesh";

let dostIds = lsOxu(K_DOST, []);        // dostların id-ləri (telefondan dərhal hazırdır, arxa planda yenilənir)
let tanisKesh = lsOxu(K_TANIS, {});     // tanışlar
let preKesh = null;                     // kim oyundadır: köhnə "oyundadır" göstərməsin deyə telefona yazılmır
let dostSon = 0;
const avLS = lsOxu(K_AV, {});           // şəkil ünvanları
const masaSay = new Map();              // masa -> { o, q } son bilinən oğlan/qız sayı

// ---------- Dostlar ----------
const av = {};
const avatar = (u) => av[u] || (av[u] = getDoc(doc(fsdb, "users", u)).then((s) => {
  const a = (s.data() || {}).avatar || "";
  if (a && avLS[u] !== a) {
    avLS[u] = a;
    const ks = Object.keys(avLS);
    if (ks.length > 200) delete avLS[ks[0]];
    lsYaz(K_AV, avLS);
  }
  return a;
}).catch(() => ""));

// Siyahını bazadan oxuyur. Əsas sənəd oxuna bilməsə null qaytarır (köhnə yaddaşdakı siyahı pozulmasın)
async function dostlarim() {
  const ids = new Set();
  let ok = false;
  try {
    const p = (await getDoc(doc(fsdb, "users", cari.docId))).data() || {};
    ok = true;
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
  return ok ? out : null;
}
async function dostYukle(zorla) {
  if (!cari.docId) return;
  if (!zorla && Date.now() - dostSon < 60000) return;     // dəqiqədə bir dəfədən çox soruşma
  dostSon = Date.now();
  const l = await dostlarim();
  if (l) { dostIds = l; lsYaz(K_DOST, l); }
}

// Oyun açılan kimi arxa planda hazırlaşırıq (pəncərə 9 saniyədən sonra açılır, hər şey artıq hazır olur)
if (cari.docId) {
  dostYukle(true);
  get(ref(rtdb, "tanis/" + cari.docId)).then((s) => { tanisKesh = s.val() || {}; lsYaz(K_TANIS, tanisKesh); }).catch(() => {});
  setTimeout(() => {
    get(ref(rtdb, "prezans")).then((s) => { if (preKesh === null) preKesh = s.val() || {}; }).catch(() => {});
  }, 2500);
}

// ---------- Pəncərədəki "Dostlar və tanışlar" siyahısı ----------
export function dostBolmesi(box, gir, IK_O, IK_Q) {
  let olu = false;
  const subs = [];
  const satir = new Map();   // uid -> { el, masa, say }

  function sayAbune(s, masa) {
    if (s.say) s.say();
    s.masa = masa;
    const so = s.el.querySelector(".so"), sq = s.el.querySelector(".sq");
    const k = masaSay.get(masa);
    if (k) { so.textContent = k.o; sq.textContent = k.q; }          // son bilinən say dərhal görünür
    s.say = onValue(ref(rtdb, `masalar/${masa}/oturacaqlar`), (sn) => {
      const v = Object.values(sn.val() || {}).filter(Boolean);
      const q = v.filter((x) => x.cins === "q").length, o = v.filter((x) => x.cins !== "q").length;
      masaSay.set(masa, { o, q });
      so.textContent = o; sq.textContent = q;
    });
  }
  function yarat(u, p) {
    const r = document.createElement("div"); r.className = "sira";
    r.innerHTML = `<div class="dfoto"></div><div class="mad"></div><div class="say"><span>${IK_O}<b class="so">0</b></span><span>${IK_Q}<b class="sq">0</b></span></div>`;
    r.querySelector(".mad").textContent = p.ad;
    const s = { el: r, masa: null, say: null };
    r.onclick = () => gir(s.masa);
    const foto = r.querySelector(".dfoto");
    const goster = (a) => { if (a) foto.style.backgroundImage = `url("${String(a).replace(/"/g, "%22")}")`; };
    goster(avLS[u]);                                               // şəkil telefondan dərhal
    avatar(u).then(goster);
    satir.set(u, s);
    sayAbune(s, p.masa);
    return s;
  }
  function sil(u) {
    const s = satir.get(u);
    if (!s) return;
    if (s.say) s.say();
    s.el.remove();
    satir.delete(u);
  }

  function ciz() {
    if (olu) return;
    if (preKesh === null) {                                         // kim oyundadır hələ bilinmir: "yoxdur" yazma
      if (!box.firstChild) box.innerHTML = '<div class="bos">Yüklənir...</div>';
      return;
    }
    const pre = preKesh;
    const hamisi = new Set([...dostIds, ...Object.keys(tanisKesh).filter((k) => Date.now() - tanisKesh[k] < HEFTE)]);
    // bloklanmış oyunçular siyahıda görünmür (profil-kart.js window.blokluMu verir)
    const siya = [...hamisi].filter((u) => u !== cari.docId && pre[u] && prezansTaze(pre[u]) && !(window.blokluMu && window.blokluMu(u)));   // köhnə qalmış yazılar sayılmır
    if (!siya.length) {
      [...satir.keys()].forEach(sil);
      box.innerHTML = '<div class="bos">Hazırda oyunda dost və ya tanış yoxdur</div>';
      return;
    }
    const b = box.querySelector(".bos"); if (b) b.remove();
    [...satir.keys()].forEach((u) => { if (!siya.includes(u)) sil(u); });
    siya.forEach((u) => {
      const p = pre[u], s = satir.get(u);
      if (!s) { yarat(u, p); return; }
      const ad = s.el.querySelector(".mad");
      if (ad.textContent !== p.ad) ad.textContent = p.ad;
      if (s.masa !== p.masa) sayAbune(s, p.masa);                   // başqa masaya keçibsə
    });
    const hedef = siya.map((u) => satir.get(u).el);
    if (hedef.some((e, i) => box.children[i] !== e)) hedef.forEach((e) => box.appendChild(e));   // yalnız sıra dəyişibsə
  }

  // blok siyahısı dəyişəndə siyahı dərhal yenilənir
  const blokDinle = () => ciz();
  document.addEventListener("blok-deyisdi", blokDinle);

  ciz();                                                            // telefondakı yaddaşla dərhal çək
  dostYukle().then(ciz);
  subs.push(onValue(ref(rtdb, "tanis/" + cari.docId), (s) => { tanisKesh = s.val() || {}; lsYaz(K_TANIS, tanisKesh); ciz(); }));
  subs.push(onValue(ref(rtdb, "prezans"), (s) => { preKesh = s.val() || {}; ciz(); }));
  const saat = setInterval(ciz, 15000);                             // heç nə dəyişməsə də köhnə qalanları təmizləsin
  return () => { olu = true; clearInterval(saat); document.removeEventListener("blok-deyisdi", blokDinle); subs.forEach((f) => f()); satir.forEach((s) => s.say && s.say()); satir.clear(); };
}
