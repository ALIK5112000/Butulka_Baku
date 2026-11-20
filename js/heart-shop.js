(function () {
  const KEY = 'hearts_balance';
  const FREE_KEY = 'hearts_free_time';
  const HEART_SVG = '<svg viewBox="0 0 24 24"><path fill="#ff5a14" stroke="#f3d9cf" stroke-width="1.5" d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/></svg>';

  const PACKS = [
    { top: '<span class="gold">PREMIUM<br>İCAZƏNAMƏ</span>', icon: '🎟️', btn: 'Təfərrüatlar', color: 'blue', type: 'premium' },
    { top: '<b>VIP</b><small>STATUS</small>', icon: '👑', btn: 'Təfərrüatlar', color: 'blue', type: 'vip' },
    { hearts: 14000, bonus: 40, icon: '🧰', btn: '10000', color: 'green', tag: ['Ən yaxşı təklif', 'pink'] },
    { hearts: 6500, bonus: 30, icon: '🛢️', btn: '5000', color: 'green' },
    { hearts: 1200, bonus: 20, icon: '🏺', btn: '1000', color: 'green', tag: ['Ən yaxşı', 'purple'] },
    { hearts: 575, bonus: 15, icon: '👝', btn: '500', color: 'green' },
    { hearts: 270, bonus: 8, icon: '🎁', btn: '250', color: 'green' },
    { hearts: 300, icon: '❤️', btn: 'Götür', color: 'cyan', tag: ['Pulsuz', 'purple'], free: true }
  ];

  const get = () => parseInt(localStorage.getItem(KEY) || '0', 10);
  function set(n) {
    localStorage.setItem(KEY, Math.max(0, n));
    render(true);
    window.dispatchEvent(new CustomEvent('hearts:change', { detail: get() }));
  }
  const add = n => set(get() + n);

  /* ---- ikon + say ---- */
  const widget = document.createElement('div');
  widget.id = 'heart-widget';
  widget.innerHTML = HEART_SVG + '<span class="hw-num"></span>';
  function render(pop) {
    widget.querySelector('.hw-num').textContent = get();
    if (pop) { widget.classList.remove('hw-pop'); void widget.offsetWidth; widget.classList.add('hw-pop'); }
  }

  /* ---- pəncərə ---- */
  const ov = document.createElement('div');
  ov.className = 'hs-overlay';
  ov.innerHTML = '<div class="hs-modal"><button class="hs-close">×</button><div class="hs-title">Ürəklər satın al</div><div class="hs-grid"></div><div class="hs-sellers">▸ 💬 Satıcılardan al (1)</div></div>';
  const grid = ov.querySelector('.hs-grid');

  PACKS.forEach(p => {
    const c = document.createElement('div');
    c.className = 'hs-card';
    const top = p.hearts
      ? `<div class="hs-top">❤️${p.hearts}${p.bonus ? `<small>${p.bonus}% BONUS</small>` : ''}</div>`
      : `<div class="hs-top gold">${p.top}</div>`;
    c.innerHTML = (p.tag ? `<div class="hs-tag ${p.tag[1]}">${p.tag[0]}</div>` : '') + top +
      `<div class="hs-img">${p.icon}</div><button class="hs-btn ${p.color}">${p.btn}</button>`;
    const b = c.querySelector('button');
    b.onclick = () => {
      if (p.free) {
        const last = +localStorage.getItem(FREE_KEY) || 0;
        if (Date.now() - last < 864e5) return alert('Pulsuz ürək artıq götürülüb. 24 saatdan sonra yenə gəl.');
        localStorage.setItem(FREE_KEY, Date.now());
        add(p.hearts);
      } else {
        window.dispatchEvent(new CustomEvent('hearts:buy', { detail: p })); // satın alma məntiqi sonra
      }
    };
    grid.appendChild(c);
  });

  const open = () => ov.classList.add('open');
  const close = () => ov.classList.remove('open');
  widget.onclick = open;
  ov.querySelector('.hs-close').onclick = close;
  ov.addEventListener('click', e => { if (e.target === ov) close(); });

  /* ---- səhifəyə yerləşdir ---- */
  function mount() {
    const slot = document.getElementById('heart-slot');
    if (slot) slot.appendChild(widget); else { widget.classList.add('hw-fixed'); document.body.appendChild(widget); }
    document.body.appendChild(ov);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();

  window.addEventListener('storage', e => { if (e.key === KEY) render(true); }); // başqa tabda dəyişsə
  window.HeartShop = { get, set, add, open, close };
})();
