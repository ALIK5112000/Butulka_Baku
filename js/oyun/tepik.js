/* tepik.js - "Təpik vur və qoru" (v4) */
(function () {
  'use strict';

  var CONFIG = {
    qiymet: 15,
    vurmaAddim: 15,
    qorumaQiymet: 15,
    qorumaAddim: 15,
    qiymetSifirlaDeqiqe: 60,        // son əməliyyatdan neçə dəqiqə sonra qiymət yenidən 15-dən başlasın
    gozleSaniye: 30,
    qadagaDeqiqe: 15,
    xilasGosterSaniye: 2,           // qalxan kartda neçə saniyə görünsün
    yaziSaniye: 3,                  // ekranda çıxan qısa yazı neçə saniyə qalsın
    sekilYolu: 'images/tepik-vur/',
    belgeTepikSekil: 'tepik_icon_ag.png',   // kartdakı çəkmə ikonu (ağ)
    belgeQalxanSekil: 'qalxan.png',         // kartdakı qalxan ikonu
    /* masadakı oyunçu kartları: element + uid necə tapılsın */
    kartSelektoru: '[data-uid]',
    kartUid: function (e) { return e.getAttribute('data-uid'); },
    /* masalar siyahısı: element + masa id necə tapılsın (altında dəqiqə sayğacı çıxacaq) */
    masaSelektoru: '[data-masa-id]',
    masaIdOxu: function (e) { return e.getAttribute('data-masa-id'); },
    masaNomre: function (id) { return id; },
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
    adGetir: function () { return Promise.resolve('Bir oyunçu'); },
    sekilGetir: function (uid) {
      return CONFIG.db().ref(CONFIG.oyuncuYolu(uid) + '/' + CONFIG.sekilSahesi).once('value').then(function (s) { return s.val() || ''; });
    }
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

  /* ekranda pəncərəsiz qısa yazı (3 saniyə); həmişə ən üstdə görünür */
  var yaziEl = null, yaziT = null;
  function toast(msg) {
    clearTimeout(yaziT);
    if (yaziEl) { yaziEl.remove(); yaziEl = null; }
    yaziEl = el('div', 'tepik-yazi', esc(msg));
    document.body.appendChild(yaziEl);
    yaziT = setTimeout(function () {
      if (yaziEl) { yaziEl.remove(); yaziEl = null; }
    }, CONFIG.yaziSaniye * 1000);
  }
  /* istifadəçiyə göstərilməli xəta (qalan xətalar üçün ümumi "Xəta baş verdi" çıxır) */
  function xeta(msg) {
    var e = new Error(msg);
    e.tepik = true;
    return e;
  }
  function xetaMesaji(err) {
    return err && err.tepik && err.message ? err.message : 'Xəta baş verdi';
  }
  var BONUS_YOXDUR = 'Kifayət qədər bonus yoxdur';

  function dqSan(s) {
    s = Math.max(0, s);
    var d = Math.floor(s / 60), c = s % 60;
    return d + ':' + (c < 10 ? '0' : '') + c;
  }
  var serverOfset = 0;
  function indi() { return Date.now() + serverOfset; }
  function ofsetDinle() {
    try {
      CONFIG.db().ref('.info/serverTimeOffset').on('value', function (s) {
        serverOfset = s.val() || 0;
        if (menimRef) qiymetlendir();   // saat fərqi məlum oldu: taymeri dəqiqləşdir
      });
    } catch (e) {}
  }

  /* ================= masa üzrə qadağa (yalnız atıldığı masaya) ================= */
  var QADAGA_KEY = 'tepikQadaga2';
  try { localStorage.removeItem('tepikQadaga'); } catch (e) {}

  function qadagaOxu() {
    try { return JSON.parse(localStorage.getItem(QADAGA_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function qadagaYaz(m) {
    try { localStorage.setItem(QADAGA_KEY, JSON.stringify(m)); } catch (e) {}
  }
  /* v = tepik/{menimUid} qeydi; qadağa yalnız v.masa üçün yazılır */
  function qadagaYenile(v) {
    var m = qadagaOxu(), n = indi(), d = false;
    if (!v) { if (Object.keys(m).length) { m = {}; d = true; } }
    else {
      Object.keys(m).forEach(function (k) { if (m[k].bit <= n) { delete m[k]; d = true; } });
      if (v.masa) {
        var k = String(v.masa);
        if (!v.xilas && v.bitme > n) { m[k] = { bas: v.terkVaxti, bit: v.bitme, kim: v.kim }; d = true; }
        else if (m[k]) { delete m[k]; d = true; }
      }
      /* əvvəlki masalardakı hələ bitməyən qadağalar (başqa masada yenidən təpik vurulsa da itmir) */
      if (v.eski) {
        Object.keys(v.eski).forEach(function (ek) {
          var e = v.eski[ek];
          if (!e || e.bit <= n || ek === String(v.masa)) return;
          if (!m[ek] || m[ek].bit !== e.bit) { m[ek] = { bas: e.bas, bit: e.bit, kim: e.kim }; d = true; }
        });
      }
    }
    if (d) qadagaYaz(m);
  }

  /* yeni təpik köhnə qadağanı silməsin: əvvəlki qeyddən hələ bitməyən qadağalar (masa -> {bas,bit,kim}) */
  function eskiQadagalar(v, yeniMasa) {
    if (!v) return null;
    var n = indi(), r = {}, say = 0, ym = String(yeniMasa);
    if (v.eski) {
      Object.keys(v.eski).forEach(function (k) {
        var e = v.eski[k];
        if (e && e.bit > n && k !== ym) { r[k] = { bas: e.bas || 0, bit: e.bit, kim: e.kim || '' }; say++; }
      });
    }
    /* yeni təpik eyni masadadırsa, köhnə qeydi daşımağa ehtiyac yoxdur: yeni qadağa onu əvəz edir */
    if (v.masa && String(v.masa) !== ym && !v.xilas && v.bitme > n) {
      r[String(v.masa)] = { bas: v.terkVaxti || 0, bit: v.bitme, kim: v.kim || '' };
      say++;
    }
    return say ? r : null;
  }

  /* qoşulmaq / masa arxasına keçmək qadağandırmı (yalnız həmin masa üçün) */
  function qadagaVarmi(masaId, sessiz) {
    masaId = masaId || CONFIG.masaId();
    if (!masaId) return false;
    var q = qadagaOxu()[String(masaId)], n = indi();
    if (q && n >= q.bas && n < q.bit) {
      if (!sessiz) qadagaPencere(masaId, q);
      return true;
    }
    return false;
  }

  /* atıldıqdan sonra yeni masaya düşəndə: qadağa bitməyibsə pəncərəni göstər
     (cihaz saatı serverdən bir neçə saniyə geri qalsa belə pəncərə çıxsın deyə "bas" yoxlanmır) */
  function qadagaGoster(masaId) {
    var q = qadagaOxu()[String(masaId)];
    if (q && indi() < q.bit) { qadagaPencere(masaId, q); return true; }
    return false;
  }

  /* masa üçün qadağanın qalan saniyəsi (qadağa başlamayıbsa və ya bitibsə 0) */
  function qadagaQalan(masaId) {
    var q = qadagaOxu()[String(masaId)], n = indi();
    return (q && n >= q.bas && n < q.bit) ? Math.ceil((q.bit - n) / 1000) : 0;
  }
  /* hazırda qadağalı olan masaların siyahısı */
  function qadagaMasalari() {
    var m = qadagaOxu();
    return Object.keys(m).filter(function (k) { return qadagaQalan(k) > 0; });
  }

  var qadEl = null, qadT = null;
  function qadagaBagla() { clearInterval(qadT); if (qadEl) { qadEl.remove(); qadEl = null; } }
  function qadagaPencere(masaId, q) {
    q = q || qadagaOxu()[String(masaId)];
    if (!q) return;
    qadagaBagla();
    qadEl = el('div', 'tepik-qad');
    qadEl.innerHTML =
      '<div class="tepik-qad-k">' +
        '<button type="button" class="tepik-qad-x">&times;</button>' +
        '<div class="tepik-qad-b">Masa arxasına keçmək qadağandır</div>' +
        '<div class="tepik-qad-s">' +
          '<div class="tepik-qad-foto"><img alt=""><span>&#128682;</span></div>' +
          '<div class="tepik-qad-m"><b class="tepik-qad-ad">Bir oyunçu</b> sizi #' + esc(CONFIG.masaNomre(masaId)) +
            ' nömrəli masadan kənarlaşdırıb</div>' +
        '</div>' +
        '<div class="tepik-qad-t">Masa arxasına aşağıdakı müddətdən sonra keçmək olar:<b>&#9201; <i>0:00</i></b></div>' +
        '<button type="button" class="tepik-qad-ok">Oldu</button>' +
      '</div>';
    document.body.appendChild(qadEl);
    var adEl = qadEl.querySelector('.tepik-qad-ad'), img = qadEl.querySelector('img'), say = qadEl.querySelector('.tepik-qad-t i');
    try {
      Promise.resolve(CONFIG.adGetir(q.kim)).then(function (a) { if (qadEl) adEl.textContent = a; });
      Promise.resolve(CONFIG.sekilGetir(q.kim)).then(function (src) {
        if (qadEl && src) img.src = src;
      });
    } catch (e) {}
    function yenile() {
      var s = Math.ceil((q.bit - indi()) / 1000);
      if (s <= 0) { qadagaBagla(); return; }
      say.textContent = dqSan(s);
    }
    yenile();
    qadT = setInterval(yenile, 250);
    qadEl.querySelector('.tepik-qad-x').onclick = qadagaBagla;
    qadEl.querySelector('.tepik-qad-ok').onclick = qadagaBagla;
  }

  /* masalar siyahısında hər qadağan olunmuş masanın altında real vaxtlı sayğac */
  function masaSayaciTara() {
    var m = qadagaOxu(), n = indi();
    var list = document.querySelectorAll(CONFIG.masaSelektoru);
    Array.prototype.forEach.call(list, function (e) {
      var id = CONFIG.masaIdOxu(e), q = id != null ? m[String(id)] : null;
      var b = e._tepikSay;
      if (b && !e.contains(b)) { b = null; e._tepikSay = null; }
      if (q && n >= q.bas && n < q.bit) {
        if (!b) { b = el('div', 'tepik-masa-say'); e.appendChild(b); e._tepikSay = b; }
        b.textContent = '\u23F1 ' + dqSan(Math.ceil((q.bit - n) / 1000));
      } else if (b) { b.remove(); e._tepikSay = null; }
    });
  }

  /* ================= masalar lentində atıldığın masaya toxunanda qadağa pəncərəsi ================= */
  function rxEsc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /* toxunulan elementin (və 8 səviyyə yuxarısının) hansı qadağalı masaya aid olduğunu tapır */
  function masaTiklaId(hedef) {
    if (!hedef || !hedef.closest) return null;
    if (hedef.closest('.tepik-qad,.tepik-qov,.tepik-overlay,.tepik-yazi')) return null;   // öz pəncərələrimiz
    var cari = String(CONFIG.masaId() || '');
    var yasaq = qadagaMasalari().filter(function (k) { return k !== cari; });
    if (!yasaq.length) return null;
    var i, k, d, e, an, av;

    /* 1) CONFIG-dəki seçici + oxuyucu */
    try {
      var me = hedef.closest(CONFIG.masaSelektoru);
      if (me) {
        var mid = CONFIG.masaIdOxu(me);
        if (mid != null && yasaq.indexOf(String(mid)) >= 0) return String(mid);
      }
    } catch (x) {}

    /* 2) ümumi yoxlama: elementin hər hansı atributunda (data-*, id, value, onclick) masa nömrəsi varmı */
    e = hedef; d = 0;
    while (e && e.nodeType === 1 && e !== document.body && e !== document.documentElement && d < 8) {
      for (i = 0; i < e.attributes.length; i++) {
        an = e.attributes[i].name;
        if (an === 'class' || an === 'style') continue;
        av = String(e.attributes[i].value).trim();
        for (k = 0; k < yasaq.length; k++) {
          if (av === yasaq[k]) return yasaq[k];
          if (an === 'onclick' && new RegExp('(^|[^0-9A-Za-z_])' + rxEsc(yasaq[k]) + '([^0-9A-Za-z_]|$)').test(av)) return yasaq[k];
        }
      }
      e = e.parentElement; d++;
    }
    return null;
  }

  function masaTikla(ev) {
    var id = masaTiklaId(ev.target);
    if (id == null) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    qadagaPencere(id);   // keçid bloklanır, qadağa pəncərəsi (kim atdı + qalan vaxt) açılır
  }
  document.addEventListener('click', masaTikla, true);

  /* ================= masadakı oyunçu kartında nişan (çəkmə + say / qalxan) ================= */
  var kesh = {}, abune = {};
  function abuneOl(u) {
    var r = CONFIG.db().ref(ROOT + '/' + u);
    var h = r.on('value', function (s) { kesh[u] = s.val(); });
    abune[u] = { r: r, h: h };
  }
  function abuneSil(u) {
    try { abune[u].r.off('value', abune[u].h); } catch (e) {}
    delete abune[u]; delete kesh[u];
  }
  function ikon(src, emoji) {
    return '<img src="' + CONFIG.sekilYolu + src + '" alt="" ' +
      'onerror="this.style.display=\'none\';this.nextSibling.style.display=\'block\'">' +
      '<span class="tepik-belge-emo" style="display:none">' + emoji + '</span>';
  }
  function kartRender(e, u) {
    var v = kesh[u], n = indi(), mod = null, say = 0, hm = CONFIG.masaId();
    if (v && (!v.masa || (hm && String(v.masa) === String(hm)))) {
      if (!v.xilas && v.terkVaxti > n) { mod = 'tepik'; say = Math.ceil((v.terkVaxti - n) / 1000); }
      else if (v.xilas && v.xilasVaxti && n - v.xilasVaxti < CONFIG.xilasGosterSaniye * 1000) mod = 'qalxan';
    }
    var b = e._tepikB;
    if (b && !e.contains(b)) { b = null; e._tepikB = null; e._tepikMod = null; }
    if (!mod) { if (b) { b.remove(); e._tepikB = null; e._tepikMod = null; } return; }
    if (!b) {
      if (getComputedStyle(e).position === 'static') e.style.position = 'relative';
      b = el('div', 'tepik-belge');
      e.appendChild(b);
      e._tepikB = b;
    }
    if (e._tepikMod !== mod) {
      e._tepikMod = mod;
      b.className = 'tepik-belge tepik-belge-' + mod;
      b.innerHTML = mod === 'tepik'
        ? ikon(CONFIG.belgeTepikSekil, '\uD83D\uDC62') + '<span class="tepik-belge-say"></span>'
        : ikon(CONFIG.belgeQalxanSekil, '\uD83D\uDEE1\uFE0F');
    }
    if (mod === 'tepik') b.querySelector('.tepik-belge-say').textContent = say;
  }
  function kartTara() {
    var db;
    try { db = CONFIG.db(); } catch (e) {}
    if (!db) return;
    var used = {};
    Array.prototype.forEach.call(document.querySelectorAll(CONFIG.kartSelektoru), function (e) {
      var u = CONFIG.kartUid(e);
      if (!u) {   // element artıq heç kimi göstərmir: köhnə nişanı sil
        if (e._tepikB) { e._tepikB.remove(); e._tepikB = null; e._tepikMod = null; }
        return;
      }
      used[u] = 1;
      if (!abune[u]) abuneOl(u);
      kartRender(e, u);
    });
    Object.keys(abune).forEach(function (u) { if (!used[u]) abuneSil(u); });
  }

  /* ================= qiymətlər =================
     Qiymət oyunçuya bağlıdır (masa dəyişsə də qalır) və {q, kim, vaxt} kimi saxlanır:
       - q    : növbəti əməliyyatın qiyməti
       - kim  : qiymətin bağlı olduğu təpik vuran oyunçu
       - vaxt : son əməliyyat vaxtı
     Qiymət yenidən 15-dən başlayır əgər:
       1) başqa oyunçu təpik vuribsa ("kim" dəyişibsə), və ya
       2) son əməliyyatdan 1 saat keçibsə.
     Bunlar yoxdursa, hər dəfə +15 artır. */
  var VUR_YOL = 'tepikVurQiymet/';   // təpik vurma qiyməti (hədəf oyunçu üzrə)
  var QORU_YOL = 'tepikQiymet/';     // qoruma qiyməti (qorunan oyunçu üzrə)

  function qiymetHesabla(v, kim, baza) {
    if (!v || typeof v !== 'object' || !v.q || !v.vaxt) return baza;   // yoxdur / köhnə format
    if (indi() - v.vaxt >= CONFIG.qiymetSifirlaDeqiqe * 60 * 1000) return baza;   // 1 saat keçib
    if (kim && v.kim !== kim) return baza;   // başqa oyunçu təpik vurub
    return v.q;
  }
  function qiymetOxuUmumi(yol, uid, kim, baza) {
    return CONFIG.db().ref(yol + uid).once('value').then(function (s) {
      return qiymetHesabla(s.val(), kim, baza);
    });
  }
  function qiymetYaz(yol, uid, q, kim) {
    return CONFIG.db().ref(yol + uid).set({ q: q, kim: kim || '', vaxt: indi() });
  }

  /* təpik vurma qiyməti: hədəf oyunçuya mən vururam */
  function vurQiymetOxu(hedefUid, kim) {
    return qiymetOxuUmumi(VUR_YOL, hedefUid, kim, CONFIG.qiymet);
  }
  /* qoruma qiyməti: qorunan oyunçu, onu təpikləyən "kim"-ə qarşı */
  function qiymetOxu(uid, kim) {
    return qiymetOxuUmumi(QORU_YOL, uid, kim, CONFIG.qorumaQiymet);
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

    var qEl = overlay.querySelector('.tepik-qiymet b');
    qEl.textContent = CONFIG.qiymet;
    vurQiymetOxu(hedefUid, CONFIG.menimUid()).then(function (q) { if (acikUid === hedefUid) qEl.textContent = q; });

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
    if (!masa) { toast('Masa tapılmadı'); return; }
    var btn = overlay.querySelector('.tepik-vur');
    btn.disabled = true;

    var ref = CONFIG.db().ref(ROOT + '/' + hedef), q = 0, evvelki = null;
    ref.once('value').then(function (snap) {
      evvelki = snap.val();
      /* qiymət: eyni oyunçu təpik vurursa qaldığı yerdən artır; başqa oyunçu vurursa
         və ya 1 saat keçibsə yenidən 15-dən başlayır; masa dəyişməsi qiymətə təsir etmir */
      return vurQiymetOxu(hedef, men);
    }).then(function (p) {
      q = p;
      return CONFIG.bonusCix(q);
    }).then(function (ok) {
      if (!ok) throw xeta(BONUS_YOXDUR);
      var baslama = indi();
      var yeni = {
        kim: men,
        masa: String(masa),
        baslama: baslama,
        terkVaxti: baslama + CONFIG.gozleSaniye * 1000,
        bitme: baslama + CONFIG.gozleSaniye * 1000 + CONFIG.qadagaDeqiqe * 60 * 1000,
        xilas: false
      };
      var eski = eskiQadagalar(evvelki, masa);
      if (eski) yeni.eski = eski;   // əvvəlki masadakı qadağa yeni qeydlə silinməsin
      return ref.set(yeni);
    }).then(function () {
      return qiymetYaz(VUR_YOL, hedef, q + CONFIG.vurmaAddim, men);
    }).then(function () {
      toast('Təpik vuruldu!');
      bagla();
    }).catch(function (err) {
      toast(xetaMesaji(err));
      btn.disabled = false;
    });
  }

  /* ================= qoruma ================= */
  function xilas(hedefUid) {
    return CONFIG.db().ref(ROOT + '/' + hedefUid).update({ xilas: true, xilasVaxti: indi() });
  }

  function qoru(hedefUid) {
    var r = CONFIG.db().ref(ROOT + '/' + hedefUid), q = 0, tepikleyen = null;
    return r.once('value').then(function (snap) {
      var v = snap.val();
      if (!v || v.xilas || v.terkVaxti <= indi()) throw xeta('Qoruma artıq lazım deyil');
      tepikleyen = v.kim || null;
      /* qoruma qiyməti də eyni məntiqlə: eyni oyunçunun təpiyinə qarşı qaldığı yerdən artır;
         başqa oyunçu təpik vurubsa və ya 1 saat keçibsə yenidən 15-dən başlayır */
      return qiymetOxu(hedefUid, tepikleyen);
    }).then(function (p) {
      q = p;
      return CONFIG.bonusCix(q);
    }).then(function (ok) {
      if (!ok) throw xeta(BONUS_YOXDUR);   // bonus çatmırsa: pəncərəsiz, 3 saniyəlik yazı
      return xilas(hedefUid);
    }).then(function () {
      return qiymetYaz(QORU_YOL, hedefUid, q + CONFIG.qorumaAddim, tepikleyen);
    }).then(function () { toast('Oyunçu qorundu!'); })
    .catch(function (err) { toast(xetaMesaji(err)); });
  }

  /* kartda qalxanı göstərmək üçün (köhnə API): cb(true/false) */
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

  /* ================= üslublar ================= */
  var stl = document.createElement('style');
  stl.textContent = [
    /* ekranda qısa yazı (pəncərəsiz) */
    '.tepik-yazi{position:fixed;left:50%;top:40%;right:auto;bottom:auto;transform:translate(-50%,-50%);max-width:82vw;padding:3.4vw 5.4vw;border-radius:3.4vw;background:rgba(25,12,45,.92);color:#fff;font:700 4.2vw/1.3 Roboto,Arial,sans-serif;text-align:center;z-index:20010;pointer-events:none;box-shadow:0 1vw 4vw rgba(0,0,0,.4)}',
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
    '.tepik-qov-c{background:none;border:0;color:#cfc4e6;font:500 3.5vw/1 Roboto,Arial,sans-serif;margin-top:4.6vw;padding:1vw 3vw}',
    /* qadağa pəncərəsi */
    '.tepik-qad{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:20002;display:flex;align-items:center;justify-content:center}',
    '.tepik-qad-k{position:relative;width:80vw;background:#fff;border-radius:6vw;padding:6vw 4vw 5vw;text-align:center;font-family:Roboto,Arial,sans-serif}',
    '.tepik-qad-x{position:absolute;right:-2vw;top:-2vw;width:9vw;height:9vw;border-radius:50%;border:0;background:#fff;color:#7cc24a;font-size:7vw;line-height:9vw;padding:0;box-shadow:0 .5vw 2vw rgba(0,0,0,.3)}',
    '.tepik-qad-b{font:500 4.4vw/1.2 Roboto,Arial,sans-serif;color:#9a9a9a;margin-bottom:5vw}',
    '.tepik-qad-s{display:flex;align-items:center;gap:3vw;text-align:left;margin-bottom:5vw}',
    '.tepik-qad-foto{position:relative;width:16vw;height:16vw;flex:none}',
    '.tepik-qad-foto img{width:100%;height:100%;border-radius:2.5vw;object-fit:cover;background:#222}',
    '.tepik-qad-foto span{position:absolute;right:-2vw;bottom:-2vw;font-size:7vw}',
    '.tepik-qad-m{font-size:4vw;line-height:1.25;color:#111}',
    '.tepik-qad-ad{color:#1a1aff}',
    '.tepik-qad-t{background:#fdf8e1;border-radius:3vw;padding:4vw 3vw;font-size:4vw;line-height:1.25;color:#111;margin-bottom:5vw}',
    '.tepik-qad-t b{display:block;font-size:4.8vw;margin-top:1.5vw}',
    '.tepik-qad-t i{font-style:normal}',
    '.tepik-qad-ok{background:#9bc43d;color:#fff;border:0;border-radius:3vw;padding:3vw 9vw;font-size:4.4vw}',
    /* kartdakı nişan */
    '.tepik-belge{position:absolute;left:.8vw;bottom:.8vw;display:flex;align-items:center;gap:.6vw;z-index:5;pointer-events:none;max-width:calc(100% - 1.6vw)}',
    '.tepik-belge-tepik{background:rgba(0,0,0,.72);border-radius:3vw;padding:.3vw 1.6vw .3vw .5vw}',
    '.tepik-belge img{width:4.2vw;height:4.2vw;object-fit:contain}',
    '.tepik-belge-qalxan img{width:5.4vw;height:6.2vw}',
    '.tepik-belge-say{font:700 3.6vw/1 Roboto,Arial,sans-serif;color:#fff}',
    '.tepik-belge-emo{font-size:3.6vw;line-height:1}',
    /* masalar siyahısında sayğac */
    '.tepik-masa-say{font:700 3.2vw/1.2 Roboto,Arial,sans-serif;color:#ff5a7a;text-align:center;margin-top:.8vw}'
  ].join('');
  document.head.appendChild(stl);

  /* ================= təpik vurulana çıxan pəncərə ================= */
  var qovEl = null, qovT = null;
  function qovBagla() { clearInterval(qovT); if (qovEl) { qovEl.remove(); qovEl = null; } }
  function qovAc(v) {
    var men = CONFIG.menimUid();
    /* qoruma qiyməti bu təpikləyənə görə hesablanır (başqa oyunçu vurubsa 15-dən başlayır) */
    Promise.all([qiymetOxu(men, v.kim), CONFIG.adGetir(v.kim)]).then(function (r) {
      /* gözləyərkən vəziyyət dəyişibsə (qorunub / başqa masa) açma */
      if (!sonV || sonV.baslama !== v.baslama || sonV.xilas || !masaUygun(sonV)) return;
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
      /* "Bilirəm, çıxıram" yalnız pəncərəni bağlayır; say oyunçunun kartında davam edir
         və sıfırlananda oyunçu masadan çıxarılır */
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
  var sonV = null, sonMasa = null, tikT = null;

  /* qeyd hazırda oturduğum masaya aiddirmi */
  function masaUygun(v) {
    var m = CONFIG.masaId();
    if (!v.masa) return true;
    return !!m && String(v.masa) === String(m);   // masa məlum deyilsə (lobbi) göstərmə
  }

  function terkEt(v) {
    sonVerilen = v.baslama;
    qovBagla();
    CONFIG.masaniTerkEt();   // başqa masaya keçirmə və qadağa pəncərəsi tepik-baglanti.js-dədir
  }

  function qiymetlendir() {
    var v = sonV;
    clearTimeout(tepikTimer);
    if (!v || v.xilas || v.bitme <= indi()) { qovBagla(); return; }
    /* başqa masadayam: təpiklə bağlı heç bir bildiriş çıxmasın */
    if (!masaUygun(v)) { qovBagla(); return; }

    var qalan = v.terkVaxti - indi();
    if (qalan <= 0) {
      qovBagla();
      if (sonVerilen !== v.baslama) {
        /* yalnız indicə atılmışamsa çıx; sonradan qayıdıbsa sadəcə yadda saxla */
        if (indi() - v.terkVaxti < 10000) terkEt(v);
        else { sonVerilen = v.baslama; CONFIG.masaniTerkEt(); }   // qadağalı masaya qayıdıbsa yerini boşalt
      }
      return;
    }
    if (gosterilen !== v.baslama) { gosterilen = v.baslama; qovAc(v); }
    tepikTimer = setTimeout(function () {
      if (sonV !== v || !masaUygun(v)) return;
      if (v.terkVaxti - indi() > 400) { qiymetlendir(); return; }   // saat fərqi: vaxt hələ bitməyib, taymeri yenidən qur
      menimRef.child('xilas').once('value').then(function (s) {
        if (s.val() || sonVerilen === v.baslama) return;
        if (!masaUygun(v)) return;
        terkEt(v);
      });
    }, qalan);
  }

  function dinle() {
    var men = CONFIG.menimUid();
    if (!men) { setTimeout(dinle, 500); return; }
    if (menimRef) return;
    ofsetDinle();
    menimRef = CONFIG.db().ref(ROOT + '/' + men);
    menimRef.on('value', function (snap) {
      sonV = snap.val();
      qadagaYenile(sonV);   // qadağa həmişə yazılır, amma yalnız v.masa üçün
      qiymetlendir();
    });
    sonMasa = CONFIG.masaId();
    clearInterval(tikT);
    tikT = setInterval(function () {
      var m = CONFIG.masaId();
      if (String(m) !== String(sonMasa)) {   // masa dəyişdi
        sonMasa = m;
        qovBagla();
        qiymetlendir();
      }
      /* ehtiyat: say sıfırlandığı halda taymer işləməyibsə də oyunçu masadan çıxarılsın */
      if (sonV && !sonV.xilas && sonVerilen !== sonV.baslama && sonV.terkVaxti <= indi() &&
          sonV.bitme > indi() && masaUygun(sonV)) qiymetlendir();
      kartTara();
      masaSayaciTara();
    }, 250);
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
    dinle: dinle, qadagaVarmi: qadagaVarmi, qadagaPencere: qadagaPencere,
    qadagaGoster: qadagaGoster,
    qadagaQalan: qadagaQalan, qadagaMasalari: qadagaMasalari, dqSan: dqSan,
    kartTara: kartTara, masaSayaciTara: masaSayaciTara,
    duymeElaveEt: duymeElaveEt
  };
})();
