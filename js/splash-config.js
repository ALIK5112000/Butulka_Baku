/*
  ===== GİRİŞ EKRANININ AYARLARI =====
  Arxa fonu dəyişmək üçün YALNIZ bu faylı və assets/splash/ qovluğunu dəyiş.
  Oyun kodlarına toxunmağa ehtiyac yoxdur.

  Necə dəyişmək olar:
  1) Şəkli assets/splash/loading/ (yüklənmə) və ya assets/splash/brand/ (Butulka Baku yazısı) qovluğuna at
  2) Aşağıdakı siyahıya adını yaz
  3) Birdən çox şəkil yazsan, onlar növbə ilə yumşaq keçidlə dəyişəcək
  4) Siyahı boş olsa, hazır qaranlıq-qızılı fon görünəcək
*/
window.SPLASH_CONFIG = {
  loadingBackgrounds: [
    // "assets/splash/loading/bg1.jpg",
    // "assets/splash/loading/bg2.jpg",
  ],
  brandBackgrounds: [
    // "assets/splash/brand/bg1.jpg",
  ],

  nextPage: "oyun.html",   // brend göründükdən sonra açılacaq səhifə
  minLoadingMs: 2600,      // yüklənmə ən azı nə qədər görünsün
  brandMs: 3200,           // Butulka Baku yazısı nə qədər qalsın
  slideEveryMs: 5000,      // şəkillər neçə saniyədən bir dəyişsin
  loginPage: "index.html", // giriş etməyibsə bura göndərilir
  requireLogin: true,     // true etsən, giriş etməyən istifadəçi oyuna keçə bilməz

  // Yüklənmə zamanı əvvəlcədən yüklənəcək oyun şəkilləri/səsləri (sonradan əlavə et)
  preload: [
    // "assets/images/bottle.png",
  ]
};
