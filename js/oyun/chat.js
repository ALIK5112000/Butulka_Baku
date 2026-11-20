import { rtdb, fsdb } from "../core/firebase.js";
import { MASA_NOMRESI } from "../core/config.js";
import { cariOyuncu, cinsTap, vipMi, adRengi, toast } from "./yardimci.js";
import { tanisYaz } from "./dostlar.js";
import { ref, push, set, query, limitToLast, limitToFirst, onChildAdded, onValue, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { doc, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const cari = cariOyuncu();
const yol = `masalar/${MASA_NOMRESI}/chat`;
const klipYol = `masalar/${MASA_NOMRESI}/aktivKlip`;
const qutu = document.getElementById("mesajlar");
const inp = document.getElementById("mesajInput");
const panel = document.getElementById("smayPanel");
let men = null;

function musiqiPanelYenile(calir) {
  const mPanel = document.getElementById("musiqiPanel");
  if (!mPanel) return;
  mPanel.style.display = "flex";
  mPanel.classList.toggle("aktiv-calir", Boolean(calir));
}

function musiqiDüymeleriniBagla() {
  musiqiPanelYenile(false);
  const b1 = document.getElementById("musiqiBtn1");
  const b2 = document.getElementById("musiqiBtn2");
  if (b1) {
    b1.onclick = () => window.MusiqiPanel && window.MusiqiPanel.open("popular");
  }
  if (b2) {
    b2.onclick = () => window.MusiqiPanel && window.MusiqiPanel.open("search");
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

  // Klip qoşulma bildirişi (bütün masada görünür)
  if (m.isMusicNotice) {
    const g = document.createElement("div");
    g.className = "mgovde";
    g.style.cssText = "background:#f0fdf4; border:1px solid #86efac; border-radius:10px; padding:5px 10px; font-size:12px; color:#166534; font-weight:700;";
    g.textContent = `🎵 ${m.ad} klip qoşdu: ${m.metn}`;
    d.append(g);
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

// ==================== REAL-VAXT MASA KLİP KÖRPÜSÜ ====================
window.MusiqiFirebase = {
  // 9 bonus çıxıb klipi yalnız BU masaya (`masalar/${MASA_NOMRESI}/aktivKlip`) yazır
  async klipQos(clip, cost = 9) {
    if (!cari || !cari.docId) {
      toast("Oyunçu məlumatı tapılmadı");
      return false;
    }
    const uRef = doc(fsdb, "users", cari.docId);
    const uSnap = await getDoc(uRef);
    if (!uSnap.exists()) return false;

    const uData = uSnap.data();
    const field = uData.hearts !== undefined ? "hearts" : (uData.bonus !== undefined ? "bonus" : "balance");
    const balans = Number(uData[field] || 0);

    if (balans < cost) {
      toast(`Klip qoşmaq üçün minimum ${cost} bonus lazımdır!`);
      return false;
    }

    // Firestore-da 9 bonus çıx
    await updateDoc(uRef, { [field]: balans - cost });
    const urekEl = document.getElementById("urekSayi");
    if (urekEl) urekEl.textContent = String(balans - cost);

    const payload = {
      klipId: Date.now() + "_" + cari.docId,
      masa: String(MASA_NOMRESI),
      videoId: clip.videoId,
      title: clip.title,
      djUid: cari.docId,
      djAd: uData.username || "Oyunçu",
      djAvatar: uData.avatar || "images/avatar/nophoto.svg",
      startedAt: Date.now(),
      durationSec: Number(clip.durationSec || 240)
    };

    // Yalnız bu masanın RTDB yoluna yaz
    await set(ref(rtdb, klipYol), payload);

    // Chatda mahnının adını bütün masaya göstər
    await push(ref(rtdb, yol), {
      isMusicNotice: true,
      ad: payload.djAd,
      metn: clip.title,
      vaxt: serverTimestamp()
    });

    return true;
  },

  async klipBitir() {
    await set(ref(rtdb, klipYol), null).catch(() => {});
  }
};

// Yalnız cari masanın (`masalar/${MASA_NOMRESI}/aktivKlip`) klipini real-vaxt dinlə
onValue(ref(rtdb, klipYol), (snap) => {
  const data = snap.val();
  if (!data || !data.videoId) {
    musiqiPanelYenile(false);
    if (window.MusiqiPanel && typeof window.MusiqiPanel.stop === "function") {
      window.MusiqiPanel.stop();
    }
    return;
  }

  const kecenSaniye = Math.floor((Date.now() - Number(data.startedAt || Date.now())) / 1000);
  const muddet = Number(data.durationSec || 240);

  // Vaxtı artıq bitibsə göstərmə
  if (kecenSaniye >= muddet) {
    musiqiPanelYenile(false);
    if (window.MusiqiPanel && typeof window.MusiqiPanel.stop === "function") {
      window.MusiqiPanel.stop();
    }
    return;
  }

  musiqiPanelYenile(true);

  // Əgər djAvatar boşdursa Firestore-dan real profil şəklini gətir
  if (!data.djAvatar && data.djUid) {
    sekil(data.djUid).then((realAvatar) => {
      data.djAvatar = realAvatar || "images/avatar/nophoto.svg";
      if (window.MusiqiPanel && typeof window.MusiqiPanel.play === "function") {
        window.MusiqiPanel.play(data);
      }
    });
  } else {
    if (window.MusiqiPanel && typeof window.MusiqiPanel.play === "function") {
      window.MusiqiPanel.play(data);
    }
  }
});

// İkonları yenilə və #musiqiBtn1 / #musiqiBtn2 düymələrini MusiqiPanel-ə bağla
setTimeout(() => {
  const b1 = document.getElementById("musiqiBtn1");
  const b2 = document.getElementById("musiqiBtn2");
  if (b1) b1.onclick = () => window.MusiqiPanel && window.MusiqiPanel.open("popular");
  if (b2) b2.onclick = () => window.MusiqiPanel && window.MusiqiPanel.open("search");

  [["musiqiBtn1", "klip-ikon.png"], ["musiqiBtn2", "musiqi-ikon.png"]].forEach(([id, f]) => {
    const b = document.getElementById(id);
    if (b) b.innerHTML = '<img src="images/' + f + '" style="width:36px;height:36px;object-fit:contain">';
  });
}, 500);
