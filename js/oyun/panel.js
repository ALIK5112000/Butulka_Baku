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
  el.style.fontSize = (n.length <= 4 ? 3.85 : n.length === 5 ? 3.2 : n.length === 6 ? 2.6 : 2.15) + "vw";
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

// ===== Menyu düyməsi (3 xətt) + açılan siyahı =====
(function menyuQur() {
  if (document.getElementById("menyuBtn")) return;
  const panel = document.getElementById("ustPanel") || document.getElementById("cixisBtn").parentNode;

  // Düymə: digər üst panel düymələri ilə eyni (.ub) görünüş
  const btn = document.createElement("button");
  btn.id = "menyuBtn";
  btn.type = "button";
  btn.className = "ub";
  btn.style.left = "54.9vw";
  btn.innerHTML =
    '<svg viewBox="0 0 24 24"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>' +
    '<span class="nuqte"></span>';
  panel.appendChild(btn);

  // Siyahı (Dəvət et çıxarılıb)
  const bendler = [
    { key: "nailiyyetler", ad: "Nailiyyətlər", ikon: "🏅", noqte: true },
    { key: "reytinqler",   ad: "Reytinqlər",   ikon: "🏆" },
    { key: "butulka",      ad: "Butulka",      ikon: "🍾" },
    { key: "masafonu",     ad: "Masa fonu",    ikon: "🎨" },
    { key: "terz",         ad: "Tərz",         ikon: "🖼️" },
    { key: "busterler",    ad: "Busterlər",    ikon: "⚡" }
  ];

  const menyu = document.createElement("div");
  menyu.id = "menyuPanel";
  menyu.style.cssText =
    "position:fixed;display:none;z-index:9999;background:#fff;border-radius:2.6vw;padding:1vw 0;" +
    "width:40vw;box-shadow:0 1vw 4vw rgba(0,0,0,.28);font-family:Roboto,Arial,sans-serif;";

  bendler.forEach((b) => {
    const row = document.createElement("div");
    row.style.cssText =
      "display:flex;align-items:center;gap:2.6vw;padding:0 2.8vw;height:10.4vw;" +
      "font-size:4.2vw;color:#222;cursor:pointer;";
    row.innerHTML =
      '<span style="font-size:5.6vw;width:6.2vw;text-align:center;line-height:1;">' + b.ikon + "</span>" +
      '<span style="flex:1;">' + b.ad + "</span>" +
      (b.noqte ? '<span style="width:2.2vw;height:2.2vw;border-radius:50%;background:#ff4d00;"></span>' : "");
    row.onclick = () => {
      menyu.style.display = "none";
      // Hər bəndin öz funksiyasını sonra bura bağlaya bilərsən
      document.dispatchEvent(new CustomEvent("menyu-sec", { detail: b.key }));
    };
    menyu.appendChild(row);
  });
  document.body.appendChild(menyu);

  function yerlesdir() {
    const r = btn.getBoundingClientRect();
    const eni = menyu.offsetWidth;
    menyu.style.top = (r.bottom + window.innerWidth * 0.03) + "px";
    let sol = r.left + r.width / 2 - eni / 2;
    sol = Math.max(8, Math.min(sol, window.innerWidth - eni - 8));
    menyu.style.left = sol + "px";
  }

  btn.onclick = (e) => {
    e.stopPropagation();
    const acilib = menyu.style.display === "block";
    menyu.style.display = acilib ? "none" : "block";
    if (!acilib) yerlesdir();
  };
  document.addEventListener("click", (e) => {
    if (!menyu.contains(e.target) && e.target !== btn) menyu.style.display = "none";
  });
  window.addEventListener("resize", () => { if (menyu.style.display === "block") yerlesdir(); });
})();
