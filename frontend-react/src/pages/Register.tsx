import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/api';

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<{ city_name: string; duration_minutes: number } | null>(null);
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const joinCode = searchParams.get('session');

  useEffect(() => {
    const fetchSession = async () => {
      if (joinCode) {
        try {
          const session = await apiClient.getSession(joinCode);
          setSessionInfo({ city_name: session.city_name, duration_minutes: session.duration_minutes });
        } catch (err) {
          console.error('Failed to fetch session:', err);
        }
      }
    };
    fetchSession();
  }, [joinCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (joinCode) {
        const teamColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
        // Use join endpoint when registering via join code
        const joinResponse = await apiClient.joinGame(joinCode, {
          team_name: name,
          password: password,
          color: teamColor
        });

        // Save auth directly from join response to avoid ambiguous login selection
        // when duplicate team names exist across sessions.
        apiClient.setToken(joinResponse.auth_token);
        localStorage.setItem(
          'team',
          JSON.stringify({
            id: joinResponse.team_id,
            name: joinResponse.team_name,
            color: joinResponse.team_color || teamColor,
            is_admin: false,
            game_session_id: joinResponse.session_id,
            created_at: new Date().toISOString(),
          })
        );

        // Reload so AuthContext picks up the freshly stored session-bound team.
        window.location.href = '/waiting';
      } else {
        // Regular registration without join code
        await register(name, password);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registreren mislukt. Probeer opnieuw.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>🏙️ Stadsspel</h1>
        <h2>Registreer Team</h2>
        
        {sessionInfo && (
          <div style={{ 
            background: '#e8f5e9', 
            padding: '12px', 
            borderRadius: '8px', 
            marginBottom: '20px',
            border: '1px solid #4caf50'
          }}>
            <p style={{ margin: 0, color: '#2e7d32', fontWeight: 'bold' }}>
              🎮 Je meldt je aan voor: {sessionInfo.city_name}
            </p>
            <p style={{ margin: '4px 0 0 0', color: '#2e7d32', fontSize: '14px' }}>
              ⏱️ Speelduur: {sessionInfo.duration_minutes} minuten
            </p>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Teamnaam</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
              autoComplete="username"
              minLength={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Wachtwoord</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="new-password"
              minLength={6}
            />
          </div>

          <p className="info-message" style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
            💡 Een unieke teamkleur wordt automatisch toegewezen bij registratie
          </p>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Bezig met registreren...' : 'Registreren'}
          </button>
        </form>

        <p className="auth-link">
          Al een account? <Link to="/login">Inloggen</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
