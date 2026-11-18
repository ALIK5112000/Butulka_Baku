import { masaniBasla } from "./masa.js";

// Fon naxışı
const emojiler = ["🍾", "💋", "🎁", "👑", "🎵", "❤️"];
const naxis = document.getElementById("naxis");
for (let i = 0; i < 120; i++) {
  const s = document.createElement("span");
  s.textContent = emojiler[i % emojiler.length];
  naxis.appendChild(s);
}

// Masa yüklənmə zamanı arxada qoşulur
masaniBasla();

// Yükləmə barı (təxminən 3 saniyə)
const bar = document.getElementById("barDolu");
let faiz = 0;
const timer = setInterval(() => {
  faiz += 4;
  bar.style.width = Math.min(faiz, 100) + "%";
  if (faiz >= 100) {
    clearInterval(timer);
    setTimeout(oyunuAc, 300);
  }
}, 120);

function oyunuAc() {
  document.getElementById("yuklemeEkrani").classList.remove("aktiv");
  document.getElementById("oyunEkrani").classList.add("aktiv");
}
