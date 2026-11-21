export const MASA_NOMRESI = new URLSearchParams(location.search).get("masa") || "511";
export const OTURACAQ_SAYI = 12;
// Oyunçu şəkillərinin mərkəzi (vw). masa.css-dəki .yer-N ilə eyni olmalıdır
export const YER_XY = [
  [17.3, 30.8], [39.2, 25.5], [61, 25.5], [83.1, 30], [86.9, 52.7], [86.9, 74.4],
  [83, 96.3], [61, 101.3], [39.2, 101.3], [17.3, 96], [13.3, 74.4], [13.3, 52.7]
];

// ---------- KLİP (YouTube) AYARLARI ----------
// YouTube Data API v3 açarı (Google Cloud-da yaradılır). Açarı bura yapışdır: "AIza..."
// Boş qalsa axtarış yalnız ehtiyat serverlərlə işləyir (az etibarlıdır).
export const YT_API_KEY = "";
export const YT_REGION = "AZ";          // "Populyar" siyahısı bu ölkənin musiqi çartından gəlir
export const KLIP_QIYMETI = 9;          // bir klipin qiyməti (ürək)
export const KLIP_MAKS_SANIYE = 720;    // bundan uzun kliplər siyahıda görünmür (720 san = 12 dəq)
