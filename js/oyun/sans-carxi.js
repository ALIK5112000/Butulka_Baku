/* Şans çarxı modulu — oyun.html-də  <script src="js/sans-carxi.js"></script>  ilə qoşun.
   Səslər: sesler/ qovluğuna atın (sans_klik, sans_firlat, sans_tik, sans_qazan, sans_qazan2 .mp3)
   İstifadə:
     SansCarxi.init({
       button: '#sansCarxBtn',          // yuxarı paneldəki çarx düyməsi (selector və ya element)
       sesYolu: 'sesler/',
       getHearts: () => ürək_sayı,       // oyunun öz ürək sayı
       addHearts: (n) => { ... },        // ürək əlavə et / çıxar (n mənfi ola bilər)
     });
*/
(function () {
  var ICON = '<svg viewBox="0 0 48 48" width="100%" height="100%" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="3.2" fill="#fff" stroke="none"/>' +
    '<path d="M24 7v6M24 35v6M7 24h6M35 24h6M12 12l4 4M32 32l4 4M12 36l4-4M32 16l4-4"/>' +
    '<path d="M5 24l8-5.5v11z" fill="#fff"/></svg>';

  // 16 dilim, saat əqrəbi istiqamətində (yuxarıdan başlayır)
  var P = [
    {e:'❤️',n:5,w:14},{e:'⭐',n:1,t:'+5',w:3},{e:'😂',n:5,w:8},{e:'❤️',n:25,w:6},
    {e:'⭐',n:1,t:'x2',w:3},{e:'🎲',n:3,w:5},{e:'❤️',n:100,w:2},{e:'👏',n:3,w:5},
    {e:'😂',n:1,w:10},{e:'❤️',n:1,w:14},{e:'💋',n:1,w:6},{e:'😂',n:3,w:6},
    {e:'🎲',n:1,w:8},{e:'❤️',n:1000,w:1},{e:'💋',n:3,w:5},{e:'😂',n:25,w:3}
  ];
  var SHOP = [[300,900],[50,150],[15,45],[5,20],[1,5]];
  var cfg = {}, el = {}, spinning = false, rot = 0, A = {};

  function ls(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function ss(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var chances = function () { return ls('sans_sans', 0); };
  function hearts() { return cfg.getHearts ? cfg.getHearts() : ls('sans_urek', 0); }
  function addH(n) { if (cfg.addHearts) cfg.addHearts(n); else ss('sans_urek', hearts() + n); refresh(); }

  function snd(name) {
    try { var a = A[name]; if (!a) { a = A[name] = new Audio(cfg.sesYolu + name + '.mp3'); } a.currentTime = 0; a.play().catch(function () {}); } catch (e) {}
  }

  var CSS = '' +
  '.sc-ov{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:none;font-family:Roboto,Arial,sans-serif;color:#fff;overflow:auto}' +
  '.sc-ov.on{display:block}' +
  '.sc-wrap{max-width:480px;margin:0 auto;padding:12px 12px 30px;position:relative}' +
  '.sc-close{position:absolute;right:10px;top:8px;width:44px;height:44px;border-radius:50%;background:#9ccc3c;border:3px solid #fff;color:#fff;font-size:26px;line-height:34px;text-align:center;cursor:pointer;z-index:3}' +
  '.sc-info{background:rgba(30,20,10,.82);border-radius:20px;padding:14px 16px;margin-top:52px;text-align:center;position:relative}' +
  '.sc-info h3{margin:0 0 8px;color:#ffd83a;font-size:17px}' +
  '.sc-info p{margin:0 0 12px;font-size:16px;line-height:1.35}' +
  '.sc-q{position:absolute;left:14px;top:8px;font-size:24px;font-weight:700}' +
  '.sc-eht{display:inline-block;background:linear-gradient(#ffd36b,#f5a21a);color:#5a2a00;font-weight:700;border:0;border-radius:20px;padding:9px 20px;font-size:16px;cursor:pointer}' +
  '.sc-line{border-top:1px solid rgba(255,255,255,.35);margin:12px 4px}' +
  '.sc-chn{font-size:17px;display:flex;justify-content:center;align-items:center;gap:8px}' +
  '.sc-pill{display:inline-flex;align-items:center;gap:6px;border:1px solid #3a8a6a;border-radius:20px;padding:2px 10px 2px 4px;font-weight:700}' +
  '.sc-dice{display:inline-flex;width:30px;height:30px;border-radius:8px;background:#0e8f72;align-items:center;justify-content:center;font-size:18px}' +
  '.sc-plus{width:24px;height:24px;border-radius:50%;background:#9ccc3c;color:#fff;font-weight:700;text-align:center;line-height:24px;cursor:pointer}' +
  '.sc-stage{position:relative;width:min(92vw,440px);height:min(92vw,440px);margin:18px auto 0}' +
  '.sc-wheel{width:100%;height:100%;transition:transform 5s cubic-bezier(.12,.6,.1,1)}' +
  '.sc-ptr{position:absolute;left:-14px;top:50%;margin-top:-34px;width:68px;height:68px;transform:rotate(45deg);background:linear-gradient(#ffd64a,#f0a000);border-radius:12px;border:3px solid #ffe38a;display:flex;align-items:center;justify-content:center}' +
  '.sc-ptr i{transform:rotate(-45deg);font-style:normal;font-size:30px}' +
  '.sc-heart{position:absolute;left:50%;top:50%;width:68px;height:68px;margin:-34px 0 0 -34px;border-radius:50%;background:radial-gradient(#fff,#cfd3d6);border:5px solid #f6b81a;display:flex;align-items:center;justify-content:center;font-size:28px;color:#e8eaec}' +
  '.sc-cost{text-align:center;margin:14px 0 10px;font-size:17px}' +
  '.sc-btn{display:block;width:260px;margin:0 auto;background:#9ccc3c;color:#fff;border:0;border-radius:10px;padding:14px;font-size:20px;cursor:pointer}' +
  '.sc-btn[disabled]{opacity:.45}' +
  '.sc-res{position:absolute;inset:0;border-radius:50%;background:rgba(0,40,30,.82);display:none;flex-direction:column;align-items:center;justify-content:center;animation:scp .5s}' +
  '.sc-res.on{display:flex}' +
  '.sc-res b{font-size:84px;line-height:1;text-shadow:0 0 30px #ffe27a}.sc-res span{font-size:32px;font-weight:700;margin-top:8px}' +
  '@keyframes scp{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}' +
  '.sc-shop{position:absolute;left:50%;transform:translateX(-50%);top:150px;width:300px;background:#e9f7f2;color:#0a5a44;border-radius:18px;padding:12px;display:none;z-index:4;box-shadow:0 6px 24px #0007}' +
  '.sc-shop.on{display:block}.sc-shop h4{text-align:center;margin:0 0 10px;font-size:14px}' +
  '.sc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}' +
  '.sc-it{background:#fff;border-radius:10px;text-align:center;padding:8px 2px;cursor:pointer;font-weight:700;font-size:14px}' +
  '.sc-it small{display:block;color:#e8581c;margin-top:4px;font-size:13px}' +
  '.sc-prob{display:none;margin-top:10px;font-size:13px;text-align:left}.sc-prob.on{display:block}';

  function build() {
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var ov = document.createElement('div'); ov.className = 'sc-ov';
    ov.innerHTML =
      '<div class="sc-wrap"><div class="sc-close">×</div>' +
      '<div class="sc-info"><div class="sc-q">?</div><h3>Şans çarxı</h3>' +
      '<p>“<b>Spin</b>” üzərinə vuraraq <b>Şans çarxını</b> işə salın və hədiyyənizi alın!</p>' +
      '<button class="sc-eht">📊 Ehtimallar</button><div class="sc-prob"></div><div class="sc-line"></div>' +
      '<div class="sc-chn">Şanslar: <span class="sc-pill"><span class="sc-dice">🎲</span><b class="sc-cn">0</b></span><span class="sc-plus">+</span></div></div>' +
      '<div class="sc-shop"><h4>Şanslar mağazası</h4><div class="sc-grid"></div></div>' +
      '<div class="sc-stage"><div class="sc-wheel"></div><div class="sc-ptr"><i>🏹</i></div><div class="sc-heart">♥</div>' +
      '<div class="sc-res"><b></b><span></span></div></div>' +
      '<div class="sc-cost">Qiyməti: <span class="sc-dice" style="width:26px;height:26px">🎲</span> <b>1</b></div>' +
      '<button class="sc-btn">Fırlat</button></div>';
    document.body.appendChild(ov);
    el.ov = ov; el.wheel = ov.querySelector('.sc-wheel'); el.btn = ov.querySelector('.sc-btn');
    el.cn = ov.querySelector('.sc-cn'); el.res = ov.querySelector('.sc-res'); el.shop = ov.querySelector('.sc-shop');
    el.prob = ov.querySelector('.sc-prob');

    // çarx SVG
    var s = '<svg viewBox="-100 -100 200 200"><defs><linearGradient id="scg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd24a"/><stop offset="1" stop-color="#e8890a"/></linearGradient></defs>' +
      '<circle r="99" fill="url(#scg)"/><circle r="88" fill="#00a383"/>';
    var n = P.length, step = 360 / n;
    for (var i = 0; i < n; i++) {
      var a0 = (i * step - step / 2 - 90) * Math.PI / 180, a1 = (i * step + step / 2 - 90) * Math.PI / 180;
      s += '<path d="M0 0L' + (88 * Math.cos(a0)).toFixed(2) + ' ' + (88 * Math.sin(a0)).toFixed(2) + 'A88 88 0 0 1 ' + (88 * Math.cos(a1)).toFixed(2) + ' ' + (88 * Math.sin(a1)).toFixed(2) + 'Z" fill="' + (i % 2 ? '#00b08a' : '#00c79c') + '" stroke="#0a8f72" stroke-width=".6"/>';
      var p = P[i];
      s += '<g transform="rotate(' + (i * step) + ')"><text y="-68" font-size="15" text-anchor="middle">' + p.e + '</text>' +
        '<text y="-46" font-size="9" font-weight="700" fill="#fff" text-anchor="middle">' + (p.t || p.n) + '</text></g>';
    }
    el.wheel.innerHTML = s + '</svg>';

    var g = el.shop.querySelector('.sc-grid');
    SHOP.forEach(function (x) {
      var d = document.createElement('div'); d.className = 'sc-it';
      d.innerHTML = '🎲 ' + x[0] + '<small>❤️ ' + x[1] + '</small>';
      d.onclick = function () {
        snd('sans_klik');
        if (hearts() < x[1]) { return; }
        addH(-x[1]); ss('sans_sans', chances() + x[0]); refresh(); el.shop.classList.remove('on');
      };
      g.appendChild(d);
    });
    var tot = P.reduce(function (a, b) { return a + b.w; }, 0);
    el.prob.innerHTML = P.map(function (p) { return p.e + ' ' + (p.t || p.n) + ' — ' + (p.w * 100 / tot).toFixed(1) + '%'; }).join('<br>');

    ov.querySelector('.sc-close').onclick = close;
    ov.querySelector('.sc-plus').onclick = function () { snd('sans_klik'); el.shop.classList.toggle('on'); };
    ov.querySelector('.sc-eht').onclick = function () { snd('sans_klik'); el.prob.classList.toggle('on'); };
    el.btn.onclick = spin;
    el.res.onclick = function () { el.res.classList.remove('on'); el.btn.textContent = 'Fırlat'; };
  }

  function refresh() { el.cn.textContent = chances(); }
  function open() { snd('sans_klik'); refresh(); el.res.classList.remove('on'); el.ov.classList.add('on'); }
  function close() { if (spinning) return; snd('sans_klik'); el.ov.classList.remove('on'); el.shop.classList.remove('on'); }

  function pick() {
    var tot = P.reduce(function (a, b) { return a + b.w; }, 0), r = Math.random() * tot;
    for (var i = 0; i < P.length; i++) { r -= P[i].w; if (r <= 0) return i; }
    return 0;
  }

  function spin() {
    if (spinning) return;
    if (el.res.classList.contains('on')) { el.res.classList.remove('on'); }
    if (chances() < 1) { el.shop.classList.add('on'); snd('sans_klik'); return; }
    ss('sans_sans', chances() - 1); refresh();
    spinning = true; el.btn.disabled = true; el.btn.textContent = 'Fırlat';
    var i = pick(), step = 360 / P.length;
    var target = ((270 - i * step) % 360 + 360) % 360;
    rot = rot - (rot % 360) + 360 * 6 + target;
    snd('sans_firlat');
    el.wheel.style.transform = 'rotate(' + rot + 'deg)';
    setTimeout(function () { snd('sans_tik'); }, 4800);
    setTimeout(function () {
      var p = P[i]; spinning = false; el.btn.disabled = false;
      el.res.querySelector('b').textContent = p.e;
      el.res.querySelector('span').textContent = (p.t || p.n);
      el.res.classList.add('on');
      snd(p.n >= 25 || p.e === '🎲' ? 'sans_qazan' : 'sans_qazan2');
      if (p.e === '❤️') addH(p.n);
      else if (p.e === '🎲') { ss('sans_sans', chances() + p.n); refresh(); }
      if (cfg.onPrize) cfg.onPrize(p);
    }, 5200);
  }

  window.SansCarxi = {
    init: function (c) {
      cfg = c || {}; cfg.sesYolu = cfg.sesYolu || 'sesler/';
      build();
      var b = typeof cfg.button === 'string' ? document.querySelector(cfg.button) : cfg.button;
      if (b) { if (cfg.ikonYenile !== false) b.innerHTML = ICON; b.onclick = open; }
      ['sans_klik', 'sans_firlat', 'sans_tik', 'sans_qazan', 'sans_qazan2'].forEach(function (n) { A[n] = new Audio(cfg.sesYolu + n + '.mp3'); A[n].preload = 'auto'; });
    },
    open: open, close: close, icon: ICON
  };
})();
