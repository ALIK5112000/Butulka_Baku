import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
    query, where, orderBy, limit, onSnapshot, arrayUnion, increment
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAANVVrJKhZyaCErn8YFNVTUPF70A9xlmQ",
    authDomain: "butulka-baku-istifadeci-bazasi.firebaseapp.com",
    projectId: "butulka-baku-istifadeci-bazasi",
    storageBucket: "butulka-baku-istifadeci-bazasi.firebasestorage.app",
    messagingSenderId: "52438073026",
    appId: "1:52438073026:web:1c4a0a8d1fc1ce5f78455b"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

const DEFAULT_AVATAR = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
const TOTAL_SEATS = 12;

const GIFTS = [
    { id: "rose", icon: "🌹", name: "Qızılgül", price: 10, hearts: 1 },
    { id: "kiss", icon: "💋", name: "Ehtiraslı Öpüş", price: 25, hearts: 3 },
    { id: "cocktail", icon: "🍸", name: "Kokteyl", price: 50, hearts: 6 },
    { id: "teddy", icon: "🧸", name: "Ayıcıq", price: 100, hearts: 15 },
    { id: "ring", icon: "💍", name: "Üzük", price: 250, hearts: 40 },
    { id: "crown", icon: "👑", name: "Tac", price: 500, hearts: 90 },
    { id: "car", icon: "🏎️", name: "Sport Avto", price: 1000, hearts: 200 }
];

const sessionRaw = localStorage.getItem("currentUser");
if (!sessionRaw) {
    window.location.href = "index.html";
}
const sessionUser = JSON.parse(sessionRaw);

let myDocId = sessionUser.docId || null;
let myData = null;
let currentRoomId = localStorage.getItem("activeRoomId") || "masa_1";
let currentRoomData = null;
let unsubRoom = null;
let unsubChat = null;
let heartbeatTimer = null;
let lastHandledSpinId = null;
let selectedTargetUser = null;
let vipHoldInterval = null;

// ==========================================
// 1. BAŞLANĞIC VƏ İSTİFADƏÇİ SİNXRONİZASİYASI
// ==========================================
async function initGame() {
    try {
        if (!myDocId) {
            const q = query(collection(db, "users"), where("id", "==", sessionUser.id));
            const snap = await getDocs(q);
            if (!snap.empty) {
                myDocId = snap.docs[0].id;
                sessionUser.docId = myDocId;
                localStorage.setItem("currentUser", JSON.stringify(sessionUser));
            } else {
                window.location.href = "index.html";
                return;
            }
        }

        onSnapshot(doc(db, "users", myDocId), (snap) => {
            if (!snap.exists()) {
                localStorage.removeItem("currentUser");
                window.location.href = "index.html";
                return;
            }
            myData = snap.data();

            if (myData.blockedUntil && Number(myData.blockedUntil) > Date.now()) {
                alert("Hesabınız admin tərəfindən müvəqqəti bloklanıb!");
                window.location.href = "profil.html";
                return;
            }

            if ((myData.sessionVersion || 1) > (sessionUser.sessionVersion || 1)) {
                localStorage.removeItem("currentUser");
                window.location.href = "index.html";
                return;
            }

            updateTopHud();
        });

        renderGiftsGrid();
        await joinRoom(currentRoomId);
        startHeartbeat();
    } catch (err) {
        console.error("Oyun xətası:", err);
        alert("Bağlantı xətası: " + err.message);
    }
}

function isUserVip(userObj) {
    if (!userObj) return false;
    return Boolean(userObj.vip && (!userObj.vipUntil || Number(userObj.vipUntil) > Date.now()));
}

function getPlayerNameColor(userObj) {
    if (!isUserVip(userObj)) return "#ffffff";
    return userObj.gender === "Qadın" ? "#ff4d6d" : "#38bdf8";
}

function updateTopHud() {
    if (!myData) return;
    const jetonEl = document.getElementById("hudJetons");
    const heartEl = document.getElementById("hudHearts");
    const nameEl = document.getElementById("hudUsername");
    const avatarEl = document.getElementById("hudAvatar");

    if (jetonEl) jetonEl.textContent = myData.jetons || 0;
    if (heartEl) heartEl.textContent = myData.hearts || 0;
    if (nameEl) {
        nameEl.textContent = (isUserVip(myData) ? "👑 " : "") + myData.username;
        nameEl.style.color = getPlayerNameColor(myData);
    }
    if (avatarEl) avatarEl.src = myData.avatar || DEFAULT_AVATAR;
}

// ==========================================
// 2. MASA (OTAQ) İDARƏETMƏSİ VƏ 12 OTURACAQ
// ==========================================
window.joinRoom = async function(roomId) {
    currentRoomId = roomId;
    localStorage.setItem("activeRoomId", roomId);

    const roomLabel = document.getElementById("currentRoomName");
    if (roomLabel) {
        roomLabel.textContent = roomId.replace("masa_", "Masa #");
    }

    const roomRef = doc(db, "rooms", roomId);
    const snap = await getDoc(roomRef);

    if (!snap.exists()) {
        const emptySeats = {};
        for (let i = 0; i < TOTAL_SEATS; i++) {
            emptySeats[`seat_${i}`] = null;
        }
        await setDoc(roomRef, {
            name: roomId.replace("masa_", "Masa #"),
            seats: emptySeats,
            currentTurnId: null,
            spinState: null,
            updatedAt: Date.now()
        });
    }

    if (unsubRoom) unsubRoom();
    unsubRoom = onSnapshot(roomRef, (docSnap) => {
        if (!docSnap.exists()) return;
        currentRoomData = docSnap.data();
        cleanInactiveSeats(roomRef, currentRoomData);
        renderTableSeats(currentRoomData);
        handleSpinSync(currentRoomData);
    });

    listenRoomChat(roomId);
};

window.switchRoom = async function(newRoomId) {
    await leaveSeat(true);
    await joinRoom(newRoomId);
};

async function cleanInactiveSeats(roomRef, data) {
    if (!data || !data.seats) return;
    const now = Date.now();
    const updates = {};
    let hasChanges = false;

    for (let i = 0; i < TOTAL_SEATS; i++) {
        const seat = data.seats[`seat_${i}`];
        if (seat && seat.lastActive && now - seat.lastActive > 90000) {
            updates[`seats.seat_${i}`] = null;
            if (data.currentTurnId === seat.id) {
                updates.currentTurnId = null;
            }
            hasChanges = true;
        }
    }
    if (hasChanges) {
        await updateDoc(roomRef, updates);
    }
}

function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(async () => {
        if (!myData || !currentRoomData || !currentRoomData.seats) return;
        for (let i = 0; i < TOTAL_SEATS; i++) {
            const seat = currentRoomData.seats[`seat_${i}`];
            if (seat && seat.id === myData.id) {
                await updateDoc(doc(db, "rooms", currentRoomId), {
                    [`seats.seat_${i}.lastActive`]: Date.now(),
                    [`seats.seat_${i}.vip`]: isUserVip(myData),
                    [`seats.seat_${i}.avatar`]: myData.avatar || DEFAULT_AVATAR,
                    [`seats.seat_${i}.username`]: myData.username
                });
                break;
            }
        }
    }, 25000);
}

function renderTableSeats(data) {
    const ring = document.getElementById("seatsContainer");
    if (!ring) return;

    const seats = data.seats || {};
    let mySeatIndex = -1;
    let occupiedCount = 0;
    const seatedIds = [];

    for (let i = 0; i < TOTAL_SEATS; i++) {
        const p = seats[`seat_${i}`];
        if (p) {
            occupiedCount++;
            seatedIds.push(p.id);
            if (myData && p.id === myData.id) {
                mySeatIndex = i;
            }
        }
    }

    const onlineCountEl = document.getElementById("tableOnlineCount");
    if (onlineCountEl) onlineCountEl.textContent = `${occupiedCount} / ${TOTAL_SEATS}`;

    const leaveBtn = document.getElementById("leaveSeatBtn");
    if (leaveBtn) leaveBtn.style.display = mySeatIndex !== -1 ? "inline-flex" : "none";

    // Növbə masada olmayan birində qalıbsa sıfırla
    const activeTurnId = seatedIds.includes(data.currentTurnId) ? data.currentTurnId : null;

    let html = "";
    for (let i = 0; i < TOTAL_SEATS; i++) {
        const angleDeg = (i * (360 / TOTAL_SEATS)) - 90;
        const angleRad = (angleDeg * Math.PI) / 180;
        const radiusPercent = 42;
        const leftPct = 50 + radiusPercent * Math.cos(angleRad);
        const topPct = 50 + radiusPercent * Math.sin(angleRad);

        const player = seats[`seat_${i}`];
        if (player) {
            const vipActive = Boolean(player.vip);
            const nameColor = vipActive ? (player.gender === "Qadın" ? "#ff4d6d" : "#38bdf8") : "#f8fafc";
            const isTurn = activeTurnId === player.id;
            html += `
                <div class="seat-node occupied ${vipActive ? "vip-seat" : ""} ${isTurn ? "active-turn" : ""}"
                     style="left:${leftPct}%; top:${topPct}%;"
                     onclick="openSeatPlayerMenu(${i})">
                    <div class="seat-avatar-wrap">
                        <img src="${player.avatar || DEFAULT_AVATAR}" alt="${player.username}">
                        ${vipActive ? '<span class="seat-crown">👑</span>' : ''}
                    </div>
                    <div class="seat-name" style="color:${nameColor};">${player.username}</div>
                </div>
            `;
        } else {
            html += `
                <div class="seat-node empty"
                     style="left:${leftPct}%; top:${topPct}%;"
                     onclick="sitAtSeat(${i})">
                    <div class="seat-empty-circle">+</div>
                    <div class="seat-name" style="color:#64748b;">Boş</div>
                </div>
            `;
        }
    }
    ring.innerHTML = html;

    const spinBtn = document.getElementById("spinBottleBtn");
    if (spinBtn) {
        const isSpinning = data.spinState && data.spinState.status === "spinning";
        if (mySeatIndex === -1) {
            spinBtn.disabled = true;
            spinBtn.textContent = "Oturacaq seçin";
        } else if (occupiedCount < 2) {
            spinBtn.disabled = true;
            spinBtn.textContent = "Oyunçu gözlənilir...";
        } else if (isSpinning) {
            spinBtn.disabled = true;
            spinBtn.textContent = "Fırlanır...";
        } else if (activeTurnId && activeTurnId !== myData.id) {
            spinBtn.disabled = true;
            spinBtn.textContent = "Növbə gözlənilir";
        } else {
            spinBtn.disabled = false;
            spinBtn.textContent = "🍾 Şüşəni Fırlat";
        }
    }
}

window.sitAtSeat = async function(seatIndex) {
    if (!myData || !currentRoomData) return;

    const seats = currentRoomData.seats || {};
    if (seats[`seat_${seatIndex}`]) {
        return alert("Bu yer artıq tutulub!");
    }

    const updates = {};
    for (let i = 0; i < TOTAL_SEATS; i++) {
        if (seats[`seat_${i}`] && seats[`seat_${i}`].id === myData.id) {
            updates[`seats.seat_${i}`] = null;
        }
    }

    updates[`seats.seat_${seatIndex}`] = {
        docId: myDocId,
        id: myData.id,
        username: myData.username,
        avatar: myData.avatar || DEFAULT_AVATAR,
        gender: myData.gender || "Kişi",
        vip: isUserVip(myData),
        seatIndex: seatIndex,
        lastActive: Date.now()
    };

    if (!currentRoomData.currentTurnId) {
        updates.currentTurnId = myData.id;
    }

    await updateDoc(doc(db, "rooms", currentRoomId), updates);
    await postSystemMessage(`${myData.username} masaya əyləşdi.`);
};

window.leaveSeat = async function(silent = false) {
    if (!myData || !currentRoomData || !currentRoomData.seats) return;
    const updates = {};
    let wasSeated = false;

    for (let i = 0; i < TOTAL_SEATS; i++) {
        const s = currentRoomData.seats[`seat_${i}`];
        if (s && s.id === myData.id) {
            updates[`seats.seat_${i}`] = null;
            wasSeated = true;
        }
    }

    if (wasSeated) {
        if (currentRoomData.currentTurnId === myData.id) {
            updates.currentTurnId = null;
        }
        await updateDoc(doc(db, "rooms", currentRoomId), updates);
        if (!silent) {
            await postSystemMessage(`${myData.username} masadan qalxdı.`);
        }
    }
};

window.addEventListener("beforeunload", () => {
    leaveSeat(true);
});

// ==========================================
// 3. ŞÜŞƏNİN FIRLANMASI VƏ ÖPÜŞ / ÜRƏK SEÇİMİ
// ==========================================
window.spinBottle = async function() {
    if (!myData || !currentRoomData || !currentRoomData.seats) return;

    const occupied = [];
    let mySeat = null;

    for (let i = 0; i < TOTAL_SEATS; i++) {
        const s = currentRoomData.seats[`seat_${i}`];
        if (s) {
            occupied.push(s);
            if (s.id === myData.id) mySeat = s;
        }
    }

    if (!mySeat) return alert("Əvvəlcə boş bir oturacağa əyləşin!");
    const candidates = occupied.filter(p => p.id !== myData.id);
    if (candidates.length === 0) return alert("Masada ən azı 2 nəfər olmalıdır!");

    const oppositeGender = candidates.filter(p => p.gender !== myData.gender);
    const pool = oppositeGender.length > 0 ? oppositeGender : candidates;
    const target = pool[Math.floor(Math.random() * pool.length)];

    const targetAngle = (target.seatIndex * (360 / TOTAL_SEATS));
    const totalRotation = 1800 + targetAngle;
    const spinId = `${Date.now()}_${myData.id}`;

    await updateDoc(doc(db, "rooms", currentRoomId), {
        spinState: {
            spinId: spinId,
            status: "spinning",
            spinnerId: myData.id,
            spinnerDocId: myDocId,
            spinnerName: myData.username,
            spinnerAvatar: myData.avatar || DEFAULT_AVATAR,
            targetId: target.id,
            targetDocId: target.docId,
            targetName: target.username,
            targetAvatar: target.avatar || DEFAULT_AVATAR,
            angle: totalRotation,
            kissDecision: null,
            startedAt: Date.now()
        }
    });
};

function handleSpinSync(data) {
    const spin = data.spinState;
    if (!spin) return;

    const bottle = document.getElementById("bottleImg");
    if (bottle && spin.angle !== undefined) {
        bottle.style.transition = "transform 3.6s cubic-bezier(0.15, 0.85, 0.25, 1)";
        bottle.style.transform = `rotate(${spin.angle}deg)`;
    }

    if (spin.spinId !== lastHandledSpinId) {
        lastHandledSpinId = spin.spinId;

        setTimeout(async () => {
            showSpinResultModal(spin);
            if (myData && spin.spinnerId === myData.id && spin.status === "spinning") {
                await updateDoc(doc(db, "rooms", currentRoomId), {
                    "spinState.status": "deciding"
                });
            }
        }, 3700);
    }

    if (spin.kissDecision && spin.kissDecision.done && !spin.kissDecision.rendered) {
        spin.kissDecision.rendered = true;
        if (spin.kissDecision.accepted) {
            triggerFloatingEffect("💋❤️", `${spin.spinnerName} və ${spin.targetName} öpüşdü!`);
        } else {
            triggerFloatingEffect("💔", `${spin.spinnerName} imtina etdi.`);
        }
    }
}

function showSpinResultModal(spin) {
    const modal = document.getElementById("kissDecisionModal");
    if (!modal || !myData) return;

    const infoEl = document.getElementById("kissPairInfo");
    const actionsEl = document.getElementById("kissActionButtons");

    if (infoEl) {
        infoEl.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:center; gap:14px; margin:12px 0;">
                <img src="${spin.spinnerAvatar}" style="width:58px; height:58px; border-radius:50%; object-fit:cover; border:2px solid #818cf8;">
                <span style="font-size:26px;">🍾</span>
                <img src="${spin.targetAvatar}" style="width:58px; height:58px; border-radius:50%; object-fit:cover; border:2px solid #ec4899;">
            </div>
            <div style="font-size:15px; font-weight:700;">
                <span style="color:#818cf8;">${spin.spinnerName}</span> ➔ <span style="color:#ec4899;">${spin.targetName}</span>
            </div>
        `;
    }

    if (actionsEl) {
        if (spin.spinnerId === myData.id || spin.targetId === myData.id) {
            actionsEl.style.display = "flex";
        } else {
            actionsEl.style.display = "none";
        }
    }

    modal.classList.add("open");
    setTimeout(() => {
        modal.classList.remove("open");
    }, 6500);
}

window.sendKissChoice = async function(isAccepted) {
    const modal = document.getElementById("kissDecisionModal");
    if (modal) modal.classList.remove("open");

    if (!currentRoomData || !currentRoomData.spinState) return;
    const spin = currentRoomData.spinState;

    await updateDoc(doc(db, "rooms", currentRoomId), {
        "spinState.status": "finished",
        "spinState.kissDecision": {
            done: true,
            accepted: isAccepted,
            by: myData.username
        },
        currentTurnId: spin.targetId
    });

    if (isAccepted) {
        const receiverDocId = spin.spinnerId === myData.id ? spin.targetDocId : spin.spinnerDocId;
        if (receiverDocId) {
            await updateDoc(doc(db, "users", receiverDocId), {
                hearts: increment(1)
            });
        }
        await postSystemMessage(`💋 ${spin.spinnerName} və ${spin.targetName} öpüşdü! (+1 ❤️)`);
    } else {
        await postSystemMessage(`❌ ${myData.username} öpüşməkdən imtina etdi.`);
    }
};

// ==========================================
// 4. OYUNÇU PROFİL MENYUSU VƏ HƏDİYYƏLƏR
// ==========================================
window.openSeatPlayerMenu = function(seatIndex) {
    if (!currentRoomData || !currentRoomData.seats) return;
    const target = currentRoomData.seats[`seat_${seatIndex}`];
    if (!target || target.id === myData.id) return;

    selectedTargetUser = target;
    const modal = document.getElementById("playerActionModal");
    if (!modal) return;

    document.getElementById("targetPlayerAvatar").src = target.avatar || DEFAULT_AVATAR;
    document.getElementById("targetPlayerName").textContent = (target.vip ? "👑 " : "") + target.username;
    document.getElementById("targetPlayerId").textContent = `ID ${target.id}`;
    modal.classList.add("open");
};

window.sendFriendFromTable = async function() {
    if (!selectedTargetUser || !selectedTargetUser.docId) return;
    await updateDoc(doc(db, "users", selectedTargetUser.docId), {
        friendRequests: arrayUnion({
            docId: myDocId,
            id: myData.id,
            username: myData.username,
            avatar: myData.avatar || ""
        })
    });
    alert(`${selectedTargetUser.username} adlı oyunçuya dostluq sorğusu göndərildi!`);
};

function renderGiftsGrid() {
    const grid = document.getElementById("giftsGrid");
    if (!grid) return;

    grid.innerHTML = GIFTS.map(g => `
        <div class="gift-card"
             onpointerdown="startGiftHold('${g.id}')"
             onpointerup="stopGiftHold()"
             onpointerleave="stopGiftHold()">
            <div style="font-size:28px;">${g.icon}</div>
            <div style="font-size:12px; font-weight:700; margin-top:4px;">${g.name}</div>
            <div style="font-size:11px; color:#fbbf24;">${g.price} 🪙</div>
        </div>
    `).join("");
}

window.startGiftHold = function(giftId) {
    sendGift(giftId);
    if (isUserVip(myData)) {
        stopGiftHold();
        vipHoldInterval = setInterval(() => {
            sendGift(giftId);
        }, 450);
    }
};

window.stopGiftHold = function() {
    if (vipHoldInterval) {
        clearInterval(vipHoldInterval);
        vipHoldInterval = null;
    }
};

window.sendGift = async function(giftId) {
    if (!selectedTargetUser || !myData) {
        stopGiftHold();
        return alert("Əvvəlcə masadakı bir oyunçunu seçin!");
    }

    const gift = GIFTS.find(g => g.id === giftId);
    if (!gift) return;

    if ((myData.jetons || 0) < gift.price) {
        stopGiftHold();
        return alert("Balansınızda kifayət qədər jeton yoxdur!");
    }

    await updateDoc(doc(db, "users", myDocId), {
        jetons: increment(-gift.price)
    });

    if (selectedTargetUser.docId) {
        await updateDoc(doc(db, "users", selectedTargetUser.docId), {
            hearts: increment(gift.hearts)
        });
    }

    triggerFloatingEffect(gift.icon, `${myData.username} ➔ ${selectedTargetUser.username}: ${gift.name}`);
    await postSystemMessage(`🎁 ${myData.username} ➡️ ${selectedTargetUser.username} oyunçusuna ${gift.icon} ${gift.name} hədiyyə etdi!`);
};

function triggerFloatingEffect(emoji, caption) {
    const layer = document.getElementById("effectsLayer");
    if (!layer) return;

    const item = document.createElement("div");
    item.className = "floating-effect";
    item.innerHTML = `<div style="font-size:44px;">${emoji}</div><div style="font-size:12px; font-weight:700;">${caption}</div>`;
    layer.appendChild(item);

    setTimeout(() => {
        item.remove();
    }, 2600);
}

// ==========================================
// 5. CANLI MASA ÇATI
// ==========================================
function listenRoomChat(roomId) {
    if (unsubChat) unsubChat();
    const q = query(
        collection(db, "rooms", roomId, "chat"),
        orderBy("createdAt", "desc"),
        limit(35)
    );

    unsubChat = onSnapshot(q, (snap) => {
        const box = document.getElementById("tableChatBox");
        if (!box) return;

        const items = [];
        snap.forEach(d => items.push(d.data()));
        items.reverse();

        box.innerHTML = items.map(m => {
            if (m.system) {
                return `<div class="chat-sys">${m.text}</div>`;
            }
            const nameColor = m.vip ? (m.gender === "Qadın" ? "#ff4d6d" : "#38bdf8") : "#a5b4fc";
            return `
                <div class="chat-line">
                    <span style="font-weight:700; color:${nameColor};">${m.vip ? "👑 " : ""}${m.senderName}:</span>
                    <span>${m.text}</span>
                </div>
            `;
        }).join("");

        box.scrollTop = box.scrollHeight;
    });
}

window.sendTableChat = async function() {
    const input = document.getElementById("tableChatInput");
    if (!input || !myData) return;
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    await addDoc(collection(db, "rooms", currentRoomId, "chat"), {
        senderId: myData.id,
        senderName: myData.username,
        gender: myData.gender || "Kişi",
        vip: isUserVip(myData),
        text: text,
        system: false,
        createdAt: Date.now()
    });
};

async function postSystemMessage(text) {
    await addDoc(collection(db, "rooms", currentRoomId, "chat"), {
        text: text,
        system: true,
        createdAt: Date.now()
    });
}

initGame();
