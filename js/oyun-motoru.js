// js/oyun-motoru.js
import {
  db, doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, where, onSnapshot,
  runTransaction, increment, serverTimestamp, arrayUnion, getDocs,
  getLocalSession, ensureGameProfile, isUserVip
} from "./firebase-config.js";
import { Sounds } from "./ses-effektleri.js";
import { initBottleSystem, renderBottleState } from "./butulka.js";
import { initChatAndClip } from "./chat-ve-klip.js";
import { openPlayerProfile, triggerKickAlert, renderSeatGiftDecorations } from "./profil-ve-hediyye.js";
import { initShopAndVip, startHourlyTimer } from "./magaza-ve-vip.js";
import { openRankingsModal, loadTop10Cache, isTop10User } from "./reytinqler.js";

export const GameState = {
  currentUser: null,
  currentTableId: "1",
  tableData: null,
  mySeatIndex: -1,
  top10Ids: new Set(),
  unsubTable: null,
  unsubUser: null,
  unsubKick: null,
  tableCooldownTimer: null,
  afkTimeout: null
};

export function getDisplayName(u) {
  return u?.username || u?.name || "Oyunçu";
}

export function getDisplayAvatar(u) {
  return u?.avatar || "https://cdn-icons-png.flaticon.com/512/149/149071.png";
}

export function getShortId(u) {
  return u?.id || "00000";
}

export function isFemaleGender(genderVal) {
  const g = String(genderVal || "").toLowerCase();
  return g === "qadın" || g === "qadin" || g === "female";
}

// Adın rəng sinfi (Top 10 Sarı, VIP Kişi Göy, VIP Qadın Qırmızı, Adi Kişi Mavi, Adi Qadın Rozuvu)
export function getNameColorClass(docId, userObj) {
  if (GameState.top10Ids.has(docId) || isTop10User(docId)) return "name-top10";
  const vip = isUserVip(userObj);
  const female = isFemaleGender(userObj?.gender);
  if (vip) return female ? "name-vip-female" : "name-vip-male";
  return female ? "name-female" : "name-male";
}

// OYUN BAŞLAYANDA SESSİYANI YOXLAYIR
async function bootGame() {
  const session = getLocalSession();
  if (!session) {
    window.location.href = "index.html";
    return;
  }

  let docId = session.docId;
  if (!docId && session.id) {
    const q = query(collection(db, "users"), where("id", "==", Number(session.id)));
    const snap = await getDocs(q);
    if (!snap.empty) {
      docId = snap.docs[0].id;
      session.docId = docId;
      localStorage.setItem("currentUser", JSON.stringify(session));
    }
  }

  if (!docId) {
    window.location.href = "index.html";
    return;
  }

  const profile = await ensureGameProfile(docId);
  if (!profile) {
    window.location.href = "index.html";
    return;
  }

  if (profile.blockedUntil && profile.blockedUntil > Date.now()) {
    alert("Hesabınız admin tərəfindən müvəqqəti bloklanıb!");
    window.location.href = "profil.html";
    return;
  }

  GameState.currentUser = profile;
  await loadTop10Cache();

  // Öz profilini real-time dinlə
  GameState.unsubUser = onSnapshot(doc(db, "users", docId), (snap) => {
    if (!snap.exists()) return;
    GameState.currentUser = { docId, ...snap.data() };

    if (GameState.currentUser.blockedUntil && GameState.currentUser.blockedUntil > Date.now()) {
      alert("Hesabınız admin tərəfindən bloklandı!");
      leaveCurrentTable().then(() => (window.location.href = "profil.html"));
      return;
    }

    updateTopBarUI();
    renderSeats();
  });

  listenForIncomingKicks(docId);

  initShopAndVip();
  startHourlyTimer();
  initBottleSystem();
  initChatAndClip();
  bindTopBarButtons();
  setupAfkAutoExit();

  const params = new URLSearchParams(window.location.search);
  const startTable = params.get("masa") || "1";
  await joinTable(startTable);
}

function updateTopBarUI() {
  const u = GameState.currentUser;
  if (!u) return;
  document.getElementById("ui-hearts-count").textContent = u.hearts ?? 0;
  document.getElementById("ui-table-number").textContent = GameState.currentTableId;
}

// MASAYA DAXİL OLMAQ (12 yer + Növbə sistemi)
export async function joinTable(tableId, enteredPassword = null) {
  tableId = String(tableId).trim() || "1";
  const me = GameState.currentUser;
  if (!me) return;

  const tableRef = doc(db, "tables", tableId);
  const snap = await getDoc(tableRef);

  if (!snap.exists()) {
    await setDoc(tableRef, {
      id: tableId,
      ownerDocId: null,
      ownerExpiresAt: 0,
      password: "",
      bottleType: "vip",
      seats: Array(12).fill(null),
      queue: [],
      spinState: { status: "idle" },
      activeClip: null,
      createdAt: serverTimestamp()
    });
  } else {
    const tData = snap.data();
    const isCustomActive = tData.ownerDocId && tData.ownerExpiresAt > Date.now();
    if (isCustomActive && tData.password && tData.ownerDocId !== me.docId) {
      if (enteredPassword !== tData.password) {
        openPasswordPromptModal(tableId);
        return;
      }
    }
  }

  if (GameState.currentTableId && GameState.currentTableId !== tableId && GameState.unsubTable) {
    await leaveCurrentTable();
  }

  GameState.currentTableId = tableId;
  document.getElementById("ui-table-number").textContent = tableId;
  startTableSwitchCooldown();

  await runTransaction(db, async (tx) => {
    const tSnap = await tx.get(tableRef);
    const data = tSnap.data();
    let seats = Array.isArray(data.seats) ? [...data.seats] : Array(12).fill(null);
    while (seats.length < 12) seats.push(null);
    let queue = Array.isArray(data.queue) ? [...data.queue] : [];

    const existingIdx = seats.findIndex((s) => s && s.docId === me.docId);
    const seatPayload = {
      docId: me.docId,
      id: getShortId(me),
      username: getDisplayName(me),
      avatar: getDisplayAvatar(me),
      gender: me.gender || "Kişi",
      vip: Boolean(me.vip),
      vipUntil: me.vipUntil || 0,
      tableKisses: existingIdx !== -1 ? (seats[existingIdx].tableKisses || 0) : 0,
      gifts: existingIdx !== -1 ? (seats[existingIdx].gifts || []) : [],
      activeSmaylik: null,
      joinedAt: Date.now()
    };

    if (existingIdx !== -1) {
      seats[existingIdx] = seatPayload;
      queue = queue.filter((q) => q !== me.docId);
    } else {
      const emptyIdx = seats.findIndex((s) => !s);
      if (emptyIdx !== -1) {
        seats[emptyIdx] = seatPayload;
        queue = queue.filter((q) => q !== me.docId);
      } else {
        if (!queue.includes(me.docId)) queue.push(me.docId);
      }
    }

    tx.update(tableRef, { seats, queue });
  });

  await updateDoc(doc(db, "users", me.docId), {
    recentTables: arrayUnion(tableId)
  });

  if (GameState.unsubTable) GameState.unsubTable();
  GameState.unsubTable = onSnapshot(tableRef, async (docSnap) => {
    if (!docSnap.exists()) return;
    GameState.tableData = docSnap.data();
    const seats = GameState.tableData.seats || [];
    const queue = GameState.tableData.queue || [];

    GameState.mySeatIndex = seats.findIndex((s) => s && s.docId === me.docId);

    if (GameState.mySeatIndex === -1) {
      const qPos = queue.indexOf(me.docId);
      if (qPos !== -1) {
        const hasEmpty = seats.some((s) => !s);
        if (hasEmpty && qPos === 0) {
          await joinTable(tableId, enteredPassword);
          return;
        }
        document.getElementById("queue-overlay").classList.remove("hidden");
        document.getElementById("queue-position-text").textContent = `Sən növbədə ${qPos + 1}-cisən`;
      }
    } else {
      document.getElementById("queue-overlay").classList.add("hidden");
    }

    const activeCount = seats.filter(Boolean).length;
    document.getElementById("online-count-badge").textContent = `Masada: ${activeCount}/12`;

    renderSeats();
    renderBottleState(GameState.tableData);
  });
}

// MASADAN ÇIXMAQ
export async function leaveCurrentTable() {
  const me = GameState.currentUser;
  const tableId = GameState.currentTableId;
  if (!me || !tableId) return;

  if (GameState.unsubTable) {
    GameState.unsubTable();
    GameState.unsubTable = null;
  }

  const tableRef = doc(db, "tables", tableId);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(tableRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const seats = (data.seats || []).map((s) => (s && s.docId === me.docId ? null : s));
      const queue = (data.queue || []).filter((id) => id !== me.docId);
      tx.update(tableRef, { seats, queue });
    });
  } catch (e) {
    console.warn("Masadan çıxış xətası:", e);
  }
}

// 12 OTURACAĞI EKRANA ÇƏKMƏK
export function renderSeats() {
  const container = document.getElementById("seats-layer");
  if (!container || !GameState.tableData) return;

  const seats = GameState.tableData.seats || [];
  const blockedList = GameState.currentUser?.blockedUsers || [];
  container.innerHTML = "";

  for (let i = 0; i < 12; i++) {
    const player = seats[i];
    const slot = document.createElement("div");
    slot.className = "seat-slot";
    slot.dataset.seat = i;

    if (!player) {
      slot.innerHTML = `<div class="seat-empty-box">+</div>`;
      slot.onclick = () => moveToEmptySeat(i);
    } else {
      const isBlocked = blockedList.includes(player.docId);
      const avatarSrc = isBlocked
        ? "https://cdn-icons-png.flaticon.com/512/1828/1828843.png"
        : player.avatar;
      const nameClass = getNameColorClass(player.docId, player);
      const kissBadge = player.tableKisses > 0
        ? `<span class="seat-kiss-badge">💋 ${player.tableKisses}</span>`
        : "";
      const smaylikPop = player.activeSmaylik
        ? `<div class="active-smaylik-pop">${player.activeSmaylik}</div>`
        : "";
      const giftHtml = renderSeatGiftDecorations(player.gifts || []);

      slot.innerHTML = `
        <div class="seat-avatar-wrap">
          <img class="player-pic" src="${avatarSrc}" alt="" />
          ${kissBadge}
          ${giftHtml}
          ${smaylikPop}
        </div>
        <span class="seat-name-tag ${nameClass}">${isBlocked ? "IGNORE" : player.username}</span>
      `;
      slot.onclick = () => openPlayerProfile(player.docId);
    }

    container.appendChild(slot);
  }
}

async function moveToEmptySeat(targetIdx) {
  const me = GameState.currentUser;
  if (!me || GameState.mySeatIndex === -1) return;

  const tableRef = doc(db, "tables", GameState.currentTableId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(tableRef);
    const seats = [...(snap.data().seats || [])];
    if (seats[targetIdx]) return;
    const myData = { ...seats[GameState.mySeatIndex], tableKisses: 0 };
    seats[GameState.mySeatIndex] = null;
    seats[targetIdx] = myData;
    tx.update(tableRef, { seats });
  });
}

function startTableSwitchCooldown() {
  const btn = document.getElementById("btn-change-table");
  const cdSpan = document.getElementById("ui-table-cooldown");
  if (GameState.tableCooldownTimer) clearInterval(GameState.tableCooldownTimer);

  let sec = 9;
  btn.disabled = true;
  btn.classList.add("disabled");
  cdSpan.textContent = sec;

  GameState.tableCooldownTimer = setInterval(() => {
    sec--;
    if (sec > 0) {
      cdSpan.textContent = sec;
    } else {
      clearInterval(GameState.tableCooldownTimer);
      btn.disabled = false;
      btn.classList.remove("disabled");
      cdSpan.textContent = "↻";
    }
  }, 1000);
}

function bindTopBarButtons() {
  document.getElementById("btn-change-table").onclick = () => openChangeTableModal();

  document.getElementById("btn-exit-game").onclick = async () => {
    await leaveCurrentTable();
    window.location.href = "profil.html";
  };

  document.getElementById("btn-leave-queue").onclick = async () => {
    document.getElementById("queue-overlay").classList.add("hidden");
    const randomNum = String(Math.floor(Math.random() * 20) + 1);
    await joinTable(randomNum);
  };

  document.getElementById("btn-menu").onclick = () => openMainMenuModal();
}

function openMainMenuModal() {
  const backdrop = document.getElementById("modal-backdrop");
  const box = document.getElementById("modal-container");
  backdrop.classList.remove("hidden");

  box.innerHTML = `
    <button class="modal-close-x" onclick="document.getElementById('modal-backdrop').classList.add('hidden')">✕</button>
    <div class="modal-header-title">Oyun Menyusu</div>
    <div style="padding:14px; display:flex; flex-direction:column; gap:10px;">
      <button id="menu-open-profile" class="btn-green-buy" style="background:#0284c7;">👤 Mənim Profilim & Smayliklər</button>
      <button id="menu-open-ratings" class="btn-green-buy" style="background:#eab308; color:#111;">🏆 Reytinqlər (Top 50)</button>
      <button id="menu-open-bottles" class="btn-green-buy" style="background:#f97316;">🍾 Butulka Seç (5 ❤️)</button>
    </div>
  `;

  document.getElementById("menu-open-profile").onclick = () => openPlayerProfile(GameState.currentUser.docId);
  document.getElementById("menu-open-ratings").onclick = () => openRankingsModal();
  document.getElementById("menu-open-bottles").onclick = () => openBottleSelectorModal();
}

function openBottleSelectorModal() {
  const box = document.getElementById("modal-container");
  const bottles = [
    { id: "vip", name: "VIP Şampan", icon: "🍾" },
    { id: "cola", name: "Kola Butulkası", icon: "🥤" },
    { id: "fanta", name: "Fanta Butulkası", icon: "🧃" },
    { id: "gold", name: "Qızıl Butulka", icon: "🏺" }
  ];

  box.innerHTML = `
    <button class="modal-close-x" onclick="document.getElementById('modal-backdrop').classList.add('hidden')">✕</button>
    <div class="modal-header-title">Masadakı Butulkanı Dəyiş</div>
    <div class="shop-grid">
      ${bottles.map((b) => `
        <div class="shop-card">
          <div style="font-size:38px;">${b.icon}</div>
          <div style="font-weight:800; margin:6px 0;">${b.name}</div>
          <button class="btn-green-buy select-bottle-btn" data-type="${b.id}">❤️ 5</button>
        </div>
      `).join("")}
    </div>
  `;

  box.querySelectorAll(".select-bottle-btn").forEach((btn) => {
    btn.onclick = async () => {
      const me = GameState.currentUser;
      if ((me.hearts || 0) < 5) {
        alert("Kifayət qədər ürəyiniz yoxdur!");
        return;
      }
      await updateDoc(doc(db, "users", me.docId), { hearts: increment(-5) });
      await updateDoc(doc(db, "tables", GameState.currentTableId), { bottleType: btn.dataset.type });
      Sounds.playBonus();
      document.getElementById("modal-backdrop").classList.add("hidden");
    };
  });
}

// MASA DƏYİŞ / AXTAR / MASA YARAT
export async function openChangeTableModal() {
  const backdrop = document.getElementById("modal-backdrop");
  const box = document.getElementById("modal-container");
  backdrop.classList.remove("hidden");

  const me = GameState.currentUser;
  const recentIds = (me.recentTables || []).slice(-6).reverse();

  let recentHtml = "";
  for (const tid of recentIds) {
    const tSnap = await getDoc(doc(db, "tables", String(tid)));
    if (!tSnap.exists()) continue;
    const td = tSnap.data();
    const seats = (td.seats || []).filter(Boolean);
    const boys = seats.filter((s) => !isFemaleGender(s.gender)).length;
    const girls = seats.filter((s) => isFemaleGender(s.gender)).length;
    const isLocked = td.ownerDocId && td.ownerExpiresAt > Date.now() && td.password;

    recentHtml += `
      <div class="list-row recent-table-row" data-tid="${tid}">
        <div class="list-row-left">
          <span style="font-size:22px;">🍾</span>
          <strong>${isLocked ? "🔒 " : ""}#${tid}</strong>
        </div>
        <div style="font-size:13px; color:#64748b; font-weight:700;">
          👦 ${boys} &nbsp; 👧 ${girls}
        </div>
      </div>
    `;
  }

  // Profil dostları + oyundakı tanışlar birləşdirilir
  const mergedMap = new Map();
  (me.friends || []).forEach((f) => {
    if (f.docId) mergedMap.set(f.docId, { docId: f.docId, username: f.username, avatar: f.avatar });
  });
  (me.contacts || []).forEach((c) => {
    if (c.docId) mergedMap.set(c.docId, { docId: c.docId, username: c.username, avatar: c.avatar });
  });
  const contacts = Array.from(mergedMap.values());

  let contactsHtml = contacts.length === 0
    ? `<p style="padding:10px 14px; font-size:12px; color:#94a3b8;">Hələ tanış siyahısı boşdur.</p>`
    : contacts.map((c) => `
      <div class="list-row" onclick="window.__openProf('${c.docId}')">
        <div class="list-row-left">
          <img src="${c.avatar || "https://cdn-icons-png.flaticon.com/512/149/149071.png"}" />
          <strong>${c.username}</strong>
        </div>
      </div>
    `).join("");

  window.__openProf = (dId) => openPlayerProfile(dId);

  box.innerHTML = `
    <button class="modal-close-x" onclick="document.getElementById('modal-backdrop').classList.add('hidden')">✕</button>
    <div class="modal-header-title">Masanı dəyiş</div>
    <div style="padding:12px 14px;">
      <label style="font-size:12px; color:#64748b; font-weight:700;">🔍 Masa axtar</label>
      <div style="display:flex; gap:6px; margin-top:4px;">
        <input id="input-search-table" type="number" placeholder="Masa nömrəsi, məs. 666" style="flex:1; padding:8px 10px; border:1px solid #cbd5e1; border-radius:10px;" />
        <button id="btn-search-table-go" style="background:#f59e0b; color:#fff; border:none; border-radius:10px; padding:0 16px; font-weight:800; cursor:pointer;">Get</button>
      </div>

      <button id="btn-random-table" style="width:100%; margin-top:10px; background:#f59e0b; color:#fff; border:none; border-radius:12px; padding:11px; font-weight:800; cursor:pointer;">
        Təsadüfi seçilmiş masa!
      </button>

      <button id="btn-open-create-table" style="width:100%; margin-top:8px; background:linear-gradient(90deg, #7c3aed, #db2777); color:#fff; border:none; border-radius:12px; padding:11px; font-weight:800; cursor:pointer;">
        👑 Masa yarat / Mənim masam
      </button>
    </div>

    <div style="padding:6px 14px; font-size:12px; font-weight:700; color:#94a3b8;">Dostlar və tanışlar</div>
    ${contactsHtml}

    <div style="padding:10px 14px 4px; font-size:12px; font-weight:700; color:#94a3b8;">Ən son baş çəkmiş olduğun masalar</div>
    ${recentHtml || `<p style="padding:10px 14px; font-size:12px; color:#94a3b8;">Tarixçə boşdur.</p>`}
  `;

  document.getElementById("btn-search-table-go").onclick = async () => {
    const val = document.getElementById("input-search-table").value.trim();
    if (!val) return;
    const checkSnap = await getDoc(doc(db, "tables", val));
    if (checkSnap.exists()) {
      const td = checkSnap.data();
      if (td.ownerDocId && td.ownerExpiresAt > Date.now() && td.password && td.ownerDocId !== me.docId) {
        alert("Bu nömrəli masa axtarışda tapılmadı (şəxsi kodlu masadır).");
        return;
      }
    }
    backdrop.classList.add("hidden");
    await joinTable(val);
  };

  document.getElementById("btn-random-table").onclick = async () => {
    const rand = String(Math.floor(Math.random() * 50) + 1);
    const checkSnap = await getDoc(doc(db, "tables", rand));
    if (checkSnap.exists() && checkSnap.data().password && checkSnap.data().ownerExpiresAt > Date.now()) {
      return document.getElementById("btn-random-table").click();
    }
    backdrop.classList.add("hidden");
    await joinTable(rand);
  };

  document.getElementById("btn-open-create-table").onclick = () => openCreateCustomTableModal();

  box.querySelectorAll(".recent-table-row").forEach((row) => {
    row.onclick = async () => {
      const tid = row.dataset.tid;
      backdrop.classList.add("hidden");
      await joinTable(tid);
    };
  });
}

function openPasswordPromptModal(tableId) {
  const backdrop = document.getElementById("modal-backdrop");
  const box = document.getElementById("modal-container");
  backdrop.classList.remove("hidden");

  box.innerHTML = `
    <button class="modal-close-x" onclick="document.getElementById('modal-backdrop').classList.add('hidden')">✕</button>
    <div style="padding:20px;">
      <h3>🔒 Masa #${tableId}</h3>
      <p style="font-size:13px; color:#64748b; margin:6px 0 12px;">Bu masa parolludur. Girmək üçün parolu yaz.</p>
      <input id="input-table-pass" type="text" placeholder="Parol" style="width:100%; padding:10px; border:1.5px solid #7c3aed; border-radius:10px;" />
      <div style="display:flex; gap:8px; margin-top:14px;">
        <button id="btn-submit-table-pass" style="flex:1; background:#7c3aed; color:#fff; border:none; border-radius:10px; padding:11px; font-weight:800; cursor:pointer;">Daxil ol</button>
        <button onclick="document.getElementById('modal-backdrop').classList.add('hidden')" style="background:#f1f5f9; border:none; border-radius:10px; padding:11px 16px; font-weight:700;">Ləğv et</button>
      </div>
    </div>
  `;

  document.getElementById("btn-submit-table-pass").onclick = async () => {
    const pass = document.getElementById("input-table-pass").value;
    backdrop.classList.add("hidden");
    await joinTable(tableId, pass);
  };
}

function openCreateCustomTableModal() {
  const box = document.getElementById("modal-container");
  const me = GameState.currentUser;

  box.innerHTML = `
    <button class="modal-close-x" onclick="document.getElementById('modal-backdrop').classList.add('hidden')">✕</button>
    <div style="padding:18px;">
      <h3 style="font-size:18px; margin-bottom:8px;">Masa yarat</h3>
      <p style="font-size:12.5px; color:#475569; line-height:1.45; margin-bottom:12px;">
        Öz masan: <strong>5000 🪙</strong>, 30 gün sənindir. Parol yazsan, masaya yalnız parolu bilənlər girə bilər.
        Sən masadan çıxsan da masa kilidli qalır (müddət bitənə qədər); 30 gün ərzində parolu istədiyin vaxt dəyişə və ya silə bilərsən.
        Müddət bitəndə masa adi masa olur. Jeton yalnız masa yarananda çıxılır.
      </p>

      <label style="font-size:12px; font-weight:700;">Masa nömrəsi</label>
      <input id="custom-table-num" type="number" min="1" max="999999" placeholder="Masa nömrəsi: 1-999999 (boş - avtomatik)" style="width:100%; padding:9px; border:1px solid #cbd5e1; border-radius:10px; margin:4px 0 10px;" />

      <label style="font-size:12px; font-weight:700;">Parol</label>
      <input id="custom-table-pass" type="text" placeholder="Parol (istəyə bağlı)" style="width:100%; padding:9px; border:1px solid #cbd5e1; border-radius:10px; margin:4px 0 14px;" />

      <div style="display:flex; gap:8px;">
        <button id="btn-confirm-create-table" style="flex:1; background:#7c3aed; color:#fff; border:none; border-radius:12px; padding:12px; font-weight:800; cursor:pointer;">
          Yarat • 5000 🪙
        </button>
        <button onclick="document.getElementById('modal-backdrop').classList.add('hidden')" style="background:#f1f5f9; border:none; border-radius:12px; padding:12px 16px; font-weight:700;">
          Ləğv et
        </button>
      </div>
    </div>
  `;

  document.getElementById("btn-confirm-create-table").onclick = async () => {
    if ((me.jetons || 0) < 5000) {
      alert("Profil balansınızda 5000 Jeton yoxdur!");
      return;
    }

    let numInput = document.getElementById("custom-table-num").value.trim();
    if (!numInput) {
      numInput = String(Math.floor(100 + Math.random() * 900000));
    }
    const passInput = document.getElementById("custom-table-pass").value.trim();

    const tRef = doc(db, "tables", numInput);
    const tSnap = await getDoc(tRef);
    if (tSnap.exists() && tSnap.data().ownerDocId && tSnap.data().ownerExpiresAt > Date.now()) {
      alert("Bu masa nömrəsi artıq alınıb! Başqa nömrə seçin.");
      return;
    }

    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    await updateDoc(doc(db, "users", me.docId), {
      jetons: increment(-5000),
      myCustomTableId: numInput
    });

    await setDoc(tRef, {
      id: numInput,
      ownerDocId: me.docId,
      ownerExpiresAt: Date.now() + thirtyDaysMs,
      password: passInput,
      bottleType: "vip",
      seats: Array(12).fill(null),
      queue: [],
      spinState: { status: "idle" },
      activeClip: null,
      createdAt: serverTimestamp()
    });

    Sounds.playBonus();
    document.getElementById("modal-backdrop").classList.add("hidden");
    await joinTable(numInput, passInput);
  };
}

function listenForIncomingKicks(myDocId) {
  const kickRef = doc(db, "kicks", myDocId);
  GameState.unsubKick = onSnapshot(kickRef, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.expiresAt > Date.now() && data.tableId === GameState.currentTableId) {
      triggerKickAlert(data);
    }
  });
}

function setupAfkAutoExit() {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      GameState.afkTimeout = setTimeout(async () => {
        await leaveCurrentTable();
        window.location.href = "profil.html";
      }, 60000);
    } else {
      if (GameState.afkTimeout) {
        clearTimeout(GameState.afkTimeout);
        GameState.afkTimeout = null;
      }
    }
  });

  window.addEventListener("beforeunload", () => {
    leaveCurrentTable();
  });
}

bootGame();

