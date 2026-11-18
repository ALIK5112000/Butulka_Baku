import { rtdb } from "../core/firebase.js";
import { MASA_NOMRESI, YER_XY } from "../core/config.js";
import { cariOyuncu } from "./yardimci.js";
import { ref, onValue, set, runTransaction, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const cari = cariOyuncu();
if (cari && cari.docId) {
  const B = `masalar/${MASA_NOMRESI}`;
  const SPIN = 3400, CUT = 9000, ARA = 2500; // ms
  const $ = (id) => document.getElementById(id);
  const butulka = $("butulka"), masa = $("masa");
  let yerler = {}, raund = null, opus = {}, offset = 0, hazir = 0;
  let bucaq = 0, sonSpin = 0, ortada = false, ortaIdx = null, secildi = 0;
  const indi = () => Date.now() + offset;
  const temiz = (v) => { const o = {}; Object.entries(v || {}).forEach(([k, x]) => { if (x) o[k] = x; }); return o; };

  onValue(ref(rtdb, ".info/serverTimeOffset"), (s) => { offset = s.val() || 0; });
  onValue(ref(rtdb, B + "/oturacaqlar"), (s) => { yerler = temiz(s.val()); hazir |= 1; });
  onValue(ref(rtdb, B + "/raund"), (s) => { raund = s.val(); hazir |= 2; });
  onValue(ref(rtdb, B + "/opus"), (s) => { opus = s.val() || {}; });
  onDisconnect(ref(rtdb, B + "/opus/" + cari.docId)).remove();

  function yarat() {
    const d = document.createElement("div"); d.className = "orta";
    d.innerHTML = '<div class="foto"></div><div class="ad"></div><div class="durum"></div>';
    masa.appendChild(d); return d;
  }
  const oQ = yarat(), oO = yarat();
  const MQ = [37.6, 61], MO = [62.4, 61];
  const gizle = (i, b) => { const e = document.querySelector(".yer-" + i); if (e) e.classList.toggle("gizli", b); };

  function gotur(d, i, m) {
    const y = yerler[i] || {};
    d.querySelector(".foto").style.backgroundImage = y.sekil ? `url("${y.sekil}")` : "";
    d.querySelector(".ad").textContent = y.ad || "";
    const [x, z] = YER_XY[i];
    d.style.transition = "none"; d.style.left = x + "vw"; d.style.top = z + "vw";
    d.classList.add("goster"); void d.offsetWidth;
    d.style.transition = ""; d.style.left = m[0] + "vw"; d.style.top = m[1] + "vw";
  }
  function geri(d, i) {
    const [x, z] = YER_XY[i]; d.style.left = x + "vw"; d.style.top = z + "vw";
    setTimeout(() => d.classList.remove("goster"), 700);
  }
  function durum(d, v) {
    const x = d.querySelector(".durum");
    x.className = "durum" + (v ? " " + v : "");
    x.textContent = v === "op" ? "💋" : v === "yox" ? "✖" : "";
  }

  function kadr() {
    if (hazir < 3) return;
    const idx = Object.keys(yerler);
    const qiz = idx.filter((i) => yerler[i].cins === "q").length;
    const oglan = idx.length - qiz;
    const gozle = !qiz || !oglan;
    const yazi = $("gozleYazi");
    yazi.style.display = gozle ? "block" : "none";
    yazi.textContent = "Oyuna başlamaq üçün " + (!qiz ? "qızları" : "oğlanları") + " gözləyirik";

    const aktiv = raund && yerler[raund.q] && yerler[raund.o] &&
      yerler[raund.q].uid === raund.qu && yerler[raund.o].uid === raund.ou;
    const t = aktiv ? indi() - raund.bas : -1;
    const cut = aktiv && t >= SPIN && t < SPIN + CUT;

    if (gozle) {
      if (sonSpin !== -1) {
        sonSpin = -1; bucaq = 0;
        butulka.style.transition = "transform .6s";
        butulka.style.transform = "translate(-50%,-50%) rotate(0deg)";
      }
    } else if (aktiv && raund.bas !== sonSpin && t < SPIN + CUT) {
      sonSpin = raund.bas;
      const [x, y] = YER_XY[raund.hedef];
      const a = Math.atan2(x - 50, -(y - 61.6)) * 180 / Math.PI;
      bucaq += 1440 + ((((a - bucaq) % 360) + 360) % 360);
      butulka.style.transition = t < SPIN ? "transform 3.4s cubic-bezier(.15,.8,.2,1)" : "none";
      butulka.style.transform = `translate(-50%,-50%) rotate(${bucaq}deg)`;
    }
    butulka.style.opacity = cut ? 0 : 1;

    if (cut && !ortada) {
      ortada = true; ortaIdx = { q: raund.q, o: raund.o };
      gotur(oQ, raund.q, MQ); gotur(oO, raund.o, MO);
      gizle(raund.q, true); gizle(raund.o, true);
    }
    if (!cut && ortada) {
      ortada = false; const z = ortaIdx;
      geri(oQ, z.q); geri(oO, z.o);
      setTimeout(() => { gizle(z.q, false); gizle(z.o, false); }, 700);
    }

    $("sayac").style.display = cut ? "block" : "none";
    if (cut) $("sayac").textContent = Math.ceil((SPIN + CUT - t) / 1000);
    const men = aktiv && (cari.docId === raund.qu || cari.docId === raund.ou);
    const sec = aktiv && raund.sec ? raund.sec : {};
    const goster = cut && men && !sec[cari.docId] && secildi !== raund.bas;
    $("dugmeler").style.display = $("sizinSecim").style.display = goster ? "block" : "none";
    if (aktiv) { durum(oQ, sec[raund.qu]); durum(oO, sec[raund.ou]); }

    for (let i = 0; i < 12; i++) {
      const e = document.querySelector(".yer-" + i + " .foto"); if (!e) continue;
      const n = yerler[i] ? opus[yerler[i].uid] || 0 : 0;
      let b = e.querySelector(".opus");
      if (n && !b) { e.insertAdjacentHTML("beforeend", '<span class="opus"><i>💋</i><b></b></span>'); b = e.querySelector(".opus"); }
      if (b) { b.style.display = n ? "flex" : "none"; b.querySelector("b").textContent = n; }
    }
  }
  setInterval(kadr, 100);

  function sec(n) {
    if (!raund) return;
    secildi = raund.bas;
    const o = cari.docId === raund.qu ? raund.ou : raund.qu;
    set(ref(rtdb, B + "/raund/sec/" + cari.docId), n);
    if (n === "op") runTransaction(ref(rtdb, B + "/opus/" + o), (v) => (v || 0) + 1);
  }
  $("btnOp").onclick = () => sec("op");
  $("btnImtina").onclick = () => sec("yox");

  // Raundu yalnız masadakı ən kiçik nömrəli oyunçu idarə edir (təkrar olmasın deyə)
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];
  setInterval(() => {
    if (hazir < 3) return;
    const idx = Object.keys(yerler).map(Number).sort((a, b) => a - b);
    if (!idx.length || yerler[idx[0]].uid !== cari.docId) return;
    const qizlar = idx.filter((i) => yerler[i].cins === "q");
    const oglanlar = idx.filter((i) => yerler[i].cins !== "q");
    const bitdi = !raund || indi() - raund.bas > SPIN + CUT + ARA;
    const pozuldu = raund && (!yerler[raund.q] || !yerler[raund.o] ||
      yerler[raund.q].uid !== raund.qu || yerler[raund.o].uid !== raund.ou);
    if (!qizlar.length || !oglanlar.length) {
      if (raund && (bitdi || pozuldu)) set(ref(rtdb, B + "/raund"), null);
      return;
    }
    if (bitdi || pozuldu) {
      const q = rnd(qizlar), o = rnd(oglanlar);
      set(ref(rtdb, B + "/raund"), {
        q, o, qu: yerler[q].uid, ou: yerler[o].uid,
        hedef: Math.random() < 0.5 ? q : o, bas: serverTimestamp()
      });
    }
  }, 1000);
        }
