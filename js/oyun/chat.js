import { rtdb, fsdb } from "../core/firebase.js";
import { MASA_NOMRESI } from "../core/config.js";
import { cariOyuncu, cinsTap, vipMi, adRengi, toast } from "./yardimci.js";
import { tanisYaz } from "./dostlar.js";
import { ref, push, query, limitToLast, limitToFirst, onChildAdded, onValue, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const cari = cariOyuncu();
const yol = `masalar/${MASA_NOMRESI}/chat`;
const qutu = document.getElementById("mesajlar");
const inp = document.getElementById("mesajInput");
const panel = document.getElementById("smayPanel");
let men = null;

if (cari && cari.docId) onSnapshot(doc(fsdb, "users", cari.docId), (s) => { men = s.data(); });

const sekiller = {};
function sekil(uid) {
  if (!sekiller[uid]) sekiller[uid] = getDoc(doc(fsdb, "users", uid)).then((s) => (s.data() || {}).avatar || "").catch(() => "");
  return sekiller[uid];
}

onChildAdded(query(ref(rtdb, yol), limitToLast(50)), (s) => {
  const m = s.val();
  const d = document.createElement("div"); d.className = "mesaj";
  const f = document.createElement("div"); f.className = "mfoto";
  f.style.backgroundImage = 'url("images/avatar/nophoto.svg")';
  sekil(m.uid).then((u) => { if (u) f.style.backgroundImage = `url("${u}")`; });
  const g = document.createElement("div"); g.className = "mgovde";
  const a = document.createElement("span"); a.className = "mad";
  a.style.color = adRengi(m.cins, m.vip);
  a.textContent = (m.vip ? "👑 " : "") + m.ad + ": ";
  const t = document.createElement("span"); t.textContent = m.metn;
  g.append(a, t); d.append(f, g); qutu.appendChild(d);
  while (qutu.children.length > 60) qutu.removeChild(qutu.firstChild);
  qutu.scrollTop = qutu.scrollHeight;
});

function gonder() {
  const metn = inp.value.trim();
  tanisYaz(metn, cari.docId);
  if (!metn || !men) return;
  if (!vipMi(men) && /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(metn)) {
    toast("Smaylik göndərmək yalnız VIP üçündür");
    return;
  }
  inp.value = "";
  push(ref(rtdb, yol), {
    uid: cari.docId, ad: men.username, vip: vipMi(men),
    cins: cinsTap(men.gender), metn: metn.slice(0, 300), vaxt: serverTimestamp()
  });
}
document.getElementById("gonderBtn").onclick = gonder;
inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); gonder(); } });

"😀 😂 😍 😘 😎 🥰 😉 😢 😡 👍 🙏 🔥 ❤️ 💋 🍾 🎁".split(" ").forEach((e) => {
  const s = document.createElement("span"); s.textContent = e;
  s.onclick = () => {
    if (!vipMi(men)) { toast("Smaylik göndərmək yalnız VIP üçündür"); return; }
    inp.value += e; inp.focus();
  };
  panel.appendChild(s);
});
document.getElementById("smayBtn").onclick = () => panel.classList.toggle("ac");
