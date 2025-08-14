// script.js
// Toutes les fonctions JS du jeu d'imitation

// Variables globales
let mediaRecorder = null;
let audioChunks = [];
let imitationBlob = null;
let imitationBuffer = null;
let phase1Stream = null;
let recordingInterface = null;
let animationId = null;
let videoAudioContext = null;
let videoAnalyser = null;
let videoAudioData = null;

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

// Initialiser l'analyse audio de la vidéo
function initVideoAudioAnalysis(video) {
    if (!videoAudioContext) {
        videoAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        videoAnalyser = videoAudioContext.createAnalyser();
        
        try {
            const source = videoAudioContext.createMediaElementSource(video);
            source.connect(videoAnalyser);
            videoAnalyser.connect(videoAudioContext.destination);
            
            videoAnalyser.fftSize = 512; // Augmenté pour plus de précision
            const bufferLength = videoAnalyser.frequencyBinCount;
            videoAudioData = new Uint8Array(bufferLength);
            
            console.log('Video audio analysis initialized with better precision');
            return true;
        } catch (error) {
            console.log('Could not analyze video audio:', error);
            // Créer un fallback avec données simulées
            videoAudioData = new Uint8Array(256);
            return false;
        }
    }
    return true;
}

// Dessiner les vagues audio de la vidéo
function drawVideoWaveform() {
    if (!waveformCanvas) return;
    
    const ctx = waveformCanvas.getContext('2d');
    const width = waveformCanvas.width;
    const height = waveformCanvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    // Essayer d'utiliser les données audio réelles
    if (videoAnalyser && videoAudioData) {
        videoAnalyser.getByteFrequencyData(videoAudioData);
        
        // Dessiner les vagues basées sur l'audio réel
        ctx.fillStyle = '#4f8cff';
        ctx.beginPath();
        
        const barWidth = width / videoAudioData.length * 2;
        let x = 0;
        
        for (let i = 0; i < videoAudioData.length; i += 2) {
            const barHeight = (videoAudioData[i] / 255) * height * 0.8;
            const y = (height - barHeight) / 2;
            
            ctx.fillRect(x, y, barWidth - 1, barHeight);
            x += barWidth;
        }
    } else {
        // Fallback : générer des vagues statiques stylisées
        ctx.fillStyle = '#4f8cff';
        ctx.beginPath();
        
        const barWidth = 3;
        const barSpacing = 1;
        const numBars = Math.floor(width / (barWidth + barSpacing));
        
        for (let i = 0; i < numBars; i++) {
            // Créer une forme de vague sinusoïdale avec variation
            const x = i * (barWidth + barSpacing);
            const baseHeight = height * 0.3;
            const variation = Math.sin(i * 0.1) * height * 0.2;
            const randomFactor = Math.sin(i * 0.05) * height * 0.1;
            const barHeight = baseHeight + variation + randomFactor;
            const y = (height - barHeight) / 2;
            
            ctx.fillRect(x, y, barWidth, barHeight);
        }
    }
    
    // Barre de progression blanche
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const percent = (previewVideo.currentTime / previewVideo.duration) || 0;
    ctx.fillRect(0, 0, width * percent, height);
}

// Fonction spécifique pour gameVideo
function drawVideoWaveformForGame() {
    if (!waveformCanvas) return;
    
    const ctx = waveformCanvas.getContext('2d');
    const width = waveformCanvas.width;
    const height = waveformCanvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    // Générer des vagues stylisées pour gameVideo
    ctx.fillStyle = '#4f8cff';
    ctx.beginPath();
    
    const barWidth = 3;
    const barSpacing = 1;
    const numBars = Math.floor(width / (barWidth + barSpacing));
    
    for (let i = 0; i < numBars; i++) {
        const x = i * (barWidth + barSpacing);
        const baseHeight = height * 0.3;
        const variation = Math.sin(i * 0.1) * height * 0.2;
        const randomFactor = Math.sin(i * 0.05) * height * 0.1;
        const barHeight = baseHeight + variation + randomFactor;
        const y = (height - barHeight) / 2;
        
        ctx.fillRect(x, y, barWidth, barHeight);
    }
    
    // Barre de progression blanche pour gameVideo
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const percent = (gameVideo.currentTime / gameVideo.duration) || 0;
    ctx.fillRect(0, 0, width * percent, height);
}

// Charger l'analyse audio au démarrage
previewVideo.addEventListener('loadedmetadata', () => {
    initVideoAudioAnalysis(previewVideo);
});

previewVideo.addEventListener('play', () => {
    function animate() {
        drawVideoWaveform();
        if (!previewVideo.paused && !previewVideo.ended) {
            requestAnimationFrame(animate);
        }
    }
    animate();
});

previewVideo.addEventListener('timeupdate', drawVideoWaveform);
previewVideo.addEventListener('seeked', drawVideoWaveform);
previewVideo.addEventListener('pause', drawVideoWaveform);

// Événements pour gameVideo
gameVideo.addEventListener('loadedmetadata', () => {
    initVideoAudioAnalysis(gameVideo);
});

gameVideo.addEventListener('play', () => {
    function animateGameWave() {
        drawVideoWaveformForGame();
        if (!gameVideo.paused && !gameVideo.ended) {
            requestAnimationFrame(animateGameWave);
        }
    }
    animateGameWave();
});

gameVideo.addEventListener('timeupdate', drawVideoWaveformForGame);
gameVideo.addEventListener('seeked', drawVideoWaveformForGame);
gameVideo.addEventListener('pause', drawVideoWaveformForGame);

// INTERFACE D'ENREGISTREMENT VISUEL
function createRecordingInterface() {
    console.log('Creating recording interface...');
    
    // Créer le conteneur principal
    recordingInterface = document.createElement('div');
    recordingInterface.className = 'recording-interface';
    recordingInterface.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 15px;
        padding: 20px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.3);
        width: 300px;
        text-align: center;
        margin: 15px auto;
        position: relative;
    `;
    
    // Créer le canvas pour les ondes audio de la vidéo de référence
    const referenceWaveCanvas = document.createElement('canvas');
    referenceWaveCanvas.width = 280;
    referenceWaveCanvas.height = 60;
    referenceWaveCanvas.style.cssText = `
        width: 100%;
        height: 60px;
        border-radius: 5px;
        background: rgba(255,255,255,0.1);
        margin-bottom: 15px;
        border: 1px solid rgba(255,255,255,0.2);
    `;
    
    // Titre pour les ondes de référence
    const referenceTitle = document.createElement('div');
    referenceTitle.textContent = 'Audio de référence';
    referenceTitle.style.cssText = `
        color: rgba(255,255,255,0.8);
        font-size: 12px;
        margin-bottom: 5px;
        text-align: center;
    `;
    
    // Créer le conteneur des barres audio d'enregistrement
    const barsContainer = document.createElement('div');
    barsContainer.className = 'audio-bars';
    barsContainer.style.cssText = `
        display: flex;
        justify-content: center;
        align-items: flex-end;
        height: 50px;
        margin: 15px 0;
        gap: 2px;
    `;
    
    // Créer les barres audio (24 barres au lieu de 32)
    for (let i = 0; i < 24; i++) {
        const bar = document.createElement('div');
        bar.className = 'audio-bar';
        bar.style.cssText = `
            width: 3px;
            background: white;
            border-radius: 1.5px;
            height: 15px;
            transition: height 0.1s ease;
        `;
        barsContainer.appendChild(bar);
    }
    
    // Créer le timer
    const timer = document.createElement('div');
    timer.className = 'recording-timer';
    timer.style.cssText = `
        color: white;
        font-size: 20px;
        font-weight: bold;
        margin-bottom: 15px;
    `;
    timer.textContent = '00:00';
    
    // Créer le bouton stop stylisé - CORRIGÉ POUR ÉVITER L'ÉTIREMENT
    const stopBtnStyled = document.createElement('button');
    stopBtnStyled.className = 'stop-btn-styled';
    stopBtnStyled.style.cssText = `
        width: 45px !important;
        height: 45px !important;
        min-width: 45px !important;
        min-height: 45px !important;
        max-width: 45px !important;
        max-height: 45px !important;
        border-radius: 50% !important;
        background: #ff4444;
        border: none;
        cursor: pointer;
        display: flex !important;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s ease;
        margin: 0 auto;
        flex-shrink: 0 !important;
        flex-grow: 0 !important;
        flex-basis: 45px !important;
        box-sizing: border-box !important;
        padding: 0 !important;
        aspect-ratio: 1 / 1 !important;
    `;
    
    const stopIcon = document.createElement('div');
    stopIcon.style.cssText = `
        width: 12px;
        height: 12px;
        background: white;
        border-radius: 1px;
        flex-shrink: 0;
    `;
    stopBtnStyled.appendChild(stopIcon);
    
    // Assembler l'interface avec les ondes de référence en haut
    recordingInterface.appendChild(referenceTitle);
    recordingInterface.appendChild(referenceWaveCanvas);
    recordingInterface.appendChild(timer);
    recordingInterface.appendChild(barsContainer);
    recordingInterface.appendChild(stopBtnStyled);
    
    // Ajouter à la place du bouton d'enregistrement
    const recordSection = document.querySelector('.record-section');
    if (recordSection) {
        console.log('Adding interface to record-section');
        recordSection.appendChild(recordingInterface);
    } else {
        // Fallback: ajouter après le bouton d'enregistrement
        console.log('record-section not found, adding after record button');
        recordBtn.parentNode.insertBefore(recordingInterface, recordBtn.nextSibling);
    }
    
    // Fonction pour animer les ondes de référence
    function animateReferenceWave() {
        if (!referenceWaveCanvas) return;
        
        const ctx = referenceWaveCanvas.getContext('2d');
        const width = referenceWaveCanvas.width;
        const height = referenceWaveCanvas.height;
        
        ctx.clearRect(0, 0, width, height);
        
        // Dessiner les vraies ondes audio de la vidéo de référence
        if (videoAnalyser && videoAudioData) {
            videoAnalyser.getByteFrequencyData(videoAudioData);
            
            ctx.fillStyle = '#4f8cff';
            const barWidth = width / videoAudioData.length * 2;
            let x = 0;
            
            for (let i = 0; i < videoAudioData.length; i += 2) {
                const barHeight = (videoAudioData[i] / 255) * height * 0.8;
                const y = (height - barHeight) / 2;
                
                ctx.fillRect(x, y, barWidth - 1, barHeight);
                x += barWidth;
            }
        } else {
            // Fallback : ondes stylisées
            ctx.fillStyle = '#4f8cff';
            const barWidth = 3;
            const barSpacing = 1;
            const numBars = Math.floor(width / (barWidth + barSpacing));
            
            for (let i = 0; i < numBars; i++) {
                const x = i * (barWidth + barSpacing);
                const baseHeight = height * 0.3;
                const variation = Math.sin((i + Date.now() * 0.01) * 0.1) * height * 0.2;
                const barHeight = baseHeight + variation;
                const y = (height - barHeight) / 2;
                
                ctx.fillRect(x, y, barWidth, barHeight);
            }
        }
        
        // Barre de progression de la vidéo
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        const percent = (gameVideo.currentTime / gameVideo.duration) || 0;
        ctx.fillRect(0, 0, width * percent, height);
        
        // Continuer l'animation si on enregistre encore
        if (recordingInterface && mediaRecorder && mediaRecorder.state === 'recording') {
            requestAnimationFrame(animateReferenceWave);
        }
    }
    
    // Démarrer l'animation des ondes de référence
    animateReferenceWave();
    
    // Démarrer le timer
    let seconds = 0;
    const timerInterval = setInterval(() => {
        seconds++;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        timer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
    
    // Action du bouton stop
    stopBtnStyled.onclick = () => {
        clearInterval(timerInterval);
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
        if (recordingInterface) {
            recordingInterface.remove();
            recordingInterface = null;
        }
        // Arrêter l'enregistrement directement
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            gameVideo.pause();
            mediaRecorder.stop();
        }
    };
    
    // Effet hover sur le bouton
    stopBtnStyled.onmouseenter = () => {
        stopBtnStyled.style.transform = 'scale(1.1)';
    };
    stopBtnStyled.onmouseleave = () => {
        stopBtnStyled.style.transform = 'scale(1)';
    };
    
    console.log('Recording interface created and added to page');
}

function startAudioVisualization(analyser, dataArray) {
    const bars = document.querySelectorAll('.audio-bar');
    
    function animate() {
        if (!recordingInterface) return; // Arrêter si l'interface est supprimée
        
        analyser.getByteFrequencyData(dataArray);
        
        // Mettre à jour chaque barre
        bars.forEach((bar, index) => {
            // Prendre des échantillons espacés du spectre audio
            const dataIndex = Math.floor((index / bars.length) * dataArray.length);
            const amplitude = dataArray[dataIndex] || 0;
            
            // Convertir l'amplitude (0-255) en hauteur (10-80px)
            const height = Math.max(10, (amplitude / 255) * 80);
            bar.style.height = height + 'px';
            
            // Ajouter un effet de couleur basé sur l'amplitude
            const intensity = amplitude / 255;
            bar.style.background = `rgba(255, 255, 255, ${0.6 + intensity * 0.4})`;
        });
        
        animationId = requestAnimationFrame(animate);
    }
    
    animate();
}

// ENREGISTREMENT
recordBtn.onclick = async () => {
    console.log('Record button clicked');
    
    // Vérifier que les éléments nécessaires existent
    if (!gameVideo) {
        console.error('gameVideo element not found!');
        return;
    }
    if (!previewVideo) {
        console.error('previewVideo element not found!');
        return;
    }
    if (!waveformCanvas) {
        console.error('waveformCanvas element not found!');
        return;
    }
    
    recordBtn.style.display = 'none';
    audioChunks = [];
    
    // Créer l'interface d'enregistrement visuel
    createRecordingInterface();
    
    // Configuration initiale de l'affichage
    waveformCanvas.style.opacity = 1;
    previewVideo.style.display = 'none';
    gameVideo.style.display = 'block';
    
    // Rendre la vidéo MUETTE pendant l'enregistrement pour éviter les interférences
    gameVideo.muted = true;   // Muter pour éviter la confusion sonore
    gameVideo.volume = 0;     // Volume à zéro
    gameVideo.currentTime = 0;
    
    // Lancer la lecture
    gameVideo.play();
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Microphone access granted');
        mediaRecorder = new MediaRecorder(stream);
    
    // Analyser l'audio pour l'animation
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    // Démarrer l'animation des barres audio
    startAudioVisualization(analyser, dataArray);
    
    // Animation des vagues pendant l'enregistrement (sur le canvas principal)
    function animateRecordingWave() {
        drawVideoWaveformForGame(); // Utiliser la même fonction que pour la phase 2
        
        if (!gameVideo.paused && !gameVideo.ended && mediaRecorder && mediaRecorder.state === 'recording') {
            requestAnimationFrame(animateRecordingWave);
        }
    }
    
    // Démarrer l'animation des vagues d'enregistrement
    gameVideo.addEventListener('play', animateRecordingWave);
    gameVideo.addEventListener('timeupdate', animateRecordingWave);
    animateRecordingWave(); // Démarrer immédiatement
    
    mediaRecorder.start();
    mediaRecorder.ondataavailable = e => {
        audioChunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
        console.log('MediaRecorder stopped, creating player...');
        imitationBlob = new Blob(audioChunks, { type: 'audio/webm' });
        console.log('Blob created:', imitationBlob);
        
        gameVideo.pause();
        
        // Trouver un bon endroit pour mettre le lecteur - après la record-section
        const recordSection = document.querySelector('.record-section');
        const phase2 = document.getElementById('phase2');
        const container = phase2 || document.body; // Fallback au body si phase2 n'existe pas
        
        if (!container) {
            console.error('No container found for recording player!');
            return;
        }
        
        console.log('Creating recording player in container:', container);
        createRecordingPlayer(container, imitationBlob);
        
        // Clean up
        if (audioContext && audioContext.state !== 'closed') {
            audioContext.close();
        }
        stream.getTracks().forEach(track => track.stop());
    };
    } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Erreur d\'accès au microphone. Veuillez autoriser l\'accès au microphone.');
        recordBtn.style.display = 'inline-block';
        if (recordingInterface) {
            recordingInterface.remove();
            recordingInterface = null;
        }
    }
};

function createRecordingPlayer(container, blob) {
    console.log('createRecordingPlayer called with:', container, blob);
    
    if (!container) {
        console.error('No container provided to createRecordingPlayer');
        return;
    }
    
    if (!blob) {
        console.error('No blob provided to createRecordingPlayer');
        return;
    }
    
    const playerDiv = document.createElement('div');
    playerDiv.className = 'recording-player';
    playerDiv.id = 'audioPlayerContainer'; // Identifiant unique
    playerDiv.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 20px;
        padding: 20px;
        max-width: 600px;
        margin: 20px auto;
        display: flex !important;
        align-items: center;
        gap: 15px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        position: relative;
        z-index: 100;
        visibility: visible;
    `;
    
    // Lecteur audio natif
    const audioPlayer = document.createElement('audio');
    audioPlayer.controls = true;
    audioPlayer.src = URL.createObjectURL(blob);
    audioPlayer.style.cssText = `
        flex: 1;
        height: 40px;
        min-width: 200px;
    `;
    
    console.log('Audio player created with src:', audioPlayer.src);
    
    // Bouton supprimer
    const deleteBtn = document.createElement('button');
    deleteBtn.style.cssText = `
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: #ff4444;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        transition: transform 0.2s ease;
        color: white;
    `;
    deleteBtn.innerHTML = '🗑';
    
    // Bouton valider
    const validateBtn = document.createElement('button');
    validateBtn.style.cssText = `
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: #44ff44;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        transition: transform 0.2s ease;
        color: white;
    `;
    validateBtn.innerHTML = '✓';
    
    // Effets hover
    deleteBtn.onmouseenter = () => deleteBtn.style.transform = 'scale(1.1)';
    deleteBtn.onmouseleave = () => deleteBtn.style.transform = 'scale(1)';
    validateBtn.onmouseenter = () => validateBtn.style.transform = 'scale(1.1)';
    validateBtn.onmouseleave = () => validateBtn.style.transform = 'scale(1)';
    
    // Actions des boutons
    deleteBtn.onclick = () => {
        console.log('Delete button clicked');
        
        // Supprimer le lecteur audio par son ID
        const audioPlayerContainer = document.getElementById('audioPlayerContainer');
        if (audioPlayerContainer && audioPlayerContainer.parentNode) {
            audioPlayerContainer.parentNode.removeChild(audioPlayerContainer);
            console.log('Audio player removed successfully');
        } else {
            console.log('Audio player container not found');
        }
        
        // Remettre le bouton d'enregistrement
        recordBtn.disabled = false;
        recordBtn.style.display = 'inline-block';
        
        // Remettre la vidéo en mode preview
        previewVideo.style.display = 'block';
        gameVideo.style.display = 'none';
        
        console.log('Recording deleted, record button restored');
    };
    
    validateBtn.onclick = () => {
        if (!socketAvailable || !socket || !imitationBlob) {
            if (!socketAvailable || !socket) {
                console.log('Mode local - enregistrement terminé avec succès !');
                alert('Enregistrement sauvegardé ! (Mode local)');
                container.innerHTML = '';
                recordBtn.disabled = false;
                recordBtn.style.display = 'inline-block';
                return;
            }
            console.error('Socket or imitation not ready');
            return;
        }
        
        try {
            socket.emit('imitationComplete', {
                playerId,
                imitation: blob
            });
            gameState = 'waiting';
            showWaitingScreen();
            container.innerHTML = '';
        } catch (error) {
            console.error('Error sending imitation:', error);
            alert('Une erreur est survenue lors de l\'envoi de votre imitation. Veuillez réessayer.');
        }
        recordBtn.disabled = false;
    };
    
    // Assembler le lecteur
    playerDiv.appendChild(audioPlayer);
    playerDiv.appendChild(deleteBtn);
    playerDiv.appendChild(validateBtn);
    
    // Ajouter le lecteur SANS vider le container
    container.appendChild(playerDiv);
    console.log('Recording player added to container successfully');
    
    // Message temporaire pour confirmer que le lecteur est ajouté
    const tempMessage = document.createElement('div');
    tempMessage.textContent = 'Lecteur audio créé !';
    tempMessage.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: green;
        color: white;
        padding: 10px;
        border-radius: 5px;
        z-index: 1000;
    `;
    document.body.appendChild(tempMessage);
    setTimeout(() => {
        if (tempMessage.parentNode) {
            tempMessage.parentNode.removeChild(tempMessage);
        }
    }, 3000);
};

continueBtn.onclick = () => {
    phase1.style.display = 'none';
    phase2.style.display = 'block';
    gameVideo.style.display = 'block';
    previewVideo.style.display = 'none';
    gameVideo.currentTime = 0;
    gameVideo.pause();
    
    // Initialiser l'audio pour gameVideo aussi et s'assurer qu'il est prêt
    initVideoAudioAnalysis(gameVideo);
    
    // S'assurer que gameVideo a du son (pour l'analyse audio, pas pour l'écoute)
    gameVideo.muted = false;
    gameVideo.volume = 1.0;
    
    // Faire jouer la vidéo un instant pour initialiser l'analyse audio, puis la pauser
    gameVideo.play().then(() => {
        setTimeout(() => {
            gameVideo.pause();
            gameVideo.currentTime = 0;
        }, 100);
    });
    
    // Nettoyer les containers
    soundwaveGame.innerHTML = '';
    soundwaveRecord.innerHTML = '';
    playbackSection.style.display = 'none';
    
    // Dessiner les vagues pour gameVideo
    drawVideoWaveformForGame();
    
    console.log('Phase 2 initialized with audio waveform and audio analysis ready');
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
let socket = null;

// Initialiser Socket.IO seulement si disponible
function initializeSocket() {
    try {
        if (typeof io !== 'undefined') {
            socket = io();
            
            socket.on('connect', () => {
                console.log('Connected to server');
            });

            socket.on('connect_error', (error) => {
                console.error('Connection error:', error);
                alert('Erreur de connexion au serveur. Mode local activé.');
                socket = null;
            });
            
            return true;
        } else {
            console.log('Socket.IO not available - running in local mode');
            return false;
        }
    } catch (error) {
        console.error('Socket initialization error:', error);
        socket = null;
        return false;
    }
}

// Initialiser au chargement
const socketAvailable = initializeSocket();

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
    
    playerName = nameInput.value;
    
    if (!socketAvailable || !socket) {
        console.log('Socket not available - starting local game');
        // Mode local : passer directement au jeu
        document.getElementById('playerSetup').style.display = 'none';
        document.getElementById('lobby').style.display = 'none';
        document.getElementById('game').style.display = 'block';
        phase1.style.display = 'block';
        phase2.style.display = 'none';
        return;
    }
    
    console.log('Emitting createGame event with name:', playerName);
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

// Événements socket pour le lobby (seulement si socket disponible)
if (socketAvailable && socket) {
    socket.on('gameCreated', (data) => {
        isHost = true;
        playerId = data.playerId;
        gameCode = data.gameCode;
        
        // Mise à jour des joueurs
        players.clear();
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
        document.getElementById('playerSetup').style.display = 'none';
        gameRoom.style.display = 'block';
        document.getElementById('gameCodeDisplay').textContent = gameCode;
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
    });

    socket.on('gameStarted', () => {
        // Cacher le lobby
        document.getElementById('lobby').style.display = 'none';
        // Afficher le jeu
        document.getElementById('game').style.display = 'block';
        // Commencer par la phase 1
        phase1.style.display = 'block';
        phase2.style.display = 'none';
    });
}

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

// Événements socket pour les votes et synchronisation (seulement si socket disponible)
if (socketAvailable && socket) {
    socket.on('voteRegistered', (data) => {
        const player = players.get(data.playerId);
        if (player) {
            player.score += data.value;
            updateScoreboard();
        }
    });

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
}

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
