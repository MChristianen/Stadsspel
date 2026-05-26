// Map module with Leaflet
import { api } from './api.js';
import { queueSubmission } from './offline_queue.js';
import { getCurrentUser } from './auth.js';

let map = null;
let areasLayer = null;
let challengePointLayer = null;
let currentAreaId = null;
let currentPosition = null;
let featuresById = {};

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

    challengePointLayer = L.layerGroup().addTo(map);

    // Load areas
    loadAreas();

    // Refresh areas every 5 seconds (polling for realtime updates)
    setInterval(loadAreas, 5000);

    startGpsTracking();

    // Setup submission form
    setupSubmissionForm();
}

function startGpsTracking() {
    if (!navigator.geolocation) return;
    navigator.geolocation.watchPosition(
        (pos) => {
            currentPosition = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        },
        () => { /* permission denied — currentPosition stays null */ },
        { enableHighAccuracy: true, maximumAge: 10000 }
    );
}

function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const dphi = (lat2 - lat1) * Math.PI / 180;
    const dlambda = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

async function loadAreas() {
    try {
        const geojson = await api.getAreasGeoJSON();

        // Index features by area ID for proximity lookups
        featuresById = {};
        for (const feature of geojson.features) {
            featuresById[feature.properties.id] = feature.properties;
        }

        // Clear and update layer
        areasLayer.clearLayers();
        areasLayer.addData(geojson);

        // Render challenge point markers (visible to all users including tikkers)
        challengePointLayer.clearLayers();
        for (const feature of geojson.features) {
            const props = feature.properties;
            if (props.challenge_point) {
                const [lon, lat] = props.challenge_point.coordinates;
                L.circleMarker([lat, lon], {
                    radius: 7,
                    color: '#2c3e50',
                    fillColor: '#f39c12',
                    fillOpacity: 1,
                    weight: 2,
                }).addTo(challengePointLayer)
                  .bindTooltip(`📍 ${props.name}`, { direction: 'top' });
            }
        }

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

    const cached = featuresById[areaId] || {};
    const proximityEnabled = cached.proximity_enabled || false;
    const proximityRadius = cached.proximity_radius || 150;
    const challengePoint = cached.challenge_point;
    const currentUser = getCurrentUser();

    // Proximity check for non-admins
    if (proximityEnabled && !currentUser?.is_admin && challengePoint) {
        if (!currentPosition) {
            showProximityBlock(areaId, null, proximityRadius);
            return;
        }
        const [cpLon, cpLat] = challengePoint.coordinates;
        const distance = haversineDistance(currentPosition.lat, currentPosition.lon, cpLat, cpLon);
        if (distance > proximityRadius) {
            showProximityBlock(areaId, Math.round(distance), proximityRadius);
            return;
        }
    }

    try {
        const area = await api.getAreaDetail(areaId);

        const modal = document.getElementById('area-modal');
        const detailDiv = document.getElementById('area-detail');

        let html = `<h2>${area.name}</h2>`;
        if (area.description) html += `<p>${area.description}</p>`;

        if (area.challenge?.title) {
            html += `
                <h3>Opdracht: ${area.challenge.title}</h3>
                <p>${area.challenge.description}</p>
                <p><strong>Modus:</strong> ${area.challenge.mode === 'HIGHEST_SCORE_WINS' ? 'Hoogste score wint' : 'Laatst goedgekeurd wint'}</p>
            `;
        } else {
            html += `<p><em>Je kunt de opdracht niet zien op deze locatie.</em></p>`;
        }

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

        if (area.challenge?.title) {
            html += `
                <button class="btn btn-primary" onclick="window.showSubmitModal(${areaId}, '${area.challenge.mode}')">
                    📤 Opdracht Inzenden
                </button>
            `;
        }

        detailDiv.innerHTML = html;
        modal.classList.add('show');
    } catch (error) {
        alert('Kon gebied niet laden: ' + error.message);
    }
};

function showProximityBlock(areaId, distance, radius) {
    const modal = document.getElementById('area-modal');
    const detailDiv = document.getElementById('area-detail');
    const cached = featuresById[areaId] || {};

    let message;
    if (distance === null) {
        message = 'Zet je GPS aan om de opdracht te onthullen. De app heeft je locatie nodig.';
    } else {
        message = `Je bent ${distance}m van het opdrachtpunt. Loop binnen ${radius}m om de opdracht te onthullen.`;
    }

    detailDiv.innerHTML = `
        <h2>${cached.name || 'Gebied'}</h2>
        <div style="margin: 20px 0; padding: 15px; background: #fff3cd; border-radius: 5px; border-left: 4px solid #f39c12;">
            <strong>📍 Nabijheid vereist</strong><br>${message}
        </div>
    `;
    modal.classList.add('show');
}

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
        
        const lat = currentPosition?.lat ?? null;
        const lon = currentPosition?.lon ?? null;

        try {
            if (navigator.onLine) {
                await api.createSubmission(areaId, text, score, photoFiles, videoFiles, lat, lon);
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
