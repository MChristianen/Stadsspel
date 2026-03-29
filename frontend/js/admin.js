// Admin panel JS
import { api } from './api.js';

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Check auth
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('current_user');
    
    if (!token || !userStr) {
        window.location.href = '/';
        return;
    }
    
    currentUser = JSON.parse(userStr);
    
    if (!currentUser.is_admin) {
        alert('Alleen admins hebben toegang tot deze pagina');
        window.location.href = '/';
        return;
    }
    
    document.getElementById('admin-name').textContent = `Ingelogd als: ${currentUser.name}`;
    
    // Load initial data
    await loadGameStatus();
    await loadPendingSubmissions();
    
    // Auto-refresh every 10 seconds
    setInterval(loadPendingSubmissions, 10000);
    setInterval(loadGameStatus, 5000);
    
    setupEventListeners();
});

async function loadGameStatus() {
    try {
        const status = await api.getGameStatus();
        const infoDiv = document.getElementById('game-status-info');
        const publishBtn = document.getElementById('publish-results-btn');
        
        if (!status.is_active) {
            infoDiv.innerHTML = '<p style="color: #757575;">Geen actief spel</p>';
            publishBtn.disabled = true;
            return;
        }
        
        let html = '<p><strong>Actief spel:</strong></p>';
        html += `<p>Start: ${new Date(status.start_time).toLocaleString('nl-NL')}</p>`;
        html += `<p>Einde: ${new Date(status.end_time).toLocaleString('nl-NL')}</p>`;
        html += `<p>Resterende tijd: ${formatSeconds(status.time_remaining_seconds)}</p>`;
        
        if (status.is_finished) {
            html += '<p style="color: #f44336; font-weight: bold;">⏱️ Spel is afgelopen</p>';
            
            if (status.published_at) {
                html += `<p style="color: #4CAF50;">✅ Resultaten gepubliceerd op ${new Date(status.published_at).toLocaleString('nl-NL')}</p>`;
                publishBtn.disabled = true;
            } else {
                html += '<p style="color: #FF9800;">⚠️ Resultaten nog niet gepubliceerd</p>';
                publishBtn.disabled = false;
            }
        } else {
            publishBtn.disabled = true;
        }
        
        infoDiv.innerHTML = html;
        
    } catch (error) {
        console.error('Failed to load game status:', error);
    }
}

async function loadPendingSubmissions() {
    try {
        const response = await api.getPendingSubmissions();
        const submissions = response.pending_submissions;
        
        document.getElementById('pending-count').textContent = response.count;
        
        const container = document.getElementById('pending-submissions');
        
        if (submissions.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #757575;">Geen inzendingen te beoordelen</p>';
            return;
        }
        
        let html = '';
        
        for (const sub of submissions) {
            html += `
                <div class="submission-card" style="background: #f9f9f9;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <h3>${sub.challenge_title}</h3>
                            <p><strong>Team:</strong> ${sub.team_name}</p>
                            <p><strong>Gebied:</strong> ${sub.area_name}</p>
                            <p><small>${new Date(sub.created_at).toLocaleString('nl-NL')}</small></p>
                        </div>
                        ${sub.score !== null ? `<div style="font-size: 24px; font-weight: bold; color: #2196F3;">${sub.score}</div>` : ''}
                    </div>
                    
                    <div style="margin: 15px 0; padding: 15px; background: white; border-radius: 5px;">
                        <p><strong>Beschrijving:</strong></p>
                        <p style="white-space: pre-wrap;">${sub.text || 'Geen tekst'}</p>
                    </div>
            `;
            
            if (sub.media && sub.media.length > 0) {
                html += '<div class="submission-media">';
                for (const media of sub.media) {
                    if (media.media_type === 'PHOTO') {
                        html += `<img src="${media.url}" alt="Submission media" loading="lazy">`;
                    } else {
                        html += `<video src="${media.url}" controls style="max-width: 300px;"></video>`;
                    }
                }
                html += '</div>';
            }
            
            html += `
                    <textarea class="feedback-input" id="feedback-${sub.id}" placeholder="Optionele feedback voor team..."></textarea>
                    
                    <div class="action-buttons">
                        <button class="btn btn-success" onclick="approveSubmission(${sub.id})">
                            ✅ Goedkeuren
                        </button>
                        <button class="btn btn-danger" onclick="rejectSubmission(${sub.id})">
                            ❌ Afwijzen
                        </button>
                        <button class="btn btn-secondary" onclick="toggleFeedback(${sub.id})">
                            💬 Feedback
                        </button>
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Failed to load pending submissions:', error);
    }
}

window.toggleFeedback = function(submissionId) {
    const input = document.getElementById(`feedback-${submissionId}`);
    input.style.display = input.style.display === 'none' ? 'block' : 'none';
};

window.approveSubmission = async function(submissionId) {
    const feedback = document.getElementById(`feedback-${submissionId}`).value.trim();
    
    if (!confirm('Deze inzending goedkeuren?')) {
        return;
    }
    
    try {
        await api.approveSubmission(submissionId, feedback || null);
        alert('✅ Inzending goedgekeurd!');
        await loadPendingSubmissions();
    } catch (error) {
        alert('❌ Fout: ' + error.message);
    }
};

window.rejectSubmission = async function(submissionId) {
    const feedback = document.getElementById(`feedback-${submissionId}`).value.trim();
    
    if (!confirm('Deze inzending afwijzen?')) {
        return;
    }
    
    try {
        await api.rejectSubmission(submissionId, feedback || null);
        alert('❌ Inzending afgewezen');
        await loadPendingSubmissions();
    } catch (error) {
        alert('❌ Fout: ' + error.message);
    }
};

function setupEventListeners() {
    document.getElementById('start-game-btn').addEventListener('click', async () => {
        const duration = parseInt(document.getElementById('game-duration').value);
        
        if (!duration || duration < 1) {
            alert('Voer een geldige duur in');
            return;
        }
        
        if (!confirm(`Nieuw spel starten met duur ${duration} minuten?`)) {
            return;
        }
        
        try {
            await api.startGame(duration);
            alert('✅ Spel gestart!');
            await loadGameStatus();
        } catch (error) {
            alert('❌ Fout: ' + error.message);
        }
    });
    
    document.getElementById('publish-results-btn').addEventListener('click', async () => {
        if (!confirm('Resultaten publiceren? Alle inzendingen worden zichtbaar voor iedereen.')) {
            return;
        }
        
        try {
            await api.publishResults();
            alert('✅ Resultaten gepubliceerd!');
            await loadGameStatus();
        } catch (error) {
            alert('❌ Fout: ' + error.message);
        }
    });
    
    document.getElementById('export-btn').addEventListener('click', async () => {
        try {
            const blob = await api.exportGameData();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `stadsspel_export_${Date.now()}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            alert('❌ Fout bij export: ' + error.message);
        }
    });
}

function formatSeconds(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}u ${minutes}m ${secs}s`;
}
