// record-player.js
function createRecordingPlayer(container, blob, options) {
    const {
        onDelete,
        onValidate,
        onPlaySync
    } = options;

    const playerDiv = document.createElement('div');
    playerDiv.className = 'recording-player';
    
    // Waveform de l'imitation
    const imitationWave = document.createElement('canvas');
    imitationWave.className = 'waveform';
    imitationWave.width = 320;
    imitationWave.height = 48;
    drawAudioWave(blob, imitationWave);
    playerDiv.appendChild(imitationWave);
    
    // Audio player
    const audioPlayer = document.createElement('audio');
    audioPlayer.controls = true;
    audioPlayer.src = URL.createObjectURL(blob);
    playerDiv.appendChild(audioPlayer);
    
    // Boutons
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete';
    deleteBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12"/><rect x="7" y="11" width="10" height="2" rx="1" fill="#fff"/></svg>';
    deleteBtn.title = 'Supprimer';
    playerDiv.appendChild(deleteBtn);
    
    const validateBtn = document.createElement('button');
    validateBtn.className = 'validate';
    validateBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12"/><polyline points="8,13 11,16 16,9" stroke="#fff" stroke-width="2" fill="none"/></svg>';
    validateBtn.title = 'Valider';
    playerDiv.appendChild(validateBtn);
    
    const playSyncBtn = document.createElement('button');
    playSyncBtn.className = 'play';
    playSyncBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12"/><polygon points="10,8 16,12 10,16" fill="#fff"/></svg>';
    playSyncBtn.title = 'Écouter avec la vidéo';
    playerDiv.appendChild(playSyncBtn);
    
    // Actions des boutons
    deleteBtn.onclick = onDelete;
    validateBtn.onclick = onValidate;
    playSyncBtn.onclick = onPlaySync;
    
    container.appendChild(playerDiv);
    
    return playerDiv;
}

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

export { createRecordingPlayer };
