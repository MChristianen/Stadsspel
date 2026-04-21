import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../services/api';
import type { PublicResultsResponse } from '../types/api';

const W = 800, H = 300, PL = 55, PR = 20, PT = 20, PB = 40;
const plotW = W - PL - PR;
const plotH = H - PT - PB;

const PointsChart: React.FC<{ data: PublicResultsResponse }> = ({ data }) => {
  const teamColors = useMemo(() => {
    const map: Record<string, string> = {};
    data.final_standings.forEach((s) => { map[s.team_name] = s.team_color; });
    return map;
  }, [data]);

  const series = useMemo(() => {
    const teamNames = Array.from(new Set(data.points_history.map((p) => p.team_name)));
    return teamNames.map((teamName) => {
      const points = data.points_history
        .filter((p) => p.team_name === teamName)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        .map((p) => ({ t: new Date(p.timestamp).getTime(), pts: p.points }));
      return { teamName, color: teamColors[teamName] || '#999', points };
    });
  }, [data, teamColors]);

  if (series.length === 0 || series.every((s) => s.points.length === 0)) {
    return <p style={{ color: '#888' }}>Geen puntdata beschikbaar.</p>;
  }

  const allTimes = series.flatMap((s) => s.points.map((p) => p.t));
  const allPts = series.flatMap((s) => s.points.map((p) => p.pts));
  const tMin = Math.min(...allTimes);
  const tMax = Math.max(...allTimes);
  const pMax = Math.max(...allPts, 1);
  const tRange = tMax - tMin || 1;

  const toX = (t: number) => PL + ((t - tMin) / tRange) * plotW;
  const toY = (p: number) => PT + plotH - (p / pMax) * plotH;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    value: Math.round(pMax * f),
    y: toY(pMax * f),
  }));

  const xTicks = [tMin, tMin + tRange * 0.5, tMax].map((t) => ({
    t,
    x: toX(t),
    label: new Date(t).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
  }));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', fontFamily: 'sans-serif' }}>
        {yTicks.map((tick) => (
          <g key={tick.value}>
            <line x1={PL} y1={tick.y} x2={W - PR} y2={tick.y} stroke="#eee" strokeWidth={1} />
            <text x={PL - 6} y={tick.y + 4} textAnchor="end" fontSize={11} fill="#888">{tick.value}</text>
          </g>
        ))}
        {xTicks.map((tick) => (
          <text key={tick.t} x={tick.x} y={H - 8} textAnchor="middle" fontSize={10} fill="#888">{tick.label}</text>
        ))}
        <line x1={PL} y1={PT} x2={PL} y2={PT + plotH} stroke="#ccc" strokeWidth={1} />
        <line x1={PL} y1={PT + plotH} x2={W - PR} y2={PT + plotH} stroke="#ccc" strokeWidth={1} />
        {series.map((s) => {
          if (s.points.length < 2) return null;
          const pts = s.points.map((p) => `${toX(p.t)},${toY(p.pts)}`).join(' ');
          return (
            <polyline key={s.teamName} points={pts} fill="none" stroke={s.color}
              strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          );
        })}
        {series.flatMap((s) =>
          s.points.map((p, i) => (
            <circle key={`${s.teamName}-${i}`} cx={toX(p.t)} cy={toY(p.pts)} r={3} fill={s.color} />
          ))
        )}
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
        {series.map((s) => (
          <div key={s.teamName} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: s.color }} />
            {s.teamName}
          </div>
        ))}
      </div>
    </div>
  );
};

const PublicResults: React.FC = () => {
  const { joinCode } = useParams<{ joinCode: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['publicResults', joinCode],
    queryFn: () => apiClient.getPublicResults(joinCode!),
    enabled: !!joinCode,
    retry: 1,
  });

  const { data: mediaGallery = [], isLoading: loadingGallery } = useQuery({
    queryKey: ['publicResultsMedia', joinCode],
    queryFn: () => apiClient.getPublicMediaGallery(joinCode!),
    enabled: !!joinCode,
    retry: 1,
  });

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
      <PointsChart data={data} />

      <h2 style={{ marginTop: '32px' }}>Media per gebied</h2>
      {loadingGallery ? (
        <div>Laden...</div>
      ) : (
        mediaGallery.map((area) => (
          <div key={area.area_id} style={{ marginBottom: '32px' }}>
            <h3 style={{ marginBottom: '8px' }}>{area.area_name}</h3>
            {area.submissions.length === 0 ? (
              <p style={{ color: '#888', fontSize: '14px' }}>Geen media voor dit gebied.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                {area.submissions.map((sub) => (
                  <div key={sub.id} style={{ minWidth: 180, maxWidth: 220, background: '#fafafa', borderRadius: 8, padding: 8, boxShadow: '0 1px 4px #0001' }}>
                    <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 4 }}>{sub.team_name}</div>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{new Date(sub.created_at).toLocaleString()}</div>
                    <div style={{ fontSize: 13, marginBottom: 6 }}>{sub.text}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {sub.media.map((m) => (
                        m.media_type === 'PHOTO' ? (
                          <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer">
                            <img src={m.url} alt="media" loading="lazy" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4, border: '1px solid #eee' }} />
                          </a>
                        ) : (
                          <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer">
                            <video src={m.url} style={{ width: 80, height: 80, borderRadius: 4, border: '1px solid #eee' }} controls preload="none" />
                          </a>
                        )
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default PublicResults;
