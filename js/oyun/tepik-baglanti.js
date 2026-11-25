import { fsdb, rtdb } from "../core/firebase.js";
import { MASA_NOMRESI, OTURACAQ_SAYI } from "../core/config.js";
import { cariOyuncu } from "./yardimci.js";
import { doc, getDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ref as rRef, onValue, get, set, update } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const T = window.TepikVur;
if (T) {
  const C = T.CONFIG;

  /* təsadüfi masa seçiləndə baxılan masaların sayı (1-dən bu nömrəyə qədər) */
  const TESADUFI_MASA_SAYI = 40;

  /* tepik.js köhnə db.ref() üslubundadır, modulyar SDK-ya uyğunlaşdırırıq */
  const sn = s => ({ val: () => s.val() });
  const mkRef = path => {
    const r = rRef(rtdb, path);
    return {
      on(ev, cb) { cb.__un = onValue(r, s => cb(sn(s))); return cb; },
      off(ev, cb) { if (cb && cb.__un) cb.__un(); },
      once() { return get(r).then(sn); },
      set(v) { return set(r, v); },
      update(v) { return update(r, v); },
      child(p) { return mkRef(path + "/" + p); }
    };
  };
  C.db = () => ({ ref: mkRef });
  C.menimUid = () => (cariOyuncu() || {}).docId;
  C.masaId = () => MASA_NOMRESI;

  /* masalar lentində masa elementi + nömrəsi (qadağalı masanın altında dəqiqə sayğacı çıxır;
     lentdə qadağalı masaya toxunanda qadağa pəncərəsi tepik.js-də açılır) */
  C.masaSelektoru = "[data-masa-id],[data-masa],[data-masa-no],[data-masa-nomre],[data-nomre]";
  C.masaIdOxu = e =>
    e.getAttribute("data-masa-id") || e.getAttribute("data-masa") || e.getAttribute("data-masa-no") ||
    e.getAttribute("data-masa-nomre") || e.getAttribute("data-nomre");

  /* Təpik vurulanda: yer boşalır və oyunçu təsadüfi BAŞQA masaya keçirilir.
     Yeni masada qadağa pəncərəsi (kim atdı, neçə dəqiqə qaldı) açılır. */
  let atilir = false;
  async function basqaMasaSec() {
    const ids = Array.from({ length: TESADUFI_MASA_SAYI }, (_, i) => String(i + 1)).filter(n => n !== String(MASA_NOMRESI));
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    for (const n of ids.slice(0, 20)) {
      if (T.qadagaVarmi(n, true)) continue;                    // qadağalı masa olmasın
      try {
        const m = await getDoc(doc(fsdb, "masalar", n));
        const md = m.exists() ? m.data() : null;
        if (md && md.bitis > Date.now() && md.parolHash) continue;   // kilidli masa olmasın
        const dolu = Object.values((await get(rRef(rtdb, `masalar/${n}/oturacaqlar`))).val() || {}).filter(Boolean).length;
        if (dolu >= OTURACAQ_SAYI) continue;                   // dolu masa olmasın
        return n;
      } catch (e) {}
    }
    return null;
  }
  C.masaniTerkEt = async () => {
    if (atilir) return;
    atilir = true;
    const kohne = String(MASA_NOMRESI);
    try { sessionStorage.setItem("tepikAtildi", kohne); sessionStorage.setItem("sonMasa", kohne); } catch (e) {}
    /* yer boşalsın; amma cavab gecikərsə 3 saniyədən sonra yenə də keçid olsun */
    try {
      if (typeof window.masadanCix === "function") {
        await Promise.race([Promise.resolve(window.masadanCix()), new Promise(r => setTimeout(r, 3000))]);
      }
    } catch (e) {}
    const n = await basqaMasaSec();
    window.__masaCixir = true;
    location.href = n ? "oyun.html?masa=" + n : "oyun.html";   // oyun.html özü təsadüfi masa seçir
  };
  /* yeni masaya düşəndə qadağa pəncərəsini göstər (qeyd hələ yazılmayıbsa bir neçə dəfə yenidən yoxlayır) */
  try {
    const k = sessionStorage.getItem("tepikAtildi");
    if (k) {
      sessionStorage.removeItem("tepikAtildi");
      let cehd = 0;
      const goster = () => {
        if (T.qadagaGoster(k) || ++cehd > 20) return;
        setTimeout(goster, 400);
      };
      setTimeout(goster, 800);
    }
  } catch (e) {}

  /* masadakı oyunçu kartları: oturduqları yer (.yer > .foto) və öpüş üçün ortaya gələn kart (.orta > .foto).
     Ortadakı kartın sahibini raund/spin qeydindən tapırıq: 1-ci .orta = qız (qu), 2-ci .orta = oğlan (ou) */
  let spinSon = null;
  onValue(rRef(rtdb, `masalar/${MASA_NOMRESI}/raund/spin`), s => { spinSon = s.val(); });
  C.kartSelektoru = ".yer .foto, .orta .foto";
  C.kartUid = e => {
    const p = e.parentElement;
    if (!p) return null;
    if (p.classList.contains("orta")) {
      if (!p.classList.contains("goster") || !spinSon) return null;
      const k = Array.prototype.indexOf.call(document.querySelectorAll(".orta"), p);
      return k === 0 ? spinSon.qu : k === 1 ? spinSon.ou : null;
    }
    return p.dataset.uid || null;
  };

  C.bonusCix = miqdar => {
    const cari = cariOyuncu();
    if (!cari || !cari.docId) return Promise.resolve(false);
    const ref = doc(fsdb, "users", cari.docId);
    return runTransaction(fsdb, async tx => {
      const d = (await tx.get(ref)).data() || {};
      const h = Number(d.hearts) || 0;
      if (h < miqdar) return false;
      tx.update(ref, { hearts: h - miqdar });
      return true;
    });
  };
  C.vipMi = async () => {
    const cari = cariOyuncu();
    if (!cari || !cari.docId) return false;
    const d = (await getDoc(doc(fsdb, "users", cari.docId))).data() || {};
    return d.role === "admin" || (!!d.vip && (!d.vipUntil || Number(d.vipUntil) > Date.now()));
  };
  C.adGetir = async uid => ((await getDoc(doc(fsdb, "users", uid))).data() || {}).username || "Oyunçu";
  /* qadağa pəncərəsində atan şəxsin şəkli (users.avatar) */
  C.sekilGetir = async uid => ((await getDoc(doc(fsdb, "users", uid))).data() || {}).avatar || "";
  T.dinle();

  /* ===== profil kartında düymə ===== */
  const st = document.createElement("style");
  st.textContent = ".pf-btn.pf-qalxan{background:none!important}.pf-btn.pf-qalxan img{width:100%;height:100%;display:block}";
  document.head.appendChild(st);

  const P = "images/tepik-vur/";
  let hedef = null, aktiv = false, off = null;

  function duyme() {
    const b = document.querySelector(".pf-ov.open .pf-act .pf-btn:first-child");
    if (!b) return;
    if (!b.__orig) b.__orig = b.innerHTML;
    b.classList.toggle("pf-qalxan", aktiv);
    b.style.visibility = (!aktiv && hedef === C.menimUid()) ? "hidden" : "visible";
    const h = aktiv ? "q" : "t";
    if (b.dataset.h === h) return;
    b.dataset.h = h;
    const im = new Image();
    im.alt = "";
    if (aktiv) {
      im.src = P + "tepik_qoruma.png";
    } else {
      im.style.cssText = "width:7.5vw;height:auto;display:block";
      im.onerror = () => { b.innerHTML = b.__orig; };
      im.src = P + "tepik_icon_sari.png";
    }
    b.innerHTML = "";
    b.appendChild(im);
  }

  function izle(id) {
    if (off) { off(); off = null; }
    hedef = id; aktiv = false;
    if (id) off = T.izle(id, a => { aktiv = a; duyme(); });
    duyme();
  }

  function sarla() {
    const pk = window.ProfilKart;
    if (!pk) return false;
    if (pk.__tepik) return true;
    const ac0 = pk.ac, bagla0 = pk.bagla;
    pk.ac = function (id) { if (id !== hedef) izle(id); return ac0.apply(this, arguments); };
    pk.bagla = function () { izle(null); return bagla0.apply(this, arguments); };
    pk.__tepik = true;
    return true;
  }
  const t = setInterval(() => { if (sarla()) clearInterval(t); }, 200);

  new MutationObserver(duyme).observe(document.querySelector(".pf-ov") || document.body, { childList: true, subtree: true });

  document.addEventListener("click", async e => {
    const b = e.target.closest && e.target.closest(".pf-ov .pf-act .pf-btn:first-child");
    if (!b || !hedef) return;
    const uid = hedef;
    if (aktiv) { T.qoru(uid); return; }
    if (uid === C.menimUid()) return;
    if (!(await C.vipMi())) { T.toast("Təpik vurmaq yalnız VIP oyunçular üçündür"); return; }
    const sekil = (document.querySelector(".pf-ov .pf-photo img") || {}).src || "";
    const ad = await C.adGetir(uid);
    window.ProfilKart.bagla();
    T.ac(uid, ad + " ", sekil);
  }, true);
}
