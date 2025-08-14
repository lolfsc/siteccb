const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const path = require('path');

// Games storage
const games = new Map();

function generateGameCode() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
}

// Serve static files
app.use(express.static(__dirname));

// Redirect root to lobby.html
app.get('/', (req, res) => {
    res.redirect('/lobby.html');
});

// Socket.IO event handlers
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);    socket.on('createGame', (playerName) => {
        const gameCode = generateGameCode();
        games.set(gameCode, {
            host: socket.id,
            players: new Map([[socket.id, { name: playerName, score: 0, hasFinished: false }]])
        });
        
        socket.join(gameCode);
        socket.emit('gameCreated', {
            playerId: socket.id,
            gameCode: gameCode,
            players: Array.from(games.get(gameCode).players.values())
        });
        console.log(`${playerName} created game ${gameCode}`);
    });    socket.on('joinGame', ({playerName, gameCode}) => {
        const game = games.get(gameCode);
        if (!game) {
            socket.emit('error', 'Code de partie invalide');
            return;
        }

        // Vérifier si le pseudo est déjà utilisé
        const pseudoExists = Array.from(game.players.values()).some(player => 
            player.name.toLowerCase() === playerName.toLowerCase()
        );
        
        if (pseudoExists) {
            socket.emit('error', 'Ce pseudo est déjà utilisé dans cette partie');
            return;
        }

        // Ajouter le nouveau joueur avec son ID
        game.players.set(socket.id, { 
            id: socket.id,
            name: playerName, 
            score: 0, 
            hasFinished: false 
        });
        
        socket.join(gameCode);
        
        socket.emit('gameJoined', {
            playerId: socket.id,
            gameCode: gameCode,
            isHost: false,
            players: Array.from(game.players.values())
        });
        
        // Informer tous les joueurs de la mise à jour
        io.to(gameCode).emit('updatePlayers', {
            players: Array.from(game.players.values()),
            gameCode: gameCode
        });
        console.log(`${playerName} joined the game`);
    });

    socket.on('startGame', (gameCode) => {
        const game = games.get(gameCode);
        if (!game || game.host !== socket.id) {
            socket.emit('error', 'Vous n\'avez pas la permission de démarrer la partie');
            return;
        }
        
        io.to(gameCode).emit('gameStarted');
        console.log(`Game ${gameCode} started`);
    });

    socket.on('imitationComplete', (data) => {
        io.to('game').emit('playerFinished', data.playerId);
        // Check if all players finished
        const room = io.sockets.adapter.rooms.get('game');
        const finishedPlayers = new Set(); // In a real app, track this properly
        finishedPlayers.add(data.playerId);
        if (room && finishedPlayers.size === room.size) {
            io.to('game').emit('allPlayersFinished');
        }
    });

    socket.on('vote', (data) => {
        io.to('game').emit('voteRegistered', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    // Afficher les adresses IP disponibles
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    console.log('\nAdresses IP disponibles :');
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`- http://${net.address}:${PORT}`);
            }
        }
    }
});
