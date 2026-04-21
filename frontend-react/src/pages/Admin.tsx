import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { useToast } from '../components/Toast';
import type {
  City,
  CityPointsConfig,
  CreatedAdminAccount,
  SessionResponse,
  SessionTeam,
  UpdateCityPointsConfigRequest,
} from '../types/api';

const Admin: React.FC = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [currentSession, setCurrentSession] = useState<SessionResponse | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(true);
  const [selectedAdditionalAdmins, setSelectedAdditionalAdmins] = useState<number[]>([]);
  const [createdAdminAccounts, setCreatedAdminAccounts] = useState<CreatedAdminAccount[]>([]);
  const [configCityId, setConfigCityId] = useState<number | null>(null);
  const [pointsConfigDraft, setPointsConfigDraft] = useState<CityPointsConfig | null>(null);
  const [extendMinutes, setExtendMinutes] = useState(10);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState('');
  const prevSubmissionIdsRef = useRef<Set<number>>(new Set());

  const { data: allSessions = [] } = useQuery<SessionResponse[]>({
    queryKey: ['allSessions'],
    queryFn: () => apiClient.getAllSessions(),
  });

  useEffect(() => {
    if (allSessions.length === 0) {
      return;
    }

    if (currentSession) {
      const refreshedSession = allSessions.find((s) => s.id === currentSession.id);
      if (refreshedSession && (
        refreshedSession.is_active !== currentSession.is_active ||
        refreshedSession.is_finished !== currentSession.is_finished ||
        refreshedSession.started_at !== currentSession.started_at ||
        refreshedSession.end_time !== currentSession.end_time
      )) {
        setCurrentSession(refreshedSession);
      }
      return;
    }

    const activeSession =
      allSessions.find((s) => s.is_active && !s.is_finished) ||
      allSessions.find((s) => !s.is_active && !s.is_finished);
    if (activeSession) {
      setCurrentSession(activeSession);
      setShowCreateForm(false);
    }
  }, [allSessions, currentSession]);

  const { data: cities = [] } = useQuery<City[]>({
    queryKey: ['cities'],
    queryFn: () => apiClient.getCities(),
  });

  useEffect(() => {
    if (currentSession?.city_id) {
      setConfigCityId(currentSession.city_id);
      return;
    }
    if (!configCityId && cities.length > 0) {
      setConfigCityId(cities[0].id);
    }
  }, [cities, currentSession, configCityId]);

  const { data: pointsConfig, isLoading: pointsConfigLoading } = useQuery<CityPointsConfig>({
    queryKey: ['cityPointsConfig', configCityId],
    queryFn: () => apiClient.getCityPointsConfig(configCityId!),
    enabled: !!configCityId,
  });

  useEffect(() => {
    if (pointsConfig) {
      setPointsConfigDraft({
        ...pointsConfig,
        areas: pointsConfig.areas.map((area) => ({ ...area })),
      });
    }
  }, [pointsConfig]);

  const { data: sessionTeams = [] } = useQuery<SessionTeam[]>({
    queryKey: ['sessionTeams', currentSession?.id],
    queryFn: () => apiClient.getSessionTeams(currentSession!.id),
    enabled: !!currentSession,
    refetchInterval: 3000,
  });

  const { data: gameStatus } = useQuery({
    queryKey: ['gameStatus'],
    queryFn: () => apiClient.getGameStatus(),
    refetchInterval: 5000,
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ['allSubmissions'],
    queryFn: () => apiClient.getAllSubmissions(),
    refetchInterval: 5000,
  });

  // Notify admin when new pending submissions arrive
  useEffect(() => {
    if (submissions.length === 0) return;
    const currentIds = new Set(submissions.map((s) => s.id));
    if (prevSubmissionIdsRef.current.size > 0) {
      const newOnes = submissions.filter((s) => !prevSubmissionIdsRef.current.has(s.id));
      newOnes.forEach((s) =>
        showToast(`Nieuwe inzending: ${s.team_name} — ${s.area_name}`, 'info', 6000)
      );
    }
    prevSubmissionIdsRef.current = currentIds;
  }, [submissions, showToast]);

  const { data: pendingCount } = useQuery({
    queryKey: ['pendingCount'],
    queryFn: () => apiClient.getPendingCount(),
    refetchInterval: 5000,
  });

  const createSessionMutation = useMutation({
    mutationFn: (data: { city_id: number; duration_minutes: number }) => apiClient.createSession(data),
    onSuccess: (session) => {
      setCurrentSession(session);
      setShowCreateForm(false);
      setSelectedAdditionalAdmins([]);
      setCreatedAdminAccounts([]);
      alert('Spel aangemaakt! Deel de join link met teams.');
    },
  });

  const startSessionMutation = useMutation({
    mutationFn: (sessionId: number) => apiClient.startSession(sessionId, selectedAdditionalAdmins),
    onSuccess: (response) => {
      setCurrentSession((prev) =>
        prev
          ? {
              ...prev,
              is_active: true,
              started_at: response.started_at,
              end_time: response.end_time,
            }
          : prev
      );
      setCreatedAdminAccounts(response.created_admin_accounts || []);
      setSelectedAdditionalAdmins([]);
      queryClient.invalidateQueries({ queryKey: ['gameStatus'] });
      queryClient.invalidateQueries({ queryKey: ['allSessions'] });
      queryClient.invalidateQueries({ queryKey: ['sessionTeams', currentSession?.id] });
      alert('Spel gestart!');
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => apiClient.publishResults(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gameStatus'] });
    },
  });

  const extendMutation = useMutation({
    mutationFn: ({ sessionId, minutes }: { sessionId: number; minutes: number }) =>
      apiClient.extendSession(sessionId, minutes),
    onSuccess: (_, { minutes }) => {
      queryClient.invalidateQueries({ queryKey: ['gameStatus'] });
      queryClient.invalidateQueries({ queryKey: ['allSessions'] });
      showToast(`Spel verlengd met ${minutes} minuten`, 'success');
    },
    onError: () => showToast('Verlengen mislukt', 'error'),
  });

  const pauseMutation = useMutation({
    mutationFn: (sessionId: number) => apiClient.pauseSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gameStatus'] });
      showToast('Spel gepauzeerd', 'warning');
    },
    onError: () => showToast('Pauzeren mislukt', 'error'),
  });

  const resumeMutation = useMutation({
    mutationFn: (sessionId: number) => apiClient.resumeSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gameStatus'] });
      showToast('Spel hervat', 'success');
    },
    onError: () => showToast('Hervatten mislukt', 'error'),
  });

  const stopMutation = useMutation({
    mutationFn: (sessionId: number) => apiClient.stopSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gameStatus'] });
      queryClient.invalidateQueries({ queryKey: ['allSessions'] });
      setCurrentSession(null);
      setShowCreateForm(true);
      showToast('Spel gestopt', 'warning');
    },
    onError: () => showToast('Stoppen mislukt', 'error'),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, approved, feedback }: any) =>
      apiClient.reviewSubmission(id, { approved, admin_feedback: feedback }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allSubmissions'] });
      queryClient.invalidateQueries({ queryKey: ['pendingCount'] });
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });

  const exportMutation = useMutation({
    mutationFn: (sessionId: number) => apiClient.exportGameZip(sessionId),
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resultaten_export_${Date.now()}.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
    },
  });

  const autoExportMutation = useMutation({
    mutationFn: (sessionId: number) => apiClient.downloadAutoExport(sessionId),
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resultaten_auto_export_${Date.now()}.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
    },
  });

  const updatePointsConfigMutation = useMutation({
    mutationFn: (payload: UpdateCityPointsConfigRequest) => {
      if (!configCityId) {
        throw new Error('Geen stad geselecteerd');
      }
      return apiClient.updateCityPointsConfig(configCityId, payload);
    },
    onSuccess: (updatedConfig) => {
      setPointsConfigDraft({
        ...updatedConfig,
        areas: updatedConfig.areas.map((area) => ({ ...area })),
      });
      queryClient.invalidateQueries({ queryKey: ['cityPointsConfig', configCityId] });
      alert('Punteninstellingen opgeslagen');
    },
    onError: () => {
      alert('Opslaan mislukt');
    },
  });

  const handleCreateSession = () => {
    if (!selectedCityId) {
      alert('Selecteer een stad');
      return;
    }
    createSessionMutation.mutate({
      city_id: selectedCityId,
      duration_minutes: durationMinutes,
    });
  };

  const copyJoinLink = () => {
    if (!currentSession) return;
    const joinLink = `${window.location.origin}/join/${currentSession.join_code}`;
    copyText(joinLink, 'Join-link gekopieerd! Deel deze met teams om ze uit te nodigen.');
  };

  const copyResultsLink = () => {
    if (!currentSession) return;
    const resultsLink = `${window.location.origin}/results/${currentSession.join_code}`;
    copyText(resultsLink, 'Uitslag-link gekopieerd! Je kunt deze delen met teams.');
  };

  const copyText = async (text: string, successMessage: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      alert(successMessage);
    } catch {
      alert('KopiÃ«ren mislukt. Kopieer de tekst handmatig.');
    }
  };

  const toggleAdditionalAdmin = (teamId: number, checked: boolean) => {
    setSelectedAdditionalAdmins((prev) => {
      if (checked) {
        if (prev.includes(teamId)) return prev;
        return [...prev, teamId];
      }
      return prev.filter((id) => id !== teamId);
    });
  };

  const copyAdminCredentials = async (account: CreatedAdminAccount) => {
    const text = `Team: ${account.team_name}\nGebruikersnaam: ${account.admin_username}\nWachtwoord: ${account.admin_password}`;
    await copyText(text, `Inloggegevens gekopieerd voor ${account.team_name}`);
  };

  const handleDefaultPointsChange = (
    key: 'default_capture_points' | 'default_hold_points_per_minute',
    value: string
  ) => {
    const numeric = Number(value);
    if (!pointsConfigDraft || Number.isNaN(numeric) || numeric < 0) return;
    setPointsConfigDraft({ ...pointsConfigDraft, [key]: numeric });
  };

  const handleAreaPointsChange = (
    areaId: number,
    key: 'capture_points' | 'hold_points_per_minute',
    value: string
  ) => {
    if (!pointsConfigDraft) return;
    const parsedValue = value.trim() === '' ? null : Number(value);
    if (parsedValue !== null && (Number.isNaN(parsedValue) || parsedValue < 0)) return;

    setPointsConfigDraft({
      ...pointsConfigDraft,
      areas: pointsConfigDraft.areas.map((area) =>
        area.area_id === areaId
          ? {
              ...area,
              [key]: parsedValue,
            }
          : area
      ),
    });
  };

  const toggleAreaDefaults = (areaId: number, enabled: boolean) => {
    if (!pointsConfigDraft) return;
    setPointsConfigDraft({
      ...pointsConfigDraft,
      areas: pointsConfigDraft.areas.map((area) =>
        area.area_id === areaId
          ? {
              ...area,
              capture_points: enabled ? null : area.capture_points ?? pointsConfigDraft.default_capture_points,
              hold_points_per_minute: enabled ? null : area.hold_points_per_minute ?? pointsConfigDraft.default_hold_points_per_minute,
            }
          : area
      ),
    });
  };

  const handleSavePointsConfig = () => {
    if (!pointsConfigDraft) return;
    if (pointsConfigDraft.default_capture_points < 0 || pointsConfigDraft.default_hold_points_per_minute < 0) {
      alert('Punten moeten 0 of hoger zijn');
      return;
    }

    const payload: UpdateCityPointsConfigRequest = {
      default_capture_points: pointsConfigDraft.default_capture_points,
      default_hold_points_per_minute: pointsConfigDraft.default_hold_points_per_minute,
      areas: pointsConfigDraft.areas.map((area) => ({
        area_id: area.area_id,
        capture_points: area.capture_points,
        hold_points_per_minute: area.hold_points_per_minute,
      })),
    };

    updatePointsConfigMutation.mutate(payload);
  };

  return (
    <div className="admin-container">
      <h1>Beheerpaneel</h1>

      {(showCreateForm || !currentSession) && (
        <div className="admin-section">
          <h2>Nieuw Spel Aanmaken</h2>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Kies een stad:</label>
            <select
              value={selectedCityId || ''}
              onChange={(e) => setSelectedCityId(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '16px',
                borderRadius: '4px',
                border: '1px solid #ddd',
              }}
            >
              <option value="">-- Selecteer een stad --</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name} ({city.area_count} gebieden)
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Speelduur (minuten):</label>
            <input
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              min="1"
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '16px',
                borderRadius: '4px',
                border: '1px solid #ddd',
              }}
            />
          </div>

          <button
            onClick={handleCreateSession}
            disabled={!selectedCityId || createSessionMutation.isPending}
            className="btn-primary"
          >
            {createSessionMutation.isPending ? 'Aanmaken...' : 'Maak Spel Aan'}
          </button>
        </div>
      )}

      {currentSession && (
        <>
          <div className="admin-section" style={{ background: '#e3f2fd', border: '2px solid #2196f3' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <h2 style={{ margin: 0 }}>Spel: {currentSession.city_name}</h2>
              <button
                onClick={() => { setCurrentSession(null); setShowCreateForm(true); }}
                className="btn-secondary"
                style={{ fontSize: '13px', padding: '6px 12px', whiteSpace: 'nowrap' }}
              >
                + Nieuw spel
              </button>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <p><strong>Speelduur:</strong> {currentSession.duration_minutes} minuten</p>
              <p>
                <strong>Status:</strong>{' '}
                {currentSession.is_active
                  ? 'Actief'
                  : currentSession.is_finished
                    ? 'Afgelopen'
                    : 'Wacht op start'}
              </p>
              <p><strong>Teams aangemeld:</strong> {sessionTeams.length}</p>
            </div>

            {sessionTeams.length > 0 && (
              <div style={{ background: 'white', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <p style={{ marginBottom: '10px', fontWeight: 'bold' }}>Teams in dit spel:</p>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {sessionTeams.map((team) => (
                    <li
                      key={team.id}
                      style={{
                        backgroundColor: team.color,
                        color: 'white',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
                      }}
                    >
                      {team.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ background: 'white', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
              <p style={{ marginBottom: '10px', fontWeight: 'bold' }}>Deel-link:</p>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                <input
                  type="text"
                  value={`${window.location.origin}/join/${currentSession.join_code}`}
                  readOnly
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                />
                <button onClick={copyJoinLink} className="btn-primary">
                  Kopieer
                </button>
              </div>
              <div style={{ textAlign: 'center' }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(`${window.location.origin}/join/${currentSession.join_code}`)}&size=180x180&margin=6`}
                  alt="QR code join link"
                  style={{ borderRadius: '8px', border: '1px solid #eee' }}
                />
                <p style={{ fontSize: '12px', color: '#888', margin: '6px 0 0' }}>Scan om mee te doen</p>
              </div>
            </div>

            <div style={{ background: 'white', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
              <p style={{ marginBottom: '10px', fontWeight: 'bold' }}>Uitslag-link (publiek):</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  value={`${window.location.origin}/results/${currentSession.join_code}`}
                  readOnly
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                />
                <button onClick={copyResultsLink} className="btn-primary">
                  Resultaten Delen
                </button>
              </div>
            </div>

            {!currentSession.is_finished && (
              <button
                onClick={() => {
                  if (window.confirm('Weet je zeker dat je het spel wilt stoppen? Dit kan niet ongedaan worden.')) {
                    stopMutation.mutate(currentSession.id);
                  }
                }}
                disabled={stopMutation.isPending}
                className="btn-danger"
                style={{ width: '100%', marginBottom: '12px', fontSize: '16px', padding: '12px' }}
              >
                ⏹ Spel stoppen
              </button>
            )}

            {!currentSession.is_active && !currentSession.is_finished && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ background: 'white', padding: '15px', borderRadius: '8px', marginBottom: '12px' }}>
                  <p style={{ marginTop: 0, fontWeight: 'bold' }}>Extra adminaccounts (optioneel)</p>
                  <p style={{ marginTop: '6px', color: '#666', fontSize: '14px' }}>
                    Selecteer teams die een extra adminaccount moeten krijgen.
                  </p>
                  <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
                    {sessionTeams.map((team) => (
                      <label key={`admin-${team.id}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={selectedAdditionalAdmins.includes(team.id)}
                          onChange={(e) => toggleAdditionalAdmin(team.id, e.target.checked)}
                        />
                        <span>{team.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => startSessionMutation.mutate(currentSession.id)}
                  disabled={startSessionMutation.isPending}
                  className="btn-primary"
                  style={{ fontSize: '18px', padding: '12px 24px' }}
                >
                  Start Spel Nu
                </button>
              </div>
            )}

            {currentSession.is_active && !currentSession.is_finished && (
              <div style={{ background: 'white', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <p style={{ marginBottom: '10px', fontWeight: 'bold' }}>Tijdbeheer</p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
                  {gameStatus?.is_paused ? (
                    <button
                      onClick={() => resumeMutation.mutate(currentSession.id)}
                      disabled={resumeMutation.isPending}
                      className="btn-primary"
                    >
                      ▶ Hervat spel
                    </button>
                  ) : (
                    <button
                      onClick={() => pauseMutation.mutate(currentSession.id)}
                      disabled={pauseMutation.isPending}
                      className="btn-secondary"
                    >
                      ⏸ Pauzeer spel
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="number"
                    min="1"
                    max="480"
                    value={extendMinutes}
                    onChange={(e) => setExtendMinutes(Number(e.target.value))}
                    style={{ width: '70px', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
                  />
                  <span style={{ fontSize: '14px' }}>minuten</span>
                  <button
                    onClick={() => extendMutation.mutate({ sessionId: currentSession.id, minutes: extendMinutes })}
                    disabled={extendMutation.isPending}
                    className="btn-secondary"
                  >
                    + Verleng tijd
                  </button>
                </div>
              </div>
            )}

            {currentSession.is_active && gameStatus?.remaining_seconds! <= 0 && !gameStatus?.is_published && (
              <button
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
                className="btn-primary"
              >
                Publiceer Resultaten
              </button>
            )}

            <button
              onClick={() => exportMutation.mutate(currentSession.id)}
              disabled={exportMutation.isPending}
              className="btn-secondary"
              style={{ marginTop: '15px' }}
            >
              Download Resultaten (ZIP)
            </button>
            {currentSession.is_finished && (
              <>
                <button
                  onClick={() => autoExportMutation.mutate(currentSession.id)}
                  disabled={autoExportMutation.isPending}
                  className="btn-secondary"
                  style={{ marginTop: '10px' }}
                >
                  Download Auto-export (met media)
                </button>
                <button
                  onClick={() => {
                    setCurrentSession(null);
                    setShowCreateForm(true);
                    setSelectedAdditionalAdmins([]);
                    setCreatedAdminAccounts([]);
                  }}
                  className="btn-primary"
                  style={{ marginTop: '10px' }}
                >
                  Nieuw spel starten
                </button>
              </>
            )}
          </div>

          <div className="admin-section">
            <h2>Punteninstellingen</h2>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Stad</label>
              <select
                value={configCityId || ''}
                onChange={(e) => setConfigCityId(Number(e.target.value))}
                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                {cities.map((city) => (
                  <option key={`cfg-${city.id}`} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>

            {pointsConfigLoading || !pointsConfigDraft ? (
              <p>Laden...</p>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Capture points (stad)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={pointsConfigDraft.default_capture_points}
                      onChange={(e) => handleDefaultPointsChange('default_capture_points', e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Hold points/min (stad)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={pointsConfigDraft.default_hold_points_per_minute}
                      onChange={(e) => handleDefaultPointsChange('default_hold_points_per_minute', e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                  </div>
                </div>

                <div style={{ border: '1px solid #e5e5e5', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', background: '#f7f7f7', padding: '10px', fontWeight: 'bold', gap: '10px' }}>
                    <div>Gebied</div>
                    <div>Capture</div>
                    <div>Hold/min</div>
                    <div>Override</div>
                  </div>
                  {pointsConfigDraft.areas.map((area) => {
                    const useDefaults = area.capture_points === null && area.hold_points_per_minute === null;
                    return (
                      <div
                        key={`points-${area.area_id}`}
                        style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '10px', gap: '10px', borderTop: '1px solid #f0f0f0', alignItems: 'center' }}
                      >
                        <div>{area.name}</div>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          disabled={useDefaults}
                          value={area.capture_points ?? ''}
                          placeholder={`${area.effective_capture_points}`}
                          onChange={(e) => handleAreaPointsChange(area.area_id, 'capture_points', e.target.value)}
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          disabled={useDefaults}
                          value={area.hold_points_per_minute ?? ''}
                          placeholder={`${area.effective_hold_points_per_minute}`}
                          onChange={(e) => handleAreaPointsChange(area.area_id, 'hold_points_per_minute', e.target.value)}
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                        />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="checkbox"
                            checked={useDefaults}
                            onChange={(e) => toggleAreaDefaults(area.area_id, e.target.checked)}
                          />
                          <span>Stad</span>
                        </label>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={handleSavePointsConfig}
                  className="btn-primary"
                  disabled={updatePointsConfigMutation.isPending}
                  style={{ marginTop: '12px' }}
                >
                  {updatePointsConfigMutation.isPending ? 'Opslaan...' : 'Sla punteninstellingen op'}
                </button>
              </>
            )}
          </div>

          {createdAdminAccounts.length > 0 && (
            <div className="admin-section" style={{ background: '#fff8e1', border: '2px solid #ffb300' }}>
              <h2>Nieuwe Admin Accounts</h2>
              <p style={{ marginTop: 0 }}>
                Bewaar deze gegevens nu. Wachtwoorden worden slechts eenmalig getoond.
              </p>
              <div style={{ display: 'grid', gap: '10px' }}>
                {createdAdminAccounts.map((account) => (
                  <div
                    key={`${account.team_id}-${account.admin_username}`}
                    style={{ background: 'white', borderRadius: '8px', padding: '12px' }}
                  >
                    <p style={{ margin: '0 0 6px 0' }}><strong>Team:</strong> {account.team_name}</p>
                    <p style={{ margin: '0 0 6px 0' }}>
                      <strong>Gebruikersnaam:</strong> {account.admin_username}
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong>Wachtwoord:</strong> {account.admin_password}
                    </p>
                    <button
                      onClick={() => copyAdminCredentials(account)}
                      className="btn-secondary"
                      style={{ marginTop: '10px' }}
                    >
                      Kopieer Inloggegevens
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </>
      )}

      <div className="admin-section">
        <h2>Wachtende inzendingen ({pendingCount?.count || 0})</h2>
        {submissions.length === 0 ? (
          <p>Geen wachtende inzendingen</p>
        ) : (
          <div className="submissions-list">
            {submissions.map((submission) => (
              <div key={submission.id} className="submission-card">
                <div className="submission-header">
                  <strong>{submission.team_name}</strong> - {submission.area_name}
                  <span className="submission-time">{new Date(submission.created_at).toLocaleString()}</span>
                </div>
                <p><strong>{submission.challenge_title}</strong></p>
                <p>{submission.text}</p>
                {submission.score !== null && <p>Score: {submission.score}</p>}
                {submission.media.length > 0 && (
                  <div className="media-files">
                    {submission.media.map((file) => {
                      // Show image or video inline if possible, else fallback to link
                      if (file.media_type === 'PHOTO' || file.media_type === 'image' || file.media_type.startsWith('image')) {
                        return (
                          <div key={file.id} style={{ marginBottom: 8 }}>
                            <a href={file.url} target="_blank" rel="noopener noreferrer">
                              <img src={file.url} alt={`media-${file.id}`} style={{ maxWidth: 300, maxHeight: 200, display: 'block', marginBottom: 2 }} />
                            </a>
                          </div>
                        );
                      } else if (file.media_type === 'VIDEO' || file.media_type === 'video' || file.media_type.startsWith('video')) {
                        return (
                          <div key={file.id} style={{ marginBottom: 8 }}>
                            <video src={file.url} controls style={{ maxWidth: 300, maxHeight: 200, display: 'block', marginBottom: 2 }} />
                            <a href={file.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#667eea' }}>Openen in nieuw tabblad</a>
                          </div>
                        );
                      } else {
                        return (
                          <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer">
                            {file.media_type} {file.id}
                          </a>
                        );
                      }
                    })}
                  </div>
                )}
                <div className="submission-actions">
                  <button
                    onClick={() => reviewMutation.mutate({ id: submission.id, approved: true, feedback: '' })}
                    className="btn-success"
                    disabled={reviewMutation.isPending}
                  >
                    Goedkeuren
                  </button>
                  <button
                    onClick={() => { setRejectingId(submission.id); setRejectFeedback(''); }}
                    className="btn-danger"
                    disabled={reviewMutation.isPending}
                  >
                    Afkeuren
                  </button>
                </div>
                {rejectingId === submission.id && (
                  <div style={{ marginTop: '10px', background: '#fff3f3', border: '1px solid #f5c6cb', borderRadius: '8px', padding: '12px' }}>
                    <p style={{ margin: '0 0 8px', fontWeight: 'bold', fontSize: '14px' }}>Reden van afwijzing (optioneel):</p>
                    <textarea
                      value={rejectFeedback}
                      onChange={(e) => setRejectFeedback(e.target.value)}
                      rows={2}
                      placeholder="Bijv. foto niet duidelijk genoeg..."
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button
                        onClick={() => {
                          reviewMutation.mutate({ id: submission.id, approved: false, feedback: rejectFeedback });
                          setRejectingId(null);
                          setRejectFeedback('');
                        }}
                        className="btn-danger"
                        disabled={reviewMutation.isPending}
                      >
                        Bevestig afwijzing
                      </button>
                      <button onClick={() => setRejectingId(null)} className="btn-secondary">Annuleren</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;

