// Game timer module
import { api } from './api.js';

let gameStatus = null;
let timerInterval = null;

export function initTimer() {
    updateTimer();
    
    // Update every second
    timerInterval = setInterval(updateTimer, 1000);
}

async function updateTimer() {
    try {
        gameStatus = await api.getGameStatus();
        
        if (!gameStatus.is_active) {
            displayTimer('Geen actief spel');
            return;
        }
        
        if (gameStatus.is_finished) {
            displayTimer('00:00:00', true);
            return;
        }
        
        const seconds = gameStatus.time_remaining_seconds;
        displayTimer(formatTime(seconds), false);
        
    } catch (error) {
        console.error('Failed to update timer:', error);
    }
}

function formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function pad(num) {
    return num.toString().padStart(2, '0');
}

function displayTimer(text, isFinished = false) {
    const timerEl = document.getElementById('timer-display');
    timerEl.textContent = text;
    
    if (isFinished) {
        timerEl.style.color = '#f44336';
    } else {
        timerEl.style.color = 'white';
    }
}

export function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
}
