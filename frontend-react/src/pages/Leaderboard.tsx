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

  if (isLoading) {
    return <div>Laden...</div>;
  }

  return (
    <div className="scoreboard-container">
      <h1>Scorebord</h1>
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
