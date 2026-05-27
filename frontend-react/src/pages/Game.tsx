import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { BackgroundGeolocationPlugin, Location as GpsLocation, CallbackError } from '@capacitor-community/background-geolocation';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');
import { apiClient } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import 'leaflet/dist/leaflet.css';

const createColorMarker = (color: string, label: string) =>
  L.divIcon({
    className: '',
    html: `<div title="${label}" style="width:18px;height:18px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

const createPinMarker = (label: string) =>
  L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="28" viewBox="0 0 20 28"><title>${label}</title><path d="M10 0C4.5 0 0 4.5 0 10c0 7.5 10 18 10 18S20 17.5 20 10C20 4.5 15.5 0 10 0z" fill="#e53935" stroke="white" stroke-width="1.5"/><circle cx="10" cy="10" r="3.5" fill="white"/></svg>`,
    iconSize: [20, 28],
    iconAnchor: [10, 28],
  });

const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const Game: React.FC = () => {
  const { team } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const assignmentFormRef = useRef<HTMLDivElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const isSubmittingRef = useRef(false);
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

  useEffect(() => {
    if (selectedAreaId && assignmentFormRef.current) {
      assignmentFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedAreaId]);

  const [submissionText, setSubmissionText] = useState('');
  const [submissionScore, setSubmissionScore] = useState<number | null>(null);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [error, setError] = useState('');

  // Tikker: tag team selector
  const [showTagPanel, setShowTagPanel] = useState(false);

  // GPS: own position
  const [ownPosition, setOwnPosition] = useState<{ lat: number; lng: number } | null>(null);
  const ownPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'waiting' | 'active' | 'denied' | 'unavailable'>('waiting');

  const addMediaFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    setMediaFiles((prev) => [...prev, ...fileArray]);
  };

  // Queries
  const { data: gameStatus } = useQuery({
    queryKey: ['gameStatus'],
    queryFn: () => apiClient.getGameStatus(),
    refetchInterval: 5000,
  });

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
    refetchInterval: 3000,
    retry: 1,
  });

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

  const { data: cooldowns = [] } = useQuery({
    queryKey: ['cooldowns'],
    queryFn: () => apiClient.getMyCooldowns(),
    refetchInterval: 1000,
    enabled: !!team?.game_session_id,
    retry: false,
  });

  const { data: mySubmissions = [] } = useQuery({
    queryKey: ['mySubmissions'],
    queryFn: () => apiClient.getMySubmissions(),
    refetchInterval: 10000,
    enabled: !!team?.game_session_id,
  });

  // Tikker status poll — all teams need this
  const { data: tikkerStatus } = useQuery({
    queryKey: ['tikkerStatus'],
    queryFn: () => apiClient.getTikkerStatus(),
    refetchInterval: 5000,
    enabled: !!team?.game_session_id && !!gameStatus?.is_active,
  });

  // GPS: watch own position — native app uses background plugin, browser uses watchPosition
  useEffect(() => {
    if (!gameStatus?.is_active) return;

    if (Capacitor.isNativePlatform()) {
      let watcherId: string | null = null;
      BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: 'Stadsspel volgt je locatie.',
          backgroundTitle: 'Stadsspel is actief',
          requestPermissions: true,
          stale: false,
          distanceFilter: 0,
        },
        (position?: GpsLocation, error?: CallbackError) => {
          if (error) {
            if (error.code === 'NOT_AUTHORIZED') setGpsStatus('denied');
            return;
          }
          if (position) {
            const p = { lat: position.latitude, lng: position.longitude };
            setOwnPosition(p);
            ownPositionRef.current = p;
            setGpsStatus('active');
          }
        },
      ).then((id: string) => { watcherId = id; });
      return () => {
        if (watcherId) BackgroundGeolocation.removeWatcher({ id: watcherId });
      };
    }

    if (!navigator.geolocation) {
      setGpsStatus('unavailable');
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setOwnPosition(p);
        ownPositionRef.current = p;
        setGpsStatus('active');
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setGpsStatus('denied');
      },
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [gameStatus?.is_active]);

  // GPS: send own position to backend every 10s
  useEffect(() => {
    if (!gameStatus?.is_active) return;
    const id = setInterval(() => {
      const p = ownPositionRef.current;
      if (p) apiClient.updateLocation(p.lat, p.lng).catch(() => {});
    }, 10000);
    return () => clearInterval(id);
  }, [gameStatus?.is_active]);

  // Tikker: fetch all team locations
  const { data: teamLocations = [] } = useQuery({
    queryKey: ['teamLocations'],
    queryFn: () => apiClient.getLocations(),
    enabled: !!tikkerStatus?.is_tikker && !!gameStatus?.is_active,
    refetchInterval: 5000,
  });

  // Session teams — needed for tikker tag panel
  const { data: sessionTeams = [] } = useQuery({
    queryKey: ['sessionTeamsGame'],
    queryFn: () => apiClient.getTaggableTeams(),
    enabled: !!tikkerStatus?.is_tikker,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (mySubmissions.length === 0) return;
    mySubmissions.forEach((sub) => {
      const prev = prevSubmissionStatusRef.current[sub.id];
      if (prev && prev !== sub.status && sub.status === 'REJECTED') {
        showToast(`Inzending voor ${sub.area_name} is afgewezen`, 'error', 8000);
      }
      if (prev && prev !== sub.status && sub.status === 'APPROVED') {
        showToast(`Inzending voor ${sub.area_name} is goedgekeurd!`, 'success', 6000);
      }
    });
    const next: Record<number, string> = {};
    mySubmissions.forEach((sub) => { next[sub.id] = sub.status; });
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
      setSubmissionScore(null);
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

  const tagMutation = useMutation({
    mutationFn: (targetTeamId: number) => apiClient.tagTeam(targetTeamId),
    onSuccess: (_, targetTeamId) => {
      const targetName = sessionTeams.find((t) => t.id === targetTeamId)?.name ?? 'het team';
      showToast(`Tikverzoek verstuurd naar ${targetName}!`, 'info');
      setShowTagPanel(false);
      queryClient.invalidateQueries({ queryKey: ['tikkerStatus'] });
    },
    onError: (err: any) => {
      showToast(err.response?.data?.detail ?? 'Tikken mislukt', 'error');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => apiClient.confirmTag(),
    onSuccess: () => {
      showToast('Jullie zijn nu de tikker!', 'warning', 8000);
      queryClient.invalidateQueries({ queryKey: ['tikkerStatus'] });
    },
    onError: (err: any) => {
      showToast(err.response?.data?.detail ?? 'Bevestigen mislukt', 'error');
    },
  });

  const denyMutation = useMutation({
    mutationFn: () => apiClient.denyTag(),
    onSuccess: () => {
      showToast('Tikverzoek afgewezen.', 'info');
      queryClient.invalidateQueries({ queryKey: ['tikkerStatus'] });
    },
    onError: (err: any) => {
      showToast(err.response?.data?.detail ?? 'Afwijzen mislukt', 'error');
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
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

    const isHighestScore = selectedArea?.challenge?.mode === 'HIGHEST_SCORE_WINS';
    if (isHighestScore && (submissionScore === null || submissionScore < 0)) {
      const scoreDesc = selectedArea?.challenge?.score_description;
      const msg = scoreDesc
        ? `Vergeet je score niet: "${scoreDesc}"`
        : 'Je moet een score invullen voor deze opdracht';
      setError(msg);
      showToast(msg, 'warning');
      return;
    }

    isSubmittingRef.current = true;
    submitMutation.mutate({
      areaId: selectedAreaId,
      text: submissionText,
      score: isHighestScore ? submissionScore : null,
      files: mediaFiles,
    });
  };

  const getProximityState = (areaId: number): 'near' | 'far' | 'unknown' | 'disabled' => {
    const feature = areasData?.features.find((f) => f.properties.id === areaId);
    if (!feature) return 'disabled';
    if (!feature.properties.proximity_enabled) return 'disabled';
    if (team?.is_admin) return 'near';
    if (!ownPosition) return 'unknown';
    const cp = feature.properties.challenge_point;
    if (!cp) return 'disabled';
    const dist = haversineDistance(ownPosition.lat, ownPosition.lng, cp.coordinates[1], cp.coordinates[0]);
    return dist <= feature.properties.proximity_radius ? 'near' : 'far';
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
    if (minutes === 0) return `${hours} uur`;
    return `${hours}u ${minutes}m`;
  };

  const mapCenter: [number, number] = useMemo(() => {
    try {
      if (areasData && areasData.features && areasData.features.length > 0) {
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        areasData.features.forEach((feature: any) => {
          if (feature.geometry && feature.geometry.coordinates) {
            const coords = feature.geometry.coordinates[0];
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
    return [52.3676, 4.9041];
  }, [areasData]);

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

  if (areasLoading || !gameStatus) {
    return <div className="game-container"><h2>Laden...</h2></div>;
  }

  if (areasError) {
    return <div className="game-container"><h2>Fout bij laden van het spel</h2><p>Ververs de pagina</p></div>;
  }

  if (!gameStatus?.is_active && !team?.is_admin) {
    return <div className="game-container"><h2>Spel niet actief</h2><p>Wacht tot een admin het spel start.</p></div>;
  }

  const pendingRequest = tikkerStatus?.pending_request ?? null;

  // Pending tag targeting THIS team
  const incomingTag = team?.id && pendingRequest?.target_team_id === team.id ? pendingRequest : null;

  // Pending tag sent by THIS team (tikker waiting for confirmation)
  const outgoingTag = team?.id && tikkerStatus?.is_tikker && pendingRequest?.initiating_team_id === team.id
    ? pendingRequest
    : null;

  const otherTeams = sessionTeams.filter((t) => t.id !== team?.id && !t.is_tikker);

  return (
    <div className="game-container">
      <div className="game-header">
        <h2>Stadsspel</h2>
        <div className="timer">
          {hours}:{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
        </div>
        <div className="team-info" style={{ backgroundColor: team?.color }}>
          {team?.name}
          {tikkerStatus?.is_tikker && <span style={{ marginLeft: '6px' }}>🏃</span>}
        </div>
      </div>

      {/* GPS status indicator */}
      {gameStatus?.is_active && (
        <div style={{ fontSize: '12px', color: gpsStatus === 'active' ? '#2e7d32' : gpsStatus === 'denied' || gpsStatus === 'unavailable' ? '#c62828' : '#888', marginBottom: '6px', textAlign: 'center' }}>
          {gpsStatus === 'waiting' && '📍 GPS ophalen…'}
          {gpsStatus === 'active' && `📍 GPS actief (${ownPosition?.lat.toFixed(4)}, ${ownPosition?.lng.toFixed(4)})`}
          {gpsStatus === 'denied' && '📍 GPS geweigerd — sta locatie toe in je browser'}
          {gpsStatus === 'unavailable' && '📍 GPS niet beschikbaar in deze browser'}
        </div>
      )}

      {gameStatus?.is_paused && (
        <div style={{
          background: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
          color: '#333', padding: '12px 20px', borderRadius: '12px',
          marginBottom: '12px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.05em',
        }}>
          ⏸ Spel is gepauzeerd — wacht op de admin
        </div>
      )}

      {/* Incoming tag confirmation banner */}
      {incomingTag && (
        <div style={{
          background: 'linear-gradient(135deg, #e53935 0%, #c62828 100%)',
          color: 'white', borderRadius: '12px', padding: '18px 20px',
          marginBottom: '12px', textAlign: 'center',
          boxShadow: '0 4px 15px rgba(229,57,53,0.5)',
        }}>
          <div style={{ fontSize: '1.3em', fontWeight: 'bold', marginBottom: '8px' }}>
            🎯 Jullie zijn getikt door {incomingTag.initiating_team_name}!
          </div>
          <p style={{ margin: '0 0 14px', opacity: 0.9, fontSize: '0.95em' }}>
            Klopt dit? Bevestig dan hieronder.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending || denyMutation.isPending}
              style={{
                background: 'white', color: '#c62828', border: 'none',
                padding: '10px 22px', borderRadius: '8px', fontWeight: 'bold',
                fontSize: '1em', cursor: 'pointer',
              }}
            >
              Ja, wij zijn getikt
            </button>
            <button
              onClick={() => denyMutation.mutate()}
              disabled={confirmMutation.isPending || denyMutation.isPending}
              style={{
                background: 'rgba(255,255,255,0.2)', color: 'white', border: '2px solid white',
                padding: '10px 22px', borderRadius: '8px', fontWeight: 'bold',
                fontSize: '1em', cursor: 'pointer',
              }}
            >
              Nee, klopt niet
            </button>
          </div>
        </div>
      )}

      {/* Outgoing tag: tikker waiting for target confirmation */}
      {outgoingTag && (
        <div style={{
          background: '#e8f5e9', border: '1px solid #4caf50',
          borderRadius: '10px', padding: '12px 16px', marginBottom: '10px',
          fontSize: '0.9em', textAlign: 'center',
        }}>
          ⏳ Wacht op bevestiging van <strong>{outgoingTag.target_team_name}</strong>…
        </div>
      )}

      {/* Tikker tag panel */}
      {tikkerStatus?.is_tikker && !outgoingTag && (
        <div style={{
          background: 'linear-gradient(135deg, #ff6f00 0%, #ff8f00 100%)',
          color: 'white', borderRadius: '12px', padding: '14px 18px', marginBottom: '12px',
        }}>
          <div style={{ fontWeight: 'bold', fontSize: '1.05em', marginBottom: '8px' }}>
            🏃 Jij bent de tikker!
          </div>
          {!showTagPanel ? (
            <button
              onClick={() => setShowTagPanel(true)}
              style={{
                background: 'white', color: '#e65100', border: 'none',
                padding: '8px 18px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer',
              }}
            >
              Ik heb een team getikt!
            </button>
          ) : (
            <div>
              <p style={{ margin: '0 0 10px', fontSize: '0.9em', opacity: 0.9 }}>
                Welk team heb je getikt?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {otherTeams.length === 0 ? (
                  <p style={{ margin: 0, opacity: 0.8, fontSize: '0.9em' }}>Geen andere teams gevonden.</p>
                ) : (
                  otherTeams.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => tagMutation.mutate(t.id)}
                      disabled={tagMutation.isPending}
                      style={{
                        background: t.color, color: 'white', border: 'none',
                        padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold',
                        cursor: 'pointer', textAlign: 'left', fontSize: '0.95em',
                        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                      }}
                    >
                      {t.name}
                    </button>
                  ))
                )}
              </div>
              <button
                onClick={() => setShowTagPanel(false)}
                style={{
                  marginTop: '10px', background: 'transparent', color: 'white',
                  border: '1px solid rgba(255,255,255,0.6)', padding: '6px 14px',
                  borderRadius: '6px', cursor: 'pointer', fontSize: '0.85em',
                }}
              >
                Annuleren
              </button>
            </div>
          )}
        </div>
      )}

      <MapContainer center={mapCenter} zoom={13} style={{ height: '400px', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {/* Own position marker — visible to everyone */}
        {ownPosition && (
          <Marker
            position={[ownPosition.lat, ownPosition.lng]}
            icon={createColorMarker(team?.color ?? '#667eea', `${team?.name} (jij)`)}
          >
            <Popup>{team?.name} (jij)</Popup>
          </Marker>
        )}

        {/* All team markers — tikker only */}
        {tikkerStatus?.is_tikker && teamLocations.map((loc) => (
          <Marker
            key={loc.team_id}
            position={[loc.latitude, loc.longitude]}
            icon={createColorMarker(loc.team_color, loc.team_name)}
          >
            <Popup>{loc.team_name}</Popup>
          </Marker>
        ))}

        {/* Opdrachtpunt markers — always visible for all players */}
        {areasData?.features.map((feature) => {
          const cp = feature.properties.challenge_point;
          if (!cp) return null;
          const [lng, lat] = cp.coordinates;
          return (
            <Marker
              key={`pin-${feature.properties.id}`}
              position={[lat, lng]}
              icon={createPinMarker(feature.properties.name)}
            >
              <Popup>
                <div style={{ minWidth: '160px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>{feature.properties.name}</h4>
                  <button
                    onClick={() => document.dispatchEvent(new CustomEvent('selectArea', { detail: feature.properties.id }))}
                    style={{ padding: '6px 12px', background: '#667eea', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', width: '100%', fontSize: '13px' }}
                  >
                    Selecteer gebied
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {areasData && (
          <GeoJSON
            key={areasRenderKey}
            data={areasData}
            style={(feature) => ({
              fillColor: (gameStatus?.is_finished ? null : feature?.properties.ownership?.owner_team_color) || '#cccccc',
              fillOpacity: 0.5,
              color: '#000',
              weight: 2,
            })}
            onEachFeature={(feature, layer) => {
              const cooldownTime = getCooldownTime(feature.properties.id);
              const modeEmoji = feature.properties.challenge?.mode === 'LAST_APPROVED_WINS' ? '🏆' : '📊';
              const popupContent = `
                <div style="min-width: 180px;">
                  <h4 style="margin: 0 0 8px 0;">${feature.properties.name}</h4>
                  <p style="margin: 4px 0;">${modeEmoji} ${feature.properties.challenge?.mode === 'LAST_APPROVED_WINS' ? 'Laatst goedgekeurd wint' : 'Hoogste score wint'}</p>
                  ${feature.properties.ownership?.owner_team_name
                    ? `<p style="margin: 4px 0;"><strong>Eigenaar:</strong> <span style="color: ${feature.properties.ownership.owner_team_color}; font-weight: bold;">${feature.properties.ownership.owner_team_name}</span></p>
                       <p style="margin: 4px 0; font-size: 0.85em; color: #666;">In bezit: ${formatOwnedTime(feature.properties.ownership.owned_seconds)}</p>`
                    : '<p style="margin: 4px 0; color: #999;">Nog geen eigenaar</p>'}
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

                {area?.ownership?.owner_team_name ? (
                  <div style={{
                    background: area.ownership.owner_team_color, color: 'white',
                    padding: '10px 20px', borderRadius: '0',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    fontSize: '0.95em', fontWeight: 'bold', textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                  }}>
                    <span style={{ fontSize: '1.3em' }}>👑</span>
                    <span>In bezit van {area.ownership.owner_team_name}</span>
                    <span style={{ marginLeft: 'auto', fontWeight: 'normal', opacity: 0.9, fontSize: '0.88em' }}>
                      {formatOwnedTime(area.ownership.owned_seconds)}
                    </span>
                  </div>
                ) : (
                  <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '8px 20px', fontSize: '0.88em', fontWeight: 'bold' }}>
                    Nog geen eigenaar — wees de eerste!
                  </div>
                )}

                {(() => {
                  const proxState = getProximityState(selectedAreaId!);
                  if (proxState === 'far') {
                    return (
                      <div style={{ background: '#fff3e0', border: '1px solid #ffe0b2', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '14px 20px', marginBottom: '16px', textAlign: 'center', color: '#e65100' }}>
                        <div style={{ fontSize: '24px', marginBottom: '6px' }}>📍</div>
                        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Kom dichterbij</div>
                        <div style={{ fontSize: '0.88em' }}>Je moet binnen {area?.proximity_radius}m van het opdrachtpunt staan om de opdracht te zien en in te dienen.</div>
                      </div>
                    );
                  }
                  if (proxState === 'unknown') {
                    return (
                      <div style={{ background: '#f5f5f5', border: '1px solid #e0e0e0', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '14px 20px', marginBottom: '16px', textAlign: 'center', color: '#888' }}>
                        <div style={{ fontSize: '13px' }}>GPS ophalen… wacht even.</div>
                      </div>
                    );
                  }
                  if (!area?.challenge?.description) return null;
                  const desc = area.challenge.description;
                  const urlMatch = desc.match(/https:\/\/maps\.google\.com\/[^\s)]+/);
                  const mapsUrl = urlMatch ? urlMatch[0] : null;
                  const cleanDesc = desc.replace(/\s*\(?https:\/\/maps\.google\.com\/[^\s)]+\)?/g, '');
                  return (
                    <div style={{ background: '#f8f9ff', border: '1px solid #e0e4ff', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '14px 20px', marginBottom: '16px', fontSize: '0.95em', lineHeight: '1.6', color: '#333', whiteSpace: 'pre-wrap' }}>
                      <span dangerouslySetInnerHTML={{ __html: cleanDesc }} />
                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'block', marginTop: '14px', padding: '11px 16px', background: '#4285f4', color: 'white', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', textAlign: 'center', fontSize: '0.95em' }}
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
                    color: 'white', padding: '20px', borderRadius: '12px',
                    marginTop: '15px', marginBottom: '15px', textAlign: 'center',
                    border: '3px solid #764ba2', boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '10px' }}>⏱️</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>Cooldown Actief</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', letterSpacing: '2px' }}>{getCooldownTime(selectedAreaId)}</div>
                    <div style={{ fontSize: '14px', marginTop: '10px', opacity: 0.9 }}>Je kunt over deze tijd weer een nieuwe poging doen</div>
                  </div>
                )}
              </>
            );
          })()}

          {tikkerStatus?.is_tikker ? (
            <div style={{
              background: 'linear-gradient(135deg, #e65100 0%, #bf360c 100%)',
              color: 'white', padding: '20px', borderRadius: '12px',
              marginTop: '15px', textAlign: 'center',
              border: '3px solid #bf360c',
            }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>🏃</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '6px' }}>Jij bent de tikker!</div>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>Als tikker kun je geen opdrachten indienen.</div>
            </div>
          ) : getProximityState(selectedAreaId!) === 'far' || getProximityState(selectedAreaId!) === 'unknown' ? null : (
          <form onSubmit={handleSubmit}>
            <div style={{ background: '#fff3cd', padding: '12px', borderRadius: '8px', marginBottom: '15px', border: '2px solid #ffc107' }}>
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

            {areasData?.features.find((f) => f.properties.id === selectedAreaId)?.properties.challenge?.mode === 'HIGHEST_SCORE_WINS' && (() => {
              const scoreDesc = areasData.features.find((f) => f.properties.id === selectedAreaId)?.properties.challenge?.score_description;
              return (
                <div className="form-group">
                  <label>Score *</label>
                  {scoreDesc && (
                    <p style={{ fontSize: '13px', color: '#444', marginBottom: '6px', marginTop: '2px' }}>
                      {scoreDesc}
                    </p>
                  )}
                  <input
                    type="number"
                    value={submissionScore ?? ''}
                    onChange={(e) => setSubmissionScore(e.target.value === '' ? null : Number(e.target.value))}
                    min="0"
                    step="1"
                    disabled={isCooldownActive(selectedAreaId)}
                    placeholder="Vul hier je score in"
                  />
                </div>
              );
            })()}

            <div className="form-group">
              <label>Foto's / Video's <span style={{ color: 'red' }}>*</span></label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                <label
                  className="btn-primary"
                  style={{
                    flex: 1, textAlign: 'center',
                    cursor: isCooldownActive(selectedAreaId) ? 'not-allowed' : 'pointer',
                    opacity: isCooldownActive(selectedAreaId) ? 0.5 : 1,
                    pointerEvents: isCooldownActive(selectedAreaId) ? 'none' : 'auto',
                  }}
                >
                  📎 Voeg media toe
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    style={{ display: 'none' }}
                    disabled={isCooldownActive(selectedAreaId)}
                    onChange={(e) => addMediaFiles(e.target.files)}
                  />
                </label>
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
                    height: '100%', width: `${uploadProgress}%`,
                    transition: 'width 0.2s ease', borderRadius: '6px',
                  }} />
                </div>
              </div>
            )}

            <div className="form-actions">
              <button type="button" onClick={() => setSelectedAreaId(null)} className="btn-secondary">
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
          )}
        </div>
      )}
    </div>
  );
};

export default Game;
