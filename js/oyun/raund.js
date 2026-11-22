import { rtdb } from "../core/firebase.js";
import { MASA_NOMRESI, YER_XY } from "../core/config.js";
import { cariOyuncu } from "./yardimci.js";
import { ref, onValue, set, runTransaction, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const cari = cariOyuncu();
if (cari && cari.docId) {
  const B = `masalar/${MASA_NOMRESI}`;
  // ---- Zamanlar (ms). Sürəti buradan tənzimlə ----
  const GOZLE = 8000, SPIN = 5000, ARA = 1500;
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
  masa.insertAdjacentHTML("beforeend",
    '<div id="oxlar"><svg viewBox="0 0 44 42"><defs>' +
    '<marker id="mK" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="2" markerHeight="2" orient="auto"><path d="M0 0L10 5L0 10z" fill="#e03d1c"/></marker>' +
    '<marker id="mY" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="2" markerHeight="2" orient="auto"><path d="M0 0L10 5L0 10z" fill="#9bcc34"/></marker>' +
    '</defs><path id="oxU" class="xett" d="M9.6 11 Q22 -3 34.4 11"/><path id="oxA" class="xett" d="M34.4 31 Q22 40 9.6 31"/></svg>' +
    '<div id="bdU" class="bd"></div><div id="bdA" class="bd"></div></div>' +
    `<div id="novbeYazi"><svg viewBox="0 0 24 40"><path d="M12 38C8 30 16 24 12 14M12 4L5 13M12 4L19 13" ${OK}/></svg><div>Butulkanı<br>fırladır</div></div>` +
    `<div id="firlatYazi"><div>Butulkanı<br>fırlat</div><svg viewBox="0 0 40 24"><path d="M2 12C14 8 22 16 36 12M28 4L37 12L28 20" ${OK}/></svg></div>` +
    '<div id="butulkaDokun"></div>');

  function ox(pid, bid, v) {
    const p = $(pid), b = $(bid);
    if (!v) { p.style.display = "none"; b.style.display = "none"; return; }
    p.style.display = "";
    p.setAttribute("stroke", v === "op" ? "#9bcc34" : "#e03d1c");
    p.setAttribute("marker-end", v === "op" ? "url(#mY)" : "url(#mK)");
    b.style.display = "flex"; b.className = "bd " + v;
    b.textContent = v === "op" ? "💋" : "✖";
  }

  const DUDAQ = '<svg viewBox="0 0 100 88"><path d="M4 48C14 30 30 18 42 24C46 26 48 28 50 28C52 28 54 26 58 24C70 18 86 30 96 48C84 70 66 82 50 82C34 82 16 70 4 48Z" fill="#e8452c"/><path d="M7 48C26 57 40 52 50 54C60 52 74 57 93 48" fill="none" stroke="#b32612" stroke-width="3" stroke-linecap="round"/></svg>';
  function nishan(foto, n) {
    let b = foto.querySelector(".opus");
    if (n && !b) { foto.insertAdjacentHTML("beforeend", '<span class="opus">' + DUDAQ + "<b></b></span>"); b = foto.querySelector(".opus"); }
    if (b) { b.style.display = n ? "flex" : "none"; b.querySelector("b").textContent = n; }
  }

  function yarat() {
    const d = document.createElement("div"); d.className = "orta";
    d.innerHTML = '<div class="foto"></div><div class="ad"></div>';
    masa.appendChild(d); return d;
  }
  const oQ = yarat(), oO = yarat();
  const MQ = [37.6, 61], MO = [62.4, 61]; // sol və sağ mərkəz
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
    if (hazir < 3) return;
    const ben = cari.docId;
    const idx = Object.keys(yerler).map(Number);
    const qiz = idx.filter((i) => yerler[i].cins === "q").length;
    const gozle = !qiz || idx.length - qiz === 0;
    const yazi = $("gozleYazi");
    yazi.style.display = gozle ? "block" : "none";
    yazi.innerHTML = "Oyuna başlamaq üçün<br>" + (!qiz ? "qızları" : "oğlanları") + " gözləyirik";

    const sp = raund && raund.spin;
    const spOK = raund && yerler[raund.sp] && yerler[raund.sp].uid === raund.spu;
    const cutOK = sp && yerler[sp.q] && yerler[sp.o] && yerler[sp.q].uid === sp.qu && yerler[sp.o].uid === sp.ou;
    const t = sp ? indi() - sp.t : -1;
    const faza = gozle || !spOK ? "yox" : !sp ? "gozle" : !cutOK ? "yox"
      : t < SPIN ? "spin" : t < SPIN + CUT ? "cut" : "ara";
    const cut = faza === "cut";

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
    butulka.style.opacity = cut ? 0 : 1;

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
    const nv = $("novbeYazi");
    if (faza === "gozle" && !menFirlat) {
      const [x, y] = YER_XY[raund.sp];
      const ust = y > 88;
      nv.classList.toggle("ust", ust);
      nv.style.left = x + "vw";
      nv.style.top = (ust ? y - 8.5 - 11.2 : y + 12.4) + "vw";
      nv.style.display = "flex";
    } else nv.style.display = "none";

    // Ortadakı raund (sayğac uçuş bitəndən sonra başlayır: 9 → 0)
    const sec = (cut && raund.sec) || {};
    const sayDa = cut && t >= SPIN + UCUS;
    $("sayac").style.display = sayDa ? "block" : "none";
    $("sizinSecim").style.display = cut ? "block" : "none";
    $("oxlar").style.display = sayDa ? "block" : "none";
    let goster = false;
    if (cut) {
      if (sayDa) $("sayac").textContent = Math.ceil((SPIN + CUT - t) / 1000);
      const sq = sec[sp.qu], so = sec[sp.ou];
      const oynayan = ben === sp.qu || ben === sp.ou;
      let metn;
      if (sq && so) metn = sq === "op" && so === "op" ? "Öpüşdülər!" : "Öpüşmədilər";
      else if (oynayan && !sec[ben]) metn = "Sənin seçimin";
      else if (sq === "op" || so === "op") metn = "Öpüşə öpüşlə cavab verəcək?";
      else if (sq === "yox" || so === "yox") metn = "Biri imtina etdi";
      else metn = "Onlar öpəcəklər ya yox?";
      $("sizinSecim").textContent = metn;
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
    const bitdi = sp && indi() - sp.t > SPIN + CUT + ARA;
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
