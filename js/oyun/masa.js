import { rtdb, fsdb } from "../core/firebase.js";
import { MASA_NOMRESI, OTURACAQ_SAYI } from "../core/config.js";
import { cinsTap, vipMi } from "./yardimci.js";
import { girisIcazesi } from "./masalar.js";
import { ref, get, set, onValue, onDisconnect, runTransaction } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
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
      await set(r, oyuncu); // məlumatı yenilə
      onDisconnect(r).remove();
      return;
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
    await new Promise((res) => onValue(ref(rtdb, yol), (s) => { cizdir(s.val() || {}); res(); }));
    katil(cari);
  } catch (e) {
    alert("Masa xətası: " + e.message);
  }
}
