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

// ===== Ayarlar düyməsi (dişli çarx) + Parametrlər pəncərəsi =====
(function ayarQur() {
  const panel = document.getElementById("ustPanel") || document.getElementById("cixisBtn").parentNode;

  // Köhnə ayarlar düyməsi varsa onu istifadə edirik (id: ayarBtn), yoxdursa yenisini yaradırıq
  let ayarBtn = document.getElementById("ayarBtn");
  if (!ayarBtn) {
    ayarBtn = document.createElement("button");
    ayarBtn.id = "ayarBtn";
    ayarBtn.type = "button";
    panel.appendChild(ayarBtn);
  }
  ayarBtn.className = "ub";
  ayarBtn.style.left = "64.5vw";
  ayarBtn.innerHTML =
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/>' +
    '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

  // Səs səviyyələri (yadda qalır)
  function oxu(acar, ilk) {
    try { const v = localStorage.getItem(acar); return v === null ? ilk : Number(v); } catch (e) { return ilk; }
  }
  window.__sesSeviyyesi = oxu("sesSeviyyesi", 100);       // chat + hədiyyə səsləri (0-100)
  window.__musiqiSeviyyesi = oxu("musiqiSeviyyesi", 0);   // musiqi + klip səsləri (0-100)

  // Slider üçün stil
  if (!document.getElementById("ayarStil")) {
    const st = document.createElement("style");
    st.id = "ayarStil";
    st.textContent =
      "#ayarOverlay .sl{-webkit-appearance:none;appearance:none;width:100%;height:.6vw;border-radius:1vw;outline:none;margin:0;" +
      "background:linear-gradient(to right,#8cc63f var(--d,0%),#e6e6e6 var(--d,0%));}" +
      "#ayarOverlay .sl::-webkit-slider-thumb{-webkit-appearance:none;width:6.2vw;height:6.2vw;border-radius:50%;background:#fff;" +
      "box-shadow:0 .4vw 1.2vw rgba(0,0,0,.35);border:.2vw solid #eee;}" +
      "#ayarOverlay .sl::-moz-range-thumb{width:6.2vw;height:6.2vw;border-radius:50%;background:#fff;" +
      "box-shadow:0 .4vw 1.2vw rgba(0,0,0,.35);border:.2vw solid #eee;}";
    document.head.appendChild(st);
  }

  // Pəncərə
  const overlay = document.createElement("div");
  overlay.id = "ayarOverlay";
  overlay.style.cssText =
    "position:fixed;inset:0;display:none;z-index:10000;background:rgba(0,0,0,.35);" +
    "align-items:center;justify-content:center;font-family:Roboto,Arial,sans-serif;";

  const kart = document.createElement("div");
  kart.style.cssText =
    "position:relative;width:80vw;background:#fff;border-radius:5vw;padding:4vw 3vw 4vw;" +
    "box-shadow:0 1vw 5vw rgba(0,0,0,.3);";

  const baslig = document.createElement("div");
  baslig.textContent = "Parametrlər";
  baslig.style.cssText = "text-align:center;color:#a9a9a9;font-size:4.2vw;font-weight:700;margin-bottom:3vw;";
  kart.appendChild(baslig);

  // X düyməsi
  const baglaBtn = document.createElement("button");
  baglaBtn.type = "button";
  baglaBtn.style.cssText =
    "position:absolute;top:-3.5vw;right:-3.5vw;width:8.4vw;height:8.4vw;border-radius:50%;border:0;padding:0;" +
    "background:#fff;box-shadow:0 .6vw 2vw rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;cursor:pointer;";
  baglaBtn.innerHTML =
    '<svg viewBox="0 0 24 24" width="62%" height="62%" fill="none" stroke="#8cc63f" stroke-width="3" stroke-linecap="round">' +
    '<line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>';
  kart.appendChild(baglaBtn);

  const IK_SES =
    '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M3 9v6h4l5 4V5L7 9H3z" fill="#8cc63f"/>' +
    '<path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="#c7c7c7" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const IK_MUSIQI =
    '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M9 18V6l11-2v12" fill="none" stroke="#c0489d" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<circle cx="6.5" cy="18" r="3" fill="#c0489d"/><circle cx="17.5" cy="16" r="3" fill="#c0489d"/></svg>';
  const IK_BLOK =
    '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="#e5383b" stroke-width="2.6" stroke-linecap="round">' +
    '<circle cx="12" cy="12" r="9"/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/></svg>';
  const IK_ADMIN =
    '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 2.5l8 3v6c0 4.8-3.3 8.6-8 10-4.7-1.4-8-5.2-8-10v-6l8-3z" fill="#6a5acd"/>' +
    '<rect x="8" y="9.5" width="8" height="1.8" rx=".9" fill="#fff"/><rect x="8" y="12.6" width="5.5" height="1.8" rx=".9" fill="#fff"/></svg>';

  const SATIR = "display:flex;align-items:center;gap:3.4vw;height:11vw;padding:0 3vw;font-size:4.4vw;color:#222;";
  const IKON = "width:7vw;height:7vw;flex:none;display:flex;";

  function sliderSatiri(ikon, ad, acar, ilk, hadise) {
    const row = document.createElement("div");
    row.style.cssText = SATIR;
    row.innerHTML =
      '<span style="' + IKON + '">' + ikon + "</span>" +
      '<span style="flex:1;">' + ad + "</span>" +
      '<div style="width:30vw;flex:none;display:flex;align-items:center;">' +
      '<input class="sl" type="range" min="0" max="100" step="1" value="' + ilk + '"></div>';
    const inp = row.querySelector("input");
    const yenile = () => inp.style.setProperty("--d", inp.value + "%");
    yenile();
    inp.addEventListener("input", () => {
      yenile();
      const v = Number(inp.value);
      window[acar] = v;
      try { localStorage.setItem(acar === "__sesSeviyyesi" ? "sesSeviyyesi" : "musiqiSeviyyesi", String(v)); } catch (e) {}
      document.dispatchEvent(new CustomEvent("ses-deyisdi", { detail: { tip: hadise, deyer: v } }));
    });
    return row;
  }

  function dokunSatiri(ikon, ad, key) {
    const row = document.createElement("div");
    row.style.cssText = SATIR + "cursor:pointer;";
    row.innerHTML = '<span style="' + IKON + '">' + ikon + "</span><span style=\"flex:1;\">" + ad + "</span>";
    row.onclick = () => {
      bagla();
      document.dispatchEvent(new CustomEvent("ayar-sec", { detail: key }));
    };
    return row;
  }

  // 1) Səslər: chat və hədiyyə səsləri
  kart.appendChild(sliderSatiri(IK_SES, "Səslər", "__sesSeviyyesi", window.__sesSeviyyesi, "ses"));
  // 2) Musiqi: musiqi və klip səsləri
  kart.appendChild(sliderSatiri(IK_MUSIQI, "Musiqi", "__musiqiSeviyyesi", window.__musiqiSeviyyesi, "musiqi"));
  // 3) Bloklanmış oyunçular
  kart.appendChild(dokunSatiri(IK_BLOK, "Bloklanmış oyunçular", "bloklanmis"));
  // 4) Adminə mesaj yaz
  kart.appendChild(dokunSatiri(IK_ADMIN, "Adminə mesaj yaz", "admin-mesaj"));

  overlay.appendChild(kart);
  document.body.appendChild(overlay);

  function ac() { overlay.style.display = "flex"; }
  function bagla() { overlay.style.display = "none"; }

  ayarBtn.onclick = (e) => { e.stopPropagation(); ac(); };
  baglaBtn.onclick = bagla;
  overlay.addEventListener("click", (e) => { if (e.target === overlay) bagla(); });
})();
// ===== Ramka düyməsi (# yerinə) =====
(function ramkaQur() {
  if (document.getElementById("ramkaBtn")) return;
  const panel = document.getElementById("ustPanel") || document.getElementById("cixisBtn").parentNode;

  // Köhnə "#-" düyməsini götür
  Array.from(panel.children).forEach((el) => {
    if ((el.textContent || "").trim().startsWith("#")) el.remove();
  });

  const btn = document.createElement("button");
  btn.id = "ramkaBtn";
  btn.type = "button";
  btn.className = "ub";
  btn.style.left = "45.2vw";
  btn.innerHTML =
    '<svg viewBox="0 0 24 24">' +
    '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
    '<rect x="7.5" y="7.5" width="9" height="9" rx="1"/></svg>';
  panel.appendChild(btn);

  btn.onclick = (e) => {
    e.stopPropagation();
    document.dispatchEvent(new CustomEvent("ramka-ac"));
  };
})();
