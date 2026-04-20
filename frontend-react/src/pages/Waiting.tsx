import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const Waiting: React.FC = () => {
  const navigate = useNavigate();
  const { team } = useAuth();

  const { data: gameStatus } = useQuery({
    queryKey: ['gameStatus'],
    queryFn: () => apiClient.getGameStatus(),
    refetchInterval: 3000, // Poll every 3 seconds
  });

  useEffect(() => {
    if (gameStatus?.is_active) {
      navigate('/');
    }
  }, [gameStatus, navigate]);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>🎉 Registratie Voltooid!</h1>
        
        <div style={{ 
          background: '#e8f5e9', 
          padding: '20px', 
          borderRadius: '12px', 
          marginBottom: '30px',
          border: '2px solid #4caf50',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>✅</div>
          <h2 style={{ marginTop: 0, marginBottom: '10px', color: '#2e7d32' }}>
            Je team is aangemeld!
          </h2>
          <p style={{ fontSize: '18px', margin: '10px 0', fontWeight: 'bold' }}>
            Team: <span style={{ color: team?.color }}>{team?.name}</span>
          </p>
        </div>

        <div style={{ 
          background: '#fff3cd', 
          padding: '20px', 
          borderRadius: '12px', 
          marginBottom: '30px',
          border: '2px solid #ffc107'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '10px', textAlign: 'center' }}>⏳</div>
          <h3 style={{ marginTop: 0, marginBottom: '15px', textAlign: 'center', color: '#856404' }}>
            Wachten op admin...
          </h3>
          <p style={{ textAlign: 'center', margin: '10px 0', lineHeight: '1.6' }}>
            Je registratie is succesvol verstuurd naar de admin. 
            Het spel start zodra de admin alle teams heeft verzameld en op de startknop drukt.
          </p>
        </div>

        <div style={{ 
          padding: '15px', 
          background: '#f8f9fa', 
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h4 style={{ marginTop: 0, marginBottom: '10px' }}>💡 Wat gebeurt er nu?</h4>
          <ol style={{ textAlign: 'left', lineHeight: '1.8', paddingLeft: '20px', margin: 0 }}>
            <li>De admin ziet jullie team verschijnen in het overzicht</li>
            <li>Wanneer alle teams zijn aangemeld, start de admin het spel</li>
            <li>Je wordt automatisch doorgestuurd naar het speelveld</li>
            <li>Dan kun je gebieden beginnen te veroveren!</li>
          </ol>
        </div>

        <div style={{ textAlign: 'center', color: '#666', fontSize: '14px' }}>
          <div className="loading-dots" style={{ marginBottom: '10px' }}>
            <span style={{ animation: 'pulse 1.5s infinite' }}>●</span>
            <span style={{ animation: 'pulse 1.5s infinite 0.2s' }}>●</span>
            <span style={{ animation: 'pulse 1.5s infinite 0.4s' }}>●</span>
          </div>
          <p style={{ margin: 0 }}>
            Deze pagina vernieuwt automatisch wanneer het spel start
          </p>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
};

export default Waiting;
