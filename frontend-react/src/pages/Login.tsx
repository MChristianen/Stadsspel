import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/api';

const Login: React.FC = () => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Check if user was redirected due to expired session
    if (searchParams.get('expired') === 'true') {
      setError('Je sessie is verlopen. Log opnieuw in om door te gaan.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const team = await login(name, password);
      
      if (team.is_admin) {
        // Admin always goes to admin panel
        window.location.href = '/admin';
      } else {
        // Regular team: check if game is active
        const gameStatus = await apiClient.getGameStatus();
        if (gameStatus.is_active) {
          window.location.href = '/';
        } else {
          // Game not started yet, go to waiting page
          window.location.href = '/waiting';
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Inloggen mislukt. Controleer je gegevens.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>🏙️ Stadsspel</h1>
        <h2>Inloggen</h2>
        
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
              autoComplete="current-password"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Bezig met inloggen...' : 'Inloggen'}
          </button>
        </form>

        <p className="auth-link">
          Nog geen account? <Link to="/register">Registreer hier</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
