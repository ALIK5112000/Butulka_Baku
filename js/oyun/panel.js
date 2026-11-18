import { fsdb } from "../core/firebase.js";
import { MASA_NOMRESI } from "../core/config.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let cari = null;
try { cari = JSON.parse(localStorage.getItem("currentUser")); } catch (e) {}

document.getElementById("masaNo").textContent = MASA_NOMRESI;
document.getElementById("cixisBtn").onclick = () => { location.href = "profil.html"; };

if (cari && cari.docId) {
  onSnapshot(doc(fsdb, "users", cari.docId), (s) => {
    const p = s.data();
    if (!p) return;
    document.getElementById("urekSayi").textContent = p.hearts || 0;

    const qalan = p.vip && p.vipUntil > Date.now()
      ? Math.ceil((p.vipUntil - Date.now()) / 86400000) : 0;
    const pill = document.getElementById("vipPill");
    pill.textContent = qalan + " gün";
    pill.style.display = qalan ? "" : "none";
  });
}
