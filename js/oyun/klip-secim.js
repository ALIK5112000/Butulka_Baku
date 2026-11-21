// Klip seçim pəncərəsi: 🔥 populyar, ⭐ sevimli, 🕒 son qoşulanlar, 🔍 YouTube axtarışı + təsdiq pəncərəsi.
import { KLIP_QIYMETI } from "../core/config.js";
import { axtar, populyar, kicikSekil } from "./klip-axtaris.js";
import { klipQos, klipCalirMi } from "./klip.js";

const $ = (id) => document.getElementById(id);
const pen = $("klipPenceresi");
const siyahi = $("kpSiyahi");
const baslik = $("kpBaslik");
const axtarQutu = $("kpAxtarQutu");
const inp = $("kpAxtarInput");
const tesdiq = $("klipTesdiq");
const tablar = [...document.querySelectorAll(".kp-tab")];

const FAV = "bb_fav_clips";
const TAR = "bb_hist_clips";
const ID_RE = /^[\w-]{11}$/;
const BASLIQLAR = {
  popular: "Populyar bölməsindən musiqi seç",
  favorites: "Sevimli musiqilər",
  history: "Son qoşulan kliplər",
  search: "Musiqi axtar"
};

let aktivTab = "popular";
let sayac = 0;          // köhnə (gec gələn) cavablar yeni ekranı pozmasın
let axtarTimer = null;

const oxu = (a) => { try { const x = JSON.parse(localStorage.getItem(a) || "[]"); return Array.isArray(x) ? x : []; } catch (e) { return []; } };
const yaz = (a, v) => { try { localStorage.setItem(a, JSON.stringify(v)); } catch (e) {} };
const sade = (c) => ({ videoId: c.videoId, title: c.title, durationSec: c.durationSec || 0 });

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function dq(s) {
  s = Math.round(Number(s) || 0);
  if (s <= 0) return "";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), n = s % 60;
  const ikirq = (x) => String(x).padStart(2, "0");
  return h ? `${h}:${ikirq(m)}:${ikirq(n)}` : `${ikirq(m)}:${ikirq(n)}`;
}

// ---------- siyahı ----------
function goster(items, bosYazi) {
  siyahi.textContent = "";
  const l = (items || []).filter((c) => c && ID_RE.test(String(c.videoId)));
  siyahi.classList.toggle("bos", !l.length);
  if (!l.length) { siyahi.textContent = bosYazi || "Hər hansı musiqi tapılmadı"; return; }

  const sevimliler = oxu(FAV);
  l.forEach((c) => {
    const kart = el("div", "kp-kart");
    const resim = el("div", "kp-resim");
    const img = new Image();
    img.src = kicikSekil(c.videoId);
    img.alt = "";
    img.loading = "lazy";
    const ulduz = el("button", "kp-ulduz", sevimliler.some((x) => x.videoId === c.videoId) ? "★" : "☆");
    ulduz.type = "button";
    resim.append(img, ulduz);
    if (dq(c.durationSec)) resim.append(el("span", "kp-muddet", dq(c.durationSec)));
    kart.append(resim, el("div", "kp-ad", c.title));

    ulduz.addEventListener("click", (e) => {
      e.stopPropagation();
      let f = oxu(FAV);
      if (f.some((x) => x.videoId === c.videoId)) { f = f.filter((x) => x.videoId !== c.videoId); ulduz.textContent = "☆"; }
      else { f.unshift(sade(c)); ulduz.textContent = "★"; }
      yaz(FAV, f.slice(0, 40));
    });
    kart.addEventListener("click", () => tesdiqAc(c));
    siyahi.appendChild(kart);
  });
}

function mesaj(metn) {
  siyahi.classList.add("bos");
  siyahi.textContent = metn;
}

// ---------- tablar ----------
async function tabGoster(tab) {
  aktivTab = tab;
  const n = ++sayac;
  tablar.forEach((b) => b.classList.toggle("aktiv", b.dataset.tab === tab));
  baslik.textContent = BASLIQLAR[tab];
  axtarQutu.hidden = tab !== "search";

  if (tab === "favorites") return goster(oxu(FAV));
  if (tab === "history") return goster(oxu(TAR));
  if (tab === "search") {
    if (inp.value.trim().length >= 2) return axtarIsle(inp.value);
    mesaj("Mahnı və ya müğənni adını yaz");
    setTimeout(() => inp.focus(), 80);
    return;
  }
  mesaj("Yüklənir...");
  const l = await populyar();
  if (n === sayac && aktivTab === "popular") goster(l);
}

async function axtarIsle(q) {
  const n = ++sayac;
  mesaj("Axtarılır...");
  try {
    const l = await axtar(q);
    if (n === sayac && aktivTab === "search") goster(l);
  } catch (e) {
    if (n === sayac) mesaj("Axtarış hazırda işləmir. Bir az sonra yenidən cəhd et.");
  }
}

inp.addEventListener("input", () => {
  clearTimeout(axtarTimer);
  const q = inp.value.trim();
  if (q.length < 2) { sayac++; mesaj("Mahnı və ya müğənni adını yaz"); return; }
  axtarTimer = setTimeout(() => axtarIsle(q), 700);
});
inp.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  clearTimeout(axtarTimer);
  if (inp.value.trim().length >= 2) { axtarIsle(inp.value); inp.blur(); }
});
tablar.forEach((b) => b.addEventListener("click", () => tabGoster(b.dataset.tab)));

// ---------- aç / bağla ----------
function ac(tab) {
  pen.hidden = false;
  tabGoster(tab);
}
function bagla() {
  pen.hidden = true;
  sayac++;
}
$("kpBagla").addEventListener("click", bagla);
pen.addEventListener("click", (e) => { if (e.target === pen) bagla(); });
$("musiqiBtn1").addEventListener("click", () => ac("popular"));
$("musiqiBtn2").addEventListener("click", () => ac("search"));
$("klipAvatarQutu").addEventListener("click", () => ac("popular"));   // klip çalanda şəkilə toxun = başqa mahnı seç

// ---------- təsdiq pəncərəsi ----------
let secilen = null;
function tesdiqAc(c) {
  secilen = c;
  const onizle = $("ktOnizle");
  onizle.textContent = "";
  const fr = document.createElement("iframe");
  fr.src = "https://www.youtube-nocookie.com/embed/" + c.videoId + "?rel=0&playsinline=1&modestbranding=1";
  fr.allow = "encrypted-media; picture-in-picture";
  onizle.appendChild(fr);

  $("ktQiymet").textContent = String(KLIP_QIYMETI);
  $("ktMetn").textContent = ` üçün “${c.title}” musiqi hər kəs üçün ifa edilsin?`;
  $("ktXeber").hidden = !klipCalirMi();
  $("ktIfa").disabled = false;
  tesdiq.hidden = false;
}
function tesdiqBagla() {
  tesdiq.hidden = true;
  $("ktOnizle").textContent = "";   // önizləmə videosu dayansın
  secilen = null;
}
$("ktBagla").addEventListener("click", tesdiqBagla);
$("ktLegv").addEventListener("click", tesdiqBagla);
tesdiq.addEventListener("click", (e) => { if (e.target === tesdiq) tesdiqBagla(); });
$("ktIfa").addEventListener("click", async () => {
  const c = secilen;
  if (!c) return;
  $("ktIfa").disabled = true;
  const ok = await klipQos(c);
  tesdiqBagla();
  if (ok) {
    yaz(TAR, [sade(c), ...oxu(TAR).filter((x) => x.videoId !== c.videoId)].slice(0, 30));
    bagla();
  }
});
