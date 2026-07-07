import React, { useState } from 'react';
import { BarChart3, Trophy, Crown } from 'lucide-react';
import * as api from '../api.js';
import { useResource } from '../hooks/useResource.js';
import { fmtETB } from '../i18n.js';
import ScreenShell from '../components/ui/ScreenShell.jsx';
import Card from '../components/ui/Card.jsx';
import SegmentedTabs from '../components/ui/SegmentedTabs.jsx';
import { Spinner, EmptyState, ErrorState } from '../components/ui/states.jsx';

const MEDALS = ['#fbbf24', '#cbd5e1', '#d97706'];

export default function LeaderboardScreen({ onBack }) {
  const [period, setPeriod] = useState('all');
  const { data, loading, error, reload } = useResource(() => api.getLeaderboard(period), [period]);

  const rows = data?.leaderboard || [];
  const me = data?.me || null;
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <ScreenShell title="Leaderboard" subtitle="Top winners" Icon={BarChart3} onBack={onBack}>
      <SegmentedTabs
        className="mb-4 animate-slide-up"
        value={period}
        onChange={setPeriod}
        items={[{ key: 'all', label: 'All Time' }, { key: 'week', label: 'This Week' }]}
      />

      {loading ? (
        <Spinner label="Loading rankings\u2026" />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState Icon={Trophy} title="No winners yet" text="Be the first to top the board!" />
      ) : (
        <>
          {/* Podium */}
          <div className="mb-4 flex items-end justify-center gap-3 animate-slide-up">
            {[1, 0, 2].map((slot) => {
              const p = top3[slot];
              if (!p) return <div key={slot} className="w-24" />;
              const isFirst = slot === 0;
              return (
                <div key={slot} className={`flex flex-1 flex-col items-center ${isFirst ? '-mt-2' : ''}`}>
                  <div className="relative">
                    {isFirst && <Crown size={20} className="absolute -top-5 left-1/2 -translate-x-1/2 text-coin-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />}
                    <div
                      className="grid place-items-center rounded-full font-black text-amber-950 transition-all duration-200 hover:scale-105"
                      style={{
                        width: isFirst ? 68 : 56,
                        height: isFirst ? 68 : 56,
                        background: `radial-gradient(circle at 35% 28%, #fef9c3, ${MEDALS[slot]} 70%)`,
                        boxShadow: `0 0 20px ${MEDALS[slot]}55`,
                      }}
                    >
                      {(p.name || p.username || '?').slice(0, 1).toUpperCase()}
                    </div>
                  </div>
                  <p className="mt-2 max-w-[6rem] truncate text-xs font-bold text-white">{p.name || p.username || 'Player'}</p>
                  <p className="text-xs font-black text-coin-300">{fmtETB(p.total_won)} ETB</p>
                  <div
                    className="mt-1 w-full rounded-t-xl bg-white/[0.05]"
                    style={{ height: isFirst ? 40 : slot === 1 ? 28 : 20 }}
                  >
                    <p className="pt-1 text-center text-sm font-black text-slate-400">{slot + 1}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rest */}
          <div className="space-y-2">
            {rest.map((p, i) => (
              <Row key={p.id ?? i} rank={i + 4} player={p} />
            ))}
          </div>

          {/* You */}
          {me && (
            <div className="sticky bottom-24 mt-4 animate-slide-up">
              <div className="rounded-2xl border border-coin-400/30 bg-coin-500/15 p-1 shadow-[0_0_20px_rgba(251,191,36,0.12)] backdrop-blur">
                <Row rank={me.rank} player={me} highlight />
              </div>
            </div>
          )}
        </>
      )}
    </ScreenShell>
  );
}

function Row({ rank, player, highlight = false }) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-white/10 p-3 transition-all duration-300 ${
        highlight
          ? 'border-transparent'
          : 'bg-white/[0.04] hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(45,212,191,0.12)] hover:border-teal-400/40'
      }`}
    >
      {/* Gradient accent bar — left edge */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-teal-400 via-teal-500 to-emerald-500 rounded-l-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative flex items-center gap-3 pl-2.5">
        <span className={`w-6 text-center text-sm font-black ${highlight ? 'text-coin-200' : 'text-slate-400'}`}>{rank}</span>
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-sm font-black text-coin-300">
          {(player.name || player.username || '?').slice(0, 1).toUpperCase()}
        </div>
        <p className={`min-w-0 flex-1 truncate text-sm font-bold transition-colors duration-300 ${highlight ? 'text-white' : 'text-slate-200 group-hover:text-teal-100'}`}>
          {highlight ? 'You' : (player.name || player.username || 'Player')}
        </p>
        <span className="text-sm font-black text-emerald-300">{fmtETB(player.total_won)} ETB</span>
      </div>
    </div>
  );
}
