// Klip sistemi: masadakı hamı üçün sinxron YouTube klipi (pleyer + kart + ürək ödənişi).
// Bu masanın klipi bazada saxlanır: masalar/<masa>/aktivKlip
// Vaxt SERVER saatı ilə yazılır, ona görə hamıda eyni saniyədə oynayır və
// masadan çıxıb qayıdanda klip qaldığı yerdən (real vaxtla) davam edir.
import { rtdb, fsdb } from "../core/firebase.js";
import { MASA_NOMRESI, KLIP_QIYMETI } from "../core/config.js";
import { cariOyuncu, toast } from "./yardimci.js";
import { ref, onValue, set, push, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
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
const geriQaytarilan = new Set();

const indi = () => Date.now() + offset;
const kecen = (d) => Math.max(0, (indi() - Number(d.startedAt || indi())) / 1000);

// ---------- səs ayarı (yadda qalır) ----------
const lsOxu = (a, v) => { try { const x = localStorage.getItem(a); return x === null ? v : x; } catch (e) { return v; } };
const lsYaz = (a, v) => { try { localStorage.setItem(a, v); } catch (e) {} };
let ses = Math.min(100, Math.max(1, Number(lsOxu("klipSes", 85)) || 85));
let sessiz = lsOxu("klipSessiz", "0") === "1";

function sesUI() {
  const v = sessiz ? 0 : ses;
  sesInp.value = v;
  sesInp.style.setProperty("--d", v + "%");
  sesBtn.classList.toggle("sessiz", sessiz);
}
function sesiTetbiqEt() {
  if (!oynatici || !oynatici.mute) return;
  try {
    if (sessiz) oynatici.mute();
    else { oynatici.unMute(); oynatici.setVolume(ses); }
  } catch (e) {}
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
  chatYeri.classList.remove("kz1", "kz2");
  if (zoom) { kart.classList.add("z" + zoom); chatYeri.classList.add("kz" + zoom); }
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
          onStateChange: (e) => { if (e.data === 0 && aktiv) bitir(aktiv); },
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
  try { oynatici.playVideo(); } catch (e) {}
}, true);

// Video bu saytda oynadıla bilmir (sahibi icazə vermir və s.): klipi bağla, qoşan oyunçuya ürəyi qaytar
function oynadilmadi() {
  const d = aktiv;
  if (!d) return;
  const cari = cariOyuncu();
  if (cari && cari.docId === d.djUid && !geriQaytarilan.has(d.klipId)) {
    geriQaytarilan.add(d.klipId);
    updateDoc(doc(fsdb, "users", cari.docId), { hearts: increment(KLIP_QIYMETI) }).catch(() => {});
    toast(`Bu klip oynadıla bilmədi, ${KLIP_QIYMETI} ürək geri qaytarıldı`);
  }
  bitir(d);
}

// ---------- klipin başlaması / dayanması ----------
async function baslat(d) {
  aktiv = d;
  panel.classList.add("gizli");               // klip çalanda musiqi düymələri görünmür
  await oyunGorunur;
  if (aktiv !== d) return;
  kart.hidden = false;
  chatYeri.classList.add("klip-var");        // chat mesajları kartın altına enir (örtülmür)
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
    const gozlenen = kecen(d);
    if (st === 1) {
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
  }, 500);
}

// ---------- klip qoşmaq (ürək çıxılır) ----------
export const klipCalirMi = () => !!aktiv;

export async function klipQos(klip) {
  const cari = cariOyuncu();
  if (!cari || !cari.docId) { toast("Oyunçu məlumatı tapılmadı"); return false; }
  if (!klip || !ID_RE.test(String(klip.videoId))) { toast("Klip tapılmadı"); return false; }

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
    toast(e.message === "az" ? `Klip qoşmaq üçün ${KLIP_QIYMETI} ürək lazımdır` : "Xəta baş verdi, yenidən cəhd et");
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
    // Chatda: qoşan oyunçunun şəkli + klipin adı (bütün masa görür)
    await push(ref(rtdb, chatYol), { isMusicNotice: true, uid: cari.docId, ad, metn: title, vaxt: serverTimestamp() });
  } catch (e) {
    updateDoc(uRef, { hearts: increment(KLIP_QIYMETI) }).catch(() => {});
    toast("Klip qoşula bilmədi, ürəklər geri qaytarıldı");
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
