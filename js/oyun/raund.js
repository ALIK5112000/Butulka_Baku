import { rtdb } from "../core/firebase.js";
import { MASA_NOMRESI, YER_XY } from "../core/config.js";
import { cariOyuncu } from "./yardimci.js";
import { ref, onValue, set, runTransaction, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const cari = cariOyuncu();
if (cari && cari.docId) {
  const B = `masalar/${MASA_NOMRESI}`;
  // ---- Zamanlar (ms). Sürəti buradan tənzimlə ----
  const GOZLE = 8000, SPIN = 5000, ARA = 2200;
  const HOLD = 2200;           // ikisi də seçəndən sonra ortada qalma müddəti
  const UCUS = 950;            // cütün ortaya uçma müddəti
  const QAYIT = 600;           // yerinə qayıtma müddəti
  const CUT = 9000 + UCUS;     // 9 san sayğac + uçuş
  const EASE = "cubic-bezier(.25,.46,.45,.94)"; // orijinaldakı kimi: sürətli başlayır, yavaş dayanır
  const $ = (id) => document.getElementById(id);
  const butulka = $("butulka"), masa = $("masa");
  const OPAC = ", opacity .9s";
  let yerler = {}, raund = null, opus = {}, offset = 0, hazir = 0;
  let bucaq = 0, sonSpin = 0, ortada = false, ortaIdx = null, secildi = 0, sesBas = 0;
  const indi = () => Date.now() + offset;
  const temiz = (v) => { const o = {}; Object.entries(v || {}).forEach(([k, x]) => { if (x) o[k] = x; }); return o; };
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];
  // Ortadakı mərhələnin bitmə vaxtı (sp.t-dən ms): ikisi də seçibsə tez bitir
  const cutSon = (r) => (r && r.spin && r.bt) ? Math.min(SPIN + CUT, r.bt - r.spin.t + HOLD) : SPIN + CUT;
  const bitisYaz = () => runTransaction(ref(rtdb, B + "/raund/bt"), (c) => c ? undefined : serverTimestamp()).catch(() => {});

  // Növbə səsi (brauzer icazəsi üçün ilk toxunuşda "hazırlanır")
  const novbeSes = new Audio("sesler/novbe.mp3");
  novbeSes.preload = "auto";
  document.addEventListener("pointerdown", () => {
    novbeSes.muted = true;
    novbeSes.play().then(() => { novbeSes.pause(); novbeSes.currentTime = 0; novbeSes.muted = false; }).catch(() => { novbeSes.muted = false; });
  }, { once: true });

  onValue(ref(rtdb, ".info/serverTimeOffset"), (s) => { offset = s.val() || 0; });
  onValue(ref(rtdb, B + "/oturacaqlar"), (s) => { yerler = temiz(s.val()); hazir |= 1; });
  onValue(ref(rtdb, B + "/raund"), (s) => { raund = s.val(); hazir |= 2; });
  onValue(ref(rtdb, B + "/opus"), (s) => { opus = s.val() || {}; });
  onDisconnect(ref(rtdb, B + "/opus/" + cari.docId)).remove();

  const OK = 'stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"';
  // Oxlar (videodakı ölçülərlə, koordinatlar vw): gövdə + açıq (L şəkilli) ox ucu
  const OXU = "M41.04 12.3Q49.62 5.28 59.72 13.14M59.72 10.74L59.72 13.14L57.32 13.14";
  const OXA = "M58.7 29.96Q50.55 36.67 40.2 29.03M42.6 29.03L40.2 29.03L40.2 31.43";
  const DODAQ = '<svg viewBox="-2 -2 104 64"><path d="M1 29C8 18 22 4 33 4C40 4 45 6 50 8C55 6 60 4 67 4C78 4 92 18 99 28C90 46 70 59 50 59C30 59 10 46 1 29Z" fill="#d94a2b" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/><path d="M25 29Q50 23.5 75 29Q50 37 25 29Z" fill="#fff"/></svg>';
  const IKS = '<svg viewBox="0 0 20 20"><path d="M3.2 3.2L16.8 16.8M16.8 3.2L3.2 16.8" stroke="#fff" stroke-width="3.2" stroke-linecap="round" fill="none"/></svg>';
  masa.insertAdjacentHTML("beforeend",
    '<div id="oxlar"><svg viewBox="0 0 100 42">' +
    '<g id="oxU"><path class="ow" d="' + OXU + '"/><path class="oc" d="' + OXU + '"/></g>' +
    '<g id="oxA"><path class="ow" d="' + OXA + '"/><path class="oc" d="' + OXA + '"/></g></svg>' +
    '<div id="bdU" class="bd"></div><div id="bdA" class="bd"></div></div>' +
    // Yazılar yalnız masanın ORTA boş hissəsində dayanır (oyunçu kartlarının üstünə düşmür)
    '<style>' +
    '#masa #novbeYazi{display:none!important}' +
    '#masa #novbeYan,#masa #firlatYazi{position:absolute;display:none;align-items:center;justify-content:center;gap:1vw;z-index:6;pointer-events:none;color:#fff;font:500 3vw/1.15 Roboto,Arial,sans-serif;text-shadow:0 .2vw .6vw rgba(0,0,0,.7);width:auto;height:auto;margin:0;white-space:nowrap}' +
    '#masa #novbeYan svg,#masa #firlatYazi svg{width:6vw;height:3.6vw;flex:none;display:block;position:static;transform-origin:50% 50%}' +
    '#masa #firlatYazi{left:50vw!important;top:84vw!important;right:auto!important;bottom:auto!important;flex-direction:column!important;text-align:center;transform:translate(-50%,-50%)!important}' +
    '#masa #firlatYazi svg{transform:rotate(90deg)}' +   // ox yuxarı, butulkaya doğru
    '</style>' +
    `<div id="novbeYazi"></div>` +
    `<div id="novbeYan"><svg id="novbeOk" viewBox="0 0 40 24"><path d="M38 12C26 8 18 16 4 12M12 4L3 12L12 20" ${OK}/></svg><div id="novbeMetn">Butulkanı<br>fırladır</div></div>` +
    `<div id="firlatYazi"><svg viewBox="0 0 40 24"><path d="M38 12C26 8 18 16 4 12M12 4L3 12L12 20" ${OK}/></svg><div>Butulkanı<br>fırlat</div></div>` +
    '<div id="butulkaDokun"></div><div id="araYazi">Növbəti fırlanmanı<br>gözləyirlər</div>');

  const yz = (el, v) => { v = String(v); if (el._v !== v) { el._v = v; el.textContent = v; } };   // yalnız dəyişəndə yaz (lazımsız yenidən çəkilmə olmasın)
  function ox(pid, bid, v) {
    const p = $(pid), b = $(bid);
    const key = v || ""; if (p._k === key) return; p._k = key;
    if (!v) { p.style.display = "none"; b.style.display = "none"; return; }
    p.style.display = "";
    p.querySelector(".oc").setAttribute("stroke", v === "op" ? "#9bcc34" : "#e03d1c");
    b.style.display = "flex"; b.className = "bd " + v;
    b.innerHTML = v === "op" ? DODAQ : IKS;
  }

  const DUDAQ = '<svg viewBox="0 0 100 88"><path d="M4 48C14 30 30 18 42 24C46 26 48 28 50 28C52 28 54 26 58 24C70 18 86 30 96 48C84 70 66 82 50 82C34 82 16 70 4 48Z" fill="#e8452c"/><path d="M7 48C26 57 40 52 50 54C60 52 74 57 93 48" fill="none" stroke="#b32612" stroke-width="3" stroke-linecap="round"/></svg>';
  function nishan(foto, n) {
    let b = foto.querySelector(".opus");
    if (!b && !n) return;
    if (b && b._n === n) return;
    if (n && !b) { foto.insertAdjacentHTML("beforeend", '<span class="opus">' + DUDAQ + "<b></b></span>"); b = foto.querySelector(".opus"); }
    if (b) { b._n = n; b.style.display = n ? "flex" : "none"; b.querySelector("b").textContent = n; }
  }

  function yarat() {
    const d = document.createElement("div"); d.className = "orta";
    d.innerHTML = '<div class="foto"></div><div class="ad"></div>';
    masa.appendChild(d); return d;
  }
  const oQ = yarat(), oO = yarat();
  const MQ = [38.8, 61], MO = [61.2, 61]; // sol və sağ mərkəz (videodakı nisbətlə)
  const gizle = (i, b) => { const e = document.querySelector(".yer-" + i); if (e) e.classList.toggle("gizli", b); };

  // Kart masadakı yerindən başlayır, ortaya uçur (ölçü dəyişmir)
  function gotur(d, i, m) {
    const y = yerler[i] || {};
    d.querySelector(".foto").style.backgroundImage = y.sekil ? `url("${y.sekil}")` : "";
    d.querySelector(".ad").textContent = y.ad || "";
    const [x, z] = YER_XY[i];
    d.style.transition = "none"; d.style.left = x + "vw"; d.style.top = z + "vw";
    d.classList.add("goster"); gizle(i, true); void d.offsetWidth;
    d.style.transition = `left ${UCUS}ms ${EASE}, top ${UCUS}ms ${EASE}`;
    d.style.left = m[0] + "vw"; d.style.top = m[1] + "vw";
  }
  // Kart yerinə qayıdır; çatan anda masadakı şəkil və kart eyni anda dəyişir (ikiqat görünmə yoxdur)
  function geri(d, i) {
    const [x, z] = YER_XY[i];
    d.style.transition = `left ${QAYIT}ms ${EASE}, top ${QAYIT}ms ${EASE}`;
    d.style.left = x + "vw"; d.style.top = z + "vw";
    setTimeout(() => { gizle(i, false); d.style.transition = "none"; d.classList.remove("goster"); }, QAYIT);
  }

  function kadr() {
    if (hazir < 3 || document.hidden) return;
    const ben = cari.docId;
    const idx = Object.keys(yerler).map(Number);
    const qiz = idx.filter((i) => yerler[i].cins === "q").length;
    const gozle = !qiz || idx.length - qiz === 0;
    const yazi = $("gozleYazi");
    yazi.style.display = gozle ? "block" : "none";
    const yt = "Oyuna başlamaq üçün<br>" + (!qiz ? "qızları" : "oğlanları") + " gözləyirik";
    if (yazi._t !== yt) { yazi._t = yt; yazi.innerHTML = yt; }

    const sp = raund && raund.spin;
    const spOK = raund && yerler[raund.sp] && yerler[raund.sp].uid === raund.spu;
    const cutOK = sp && yerler[sp.q] && yerler[sp.o] && yerler[sp.q].uid === sp.qu && yerler[sp.o].uid === sp.ou;
    const t = sp ? indi() - sp.t : -1;
    const faza = gozle || !spOK ? "yox" : !sp ? "gozle" : !cutOK ? "yox"
      : t < SPIN ? "spin" : t < cutSon(raund) ? "cut" : "ara";
    const cut = faza === "cut";
    $("araYazi").style.display = faza === "ara" ? "block" : "none";

    // Şüşə (5 san yavaşıyaraq fırlanır, uçuş zamanı solur)
    if (faza === "spin" && sp.t !== sonSpin) {
      sonSpin = sp.t;
      const [x, y] = YER_XY[sp.hedef];
      const a = Math.atan2(x - 50, -(y - 61.6)) * 180 / Math.PI;
      bucaq += 1800 + ((((a - bucaq) % 360) + 360) % 360);
      butulka.style.transition = "transform 5s cubic-bezier(.12,.55,.12,1)" + OPAC;
      butulka.style.transform = `translate(-50%,-50%) rotate(${bucaq}deg)`;
    } else if ((faza === "gozle" || faza === "yox" || faza === "ara") && bucaq !== 0) {
      bucaq = 0;
      butulka.style.transition = "transform .6s" + OPAC;
      butulka.style.transform = "translate(-50%,-50%) rotate(0deg)";
    }
    const opN = cut ? 0 : 1; if (butulka._op !== opN) { butulka._op = opN; butulka.style.opacity = opN; }

    // Sol/sağ: masada solda oturan solda, sağda oturan sağda dayanır (kartlar keçmir)
    const sol = sp && yerler[sp.q] ? YER_XY[sp.q][0] <= YER_XY[sp.o][0] : true;

    if (cut && !ortada) {
      ortada = true; ortaIdx = { q: sp.q, o: sp.o };
      gotur(oQ, sp.q, sol ? MQ : MO); gotur(oO, sp.o, sol ? MO : MQ);
      setTimeout(() => { // şüşə tam solandan sonra düz vəziyyətə qaytar
        if (bucaq !== 0) { butulka.style.transition = "opacity .9s"; butulka.style.transform = "translate(-50%,-50%) rotate(0deg)"; bucaq = 0; }
      }, 1100);
    }
    if (!cut && ortada) {
      ortada = false; const z = ortaIdx;
      geri(oQ, z.q); geri(oO, z.o);
    }

    // Növbə yazıları və səsi
    const menFirlat = faza === "gozle" && raund.spu === ben;
    if (menFirlat && raund.bas !== sesBas) {
      sesBas = raund.bas;
      novbeSes.currentTime = 0;
      novbeSes.play().catch(() => {});
    }
    $("firlatYazi").style.display = menFirlat ? "flex" : "none";
    $("butulkaDokun").style.display = menFirlat ? "block" : "none";
    const ny = $("novbeYan");
    if (faza === "gozle" && !menFirlat) {
      const [sx, sy] = YER_XY[raund.sp];
      const sol = sx < 25, sag = sx > 75;
      let X, Y, tf, fd, ta, ax, ay;
      if (sol || sag) {
        // Sol/sağ sütun: yazı orta boşluqda, kənara yaxın; künc yerlərində yuxarı/aşağı sıranın altında/üstündə boş hissə
        const kunc = sy < 40 || sy > 85;
        Y = kunc ? (sy < 40 ? 42 : 88) : sy;
        X = sol ? 25 : 75;
        tf = sol ? "translate(0,-50%)" : "translate(-100%,-50%)";
        fd = sol ? "row" : "row-reverse"; ta = sol ? "left" : "right";
        ax = sol ? X + 3 : X - 3; ay = Y;
      } else {
        // Yuxarı sıra: yazı orta boşluqda (oxu yuxarı); aşağı sıra: yazı üstdə, oxu aşağı
        const alt = sy > 60;
        X = sx; Y = alt ? 82 : 45;
        tf = "translate(-50%,-50%)"; fd = alt ? "column-reverse" : "column"; ta = "center";
        ax = X; ay = alt ? Y + 4.8 : Y - 4.8;
      }
      // Ox həmişə növbə sahibinin yerinə baxır (ox şəkli sola baxır: 180°)
      const ang = Math.atan2(sy - ay, sx - ax) * 180 / Math.PI;
      $("novbeOk").style.transform = `rotate(${ang - 180}deg)`;
      ny.style.left = X + "vw"; ny.style.top = Y + "vw";
      ny.style.transform = tf; ny.style.flexDirection = fd; ny.style.textAlign = ta;
      ny.style.display = "flex";
    } else ny.style.display = "none";

    // Ortadakı raund (sayğac uçuş bitəndən sonra başlayır: 9 → 0)
    const sec = (cut && raund.sec) || {};
    const sayDa = cut && t >= SPIN + UCUS;
    $("sayac").style.display = sayDa ? "block" : "none";
    $("sizinSecim").style.display = cut ? "block" : "none";
    $("oxlar").style.display = sayDa ? "block" : "none";
    let goster = false;
    if (cut) {
      if (sayDa) yz($("sayac"), Math.ceil((SPIN + CUT - t) / 1000));
      const sq = sec[sp.qu], so = sec[sp.ou];
      const oynayan = ben === sp.qu || ben === sp.ou;
      let metn;
      if (sq && so) metn = "";
      else if (sq || so) metn = "öpüşə\nöpüşlə cavab verəcək?";
      else if (oynayan) metn = "Sənin\nseçimin";
      else metn = "Onlar öpəcəklər\nya yox?";
      // Yazı nişanın (ox) üstündə dayanır; üst sıradakı oyunçuya toxunursa 1 sətirə keçir
      let lim = 0;
      for (const k in yerler) {
        const i = +k; if (i === sp.q || i === sp.o || !YER_XY[i]) continue;
        const [px, py] = YER_XY[i];
        if (py < 46 && Math.abs(px - 50) < 30) lim = Math.max(lim, py + 11.6);   // foto yarısı + ad
      }
      const iki = metn.indexOf("\n") >= 0 && 45.3 - lim >= 8.8;
      const mt = iki ? metn : metn.replace("\n", " ");
      yz($("sizinSecim"), mt);
      const tp = (45.3 - (iki ? 8.7 : 4.4)) + "vw", szEl = $("sizinSecim");
      if (szEl._tp !== tp) { szEl._tp = tp; szEl.style.top = tp; }
      if (sq && so) $("sayac").style.display = "none";
      goster = sayDa && oynayan && !sec[ben] && secildi !== sp.t;
      ox("oxU", "bdU", sol ? sq : so);   // yuxarı ox: soldakının seçimi
      ox("oxA", "bdA", sol ? so : sq);   // aşağı ox: sağdakının seçimi
      nishan(oQ.querySelector(".foto"), opus[sp.qu] || 0);
      nishan(oO.querySelector(".foto"), opus[sp.ou] || 0);
    }
    $("dugmeler").style.display = goster ? "block" : "none";

    // Masadakı öpüş nişanları
    for (let i = 0; i < 12; i++) {
      const e = document.querySelector(".yer-" + i + " .foto"); if (!e) continue;
      nishan(e, yerler[i] ? opus[yerler[i].uid] || 0 : 0);
    }
  }
  setInterval(kadr, 100);

  function secimYaz(n) {
    const s = raund && raund.spin; if (!s) return;
    secildi = s.t;
    const o = cari.docId === s.qu ? s.ou : s.qu;
    set(ref(rtdb, B + "/raund/sec/" + cari.docId), n);
    if (raund.sec && raund.sec[o]) bitisYaz();
    if (n === "op") runTransaction(ref(rtdb, B + "/opus/" + o), (v) => (v || 0) + 1);
  }
  $("btnOp").onclick = () => secimYaz("op");
  $("btnImtina").onclick = () => secimYaz("yox");

  // Şüşəni fırlat: növbə sahibi toxunanda və ya 8 saniyə keçəndə avtomatik
  function firlatYaz(spIdx) {
    const s = yerler[spIdx]; if (!s) return;
    const q = s.cins === "q";
    const ad = Object.keys(yerler).map(Number).filter((i) => i !== spIdx && (yerler[i].cins === "q") !== q);
    if (!ad.length) return;
    const h = rnd(ad), qi = q ? spIdx : h, oi = q ? h : spIdx;
    runTransaction(ref(rtdb, B + "/raund/spin"), (cur) => cur ? undefined : {
      q: qi, o: oi, qu: yerler[qi].uid, ou: yerler[oi].uid, hedef: h, t: serverTimestamp()
    });
  }
  const toxun = () => { if (raund && !raund.spin && raund.spu === cari.docId) firlatYaz(raund.sp); };
  $("butulkaDokun").onclick = toxun;
  butulka.onclick = toxun;

  // Raundları yalnız masadakı ən kiçik nömrəli oyunçu idarə edir
  setInterval(() => {
    if (hazir < 3) return;
    const idx = Object.keys(yerler).map(Number).sort((a, b) => a - b);
    if (!idx.length || yerler[idx[0]].uid !== cari.docId) return;
    const qiz = idx.filter((i) => yerler[i].cins === "q").length;
    if (!qiz || idx.length - qiz === 0) { if (raund) set(ref(rtdb, B + "/raund"), null); return; }

    const sp = raund && raund.spin;
    const spOK = raund && yerler[raund.sp] && yerler[raund.sp].uid === raund.spu;
    const cutOK = !sp || (yerler[sp.q] && yerler[sp.o] && yerler[sp.q].uid === sp.qu && yerler[sp.o].uid === sp.ou);
    if (sp && raund.sec && raund.sec[sp.qu] && raund.sec[sp.ou] && !raund.bt) bitisYaz();
    const bitdi = sp && indi() - sp.t > cutSon(raund) + ARA;
    if (!raund || !spOK || !cutOK || bitdi) {
      const prev = raund && raund.sp !== undefined ? raund.sp : -1;
      const n = idx.find((i) => i > prev);
      const sira = n === undefined ? idx[0] : n;
      set(ref(rtdb, B + "/raund"), { sp: sira, spu: yerler[sira].uid, bas: serverTimestamp() });
      return;
    }
    if (!sp && indi() - raund.bas > GOZLE) firlatYaz(raund.sp);
  }, 1000);
}
