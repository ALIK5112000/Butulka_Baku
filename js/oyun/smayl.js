import { fsdb, rtdb } from "../core/firebase.js";
import { MASA_NOMRESI } from "../core/config.js";
import { cariOyuncu } from "./yardimci.js";
import { doc, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ref, onValue, set, onDisconnect } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

/* ADDIM 2: Smaylik (jest) paneli. Oyunçu öz şəklinə toxunanda açılır.
   users/{uid}: smileBal = smaylik balansı, smiles = smaylik XALI (istifadə edilən smayliklərin cəmi qiyməti) */

/* ---------- AYARLAR (buranı özünüz dəyişə bilərsiniz) ---------- */
/* Bonus ürək -> jeton (smaylik) paketləri. Şəkillər images/jeton/ qovluğundadır */
const PAKETLER = [
  { urek: 180, smayl: 450, img: "images/jeton/p450.png" },
  { urek: 30,  smayl: 75,  img: "images/jeton/p75.png" },
  { urek: 10,  smayl: 25,  img: "images/jeton/p25.png" },
  { urek: 5,   smayl: 10,  img: "images/jeton/p10.png" },
  { urek: 3,   smayl: 3,   img: "images/jeton/p3.png" }
];
/* Alma səsi: öz səs faylınız varsa yazın, məs. "sesler/smayl.mp3". null olsa hazır "sikkə" səsi çalınır */
const SATIN_ALMA_SESI = null;

/* Jestlər. e = emoji (öz şəkliniz olsa e əvəzinə img: "images/jest/1.png" yazın), q = qiymət (smaylik),
   a = şəkil üstündəki hərəkət: bounce | spin | float | shake | pulse | zoom */
const JESTLER = [
  { id: "j1",  e: "😍", q: 1,  a: "pulse" },
  { id: "j2",  e: "😂", q: 1,  a: "shake" },
  { id: "j3",  e: "😘", q: 1,  a: "float" },
  { id: "j4",  e: "👍", q: 1,  a: "bounce" },
  { id: "j5",  e: "😎", q: 2,  a: "spin" },
  { id: "j6",  e: "🎉", q: 2,  a: "zoom" },
  { id: "j7",  e: "🔥", q: 2,  a: "float" },
  { id: "j8",  e: "💃", q: 2,  a: "shake" },
  { id: "j9",  e: "🥳", q: 3,  a: "bounce" },
  { id: "j10", e: "🤩", q: 3,  a: "spin" },
  { id: "j11", e: "😈", q: 3,  a: "pulse" },
  { id: "j12", e: "💋", q: 3,  a: "float" },
  { id: "j13", e: "🌹", q: 5,  a: "zoom" },
  { id: "j14", e: "🍾", q: 5,  a: "shake" },
  { id: "j15", e: "👑", q: 5,  a: "bounce" },
  { id: "j16", e: "🚀", q: 10, a: "float" },
  { id: "j17", e: "💎", q: 10, a: "spin" },
  { id: "j18", e: "🦄", q: 15, a: "pulse" },
  { id: "j19", e: "🏆", q: 20, a: "zoom" },
  { id: "j20", e: "💰", q: 50, a: "bounce" }
];

const CSS = `
.sp-root{display:none}
.sp-root.open{display:block}
.sp-top{position:fixed;left:0;right:0;z-index:9990;background:#fff;display:flex;align-items:center;padding:0 3.9vw;box-sizing:border-box;font-family:Roboto,Arial,sans-serif}
.sp-av{width:7.4vw;height:7.4vw;border-radius:50%;background:#3b8fe0;border:0;padding:0;display:flex;align-items:center;justify-content:center;flex:none}
.sp-av svg{width:4.4vw;height:4.4vw}
.sp-ttl{flex:1;margin-left:3.2vw;font:400 3.9vw/1.2 Roboto,Arial,sans-serif;color:#a8a8a8}
.sp-bal{display:flex;align-items:center;gap:1.4vw;height:8.8vw;padding:0 1.2vw 0 1.6vw;border:.3vw solid #9cc454;border-radius:5vw;background:#f4f9e8}
.sp-bal svg.sm{width:5vw;height:5vw}
.sp-bal b{font:700 4.2vw/1 Roboto,Arial,sans-serif;color:#222}
.sp-plus{width:6.4vw;height:6.4vw;border-radius:50%;background:#7cc92f;border:0;padding:0;display:flex;align-items:center;justify-content:center}
.sp-plus svg{width:3.6vw;height:3.6vw}
.sp-list{position:fixed;left:0;right:0;bottom:0;z-index:9990;background:#fff;overflow-y:auto;padding:2vw 0 22vw;box-sizing:border-box;font-family:Roboto,Arial,sans-serif}
.sp-grid{display:grid;grid-template-columns:repeat(5,1fr)}
.sp-cell{display:flex;flex-direction:column;align-items:center;padding:2.2vw 0 2.6vw}
.sp-cell:active .sp-e{transform:scale(.9)}
.sp-e{height:14vw;display:flex;align-items:center;justify-content:center;font-size:11.5vw;line-height:1;transition:transform .12s}
.sp-e img{height:13vw;width:auto}
.sp-pr{display:flex;align-items:center;gap:1.2vw;margin-top:1.4vw;font:700 4vw/1 Roboto,Arial,sans-serif;color:#333}
.sp-pr svg{width:4.7vw;height:4.7vw}
.sp-x{position:fixed;right:2vw;bottom:2.1vw;width:8.3vw;height:8.3vw;border-radius:50%;background:#7cc92f;border:0;padding:0;z-index:9991;display:flex;align-items:center;justify-content:center;box-shadow:0 .6vw 1.8vw rgba(0,0,0,.3)}
.sp-x svg{width:4.4vw;height:4.4vw}
.sp-shop{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9995;display:none;align-items:center;justify-content:center;font-family:Roboto,Arial,sans-serif}
.sp-shop.open{display:flex}
.sp-sh{position:relative;width:88vw;max-width:420px;background:#ebe9f7;border-radius:6vw;box-sizing:border-box}
.sp-sh h3{margin:0;padding:6vw 0 5vw;text-align:center;font:700 4.6vw/1.2 Roboto,Arial,sans-serif;color:#fff;background:linear-gradient(#9c82d8,#b3a2e3);border-radius:6vw 6vw 0 0}
.sp-sh p{display:none}
.sp-sx{position:absolute;top:-3.5vw;right:-3vw;width:10vw;height:10vw;border-radius:50%;background:#fff;border:0;padding:0;display:flex;align-items:center;justify-content:center;box-shadow:0 .6vw 1.8vw rgba(0,0,0,.3)}
.sp-sx svg{width:4.6vw;height:4.6vw}
.sp-pk{display:grid;grid-template-columns:repeat(3,1fr);gap:2vw;padding:2vw 2.4vw 2.4vw}
.sp-p{background:#fff;border-radius:4vw;padding:2.4vw 2.4vw 1.6vw;text-align:center;box-shadow:0 .3vw 1vw rgba(0,0,0,.12)}
.sp-p img{width:100%;display:block}
.sp-p button{margin-top:1.4vw;width:100%;border:0;background:none;display:flex;align-items:center;justify-content:center;gap:2vw;font:700 5.6vw/1.2 Roboto,Arial,sans-serif;color:#222}
.sp-p button svg{width:6.4vw;height:6.4vw}
.sp-t{position:fixed;left:50%;bottom:24vw;transform:translateX(-50%);max-width:80vw;text-align:center;z-index:20000;background:rgba(35,35,35,.92);color:#fff;font:500 3.5vw/1.3 Roboto,Arial,sans-serif;padding:2.6vw 4.6vw;border-radius:3vw}
.pfj{position:fixed;z-index:9000;pointer-events:none;line-height:1;will-change:transform,opacity;animation-fill-mode:both}
.pfj img{height:1em;width:auto;display:block}
@keyframes pfj-bounce{0%{transform:translate(-50%,-50%) scale(0);opacity:0}20%{transform:translate(-50%,-95%) scale(1.2);opacity:1}40%{transform:translate(-50%,-50%) scale(1)}60%{transform:translate(-50%,-80%) scale(1.1)}80%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(-50%,-50%) scale(1);opacity:0}}
@keyframes pfj-spin{0%{transform:translate(-50%,-50%) rotate(0) scale(0);opacity:0}25%{transform:translate(-50%,-50%) rotate(180deg) scale(1.3);opacity:1}80%{transform:translate(-50%,-50%) rotate(720deg) scale(1);opacity:1}100%{transform:translate(-50%,-50%) rotate(720deg) scale(1);opacity:0}}
@keyframes pfj-float{0%{transform:translate(-50%,-30%) scale(.6);opacity:0}20%{opacity:1}100%{transform:translate(-50%,-220%) scale(1.25);opacity:0}}
@keyframes pfj-shake{0%{transform:translate(-50%,-50%) scale(0);opacity:0}15%{transform:translate(-50%,-50%) scale(1);opacity:1}25%{transform:translate(-50%,-50%) rotate(-18deg)}40%{transform:translate(-50%,-50%) rotate(18deg)}55%{transform:translate(-50%,-50%) rotate(-14deg)}70%{transform:translate(-50%,-50%) rotate(14deg)}85%{transform:translate(-50%,-50%) rotate(0);opacity:1}100%{transform:translate(-50%,-50%);opacity:0}}
@keyframes pfj-pulse{0%{transform:translate(-50%,-50%) scale(0);opacity:0}20%{transform:translate(-50%,-50%) scale(1.5);opacity:1}40%{transform:translate(-50%,-50%) scale(1)}60%{transform:translate(-50%,-50%) scale(1.5)}80%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(-50%,-50%) scale(1);opacity:0}}
@keyframes pfj-zoom{0%{transform:translate(-50%,-50%) scale(0);opacity:0}30%{transform:translate(-50%,-50%) scale(2.2);opacity:1}70%{transform:translate(-50%,-50%) scale(1.6);opacity:1}100%{transform:translate(-50%,-50%) scale(2.6);opacity:0}}
`;
const st = document.createElement("style");
st.textContent = CSS;
document.head.appendChild(st);

const SM = '<svg class="sm" viewBox="0 0 48 48"><defs><linearGradient id="spg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc83a"/><stop offset="1" stop-color="#f08a00"/></linearGradient></defs><circle cx="24" cy="24" r="22" fill="url(#spg)" stroke="#e17f00" stroke-width="2"/><path d="M12 21q4.5-6 9 0M27 21q4.5-6 9 0" fill="none" stroke="#7a3c00" stroke-width="3" stroke-linecap="round"/><path d="M12 28q12 14 24 0z" fill="#7a3c00"/><path d="M17 34q7 5 14 0" fill="none" stroke="#e8573b" stroke-width="3" stroke-linecap="round"/></svg>';
const UREK = '<svg viewBox="0 0 24 22"><path d="M12 21C5 16 1 12 1 7.2A5.2 5.2 0 0 1 12 4.5 5.2 5.2 0 0 1 23 7.2C23 12 19 16 12 21z" fill="#ff6a3d" stroke="#fff" stroke-width="1.2"/></svg>';
const num = v => Number(v) || 0;
const fmt = n => num(n).toLocaleString("ru-RU");
const MEN = (cariOyuncu() || {}).docId || null;

let tT = null;
function toast(msg) {
  let t = document.getElementById("spToast");
  if (!t) { t = document.createElement("div"); t.id = "spToast"; t.className = "sp-t"; document.body.appendChild(t); }
  t.textContent = msg; t.style.display = "block";
  clearTimeout(tT); tT = setTimeout(() => { t.style.display = "none"; }, 2600);
}

/* ---------- Səs ---------- */
function ses() {
  try {
    if (SATIN_ALMA_SESI) { new Audio(SATIN_ALMA_SESI).play().catch(() => {}); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    const c = new C();
    [[880, 0, .09], [1320, .09, .16]].forEach(([f, t0, d]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(.0001, c.currentTime + t0);
      g.gain.exponentialRampToValueAtTime(.35, c.currentTime + t0 + .02);
      g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + t0 + d);
      o.connect(g); g.connect(c.destination);
      o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + d + .02);
    });
    setTimeout(() => c.close(), 800);
  } catch (e) {}
}

/* ---------- Panel ---------- */
const root = document.createElement("div");
root.className = "sp-root";
root.innerHTML =
  '<div class="sp-top"><button class="sp-av" aria-label="Profil"><svg viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="8" r="4.2"/><path d="M3.500 21c0-4.600 3.800-7 8.500-7s8.500 2.400 8.500 7z"/></svg></button>' +
    '<span class="sp-ttl">Jestdən istifadə et</span>' +
    '<div class="sp-bal">' + SM + '<b id="spBal">0</b><button class="sp-plus" aria-label="Smaylik al"><svg viewBox="0 0 24 24"><path d="M12 4v16M4 12h16" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg></button></div></div>' +
  '<div class="sp-list"><div class="sp-grid"></div></div>' +
  '<button class="sp-x" aria-label="Bağla"><svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" stroke="#fff" stroke-width="3.400" stroke-linecap="round"/></svg></button>' +
  '<div class="sp-shop"><div class="sp-sh"><button class="sp-sx" aria-label="Bağla"><svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" stroke="#7d5fd0" stroke-width="3.200" stroke-linecap="round"/></svg></button>' +
    '<h3>Jeton mağazası</h3><p>Bonus ürək qarşılığında</p><div class="sp-pk"></div></div></div>';
document.body.appendChild(root);

const $ = s => root.querySelector(s);
const grid = $(".sp-grid"), shop = $(".sp-shop");

JESTLER.forEach(g => {
  const c = document.createElement("div");
  c.className = "sp-cell";
  c.innerHTML = '<div class="sp-e">' + (g.img ? '<img src="' + g.img + '" alt="">' : g.e) + '</div><div class="sp-pr">' + SM + g.q + "</div>";
  c.onclick = () => jestIsle(g);
  grid.appendChild(c);
});

const pk = $(".sp-pk");
PAKETLER.forEach(p => {
  const d = document.createElement("div");
  d.className = "sp-p";
  d.innerHTML = '<img src="' + p.img + '" alt="' + p.smayl + '"><button>' + UREK + p.urek + "</button>";
  const b = d.querySelector("button");
  d.onclick = () => satinAl(p, b);
  pk.appendChild(d);
});

function yerlesdir() {
  const u = document.getElementById("ustPanel"), c = document.getElementById("chatYeri");
  const ur = u ? u.getBoundingClientRect() : null, cr = c ? c.getBoundingClientRect() : null;
  const top = $(".sp-top"), list = $(".sp-list");
  top.style.top = (ur && ur.height > 0 ? ur.top : 0) + "px";
  top.style.height = (ur && ur.height > 0 ? ur.height : innerWidth * 0.124) + "px";
  list.style.top = (cr && cr.height > 0 ? cr.top : innerHeight * 0.55) + "px";
}
window.addEventListener("resize", () => { if (root.classList.contains("open")) yerlesdir(); });

let balUnsub = null;
function ac() {
  if (!MEN) return;
  yerlesdir();
  root.classList.add("open");
  if (!balUnsub) balUnsub = onSnapshot(doc(fsdb, "users", MEN), s => {
    $("#spBal").textContent = fmt((s.data() || {}).smileBal);
  }, () => {});
}
function bagla() {
  root.classList.remove("open");
  shop.classList.remove("open");
  if (balUnsub) { balUnsub(); balUnsub = null; }
}
$(".sp-x").onclick = bagla;
$(".sp-av").onclick = () => { if (window.ProfilKart) window.ProfilKart.ac(MEN); };
$(".sp-plus").onclick = () => shop.classList.add("open");
$(".sp-sx").onclick = () => shop.classList.remove("open");
shop.addEventListener("click", e => { if (e.target === shop) shop.classList.remove("open"); });

window.SmaylPanel = { ac, bagla };

/* ---------- Smaylik almaq (bonus ürək -> smaylik) ---------- */
let mesgul = false;
async function satinAl(p, btn) {
  if (mesgul || !MEN) return;
  mesgul = true; btn.disabled = true;
  try {
    await runTransaction(fsdb, async tx => {
      const r = doc(fsdb, "users", MEN), s = await tx.get(r), d = s.data() || {};
      if (num(d.hearts) < p.urek) throw new Error("YETMIR");
      tx.update(r, { hearts: num(d.hearts) - p.urek, smileBal: num(d.smileBal) + p.smayl });
    });
    ses();
    toast("+" + fmt(p.smayl) + " smaylik");
  } catch (e) {
    if (e.message === "YETMIR") {
      toast("Bonus ürəyiniz çatmır");
      if (window.HeartShop) { shop.classList.remove("open"); window.HeartShop.open(); }
    } else { console.error(e); toast("Xəta baş verdi, yenidən cəhd edin"); }
  }
  mesgul = false; btn.disabled = false;
}

/* ---------- Jest işlətmək ---------- */
async function jestIsle(g) {
  if (mesgul || !MEN) return;
  mesgul = true;
  try {
    await runTransaction(fsdb, async tx => {
      const r = doc(fsdb, "users", MEN), s = await tx.get(r), d = s.data() || {};
      if (num(d.smileBal) < g.q) throw new Error("YETMIR");
      tx.update(r, { smileBal: num(d.smileBal) - g.q, smiles: num(d.smiles) + g.q });
    });
    /* hamıya göstər: n unikal olduğu üçün hər istifadə bir dəfə oynayır */
    const r = ref(rtdb, "masalar/" + MASA_NOMRESI + "/jest/" + MEN);
    onDisconnect(r).remove();
    set(r, { i: g.id, n: Date.now() + "-" + Math.random().toString(36).slice(2, 7) });
  } catch (e) {
    if (e.message === "YETMIR") { toast("Smaylik çatmır, alın"); shop.classList.add("open"); }
    else { console.error(e); toast("Xəta baş verdi, yenidən cəhd edin"); }
  }
  mesgul = false;
}

/* ---------- Hərəkət: oyunçunun şəkli üstündə (hamıda görünür) ---------- */
let oturacaqlar = {}, spin = null;
onValue(ref(rtdb, "masalar/" + MASA_NOMRESI + "/oturacaqlar"), s => { oturacaqlar = s.val() || {}; });
onValue(ref(rtdb, "masalar/" + MASA_NOMRESI + "/raund/spin"), s => { spin = s.val() || null; });

function fotoTap(uid) {
  const ortalar = document.querySelectorAll("#masa .orta");
  if (spin && spin.qu === uid && ortalar[0] && ortalar[0].classList.contains("goster")) return ortalar[0];
  if (spin && spin.ou === uid && ortalar[1] && ortalar[1].classList.contains("goster")) return ortalar[1];
  for (const k in oturacaqlar) {
    if (oturacaqlar[k] && oturacaqlar[k].uid === uid) return document.querySelector("#masa .yer-" + k);
  }
  return null;
}

function oyna(uid, g) {
  const el = fotoTap(uid);
  if (!el) return;
  const r = (el.querySelector(".foto") || el).getBoundingClientRect();
  if (!r.width) return;
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const say = g.q >= 10 ? 6 : g.q >= 5 ? 3 : 1;
  for (let i = 0; i < say; i++) {
    const d = document.createElement("div");
    d.className = "pfj";
    const esas = i === 0;
    d.style.left = (cx + (esas ? 0 : (Math.random() - .5) * r.width * 1.3)) + "px";
    d.style.top = (cy + (esas ? 0 : (Math.random() - .5) * r.height * 1.1)) + "px";
    d.style.fontSize = (esas ? 14 : 7 + Math.random() * 3) + "vw";
    d.style.animation = "pfj-" + g.a + " " + (esas ? 2.4 : 2 + Math.random() * .8) + "s ease " + (esas ? 0 : Math.random() * .5) + "s both";
    d.innerHTML = g.img ? '<img src="' + g.img + '" alt="">' : g.e;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 3600);
  }
}

let ilk = true;
const sonN = {};
onValue(ref(rtdb, "masalar/" + MASA_NOMRESI + "/jest"), s => {
  const v = s.val() || {};
  for (const uid in v) {
    const x = v[uid];
    if (!x || sonN[uid] === x.n) continue;
    sonN[uid] = x.n;
    if (ilk) continue;
    const g = JESTLER.find(j => j.id === x.i);
    if (g) oyna(uid, g);
  }
  for (const uid in sonN) if (!v[uid]) delete sonN[uid];
  ilk = false;
});
