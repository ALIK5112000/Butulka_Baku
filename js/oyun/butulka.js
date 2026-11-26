// ===== Butulka seçimi paneli (aşağıdan açılır) =====
const BUTULKALAR = [
  { id: "vip",      ad: "VIP",      sekil: "butulkalar/vip.png",      qiymet: 5 },
  { id: "kola",     ad: "Kola",     sekil: "butulkalar/kola.png",     qiymet: 5 },
  { id: "portagal", ad: "Portağal", sekil: "butulkalar/portagal.png", qiymet: 5 },
  { id: "kolamax",  ad: "Kola Max", sekil: "butulkalar/kolamax.png",  qiymet: 5 },
  // yeni butulka əlavə etmək üçün bura bir sətir yaz
];

(function butulkaQur() {
  const UREK =
    '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 21s-8-5.2-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.8-8 11-8 11z" fill="#ff6a13"/></svg>';

  const panel = document.createElement("div");
  panel.id = "butulkaPanel";
  panel.style.cssText =
    "position:fixed;left:0;right:0;bottom:0;top:121vw;display:none;z-index:9000;" +
    "background:#fff;font-family:Roboto,Arial,sans-serif;flex-direction:column;";

  const baslig = document.createElement("div");
  baslig.textContent = "Butulkanı dəyiş";
  baslig.style.cssText =
    "flex:none;padding:4.2vw 4vw;font-size:5vw;color:#b5b5b5;border-bottom:.3vw solid #e6e6e6;";
  panel.appendChild(baslig);

  const siyahi = document.createElement("div");
  siyahi.style.cssText =
    "flex:1;overflow-y:auto;display:grid;grid-template-columns:repeat(4,1fr);" +
    "row-gap:3vw;padding:3vw 2vw 20vw;-webkit-overflow-scrolling:touch;";
  panel.appendChild(siyahi);

  BUTULKALAR.forEach((b) => {
    const item = document.createElement("div");
    item.style.cssText =
      "display:flex;flex-direction:column;align-items:center;gap:1vw;cursor:pointer;";
    item.innerHTML =
      '<div style="width:20vw;height:20vw;display:flex;align-items:center;justify-content:center;">' +
      '<img src="' + b.sekil + '" alt="' + b.ad + '" style="max-width:100%;max-height:100%;object-fit:contain;"></div>' +
      '<div style="display:flex;align-items:center;gap:1vw;font-size:5.4vw;font-weight:700;color:#222;">' +
      '<span style="width:6.4vw;height:6.4vw;display:flex;">' + UREK + "</span>" + b.qiymet + "</div>";
    item.onclick = () => {
      // Burda sonra ürək çıxma / alma məntiqini bağlayacağıq
      try { localStorage.setItem("secilmisButulka", b.id); } catch (e) {}
      document.dispatchEvent(new CustomEvent("butulka-secildi", { detail: b }));
      bagla();
    };
    siyahi.appendChild(item);
  });

  // Yaşıl X düyməsi
  const x = document.createElement("button");
  x.type = "button";
  x.style.cssText =
    "position:absolute;right:3vw;bottom:3vw;width:14vw;height:14vw;border-radius:50%;border:0;padding:0;" +
    "background:#8cc63f;box-shadow:0 1vw 3vw rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;";
  x.innerHTML =
    '<svg viewBox="0 0 24 24" width="60%" height="60%" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round">' +
    '<line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>';
  x.onclick = () => bagla();
  panel.appendChild(x);

  document.body.appendChild(panel);

  function ac() { panel.style.display = "flex"; }
  function bagla() { panel.style.display = "none"; }

  document.addEventListener("menyu-sec", (e) => {
    if (e.detail === "butulka") ac();
  });
})();
