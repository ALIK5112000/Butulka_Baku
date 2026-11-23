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
const ikon = '<img src="data:image/png;base64,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" alt="" style="width:64.8%;height:auto;display:block;pointer-events:none">';
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
