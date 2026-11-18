const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// 12 nəfərlik masa vəziyyəti
const MAX_SEATS = 12;
let room = {
  seats: Array(MAX_SEATS).fill(null),
  turnIndex: 0,
  phase: 'WAITING', // WAITING, SPIN_READY, SPINNING, KISS_DECISION
  targetIndex: null,
  spinnerChoice: null, // 'kiss' | 'skip' | null
  targetChoice: null,  // 'kiss' | 'skip' | null
  bottleAngle: 0,
  timer: null,
  timeLeft: 0
};

function getOccupiedIndices() {
  const list = [];
  room.seats.forEach((p, idx) => {
    if (p !== null) list.push(idx);
  });
  return list;
}

function broadcastState() {
  io.emit('room_state', {
    seats: room.seats,
    turnIndex: room.turnIndex,
    phase: room.phase,
    targetIndex: room.targetIndex,
    spinnerChoice: room.spinnerChoice,
    targetChoice: room.targetChoice,
    bottleAngle: room.bottleAngle,
    timeLeft: room.timeLeft
  });
}

function startCountdown(seconds, onComplete) {
  clearInterval(room.timer);
  room.timeLeft = seconds;
  broadcastState();

  room.timer = setInterval(() => {
    room.timeLeft -= 1;
    io.emit('timer_tick', room.timeLeft);
    if (room.timeLeft <= 0) {
      clearInterval(room.timer);
      onComplete();
    }
  }, 1000);
}

function nextTurn() {
  clearInterval(room.timer);
  room.targetIndex = null;
  room.spinnerChoice = null;
  room.targetChoice = null;

  const occupied = getOccupiedIndices();
  if (occupied.length < 2) {
    room.phase = 'WAITING';
    room.timeLeft = 0;
    broadcastState();
    return;
  }

  // Növbəti dolu oturacağı tap
  let nextIdx = (room.turnIndex + 1) % MAX_SEATS;
  for (let i = 0; i < MAX_SEATS; i++) {
    if (room.seats[nextIdx] !== null) {
      room.turnIndex = nextIdx;
      break;
    }
    nextIdx = (nextIdx + 1) % MAX_SEATS;
  }

  room.phase = 'SPIN_READY';
  // 10 saniyə ərzində fırlatmasa, sistem avtomatik fırladır
  startCountdown(10, () => {
    if (room.phase === 'SPIN_READY') {
      executeSpin();
    }
  });
}

function executeSpin() {
  const occupied = getOccupiedIndices().filter(idx => idx !== room.turnIndex);
  if (occupied.length === 0) {
    room.phase = 'WAITING';
    broadcastState();
    return;
  }

  clearInterval(room.timer);
  room.phase = 'SPINNING';

  // Təsadüfi hədəf seç (mümkünsə əks cinsə üstünlük ver, OK.ru məntiqi)
  const spinner = room.seats[room.turnIndex];
  const oppositeGender = occupied.filter(idx => room.seats[idx].gender !== spinner.gender);
  const pool = oppositeGender.length > 0 ? oppositeGender : occupied;
  const chosenTarget = pool[Math.floor(Math.random() * pool.length)];

  room.targetIndex = chosenTarget;

  // 12 yerlik dairədə hədəfin bucağı (0-cı yer yuxarı mərkəz -90 deg və ya 0 deg hesabı ilə)
  const targetBaseAngle = chosenTarget * (360 / MAX_SEATS);
  const extraSpins = 360 * (5 + Math.floor(Math.random() * 3)); // 5-7 tam dövrə
  const currentMod = room.bottleAngle % 360;
  const delta = (targetBaseAngle - currentMod + 360) % 360;
  room.bottleAngle += extraSpins + delta;

  io.emit('bottle_spun', {
    turnIndex: room.turnIndex,
    targetIndex: room.targetIndex,
    bottleAngle: room.bottleAngle
  });

  // 4 saniyə şüşə fırlanır, sonra öpüş qərarı mərhələsi açılır
  setTimeout(() => {
    if (!room.seats[room.turnIndex] || !room.seats[room.targetIndex]) {
      return nextTurn();
    }
    room.phase = 'KISS_DECISION';
    room.spinnerChoice = null;
    room.targetChoice = null;

    // 9 saniyə öpüş qərarı vaxtı (OK.ru standartı)
    startCountdown(9, () => {
      resolveKissDecision();
    });
  }, 4000);
}

function resolveKissDecision() {
  clearInterval(room.timer);
  const p1 = room.seats[room.turnIndex];
  const p2 = room.seats[room.targetIndex];

  if (p1 && p2 && room.spinnerChoice === 'kiss' && room.targetChoice === 'kiss') {
    p1.kisses += 1;
    p2.kisses += 1;
    io.emit('kiss_success', {
      fromIndex: room.turnIndex,
      toIndex: room.targetIndex,
      p1Name: p1.name,
      p2Name: p2.name
    });
    io.emit('chat_message', {
      system: true,
      text: `💋 ${p1.name} və ${p2.name} öpüşdülər!`
    });
  } else if (p1 && p2) {
    io.emit('kiss_failed', {
      fromIndex: room.turnIndex,
      toIndex: room.targetIndex
    });
  }

  setTimeout(() => {
    nextTurn();
  }, 2200);
}

io.on('connection', (socket) => {
  socket.on('join_table', (userData) => {
    const emptyIdx = room.seats.findIndex(s => s === null);
    if (emptyIdx === -1) {
      socket.emit('table_full');
      return;
    }

    const player = {
      id: socket.id,
      seatIndex: emptyIdx,
      name: (userData.name || 'Oyunçu').slice(0, 16),
      gender: userData.gender === 'female' ? 'female' : 'male',
      avatar: userData.avatar || (userData.gender === 'female'
        ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + socket.id + '&top=longHair'
        : 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + socket.id + '&top=shortHair'),
      kisses: 0,
      vip: Boolean(userData.vip)
    };

    room.seats[emptyIdx] = player;
    socket.emit('joined_success', { seatIndex: emptyIdx, player });

    io.emit('chat_message', {
      system: true,
      text: `✨ ${player.name} masaya əyləşdi.`
    });

    const occupied = getOccupiedIndices();
    if (occupied.length >= 2 && room.phase === 'WAITING') {
      room.turnIndex = occupied[0];
      room.phase = 'SPIN_READY';
      startCountdown(10, () => {
        if (room.phase === 'SPIN_READY') executeSpin();
      });
    } else {
      broadcastState();
    }
  });

  socket.on('spin_bottle', () => {
    const current = room.seats[room.turnIndex];
    if (current && current.id === socket.id && room.phase === 'SPIN_READY') {
      executeSpin();
    }
  });

  socket.on('kiss_action', (choice) => {
    if (room.phase !== 'KISS_DECISION') return;
    const spinner = room.seats[room.turnIndex];
    const target = room.seats[room.targetIndex];

    if (spinner && spinner.id === socket.id && !room.spinnerChoice) {
      room.spinnerChoice = choice === 'kiss' ? 'kiss' : 'skip';
    } else if (target && target.id === socket.id && !room.targetChoice) {
      room.targetChoice = choice === 'kiss' ? 'kiss' : 'skip';
    }

    broadcastState();

    // Hər ikisi qərarını verdisə dərhal nəticəni göstər
    if (room.spinnerChoice && room.targetChoice) {
      resolveKissDecision();
    }
  });

  socket.on('send_chat', (msg) => {
    const player = room.seats.find(p => p && p.id === socket.id);
    if (!player || !msg || !msg.trim()) return;
    io.emit('chat_message', {
      system: false,
      name: player.name,
      gender: player.gender,
      vip: player.vip,
      text: msg.trim().slice(0, 180)
    });
  });

  socket.on('disconnect', () => {
    const idx = room.seats.findIndex(p => p && p.id === socket.id);
    if (idx !== -1) {
      const leftPlayer = room.seats[idx];
      room.seats[idx] = null;
      io.emit('chat_message', {
        system: true,
        text: `🚪 ${leftPlayer.name} masadan ayrıldı.`
      });

      if (idx === room.turnIndex || idx === room.targetIndex) {
        nextTurn();
      } else {
        broadcastState();
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Butulka Baku serveri işləyir: http://localhost:${PORT}`);
});
