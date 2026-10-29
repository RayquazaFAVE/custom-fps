const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;

// Serve your HTML, CSS, and JS game files
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Multiplayer logic
// Tracks every connected player and relays their state to the others.
const players = new Map();

io.on('connection', (socket) => {
    console.log(`A player connected: ${socket.id}`);

    const name = 'Operator ' + socket.id.slice(0, 4);
    players.set(socket.id, { name, weaponIndex: 0, kills: 0, health: 100, last: null });

    // Tell the new player who they are and how many are already here.
    socket.emit('hello', { id: socket.id, name, playerCount: players.size });

    // Send the new player a snapshot of everyone already connected.
    for (const [pid, p] of players) {
        if (pid === socket.id) continue;
        socket.emit('player:update', {
            id: pid,
            name: p.name,
            weaponIndex: p.weaponIndex,
            kills: p.kills,
            health: p.health,
            x: p.last ? p.last.x : undefined,
            y: p.last ? p.last.y : undefined,
            z: p.last ? p.last.z : undefined,
            rotY: p.last ? p.last.rotY : undefined,
            rotX: p.last ? p.last.rotX : undefined
        });
    }

    socket.broadcast.emit('player:join', { id: socket.id, name });

    socket.on('state', (state) => {
        const player = players.get(socket.id);
        if (!player) return;
        if (state.name) player.name = state.name;
        if (state.weaponIndex !== undefined) player.weaponIndex = state.weaponIndex;
        if (state.kills !== undefined) player.kills = state.kills;
        if (state.health !== undefined) player.health = state.health;
        player.last = {
            x: state.x, y: state.y, z: state.z,
            rotY: state.rotY, rotX: state.rotX
        };

        socket.broadcast.emit('player:update', {
            id: socket.id,
            name: player.name,
            x: state.x,
            y: state.y,
            z: state.z,
            rotY: state.rotY,
            rotX: state.rotX,
            weaponIndex: player.weaponIndex,
            kills: player.kills,
            health: player.health
        });
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        players.delete(socket.id);
        socket.broadcast.emit('player:leave', { id: socket.id });
    });
});

server.listen(PORT, () => {
    console.log(`Multiplayer server running on port ${PORT}`);
});
