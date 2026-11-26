/* masafon.js — "Masa fonu" pəncərəsi. Mövcud koda toxunmur.
   Quraşdırma (oyun yüklənəndən sonra bir dəfə):

   MasaFon.init({
     rtdb: rtdbDatabase,          // masa/söhbət/butulka olan Realtime DB
     fs: firestoreDb,             // istifadəçi/jeton olan Firestore
     getUid: () => currentUid,
     getTableId: () => currentTableId,   // oyunçunun hazırkı masası
     tableSelector: '#masa',      // fonu görünməli element
   });
*/
(function () {
  var CFG = {
    rtdb: null, fs: null,
    getUid: function () { return null; },
    getTableId: function () { return null; },
    tableSelector: '#masa',
    tablesPath: 'tables',        // RTDB: tables/{id}/bg
    userCollection: 'users',     // Firestore: users/{uid}
    tokenField: 'tokens',        // jeton sahəsi
    price: 100,
    folder: 'images/masa/'
  };

  // Şəkilləri images/masa/ qovluğuna at və bura əlavə et. file:null = standart.
  var BACKGROUNDS = [
    { id: 'standart', name: 'Standart', file: null },
    { id: 'yeniil', name: 'Yeni il', file: 'yeniil.jpg' },
    { id: 'luks', name: 'Lüks zal', file: 'luks.jpg' },
    { id: 'gece', name: 'Gecə şəhəri', file: 'gece.jpg' },
    { id: 'kosmos', name: 'Kosmos', file: 'kosmos.jpg' },
    { id: 'deniz', name: 'Dəniz kənarı', file: 'deniz.jpg' }
  ];

  var balance = 0, selected = null, activeId = 'standart';
  var overlay, unsubBal = null, bgRef = null, bgRefTable = null, bgCb = null;

  function byId(id) { return BACKGROUNDS.filter(function (b) { return b.id === id; })[0]; }
  function src(b) { return b.file ? CFG.folder + b.file : null; }

  /* ---------- Fonu tətbiq et (hamıda) ---------- */
  function apply(id) {
    var b = byId(id) || BACKGROUNDS[0];
    activeId = b.id;
    var el = document.querySelector(CFG.tableSelector);
    if (!el) return;
    var s = src(b);
    if (!s) { el.style.backgroundImage = ''; el.style.backgroundSize = ''; return; }
    var img = new Image();                 // əvvəl yüklə, sonra göstər
    img.onload = function () {
      el.style.backgroundImage = 'url("' + s + '")';
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
    };
    img.src = s;
  }

  /* Masa dəyişəndə də çağırılmalıdır: MasaFon.watchTable() */
  function watchTable() {
    var tid = CFG.getTableId();
    if (!CFG.rtdb || !tid || tid === bgRefTable) return;
    if (bgRef && bgCb) bgRef.off('value', bgCb);
    bgRefTable = tid;
    bgRef = CFG.rtdb.ref(CFG.tablesPath + '/' + tid + '/bg');
    bgCb = function (s) { apply(s.val() || 'standart'); };
    bgRef.on('value', bgCb);
  }

  /* ---------- Jeton balansı (real vaxt) ---------- */
  function watchBalance() {
    var uid = CFG.getUid();
    if (!CFG.fs || !uid) return;
    if (unsubBal) unsubBal();
    unsubBal = CFG.fs.collection(CFG.userCollection).doc(uid).onSnapshot(function (d) {
      balance = (d.data() && d.data()[CFG.tokenField]) || 0;
      var n = document.getElementById('mf-bal');
      if (n) n.textContent = balance;
    });
  }

  /* ---------- Pəncərə ---------- */
  function open() {
    close();
    selected = null;
    watchBalance();
    overlay = document.createElement('div');
    overlay.className = 'mf-overlay';
    overlay.innerHTML =
      '<div class="mf-box">' +
      '<button class="mf-x" id="mf-close">✕</button>' +
      '<div class="mf-title">Masa fonu</div>' +
      '<div class="mf-sub">Masadakı hamı görəcək · dəyişmək ' + CFG.price +
      ' 🪙 · Jetonun: <b id="mf-bal">' + balance + '</b></div>' +
      '<div class="mf-grid" id="mf-grid"></div>' +
      '<div class="mf-confirm" id="mf-confirm" style="display:none">' +
      '<div id="mf-q"></div><div class="mf-row">' +
      '<button class="mf-yes" id="mf-yes">Bəli, dəyiş</button>' +
      '<button class="mf-no" id="mf-no">Ləğv et</button></div></div></div>';
    document.body.appendChild(overlay);

    var grid = overlay.querySelector('#mf-grid');
    BACKGROUNDS.forEach(function (b) {
      var c = document.createElement('div');
      c.className = 'mf-card';
      c.dataset.id = b.id;
      var s = src(b);
      c.innerHTML =
        (b.id === activeId ? '<span class="mf-badge">Hazırkı</span>' : '') +
        '<div class="mf-img"' + (s ? ' style="background-image:url(\'' + s + '\')"' : '') + '></div>' +
        '<div class="mf-name">' + b.name + '</div>';
      c.onclick = function () { pick(b.id); };
      grid.appendChild(c);
    });

    overlay.querySelector('#mf-close').onclick = close;
    overlay.querySelector('#mf-no').onclick = function () { pick(null); };
    overlay.querySelector('#mf-yes').onclick = confirmChange;
    overlay.onclick = function (e) { if (e.target === overlay) close(); };
  }

  function close() {
    if (overlay) { overlay.remove(); overlay = null; }
    if (unsubBal) { unsubBal(); unsubBal = null; }
  }

  function pick(id) {
    if (id === activeId) id = null;
    selected = id;
    [].forEach.call(overlay.querySelectorAll('.mf-card'), function (c) {
      c.classList.toggle('mf-sel', c.dataset.id === id);
    });
    var box = overlay.querySelector('#mf-confirm');
    if (!id) { box.style.display = 'none'; return; }
    overlay.querySelector('#mf-q').textContent =
      '“' + byId(id).name + '” fonu ' + CFG.price + ' jetona qoyulsun?';
    box.style.display = 'block';
  }

  function confirmChange() {
    var uid = CFG.getUid(), tid = CFG.getTableId(), id = selected;
    if (!uid || !tid || !id) return;
    var yes = overlay.querySelector('#mf-yes');
    yes.disabled = true;
    var ref = CFG.fs.collection(CFG.userCollection).doc(uid);
    CFG.fs.runTransaction(function (t) {
      return t.get(ref).then(function (d) {
        var bal = (d.data() && d.data()[CFG.tokenField]) || 0;
        if (bal < CFG.price) throw new Error('az');
        var u = {}; u[CFG.tokenField] = bal - CFG.price;
        t.update(ref, u);
      });
    }).then(function () {
      return CFG.rtdb.ref(CFG.tablesPath + '/' + tid + '/bg').set(id); // hamıda dəyişir
    }).then(function () {
      close();
    }).catch(function (e) {
      yes.disabled = false;
      alert(e && e.message === 'az' ? 'Jeton çatmır' : 'Xəta baş verdi');
    });
  }

    /* 3-xətt menyusunda "Masa fonu" yazısına toxunanda aç */
  document.addEventListener('click', function (e) {
    if (overlay) return;
    var el = e.target;
    for (var i = 0; el && i < 5; i++, el = el.parentElement) {
      var txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (txt.length < 20 && txt.indexOf('Masa fonu') !== -1) {
        e.stopPropagation();
        open();
        return;
      }
    }
  }, true);

  window.MasaFon = {
    init: function (o) { for (var k in o) CFG[k] = o[k]; watchTable(); },
    open: open, close: close, watchTable: watchTable
  };
})();
