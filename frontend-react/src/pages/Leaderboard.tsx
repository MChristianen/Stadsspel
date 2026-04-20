import React from 'react';
import '../leaderboard.css';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';

const Leaderboard: React.FC = () => {
  const { data: leaderboard = [], isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => apiClient.getLeaderboard(),
    refetchInterval: 5000,
  });

  const { data: gameStatus } = useQuery({
    queryKey: ['gameStatus'],
    queryFn: () => apiClient.getGameStatus(),
    refetchInterval: 5000,
  });

  if (isLoading) {
    return <div>Laden...</div>;
  }

  return (
    <div className="scoreboard-container">
      <h1>Scorebord</h1>

      {gameStatus?.is_finished && gameStatus.join_code && (
        <div style={{
          background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
          color: 'white',
          padding: '14px 18px',
          borderRadius: '10px',
          marginBottom: '16px',
          textAlign: 'center',
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>🏁 Spel afgelopen — bekijk het volledige eindoverzicht</div>
          <a
            href={`/results/${gameStatus.join_code}`}
            style={{
              display: 'inline-block',
              background: 'white',
              color: '#11998e',
              fontWeight: 'bold',
              padding: '8px 20px',
              borderRadius: '6px',
              textDecoration: 'none',
            }}
          >
            Eindoverzicht →
          </a>
        </div>
      )}

      {leaderboard.length === 0 ? (
        <p className="empty-message">Nog geen punten. Verover als eerste een gebied!</p>
      ) : (
        <div className="scoreboard-list">
          {leaderboard.map((entry) => (
            <div key={entry.team_id} className="scoreboard-row">
              <div className="scoreboard-rank">#{entry.rank}</div>
              <div className="scoreboard-color" style={{ backgroundColor: entry.team_color }}></div>
              <div className="scoreboard-team">{entry.team_name}</div>
              <div className="scoreboard-summary">
                {entry.points.toFixed(1)} punten · {entry.territory_count} {entry.territory_count === 1 ? 'gebied' : 'gebieden'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
