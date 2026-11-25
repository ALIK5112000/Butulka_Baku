/* tepik.js - "Təpik vur və qoru" */
(function () {
  'use strict';

  var CONFIG = {
    qiymet: 15,
    qorumaQiymet: 15,
    qorumaAddim: 15,
    gozleSaniye: 30,
    qadagaDeqiqe: 15,
    sekilYolu: 'images/tepik-vur/',
    db: function () { return window.db || (window.firebase && firebase.database()); },
    menimUid: function () { return window.uid || window.menimUid || window.userId; },
    masaId: function () { return window.masaId || window.hazirkiMasa; },
    oyuncuYolu: function (uid) { return 'oyuncular/' + uid; },
    adSahesi: 'ad',
    sekilSahesi: 'foto',
    bonusCix: function (miqdar) {
      return Promise.reject(new Error('CONFIG.bonusCix doldurulmayıb'));
    },
    masaniTerkEt: function () {
      if (typeof window.masaniTerkEt === 'function') window.masaniTerkEt();
      else if (typeof window.terkEt === 'function') window.terkEt();
    },
    vipMi: function () { return Promise.resolve(true); },
    adGetir: function () { return Promise.resolve('Bir oyunçu'); }
  };

  var ROOT = 'tepik';

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

  /* ================= təpik vurma pəncərəsi ================= */
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
    CONFIG.vipMi().then(function (ok) {
      if (!ok) { toast('Təpik vurmaq yalnız VIP oyunçular üçündür'); return; }
      acIc(hedefUid, ilkAd, ilkSekil);
    });
  }

  function acIc(hedefUid, ilkAd, ilkSekil) {
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
      if (v && v.xilas && v.bitme > indi()) { throw new Error('Bu oyunçu qorunur, təpik vurmaq olmur'); }
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

  /* ================= qoruma ================= */
  function xilas(hedefUid) {
    return CONFIG.db().ref(ROOT + '/' + hedefUid + '/xilas').set(true);
  }

  function qiymetOxu(uid) {
    return CONFIG.db().ref('tepikQiymet/' + uid).once('value').then(function (s) {
      return s.val() || CONFIG.qorumaQiymet;
    });
  }

  function qoru(hedefUid) {
    var r = CONFIG.db().ref(ROOT + '/' + hedefUid), q = 0;
    return r.once('value').then(function (snap) {
      var v = snap.val();
      if (!v || v.xilas || v.terkVaxti <= indi()) throw new Error('Qoruma artıq lazım deyil');
      return qiymetOxu(hedefUid);
    }).then(function (p) {
      q = p;
      return CONFIG.bonusCix(q);
    }).then(function (ok) {
      if (!ok) throw new Error('Bonusun çatmır');
      return xilas(hedefUid);
    }).then(function () {
      return CONFIG.db().ref('tepikQiymet/' + hedefUid).set(q + CONFIG.qorumaAddim);
    }).then(function () { toast('Oyunçu qorundu!'); })
    .catch(function (err) { toast(err && err.message ? err.message : 'Xəta baş verdi'); });
  }

  /* kartda qalxanı göstərmək üçün: cb(true/false) */
  function izle(hedefUid, cb) {
    var r = CONFIG.db().ref(ROOT + '/' + hedefUid), t = null;
    var h = r.on('value', function (snap) {
      clearTimeout(t);
      var v = snap.val();
      var qalan = v && !v.xilas ? v.terkVaxti - indi() : 0;
      cb(qalan > 0);
      if (qalan > 0) t = setTimeout(function () { cb(false); }, qalan);
    });
    return function () { clearTimeout(t); r.off('value', h); };
  }

  /* ================= təpik vurulana çıxan pəncərə ================= */
  var stl = document.createElement('style');
  stl.textContent = [
    '.tepik-qov{position:fixed;inset:0;background:rgba(8,4,20,.72);z-index:20001;display:flex;align-items:center;justify-content:center}',
    '.tepik-qov-k{width:84vw;padding:7vw 5vw 5vw;border-radius:5vw;background:linear-gradient(#3b2163,#2a1749);box-shadow:0 2vw 8vw rgba(0,0,0,.5);text-align:center;color:#fff}',
    '.tepik-qov-ic{width:17vw;height:17vw;margin:0 auto 4vw;border-radius:50%;background:linear-gradient(#ff6a7d,#e8335f);display:flex;align-items:center;justify-content:center;font-size:8.5vw}',
    '.tepik-qov-b{font:700 5.6vw/1.2 Georgia,"Times New Roman",serif;margin-bottom:2.6vw}',
    '.tepik-qov-m{font:400 3.5vw/1.45 Roboto,Arial,sans-serif;color:#cfc4e6;margin-bottom:4.6vw}',
    '.tepik-qov-m b{color:#f6c453}',
    '.tepik-qov-s{background:#1f1137;border-radius:3vw;padding:4vw 0 3.4vw;margin-bottom:4.6vw}',
    '.tepik-qov-s i{display:block;font:700 10vw/1 Georgia,serif;font-style:normal;color:#ff5a7a;margin-bottom:1.6vw}',
    '.tepik-qov-s span{font:500 2.7vw/1 Roboto,Arial,sans-serif;letter-spacing:.3vw;color:#a99cc4}',
    '.tepik-qov-od{width:100%;height:13vw;border:0;border-radius:3.4vw;background:linear-gradient(#ffe29a,#f1b24c);color:#4a2b00;font:700 4vw/1 Roboto,Arial,sans-serif}',
    '.tepik-qov-od:disabled{opacity:.6}',
    '.tepik-qov-c{background:none;border:0;color:#cfc4e6;font:500 3.5vw/1 Roboto,Arial,sans-serif;margin-top:4.6vw;padding:1vw 3vw}'
  ].join('');
  document.head.appendChild(stl);

  var qovEl = null, qovT = null;
  function qovBagla() { clearInterval(qovT); if (qovEl) { qovEl.remove(); qovEl = null; } }
  function qovAc(v) {
    var men = CONFIG.menimUid();
    Promise.all([qiymetOxu(men), CONFIG.adGetir(v.kim)]).then(function (r) {
      qovBagla();
      var q = r[0], ad = r[1];
      qovEl = el('div', 'tepik-qov');
      qovEl.innerHTML =
        '<div class="tepik-qov-k">' +
          '<div class="tepik-qov-ic">&#128098;</div>' +
          '<div class="tepik-qov-b">Masadan qovulursan!</div>' +
          '<div class="tepik-qov-m"><b>' + esc(ad) + '</b> səni masadan qovmaq istəyir. Ürək ödəyib qala bilərsən!</div>' +
          '<div class="tepik-qov-s"><i>30</i><span>SANİYƏ QALIB</span></div>' +
          '<button type="button" class="tepik-qov-od">&#10084; ' + q + ' ürək ödə, masada qal</button>' +
          '<button type="button" class="tepik-qov-c">Bilirəm, çıxıram</button>' +
        '</div>';
      document.body.appendChild(qovEl);
      var say = qovEl.querySelector('.tepik-qov-s i');
      function yenile() {
        var s = Math.ceil((v.terkVaxti - indi()) / 1000);
        if (s <= 0) { qovBagla(); return; }
        say.textContent = s;
      }
      yenile();
      qovT = setInterval(yenile, 250);
      qovEl.querySelector('.tepik-qov-c').onclick = qovBagla;
      var od = qovEl.querySelector('.tepik-qov-od');
      od.onclick = function () {
        od.disabled = true;
        qoru(men).then(function () { od.disabled = false; });
      };
    });
  }

  /* ================= mənə təpik vurulanda ================= */
  var menimRef = null, tepikTimer = null, sonVerilen = null, gosterilen = null;

  function dinle() {
    var men = CONFIG.menimUid();
    if (!men) { setTimeout(dinle, 500); return; }
    if (menimRef) return;
    ofsetDinle();
    menimRef = CONFIG.db().ref(ROOT + '/' + men);
    menimRef.on('value', function (snap) {
      var v = snap.val();
      clearTimeout(tepikTimer);
      if (!v || v.xilas) { localStorage.removeItem('tepikQadaga'); qovBagla(); return; }
      if (v.bitme <= indi()) { qovBagla(); return; }
      var qalan = v.terkVaxti - indi();
      localStorage.setItem('tepikQadaga', String(v.bitme));
      if (qalan <= 0) {
        qovBagla();
        if (sonVerilen !== v.baslama) { sonVerilen = v.baslama; CONFIG.masaniTerkEt(); }
        return;
      }
      if (gosterilen !== v.baslama) { gosterilen = v.baslama; qovAc(v); }
      tepikTimer = setTimeout(function () {
        menimRef.child('xilas').once('value').then(function (s) {
          if (s.val()) return;
          sonVerilen = v.baslama;
          qovBagla();
          CONFIG.masaniTerkEt();
        });
      }, qalan);
    });
  }

  /* qoşulmaq qadağandırmı */
  function qadagaVarmi() {
    var b = parseInt(localStorage.getItem('tepikQadaga') || '0', 10);
    if (b && b > indi()) {
      var dq = Math.ceil((b - indi()) / 60000);
      toast('Təpik vurulub. ' + dq + ' dəqiqə sonra qoşula bilərsən');
      return true;
    }
    return false;
  }

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
    ac: ac, bagla: bagla, xilas: xilas, qoru: qoru, izle: izle, toast: toast,
    dinle: dinle, qadagaVarmi: qadagaVarmi,
    duymeElaveEt: duymeElaveEt
  };
})();
