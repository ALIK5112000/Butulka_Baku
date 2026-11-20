// Butulka Baku - Anti-Inspect və Kod Qoruma Sistemi
(function () {
  // 1. Sağ klik (Context Menu) tam blokla
  document.addEventListener("contextmenu", function (e) {
    e.preventDefault();
    return false;
  });

  // 2. Mətn seçməyi və kopyalamağı blokla (input və textarea istisna olmaqla)
  document.addEventListener("selectstart", function (e) {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
    if (tag !== "input" && tag !== "textarea") {
      e.preventDefault();
    }
  });

  // 3. F12, Ctrl+U, Ctrl+S, Ctrl+Shift+I / J / C klaviatura kombinasiyalarını blokla
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
    if (e.ctrlKey && ["u", "s", "p"].includes(key)) {
      e.preventDefault();
      return false;
    }
    if (e.metaKey && e.altKey && ["i", "j", "c", "u"].includes(key)) {
      e.preventDefault();
      return false;
    }
  });

  // 4. Brauzer menyusundan DevTools (Inspect) açılarsa dərhal aşkarla və səhifəni kilidlə
  let kilidli = false;
  function ekraniKilidle() {
    if (kilidli) return;
    kilidli = true;
    document.body.innerHTML = `
      <div style="position:fixed;inset:0;background:#070811;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;font-family:sans-serif;z-index:999999;">
        <div style="font-size:48px;margin-bottom:12px;">🛡️</div>
        <h2 style="color:#ef4444;margin-bottom:8px;">Təhlükəsizlik Müdafiəsi Aktivdir</h2>
        <p style="color:#94a3b8;font-size:14px;max-width:340px;line-height:1.5;">
          Butulka Baku sistem kodlarına baxmaq və ya müdaxilə etmək qadağandır. Zəhmət olmasa geliştirici alətlərini (F12 / Inspect) bağlayıb səhifəni yeniləyin.
        </p>
      </div>
    `;
  }

  // Masaüstü brauzerlərdə pəncərə ölçüsü fərqi ilə DevTools yoxlaması
  setInterval(function () {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile) {
      const widthDiff = window.outerWidth - window.innerWidth > 160;
      const heightDiff = window.outerHeight - window.innerHeight > 160;
      if (widthDiff || heightDiff) {
        ekraniKilidle();
      }
    }
  }, 800);

  // Konsol təmizləmə və debugger tələsi
  setInterval(function () {
    try {
      console.clear();
      const t0 = performance.now();
      (function () {}).constructor("debugger")();
      if (performance.now() - t0 > 120) {
        ekraniKilidle();
      }
    } catch (e) {}
  }, 1500);
})();
