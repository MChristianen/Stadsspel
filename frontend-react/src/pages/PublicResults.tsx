import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../services/api';

const PublicResults: React.FC = () => {
  const { joinCode } = useParams<{ joinCode: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['publicResults', joinCode],
    queryFn: () => apiClient.getPublicResults(joinCode!),
    enabled: !!joinCode,
    retry: 1,
  });

  type TimelineData = {
    teamNames: string[];
    rows: Array<{ timestamp: string; event: string; rows: Record<string, number> }>;
  };

  const timeline = useMemo(() => {
    if (!data) return { teamNames: [], rows: [] } as TimelineData;
    const grouped = new Map<string, { timestamp: string; event: string; rows: Record<string, number> }>();
    const teamNames = Array.from(new Set(data.final_standings.map((s) => s.team_name)));
    for (const point of data.points_history) {
      const key = `${point.timestamp}|${point.event}`;
      if (!grouped.has(key)) {
        grouped.set(key, { timestamp: point.timestamp, event: point.event, rows: {} });
      }
      grouped.get(key)!.rows[point.team_name] = point.points;
    }
    return {
      teamNames,
      rows: Array.from(grouped.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    } as TimelineData;
  }, [data]);

  if (isLoading) {
    return <div className="leaderboard-container"><h2>Laden...</h2></div>;
  }

  if (error || !data) {
    return (
      <div className="leaderboard-container">
        <h2>Resultaten niet beschikbaar</h2>
        <p>Deze uitslaglink is ongeldig of nog niet gepubliceerd.</p>
      </div>
    );
  }

  return (
    <div className="leaderboard-container">
      <h1>Uitslag - {data.city_name}</h1>
      <p>
        Sessie: <strong>{data.join_code}</strong> | Teams: <strong>{data.team_count}</strong> | Gebieden:{' '}
        <strong>{data.area_count}</strong>
      </p>

      <h2 style={{ marginTop: '20px' }}>Eindstand</h2>
      <div className="leaderboard-list">
        {data.final_standings.map((entry) => (
          <div key={entry.team_id} className="leaderboard-item">
            <div className="rank">#{entry.rank}</div>
            <div className="team-color" style={{ backgroundColor: entry.team_color }}></div>
            <div className="team-name">{entry.team_name}</div>
            <div className="areas-owned">{entry.points.toFixed(1)} punten</div>
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: '24px' }}>Puntenverloop over tijd</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Tijd</th>
              <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Event</th>
              {timeline.teamNames.map((teamName) => (
                <th key={teamName} style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #ddd' }}>
                  {teamName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeline.rows.map((row, idx) => (
              <tr key={`${row.timestamp}-${row.event}-${idx}`}>
                <td style={{ padding: '8px', borderBottom: '1px solid #f1f1f1' }}>
                  {new Date(row.timestamp).toLocaleString()}
                </td>
                <td style={{ padding: '8px', borderBottom: '1px solid #f1f1f1' }}>{row.event}</td>
                {timeline.teamNames.map((teamName) => (
                  <td key={teamName} style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #f1f1f1' }}>
                    {(row.rows[teamName] ?? 0).toFixed(1)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PublicResults;
