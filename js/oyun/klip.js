// Klip sistemi: masadakı hamı üçün sinxron YouTube klipi (pleyer + kart + ürək ödənişi).
// Bu masanın klipi bazada saxlanır: masalar/<masa>/aktivKlip
// Vaxt SERVER saatı ilə yazılır, ona görə hamıda eyni saniyədə oynayır və
// masadan çıxıb qayıdanda klip qaldığı yerdən (real vaxtla) davam edir.
import { rtdb, fsdb } from "../core/firebase.js";
import { MASA_NOMRESI, KLIP_QIYMETI } from "../core/config.js";
import { cariOyuncu, toast } from "./yardimci.js";
import { ref, onValue, set, push, runTransaction, serverTimestamp, get } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { doc, getDoc, updateDoc, increment, runTransaction as fsRunTransaction } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const kart = $("klipKart");
const chatYeri = $("chatYeri");
const avatar = $("klipAvatar");
const halqa = $("klipHalqaDolu");
const sesBtn = $("klipSesBtn");
const sesInp = $("klipSes");
const panel = $("musiqiPanel");
const oyunEkrani = $("oyunEkrani");
const kkDokunus = $("klipDokunus");
const kkOyna = $("kkOyna");
const kkSeek = $("kkSeek");

const ID_RE = /^[\w-]{11}$/;
const HALQA_UZUN = 2 * Math.PI * 33;
const klipRef = ref(rtdb, `masalar/${MASA_NOMRESI}/aktivKlip`);
const chatYol = `masalar/${MASA_NOMRESI}/chat`;

let offset = 0;          // server saatı ilə telefon saatı arasındakı fərq (ms)
let aktiv = null;        // indi çalan klip (bazadakı məlumat)
let oynatici = null;     // YouTube pleyeri
let oynaticiVeId = null;
let dovr = null;         // 0.5 san-lik dövr: halqa + sinxron + bitmə yoxlaması
let blokTimer = null;
let sesliGozle = false;  // brauzer səsli avtooynatmanı blokladı, ilk toxunuşu gözləyirik
let zoom = 0;
let secimAcik = false;   // klip seçim pəncərəsi açıqdır: chatdakı klipin səsi YALNIZ bu oyunçuda kəsilir
// Şəxsi idarə: oyunçu klipi özü üçün irəli-geri edə / pauza edə bilər (digər oyunçulara təsir etmir)
let serbest = false;     // real vaxtdan ayrılıb (özü irəli-geri edib və ya pauza edib)
let lokalPauza = false;  // özü pauza edib
let suruk = false;       // vaxt çubuğunu sürüşdürür
let kkTimer = null;
const YAXIN = 2.5;       // real vaxta bu qədər yaxındırsa "canlı" sayılır (saniyə)
const geriQaytarilan = new Set();

const indi = () => Date.now() + offset;
const kecen = (d) => Math.max(0, (indi() - Number(d.startedAt || indi())) / 1000);

// ---------- 30 günlük reytinq dondurma yoxlaması ("kiss" | "music" | "smile") ----------
const FREEZE_SAHELERI = {
  kiss: { freeze: "freeze_kisses", saved: "saved_kisses", stat: "kisses" },
  music: { freeze: "freeze_music", saved: "saved_music", stat: "music" },
  smile: { freeze: "freeze_smiles", saved: "saved_smiles", stat: "smiles" }
};

export async function reytingArtiraBiler(uid, tip) {
  if (!uid) return true;
  const cfg = FREEZE_SAHELERI[tip];
  if (!cfg) return true;
  try {
    const uRef = doc(fsdb, "users", uid);
    const snap = await getDoc(uRef);
    if (!snap.exists()) return true;
    const d = snap.data() || {};
    const fUntil = Number(d[cfg.freeze] || 0);
    if (fUntil <= 0) return true;

    const now = indi();
    if (now < fUntil) {
      // Hələ 30 günlük dondurma müddəti bitməyib: xal artmasın və 0 qalsın
      if (Number(d[cfg.stat] || 0) !== 0) {
        await updateDoc(uRef, { [cfg.stat]: 0 }).catch(() => {});
      }
      return false;
    }

    // 30 gün bitibsə, köhnə xalı avtomatik bərpa et
    const savedVal = Number(d[cfg.saved] || 0);
    await updateDoc(uRef, {
      [cfg.stat]: savedVal,
      [cfg.freeze]: 0,
      [cfg.saved]: 0
    }).catch(() => {});
    return true;
  } catch (e) {
    return true;
  }
}

// ---------- yeni klip üçün gözləmə: başqasının klipi başlayandan 60 saniyə keçməyibsə qoşmaq olmaz ----------
export const KLIP_BEKLE = 60;
const gozleQalan = (d) => (d ? Math.max(0, Math.ceil(KLIP_BEKLE - kecen(d))) : 0);

// ---------- səs ayarı (yadda qalır) ----------
const lsOxu = (a, v) => { try { const x = localStorage.getItem(a); return x === null ? v : x; } catch (e) { return v; } };
const lsYaz = (a, v) => { try { localStorage.setItem(a, v); } catch (e) {} };
let ses = Math.min(100, Math.max(1, Number(lsOxu("klipSes", 85)) || 85));
let sessiz = lsOxu("klipSessiz", "0") === "1";

const musiqiSeviyyesi = () => {
  const v = window.__musiqiSeviyyesi;
  return v === undefined || v === null ? 100 : Number(v);
};

function sesUI() {
  const v = sessiz ? 0 : ses;
  sesInp.value = v;
  sesInp.style.setProperty("--d", v + "%");
  sesBtn.classList.toggle("sessiz", sessiz);
}
function sesiTetbiqEt() {
  if (!oynatici || !oynatici.mute) return;
  try {
    const m = musiqiSeviyyesi();
    if (sessiz || secimAcik || m <= 0) oynatici.mute();
    else {
      oynatici.unMute();
      oynatici.setVolume(Math.max(1, Math.round(ses * m / 100)));
    }
  } catch (e) {}
}
// Klip seçim pəncərəsi açılanda chatdakı klipin səsi kəsilir, bağlananda avtomatik qayıdır (yalnız bu oyunçuda)
export function secimSesi(acik) {
  secimAcik = !!acik;
  sesiTetbiqEt();
}
sesInp.addEventListener("input", () => {
  const v = Number(sesInp.value);
  sessiz = v === 0;
  if (v > 0) ses = v;
  lsYaz("klipSes", ses); lsYaz("klipSessiz", sessiz ? "1" : "0");
  sesUI(); sesiTetbiqEt();
});
sesBtn.addEventListener("click", () => {
  sessiz = !sessiz;
  lsYaz("klipSessiz", sessiz ? "1" : "0");
  sesUI(); sesiTetbiqEt();
});
sesUI();

// ---------- ölçü: 1-ci toxunuş 1x, 2-ci 2x, 3-cü orijinala qayıt ----------
$("klipOlcuBtn").addEventListener("click", () => {
  zoom = (zoom + 1) % 3;
  kart.classList.remove("z1", "z2");
  if (zoom) kart.classList.add("z" + zoom);
});

// ---------- yardımçılar ----------
const sekiller = {};
function profilSekli(uid) {
  if (!sekiller[uid]) sekiller[uid] = getDoc(doc(fsdb, "users", uid)).then((s) => (s.data() || {}).avatar || "").catch(() => "");
  return sekiller[uid];
}

// Oyun ekranı görünənə qədər (yükləmə ekranı bitənə qədər) klip nə göstərilir, nə də səslənir
const oyunGorunur = new Promise((res) => {
  if (oyunEkrani.classList.contains("aktiv")) return res();
  const mo = new MutationObserver(() => {
    if (oyunEkrani.classList.contains("aktiv")) { mo.disconnect(); res(); }
  });
  mo.observe(oyunEkrani, { attributes: true, attributeFilter: ["class"] });
});

function halqaYaz(nisbet) {
  halqa.style.strokeDashoffset = String(HALQA_UZUN * (1 - Math.min(1, Math.max(0, nisbet))));
}

// ---------- YouTube pleyeri ----------
function ytYukle() {
  return new Promise((res) => {
    if (window.YT && window.YT.Player) return res();
    const evvel = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (typeof evvel === "function") evvel(); res(); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
}

function oynaticiAl() {
  if (!oynaticiVeId) {
    oynaticiVeId = ytYukle().then(() => new Promise((res) => {
      const p = new window.YT.Player("klipOynatici", {
        host: "https://www.youtube-nocookie.com",
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, playsinline: 1, rel: 0, origin: location.origin },
        events: {
          onReady: () => res(p),
          onStateChange: (e) => { stateDeyisdi(e.data); },
          onError: () => oynadilmadi(),
          onAutoplayBlocked: () => blok()
        }
      });
    }));
  }
  return oynaticiVeId;
}

// Brauzer səsli avtooynatmanı blokladı: səssiz başlat, ilk toxunuşda səsi aç
function blok() {
  if (!aktiv || !oynatici) return;
  try { oynatici.mute(); oynatici.playVideo(); } catch (e) {}
  sesliGozle = true;
  kart.classList.add("klik-gozle");
}
document.addEventListener("pointerdown", () => {
  if (!sesliGozle) return;
  sesliGozle = false;
  kart.classList.remove("klik-gozle");
  sesiTetbiqEt();
  try { if (oynatici && oynatici.playVideo) oynatici.playVideo(); } catch (e) {}
}, true);

// Video bu saytda oynadıla bilmir (sahibi icazə vermir və s.): klipi bağla, qoşan oyunçuya ürəyi qaytar
function oynadilmadi() {
  const d = aktiv;
  if (!d) return;
  const cari = cariOyuncu();
  if (cari && cari.docId === d.djUid && !geriQaytarilan.has(d.klipId)) {
    geriQaytarilan.add(d.klipId);
    updateDoc(doc(fsdb, "users", cari.docId), { hearts: increment(KLIP_QIYMETI) }).catch(() => {});
    if (!window.__klipSessizBildiris) {
      toast(`Bu klip oynadıla bilmədi, ${KLIP_QIYMETI} ürək geri qaytarıldı`);
    }
  }
  bitir(d);
}

// ---------- klipin başlaması / dayanması ----------
async function baslat(d) {
  aktiv = d;
  panel.classList.add("gizli");               // klip çalanda musiqi düymələri görünmür
  await oyunGorunur;
  if (aktiv !== d) return;
  serbestSifir();
  kart.hidden = false;
  chatYeri.classList.add("klip-var");        // az mesaj olanda mesajlar aşağıda durur, kartın altına düşmür
  avatar.src = "images/avatar/nophoto.svg";
  profilSekli(d.djUid).then((u) => { if (aktiv === d && u) avatar.src = u; });
  halqaYaz(0);

  const p = await oynaticiAl();
  if (aktiv !== d) return;
  oynatici = p;
  p.loadVideoById({ videoId: d.videoId, startSeconds: Math.floor(kecen(d)) });
  sesiTetbiqEt();

  clearTimeout(blokTimer);
  blokTimer = setTimeout(() => {
    if (aktiv !== d) return;
    const st = p.getPlayerState();
    if (st !== 1 && st !== 3 && st !== 0) blok();
  }, 2500);
  dovrBasla();
}

function dayandir() {
  aktiv = null;
  clearInterval(dovr);
  clearTimeout(blokTimer);
  sesliGozle = false;
  kart.classList.remove("klik-gozle");
  try { if (oynatici && oynatici.stopVideo) oynatici.stopVideo(); } catch (e) {}
  kart.hidden = true;
  chatYeri.classList.remove("klip-var");
  serbestSifir();
  panel.classList.remove("gizli");
}

function klipBitirDb(id) {
  // Yalnız həmin klip hələ də aktivdirsə sil (yeni klipi səhvən silməsin)
  return runTransaction(klipRef, (cur) => (cur && cur.klipId === id ? null : undefined)).catch(() => {});
}
function bitir(d) {
  if (aktiv && aktiv.klipId === d.klipId) dayandir();
  return klipBitirDb(d.klipId);
}

// Telefon klipi arxa plana atıb/sistem pauza edibsə və ya geri qalıbsa real vaxta çək
function senkron() {
  const p = oynatici, d = aktiv;
  if (!p || !d || document.visibilityState !== "visible") return;
  try {
    const st = p.getPlayerState();
    if (serbest) {
      // Oyunçu özü irəli-geri edib / pauza edib: real vaxta ÇƏKMİRİK. Yalnız sistem pauza edibsə davam etdir.
      if (st === 2 && !lokalPauza && !sesliGozle) p.playVideo();
      return;
    }
    const gozlenen = kecen(d);
    if (st === 0) {
      const m = muddetAl();
      if (m <= 0 || gozlenen < m - 3) { p.seekTo(gozlenen, true); p.playVideo(); }
    } else if (st === 1) {
      if (Math.abs(p.getCurrentTime() - gozlenen) > 3) p.seekTo(gozlenen, true);
    } else if (st === 2 && !sesliGozle) {
      p.seekTo(gozlenen, true);
      p.playVideo();
    }
  } catch (e) {}
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") { senkron(); setTimeout(senkron, 800); }
});

function dovrBasla() {
  clearInterval(dovr);
  let say = 0;
  dovr = setInterval(() => {
    const d = aktiv, p = oynatici;
    if (!d || !p || !p.getCurrentTime) return;
    const gozlenen = kecen(d);
    let muddet = 0;
    try { muddet = p.getDuration() || 0; } catch (e) {}
    muddet = muddet || Number(d.durationSec) || 0;
    if (muddet > 0) {
      halqaYaz(gozlenen / muddet);
      if (gozlenen >= muddet + 3) { bitir(d); return; }
    }
    if (++say % 8 === 0) senkron();
    kkYenile();
  }, 500);
}

// ---------- şəxsi idarə (pauza, ±10 san, vaxt çubuğu, Canlı) ----------
function muddetAl() {
  let m = 0;
  try { m = oynatici && oynatici.getDuration ? oynatici.getDuration() || 0 : 0; } catch (e) {}
  return m || (aktiv && Number(aktiv.durationSec)) || 0;
}
function vq(s) {
  s = Math.max(0, Math.floor(Number(s) || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), n = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(n).padStart(2, "0")}` : `${m}:${String(n).padStart(2, "0")}`;
}
function cariVaxt() {
  try { return oynatici && oynatici.getCurrentTime ? oynatici.getCurrentTime() || 0 : 0; } catch (e) { return 0; }
}
function serbestSifir() {
  serbest = false; lokalPauza = false; suruk = false;
  clearTimeout(kkTimer);
  kart.classList.remove("serbest", "kk-acik", "oynayir");
}
function serbestYaz(b) {
  serbest = b;
  kart.classList.toggle("serbest", b);
}
function kkYenile() {
  if (!aktiv || !oynatici) return;
  let st = -1;
  try { st = oynatici.getPlayerState(); } catch (e) {}
  kart.classList.toggle("oynayir", st === 1 || st === 3);
  if (!kart.classList.contains("kk-acik") || suruk) return;
  const m = muddetAl(), c = Math.min(cariVaxt(), m || Infinity);
  kkSeek.max = String(Math.max(1, Math.floor(m)));
  kkSeek.value = String(Math.floor(c));
  kkSeek.style.setProperty("--d", (m ? (c / m) * 100 : 0) + "%");
  $("kkVaxt").textContent = vq(c);
  $("kkMuddet").textContent = vq(m);
}
function kkGoster(ac) {
  clearTimeout(kkTimer);
  kart.classList.toggle("kk-acik", ac);
  if (!ac) return;
  kkYenile();
  kkTimer = setTimeout(() => { if (suruk) return kkGoster(true); kart.classList.remove("kk-acik"); }, 4500);
}
// Seek: özü üçün (başqalarına təsir etmir). Real vaxta yaxınsa yenə "canlı" sayılır.
function lokalSeek(t) {
  const p = oynatici, d = aktiv;
  if (!p || !d) return;
  const m = muddetAl();
  t = Math.max(0, m ? Math.min(t, m - 1) : t);
  try { p.seekTo(t, true); } catch (e) {}
  serbestYaz(Math.abs(t - kecen(d)) > YAXIN || lokalPauza);
  kkYenile();
}
function stateDeyisdi(st) {
  kart.classList.toggle("oynayir", st === 1 || st === 3);
  if (st !== 0 || !aktiv) return;
  // Video özü üçün bitdi. Yalnız real vaxt də bitibsə klip hamı üçün silinir;
  // özü irəli çəkibsə (serbest) başqalarının klipini bitirmir.
  const m = muddetAl();
  if (!serbest && (m <= 0 || kecen(aktiv) >= m - 5)) bitir(aktiv);
}

kkDokunus.addEventListener("click", (e) => {
  if (e.target.closest("button, input")) return;
  kkGoster(!kart.classList.contains("kk-acik"));
});
kkOyna.addEventListener("click", () => {
  const p = oynatici;
  if (!p || !aktiv) return;
  let st = -1;
  try { st = p.getPlayerState(); } catch (e) {}
  if (st === 1 || st === 3) {
    lokalPauza = true; serbestYaz(true);
    try { p.pauseVideo(); } catch (e) {}
    kart.classList.remove("oynayir");
  } else {
    lokalPauza = false;
    sesliGozle = false; kart.classList.remove("klik-gozle"); sesiTetbiqEt();
    try { p.playVideo(); } catch (e) {}
    serbestYaz(Math.abs(cariVaxt() - kecen(aktiv)) > YAXIN);
    kart.classList.add("oynayir");
  }
  kkGoster(true);
});
$("kkGeri").addEventListener("click", () => { lokalSeek(cariVaxt() - 10); kkGoster(true); });
$("kkIrali").addEventListener("click", () => { lokalSeek(cariVaxt() + 10); kkGoster(true); });
$("kkCanli").addEventListener("click", () => {
  const p = oynatici, d = aktiv;
  if (!p || !d) return;
  lokalPauza = false; serbestYaz(false);
  try { p.seekTo(kecen(d), true); p.playVideo(); } catch (e) {}
  kkGoster(true);
});
kkSeek.addEventListener("input", () => {
  suruk = true;
  const m = muddetAl(), v = Number(kkSeek.value);
  $("kkVaxt").textContent = vq(v);
  kkSeek.style.setProperty("--d", (m ? (v / m) * 100 : 0) + "%");
});
kkSeek.addEventListener("change", () => {
  suruk = false;
  lokalSeek(Number(kkSeek.value));
  kkGoster(true);
});

// ---------- klip qoşmaq (ürək çıxılır) ----------
export const klipCalirMi = () => !!aktiv;

// Seçim pəncərəsi üçün: klip çalır? mənimdir? başqasınındırsa neçə saniyə gözləmək lazımdır?
export function klipDurumu() {
  const cari = cariOyuncu();
  if (!aktiv) return { calir: false, benim: false, qalan: 0 };
  const benim = !!(cari && cari.docId === aktiv.djUid);
  return { calir: true, benim, qalan: benim ? 0 : gozleQalan(aktiv) };
}

export async function klipQos(klip, opts = {}) {
  const sessizToast = !!(opts && opts.sessizBildiris) || !!window.__klipSessizBildiris;
  const xeberVer = (msg) => { if (!sessizToast) toast(msg); };

  const cari = cariOyuncu();
  if (!cari || !cari.docId) { xeberVer("Oyunçu məlumatı tapılmadı"); return false; }
  if (!klip || !ID_RE.test(String(klip.videoId))) { xeberVer("Klip tapılmadı"); return false; }

  // Başqasının klipi başlayandan 60 saniyə keçməyibsə qoşmaq olmaz (klipi qoşan oyunçu istənilən an qoşa bilər).
  // Ürək çıxılmamışdan əvvəl bazadakı ən son məlumata baxırıq (pəncərə açıq qalarkən kimsə klip qoşmuş ola bilər).
  try {
    const t = (await get(klipRef)).val();
    if (t && ID_RE.test(String(t.videoId)) && t.djUid !== cari.docId) {
      const q = gozleQalan(t);
      if (q > 0) { xeberVer(`Yeni klip üçün ${vq(q)} gözləyin`); return false; }
    }
  } catch (e) {}

  // Hədiyyə panelindən kiminsə adına qoşulursa (Hediye.js bunu window.__klipHedef-ə yazır)
  const hedef = window.__klipHedef || null;

  const uRef = doc(fsdb, "users", cari.docId);
  let ad = "Oyunçu";
  try {
    ad = await fsRunTransaction(fsdb, async (tx) => {
      const s = await tx.get(uRef);
      if (!s.exists()) throw new Error("yox");
      const d = s.data();
      const hearts = Number(d.hearts || 0);
      if (hearts < KLIP_QIYMETI) throw new Error("az");
      tx.update(uRef, { hearts: hearts - KLIP_QIYMETI });
      return d.username || "Oyunçu";
    });
  } catch (e) {
    xeberVer(e.message === "az" ? `Klip qoşmaq üçün ${KLIP_QIYMETI} ürək lazımdır` : "Xəta baş verdi, yenidən cəhd et");
    return false;
  }

  const title = String(klip.title || "").slice(0, 120);
  try {
    await set(klipRef, {
      klipId: Date.now() + "_" + cari.docId,
      videoId: klip.videoId,
      title,
      durationSec: Number(klip.durationSec) > 0 ? Math.round(Number(klip.durationSec)) : 0,
      djUid: cari.docId,
      djAd: ad,
      startedAt: serverTimestamp()
    });
    // Chatda: qoşan oyunçunun şəkli + klipin adı (+ kiminsə adına qoşulubsa ox və onun şəkli) — bütün masa görür
    await push(ref(rtdb, chatYol), { isMusicNotice: true, uid: cari.docId, ad, metn: title, hedef, vaxt: serverTimestamp() });
    window.__klipHedef = null;
  } catch (e) {
    updateDoc(uRef, { hearts: increment(KLIP_QIYMETI) }).catch(() => {});
    xeberVer("Klip qoşula bilmədi, ürəklər geri qaytarıldı");
    return false;
  }
  return true;
}

// ---------- bazanı dinlə ----------
let dinleyirik = false;
onValue(ref(rtdb, ".info/serverTimeOffset"), (s) => {
  offset = s.val() || 0;
  if (dinleyirik) return;       // server saatı məlum olduqdan SONRA klipi dinləməyə başla
  dinleyirik = true;
  onValue(klipRef, (s) => {
    const d = s.val();
    if (!d || !ID_RE.test(String(d.videoId))) {
      if (aktiv) dayandir(); else panel.classList.remove("gizli");
      return;
    }
    if (aktiv && aktiv.klipId === d.klipId) { aktiv.startedAt = d.startedAt; return; }  // eyni klip, vaxt dəqiqləşdi
    if (Number(d.durationSec) > 0 && kecen(d) >= Number(d.durationSec) + 3) {           // klip çoxdan bitib
      klipBitirDb(d.klipId);
      if (aktiv) dayandir();
      return;
    }
    if (aktiv) dayandir();                                                               // yeni klip köhnənin yerinə
    baslat(d);
  });
});
