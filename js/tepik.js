/* tepik.js - "Təpik vur və qoru" funksiyası (ayrıca fayl, mövcud koda toxunmur)
 *
 * Qoşulma:
 *   <link rel="stylesheet" href="css/tepik.css">
 *   <script src="js/tepik.js"></script>
 *
 * 1) Profil kartı açılanda düymə əlavə et (Buto düyməsinin olduğu sətirdə):
 *      TepikVur.duymeElaveEt(duymeSetiri, hedefUid);
 *    (düymə sətirin ƏVVƏLİNƏ qoyulur və qonşu düymənin ölçüsünü götürür)
 *
 * 2) Oyun açılanda bir dəfə çağır (mənə təpik vurulubsa dinləyir):
 *      TepikVur.dinle();
 *
 * 3) Masaya qoşulma funksiyanın əvvəlində yoxla:
 *      if (TepikVur.qadagaVarmi(masaId)) return;
 */
(function () {
  'use strict';

  /* ================= AYARLAR - layihəyə uyğun dəyiş ================= */
  var CONFIG = {
    qiymet: 15,            // bonus (ürək) qiyməti
    gozleSaniye: 30,       // təpikdən neçə saniyə sonra masadan çıxır
    qadagaDeqiqe: 15,      // neçə dəqiqə yenidən qoşula bilmir
    sekilYolu: 'images/tepik-vur/',

    // Realtime Database (masa/çat/butulka olan layihə)
    db: function () { return window.db || (window.firebase && firebase.database()); },

    // Mənim uid-im
    menimUid: function () { return window.uid || window.menimUid || window.userId; },

    // Hazırkı masanın id-si
    masaId: function () { return window.masaId || window.hazirkiMasa; },

    // Oyunçunun adı/şəkli RTDB-də hansı yoldadır
    oyuncuYolu: function (uid) { return 'oyuncular/' + uid; },
    adSahesi: 'ad',
    sekilSahesi: 'foto',

    // Bonusu çıx (Firestore-dakı hesabdan). Promise<true> qaytarsın, çatmasa false.
    // MÜTLƏQ layihəyə görə doldurulmalıdır:
    bonusCix: function (miqdar) {
      return Promise.reject(new Error('CONFIG.bonusCix doldurulmayıb'));
    },

    // Mənə təpik vurulanda masanı tərk etmə funksiyan:
    masaniTerkEt: function () {
      if (typeof window.masaniTerkEt === 'function') window.masaniTerkEt();
      else if (typeof window.terkEt === 'function') window.terkEt();
    }
  };

  var ROOT = 'tepik'; // RTDB: tepik/{hedefUid}

  /* ================= kömək ================= */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(msg) {
    var t = el('div', 'tepik-toast', esc(msg));
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2500);
  }
  var serverOfset = 0;
  function indi() { return Date.now() + serverOfset; }
  function ofsetDinle() {
    try {
      CONFIG.db().ref('.info/serverTimeOffset').on('value', function (s) { serverOfset = s.val() || 0; });
    } catch (e) {}
  }

  /* ================= pəncərə ================= */
  var overlay, acikUid = null, adRef = null, adDinleyici = null;

  function qur() {
    if (overlay) return;
    var S = CONFIG.sekilYolu;
    overlay = el('div', 'tepik-overlay');
    overlay.innerHTML =
      '<div class="tepik-pencere">' +
        '<button class="tepik-bagla" type="button">&times;</button>' +
        '<div class="tepik-sual">?</div>' +
        '<div class="tepik-bashliq">Təpik vur və qoru</div>' +
        '<div class="tepik-esas">' +
          '<div class="tepik-foto">' +
            '<img class="tepik-avatar" alt="">' +
            '<img class="tepik-nishan" src="' + S + 'tepik_icon_sari.png" alt="">' +
          '</div>' +
          '<div class="tepik-metn"><span class="tepik-ad"></span>' +
            'oyunçusuna təpik vurulsun ki, <b>' + CONFIG.gozleSaniye + '</b> saniyə sonra masanı tərk etsin və ' +
            '<b>' + CONFIG.qadagaDeqiqe + '</b> dəqiqə ərzində yenidən qoşula bilməsin?' +
          '</div>' +
        '</div>' +
        '<div class="tepik-xeberdarliq">XƏBƏRDARLIQ! Kimsə oyunçunu xilas edərsə, təpiklə kənarlaşdırmaq mümkün olmayacaq</div>' +
        '<div class="tepik-zolaq">' +
          '<img src="' + S + 'tepik_icon_sari.png" alt="">' +
          '<div class="tepik-bar"><i></i></div>' +
          '<div class="tepik-tik">&#10003;</div>' +
        '</div>' +
        '<div class="tepik-qiymet">Aktivləşdirmənin qiyməti: <span class="tepik-urek">&#10084;</span> <b>' + CONFIG.qiymet + '</b></div>' +
        '<div class="tepik-duymeler">' +
          '<button type="button" class="tepik-legv">Ləğv et</button>' +
          '<button type="button" class="tepik-vur">Təpik vur</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.querySelector('.tepik-bagla').onclick = bagla;
    overlay.querySelector('.tepik-legv').onclick = bagla;
    overlay.querySelector('.tepik-vur').onclick = vur;
    overlay.addEventListener('click', function (e) { if (e.target === overlay) bagla(); });
  }

  function ac(hedefUid, ilkAd, ilkSekil) {
    if (!hedefUid) return;
    if (hedefUid === CONFIG.menimUid()) { toast('Özünə təpik vura bilməzsən'); return; }
    qur();
    acikUid = hedefUid;
    var adEl = overlay.querySelector('.tepik-ad');
    var imgEl = overlay.querySelector('.tepik-avatar');
    adEl.textContent = ilkAd || '';
    if (ilkSekil) imgEl.src = ilkSekil;
    overlay.querySelector('.tepik-vur').disabled = false;
    overlay.classList.add('acik');

    // adı REAL VAXTDA izlə (ad dəyişsə pəncərədə də dəyişir)
    dinleyiciniSil();
    try {
      adRef = CONFIG.db().ref(CONFIG.oyuncuYolu(hedefUid));
      adDinleyici = adRef.on('value', function (snap) {
        var v = snap.val();
        if (!v) return;
        if (v[CONFIG.adSahesi]) adEl.textContent = v[CONFIG.adSahesi] + ' ';
        if (v[CONFIG.sekilSahesi]) imgEl.src = v[CONFIG.sekilSahesi];
      });
    } catch (e) { console.warn('[tepik] ad dinlənmədi:', e); }
  }

  function dinleyiciniSil() {
    if (adRef && adDinleyici) { try { adRef.off('value', adDinleyici); } catch (e) {} }
    adRef = null; adDinleyici = null;
  }

  function bagla() {
    if (overlay) overlay.classList.remove('acik');
    dinleyiciniSil();
    acikUid = null;
  }

  /* ================= təpik vurmaq ================= */
  function vur() {
    var hedef = acikUid, men = CONFIG.menimUid(), masa = CONFIG.masaId();
    if (!hedef || !men) return;
    var btn = overlay.querySelector('.tepik-vur');
    btn.disabled = true;

    var ref = CONFIG.db().ref(ROOT + '/' + hedef);
    ref.once('value').then(function (snap) {
      var v = snap.val();
      if (v && v.xilas) { throw new Error('Bu oyunçu qorunur, təpik vurmaq olmur'); }
      if (v && v.bitme && v.bitme > indi()) { throw new Error('Bu oyunçuya artıq təpik vurulub'); }
      return CONFIG.bonusCix(CONFIG.qiymet);
    }).then(function (ok) {
      if (!ok) throw new Error('Bonusun çatmır');
      var baslama = indi();
      return ref.set({
        kim: men,
        masa: masa || null,
        baslama: baslama,
        terkVaxti: baslama + CONFIG.gozleSaniye * 1000,
        bitme: baslama + CONFIG.gozleSaniye * 1000 + CONFIG.qadagaDeqiqe * 60 * 1000,
        xilas: false
      });
    }).then(function () {
      toast('Təpik vuruldu!');
      bagla();
    }).catch(function (err) {
      toast(err && err.message ? err.message : 'Xəta baş verdi');
      btn.disabled = false;
    });
  }

  /* kimsə təpik vurulanı xilas edir (istəsən başqa düymədən çağır) */
  function xilas(hedefUid) {
    return CONFIG.db().ref(ROOT + '/' + hedefUid + '/xilas').set(true);
  }

  /* ================= mənə təpik vurulanda ================= */
  var menimRef = null, tepikTimer = null, sonVerilen = null;

  function dinle() {
    var men = CONFIG.menimUid();
    if (!men) { setTimeout(dinle, 500); return; }
    ofsetDinle();
    menimRef = CONFIG.db().ref(ROOT + '/' + men);
    menimRef.on('value', function (snap) {
      var v = snap.val();
      clearTimeout(tepikTimer);
      if (!v || v.xilas) return;
      if (v.bitme <= indi()) return;                 // köhnə qeyd
      var qalan = v.terkVaxti - indi();
      localStorage.setItem('tepikQadaga', String(v.bitme));
      if (qalan <= 0) { if (sonVerilen !== v.baslama) { sonVerilen = v.baslama; CONFIG.masaniTerkEt(); } return; }
      tepikTimer = setTimeout(function () {
        // son anda xilas olunubmu yenidən yoxla
        menimRef.child('xilas').once('value').then(function (s) {
          if (s.val()) return;
          sonVerilen = v.baslama;
          toast('Sənə təpik vuruldu!');
          CONFIG.masaniTerkEt();
        });
      }, qalan);
    });
  }

  /* qoşulmaq qadağandırmı (bitmə vaxtına qədər) */
  function qadagaVarmi() {
    var b = parseInt(localStorage.getItem('tepikQadaga') || '0', 10);
    if (b && b > indi()) {
      var dq = Math.ceil((b - indi()) / 60000);
      toast('Təpik vurulub. ' + dq + ' dəqiqə sonra qoşula bilərsən');
      return true;
    }
    return false;
  }

  /* ================= profil kartına düymə ================= */
  function duymeElaveEt(satir, hedefUid, ad, sekil) {
    if (!satir || satir.querySelector('.tepik-duyme')) return;
    var b = el('button', 'tepik-duyme');
    b.type = 'button';
    b.title = 'Təpik vur';
    var qonshu = satir.firstElementChild;
    if (qonshu && qonshu.offsetWidth) {
      b.style.width = qonshu.offsetWidth + 'px';
      b.style.height = qonshu.offsetHeight + 'px';
    }
    b.addEventListener('click', function (e) { e.stopPropagation(); ac(hedefUid, ad, sekil); });
    satir.insertBefore(b, satir.firstChild);
    return b;
  }

  window.TepikVur = {
    CONFIG: CONFIG,
    ac: ac, bagla: bagla, xilas: xilas,
    dinle: dinle, qadagaVarmi: qadagaVarmi,
    duymeElaveEt: duymeElaveEt
  };
})();
