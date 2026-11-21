// YouTube-dan klip siyahısı gətirir: populyar çart + mahnı adı ilə axtarış.
//
// 1) ƏSAS yol (sabit): rəsmi YouTube Data API v3. Açarı js/core/config.js-də YT_API_KEY-ə yaz.
// 2) Açar yoxdursa / günlük limit bitibsə: bir neçə açıq mənbəyə EYNİ ANDA sorğu göndərilir,
//    ilk düzgün cavab götürülür (Piped, Invidious və YouTube səhifəsi CORS körpüləri üzərindən).
//    Bu mənbələr pulsuz və könüllülər tərəfindən saxlanılır, ona görə bəzən işləməyə bilər.
import { YT_API_KEY, YT_REGION, KLIP_MAKS_SANIYE } from "../core/config.js";

const API = "https://www.googleapis.com/youtube/v3/";
const ID_RE = /^[\w-]{11}$/;
const MIN_SANIYE = 15;

// Açıq mənbələrin başlanğıc siyahısı (aşağıdakı "kəşf" siyahını təzələyir)
const PIPED_TOHUM = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://api.piped.private.coffee",
  "https://pipedapi.leptons.xyz",
  "https://pipedapi.nosebs.ru",
  "https://pipedapi.reallyaweso.me",
  "https://pipedapi.darkness.services",
  "https://pipedapi.orangenet.cc"
];
const INVID_TOHUM = [
  "https://inv.nadeko.net",
  "https://yewtu.be",
  "https://invidious.nerdvpn.de",
  "https://invidious.privacyredirect.com",
  "https://invidious.f5.si",
  "https://inv.tux.pizza"
];
const PIPED_SIYAHI = "https://piped-instances.kavin.rocks/";
const INVID_SIYAHI = "https://api.invidious.io/instances.json?sort_by=type,health";
// YouTube-un öz axtarış səhifəsini CORS-a icazə verən körpülər vasitəsilə oxuyuruq
const KORPU = [
  (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
  (u) => "https://corsproxy.io/?url=" + encodeURIComponent(u),
  (u) => "https://api.codetabs.com/v1/proxy/?quest=" + encodeURIComponent(u)
];

export const kicikSekil = (id) => "https://i.ytimg.com/vi/" + id + "/mqdefault.jpg";

// API işləməyəndə "Populyar" bölməsində görünən sabit siyahı
export const POPULYAR_SABIT = [
  { videoId: "M7lc1UVf-VE", title: "OMER DEEP - Medusa (Original Mix)", durationSec: 377 },
  { videoId: "nVjsGKrE6E8", title: "Lana Del Rey - Summertime Sadness", durationSec: 265 },
  { videoId: "60ItHLz5WEA", title: "Alan Walker - Faded", durationSec: 212 },
  { videoId: "kJQP7kiw5Fk", title: "Luis Fonsi - Despacito", durationSec: 281 },
  { videoId: "JGwWNGJdvx8", title: "Ed Sheeran - Shape of You", durationSec: 263 },
  { videoId: "RgKAFK5djSk", title: "Wiz Khalifa - See You Again", durationSec: 237 },
  { videoId: "fRh_vgS2dFE", title: "Justin Bieber - Sorry", durationSec: 205 },
  { videoId: "09R8_2nJtjg", title: "Maroon 5 - Sugar", durationSec: 301 },
  { videoId: "OPf0YbXqDm0", title: "Mark Ronson - Uptown Funk", durationSec: 270 },
  { videoId: "hT_nvWreIhg", title: "OneRepublic - Counting Stars", durationSec: 283 },
  { videoId: "YQHsXMglC9A", title: "Adele - Hello", durationSec: 366 },
  { videoId: "pRpeEdMmmQ0", title: "Shakira - Waka Waka", durationSec: 210 }
];

// "PT4M13S" -> 253
export function muddetSaniye(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
  if (!m) return 0;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}
// "4:13" / "1:02:03" -> saniyə
export function saatSaniye(t) {
  if (!/^\d+(:\d{1,2}){1,2}$/.test(String(t || "").trim())) return 0;
  return String(t).trim().split(":").reduce((a, x) => a * 60 + Number(x), 0);
}

const muddetUygun = (s) => s == null || (s >= MIN_SANIYE && s <= KLIP_MAKS_SANIYE);

// ---------- yerli keş (eyni sorğu üçün şəbəkəni/limiti xərcləməsin) ----------
function keshOxu(acar, omur) {
  try {
    const x = JSON.parse(localStorage.getItem("klipKesh:" + acar));
    if (x && Date.now() - x.t < omur) return x.v;
  } catch (e) {}
  return null;
}
function keshYaz(acar, v) {
  try { localStorage.setItem("klipKesh:" + acar, JSON.stringify({ t: Date.now(), v })); } catch (e) {}
}

async function fetchMetn(url, ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal });
    if (!r.ok) throw new Error("http" + r.status);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}
async function json(url, ms = 6000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal });
    const d = await r.json().catch(() => null);
    if (!r.ok) {
      const msg = d && d.error && d.error.message ? d.error.message : "";
      throw new Error("http" + r.status + (msg ? " " + msg : ""));
    }
    return d;
  } finally {
    clearTimeout(t);
  }
}

// ---------- ortaq: xam siyahını təmiz klip siyahısına çevir ----------
export function suz(xam) {
  const gordu = new Set();
  const netice = [];
  for (const c of xam || []) {
    if (!c || !ID_RE.test(String(c.videoId)) || gordu.has(c.videoId)) continue;
    const san = isNaN(c.durationSec) ? null : Number(c.durationSec);
    if (!muddetUygun(san)) continue;
    gordu.add(c.videoId);
    netice.push({ videoId: c.videoId, title: String(c.title || "").slice(0, 120), durationSec: san > 0 ? Math.round(san) : 0 });
    if (netice.length >= 20) break;
  }
  return netice;
}

// ---------- YouTube Data API ----------
function videodan(v) {
  const id = v && v.id;
  const sn = (v && v.snippet) || {};
  const saniye = muddetSaniye(((v && v.contentDetails) || {}).duration);
  const yayim = sn.liveBroadcastContent && sn.liveBroadcastContent !== "none";
  const nesrOlunur = ((v && v.status) || {}).embeddable !== false;
  if (!ID_RE.test(String(id)) || yayim || !nesrOlunur || !muddetUygun(saniye)) return null;
  return { videoId: id, title: String(sn.title || "").slice(0, 120), durationSec: saniye };
}

async function videolarYukle(idler) {
  const d = await json(API + "videos?part=snippet,contentDetails,status&id=" + idler.join(",") + "&key=" + encodeURIComponent(YT_API_KEY));
  const xerite = {};
  (d.items || []).forEach((v) => { xerite[v.id] = v; });
  return idler.map((id) => xerite[id]).filter(Boolean).map(videodan).filter(Boolean);
}

async function apiAxtar(q) {
  const s = await json(
    API + "search?part=snippet&type=video&videoEmbeddable=true&videoSyndicated=true&maxResults=20&q=" +
      encodeURIComponent(q) + "&key=" + encodeURIComponent(YT_API_KEY)
  );
  const idler = (s.items || []).map((i) => i.id && i.id.videoId).filter((id) => ID_RE.test(String(id)));
  return idler.length ? videolarYukle(idler) : [];
}

// ---------- açıq mənbələrin cavab formaları ----------
export function pipedCevir(d) {
  const l = Array.isArray(d) ? d : (d && d.items) || [];
  return l
    .filter((i) => i && !i.isShort && /[?&]v=/.test(i.url || ""))
    .map((i) => ({ videoId: String(i.url).split("v=")[1].split("&")[0], title: i.title, durationSec: Number(i.duration) }));
}
export function invidCevir(d) {
  return (Array.isArray(d) ? d : [])
    .filter((i) => i && i.type === "video" && !i.liveNow && !i.isUpcoming && i.videoId)
    .map((i) => ({ videoId: i.videoId, title: i.title, durationSec: Number(i.lengthSeconds) }));
}

// YouTube axtarış səhifəsinin içindəki ytInitialData JSON-unu çıxarır
function ytVeri(html) {
  const m = /ytInitialData["'\]]*\s*=\s*/.exec(html || "");
  if (!m) return null;
  const bas = m.index + m[0].length;
  if (html[bas] !== "{") return null;
  let derin = 0, setir = false, qac = false;
  for (let j = bas; j < html.length; j++) {
    const c = html[j];
    if (setir) {
      if (qac) qac = false;
      else if (c === "\\") qac = true;
      else if (c === '"') setir = false;
      continue;
    }
    if (c === '"') setir = true;
    else if (c === "{") derin++;
    else if (c === "}" && --derin === 0) {
      try { return JSON.parse(html.slice(bas, j + 1)); } catch (e) { return null; }
    }
  }
  return null;
}
function videoRendererler(o, cixis) {
  if (!o || typeof o !== "object" || cixis.length >= 40) return;
  if (Array.isArray(o)) { o.forEach((x) => videoRendererler(x, cixis)); return; }
  if (o.videoRenderer && o.videoRenderer.videoId) cixis.push(o.videoRenderer);
  for (const k in o) if (k !== "videoRenderer") videoRendererler(o[k], cixis);
}
export function ytHtmlCevir(html) {
  const veri = ytVeri(html);
  if (!veri) return [];
  const l = [];
  videoRendererler(veri, l);
  return l
    .map((v) => {
      const baslik = v.title && (v.title.simpleText || (v.title.runs || []).map((r) => r.text).join(""));
      const san = saatSaniye(v.lengthText && v.lengthText.simpleText);
      return { videoId: v.videoId, title: baslik, durationSec: san || NaN };
    })
    .filter((c) => c.durationSec > 0);        // müddəti yoxdursa (canlı yayım / tezliklə) götürmə
}

// ---------- mənbə siyahısı (təzələnir, 12 saat yadda qalır) ----------
const sonuc = (a) => [...new Set(a.filter((u) => typeof u === "string" && /^https:\/\/[^/\s]+$/.test(u.replace(/\/+$/, ""))).map((u) => u.replace(/\/+$/, "")))];
let instansVeed = null, instansBos = false, instansZaman = 0;
async function instanslariTap() {
  const k = keshOxu("inst2", 12 * 3600e3);
  if (k) return k;
  const [p, i] = await Promise.all([json(PIPED_SIYAHI, 4000).catch(() => null), json(INVID_SIYAHI, 4000).catch(() => null)]);
  const piped = Array.isArray(p) ? p.map((x) => x && x.api_url) : [];
  const invid = Array.isArray(i)
    ? i.filter((x) => Array.isArray(x) && x[1] && x[1].api === true && x[1].cors === true && x[1].type === "https").map((x) => x[1].uri)
    : [];
  const v = { piped: sonuc(piped), invid: sonuc(invid) };
  if (v.piped.length || v.invid.length) keshYaz("inst2", v);
  return v;
}
// Axtarış bölməsi açılanda öncədən çağırılır ki, siyahı hazır olsun
export function isit() {
  // Siyahı alınmayıbsa (şəbəkə qırıldı və s.) 1 dəqiqədən sonra yenidən cəhd edilir
  if (!instansVeed || (instansBos && Date.now() - instansZaman > 60000)) {
    instansZaman = Date.now();
    instansVeed = instanslariTap()
      .then((v) => { instansBos = !(v.piped.length || v.invid.length); return v; })
      .catch(() => { instansBos = true; return { piped: [], invid: [] }; });
  }
  return instansVeed;
}

const qarisdir = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

async function menbeler() {
  const yeni = await Promise.race([isit(), new Promise((r) => setTimeout(() => r(null), 1200))]);
  const piped = qarisdir(sonuc([...(yeni ? yeni.piped : []), ...PIPED_TOHUM]));
  const invid = qarisdir(sonuc([...(yeni ? yeni.invid : []), ...INVID_TOHUM]));
  return { piped: piped.slice(0, 5), invid: invid.slice(0, 5) };
}

// Hamısını eyni anda işə sal: ilk NƏTİCƏLİ cavab qalib gəlir. { netice, cavab } qaytarır.
export function yaris(isler) {
  return new Promise((bitdi) => {
    let qalan = isler.length, cavab = false;
    if (!qalan) return bitdi({ netice: null, cavab });
    isler.forEach((is) => {
      Promise.resolve()
        .then(is)
        .then((r) => {
          if (r && r.length) bitdi({ netice: r, cavab: true });
          else if (r) cavab = true;
        })
        .catch(() => {})
        .finally(() => { if (--qalan === 0) bitdi({ netice: null, cavab }); });
    });
  });
}

async function aciqAxtar(q) {
  const { piped, invid } = await menbeler();
  const e = encodeURIComponent(q);
  const ytUrl = "https://www.youtube.com/results?hl=en&sp=EgIQAQ%253D%253D&search_query=" + e;   // sp = yalnız video
  const isler = [
    ...piped.map((b) => () => json(b + "/search?filter=videos&q=" + e, 6000).then(pipedCevir).then(suz)),
    ...invid.map((b) => () => json(b + "/api/v1/search?type=video&q=" + e, 6000).then(invidCevir).then(suz)),
    ...KORPU.map((k) => () => fetchMetn(k(ytUrl), 8000).then(ytHtmlCevir).then(suz))
  ];
  const r = await yaris(isler);
  if (r.netice) return r.netice;
  if (r.cavab) return [];
  throw new Error("axtaris-islemir");
}

export async function axtar(sorgu) {
  const q = String(sorgu || "").trim().slice(0, 80);
  if (q.length < 2) return [];
  const acar = "a:" + q.toLowerCase();
  const k = keshOxu(acar, 6 * 3600e3);
  if (k) return k;

  let netice = null;
  if (YT_API_KEY) {
    try { netice = await apiAxtar(q); }
    catch (e) { console.warn("YouTube API xətası (limit və ya açar problemi ola bilər), ehtiyat yola keçirik:", e.message); }
  } else {
    console.info("YT_API_KEY boşdur: axtarış açıq mənbələrlə işləyir (stabil deyil). Açar üçün js/core/config.js-ə bax.");
  }
  if (!netice) netice = await aciqAxtar(q);
  if (netice.length) keshYaz(acar, netice);
  return netice;
}

// ---------- populyar ----------
async function aciqPopulyar() {
  const { invid } = await menbeler();
  const reg = encodeURIComponent(YT_REGION);
  const isler = invid.map((b) => () => json(b + "/api/v1/trending?type=music&region=" + reg, 4000).then(invidCevir).then(suz));
  const r = await yaris(isler);
  return r.netice && r.netice.length >= 4 ? r.netice : null;
}

export async function populyar() {
  const acar = "p:" + YT_REGION;
  const k = keshOxu(acar, 30 * 60e3);
  if (k) return k;
  if (YT_API_KEY) {
    try {
      const d = await json(
        API + "videos?part=snippet,contentDetails,status&chart=mostPopular&videoCategoryId=10&regionCode=" +
          encodeURIComponent(YT_REGION) + "&maxResults=30&key=" + encodeURIComponent(YT_API_KEY)
      );
      const l = (d.items || []).map(videodan).filter(Boolean);
      if (l.length) { keshYaz(acar, l); return l; }
    } catch (e) {
      console.warn("YouTube API xətası (populyar):", e.message);
    }
  }
  try {
    const l = await Promise.race([aciqPopulyar(), new Promise((r) => setTimeout(() => r(null), 3500))]);
    if (l) { keshYaz(acar, l); return l; }
  } catch (e) {}
  return POPULYAR_SABIT;
}
