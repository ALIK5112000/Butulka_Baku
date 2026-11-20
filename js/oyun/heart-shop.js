(function () {
  const PACKS = [
    { top: 'PREMIUM<br>İCAZƏNAMƏ', icon: '🎟️', btn: 'Təfərrüatlar', color: 'blue' },
    { top: '<b>VIP</b><small>STATUS</small>', icon: '👑', btn: 'Təfərrüatlar', color: 'blue' },
    { hearts: 14000, bonus: 40, icon: '🧰', btn: '10000', color: 'green', tag: ['Ən yaxşı təklif', 'pink'] },
    { hearts: 6500, bonus: 30, icon: '🛢️', btn: '5000', color: 'green' },
    { hearts: 1200, bonus: 20, icon: '🏺', btn: '1000', color: 'green', tag: ['Ən yaxşı', 'purple'] },
    { hearts: 575, bonus: 15, icon: '👝', btn: '500', color: 'green' },
    { hearts: 270, bonus: 8, icon: '🎁', btn: '250', color: 'green' },
    { hearts: 300, icon: '❤️', btn: 'Götür', color: 'cyan', tag: ['Pulsuz', 'purple'], free: true }
  ];

  const ov = document.createElement('div');
  ov.className = 'hs-overlay';
  ov.innerHTML = '<div class="hs-modal"><button class="hs-close">×</button><div class="hs-title">Ürəklər satın al</div><div class="hs-scroll"><div class="hs-grid"></div><div class="hs-sellers">▸ 💬 Satıcılardan al (1)</div></div></div>';
  const grid = ov.querySelector('.hs-grid');

  PACKS.forEach(p => {
    const c = document.createElement('div');
    c.className = 'hs-card';
    const top = p.hearts
      ? '<div class="hs-top">❤️' + p.hearts + (p.bonus ? '<small>' + p.bonus + '% BONUS</small>' : '') + '</div>'
      : '<div class="hs-top gold">' + p.top + '</div>';
    c.innerHTML = (p.tag ? '<div class="hs-tag ' + p.tag[1] + '">' + p.tag[0] + '</div>' : '') + top +
      '<div class="hs-img">' + p.icon + '</div><button class="hs-btn ' + p.color + '">' + p.btn + '</button>';
    // satın alma / pulsuz götürmə məntiqi sonra bu hadisəyə bağlanacaq
    c.querySelector('button').onclick = () => window.dispatchEvent(new CustomEvent('hearts:buy', { detail: p }));
    grid.appendChild(c);
  });

  let openedAt = 0;
  const open = () => { openedAt = Date.now(); ov.classList.add('open'); };
  const close = () => ov.classList.remove('open');
  ov.querySelector('.hs-close').onclick = close;
  ov.addEventListener('click', e => { if (e.target === ov && Date.now() - openedAt > 500) close(); });
  document.body.appendChild(ov);

  // Üst panelin üstünü hansısa qat örtsə belə işləsin deyə: toxunuşun koordinatına baxırıq
  function inside(el, x, y) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    return x >= r.left - 10 && x <= r.right + 10 && y >= r.top - 10 && y <= r.bottom + 10;
  }
  var lastOpen = 0;
  function check(e) {
    if (ov.classList.contains('open')) return;
    if (Date.now() - lastOpen < 400) return;
    var x = e.clientX, y = e.clientY;
    if (inside(document.getElementById('urekBtn'), x, y) || inside(document.getElementById('urekSayi'), x, y)) {
      lastOpen = Date.now();
      open();
    }
  }
  window.addEventListener('click', check, true);

  window.HeartShop = { open, close };

  // TEST: fayl yükləndiyini göstərir (təsdiqləndikdən sonra silin)
  var tt = document.createElement('div');
  tt.textContent = 'heart-shop v3 yükləndi';
  tt.style.cssText = 'position:fixed;bottom:70px;left:50%;transform:translateX(-50%);background:#222;color:#fff;padding:6px 12px;border-radius:8px;font:13px Arial;z-index:100000';
  document.body.appendChild(tt);
  setTimeout(function () { tt.remove(); }, 3000);
})();
