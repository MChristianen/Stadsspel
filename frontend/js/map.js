// Map module with Leaflet
import { api } from './api.js';
import { queueSubmission } from './offline_queue.js';

let map = null;
let areasLayer = null;
let currentAreaId = null;

export function initMap() {
    // Initialize Leaflet map
    map = L.map('map').setView([52.37, 4.89], 13);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
    }).addTo(map);

    // Create layer for areas
    areasLayer = L.geoJSON(null, {
        style: styleArea,
        onEachFeature: onEachArea,
    }).addTo(map);

    // Load areas
    loadAreas();

    // Refresh areas every 5 seconds (polling for realtime updates)
    setInterval(loadAreas, 5000);

    // Setup submission form
    setupSubmissionForm();
}

async function loadAreas() {
    try {
        const geojson = await api.getAreasGeoJSON();
        
        // Clear and update layer
        areasLayer.clearLayers();
        areasLayer.addData(geojson);

        // Store in localStorage for offline access
        localStorage.setItem('areas_cache', JSON.stringify(geojson));
    } catch (error) {
        console.error('Failed to load areas:', error);
        
        // Try to use cached data
        const cached = localStorage.getItem('areas_cache');
        if (cached) {
            const geojson = JSON.parse(cached);
            areasLayer.clearLayers();
            areasLayer.addData(geojson);
            showOfflineIndicator();
        }
    }
}

function styleArea(feature) {
    const ownership = feature.properties.ownership;
    
    return {
        fillColor: ownership?.owner_team_color || '#999999',
        fillOpacity: ownership?.owner_team_id ? 0.6 : 0.2,
        color: '#333',
        weight: 2,
    };
}

function onEachArea(feature, layer) {
    const props = feature.properties;
    const ownership = props.ownership;
    
    let popupContent = `
        <div class="area-popup">
            <h3>${props.name}</h3>
            <p><strong>Opdracht:</strong> ${props.challenge?.title || 'Geen opdracht'}</p>
    `;
    
    if (ownership?.owner_team_name) {
        popupContent += `
            <p><strong>Eigenaar:</strong> 
                <span style="color: ${ownership.owner_team_color}">${ownership.owner_team_name}</span>
            </p>
        `;
        
        if (ownership.current_high_score !== null) {
            popupContent += `<p><strong>Score:</strong> ${ownership.current_high_score}</p>`;
        }
    } else {
        popupContent += `<p><em>Nog niet geclaimd</em></p>`;
    }
    
    popupContent += `
            <button class="btn btn-primary" onclick="window.showAreaDetail(${props.id})">
                Details & Inzenden
            </button>
        </div>
    `;
    
    layer.bindPopup(popupContent);
    
    // Add center marker
    if (props.center) {
        const coords = props.center.coordinates;
        L.marker([coords[1], coords[0]])
            .bindPopup(popupContent)
            .addTo(map);
    }
}

// Global function to show area detail
window.showAreaDetail = async function(areaId) {
    currentAreaId = areaId;
    
    try {
        const area = await api.getAreaDetail(areaId);
        
        const modal = document.getElementById('area-modal');
        const detailDiv = document.getElementById('area-detail');
        
        let html = `
            <h2>${area.name}</h2>
            ${area.description ? `<p>${area.description}</p>` : ''}
            
            <h3>Opdracht: ${area.challenge.title}</h3>
            <p>${area.challenge.description}</p>
            <p><strong>Modus:</strong> ${area.challenge.mode === 'HIGHEST_SCORE_WINS' ? 'Hoogste score wint' : 'Laatst goedgekeurd wint'}</p>
        `;
        
        if (area.ownership?.owner_team_name) {
            html += `
                <div style="margin: 20px 0; padding: 15px; background: #e3f2fd; border-radius: 5px;">
                    <strong>Huidige eigenaar:</strong> 
                    <span style="color: ${area.ownership.owner_team_color}; font-weight: bold;">
                        ${area.ownership.owner_team_name}
                    </span>
            `;
            
            if (area.ownership.current_high_score !== null) {
                html += `<br><strong>Te verslaan score:</strong> ${area.ownership.current_high_score}`;
            }
            
            html += `</div>`;
        }
        
        html += `
            <button class="btn btn-primary" onclick="window.showSubmitModal(${areaId}, '${area.challenge.mode}')">
                📤 Opdracht Inzenden
            </button>
        `;
        
        detailDiv.innerHTML = html;
        modal.classList.add('show');
    } catch (error) {
        alert('Kon gebied niet laden: ' + error.message);
    }
};

window.showSubmitModal = function(areaId, challengeMode) {
    document.getElementById('area-modal').classList.remove('show');
    
    const modal = document.getElementById('submit-modal');
    document.getElementById('submit-area-id').value = areaId;
    
    // Show/hide score field based on challenge mode
    const scoreGroup = document.getElementById('score-group');
    if (challengeMode === 'HIGHEST_SCORE_WINS') {
        scoreGroup.style.display = 'block';
        document.getElementById('submit-score').required = true;
    } else {
        scoreGroup.style.display = 'none';
        document.getElementById('submit-score').required = false;
    }
    
    modal.classList.add('show');
};

function setupSubmissionForm() {
    const form = document.getElementById('submit-form');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const areaId = parseInt(document.getElementById('submit-area-id').value);
        const text = document.getElementById('submit-text').value;
        const scoreInput = document.getElementById('submit-score').value;
        const score = scoreInput ? parseFloat(scoreInput) : null;
        
        const photoFiles = Array.from(document.getElementById('submit-photos').files);
        const videoFiles = Array.from(document.getElementById('submit-videos').files);
        
        const errorDiv = document.getElementById('submit-error');
        errorDiv.style.display = 'none';
        
        try {
            if (navigator.onLine) {
                await api.createSubmission(areaId, text, score, photoFiles, videoFiles);
                alert('✅ Inzending verstuurd!');
            } else {
                // Queue for later
                queueSubmission({ areaId, text, score, photoFiles, videoFiles });
                alert('📡 Offline - inzending wordt verzonden zodra je online bent');
            }
            
            closeSubmitModal();
            form.reset();
        } catch (error) {
            if (error.message.includes('Cooldown')) {
                errorDiv.textContent = error.message;
                errorDiv.style.display = 'block';
            } else {
                alert('❌ Fout bij inzenden: ' + error.message);
            }
        }
    });
    
    // Close modals
    document.getElementById('close-area-modal').addEventListener('click', () => {
        document.getElementById('area-modal').classList.remove('show');
    });
    
    document.getElementById('close-submit-modal').addEventListener('click', closeSubmitModal);
}

function closeSubmitModal() {
    document.getElementById('submit-modal').classList.remove('show');
}

function showOfflineIndicator() {
    document.getElementById('offline-indicator').style.display = 'block';
}

export function refreshMap() {
    loadAreas();
}
