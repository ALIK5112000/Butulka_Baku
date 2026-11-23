import { rtdb, fsdb } from "../core/firebase.js";
import { MASA_NOMRESI, OTURACAQ_SAYI } from "../core/config.js";
import { cinsTap, vipMi } from "./yardimci.js";
import { girisIcazesi } from "./masalar.js";
import { novbeBaxis, novbeBaslat } from "./novbe.js";
import { ref, get, set, remove, onValue, onDisconnect, runTransaction } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const yol = `masalar/${MASA_NOMRESI}/oturacaqlar`;
const masa = document.getElementById("masa");
const yerler = [];

// Aşağı sıradakı yerlərin (6,7,8,9) adı chat panelinin altında qalıb kəsilir: hələlik adlar gizlədilir.
// Adları qaytarmaq üçün siyahını boş yaz: const ALT_YERLER = [];
const ALT_YERLER = [6, 7, 8, 9];
document.head.insertAdjacentHTML("beforeend", "<style>.yer.alt-yer .ad{display:none!important}</style>");

for (let i = 0; i < OTURACAQ_SAYI; i++) {
  const d = document.createElement("div");
  d.className = "yer yer-" + i + (ALT_YERLER.includes(i) ? " alt-yer" : "");
  d.innerHTML = '<div class="foto"></div><div class="ad"></div>';
  masa.appendChild(d);
  yerler.push(d);
}

let aktivOyuncu = null;
let sonData = {};
let oturmusam = false;      // bu səhifədə bir dəfə oturmuşam (yer itərsə dərhal bərpa edək)
let berpaTimer = null;
// Oyundan çıxış edibsə (currentUser silinibsə) yer bərpa olunmasın
const girisVar = () => {
  try { const c = JSON.parse(localStorage.getItem("currentUser")); return !!(c && c.docId); } catch (e) { return false; }
};

// Əməliyyatlar növbə ilə işləyir ki, bir-birinin yerini silməsin (itib-gəlmənin əsas səbəbi bu idi)
let zencir = Promise.resolve();
function ardicil(fn) {
  const p = zencir.then(fn);
  zencir = p.catch(() => {});
  return p;
}

// Son oturduğum yer yadda qalır: geri qayıdanda eyni yerə otursun
const sonYerOxu = () => {
  try {
    const v = sessionStorage.getItem(`sonYer_${MASA_NOMRESI}_${aktivOyuncu && aktivOyuncu.uid}`);
    return v === null ? null : Number(v);
  } catch (e) { return null; }
};
const sonYerYaz = (i) => {
  try { sessionStorage.setItem(`sonYer_${MASA_NOMRESI}_${aktivOyuncu && aktivOyuncu.uid}`, String(i)); } catch (e) {}
};

function qarish(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cizdir(data) {
  sonData = data || {};
  const gorulen = new Set();   // eyni oyunçu iki yerdə görünməsin
  yerler.forEach((d, i) => {
    let o = sonData[i];
    if (o && gorulen.has(o.uid)) o = null;
    if (o) gorulen.add(o.uid);
    const sig = o ? o.uid + "|" + o.ad + "|" + o.sekil : "";
    if (d._sig === sig) return;      // dəyişməyən yer yenidən çəkilmir
    d._sig = sig;
    d.classList.toggle("dolu", !!o);
    if (o) {
      d.querySelector(".ad").textContent = o.ad;
      const s = o.sekil ? String(o.sekil).replace(/"/g, "%22") : "";
      d.querySelector(".foto").style.backgroundImage = s ? `url("${s}")` : "";
    } else {
      d.querySelector(".ad").textContent = "";
      d.querySelector(".foto").style.backgroundImage = "";
    }
  });
}

// Oyunçu bazanın cavabını gözləmədən dərhal görünsün
function yerliGoster(i, oyuncu) {
  const d = {};
  for (const k in sonData) if (sonData[k] && sonData[k].uid !== oyuncu.uid) d[k] = sonData[k];
  d[i] = oyuncu;
  cizdir(d);
}

// Yer müvəqqəti itibsə (köhnə bağlantının onDisconnect-i), bərpa olunana qədər oyunçu yerində görünsün
function gosterData(data) {
  if (oturmusam && aktivOyuncu && !window.__masaCixir && girisVar()) {
    const var_ = Object.values(data).some((o) => o && o.uid === aktivOyuncu.uid);
    if (!var_) {
      const i = sonYerOxu();
      if (i !== null && !data[i]) return { ...data, [i]: aktivOyuncu };
    } else {
      // Yer dəyişəndə bir an iki yerdə yazılı olur: yalnız yeni (son) yerdə göstər, titrəməsin
      const oz = Object.keys(data).filter((k) => data[k] && data[k].uid === aktivOyuncu.uid);
      const ev = String(sonYerOxu());
      if (oz.length > 1 && oz.includes(ev)) {
        const d = { ...data };
        oz.forEach((k) => { if (k !== ev) delete d[k]; });
        return d;
      }
    }
  }
  return data;
}

function yerItdiYoxla(data) {
  if (!oturmusam || !aktivOyuncu || window.__masaCixir || !girisVar()) return;
  clearTimeout(berpaTimer);
  const var_ = Object.values(data).some((o) => o && o.uid === aktivOyuncu.uid);
  if (var_) return;
  berpaTimer = setTimeout(() => {
    if (document.visibilityState === "visible") berpa();
  }, 250);
}

// Eyni uid-ə aid bütün köhnə yerləri sil (yalnız saxlaDediyin indeks qalsın)
async function dublikatlariSil(uid, saxlaIndeks = null) {
  const snap = await get(ref(rtdb, yol));
  const hamisi = snap.val() || {};
  const silinecekler = [];
  for (const k in hamisi) {
    if (hamisi[k] && hamisi[k].uid === uid && String(k) !== String(saxlaIndeks)) {
      const rk = ref(rtdb, `${yol}/${k}`);
      onDisconnect(rk).cancel().catch(() => {});   // köhnə yerdə qalan "çıxanda sil" başqasının yerini silməsin
      silinecekler.push(remove(rk));
    }
  }
  if (silinecekler.length) {
    await Promise.all(silinecekler);
  }
}

// Artıq oturduğum yeri saxla (lazım olmasa bazaya yenidən yazma)
async function saxla(oyuncu, k, movcud) {
  const r = ref(rtdb, `${yol}/${k}`);
  oturmusam = true;
  sonYerYaz(k);
  yerliGoster(k, oyuncu);
  const eyni = movcud && ["uid", "ad", "sekil", "vip", "cins"].every((f) => (movcud[f] || "") === (oyuncu[f] || ""));
  if (!eyni) await set(r, oyuncu);
  onDisconnect(r).remove().catch(() => {});
}

// Təsadüfi boş yer tapıb oturur. istisna = bu yerə oturma (yer dəyişəndə köhnə yer)
async function yerTutIc(oyuncu, istisna) {
  const hamisi = (await get(ref(rtdb, yol))).val() || {};

  if (istisna === null) {
    for (const k in hamisi) {
      if (hamisi[k] && hamisi[k].uid === oyuncu.uid) {
        await saxla(oyuncu, k, hamisi[k]);
        return true;
      }
    }
  }

  const bos = [];
  for (let i = 0; i < OTURACAQ_SAYI; i++) {
    if (!hamisi[i] && String(i) !== String(istisna)) bos.push(i);
  }
  qarish(bos);
  if (istisna === null) {                       // geri qayıdanda əvvəlki yerim boşdursa ora otur
    const ev = sonYerOxu();
    const p = bos.indexOf(ev);
    if (p > 0) { bos.splice(p, 1); bos.unshift(ev); }
  }

  for (const i of bos) {
    const r = ref(rtdb, `${yol}/${i}`);
    const netice = await runTransaction(r, (cur) => (cur ? undefined : oyuncu));
    if (netice.committed) {
      oturmusam = true;
      sonYerYaz(i);
      yerliGoster(i, oyuncu);                    // dərhal görünsün
      onDisconnect(r).remove().catch(() => {});
      if (istisna !== null) {
        // Yer dəyişmə: köhnə yeri dərhal boşalt (başqasının yerini silməsin deyə yalnız öz yazımı)
        const eski = ref(rtdb, `${yol}/${istisna}`);
        onDisconnect(eski).cancel().catch(() => {});
        runTransaction(eski, (cur) => (cur && cur.uid === oyuncu.uid ? null : undefined)).catch(() => {});
        window.dispatchEvent(new CustomEvent("oyuncuYerDeyisdi", { detail: { uid: oyuncu.uid, kohne: Number(istisna), yeni: i } }));
      }
      await dublikatlariSil(oyuncu.uid, i);      // köhnə yer varsa sil
      return true;
    }
  }
  return false;
}
const yerTut = (oyuncu) => yerTutIc(oyuncu, null);

async function oturacaqTap(oyuncu) {
  const hamisi = (await get(ref(rtdb, yol))).val() || {};
  const oz = Object.keys(hamisi).filter((k) => hamisi[k] && hamisi[k].uid === oyuncu.uid);

  if (oz.length > 0) {
    await saxla(oyuncu, oz[0], hamisi[oz[0]]);
    if (oz.length > 1) await dublikatlariSil(oyuncu.uid, oz[0]);
    return;
  }

  if (!(await novbeBaxis(oyuncu.uid)) && (await yerTut(oyuncu))) return;
  novbeBaslat(oyuncu, yerTut);
}

async function aktivOyuncuHazirla() {
  if (aktivOyuncu) return;
  let cari = null;
  try { cari = JSON.parse(localStorage.getItem("currentUser")); } catch (e) {}
  if (cari && cari.docId) {
    const snap = await getDoc(doc(fsdb, "users", cari.docId));
    if (snap.exists() && !snap.data().banned && !snap.data().gizli) {
      const p = snap.data();
      aktivOyuncu = {
        uid: cari.docId,
        ad: p.username || "Oyunçu",
        sekil: p.avatar || "",
        vip: vipMi(p),
        cins: cinsTap(p.gender)
      };
    }
  }
}

// Yerim itibsə bərpa et (növbə ilə, başqa əməliyyatla toqquşmasın)
function berpa() {
  return ardicil(async () => {
    if (window.__masaCixir || !girisVar()) return;
    try {
      await aktivOyuncuHazirla();
      if (!aktivOyuncu) return;
      await oturacaqTap(aktivOyuncu);
    } catch (e) {
      // qısamüddətli şəbəkə kəsintisində səssiz keç
    }
  });
}

// Masada yerimi dəyiş: təsadüfi başqa boş yerə keç (dostun masasındayamsa)
export function yerDeyis() {
  return ardicil(async () => {
    try {
      await aktivOyuncuHazirla();
      if (!aktivOyuncu) return false;
      const hamisi = (await get(ref(rtdb, yol))).val() || {};
      const oz = Object.keys(hamisi).filter((k) => hamisi[k] && hamisi[k].uid === aktivOyuncu.uid);
      if (!oz.length) return await yerTutIc(aktivOyuncu, null);
      return await yerTutIc(aktivOyuncu, oz[0]);
    } catch (e) {
      return false;
    }
  });
}
window.yerDeyis = yerDeyis;

// Oyundan tam çıxış: yeri, prezansı sil və bir daha bərpa etmə
export async function masadanCix() {
  window.__masaCixir = true;
  clearTimeout(berpaTimer);
  try {
    let uid = aktivOyuncu && aktivOyuncu.uid;
    if (!uid) { try { uid = (JSON.parse(localStorage.getItem("currentUser")) || {}).docId; } catch (e) {} }
    if (!uid) return;
    const hamisi = (await get(ref(rtdb, yol))).val() || {};
    await Promise.all(Object.keys(hamisi)
      .filter((k) => hamisi[k] && hamisi[k].uid === uid)
      .map((k) => remove(ref(rtdb, `${yol}/${k}`))));
    await remove(ref(rtdb, `masalar/${MASA_NOMRESI}/opus/${uid}`));
    await remove(ref(rtdb, "prezans/" + uid));
  } catch (e) {}
}
window.masadanCix = masadanCix;

// Səhifədən ayrılanda yer bərpa olunmasın (geri qayıdanda pageshow bunu sıfırlayır)
window.addEventListener("pagehide", () => { window.__masaCixir = true; });

// Çıxış düyməsi (#cixisBtn): yeri dərhal sil, bərpa etmə. Səhifədən getməsə (ləğv edilsə) 4 san sonra yenidən otur
document.addEventListener("click", (e) => {
  if (!(e.target.closest && e.target.closest("#cixisBtn"))) return;
  masadanCix();
  setTimeout(() => {
    if (document.visibilityState === "visible" && girisVar()) { window.__masaCixir = false; berpa(); }
  }, 4000);
}, true);

let yoxlaTimer = null;
function geriQayidandaYoxla() {
  if (document.visibilityState !== "visible") return;
  clearTimeout(yoxlaTimer);
  yoxlaTimer = setTimeout(() => {
    berpa();
    // köhnə bağlantının gecikmiş onDisconnect-i yeri silə bilər: bir də yoxla
    setTimeout(() => { if (document.visibilityState === "visible") berpa(); }, 1500);
  }, 150);
}

document.addEventListener("visibilitychange", geriQayidandaYoxla);
window.addEventListener("pageshow", (e) => {
  if (e.persisted) window.__masaCixir = false;
  geriQayidandaYoxla();
});
window.addEventListener("focus", geriQayidandaYoxla);

async function katil(cari, profilP) {
  try {
    const snap = await (profilP || getDoc(doc(fsdb, "users", cari.docId)));
    if (!snap.exists()) { location.href = "index.html"; return; }
    const p = snap.data();

    if (p.banned) {
      alert("Hesabınız bloklanıb");
      localStorage.removeItem("currentUser");
      location.href = "index.html";
      return;
    }

    if (p.gizli) return;

    aktivOyuncu = {
      uid: cari.docId,
      ad: p.username || "Oyunçu",
      sekil: p.avatar || "",
      vip: vipMi(p),
      cins: cinsTap(p.gender)
    };
    await ardicil(() => oturacaqTap(aktivOyuncu));
  } catch (e) {
    alert("Masa xətası: " + e.message);
  }
}

// Oyuna təzə girəndə (linkdə ?masa= yoxdur) kilidsiz və dolu olmayan təsadüfi masa seç
async function tesadufiMasaSec() {
  for (let k = 0; k < 15; k++) {
    const n = String(1 + Math.floor(Math.random() * 40));
    if (n === MASA_NOMRESI) continue;
    try {
      const m = await getDoc(doc(fsdb, "masalar", n));
      const md = m.exists() ? m.data() : null;
      if (md && md.bitis > Date.now() && md.parolHash) continue;          // kilidli masa
      const dolu = Object.values((await get(ref(rtdb, `masalar/${n}/oturacaqlar`))).val() || {}).filter(Boolean).length;
      if (dolu >= OTURACAQ_SAYI) continue;                                // dolu masa
      return n;
    } catch (e) {}
  }
  return null;
}

export async function masaniBasla() {
  let cari = null;
  try { cari = JSON.parse(localStorage.getItem("currentUser")); } catch (e) {}
  if (!cari || !cari.docId) { location.href = "index.html"; return; }

  // Hamı 511-ə düşməsin: linkdə masa nömrəsi yoxdursa təsadüfi masaya yönləndir
  if (!new URLSearchParams(location.search).has("masa")) {
    const n = await tesadufiMasaSec();
    if (n) { location.replace("oyun.html?masa=" + n); return; }
  }

  try {
    const profilP = getDoc(doc(fsdb, "users", cari.docId));   // profil paralel yüklənir
    profilP.catch(() => {});

    if (!(await girisIcazesi(MASA_NOMRESI))) {
      alert("Bu masa parolludur");
      const g = sessionStorage.getItem("sonMasa") || "511";
      location.replace("oyun.html?masa=" + (g === MASA_NOMRESI ? "511" : g));
      return;
    }

    const ilk = new Promise((res) => onValue(ref(rtdb, yol), (s) => {
      const data = s.val() || {};
      cizdir(gosterData(data));
      yerItdiYoxla(data);
      res();
    }));
    katil(cari, profilP);      // masa məlumatını gözləmədən oturmağa başla
    await ilk;
  } catch (e) {
    alert("Masa xətası: " + e.message);
  }
}
