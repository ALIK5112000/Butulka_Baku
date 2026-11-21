import { fsdb, rtdb } from "../core/firebase.js";
import { MASA_NOMRESI } from "../core/config.js";
import { cariOyuncu } from "./yardimci.js";
import { doc, onSnapshot, updateDoc, increment, runTransaction, collection, query, where, getCountFromServer } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

/* ADDIM 1: Profil kartı (reytinqlər + Məftun sistemi). Bu fayl təkbaşınadır, CSS də içindədir. */

/* users/{uid} sənədindəki sahələr:
   kisses       = öpüş xalı
   music        = musiqi xalı
   smiles       = smaylik xalı
   meftunQiymet = "tək ürək": Məftun yerinin cari qiyməti (yeni oyunçuda 1)
   meftunUid    = hazırkı məftunun uid-i (boşdursa "Məftun yoxdur")
   meftunOdenis = məftun nə qədər ödəyib
   cutUrek      = "cüt ürək": bu oyunçunun başqalarına məftun olmaq üçün hazırda ödədiyi cəmi bonus
   hearts       = bonus ürək BALANSI (mağazadakı), kartda göstərilmir */

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
.pf-k b{color:#d2381a}.pf-m b{color:#b0508f}.pf-c b{color:#f08a00}.pf-h b{color:#c0391b}
.pf-trophy{width:15.7vw;height:16.8vw;flex:none}
.pf-dv{display:flex;align-items:center;height:3.9vw;margin:1.55vw 3.9vw 0}
.pf-dv i{flex:1;height:.3vw;background:#e3e3e3}
.pf-dv span{width:8.8vw;height:3.9vw;margin:0 2.1vw;border-radius:1vw;background:#ececec;display:flex;align-items:center;justify-content:center;cursor:pointer}
.pf-dv svg{width:4.6vw;height:2.4vw}
.pf-dv.up svg{transform:rotate(180deg)}
.pf-user{display:flex;gap:3vw;margin:2.8vw 3.9vw 0;height:16.7vw}
.pf-ava{width:16.7vw;height:16.7vw;border-radius:3.3vw;object-fit:cover;background:#dfe9f1;flex:none}
.pf-info{display:flex;flex-direction:column;justify-content:space-between;align-items:flex-start;min-width:0}
.pf-name{font:400 3.6vw/3.9vw Roboto,Arial,sans-serif;color:#555;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pf-name u{text-decoration:none;color:#3aa0e0;font-weight:700}
.pf-heart{display:flex;align-items:center;height:6.5vw}
.pf-heart svg{width:5.8vw;height:5.4vw;margin-right:2.1vw}
.pf-heart b{font:700 3.6vw/1 Roboto,Arial,sans-serif;color:#2b2b2b;margin-right:2.8vw}
.pf-heart .pf-rk{font-size:2.7vw}
.pf-follow{background:#7cc92f;color:#fff;border:0;border-radius:.5vw;min-width:20.8vw;padding:0 2vw;height:6.2vw;font:400 3.4vw/1 Roboto,Arial,sans-serif}
.pf-follow.g{background:#c9c9c9}
.pf-follow:disabled{opacity:.7}
.pf-ln{height:.3vw;background:#e6e6e6;margin:2.6vw 3.9vw 0}
.pf-act{display:flex;justify-content:space-between;padding:2.7vw 3.9vw 4.9vw}
.pf-btn{width:12vw;height:12vw;border-radius:50%;border:0;color:#fff;padding:0;display:flex;align-items:center;justify-content:center}
.pf-btn svg{width:7vw;height:7vw;fill:none;stroke:#fff;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.pf-btn.t{font:700 3.5vw/1 Roboto,Arial,sans-serif}
.pf-full{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:10001;display:flex;align-items:center;justify-content:center}
.pf-full img{max-width:100%;max-height:100%}
.pf-toast{position:fixed;left:50%;bottom:24vw;transform:translateX(-50%);max-width:80vw;text-align:center;z-index:20000;background:rgba(35,35,35,.92);color:#fff;font:500 3.5vw/1.3 Roboto,Arial,sans-serif;padding:2.6vw 4.6vw;border-radius:3vw}
`;
const st = document.createElement("style");
st.textContent = CSS;
document.head.appendChild(st);

const IC = {
  dudaq: '<svg viewBox="0 0 64 44" style="width:5.7vw"><path fill="#e53a1d" d="M2 24c8-10 16-14 22-12 3 1 5 3 8 3s5-2 8-3c6-2 14 2 22 12-6 12-16 19-30 19S8 36 2 24z"/><path fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2.2" stroke-linecap="round" d="M7 24c9 4 17 3 25 3s16 1 25-3"/><path fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.6" stroke-linecap="round" d="M14 16l4 3M26 14l3 3M44 15l-3 3M52 20l-4 2M20 35l4-2M44 35l-4-2"/></svg>',
  nota: '<svg viewBox="0 0 44 44" style="width:4.6vw"><g fill="#b0508f"><rect x="16" y="6" width="6" height="31"/><rect x="34" y="2" width="6" height="30"/><path d="M16 6L40 1v10L16 16z"/><ellipse cx="13" cy="37" rx="9" ry="7" transform="rotate(-20 13 37)"/><ellipse cx="31" cy="33" rx="9" ry="7" transform="rotate(-20 31 33)"/></g></svg>',
  smayl: '<svg viewBox="0 0 48 48" style="width:4.7vw"><defs><linearGradient id="pfs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc83a"/><stop offset="1" stop-color="#f08a00"/></linearGradient></defs><circle cx="24" cy="24" r="22" fill="url(#pfs)" stroke="#e17f00" stroke-width="2"/><path d="M12 21q4.5-6 9 0M27 21q4.5-6 9 0" fill="none" stroke="#7a3c00" stroke-width="3" stroke-linecap="round"/><path d="M12 28q12 14 24 0z" fill="#7a3c00"/><path d="M17 34q7 5 14 0" fill="none" stroke="#e8573b" stroke-width="3" stroke-linecap="round"/></svg>',
  urek1: '<svg viewBox="0 0 24 22" style="width:5.8vw"><defs><linearGradient id="pfh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6a3d"/><stop offset="1" stop-color="#e5391a"/></linearGradient></defs><path d="M12 21C5 16 1 12 1 7.2A5.2 5.2 0 0 1 12 4.5 5.2 5.2 0 0 1 23 7.2C23 12 19 16 12 21z" fill="url(#pfh)"/></svg>',
  urek2: '<svg viewBox="0 0 30 22" style="width:6vw"><path d="M10 20C4 16 1 12.5 1 8.5A4.4 4.4 0 0 1 10 6.2 4.4 4.4 0 0 1 19 8.5C19 12.5 16 16 10 20z" fill="#e5391a"/><path d="M20 21c-6-4-9-7.500-9-11.500a4.400 4.400 0 0 1 9-2.300 4.400 4.400 0 0 1 9 2.300c0 4-3 7.500-9 11.500z" fill="#ff7a2e" stroke="#fff" stroke-width="1"/></svg>',
  kubok: '<svg class="pf-trophy" viewBox="0 0 64 68"><defs><linearGradient id="pfg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#aebfd0"/><stop offset=".45" stop-color="#eef3f8"/><stop offset="1" stop-color="#93a9bf"/></linearGradient></defs><path d="M13 9C0 9 0 30 20 34M51 9c13 0 13 21-7 25" fill="none" stroke="#9db2c6" stroke-width="5" stroke-linecap="round"/><path d="M12 5h40v17c0 14-8 22-20 22S12 36 12 22z" fill="url(#pfg)" stroke="#8aa0b5" stroke-width="2"/><rect x="28" y="44" width="8" height="11" fill="#9db2c6"/><path d="M17 55h30l3 9H14z" fill="url(#pfg)" stroke="#8aa0b5" stroke-width="2"/><path d="M32 13l3.200 6.500 7.100 1-5.200 5 1.300 7.100L32 29.200l-6.400 3.400 1.300-7.100-5.200-5 7.100-1z" fill="#f6b300" stroke="#d99700" stroke-width="1.200"/></svg>',
  chev: '<svg viewBox="0 0 46 24"><path d="M6 6l17 12L40 6" fill="none" stroke="#9a9a9a" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  zoom: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3"/></svg>',
  qalxan: '<svg viewBox="0 0 24 24"><path d="M12 2.5l8 3v6c0 5-3.400 8.600-8 10-4.600-1.400-8-5-8-10v-6z"/><path d="M12 8l1.300 2.700 3 .4-2.200 2.100.5 3-2.600-1.400-2.600 1.400.5-3-2.200-2.100 3-.4z"/></svg>',
  musiqi: '<svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
  tesdiq: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M7.500 12.500l3 3 6-6.500"/></svg>',
  mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  bosAva: '<svg viewBox="0 0 100 100" style="width:100%;height:100%;display:block"><rect width="100" height="100" fill="#dfe9f1"/><g fill="none" stroke="#b9c7d3" stroke-width="3" stroke-dasharray="5 4"><ellipse cx="50" cy="38" rx="14" ry="17"/><path d="M18 96c0-20 14-30 32-30s32 10 32 30"/></g></svg>'
};

const pick = (d, keys) => { for (const k of keys) if (d[k] !== undefined && d[k] !== null && d[k] !== "") return d[k]; return null; };
const vipMi = d => d.role === "admin" || (d.vip && (!d.vipUntil || Number(d.vipUntil) > Date.now()));
const fmt = n => (Number(n) || 0).toLocaleString("ru-RU");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NOPHOTO = "images/avatar/nophoto.svg";
const num = v => Number(v) || 0;

let tT = null;
function toast(msg) {
  let t = document.getElementById("pfToast");
  if (!t) { t = document.createElement("div"); t.id = "pfToast"; t.className = "pf-toast"; document.body.appendChild(t); }
  t.textContent = msg; t.style.display = "block";
  clearTimeout(tT); tT = setTimeout(() => { t.style.display = "none"; }, 2600);
}

/* ================= XALLAR ================= */
const men = cariOyuncu();
const MEN = men && men.docId ? men.docId : null;
const xalVer = (uid, sahe, n = 1) => {
  if (!uid || !n) return;
  updateDoc(doc(fsdb, "users", uid), { [sahe]: increment(n) }).catch(e => console.error("Xal xətası:", e));
};
window.Xallar = {
  opus: (uid, n = 1) => xalVer(uid, "kisses", n),
  musiqiQosdu: uid => xalVer(uid, "music", 9),
  musiqiHediyye: (uid, n = 1) => xalVer(uid, "music", n),
  smayl: (uid, n = 1) => xalVer(uid, "smiles", n)
};

/* Yaşıl veriləndə: masadakı öpüş sayğacı artanda oyunçu öz "kisses" xalını eyni qədər artırır */
if (MEN) {
  let evvel = null;
  onValue(ref(rtdb, "masalar/" + MASA_NOMRESI + "/opus/" + MEN), s => {
    const v = num(s.val());
    if (evvel !== null && v > evvel) xalVer(MEN, "kisses", v - evvel);
    evvel = v;
  });
}

/* Musiqi qoşanda +9 */
function klipQosBagla() {
  const mf = window.MusiqiFirebase;
  if (!mf || typeof mf.klipQos !== "function") return false;
  if (mf.__xal) return true;
  const asil = mf.klipQos.bind(mf);
  mf.klipQos = async (...a) => {
    const r = await asil(...a);
    if (r !== false && MEN) { window.Xallar.musiqiQosdu(MEN); toast("+9 musiqi xalı"); }
    return r;
  };
  mf.__xal = true;
  return true;
}
const bagTimer = setInterval(() => { if (klipQosBagla()) clearInterval(bagTimer); }, 500);
setTimeout(() => clearInterval(bagTimer), 300000);

/* ================= MƏFTUN ƏMƏLİYYATLARI (tranzaksiya) ================= */
function meftunTx(isle) {
  return runTransaction(fsdb, async tx => {
    const W = {}, P = {};
    const al = async uid => {
      if (!W[uid]) { const s = await tx.get(doc(fsdb, "users", uid)); W[uid] = s.data() || {}; P[uid] = {}; }
      return W[uid];
    };
    const yaz = (uid, k, v) => { W[uid][k] = v; P[uid][k] = v; };
    await isle(al, yaz);
    for (const uid in P) if (Object.keys(P[uid]).length) tx.update(doc(fsdb, "users", uid), P[uid]);
  });
}

/* Başqası (və ya özü) hədəfə məftun olur: cari qiyməti bonus ürəkdən ödəyir, qiymət +1 artır */
function meftunOl(hedef) {
  return meftunTx(async (al, yaz) => {
    const h = await al(hedef), m = await al(MEN);
    const q = Math.max(1, num(h.meftunQiymet));
    if (h.meftunUid === MEN) throw new Error("ARTIQ");
    if (num(m.hearts) < q) throw new Error("YETMIR");
    const prev = h.meftunUid || null, odenen = num(h.meftunOdenis);
    if (prev) { const p = await al(prev); yaz(prev, "cutUrek", Math.max(0, num(p.cutUrek) - odenen)); }
    yaz(MEN, "hearts", num(m.hearts) - q);
    yaz(MEN, "cutUrek", num(m.cutUrek) + q);
    yaz(hedef, "meftunUid", MEN);
    yaz(hedef, "meftunOdenis", q);
    yaz(hedef, "meftunQiymet", q + 1);
  });
}

/* Hədəf öz məftununu silir: cari qiymət qədər bonus ödəyir, yer boşalır, məftunun cüt ürək xalı azalır */
function terkEt() {
  return meftunTx(async (al, yaz) => {
    const o = await al(MEN);
    if (!o.meftunUid) throw new Error("BOS");
    const q = Math.max(1, num(o.meftunQiymet));
    if (num(o.hearts) < q) throw new Error("YETMIR");
    const prev = o.meftunUid, odenen = num(o.meftunOdenis);
    const p = await al(prev);
    yaz(prev, "cutUrek", Math.max(0, num(p.cutUrek) - odenen));
    yaz(MEN, "hearts", num(o.hearts) - q);
    yaz(MEN, "meftunUid", null);
    yaz(MEN, "meftunOdenis", 0);
  });
}

/* ================= SIRA (real vaxt) ================= */
const ov = document.createElement("div");
ov.className = "pf-ov";
document.body.appendChild(ov);

const SIRA_SAHELERI = ["kisses", "music", "smiles", "meftunQiymet", "cutUrek"];
let tok = 0, sonD = null, unsub = null, mesgul = false, acik = false, ownerUid = null;
const kesh = {};

async function siraYenile(d) {
  if (mesgul) return;
  mesgul = true;
  const t = ++tok;
  await Promise.all(SIRA_SAHELERI.map(async k => {
    const v = k === "meftunQiymet" ? Math.max(1, num(d[k])) : num(d[k]);
    let n = null;
    if (v > 0) {
      try { n = (await getCountFromServer(query(collection(fsdb, "users"), where(k, ">", v)))).data().count + 1; }
      catch (e) { console.error("Sıra xətası:", e); }
    }
    if (t !== tok) return;
    kesh[k] = n ? fmt(n) + " sıra" : "";
    ov.querySelectorAll('[data-r="' + k + '"]').forEach(el => { el.textContent = kesh[k]; });
  }));
  mesgul = false;
}
setInterval(() => { if (ov.classList.contains("open") && sonD) siraYenile(sonD); }, 1000);

/* ================= MƏFTUNUN CANLI MƏLUMATI ================= */
let mUid = null, mUnsub = null, mD = null;
function izleMeftun(uid) {
  if (uid === mUid) return;
  if (mUnsub) { mUnsub(); mUnsub = null; }
  mUid = uid; mD = null;
  if (!uid) return;
  mUnsub = onSnapshot(doc(fsdb, "users", uid), s => {
    const x = s.data() || {};
    mD = { uid, ad: x.username || "Oyunçu", avatar: x.avatar || "" };
    if (sonD) ciz(sonD);
  }, () => {});
}

/* ================= KART ================= */
let gurulu = false, sig = {};
function bagla() {
  tok++; sonD = null; mesgul = false; ownerUid = null; gurulu = false; sig = {};
  if (mUnsub) { mUnsub(); mUnsub = null; } mUid = null; mD = null;
  ov.classList.remove("open");
  if (unsub) { unsub(); unsub = null; }
  ov.innerHTML = "";
}
ov.addEventListener("click", e => { if (e.target === ov) bagla(); });

const onerr = "this.onerror=null;this.src='" + NOPHOTO + "'";
const R = k => '<span class="pf-rk" data-r="' + k + '">' + esc(kesh[k] || "") + "</span>";
const row = (cls, ic, val, k) => '<div class="pf-row ' + cls + '"><span class="pf-ic">' + ic + "</span><b>" + fmt(val) + "</b>" + R(k) + "</div>";

/* Kartın karkası bir dəfə qurulur; sonra yalnız dəyişən hissələr yenilənir */
function qur() {
  ov.innerHTML =
    '<div class="pf-card">' +
      '<button class="pf-close" aria-label="Bağla"><svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" stroke="#7cc92f" stroke-width="3.2" stroke-linecap="round"/></svg></button>' +
      '<div class="pf-topw"></div>' +
      '<div class="pf-stats"><div class="pf-rowsw"></div>' + IC.kubok + "</div>" +
      '<div class="pf-dv"><i></i><span>' + IC.chev + "</span><i></i></div>" +
      '<div class="pf-userw"></div>' +
      '<div class="pf-ln"></div>' +
      '<div class="pf-act">' +
        '<button class="pf-btn" style="background:#ec5440">' + IC.qalxan + "</button>" +
        '<button class="pf-btn t" style="background:#ef8c0b">Buto</button>' +
        '<button class="pf-btn" style="background:#ab5a98">' + IC.musiqi + "</button>" +
        '<button class="pf-btn" style="background:#f9a23a">' + IC.tesdiq + "</button>" +
        '<button class="pf-btn" style="background:#4fa9de">' + IC.mail + "</button>" +
      "</div>" +
    "</div>";
  gurulu = true; sig = {};
  ov.querySelector(".pf-close").onclick = bagla;
  ov.querySelector(".pf-dv span").onclick = () => { acik = !acik; if (sonD) ciz(sonD); };
}

function ciz(d) {
  if (!gurulu || !ov.querySelector(".pf-card")) qur();
  const ad = pick(d, ["username"]) || "Oyunçu";
  const yas = pick(d, ["age"]);
  const yer = [pick(d, ["country"]), pick(d, ["city"])].filter(Boolean).join(", ");
  const sekil = pick(d, ["avatar"]) || NOPHOTO;
  const qiymet = Math.max(1, num(d.meftunQiymet));
  const mVar = !!d.meftunUid;
  const menimdir = ownerUid === MEN;

  /* 1) şəkil, ad, VIP (yalnız dəyişəndə) */
  const sTop = [sekil, ad, yas, yer, vipMi(d)].join("|");
  if (sig.top !== sTop) {
    sig.top = sTop;
    ov.querySelector(".pf-topw").innerHTML =
      (vipMi(d) ? '<div class="pf-fold"></div><div class="pf-vip">VIP</div>' : "") +
      '<div class="pf-photo"><img src="' + esc(sekil) + '" alt="" onerror="' + onerr + '">' +
      '<div class="pf-cap">' + esc(ad) + (yas ? ", " + esc(yas) : "") + (yer ? "<small>" + esc(yer) + "</small>" : "") + "</div>" +
      '<button class="pf-zoom" aria-label="Böyüt">' + IC.zoom + "</button></div>";
    ov.querySelector(".pf-zoom").onclick = () => {
      const f = document.createElement("div");
      f.className = "pf-full";
      f.innerHTML = '<img src="' + esc(sekil) + '" alt="">';
      f.onclick = () => f.remove();
      document.body.appendChild(f);
    };
  }

  /* 2) xal sətirləri */
  ov.querySelector(".pf-dv").classList.toggle("up", acik);
  const sRows = [d.kisses, d.music, d.smiles, qiymet, d.cutUrek, acik].map(num).join("|");
  if (sig.rows !== sRows) {
    sig.rows = sRows;
    let rows = row("pf-k", IC.dudaq, d.kisses, "kisses") + row("pf-m", IC.nota, d.music, "music");
    if (acik) rows += row("pf-h", IC.urek1, qiymet, "meftunQiymet") + row("pf-h", IC.urek2, d.cutUrek, "cutUrek");
    rows += row("pf-c", IC.smayl, d.smiles, "smiles");
    ov.querySelector(".pf-rowsw").innerHTML = rows;
  }

  /* 3) yalnız Məftun yeri (şəkil/ad/düymə dəyişəndə) */
  const mOK = mVar && mD && mD.uid === d.meftunUid;
  const sUser = [d.meftunUid || "", mOK ? mD.ad + "|" + mD.avatar : "", menimdir, d.meftunUid === MEN].join("#");
  if (sig.user !== sUser) {
    sig.user = sUser;
    let mAva, mAd;
    if (!mVar) { mAva = IC.bosAva; mAd = "Məftun yoxdur"; }
    else if (mOK) {
      mAva = '<img style="width:100%;height:100%;object-fit:cover;display:block" src="' + esc(mD.avatar || NOPHOTO) + '" alt="" onerror="' + onerr + '">';
      mAd = "Məftun <u>" + esc(mD.ad) + "</u>";
    } else { mAva = IC.bosAva; mAd = "Məftun ..."; }

    let dugme;
    if (menimdir) dugme = mVar ? '<button class="pf-follow" data-a="terk">Tərk et</button>' : '<button class="pf-follow g" disabled>Məftun ol</button>';
    else if (d.meftunUid === MEN) dugme = '<button class="pf-follow g" disabled>Məftunsan</button>';
    else dugme = '<button class="pf-follow" data-a="ol">Məftun ol</button>';

    ov.querySelector(".pf-userw").innerHTML =
      '<div class="pf-user"><div class="pf-ava" style="overflow:hidden">' + mAva + "</div>" +
      '<div class="pf-info"><div class="pf-name">' + mAd + "</div>" +
      '<div class="pf-heart">' + IC.urek1 + '<b class="pf-hv"></b>' + R("meftunQiymet") + "</div>" +
      dugme + "</div></div>";

    if (mOK) {
      const goster = () => window.ProfilKart.ac(d.meftunUid);
      const av = ov.querySelector(".pf-userw .pf-ava"), nm = ov.querySelector(".pf-userw .pf-name");
      av.style.cursor = nm.style.cursor = "pointer";
      av.onclick = nm.onclick = goster;
    }
    const b = ov.querySelector(".pf-follow[data-a]");
    if (b) b.onclick = async () => {
      b.disabled = true;
      try {
        if (b.dataset.a === "ol") await meftunOl(ownerUid); else await terkEt();
      } catch (e) {
        if (e.message === "YETMIR") toast("Kifayət qədər bonus ürəyiniz yoxdur");
        else if (e.message === "ARTIQ") toast("Artıq məftunsunuz");
        else if (e.message === "BOS") toast("Məftun yoxdur");
        else { console.error(e); toast("Xəta baş verdi, yenidən cəhd edin"); }
      }
      if (b.isConnected) b.disabled = false;
    };
  }
  const hv = ov.querySelector(".pf-hv");
  if (hv) hv.textContent = fmt(qiymet);
}

/* ProfilKart.ac("istifadəçi_docId") */
window.ProfilKart = {
  ac(docId) {
    if (!docId) return;
    if (unsub) unsub();
    if (ownerUid !== docId) {
      /* başqa oyunçunun kartına keçid: köhnə məlumat qalmasın */
      tok++; mesgul = false; gurulu = false; sig = {}; sonD = null; ov.innerHTML = "";
      for (const k in kesh) delete kesh[k];
      if (mUnsub) { mUnsub(); mUnsub = null; } mUid = null; mD = null;
    }
    ownerUid = docId;
    ov.classList.add("open");
    unsub = onSnapshot(doc(fsdb, "users", docId), snap => {
      if (!snap.exists()) { bagla(); return; }
      sonD = snap.data();
      izleMeftun(sonD.meftunUid || null);
      ciz(sonD);
      siraYenile(sonD);
    }, err => { console.error("ProfilKart:", err); bagla(); });
  },
  bagla
};

/* Oturacağa və ya fırlanma zamanı ortaya gələn kartlara toxunanda aç
   (üstünü qat örtsə belə, koordinatla tapır) */
let oturacaqlar = {}, spin = null;
onValue(ref(rtdb, "masalar/" + MASA_NOMRESI + "/oturacaqlar"), s => { oturacaqlar = s.val() || {}; });
onValue(ref(rtdb, "masalar/" + MASA_NOMRESI + "/raund/spin"), s => { spin = s.val() || null; });

/* Öz şəklinə ilk toxunuş: smaylik paneli, panel açıqkən yenə toxunsan: profil kartı.
   Başqasının şəklinə ilk toxunuş: hədiyyə paneli, yenə toxunsan: profil kartı. */
function ackart(uid) {
  const S = window.SmaylPanel, H = window.HediyyePanel;
  if (uid === MEN) {
    if (H) H.bagla();
    if (S && !S.acikdir()) { S.ac(); return; }
  } else if (H) {
    if (S) S.bagla();
    if (H.hedef() !== uid) { H.ac(uid); return; }
  }
  window.ProfilKart.ac(uid);
}

const icinde = (el, x, y) => {
  const r = (el.querySelector(".foto") || el).getBoundingClientRect();
  return r.width > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
};

window.addEventListener("click", e => {
  if (ov.classList.contains("open")) return;

  /* ortadakı iki kart: birincisi qız (q), ikincisi oğlan (o) oyunçusudur */
  if (spin) {
    const ortalar = document.querySelectorAll("#masa .orta");
    const uidler = [spin.qu, spin.ou];
    for (let i = 0; i < ortalar.length && i < 2; i++) {
      const el = ortalar[i];
      if (el.classList.contains("goster") && uidler[i] && icinde(el, e.clientX, e.clientY)) {
        ackart(uidler[i]);
        return;
      }
    }
  }

  for (const el of document.querySelectorAll("#masa .yer.dolu")) {
    const m = /yer-(\d+)/.exec(el.className);
    if (!m) continue;
    const o = oturacaqlar[m[1]];
    if (o && o.uid && icinde(el, e.clientX, e.clientY)) {
      ackart(o.uid);
      return;
    }
  }
}, true);
