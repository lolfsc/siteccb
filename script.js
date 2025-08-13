// script.js
// Toutes les fonctions JS du jeu d'imitation

// Variables globales
let mediaRecorder = null;
let audioChunks = [];
let imitationBlob = null;
let imitationBuffer = null;
let phase1Stream = null;
let waveImage = null;

// Variables multijoueur
let isHost = false;
let playerId = null;
let playerName = '';
let gameCode = null;
let players = new Map(); // Map des joueurs {id: {name, score, imitation, hasFinished}}
let currentPlayingIndex = -1;
let votingEnabled = true;
let gameState = 'lobby'; // 'lobby', 'playing', 'waiting', 'voting', 'results'

// PHASE SWITCH
const phase1 = document.getElementById('phase1');
const phase2 = document.getElementById('phase2');
const continueBtn = document.getElementById('continueBtn');
const previewVideo = document.getElementById('previewVideo');
const gameVideo = document.getElementById('gameVideo');
const recordBtn = document.getElementById('recordBtn');
const validateBtn = document.getElementById('validateBtn');
const playbackSection = document.getElementById('playbackSection');
const previewGameVideo = document.getElementById('previewGameVideo');
const soundwavePlayback = document.getElementById('soundwavePlayback');
const submitBtn = document.getElementById('submitBtn');
const soundwavePreview = document.getElementById('soundwavePreview');
const soundwaveGame = document.getElementById('soundwaveGame');
const soundwaveRecord = document.getElementById('soundwaveRecord');
const progressBarPreview = document.getElementById('progressBarPreview');
const waveformCanvas = document.getElementById('waveformCanvas');

// Barre blanche synchronisée avec la vidéo
function syncProgressBar(video, bar) {
    if (!bar) return;
    function updateBar() {
        const percent = (video.currentTime / video.duration) * 100;
        bar.style.width = percent + '%';
        if (!video.paused && !video.ended) {
            requestAnimationFrame(updateBar);
        }
    }
    updateBar();
}

previewVideo.addEventListener('play', () => {
    syncProgressBar(previewVideo, progressBarPreview);
});
previewVideo.addEventListener('seeked', () => {
    syncProgressBar(previewVideo, progressBarPreview);
});
previewVideo.addEventListener('pause', () => {
    syncProgressBar(previewVideo, progressBarPreview);
});

// Charger l'image wave.png une seule fois
function loadWaveImage() {
    if (!waveImage) {
        waveImage = new Image();
        waveImage.src = 'wave.png';
        return new Promise((resolve) => {
            waveImage.onload = () => resolve();
        });
    }
    return Promise.resolve();
}

// Affichage du wave fixe et barre de progression
function drawWaveImage() {
    if (!waveformCanvas || !waveImage) return;
    const ctx = waveformCanvas.getContext('2d');
    ctx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    
    // Dessiner l'image
    ctx.drawImage(waveImage, 0, 0, waveformCanvas.width, waveformCanvas.height);
    
    // Barre blanche synchronisée
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const percent = (previewVideo.currentTime / previewVideo.duration) || 0;
    ctx.fillRect(0, 0, waveformCanvas.width * percent, waveformCanvas.height);
}

// Charger l'image au démarrage
loadWaveImage();

previewVideo.addEventListener('play', () => {
    loadWaveImage().then(() => {
        function animate() {
            drawWaveImage();
            if (!previewVideo.paused && !previewVideo.ended) {
                requestAnimationFrame(animate);
            }
        }
        animate();
    });
});

previewVideo.addEventListener('timeupdate', drawWaveImage);
previewVideo.addEventListener('seeked', drawWaveImage);
previewVideo.addEventListener('pause', drawWaveImage);

// ENREGISTREMENT
const stopBtn = document.createElement('button');
stopBtn.textContent = 'Arrêter';
stopBtn.style.display = 'none';
stopBtn.style.padding = '10px 24px';
stopBtn.style.background = '#ff4f4f';
stopBtn.style.color = '#fff';
stopBtn.style.border = 'none';
stopBtn.style.borderRadius = '6px';
stopBtn.style.cursor = 'pointer';
stopBtn.style.fontSize = '16px';
stopBtn.style.marginTop = '8px';
recordBtn.parentNode.insertBefore(stopBtn, recordBtn.nextSibling);

recordBtn.onclick = async () => {    recordBtn.disabled = true;
    recordBtn.style.display = 'none';
    stopBtn.style.display = 'inline-block';
    audioChunks = [];
    
    // S'assurer que l'image est chargée
    await loadWaveImage();
    
    // Fonction d'animation pour le wave pendant l'enregistrement
    function animateGameWave() {
        if (!waveformCanvas || !waveImage) return;
        const ctx = waveformCanvas.getContext('2d');
        ctx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
        
        // Dessiner l'image wave.png
        ctx.drawImage(waveImage, 0, 0, waveformCanvas.width, waveformCanvas.height);
        
        // Barre blanche synchronisée avec gameVideo
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        const percent = (gameVideo.currentTime / gameVideo.duration) || 0;
        ctx.fillRect(0, 0, waveformCanvas.width * percent, waveformCanvas.height);
        
        if (!gameVideo.paused && !gameVideo.ended) {
            requestAnimationFrame(animateGameWave);
        }
    }
    
    // Configuration initiale de l'affichage
    waveformCanvas.style.opacity = 1;
    previewVideo.style.display = 'none';
    gameVideo.style.display = 'block';
    
    // Démarrer la vidéo et l'animation
    gameVideo.muted = true;
    gameVideo.currentTime = 0;
    
    // Gestionnaires d'événements pour l'animation
    function startAnimation() {
        animateGameWave();
    }
    
    gameVideo.addEventListener('play', startAnimation);
    gameVideo.addEventListener('seeked', animateGameWave);
    gameVideo.addEventListener('pause', animateGameWave);
    
    // Lancer la lecture
    gameVideo.play();
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
    mediaRecorder.ondataavailable = e => {
        audioChunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
        recordBtn.disabled = false;
        stopBtn.style.display = 'none';
        imitationBlob = new Blob(audioChunks, { type: 'audio/webm' });
        validateBtn.style.display = 'none';
        soundwaveGame.innerHTML = '';
        waveformCanvas.style.opacity = 0.3;
        gameVideo.pause();
        
        // Affichage du player audio stylé + boutons
        const playerDiv = document.createElement('div');
        playerDiv.style.background = '#7a8cff22';
        playerDiv.style.borderRadius = '12px';
        playerDiv.style.padding = '18px 24px';
        playerDiv.style.display = 'flex';
        playerDiv.style.alignItems = 'center';
        playerDiv.style.gap = '18px';
        playerDiv.style.marginTop = '18px';
        
        // Waveform imitation
        const imitationWave = document.createElement('canvas');
        imitationWave.width = 320;
        imitationWave.height = 48;
        drawAudioWave(imitationBlob, imitationWave);
        playerDiv.appendChild(imitationWave);
        
        // Audio player
        const audioPlayer = document.createElement('audio');
        audioPlayer.controls = true;
        audioPlayer.src = URL.createObjectURL(imitationBlob);
        audioPlayer.style.flex = '1';
        audioPlayer.style.background = '#b3c7ff';
        audioPlayer.style.borderRadius = '8px';
        playerDiv.appendChild(audioPlayer);
        
        // Bouton supprimer
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<svg width="24" height="24" fill="#fff"><circle cx="12" cy="12" r="12" fill="#ff4f4f"/><rect x="7" y="11" width="10" height="2" rx="1" fill="#fff"/></svg>';
        deleteBtn.style.background = 'none';
        deleteBtn.style.border = 'none';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.marginLeft = '8px';
        deleteBtn.style.width = '40px';
        deleteBtn.style.height = '40px';
        playerDiv.appendChild(deleteBtn);
        
        // Bouton valider
        const validateBtn2 = document.createElement('button');
        validateBtn2.innerHTML = '<svg width="24" height="24" fill="#fff"><circle cx="12" cy="12" r="12" fill="#4ffca3"/><polyline points="8,13 11,16 16,9" stroke="#fff" stroke-width="2" fill="none"/></svg>';
        validateBtn2.style.background = 'none';
        validateBtn2.style.border = 'none';
        validateBtn2.style.cursor = 'pointer';
        validateBtn2.style.marginLeft = '8px';
        validateBtn2.style.width = '40px';
        validateBtn2.style.height = '40px';
        playerDiv.appendChild(validateBtn2);
        
        // Bouton play synchro
        const playSyncBtn = document.createElement('button');
        playSyncBtn.innerHTML = '<svg width="24" height="24" fill="#fff"><circle cx="12" cy="12" r="12" fill="#4f8cff"/><polygon points="10,8 16,12 10,16" fill="#fff"/></svg>';
        playSyncBtn.title = 'Écouter avec la vidéo';
        playSyncBtn.style.background = 'none';
        playSyncBtn.style.border = 'none';
        playSyncBtn.style.cursor = 'pointer';
        playSyncBtn.style.marginLeft = '8px';
        playSyncBtn.style.width = '40px';
        playSyncBtn.style.height = '40px';
        playerDiv.appendChild(playSyncBtn);
        
        // Actions play synchro
        playSyncBtn.onclick = () => {
            gameVideo.currentTime = 0;
            gameVideo.muted = true;
            gameVideo.play();
            const imitationAudio = new Audio(URL.createObjectURL(imitationBlob));
            imitationAudio.currentTime = 0;
            imitationAudio.play();
            imitationAudio.onended = () => {
                gameVideo.pause();
            };
        };
        
        soundwaveGame.appendChild(playerDiv);
        
        // Actions
        deleteBtn.onclick = () => {
            soundwaveGame.innerHTML = '';
            waveformCanvas.style.opacity = 1;
            recordBtn.disabled = false;
            recordBtn.style.display = 'inline-block';
        };        validateBtn2.onclick = () => {
            if (!socket || !imitationBlob) {
                console.error('Socket or imitation not ready');
                return;
            }
            
            try {
                socket.emit('imitationComplete', {
                    playerId,
                    imitation: imitationBlob
                });
                gameState = 'waiting';
                showWaitingScreen();
                soundwaveGame.innerHTML = '';
            } catch (error) {
                console.error('Error sending imitation:', error);
                alert('Une erreur est survenue lors de l\'envoi de votre imitation. Veuillez réessayer.');
            }
            waveformCanvas.style.opacity = 1;
            recordBtn.disabled = false;
        };
        
        stream.getTracks().forEach(track => track.stop());
    };
};

stopBtn.onclick = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
};

continueBtn.onclick = () => {
    phase1.style.display = 'none';
    phase2.style.display = 'block';
    gameVideo.currentTime = 0;
    gameVideo.pause();
    soundwaveGame.innerHTML = '';
    soundwaveRecord.innerHTML = '';
    playbackSection.style.display = 'none';
};

function drawAudioWave(blob, canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const reader = new FileReader();
    reader.onload = function(e) {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtx.decodeAudioData(e.target.result, function(buffer) {
            const data = buffer.getChannelData(0);
            const step = Math.floor(data.length / canvas.width);
            ctx.strokeStyle = '#4f8cff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < canvas.width; i++) {
                const min = Math.min(...data.slice(i * step, (i + 1) * step));
                const max = Math.max(...data.slice(i * step, (i + 1) * step));
                const y1 = canvas.height / 2 - min * canvas.height / 2;
                const y2 = canvas.height / 2 - max * canvas.height / 2;
                ctx.moveTo(i, y1);
                ctx.lineTo(i, y2);
            }
            ctx.stroke();
        });
    };
    reader.readAsArrayBuffer(blob);
}

// LOBBY ET MULTIJOUEUR
let socket;
try {
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to server');
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        alert('Erreur de connexion au serveur. Veuillez rafraîchir la page.');
    });
} catch (error) {
    console.error('Socket initialization error:', error);
}

const nameInput = document.getElementById('nameInput');
const createGameBtn = document.getElementById('createGame');
const joinGameBtn = document.getElementById('joinGame');
const startGameBtn = document.getElementById('startGame');
const playerList = document.getElementById('playerList');
const gameRoom = document.getElementById('gameRoom');
const gameCodeInput = document.getElementById('gameCodeInput');
const votingPhase = document.getElementById('votingPhase');

function updatePlayerList() {
    playerList.innerHTML = '';
    players.forEach((player) => {
        const div = document.createElement('div');
        div.className = 'player-list-item';
        div.textContent = `${player.name} ${player.hasFinished ? '✓' : ''}`;
        if (isHost && player.id === playerId) div.textContent += ' (Hôte)';
        playerList.appendChild(div);
    });
    
    if (isHost) {
        startGameBtn.style.display = 'block';
        startGameBtn.disabled = players.size < 2;
    }
}

createGameBtn.onclick = () => {
    console.log('Create game button clicked');
    if (!nameInput.value) {
        console.log('Name input is empty');
        return;
    }
    if (!socket) {
        console.error('Socket not initialized');
        return;
    }
    console.log('Emitting createGame event with name:', nameInput.value);
    playerName = nameInput.value;
    socket.emit('createGame', playerName);
    if (gameCodeInput) gameCodeInput.style.display = 'none';
};

joinGameBtn.onclick = () => {
    if (!gameCodeInput.style.display || gameCodeInput.style.display === 'none') {
        gameCodeInput.style.display = 'block';
        return;
    }
    if (!nameInput.value || !gameCodeInput.value) return;
    
    playerName = nameInput.value;
    gameCode = gameCodeInput.value.toUpperCase();
    socket.emit('joinGame', { playerName, gameCode });
};

startGameBtn.onclick = () => {
    if (isHost && gameCode) {
        socket.emit('startGame', gameCode);
    }
};

// Événements socket pour le lobby
socket.on('gameCreated', (data) => {
    console.log('Received gameCreated event:', data);
    isHost = true;
    playerId = data.playerId;
    gameCode = data.gameCode;
    
    // Mise à jour des joueurs
    players.clear();
    console.log('Adding players:', data.players);
    data.players.forEach(player => {
        players.set(player.id, player);
    });
    
    // Mise à jour de l'interface
    document.getElementById('playerSetup').style.display = 'none';
    gameRoom.style.display = 'block';
    document.getElementById('gameCodeDisplay').textContent = gameCode;
    updatePlayerList();
});

socket.on('gameJoined', (data) => {
    isHost = false;
    playerId = data.playerId;
    gameCode = data.gameCode;
    
    // Mise à jour des joueurs existants
    players.clear();
    data.players.forEach(player => {
        players.set(player.id, player);
    });
    
    document.getElementById('playerSetup').style.display = 'none';
    gameRoom.style.display = 'block';
    document.getElementById('gameCodeDisplay').textContent = gameCode;
    updatePlayerList();
});

socket.on('updatePlayers', (data) => {
    players.clear();
    data.players.forEach(player => {
        players.set(player.id, player);
    });
    updatePlayerList();
});

socket.on('error', (message) => {
    alert(message);
    if (message === 'Ce pseudo est déjà utilisé dans cette partie') {
        nameInput.value = '';
        nameInput.focus();
        if (gameCodeInput.style.display !== 'none') {
            gameCodeInput.style.display = 'none';
        }
    }
});

// SYSTÈME DE VOTE
const currentPlayerName = document.getElementById('currentPlayerName');
const scoreList = document.getElementById('scoreList');
const dislikeBtn = document.getElementById('dislikeBtn');
const likeBtn = document.getElementById('likeBtn');
const superlikeBtn = document.getElementById('superlikeBtn');

function updateScoreboard() {
    scoreList.innerHTML = '';
    const sortedPlayers = Array.from(players.values())
        .sort((a, b) => b.score - a.score);
    
    sortedPlayers.forEach(player => {
        const div = document.createElement('div');
        div.className = `score-item ${player.id === currentPlayingIndex ? 'current' : ''}`;
        div.innerHTML = `
            <span>${player.name}</span>
            <span>${player.score} pts</span>
        `;
        scoreList.appendChild(div);
    });
}

function startVotingPhase() {
    document.getElementById('game').style.display = 'none';
    votingPhase.style.display = 'flex';
    // Mélanger l'ordre des joueurs
    const playerIds = Array.from(players.keys());
    shuffleArray(playerIds);
    currentPlayingIndex = playerIds[0];
    playNextImitation();
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function playNextImitation() {
    if (currentPlayingIndex === null) {
        showResults();
        return;
    }
    
    const currentPlayer = players.get(currentPlayingIndex);
    currentPlayerName.textContent = currentPlayer.name;
    
    // Désactiver les votes pour sa propre imitation
    votingEnabled = currentPlayingIndex !== playerId;
    dislikeBtn.disabled = !votingEnabled;
    likeBtn.disabled = !votingEnabled;
    superlikeBtn.disabled = !votingEnabled;
    
    if (!votingEnabled) {
        dislikeBtn.classList.add('disabled');
        likeBtn.classList.add('disabled');
        superlikeBtn.classList.add('disabled');
    } else {
        dislikeBtn.classList.remove('disabled');
        likeBtn.classList.remove('disabled');
        superlikeBtn.classList.remove('disabled');
    }
    
    // Jouer l'imitation
    playImitation(currentPlayer.imitation);
}

function vote(value) {
    if (!votingEnabled) return;
    
    socket.emit('vote', {
        voterId: playerId,
        playerId: currentPlayingIndex,
        value
    });
    
    // Passer au joueur suivant
    const playerIds = Array.from(players.keys());
    const currentIndex = playerIds.indexOf(currentPlayingIndex);
    currentPlayingIndex = playerIds[currentIndex + 1] || null;
    
    if (currentPlayingIndex) {
        playNextImitation();
    }
}

dislikeBtn.onclick = () => vote(-1);
likeBtn.onclick = () => vote(1);
superlikeBtn.onclick = () => vote(2);

socket.on('voteRegistered', (data) => {
    const player = players.get(data.playerId);
    if (player) {
        player.score += data.value;
        updateScoreboard();
    }
});

function showWaitingScreen() {
    const waitingDiv = document.createElement('div');
    waitingDiv.className = 'waiting-screen';
    waitingDiv.innerHTML = `
        <h2>En attente des autres joueurs...</h2>
        <div class="player-status">
            ${Array.from(players.values()).map(player => `
                <div class="status-item ${player.hasFinished ? 'finished' : ''}">
                    ${player.name} ${player.hasFinished ? '✓' : '...'}
                </div>
            `).join('')}
        </div>
    `;
    document.getElementById('game').appendChild(waitingDiv);
}

function showResults() {
    gameState = 'results';
    votingPhase.innerHTML = `
        <h1>Résultats finaux</h1>
        <div class="scoreboard final">
            ${Array.from(players.values())
                .sort((a, b) => b.score - a.score)
                .map((player, index) => `
                    <div class="score-item ${index === 0 ? 'winner' : ''}">
                        <span>${index + 1}. ${player.name}</span>
                        <span>${player.score} points</span>
                    </div>
                `).join('')}
        </div>
        <button class="new-game-btn" onclick="location.reload()">Nouvelle partie</button>
    `;
}

// Événements socket pour la synchronisation
socket.on('playerFinished', (playerId) => {
    const player = players.get(playerId);
    if (player) {
        player.hasFinished = true;
        updatePlayerList();
    }
});

socket.on('allPlayersFinished', () => {
    gameState = 'voting';
    startVotingPhase();
});
