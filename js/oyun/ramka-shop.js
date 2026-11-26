import { fsdb } from "../core/firebase.js";
import { cariOyuncu } from "./yardimci.js";
import { doc, onSnapshot, runTransaction, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const REPO = "ALIK5112000/Butulka_Baku";
const YOL = "images/ramkalar";

// GitHub API işləməyəndə (private repo / limit) bu siyahı istifadə olunur.
// Yeni ramka yükləyəndə adını bura da əlavə et (API işləyirsə, buna ehtiyac yoxdur).
const EHTIYAT = ["Gul-Almaz.png", "VIP-Aslan.png", "Yunan-Qizil.png"];

// ===== QİYMƏT: bütün ramkalar eyni =====
const QH = 500;    // 7 günlük
const QA = 1000;   // 30 günlük

// ===== users/{docId} sahə adları: bazanda fərqlidirsə, siyahıya öz adını ƏN BAŞA yaz =====
const SAHE = {
  ad:      ["ad", "name", "nick", "nickname", "username", "adi", "isim", "displayName"],
  yas:     ["yas", "age"],
  foto:    ["foto", "photo", "photoURL", "photoUrl", "sekil", "avatar", "image", "img", "pic", "picture"],
  status:  ["status", "bio"],
  opuc:    ["opuc", "opucler", "opucSayi", "kisses", "kiss"],
  opucS:   ["opucSira", "kissRank"],
  musiqi:  ["musiqi", "musiqiBal", "music"],
  musiqiS: ["musiqiSira", "musicRank"],
  jeton:   ["jeton", "jetons", "jetonlar", "coins", "coin", "tokens"],
  jetonS:  ["jetonSira", "coinRank"],
  meftun:  ["meftun", "partner", "sevgili"]
};

const gt = (o, keys, def) => {
  if (!o) return def;
  for (const k of keys) { const v = o[k]; if (v !== undefined && v !== null && v !== "") return v; }
  return def;
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function jetonAcar(o) {
  o = o || {};
  for (const k of SAHE.jeton) if (o[k] !== undefined && o[k] !== "" && !isNaN(Number(o[k]))) return k;
  for (const k of Object.keys(o)) if (/jeton|coin|token/i.test(k) && !isNaN(Number(o[k]))) return k;
  return SAHE.jeton[0];
}

function meftunOxu(v) {
  if (!v) return null;
  if (typeof v === "string") return { ad: v, foto: "", urek: "", sira: "" };
  if (typeof v !== "object") return null;
  return { ad: gt(v, SAHE.ad, ""), foto: gt(v, SAHE.foto, ""), urek: gt(v, ["hearts", "urek", "sayi"], ""), sira: gt(v, ["sira", "rank"], "") };
}

function melumat(p, cari) {
  const o = Object.assign({}, cari || {}, p || {});
  let foto = gt(o, SAHE.foto, "");
  if (Array.isArray(foto)) foto = foto[0] || "";
  if (typeof foto !== "string") foto = "";
  if (!foto) {
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (typeof v === "string" && /^(https?:\/\/|data:image\/)/.test(v) && /(\.(jpe?g|png|webp|gif)|firebasestorage|data:image)/i.test(v)) { foto = v; break; }
    }
  }
  return {
    ad: String(gt(o, SAHE.ad, "Oyunçu")),
    yas: gt(o, SAHE.yas, ""),
    foto,
    status: String(gt(o, SAHE.status, "Xoş Oyunlar")),
    opuc: Number(gt(o, SAHE.opuc, 0)) || 0,
    opucS: gt(o, SAHE.opucS, ""),
    musiqi: Number(gt(o, SAHE.musiqi, 0)) || 0,
    musiqiS: gt(o, SAHE.musiqiS, ""),
    jetonS: gt(o, SAHE.jetonS, ""),
    vip: !!(o.vip && o.vipUntil > Date.now()),
    meftun: meftunOxu(gt(o, SAHE.meftun, null))
  };
}

const GUN = { h: 7, a: 30 };
const GUN_MS = 86400000;

// ===== Ehtiyat CSS ramkaları (images/ramkalar boş olanda görünür) =====
const R = (id, kat, ad, h, a, g, bg) => ({ id, kat, ad, h: QH, a: QA, g, bg });
const NUMUNE = [
  R("cicek",  "qiz",     "Çiçək Çəhrayı", 0, 0, "linear-gradient(135deg,#ff9ccb,#ffe0f0,#ff6fb0)", "#5a1a3f"),
  R("lavanda","qiz",     "Lavanda",       0, 0, "linear-gradient(135deg,#b79cff,#e6dcff,#8a6bff)", "#2e2160"),
  R("zumrud", "oglan",   "Zümrüd Qızıl",  0, 0, "linear-gradient(135deg,#d4a73a,#fff3b0,#d4a73a)", "#0e4d3a"),
  R("deniz",  "oglan",   "Dəniz Mavisi",  0, 0, "linear-gradient(135deg,#2b8cff,#8fe3ff,#2b8cff)", "#0a2a52"),
  R("alov",   "premium", "Alov",          0, 0, "linear-gradient(135deg,#ff3b00,#ffb000,#ff3b00)", "#3a0d05"),
  R("neon",   "premium", "Neon",          0, 0, "linear-gradient(135deg,#ff2bd6,#2bffea,#ffe92b,#ff2bd6)", "#0d0d0d")
];
let RAMKALAR = NUMUNE;

const RAMKA_KES = "polygon(evenodd,0 0,100% 0,100% 100%,0 100%,0 0,8.1% 54.3%,91.9% 54.3%,91.9% 91%,82% 91%,82% 96.8%,18% 96.8%,18% 91%,8.1% 91%,8.1% 54.3%)";   // ramkanın alt qara hissəsini kəsir (küncdəki naxışlar qalır)
const U = (n) => "calc(" + n + "*var(--u))";
const stil = (r, w) =>
  "border:" + w + " solid transparent;background:linear-gradient(" + r.bg + "," + r.bg + ") padding-box," + r.g + " border-box;";

// ===== images/ramkalar qovluğunu oxuyur =====
// Fayl adı istənilən ola bilər: Zumrud-Qizil.png  (ad = Zumrud Qizil)
// Rəqəmlə adlanan fayllar da olar: 1.png, 2.png ... (ad = Ramka 1)
// İstəsən əvvəlinə qiz_ / oglan_ / premium_ yaza bilərsən, o ada düşməz.
// Qiymət fayl adından asılı deyil: həmişə QH / QA.
const PREF = ["qiz", "oglan", "premium"];
function parsla(fad) {
  const m = fad.match(/^(.+)\.(png|webp|gif|jpg|jpeg)$/i);
  if (!m) return null;
  const p = m[1].split("_").filter((s) => s);
  if (p.length > 1 && PREF.includes(p[0].toLowerCase())) p.shift();
  if (!p.length) p.push("Ramka " + m[1]);
  return {
    id: m[1].replace(/[^a-zA-Z0-9_]/g, "_"),
    kat: "",
    ad: /^\d+$/.test(p.join("")) ? "Ramka " + p.join(" ") : p.join(" ").replace(/-/g, " "),
    h: QH,
    a: QA,
    img: YOL + "/" + encodeURIComponent(fad)
  };
}
function yoxla(url) {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => res(true);
    im.onerror = () => res(false);
    im.src = url;
  });
}
async function sekilRamkalar() {
  let f = null;
  try { const c = JSON.parse(localStorage.getItem("ramkaSiyahi") || "null"); if (c && Date.now() - c.t < 120000) f = c.f; } catch (e) {}
  if (!f) {
    f = [];
    // 1) GitHub API (public repo): qovluqdakı bütün fayllar, istənilən adla
    try {
      const r = await fetch("https://api.github.com/repos/" + REPO + "/contents/" + YOL);
      if (r.ok) f = (await r.json()).filter((x) => x.type === "file").map((x) => x.name);
    } catch (e) {}
    // 2) API işləməsə (private repo / limit): 1.png, 2.png ... 40.png (və .webp) birbaşa yoxlanır
    if (!f.length) {
      const yoxlar = [];
      for (let n = 1; n <= 40; n++) for (const ext of ["png", "webp"]) {
        const ad = n + "." + ext;
        yoxlar.push(yoxla(YOL + "/" + ad).then((ok) => (ok ? ad : null)));
      }
      f = (await Promise.all(yoxlar)).filter(Boolean);
    }
    // 3) Ən son ehtiyat: siyahi.json varsa onu oxuyur
    if (!f.length) {
      try { f = await (await fetch(YOL + "/siyahi.json")).json(); } catch (e2) { f = []; }
    }
    // 4) hələ də boşdursa, koddakı ehtiyat siyahı
    if (!f.length) f = EHTIYAT.slice();
    if (f.length) { try { localStorage.setItem("ramkaSiyahi", JSON.stringify({ t: Date.now(), f })); } catch (e) {} }
  }
  return f.map(parsla).filter(Boolean).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

const cari = cariOyuncu();
let p = {}, jeton = 0, sahib = {}, aktiv = "";
let sec = RAMKALAR[0].id, period = "h";

// ===== CSS (ölçülər vw ilə yazılıb, aşağıda ekrana sığan vahidə çevrilir) =====
const st = document.createElement("style");
st.textContent =
  "#ramkaOv{position:fixed;inset:0;display:none;z-index:10000;background:rgba(0,0,0,.6);font-family:Roboto,Arial,sans-serif;color:#fff}" +
  "#ramkaOv .pn{position:absolute;left:50%;top:50%;width:92vw;height:138vw;transform:translate(-50%,-50%)}" +
  "#ramkaOv .row{display:block}" +
  "#ramkaOv .ky{position:absolute;left:4.4vw;top:0;width:66vw;height:114.6vw}" +
  "#ramkaOv .kart{position:absolute;left:0;top:0;box-sizing:border-box;width:100%;height:100%;border-radius:2.6vw;overflow:hidden;box-shadow:0 1vw 5vw rgba(0,0,0,.5);background:#fff}" +
  "#ramkaOv .over{position:absolute;inset:0;background:center/100% 100% no-repeat;pointer-events:none;z-index:2}" +
  "#ramkaOv .foto{position:absolute;left:5.5%;top:2.4%;width:89%;height:51.2%;z-index:1;background:#2b2b2b center/cover no-repeat}" +
  "#ramkaOv .cap{position:absolute;left:0;right:0;bottom:0;padding:6vw 2vw 2vw;text-align:center;font-size:4vw;font-weight:700;text-shadow:0 .3vw .8vw rgba(0,0,0,.7);background:linear-gradient(transparent,rgba(0,0,0,.45))}" +
  "#ramkaOv .vip{position:absolute;left:1.5%;top:3.2%;z-index:4;display:none;background:#7cb83a;color:#fff;font-weight:800;font-size:5.4vw;padding:.3vw 3.4vw .3vw 2.4vw;border-radius:.8vw 2vw 2vw .8vw;box-shadow:0 .4vw 1vw rgba(0,0,0,.4)}" +
  "#ramkaOv .alt{color:#111;position:absolute;left:7.8%;top:54%;width:84.4%;height:43%;z-index:3;box-sizing:border-box;padding:.8vw 1vw 1vw;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden}" +
  "#ramkaOv .stt{text-align:center;font-style:italic;font-size:3.4vw}" +
  "#ramkaOv .sts{display:flex;align-items:center;justify-content:space-between}" +
  "#ramkaOv .sr{display:flex;align-items:center;gap:2vw;height:5.6vw;font-size:4.2vw;font-weight:800;white-space:nowrap}" +
  "#ramkaOv .sr span{width:5vw;text-align:center;font-size:4.4vw}" +
  "#ramkaOv .sr small{font-size:2.5vw;color:#999;font-weight:400}" +
  "#ramkaOv .dv{display:flex;align-items:center;gap:2vw;height:3.6vw}" +
  "#ramkaOv .dv i{flex:1;height:.2vw;background:#e3e3e3}" +
  "#ramkaOv .dv b{font-size:3vw;background:#ececec;border-radius:1.2vw;padding:0 3vw;line-height:3.4vw;color:#9a9a9a;font-weight:400}" +
  "#ramkaOv .mf{display:flex;gap:2.4vw;align-items:center}" +
  "#ramkaOv .mf .av{width:11vw;height:11vw;flex:none;border-radius:2vw;background:#2b2b2b center/cover no-repeat;border:.3vw solid #c9a45a;box-sizing:border-box}" +
  "#ramkaOv .mf .tx{font-size:3.4vw;line-height:1.25;min-width:0;color:#555}" +
  "#ramkaOv .mf .tx small{color:#999;font-size:2.6vw}" +
  "#ramkaOv .mf .tk{display:inline-block;background:#6fbf2e;color:#fff;border-radius:1vw;padding:.4vw 2.6vw;font-size:3vw;margin-top:.6vw}" +
  "#ramkaOv .x{position:absolute;top:-3vw;right:-3vw;z-index:6;width:8.4vw;height:8.4vw;border-radius:50%;border:0;padding:0;background:#fff;color:#8cc63f;font-size:6vw;line-height:1;box-shadow:0 .6vw 2vw rgba(0,0,0,.3);cursor:pointer}" +
  // sağ zolaq
  "#ramkaOv .zl{position:absolute;left:73vw;top:57.3vw;transform:translateY(-50%);width:15.6vw;max-height:76vw;overflow-y:auto;scrollbar-width:none;background:rgba(0,0,0,.5);border-radius:3.4vw;padding:1.8vw;box-sizing:border-box;display:flex;flex-direction:column;gap:2vw;align-items:center}" +
  "#ramkaOv .zl::-webkit-scrollbar{display:none}" +
  "#ramkaOv .th{position:relative;flex:none;width:12vw;height:12vw;border-radius:2.2vw;box-sizing:border-box;cursor:pointer;background:#2b2b2b}" +
  "#ramkaOv .th.s{outline:.6vw solid #fff;outline-offset:.2vw}" +
  "#ramkaOv .th i{position:absolute;right:-1vw;top:-1vw;width:4.6vw;height:4.6vw;border-radius:50%;background:#8cc63f;color:#fff;font-size:3vw;font-style:normal;display:flex;align-items:center;justify-content:center}" +
  "#ramkaOv .bos{font-size:2.6vw;color:#aaa;padding:3vw 0;text-align:center}" +
  // aşağı bar (adı .rbar: səhifədəki başqa .bar qaydası ilə toqquşmasın deyə; transform/right/bottom/margin sıfırlanıb)
  "#ramkaOv .rbar{position:absolute;left:0;top:119vw;right:auto;bottom:auto;margin:0;transform:none;box-sizing:border-box;width:92vw;background:#16130f;border-radius:4vw;padding:2.4vw 3vw;display:flex;align-items:center;gap:2.6vw;box-shadow:0 1vw 4vw rgba(0,0,0,.5)}" +
  "#ramkaOv .ad{flex:1;min-width:0;color:#e8c766;font-size:4.6vw;font-weight:700;line-height:1.15}" +
  "#ramkaOv .ad small{display:block;color:#9a9a9a;font-size:2.8vw;font-weight:400;margin-top:.6vw}" +
  "#ramkaOv .qy{flex:none;display:flex;flex-direction:column;gap:1.2vw}" +
  "#ramkaOv .qy button{border:.3vw solid #444;background:transparent;color:#ddd;border-radius:2vw;padding:1.2vw 2vw;font-size:3.3vw;cursor:pointer;white-space:nowrap}" +
  "#ramkaOv .qy button.a{border-color:#f08a1c;color:#fff;background:#3a2a14}" +
  "#ramkaOv .al{flex:none;width:18vw;height:12vw;border:0;border-radius:2.6vw;background:#6fbf2e;color:#fff;font-size:4.8vw;font-weight:800;cursor:pointer}";
// vw -> ekrana (en və hündürlüyə) görə kiçilən vahid: hər şey ekrana sığır
st.textContent = st.textContent.replace(/(-?\d*\.?\d+)vw/g, "calc($1*var(--u))");
st.textContent += "#ramkaOv{--u:min(1vw,.6vh)}";
document.head.appendChild(st);

const ov = document.createElement("div");
ov.id = "ramkaOv";
ov.innerHTML =
  '<div class="pn"><div class="row"><div class="ky"><div class="kart" id="rKart">' +
  '<div class="foto" id="rFoto"><div class="cap" id="rCap"></div></div>' +
  '<div class="alt"><div class="stt" id="rStt"></div><div class="sts" id="rSts"></div>' +
  '<div class="dv"><i></i><b>&#8964;</b><i></i></div><div class="mf" id="rMf"></div></div>' +
  '<div class="vip" id="rVip">VIP</div><div class="over" id="rOver"></div></div>' +
  '<button class="x" id="rBagla" type="button">&times;</button></div>' +
  '<div class="zl" id="rZl"></div></div>' +
  '<div class="rbar"><div class="ad" id="rAd"></div>' +
  '<div class="qy"><button id="rQH" type="button"></button><button id="rQA" type="button"></button></div>' +
  '<button class="al" id="rAl" type="button">AL</button></div></div>';
document.body.appendChild(ov);

const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n).toLocaleString("en-US").replace(/,/g, " ");
const qalanGun = (id) => { const b = sahib[id] || 0; return b > Date.now() ? Math.ceil((b - Date.now()) / GUN_MS) : 0; };
const sira = (v) => (v ? "<small>" + esc(v) + " sıra</small>" : "");
const sr = (ik, renk, n, s) => '<div class="sr"><span>' + ik + '</span><b style="color:' + renk + '">' + fmt(n) + "</b>" + sira(s) + "</div>";

function ciz() {
  const r = RAMKALAR.find((x) => x.id === sec);
  const m = melumat(p, cari);

  // ===== Profil kartı: oyunçunun öz canlı məlumatları + seçilən ramka =====
  $("rKart").setAttribute("style", !r ? "background:#fff;border:" + U(.5) + " solid #ccc;" : r.img ? "background:#fff;" : stil(r, U(1.3)));
  $("rOver").style.backgroundImage = r && r.img ? "url(" + JSON.stringify(r.img) + ")" : "none";
  $("rOver").style.clipPath = $("rOver").style.webkitClipPath = r && r.img ? RAMKA_KES : "";
  $("rFoto").style.backgroundImage = m.foto ? "url(" + JSON.stringify(m.foto) + ")" : "none";
  $("rCap").textContent = m.ad + (m.yas ? ", " + m.yas : "");
  $("rStt").textContent = m.status;
  $("rVip").style.display = m.vip ? "block" : "none";
  $("rSts").innerHTML =
    "<div>" + sr("&#128139;", "#e5383b", m.opuc, m.opucS) + sr("&#127925;", "#c57ac0", m.musiqi, m.musiqiS) +
    sr("&#128516;", "#f08a1c", jeton, m.jetonS) + "</div>";
  const mf = $("rMf");
  if (m.meftun) {
    mf.style.display = "flex";
    mf.innerHTML = '<div class="av"></div><div class="tx">Məftun <b>' + esc(m.meftun.ad) + "</b><br>" +
      (m.meftun.urek !== "" ? "&#10084;&#65039; <b>" + esc(m.meftun.urek) + "</b> " : "") + sira(m.meftun.sira) +
      '<br><span class="tk">Tərk et</span></div>';
    if (m.meftun.foto) mf.querySelector(".av").style.backgroundImage = "url(" + JSON.stringify(m.meftun.foto) + ")";
  } else { mf.style.display = "none"; mf.innerHTML = ""; }

  // ===== Sağ zolaq: bütün ramkalar (hər kiçik şəkildə oyunçunun öz şəkli ramkanın içində görünür) =====
  const zl = $("rZl");
  const kecen = zl.scrollTop;
  zl.innerHTML = "";
  if (!RAMKALAR.length) {
    zl.innerHTML = '<div class="bos">Tezliklə</div>';
  } else {
    RAMKALAR.forEach((x) => {
      const d = document.createElement("div");
      d.className = "th" + (x.id === sec ? " s" : "");
      d.dataset.id = x.id;
      if (x.img) {
        const ft = m.foto ? ",url(" + JSON.stringify(m.foto) + ")" : "";
        d.style.backgroundImage = "url(" + JSON.stringify(x.img) + ")" + ft;
        d.style.backgroundSize = m.foto ? "100% auto,cover" : "100% auto";
        d.style.backgroundPosition = m.foto ? "top center,center" : "top center";
        d.style.backgroundRepeat = "no-repeat";
        d.style.overflow = "visible";
      } else {
        d.style.cssText = stil(x, U(.9));
      }
      if (qalanGun(x.id)) { const i = document.createElement("i"); i.innerHTML = "&#10003;"; d.appendChild(i); }
      zl.appendChild(d);
    });
  }
  zl.scrollTop = kecen;

  // ===== Aşağı bar =====
  if (!r) {
    $("rAd").innerHTML = "Tezliklə";
    $("rQH").textContent = ""; $("rQA").textContent = ""; $("rAl").textContent = "—";
    return;
  }
  const q = qalanGun(r.id);
  $("rAd").innerHTML = esc(r.ad) + "<small>" + (q ? q + " gün qalıb" : "Önizləmə") + "</small>";
  $("rQH").textContent = "7 Gün: " + r.h + " \u{1F604}";
  $("rQA").textContent = "30 Gün: " + r.a + " \u{1F604}";
  $("rQH").className = period === "h" ? "a" : "";
  $("rQA").className = period === "a" ? "a" : "";
  $("rAl").textContent = !q ? "AL" : (aktiv === r.id ? "UZAT" : "TAX");
}

async function al() {
  const r = RAMKALAR.find((x) => x.id === sec);
  if (!r || !cari || !cari.docId) return;
  const ref = doc(fsdb, "users", cari.docId);
  const q = qalanGun(r.id);

  if (q && aktiv !== r.id) {                       // artıq alınıb, sadəcə taxır
    try { await updateDoc(ref, { aktivRamka: r.id }); } catch (e) { alert("Xəta baş verdi, yenidən cəhd edin"); }
    return;
  }
  const qiymet = r[period];
  try {
    await runTransaction(fsdb, async (tx) => {
      const d = (await tx.get(ref)).data() || {};
      const ja = jetonAcar(d);
      const var_ = Number(d[ja]) || 0;
      if (var_ < qiymet) throw new Error("az");
      const baza = Math.max((d.ramkalar && d.ramkalar[r.id]) || 0, Date.now());   // üstünə əlavə olunur
      tx.update(ref, {
        [ja]: var_ - qiymet,
        ["ramkalar." + r.id]: baza + GUN[period] * GUN_MS,
        aktivRamka: r.id
      });
    });
  } catch (e) {
    alert(e.message === "az" ? "Jeton çatmır" : "Xəta baş verdi, yenidən cəhd edin");
  }
}

if (cari && cari.docId) {
  onSnapshot(doc(fsdb, "users", cari.docId), (s) => {
    p = s.data() || {};
    jeton = Number(p[jetonAcar(p)]) || 0;
    sahib = p.ramkalar || {};
    aktiv = p.aktivRamka || "";
    ciz();
  });
}

// images/ramkalar-dakı ramkaları oxuyub siyahını yeniləyir (nümunələrin yerinə onlar gəlir)
function yenile() {
  sekilRamkalar().then((l) => {
    if (!l.length) return;
    RAMKALAR = l;
    const a = RAMKALAR.find((x) => x.id === aktiv && qalanGun(x.id));
    const f = RAMKALAR.find((x) => x.id === sec) || a || RAMKALAR[0];
    sec = f.id;
    ciz();
    document.dispatchEvent(new Event("ramka-yuklendi"));   // açıq profil kartı ramkanı tapsın
  }).catch(() => {});
}

document.addEventListener("ramka-ac", () => {
  const a = RAMKALAR.find((x) => x.id === aktiv && qalanGun(x.id));
  if (a) sec = a.id;
  ciz();
  ov.style.display = "block";
  yenile();                                         // hər açılışda yeni yüklənən ramkalar da gəlsin
});
const bagla = () => { ov.style.display = "none"; };
$("rBagla").onclick = bagla;
ov.addEventListener("click", (e) => {
  if (e.target === ov || e.target.classList.contains("pn") || e.target.classList.contains("row")) bagla();
});
$("rZl").onclick = (e) => { const t = e.target.closest(".th"); if (t) { sec = t.dataset.id; ciz(); } };
$("rQH").onclick = () => { period = "h"; ciz(); };
$("rQA").onclick = () => { period = "a"; ciz(); };
$("rAl").onclick = al;

yenile();

// Başqa fayllar (məs. masadakı profil kartı) üçün: oyunçunun aktiv ramkasını qaytarır
window.ramkaAktivTap = (pp) => {
  const id = pp && pp.aktivRamka;
  const b = pp && pp.ramkalar && pp.ramkalar[id];
  return id && b > Date.now() ? (RAMKALAR.find((x) => x.id === id) || null) : null;
};
window.ramkaStil = stil;
