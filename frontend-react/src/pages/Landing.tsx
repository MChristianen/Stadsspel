import React from 'react';
import { useNavigate, Link } from 'react-router-dom';

const Landing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem',
    }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{ fontSize: '5rem', lineHeight: 1, marginBottom: '1rem' }}>🏙️</div>
        <h1 style={{
          color: '#fff',
          fontSize: '3rem',
          fontWeight: '800',
          margin: '0 0 0.5rem',
          letterSpacing: '-0.5px',
        }}>
          Stadsspel
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '1.1rem', margin: 0 }}>
          Verover de stad, versla je tegenstanders
        </p>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        width: '100%',
        maxWidth: '340px',
      }}>
        <button
          onClick={() => navigate('/join')}
          style={{
            background: '#fff',
            color: '#667eea',
            border: 'none',
            padding: '1.1rem 1.5rem',
            borderRadius: '12px',
            fontSize: '1.15rem',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            transition: 'transform 0.1s, box-shadow 0.1s',
          }}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          Neem deel aan een spel
        </button>

        <button
          onClick={() => navigate('/login')}
          style={{
            background: 'transparent',
            color: '#fff',
            border: '2px solid rgba(255,255,255,0.55)',
            padding: '1rem 1.5rem',
            borderRadius: '12px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          Inloggen
        </button>
      </div>

      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', marginTop: '3rem' }}>
        <Link to="/uitleg" style={{ color: 'inherit', textDecoration: 'underline' }}>
          Hoe werkt het?
        </Link>
      </p>
    </div>
  );
};

export default Landing;
