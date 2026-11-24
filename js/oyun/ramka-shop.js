import { fsdb } from "../core/firebase.js";
import { cariOyuncu } from "./yardimci.js";
import { doc, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// !!! Jetonun Firestore-da saxlandığı sahənin adı. heart-shop.js-də necə yazılıbsa, eyni yaz.
const JETON_SAHESI = "jeton";

// Ramkalar: img verməsən CSS ilə çəkilir. Öz ramkan varsa img: "images/ramka/qizil.png" yaz
const RAMKALAR = [
  { id: "qizil", ad: "Qızıl yunan", h: 500,  a: 1500, css: "border:1vw solid #d4a73a;outline:.25vw solid #6b4e0f;outline-offset:-1.6vw" },
  { id: "alov",  ad: "Alovlu",      h: 800,  a: 2400, css: "border:1vw solid #e8561f;outline:.5vw solid #ffb347;outline-offset:-1.6vw" },
  { id: "kral",  ad: "Kral",        h: 1200, a: 3600, css: "border:1.3vw double #8a4fd6" },
  { id: "neon",  ad: "Neon",        h: 2000, a: 6000, css: "border:.8vw solid #20d0c0;outline:.5vw solid #0b7a70;outline-offset:.5vw" }
];
const GUN = { h: 7, a: 30 };
const GUN_MS = 86400000;

const cari = cariOyuncu();
let period = "h", jeton = 0, sahib = {};

const st = document.createElement("style");
st.textContent =
  "#ramkaOv{position:fixed;inset:0;display:none;z-index:10000;background:rgba(0,0,0,.4);align-items:flex-end;font-family:Roboto,Arial,sans-serif}" +
  "#ramkaOv .sh{width:100%;background:#f4f3f2;border-radius:5vw 5vw 0 0;padding:4vw 3.5vw 5vw;color:#222;max-height:85vh;overflow:auto}" +
  "#ramkaOv .bs{display:flex;align-items:center;justify-content:space-between;margin-bottom:3vw}" +
  "#ramkaOv .bs b{font-size:4.6vw;font-weight:500}" +
  "#ramkaOv .bl{display:flex;align-items:center;gap:2vw}" +
  "#ramkaOv .jb{background:#fff;border:.2vw solid #ddd;border-radius:4vw;padding:.8vw 2.8vw;font-size:3.6vw;display:flex;align-items:center;gap:1.4vw}" +
  "#ramkaOv .jt{width:4.2vw;height:4.2vw;border-radius:50%;background:#f7a823;display:inline-block}" +
  "#ramkaOv .x{width:8vw;height:8vw;border-radius:50%;border:.2vw solid #ddd;background:#fff;color:#6fbf2e;font-size:5vw;line-height:1;cursor:pointer;padding:0}" +
  "#ramkaOv .tg{display:flex;gap:1vw;background:#e6e4e1;border-radius:3vw;padding:.9vw;margin-bottom:3vw}" +
  "#ramkaOv .tg button{flex:1;height:9vw;border:0;border-radius:2.4vw;background:transparent;color:#555;font-size:3.7vw;font-weight:500;cursor:pointer}" +
  "#ramkaOv .tg button.a{background:#f08a1c;color:#fff}" +
  "#ramkaOv .gr{display:grid;grid-template-columns:1fr 1fr;gap:3vw}" +
  "#ramkaOv .cd{background:#fff;border:.2vw solid #ddd;border-radius:3.4vw;padding:2.8vw;display:flex;flex-direction:column;align-items:center;gap:1.8vw}" +
  "#ramkaOv .cd.on{border:.6vw solid #f08a1c;padding:2.4vw}" +
  "#ramkaOv .av{width:17vw;height:17vw;background:#2b2b2b;border-radius:1.6vw;box-sizing:border-box;background-size:cover}" +
  "#ramkaOv .ad{font-size:3.7vw;font-weight:500}" +
  "#ramkaOv .al{width:100%;border:0;border-radius:2.2vw;height:9.4vw;background:#f08a1c;color:#fff;font-size:3.6vw;font-weight:500;display:flex;align-items:center;justify-content:center;gap:1.4vw;cursor:pointer}" +
  "#ramkaOv .al.ok{background:#6fbf2e}" +
  "#ramkaOv .qeyd{font-size:3.2vw;color:#777;text-align:center;margin-top:3vw}";
document.head.appendChild(st);

const ov = document.createElement("div");
ov.id = "ramkaOv";
ov.innerHTML =
  '<div class="sh"><div class="bs"><b>Ramkalar</b><div class="bl">' +
  '<div class="jb"><span class="jt"></span><span id="ramkaJeton">0</span></div>' +
  '<button class="x" id="ramkaBagla" type="button">&times;</button></div></div>' +
  '<div class="tg"><button id="rH" class="a" type="button">Həftəlik · 7 gün</button>' +
  '<button id="rA" type="button">Aylıq · 30 gün</button></div>' +
  '<div class="gr" id="ramkaGrid"></div>' +
  '<div class="qeyd">Müddət bitəndə ramka avtomatik silinir</div></div>';
document.body.appendChild(ov);

const fmt = (n) => Number(n).toLocaleString("en-US").replace(/,/g, " ");

function ciz() {
  document.getElementById("ramkaJeton").textContent = fmt(jeton);
  const now = Date.now();
  document.getElementById("ramkaGrid").innerHTML = RAMKALAR.map((r) => {
    const bitme = sahib[r.id] || 0;
    const qalan = bitme > now ? Math.ceil((bitme - now) / GUN_MS) : 0;
    const onizle = r.img ? "background-image:url(" + r.img + ")" : r.css;
    return '<div class="cd' + (qalan ? " on" : "") + '"><div class="av" style="' + onizle + '"></div>' +
      '<div class="ad">' + r.ad + "</div>" +
      '<button class="al' + (qalan ? " ok" : "") + '" data-id="' + r.id + '" type="button">' +
      (qalan ? "Aktiv · " + qalan + " gün" : '<span class="jt"></span>' + fmt(r[period]) + " · Al") +
      "</button></div>";
  }).join("");
}

async function al(id) {
  const r = RAMKALAR.find((x) => x.id === id);
  if (!r || !cari || !cari.docId) return;
  const qiymet = r[period];
  const ref = doc(fsdb, "users", cari.docId);
  try {
    await runTransaction(fsdb, async (tx) => {
      const p = (await tx.get(ref)).data() || {};
      if ((p[JETON_SAHESI] || 0) < qiymet) throw new Error("az");
      const kohne = (p.ramkalar && p.ramkalar[id]) || 0;
      const baza = Math.max(kohne, Date.now());           // aktiv ramkanı alsa, üstünə əlavə olunur
      tx.update(ref, {
        [JETON_SAHESI]: (p[JETON_SAHESI] || 0) - qiymet,
        ["ramkalar." + id]: baza + GUN[period] * GUN_MS,
        aktivRamka: id
      });
    });
  } catch (e) {
    alert(e.message === "az" ? "Jeton çatmır" : "Xəta baş verdi, yenidən cəhd edin");
  }
}

if (cari && cari.docId) {
  onSnapshot(doc(fsdb, "users", cari.docId), (s) => {
    const p = s.data() || {};
    jeton = p[JETON_SAHESI] || 0;
    sahib = p.ramkalar || {};
    ciz();
  });
}

const bagla = () => { ov.style.display = "none"; };
document.addEventListener("ramka-ac", () => { ciz(); ov.style.display = "flex"; });
document.getElementById("ramkaBagla").onclick = bagla;
ov.addEventListener("click", (e) => { if (e.target === ov) bagla(); });
document.getElementById("rH").onclick = function () { period = "h"; this.className = "a"; document.getElementById("rA").className = ""; ciz(); };
document.getElementById("rA").onclick = function () { period = "a"; this.className = "a"; document.getElementById("rH").className = ""; ciz(); };
document.getElementById("ramkaGrid").onclick = (e) => {
  const b = e.target.closest(".al");
  if (b) al(b.dataset.id);
};
