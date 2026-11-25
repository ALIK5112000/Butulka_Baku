import { fsdb, rtdb } from "../core/firebase.js";
import { MASA_NOMRESI } from "../core/config.js";
import { cariOyuncu } from "./yardimci.js";
import { doc, getDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ref as rRef, onValue, get, set, update } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const T = window.TepikVur;
if (T) {
  const C = T.CONFIG;

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

  /* Təpik vurulanda oyunçu masadan çıxır (yeri boşalır), amma səhifədə izləyici kimi qalır.
     masadanCix() yeri silir və bərpanı dayandırır (masa.js) */
  C.masaniTerkEt = () => {
    if (typeof window.masadanCix === "function") window.masadanCix();
    else { const b = document.getElementById("cixisBtn"); if (b) b.click(); }
  };

  /* masadakı oyunçu kartları: .yer > .foto (masa.js hər kartın .yer elementinə data-uid yazır) */
  C.kartSelektoru = ".yer .foto";
  C.kartUid = e => (e.parentElement && e.parentElement.dataset.uid) || null;

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
