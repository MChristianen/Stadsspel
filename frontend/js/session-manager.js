// Session manager JS
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
    
    // Load data
    await loadCities();
    await loadSessions();
    
    // Auto-refresh sessions every 5 seconds to show new team registrations
    setInterval(loadSessions, 5000);
    
    setupEventListeners();
});

async function loadCities() {
    const select = document.getElementById('city-select');
    
    try {
        console.log('[Session Manager] Loading cities...');
        const cities = await api.getCities();
        console.log('[Session Manager] Cities loaded:', cities);
        
        if (!cities || cities.length === 0) {
            select.innerHTML = '<option value="">Geen steden beschikbaar - Run seed script</option>';
            console.warn('[Session Manager] No cities available');
            return;
        }
        
        select.innerHTML = cities.map(city => 
            `<option value="${city.id}">${city.name} (${city.area_count} gebieden)</option>`
        ).join('');
        
        console.log('[Session Manager] Dropdown updated successfully');
        
    } catch (error) {
        console.error('[Session Manager] Failed to load cities:', error);
        select.innerHTML = '<option value="">Fout: ' + error.message + '</option>';
        alert('Fout bij laden steden:\n\n' + error.message + '\n\nCheck de browser console (F12) voor meer details.');
    }
}

async function loadSessions() {
    try {
        const sessions = await api.listSessions();
        console.log('[Session Manager] Loaded sessions:', sessions);
        
        const container = document.getElementById('sessions-list');
        
        if (sessions.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #757575;">Nog geen spellen aangemaakt</p>';
            return;
        }
        
        let html = '';
        
        for (const session of sessions) {
            console.log(`[Session Manager] Session ${session.id}: ${session.team_count} teams`, session.teams);
            
            const statusClass = session.is_active ? 'active' : '';
            const statusBadge = session.is_finished ? 
                '<span class="status-badge status-finished">Afgelopen</span>' :
                session.is_active ? 
                '<span class="status-badge status-active">Actief</span>' :
                '<span class="status-badge status-waiting">Wacht op Start</span>';
            
            const joinUrl = `${window.location.origin}/join.html?code=${session.join_code}`;
            
            html += `
                <div class="session-item ${statusClass}">
                    <div class="session-header">
                        <div class="session-info">
                            <h3>${session.city_name} ${statusBadge}</h3>
                            <p><strong>Duur:</strong> ${session.duration_minutes} minuten</p>
                            <p><strong>Teams:</strong> ${session.team_count}</p>
                            ${session.started_at ? `<p><strong>Gestart:</strong> ${new Date(session.started_at).toLocaleString('nl-NL')}</p>` : ''}
                            ${session.end_time ? `<p><strong>Eindigt:</strong> ${new Date(session.end_time).toLocaleString('nl-NL')}</p>` : ''}
                        </div>
                        <div class="session-actions">
                            ${!session.is_active && !session.is_finished ? 
                                `<button class="btn btn-success" onclick="startSession(${session.id})">▶️ Start Spel</button>` : ''}
                            ${!session.is_active && !session.is_finished ? 
                                `<button class="btn btn-danger" onclick="deleteSession(${session.id})">🗑️ Verwijder</button>` : ''}
                            <button class="btn btn-primary" onclick="viewSession(${session.id})">👁️ Details</button>
                        </div>
                    </div>
                    
                    <div>
                        <p><strong>Join Code:</strong></p>
                        <span class="join-code">${session.join_code}</span>
                        <button class="btn btn-copy" onclick="copyToClipboard('${session.join_code}')">📋 Kopieer Code</button>
                    </div>
                    
                    <div>
                        <p><strong>Join Link:</strong></p>
                        <div class="join-link">${joinUrl}</div>
                        <button class="btn btn-copy" onclick="copyToClipboard('${joinUrl}')">📋 Kopieer Link</button>
                    </div>
                    
                    ${session.team_count > 0 && session.teams && session.teams.length > 0 ? `
                        <div class="team-list">
                            <p><strong>Geregistreerde Teams (${session.team_count}):</strong></p>
                            <div>
                                ${session.teams.map(team => 
                                    `<span class="team-badge" style="background-color: ${team.color};">${team.name}</span>`
                                ).join('')}
                            </div>
                        </div>
                    ` : `
                        <div style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 5px; color: #856404;">
                            ⏳ Wacht op teams... (Refresh automatisch elke 5 seconden)
                        </div>
                    `}
                </div>
            `;
        }
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Failed to load sessions:', error);
    }
}

function setupEventListeners() {
    document.getElementById('create-session-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const cityId = parseInt(document.getElementById('city-select').value);
        const duration = parseInt(document.getElementById('duration-input').value);
        
        if (!cityId || !duration) {
            alert('Vul alle velden in');
            return;
        }
        
        try {
            const session = await api.createSession(cityId, duration);
            alert(`✅ Spel aangemaakt!\n\nJoin Code: ${session.join_code}\n\nStuur deze code naar de teams.`);
            
            // Reset form
            document.getElementById('duration-input').value = 120;
            
            // Reload sessions
            await loadSessions();
            
            // Scroll to the newly created session
            setTimeout(() => {
                const sessionsList = document.getElementById('sessions-list');
                if (sessionsList && sessionsList.firstChild) {
                    sessionsList.firstChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }, 100);
            
        } catch (error) {
            alert('❌ Fout: ' + error.message);
        }
    });
}

window.startSession = async function(sessionId) {
    if (!confirm('Dit spel nu starten? Teams kunnen daarna niet meer deelnemen.')) {
        return;
    }
    
    try {
        const result = await api.startSession(sessionId);
        alert(`✅ Spel gestart met ${result.team_count} teams!\n\nJe wordt nu doorverwezen naar het admin panel om inzendingen te bekijken.`);
        await loadSessions();
        
        // Redirect to admin panel to manage submissions
        setTimeout(() => {
            window.location.href = '/admin.html';
        }, 1000);
    } catch (error) {
        alert('❌ Fout: ' + error.message);
    }
};

window.deleteSession = async function(sessionId) {
    if (!confirm('Dit spel verwijderen? Alle teams worden ook verwijderd.')) {
        return;
    }
    
    try {
        await api.deleteSession(sessionId);
        alert('✅ Spel verwijderd');
        await loadSessions();
    } catch (error) {
        alert('❌ Fout: ' + error.message);
    }
};

window.viewSession = async function(sessionId) {
    try {
        const session = await api.getSession(sessionId);
        
        let msg = `Spel: ${session.city_name}\n`;
        msg += `Join Code: ${session.join_code}\n`;
        msg += `Duur: ${session.duration_minutes} minuten\n`;
        msg += `Status: ${session.is_finished ? 'Afgelopen' : session.is_active ? 'Actief' : 'Wacht op start'}\n`;
        msg += `Teams: ${session.team_count}\n\n`;
        
        if (session.teams.length > 0) {
            msg += 'Geregistreerde teams:\n';
            for (const team of session.teams) {
                msg += `- ${team.name} (${team.color})\n`;
            }
        }
        
        alert(msg);
        
    } catch (error) {
        alert('❌ Fout: ' + error.message);
    }
};

window.copyToClipboard = function(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Visual feedback
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '✅ Gekopieerd!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    }).catch(err => {
        alert('Kon niet kopiëren naar klembord');
        console.error('Copy failed:', err);
    });
};
