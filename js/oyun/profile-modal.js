import { fsdb, rtdb } from "../core/firebase.js";
import { MASA_NOMRESI } from "../core/config.js";
import { cariOyuncu } from "./yardimci.js";
import { doc, onSnapshot, updateDoc, increment, collection, query, where, getCountFromServer } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

/* BU FAYL TƏK BAŞINADIR: görünüş (CSS) də içindədir. Ayrıca css faylı lazım deyil. */

/* ---------- CSS (ölçülər referans şəklə görə, 1080px = 100vw) ---------- */
const CSS = `
.pf-ov{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:10000;font-family:Roboto,Arial,sans-serif}
.pf-ov.open{display:flex}
.pf-card{position:relative;width:80vw;background:#fff;border-radius:4.4vw;box-shadow:0 1vw 4vw rgba(0,0,0,.35);animation:pfin .25s ease}
@keyframes pfin{from{transform:translateY(5vw);opacity:0}}
.pf-photo{position:relative;width:100%;height:80vw;border-radius:4.4vw 4.4vw 0 0;overflow:hidden;background:#0b1530}
.pf-photo img{width:100%;height:100%;object-fit:cover;object-position:center top;display:block}
.pf-cap{position:absolute;left:0;right:0;bottom:1.1vw;text-align:center;color:#fff;font:700 3.8vw/4.4vw Roboto,Arial,sans-serif;text-shadow:0 .2vw .8vw rgba(0,0,0,.85)}
.pf-cap small{display:block;font:500 3.4vw/4.4vw Roboto,Arial,sans-serif}
.pf-zoom{position:absolute;right:3vw;bottom:2.7vw;width:4.7vw;height:4.7vw;border:0;background:none;padding:0}
.pf-zoom svg{width:100%;height:100%;display:block}
.pf-close{position:absolute;top:-2.6vw;right:-2.6vw;width:8.3vw;height:8.3vw;border-radius:50%;background:#fff;border:0;padding:0;display:flex;align-items:center;justify-content:center;box-shadow:0 .6vw 1.8vw rgba(0,0,0,.3);z-index:3}
.pf-close svg{width:4.2vw;height:4.2vw}
.pf-vip{position:absolute;top:4.4vw;left:-3.9vw;z-index:2;height:7.7vw;box-sizing:border-box;background:linear-gradient(#97cf45,#7cbc2c);color:#fff;font:900 5.3vw/7.7vw Roboto,Arial,sans-serif;padding:0 3.6vw 0 4.8vw;clip-path:polygon(0 0,100% 0,93% 50%,100% 100%,0 100%)}
.pf-fold{position:absolute;top:12.1vw;left:-3.9vw;width:3.9vw;height:2.8vw;background:#4d8c1c;clip-path:polygon(0 0,100% 0,100% 100%);z-index:1}
.pf-stats{display:flex;justify-content:space-between;align-items:center;padding:1.35vw 4.5vw 0 2.9vw}
.pf-row{display:flex;align-items:center;height:6.9vw;white-space:nowrap}
.pf-ic{width:8vw;margin-right:1vw;display:flex;align-items:center;justify-content:center}
.pf-ic svg{display:block}
.pf-row b{font:700 3.7vw/1 Roboto,Arial,sans-serif;margin-right:3vw}
.pf-rk{font:400 2.6vw/1 Roboto,Arial,sans-serif;color:#9a9a9a}
.pf-k b{color:#d2381a}.pf-m b{color:#b0508f}.pf-c b{color:#f08a00}
.pf-trophy{width:15.7vw;height:16.8vw;flex:none}
.pf-dv{display:flex;align-items:center;height:3.9vw;margin:1.55vw 3.9vw 0}
.pf-dv i{flex:1;height:.3vw;background:#e3e3e3}
.pf-dv span{width:8.8vw;height:3.9vw;margin:0 2.1vw;border-radius:1vw;background:#ececec;display:flex;align-items:center;justify-content:center}
.pf-dv svg{width:4.6vw;height:2.4vw}
.pf-user{display:flex;gap:3vw;margin:2.8vw 3.9vw 0;height:16.7vw}
.pf-ava{width:16.7vw;height:16.7vw;border-radius:3.3vw;object-fit:cover;background:#ddd;flex:none}
.pf-info{display:flex;flex-direction:column;justify-content:space-between;align-items:flex-start;min-width:0}
.pf-name{font:400 3.5vw/3.9vw Roboto,Arial,sans-serif;color:#555;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pf-heart{display:flex;align-items:center;height:6.5vw}
.pf-heart svg{width:5.8vw;height:5.4vw;margin-right:2.1vw}
.pf-heart b{font:700 3.6vw/1 Roboto,Arial,sans-serif;color:#2b2b2b;margin-right:2.8vw}
.pf-heart .pf-rk{font-size:2.7vw}
.pf-follow{background:#7cc92f;color:#fff;border:0;border-radius:.5vw;width:20.8vw;height:6.2vw;font:400 3.4vw/1 Roboto,Arial,sans-serif;padding:0}
.pf-ln{height:.3vw;background:#e6e6e6;margin:2.6vw 3.9vw 0}
.pf-act{display:flex;justify-content:space-between;padding:2.7vw 3.9vw 4.9vw}
.pf-btn{width:12vw;height:12vw;border-radius:50%;border:0;color:#fff;padding:0;display:flex;align-items:center;justify-content:center}
.pf-btn svg{width:7vw;height:7vw;fill:none;stroke:#fff;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.pf-btn.t{font:700 3.5vw/1 Roboto,Arial,sans-serif}
.pf-full{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:10001;display:flex;align-items:center;justify-content:center}
.pf-full img{max-width:100%;max-height:100%}
`;
const st = document.createElement("style");
st.textContent = CSS;
document.head.appendChild(st);

/* ---------- İkonlar (referans şəkildəkilərə uyğun) ---------- */
const IC = {
  dudaq: '<svg viewBox="0 0 64 44" style="width:5.7vw"><path fill="#e53a1d" d="M2 24c8-10 16-14 22-12 3 1 5 3 8 3s5-2 8-3c6-2 14 2 22 12-6 12-16 19-30 19S8 36 2 24z"/><path fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2.2" stroke-linecap="round" d="M7 24c9 4 17 3 25 3s16 1 25-3"/><path fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.6" stroke-linecap="round" d="M14 16l4 3M26 14l3 3M44 15l-3 3M52 20l-4 2M20 35l4-2M44 35l-4-2"/></svg>',
  nota: '<svg viewBox="0 0 44 44" style="width:4.6vw"><g fill="#b0508f"><rect x="16" y="6" width="6" height="31"/><rect x="34" y="2" width="6" height="30"/><path d="M16 6L40 1v10L16 16z"/><ellipse cx="13" cy="37" rx="9" ry="7" transform="rotate(-20 13 37)"/><ellipse cx="31" cy="33" rx="9" ry="7" transform="rotate(-20 31 33)"/></g></svg>',
  smayl: '<svg viewBox="0 0 48 48" style="width:4.7vw"><defs><linearGradient id="pfs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc83a"/><stop offset="1" stop-color="#f08a00"/></linearGradient></defs><circle cx="24" cy="24" r="22" fill="url(#pfs)" stroke="#e17f00" stroke-width="2"/><path d="M12 21q4.5-6 9 0M27 21q4.5-6 9 0" fill="none" stroke="#7a3c00" stroke-width="3" stroke-linecap="round"/><path d="M12 28q12 14 24 0z" fill="#7a3c00"/><path d="M17 34q7 5 14 0" fill="none" stroke="#e8573b" stroke-width="3" stroke-linecap="round"/></svg>',
  kubok: '<svg class="pf-trophy" viewBox="0 0 64 68"><defs><linearGradient id="pfg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#aebfd0"/><stop offset=".45" stop-color="#eef3f8"/><stop offset="1" stop-color="#93a9bf"/></linearGradient></defs><path d="M13 9C0 9 0 30 20 34M51 9c13 0 13 21-7 25" fill="none" stroke="#9db2c6" stroke-width="5" stroke-linecap="round"/><path d="M12 5h40v17c0 14-8 22-20 22S12 36 12 22z" fill="url(#pfg)" stroke="#8aa0b5" stroke-width="2"/><rect x="28" y="44" width="8" height="11" fill="#9db2c6"/><path d="M17 55h30l3 9H14z" fill="url(#pfg)" stroke="#8aa0b5" stroke-width="2"/><path d="M32 13l3.2 6.5 7.1 1-5.2 5 1.3 7.1L32 29.2l-6.4 3.4 1.3-7.1-5.2-5 7.1-1z" fill="#f6b300" stroke="#d99700" stroke-width="1.2"/></svg>',
  urek: '<svg viewBox="0 0 24 22"><defs><linearGradient id="pfh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6a3d"/><stop offset="1" stop-color="#e5391a"/></linearGradient></defs><path d="M12 21C5 16 1 12 1 7.2A5.2 5.2 0 0 1 12 4.5 5.2 5.2 0 0 1 23 7.2C23 12 19 16 12 21z" fill="url(#pfh)"/></svg>',
  chev: '<svg viewBox="0 0 46 24"><path d="M6 6l17 12L40 6" fill="none" stroke="#9a9a9a" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  zoom: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3"/></svg>',
  qalxan: '<svg viewBox="0 0 24 24"><path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z"/><path d="M12 8l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4z"/></svg>',
  musiqi: '<svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
  tesdiq: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M7.5 12.5l3 3 6-6.5"/></svg>',
  mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>'
};

/* ---------- users sənədindəki sahələr ---------- */
const pick = (d, keys) => { for (const k of keys) if (d[k] !== undefined && d[k] !== null && d[k] !== "") return d[k]; return null; };
const vipMi = d => d.role === "admin" || (d.vip && (!d.vipUntil || Number(d.vipUntil) > Date.now()));
const fmt = n => (Number(n) || 0).toLocaleString("ru-RU");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NOPHOTO = "images/avatar/nophoto.svg";

/* ================= XALLAR ================= */
const men = cariOyuncu();
const xalVer = (uid, sahe, n = 1) => {
  if (!uid || !n) return;
  updateDoc(doc(fsdb, "users", uid), { [sahe]: increment(n) }).catch(e => console.error("Xal xətası:", e));
};

/* Başqa fayllardan çağırmaq üçün:
   Xallar.opus(uid, n)          -> öpüş hədiyyəsi atılanda alana +n
   Xallar.musiqiQosdu(uid)      -> musiqi qoşana +9
   Xallar.musiqiHediyye(uid, n) -> qoşulan musiqiyə hədiyyə atılanda musiqini qoşana +n */
window.Xallar = {
  opus: (uid, n = 1) => xalVer(uid, "kisses", n),
  musiqiQosdu: uid => xalVer(uid, "music", 9),
  musiqiHediyye: (uid, n = 1) => xalVer(uid, "music", n)
};

/* 1) Yaşıl (öpüş) veriləndə: masadakı öpüş sayğacı artanda həmin oyunçu öz "kisses" xalını eyni qədər artırır */
if (men && men.docId) {
  let evvel = null;
  onValue(ref(rtdb, "masalar/" + MASA_NOMRESI + "/opus/" + men.docId), s => {
    const v = Number(s.val()) || 0;
    if (evvel !== null && v > evvel) xalVer(men.docId, "kisses", v - evvel);
    evvel = v;
  });
}

/* 2) Musiqi qoşanda +9: MusiqiFirebase.klipQos uğurla bitəndə musiqi xalı artır */
function klipQosBagla() {
  const mf = window.MusiqiFirebase;
  if (!mf || typeof mf.klipQos !== "function") return false;
  if (mf.__xal) return true;
  const asil = mf.klipQos.bind(mf);
  mf.klipQos = async (...a) => {
    const r = await asil(...a);
    if (r !== false && men && men.docId) window.Xallar.musiqiQosdu(men.docId);
    return r;
  };
  mf.__xal = true;
  return true;
}
const bagTimer = setInterval(() => { if (klipQosBagla()) clearInterval(bagTimer); }, 500);
setTimeout(() => clearInterval(bagTimer), 60000);

/* ================= SIRA (real vaxt) ================= */
const ov = document.createElement("div");
ov.className = "pf-ov";
document.body.appendChild(ov);

let tok = 0, sonD = null, unsub = null, mesgul = false;
async function siraYenile(d) {
  if (mesgul) return;
  mesgul = true;
  const t = ++tok;
  await Promise.all(["kisses", "music", "smiles", "hearts"].map(async k => {
    const v = Number(d[k]) || 0;
    let n = null;
    if (v > 0) {
      try { n = (await getCountFromServer(query(collection(fsdb, "users"), where(k, ">", v)))).data().count + 1; }
      catch (e) { console.error("Sıra xətası:", e); }
    }
    if (t !== tok) return;
    const el = ov.querySelector('[data-r="' + k + '"]');
    if (el) el.textContent = n ? fmt(n) + " sıra" : "";
  }));
  mesgul = false;
}
/* Kart açıq olan müddətdə sıra hər 1 saniyədən bir yoxlanır (xal dəyişəndə isə dərhal) */
setInterval(() => { if (ov.classList.contains("open") && sonD) siraYenile(sonD); }, 1000);

/* ================= KART ================= */
function bagla() {
  tok++; sonD = null; mesgul = false;
  ov.classList.remove("open");
  if (unsub) { unsub(); unsub = null; }
  ov.innerHTML = "";
}
ov.addEventListener("click", e => { if (e.target === ov) bagla(); });

function ciz(d) {
  const ad = pick(d, ["username"]) || "Oyunçu";
  const yas = pick(d, ["age"]);
  const yer = [pick(d, ["country"]), pick(d, ["city"])].filter(Boolean).join(", ");
  const sekil = pick(d, ["avatar"]) || NOPHOTO;
  const onerr = "this.onerror=null;this.src='" + NOPHOTO + "'";
  const R = k => '<span class="pf-rk" data-r="' + k + '"></span>';

  ov.innerHTML =
    '<div class="pf-card">' +
      '<button class="pf-close" aria-label="Bağla"><svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" stroke="#7cc92f" stroke-width="3.2" stroke-linecap="round"/></svg></button>' +
      (vipMi(d) ? '<div class="pf-fold"></div><div class="pf-vip">VIP</div>' : "") +
      '<div class="pf-photo"><img src="' + esc(sekil) + '" alt="" onerror="' + onerr + '">' +
        '<div class="pf-cap">' + esc(ad) + (yas ? ", " + esc(yas) : "") + (yer ? "<small>" + esc(yer) + "</small>" : "") + "</div>" +
        '<button class="pf-zoom" aria-label="Böyüt">' + IC.zoom + "</button></div>" +
      '<div class="pf-stats"><div>' +
        '<div class="pf-row pf-k"><span class="pf-ic">' + IC.dudaq + "</span><b>" + fmt(d.kisses) + "</b>" + R("kisses") + "</div>" +
        '<div class="pf-row pf-m"><span class="pf-ic">' + IC.nota + "</span><b>" + fmt(d.music) + "</b>" + R("music") + "</div>" +
        '<div class="pf-row pf-c"><span class="pf-ic">' + IC.smayl + "</span><b>" + fmt(d.smiles) + "</b>" + R("smiles") + "</div>" +
      "</div>" + IC.kubok + "</div>" +
      '<div class="pf-dv"><i></i><span>' + IC.chev + "</span><i></i></div>" +
      '<div class="pf-user"><img class="pf-ava" src="' + esc(sekil) + '" alt="" onerror="' + onerr + '">' +
        '<div class="pf-info"><div class="pf-name">' + esc(ad) + "</div>" +
        '<div class="pf-heart">' + IC.urek + "<b>" + fmt(d.hearts) + "</b>" + R("hearts") + "</div>" +
        '<button class="pf-follow">Tərk et</button></div></div>' +
      '<div class="pf-ln"></div>' +
      '<div class="pf-act">' +
        '<button class="pf-btn" style="background:#ec5440">' + IC.qalxan + "</button>" +
        '<button class="pf-btn t" style="background:#ef8c0b">Buto</button>' +
        '<button class="pf-btn" style="background:#ab5a98">' + IC.musiqi + "</button>" +
        '<button class="pf-btn" style="background:#f9a23a">' + IC.tesdiq + "</button>" +
        '<button class="pf-btn" style="background:#4fa9de">' + IC.mail + "</button>" +
      "</div>" +
    "</div>";

  ov.querySelector(".pf-close").onclick = bagla;
  ov.querySelector(".pf-zoom").onclick = () => {
    const f = document.createElement("div");
    f.className = "pf-full";
    f.innerHTML = '<img src="' + esc(sekil) + '" alt="">';
    f.onclick = () => f.remove();
    document.body.appendChild(f);
  };
}

/* ProfilKart.ac("istifadəçi_docId") */
window.ProfilKart = {
  ac(docId) {
    if (!docId) return;
    if (unsub) unsub();
    ov.classList.add("open");
    unsub = onSnapshot(doc(fsdb, "users", docId), snap => {
      if (!snap.exists()) { bagla(); return; }
      sonD = snap.data();
      ciz(sonD);
      siraYenile(sonD);
    }, err => { console.error("ProfilKart:", err); bagla(); });
  },
  bagla
};

/* Oturacağa toxunanda aç (üstünü qat örtsə belə, koordinatla tapır) */
let oturacaqlar = {};
onValue(ref(rtdb, "masalar/" + MASA_NOMRESI + "/oturacaqlar"), s => { oturacaqlar = s.val() || {}; });

window.addEventListener("click", e => {
  if (ov.classList.contains("open")) return;
  for (const el of document.querySelectorAll("#masa .yer.dolu")) {
    const m = /yer-(\d+)/.exec(el.className);
    if (!m) continue;
    const o = oturacaqlar[m[1]];
    const r = (el.querySelector(".foto") || el).getBoundingClientRect();
    if (o && o.uid && r.width && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
      window.ProfilKart.ac(o.uid);
      return;
    }
  }
}, true);
