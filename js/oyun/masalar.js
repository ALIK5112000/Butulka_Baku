import { rtdb, fsdb } from "../core/firebase.js";
import { MASA_NOMRESI, OTURACAQ_SAYI } from "../core/config.js";
import { cariOyuncu, toast } from "./yardimci.js";
import { dostBolmesi } from "./dostlar.js";
import { ref, get, remove, onValue } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { doc, getDoc, updateDoc, runTransaction, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

document.head.insertAdjacentHTML("beforeend", '<link rel="stylesheet" href="css/masalar.css">');

const cari = cariOyuncu() || {};
const QIYMET = 5000, GUN30 = 30 * 86400000, ADMIN = "511";
const $ = (id) => document.getElementById(id);
const xetaGoster = (e) => toast("Xəta: " + ((e && (e.message || (e.reason && e.reason.message))) || e) + (e && e.filename ? " [" + e.filename.split("/").pop() + ":" + e.lineno + "]" : ""));
window.addEventListener("unhandledrejection", xetaGoster);
window.addEventListener("error", xetaGoster);
const COIN = '<svg class="coin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#f5b800"/><circle cx="12" cy="12" r="8" fill="#ffd84d" stroke="#d99a00" stroke-width="1.5"/><path d="M12 6l1.8 3.8 4.2.5-3.1 2.9.8 4.1L12 15.2 8.3 17.3l.8-4.1L6 10.3l4.2-.5z" fill="#d99a00"/></svg>';
const IK_O = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#cfcfcf"/><path d="M5 11C4 4 20 4 19 11C16 7 8 7 5 11Z" fill="#8c8c8c"/><circle cx="9" cy="13.5" r="1.2" fill="#fff"/><circle cx="15" cy="13.5" r="1.2" fill="#fff"/></svg>';
const IK_Q = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#cfcfcf"/><path d="M4 18C2 6 8 3 12 3C16 3 22 6 20 18C19 12 17 8 12 8C7 8 5 12 4 18Z" fill="#8c8c8c"/><circle cx="9" cy="13.5" r="1.2" fill="#fff"/><circle cx="15" cy="13.5" r="1.2" fill="#fff"/></svg>';

async function hash(s) {
  if (!s) return "";
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("butulka:" + s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
// Aktiv (müddəti bitməmiş) masa məlumatı; yoxdursa null (adi masa)
async function melumat(n) {
  const s = await getDoc(doc(fsdb, "masalar", String(n)));
  const d = s.exists() ? s.data() : null;
  return d && d.bitis > Date.now() ? d : null;
}
// Kilid məlumatı telefonda yadda qalır: pəncərə açılanda kilid işarəsi dərhal görünür (sonra arxada yenilənir)
const KK = "kilitK2";
const kilitKesh = new Map();
try { Object.entries(JSON.parse(localStorage.getItem(KK)) || {}).forEach(([k, v]) => kilitKesh.set(k, v)); } catch (e) {}
const kilitSaxla = () => { try { localStorage.setItem(KK, JSON.stringify(Object.fromEntries(kilitKesh))); } catch (e) {} };
const kilitOxu = (n) => { const k = kilitKesh.get(String(n)); return k ? k.v : undefined; };
const kilidli = async (n) => {
  n = String(n);
  const k = kilitKesh.get(n);
  if (k && Date.now() - k.t < 30000) return k.v;
  const d = await melumat(n);
  const v = !!(d && d.parolHash);
  kilitKesh.set(n, { v, t: Date.now() });
  kilitSaxla();
  return v;
};
// Özünə məxsus masalar da telefonda yadda qalır: pəncərə açılanda ən üstdə dərhal görünür
const SAHIB = "sahibMasalar_" + cari.docId;
const sahibOxu = () => { try { const x = JSON.parse(localStorage.getItem(SAHIB)); return Array.isArray(x) ? x.map(String) : []; } catch (e) { return []; } };
const sahibYaz = (a) => { try { localStorage.setItem(SAHIB, JSON.stringify(a)); } catch (e) {} };
// Hər masadakı oğlan/qız sayı son bilinən dəyərlə dərhal görünür, sonra canlı yenilənir
const sayKesh = new Map();

// ---------- Son baş çəkilən masalar: telefonda (dərhal açılsın) + hesabda (Firestore, itməsin) ----------
const SON = "sonMasalar_" + cari.docId;
function sonOxu() {
  try {
    const x = JSON.parse(localStorage.getItem(SON));
    if (Array.isArray(x)) return { a: x.map(String), t: 0 };                       // köhnə format
    if (x && Array.isArray(x.a)) return { a: x.a.map(String), t: Number(x.t) || 0 };
  } catch (e) {}
  return { a: [], t: 0 };
}
const sonlar = () => sonOxu().a;
function sonYaz(a, t) {
  try { localStorage.setItem(SON, JSON.stringify({ a: a.slice(0, 10), t })); } catch (e) {}
}
function sonFs(a, t) {
  if (!cari.docId) return;
  updateDoc(doc(fsdb, "users", cari.docId), { sonMasalar: a.slice(0, 10), sonMasalarT: t }).catch(() => {});
}
let sonYenile = null;   // pəncərə açıqdırsa siyahını tamamlayır
function sonaYaz(n) {
  const a = sonlar().filter((x) => x !== String(n)); a.unshift(String(n));
  const t = Date.now();
  sonYaz(a, t);
  sonFs(a, t);
}
// Oyuna girəndə hesabdakı siyahı ilə sinxronlaşırıq: başqa cihazda və ya təmizlənmiş brauzerdə də siyahı qalır
(async () => {
  if (!cari.docId) return;
  try {
    const d = (await getDoc(doc(fsdb, "users", cari.docId))).data() || {};
    const L = sonOxu();
    const sT = Number(d.sonMasalarT) || 0;
    if (Array.isArray(d.sonMasalar) && d.sonMasalar.length && sT > L.t) {
      sonYaz(d.sonMasalar.map(String), sT);                 // hesabdakı daha təzədir
      if (sonYenile) sonYenile();
    } else if (L.a.length && L.t > sT) {
      sonFs(L.a, L.t);                                      // telefondakı daha təzədir: hesaba yaz
    } else if (L.a.length && !Array.isArray(d.sonMasalar)) {
      sonFs(L.a, L.t || Date.now());                        // hesabda hələ yoxdur: köhnə siyahını köçür
    }
  } catch (e) {}
})();

// masa.js bunu çağırır: parolu bilmədən şifrəli masaya girmək olmaz
export async function girisIcazesi(n) {
  n = String(n);
  const d = n === ADMIN ? null : await melumat(n);
  const ok = !d || !d.parolHash || d.sahib === cari.docId || sessionStorage.getItem("icaze_" + n) === d.parolHash;
  if (ok) sonaYaz(n);
  return ok;
}

async function git(n) {
  window.__masaCixir = true;   // masa.js yerimi yenidən bərpa etməsin
  sessionStorage.setItem("sonMasa", MASA_NOMRESI);
  // Köhnə masadakı yerini boşalt (ən çox 1,5 san gözlə, sonra hər halda keç)
  const temizle = (async () => {
    const yolu = `masalar/${MASA_NOMRESI}/oturacaqlar`;
    const hamisi = (await get(ref(rtdb, yolu))).val() || {};
    await Promise.all(Object.keys(hamisi)
      .filter((k) => hamisi[k] && hamisi[k].uid === cari.docId)
      .map((k) => remove(ref(rtdb, `${yolu}/${k}`))));
    await remove(ref(rtdb, `masalar/${MASA_NOMRESI}/opus/${cari.docId}`));
    await remove(ref(rtdb, "prezans/" + cari.docId));
  })().catch(() => {});
  await Promise.race([temizle, new Promise((r) => setTimeout(r, 1500))]);
  location.href = "oyun.html?masa=" + n;
}

// ---------- Pəncərə köməkçiləri ----------
const yer = document.createElement("div"); yer.id = "modalYer"; document.body.appendChild(yer);
yer.addEventListener("pointerdown", (e) => {
  const t = e.target.closest && e.target.closest(".btn-get,.btn-tes,.btn-yar,.sira,.mx");
  if (!t || !yer.contains(t)) return;
  const r = t.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2;
  const s = document.createElement("span");
  s.className = "rpl";
  s.style.cssText = "width:" + d + "px;height:" + d + "px;left:" + (e.clientX - r.left - d / 2) + "px;top:" + (e.clientY - r.top - d / 2) + "px";
  if (getComputedStyle(t).position === "static") t.style.position = "relative";
  t.appendChild(s);
  setTimeout(() => s.remove(), 650);
});
// Dost/masa sətirində harasına bassan (şəkil və ya ad) yalnız həmin masaya getsin; ada basanda hədiyyə açılmasın
yer.addEventListener("click", (e) => {
  const s = e.target.closest && e.target.closest(".sira");
  if (!s || !yer.contains(s)) return;
  e.stopPropagation();
  e.preventDefault();
  if (typeof s.onclick === "function") s.onclick(e);
}, true);
// Pəncərənin kənarındakı boş yerə toxunanda bağlanır
yer.addEventListener("click", (e) => { if (e.target === yer) bagla(); });
let unsubs = [];
const ac = (html) => { bagla(); yer.innerHTML = html; yer.style.display = "block"; };
function bagla() { unsubs.forEach((f) => f()); unsubs = []; sonYenile = null; yer.style.display = "none"; yer.innerHTML = ""; }
function nomreOxu(v) {
  v = String(v).trim();
  if (!/^\d{1,6}$/.test(v) || +v < 1) return null;
  return String(+v);
}

// ---------- Geri sayım düyməsi (9 → 0) ----------
const yBtn = [...document.querySelectorAll("#ustPanel .ub")].pop();
// İkon: referans şəkildəki iki dairəvi ox (ağ, parıltılı), şəkildən birbaşa götürülüb
// >>>>>> DİQQƏT: aşağıdakı sətri sil və yerinə KÖHNƏ masalar.js faylındakı "const ikon = '<img src="data:image/png;base64,...";" sətrini yapışdır <<<<<<
const ikon = "";
// Rəqəm: "Masa 511" yazısının şrifti, ölçüsü, rəngi və parıltısı ilə eyni (yazıdan oxunur)
const sayiStil = (() => {
  try {
    const l = [...document.querySelectorAll("#ustPanel *")]
      .filter((e) => /^\s*Masa/.test(e.textContent))
      .sort((x, y) => x.getElementsByTagName("*").length - y.getElementsByTagName("*").length)[0];
    if (!l) return "";
    const c = getComputedStyle(l);
    return `font-family:${c.fontFamily};font-size:${c.fontSize};font-weight:${c.fontWeight};line-height:1;color:${c.color};text-shadow:${c.textShadow};letter-spacing:${c.letterSpacing};`;
  } catch (e) { return ""; }
})();
let sayac = 9, sayT = null;
const goster = () => { yBtn.innerHTML = sayac > 0 ? `<b class="gerisay" style="${sayiStil}">${sayac}</b>` : ikon; };
goster();
function baslatSayac() {
  clearInterval(sayT);
  sayac = 9; goster();
  sayT = setInterval(() => { sayac--; goster(); if (sayac <= 0) clearInterval(sayT); }, 1000);
}
const gozle = setInterval(() => {
  if ($("oyunEkrani").classList.contains("aktiv")) { clearInterval(gozle); baslatSayac(); }
}, 200);
// Masada yer dəyişəndə (masa.js "oyuncuYerDeyisdi" göndərir) oxlar yox olur, 9 saniyə geri sayım gedir
window.addEventListener("oyuncuYerDeyisdi", (e) => { if (e.detail && e.detail.uid === cari.docId) baslatSayac(); });
yBtn.onclick = () => { if (sayac > 0) return; deyisModal(); };

// ---------- Masanı dəyiş ----------
export async function deyisModal() {
  // 1) Karkas dərhal çəkilir (şəbəkə gözlənmir)
  ac(`<div class="mk"><button class="mx" id="mX">✕</button><h2>Masanı dəyiş</h2><div class="mb" id="mB">
    <div class="et">🔍 Masa axtar</div>
    <div class="arama"><input id="mAra" type="text" inputmode="numeric" placeholder="Masa nömrəsi, məs. 666"><button class="btn-get" id="mGet">Get</button></div>
    <button class="btn-tes" id="mTes">Təsadüfi seçilmiş masa!</button>
    <button class="btn-yar" id="mYar">👑 Masa yarat / Mənim masam</button>
    <div class="bolum">Dostlar və tanışlar</div><div class="siyahi" id="mDost"></div>
    <div class="bolum">Ən son baş çəkmiş olduğun masalar</div><div class="siyahi" id="mSiya"></div></div></div>`);
  $("mX").onclick = bagla;
  $("mB").addEventListener("scroll", () => $("mB").parentElement.classList.toggle("kay", $("mB").scrollTop > 4), { passive: true });
  $("mGet").onclick = () => masayaGir($("mAra").value);
  $("mAra").addEventListener("keydown", (e) => { if (e.key === "Enter") masayaGir($("mAra").value); });
  $("mTes").onclick = tesadufi;
  $("mYar").onclick = yaratModal;

  const dostBox = $("mDost"), box = $("mSiya");
  const satirlar = new Map(), bekle = [];
  let hazir = false;

  const kilitGoster = (r, k) => { r.querySelector(".kl").textContent = k ? "🔒 " : ""; };
  // Canlı say: ağır iş ilk çəkilişdən SONRA qoşulur
  function canli(n, r) {
    unsubs.push(onValue(ref(rtdb, `masalar/${n}/oturacaqlar`), (s) => {
      const v = Object.values(s.val() || {}).filter(Boolean);
      const q = v.filter((x) => x.cins === "q").length, o = v.filter((x) => x.cins !== "q").length;
      sayKesh.set(n, { o, q });
      r.querySelector(".sq").textContent = q;
      r.querySelector(".so").textContent = o;
    }));
  }
  function masaSirasi(n, basa) {
    n = String(n);
    const var_ = satirlar.get(n);
    if (var_) { if (basa && box.firstChild !== var_) box.prepend(var_); return; }
    const r = document.createElement("div"); r.className = "sira";
    r.innerHTML = `<div class="mtum"><img src="images/butulka/butulka.png" alt=""></div><div class="mad"><span class="kl"></span>#${n}</div>` +
      `<div class="say"><span>${IK_O}<b class="so">0</b></span><span>${IK_Q}<b class="sq">0</b></span></div>`;
    // Təpik qadağası: masa nömrəsinin altında real vaxtla azalan sayğac (tik() yeniləyir)
    r.querySelector(".mad").insertAdjacentHTML("beforeend", '<div class="tsay" style="display:none;color:#e8335f;font-weight:700;font-size:.8em"></div>');
    r.dataset.masaId = n;
    const k0 = sayKesh.get(n);
    if (k0) { r.querySelector(".so").textContent = k0.o; r.querySelector(".sq").textContent = k0.q; }
    kilitGoster(r, kilitOxu(n));            // telefondakı yaddaşdan: sıçrayış olmasın
    r.onclick = () => masayaGir(n);
    satirlar.set(n, r);
    if (basa) box.prepend(r); else box.appendChild(r);
    if (hazir) { canli(n, r); kilidli(n).then((k) => { if (r.isConnected) kilitGoster(r, k); }); }
    else bekle.push([n, r]);
  }

  // Son 5 masa + özünə məxsus masalar (telefondan dərhal), ən üstdə alınmış masa
  const son5 = () => sonlar().slice(0, 5);
  son5().forEach((n) => masaSirasi(n));

  // Təpik qadağası olan masalar siyahıda ən üstdə görünür və altında geri sayım gedir
  const TV = window.TepikVur;
  if (TV) {
    TV.qadagaMasalari().forEach((n) => masaSirasi(n, true));
    const tik = () => satirlar.forEach((r, n) => {
      const t = r.querySelector(".tsay"); if (!t) return;
      const q = TV.qadagaQalan(n);
      t.style.display = q > 0 ? "block" : "none";
      if (q > 0) t.textContent = "⏱ " + TV.dqSan(q);
    });
    tik();
    const tikT = setInterval(tik, 500);
    unsubs.push(() => clearInterval(tikT));
  }

  sahibOxu().slice().reverse().forEach((n) => masaSirasi(n, true));
  sonYenile = () => { if (box.isConnected) son5().forEach((n) => masaSirasi(n)); };

  // 2) Ağır işlər ilk çəkilişdən sonra: pəncərə dərhal açılır, donma olmur
  requestAnimationFrame(() => setTimeout(async () => {
    if (!box.isConnected) return;
    hazir = true;
    unsubs.push(dostBolmesi(dostBox, masayaGir, IK_O, IK_Q));
    bekle.splice(0).forEach(([n, r]) => {
      canli(n, r);
      kilidli(n).then((k) => { if (r.isConnected) kilitGoster(r, k); });
    });
    try {
      const q = await getDocs(query(collection(fsdb, "masalar"), where("sahib", "==", cari.docId)));
      const sahibler = q.docs.filter((d) => d.data().bitis > Date.now()).map((d) => d.id);
      if (!box.isConnected) return;
      const eski = sahibOxu();
      sahibYaz(sahibler);
      sahibler.slice().reverse().forEach((n) => { if (!satirlar.has(n)) masaSirasi(n, true); });
      // artıq sənin olmayan (müddəti bitmiş) masa yalnız son 5-də deyilsə siyahıdan çıxır
      eski.filter((n) => !sahibler.includes(n) && !son5().includes(n)).forEach((n) => {
        const r = satirlar.get(n); if (r) { r.remove(); satirlar.delete(n); }
      });
    } catch (e) {}
  }, 0));
}

async function masayaGir(v) {
  const n = nomreOxu(v);
  if (!n) return toast("Masa nömrəsi 1-999999 arasında olmalıdır");
  // Təpik qadağası: bu masaya girmək olmaz, qadağa pəncərəsi göstərilir
  if (window.TepikVur && window.TepikVur.qadagaVarmi(n)) return;
  if (n === MASA_NOMRESI) {
    // Artıq bu masadayam: pəncərəni bağla və təsadüfi başqa boş yerə keç
    bagla();
    Promise.resolve(window.yerDeyis && window.yerDeyis()).then((ok) => {
      if (ok === false) toast("Bu masada boş yer yoxdur");
    });
    return;
  }
  const d = n === ADMIN ? null : await melumat(n);
  if (d && d.parolHash && d.sahib !== cari.docId) return parolModal(n, d);
  git(n);
}

async function tesadufi() {
  for (let k = 0; k < 20; k++) {
    const n = String(1 + Math.floor(Math.random() * 40));
    if (window.TepikVur && window.TepikVur.qadagaVarmi(n, true)) continue;   // qadağalı masa seçilməsin
    if (n === MASA_NOMRESI || (await kilidli(n))) continue;
    // dolu masaya düşməsin
    const dolu = Object.values((await get(ref(rtdb, `masalar/${n}/oturacaqlar`))).val() || {}).filter(Boolean).length;
    if (dolu >= OTURACAQ_SAYI) continue;
    return git(n);
  }
  toast("Uyğun masa tapılmadı");
}

// ---------- Parol pəncərəsi ----------
function parolModal(n, d) {
  ac(`<div class="mk2"><button class="mx2" id="pX">✕</button><div class="ic"><h2>🔒 Masa #${n}</h2>
    <p>Bu masa parolludur. Girmək üçün parolu yaz.</p>
    <input id="pInp" type="text" placeholder="Parol" style="margin-top:4vw"></div>
    <div class="alt"><button class="ok" id="pGir">Daxil ol</button><button class="ig" id="pLegv">Ləğv et</button></div></div>`);
  $("pX").onclick = $("pLegv").onclick = bagla; // olduğun masada qalırsan
  $("pGir").onclick = async () => {
    const h = await hash($("pInp").value.trim());
    if (h === d.parolHash) { sessionStorage.setItem("icaze_" + n, h); git(n); }
    else toast("Parol yanlışdır");
  };
}

// ---------- Masa yarat / Mənim masam ----------
async function masaAl(n, parolHash) {
  const mref = doc(fsdb, "masalar", n), uref = doc(fsdb, "users", cari.docId);
  await runTransaction(fsdb, async (tx) => {
    const m = await tx.get(mref), u = await tx.get(uref);
    if (m.exists() && m.data().bitis > Date.now()) throw new Error("MESGUL");
    const j = Number((u.data() || {}).jetons || 0);
    if (j < QIYMET) throw new Error("JETON");
    tx.update(uref, { jetons: j - QIYMET });
    tx.set(mref, { sahib: cari.docId, sahibAd: u.data().username || "", parolHash, yaradildi: Date.now(), bitis: Date.now() + GUN30 });
  });
  kilitKesh.delete(String(n));
}

async function yaratModal() {
  const m = await melumat(MASA_NOMRESI);
  const menimki = m && m.sahib === cari.docId;
  const gun = menimki ? Math.ceil((m.bitis - Date.now()) / 86400000) : 0;
  const sahibHTML = menimki
    ? `<div class="sahib">Sənin masan #${MASA_NOMRESI}: ${gun} gün qalıb<input id="yPar2" type="text" placeholder="Yeni şifrə (boş = sil)" style="margin-top:2vw"><button id="yYenile">Şifrəni yenilə</button></div>`
    : "";
  ac(`<div class="mk2"><button class="mx2" id="yX">✕</button><div class="ic"><h2>Masa yarat</h2>
    <p>Öz masan: ${QIYMET} ${COIN}, 30 gün sənindir. Şifrə yazsan, masaya yalnız şifrəni bilənlər gir bilər. Sən masadan çıxsan da masa kilidli qalır (müddət bitənə qədər); 30 gün ərzində şifrəni istədiyin vaxt dəyişə və ya silə bilərsən. Müddət bitəndə masa adi masa olur. Jeton yalnız masa yaranında çıxılır.</p>
    ${sahibHTML}
    <label>Masa nömrəsi</label><input id="yNo" type="text" inputmode="numeric" placeholder="Masa nömrəsi: 1-999999 (boş - avtomatik)">
    <label>Şifrə</label><input id="yPar" type="text" placeholder="Şifrə (istəyə bağlı)"></div>
    <div class="alt"><button class="ok" id="yYarat">Yarat · ${COIN} ${QIYMET}</button><button class="ig" id="yLegv">Ləğv et</button></div></div>`);
  $("yX").onclick = $("yLegv").onclick = bagla;
  if (menimki) {
    $("yYenile").onclick = async () => {
      await updateDoc(doc(fsdb, "masalar", MASA_NOMRESI), { parolHash: await hash($("yPar2").value.trim()) });
      kilitKesh.delete(String(MASA_NOMRESI));
      toast("Şifrə yeniləndi"); bagla();
    };
  }
  let is = false;
  $("yYarat").onclick = async () => {
    if (is) return;
    let n = $("yNo").value.trim();
    if (n) { n = nomreOxu(n); if (!n) return toast("Masa nömrəsi 1-999999 arasında olmalıdır"); }
    if (n === ADMIN) return toast("Bu adminin masasıdır, ala bilməzsiniz");
    is = true;
    try {
      for (let k = 0; !n && k < 20; k++) {
        const t = String(1 + Math.floor(Math.random() * 999999));
        if (t !== ADMIN && !(await melumat(t))) n = t;
      }
      if (!n) { is = false; return toast("Boş nömrə tapılmadı, yenidən cəhd et"); }
      await masaAl(n, await hash($("yPar").value.trim()));
      toast("Masa yaradıldı! 30 gün sənindir");
      setTimeout(() => git(n), 800);
    } catch (e) {
      is = false;
      toast(e.message === "MESGUL" ? "Bu masa nömrəsi artıq istifadə olunur"
        : e.message === "JETON" ? "Kifayət qədər jetonunuz yoxdur" : "Xəta: " + e.message);
    }
  };
}
