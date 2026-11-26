import { rtdb, fsdb } from "../core/firebase.js";
import { MASA_NOMRESI } from "../core/config.js";
import { cariOyuncu } from "./yardimci.js";
import { doc, runTransaction } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

// ===== Butulka seçimi paneli (aşağıdan açılır) =====
const QOVLUQ = "images/butulka/";
const PANEL_TOP_VW = 122;      // panelin başladığı yer. Aşağı-yuxarı etmək üçün dəyiş
const BUTULKA_OLCU_VW = 34;    // masadakı butulka şəklinin kvadrat ölçüsü (vw)

const BUTULKALAR = [
  { id: "vip",        ad: "VIP",            fayl: "vip.png",        qiymet: 10 },
  { id: "butulka",    ad: "Butulka",        fayl: "butulka.png",    qiymet: 5 },
  { id: "energy",     ad: "Butulka Energy", fayl: "energy.png",     qiymet: 5 },
  { id: "viski_mavi", ad: "Mavi Viski",     fayl: "viski_mavi.png", qiymet: 5 },
  // yeni butulka: şəkli images/butulka/ qovluğuna yüklə, bura bir sətir yaz
];

(function butulkaQur() {
  if (document.getElementById("butulkaPanel")) return;

  const UREK =
    '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 21s-8-5.2-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.8-8 11-8 11z" fill="#ff6a13"/></svg>';

  const butulkaRef = ref(rtdb, `masalar/${MASA_NOMRESI}/butulka`);
  let masadakiId = null;   // masada hazırda hansı butulka var
  let mesgul = false;      // ikiqat toxunuşdan qorunma

  function toast(metn) {
    const t = document.createElement("div");
    t.textContent = metn;
    t.style.cssText =
      "position:fixed;left:50%;bottom:24vw;transform:translateX(-50%);z-index:10001;background:rgba(0,0,0,.82);" +
      "color:#fff;padding:2.6vw 4.5vw;border-radius:3vw;font:600 3.8vw Roboto,Arial,sans-serif;max-width:80vw;text-align:center;";
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  // ---- panel ----
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
    item.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:1vw;cursor:pointer;";

    const qutu = document.createElement("div");
    qutu.style.cssText = "width:16vw;height:16vw;display:flex;align-items:center;justify-content:center;";
    const img = document.createElement("img");
    img.src = QOVLUQ + b.fayl;
    img.alt = "";
    // 45° əyilmiş butulka xananı doldurur (referansdakı kimi)
    img.style.cssText =
      "width:19vw;height:19vw;flex:none;object-fit:contain;transform:rotate(45deg);pointer-events:none;";
    img.onerror = () => item.remove();   // şəkil yoxdursa, xana görünmür
    qutu.appendChild(img);

    const qiy = document.createElement("div");
    qiy.style.cssText = "display:flex;align-items:center;gap:1.2vw;font-size:4vw;font-weight:700;color:#222;";
    qiy.innerHTML = '<span style="width:6.2vw;height:6.2vw;display:flex;">' + UREK + "</span>" + b.qiymet;

    item.appendChild(qutu);
    item.appendChild(qiy);
    item.onclick = () => al(b);
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
  document.addEventListener("menyu-sec", (e) => { if (e.detail === "butulka") ac(); });

  // Ürəyi dəyiş (Firestore tranzaksiyası). delta mənfi = çıx, müsbət = geri qaytar
  function urekDeyis(userRef, delta, yoxla) {
    return runTransaction(fsdb, async (tx) => {
      const s = await tx.get(userRef);
      const urek = (s.data() && s.data().hearts) || 0;
      if (yoxla && urek + delta < 0) throw new Error("AZ_UREK");
      tx.update(userRef, { hearts: urek + delta });
    });
  }

  // ---- ALMAQ ----
  async function al(b) {
    if (mesgul) return;
    const cari = cariOyuncu();
    if (!cari || !cari.docId) { toast("Əvvəlcə daxil ol"); return; }
    if (masadakiId === b.id) { bagla(); return; }     // masada artıq bu var: pul tutulmur

    mesgul = true;
    const userRef = doc(fsdb, "users", cari.docId);
    try {
      await urekDeyis(userRef, -b.qiymet, true);       // 1) ürək çıxılır
      try {
        await set(butulkaRef, { id: b.id, fayl: b.fayl, kim: cari.docId, vaxt: Date.now() });   // 2) masaya yazılır
        bagla();
      } catch (e) {
        await urekDeyis(userRef, b.qiymet, false).catch(() => {});   // masaya yazılmadısa ürək geri qaytarılır
        throw e;
      }
    } catch (e) {
      toast(e.message === "AZ_UREK" ? "Kifayət qədər ürək yoxdur" : "Xəta baş verdi, yenidən cəhd edin");
      console.error("butulka al:", e);
    }
    mesgul = false;
  }

  // ---- HAMI GÖRSÜN: masadakı butulkanı canlı yenilə ----
  function masadaGoster(b) {
    const el = document.getElementById("butulka");
    if (!el) { console.warn("Masadakı #butulka elementi tapılmadı"); return; }
    el.src = QOVLUQ + b.fayl;
    el.style.width = BUTULKA_OLCU_VW + "vw";
    el.style.height = BUTULKA_OLCU_VW + "vw";
    el.style.objectFit = "contain";
  }

  onValue(butulkaRef, (s) => {
    const d = s.val();
    if (!d || !d.id) return;
    masadakiId = d.id;
    const b = BUTULKALAR.find((z) => z.id === d.id);
    if (b) masadaGoster(b);
    document.dispatchEvent(new CustomEvent("butulka-secildi", { detail: b || d }));
  });
})();
