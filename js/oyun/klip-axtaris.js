// YouTube-dan klip siyahısı gətirir: populyar çart + mahnı adı ilə axtarış.
// Əsas yol: rəsmi YouTube Data API v3 (açar js/core/config.js-dədir).
// Açar yoxdursa və ya gündəlik limit bitibsə: ehtiyat açıq serverlər (Piped/Invidious).
import { YT_API_KEY, YT_REGION, KLIP_MAKS_SANIYE } from "../core/config.js";

const API = "https://www.googleapis.com/youtube/v3/";
const EHTIYAT = [
  { tip: "piped", url: "https://pipedapi.kavin.rocks/search?filter=videos&q=" },
  { tip: "piped", url: "https://pipedapi.adminforge.de/search?filter=videos&q=" },
  { tip: "invidious", url: "https://inv.nadeko.net/api/v1/search?type=video&q=" }
];
const ID_RE = /^[\w-]{11}$/;
const MIN_SANIYE = 15;

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

const muddetUygun = (s) => s == null || (s >= MIN_SANIYE && s <= KLIP_MAKS_SANIYE);

// ---------- yerli keş (eyni sorğu üçün YouTube limitini xərcləməsin) ----------
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

async function json(url, ms = 6000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal });
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error("http" + r.status);
    return d;
  } finally {
    clearTimeout(t);
  }
}

// YouTube Data API "video" obyektini bizim klip formasına çevirir. Uyğun deyilsə null.
function videodan(v) {
  const id = v && v.id;
  const sn = v.snippet || {};
  const saniye = muddetSaniye((v.contentDetails || {}).duration);
  const yayim = sn.liveBroadcastContent && sn.liveBroadcastContent !== "none";
  const nesrOlunur = (v.status || {}).embeddable !== false;
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

// Ehtiyat: açar yoxdur / limit bitib. Heç bir server cavab verməsə xəta atır.
async function ehtiyatAxtar(q) {
  let cavabVar = false;
  for (const s of EHTIYAT) {
    try {
      const d = await json(s.url + encodeURIComponent(q), 5000);
      cavabVar = true;
      const xam = s.tip === "piped"
        ? ((d && d.items) || []).filter((i) => !i.isShort && /[?&]v=/.test(i.url || "")).map((i) => ({
            videoId: String(i.url).split("v=")[1].split("&")[0], title: i.title, durationSec: Number(i.duration)
          }))
        : (Array.isArray(d) ? d : []).filter((i) => i.type === "video" && !i.liveNow).map((i) => ({
            videoId: i.videoId, title: i.title, durationSec: Number(i.lengthSeconds)
          }));
      const netice = xam
        .filter((c) => ID_RE.test(String(c.videoId)) && muddetUygun(isNaN(c.durationSec) ? null : c.durationSec))
        .slice(0, 20)
        .map((c) => ({ videoId: c.videoId, title: String(c.title || "").slice(0, 120), durationSec: c.durationSec > 0 ? c.durationSec : 0 }));
      if (netice.length) return netice;
    } catch (e) {}
  }
  if (cavabVar) return [];
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
    try { netice = await apiAxtar(q); } catch (e) { netice = null; }
  }
  if (!netice) netice = await ehtiyatAxtar(q);
  if (netice.length) keshYaz(acar, netice);
  return netice;
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
    } catch (e) {}
  }
  return POPULYAR_SABIT;
}
