import { fsdb } from "../core/firebase.js";
import { MASA_NOMRESI } from "../core/config.js";
import { cariOyuncu } from "./yardimci.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const cari = cariOyuncu();
document.getElementById("masaNo").textContent = MASA_NOMRESI;
document.getElementById("cixisBtn").onclick = () => { location.href = "profil.html"; };

// Ürək sayını ekrana yazır (ürək mağazasındakı animasiya da bunu çağırır)
function urekYaz(nVal) {
  const n = String(nVal), el = document.getElementById("urekSayi");
  el.textContent = n;
  el.style.fontSize = (n.length <= 4 ? 3.4 : n.length === 5 ? 2.9 : n.length === 6 ? 2.4 : 2) + "vw";
}
window.urekYaz = urekYaz;

if (cari && cari.docId) {
  onSnapshot(doc(fsdb, "users", cari.docId), (s) => {
    const p = s.data();
    if (!p) return;
    const n = String(p.hearts || 0);
    window.__urekSon = n;                    // ən son real balans
    if (!window.__urekHold) urekYaz(n);      // animasiya gedərkən rəqəmi dərhal dəyişmirik

    const qalan = p.vip && p.vipUntil > Date.now() ? Math.ceil((p.vipUntil - Date.now()) / 86400000) : 0;
    const pill = document.getElementById("vipPill");
    pill.textContent = qalan + " gün";
    pill.style.display = qalan ? "" : "none";
  });
}
