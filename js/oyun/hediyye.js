import { fsdb, rtdb } from "../core/firebase.js";
import { MASA_NOMRESI } from "../core/config.js";
import { cariOyuncu } from "./yardimci.js";
import { doc, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ref, onValue, set, onDisconnect, runTransaction as rtTx } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

/* ADDIM 3: Hədiyyə paneli. Başqa oyunçunun şəklinə toxunanda açılır.
   Hədiyyənin qiyməti bonus ürəkdən (users/{uid}.hearts) çıxır.
   - Öpüş hədiyyəsi: alanın öpüş xalı və masadakı öpüş sayğacı hədiyyə sayı qədər artır.
   - Hədiyyə alan oyunçunun musiqisi hazırda çalırsa: onun musiqi xalı hədiyyə sayı qədər artır. */

/* ---------- AYARLAR ---------- */
/* Şəkillər: images/hediyye/ papkasında. Hədiyyənin şəklini dəyişmək üçün
   həmin faylı eyni adla əvəz et (və ya img yolunu dəyiş).
   Şəkil tapılmasa e (emoji) göstərilir.
   q = qiymət (bonus ürək), opus:true = öpüş hədiyyəsi, k = bölmə (ozel | yeni) */
const SEKIL_PAPKA = "images/hediyye/";
const HEDIYYELER = [
  { id: "g1",  e: "💋", img: SEKIL_PAPKA + "opus.png",    q: 1, opus: true, k: "ozel" },
  { id: "g3",  e: "🍅", img: SEKIL_PAPKA + "pomidor.png", q: 1, k: "yeni" },
  { id: "g7",  e: "🐸", img: SEKIL_PAPKA + "qurbaga.png", q: 2 },
  { id: "g2",  e: "🍓", img: SEKIL_PAPKA + "cilek.png",   q: 1, k: "yeni" },
  { id: "g4",  e: "🪨", img: SEKIL_PAPKA + "dash.png",    q: 1 },
  { id: "g5",  e: "🌹", img: SEKIL_PAPKA + "gul.png",     q: 1, k: "ozel" },
  { id: "g6",  e: "🍬", img: SEKIL_PAPKA + "konfet.png",  q: 1 },
  { id: "g8",  e: "🐧", img: SEKIL_PAPKA + "pinqvin.png", q: 1 },
  { id: "g9",  e: "🐥", img: SEKIL_PAPKA + "cuce.png",    q: 1, k: "yeni" },
  { id: "g10", e: "🌷", img: SEKIL_PAPKA + "lale.png",    q: 1 },
  { id: "g11", e: "💐", img: SEKIL_PAPKA + "buket.png",   q: 2, k: "ozel" },
  { id: "g12", e: "🍫", img: SEKIL_PAPKA + "sokolad.png", q: 2 },
  { id: "g13", e: "🍷", img: SEKIL_PAPKA + "sarab.png",   q: 2 },
  { id: "g14", e: "💍", img: SEKIL_PAPKA + "uzuk.png",    q: 3, k: "ozel" },
  { id: "g15", e: "👑", img: SEKIL_PAPKA + "tac.png",     q: 3, k: "ozel" },
  { id: "g16", e: "🎩", img: SEKIL_PAPKA + "sapka.png",   q: 2 },
  { id: "g17", e: "🧸", img: SEKIL_PAPKA + "ayicik.png",  q: 3, k: "yeni" },
  { id: "g18", e: "🚗", img: SEKIL_PAPKA + "masin.png",   q: 5, k: "yeni" },
  { id: "g19", e: "💎", img: SEKIL_PAPKA + "almaz.png",   q: 5, k: "ozel" },
  { id: "g20", e: "🏰", img: SEKIL_PAPKA + "qala.png",    q: 9, k: "ozel" }
];
/* "Klip qoş" və "Mahnı qoş" kafellərinin qiyməti (yazı üçündür; real ödəniş mövcud musiqi sistemində olur) */
const KLIP_QIYMETI = 9, MAHNI_QIYMETI = 5;

const CSS = `
.hd-root{display:none}
.hd-root.open{display:block}
.hd-top{position:fixed;left:0;right:0;z-index:9990;background:#fff;display:flex;align-items:center;padding:0 3.9vw;box-sizing:border-box;font-family:Roboto,Arial,sans-serif}
.hd-av{width:7.4vw;height:7.4vw;border-radius:50%;background:#3b8fe0;border:0;padding:0;display:flex;align-items:center;justify-content:center;flex:none}
.hd-av svg{width:4.4vw;height:4.4vw}
.hd-ttl{flex:1;margin-left:3.2vw;min-width:0}
.hd-ttl b{display:block;font:700 4.2vw/1.15 Roboto,Arial,sans-serif;color:#8a8a8a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hd-ttl span{display:block;font:400 3.5vw/1.15 Roboto,Arial,sans-serif;color:#b5b5b5}
.hd-plus{width:7.3vw;height:7.3vw;border-radius:50%;background:#7cc92f;border:0;padding:0;display:flex;align-items:center;justify-content:center;flex:none}
.hd-plus svg{width:4.2vw;height:4.2vw}
.hd-main{position:fixed;left:0;right:0;bottom:0;z-index:9990;background:#fff;display:flex;flex-direction:column;font-family:Roboto,Arial,sans-serif}
.hd-ctl{background:#f3f0fa;padding:1.8vw 2.4vw 1.6vw;border-bottom:.3vw solid #e1dbf0}
.hd-r1{display:flex;justify-content:space-between;align-items:center}
.hd-seg{display:flex;border:.3vw solid #c9bfe6;border-radius:5vw;overflow:hidden;background:#fff}
.hd-seg button{border:0;background:none;padding:0 3.4vw;height:6.6vw;font:600 3.7vw/1 Roboto,Arial,sans-serif;color:#6c4fd6;border-left:.3vw solid #e1dbf0}
.hd-seg button:first-child{border-left:0}
.hd-seg button.on{background:#6c4fd6;color:#fff}
.hd-r2{display:flex;justify-content:flex-end;align-items:center;gap:2vw;margin-top:2vw}
.hd-r2 span{font:600 4vw/1 Roboto,Arial,sans-serif;color:#6c4fd6;margin-right:1vw}
.hd-pm{width:8.4vw;height:8.4vw;border-radius:50%;border:0;background:#e3dcf6;color:#6c4fd6;font:700 5vw/1 Roboto,Arial,sans-serif;padding:0}
.hd-n{width:11.8vw;height:8vw;border:.3vw solid #c9bfe6;border-radius:2.4vw;text-align:center;font:700 4vw/1 Roboto,Arial,sans-serif;color:#333;background:#fff;padding:0;box-sizing:border-box}
.hd-list{flex:1;overflow-y:auto;padding:1vw 0 22vw}
.hd-grid{display:grid;grid-template-columns:repeat(5,1fr)}
.hd-cell{display:flex;flex-direction:column;align-items:center;padding:2.4vw 0 2.4vw;border-radius:2vw;margin:.4vw}
.hd-cell.sel{background:#efe9ff;box-shadow:inset 0 0 0 .4vw #6c4fd6}
.hd-cell:active .hd-e{transform:scale(.9)}
.hd-e{width:15vw;height:14vw;display:flex;align-items:center;justify-content:center;font-size:11.5vw;line-height:1;transition:transform .12s}
.hd-e img{max-width:14vw;max-height:13vw;width:auto;height:auto;object-fit:contain;display:block}
.hd-pr{display:flex;align-items:center;gap:1.2vw;margin-top:1.4vw;font:700 4.4vw/1 Roboto,Arial,sans-serif;color:#333}
.hd-pr svg{width:5.2vw;height:5vw}
.hd-send{position:fixed;left:50%;bottom:3vw;transform:translateX(-50%);z-index:9991;display:none;height:8.6vw;padding:0 8vw;border:0;border-radius:5vw;background:#7cc92f;color:#fff;font:700 4vw/1 Roboto,Arial,sans-serif;box-shadow:0 .6vw 1.8vw rgba(0,0,0,.3)}
.hd-x{position:fixed;right:2vw;bottom:2.1vw;width:8.3vw;height:8.3vw;border-radius:50%;background:#7cc92f;border:0;padding:0;z-index:9991;display:flex;align-items:center;justify-content:center;box-shadow:0 .6vw 1.8vw rgba(0,0,0,.3)}
.hd-x svg{width:4.4vw;height:4.4vw}
.hd-tray{position:fixed;right:3.9vw;z-index:9992;display:none;gap:2.4vw;padding:1.6vw 2vw;background:#fff;border-radius:6vw;box-shadow:0 .6vw 2.4vw rgba(0,0,0,.3)}
.hd-tray.open{display:flex}
.hd-tray button{width:10vw;height:10vw;border-radius:50%;border:0;padding:0;display:flex;align-items:center;justify-content:center;font-size:6vw;line-height:1;color:#fff}
.hd-tb{background:#3b8fe0}.hd-tg{background:#f26aa6}.hd-tx{background:#e03d1c;font:700 5vw/1 Roboto,Arial,sans-serif}
.yer.hd-mk .foto{outline:.9vw solid #7cc92f;outline-offset:.2vw;box-shadow:0 0 3vw #7cc92f}
.hd-t{position:fixed;left:50%;bottom:24vw;transform:translateX(-50%);max-width:80vw;text-align:center;z-index:20000;background:rgba(35,35,35,.92);color:#fff;font:500 3.5vw/1.3 Roboto,Arial,sans-serif;padding:2.6vw 4.6vw;border-radius:3vw}
.hd-fly{position:fixed;z-index:9000;pointer-events:none;line-height:1;will-change:transform,opacity;font-size:11vw}
.hd-fly img{height:1em;width:auto;display:block}
.hd-fly i{position:absolute;right:-3vw;bottom:-2vw;font:700 4vw/1 Roboto,Arial,sans-serif;font-style:normal;color:#fff;background:#6c4fd6;border-radius:3vw;padding:.8vw 1.8vw}
`;
const st = document.createElement("style");
st.textContent = CSS;
document.head.appendChild(st);

/* Ürək stikeri: bütün qiymətlərdə eynidir (gradient yoxdur, ID təkrarı problemi olmur).
   Öz şəklini istəsən: '<img src="images/hediyye/urek.png" alt="">' yaz. */
const UREK = '<svg viewBox="0 0 24 22"><path d="M12 21C5 16 1 12 1 7.2A5.2 5.2 0 0 1 12 4.5 5.2 5.2 0 0 1 23 7.2C23 12 19 16 12 21z" fill="#dc5a22"/></svg>';

/* Şəkil varsa onu, yoxdursa (və ya yüklənməsə) emojini göstərir */
const gorsel = g => g.img
  ? '<img src="' + g.img + '" alt="" onerror="this.replaceWith(document.createTextNode(\'' + g.e + '\'))">'
  : g.e;

const num = v => Number(v) || 0;
const MEN = (cariOyuncu() || {}).docId || null;

let tT = null;
function toast(msg) {
  let t = document.getElementById("hdToast");
  if (!t) { t = document.createElement("div"); t.id = "hdToast"; t.className = "hd-t"; document.body.appendChild(t); }
  t.textContent = msg; t.style.display = "block";
  clearTimeout(tT); tT = setTimeout(() => { t.style.display = "none"; }, 2600);
}

/* ---------- Panel ---------- */
const root = document.createElement("div");
root.className = "hd-root";
root.innerHTML =
  '<div class="hd-top"><button class="hd-av" aria-label="Profil"><svg viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="8" r="4.2"/><path d="M3.5 21c0-4.6 3.8-7 8.5-7s8.5 2.4 8.5 7z"/></svg></button>' +
    '<div class="hd-ttl"><b id="hdAd">...</b><span id="hdSub">üçün hədiyyə göndər</span></div>' +
    '<button class="hd-plus" aria-label="Bonus ürək al"><svg viewBox="0 0 24 24"><path d="M12 4v16M4 12h16" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg></button></div>' +
  '<div class="hd-main"><div class="hd-ctl">' +
    '<div class="hd-r1"><div class="hd-seg hd-tabs"><button data-k="ozel">Özəl</button><button data-k="yeni">Yeni</button><button data-k="hamisi" class="on">Hamısı</button></div>' +
    '<div class="hd-seg hd-mode"><button data-m="avto" class="on">Avtomatik</button><button data-m="el">Əl ilə</button></div></div>' +
    '<div class="hd-r2"><span>Say</span><button class="hd-pm" data-d="-1">−</button><input class="hd-n" value="1" inputmode="numeric" maxlength="2"><button class="hd-pm" data-d="1">+</button></div>' +
  '</div><div class="hd-list"><div class="hd-grid"></div></div></div>' +
  '<div class="hd-tray"><button class="hd-tb" aria-label="Oğlanlar">👦</button><button class="hd-tg" aria-label="Qızlar">👧</button><button class="hd-tx" aria-label="Seçimi dayandır">✕</button></div>' +
  '<button class="hd-send">Göndər</button>' +
  '<button class="hd-x" aria-label="Bağla"><svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/></svg></button>';
document.body.appendChild(root);

const $ = s => root.querySelector(s);
const grid = $(".hd-grid"), sayInp = $(".hd-n"), sendBtn = $(".hd-send");
let hedef = null, hedefAd = "...", tab = "hamisi", mod = "avto", sec = null, mesgul = false, uUnsub = null;
const isaret = new Set();
const tray = $(".hd-tray");

const say = () => Math.min(99, Math.max(1, parseInt(sayInp.value, 10) || 1));

function ciz() {
  grid.innerHTML = "";
  /* ilk iki kafel: klip və mahnı qoşmaq */
  if (tab === "hamisi") {
    const musiqiKafel = (img, emoji, qiymet, ac) => {
      const m = document.createElement("div");
      m.className = "hd-cell";
      m.innerHTML = '<div class="hd-e">' + gorsel({ img, e: emoji }) + '</div><div class="hd-pr">' + UREK + qiymet + "</div>";
      m.onclick = ac;
      grid.appendChild(m);
    };
    /* 1) Klip */
    musiqiKafel(SEKIL_PAPKA + "klip.png", "🎬", KLIP_QIYMETI, () => {
      const kimin = hedef;                      /* musiqi bu oyunçunun adına qoşulur */
      bagla();
      const bt = document.getElementById("musiqiBtn1");
      if (!bt) { if (window.MusiqiPanel) window.MusiqiPanel.open("popular"); return; }
      window.__klipHedef = kimin || null;       /* klip.js çata yazanda bunu da əlavə edir */
      bt.click();
      klipHedefIzle();
    });
    /* 2) Mahnı */
    musiqiKafel(SEKIL_PAPKA + "mahni.png", "🎵", MAHNI_QIYMETI, () => {
      const kimin = hedef;
      bagla();
      const bt = document.getElementById("musiqiBtn2");   /* mahnı düyməsinin id-si fərqlidirsə bunu dəyiş */
      window.__klipHedef = kimin || null;
      if (bt) { bt.click(); klipHedefIzle(); }
      else if (window.MusiqiPanel) window.MusiqiPanel.open("popular");
    });
  }
  HEDIYYELER.filter(g => tab === "hamisi" || g.k === tab).forEach(g => {
    const c = document.createElement("div");
    c.className = "hd-cell" + (sec && sec.id === g.id ? " sel" : "");
    c.innerHTML = '<div class="hd-e">' + gorsel(g) + '</div><div class="hd-pr">' + UREK + g.q + "</div>";
    c.onclick = () => {
      if (mod === "avto") { gonder(g, say()); return; }
      sec = g; sendBtn.style.display = "block"; ciz();
    };
    grid.appendChild(c);
  });
}

root.querySelectorAll(".hd-tabs button").forEach(b => b.onclick = () => {
  tab = b.dataset.k;
  root.querySelectorAll(".hd-tabs button").forEach(x => x.classList.toggle("on", x === b));
  ciz();
});
root.querySelectorAll(".hd-mode button").forEach(b => b.onclick = () => {
  mod = b.dataset.m;
  root.querySelectorAll(".hd-mode button").forEach(x => x.classList.toggle("on", x === b));
  sec = null; sendBtn.style.display = "none"; ciz();
});
root.querySelectorAll(".hd-pm").forEach(b => b.onclick = () => { sayInp.value = Math.min(99, Math.max(1, say() + Number(b.dataset.d))); });
sayInp.oninput = () => { sayInp.value = sayInp.value.replace(/\D/g, ""); };
sayInp.onblur = () => { sayInp.value = say(); };
sendBtn.onclick = () => { if (sec) gonder(sec, say()); };

/* Musiqi pəncərəsi bağlananda "kimin adına" qeydi silinir (sonrakı adi musiqi qoşma təsirlənməsin) */
function klipHedefIzle() {
  const pen = document.getElementById("klipPenceresi");
  if (!pen) { setTimeout(() => { window.__klipHedef = null; }, 120000); return; }
  // Pəncərə bağlanan kimi hədəfi silmirik: klip.js klipi seçib çata yazana qədər vaxt lazımdır.
  // (klip.js çata yazandan sonra özü də sıfırlayır.)
  const mo = new MutationObserver(() => { if (pen.hidden) { mo.disconnect(); setTimeout(() => { window.__klipHedef = null; }, 10000); } });
  mo.observe(pen, { attributes: true, attributeFilter: ["hidden"] });
}

function yerlesdir() {
  const u = document.getElementById("ustPanel"), c = document.getElementById("chatYeri");
  const ur = u ? u.getBoundingClientRect() : null, cr = c ? c.getBoundingClientRect() : null;
  const top = $(".hd-top"), main = $(".hd-main");
  top.style.top = (ur && ur.height > 0 ? ur.top : 0) + "px";
  top.style.height = (ur && ur.height > 0 ? ur.height : innerWidth * 0.124) + "px";
  main.style.top = (cr && cr.height > 0 ? cr.top : innerHeight * 0.55) + "px";
  tray.style.top = ((ur && ur.height > 0 ? ur.bottom : innerWidth * 0.124) + innerWidth * 0.01) + "px";
}
window.addEventListener("resize", () => { if (root.classList.contains("open")) yerlesdir(); });

function ac(uid) {
  if (!uid || uid === MEN) return;
  /* "Masanı dəyiş" pəncərəsi (dost/masa siyahısı) açıqkən hədiyyə paneli açılmasın */
  const my = document.getElementById("modalYer");
  if (my && getComputedStyle(my).display !== "none") return;
  if (uUnsub) { uUnsub(); uUnsub = null; }
  if (!root.classList.contains("open")) { isaret.clear(); tray.classList.remove("open"); }
  hedef = uid; sec = null; sendBtn.style.display = "none";
  hedefAd = "..."; basliq();
  uUnsub = onSnapshot(doc(fsdb, "users", uid), s => { hedefAd = (s.data() || {}).username || "Oyunçu"; basliq(); }, () => {});
  yerlesdir(); ciz();
  root.classList.add("open");
}
function bagla() {
  root.classList.remove("open");
  sendBtn.style.display = "none";
  if (uUnsub) { uUnsub(); uUnsub = null; }
  hedef = null; sec = null;
  isaret.clear(); tray.classList.remove("open"); markYenile();
}
$(".hd-x").onclick = bagla;
$(".hd-av").onclick = () => { if (hedef && window.ProfilKart) window.ProfilKart.ac(hedef); };
$(".hd-plus").onclick = () => tray.classList.toggle("open");

/* ---------- Çoxlu seçim: qızlar / oğlanlar / tək-tək ---------- */
function basliq() {
  if (isaret.size) { $("#hdAd").textContent = "Seçilmiş: " + isaret.size; $("#hdSub").textContent = "oyunçuya hədiyyə göndər"; }
  else { $("#hdAd").textContent = hedefAd; $("#hdSub").textContent = "üçün hədiyyə göndər"; }
}
function markYenile() {
  for (const u of [...isaret]) if (!Object.values(oturacaqlar).some(o => o && o.uid === u)) isaret.delete(u);
  const var_ = new Set();
  for (const k in oturacaqlar) { const o = oturacaqlar[k]; if (o && isaret.has(o.uid)) var_.add(k); }
  document.querySelectorAll("#masa .yer").forEach(el => {
    const m = /yer-(\d+)/.exec(el.className);
    el.classList.toggle("hd-mk", !!(m && var_.has(m[1])));
  });
  basliq();
}
setInterval(markYenile, 400);
function isaretle(uid) {
  if (!uid || uid === MEN) return;
  if (isaret.has(uid)) isaret.delete(uid); else isaret.add(uid);
  markYenile();
}
function toplu(qiz) {
  const l = [];
  for (const k in oturacaqlar) { const o = oturacaqlar[k]; if (o && o.uid && o.uid !== MEN && (o.cins === "q") === qiz) l.push(o.uid); }
  if (!l.length) { toast(qiz ? "Masada qız yoxdur" : "Masada oğlan yoxdur"); return; }
  const hamisi = l.every(u => isaret.has(u));
  l.forEach(u => (hamisi ? isaret.delete(u) : isaret.add(u)));
  markYenile();
}
$(".hd-tg").onclick = () => toplu(true);
$(".hd-tb").onclick = () => toplu(false);
$(".hd-tx").onclick = () => { isaret.clear(); tray.classList.remove("open"); markYenile(); };

window.HediyyePanel = { ac, bagla, hedef: () => hedef, modu: () => root.classList.contains("open") && tray.classList.contains("open"), isaretle };

/* ---------- Hazırda kimin musiqisi çalır? ---------- */
/* klip.js klipi bazada saxlayır: masalar/<masa>/aktivKlip (djUid = klipi qoşan oyunçu) */
let oturacaqlar = {}, spin = null, offset = 0, aktivKlip = null;
onValue(ref(rtdb, "masalar/" + MASA_NOMRESI + "/oturacaqlar"), s => { oturacaqlar = s.val() || {}; });
onValue(ref(rtdb, "masalar/" + MASA_NOMRESI + "/raund/spin"), s => { spin = s.val() || null; });
onValue(ref(rtdb, "masalar/" + MASA_NOMRESI + "/aktivKlip"), s => { aktivKlip = s.val() || null; });
onValue(ref(rtdb, ".info/serverTimeOffset"), s => { offset = s.val() || 0; });

function djUid() {
  const d = aktivKlip;
  if (!d || !d.djUid) return null;
  const bas = num(d.startedAt), dur = num(d.durationSec);
  if (bas && dur && Date.now() + offset > bas + dur * 1000 + 3000) return null;   /* klip bitib */
  return d.djUid;
}

/* ---------- Hədiyyə göndərmək ---------- */
async function gonder(g, c) {
  if (mesgul || !MEN) return;
  /* alanlar: işarələnmişlər, işarə yoxdursa toxunulan oyunçu */
  const alanlar = isaret.size ? [...isaret].filter(u => u !== MEN) : (hedef ? [hedef] : []);
  if (!alanlar.length) { toast("Oyunçu seçilməyib"); return; }
  mesgul = true;
  const cost = g.q * c * alanlar.length;
  try {
    await runTransaction(fsdb, async tx => {
      const r = doc(fsdb, "users", MEN), s = await tx.get(r), d = s.data() || {};
      if (num(d.hearts) < cost) throw new Error("YETMIR");
      tx.update(r, { hearts: num(d.hearts) - cost });
    });
    /* öpüş hədiyyəsi: masadakı sayğac artır, alan oyunçunun öz klienti "kisses" xalını eyni qədər artırır */
    if (g.opus) alanlar.forEach(k => rtTx(ref(rtdb, "masalar/" + MASA_NOMRESI + "/opus/" + k), v => num(v) + c));
    /* hədiyyə alanlardan musiqisi çalan varsa: hər hədiyyəyə +1 musiqi xalı */
    const dj = djUid();
    if (dj && alanlar.includes(dj) && window.Xallar) window.Xallar.musiqiHediyye(dj, c);
    /* hamıya göstər */
    const r = ref(rtdb, "masalar/" + MASA_NOMRESI + "/hediyye/" + MEN);
    onDisconnect(r).remove();
    set(r, { to: alanlar, i: g.id, c, n: Date.now() + "-" + Math.random().toString(36).slice(2, 7) });
    /* hədiyyə atılandan sonra işarələr sıfırlanır */
    isaret.clear(); tray.classList.remove("open"); sec = null; sendBtn.style.display = "none"; ciz(); markYenile();
  } catch (e) {
    if (e.message === "YETMIR") { toast("Bonus ürəyiniz çatmır"); if (window.HeartShop) window.HeartShop.open(); }
    else { console.error(e); toast("Xəta baş verdi, yenidən cəhd edin"); }
  }
  mesgul = false;
}

/* ---------- Animasiya: göndərənin şəklindən alanın şəklinə uçur ---------- */
function fotoTap(uid) {
  const ortalar = document.querySelectorAll("#masa .orta");
  if (spin && spin.qu === uid && ortalar[0] && ortalar[0].classList.contains("goster")) return ortalar[0];
  if (spin && spin.ou === uid && ortalar[1] && ortalar[1].classList.contains("goster")) return ortalar[1];
  let ehtiyat = null;
  for (const k in oturacaqlar) {
    if (oturacaqlar[k] && oturacaqlar[k].uid === uid) {
      const e = document.querySelector("#masa .yer-" + k);
      if (e && e.classList.contains("dolu")) return e;   /* ekranda həqiqətən dolu görünən yer üstündür */
      if (e && !ehtiyat) ehtiyat = e;
    }
  }
  return ehtiyat;
}
const merkez = el => {
  const r = (el.querySelector(".foto") || el).getBoundingClientRect();
  return r.width ? [r.left + r.width / 2, r.top + r.height / 2] : null;
};

function oynaBir(kimden, x, to) {
  const g = HEDIYYELER.find(h => h.id === x.i);
  const a = fotoTap(kimden), b = fotoTap(to);
  if (!g || !b) return;
  const pb = merkez(b), pa = (a && merkez(a)) || [innerWidth / 2, innerHeight * 0.6];
  if (!pb) return;
  const d = document.createElement("div");
  d.className = "hd-fly";
  d.style.left = pa[0] + "px"; d.style.top = pa[1] + "px";
  d.innerHTML = gorsel(g) + (x.c > 1 ? "<i>x" + x.c + "</i>" : "");
  document.body.appendChild(d);
  const dx = pb[0] - pa[0], dy = pb[1] - pa[1];
  const an = d.animate([
    { transform: "translate(-50%,-50%) scale(.4)", opacity: 0 },
    { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: .15 },
    { transform: "translate(calc(-50% + " + dx + "px),calc(-50% + " + dy + "px)) scale(1.1)", opacity: 1, offset: .6 },
    { transform: "translate(calc(-50% + " + dx + "px),calc(-50% + " + dy + "px)) scale(1.6)", opacity: 1, offset: .85 },
    { transform: "translate(calc(-50% + " + dx + "px),calc(-50% + " + dy + "px)) scale(1.9)", opacity: 0 }
  ], { duration: 1800, easing: "ease-in-out", fill: "both" });
  an.onfinish = () => d.remove();
}

function oyna(kimden, x) {
  const l = Array.isArray(x.to) ? x.to : [x.to];
  l.forEach((to, i) => setTimeout(() => oynaBir(kimden, x, to), i * 120));
}

let ilk = true;
const sonN = {};
onValue(ref(rtdb, "masalar/" + MASA_NOMRESI + "/hediyye"), s => {
  const v = s.val() || {};
  for (const uid in v) {
    const x = v[uid];
    if (!x || sonN[uid] === x.n) continue;
    sonN[uid] = x.n;
    if (!ilk) oyna(uid, x);
  }
  for (const uid in sonN) if (!v[uid]) delete sonN[uid];
  ilk = false;
});
