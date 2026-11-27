/* premium-hediyye.js
   "Premium" bölməsindəki hədiyyələr bu faylda saxlanılır.
   hediyye.js bu siyahını import edib "Premium" düyməsinə basanda göstərir.

   Hər hədiyyənin formatı hediyye.js-dəki hədiyyələrlə eynidir:
   { id, e (emoji ehtiyatı), img (şəkil), q (qiymət, ürək), s (göndərəndə səs), sl (düşəndə səs),
     ucusMs, yapis / yigim / koktel ... (animasiya növü) }

   Nümunə (açıb istifadə edə bilərsən):
   { id: "p1", e: "👑", img: PREMIUM_SEKIL_PAPKA + "nümunə.png", q: 20 }

   DİQQƏT: id-lər "p1", "p2" ... kimi olsun ki, sadə hədiyyələrin id-ləri (g1...g21) ilə qarışmasın. */

export const PREMIUM_SEKIL_PAPKA = "images/hediyye/premium/";
export const PREMIUM_SES_PAPKA = "sesler/premium/";

export const PREMIUM_HEDIYYELER = [
  /* hədiyyələr növbəti addımda əlavə olunacaq */
];
