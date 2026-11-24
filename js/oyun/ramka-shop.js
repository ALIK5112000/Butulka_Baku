import { fsdb } from "../core/firebase.js";
import { cariOyuncu } from "./yardimci.js";
import { doc, onSnapshot, runTransaction, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const REPO = "ALIK5112000/Butulka_Baku";
const YOL = "images/ramkalar";

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
const KAT = [{ id: "qiz", ad: "Qız" }, { id: "oglan", ad: "Oğlan" }, { id: "premium", ad: "Premium" }];

// ===== Ehtiyat CSS ramkaları (images/ramkalar boş olanda görünür) =====
const R = (id, kat, ad, h, a, g, bg) => ({ id, kat, ad, h, a, g, bg });
const NUMUNE = [
  R("cicek",  "qiz",     "Çiçək Çəhrayı", 60, 180, "linear-gradient(135deg,#ff9ccb,#ffe0f0,#ff6fb0)", "#5a1a3f"),
  R("lavanda","qiz",     "Lavanda",       60, 180, "linear-gradient(135deg,#b79cff,#e6dcff,#8a6bff)", "#2e2160"),
  R("zumrud", "oglan",   "Zümrüd Qızıl",  60, 180, "linear-gradient(135deg,#d4a73a,#fff3b0,#d4a73a)", "#0e4d3a"),
  R("deniz",  "oglan",   "Dəniz Mavisi",  60, 180, "linear-gradient(135deg,#2b8cff,#8fe3ff,#2b8cff)", "#0a2a52"),
  R("alov",   "premium", "Alov",         150, 450, "linear-gradient(135deg,#ff3b00,#ffb000,#ff3b00)", "#3a0d05"),
  R("neon",   "premium", "Neon",         150, 450, "linear-gradient(135deg,#ff2bd6,#2bffea,#ffe92b,#ff2bd6)", "#0d0d0d")
];
let RAMKALAR = NUMUNE;

const stil = (r, w) =>
  "border:" + w + " solid transparent;background:linear-gradient(" + r.bg + "," + r.bg + ") padding-box," + r.g + " border-box;";

// ===== images/ramkalar qovluğunu oxuyur: kateqoriya_Ad_həftəlik_aylıq.png =====
const QIY = { qiz: [60, 180], oglan: [60, 180], premium: [150, 450] };
function parsla(fad) {
  const m = fad.match(/^(.+)\.(png|webp|gif|jpg|jpeg)$/i);
  if (!m) return null;
  const p = m[1].split("_");
  const kat = (p[0] || "").toLowerCase();
  if (!QIY[kat] || !p[1]) return null;
  return {
    id: m[1].replace(/[^a-zA-Z0-9_]/g, "_"),
    kat,
    ad: p[1].replace(/-/g, " "),
    h: Number(p[2]) || QIY[kat][0],
    a: Number(p[3]) || QIY[kat][1],
    img: YOL + "/" + encodeURIComponent(fad)
  };
}
async function sekilRamkalar() {
  let f = null;
  try { const c = JSON.parse(localStorage.getItem("ramkaSiyahi") || "null"); if (c && Date.now() - c.t < 300000) f = c.f; } catch (e) {}
  if (!f) {
    try {
      const r = await fetch("https://api.github.com/repos/" + REPO + "/contents/" + YOL);
      if (!r.ok) throw new Error(r.status);
      f = (await r.json()).map((x) => x.name);
    } catch (e) {
      try { f = await (await fetch(YOL + "/siyahi.json")).json(); } catch (e2) { f = []; }
    }
    if (f.length) { try { localStorage.setItem("ramkaSiyahi", JSON.stringify({ t: Date.now(), f })); } catch (e) {} }
  }
  return f.map(parsla).filter(Boolean).sort((a, b) => a.id.localeCompare(b.id));
}

const cari = cariOyuncu();
let p = {}, jeton = 0, sahib = {}, aktiv = "";
let sec = RAMKALAR[0].id, period = "h", kat = RAMKALAR[0].kat;

const st = document.createElement("style");
st.textContent =
  "#ramkaOv{position:fixed;inset:0;display:none;z-index:10000;background:rgba(0,0,0,.55);font-family:Roboto,Arial,sans-serif;color:#fff}" +
  "#ramkaOv .wrap{position:absolute;left:0;right:0;top:0;bottom:34vw;display:flex;align-items:center;justify-content:center}" +
  "#ramkaOv .ky{position:relative}" +
  "#ramkaOv .kart{position:relative;box-sizing:border-box;width:66vw;aspect-ratio:1075/1867;border-radius:4vw;overflow:hidden;box-shadow:0 1vw 5vw rgba(0,0,0,.5);background:#0b0b0b}" +
  "#ramkaOv .over{position:absolute;inset:0;background:center/100% 100% no-repeat;pointer-events:none;z-index:2}" +
  "#ramkaOv .foto{position:absolute;left:5.5%;top:2.4%;width:89%;height:51.2%;z-index:1;background:#2b2b2b center/cover no-repeat}" +
  "#ramkaOv .cap{position:absolute;left:0;right:0;bottom:0;padding:6vw 2vw 2vw;text-align:center;font-size:4vw;font-weight:700;text-shadow:0 .3vw .8vw rgba(0,0,0,.7);background:linear-gradient(transparent,rgba(0,0,0,.45))}" +
  "#ramkaOv .vip{position:absolute;left:1.5%;top:3.2%;z-index:4;display:none;background:#7cb83a;color:#fff;font-weight:800;font-size:5.4vw;padding:.3vw 3.4vw .3vw 2.4vw;border-radius:.8vw 2vw 2vw .8vw;box-shadow:0 .4vw 1vw rgba(0,0,0,.4)}" +
  "#ramkaOv .alt{position:absolute;left:7.8%;top:54%;width:84.4%;height:43%;z-index:3;box-sizing:border-box;padding:.8vw 1vw 1vw;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden}" +
  "#ramkaOv .stt{text-align:center;font-style:italic;font-size:3.4vw}" +
  "#ramkaOv .sts{display:flex;align-items:center;justify-content:space-between}" +
  "#ramkaOv .sr{display:flex;align-items:center;gap:2vw;height:5.6vw;font-size:4.2vw;font-weight:800;white-space:nowrap}" +
  "#ramkaOv .sr span{width:5vw;text-align:center;font-size:4.4vw}" +
  "#ramkaOv .sr small{font-size:2.5vw;color:#999;font-weight:400}" +
  "#ramkaOv .tr{font-size:12vw;line-height:1;margin-right:1vw}" +
  "#ramkaOv .dv{display:flex;align-items:center;gap:2vw;height:3.6vw}" +
  "#ramkaOv .dv i{flex:1;height:.2vw;background:rgba(255,255,255,.18)}" +
  "#ramkaOv .dv b{font-size:3vw;background:#3a3125;border-radius:1.2vw;padding:0 3vw;line-height:3.4vw;color:#ddd;font-weight:400}" +
  "#ramkaOv .mf{display:flex;gap:2.4vw;align-items:center}" +
  "#ramkaOv .mf .av{width:11vw;height:11vw;flex:none;border-radius:2vw;background:#2b2b2b center/cover no-repeat;border:.3vw solid #c9a45a;box-sizing:border-box}" +
  "#ramkaOv .mf .tx{font-size:3.4vw;line-height:1.25;min-width:0}" +
  "#ramkaOv .mf .tx small{color:#999;font-size:2.6vw}" +
  "#ramkaOv .mf .tk{display:inline-block;background:#6fbf2e;color:#fff;border-radius:1vw;padding:.4vw 2.6vw;font-size:3vw;margin-top:.6vw}" +
  "#ramkaOv .dg{display:flex;justify-content:space-between;padding:0 1vw}" +
  "#ramkaOv .dg div{width:9vw;height:9vw;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:3vw;font-weight:800;box-sizing:border-box}" +
  "#ramkaOv .x{position:absolute;top:-3vw;right:-3vw;width:8.4vw;height:8.4vw;border-radius:50%;border:0;padding:0;background:#fff;color:#8cc63f;font-size:6vw;line-height:1;box-shadow:0 .6vw 2vw rgba(0,0,0,.3);cursor:pointer}" +
  "#ramkaOv .zl{position:absolute;right:1.2vw;top:50%;transform:translateY(-50%);width:14.6vw;max-height:100vw;overflow-y:auto;background:rgba(0,0,0,.45);border-radius:3vw;padding:1.5vw;box-sizing:border-box;display:flex;flex-direction:column;gap:1.6vw;align-items:center}" +
  "#ramkaOv .th{position:relative;flex:none;width:11.4vw;height:11.4vw;border-radius:2vw;box-sizing:border-box;cursor:pointer}" +
  "#ramkaOv .th.s{outline:.6vw solid #fff;outline-offset:.2vw}" +
  "#ramkaOv .th i{position:absolute;right:-1vw;top:-1vw;width:4.4vw;height:4.4vw;border-radius:50%;background:#8cc63f;color:#fff;font-size:3vw;font-style:normal;display:flex;align-items:center;justify-content:center}" +
  "#ramkaOv .bos{font-size:2.6vw;color:#aaa;padding:3vw 0;text-align:center}" +
  "#ramkaOv .bar{position:absolute;left:2.5vw;right:2.5vw;bottom:4vw;box-sizing:border-box;background:#16130f;border-radius:4vw;padding:2.4vw 3vw 3vw;box-shadow:0 1vw 4vw rgba(0,0,0,.5)}" +
  "#ramkaOv .tabs{display:flex;gap:2vw;margin-bottom:2.6vw}" +
  "#ramkaOv .tabs button{flex:1;height:8vw;border:0;border-radius:2.4vw;background:#2a2620;color:#bbb;font-size:3.6vw;font-weight:500;cursor:pointer}" +
  "#ramkaOv .tabs button.a{background:#f08a1c;color:#fff}" +
  "#ramkaOv .alis{display:flex;align-items:center;gap:2.4vw}" +
  "#ramkaOv .ad{flex:1;min-width:0;color:#e8c766;font-size:4.2vw;font-weight:700;line-height:1.15}" +
  "#ramkaOv .ad small{display:block;color:#9a9a9a;font-size:2.8vw;font-weight:400}" +
  "#ramkaOv .qy{flex:none;display:flex;flex-direction:column;gap:1.2vw}" +
  "#ramkaOv .qy button{border:.3vw solid #444;background:transparent;color:#ddd;border-radius:2vw;padding:1vw 1.8vw;font-size:3.1vw;cursor:pointer;white-space:nowrap}" +
  "#ramkaOv .qy button.a{border-color:#f08a1c;color:#fff;background:#3a2a14}" +
  "#ramkaOv .al{flex:none;width:17vw;height:11vw;border:0;border-radius:2.6vw;background:#6fbf2e;color:#fff;font-size:4.6vw;font-weight:800;cursor:pointer}";
document.head.appendChild(st);

const ov = document.createElement("div");
ov.id = "ramkaOv";
ov.innerHTML =
  '<div class="wrap"><div class="ky"><div class="kart" id="rKart">' +
  '<div class="foto" id="rFoto"><div class="cap" id="rCap"></div></div>' +
  '<div class="alt"><div class="stt" id="rStt"></div><div class="sts" id="rSts"></div>' +
  '<div class="dv"><i></i><b>&#8964;</b><i></i></div><div class="mf" id="rMf"></div>' +
  '<div class="dg"><div style="background:#e8553d">&#128737;</div>' +
  '<div style="background:#f08a1c">Buto</div><div style="background:#a9519c">&#127925;</div>' +
  '<div style="background:#f6a23c">&#10004;</div></div></div>' +
  '<div class="vip" id="rVip">VIP</div><div class="over" id="rOver"></div></div>' +
  '<button class="x" id="rBagla" type="button">&times;</button></div>' +
  '<div class="zl" id="rZl"></div></div>' +
  '<div class="bar"><div class="tabs" id="rTabs"></div>' +
  '<div class="alis"><div class="ad" id="rAd"></div>' +
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
  $("rKart").setAttribute("style", !r ? "background:#0b0b0b;border:.5vw solid #444;" : r.img ? "background:#0b0b0b;" : stil(r, "1.3vw"));
  $("rOver").style.backgroundImage = r && r.img ? "url(" + JSON.stringify(r.img) + ")" : "none";
  $("rFoto").style.backgroundImage = m.foto ? "url(" + JSON.stringify(m.foto) + ")" : "none";
  $("rCap").textContent = m.ad + (m.yas ? ", " + m.yas : "");
  $("rStt").textContent = m.status;
  $("rVip").style.display = m.vip ? "block" : "none";
  $("rSts").innerHTML =
    "<div>" + sr("&#128139;", "#e5383b", m.opuc, m.opucS) + sr("&#127925;", "#c57ac0", m.musiqi, m.musiqiS) +
    sr("&#128516;", "#f08a1c", jeton, m.jetonS) + '</div><div class="tr">&#127942;</div>';
  const mf = $("rMf");
  if (m.meftun) {
    mf.style.display = "flex";
    mf.innerHTML = '<div class="av"></div><div class="tx">Məftun <b>' + esc(m.meftun.ad) + "</b><br>" +
      (m.meftun.urek !== "" ? "&#10084;&#65039; <b>" + esc(m.meftun.urek) + "</b> " : "") + sira(m.meftun.sira) +
      '<br><span class="tk">Tərk et</span></div>';
    if (m.meftun.foto) mf.querySelector(".av").style.backgroundImage = "url(" + JSON.stringify(m.meftun.foto) + ")";
  } else { mf.style.display = "none"; mf.innerHTML = ""; }

  // ===== Sağ zolaq: seçilən kateqoriyanın ramkaları =====
  const siy = RAMKALAR.filter((x) => x.kat === kat);
  $("rZl").innerHTML = siy.length ? siy.map((x) =>
    '<div class="th' + (x.id === sec ? " s" : "") + '" data-id="' + x.id + '" style="' +
    (x.img ? "background:#161616 center/contain no-repeat url(" + x.img + ");" : stil(x, ".9vw")) + '">' +
    (qalanGun(x.id) ? "<i>&#10003;</i>" : "") + "</div>").join("") : '<div class="bos">Tezliklə</div>';

  // ===== Aşağı bar =====
  $("rTabs").innerHTML = KAT.map((k) =>
    '<button type="button" data-k="' + k.id + '" class="' + (k.id === kat ? "a" : "") + '">' + k.ad + "</button>").join("");
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

document.addEventListener("ramka-ac", () => {
  const a = RAMKALAR.find((x) => x.id === aktiv && qalanGun(x.id));
  if (a) { sec = a.id; kat = a.kat; }
  ciz();
  ov.style.display = "block";
});
const bagla = () => { ov.style.display = "none"; };
$("rBagla").onclick = bagla;
ov.addEventListener("click", (e) => { if (e.target === ov || e.target.classList.contains("wrap")) bagla(); });
$("rZl").onclick = (e) => { const t = e.target.closest(".th"); if (t) { sec = t.dataset.id; ciz(); } };
$("rTabs").onclick = (e) => {
  const b = e.target.closest("button"); if (!b) return;
  kat = b.dataset.k;
  const f = RAMKALAR.find((x) => x.kat === kat);
  sec = f ? f.id : "";
  ciz();
};
$("rQH").onclick = () => { period = "h"; ciz(); };
$("rQA").onclick = () => { period = "a"; ciz(); };
$("rAl").onclick = al;

// images/ramkalar-dakı öz ramkaların varsa, nümunələrin yerinə onlar gəlir
sekilRamkalar().then((l) => {
  if (!l.length) return;
  RAMKALAR = l;
  const a = RAMKALAR.find((x) => x.id === aktiv && qalanGun(x.id));
  const f = a || RAMKALAR.find((x) => x.id === sec) || RAMKALAR[0];
  sec = f.id; kat = f.kat;
  ciz();
}).catch(() => {});

// Başqa fayllar (məs. masadakı profil kartı) üçün: oyunçunun aktiv ramkasını qaytarır
window.ramkaAktivTap = (pp) => {
  const id = pp && pp.aktivRamka;
  const b = pp && pp.ramkalar && pp.ramkalar[id];
  return id && b > Date.now() ? (RAMKALAR.find((x) => x.id === id) || null) : null;
};
window.ramkaStil = stil;
