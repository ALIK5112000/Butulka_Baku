import { fsdb } from "../core/firebase.js";
import { cariOyuncu } from "./yardimci.js";
import { doc, onSnapshot, runTransaction, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// !!! Firestore-da jetonun sahə adı (heart-shop.js-də necə yazılıbsa)
const JETON_SAHESI = "jeton";

// Profil kartı üçün users/{docId} sahələri: sənin bazandakı adlara görə düzəlt
function melumat(p, cari) {
  return {
    ad:     p.ad || p.name || p.nick || (cari && cari.ad) || "Oyunçu",
    yas:    p.yas || p.age || "",
    foto:   p.foto || p.photo || p.sekil || p.avatar || p.image || (cari && cari.foto) || "",
    status: p.status || "Xoş Oyunlar",
    urek:   p.hearts || 0
  };
}

const GUN = { h: 7, a: 30 };
const GUN_MS = 86400000;
const KAT = [{ id: "qiz", ad: "Qız" }, { id: "oglan", ad: "Oğlan" }, { id: "premium", ad: "Premium" }];

// R(id, kateqoriya, ad, həftəlik, aylıq, haşiyə rəngi (gradient), kartın alt fonu)
const R = (id, kat, ad, h, a, g, bg) => ({ id, kat, ad, h, a, g, bg });
const RAMKALAR = [
  R("cicek",  "qiz",     "Çiçək Çəhrayı", 60, 180, "linear-gradient(135deg,#ff9ccb,#ffe0f0,#ff6fb0)", "#5a1a3f"),
  R("lavanda","qiz",     "Lavanda",       60, 180, "linear-gradient(135deg,#b79cff,#e6dcff,#8a6bff)", "#2e2160"),
  R("qulgul", "qiz",     "Qızıl Gül",     60, 180, "linear-gradient(135deg,#f4b6a0,#ffe2c0,#e6a15a)", "#4a2a2a"),
  R("zumrud", "oglan",   "Zümrüd Qızıl",  60, 180, "linear-gradient(135deg,#d4a73a,#fff3b0,#d4a73a)", "#0e4d3a"),
  R("deniz",  "oglan",   "Dəniz Mavisi",  60, 180, "linear-gradient(135deg,#2b8cff,#8fe3ff,#2b8cff)", "#0a2a52"),
  R("karbon", "oglan",   "Qara Karbon",   60, 180, "linear-gradient(135deg,#555,#aaa,#555)",          "#141414"),
  R("alov",   "premium", "Alov",         150, 450, "linear-gradient(135deg,#ff3b00,#ffb000,#ff3b00)", "#3a0d05"),
  R("brilyant","premium","Brilyant",     150, 450, "linear-gradient(135deg,#ffffff,#9fd8ff,#ffffff)", "#1c2430"),
  R("neon",   "premium", "Neon",         150, 450, "linear-gradient(135deg,#ff2bd6,#2bffea,#ffe92b,#ff2bd6)", "#0d0d0d")
];

const stil = (r, w) =>
  "border:" + w + " solid transparent;background:linear-gradient(" + r.bg + "," + r.bg + ") padding-box," + r.g + " border-box;";

const cari = cariOyuncu();
let p = {}, jeton = 0, sahib = {}, aktiv = "";
let sec = RAMKALAR[0].id, period = "h", kat = "qiz";

const st = document.createElement("style");
st.textContent =
  "#ramkaOv{position:fixed;inset:0;display:none;flex-direction:column;z-index:10000;background:rgba(0,0,0,.55);font-family:Roboto,Arial,sans-serif;color:#fff}" +
  "#ramkaOv .wrap{flex:1;display:flex;align-items:center;justify-content:center;gap:2.4vw;min-height:0}" +
  "#ramkaOv .ky{position:relative}" +
  "#ramkaOv .kart{position:relative;width:66vw;aspect-ratio:1075/1867;border-radius:4vw;overflow:hidden;box-shadow:0 1vw 5vw rgba(0,0,0,.5);background:#0b0b0b}" +
  "#ramkaOv .over{position:absolute;inset:0;background:center/100% 100% no-repeat;pointer-events:none;z-index:2}" +
  "#ramkaOv .foto{position:absolute;left:5.5%;top:2.4%;width:89%;height:51.2%;z-index:1;background:#2b2b2b center/cover no-repeat}" +
  "#ramkaOv .cap{position:absolute;left:0;right:0;bottom:0;padding:6vw 2vw 2vw;text-align:center;font-size:4vw;font-weight:700;text-shadow:0 .3vw .8vw rgba(0,0,0,.7);background:linear-gradient(transparent,rgba(0,0,0,.45))}" +
  "#ramkaOv .alt{position:absolute;left:7.8%;top:54%;width:84.4%;height:43%;z-index:3;display:flex;flex-direction:column;justify-content:center;text-align:center}" +
  "#ramkaOv .stt{font-size:4vw;font-style:italic;margin-bottom:2.4vw}" +
  "#ramkaOv .sat{display:flex;justify-content:center;gap:6vw;font-size:4.4vw;font-weight:700}" +
  "#ramkaOv .x{position:absolute;top:-3vw;right:-3vw;width:8.4vw;height:8.4vw;border-radius:50%;border:0;padding:0;background:#fff;color:#8cc63f;font-size:6vw;line-height:1;box-shadow:0 .6vw 2vw rgba(0,0,0,.3);cursor:pointer}" +
  "#ramkaOv .zl{width:15vw;max-height:92vw;overflow-y:auto;background:rgba(0,0,0,.45);border-radius:3vw;padding:1.6vw;display:flex;flex-direction:column;gap:1.6vw}" +
  "#ramkaOv .th{position:relative;flex:none;width:11.6vw;height:11.6vw;border-radius:2vw;box-sizing:border-box;cursor:pointer}" +
  "#ramkaOv .th.s{outline:.6vw solid #fff;outline-offset:.2vw}" +
  "#ramkaOv .th i{position:absolute;right:-1vw;top:-1vw;width:4.4vw;height:4.4vw;border-radius:50%;background:#8cc63f;color:#fff;font-size:3vw;font-style:normal;display:flex;align-items:center;justify-content:center}" +
  "#ramkaOv .bar{background:#16130f;border-radius:4vw 4vw 0 0;padding:2.4vw 3.5vw 4vw}" +
  "#ramkaOv .tabs{display:flex;gap:2vw;margin-bottom:3vw}" +
  "#ramkaOv .tabs button{flex:1;height:8.4vw;border:0;border-radius:2.4vw;background:#2a2620;color:#bbb;font-size:3.7vw;font-weight:500;cursor:pointer}" +
  "#ramkaOv .tabs button.a{background:#f08a1c;color:#fff}" +
  "#ramkaOv .alis{display:flex;align-items:center;gap:3vw}" +
  "#ramkaOv .ad{flex:1;color:#e8c766;font-size:4.6vw;font-weight:700;line-height:1.15}" +
  "#ramkaOv .ad small{display:block;color:#9a9a9a;font-size:3vw;font-weight:400}" +
  "#ramkaOv .qy{display:flex;flex-direction:column;gap:1.2vw}" +
  "#ramkaOv .qy button{border:.3vw solid #444;background:transparent;color:#ddd;border-radius:2vw;padding:.8vw 2vw;font-size:3.3vw;cursor:pointer;white-space:nowrap}" +
  "#ramkaOv .qy button.a{border-color:#f08a1c;color:#fff;background:#3a2a14}" +
  "#ramkaOv .al{width:20vw;height:12vw;border:0;border-radius:2.6vw;background:#6fbf2e;color:#fff;font-size:5vw;font-weight:800;cursor:pointer}";
document.head.appendChild(st);

const ov = document.createElement("div");
ov.id = "ramkaOv";
ov.innerHTML =
  '<div class="wrap"><div class="ky"><div class="kart" id="rKart">' +
  '<div class="foto" id="rFoto"><div class="cap" id="rCap"></div></div>' +
  '<div class="alt"><div class="stt" id="rStt"></div>' +
  '<div class="sat"><span id="rUrek"></span><span id="rJeton"></span></div></div><div class="over" id="rOver"></div></div>' +
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

function ciz() {
  const r = RAMKALAR.find((x) => x.id === sec);
  const m = melumat(p, cari);

  // Profil kartı (real vaxt, seçilən ramka ilə)
  $("rKart").setAttribute("style", r.img ? "background:#0b0b0b;" : stil(r, "1.3vw"));
  $("rOver").style.backgroundImage = r.img ? "url(" + r.img + ")" : "none";
  $("rFoto").style.backgroundImage = m.foto ? "url(" + m.foto + ")" : "none";
  $("rCap").textContent = m.ad + (m.yas ? ", " + m.yas : "");
  $("rStt").textContent = m.status;
  $("rUrek").textContent = "❤️ " + fmt(m.urek);
  $("rJeton").textContent = "😄 " + fmt(jeton);

  // Sağ zolaq: seçilən kateqoriyanın ramkaları
  $("rZl").innerHTML = RAMKALAR.filter((x) => x.kat === kat).map((x) =>
    '<div class="th' + (x.id === sec ? " s" : "") + '" data-id="' + x.id + '" style="' + (x.img ? "background:#161616 center/contain no-repeat url(" + x.img + ");" : stil(x, ".9vw")) + '">' +
    (qalanGun(x.id) ? "<i>✓</i>" : "") + "</div>").join("");

  // Alt hissə: kateqoriyalar
  $("rTabs").innerHTML = KAT.filter((k) => RAMKALAR.some((x) => x.kat === k.id)).map((k) =>
    '<button type="button" data-k="' + k.id + '" class="' + (k.id === kat ? "a" : "") + '">' + k.ad + "</button>").join("");

  // Ad, qiymətlər, düymə
  const q = qalanGun(r.id);
  $("rAd").innerHTML = r.ad + (q ? "<small>" + q + " gün qalıb</small>" : "");
  $("rQH").textContent = "7 Gün: " + r.h + " 😄";
  $("rQA").textContent = "30 Gün: " + r.a + " 😄";
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
      if ((d[JETON_SAHESI] || 0) < qiymet) throw new Error("az");
      const baza = Math.max((d.ramkalar && d.ramkalar[r.id]) || 0, Date.now());   // üstünə əlavə olunur
      tx.update(ref, {
        [JETON_SAHESI]: (d[JETON_SAHESI] || 0) - qiymet,
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
    jeton = p[JETON_SAHESI] || 0;
    sahib = p.ramkalar || {};
    aktiv = p.aktivRamka || "";
    ciz();
  });
}

document.addEventListener("ramka-ac", () => {
  const a = RAMKALAR.find((x) => x.id === aktiv && qalanGun(x.id));
  if (a) { sec = a.id; kat = a.kat; }
  ciz();
  ov.style.display = "flex";
});
const bagla = () => { ov.style.display = "none"; };
$("rBagla").onclick = bagla;
ov.addEventListener("click", (e) => { if (e.target === ov) bagla(); });
$("rZl").onclick = (e) => { const t = e.target.closest(".th"); if (t) { sec = t.dataset.id; ciz(); } };
$("rTabs").onclick = (e) => {
  const b = e.target.closest("button"); if (!b) return;
  kat = b.dataset.k;
  sec = RAMKALAR.find((x) => x.kat === kat).id;
  ciz();
};
$("rQH").onclick = () => { period = "h"; ciz(); };
$("rQA").onclick = () => { period = "a"; ciz(); };
$("rAl").onclick = al;
