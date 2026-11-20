import { fsdb, rtdb } from "../core/firebase.js";
import { MASA_NOMRESI } from "../core/config.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

/* Yoxlama rejimi: telefonda kiçik mesaj göstərir. İşlədikdən sonra false et. */
const DEBUG = true;

/* users sənədindəki real sahə adları */
const SAHE = {
  ad: ["username"], yas: ["age"], olke: ["country"], sheher: ["city"],
  sekil: ["avatar"], status: ["status"], urek: ["hearts"], jeton: ["jetons"], baxish: ["views"]
};
const pick = (d, keys) => { for (const k of keys) if (d[k] !== undefined && d[k] !== null && d[k] !== "") return d[k]; return null; };
const vipMi = d => d.role === "admin" || (d.vip && (!d.vipUntil || Number(d.vipUntil) > Date.now()));
const fmt = n => (Number(n) || 0).toLocaleString("ru-RU");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NOPHOTO = "images/avatar/nophoto.svg";

/* kiçik yoxlama mesajı */
function dbg(msg) {
  if (!DEBUG) return;
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText = "position:fixed;left:50%;top:14vw;transform:translateX(-50%);z-index:20000;background:rgba(0,0,0,.85);color:#fff;font:3.4vw Roboto,Arial,sans-serif;padding:2vw 4vw;border-radius:2vw;max-width:90vw;text-align:center";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

const ov = document.createElement("div");
ov.className = "pk-overlay";
document.body.appendChild(ov);

let unsub = null;
function bagla() {
  ov.classList.remove("open");
  if (unsub) { unsub(); unsub = null; }
  ov.innerHTML = "";
}
ov.addEventListener("click", e => { if (e.target === ov) bagla(); });

function ciz(d) {
  const ad = pick(d, SAHE.ad) || "Oyunçu";
  const yas = pick(d, SAHE.yas);
  const yer = [pick(d, SAHE.olke), pick(d, SAHE.sheher)].filter(Boolean).join(", ");
  const sekil = pick(d, SAHE.sekil) || NOPHOTO;
  const vip = vipMi(d);
  const status = pick(d, SAHE.status);
  const onerr = "this.onerror=null;this.src='" + NOPHOTO + "'";

  ov.innerHTML =
    '<div class="pk-card">' +
      '<button class="pk-close" aria-label="Bağla"><svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" stroke="#7cc92f" stroke-width="3.2" stroke-linecap="round"/></svg></button>' +
      (vip ? '<div class="pk-vip">VIP</div>' : "") +
      '<div class="pk-photo"><img src="' + esc(sekil) + '" alt="" onerror="' + onerr + '">' +
        '<div class="pk-cap">' + esc(ad) + (yas ? ", " + esc(yas) : "") + (yer ? "<small>" + esc(yer) + "</small>" : "") + "</div></div>" +
      '<div class="pk-stats"><div>' +
        '<div class="pk-row pk-k"><span class="ic">❤️</span><b>' + fmt(pick(d, SAHE.urek)) + "</b></div>" +
        '<div class="pk-row pk-m"><span class="ic">👁️</span><b>' + fmt(pick(d, SAHE.baxish)) + "</b></div>" +
        '<div class="pk-row pk-c"><span class="ic">🪙</span><b>' + fmt(pick(d, SAHE.jeton)) + "</b></div>" +
      '</div><div class="pk-trophy">🏆</div></div>' +
      '<div class="pk-user"><img class="pk-ava" src="' + esc(sekil) + '" alt="" onerror="' + onerr + '">' +
        '<div><div class="pk-name">' + esc(ad) + "</div>" +
        '<div class="pk-heart">' + esc(status || "") + "</div>" +
        '<button class="pk-follow">Tərk et</button></div></div>' +
      '<div class="pk-actions">' +
        '<button class="pk-btn" style="background:#f0553f">🛡️</button>' +
        '<button class="pk-btn" style="background:#f08a00;font-size:3.6vw;font-weight:700">Buto</button>' +
        '<button class="pk-btn" style="background:#b0508f">🎵</button>' +
        '<button class="pk-btn" style="background:#f6a23a">✔</button>' +
        '<button class="pk-btn" style="background:#4fa8de">✉</button>' +
      "</div>" +
    "</div>";
  ov.querySelector(".pk-close").onclick = bagla;
}

/* ProfilKart.ac("istifadəçi_docId") */
window.ProfilKart = {
  ac(docId) {
    if (!docId) return;
    if (unsub) unsub();
    ov.classList.add("open");
    unsub = onSnapshot(doc(fsdb, "users", docId), snap => {
      if (snap.exists()) ciz(snap.data());
      else { dbg("İstifadəçi sənədi tapılmadı"); bagla(); }
    }, err => { console.error("ProfilKart:", err); dbg("Firestore xətası: " + err.code); bagla(); });
  },
  bagla
};

/* Oturacağa toxunanda aç (üstünü qat örtsə belə, koordinatla tapır) */
let oturacaqlar = {};
onValue(ref(rtdb, "masalar/" + MASA_NOMRESI + "/oturacaqlar"), s => { oturacaqlar = s.val() || {}; });

window.addEventListener("click", e => {
  if (ov.classList.contains("open")) return;
  const doluler = document.querySelectorAll("#masa .yer.dolu");
  for (const el of doluler) {
    const m = /yer-(\d+)/.exec(el.className);
    if (!m) continue;
    const o = oturacaqlar[m[1]];
    const r = (el.querySelector(".foto") || el).getBoundingClientRect();
    if (o && o.uid && r.width && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
      dbg("Açılır: " + (o.ad || o.uid));
      window.ProfilKart.ac(o.uid);
      return;
    }
  }
}, true);

dbg("Profil modulu yükləndi ✓");
