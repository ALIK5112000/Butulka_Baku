import { masaniBasla } from "./masa.js";

// Masa dəyişəndə: yalnız logo və fon görünür, yükləmə barı yoxdur
const tez = location.search.includes("masa=");

// Fon naxışı
const emojiler = ["🍾", "💋", "🎁", "👑", "🎵", "❤️"];
const naxis = document.getElementById("naxis");
for (let i = 0; i < 120; i++) {
  const s = document.createElement("span");
  s.textContent = emojiler[i % emojiler.length];
  naxis.appendChild(s);
}

function oyunuAc() {
  document.getElementById("yuklemeEkrani").classList.remove("aktiv");
  document.getElementById("oyunEkrani").classList.add("aktiv");
}

if (tez) {
  document.querySelector(".bar").style.display = "none";
  let acildi = false;
  const ac = () => { if (!acildi) { acildi = true; oyunuAc(); } };
  masaniBasla().then(ac, ac); // masa məlumatı gələn kimi açılır
  setTimeout(ac, 4000);       // ehtiyat: ən çox 4 saniyə
} else {
  masaniBasla();
  // İlk giriş: yükləmə barı (təxminən 3 saniyə)
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
}
