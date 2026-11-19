const ARAN = 0.574;    // masa ekranın neçə hissəsini tutsun. Çat daha böyük olsun istəsən azalt (məs. 0.52)
const TAXTA_VW = 114;  // masa.css-dəki 114vw ilə eyni olmalıdır

let sonEn = 0;
function hesabla() {
  const w = document.documentElement.clientWidth;
  if (!w || w === sonEn) return;   // klaviatura açılanda toxunmuruq
  sonEn = w;
  const s = Math.min(1, (ARAN * window.innerHeight) / (TAXTA_VW / 100 * w));
  document.documentElement.style.setProperty("--olcu", s.toFixed(4));
}

hesabla();
addEventListener("resize", hesabla);
