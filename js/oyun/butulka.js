// ===== Butulka seçimi paneli (aşağıdan açılır) =====
const QOVLUQ = "images/butulka/";
const PANEL_TOP_VW = 122;   // panelin başladığı yer (masanın aşağı kənarı). Aşağı-yuxarı etmək üçün bunu dəyiş

const BUTULKALAR = [
  { id: "butulka",    ad: "Butulka",        fayl: "butulka.png",    qiymet: 5 },
  { id: "energy",     ad: "Butulka Energy", fayl: "energy.png",     qiymet: 5 },
  { id: "vip",        ad: "VIP",            fayl: "vip.png",        qiymet: 10 },
  { id: "viski_mavi", ad: "Mavi Viski",     fayl: "viski_mavi.png", qiymet: 5 },
  // yeni butulka: şəkli images/butulka/ qovluğuna yüklə, bura bir sətir yaz
];

(function butulkaQur() {
  if (document.getElementById("butulkaPanel")) return;

  const UREK =
    '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 21s-8-5.2-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.8-8 11-8 11z" fill="#ff6a13"/></svg>';

  const panel = document.createElement("div");
  panel.id = "butulkaPanel";
  panel.style.cssText =
    "position:fixed;left:0;right:0;bottom:0;top:" + PANEL_TOP_VW + "vw;display:none;z-index:9000;" +
    "background:#fff;font-family:Roboto,Arial,sans-serif;flex-direction:column;";

  const baslig = document.createElement("div");
  baslig.textContent = "Butulkanı dəyiş";
  baslig.style.cssText =
    "flex:none;height:11.7vw;display:flex;align-items:center;padding:0 4vw;" +
    "font-size:3.6vw;color:#b0b0b0;border-bottom:.3vw solid #e6e6e6;";
  panel.appendChild(baslig);

  const siyahi = document.createElement("div");
  siyahi.style.cssText =
    "flex:1;min-height:0;overflow-y:auto;display:grid;grid-template-columns:repeat(4,1fr);" +
    "align-content:start;row-gap:6vw;padding:2.5vw 1vw 22vw;-webkit-overflow-scrolling:touch;";
  panel.appendChild(siyahi);

  BUTULKALAR.forEach((b) => {
    const item = document.createElement("div");
    item.style.cssText =
      "display:flex;flex-direction:column;align-items:center;gap:1vw;cursor:pointer;";

    const qutu = document.createElement("div");
    qutu.style.cssText =
      "width:16vw;height:16vw;display:flex;align-items:center;justify-content:center;";
    const img = document.createElement("img");
    img.src = QOVLUQ + b.fayl;
    img.alt = "";
    // 45° əyilmiş butulka xananı doldurur (referansdakı kimi)
    img.style.cssText =
      "width:19vw;height:19vw;flex:none;object-fit:contain;transform:rotate(45deg);pointer-events:none;";
    img.onerror = () => item.remove();   // şəkil yoxdursa, xana görünmür
    qutu.appendChild(img);

    const qiy = document.createElement("div");
    qiy.style.cssText =
      "display:flex;align-items:center;gap:1.2vw;font-size:4vw;font-weight:700;color:#222;";
    qiy.innerHTML =
      '<span style="width:6.2vw;height:6.2vw;display:flex;">' + UREK + "</span>" + b.qiymet;

    item.appendChild(qutu);
    item.appendChild(qiy);
    item.onclick = () => {
      // Sonra bura ürək çıxma / alma məntiqini bağlayacağıq
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
    "position:absolute;right:2.2vw;bottom:2.2vw;width:8.4vw;height:8.4vw;border-radius:50%;border:0;padding:0;" +
    "background:#8cc63f;box-shadow:0 1vw 3vw rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;";
  x.innerHTML =
    '<svg viewBox="0 0 24 24" width="62%" height="62%" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round">' +
    '<line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>';
  x.onclick = () => bagla();
  panel.appendChild(x);

  document.body.appendChild(panel);

  function ac() { panel.style.display = "flex"; siyahi.scrollTop = 0; }
  function bagla() { panel.style.display = "none"; }

  document.addEventListener("menyu-sec", (e) => {
    if (e.detail === "butulka") ac();
  });
})();
