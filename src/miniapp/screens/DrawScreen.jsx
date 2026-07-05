import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../api.js';
import { Radio, Clock, CheckCircle2, Ticket, RefreshCw, AlertCircle, Trophy, ListChecks } from 'lucide-react';

export default function DrawScreen({ navigate }) {
  const [games, setGames] = useState([]);
  const [activeGame, setActiveGame] = useState(null);
  const [drawnNumbers, setDrawnNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [completedGames, setCompletedGames] = useState([]);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getGames();
      const gameList = data.games || [];
      setGames(gameList);

      const drawGame = gameList.find(g => g.status === 'drawing') || gameList.find(g => g.status === 'active');
      if (drawGame) {
        setActiveGame(drawGame);
        try {
          const nums = await api.getDrawnNumbers(drawGame.id);
          setDrawnNumbers(nums.numbers || []);
        } catch { setDrawnNumbers([]); }
      } else {
        setActiveGame(null);
        setDrawnNumbers([]);
      }

      // Load completed games too
      try {
        const completed = await api.getCompletedGames();
        setCompletedGames(completed.games || []);
      } catch { /* ignore */ }
    } catch (err) {
      setError('Failed to load draw data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-full bg-gradient-dark px-4 pt-4">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-cyan-400" />
          <p className="mt-4 text-sm text-slate-500">Loading draw...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-dark px-4 pb-6 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio size={18} className="text-cyan-300" />
          <h2 className="text-lg font-bold text-white/90">Live Draw</h2>
        </div>
        <button onClick={loadData}
          className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 transition-all hover:border-cyan-300/20 hover:text-cyan-300 active:scale-95">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center backdrop-blur">
          <AlertCircle size={32} className="mx-auto mb-3 text-red-300" />
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={loadData} className="mt-3 rounded-xl bg-white/10 px-4 py-2 text-xs font-medium text-white backdrop-blur hover:bg-white/20 active:scale-95">Try Again</button>
        </div>
      ) : !activeGame && completedGames.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center backdrop-blur">
          <Clock size={36} className="mx-auto mb-3 text-slate-500" />
          <p className="text-sm font-medium text-slate-400">No draws yet</p>
          <p className="mt-1 text-xs text-slate-500">Check back when a draw is in progress</p>
        </div>
      ) : (
        <div>
          {/* Active draw */}
          {activeGame ? (
            <div className="mb-4 animate-scale-in">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white">{activeGame.title}</h3>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className={`inline-flex h-2 w-2 rounded-full ${activeGame.status === 'drawing' ? 'bg-amber-400 animate-pulse shadow-[0_0_6px_rgba(251,191,36,0.6)]' : 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]'}`} />
                      <span className="text-xs text-slate-400">
                        {activeGame.status === 'drawing' ? 'Draw in progress...' : 'Waiting for draw'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Tickets</p>
                    <p className="text-lg font-bold text-white">{activeGame.tickets_sold}</p>
                  </div>
                </div>
              </div>

              {/* Number balls */}
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-xs text-slate-400">
                    Drawn: <span className="font-bold text-white">{drawnNumbers.length}</span>/{activeGame.numbers_to_draw}
                  </p>
                  {drawnNumbers.length === activeGame.numbers_to_draw && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-300 animate-scale-in">
                      <CheckCircle2 size={10} /> Complete
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap justify-center gap-3">
                  {Array.from({ length: activeGame.numbers_to_draw }, (_, i) => {
                    const num = drawnNumbers[i];
                    const isLatest = num !== undefined && i === drawnNumbers.length - 1;
                    return (
                      <div
                        key={i}
                        className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold transition-all duration-500 ${
                          num !== undefined
                            ? `bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-[0_0_16px_rgba(34,211,238,0.4)] scale-100 animate-number-pop ${isLatest ? 'shadow-[0_0_28px_rgba(34,211,238,0.7)]' : ''}`
                            : 'bg-white/5 text-slate-600 scale-90 border border-white/10'
                        } ${isLatest ? 'animate-float' : ''}`}
                        style={{ animationDelay: `${i * 80}ms` }}
                      >
                        {num !== undefined ? String(num).padStart(2, '0') : '?'}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Drawn numbers list */}
              {drawnNumbers.length > 0 && (
                <div className="mt-3 animate-fade-in-up rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
                  <p className="mb-2 text-xs text-slate-400">Drawn Numbers (in order):</p>
                  <p className="text-lg font-bold tracking-wider text-cyan-300 text-glow-cyan">
                    {drawnNumbers.map((n, i) => (
                      <span key={i} className="animate-count-up inline-block mx-1" style={{ animationDelay: `${i * 100}ms` }}>
                        {String(n).padStart(2, '0')}{i < drawnNumbers.length - 1 ? ' · ' : ''}
                      </span>
                    ))}
                  </p>
                </div>
              )}
            </div>
          ) : null}

          {/* Check tickets button */}
          {activeGame && (
            <button onClick={() => navigate('tickets')}
              className="group relative mt-4 w-full overflow-hidden rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 py-3.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(34,211,238,0.15)] transition-all duration-200 hover:from-cyan-500 hover:to-cyan-400 hover:shadow-[0_0_30px_rgba(34,211,238,0.3)] active:scale-[0.98]">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative inline-flex items-center gap-2"><Ticket size={16} /> Check My Tickets</span>
            </button>
          )}

          {/* Recent completed draws */}
          {completedGames.length > 0 && (
            <div className="mt-6">
              <button onClick={() => setShowCompleted(!showCompleted)}
                className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 transition-all hover:text-cyan-300">
                <ListChecks size={14} />
                Past Results ({completedGames.length})
                <ChevronRight size={14} className={`transition-transform ${showCompleted ? 'rotate-90' : ''}`} />
              </button>

              {showCompleted && (
                <div className="space-y-2">
                  {completedGames.slice(0, 5).map((game, i) => (
                    <div key={game.id} className="animate-slide-up rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur" style={{ animationDelay: `${i * 60}ms` }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-white text-sm">{game.title}</h4>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {game.winner_count} winner{game.winner_count !== 1 ? 's' : ''} · {Number(game.total_payout).toFixed(0)} ETB paid
                          </p>
                        </div>
                        <Trophy size={16} className="text-amber-400/80" />
                      </div>
                      {game.drawn_numbers && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {game.drawn_numbers.map((n, idx) => (
                            <span key={idx} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/20 text-[10px] font-bold text-cyan-300">{String(n).padStart(2, '0')}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state for no active draw but has completed */}
          {!activeGame && completedGames.length > 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center backdrop-blur">
              <Clock size={24} className="mx-auto mb-2 text-slate-500" />
              <p className="text-xs text-slate-400">No active draw right now</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChevronRight({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
