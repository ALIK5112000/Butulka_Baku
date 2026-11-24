/* reytinq.js - Reytinqlər pəncərəsi (ayrıca fayl)
   Açmaq üçün: window.Reytinq.ac()
   Menyudakı "Reytinqlər" düyməsinə onclick="Reytinq.ac()" bağla. */
(function () {
  const TABS = [
    { id: 'kiss',   icon: '💋', title: 'Ən çox öpülən' },
    { id: 'music',  icon: '🎵', title: 'Ən çox musiqi' },
    { id: 'heart',  icon: '💙', title: 'Ən çox bəyənilən' },
    { id: 'hearts', icon: '💞', title: 'Ən çox cütlük' },
    { id: 'smile',  icon: '😄', title: 'Ən aktiv' },
    { id: 'crown',  icon: '👑', title: 'Ən çox hədiyyə' },
    { id: 'time',   icon: '🕒', title: 'Ən çox oyun vaxtı' }
  ];
  const PERIODS = [
    { id: 'all',   label: 'hər zaman' },
    { id: 'month', label: 'bu ay' },
    { id: 'week',  label: 'bu həftə' },
    { id: 'day',   label: 'bu gün' }
  ];

  let state = { tab: 'kiss', period: 'all' };
  let root;

  /* ---- DATA: bunu Firebase-ə görə doldur ----
     Qaytarmalı format:
     { list: [{place, name, photo, score}], me: {place, name, photo, score} } */
  async function yukle(tab, period) {
    if (typeof window.reytinqData === 'function') return window.reytinqData(tab, period);
    return { list: [], me: null };
  }

  function sira(r, mine) {
    const d = document.createElement('div');
    d.className = 'rtq-row' + (mine ? ' mine' : '');
    d.innerHTML =
      '<img src="' + (r.photo || '') + '" alt="">' +
      '<div class="rtq-place">' + r.place + '.</div>' +
      '<div class="rtq-name"></div>' +
      '<div class="rtq-score"><span class="ic">' + TABS.find(t => t.id === state.tab).icon +
      '</span><span>' + Number(r.score).toLocaleString('fr-FR') + '</span></div>';
    d.querySelector('.rtq-name').textContent = r.name || '';
    return d;
  }

  async function render() {
    const tab = TABS.find(t => t.id === state.tab);
    root.querySelectorAll('.rtq-tab').forEach(el =>
      el.classList.toggle('active', el.dataset.id === state.tab));
    root.querySelector('#rtq-title').textContent = tab.title;

    const list = root.querySelector('#rtq-list');
    const me = root.querySelector('#rtq-me');
    list.innerHTML = ''; me.innerHTML = '';
    const data = await yukle(state.tab, state.period);
    (data.list || []).forEach(r => list.appendChild(sira(r, false)));
    if (data.me) me.appendChild(sira(data.me, true));
  }

  function qur() {
    root = document.createElement('div');
    root.id = 'rtq-overlay';
    root.innerHTML =
      '<div id="rtq-box">' +
        '<button id="rtq-close" type="button">×</button>' +
        '<div id="rtq-head">' +
          '<div id="rtq-tabs">' +
            TABS.map(t => '<span class="rtq-tab" data-id="' + t.id + '">' + t.icon + '</span>').join('') +
          '</div>' +
          '<div id="rtq-sub"><span id="rtq-title"></span>' +
            '<select id="rtq-period">' +
              PERIODS.map(p => '<option value="' + p.id + '">' + p.label + '</option>').join('') +
            '</select></div>' +
        '</div>' +
        '<div id="rtq-list"></div>' +
        '<div id="rtq-me"></div>' +
      '</div>';
    document.body.appendChild(root);

    root.querySelector('#rtq-close').onclick = bagla;
    root.addEventListener('click', e => { if (e.target === root) bagla(); });
    root.querySelectorAll('.rtq-tab').forEach(el =>
      el.onclick = () => { state.tab = el.dataset.id; render(); });
    root.querySelector('#rtq-period').onchange = e => { state.period = e.target.value; render(); };
  }

  function ac() {
    if (!root) qur();
    root.classList.add('open');
    render();
  }
  function bagla() { if (root) root.classList.remove('open'); }

  window.Reytinq = { ac, bagla };

  // CSS-i özü yükləyir (index/oyun html-ə əlavə link yazmağa ehtiyac yoxdur)
  if (!document.getElementById('rtq-css')) {
    const l = document.createElement('link');
    l.id = 'rtq-css'; l.rel = 'stylesheet'; l.href = 'css/reytinq.css';
    document.head.appendChild(l);
  }

  // Menyudan "Reytinqlər" seçiləndə açılır (menyu-sec hadisəsi)
  document.addEventListener('menyu-sec', (e) => {
    if (e.detail === 'reytinqler') ac();
  });
})();
