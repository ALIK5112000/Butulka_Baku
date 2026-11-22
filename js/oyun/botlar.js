/* TEST BOTLARI: yalnız linkdə ?bot=N olanda işləyir (adi oyunçular üçün heç nə dəyişmir).
   Nümunə:  oyun.html?masa=999&bot=6            -> 6 bot (oğlan/qız növbə ilə) boş yerlərə oturur
            oyun.html?masa=999&bot=6&hereket=1  -> botlar hər 6 saniyədən bir yer dəyişir
            oyun.html?masa=999&bot=6&jest=1     -> botlar hər 7 saniyədən bir smaylik göndərir
   Bunları birləşdirmək olar: &bot=8&hereket=1&jest=1
   Botlar sənin səhifən bağlananda avtomatik silinir. Test üçün ayrıca masa (məs. 999) istifadə et. */
import { rtdb } from "../core/firebase.js";
import { MASA_NOMRESI, OTURACAQ_SAYI } from "../core/config.js";
import { ref, get, remove, onDisconnect, runTransaction, set } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const P = new URLSearchParams(location.search);
const SAY = Math.min(parseInt(P.get("bot")) || 0, OTURACAQ_SAYI - 1);
const yol = `masalar/${MASA_NOMRESI}/oturacaqlar`;
const jestYol = `masalar/${MASA_NOMRESI}/jest`;

const OGLAN = ["Elvin", "Rauf", "Murad", "Tural", "Kamran", "Orxan"];
const QIZ = ["Aynur", "Leyla", "Nigar", "Sevda", "Gunel", "Aysel"];

function avatar(qiz, i) {
  const bg = qiz ? ["#e86fa6", "#f08a5d", "#b86fe8"][i % 3] : ["#3d9be9", "#4fb286", "#6a7be8"][i % 3];
  const sac = qiz ? "<path d='M28 42c0-26 44-26 44 0v34h-9V44H37v32h-9z' fill='#4a2410'/>" : "<path d='M32 34c2-14 34-14 36 0c-8-6-28-6-36 0z' fill='#2b1a10'/>";
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='" + bg + "'/>" +
    "<path d='M14 100c0-26 16-38 36-38s36 12 36 38z' fill='#fff' fill-opacity='.88'/>" +
    "<circle cx='50' cy='40' r='17' fill='#fff' fill-opacity='.92'/>" + sac + "</svg>";
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

const botlar = [];
for (let i = 0; i < SAY; i++) {
  const qiz = i % 2 === 1;
  const ad = (qiz ? QIZ : OGLAN)[Math.floor(i / 2) % 6];
  botlar.push({ uid: "bot_" + (i + 1), ad: ad + ", " + (20 + ((i * 7) % 15)), sekil: avatar(qiz, i), vip: i % 5 === 4, cins: qiz ? "q" : "o", bot: true, yer: null });
}

const qarish = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const oyuncu = (b) => ({ uid: b.uid, ad: b.ad, sekil: b.sekil, vip: b.vip, cins: b.cins });

async function otur(b, istisna) {
  const hamisi = (await get(ref(rtdb, yol))).val() || {};
  const bos = [];
  for (let i = 0; i < OTURACAQ_SAYI; i++) if (!hamisi[i] && i !== istisna) bos.push(i);
  qarish(bos);
  for (const i of bos) {
    const r = ref(rtdb, `${yol}/${i}`);
    const n = await runTransaction(r, (cur) => (cur ? undefined : oyuncu(b)));
    if (!n.committed) continue;
    onDisconnect(r).remove().catch(() => {});
    if (b.yer !== null) {
      const eski = ref(rtdb, `${yol}/${b.yer}`);
      onDisconnect(eski).cancel().catch(() => {});
      await runTransaction(eski, (cur) => (cur && cur.uid === b.uid ? null : undefined)).catch(() => {});
      window.dispatchEvent(new CustomEvent("oyuncuYerDeyisdi", { detail: { uid: b.uid, kohne: b.yer, yeni: i } }));
    }
    b.yer = i;
    return true;
  }
  return false;
}

function temizle() {
  botlar.forEach((b) => {
    if (b.yer !== null) remove(ref(rtdb, `${yol}/${b.yer}`)).catch(() => {});
    remove(ref(rtdb, `${jestYol}/${b.uid}`)).catch(() => {});
  });
}

async function basla() {
  for (const b of botlar) { await otur(b, null); await new Promise((r) => setTimeout(r, 250)); }
  if (P.get("hereket")) {
    setInterval(() => { const b = botlar[Math.floor(Math.random() * botlar.length)]; if (b && b.yer !== null) otur(b, b.yer); }, 6000);
  }
  if (P.get("jest")) {
    const ids = ["j1", "j3", "j4", "j5", "j7", "j9"];
    setInterval(() => {
      const b = botlar[Math.floor(Math.random() * botlar.length)];
      if (!b || b.yer === null) return;
      const r = ref(rtdb, `${jestYol}/${b.uid}`);
      onDisconnect(r).remove().catch(() => {});
      set(r, { i: ids[Math.floor(Math.random() * ids.length)], n: Date.now() + "-" + Math.random().toString(36).slice(2, 7) });
    }, 7000);
  }
}

if (SAY > 0) {
  window.addEventListener("pagehide", temizle);
  window.addEventListener("beforeunload", temizle);
  basla();
}
