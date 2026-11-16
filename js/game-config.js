// Oyunun ayarları. Rəqəmləri və mətnləri buradan dəyiş.
export const CONFIG = {
  seatsPerTable: 12,        // bir masada neçə nəfər
  firstTableNumber: 1,      // ilk masanın nömrəsi
  maxTables: 200,           // maksimum masa sayı
  heartbeatMs: 20000,       // oyunçu "buradayam" siqnalını neçə saniyədən bir göndərir
  staleMs: 60000,           // bu qədər siqnal gəlməsə, yer boş sayılır

  chatMaxLen: 200,          // mesajın maksimum uzunluğu
  chatCooldownMs: 1000,     // iki mesaj arası minimum gözləmə
  chatKeep: 60,             // çatda ən çox neçə mesaj göstərilsin

  profilePage: "profile.html",
  loginPage: "index.html",

  // Şəkillər: boş buraxsan hazır dizayn görünür.
  // Dəyişmək üçün şəkli assets/game/ qovluğuna at, adını bura yaz.
  tableBackground: "",      // məs: "assets/game/table.jpg"
  bottleImage: "",          // məs: "assets/game/bottle.png"
  defaultAvatar: "https://cdn-icons-png.flaticon.com/512/149/149071.png",

  // Oyunçuların masa ətrafında yerləşmə forması (faizlə)
  ring: { x: 39, y: 38 },

  // Smaylikləri yalnız VIP göndərə bilər
  emojis: ["😀","😂","😍","😘","😎","🥰","😉","😏","🔥","❤️","💋","🌹","👍","👏","🎉","🍾","🥂","😢","😡","🙈","🤝"],

  // VIP ad rəngləri
  vipColors: { "Kişi": "#38bdf8", "Qadın": "#ef4444" },

  texts: {
    waitGirls: "Oyuna başlamaq üçün qızları gözləyirik",
    waitBoys: "Oyuna başlamaq üçün oğlanları gözləyirik",
    waitPlayers: "Oyunçular gözlənilir...",
    vipOnlyEmoji: "Smaylik göndərmək yalnız VIP üçündür 👑",
    tooFast: "Çox tez yazırsan, bir az gözlə",
    noTable: "Boş masa tapılmadı, yenidən cəhd et",
    rejoining: "Masaya yenidən qoşulur...",
    blocked: "Hesabınız admin tərəfindən müvəqqəti bloklanıb!"
  }
};
