import { fsdb, rtdb } from "../core/firebase.js";
import { MASA_NOMRESI } from "../core/config.js";
import { cariOyuncu } from "./yardimci.js";
import { doc, onSnapshot, updateDoc, increment, collection, query, where, getCountFromServer } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

/* Yoxlama mesajları (telefonda kiçik qara yazı). Hər şey işləyəndə false et. */
const DEBUG = false;

/* users sənədindəki sahələr */
const SAHE = {
  ad: ["username"], yas: ["age"], olke: ["country"], sheher: ["city"], sekil: ["avatar"],
  urek: ["hearts"], opus: ["kisses"], musiqi: ["music"], smayl: ["smiles"]
};
const pick = (d, keys) => { for (const k of keys) if (d[k] !== undefined && d[k] !== null && d[k] !== "") return d[k]; return null; };
const vipMi = d => d.role === "admin" || (d.vip && (!d.vipUntil || Number(d.vipUntil) > Date.now()));
const fmt = n => (Number(n) || 0).toLocaleString("ru-RU");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NOPHOTO = "images/avatar/nophoto.svg";

function dbg(msg) {
  if (!DEBUG) return;
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText = "position:fixed;left:50%;top:14vw;transform:translateX(-50%);z-index:20000;background:rgba(0,0,0,.85);color:#fff;font:3.4vw Roboto,Arial,sans-serif;padding:2vw 4vw;border-radius:2vw;max-width:90vw;text-align:center";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

/* ================= XALLAR ================= */
const xalVer = (uid, sahe, n = 1) => {
  if (!uid || !n) return;
  updateDoc(doc(fsdb, "users", uid), { [sahe]: increment(n) }).catch(e => console.error("Xal xətası:", e));
};

/* Başqa fayllardan çağırmaq üçün:
   Xallar.opus(uid, n)          -> öpüş hədiyyəsi atılanda alana (n dənə)
   Xallar.musiqiQosdu(uid)      -> musiqi qoşan oyunçuya +9
   Xallar.musiqiHediyye(uid, n) -> qoşulan musiqiyə hədiyyə atılanda musiqini qoşana (n dənə) */
window.Xallar = {
  opus: (uid, n = 1) => xalVer(uid, "kisses", n),
  musiqiQosdu: uid => xalVer(uid, "music", 9),
  musiqiHediyye: (uid, n = 1) => xalVer(uid, "music", n)
};

/* Butulka fırlananda yaşıl (öpüş) verilirsə: masadakı öpüş sayğacı artanda
   həmin oyunçunun öz klienti ümumi "kisses" xalını eyni qədər artırır (bir dəfə). */
const men = cariOyuncu();
if (men && men.docId) {
  let evvel = null;
  onValue(ref(rtdb, "masalar/" + MASA_NOMRESI + "/opus/" + men.docId), s => {
    const v = Number(s.val()) || 0;
    if (evvel !== null && v > evvel) xalVer(men.docId, "kisses", v - evvel);
    evvel = v;
  });
}

/* ================= SIRA (real vaxt) ================= */
let tok = 0, sonD = null;
async function siraYenile(d) {
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
}
setInterval(() => { if (ov.classList.contains("open") && sonD) siraYenile(sonD); }, 15000);

/* ================= KART ================= */
const ov = document.createElement("div");
ov.className = "pk-overlay";
document.body.appendChild(ov);

let unsub = null;
function bagla() {
  tok++; sonD = null;
  ov.classList.remove("open");
  if (unsub) { unsub(); unsub = null; }
  ov.innerHTML = "";
}
ov.addEventListener("click", e => { if (e.target === ov) bagla(); });

const IC = {
  qalxan: '<svg viewBox="0 0 24 24"><path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z"/><path d="M12 8l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4z"/></svg>',
  musiqi: '<svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
  tesdiq: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M7.5 12.5l3 3 6-6.5"/></svg>',
  mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  nota: '<svg viewBox="0 0 24 24"><path fill="#b0508f" d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3z"/></svg>',
  urek: '<svg viewBox="0 0 24 24"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" fill="#ee5a24"/></svg>',
  zoom: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>'
};

function ciz(d) {
  const ad = pick(d, SAHE.ad) || "Oyunçu";
  const yas = pick(d, SAHE.yas);
  const yer = [pick(d, SAHE.olke), pick(d, SAHE.sheher)].filter(Boolean).join(", ");
  const sekil = pick(d, SAHE.sekil) || NOPHOTO;
  const onerr = "this.onerror=null;this.src='" + NOPHOTO + "'";
  const R = k => '<span class="rk" data-r="' + k + '"></span>';

  ov.innerHTML =
    '<div class="pk-card">' +
      '<button class="pk-close" aria-label="Bağla"><svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" stroke="#7cc92f" stroke-width="3.2" stroke-linecap="round"/></svg></button>' +
      (vipMi(d) ? '<div class="pk-vipfold"></div><div class="pk-vip">VIP</div>' : "") +
      '<div class="pk-photo"><img src="' + esc(sekil) + '" alt="" onerror="' + onerr + '">' +
        '<div class="pk-cap">' + esc(ad) + (yas ? ", " + esc(yas) : "") + (yer ? "<small>" + esc(yer) + "</small>" : "") + "</div>" +
        '<button class="pk-zoom" aria-label="Böyüt">' + IC.zoom + "</button></div>" +
      '<div class="pk-stats"><div>' +
        '<div class="pk-row pk-k"><span class="ic">💋</span><b>' + fmt(pick(d, SAHE.opus)) + "</b>" + R("kisses") + "</div>" +
        '<div class="pk-row pk-m"><span class="ic">' + IC.nota + "</span><b>" + fmt(pick(d, SAHE.musiqi)) + "</b>" + R("music") + "</div>" +
        '<div class="pk-row pk-c"><span class="ic">😊</span><b>' + fmt(pick(d, SAHE.smayl)) + "</b>" + R("smiles") + "</div>" +
      '</div><div class="pk-trophy">🏆</div></div>' +
      '<div class="pk-div"></div>' +
      '<div class="pk-user"><img class="pk-ava" src="' + esc(sekil) + '" alt="" onerror="' + onerr + '">' +
        '<div class="pk-uinfo"><div class="pk-name">' + esc(ad) + "</div>" +
        '<div class="pk-heart">' + IC.urek + "<b>" + fmt(pick(d, SAHE.urek)) + "</b>" + R("hearts") + "</div>" +
        '<button class="pk-follow">Tərk et</button></div></div>' +
      '<div class="pk-div2"></div>' +
      '<div class="pk-actions">' +
        '<button class="pk-btn" style="background:#f0553f">' + IC.qalxan + "</button>" +
        '<button class="pk-btn txt" style="background:#f08a00">Buto</button>' +
        '<button class="pk-btn" style="background:#b0508f">' + IC.musiqi + "</button>" +
        '<button class="pk-btn" style="background:#f6a23a">' + IC.tesdiq + "</button>" +
        '<button class="pk-btn" style="background:#4fa8de">' + IC.mail + "</button>" +
      "</div>" +
    "</div>";

  ov.querySelector(".pk-close").onclick = bagla;
  ov.querySelector(".pk-zoom").onclick = () => {
    const f = document.createElement("div");
    f.className = "pk-full";
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
      if (!snap.exists()) { dbg("İstifadəçi sənədi tapılmadı"); bagla(); return; }
      sonD = snap.data();
      ciz(sonD);
      siraYenile(sonD);
    }, err => { console.error("ProfilKart:", err); dbg("Firestore xətası: " + err.code); bagla(); });
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
