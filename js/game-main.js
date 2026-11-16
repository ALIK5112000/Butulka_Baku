// Hər şeyi birləşdirir: istifadəçi → masa → çat → ekran
import { CONFIG } from "./game-config.js";
import { getSession, isVip, isBlocked, watchMe } from "./game-user.js";
import * as Table from "./game-table.js";
import * as Chat from "./game-chat.js";

const $ = id => document.getElementById(id);
const session = getSession();

if (!session) {
  location.replace(CONFIG.loginPage);
} else if (!session.docId) {
  location.replace(CONFIG.profilePage);
} else {
  start();
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 2400);
}

function start() {
  let myId = null, started = false, busy = false;
  const seatEls = [];

  // Fon və butulka şəkilləri (ayarlarda yazılıbsa)
  if (CONFIG.tableBackground) $("stage").style.backgroundImage = `url("${CONFIG.tableBackground}")`;
  if (CONFIG.bottleImage) $("bottle").innerHTML = `<img src="${CONFIG.bottleImage}" alt="">`;

  // 12 yeri masa ətrafında düz
  const box = $("seats");
  const n = CONFIG.seatsPerTable;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2 + Math.PI / n;
    const el = document.createElement("div");
    el.className = "seat empty";
    el.style.left = (50 + CONFIG.ring.x * Math.cos(a)) + "%";
    el.style.top = (50 + CONFIG.ring.y * Math.sin(a)) + "%";
    el.innerHTML = `<div class="seat-photo"><img alt=""></div><div class="seat-name"></div>`;
    box.appendChild(el);
    seatEls.push(el);
  }

  function renderSeats(list) {
    const bySeat = new Map(list.map(s => [s.seat, s]));
    seatEls.forEach((el, i) => {
      const s = bySeat.get(i);
      const img = el.querySelector("img"), nm = el.querySelector(".seat-name");
      if (!s) {
        el.className = "seat empty";
        el.dataset.uid = "";
        img.removeAttribute("src");
        nm.textContent = "";
        return;
      }
      el.className = "seat" + (s.uid === myId ? " me" : "") + (s.vip ? " vip" : "");
      nm.textContent = (s.vip ? "👑 " : "") + s.name;
      nm.style.color = s.vip ? (CONFIG.vipColors[s.gender] || "#f59e0b") : "";
      if (el.dataset.uid !== String(s.uid)) {
        el.dataset.uid = String(s.uid);
        img.src = CONFIG.defaultAvatar;
        Table.getAvatar(s.docId).then(url => { if (el.dataset.uid === String(s.uid)) img.src = url; });
      }
    });

    // Gözləmə yazısı
    const girls = list.filter(s => s.gender === "Qadın").length;
    const boys = list.length - girls;
    const w = $("waiting");
    let txt = "";
    if (list.length < 2) txt = CONFIG.texts.waitPlayers;
    else if (girls === 0) txt = CONFIG.texts.waitGirls;
    else if (boys === 0) txt = CONFIG.texts.waitBoys;
    w.textContent = txt;
    w.hidden = !txt;
  }

  Chat.init(toast);

  Table.on("joined", cur => {
    $("tableLabel").textContent = "Masa " + cur.table;
    Chat.open(cur.table, cur.joinedAt);
  });
  Table.on("seats", renderSeats);
  Table.on("failed", () => toast(CONFIG.texts.noTable));
  Table.on("lost", () => toast(CONFIG.texts.rejoining));

  // İstifadəçi məlumatı real vaxtda (jeton, VIP, blok və s.)
  watchMe(session.docId, data => {
    if (!data) { localStorage.removeItem("currentUser"); location.replace(CONFIG.loginPage); return; }
    if (isBlocked(data)) { alert(CONFIG.texts.blocked); location.replace(CONFIG.profilePage); return; }
    if ((data.sessionVersion || 1) > (session.sessionVersion || 1)) {
      localStorage.removeItem("currentUser");
      location.replace(CONFIG.loginPage);
      return;
    }
    myId = data.id;
    const info = { id: data.id, docId: session.docId, name: data.username, gender: data.gender || "Kişi", vip: isVip(data) };
    Table.setMe(info);
    Chat.setMe(info);
    $("heartCount").textContent = data.hearts || 0;
    if (!started) { started = true; Table.enter(); }
  });

  $("changeBtn").addEventListener("click", async () => {
    if (busy) return;
    busy = true; $("changeBtn").disabled = true;
    await Table.change();
    busy = false; $("changeBtn").disabled = false;
  });

  $("exitBtn").addEventListener("click", async () => {
    await Table.leave();
    location.href = CONFIG.exitPage;
  });

  window.addEventListener("pagehide", () => { Table.leave(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) Table.resync(); });
}
