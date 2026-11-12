const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname)));

// Masalar və Otaqlar bazası
let tables = {
    "511": { 
        id: "511",
        players: {},
        bottleAngle: 0,
        isSpinning: false
    }
};

io.on('connection', (socket) => {
    console.log('🔗 Yeni oyunçu qoşuldu:', socket.id);

    // Masaya qoşulma
    socket.on('join_table', (data) => {
        const { tableId, user } = data;
        socket.join(tableId);
        socket.tableId = tableId;

        let table = tables[tableId] || { id: tableId, players: {}, bottleAngle: 0, isSpinning: false };
        tables[tableId] = table;

        // 12 stuldan boş olanı tapırıq
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

        // Masadakı hər kəsə yenilənmiş məlumatı göndəririk
        io.to(tableId).emit('update_table', table);
    });

    // Butulkanın fırladılması məntiqi
    socket.on('spin_bottle', (tableId) => {
        let table = tables[tableId];
        if (table && !table.isSpinning) {
            table.isSpinning = true;
            // Təsadüfi fırlanma bucağı (çoxlu dövrə + random dərəcə)
            let randomRotation = table.bottleAngle + 1800 + Math.floor(Math.random() * 360);
            table.bottleAngle = randomRotation;

            io.to(tableId).emit('bottle_spinning', {
                rotation: randomRotation,
                spinningPlayer: socket.id
            });

            // 3 saniyə sonra fırlanma bitir
            setTimeout(() => {
                table.isSpinning = false;
                io.to(tableId).emit('bottle_stopped', table.bottleAngle);
            }, 3000);
        }
    });

    // Canlı çat
    socket.on('send_chat', (data) => {
        io.to(data.tableId).emit('new_chat', data);
    });

    // Oyunçu çıxan və ya səhifəni bağlayan kimi ANINDA masadan silinməsi
    socket.on('disconnect', () => {
        if (socket.tableId && tables[socket.tableId]) {
            let table = tables[socket.tableId];
            if (table.players[socket.id]) {
                delete table.players[socket.id];
                io.to(socket.tableId).emit('update_table', table);
            }
        }
        console.log('❌ Oyunçu ayrıldı:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Orijinal Butulka Baku serveri işləyir, port: ${PORT}`);
});
