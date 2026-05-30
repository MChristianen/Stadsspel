import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { useToast } from '../components/Toast';
import type {
  City,
  CreatedAdminAccount,
  SessionResponse,
  SessionTeam,
} from '../types/api';

const Admin: React.FC = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [proximityEnabled, setProximityEnabled] = useState(false);
  const [proximityRadius, setProximityRadius] = useState(150);
  const [currentSession, setCurrentSession] = useState<SessionResponse | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(true);
  const [selectedAdditionalAdmins, setSelectedAdditionalAdmins] = useState<number[]>([]);
  const [createdAdminAccounts, setCreatedAdminAccounts] = useState<CreatedAdminAccount[]>([]);
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
    if (!selectedCityId) return;
    const city = cities.find((c) => c.id === selectedCityId);
    if (!city) return;
    setProximityEnabled(city.proximity_enabled);
    setProximityRadius(city.proximity_radius);
  }, [selectedCityId, cities]);

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
    mutationFn: (data: { city_id: number; duration_minutes: number; proximity_enabled: boolean; proximity_radius: number }) => apiClient.createSession(data),
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
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      alert(detail ?? 'Kon het spel niet starten. Controleer de backend-logs.');
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

  const setTikkerMutation = useMutation({
    mutationFn: (teamId: number) => apiClient.setTikker(teamId),
    onSuccess: (_, teamId) => {
      const name = sessionTeams.find((t) => t.id === teamId)?.name ?? 'Team';
      showToast(`${name} is nu de tikker`, 'success');
      queryClient.invalidateQueries({ queryKey: ['sessionTeams', currentSession?.id] });
    },
    onError: () => showToast('Tikker instellen mislukt', 'error'),
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

  const handleCreateSession = () => {
    if (!selectedCityId) {
      alert('Selecteer een stad');
      return;
    }
    createSessionMutation.mutate({
      city_id: selectedCityId,
      duration_minutes: durationMinutes,
      proximity_enabled: proximityEnabled,
      proximity_radius: proximityRadius,
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
      alert('Kopiëren mislukt. Kopieer de tekst handmatig.');
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

  return (
    <div className="admin-container">
      <h1>Beheerpaneel</h1>

      {(showCreateForm || !currentSession) && (
        <div className="admin-section">
          <h2>Nieuw Spel Aanmaken</h2>

          {/* 1. Locatie */}
          <div style={{ marginBottom: '24px' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>📍 Locatie</p>
            <select
              value={selectedCityId || ''}
              onChange={(e) => setSelectedCityId(Number(e.target.value))}
              style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              <option value="">-- Selecteer een stad --</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name} ({city.area_count} gebieden)
                </option>
              ))}
            </select>
          </div>

          {/* 2. Tijdsduur */}
          <div style={{ marginBottom: '24px' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>⏱️ Speelduur</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                min="1"
                style={{ width: '100px', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
              <span style={{ color: '#555' }}>minuten</span>
            </div>
          </div>

          {/* 3. Nabijheidseis */}
          <div style={{ marginBottom: '24px' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>📡 Nabijheidseis</p>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '10px' }}>
              <input
                type="checkbox"
                checked={proximityEnabled}
                onChange={(e) => setProximityEnabled(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <span>Teams moeten fysiek bij het opdrachtpunt zijn om in te dienen</span>
            </label>
            {proximityEnabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '28px' }}>
                <input
                  type="number"
                  value={proximityRadius}
                  onChange={(e) => setProximityRadius(Number(e.target.value))}
                  min="10"
                  max="2000"
                  style={{ width: '90px', padding: '8px', fontSize: '15px', borderRadius: '4px', border: '1px solid #ddd' }}
                />
                <span style={{ color: '#555' }}>meter radius</span>
              </div>
            )}
          </div>

          <button
            onClick={handleCreateSession}
            disabled={!selectedCityId || createSessionMutation.isPending}
            className="btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '16px' }}
          >
            {createSessionMutation.isPending ? 'Aanmaken...' : 'Spel aanmaken'}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {sessionTeams.map((t) => (
                    <div
                      key={t.id}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                    >
                      <span style={{
                        backgroundColor: t.color,
                        color: 'white',
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
                        flex: 1,
                      }}>
                        {t.is_tikker ? '🏃 ' : ''}{t.name}
                      </span>
                      {!t.is_tikker && (
                        <button
                          onClick={() => setTikkerMutation.mutate(t.id)}
                          disabled={setTikkerMutation.isPending}
                          style={{
                            fontSize: '12px', padding: '5px 10px', borderRadius: '6px',
                            border: '1px solid #ff8f00', background: 'white',
                            color: '#e65100', cursor: 'pointer', whiteSpace: 'nowrap',
                          }}
                        >
                          Maak tikker
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{
              background: '#1a237e',
              borderRadius: '12px',
              padding: '24px 20px',
              marginBottom: '15px',
              textAlign: 'center',
            }}>
              <p style={{ color: 'rgba(255,255,255,0.75)', margin: '0 0 8px', fontSize: '13px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Spelcode
              </p>
              <div style={{
                fontSize: 'clamp(1.8rem, 10vw, 3.5rem)',
                fontWeight: '900',
                color: '#fff',
                letterSpacing: '0.15em',
                lineHeight: 1.1,
                marginBottom: '12px',
                fontVariantNumeric: 'tabular-nums',
                wordBreak: 'break-all',
              }}>
                {currentSession.join_code}
              </div>
              <p style={{ color: 'rgba(255,255,255,0.65)', margin: '0 0 16px', fontSize: '13px' }}>
                Ga naar <strong style={{ color: '#fff' }}>{window.location.host}/join</strong> en voer deze code in
              </p>
              <button
                onClick={copyJoinLink}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.35)',
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '8px 20px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                🔗 Kopieer uitnodigingslink
              </button>
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

