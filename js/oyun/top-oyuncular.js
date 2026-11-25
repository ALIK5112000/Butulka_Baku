import { fsdb } from "../core/firebase.js";
import { collection, query, where, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/* ================= TOP-10 OYUNÇULAR (ortaq siyahı) =================
   Hər reytinq üzrə ilk 10 oyunçu canlı izlənir. Oyunçu bu reytinqlərdən
   hər hansı birində 1-10 ci yerdədirsə "TOP" sayılır:
   öpücük, mahnı, smayl, məftun qiyməti, cüt ürək.
   Bu siyahını profil kartı (lent + məftun adı) və çat (ad rəngi) istifadə edir. */

export const TOP_RENG = "#f8b300"; /* TOP lentinin sarı tonu */
export const TOP_HEDD = 10;        /* 1-dən bu yerə qədər */

/* [sahə, minimum dəyər]  (məftun qiyməti standart 1-dir, ona görə yalnız 1-dən böyükləri sayılır) */
const SAHELER = [
  ["kisses", 0],
  ["music", 0],
  ["smiles", 0],
  ["meftunQiymet", 1],
  ["cutUrek", 0]
];

const FREEZE_FIELD_MAP = { kisses: "freeze_kisses", music: "freeze_music", smiles: "freeze_smiles" };

function vaxtMs(val) {
  if (!val) return 0;
  if (typeof val === "number") return val > 0 && val < 1e12 ? val * 1000 : val;
  if (val && typeof val.toMillis === "function") return val.toMillis();
  if (val && typeof val.seconds === "number") return val.seconds * 1000;
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n < 1e12 ? n * 1000 : n;
}

/* Xalı dondurulmuş oyunçu həmin reytinqdə sayılmır (profil kartındakı sıra ilə eyni qayda) */
function donmusMu(d, sahe) {
  let ms = 0;
  if (d.dondurulmusXallar && d.dondurulmusXallar[sahe] !== undefined) ms = Math.max(ms, vaxtMs(d.dondurulmusXallar[sahe]));
  const fKey = FREEZE_FIELD_MAP[sahe];
  if (fKey && d[fKey] !== undefined) ms = Math.max(ms, vaxtMs(d[fKey]));
  return ms > Date.now();
}

const siyahi = {};            /* sahə -> [uid, ...] */
let topSet = new Set();
let imza = "";
const dinleyiciler = [];

function hesabla() {
  const yeni = new Set();
  for (const k in siyahi) siyahi[k].forEach(uid => yeni.add(uid));
  const yeniImza = [...yeni].sort().join(",");
  if (yeniImza === imza) return;
  imza = yeniImza;
  topSet = yeni;
  dinleyiciler.slice().forEach(f => { try { f(); } catch (e) { console.error(e); } });
}

SAHELER.forEach(([k, min]) => {
  try {
    /* Dondurulmuşlar sonradan süzüldüyü üçün ehtiyat üçün 10-dan çox oxunur */
    const q = query(collection(fsdb, "users"), where(k, ">", min), orderBy(k, "desc"), limit(TOP_HEDD + 5));
    onSnapshot(q, snap => {
      const ids = [];
      snap.forEach(dd => {
        if (ids.length < TOP_HEDD && !donmusMu(dd.data() || {}, k)) ids.push(dd.id);
      });
      siyahi[k] = ids;
      hesabla();
    }, err => console.error("TOP siyahısı xətası (" + k + "):", err));
  } catch (e) { console.error("TOP siyahısı qurulmadı (" + k + "):", e); }
});

/* Oyunçu hazırda TOP-10 dadırmı? */
export const topMu = uid => !!uid && topSet.has(uid);

/* TOP siyahısı dəyişəndə çağırılır. Geri qaytardığı funksiya dinləməni dayandırır. */
export function topDeyis(f) {
  dinleyiciler.push(f);
  return () => { const i = dinleyiciler.indexOf(f); if (i >= 0) dinleyiciler.splice(i, 1); };
}

window.TopOyuncular = { var: topMu, deyis: topDeyis, reng: TOP_RENG };
