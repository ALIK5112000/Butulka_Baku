import { db, auth } from "../core/firebase.js";
import { MASA_NOMRESI, OTURACAQ_SAYI, ISTIFADECI_YOLU, AD_SAHELERI, SEKIL_SAHELERI } from "../core/config.js";
import { ref, get, onValue, onDisconnect, runTransaction } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

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

function sahe(obj, adlar, def) {
  for (const a of adlar) if (obj && obj[a]) return obj[a];
  return def;
}

async function oturacaqTap(oyuncu) {
  const hamisi = (await get(ref(db, yol))).val() || {};
  for (const k in hamisi) {
    if (hamisi[k] && hamisi[k].uid === oyuncu.uid) {
      onDisconnect(ref(db, `${yol}/${k}`)).remove();
      return;
    }
  }
  for (let i = 0; i < OTURACAQ_SAYI; i++) {
    const r = ref(db, `${yol}/${i}`);
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

export function masaniBasla() {
  onValue(ref(db, yol), (s) => cizdir(s.val() || {}));

  onAuthStateChanged(auth, async (user) => {
    if (!user) { location.href = "index.html"; return; }
    const profil = (await get(ref(db, `${ISTIFADECI_YOLU}/${user.uid}`))).val() || {};
    await oturacaqTap({
      uid: user.uid,
      ad: sahe(profil, AD_SAHELERI, user.displayName || "Oyunçu"),
      sekil: sahe(profil, SEKIL_SAHELERI, user.photoURL || "")
    });
  });
}
