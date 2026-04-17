import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import { apiClient } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import 'leaflet/dist/leaflet.css';

const Game: React.FC = () => {
  const { team } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [submissionScore, setSubmissionScore] = useState<number>(50);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [error, setError] = useState('');

  // Queries
  const { data: gameStatus } = useQuery({
    queryKey: ['gameStatus'],
    queryFn: () => apiClient.getGameStatus(),
    refetchInterval: 5000,
  });

  // Redirect non-admin teams to waiting page if game is not active
  useEffect(() => {
    if (gameStatus && !gameStatus.is_active && !team?.is_admin) {
      navigate('/waiting');
    }
  }, [gameStatus, team, navigate]);

  const { data: areasData, isLoading: areasLoading, error: areasError } = useQuery({
    queryKey: ['areas'],
    queryFn: () => apiClient.getAreasGeoJSON(),
    refetchInterval: 3000, // Real-time updates elke 3 seconden
    retry: 1,
  });

  // Fetch cooldowns for current team
  const { data: cooldowns = [] } = useQuery({
    queryKey: ['cooldowns'],
    queryFn: () => apiClient.getMyCooldowns(),
    refetchInterval: 1000, // Update elke seconde voor accurate timer
    enabled: !!team?.game_session_id, // Only fetch if team has a session
    retry: false,
  });

  // Mutations
  const submitMutation = useMutation({
    mutationFn: ({ areaId, text, score, files }: any) => {
      return apiClient.createSubmission(areaId, text, score, files);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      queryClient.invalidateQueries({ queryKey: ['cooldowns'] });
      setSelectedAreaId(null);
      setSubmissionText('');
      setMediaFiles([]);
      setSubmissionScore(50);
      setError('');
      alert('Inzending verstuurd! Wacht op goedkeuring van een admin.');
    },
    onError: (err: any) => {
      console.error('Submission error:', err);
      let errorMsg = 'Inzenden mislukt';
      
      // Handle FastAPI validation errors (array of error objects)
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (Array.isArray(detail)) {
          // Validation errors - format them nicely
          errorMsg = detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ');
        } else if (typeof detail === 'string') {
          errorMsg = detail;
        } else {
          errorMsg = JSON.stringify(detail);
        }
      } else if (err.message) {
        errorMsg = err.message;
      }
      
      setError(errorMsg);
      alert('Fout: ' + errorMsg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAreaId) return;

    // Validate that at least one content type is provided
    const hasText = submissionText.trim().length > 0;
    const hasMedia = mediaFiles.length > 0;
    
    if (!hasText && !hasMedia) {
      setError('Je moet minimaal tekst, een foto of een video toevoegen');
      alert('Je moet minimaal tekst, een foto of een video toevoegen');
      return;
    }

    const selectedArea = areasData?.features.find(
      (f) => f.properties.id === selectedAreaId
    )?.properties;

    submitMutation.mutate({
      areaId: selectedAreaId,
      text: submissionText,
      score: selectedArea?.challenge?.mode === 'HIGHEST_SCORE_WINS' ? submissionScore : null,
      files: mediaFiles,
    });
  };

  const isCooldownActive = (areaId: number) => {
    const cooldown = cooldowns.find((cd) => cd.area_id === areaId);
    return cooldown ? !cooldown.can_submit : false;
  };

  const getCooldownTime = (areaId: number) => {
    const cooldown = cooldowns.find((cd) => cd.area_id === areaId);
    if (!cooldown || cooldown.remaining_seconds <= 0) return null;
    const minutes = Math.floor(cooldown.remaining_seconds / 60);
    const seconds = cooldown.remaining_seconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatOwnedTime = (ownedSeconds?: number | null) => {
    if (!ownedSeconds || ownedSeconds <= 0) return 'minder dan 1 minuut';
    const totalMinutes = Math.floor(ownedSeconds / 60);
    if (totalMinutes < 60) {
      return `${totalMinutes} ${totalMinutes === 1 ? 'minuut' : 'minuten'}`;
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (minutes === 0) {
      return `${hours} ${hours === 1 ? 'uur' : 'uur'}`;
    }
    return `${hours}u ${minutes}m`;
  };

  // Calculate map center from areas data - MUST be before any conditional returns
  const mapCenter: [number, number] = useMemo(() => {
    try {
      if (areasData && areasData.features && areasData.features.length > 0) {
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        areasData.features.forEach((feature: any) => {
          if (feature.geometry && feature.geometry.coordinates) {
            const coords = feature.geometry.coordinates[0]; // Polygon outer ring
            coords.forEach(([lng, lat]: [number, number]) => {
              minLat = Math.min(minLat, lat);
              maxLat = Math.max(maxLat, lat);
              minLng = Math.min(minLng, lng);
              maxLng = Math.max(maxLng, lng);
            });
          }
        });
        return [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
      }
    } catch (err) {
      console.error('Error calculating map center:', err);
    }
    return [52.3676, 4.9041]; // Fallback to Amsterdam
  }, [areasData]);

  // Calculate time remaining - MUST be before any conditional returns
  const timeRemaining = gameStatus?.remaining_seconds || 0;
  const hours = Math.floor(timeRemaining / 3600);
  const minutes = Math.floor((timeRemaining % 3600) / 60);
  const seconds = timeRemaining % 60;

  // Show loading state
  if (areasLoading || !gameStatus) {
    return (
      <div className="game-container">
        <h2>Laden...</h2>
      </div>
    );
  }

  // Show error state
  if (areasError) {
    return (
      <div className="game-container">
        <h2>Fout bij laden van het spel</h2>
        <p>Ververs de pagina</p>
      </div>
    );
  }

  // Show message for non-admin users when game is not active
  if (!gameStatus?.is_active && !team?.is_admin) {
    return (
      <div className="game-container">
        <h2>Spel niet actief</h2>
        <p>Wacht tot een admin het spel start.</p>
      </div>
    );
  }

  return (
    <div className="game-container">
      <div className="game-header">
        <h2>Stadsspel</h2>
        <div className="timer">
          {hours}:{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
        </div>
        <div className="team-info" style={{ backgroundColor: team?.color }}>
          {team?.name}
        </div>
      </div>

      <MapContainer
        center={mapCenter}
        zoom={13}
        style={{ height: '400px', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {areasData && (
          <GeoJSON
            data={areasData}
            style={(feature) => ({
              fillColor: feature?.properties.ownership?.owner_team_color || '#cccccc',
              fillOpacity: 0.5,
              color: '#000',
              weight: 2,
            })}
            onEachFeature={(feature, layer) => {
              layer.on({
                click: () => setSelectedAreaId(feature.properties.id),
              });
              
              const cooldownTime = getCooldownTime(feature.properties.id);
              const modeEmoji = feature.properties.challenge?.mode === 'LAST_APPROVED_WINS' ? '🏆' : '📊';
              const popupContent = `
                <div style="min-width: 200px;">
                  <h4 style="margin: 0 0 8px 0;">${feature.properties.name}</h4>
                  <p style="margin: 4px 0;"><strong>Opdracht:</strong><br/>${feature.properties.challenge?.title || 'Geen opdracht'}</p>
                  <p style="margin: 4px 0; font-size: 0.9em;">${feature.properties.challenge?.description || ''}</p>
                  <p style="margin: 4px 0;"><strong>Mode:</strong> ${modeEmoji} ${feature.properties.challenge?.mode === 'LAST_APPROVED_WINS' ? 'Laatst goedgekeurd wint' : 'Hoogste score wint'}</p>
                  ${feature.properties.ownership?.owner_team_name 
                    ? `<p style="margin: 4px 0;"><strong>Eigenaar:</strong> <span style="color: ${feature.properties.ownership.owner_team_color}; font-weight: bold;">${feature.properties.ownership.owner_team_name}</span></p>
                       <p style="margin: 4px 0;"><strong>In bezit sinds:</strong> ${formatOwnedTime(feature.properties.ownership.owned_seconds)}</p>` 
                    : '<p style="margin: 4px 0; color: #999;">Nog geen eigenaar</p>'}
                  ${feature.properties.ownership?.current_high_score !== null
                    ? `<p style="margin: 4px 0;"><strong>Top score:</strong> ${feature.properties.ownership.current_high_score} punten</p>`
                    : ''}
                  ${cooldownTime ? `<p style="margin: 4px 0; color: red;"><strong>⏱️ Cooldown:</strong> ${cooldownTime}</p>` : ''}
                  <button onclick="document.dispatchEvent(new CustomEvent('selectArea', {detail: ${feature.properties.id}}))" 
                    style="margin-top: 8px; padding: 6px 12px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;">
                    Selecteer gebied
                  </button>
                </div>
              `;
              layer.bindPopup(popupContent);
            }}
          />
        )}
      </MapContainer>

      {selectedAreaId && (
        <div className="submission-form">
          {(() => {
            const area = areasData?.features.find((f) => f.properties.id === selectedAreaId)?.properties;
            return (
              <>
                <h3>Inzenden voor {area?.name}</h3>
                <div className="area-challenge-info">
                  <p className="challenge-text">
                    <strong>Opdracht:</strong> {area?.challenge?.title || 'Geen opdracht'}
                  </p>
                  {area?.challenge?.description && (
                    <p className="challenge-description" style={{ fontSize: '0.9em', whiteSpace: 'pre-wrap' }}
                       dangerouslySetInnerHTML={{ __html: area.challenge.description.replace(/(https:\/\/maps\.google\.com\/[^\s)]+)/g, '<a href="$1" target="_blank" rel="noopener">📍 Open in Google Maps</a>') }} />
                  )}
                  <p className="challenge-mode">
                    <strong>Mode:</strong>{' '}
                    {area?.challenge?.mode === 'LAST_APPROVED_WINS'
                      ? '🏆 Laatst goedgekeurd wint'
                      : '📊 Hoogste score wint'}
                  </p>
                  {area?.ownership?.owner_team_name && (
                    <p className="current-owner">
                      <strong>Huidige eigenaar:</strong>{' '}
                      <span style={{ color: area.ownership.owner_team_color || undefined }}>{area.ownership.owner_team_name}</span>
                    </p>
                  )}
                  {area?.ownership?.owner_team_name && (
                    <p className="current-owner">
                      <strong>In bezit sinds:</strong> {formatOwnedTime(area.ownership.owned_seconds)}
                    </p>
                  )}
                  {area?.ownership?.current_high_score !== null && area?.ownership && (
                    <p className="top-score">
                      <strong>Hoogste score:</strong> {area?.ownership.current_high_score} punten
                    </p>
                  )}
                </div>
          
                {isCooldownActive(selectedAreaId) && (
                  <div style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    padding: '20px',
                    borderRadius: '12px',
                    marginTop: '15px',
                    marginBottom: '15px',
                    textAlign: 'center',
                    border: '3px solid #764ba2',
                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '10px' }}>⏱️</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>
                      Cooldown Actief
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', letterSpacing: '2px' }}>
                      {getCooldownTime(selectedAreaId)}
                    </div>
                    <div style={{ fontSize: '14px', marginTop: '10px', opacity: 0.9 }}>
                      Je kunt over deze tijd weer een nieuwe poging doen
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          <form onSubmit={handleSubmit}>
            <div style={{
              background: '#fff3cd',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '15px',
              border: '2px solid #ffc107'
            }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#856404' }}>
                ℹ️ <strong>Verplicht:</strong> Voeg minimaal één van de volgende toe: tekst, foto, of video
              </p>
            </div>

            <div className="form-group">
              <label>Tekst (optioneel)</label>
              <textarea
                value={submissionText}
                onChange={(e) => setSubmissionText(e.target.value)}
                rows={4}
                disabled={isCooldownActive(selectedAreaId)}
                placeholder="Beschrijf je inzending..."
              />
            </div>

            {areasData?.features.find((f) => f.properties.id === selectedAreaId)?.properties.challenge?.mode === 'HIGHEST_SCORE_WINS' && (
              <div className="form-group">
                <label>Score *</label>
                <input
                  type="number"
                  value={submissionScore}
                  onChange={(e) => setSubmissionScore(Number(e.target.value))}
                  min="0"
                  step="1"
                  required
                  disabled={isCooldownActive(selectedAreaId)}
                  placeholder="Bijv. 4 biertjes = score 4"
                />
                <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                  De admin beoordeelt of je score correct is
                </p>
              </div>
            )}

            <div className="form-group">
              <label>Foto's / Video's (optioneel)</label>
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={(e) => setMediaFiles(Array.from(e.target.files || []))}
                disabled={isCooldownActive(selectedAreaId)}
              />
              {mediaFiles.length > 0 && (
                <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                  {mediaFiles.length} bestand(en) geselecteerd
                </p>
              )}
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="form-actions">
              <button
                type="button"
                onClick={() => setSelectedAreaId(null)}
                className="btn-secondary"
              >
                Annuleren
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={submitMutation.isPending || isCooldownActive(selectedAreaId)}
              >
                {submitMutation.isPending ? 'Verzenden...' : 'Verzenden'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Game;
