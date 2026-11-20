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

// Real vaxtda musiqi qoşulu deyilsə də oyunçuların düymələri görməsi üçün panel idarəsi
let aktivMusiqi = null; // sonrakı mərhələdə real vaxt (RTDB/Firestore) musiqi obyektinə bağlanacaq

function musiqiPanelYenile() {
  const mPanel = document.getElementById("musiqiPanel");
  if (!mPanel) return;
  mPanel.style.display = "flex";
  mPanel.classList.toggle("aktiv-calir", Boolean(aktivMusiqi));
}

function musiqiDüymeleriniBagla() {
  musiqiPanelYenile();
  const b1 = document.getElementById("musiqiBtn1");
  const b2 = document.getElementById("musiqiBtn2");
  if (b1) {
    b1.onclick = () => toast(
      aktivMusiqi
        ? "Musiqi qoşuludur"
        : "Hazırda masada musiqi qoşulu deyil — tezliklə qoşma paneli aktiv olacaq"
    );
  }
  if (b2) {
    b2.onclick = () => toast(
      aktivMusiqi
        ? "Musiqi siyahısı"
        : "Musiqi siyahısı tezliklə əlavə olunacaq"
    );
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", musiqiDüymeleriniBagla);
} else {
  musiqiDüymeleriniBagla();
}

if (cari && cari.docId) {
  onSnapshot(doc(fsdb, "users", cari.docId), (s) => {
    men = s.data();
    if (men && men.banned) {
      alert("Admin tərəfindən ban olunmusunuz!");
      localStorage.removeItem("currentUser");
      location.href = "index.html";
    }
  });
}

// Bütün oyuna məcburi yeniləmə (Force Reload) dinləyicisi
let ilkYenilemeYuklendi = false;
onValue(ref(rtdb, "sistem/yenileme"), (s) => {
  if (!ilkYenilemeYuklendi) {
    ilkYenilemeYuklendi = true;
    return;
  }
  if (s.exists()) {
    location.replace("oyun.html?masa=" + MASA_NOMRESI + "&v=" + Date.now());
  }
});

// Admin tərəfindən masadan atılma (Kick) dinləyicisi
if (cari && cari.docId) {
  onValue(ref(rtdb, `sistem/kick/${cari.docId}`), (s) => {
    if (s.exists() && s.val() > Date.now() - 10000) {
      alert("Admin tərəfindən masadan çıxarıldınız!");
      location.href = "profil.html";
    }
  });
}

const sekiller = {};
function sekil(uid) {
  if (!sekiller[uid]) sekiller[uid] = getDoc(doc(fsdb, "users", uid)).then((s) => (s.data() || {}).avatar || "").catch(() => "");
  return sekiller[uid];
}

onChildAdded(query(ref(rtdb, yol), limitToLast(50)), (s) => {
  const m = s.val();
  if (!m) return;
  const d = document.createElement("div");
  d.className = "mesaj";

  // Profilsiz "Admin" elanı və ya qovulma bildirişi (Ağ baloncuk içində tünd aydın yazı):
  if (m.isAdminBroadcast) {
    const yazilanSoz = m.metn || m.text || m.mesaj || "";
    const g = document.createElement("div");
    g.className = "mgovde";
    g.style.cssText = "background:#fffbeb; border:1.5px solid #f59e0b; border-radius:12px; padding:7px 12px; width:100%;";
    const a = document.createElement("span");
    a.className = "mad";
    a.style.cssText = "color:#dc2626; font-weight:800;";
    a.textContent = "🛡️ Admin: ";
    const t = document.createElement("span");
    t.style.cssText = "color:#111827; font-weight:700;";
    t.textContent = yazilanSoz;
    g.append(a, t);
    d.append(g);
    qutu.appendChild(d);
    while (qutu.children.length > 60) qutu.removeChild(qutu.firstChild);
    qutu.scrollTop = qutu.scrollHeight;
    return;
  }

  const f = document.createElement("div");
  f.className = "mfoto";
  f.style.backgroundImage = 'url("images/avatar/nophoto.svg")';
  if (m.uid) {
    sekil(m.uid).then((u) => { if (u) f.style.backgroundImage = `url("${u}")`; });
  }
  const g = document.createElement("div");
  g.className = "mgovde";
  const a = document.createElement("span");
  a.className = "mad";
  a.style.color = adRengi(m.cins, m.vip);
  a.textContent = (m.vip ? "👑 " : "") + m.ad + ": ";
  const t = document.createElement("span");
  t.textContent = m.metn;
  g.append(a, t);
  d.append(f, g);
  qutu.appendChild(d);
  while (qutu.children.length > 60) qutu.removeChild(qutu.firstChild);
  qutu.scrollTop = qutu.scrollHeight;
});

function gonder() {
  const metn = inp.value.trim();
  tanisYaz(metn, cari.docId);
  if (!metn || !men) return;

  if (men.mutedUntil && Number(men.mutedUntil) > Date.now()) {
    toast("Admin tərəfindən chatda susdurulmusunuz");
    return;
  }

  if (!vipMi(men) && /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(metn)) {
    toast("Smaylik göndərmək yalnız VIP üçündür");
    return;
  }
  inp.value = "";
  push(ref(rtdb, yol), {
    uid: cari.docId,
    ad: men.username,
    vip: vipMi(men),
    cins: cinsTap(men.gender),
    metn: metn.slice(0, 300),
    vaxt: serverTimestamp()
  });
}
document.getElementById("gonderBtn").onclick = gonder;
inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); gonder(); } });

"😀 😂 😍 😘 😎 🥰 😉 😢 😡 👍 🙏 🔥 ❤️ 💋 🍾 🎁".split(" ").forEach((e) => {
  const s = document.createElement("span");
  s.textContent = e;
  s.onclick = () => {
    if (!vipMi(men)) { toast("Smaylik göndərmək yalnız VIP üçündür"); return; }
    inp.value += e;
    inp.focus();
  };
  panel.appendChild(s);
});
document.getElementById("smayBtn").onclick = () => panel.classList.toggle("ac");

onValue(query(ref(rtdb, yol), limitToFirst(1)), (s) => { if (!s.exists()) qutu.innerHTML = ""; });
setTimeout(() => { const b = document.getElementById("musiqiBtn1"); if (b) b.onclick = () => window.MusiqiPanel.open(); }, 500);
