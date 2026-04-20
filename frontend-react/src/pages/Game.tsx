import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import { apiClient } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import 'leaflet/dist/leaflet.css';

const Game: React.FC = () => {
  const photoCameraInputRef = useRef<HTMLInputElement>(null);
  const videoCameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const { team } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const assignmentFormRef = useRef<HTMLDivElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const isSubmittingRef = useRef(false);
  // Live countdown: tick locally between server polls
  const [localSecondsLeft, setLocalSecondsLeft] = useState<number>(0);
  const prevSubmissionStatusRef = useRef<Record<number, string>>({});

  useEffect(() => {
    const handleSelectArea = (event: Event) => {
      const areaId = (event as CustomEvent<number>).detail;
      setSelectedAreaId(areaId);
    };

    document.addEventListener('selectArea', handleSelectArea);
    return () => document.removeEventListener('selectArea', handleSelectArea);
  }, []);

  // Only the popup button changes selectedAreaId, so the form scroll happens from that action.
  useEffect(() => {
    if (selectedAreaId && assignmentFormRef.current) {
      assignmentFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedAreaId]);

  const [submissionText, setSubmissionText] = useState('');
  const [submissionScore, setSubmissionScore] = useState<number>(50);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [error, setError] = useState('');

  const addMediaFiles = (files: FileList | null) => {
    if (files && files.length > 0) {
      setMediaFiles((prev) => [...prev, ...Array.from(files)]);
    }
  };

  // Queries
  const { data: gameStatus } = useQuery({
    queryKey: ['gameStatus'],
    queryFn: () => apiClient.getGameStatus(),
    refetchInterval: 5000,
  });

  // Redirect non-admin teams based on game state
  useEffect(() => {
    if (!gameStatus || team?.is_admin) return;
    if (gameStatus.is_finished && gameStatus.join_code) {
      navigate(`/results/${gameStatus.join_code}`, { replace: true });
    } else if (!gameStatus.is_active) {
      navigate('/waiting');
    }
  }, [gameStatus, team, navigate]);

  const { data: areasData, isLoading: areasLoading, error: areasError } = useQuery({
    queryKey: ['areas'],
    queryFn: () => apiClient.getAreasGeoJSON(),
    refetchInterval: 3000, // Real-time updates elke 3 seconden
    retry: 1,
  });

  // Sync server remaining_seconds into local countdown; tick down locally between polls
  useEffect(() => {
    if (gameStatus?.remaining_seconds != null && !gameStatus.is_paused) {
      setLocalSecondsLeft(gameStatus.remaining_seconds);
    }
  }, [gameStatus?.remaining_seconds, gameStatus?.is_paused]);

  useEffect(() => {
    if (!gameStatus?.is_active || gameStatus?.is_paused || gameStatus?.is_finished) return;
    const id = setInterval(() => setLocalSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [gameStatus?.is_active, gameStatus?.is_paused, gameStatus?.is_finished]);

  // Fetch cooldowns for current team
  const { data: cooldowns = [] } = useQuery({
    queryKey: ['cooldowns'],
    queryFn: () => apiClient.getMyCooldowns(),
    refetchInterval: 1000, // Update elke seconde voor accurate timer
    enabled: !!team?.game_session_id, // Only fetch if team has a session
    retry: false,
  });

  // Poll own submissions to detect rejections and notify the team
  const { data: mySubmissions = [] } = useQuery({
    queryKey: ['mySubmissions'],
    queryFn: () => apiClient.getMySubmissions(),
    refetchInterval: 10000,
    enabled: !!team?.game_session_id,
  });

  useEffect(() => {
    if (mySubmissions.length === 0) return;
    mySubmissions.forEach((sub: any) => {
      const prev = prevSubmissionStatusRef.current[sub.id];
      if (prev && prev !== sub.status && sub.status === 'REJECTED') {
        showToast(`Inzending voor ${sub.area_name} is afgewezen`, 'error', 8000);
      }
      if (prev && prev !== sub.status && sub.status === 'APPROVED') {
        showToast(`Inzending voor ${sub.area_name} is goedgekeurd!`, 'success', 6000);
      }
    });
    const next: Record<number, string> = {};
    mySubmissions.forEach((sub: any) => { next[sub.id] = sub.status; });
    prevSubmissionStatusRef.current = next;
  }, [mySubmissions, showToast]);

  // Mutations
  const submitMutation = useMutation({
    mutationFn: ({ areaId, text, score, files }: any) => {
      setUploadProgress(0);
      return apiClient.createSubmission(areaId, text, score, files, (pct) => setUploadProgress(pct));
    },
    onSuccess: () => {
      isSubmittingRef.current = false;
      setUploadProgress(null);
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      queryClient.invalidateQueries({ queryKey: ['cooldowns'] });
      queryClient.invalidateQueries({ queryKey: ['mySubmissions'] });
      setSelectedAreaId(null);
      setSubmissionText('');
      setMediaFiles([]);
      setSubmissionScore(50);
      setError('');
      showToast('Inzending verstuurd! Wacht op goedkeuring van een admin.', 'success');
    },
    onError: (err: any) => {
      isSubmittingRef.current = false;
      setUploadProgress(null);
      let errorMsg = 'Inzenden mislukt';
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (Array.isArray(detail)) {
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
      showToast('Fout: ' + errorMsg, 'error');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAreaId) return;
    if (isSubmittingRef.current) return;

    const hasMedia = mediaFiles.length > 0;
    if (!hasMedia) {
      setError('Je moet minimaal een foto of video toevoegen');
      showToast('Je moet minimaal een foto of video toevoegen', 'warning');
      return;
    }

    const selectedArea = areasData?.features.find(
      (f) => f.properties.id === selectedAreaId
    )?.properties;

    isSubmittingRef.current = true;
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

  // Use local countdown for smooth display
  const displaySeconds = gameStatus?.is_paused
    ? (gameStatus.remaining_seconds ?? 0)
    : localSecondsLeft;
  const hours = Math.floor(displaySeconds / 3600);
  const minutes = Math.floor((displaySeconds % 3600) / 60);
  const seconds = displaySeconds % 60;
  const areasRenderKey = useMemo(
    () =>
      areasData?.features
        .map((feature) => {
          const ownership = feature.properties.ownership;
          return `${feature.properties.id}:${ownership?.owner_team_id ?? 'none'}:${ownership?.owner_team_color ?? 'none'}:${ownership?.current_high_score ?? 'none'}`;
        })
        .join('|') ?? 'no-areas',
    [areasData]
  );

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

      {gameStatus?.is_paused && (
        <div style={{
          background: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
          color: '#333',
          padding: '12px 20px',
          borderRadius: '12px',
          marginBottom: '12px',
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: '1.05em',
        }}>
          ⏸ Spel is gepauzeerd — wacht op de admin
        </div>
      )}


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
            key={areasRenderKey}
            data={areasData}
            style={(feature) => ({
              fillColor: feature?.properties.ownership?.owner_team_color || '#cccccc',
              fillOpacity: 0.5,
              color: '#000',
              weight: 2,
            })}
            onEachFeature={(feature, layer) => {
              const cooldownTime = getCooldownTime(feature.properties.id);
              const modeEmoji = feature.properties.challenge?.mode === 'LAST_APPROVED_WINS' ? '🏆' : '📊';
              const rawDesc = feature.properties.challenge?.description || '';
              const popupDesc = rawDesc.replace(/\s*\(https:\/\/maps\.google\.com\/[^)]+\)/g, '');
              const popupContent = `
                <div style="min-width: 200px;">
                  <h4 style="margin: 0 0 8px 0;">${feature.properties.name}</h4>
                  <p style="margin: 4px 0;"><strong>Opdracht:</strong><br/>${feature.properties.challenge?.title || 'Geen opdracht'}</p>
                  <p style="margin: 4px 0; font-size: 0.9em;">${popupDesc}</p>
                  <p style="margin: 4px 0; font-size: 0.85em; color: #667eea;">📍 Tik op "Selecteer gebied" voor de locatie.</p>
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
        <div className="submission-form" ref={assignmentFormRef}>
          {(() => {
            const area = areasData?.features.find((f) => f.properties.id === selectedAreaId)?.properties;
            return (
              <>
                {/* Gebied + opdrachttitel in paarse header */}
                <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', borderRadius: '12px', padding: '16px 20px', marginBottom: '0' }}>
                  <div style={{ fontSize: '0.8em', opacity: 0.8, marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Geselecteerd gebied</div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '1.3em' }}>{area?.name}</h3>
                  <div style={{ fontWeight: 'bold', fontSize: '1.05em' }}>
                    {area?.challenge?.title || 'Geen opdracht'}
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '0.85em', opacity: 0.85 }}>
                    <span>{area?.challenge?.mode === 'LAST_APPROVED_WINS' ? '🏆 Laatst goedgekeurd wint' : '📊 Hoogste score wint'}</span>
                    {area?.ownership?.current_high_score != null && (
                      <span style={{ marginLeft: '12px' }}>⭐ Top: {area.ownership.current_high_score} punten</span>
                    )}
                  </div>
                </div>

                {/* Prominent ownership badge */}
                {area?.ownership?.owner_team_name ? (
                  <div style={{
                    background: area.ownership.owner_team_color,
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.95em',
                    fontWeight: 'bold',
                    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                  }}>
                    <span style={{ fontSize: '1.3em' }}>👑</span>
                    <span>In bezit van {area.ownership.owner_team_name}</span>
                    <span style={{ marginLeft: 'auto', fontWeight: 'normal', opacity: 0.9, fontSize: '0.88em' }}>
                      {formatOwnedTime(area.ownership.owned_seconds)}
                    </span>
                  </div>
                ) : (
                  <div style={{
                    background: '#e8f5e9',
                    color: '#2e7d32',
                    padding: '8px 20px',
                    fontSize: '0.88em',
                    fontWeight: 'bold',
                  }}>
                    Nog geen eigenaar — wees de eerste!
                  </div>
                )}

                {/* Beschrijving in apart wit blok eronder — donkere tekst voor leesbaarheid */}
                {area?.challenge?.description && (() => {
                  const desc = area.challenge.description;
                  const urlMatch = desc.match(/https:\/\/maps\.google\.com\/[^\s)]+/);
                  const mapsUrl = urlMatch ? urlMatch[0] : null;
                  const cleanDesc = desc.replace(/\s*\(https:\/\/maps\.google\.com\/[^)]+\)/g, '');
                  return (
                    <div style={{ background: '#f8f9ff', border: '1px solid #e0e4ff', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '14px 20px', marginBottom: '16px', fontSize: '0.95em', lineHeight: '1.6', color: '#333', whiteSpace: 'pre-wrap' }}>
                      <span dangerouslySetInnerHTML={{ __html: cleanDesc }} />
                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'block',
                            marginTop: '14px',
                            padding: '11px 16px',
                            background: '#4285f4',
                            color: 'white',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            fontWeight: 'bold',
                            textAlign: 'center',
                            fontSize: '0.95em',
                          }}
                        >
                          📍 Open locatie in Google Maps
                        </a>
                      )}
                    </div>
                  );
                })()}
          
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
                ℹ️ <strong>Verplicht:</strong> Voeg minimaal een foto of video toe
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
              <label>Foto's / Video's <span style={{color: 'red'}}>*</span></label>
              {/* Hidden inputs — triggered programmatically via ref.current.click() from button onClick */}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                ref={photoCameraInputRef}
                onChange={(e) => { addMediaFiles(e.target.files); e.target.value = ''; }}
              />
              <input
                type="file"
                accept="video/*"
                capture="environment"
                style={{ display: 'none' }}
                ref={videoCameraInputRef}
                onChange={(e) => { addMediaFiles(e.target.files); e.target.value = ''; }}
              />
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                style={{ display: 'none' }}
                ref={galleryInputRef}
                onChange={(e) => { addMediaFiles(e.target.files); e.target.value = ''; }}
              />
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ flex: 1 }}
                  disabled={isCooldownActive(selectedAreaId)}
                  onClick={() => photoCameraInputRef.current?.click()}
                >
                  📷 Maak foto
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ flex: 1 }}
                  disabled={isCooldownActive(selectedAreaId)}
                  onClick={() => videoCameraInputRef.current?.click()}
                >
                  🎥 Maak video
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  disabled={isCooldownActive(selectedAreaId)}
                  onClick={() => galleryInputRef.current?.click()}
                >
                  🖼️ Kies uit galerij
                </button>
              </div>
              {mediaFiles.length > 0 ? (
                <div style={{ fontSize: '13px', color: '#444', marginTop: '4px' }}>
                  <strong>{mediaFiles.length} bestand(en) toegevoegd:</strong>
                  <ul style={{ margin: '4px 0 0 0', paddingLeft: '18px' }}>
                    {mediaFiles.map((f, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{f.type.startsWith('video/') ? '🎥' : '📷'} {f.name}</span>
                        <button
                          type="button"
                          onClick={() => setMediaFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          style={{ background: 'none', border: 'none', color: '#c00', cursor: 'pointer', fontSize: '14px', padding: '0' }}
                        >✕</button>
                      </li>
                    ))}
                  </ul>
                  <p style={{ margin: '4px 0 0 0', color: '#666' }}>Druk nogmaals op een knop om meer toe te voegen.</p>
                </div>
              ) : (
                <p style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                  Je kunt meerdere foto's en video's toevoegen aan één inzending.
                </p>
              )}
            </div>

            {error && <div className="error-message">{error}</div>}

            {uploadProgress !== null && (
              <div style={{ margin: '10px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span>Uploaden...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div style={{ background: '#e0e0e0', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                  <div style={{
                    background: 'linear-gradient(90deg, #667eea, #764ba2)',
                    height: '100%',
                    width: `${uploadProgress}%`,
                    transition: 'width 0.2s ease',
                    borderRadius: '6px',
                  }} />
                </div>
              </div>
            )}

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
                {submitMutation.isPending ? `Verzenden${uploadProgress !== null ? ` (${uploadProgress}%)` : '...'}` : 'Verzenden'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Game;
