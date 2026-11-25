import { fsdb, rtdb } from "../core/firebase.js";
import { MASA_NOMRESI, OTURACAQ_SAYI } from "../core/config.js";
import { cariOyuncu } from "./yardimci.js";
import { doc, getDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ref as rRef, onValue, get, set, update, remove, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const T = window.TepikVur;
if (T) {
  const C = T.CONFIG;

  /* təsadüfi masa seçiləndə baxılan masaların sayı (1-dən bu nömrəyə qədər) */
  const TESADUFI_MASA_SAYI = 40;

  /* ===== chat hadisələri (təpik vuruldu / qovuldu / qorundu): adi chat yoluna isTepikNotice kimi yazılır, chat.js çəkir ===== */
  const chatYol = `masalar/${MASA_NOMRESI}/chat`;
  let ofs = 0;
  onValue(rRef(rtdb, ".info/serverTimeOffset"), s => { ofs = s.val() || 0; });
  const hadise = o => {
    try { return push(rRef(rtdb, chatYol), Object.assign({ isTepikNotice: true, vaxt: serverTimestamp() }, o)).catch(() => {}); } catch (e) {}
  };

  /* tepik.js köhnə db.ref() üslubundadır, modulyar SDK-ya uyğunlaşdırırıq */
  const sn = s => ({ val: () => s.val() });
  const mkRef = path => {
    const r = rRef(rtdb, path);
    return {
      on(ev, cb) { cb.__un = onValue(r, s => cb(sn(s))); return cb; },
      off(ev, cb) { if (cb && cb.__un) cb.__un(); },
      once() { return get(r).then(sn); },
      set(v) {
        const p = set(r, v), m = /^tepik\/([^/]+)$/.exec(path);
        /* təpik vuruldu: chata "vuran >> vurulan" sətri */
        if (m && v && v.kim && v.xilas === false) {
          p.then(() => hadise({ tip: "vur", uid: v.kim, hedef: m[1], baslama: v.baslama })).catch(() => {});
        }
        return p;
      },
      update(v) {
        const p = update(r, v), m = /^tepik\/([^/]+)$/.exec(path);
        /* qorundu: chata "qoruyan >> qorunan" sətri */
        if (m && v && v.xilas === true) {
          p.then(() => hadise({ tip: "qoru", uid: C.menimUid(), hedef: m[1] })).catch(() => {});
        }
        return p;
      },
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

  /* Masanı tərk et: yalnız öz yerini sil (masadanCix() işlətmirik, o oyundan tam çıxış sayılır),
     sonra təsadüfi başqa masaya keç. oyun.html-dəki #cixisBtn.click() artıq çağırılmır. */
  C.masaniTerkEt = async () => {
    if (atilir) return;
    atilir = true;
    const kohne = String(MASA_NOMRESI);
    const uid = C.menimUid();
    try { sessionStorage.setItem("tepikAtildi", kohne); sessionStorage.setItem("sonMasa", kohne); } catch (e) {}
    window.__masaCixir = true;   // masa.js yerimi yenidən bərpa etməsin

    /* hədəf masanı əvvəlcədən seç ki, yer boşaldılandan sonra gecikmə olmasın */
    const n = await basqaMasaSec();
    const hedefUrl = n ? "oyun.html?masa=" + n : "oyun.html";   // n yoxdursa oyun.html özü təsadüfi masa seçir

    /* köhnə masadakı yerim, öpüş sayğacım və prezansım silinsin (3 saniyədən çox gözləmirik) */
    const temizle = (async () => {
      if (!uid) return;
      /* mən təpiklə qovulmuşamsa: chata "vuran >> qapı >> mən" sətri yazılır */
      try {
        const tv = (await get(rRef(rtdb, "tepik/" + uid))).val();
        if (tv && tv.kim && !tv.xilas && String(tv.masa) === kohne && Date.now() + ofs - tv.terkVaxti < 15000) {
          await hadise({ tip: "at", uid: tv.kim, hedef: uid });
        }
      } catch (e) {}
      const yolu = `masalar/${kohne}/oturacaqlar`;
      const h = (await get(rRef(rtdb, yolu))).val() || {};
      await Promise.all(Object.keys(h)
        .filter(k => h[k] && h[k].uid === uid)
        .map(k => remove(rRef(rtdb, `${yolu}/${k}`))));
      await remove(rRef(rtdb, `masalar/${kohne}/opus/${uid}`));
      await remove(rRef(rtdb, "prezans/" + uid));
    })().catch(() => {});
    await Promise.race([temizle, new Promise(r => setTimeout(r, 3000))]);

    location.replace(hedefUrl);
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


  /* ===== təpik vurulanda oyunçu şəklində hərəkətli təpik animasiyası (təpik uçur, partlayış, sayğac çıxır) ===== */
  const stA = document.createElement("style");
  stA.textContent =
    ".tepik-anim{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:7}" +
    ".tepik-anim .tb{position:absolute;left:-4%;bottom:-6%;width:46%;height:auto;opacity:0;transform-origin:70% 70%;animation:tepikBot 1.1s cubic-bezier(.3,.1,.4,1) forwards}" +
    ".tepik-anim .tp{position:absolute;left:14%;bottom:-8%;width:50%;height:50%;opacity:0;animation:tepikPatla 1.1s ease-out forwards}" +
    "@keyframes tepikBot{" +
      "0%{opacity:0;transform:translate(-60%,-55%) rotate(-35deg) scale(.8)}" +
      "15%{opacity:1}" +
      "45%{transform:translate(-22%,-20%) rotate(-28deg) scale(1)}" +
      "62%{opacity:1;transform:translate(10%,2%) rotate(4deg) scale(1.12)}" +
      "78%{opacity:1;transform:translate(8%,2%) rotate(2deg) scale(1.05)}" +
      "100%{opacity:0;transform:translate(10%,3%) rotate(2deg) scale(1)}}" +
    "@keyframes tepikPatla{" +
      "0%,55%{opacity:0;transform:scale(.2)}" +
      "66%{opacity:1;transform:scale(1.15)}" +
      "100%{opacity:0;transform:scale(1.35)}}";
  document.head.appendChild(stA);

  const BOT_ANIM = '<svg class="tb" viewBox="0 0 64 48"><path d="M10 36V29Q10 23 17 23L30 25Q38 26 40 18V6H58V36Z" fill="#f7b928" stroke="#e59a12" stroke-width="2" stroke-linejoin="round"/><rect x="7" y="34" width="54" height="8" rx="3" fill="#7a3f1a"/><circle cx="19" cy="29.500" r="1.800" fill="#7a3f1a"/><circle cx="26" cy="30.500" r="1.800" fill="#7a3f1a"/><path d="M44 10V30" stroke="#fff3b0" stroke-width="2.500" stroke-linecap="round" opacity=".7"/></svg>';
  const PATLA = '<svg class="tp" viewBox="0 0 100 100"><polygon points="50,2 60,30 88,14 72,42 98,52 70,62 84,90 54,74 46,98 38,72 10,86 28,58 2,46 30,38 14,12 42,28" fill="#d9531e" stroke="#8a2a0a" stroke-width="3" stroke-linejoin="round"/></svg>';

  function tepikAnim(kart, badge) {
    badge.style.visibility = "hidden";   // animasiya bitənə qədər sayğac görünməsin
    const goster = () => { badge.style.visibility = ""; };
    const uid = C.kartUid(kart);
    if (!uid) { goster(); return; }
    get(rRef(rtdb, "tepik/" + uid)).then(snap => {
      const v = snap.val();
      const yas = v ? Date.now() + ofs - v.baslama : 1e9;
      /* yalnız təzə vurulmuş təpik üçün (səhifəyə sonradan girənə animasiya göstərilmir) */
      if (!v || v.xilas || yas > 4000 || kart._tepikAnimB === v.baslama) { goster(); return; }
      kart._tepikAnimB = v.baslama;
      if (kart._tepikAnimEl) kart._tepikAnimEl.remove();
      const a = document.createElement("div");
      a.className = "tepik-anim";
      a.innerHTML = BOT_ANIM + PATLA;
      kart.appendChild(a);
      kart._tepikAnimEl = a;
      setTimeout(() => { a.remove(); if (kart._tepikAnimEl === a) kart._tepikAnimEl = null; goster(); }, 1150);
    }).catch(goster);
  }

  new MutationObserver(list => {
    list.forEach(mu => mu.addedNodes.forEach(n => {
      if (n.nodeType === 1 && n.classList && n.classList.contains("tepik-belge-tepik") && n.parentElement) {
        tepikAnim(n.parentElement, n);
      }
    }));
  }).observe(document.body, { childList: true, subtree: true });

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
