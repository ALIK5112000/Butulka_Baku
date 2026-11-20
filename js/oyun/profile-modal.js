import { fsdb } from "../core/firebase.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/* users sənədindəki real sahə adları (profil.html-dən) */
const SAHE = {
  ad: ["username"], yas: ["age"], olke: ["country"], sheher: ["city"],
  sekil: ["avatar"], status: ["status"], urek: ["hearts"], jeton: ["jetons"], baxish: ["views"]
};
const pick = (d, keys) => { for (const k of keys) if (d[k] !== undefined && d[k] !== null && d[k] !== "") return d[k]; return null; };
const vipMi = d => d.role === "admin" || (d.vip && (!d.vipUntil || Number(d.vipUntil) > Date.now()));
const fmt = n => (Number(n) || 0).toLocaleString("ru-RU");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NOPHOTO = "images/avatar/nophoto.svg";

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
  const sheher = [pick(d, SAHE.olke), pick(d, SAHE.sheher)].filter(Boolean).join(", ");
  const sekil = pick(d, SAHE.sekil) || NOPHOTO;
  const vip = vipMi(d);
  const status = pick(d, SAHE.status);

  ov.innerHTML =
    '<div class="pk-card">' +
      '<button class="pk-close" aria-label="Bağla"><svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" stroke="#7cc92f" stroke-width="3.2" stroke-linecap="round"/></svg></button>' +
      (vip ? '<div class="pk-vip">VIP</div>' : "") +
      '<div class="pk-photo"><img src="' + esc(sekil) + '" alt="" onerror="this.src=\'' + NOPHOTO + '\'">' +
        '<div class="pk-cap">' + esc(ad) + (yas ? ", " + esc(yas) : "") + (sheher ? "<small>" + esc(sheher) + "</small>" : "") + "</div></div>" +
      '<div class="pk-stats"><div>' +
        '<div class="pk-row pk-k"><span class="ic">❤️</span><b>' + fmt(pick(d, SAHE.urek)) + "</b></div>" +
        '<div class="pk-row pk-m"><span class="ic">👁️</span><b>' + fmt(pick(d, SAHE.baxish)) + "</b></div>" +
        '<div class="pk-row pk-c"><span class="ic">🪙</span><b>' + fmt(pick(d, SAHE.jeton)) + "</b></div>" +
      '</div><div class="pk-trophy">🏆</div></div>' +
      '<div class="pk-user"><img class="pk-ava" src="' + esc(sekil) + '" alt="" onerror="this.src=\'' + NOPHOTO + '\'">' +
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

/* Hər yerdən çağırmaq üçün: ProfilKart.ac("istifadəçi_docId") */
window.ProfilKart = {
  ac(docId) {
    if (!docId) return;
    if (unsub) unsub();
    ov.classList.add("open");
    unsub = onSnapshot(doc(fsdb, "users", docId), snap => {
      if (snap.exists()) ciz(snap.data());
    }, err => console.error("ProfilKart:", err));
  },
  bagla
};
