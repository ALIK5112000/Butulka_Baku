import { rtdb, fsdb } from "../core/firebase.js";
import { MASA_NOMRESI } from "../core/config.js";
import { cariOyuncu, cinsTap, vipMi, adRengi, toast } from "./yardimci.js";
import { tanisYaz } from "./dostlar.js";
import { topMu, topDeyis, TOP_RENG } from "./top-oyuncular.js";
import { ref, push, get, remove, update, query, limitToLast, limitToFirst, onChildAdded, onChildChanged, onValue, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// Masaya yeni girən oyunçu çatın yalnız son bu qədər mesajını görür
const SON_MESAJ_SAYI = 10;

const NOTA_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#f5a21b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5.5l11-2V16"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>';

const OX_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#7cc92f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6l6 6-6 6M12 6l6 6-6 6"/></svg>';

// Təpik sətirləri üçün ikonlar (hamısı SVG, şəkil faylı lazım deyil)
const BOT_SVG = '<svg viewBox="0 0 64 48"><path d="M10 36V29Q10 23 17 23L30 25Q38 26 40 18V6H58V36Z" fill="#f7b928" stroke="#e59a12" stroke-width="2" stroke-linejoin="round"/><rect x="7" y="34" width="54" height="8" rx="3" fill="#7a3f1a"/><circle cx="19" cy="29.500" r="1.800" fill="#7a3f1a"/><circle cx="26" cy="30.500" r="1.800" fill="#7a3f1a"/><path d="M44 10V30" stroke="#fff3b0" stroke-width="2.500" stroke-linecap="round" opacity=".7"/></svg>';
const KAPI_SVG = '<svg viewBox="0 0 44 44"><rect x="5" y="4" width="20" height="36" rx="3" fill="#ee4d2d"/><circle cx="11" cy="22" r="2" fill="#fff"/><path d="M25 10l12 5v22l-12 3z" fill="#c9a0c0"/><path d="M22 24l5 5 11-13" fill="none" stroke="#f7b733" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const QALXAN_SVG = '<svg viewBox="0 0 40 46"><path d="M20 2l16 5v14c0 11-7 19-16 23C11 40 4 32 4 21V7z" fill="#f4a31f"/><path d="M20 6l12 4v11c0 8.5-5 15-12 18-7-3-12-9.5-12-18V10z" fill="#e8483a"/><path d="M20 13l2.6 5.4 5.9.8-4.3 4.1 1 5.9L20 26.4l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" fill="#ffc93d"/></svg>';
const QALXAN_YASIL_SVG = '<svg viewBox="0 0 40 46"><path d="M20 4l14 4.5v12c0 9.5-6 16.5-14 20C12 37 6 30 6 20.5v-12z" fill="none" stroke="#7bc043" stroke-width="3.5" stroke-linejoin="round"/><path d="M20 13l2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.6-4.8 2.6 1-5.4-4-3.8 5.4-.7z" fill="#7bc043"/></svg>';

const cari = cariOyuncu();
const yol = `masalar/${MASA_NOMRESI}/chat`;
const qutu = document.getElementById("mesajlar");
const inp = document.getElementById("mesajInput");
const panel = document.getElementById("smayPanel");
let men = null;
// Çatda görünən oyunçuların adı → ID-si (kiminsə adına vurub yazanda həmin oyunçunu tanımaq üçün)
const adUid = new Map();
if (cari && cari.docId && cari.username) adUid.set(cari.username, cari.docId);

// Çatda ad rəngi: TOP-10 da olan oyunçunun adı TOP lentinin sarı tonunda, qalanlar əvvəlki kimi
const adRengiTop = (uid, cins, vip) => (topMu(uid) ? TOP_RENG : adRengi(cins, vip));
// TOP siyahısı dəyişəndə çatda artıq yazılmış mesajların ad rəngləri də avtomatik yenilənir
topDeyis(() => {
  qutu.querySelectorAll(".mad[data-uid]").forEach((el) => {
    el.style.color = adRengiTop(el.dataset.uid, el.dataset.cins, el.dataset.vip === "1");
  });
});

// Mesaj kiminsə adına yazılıbsa ("Ad, ..." ilə başlayırsa) həmin oyunçunun ID-sini qaytarır, yoxsa null
function mesajHedefi(m) {
  if (m.hedefUid) return m.hedefUid;
  const metn = String(m.metn || "");
  let tapilan = null, uzun = 0;
  for (const [ad, uid] of adUid) {
    if (uid !== m.uid && ad.length > uzun && metn.startsWith(ad + ",")) { tapilan = uid; uzun = ad.length; }
  }
  return tapilan;
}

// Yazı xanasına "Ad, " əlavə edir (həmin oyunçuya müraciət).
// Çatda ada toxunanda da, profil kartındakı mavi məktub düyməsində də bu işləyir.
function hedefeYaz(ad, uid) {
  if (!ad) return;
  if (uid) adUid.set(ad, uid); // oyunçu hələ çatda yazmasa belə mesajın kimə getdiyi bilinsin
  const mur = ad + ", ";
  if (!inp.value.startsWith(mur)) inp.value = mur + inp.value;
  inp.focus();
}
window.CatHedef = hedefeYaz;

// Kimsə mənim adıma vurub mənə yazanda çalınan səs (sesler/mesaj.mp3)
const mesajSesi = new Audio("sesler/mesaj.mp3");
mesajSesi.preload = "auto";
let sesHazir = false;
function sesHazirla() {
  if (sesHazir) return;
  sesHazir = true;
  mesajSesi.muted = true;
  mesajSesi.play().then(() => { mesajSesi.pause(); mesajSesi.currentTime = 0; mesajSesi.muted = false; }).catch(() => { mesajSesi.muted = false; sesHazir = false; });
}
// Brauzer icazəsi üçün ilk toxunuşda səs "hazırlanır" (raund.js-dəki növbə səsi kimi)
["pointerdown", "touchend", "click"].forEach((o) => document.addEventListener(o, sesHazirla, { passive: true }));
function mesajSesiCal() {
  try {
    mesajSesi.currentTime = 0;
    const p = mesajSesi.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {}
}
// Çatın ilk yüklənməsi bitənə qədər (köhnə mesajlar gələndə) səs çalınmır
let catYuklendi = false;

if (cari && cari.docId) {
  onSnapshot(doc(fsdb, "users", cari.docId), (s) => {
    men = s.data();
    if (men && men.username) adUid.set(men.username, cari.docId);
    if (men && men.banned) {
      alert("Admin tərəfindən ban olunmusunuz!");
      localStorage.removeItem("currentUser");
      location.href = "index.html";
    }
  });
}

// Bütün oyuna məcburi yeniləmə (Force Reload) dinləyicisi
let ilkYenilemeYuklendi = false;
onValue(ref(rtdb, "sistem/yenileme"), (s) => {
  if (!ilkYenilemeYuklendi) {
    ilkYenilemeYuklendi = true;
    return;
  }
  if (s.exists()) {
    location.replace("oyun.html?masa=" + MASA_NOMRESI + "&v=" + Date.now());
  }
});

// Admin tərəfindən masadan atılma (Kick) dinləyicisi
if (cari && cari.docId) {
  onValue(ref(rtdb, `sistem/kick/${cari.docId}`), (s) => {
    if (s.exists() && s.val() > Date.now() - 10000) {
      alert("Admin tərəfindən masadan çıxarıldınız!");
      location.href = "profil.html";
    }
  });
}

const sekiller = {};
function sekil(uid) {
  if (!sekiller[uid]) sekiller[uid] = getDoc(doc(fsdb, "users", uid)).then((s) => (s.data() || {}).avatar || "").catch(() => "");
  return sekiller[uid];
}

// Şəkil: toxunanda həmin oyunçunun profil kartı açılır (öz şəklin olsa öz kartın)
function fotoVer(f, uid) {
  f.style.backgroundImage = 'url("images/avatar/nophoto.svg")';
  if (uid) {
    f.dataset.uid = uid;
    f.style.cursor = "pointer";
    f.onclick = () => { if (window.ProfilKart) window.ProfilKart.ac(uid); };
    sekil(uid).then((u) => { if (u) f.style.backgroundImage = `url("${String(u).replace(/"/g, "%22")}")`; });
  }
}

// ---- Musiqi qoşana +9 xal: qoşma bildirişi gələndə (yalnız təzə bildirişə, bir dəfə) ----
const PUSH_CHARS = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
function pushVaxti(key) {
  let t = 0;
  for (let i = 0; i < 8; i++) t = t * 64 + PUSH_CHARS.indexOf(key.charAt(i));
  return t;
}
let serverOffset = 0;
onValue(ref(rtdb, ".info/serverTimeOffset"), (x) => { serverOffset = x.val() || 0; });

function musiqiXalVer(key) {
  if (!cari || !cari.docId || !window.Xallar) return;
  if (Date.now() + serverOffset - pushVaxti(key) > 30000) return; // köhnə bildiriş (səhifə yenilənəndə təkrar oxunur)
  let list = [];
  try { list = JSON.parse(localStorage.getItem("xalMusiqi") || "[]"); } catch (e) {}
  if (list.includes(key)) return;
  list.push(key);
  localStorage.setItem("xalMusiqi", JSON.stringify(list.slice(-50)));
  window.Xallar.musiqiQosdu(cari.docId);
  toast("+9 musiqi xalı");
}

// Klip bildirişi sətri: [qoşanın şəkli] ♫ ad  (kiminsə adına olsa:  » [onun şəkli])
const musiqiSatirlari = {};
function musiqiSatiri(m) {
  const d = document.createElement("div");
  d.className = "mesaj";
  const f = document.createElement("div");
  f.className = "mfoto";
  fotoVer(f, m.uid);
  const g = document.createElement("div");
  g.className = "klip-musiqi";
  // Sətir həmişə bir qatda qalır (CSS keşdə qalsa və ya başqa qayda üstün gəlsə də işləsin deyə birbaşa yazılır)
  g.style.cssText = "display:flex!important;flex-wrap:nowrap!important;align-items:center!important;min-width:0!important;max-width:80vw!important;";
  g.innerHTML = NOTA_SVG;
  const ks = document.createElement("span");
  ks.textContent = m.metn;
  // Klipin adı uzundursa soldan başlayır, sığan qədəri görünür, qalanı "…" ilə kəsilir
  ks.style.cssText = "flex:0 1 auto!important;min-width:0!important;overflow:hidden!important;white-space:nowrap!important;text-overflow:ellipsis!important;word-break:normal!important;";
  g.appendChild(ks);
  if (m.hedef) {
    const ox = document.createElement("span");
    ox.className = "klip-ox";
    ox.style.cssText = "flex:none!important;";
    ox.innerHTML = OX_SVG;
    const f2 = document.createElement("div");
    f2.className = "mfoto";
    f2.style.cssText = "flex:none!important;";
    fotoVer(f2, m.hedef);
    g.append(ox, f2);
  }
  d.append(f, g);
  return d;
}

// ---- Təpik sətirləri (tepik-baglanti.js chat yoluna isTepikNotice kimi yazır) ----
//  vur : [vuran] təpik » [vurulan] (yaşıl qalxan düyməsi: bonusla qorumaq)
//  at  : [atan] qapı » [atılan]     (təpiklə masadan çıxarıldı)
//  qoru: [qoruyan] qalxan » [qorunan]
function tepikSatiri(m) {
  const d = document.createElement("div");
  d.className = "mesaj";
  const f = document.createElement("div");
  f.className = "mfoto";
  fotoVer(f, m.uid);

  const g = document.createElement("div");
  g.className = "tepik-sat";
  g.style.cssText = "display:flex;flex-wrap:nowrap;align-items:center;gap:2.4vw;min-width:0;max-width:80vw;min-height:7.8vw;";

  // İkon qutusu: ölçü aşağıda şəklin (.mfoto) eninə görə qurulur
  const ik = document.createElement("div");
  ik.style.cssText = "flex:none;display:flex;align-items:center;justify-content:center;";
  ik.innerHTML = m.tip === "vur" ? BOT_SVG : m.tip === "at" ? KAPI_SVG : QALXAN_SVG;

  const ox = document.createElement("span");
  ox.style.cssText = "flex:none;display:flex;align-items:center;";
  ox.innerHTML = OX_SVG;

  const f2 = document.createElement("div");
  f2.className = "mfoto";
  f2.style.cssText = "flex:none!important;";
  fotoVer(f2, m.hedef);

  g.append(ik, ox, f2);

  let btn = null, un = null, tm = null;
  if (m.tip === "vur") {
    btn = document.createElement("button");
    btn.type = "button";
    btn.innerHTML = QALXAN_YASIL_SVG;
    btn.style.cssText = "flex:none;border:0;padding:0;margin-left:1vw;display:flex;align-items:center;justify-content:center;background:#e3efd2;opacity:.4;touch-action:manipulation;";
    btn.onclick = () => {
      if (btn.dataset.aktiv === "1" && window.TepikVur) window.TepikVur.qoru(m.hedef);
    };
    g.appendChild(btn);
    // Düymə yalnız bu təpik hələ qüvvədədirsə (qorunmayıb, 30 saniyə bitməyib) aktivdir
    const bit = () => {
      btn.dataset.aktiv = "0";
      btn.style.opacity = ".4";
      clearTimeout(tm);
      if (un) { un(); un = null; }
    };
    un = onValue(ref(rtdb, "tepik/" + m.hedef), (s) => {
      const v = s.val(), n = Date.now() + serverOffset;
      if (v && m.baslama && v.baslama === m.baslama && !v.xilas && v.terkVaxti > n) {
        btn.dataset.aktiv = "1";
        btn.style.opacity = "1";
        clearTimeout(tm);
        tm = setTimeout(bit, v.terkVaxti - n);
      } else bit();
    });
  }

  d.append(f, g);

  // Ölçülər: şəkil (.mfoto) nə qədərdirsə ona görə (sətir yerləşdirildikdən sonra)
  d._olcu = () => {
    const w = f.offsetWidth || 40;
    const ikW = Math.round(w * 0.85);
    ik.style.width = ik.style.height = ikW + "px";
    const svg = ik.querySelector("svg");
    if (svg) { svg.style.width = "100%"; svg.style.height = "100%"; }
    const oxs = ox.querySelector("svg");
    if (oxs) { oxs.style.width = Math.round(w * 0.42) + "px"; oxs.style.height = Math.round(w * 0.42) + "px"; }
    if (btn) {
      btn.style.width = Math.round(w * 0.95) + "px";
      btn.style.height = Math.round(w * 0.75) + "px";
      btn.style.borderRadius = Math.round(w * 0.4) + "px";
      const bs = btn.querySelector("svg");
      if (bs) { bs.style.width = Math.round(w * 0.42) + "px"; bs.style.height = Math.round(w * 0.48) + "px"; }
    }
  };
  return d;
}

// Mesaja sonradan "hedef" əlavə olunanda (kiminsə adına qoşulduqda) həmin sətir yenilənir
onChildChanged(query(ref(rtdb, yol), limitToLast(SON_MESAJ_SAYI)), (s) => {
  const m = s.val(), köhnə = musiqiSatirlari[s.key];
  if (!m || !m.isMusicNotice || !köhnə || !köhnə.isConnected) return;
  const yeni = musiqiSatiri(m);
  köhnə.replaceWith(yeni);
  musiqiSatirlari[s.key] = yeni;
});

onChildAdded(query(ref(rtdb, yol), limitToLast(SON_MESAJ_SAYI)), (s) => {
  const m = s.val();
  if (!m) return;
  const d = document.createElement("div");
  d.className = "mesaj";

  // Təpik bildirişi (bütün masada görünür): vurdu / masadan atıldı / qorudu
  if (m.isTepikNotice) {
    const sat = tepikSatiri(m);
    qutu.appendChild(sat);
    sat._olcu();
    while (qutu.children.length > 60) qutu.removeChild(qutu.firstChild);
    qutu.scrollTop = qutu.scrollHeight;
    requestAnimationFrame(() => { sat._olcu(); qutu.scrollTop = qutu.scrollHeight; });
    return;
  }

  // Klip qoşulma bildirişi (bütün masada görünür): qoşan oyunçunun şəkli + klipin adı (+ kimin adına olduğu)
  if (m.isMusicNotice) {
    window.__sonDJ = { uid: m.uid, key: s.key }; // hədiyyə xalı üçün: son musiqini kim qoşub
    if (cari && m.uid === cari.docId) {
      musiqiXalVer(s.key);
      // Kiminsə adına qoşulubsa və bildirişdə hələ yoxdursa, əlavə et (klip.js dəyişməsə də işləyir)
      if (!m.hedef && window.__klipHedef && Date.now() + serverOffset - pushVaxti(s.key) <= 30000) {
        update(ref(rtdb, yol + "/" + s.key), { hedef: window.__klipHedef }).catch(() => {});
      }
    }
    const sat = musiqiSatiri(m);
    musiqiSatirlari[s.key] = sat;
    qutu.appendChild(sat);
    while (qutu.children.length > 60) qutu.removeChild(qutu.firstChild);
    qutu.scrollTop = qutu.scrollHeight;
    return;
  }

  // Məftun bildirişi: kim kimə məftun oldu / kim tərk etdi
  if (m.isMeftunNotice) {
    const f = document.createElement("div");
    f.className = "mfoto";
    fotoVer(f, m.uid);
    const g = document.createElement("div");
    g.className = "mgovde klip-bildiris";
    g.style.cssText = "background:#fff0f6;border-color:#f06aa8;";
    g.textContent = m.metn;
    d.append(f, g);
    qutu.appendChild(d);
    while (qutu.children.length > 60) qutu.removeChild(qutu.firstChild);
    qutu.scrollTop = qutu.scrollHeight;
    return;
  }

  // Profilsiz "Admin" elanı və ya qovulma bildirişi:
  if (m.isAdminBroadcast) {
    const yazilanSoz = m.metn || m.text || m.mesaj || "";
    const g = document.createElement("div");
    g.className = "mgovde";
    g.style.cssText = "background:#fffbeb; border:1.5px solid #f59e0b; border-radius:12px; padding:7px 12px; width:100%;";
    const a = document.createElement("span");
    a.className = "mad";
    a.style.cssText = "color:#dc2626; font-weight:800;";
    a.textContent = "🛡️ Admin: ";
    const t = document.createElement("span");
    t.style.cssText = "color:#111827; font-weight:700;";
    t.textContent = yazilanSoz;
    g.append(a, t);
    d.append(g);
    qutu.appendChild(d);
    while (qutu.children.length > 60) qutu.removeChild(qutu.firstChild);
    qutu.scrollTop = qutu.scrollHeight;
    return;
  }

  const f = document.createElement("div");
  f.className = "mfoto";
  fotoVer(f, m.uid);
  const g = document.createElement("div");
  if (m.ad && m.uid) adUid.set(m.ad, m.uid);
  // Kiminsə adına vurub yazılıbsa və bu yazışmada mən varamsa (mən yazmışam və ya mənə yazılıb):
  // mesaj qalın qara yazı ilə görünür. Başqalarının öz aralarındakı yazışması sadə qalır.
  const hed = mesajHedefi(m);
  const menimle = !!(cari && cari.docId && hed && (m.uid === cari.docId || hed === cari.docId));
  // Mənə yazılan təzə mesaj (başqasından, köhnə tarixçə deyil) → səs dərhal çalınır
  if (catYuklendi && cari && cari.docId && hed === cari.docId && m.uid !== cari.docId && Date.now() + serverOffset - pushVaxti(s.key) <= 30000) mesajSesiCal();
  g.className = "mgovde mkart" + (m.cins === "q" ? " qiz" : "") + (menimle ? " mene" : "");
  const a = document.createElement("span");
  a.className = "mad";
  // Ad rəngi: TOP-10 oyunçularda sarı (TOP lentinin tonu). data-* sonradan TOP dəyişəndə rəngi yeniləmək üçündür
  a.dataset.uid = m.uid || "";
  a.dataset.cins = m.cins || "";
  a.dataset.vip = m.vip ? "1" : "";
  a.style.color = adRengiTop(m.uid, m.cins, m.vip);
  a.textContent = (m.vip ? "👑 " : "") + m.ad + ": ";
  // Ada toxunanda yazı xanasına "Ad, " əlavə olunur (həmin oyunçuya müraciət üçün)
  if (!cari || m.uid !== cari.docId) {
    a.style.cursor = "pointer";
    a.onclick = () => hedefeYaz(m.ad, m.uid);
  }
  const t = document.createElement("span");
  t.textContent = m.metn;
  // Hər mesajın altında "Tərcüməni göstər" sətri (hələlik yalnız yazı)
  const tr = document.createElement("span");
  tr.className = "mtercume";
  tr.textContent = "Tərcüməni göstər";
  g.append(a, t, tr);
  d.append(f, g);
  qutu.appendChild(d);
  while (qutu.children.length > 60) qutu.removeChild(qutu.firstChild);
  qutu.scrollTop = qutu.scrollHeight;
});

// Çatın ilk yükü (son mesajlar) gəlib bitəndən sonra gələn mesajlar "təzə" sayılır
onValue(query(ref(rtdb, yol), limitToLast(SON_MESAJ_SAYI)), () => { catYuklendi = true; }, { onlyOnce: true });

function gonder() {
  const metn = inp.value.trim();
  tanisYaz(metn, cari.docId);
  if (!metn || !men) return;

  if (men.mutedUntil && Number(men.mutedUntil) > Date.now()) {
    toast("Admin tərəfindən chatda susdurulmusunuz");
    return;
  }

  if (!vipMi(men) && /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(metn)) {
    toast("Smaylik göndərmək yalnız VIP üçündür");
    return;
  }
  inp.value = "";
  const mesaj = {
    uid: cari.docId,
    ad: men.username,
    vip: vipMi(men),
    cins: cinsTap(men.gender),
    metn: metn.slice(0, 300),
    vaxt: serverTimestamp()
  };
  // Kiminsə adına vurub yazılıbsa ("Ad, ..." ilə başlayırsa) həmin oyunçunun ID-si də mesaja yazılır
  const hedefUid = mesajHedefi(mesaj);
  if (hedefUid) mesaj.hedefUid = hedefUid;
  push(ref(rtdb, yol), mesaj);
}
document.getElementById("gonderBtn").onclick = gonder;
inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); gonder(); } });

"😀 😂 😍 😘 😎 🥰 😉 😢 😡 👍 🙏 🔥 ❤️ 💋 🍾 🎁".split(" ").forEach((e) => {
  const s = document.createElement("span");
  s.textContent = e;
  s.onclick = () => {
    if (!vipMi(men)) { toast("Smaylik göndərmək yalnız VIP üçündür"); return; }
    inp.value += e;
    inp.focus();
  };
  panel.appendChild(s);
});
document.getElementById("smayBtn").onclick = () => panel.classList.toggle("ac");

onValue(query(ref(rtdb, yol), limitToFirst(1)), (s) => { if (!s.exists()) qutu.innerHTML = ""; });

// Masa boşdursa (özümdən başqa oturan oyunçu yoxdursa) köhnə çat avtomatik silinir.
// (Hamı çıxanda çatda heç kim qalmır, ona görə təmizləmə növbəti girişdə edilir; nəticə eynidir.)
if (cari && cari.docId) {
  get(ref(rtdb, `masalar/${MASA_NOMRESI}/oturacaqlar`)).then((s) => {
    const v = s.val() || {};
    const baskasi = Object.values(v).some((o) => o && o.uid && o.uid !== cari.docId);
    if (!baskasi) remove(ref(rtdb, yol)).catch(() => {});
  }).catch(() => {});
}
