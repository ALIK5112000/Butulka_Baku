import { fsdb, rtdb } from "../core/firebase.js";
import { MASA_NOMRESI } from "../core/config.js";
import { cariOyuncu } from "./yardimci.js";
import { doc, onSnapshot, updateDoc, runTransaction, collection, query, where, getCountFromServer, getDoc, deleteField } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ref, onValue, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { topMu, topDeyis, TOP_RENG } from "./top-oyuncular.js";

/* ================= DONMA VAXTI YOXLAMA VƏ BƏRPA ================= */
const FREEZE_FIELD_MAP = {
  kisses: "freeze_kisses",
  music: "freeze_music",
  smiles: "freeze_smiles"
};

const SAVED_FIELD_MAP = {
  kisses: "saved_kisses",
  music: "saved_music",
  smiles: "saved_smiles"
};

function vaxtMs(val) {
  if (!val) return 0;
  if (typeof val === "number") return val > 0 && val < 1e12 ? val * 1000 : val;
  if (val && typeof val.toMillis === "function") return val.toMillis();
  if (val && typeof val.seconds === "number") return val.seconds * 1000;
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n < 1e12 ? n * 1000 : n;
}

function donmaBitisVaxti(d, sahe) {
  if (!d) return 0;
  let maxMs = 0;

  if (d.dondurulmusXallar && d.dondurulmusXallar[sahe] !== undefined) {
    maxMs = Math.max(maxMs, vaxtMs(d.dondurulmusXallar[sahe]));
  }

  const fKey = FREEZE_FIELD_MAP[sahe];
  if (fKey && d[fKey] !== undefined) {
    maxMs = Math.max(maxMs, vaxtMs(d[fKey]));
  }

  return maxMs;
}

function aktivDonmaVarmi(d, sahe) {
  return donmaBitisVaxti(d, sahe) > Date.now();
}

async function donmaVaxtiYoxla(uid, d) {
  if (!uid || !d) return;
  const indi = Date.now();
  const yenile = {};
  let deyisdi = false;

  const dz = d.dondurulmusXallar || {};
  for (const sahe of Object.keys(dz)) {
    const bitis = vaxtMs(dz[sahe]);
    if (bitis > 0 && indi >= bitis) {
      yenile["dondurulmusXallar." + sahe] = deleteField();
      if (d.saxlanilanXallar && d.saxlanilanXallar[sahe] !== undefined) {
        yenile[sahe] = Number(d.saxlanilanXallar[sahe]) || 0;
        yenile["saxlanilanXallar." + sahe] = deleteField();
      }
      deyisdi = true;
    }
  }

  for (const [sahe, fKey] of Object.entries(FREEZE_FIELD_MAP)) {
    const bitis = vaxtMs(d[fKey]);
    if (bitis > 0 && indi >= bitis) {
      yenile[fKey] = 0;
      const sKey = SAVED_FIELD_MAP[sahe];
      if (sKey && d[sKey] !== undefined && Number(d[sKey]) > 0) {
        yenile[sahe] = Number(d[sKey]) || 0;
        yenile[sKey] = 0;
      }
      deyisdi = true;
    }
  }

  if (deyisdi) {
    try {
      await updateDoc(doc(fsdb, "users", uid), yenile);
    } catch (e) {
      console.error("Donma açılma xətası:", e);
    }
  }
}

const CSS = `
.pf-ov{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:10000;font-family:Roboto,Arial,sans-serif}
.pf-ov.open{display:flex}
.pf-card{position:relative;width:80vw;background:#fff;border-radius:4.4vw;box-shadow:0 1vw 4vw rgba(0,0,0,.35);animation:pfin .25s ease}
@keyframes pfin{from{transform:translateY(5vw);opacity:0}}
.pf-photo{position:relative;width:100%;height:80vw;border-radius:4.4vw 4.4vw 0 0;overflow:hidden;background:#0b1530}
.pf-photo img{width:100%;height:100%;object-fit:cover;object-position:center top;display:block}
.pf-cap{position:absolute;left:0;right:0;bottom:1.1vw;text-align:center;color:#fff;font:700 3.8vw/4.4vw Roboto,Arial,sans-serif;text-shadow:0 .2vw .8vw rgba(0,0,0,.85)}
.pf-cap small{display:block;font:500 3.4vw/4.4vw Roboto,Arial,sans-serif}
.pf-zoom{position:absolute;right:2.4vw;bottom:2.1vw;width:5.85vw;height:5.85vw;border:0;background:none;padding:0}
.pf-zoom svg{width:100%;height:100%;display:block}
.pf-close{position:absolute;top:-2.6vw;right:-2.6vw;width:8.3vw;height:8.3vw;border-radius:50%;background:#fff;border:0;padding:0;display:flex;align-items:center;justify-content:center;box-shadow:0 .6vw 1.8vw rgba(0,0,0,.3);z-index:3}
.pf-close svg{width:4.2vw;height:4.2vw}
.pf-stats{display:flex;justify-content:space-between;align-items:center;padding:1.2vw 4.5vw 0 2.9vw}
.pf-row{display:flex;align-items:center;height:7vw;white-space:nowrap}
.pf-ic{width:7.6vw;margin-right:1vw;display:flex;align-items:center;justify-content:center}
.pf-ic svg,.pf-ic img{display:block}
.pf-row b{font:700 3.7vw/1 Roboto,Arial,sans-serif;margin-right:3vw}
.pf-rk{font:400 2.6vw/1 Roboto,Arial,sans-serif;color:#9a9a9a}
.pf-k b{color:#d2381a}.pf-m b{color:#b0508f}.pf-c b{color:#f08a00}.pf-h b{color:#c0391b}
.pf-trophy{width:17.8vw;height:18.9vw;flex:none;transform:scaleX(.93);transform-origin:right center}
.pf-dv{display:flex;align-items:center;height:3.9vw;margin:1.5vw 3.9vw 0}
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
.pf-heart img{width:7.4vw;height:auto;margin-right:2.1vw}
.pf-heart b{font:700 3.6vw/1 Roboto,Arial,sans-serif;color:#2b2b2b;margin-right:2.8vw}
.pf-heart .pf-rk{font-size:2.7vw}
.pf-follow{background:#7cc92f;color:#fff;border:0;border-radius:.5vw;min-width:20.8vw;padding:0 2vw;height:6.2vw;font:400 3.4vw/1 Roboto,Arial,sans-serif}
.pf-follow.g{background:#c9c9c9}
.pf-follow:disabled{opacity:.7}
.pf-ln{height:.3vw;background:#e6e6e6;margin:2.6vw 3.9vw 0}
.pf-act{display:flex;justify-content:space-between;padding:2.35vw 3.9vw 4.9vw}
.pf-btn{width:12vw;height:12vw;border-radius:50%;border:0;color:#fff;padding:0;display:flex;align-items:center;justify-content:center}
.pf-btn svg{width:7vw;height:7vw;fill:none;stroke:#fff;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.pf-btn.t{font:700 2.9vw/1 Roboto,Arial,sans-serif}
.pf-act .pf-btn:nth-child(1) svg{width:10.2vw;height:10.2vw}
.pf-act .pf-btn:nth-child(3) svg{width:7.6vw;height:7.6vw}
.pf-act .pf-btn:nth-child(4) svg{width:8.9vw;height:8.9vw}
.pf-act .pf-btn:nth-child(5) svg{width:8.6vw;height:8.6vw}
.pf-st{height:9.33vw;box-sizing:border-box;padding:0 4vw;display:flex;align-items:center;justify-content:center;text-align:center;font:italic 400 3.7vw/1.2 Roboto,Arial,sans-serif;color:#111}
.pf-st span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
.pf-stl{height:.3vw;background:#e6e6e6;margin:0 3.9vw}
.pf-full{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:10001;display:flex;align-items:center;justify-content:center}
.pf-full img{max-width:100%;max-height:100%}
.pf-toast{position:fixed;left:50%;bottom:24vw;transform:translateX(-50%);max-width:80vw;text-align:center;z-index:20000;background:rgba(35,35,35,.92);color:#fff;font:500 3.5vw/1.3 Roboto,Arial,sans-serif;padding:2.6vw 4.6vw;border-radius:3vw}
.pf-ov.pf-bekle .pf-card{visibility:hidden}
/* oyunçu masada deyilsə: təpik, hədiyyə və məktub düymələri solğun, basılmır */
.pf-solgun{pointer-events:none;cursor:default}
.pf-act .pf-btn:first-child.pf-solgun,
.pf-kick.pf-solgun{filter:grayscale(1) brightness(1.35) !important;opacity:.9}
.pf-btn.pf-mus.pf-solgun{background:#8b8b8b !important}
.pf-btn.pf-mail.pf-solgun{background:#a0a0a0 !important}
/* TOP lenti: 1-10 ci yerdə olan oyunçuda VIP lentinin yerində görünür */
.pf-topimg{position:absolute;top:4.26vw;left:-3.9vw;width:14.9vw;height:auto;margin:0;z-index:2;pointer-events:none;-webkit-user-select:none;user-select:none}
/* ===== RAMKA REJİMİ: oyunçunun aktiv ramkası olanda kart qara fonda, ramka ilə görünür ===== */
.pf-rover{display:none}
.pf-card.pf-r{aspect-ratio:1075/1867;border-radius:2.6vw}
.pf-r .pf-rover{display:block;position:absolute;inset:0;z-index:2;pointer-events:none;background:center/100% 100% no-repeat}
.pf-r .pf-topw{position:absolute;left:5.5%;top:2.4%;width:89%;height:51.2%}
.pf-r .pf-photo{height:100%;border-radius:0}
.pf-r .pf-vipimg,.pf-r .pf-topimg{z-index:4}
.pf-r .pf-close{z-index:5}
.pf-r .pf-low{position:absolute;left:7.8%;top:54%;width:84.4%;height:43%;overflow:hidden;z-index:3}
.pf-r .pf-lowi{width:80vw;transform:scale(.84);transform-origin:top left}
.pf-r .pf-ln{display:none}
.pf-r .pf-st{height:7vw}
.pf-r .pf-act{padding:2vw 3.9vw 0}
`;
const st = document.createElement("style");
st.textContent = CSS;
document.head.appendChild(st);

const IC = {
  dudaq: '<img src="images/profil/opucuk.png" alt="" style="width:5.7vw;height:auto;display:block">',
  nota: '<img src="images/profil/mahni.png" alt="" style="width:4.6vw;height:auto;display:block">',
  smayl: '<img src="images/profil/smaylik.png" alt="" style="width:4.7vw;height:auto;display:block">',
  urek1: '<img src="images/profil/tek_urek.png" alt="" style="width:6.4vw;height:auto;display:block">',
  urek2: '<img src="images/profil/cut_urek.png" alt="" style="width:7.4vw;height:auto;display:block">',
  kubok: '<svg class="pf-trophy" viewBox="0 0 64 68"><defs><linearGradient id="pfg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#aebfd0"/><stop offset=".45" stop-color="#eef3f8"/><stop offset="1" stop-color="#93a9bf"/></linearGradient></defs><path d="M13 9C0 9 0 30 20 34M51 9c13 0 13 21-7 25" fill="none" stroke="#9db2c6" stroke-width="5" stroke-linecap="round"/><path d="M12 5h40v17c0 14-8 22-20 22S12 36 12 22z" fill="url(#pfg)" stroke="#8aa0b5" stroke-width="2"/><rect x="28" y="44" width="8" height="11" fill="#9db2c6"/><path d="M17 55h30l3 9H14z" fill="url(#pfg)" stroke="#8aa0b5" stroke-width="2"/><path d="M32 13l3.200 6.500 7.100 1-5.200 5 1.300 7.100L32 29.200l-6.400 3.400 1.300-7.100-5.200-5 7.100-1z" fill="#f6b300" stroke="#d99700" stroke-width="1.200"/></svg>',
  chev: '<svg viewBox="0 0 46 24"><path d="M6 6l17 12L40 6" fill="none" stroke="#9a9a9a" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  zoom: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3"/></svg>',
  qalxan: '<svg viewBox="0 0 24 24"><path d="M12 2.5l8 3v6c0 5-3.400 8.600-8 10-4.600-1.400-8-5-8-10v-6z"/><path d="M12 8l1.300 2.700 3 .4-2.200 2.100.5 3-2.600-1.400-2.600 1.400.5-3-2.200-2.100 3-.4z"/></svg>',
  musiqi: '<svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
  /* hədiyyə ikonu: ekran görüntüsündən kəsilmiş şəkil (images/profil/hediyye_icon.png), ağ xətlər şəffaf fonda */
  hediyye: '<img src="images/profil/hediyye_icon.png" alt="" style="width:7.4vw;height:auto;display:block;pointer-events:none">',
  tesdiq: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M7.500 12.500l3 3 6-6.500"/></svg>',
  mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  bosAva: '<svg viewBox="0 0 100 100" style="width:100%;height:100%;display:block"><rect width="100" height="100" fill="#dfe9f1"/><g fill="none" stroke="#b9c7d3" stroke-width="3" stroke-dasharray="5 4"><ellipse cx="50" cy="38" rx="14" ry="17"/><path d="M18 96c0-20 14-30 32-30s32 10 32 30"/></g></svg>'
};

const pick = (d, keys) => { for (const k of keys) if (d[k] !== undefined && d[k] !== null && d[k] !== "") return d[k]; return null; };
const vipMi = d => d.role === "admin" || (d.vip && (!d.vipUntil || Number(d.vipUntil) > Date.now()));
const fmt = n => (Number(n) || 0).toLocaleString("ru-RU");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NOPHOTO = "images/avatar/nophoto.svg";
/* TOP lent şəkli images/profil/ qovluğundan götürülür. Faylın adı fərqlidirsə, siyahıya yaz (ilk tapılan işləyir) */
const TOP_LENTLER = ["top-ribbon.png", "top.png", "TOP.png", "Top.png", "top.webp", "top.jpg", "top_lent.png", "top-lent.png", "toplent.png", "top_ribbon.png"].map(a => "images/profil/" + a);
const TOP_LENT = TOP_LENTLER[0];
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
  if (!uid || !n || n <= 0) return;
  const uRef = doc(fsdb, "users", uid);

  return runTransaction(fsdb, async tx => {
    const snap = await tx.get(uRef);
    if (!snap.exists()) return;
    const d = snap.data() || {};

    if (aktivDonmaVarmi(d, sahe)) {
      return;
    }

    const yenile = {};
    let bitmisVar = false;

    if (d.dondurulmusXallar && d.dondurulmusXallar[sahe] !== undefined) {
      const bitis = vaxtMs(d.dondurulmusXallar[sahe]);
      if (bitis > 0 && Date.now() >= bitis) {
        yenile["dondurulmusXallar." + sahe] = deleteField();
        if (d.saxlanilanXallar && d.saxlanilanXallar[sahe] !== undefined) {
          const kohne = num(d.saxlanilanXallar[sahe]);
          yenile["saxlanilanXallar." + sahe] = deleteField();
          yenile[sahe] = kohne + n;
          bitmisVar = true;
        }
      }
    }

    const fKey = FREEZE_FIELD_MAP[sahe];
    if (fKey && d[fKey] !== undefined) {
      const bitis = vaxtMs(d[fKey]);
      if (bitis > 0 && Date.now() >= bitis) {
        yenile[fKey] = 0;
        const sKey = SAVED_FIELD_MAP[sahe];
        if (sKey && d[sKey] !== undefined) {
          const kohne = num(d[sKey]);
          yenile[sKey] = 0;
          yenile[sahe] = kohne + n;
          bitmisVar = true;
        }
      }
    }

    if (bitmisVar) {
      tx.update(uRef, yenile);
      return;
    }

    tx.update(uRef, { ...yenile, [sahe]: num(d[sahe]) + n });
  }).catch(e => console.error("Xal xətası:", e));
};

window.Xallar = {
  opus: (uid, n = 1) => xalVer(uid, "kisses", n),
  musiqiQosdu: uid => xalVer(uid, "music", 9),
  musiqiHediyye: (uid, n = 1) => xalVer(uid, "music", n),
  smayl: (uid, n = 1) => xalVer(uid, "smiles", n),
  hediyye: (uid, n = 1) => xalVer(uid, "gifts", n),
  beyenme: (uid, n = 1) => xalVer(uid, "likes", n),
  cutluk: (uid, n = 1) => xalVer(uid, "couples", n),
  oyunVaxti: (uid, n = 1) => xalVer(uid, "playTime", n),
  donmaYoxla: donmaVaxtiYoxla
};

if (MEN) {
  let evvel = null;
  onValue(ref(rtdb, "masalar/" + MASA_NOMRESI + "/opus/" + MEN), s => {
    const v = num(s.val());
    if (evvel !== null && v > evvel) xalVer(MEN, "kisses", v - evvel);
    evvel = v;
  });
}

let urekGizli = false;
setInterval(() => {
  const acik = !!document.querySelector(".sp-root.open, .hd-root.open, .pf-ov.open");
  if (acik === urekGizli) return;
  urekGizli = acik;
  ["urekBtn", "urekSayi"].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = acik ? "none" : ""; });
}, 300);

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

async function meftunOl(hedef) {
  const info = {};
  await meftunTx(async (al, yaz) => {
    const h = await al(hedef), m = await al(MEN);
    const q = Math.max(1, num(h.meftunQiymet));
    if (h.meftunUid === MEN) throw new Error("ARTIQ");
    if (num(m.hearts) < q) throw new Error("YETMIR");
    const prev = h.meftunUid || null, odenen = num(h.meftunOdenis);
    if (prev) {
      const p = await al(prev);
      if (!aktivDonmaVarmi(p, "cutUrek")) {
        yaz(prev, "cutUrek", Math.max(0, num(p.cutUrek) - odenen));
      }
    }
    yaz(MEN, "hearts", num(m.hearts) - q);
    if (!aktivDonmaVarmi(m, "cutUrek")) {
      yaz(MEN, "cutUrek", num(m.cutUrek) + q);
    }
    yaz(hedef, "meftunUid", MEN);
    yaz(hedef, "meftunOdenis", q);
    yaz(hedef, "meftunQiymet", q + 1);
    info.metn = "💘 " + (m.username || "Oyunçu") + ", " + (h.username || "Oyunçu") + " adlı oyunçuya məftun oldu (" + q + " ❤️)";
  });
  return info;
}

async function terkEt() {
  const info = {};
  await meftunTx(async (al, yaz) => {
    const o = await al(MEN);
    if (!o.meftunUid) throw new Error("BOS");
    const q = Math.max(1, num(o.meftunQiymet));
    if (num(o.hearts) < q) throw new Error("YETMIR");
    const prev = o.meftunUid, odenen = num(o.meftunOdenis);
    const p = await al(prev);
    const prevAd = p.username || "Oyunçu";
    if (!aktivDonmaVarmi(p, "cutUrek")) {
      yaz(prev, "cutUrek", Math.max(0, num(p.cutUrek) - odenen));
    }
    yaz(MEN, "hearts", num(o.hearts) - q);
    yaz(MEN, "meftunUid", null);
    yaz(MEN, "meftunOdenis", 0);
    info.metn = "💔 " + (o.username || "Oyunçu") + ", məftunu " + prevAd + " adlı oyunçunu tərk etdi (" + q + " ❤️)";
  });
  return info;
}

function chatYaz(info) {
  if (!info || !info.metn || !MEN) return;
  push(ref(rtdb, "masalar/" + MASA_NOMRESI + "/chat"), { isMeftunNotice: true, uid: MEN, metn: info.metn, vaxt: serverTimestamp() }).catch(() => {});
}

/* ================= SIRA (real vaxt) ================= */
const ov = document.createElement("div");
ov.className = "pf-ov";
document.body.appendChild(ov);

const SIRA_SAHELERI = ["kisses", "music", "smiles", "meftunQiymet", "cutUrek"];
let sonD = null, unsub = null, acik = false, ownerUid = null;

const rkN = {};
/* son məlum sıralar cihazda saxlanır: Firestore limiti dolanda belə kartda son rəqəm görünsün */
try { Object.assign(rkN, JSON.parse(localStorage.getItem("pfRk") || "{}")); } catch (e) {}
let rkSaxT = null;
function rkSaxla() {
  clearTimeout(rkSaxT);
  rkSaxT = setTimeout(() => {
    try {
      const ks = Object.keys(rkN).slice(-40), o = {};
      ks.forEach(k => { o[k] = rkN[k]; });
      localStorage.setItem("pfRk", JSON.stringify(o));
    } catch (e) {}
  }, 1000);
}
const rkTxt = (uid, k) => (rkN[uid] && rkN[uid][k] ? fmt(rkN[uid][k]) + " sıra" : "");

/* Açıq kartdakı bütün sıra yazılarını rkN-dən yenidən yazır (itmiş yenilənmə qalmasın) */
function siraSync() {
  if (!ownerUid) return;
  ov.querySelectorAll("[data-r]").forEach(el => {
    const t = rkTxt(ownerUid, el.getAttribute("data-r"));
    if (el.textContent !== t) el.textContent = t;
  });
}

/* ================= TOP LENTİ (1-10 ci yer) ================= */
function topLentYenile() {
  if (!ownerUid) return;
  const w = ov.querySelector(".pf-topw");
  if (!w) return;
  const var_ = topMu(ownerUid);
  let el = w.querySelector(".pf-topimg");
  const vipEl = w.querySelector(".pf-vipimg");
  if (vipEl) vipEl.style.display = var_ ? "none" : "";
  if (!var_) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement("img");
    el.className = "pf-topimg";
    el.alt = "";
    let ti = 0;
    el.src = TOP_LENTLER[0];
    /* fayl tapılmasa siyahıdakı növbəti adı yoxlayır */
    el.onerror = () => { ti++; if (ti < TOP_LENTLER.length) el.src = TOP_LENTLER[ti]; else el.style.display = "none"; };
    w.insertBefore(el, w.firstChild);
  }
}

function siraYaz(uid, k) {
  rkSaxla();
  if (uid !== ownerUid) return;
  const t = rkTxt(uid, k);
  ov.querySelectorAll('[data-r="' + k + '"]').forEach(el => { if (el.textContent !== t) el.textContent = t; });
  topLentYenile();
  hazirsaGoster();
}

const taym = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("vaxt bitdi")), ms))]);
const isde = {}, gozle = {}, sonSira = {};
/* asagi=true: arxa planda (masadakı oyunçuların öncədən yüklənməsi) – açıq kartın sorğularını yavaşlatmasın deyə
   təzə nəticəsi varsa təkrar hesablamır */
async function siraYenile(uid, d, asagi) {
  if (!uid || !d) return;
  if (asagi) {
    const r0 = rkN[uid];
    if (sonSira[uid] && Date.now() - sonSira[uid] < 60000 && r0 && SIRA_SAHELERI.every(k => r0[k] !== undefined)) return;
    if (uid !== ownerUid && Object.keys(isde).some(u => isde[u] && u === ownerUid)) return;
  }
  if (isde[uid]) { gozle[uid] = d; return; }
  isde[uid] = true;
  let xeta = false;
  try {
    const rk = rkN[uid] || (rkN[uid] = {});
    await Promise.all(SIRA_SAHELERI.map(async k => {
      if (aktivDonmaVarmi(d, k)) { rk[k] = 0; siraYaz(uid, k); return; }
      const v = k === "meftunQiymet" ? Math.max(1, num(d[k])) : num(d[k]);
      if (v <= 0) { rk[k] = 0; siraYaz(uid, k); return; }
      try {
        const snap = await taym(getCountFromServer(query(collection(fsdb, "users"), where(k, ">", v))), 8000);
        rk[k] = snap.data().count + 1;
        siraYaz(uid, k);
      } catch (e) {
        xeta = true; console.error("Sıra xətası:", e);
        if (uid === ownerUid && Date.now() - (window.__siraToastT || 0) > 30000) {
          window.__siraToastT = Date.now();
          toast("Sıra xətası: " + (e && (e.code || e.message) || e));
        }
      }
    }));
    if (!xeta) sonSira[uid] = Date.now();
  } finally {
    isde[uid] = false;
    const d2 = gozle[uid];
    if (d2) { delete gozle[uid]; siraYenile(uid, d2); }
    else if (xeta && uid === ownerUid) {
      /* xəta olubsa açıq kartda 2.5 saniyəyə təkrar yoxlayır, 15 saniyə gözləmir */
      setTimeout(() => { if (uid === ownerUid && sonD && ov.classList.contains("open")) siraYenile(uid, sonD); }, 2500);
    }
  }
}
setInterval(() => { if (ov.classList.contains("open") && sonD && ownerUid) siraYenile(ownerUid, sonD); }, 120000);

/* ================= KEŞ ================= */
const udata = {};
function azalt(obj, max) {
  const ks = Object.keys(obj);
  for (let i = 0; i < ks.length - max; i++) if (ks[i] !== ownerUid) delete obj[ks[i]];
}
const sekilIsit = u => { if (u) { try { const im = new Image(); im.src = u; } catch (e) {} } };
[
  "images/profil/opucuk.png",
  "images/profil/mahni.png",
  "images/profil/smaylik.png",
  "images/profil/tek_urek.png",
  "images/profil/cut_urek.png",
  "images/profil/hediyye_icon.png",
  "images/profil/vip.png",
  TOP_LENT,
  NOPHOTO
].forEach(sekilIsit);

/* ================= MƏFTUNUN CANLI MƏLUMATI ================= */
let mUid = null, mUnsub = null, mD = null;
const mKesh = {};
const mYarat = (uid, x) => ({ uid, ad: x.username || "Oyunçu", avatar: x.avatar || "", qiz: x.gender === "Qadın", vip: vipMi(x) });
function izleMeftun(uid) {
  if (uid === mUid) return;
  if (mUnsub) { mUnsub(); mUnsub = null; }
  mUid = uid; mD = uid ? (mKesh[uid] || null) : null;
  if (!uid) return;
  mUnsub = onSnapshot(doc(fsdb, "users", uid), s => {
    mD = mKesh[uid] = mYarat(uid, s.data() || {});
    if (sonD) ciz(sonD);
  }, () => {});
}

/* ================= KART ================= */
let gurulu = false, sig = {};

let bekleT = null;
function hazirMi() {
  if (!sonD || !ownerUid) return false;
  if (sonD.meftunUid && !(mD && mD.uid === sonD.meftunUid)) return false;
  const rk = rkN[ownerUid];
  return !!rk && SIRA_SAHELERI.every(k => rk[k] !== undefined);
}
function kartiGoster() {
  clearTimeout(bekleT); bekleT = null;
  if (!ov.classList.contains("pf-bekle")) return;
  ov.classList.remove("pf-bekle");
  const c = ov.querySelector(".pf-card");
  if (c) { c.style.animation = "none"; void c.offsetWidth; c.style.animation = ""; }
  siraSync();
}
function hazirsaGoster() {
  if (ov.classList.contains("pf-bekle") && hazirMi()) kartiGoster();
}

function bagla() {
  if (window.TepikPencere) window.TepikPencere.bagla();
  sonD = null; ownerUid = null; gurulu = false; sig = {};
  if (mUnsub) { mUnsub(); mUnsub = null; } mUid = null; mD = null;
  clearTimeout(bekleT); bekleT = null;
  ov.classList.remove("pf-bekle");
  ov.classList.remove("open");
  if (unsub) { unsub(); unsub = null; }
  ov.innerHTML = "";
}
ov.addEventListener("click", e => { if (e.target === ov) bagla(); });

/* Oyunçu hazırda bu masada oturubmu? */
const masadaMi = uid => !!uid && Object.values(oturacaqlar).some(o => o && o.uid === uid);

/* Masada olmayan oyunçunun kartında məktub, hədiyyə və təpik düymələri solğun olur və basılmır */
function duymeHal() {
  if (!ownerUid) return;
  const var_ = masadaMi(ownerUid);
  ["pf-mail", "pf-mus"].forEach(c => {
    const b = ov.querySelector("." + c);
    if (!b) return;
    b.disabled = !var_;
    b.classList.toggle("pf-solgun", !var_);
  });
  /* təpik düyməsi: başqasının kartında oyunçu masada deyilsə solğun, öz kartımda həmişə aktiv.
     Class adından asılı olmasın deyə 1-ci düymə mövqeyinə görə tapılır */
  const kAktiv = var_ || ownerUid === MEN;
  const kb = ov.querySelector(".pf-act .pf-btn:first-child");
  if (kb) {
    kb.classList.add("pf-kick");
    kb.disabled = !kAktiv;
    kb.classList.toggle("pf-solgun", !kAktiv);
  }
}
/* düymə kart açıldıqdan sonra əlavə oluna bilər: açıq kartda vəziyyət tez-tez yoxlanır */
setInterval(() => { if (ov.classList.contains("open")) { duymeHal(); siraSync(); } }, 300);

/* Musiqi düyməsi: kart bağlanır, "Musiqi qoy" paneli (klip + mahnı) həmin oyunçu adına açılır.
   (Kartda artıq düyməsi yoxdur, funksiya saxlanılıb) */
function musiqiAc() {
  const uid = ownerUid;
  if (!uid || !masadaMi(uid)) return;
  bagla();
  if (window.SmaylPanel) window.SmaylPanel.bagla();
  if (window.HediyyePanel && typeof window.HediyyePanel.acMusiqi === "function") window.HediyyePanel.acMusiqi(uid);
}

/* Hədiyyə düyməsi: kart bağlanır, hədiyyə paneli həmin oyunçu adına açılır.
   Oyunçu masada deyilsə düymə solğundur və heç nə açılmır */
function hediyyeAc() {
  const uid = ownerUid;
  if (!uid || uid === MEN || !masadaMi(uid)) return;
  bagla();
  if (window.SmaylPanel) window.SmaylPanel.bagla();
  if (window.HediyyePanel) window.HediyyePanel.ac(uid);
}

function mesajYaz() {
  const uid = ownerUid, ad = sonD ? pick(sonD, ["username"]) : null;
  if (!uid || uid === MEN || !ad) return;
  if (!masadaMi(uid)) return; /* masada deyilsə çatda adı yazılmasın */
  bagla();
  if (window.HediyyePanel) window.HediyyePanel.bagla();
  if (window.SmaylPanel) window.SmaylPanel.bagla();
  if (typeof window.CatHedef === "function") window.CatHedef(ad, uid);
  else {
    const inp = document.getElementById("mesajInput");
    if (inp) { const mur = ad + ", "; if (!inp.value.startsWith(mur)) inp.value = mur + inp.value; inp.focus(); }
  }
}

const adRengi = m => (m.vip ? (m.qiz ? "#e0201c" : "#1f5fd6") : (m.qiz ? "#f26aa6" : "#3aa0e0"));

const onerr = "this.onerror=null;this.src='" + NOPHOTO + "'";
const R = k => '<span class="pf-rk" data-r="' + k + '">' + esc(rkTxt(ownerUid, k)) + "</span>";
const row = (cls, ic, val, k) => '<div class="pf-row ' + cls + '"><span class="pf-ic">' + ic + "</span><b>" + fmt(val) + "</b>" + R(k) + "</div>";

function qur() {
  ov.innerHTML =
    '<div class="pf-card">' +
      '<button class="pf-close" aria-label="Bağla"><svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" stroke="#7cc92f" stroke-width="3.2" stroke-linecap="round"/></svg></button>' +
      '<div class="pf-topw"></div>' +
      '<div class="pf-rover"></div>' +
      '<div class="pf-low"><div class="pf-lowi"><div class="pf-stw"></div>' +
      '<div class="pf-stats"><div class="pf-rowsw"></div>' + IC.kubok + "</div>" +
      '<div class="pf-dv"><i></i><span>' + IC.chev + "</span><i></i></div>" +
      '<div class="pf-userw"></div>' +
      '<div class="pf-ln"></div>' +
      '<div class="pf-act">' +
        '<button class="pf-btn pf-kick" style="background:#ec5440">' + IC.qalxan + "</button>" +
        '<button class="pf-btn t" style="background:#ef8c0b">Buto</button>' +
        '<button class="pf-btn pf-mus pf-hed" style="background:#e67c3e" aria-label="Hədiyyə">' + IC.hediyye + "</button>" +
        '<button class="pf-btn" style="background:#f9a23a">' + IC.tesdiq + "</button>" +
        '<button class="pf-btn pf-mail" style="background:#4fa9de">' + IC.mail + "</button>" +
      "</div></div></div>" +
    "</div>";
  gurulu = true; sig = {};
  ov.querySelector(".pf-close").onclick = bagla;
  ov.querySelector(".pf-mail").onclick = mesajYaz;
  ov.querySelector(".pf-mus").onclick = hediyyeAc;
  ov.querySelector(".pf-dv span").onclick = () => { acik = !acik; if (sonD) ciz(sonD); };
}

/* Oyunçunun aktiv ramkası varsa kart qara fonda ramka ilə görünür (ramka.js-dən window.ramkaAktivTap) */
const RAMKA_KES = "polygon(evenodd,0 0,100% 0,100% 100%,0 100%,0 0,8.1% 54.3%,91.9% 54.3%,91.9% 91%,82% 91%,82% 96.8%,18% 96.8%,18% 91%,8.1% 91%,8.1% 54.3%)";   // ramkanın alt qara hissəsini kəsir (küncdəki naxışlar qalır)
function ramkaTetbiq(d) {
  const c = ov.querySelector(".pf-card"), o = ov.querySelector(".pf-rover");
  if (!c || !o) return;
  const r = typeof window.ramkaAktivTap === "function" ? window.ramkaAktivTap(d) : null;
  c.classList.toggle("pf-r", !!r);
  o.style.backgroundImage = r && r.img ? "url(" + JSON.stringify(r.img) + ")" : "none";
  const kes = r && r.img ? RAMKA_KES : "";
  o.style.clipPath = kes; o.style.webkitClipPath = kes;
  const s = r && !r.img && typeof window.ramkaStil === "function" ? window.ramkaStil(r, "1.3vw") : "";
  if (c.dataset.rs !== s) { c.style.cssText = s; c.dataset.rs = s; }
}

function ciz(d) {
  if (!gurulu || !ov.querySelector(".pf-card")) qur();
  ramkaTetbiq(d);
  const ad = pick(d, ["username"]) || "Oyunçu";
  const yas = pick(d, ["age"]);
  const yer = [pick(d, ["country"]), pick(d, ["city"])].filter(Boolean).join(", ");
  const sekil = pick(d, ["avatar"]) || NOPHOTO;
  const qiymet = Math.max(1, num(d.meftunQiymet));
  const mVar = !!d.meftunUid;
  const menimdir = ownerUid === MEN;
  const mailBtn = ov.querySelector(".pf-mail");
  if (mailBtn) mailBtn.style.visibility = menimdir ? "hidden" : "visible";
  /* öz kartımda hədiyyə düyməsi görünmür (özünə hədiyyə göndərilmir) */
  const hedBtn = ov.querySelector(".pf-hed");
  if (hedBtn) hedBtn.style.visibility = menimdir ? "hidden" : "visible";
  duymeHal();

  const sTop = [sekil, ad, yas, yer, vipMi(d)].join("|");
  if (sig.top !== sTop) {
    sig.top = sTop;
    ov.querySelector(".pf-topw").innerHTML =
      (vipMi(d) ? '<img class="pf-vipimg" src="images/profil/vip.png" alt="">' : "") +
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
  /* TOP lenti: innerHTML yenilənəndə silinir, ona görə hər dəfə yenidən yoxlanır */
  topLentYenile();

  const stat = String(pick(d, ["status"]) || "").trim();
  if (sig.st !== stat) {
    sig.st = stat;
    /* status xətti həmişə görünür (status boş olsa da); status yazısı yalnız varsa əlavə olunur */
    ov.querySelector(".pf-stw").innerHTML = (stat ? '<div class="pf-st"><span>' + esc(stat) + "</span></div>" : "") + '<div class="pf-stl"></div>';
  }

  const kVal = aktivDonmaVarmi(d, "kisses") ? 0 : d.kisses;
  const mVal = aktivDonmaVarmi(d, "music") ? 0 : d.music;
  const sVal = aktivDonmaVarmi(d, "smiles") ? 0 : d.smiles;
  const cVal = aktivDonmaVarmi(d, "cutUrek") ? 0 : d.cutUrek;

  ov.querySelector(".pf-dv").classList.toggle("up", acik);
  const sRows = [kVal, mVal, sVal, qiymet, cVal, acik ? 1 : 0].map(num).join("|");
  if (sig.rows !== sRows) {
    sig.rows = sRows;
    let rows = row("pf-k", IC.dudaq, kVal, "kisses") + row("pf-m", IC.nota, mVal, "music");
    if (acik) rows += row("pf-h", IC.urek1, qiymet, "meftunQiymet") + row("pf-h", IC.urek2, cVal, "cutUrek");
    rows += row("pf-c", IC.smayl, sVal, "smiles");
    ov.querySelector(".pf-rowsw").innerHTML = rows;
  }

  const mOK = mVar && mD && mD.uid === d.meftunUid;
  const sUser = [d.meftunUid || "", mOK ? mD.ad + "|" + mD.avatar + "|" + mD.qiz + "|" + mD.vip + "|" + topMu(mD.uid) : "", menimdir, d.meftunUid === MEN].join("#");
  if (sig.user !== sUser) {
    sig.user = sUser;
    let mAva, mAd;
    if (!mVar) { mAva = IC.bosAva; mAd = "Məftun yoxdur"; }
    else if (mOK) {
      mAva = '<img style="width:100%;height:100%;object-fit:cover;display:block" src="' + esc(mD.avatar || NOPHOTO) + '" alt="" onerror="' + onerr + '">';
      mAd = 'Məftun <u style="color:' + (topMu(mD.uid) ? TOP_RENG : adRengi(mD)) + '">' + esc(mD.ad) + "</u>";
    } else { mAva = IC.bosAva; mAd = "Məftun ..."; }

    let dugme;
    if (menimdir) dugme = mVar ? '<button class="pf-follow" data-a="terk">Tərk et</button>' : '<button class="pf-follow g" disabled>Məftun ol</button>';
    else if (d.meftunUid === MEN) dugme = '<button class="pf-follow g" disabled>Məftunsan</button>';
    else dugme = '<button class="pf-follow" data-a="ol">Məftun ol</button>';

    ov.querySelector(".pf-userw").innerHTML =
      '<div class="pf-user"><div class="pf-ava" style="overflow:hidden">' + mAva + "</div>" +
      '<div class="pf-info"><div class="pf-name">' + mAd + "</div>" +
      '<div class="pf-heart"><img src="images/profil/tek_urek.png" alt="" style="width:7.2vw;height:auto;display:block;margin-right:2.1vw"><b class="pf-hv"></b>' + R("meftunQiymet") + "</div>" +
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
        chatYaz(b.dataset.a === "ol" ? await meftunOl(ownerUid) : await terkEt());
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
  siraSync();
  hazirsaGoster();
}

window.ProfilKart = {
  ac(docId) {
    if (!docId) return;
    if (unsub) unsub();
    if (ownerUid !== docId) {
      gurulu = false; sig = {}; sonD = null; ov.innerHTML = "";
      if (mUnsub) { mUnsub(); mUnsub = null; } mUid = null; mD = null;
      ov.classList.add("pf-bekle");
      /* sıra rəqəmləri hazır olana qədər 1.5 saniyəyə qədər gözləyir ki, kart sıra ilə birlikdə görünsün */
      clearTimeout(bekleT); bekleT = setTimeout(kartiGoster, 1500);
    }
    ownerUid = docId;
    ov.classList.add("open");
    if (!sonD && udata[docId]) {
      sonD = udata[docId];
      izleMeftun(sonD.meftunUid || null);
      ciz(sonD);
      siraYenile(docId, sonD);
    }
    unsub = onSnapshot(doc(fsdb, "users", docId), snap => {
      if (!snap.exists()) { bagla(); return; }
      sonD = snap.data();
      donmaVaxtiYoxla(docId, sonD);
      udata[docId] = sonD;
      mKesh[docId] = mYarat(docId, sonD);
      izleMeftun(sonD.meftunUid || null);
      ciz(sonD);
      siraYenile(docId, sonD);
      if (sonD.meftunUid) onYukle(sonD.meftunUid, 1);
    }, err => { console.error("ProfilKart:", err); bagla(); });
  },
  bagla
};

/* TOP siyahısı dəyişəndə açıq kart yenilənir (lent + məftun adının rəngi) */
topDeyis(() => { if (sonD && ownerUid && ov.classList.contains("open")) ciz(sonD); });

/* ramkalar siyahısı (images/ramkalar) yüklənəndə açıq kart ramkanı tapsın */
document.addEventListener("ramka-yuklendi", () => { if (sonD && ownerUid && ov.classList.contains("open")) ciz(sonD); });

const hazir = {};
async function onYukle(uid, derinlik = 0) {
  if (!uid) return;
  const indi = Date.now();
  if (hazir[uid] && indi - hazir[uid] < 120000) return;
  hazir[uid] = indi;
  try {
    const s = await getDoc(doc(fsdb, "users", uid));
    if (!s.exists() || uid === ownerUid) return;
    const d = s.data();
    donmaVaxtiYoxla(uid, d);
    udata[uid] = d;
    mKesh[uid] = mYarat(uid, d);
    azalt(udata, 60); azalt(mKesh, 60); azalt(rkN, 60);
    sekilIsit(d.avatar);
    if (d.meftunUid && derinlik < 1) onYukle(d.meftunUid, derinlik + 1);
  } catch (e) { delete hazir[uid]; }
}

let oturacaqlar = {}, spin = null;
onValue(ref(rtdb, "masalar/" + MASA_NOMRESI + "/oturacaqlar"), s => {
  oturacaqlar = s.val() || {};
  duymeHal();
  Object.values(oturacaqlar).forEach(o => { if (o && o.uid) onYukle(o.uid); });
});
onValue(ref(rtdb, "masalar/" + MASA_NOMRESI + "/raund/spin"), s => {
  spin = s.val() || null;
  if (spin) { onYukle(spin.qu); onYukle(spin.ou); }
});

function ackart(uid) {
  const S = window.SmaylPanel, H = window.HediyyePanel;
  if (uid === MEN) {
    if (H) H.bagla();
    if (S && !document.querySelector(".sp-root.open")) { S.ac(); return; }
  } else if (H) {
    if (S) S.bagla();
    if (typeof H.modu === "function" && H.modu()) { H.isaretle(uid); return; }
    if ((typeof H.hedef === "function" ? H.hedef() : null) !== uid) { H.ac(uid); return; }
  }
  window.ProfilKart.ac(uid);
}

const icinde = (el, x, y) => {
  const r = (el.querySelector(".foto") || el).getBoundingClientRect();
  return r.width > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
};

window.addEventListener("click", e => {
  if (ov.classList.contains("open")) return;
  if (e.target && e.target.closest && !e.target.closest("#masa, #taxta")) return;

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

  const panelAcik = document.querySelector(".sp-root.open, .hd-root.open");
  const panelIci = e.target && e.target.closest ? e.target.closest(".sp-root, .hd-root, .pf-ov") : null;
  const masa = document.getElementById("masa");
  if (panelAcik && !panelIci && masa) {
    const r = masa.getBoundingClientRect();
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
      if (window.SmaylPanel) window.SmaylPanel.bagla();
      if (window.HediyyePanel) window.HediyyePanel.bagla();
    }
  }
}, true);


/* ================= TƏPİK VUR VƏ QORU PƏNCƏRƏLƏRİ =================
   Profil kartındakı qırmızı qalxan düyməsi: qiymət pəncərəsi, "?" ilə izah pəncərəsi.
   Pəncərəni tepik-baglanti.js öz kartımda düyməyə basılanda window.TepikPencere.ac() ilə açır.
   "Oldu" yalnız pəncərəni bağlayır. */
(function () {
const T = { qiymet: 15 };

const CSS = `
.tp-ov{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:2147483000 !important;font-family:Roboto,Arial,sans-serif;-webkit-tap-highlight-color:transparent}
.tp-ov.open{display:flex}
.tp-card{position:relative;width:80vw;background:#fff;border-radius:4.4vw;box-shadow:0 1vw 4vw rgba(0,0,0,.35);animation:tpin .25s ease}
@keyframes tpin{from{transform:translateY(5vw);opacity:0}}
.tp-close{position:absolute;top:-2.6vw;right:-2.6vw;width:8.3vw;height:8.3vw;border-radius:50%;background:#fff;border:0;padding:0;display:flex;align-items:center;justify-content:center;box-shadow:0 .6vw 1.8vw rgba(0,0,0,.3);z-index:3}
.tp-close svg{width:4.2vw;height:4.2vw}
.tp-head{position:relative;height:11.4vw;display:flex;align-items:center;justify-content:center}
.tp-head h3{margin:0;font:700 3.2vw/1 Roboto,Arial,sans-serif;color:#b9b9b9}
.tp-q{position:absolute;left:1vw;top:.4vw;width:8vw;height:8vw;border:0;background:none;padding:0;display:flex;align-items:center;justify-content:center;font:700 5.8vw/1 Roboto,Arial,sans-serif;color:#c3c3c3}
.tp-main{padding-bottom:4vw}
.tp-txt{margin:0;padding:0 5vw;text-align:center;font:400 3.3vw/4vw Roboto,Arial,sans-serif;color:#111}
.tp-pb{margin:4.4vw 5.9vw 0;height:12.5vw;background:#fdf7df;border-radius:4vw;display:flex;align-items:center;padding:0 3.9vw 0 2.1vw;box-sizing:border-box}
.tp-sh{display:block;width:8.8vw;height:8.8vw;flex:none}
.tp-sh svg{width:100%;height:100%;display:block}
.tp-bar{flex:none;width:41.7vw;height:4.1vw;border-radius:2.1vw;background:#97cd32;margin:0 3.6vw 0 2.3vw}
.tp-ok{width:5.7vw;height:5.7vw;flex:none;display:block}
.tp-price{display:flex;align-items:center;justify-content:center;height:6.5vw;margin-top:1vw;font:400 3.3vw/1 Roboto,Arial,sans-serif;color:#111}
.tp-price img{width:3.7vw;height:auto;display:block;margin:0 .8vw 0 1.5vw}
.tp-price b{font-weight:700;font-size:3.5vw}
.tp-oldu{display:block;width:20.8vw;height:7.8vw;margin:2.6vw auto 0;border:0;border-radius:2vw;background:#8cc63f;color:#fff;padding:0;font:400 3.7vw/1 Roboto,Arial,sans-serif}
.tp-info{padding-bottom:3.9vw}
.tp-r{display:flex;align-items:flex-start;padding:0 4vw 0 3.9vw;margin-bottom:3.9vw}
.tp-r.l{margin-bottom:0}
.tp-ic{width:12vw;height:12vw;border-radius:50%;background:#edf3fb;flex:none;margin:1vw 3.9vw 0 0;display:flex;align-items:center;justify-content:center}
.tp-ic svg{width:8.4vw;height:8.4vw;display:block}
.tp-rt{flex:1;min-width:0;margin:0;font:400 3.6vw/5.23vw Roboto,Arial,sans-serif;color:#111}
.tp-rt b{font-weight:700}
.tp-info .tp-oldu{margin-top:4vw}
`;
const st = document.createElement("style");
st.textContent = CSS;
document.head.appendChild(st);

const X = '<svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" stroke="#7cc92f" stroke-width="3.2" stroke-linecap="round"/></svg>';

/* rəngli qalxan + təpik + partlayış */
const QALXAN =
  '<svg viewBox="0 0 64 64">' +
    '<path d="M62 42L53.4 45.1L57.3 53.3L49.1 49.4L46 58L42.9 49.4L34.7 53.3L38.6 45.1L30 42L38.6 38.9L34.7 30.7L42.9 34.6L46 26L49.1 34.6L57.3 30.7L53.4 38.9Z" fill="#f04a2f"/>' +
    '<path d="M24 38l12-5 14 16-6 7-17-3z" fill="#ffc933" stroke="#e8920e" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M20 4l14 5v11c0 9-6 15-14 18-8-3-14-9-14-18V9z" fill="#f7a823" stroke="#e8591e" stroke-width="2.5" stroke-linejoin="round"/>' +
    '<path d="M20 11l2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.6-4.8 2.6 1-5.4-4-3.8 5.4-.7z" fill="#fff3b0"/>' +
  "</svg>";

const SAATOLCEN =
  '<svg viewBox="0 0 64 64">' +
    '<rect x="27" y="3" width="10" height="7" rx="2" fill="#2f7fd6"/>' +
    '<rect x="47" y="11" width="7" height="9" rx="2" fill="#2f7fd6" transform="rotate(42 50 15)"/>' +
    '<circle cx="32" cy="37" r="24" fill="#2f7fd6"/>' +
    '<circle cx="32" cy="37" r="19" fill="#fff"/>' +
    '<path d="M32 22v3M32 49v3M17 37h3M44 37h3" stroke="#2f7fd6" stroke-width="2.5" stroke-linecap="round"/>' +
    '<path d="M32 37l8-9" stroke="#e8392e" stroke-width="4" stroke-linecap="round"/>' +
    '<circle cx="32" cy="37" r="3.5" fill="#e8392e"/>' +
  "</svg>";

const VIPMEDAL =
  '<svg viewBox="0 0 64 64">' +
    '<path d="M14 2h11l9 16h-11z" fill="#d93a2e"/>' +
    '<path d="M50 2H39l-9 16h11z" fill="#d93a2e"/>' +
    '<rect x="12" y="17" width="40" height="44" rx="6" fill="#fff" stroke="#7bbf2e" stroke-width="3"/>' +
    '<path d="M19 38l3-12 6 7 4-9 4 9 6-7 3 12z" fill="#f6b300" stroke="#d99700" stroke-width="1.5" stroke-linejoin="round"/>' +
    '<text x="32" y="55" text-anchor="middle" font-family="Roboto,Arial,sans-serif" font-weight="700" font-size="13" fill="#6cb52d">VIP</text>' +
  "</svg>";

const OK =
  '<svg class="tp-ok" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#8ec63a"/>' +
  '<path d="M6.5 12.5l3.8 3.8 7.2-7.8" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* ================= PƏNCƏRƏ ================= */
const ov = document.createElement("div");
ov.className = "tp-ov";
document.body.appendChild(ov);

let gorunus = "ana";

function anaHtml() {
  return '<div class="tp-card tp-main">' +
    '<button class="tp-close" aria-label="Bağla">' + X + "</button>" +
    '<div class="tp-head"><button class="tp-q" aria-label="Məlumat">?</button><h3>Təpik vur və qoru</h3></div>' +
    '<p class="tp-txt">Təpik vur və qoru ilə oyunçunu masadan kənarlaşdıra, eləcə də ya özünüzü, ya da digər oyunçunu kənarlaşdırılmaqdan qoruya bilərsiniz.</p>' +
    '<div class="tp-pb"><span class="tp-sh">' + QALXAN + '</span><div class="tp-bar"></div>' + OK + "</div>" +
    '<div class="tp-price">Aktivləşdirmənin qiyməti:<img src="images/profil/tek_urek.png" alt=""><b>' + (Number(T.qiymet) || 0) + "</b></div>" +
    '<button class="tp-oldu">Oldu</button>' +
  "</div>";
}

function infoHtml() {
  return '<div class="tp-card tp-info">' +
    '<button class="tp-close" aria-label="Bağla">' + X + "</button>" +
    '<div class="tp-head"><h3>Təpik vur və qoru nədir</h3></div>' +
    '<div class="tp-r"><div class="tp-ic">' + QALXAN + "</div>" +
      '<p class="tp-rt"><b>"Təpik vur və qoru"</b> – sizə oyunçunu təpiklə masadan kənarlaşdırmağa və özünüzü və ya kimisə kənarlaşdırılmaqdan qorumağa imkan verən xüsusiyyətlər toplusudur. Onlardan istifadə edilməsi taymeri işə salır və istifadəsinə davam edilməsi vaxt bitənə qədər ürəklər tələb edir.</p></div>' +
    '<div class="tp-r"><div class="tp-ic">' + SAATOLCEN + "</div>" +
      '<p class="tp-rt">Təpik vurma <b>30</b> saniyə sonra aktivləşəcək və oyunçu <b>15</b> dəqiqə ərzində masadan kənarlaşdırılacaq.</p></div>' +
    '<div class="tp-r l"><div class="tp-ic">' + VIPMEDAL + "</div>" +
      '<p class="tp-rt">Hər kəs özünü təpik vurulmasından qoruya bilər, lakin yalnız <b>VIP</b> oyunçular başqalarını təpiklə kənarlaşdıra bilər və ya bundan qoruya bilərlər. VIP oyunçular hər iki variantdan pulsuz olaraq iki dəfə daha tez istifadə edə bilərlər.</p></div>' +
    '<button class="tp-oldu">Oldu</button>' +
  "</div>";
}

function ciz() {
  ov.innerHTML = gorunus === "info" ? infoHtml() : anaHtml();
  const q = ov.querySelector(".tp-q");
  if (q) q.onclick = () => { gorunus = "info"; ciz(); };
  ov.querySelector(".tp-close").onclick = geri;
  ov.querySelector(".tp-oldu").onclick = gorunus === "info" ? () => { gorunus = "ana"; ciz(); } : bagla;
}

/* izah pəncərəsindən ana pəncərəyə qayıdır, ana pəncərədən isə tam bağlayır */
function geri() {
  if (gorunus === "info") { gorunus = "ana"; ciz(); }
  else bagla();
}

function ac(q) {
  if (q) T.qiymet = q;
  gorunus = "ana";
  ciz();
  ov.classList.add("open");
}

function bagla() {
  ov.classList.remove("open");
  ov.innerHTML = "";
  gorunus = "ana";
}

ov.addEventListener("click", e => { if (e.target === ov) geri(); });

window.TepikPencere = T;
T.ac = ac;
T.bagla = bagla;
})();
