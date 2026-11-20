// Butulka Baku - Təhlükəsiz Anti-Inspect və Klik Qoruması
(function () {
  // 1. Sağ klik menyusunu blokla (düymələr və inputlar normal işləyir)
  document.addEventListener("contextmenu", function (e) {
    e.preventDefault();
    return false;
  });

  // 2. F12, Ctrl+U, Ctrl+S, Ctrl+Shift+I/J/C blokla
  document.addEventListener("keydown", function (e) {
    const key = (e.key || "").toLowerCase();
    if (e.key === "F12" || e.keyCode === 123) {
      e.preventDefault();
      return false;
    }
    if (e.ctrlKey && e.shiftKey && ["i", "j", "c", "k"].includes(key)) {
      e.preventDefault();
      return false;
    }
    if (e.ctrlKey && ["u", "s"].includes(key)) {
      e.preventDefault();
      return false;
    }
  });
})();
