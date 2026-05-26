import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import apiClient from '../services/api';
import type { SessionResponse } from '../types/api';

const PinEntry: React.FC = () => {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = pin.trim().toUpperCase();
    if (!code) return;

    setLoading(true);
    setError('');

    try {
      const session = await apiClient.getSession(code);
      if (session.is_finished) {
        navigate(`/results/${code}`, { replace: true });
        return;
      }
      navigate(`/join/${code}`);
    } catch {
      setError('Ongeldige spelcode. Controleer de code en probeer opnieuw.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>🏙️ Stadsspel</h1>
        <h2>Neem deel</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="pin">Spelcode</label>
            <input
              type="text"
              id="pin"
              value={pin}
              onChange={e => setPin(e.target.value.toUpperCase())}
              placeholder="bijv. ABC123"
              required
              disabled={loading}
              autoComplete="off"
              autoFocus
              maxLength={12}
              style={{
                fontSize: '1.75rem',
                textAlign: 'center',
                letterSpacing: '0.25em',
                fontWeight: '700',
                textTransform: 'uppercase',
              }}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading || !pin.trim()} className="btn-primary">
            {loading ? 'Controleren...' : 'Doe mee'}
          </button>
        </form>

        <p className="auth-link">
          Al een account? <Link to="/login">Inloggen</Link>
        </p>
      </div>
    </div>
  );
};

const Join: React.FC = () => {
  const { joinCode } = useParams<{ joinCode: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSession = async () => {
      if (!joinCode) return;
      
      setLoading(true);
      try {
        const sessionData = await apiClient.getSession(joinCode);
        if (sessionData.is_finished) {
          navigate(`/results/${joinCode}`, { replace: true });
          return;
        }
        setSession(sessionData);
      } catch (err) {
        setError('Ongeldige join code. Controleer de link en probeer opnieuw.');
        console.error('Failed to fetch session:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [joinCode, navigate]);

  if (!joinCode) {
    return <PinEntry />;
  }

  if (loading) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1>🏙️ Stadsspel</h1>
          <p>Laden...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1>🏙️ Stadsspel</h1>
          <h2>Oeps!</h2>
          <div className="error-message">{error || 'Sessie niet gevonden'}</div>
          <p className="auth-link">
            <Link to="/login">Terug naar inloggen</Link>
          </p>
        </div>
      </div>
    );
  }

  const registerLink = `/register?session=${joinCode}`;

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>🏙️ Stadsspel</h1>
        <h2>Je bent uitgenodigd!</h2>
        
        <div style={{ 
          background: '#e3f2fd', 
          padding: '20px', 
          borderRadius: '12px', 
          marginBottom: '30px',
          border: '2px solid #2196f3'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#1565c0' }}>
            🎮 {session.city_name}
          </h3>
          <div style={{ fontSize: '16px', lineHeight: '1.8' }}>
            <p style={{ margin: '8px 0' }}>
              ⏱️ <strong>Speelduur:</strong> {session.duration_minutes} minuten
            </p>
            <p style={{ margin: '8px 0' }}>
              👥 <strong>Teams:</strong> {session.team_count} aangemeld
            </p>
            {session.is_active ? (
              <p style={{ margin: '8px 0', color: '#4caf50', fontWeight: 'bold' }}>
                ✅ Spel is actief!
              </p>
            ) : (
              <p style={{ margin: '8px 0', color: '#ff9800', fontWeight: 'bold' }}>
                ⏳ Wacht op start door admin
              </p>
            )}
          </div>
        </div>

        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ marginBottom: '15px' }}>Hoe werkt het?</h3>
          <ol style={{ textAlign: 'left', lineHeight: '1.8', paddingLeft: '20px' }}>
            <li>Registreer je team met een unieke naam</li>
            <li>Je krijgt automatisch een teamkleur toegewezen</li>
            <li>Verover gebieden door opdrachten te voltooien</li>
            <li>De admin keurt je inzendingen goed</li>
            <li>Het team met de meeste punten wint!</li>
          </ol>
        </div>

        <Link to={registerLink} className="btn-primary" style={{ 
          display: 'inline-block', 
          textDecoration: 'none',
          padding: '12px 24px',
          marginBottom: '15px'
        }}>
          Registreer je Team
        </Link>

        <p className="auth-link">
          Heb je al een account? <Link to="/login">Inloggen</Link>
        </p>
      </div>
    </div>
  );
};

export default Join;
