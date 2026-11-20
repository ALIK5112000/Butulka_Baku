import { rtdb, fsdb } from "../core/firebase.js";
import { MASA_NOMRESI } from "../core/config.js";
import { cariOyuncu, toast } from "./yardimci.js";
import { dostBolmesi } from "./dostlar.js";
import { ref, get, remove, onValue } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { doc, getDoc, updateDoc, runTransaction, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

document.head.insertAdjacentHTML("beforeend", '<link rel="stylesheet" href="css/masalar.css">');

const cari = cariOyuncu() || {};
const QIYMET = 5000, GUN30 = 30 * 86400000, ADMIN = "511";
const xetaGoster = (e) => toast("Xəta: " + ((e && (e.message || (e.reason && e.reason.message))) || e));
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
const kilidli = async (n) => { const d = await melumat(n); return !!(d && d.parolHash); };

const SON = "sonMasalar_" + cari.docId;
const sonlar = () => { try { return JSON.parse(localStorage.getItem(SON)) || []; } catch (e) { return []; } };
function sonaYaz(n) {
  const a = sonlar().filter((x) => x !== String(n)); a.unshift(String(n));
  localStorage.setItem(SON, JSON.stringify(a.slice(0, 10)));
}

// masa.js bunu çağırır: parolu bilmədən şifrəli masaya girmək olmaz
export async function girisIcazesi(n) {
  n = String(n);
  const d = n === ADMIN ? null : await melumat(n);
  const ok = !d || !d.parolHash || d.sahib === cari.docId || sessionStorage.getItem("icaze_" + n) === d.parolHash;
  if (ok) sonaYaz(n);
  return ok;
}

async function git(n) {
  sessionStorage.setItem("sonMasa", MASA_NOMRESI);
  // Köhnə masadakı yerini dərhal boşalt (iki masada eyni anda görünməsin)
  try {
    const yolu = `masalar/${MASA_NOMRESI}/oturacaqlar`;
    const hamisi = (await get(ref(rtdb, yolu))).val() || {};
    await Promise.all(Object.keys(hamisi)
      .filter((k) => hamisi[k] && hamisi[k].uid === cari.docId)
      .map((k) => remove(ref(rtdb, `${yolu}/${k}`))));
    await remove(ref(rtdb, `masalar/${MASA_NOMRESI}/opus/${cari.docId}`));
    await remove(ref(rtdb, "prezans/" + cari.docId));
  } catch (e) {}
  location.href = "oyun.html?masa=" + n;
}

// ---------- Pəncərə köməkçiləri ----------
const yer = document.createElement("div"); yer.id = "modalYer"; document.body.appendChild(yer);
let unsubs = [];
const ac = (html) => { bagla(); yer.innerHTML = html; yer.style.display = "block"; };
function bagla() { unsubs.forEach((f) => f()); unsubs = []; yer.style.display = "none"; yer.innerHTML = ""; }
function nomreOxu(v) {
  v = String(v).trim();
  if (!/^\d{1,6}$/.test(v) || +v < 1) return null;
  return String(+v);
}

// ---------- Geri sayım düyməsi (9 → 0) ----------
const yBtn = [...document.querySelectorAll("#ustPanel .ub")].pop();
const ikon = yBtn.innerHTML;
let sayac = 9;
const goster = () => { yBtn.innerHTML = sayac > 0 ? `<b class="gerisay">${sayac}</b>` : ikon; };
goster();
const gozle = setInterval(() => {
  if ($("oyunEkrani").classList.contains("aktiv")) {
    clearInterval(gozle);
    const t = setInterval(() => { sayac--; goster(); if (sayac <= 0) clearInterval(t); }, 1000);
  }
}, 200);
yBtn.onclick = () => { if (sayac > 0) return; deyisModal(); };
// ---------- Masanı dəyiş ----------
export async function deyisModal() {
  ac(`<div class="mk"><button class="mx" id="mX">✕</button><h2>Masanı dəyiş</h2>
    <div class="et">🔍 Masa axtar</div>
    <div class="arama"><input id="mAra" type="text" inputmode="numeric" placeholder="Masa nömrəsi, məs. 666"><button class="btn-get" id="mGet">Get</button></div>
    <button class="btn-tes" id="mTes">Təsadüfi seçilmiş masa!</button>
    <button class="btn-yar" id="mYar">👑 Masa yarat / Mənim masam</button>
    <div class="bolum">Dostlar və tanışlar</div><div class="siyahi" id="mDost"></div>
    <div class="bolum">Ən son baş çəkmiş olduğun masalar</div><div class="siyahi" id="mSiya"></div></div>`);
  $("mX").onclick = bagla;
  $("mGet").onclick = () => masayaGir($("mAra").value);
  $("mAra").addEventListener("keydown", (e) => { if (e.key === "Enter") masayaGir($("mAra").value); });
  $("mTes").onclick = tesadufi;
  $("mYar").onclick = yaratModal;
  unsubs.push(dostBolmesi($("mDost"), masayaGir, IK_O, IK_Q));

  let sahibler = [];
  try {
    const q = await getDocs(query(collection(fsdb, "masalar"), where("sahib", "==", cari.docId)));
    sahibler = q.docs.filter((d) => d.data().bitis > Date.now()).map((d) => d.id);
  } catch (e) {}
  const nums = [...sahibler, ...sonlar().filter((x) => !sahibler.includes(x))];
  const box = $("mSiya"); if (!box) return;
  nums.forEach((n) => {
    const r = document.createElement("div"); r.className = "sira";
    r.innerHTML = `<div class="mtum"><img src="images/butulka/butulka.png" alt=""></div><div class="mad"><span class="kl"></span>#${n}</div>` +
      `<div class="say"><span>${IK_O}<b class="so">0</b></span><span>${IK_Q}<b class="sq">0</b></span></div>`;
    r.onclick = () => masayaGir(n);
    box.appendChild(r);
    kilidli(n).then((k) => { if (k) r.querySelector(".kl").textContent = "🔒 "; });
    unsubs.push(onValue(ref(rtdb, `masalar/${n}/oturacaqlar`), (s) => {
      const v = Object.values(s.val() || {}).filter(Boolean);
      r.querySelector(".sq").textContent = v.filter((x) => x.cins === "q").length;
      r.querySelector(".so").textContent = v.filter((x) => x.cins !== "q").length;
    }));
  });
}

async function masayaGir(v) {
  const n = nomreOxu(v);
  if (!n) return toast("Masa nömrəsi 1-999999 arasında olmalıdır");
  if (n === MASA_NOMRESI) { bagla(); return; }
  const d = n === ADMIN ? null : await melumat(n);
  if (d && d.parolHash && d.sahib !== cari.docId) return parolModal(n, d);
  git(n);
}

async function tesadufi() {
  for (let k = 0; k < 20; k++) {
    const n = String(1 + Math.floor(Math.random() * 40));
    if (n === MASA_NOMRESI || (await kilidli(n))) continue;
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
