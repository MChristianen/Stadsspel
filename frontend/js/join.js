// Join page JS
import { api } from './api.js';

let joinCode = null;
let sessionInfo = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Get join code from URL
    const params = new URLSearchParams(window.location.search);
    joinCode = params.get('code');
    
    if (!joinCode) {
        showError('Geen join code opgegeven in de URL. Vraag de code aan je spelleider.');
        document.getElementById('join-form').style.display = 'none';
        return;
    }
    
    // Load session info
    await loadSessionInfo();
    
    // Setup color picker
    setupColorPicker();
    
    // Setup form
    document.getElementById('join-form').addEventListener('submit', handleSubmit);
});

async function loadSessionInfo() {
    try {
        sessionInfo = await api.getSessionInfo(joinCode);
        
        // Show session info
        document.getElementById('city-name').textContent = sessionInfo.city_name;
        document.getElementById('duration').textContent = sessionInfo.duration_minutes;
        document.getElementById('team-count').textContent = sessionInfo.team_count;
        
        const statusBadge = document.getElementById('status-badge');
        if (sessionInfo.is_active) {
            statusBadge.className = 'status-badge status-active';
            statusBadge.textContent = 'Actief';
            showError('Dit spel is al gestart. Je kunt niet meer deelnemen.');
            document.getElementById('join-form').style.display = 'none';
        } else {
            statusBadge.className = 'status-badge status-waiting';
            statusBadge.textContent = 'Wacht op Start';
        }
        
        document.getElementById('session-info').style.display = 'block';
        
    } catch (error) {
        console.error('Failed to load session info:', error);
        showError('Kon spel informatie niet laden: ' + error.message);
        document.getElementById('join-form').style.display = 'none';
    }
}

function setupColorPicker() {
    const colorPicker = document.getElementById('color-picker');
    const colorPreview = document.getElementById('color-preview');
    const colorHex = document.getElementById('color-hex');
    const presetColors = document.querySelectorAll('.preset-color');
    
    function updateColor(color) {
        colorPicker.value = color;
        colorPreview.style.backgroundColor = color;
        colorHex.textContent = color.toUpperCase();
        
        // Update selected preset
        presetColors.forEach(preset => {
            if (preset.dataset.color.toUpperCase() === color.toUpperCase()) {
                preset.classList.add('selected');
            } else {
                preset.classList.remove('selected');
            }
        });
    }
    
    // Initial color
    updateColor('#FF0000');
    
    // Color picker change
    colorPicker.addEventListener('input', (e) => {
        updateColor(e.target.value);
    });
    
    // Preset colors
    presetColors.forEach(preset => {
        preset.addEventListener('click', () => {
            updateColor(preset.dataset.color);
        });
    });
}

async function handleSubmit(e) {
    e.preventDefault();
    
    const teamName = document.getElementById('team-name').value.trim();
    const password = document.getElementById('password').value;
    const color = document.getElementById('color-picker').value;
    
    if (!teamName || !password || !color) {
        showError('Vul alle velden in');
        return;
    }
    
    if (password.length < 6) {
        showError('Wachtwoord moet minimaal 6 tekens lang zijn');
        return;
    }
    
    // Disable button
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Bezig met registreren...';
    
    try {
        const result = await api.joinGame(joinCode, teamName, password, color);
        
        // Save auth token and user info
        api.setToken(result.auth_token);
        localStorage.setItem('current_user', JSON.stringify({
            id: result.team_id,
            name: result.team_name,
            is_admin: false
        }));
        
        // Show success
        showSuccess(`✅ Welkom ${result.team_name}!\n\nJe bent geregistreerd voor het spel in ${result.city_name}.\n\n${result.game_started ? 'Het spel is al gestart!' : 'Wacht tot de spelleider het spel start.'}`);
        
        // Redirect to main app after 2 seconds
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
        
    } catch (error) {
        console.error('Join failed:', error);
        showError('Registratie mislukt: ' + error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = '🎯 Doe Mee!';
    }
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    document.getElementById('success-message').style.display = 'none';
}

function showSuccess(message) {
    const successDiv = document.getElementById('success-message');
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    document.getElementById('error-message').style.display = 'none';
}
