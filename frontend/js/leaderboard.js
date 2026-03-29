// Leaderboard module
import { api } from './api.js';

export function initLeaderboard() {
    loadLeaderboard();
    
    // Refresh every 5 seconds
    setInterval(loadLeaderboard, 5000);
}

async function loadLeaderboard() {
    try {
        const response = await api.getLeaderboard();
        displayLeaderboard(response.leaderboard);
    } catch (error) {
        console.error('Failed to load leaderboard:', error);
    }
}

function displayLeaderboard(leaderboard) {
    const listEl = document.getElementById('leaderboard-list');
    
    if (!leaderboard || leaderboard.length === 0) {
        listEl.innerHTML = '<p style="text-align: center; color: #757575;">Nog geen teams op het bord</p>';
        return;
    }
    
    let html = '';
    
    for (const entry of leaderboard) {
        let rankClass = '';
        let rankEmoji = '';
        
        if (entry.rank === 1) {
            rankClass = 'gold';
            rankEmoji = '🥇';
        } else if (entry.rank === 2) {
            rankClass = 'silver';
            rankEmoji = '🥈';
        } else if (entry.rank === 3) {
            rankClass = 'bronze';
            rankEmoji = '🥉';
        }
        
        html += `
            <div class="leaderboard-entry">
                <div class="leaderboard-rank ${rankClass}">
                    ${rankEmoji || entry.rank}
                </div>
                <div class="team-color-dot" style="background: ${entry.team_color}"></div>
                <div class="leaderboard-info">
                    <h3>${entry.team_name}</h3>
                    <small>${entry.territory_count} ${entry.territory_count === 1 ? 'gebied' : 'gebieden'}</small>
                </div>
                <div class="leaderboard-score">${entry.territory_count}</div>
            </div>
        `;
    }
    
    listEl.innerHTML = html;
}
