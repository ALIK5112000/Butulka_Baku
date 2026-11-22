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
const SATIN_ALMA_SESI = "sesler/smayl.mp3";
const SES_OBJ = SATIN_ALMA_SESI ? Object.assign(new Audio(SATIN_ALMA_SESI), { preload: "auto" }) : null;

/* Jestlər. img = şəkil (w = eni, vw ilə), q = qiymət; emoji istəsəniz img əvəzinə e: "😍" yazın, q = qiymət (smaylik),
   a = şəkil üstündəki hərəkət: bounce | spin | float | shake | pulse | zoom */
const JESTLER = [
  { id: "j1", img: "images/jest/j01.png", w: 12.96, q: 1, a: "pulse" },
  { id: "j2", img: "images/jest/j02.png", w: 11.85, q: 3, a: "shake" },
  { id: "j3", img: "images/jest/j03.png", w: 14.81, q: 1, a: "float" },
  { id: "j4", img: "images/jest/j04.png", w: 14.81, q: 1, a: "bounce" },
  { id: "j5", img: "images/jest/j05.png", w: 14.35, q: 1, a: "zoom" },
  { id: "j6", img: "images/jest/j06.png", w: 18.33, q: 2, a: "pulse" },
  { id: "j7", img: "images/jest/j07.png", w: 11.94, q: 1, a: "shake" },
  { id: "j8", img: "images/jest/j08.png", w: 16.94, q: 2, a: "float" },
  { id: "j9", img: "images/jest/j09.png", w: 11.76, q: 1, a: "bounce" },
  { id: "j10", img: "images/jest/j10.png", w: 12.13, q: 3, a: "zoom" },
  { id: "j11", img: "images/jest/j11.png", w: 12.87, q: 2, a: "pulse" },
  { id: "j12", img: "images/jest/j12.png", w: 12.22, q: 3, a: "shake" },
  { id: "j13", img: "images/jest/j13.png", w: 11.85, q: 2, a: "float" },
  { id: "j14", img: "images/jest/j14.png", w: 11.67, q: 2, a: "bounce" },
  { id: "j15", img: "images/jest/j15.png", w: 11.85, q: 1, a: "zoom" },
  { id: "j16", img: "images/jest/j16.png", w: 11.85, q: 3, a: "pulse" },
  { id: "j17", img: "images/jest/j17.png", w: 11.85, q: 2, a: "shake" },
  { id: "j18", img: "images/jest/j18.png", w: 11.76, q: 2, a: "float" },
  { id: "j19", img: "images/jest/j19.png", w: 16.02, q: 2, a: "bounce" },
  { id: "j20", img: "images/jest/j20.png", w: 14.81, q: 2, a: "zoom" },
  { id: "j21", img: "images/jest/j21.png", w: 11.85, q: 2, a: "pulse" },
  { id: "j22", img: "images/jest/j22.png", w: 12.04, q: 3, a: "shake" },
  { id: "j23", img: "images/jest/j23.png", w: 15.0, q: 2, a: "float" },
  { id: "j24", img: "images/jest/j24.png", w: 11.94, q: 3, a: "bounce" },
  { id: "j25", img: "images/jest/j25.png", w: 14.72, q: 5, a: "zoom" },
  { id: "j26", img: "images/jest/j26.png", w: 18.15, q: 100, a: "pulse" },
  { id: "j27", img: "images/jest/j27.png", w: 18.43, q: 1, a: "shake" },
  { id: "j28", img: "images/jest/j28.png", w: 18.52, q: 1, a: "float" },
  { id: "j29", img: "images/jest/j29.png", w: 18.33, q: 1, a: "bounce" },
  { id: "j32", img: "images/jest/j32.png", w: 12.69, q: 3, a: "shake" },
  { id: "j33", img: "images/jest/j33.png", w: 15.46, q: 2, a: "float" },
  { id: "j34", img: "images/jest/j34.png", w: 12.31, q: 2, a: "bounce" },
  { id: "j35", img: "images/jest/j35.png", w: 15.74, q: 1, a: "zoom" },
  { id: "j36", img: "images/jest/j36.png", w: 11.76, q: 2, a: "pulse" },
  { id: "j37", img: "images/jest/j37.png", w: 16.2, q: 2, a: "shake" },
  { id: "j38", img: "images/jest/j38.png", w: 15.0, q: 2, a: "float" },
  { id: "j39", img: "images/jest/j39.png", w: 11.76, q: 3, a: "bounce" },
  { id: "j40", img: "images/jest/j40.png", w: 15.65, q: 2, a: "zoom" },
  { id: "j41", img: "images/jest/j41.png", w: 12.78, q: 3, a: "pulse" },
  { id: "j42", img: "images/jest/j42.png", w: 12.87, q: 2, a: "shake" },
  { id: "j43", img: "images/jest/j43.png", w: 11.85, q: 3, a: "float" },
  { id: "j44", img: "images/jest/j44.png", w: 17.96, q: 5, a: "bounce" },
  { id: "j45", img: "images/jest/j45.png", w: 11.76, q: 2, a: "zoom" },
  { id: "j46", img: "images/jest/j46.png", w: 16.39, q: 2, a: "pulse" },
  { id: "j47", img: "images/jest/j47.png", w: 14.44, q: 1, a: "shake" },
  { id: "j48", img: "images/jest/j48.png", w: 17.87, q: 1, a: "float" },
  { id: "j49", img: "images/jest/j49.png", w: 11.67, q: 1, a: "bounce" },
  { id: "j50", img: "images/jest/j50.png", w: 11.85, q: 1, a: "zoom" },
  { id: "j51", img: "images/jest/j51.png", w: 11.85, q: 1, a: "pulse" },
  { id: "j52", img: "images/jest/j52.png", w: 11.85, q: 1, a: "shake" },
  { id: "j53", img: "images/jest/j53.png", w: 11.85, q: 1, a: "float" },
  { id: "j54", img: "images/jest/j54.png", w: 11.67, q: 1, a: "bounce" },
  { id: "j55", img: "images/jest/j55.png", w: 14.91, q: 1, a: "zoom" },
  { id: "j56", img: "images/jest/j56.png", w: 14.63, q: 1, a: "pulse" },
  { id: "j57", img: "images/jest/j57.png", w: 12.13, q: 1, a: "shake" },
  { id: "j58", img: "images/jest/j58.png", w: 11.85, q: 1, a: "float" },
  { id: "j59", img: "images/jest/j59.png", w: 11.76, q: 1, a: "bounce" },
  { id: "j60", img: "images/jest/j60.png", w: 11.85, q: 1, a: "zoom" },
  { id: "j61", img: "images/jest/j61.png", w: 16.2, q: 1, a: "pulse" }
];

const CSS = `
.sp-root{display:none}
.sp-root.open{display:block}
.sp-top{position:fixed;left:0;right:0;z-index:9990;background:#fff;display:flex;align-items:center;padding:0 3.9vw;box-sizing:border-box;font-family:Roboto,Arial,sans-serif}
.sp-av{width:7.4vw;height:7.4vw;border-radius:50%;background:#3b8fe0;border:0;padding:0;display:flex;align-items:center;justify-content:center;flex:none}
.sp-av svg{width:4.4vw;height:4.4vw}
.sp-ttl{flex:1;margin-left:3.2vw;font:400 3.9vw/1.2 Roboto,Arial,sans-serif;color:#a8a8a8}
.sp-bal{display:flex;align-items:center;gap:1.4vw;height:8.8vw;padding:0 1.2vw 0 1.6vw;border:.3vw solid #9cc454;border-radius:5vw;background:#f4f9e8}
.sp-bal img.sm{width:4.8vw;height:4.8vw;display:block}
.sp-bal{cursor:pointer}
.sp-bal b{font:700 4.2vw/1 Roboto,Arial,sans-serif;color:#222}
.sp-plus{width:6.4vw;height:6.4vw;border-radius:50%;background:#7cc92f;border:0;padding:0;display:flex;align-items:center;justify-content:center}
.sp-plus svg{width:3.6vw;height:3.6vw}
.sp-list{position:fixed;left:0;right:0;bottom:0;z-index:9990;background:#fff;overflow-y:auto;padding:2vw 0 22vw;box-sizing:border-box;font-family:Roboto,Arial,sans-serif}
.sp-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr))}
.sp-cell{display:flex;flex-direction:column;align-items:center;padding:2.2vw 0 2.6vw}
.sp-cell:active .sp-e{transform:scale(.9)}
.sp-e{height:15vw;display:flex;align-items:center;justify-content:center;font-size:11.5vw;line-height:1;transition:transform .12s}
.sp-e img{height:auto;max-width:none;display:block;-webkit-user-drag:none}
.sp-pr{display:flex;align-items:center;gap:1.2vw;margin-top:1.4vw;font:700 4vw/1 Roboto,Arial,sans-serif;color:#333}
.sp-pr img.sm{width:3.9vw;height:3.9vw;display:block}
.sp-x{position:fixed;right:2vw;bottom:2.1vw;width:8.3vw;height:8.3vw;border-radius:50%;background:#7cc92f;border:0;padding:0;z-index:9991;display:flex;align-items:center;justify-content:center;box-shadow:0 .6vw 1.8vw rgba(0,0,0,.3)}
.sp-x svg{width:4.4vw;height:4.4vw}
.sp-shop{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9995;display:none;align-items:center;justify-content:center;font-family:Roboto,Arial,sans-serif}
.sp-shop.open{display:flex}
.sp-sh{position:relative;width:78.1vw;background:linear-gradient(180deg,#9a85d8 0,#b2a3e4 17vw,#ebe9f7 32vw);background-color:#ebe9f7;border-radius:5.5vw;box-sizing:border-box;padding-bottom:2.8vw}
.sp-deco{position:absolute;left:0;top:0;width:100%;height:30vw;overflow:hidden;border-radius:5.5vw 5.5vw 0 0;pointer-events:none}
.sp-deco svg{display:block;width:100%;height:auto}
.sp-sh h3{position:relative;margin:0;height:12.2vw;line-height:12.2vw;text-align:center;font:700 3.6vw/12.2vw Roboto,Arial,sans-serif;color:#fff}
.sp-sh p{display:none}
.sp-sx{position:absolute;top:-2.5vw;right:-2.6vw;width:8.3vw;height:8.3vw;border-radius:50%;background:#fff;border:0;padding:0;display:flex;align-items:center;justify-content:center;box-shadow:0 .5vw 1.6vw rgba(0,0,0,.28);z-index:3}
.sp-sx svg{width:4.2vw;height:4.2vw}
.sp-pk{position:relative;display:grid;grid-template-columns:repeat(3,1fr);column-gap:1.3vw;row-gap:1.4vw;padding:0 2.6vw}
.sp-p{background:#fff;border-radius:3.7vw;padding:2vw 2.1vw 0;text-align:center;box-shadow:0 .3vw 1vw rgba(0,0,0,.14);overflow:hidden}
.sp-p img{width:100%;display:block}
.sp-p button{width:100%;height:8.3vw;border:0;background:none;padding:0;display:flex;align-items:center;justify-content:center;gap:1.4vw;font:700 4.5vw/1 Roboto,Arial,sans-serif;color:#222}
.sp-p button svg{width:4.9vw;height:4.5vw}
.sp-fly{position:fixed;left:0;top:0;z-index:10010;pointer-events:none;will-change:transform,opacity}
.sp-fly img.sm{width:5vw;height:5vw;display:block}
.sp-plus-n{position:fixed;z-index:10011;pointer-events:none;font:700 5vw/1 Roboto,Arial,sans-serif;color:#ffd54a;text-shadow:0 .3vw .8vw rgba(0,0,0,.55);will-change:transform,opacity}
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

const SM = '<img class="sm" src="images/jeton/smayl.png" alt="" draggable="false">';
const UREK = '<svg viewBox="0 0 24 22"><path d="M12 21C5 16 1 12 1 7.2A5.2 5.2 0 0 1 12 4.5 5.2 5.2 0 0 1 23 7.2C23 12 19 16 12 21z" fill="#ff6a3d" stroke="#fff" stroke-width="1.2"/></svg>';
const FC = (x, y, t) => '<g transform="translate(' + x + ' ' + y + ')"><circle r="32"/><path d="M-13 -8v5M13 -8v5"/><path d="' + ["M-14 8q14 14 28 0", "M-12 13h24", "M-13 17q13 -13 26 0"][t] + '"/></g>';
const DECO = '<div class="sp-deco"><svg viewBox="0 0 844 300" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3.5" stroke-linecap="round">' +
  FC(129, 18, 2) + FC(388, 23, 0) + FC(678, 13, 2) + FC(229, 86, 0) + FC(513, 88, 1) + FC(784, 91, 2) + FC(72, 123, 0) +
  '<circle cx="44" cy="50" r="9"/><circle cx="290" cy="30" r="8"/><circle cx="504" cy="19" r="9"/><circle cx="706" cy="91" r="9"/><circle cx="140" cy="90" r="4" fill="#fff" fill-opacity=".35"/><circle cx="609" cy="64" r="5" fill="#fff" fill-opacity=".35"/></svg></div>';
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
    if (SES_OBJ) { try { SES_OBJ.currentTime = 0; } catch (e) {} SES_OBJ.volume = 1; SES_OBJ.play().catch(() => {}); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    const c = new C();
    [[880, 0, .09], [1320, .09, .16]].forEach(([f, t0, d]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(.0001, c.currentTime + t0);
      g.gain.exponentialRampToValueAtTime(.06, c.currentTime + t0 + .02);
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
  '<div class="sp-shop"><div class="sp-sh">' + DECO + '<button class="sp-sx" aria-label="Bağla"><svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" stroke="#7d5fd0" stroke-width="3.200" stroke-linecap="round"/></svg></button>' +
    '<h3>Jeton mağazası</h3><p>Bonus ürək qarşılığında</p><div class="sp-pk"></div></div></div>';
document.body.appendChild(root);

const $ = s => root.querySelector(s);
const grid = $(".sp-grid"), shop = $(".sp-shop");

JESTLER.forEach(g => {
  const c = document.createElement("div");
  c.className = "sp-cell";
  c.innerHTML = '<div class="sp-e">' + (g.img ? '<img src="' + g.img + '" alt="" draggable="false"' + (g.w ? ' style="width:' + g.w + 'vw"' : '') + '>' : g.e) + '</div><div class="sp-pr">' + SM + g.q + "</div>";
  c.onclick = () => jestIsle(g);
  grid.appendChild(c);
});

const pk = $(".sp-pk");
PAKETLER.forEach(p => {
  const d = document.createElement("div");
  d.className = "sp-p";
  d.innerHTML = '<img src="' + p.img + '" alt="' + p.smayl + '"><button>' + UREK + p.urek + "</button>";
  const b = d.querySelector("button");
  d.onclick = () => satinAl(p);
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

let balUnsub = null, balNow = 0, bekle = 0;
function ac() {
  if (!MEN) return;
  yerlesdir();
  root.classList.add("open");
  if (!balUnsub) balUnsub = onSnapshot(doc(fsdb, "users", MEN), s => {
    balNow = num((s.data() || {}).smileBal);
    if (!bekle) $("#spBal").textContent = fmt(balNow);
  }, () => {});
}
function bagla() {
  root.classList.remove("open");
  shop.classList.remove("open");
  if (balUnsub) { balUnsub(); balUnsub = null; }
}
$(".sp-x").onclick = bagla;
$(".sp-av").onclick = () => { if (window.ProfilKart) window.ProfilKart.ac(MEN); };
$(".sp-bal").onclick = () => shop.classList.add("open");
$(".sp-sx").onclick = () => shop.classList.remove("open");
shop.addEventListener("click", e => { if (e.target === shop) shop.classList.remove("open"); });

window.SmaylPanel = { ac, bagla };

/* ---------- Smaylik almaq (bonus ürək -> smaylik) ---------- */
let mesgul = false;

/* alan oyunçunun öz şəklinin üstünə alınan sayda smaylik düşür (yüngül: yalnız transform/opacity) */
function dusdur(sayi) {
  const el = fotoTap(MEN);
  const src = $(".sp-bal img.sm");
  if (!el || !src) return;
  const r = (el.querySelector(".foto") || el).getBoundingClientRect();
  const s0 = src.getBoundingClientRect();
  if (!r.width || !s0.width) return;
  const tx = r.left + r.width / 2, ty = r.top + r.height / 2;
  const sx = s0.left + s0.width / 2, sy = s0.top + s0.height / 2;
  const N = Math.min(sayi, 40);                /* çox olanda da donma olmasın deyə maksimum 40 görünür */
  const gap = N > 1 ? Math.min(60, 1100 / (N - 1)) : 0;
  const S = innerWidth * 0.025;
  let bitdi = 0;
  const frag = document.createDocumentFragment(), list = [];
  for (let i = 0; i < N; i++) {
    const d = document.createElement("div");
    d.className = "sp-fly";
    d.innerHTML = SM;
    frag.appendChild(d); list.push(d);
  }
  document.body.appendChild(frag);
  list.forEach((d, i) => {
    const ox = (Math.random() - .5) * innerWidth * 0.12, oy = Math.random() * innerWidth * 0.06;
    const a = d.animate([
      { transform: "translate(" + (sx - S) + "px," + (sy - S) + "px) scale(.5)", opacity: 0 },
      { transform: "translate(" + ((sx + tx) / 2 + ox - S) + "px," + ((sy + ty) / 2 - oy - S) + "px) scale(1.1)", opacity: 1, offset: .45 },
      { transform: "translate(" + (tx + ox * .25 - S) + "px," + (ty - S) + "px) scale(.7)", opacity: 1, offset: .9 },
      { transform: "translate(" + (tx + ox * .25 - S) + "px," + (ty - S) + "px) scale(.2)", opacity: 0 }
    ], { duration: 750, delay: i * gap, easing: "ease-in", fill: "both" });
    a.onfinish = () => {
      d.remove();
      if (++bitdi === N) {
        const t = document.createElement("div");
        t.className = "sp-plus-n";
        t.textContent = "+" + fmt(sayi);
        t.style.left = (tx - innerWidth * 0.06) + "px";
        t.style.top = (ty - innerWidth * 0.03) + "px";
        document.body.appendChild(t);
        const b = t.animate([
          { transform: "translateY(0) scale(.6)", opacity: 0 },
          { transform: "translateY(-2vw) scale(1.15)", opacity: 1, offset: .25 },
          { transform: "translateY(-9vw) scale(1)", opacity: 0 }
        ], { duration: 1100, easing: "ease-out", fill: "both" });
        b.onfinish = () => t.remove();
      }
    };
  });
}

const urekOxu = () => parseInt((document.getElementById("urekSayi") || {}).textContent) || 0;
function urekGoster(n) {
  if (window.urekYaz) window.urekYaz(n);
  else { const ue = document.getElementById("urekSayi"); if (ue) ue.textContent = n; }
}

async function satinAl(p) {
  if (!MEN) return;
  shop.classList.remove("open");               /* alışda mağaza dərhal bağlanır */
  const lokal = urekOxu() >= p.urek;           /* ekrandakı ürək kifayətdirsə: gecikmədən göstər, serverə arxada yaz */

  if (lokal) {
    bekle++; window.__urekHold = true;
    const sigorta = setTimeout(() => { window.__urekHold = false; }, 8000);
    ses();                                      /* toxunuş anında çalır (gecikmə yoxdur) */
    balNow += p.smayl;
    $("#spBal").textContent = fmt(balNow);
    urekGoster(urekOxu() - p.urek);
    dusdur(p.smayl);
    try {
      const yeni = await runTransaction(fsdb, async tx => {
        const r = doc(fsdb, "users", MEN), s = await tx.get(r), d = s.data() || {};
        if (num(d.hearts) < p.urek) throw new Error("YETMIR");
        const h = num(d.hearts) - p.urek, sb = num(d.smileBal) + p.smayl;
        tx.update(r, { hearts: h, smileBal: sb });
        return { h, sb };
      });
      balNow = yeni.sb;
      if (--bekle === 0) { clearTimeout(sigorta); window.__urekHold = false; $("#spBal").textContent = fmt(balNow); urekGoster(yeni.h); }
    } catch (e) {
      /* server qəbul etmədi: göstərilən dəyişikliyi geri qaytar */
      balNow -= p.smayl;
      if (--bekle === 0) { clearTimeout(sigorta); window.__urekHold = false; }
      $("#spBal").textContent = fmt(balNow);
      urekGoster(urekOxu() + p.urek);
      if (e.message === "YETMIR") { toast("Bonus ürəyiniz çatmır"); if (window.HeartShop) window.HeartShop.open(); }
      else { console.error(e); toast("Xəta baş verdi, yenidən cəhd edin"); shop.classList.add("open"); }
    }
    return;
  }

  /* ekranda ürək azdır: serverdən dəqiq yoxla */
  try {
    const yeni = await runTransaction(fsdb, async tx => {
      const r = doc(fsdb, "users", MEN), s = await tx.get(r), d = s.data() || {};
      if (num(d.hearts) < p.urek) throw new Error("YETMIR");
      const h = num(d.hearts) - p.urek, sb = num(d.smileBal) + p.smayl;
      tx.update(r, { hearts: h, smileBal: sb });
      return { h, sb };
    });
    balNow = yeni.sb;
    $("#spBal").textContent = fmt(yeni.sb);
    urekGoster(yeni.h);
    ses();
    dusdur(p.smayl);
  } catch (e) {
    if (e.message === "YETMIR") { toast("Bonus ürəyiniz çatmır"); if (window.HeartShop) window.HeartShop.open(); }
    else { console.error(e); toast("Xəta baş verdi, yenidən cəhd edin"); shop.classList.add("open"); }
  }
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
