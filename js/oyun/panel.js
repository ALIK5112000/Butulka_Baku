import { fsdb, rtdb } from "../core/firebase.js";
import { MASA_NOMRESI } from "../core/config.js";
import { cariOyuncu } from "./yardimci.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ref, onValue, remove } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import "./ramka-shop.js";
import "./reytinq.js";
import "./butulka.js";

const cari = cariOyuncu();

/* ===== SƏS İDARƏSİ (yalnız bu oyunçunun cihazında işləyir, başqalarına təsir etmir) =====
   "Səslər" slideri: chat, hədiyyə və digər oyun səsləri.
   "Musiqi" slideri: klip və mahnı səsləri (video elementləri, adında klip/mahni/musiqi olan audio, YouTube pleyeri).
   Bütün <audio>/<video> elementlərinin səsi (volume) bu iki slayderə görə avtomatik azaldılır/artırılır,
   başqa fayllarda dəyişiklik lazım deyil. Slayder 100 = kodun qoyduğu orijinal səs, 0 = səssiz. */
(function sesIdaresi() {
  if (window.__sesIdare) return;
  window.__sesIdare = true;

  const oxuS = (acar, ilk) => {
    try { const v = localStorage.getItem(acar); return v === null ? ilk : Number(v); } catch (e) { return ilk; }
  };
  if (typeof window.__sesSeviyyesi !== "number") window.__sesSeviyyesi = oxuS("sesSeviyyesi", 100);
  if (typeof window.__musiqiSeviyyesi !== "number") window.__musiqiSeviyyesi = oxuS("musiqiSeviyyesi", 100);

  // 0..1 arası vurma əmsalı
  const faktor = (tip) => {
    let v = Number(tip === "musiqi" ? window.__musiqiSeviyyesi : window.__sesSeviyyesi);
    if (!isFinite(v)) v = 100;
    return Math.max(0, Math.min(1, v / 100));
  };

  // Element musiqidirmi (klip/mahnı), yoxsa adi səsdir (chat, hədiyyə)
  const tipTap = (el) => {
    if (el.dataset && el.dataset.ses) return el.dataset.ses === "musiqi" ? "musiqi" : "ses";
    if (el.tagName === "VIDEO") return "musiqi";
    const s = String(el.currentSrc || el.src || "").toLowerCase();
    if (/klip|mahni|musiq|music|song|youtube|googlevideo/.test(s)) return "musiqi";
    return "ses";
  };

  const vd = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "volume");
  const izlenen = new Set();

  function budama() {
    if (izlenen.size < 200) return;
    izlenen.forEach((el) => { if (!el.isConnected && el.paused) izlenen.delete(el); });
  }

  function tetbiq(el) {
    if (!vd || !vd.get || !vd.set) return;
    if (el.__bv === undefined) el.__bv = vd.get.call(el);          // kodun qoyduğu orijinal səs
    const son = Math.max(0, Math.min(1, el.__bv * faktor(tipTap(el))));
    try { vd.set.call(el, son); } catch (e) {}
  }

  if (vd && vd.get && vd.set) {
    // Kod audio.volume = X yazanda X yadda qalır, real səs slayderə vurulub qoyulur
    Object.defineProperty(HTMLMediaElement.prototype, "volume", {
      configurable: true,
      enumerable: vd.enumerable,
      get() { return this.__bv === undefined ? vd.get.call(this) : this.__bv; },
      set(v) {
        const n = Number(v);
        this.__bv = isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
        izlenen.add(this);
        tetbiq(this);
      }
    });

    // Hər play() zamanı cari slayder səviyyəsi tətbiq olunur
    const op = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      budama();
      izlenen.add(this);
      tetbiq(this);
      return op.apply(this, arguments);
    };

    // play() çağırılmadan (autoplay) başlayanlar üçün
    document.addEventListener("play", (e) => {
      if (e.target instanceof HTMLMediaElement) { izlenen.add(e.target); tetbiq(e.target); }
    }, true);
  }

  // Web Audio ilə çalınan səslər (adi səs sayılır): ümumi səs düyməsi
  const wactx = new Set();
  try {
    const BC = window.BaseAudioContext || window.AudioContext || window.webkitAudioContext;
    const dd = BC && Object.getOwnPropertyDescriptor(BC.prototype, "destination");
    if (dd && dd.get) {
      Object.defineProperty(BC.prototype, "destination", {
        configurable: true,
        enumerable: dd.enumerable,
        get() {
          if (!this.__sesG) {
            const real = dd.get.call(this);
            const g = this.createGain();
            g.gain.value = faktor("ses");
            g.connect(real);
            this.__sesG = g;
            wactx.add(this);
          }
          return this.__sesG;
        }
      });
    }
  } catch (e) {}

  // YouTube klipləri (enablejsapi=1 olan iframe-lər üçün)
  function ytSes() {
    const v = Math.round(faktor("musiqi") * 100);
    document.querySelectorAll('iframe[src*="youtube"]').forEach((f) => {
      try { f.contentWindow.postMessage(JSON.stringify({ event: "command", func: "setVolume", args: [v] }), "*"); } catch (e) {}
    });
  }

  function hamisiniYenile() {
    document.querySelectorAll("audio,video").forEach((el) => { izlenen.add(el); tetbiq(el); });
    izlenen.forEach((el) => tetbiq(el));
    wactx.forEach((c) => { try { if (c.__sesG) c.__sesG.gain.value = faktor("ses"); } catch (e) {} });
    ytSes();
  }

  // Slayder dəyişəndə (ayarQur "ses-deyisdi" göndərir) hər şey dərhal yenilənir
  document.addEventListener("ses-deyisdi", hamisiniYenile);
  // Yeni yaranan elementlər və iframe-lər üçün arabir yoxlama
  setInterval(hamisiniYenile, 3000);
})();

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

  // Köhnə ayarlar düyməsi varsa onu istifadə edirik (id: ayarBtn), yoxsa yenisini yaradırıq
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

  // Səs səviyyələri (yadda qalır; hər oyunçunun öz cihazında)
  function oxu(acar, ilk) {
    try { const v = localStorage.getItem(acar); return v === null ? ilk : Number(v); } catch (e) { return ilk; }
  }
  window.__sesSeviyyesi = oxu("sesSeviyyesi", 100);        // chat + hədiyyə səsləri (0-100)
  window.__musiqiSeviyyesi = oxu("musiqiSeviyyesi", 100);  // musiqi + klip səsləri (0-100)

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
      // sesIdaresi bu hadisəni dinləyir və səsləri dərhal yeniləyir
      document.dispatchEvent(new CustomEvent("ses-deyisdi", { detail: { tip: hadise, deyer: v } }));
    });
    return row;
  }

  // isle verilibsə: pəncərə bağlanır və həmin funksiya işləyir (məs. Bloklanmış oyunçular pəncərəsi);
  // verilməyibsə əvvəlki kimi "ayar-sec" hadisəsi göndərilir
  function dokunSatiri(ikon, ad, key, isle) {
    const row = document.createElement("div");
    row.style.cssText = SATIR + "cursor:pointer;";
    row.innerHTML = '<span style="' + IKON + '">' + ikon + "</span><span style=\"flex:1;\">" + ad + "</span>";
    row.onclick = () => {
      bagla();
      if (isle) isle();
      else document.dispatchEvent(new CustomEvent("ayar-sec", { detail: key }));
    };
    return row;
  }

  // 1) Səslər: chat və hədiyyə səsləri
  kart.appendChild(sliderSatiri(IK_SES, "Səslər", "__sesSeviyyesi", window.__sesSeviyyesi, "ses"));
  // 2) Musiqi: musiqi və klip səsləri
  kart.appendChild(sliderSatiri(IK_MUSIQI, "Musiqi", "__musiqiSeviyyesi", window.__musiqiSeviyyesi, "musiqi"));
  // 3) Bloklanmış oyunçular
  kart.appendChild(dokunSatiri(IK_BLOK, "Bloklanmış oyunçular", "bloklanmis", blokAc));
  // 4) Adminə mesaj yaz
  kart.appendChild(dokunSatiri(IK_ADMIN, "Adminə mesaj yaz", "admin-mesaj"));

  overlay.appendChild(kart);
  document.body.appendChild(overlay);

  function ac() { overlay.style.display = "flex"; }
  function bagla() { overlay.style.display = "none"; }

  ayarBtn.onclick = (e) => { e.stopPropagation(); ac(); };
  baglaBtn.onclick = bagla;
  overlay.addEventListener("click", (e) => { if (e.target === overlay) bagla(); });

  // Səhifə açılan kimi yadda qalan səviyyələr tətbiq olunur
  document.dispatchEvent(new CustomEvent("ses-deyisdi", { detail: { tip: "hamisi", deyer: null } }));

  // ===== Bloklanmış oyunçular pəncərəsi: blok siyahısı, şəkil və ad real vaxtla yenilənir =====
  function blokAc() {
    if (!cari || !cari.docId) return;
    const MEN = cari.docId;
    const NOFOTO = "images/avatar/nophoto.svg";
    const abunelik = [];          // bütün dinləyicilərin söndürmə funksiyaları
    const satirlar = new Map();   // uid -> { el, un }

    const ov = document.createElement("div");
    ov.style.cssText =
      "position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.45);display:flex;align-items:center;" +
      "justify-content:center;font-family:Roboto,Arial,sans-serif;";

    const kt = document.createElement("div");
    kt.style.cssText =
      "position:relative;width:91.7vw;max-height:80vh;box-sizing:border-box;background:#fff;border-radius:6vw;" +
      "padding:4.5vw 4.2vw 3.5vw;box-shadow:0 1vw 5vw rgba(0,0,0,.3);display:flex;flex-direction:column;";

    // Başlıq: ikon + ad + sağda X
    const bas = document.createElement("div");
    bas.style.cssText = "display:flex;align-items:center;justify-content:space-between;";
    const sol = document.createElement("div");
    sol.style.cssText = "display:flex;align-items:center;gap:2vw;";
    const ik = document.createElement("span");
    ik.style.cssText = "width:7.6vw;height:7.6vw;flex:none;display:flex;";
    ik.innerHTML = IK_BLOK;
    const bd = document.createElement("span");
    bd.textContent = "Bloklanmış oyunçular";
    bd.style.cssText = "font-size:6.6vw;font-weight:700;color:#111;";
    sol.append(ik, bd);
    const x = document.createElement("button");
    x.type = "button";
    x.style.cssText = "width:10vw;height:10vw;border:0;background:none;padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer;";
    x.innerHTML =
      '<svg viewBox="0 0 24 24" width="80%" height="80%" fill="none" stroke="#777" stroke-width="1.6" stroke-linecap="round">' +
      '<line x1="4" y1="4" x2="20" y2="20"/><line x1="20" y1="4" x2="4" y2="20"/></svg>';
    bas.append(sol, x);

    const izah = document.createElement("div");
    izah.textContent =
      "Blokladığın oyunçu ilə bir-birinizin mesajlarını, masadakı şəklini və \"Masanı dəyiş\" lentində bir-birinizi görmürsünüz. " +
      "Bloklamaq üçün oyunçunun profilində \"!\" düyməsinə bas.";
    izah.style.cssText = "margin-top:2.4vw;font-size:4.3vw;line-height:1.45;color:#777;";

    const siyahi = document.createElement("div");
    siyahi.style.cssText = "margin-top:4.5vw;overflow-y:auto;min-height:0;";

    const bos = document.createElement("div");
    bos.textContent = "Bloklanmış oyunçu yoxdur";
    bos.style.cssText = "text-align:center;color:#aaa;font-size:4.4vw;padding:6vw 0;";
    siyahi.appendChild(bos);

    kt.append(bas, izah, siyahi);
    ov.appendChild(kt);
    document.body.appendChild(ov);

    function bosYoxla() { bos.style.display = satirlar.size ? "none" : "block"; }

    function satirYarat(uid) {
      const el = document.createElement("div");
      el.style.cssText = "display:flex;align-items:center;gap:4vw;padding:2.4vw 0;border-bottom:.3vw solid #ececec;";
      const av = document.createElement("div");
      av.style.cssText =
        "width:15vw;height:15vw;border-radius:50%;flex:none;background:#dfe9f1 center/cover no-repeat;" +
        "background-image:url(\"" + NOFOTO + "\");";
      const ad = document.createElement("div");
      ad.style.cssText =
        "flex:1;min-width:0;font:italic 400 5.6vw/1.2 Georgia,'Times New Roman',serif;color:#222;" +
        "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
      ad.textContent = "...";
      const dg = document.createElement("button");
      dg.type = "button";
      dg.textContent = "Blokdan çıxar";
      dg.style.cssText =
        "flex:none;border:0;background:#9acd32;color:#fff;font:700 5vw/1 Roboto,Arial,sans-serif;" +
        "padding:3vw 4.4vw;border-radius:4.4vw;cursor:pointer;";
      dg.onclick = () => {
        dg.disabled = true;
        dg.style.opacity = ".6";
        remove(ref(rtdb, "blok/" + MEN + "/" + uid)).catch(() => {
          dg.disabled = false;
          dg.style.opacity = "";
        });
      };
      el.append(av, ad, dg);

      // oyunçunun real ad və şəkli (dəyişəndə dərhal yenilənir)
      const un = onSnapshot(doc(fsdb, "users", uid), (s) => {
        const d = s.data() || {};
        ad.textContent = d.username || "Oyunçu";
        const a = d.avatar ? String(d.avatar).replace(/"/g, "%22") : NOFOTO;
        av.style.backgroundImage = 'url("' + a + '")';
      }, () => {});
      return { el, un };
    }

    // blok siyahısı real vaxtla: əlavə olunan çıxır, silinən yox olur
    abunelik.push(onValue(ref(rtdb, "blok/" + MEN), (s) => {
      const v = s.val() || {};
      const idler = Object.keys(v).filter((k) => v[k]);
      satirlar.forEach((r, uid) => {
        if (!idler.includes(uid)) { r.un(); r.el.remove(); satirlar.delete(uid); }
      });
      idler.forEach((uid) => {
        if (satirlar.has(uid)) return;
        const r = satirYarat(uid);
        satirlar.set(uid, r);
        siyahi.appendChild(r.el);
      });
      bosYoxla();
    }));

    function bagla() {
      abunelik.forEach((f) => { try { f(); } catch (e) {} });
      satirlar.forEach((r) => { try { r.un(); } catch (e) {} });
      satirlar.clear();
      ov.remove();
    }
    x.onclick = bagla;
    ov.addEventListener("click", (e) => { if (e.target === ov) bagla(); });
  }
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
