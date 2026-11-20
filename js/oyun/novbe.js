import { rtdb } from "../core/firebase.js";
import { MASA_NOMRESI, OTURACAQ_SAYI } from "../core/config.js";
import { deyisModal } from "./masalar.js";
import { ref, get, set, remove, onValue, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

document.head.insertAdjacentHTML("beforeend", '<link rel="stylesheet" href="css/novbe.css">');

const NV = `masalar/${MASA_NOMRESI}/novbe`;
const SIRALA = (q) => Object.entries(q || {}).filter((e) => e[1])
  .sort((a, b) => (a[1].t || 0) - (b[1].t || 0) || (a[0] < b[0] ? -1 : 1)).map((e) => e[0]);
let ekran = null;

// Növbədə kimsə var və birinci sən deyilsənsə: true (birbaşa oturmaq olmaz)
export async function novbeBaxis(uid) {
  const q = SIRALA((await get(ref(rtdb, NV))).val());
  return q.length > 0 && q[0] !== uid;
}

function ekranYarat() {
  ekran = document.createElement("div");
  ekran.id = "novbeEkrani";
  const emojiler = ["🍾", "💋", "🎁", "👑", "🎵", "❤️"];
  let n = "";
  for (let i = 0; i < 120; i++) n += "<span>" + emojiler[i % emojiler.length] + "</span>";
  ekran.innerHTML = '<div class="nx">' + n + '</div><div class="nk"><h3>Bütün yerlər artıq tutulub</h3>' +
    "<p>" + MASA_NOMRESI + " nömrəli masada yer yoxdur.<br>Yer boşalana qədər gözlə.<br><span id=\"nSira\"></span></p>" +
    '<button id="nBtn">Başqa masa seç</button></div>';
  document.body.appendChild(ekran);
  document.getElementById("nBtn").onclick = () => deyisModal();
}

// tap(oyuncu): oturacaq tutmağa çalışır, uğurlu olarsa true qaytarır
export function novbeBaslat(oyuncu, tap) {
  if (ekran) return;
  ekranYarat();
  const r = ref(rtdb, NV + "/" + oyuncu.uid);
  onDisconnect(r).remove().then(() => set(r, { ad: oyuncu.ad, t: serverTimestamp() }));
  window.addEventListener("pagehide", () => remove(r));

  let q = [], dolu = OTURACAQ_SAYI, isleyir = false;
  const unsubs = [];

  async function yenile() {
    if (!ekran) return;
    const n = q.indexOf(oyuncu.uid) + 1;
    if (n > 0) document.getElementById("nSira").textContent = n === 1 ? "Sən növbədə birincisən" : "Sən növbədə " + n + "-ci yerdəsən";
    if (n === 1 && dolu < OTURACAQ_SAYI && !isleyir) {
      isleyir = true;
      if (await tap(oyuncu)) {
        await remove(r);
        unsubs.forEach((f) => f());
        ekran.remove(); ekran = null;
      } else isleyir = false;
    }
  }
  unsubs.push(onValue(ref(rtdb, NV), (s) => { q = SIRALA(s.val()); yenile(); }));
  unsubs.push(onValue(ref(rtdb, `masalar/${MASA_NOMRESI}/oturacaqlar`), (s) => {
    dolu = Object.values(s.val() || {}).filter(Boolean).length; yenile();
  }));
}
