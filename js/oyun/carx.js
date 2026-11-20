/* carx.js - Şans Çarxı (Колесо Удачи stilində). Heç bir kitabxana lazım deyil.
   Qoşulma: oyun.html-in sonunda  <script src="js/carx.js"></script>
   Sonra çarx ikonunun seçicisini aşağıdakı CARX_CONFIG.trigger-ə yaz. */
(function () {
  const CARX_CONFIG = {
    trigger: '',                  // boş qalsa, "23 gün"-ün yanındakı ikonu özü tapır
    getHearts: () => window.hearts || 0,                 // ürək sayını oxu
    addHearts: (n) => { window.hearts = (window.hearts || 0) + n;
                        const el = document.querySelector('#heartsCount'); if (el) el.textContent = window.hearts; },
    chancesKey: 'carx_chances',
    startChances: 1,
    // İstəsən öz səs fayllarını sesler/ qovluğuna at, burada yaz (boş qalsa kodla yaranan səs çalır)
    sounds: { tick: '', spin: '', win: '', click: '' }, // məs: 'sesler/tick.mp3'
  };

  Object.assign(CARX_CONFIG, window.CARX_OPTIONS || {});

  const SEG = [ // sektorlar: tip + dəyər
    ['heart',3],['dice',3],['heart',25],['dice',1],['heart',100],['heart',3],['dice',3],['heart',10],
    ['heart',5],['dice',1],['heart',1000],['heart',3],['dice',3],['heart',25],['heart',5],['dice',1]
  ];
  const SHOP = [[300,900],[50,150],[15,45],[5,20],[1,5]]; // [şans, ürək qiyməti]

  /* ---------- səs ---------- */
  let ac; const ctx = () => ac || (ac = new (window.AudioContext || window.webkitAudioContext)());
  const files = {};
  function play(name, synth) {
    const src = CARX_CONFIG.sounds[name];
    if (src) { (files[name] = files[name] || new Audio(src)).cloneNode().play().catch(()=>{}); return; }
    try { synth(ctx()); } catch (e) {}
  }
  function beep(a, f, t, d, type, g) {
    const o = a.createOscillator(), v = a.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    v.gain.setValueAtTime(g || .15, t); v.gain.exponentialRampToValueAtTime(.001, t + d);
    o.connect(v); v.connect(a.destination); o.start(t); o.stop(t + d);
  }
  const sClick = () => play('click', a => beep(a, 520, a.currentTime, .08, 'triangle'));
  const sTick  = () => play('tick',  a => beep(a, 1400, a.currentTime, .035, 'square', .06));
  const sSpin  = () => play('spin',  a => { const t=a.currentTime; const o=a.createOscillator(),v=a.createGain();
      o.type='sawtooth'; o.frequency.setValueAtTime(200,t); o.frequency.exponentialRampToValueAtTime(700,t+.5);
      v.gain.setValueAtTime(.05,t); v.gain.exponentialRampToValueAtTime(.001,t+.6);
      o.connect(v); v.connect(a.destination); o.start(t); o.stop(t+.6); });
  const sWin   = () => play('win',   a => [660,830,990,1320].forEach((f,i)=>beep(a,f,a.currentTime+i*.11,.3,'triangle',.18)));

  /* ---------- CSS ---------- */
  const css = `
  #carxOv{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9999;display:none;flex-direction:column;align-items:center;font-family:Roboto,Arial,sans-serif;color:#fff}
  #carxOv.on{display:flex}
  .cx-close{position:absolute;top:14px;right:14px;width:42px;height:42px;border-radius:50%;background:#7cc43a;border:2px solid #fff;color:#fff;font-size:24px;line-height:38px;text-align:center}
  .cx-info{margin-top:70px;width:88%;max-width:420px;background:rgba(20,20,20,.7);border-radius:14px;padding:12px 14px;text-align:center;font-size:15px}
  .cx-info b.t{display:block;color:#e8d34a;font-size:16px;margin-bottom:6px}
  .cx-ch{display:inline-flex;align-items:center;gap:6px;margin-top:8px;border:2px solid #fff3;border-radius:16px;padding:2px 8px;background:#0006}
  .cx-ch i{font-style:normal;background:#2aa97b;border-radius:5px;padding:0 5px}
  .cx-ch u{text-decoration:none;background:#7cc43a;border-radius:50%;width:20px;height:20px;line-height:20px;font-weight:700}
  .cx-wrap{position:relative;width:min(84vw,340px);aspect-ratio:1;margin-top:24px}
  .cx-ring{position:absolute;inset:0;border-radius:50%;background:radial-gradient(#f5c842,#b07a12);box-shadow:0 0 0 4px #7a5208,0 8px 24px #000a}
  #cxWheel{position:absolute;inset:3.5%;border-radius:50%;transition:transform 4.6s cubic-bezier(.12,.6,.1,1);overflow:hidden}
  #cxWheel svg{width:100%;height:100%}
  .cx-hub{position:absolute;left:50%;top:50%;width:19%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(#fff,#bbb);border:4px solid #e6b422;display:flex;align-items:center;justify-content:center;color:#999;font-size:24px}
  .cx-ptr{position:absolute;left:-7%;top:50%;transform:translateY(-50%);width:0;height:0;border:16px solid transparent;border-left:30px solid #e6a722;filter:drop-shadow(0 2px 3px #0008)}
  .cx-price{margin-top:14px;font-size:15px}.cx-price i{font-style:normal;background:#2aa97b;border-radius:5px;padding:0 5px}
  .cx-btn{margin-top:10px;background:#7cae1d;border:0;color:#fff;font-size:18px;padding:10px 70px;border-radius:8px;font-weight:600}
  .cx-btn:disabled{opacity:.5}
  .cx-shop{position:absolute;inset:0;background:#0007;display:none;align-items:center;justify-content:center}
  .cx-shop.on{display:flex}
  .cx-box{position:relative;width:88%;max-width:380px;background:#d9f7ec;border-radius:16px;padding:14px;color:#222}
  .cx-box h4{margin:0 0 10px;text-align:center;color:#2a7a5c}
  .cx-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
  .cx-it{background:#fff;border-radius:10px;padding:6px;text-align:center;font-weight:700}
  .cx-it .n{color:#1faa7a;font-size:18px}.cx-it .p{font-size:13px;margin-top:4px}
  .cx-box .cx-close{top:-14px;right:-10px;width:34px;height:34px;line-height:30px;font-size:20px;background:#fff;color:#1faa7a;border-color:#fff}
  .cx-res{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;background:#000a;font-size:56px;font-weight:700;text-shadow:0 0 20px #ff6a00}
  .cx-res.on{display:flex}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* ---------- DOM ---------- */
  const N = SEG.length, A = 360 / N;
  let paths = '';
  for (let i = 0; i < N; i++) {
    const a1 = (i * A - 90 - A / 2) * Math.PI / 180, a2 = ((i + 1) * A - 90 - A / 2) * Math.PI / 180;
    const x1 = 100 + 100 * Math.cos(a1), y1 = 100 + 100 * Math.sin(a1), x2 = 100 + 100 * Math.cos(a2), y2 = 100 + 100 * Math.sin(a2);
    const am = (i * A - 90) * Math.PI / 180, tx = 100 + 72 * Math.cos(am), ty = 100 + 72 * Math.sin(am);
    const [type, v] = SEG[i];
    paths += `<path d="M100 100L${x1} ${y1}A100 100 0 0 1 ${x2} ${y2}Z" fill="${i % 2 ? '#13a37a' : '#0f8f6c'}" stroke="#0a6a50" stroke-width=".6"/>
      <text x="${tx}" y="${ty}" font-size="11" fill="#fff" text-anchor="middle" dominant-baseline="middle" transform="rotate(${i * A} ${tx} ${ty})">${type === 'heart' ? '❤' : '🎲'}${v}</text>`;
  }
  const ov = document.createElement('div'); ov.id = 'carxOv';
  ov.innerHTML = `<div class="cx-close" id="cxX">×</div>
   <div class="cx-info"><b class="t">Şans Çarxı</b>«Fırlat» düyməsinə bas, çarxı fırlat və mükafatını qazan!
     <div class="cx-ch">Şanslar: <i>🎲</i> <span id="cxCh">0</span> <u id="cxPlus">+</u></div></div>
   <div class="cx-wrap"><div class="cx-ring"></div><div id="cxWheel"><svg viewBox="0 0 200 200">${paths}</svg></div>
     <div class="cx-hub">♥</div><div class="cx-ptr"></div>
     <div class="cx-res" id="cxRes"></div></div>
   <div class="cx-price">Qiymət: <i>🎲</i> 1</div>
   <button class="cx-btn" id="cxSpin">Fırlat</button>
   <div class="cx-shop" id="cxShop"><div class="cx-box"><div class="cx-close" id="cxShopX">×</div>
     <h4>Şans mağazası</h4><div class="cx-grid" id="cxGrid"></div></div></div>`;
  document.body.appendChild(ov);
  const $ = id => document.getElementById(id);
  $('cxGrid').innerHTML = SHOP.map((s, i) => `<div class="cx-it" data-i="${i}"><div class="n">${s[0]}</div>🎲<div class="p">❤ ${s[1]}</div></div>`).join('');

  /* ---------- məntiq ---------- */
  let ch = +(localStorage.getItem(CARX_CONFIG.chancesKey) ?? CARX_CONFIG.startChances), rot = 0, busy = false;
  const save = () => { localStorage.setItem(CARX_CONFIG.chancesKey, ch); $('cxCh').textContent = ch; };
  save();

  function open() { sClick(); ov.classList.add('on'); }
  function close() { if (busy) return; sClick(); ov.classList.remove('on'); }

  $('cxX').onclick = close;
  $('cxPlus').onclick = () => { sClick(); $('cxShop').classList.add('on'); };
  $('cxShopX').onclick = () => { sClick(); $('cxShop').classList.remove('on'); };
  $('cxGrid').onclick = e => {
    const it = e.target.closest('.cx-it'); if (!it) return;
    const [n, price] = SHOP[+it.dataset.i];
    if (CARX_CONFIG.getHearts() < price) { alert('Kifayət qədər ürək yoxdur'); return; }
    sClick(); CARX_CONFIG.addHearts(-price); ch += n; save();
  };

  $('cxSpin').onclick = () => {
    if (busy) return;
    if (ch < 1) { sClick(); $('cxShop').classList.add('on'); return; }
    ch--; save(); busy = true; $('cxSpin').disabled = true; sSpin();
    const idx = Math.floor(Math.random() * N);                 // nəticə (istəsən çəkili et)
    const target = 360 * 6 + (360 - idx * A);                  // oxun altına gətir
    const prev = rot; rot = rot - (rot % 360) + target;
    const w = $('cxWheel'); w.style.transform = `rotate(${rot}deg)`;
    // fırlananda hər sektor keçəndə "tık" səsi
    const t0 = performance.now(), dur = 4600, total = rot - prev; let lastSeg = 0;
    (function loop(now) {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3.2);
      const seg = Math.floor((total * e) / A); if (seg !== lastSeg) { lastSeg = seg; sTick(); }
      if (p < 1) requestAnimationFrame(loop);
    })(t0);
    setTimeout(() => {
      const [type, v] = SEG[idx]; sWin();
      if (type === 'heart') CARX_CONFIG.addHearts(v); else { ch += v; save(); }
      const r = $('cxRes'); r.textContent = (type === 'heart' ? '❤ ' : '🎲 ') + '+' + v; r.classList.add('on');
      setTimeout(() => { r.classList.remove('on'); busy = false; $('cxSpin').disabled = false; }, 1800);
    }, dur + 100);
  };

  const ICON = '<svg viewBox="0 0 48 48" width="62%" height="62%" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none">'
    + '<circle cx="26" cy="24" r="16"/><circle cx="26" cy="24" r="3.5" fill="#fff"/>'
    + '<path d="M26 8v9M26 31v9M10 24h9M33 24h9M14.7 12.7l6.4 6.4M30.9 28.9l6.4 6.4M37.3 12.7l-6.4 6.4M21.1 28.9l-6.4 6.4"/>'
    + '<path d="M3 17v14l9-7z" fill="#fff"/></svg>';

  function findTarget() {
    if (CARX_CONFIG.trigger) { const t = document.querySelector(CARX_CONFIG.trigger); if (t) return t; }
    // "23 gün" yazısını tap, onun yanındakı (növbəti) ikon çarx ikonudur
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      if (/^\s*\d+\s*g[uü]n\s*$/i.test(n.nodeValue)) {
        let h = n.parentElement;
        while (h && h.parentElement && h.parentElement !== document.body && h.parentElement.children.length < 4) h = h.parentElement;
        if (h && h.nextElementSibling) return h.nextElementSibling;
      }
    }
    return null;
  }

  function styleBtn(b) {
    b.id = 'carxBtn'; b.innerHTML = ICON;
    b.style.cssText += ';display:flex;align-items:center;justify-content:center;cursor:pointer;border-radius:50%;background:#cc8a45;-webkit-tap-highlight-color:transparent;';
  }

  function bind() {
    if (CARX_CONFIG.trigger) {   // seçici verilibsə: ikona toxunmadan, yalnız klikə qulaq as
      document.addEventListener('click', e => {
        if (e.target.closest && e.target.closest(CARX_CONFIG.trigger)) { e.stopPropagation(); e.preventDefault(); open(); }
      }, true);
      return;
    }
    try {
      let t = findTarget();
      if (t) {
        const c = t.cloneNode(false);               // köhnə klik hadisələrini təmizlə
        t.replaceWith(c); t = c;
        if (!t.style.width) { t.style.width = '40px'; t.style.height = '40px'; }
        styleBtn(t);
      } else {                                      // tapılmasa üzən düymə qoy
        t = document.createElement('div');
        t.style.cssText = 'position:fixed;top:14px;right:150px;width:40px;height:40px;z-index:9000;';
        styleBtn(t); document.body.appendChild(t);
        console.warn('carx: panel tapılmadı, üzən düymə qoyuldu');
      }
      t.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); open(); }, true);
    } catch (err) { console.error('carx xətası:', err); }
  }
  // oyun paneli gec yaranırsa üçün bir az gözlə
  const go = () => { bind(); if (!CARX_CONFIG.trigger) setTimeout(() => { if (!document.getElementById('carxBtn')) bind(); }, 1500); };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', go) : go();
  window.openCarx = open;
})();
