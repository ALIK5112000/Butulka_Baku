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

// Şəkil: toxunanda həmin oyunçunun profil kartı açılır (öz şəklin olsa öz kartın)
function fotoVer(f, uid) {
  f.style.backgroundImage = 'url("images/avatar/nophoto.svg")';
  if (uid) {
    f.dataset.uid = uid;
    f.style.cursor = "pointer";
    f.onclick = () => { if (window.ProfilKart) window.ProfilKart.ac(uid); };
    sekil(uid).then((u) => { if (u) f.style.backgroundImage = `url("${String(u).replace(/"/g, "%22")}")`; });
  }
}

// ---- Musiqi qoşana +9 xal: qoşma bildirişi gələndə (yalnız təzə bildirişə, bir dəfə) ----
const PUSH_CHARS = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
function pushVaxti(key) {
  let t = 0;
  for (let i = 0; i < 8; i++) t = t * 64 + PUSH_CHARS.indexOf(key.charAt(i));
  return t;
}
let serverOffset = 0;
onValue(ref(rtdb, ".info/serverTimeOffset"), (x) => { serverOffset = x.val() || 0; });

function musiqiXalVer(key) {
  if (!cari || !cari.docId || !window.Xallar) return;
  if (Date.now() + serverOffset - pushVaxti(key) > 30000) return; // köhnə bildiriş (səhifə yenilənəndə təkrar oxunur)
  let list = [];
  try { list = JSON.parse(localStorage.getItem("xalMusiqi") || "[]"); } catch (e) {}
  if (list.includes(key)) return;
  list.push(key);
  localStorage.setItem("xalMusiqi", JSON.stringify(list.slice(-50)));
  window.Xallar.musiqiQosdu(cari.docId);
  toast("+9 musiqi xalı");
}

onChildAdded(query(ref(rtdb, yol), limitToLast(50)), (s) => {
  const m = s.val();
  if (!m) return;
  const d = document.createElement("div");
  d.className = "mesaj";

  // Klip qoşulma bildirişi (bütün masada görünür): qoşan oyunçunun şəkli + klipin adı
  if (m.isMusicNotice) {
    window.__sonDJ = { uid: m.uid, key: s.key }; // hədiyyə xalı üçün: son musiqini kim qoşub
    if (cari && m.uid === cari.docId) musiqiXalVer(s.key);
    const f = document.createElement("div");
    f.className = "mfoto";
    fotoVer(f, m.uid);
    const g = document.createElement("div");
    g.className = "mgovde klip-bildiris";
    g.textContent = `🎵 ${m.ad} klip qoşdu: ${m.metn}`;
    d.append(f, g);
    qutu.appendChild(d);
    while (qutu.children.length > 60) qutu.removeChild(qutu.firstChild);
    qutu.scrollTop = qutu.scrollHeight;
    return;
  }

  // Məftun bildirişi: kim kimə məftun oldu / kim tərk etdi
  if (m.isMeftunNotice) {
    const f = document.createElement("div");
    f.className = "mfoto";
    fotoVer(f, m.uid);
    const g = document.createElement("div");
    g.className = "mgovde klip-bildiris";
    g.style.cssText = "background:#fff0f6;border-color:#f06aa8;";
    g.textContent = m.metn;
    d.append(f, g);
    qutu.appendChild(d);
    while (qutu.children.length > 60) qutu.removeChild(qutu.firstChild);
    qutu.scrollTop = qutu.scrollHeight;
    return;
  }

  // Profilsiz "Admin" elanı və ya qovulma bildirişi:
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
  fotoVer(f, m.uid);
  const g = document.createElement("div");
  g.className = "mgovde";
  const a = document.createElement("span");
  a.className = "mad";
  a.style.color = adRengi(m.cins, m.vip);
  a.textContent = (m.vip ? "👑 " : "") + m.ad + ": ";
  // Ada toxunanda yazı xanasına "Ad, " əlavə olunur (həmin oyunçuya müraciət üçün)
  if (!cari || m.uid !== cari.docId) {
    a.style.cursor = "pointer";
    a.onclick = () => {
      const mur = m.ad + ", ";
      if (!inp.value.startsWith(mur)) inp.value = mur + inp.value;
      inp.focus();
    };
  }
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
