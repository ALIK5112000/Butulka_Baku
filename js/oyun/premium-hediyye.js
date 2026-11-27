/* premium-hediyye.js
   "Premium" bölməsindəki hədiyyələr, jeton ayarları və səviyyə hesablaması bu faylda saxlanılır.
   hediyye.js bu faylı import edib "Premium" düyməsinə basanda göstərir.

   Hədiyyə sahələri:
   id     : "p1", "p2" ... (sadə hədiyyələrin g1...g21 id-ləri ilə qarışmasın)
   e      : emoji ehtiyatı (şəkil yüklənməsə göstərilir)
   img    : siyahıdakı kiçik şəkil
   q      : qiyməti (jeton)
   ad     : hədiyyənin adı (xəbər yazısında göstərilir)
   video  : göndəriləndə YALNIZ alıcının ekranında oynayan video (səsi videonun içindədir) */

export const PREMIUM_SEKIL_PAPKA = "images/hediyye/premium/";
export const PREMIUM_SES_PAPKA = "sesler/premium/";

/* JETON AYARLARI
   jetonSahesi : Firestore-da users/{uid} sənədində jeton balansının saxlandığı sahə
   xercSahesi  : users/{uid} sənədində göndərilmiş ümumi jeton (səviyyə buna görə hesablanır)
   alanPay     : alıcı qiymətin neçə hissəsini jeton kimi alır (0.5 = yarısı) */
export const PREMIUM_AYAR = {
  jetonSahesi: "jeton",
  xercSahesi: "jetonXerc",
  alanPay: 0.5
};

/* SƏVİYYƏLƏR: n-ci səviyyəyə çatmaq üçün göndərilməli ümumi jeton = SEVIYYE_ESIKLERI[n-1] */
const SEVIYYE_ESIKLERI = [0, 150, 500, 1200, 2500, 5000, 9000, 15000, 25000, 40000];

export function seviyye(xerc) {
  xerc = Number(xerc) || 0;
  let no = 1;
  for (let i = 0; i < SEVIYYE_ESIKLERI.length; i++) if (xerc >= SEVIYYE_ESIKLERI[i]) no = i + 1;
  const max = no >= SEVIYYE_ESIKLERI.length;
  const cari = SEVIYYE_ESIKLERI[no - 1];
  const novbeti = max ? cari : SEVIYYE_ESIKLERI[no];
  const ad = no <= 3 ? "Bürünc" : no <= 6 ? "Gümüş" : no <= 9 ? "Qızıl" : "Almaz";
  return {
    no, ad, max,
    qalan: max ? 0 : novbeti - xerc,
    faiz: max ? 100 : Math.max(0, Math.min(100, Math.round((xerc - cari) / (novbeti - cari) * 100)))
  };
}

export const PREMIUM_HEDIYYELER = [
  { id: "p1", e: "🐺", img: PREMIUM_SEKIL_PAPKA + "canavar.png", q: 1000, ad: "Canavar", video: PREMIUM_SEKIL_PAPKA + "canavar.mp4" }
];
