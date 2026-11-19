import { rtdb, fsdb } from "../core/firebase.js";
import { MASA_NOMRESI, OTURACAQ_SAYI } from "../core/config.js";
import { cinsTap, vipMi } from "./yardimci.js";
import { girisIcazesi } from "./masalar.js";
import { ref, get, set, remove, onValue, onDisconnect, runTransaction } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const yol = `masalar/${MASA_NOMRESI}/oturacaqlar`;
const masa = document.getElementById("masa");
const yerler = [];

for (let i = 0; i < OTURACAQ_SAYI; i++) {
  const d = document.createElement("div");
  d.className = "yer yer-" + i;
  d.innerHTML = '<div class="foto"></div><div class="ad"></div>';
  masa.appendChild(d);
  yerler.push(d);
}

async function oturacaqTap(oyuncu) {
  const hamisi = (await get(ref(rtdb, yol))).val() || {};
  for (const k in hamisi) {
    if (hamisi[k] && hamisi[k].uid === oyuncu.uid) {
      const r = ref(rtdb, `${yol}/${k}`);
      // Yer boşdursa və ya hələ səninkidirsə yenilə; başqası oturubsa onun üstünə yazma
      const n = await runTransaction(r, (cur) => (!cur || cur.uid === oyuncu.uid ? oyuncu : undefined));
      if (n.committed) { onDisconnect(r).remove(); return; }
      break; // yer tutulub — aşağıda yeni boş yer axtarılır
    }
  }
  for (let i = 0; i < OTURACAQ_SAYI; i++) {
    const r = ref(rtdb, `${yol}/${i}`);
    const netice = await runTransaction(r, (cur) => (cur ? undefined : oyuncu));
    if (netice.committed) {
      onDisconnect(r).remove(); // çıxanda yer avtomatik boşalır
      return;
    }
  }
  alert("Masa doludur");
}

function cizdir(data) {
  yerler.forEach((d, i) => {
    const o = data[i];
    d.classList.toggle("dolu", !!o);
    if (o) {
      d.querySelector(".ad").textContent = o.ad;
      const s = o.sekil ? String(o.sekil).replace(/"/g, "%22") : "";
      d.querySelector(".foto").style.backgroundImage = s ? `url("${s}")` : "";
    }
  });
}

// Oturacağı arxa planda tut (oyun ekranı gözləmir)
async function katil(cari) {
  try {
    const snap = await getDoc(doc(fsdb, "users", cari.docId));
    if (!snap.exists()) { location.href = "index.html"; return; }
    const p = snap.data();
    await oturacaqTap({
      uid: cari.docId,
      ad: p.username || "Oyunçu",
      sekil: p.avatar || "",
      vip: vipMi(p),
      cins: cinsTap(p.gender)
    });
  } catch (e) {
    alert("Masa xətası: " + e.message);
  }
}

// Eyni anda iki dəfə oturmasın deyə
let katilir = false;
async function katilBir(cari) {
  if (katilir) return;
  katilir = true;
  try { await katil(cari); } finally { katilir = false; }
}

// İlk masa məlumatı gələn kimi tamamlanır (oyun dərhal açılır)
export async function masaniBasla() {
  let cari = null;
  try { cari = JSON.parse(localStorage.getItem("currentUser")); } catch (e) {}
  if (!cari || !cari.docId) { location.href = "index.html"; return; }

  try {
    if (!(await girisIcazesi(MASA_NOMRESI))) {
      alert("Bu masa parolludur");
      const g = sessionStorage.getItem("sonMasa") || "511";
      location.replace("oyun.html?masa=" + (g === MASA_NOMRESI ? "511" : g));
      return;
    }
        const ilk = await new Promise((res) => onValue(ref(rtdb, yol), (s) => { const v = s.val() || {}; cizdir(v); res(v); }));
    // Masada məndən başqa oyunçu yoxdursa (hamı çıxıb) köhnə chat silinir
    if (!Object.values(ilk).some((o) => o && o.uid !== cari.docId)) {
      remove(ref(rtdb, `masalar/${MASA_NOMRESI}/chat`)).catch(() => {});
    }
    // Telefon başqa proqrama keçəndə server yeri boşaldır; bağlantı hər dəfə (yenidən) qurulanda geri otur
    onValue(ref(rtdb, ".info/connected"), (s) => { if (s.val() === true) katilBir(cari); });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") katilBir(cari); });
  } catch (e) {
    alert("Masa xətası: " + e.message);
  }
}
