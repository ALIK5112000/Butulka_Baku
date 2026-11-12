const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname)));

let tables = {
    "511": { players: {} }
};

io.on('connection', (socket) => {
    console.log('Yeni oyunçu qoşuldu:', socket.id);

    socket.on('join_table', (data) => {
        const { tableId, user } = data;
        socket.join(tableId);
        socket.tableId = tableId;

        let table = tables[tableId] || { players: {} };
        tables[tableId] = table;

        let usedSeats = Object.values(table.players).map(p => p.seatIndex);
        let emptySeat = -1;
        for (let i = 0; i < 12; i++) {
            if (!usedSeats.includes(i)) {
                emptySeat = i;
                break;
            }
        }

        if (emptySeat !== -1) {
            socket.seatIndex = emptySeat;
            table.players[socket.id] = {
                id: user.id,
                username: user.username,
                avatar: user.avatar || "https://cdn-icons-png.flaticon.com/512/149/149071.png",
                gender: user.gender || "Kişi",
                vip: user.vip || false,
                seatIndex: emptySeat
            };
        }

        io.to(tableId).emit('update_table', table);
    });

    socket.on('spin_bottle', (tableId) => {
        let randomRotation = 1440 + Math.floor(Math.random() * 360);
        io.to(tableId).emit('bottle_spinning', randomRotation);
    });

    socket.on('send_chat', (data) => {
        io.to(data.tableId).emit('new_chat', data);
    });

    // Kimsə çıxan kimi VƏ YA SƏHİFƏNİ BAĞLAYAN KİMİ anında masadan silinir!
    socket.on('disconnect', () => {
        if (socket.tableId && tables[socket.tableId]) {
            let table = tables[socket.tableId];
            if (table.players[socket.id]) {
                delete table.players[socket.id];
                io.to(socket.tableId).emit('update_table', table);
            }
        }
        console.log('Oyunçu masadan ayrıldı:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server işləyir, port: ${PORT}`);
});
