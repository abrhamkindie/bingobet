import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import * as api from '../api.js';
import { PlayerContext, ToastContext } from '../App.jsx';
import { Ticket, Trophy, Wallet, RefreshCw, Gamepad2, Sparkles, Clock, TrendingUp, Zap } from 'lucide-react';

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-5 w-36 rounded-lg bg-white/[0.08]" />
          <div className="mt-2 flex gap-3">
            <div className="h-4 w-16 rounded-lg bg-white/[0.05]" />
            <div className="h-4 w-20 rounded-lg bg-white/[0.05]" />
            <div className="h-4 w-24 rounded-lg bg-white/[0.05]" />
          </div>
        </div>
        <div className="h-8 w-16 rounded-lg bg-white/[0.08]" />
      </div>
    </div>
  );
}

function ProgressBar({ current, max }) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 animate-progress"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function CountdownTimer({ targetDate }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    if (!targetDate) return;
    const tick = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) { setRemaining('Now'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!remaining) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-amber-300">
      <Clock size={10} /> {remaining}
    </span>
  );
}

export default function HomeScreen({ navigate }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const { player, reload: reloadPlayer } = useContext(PlayerContext);
  const { addToast } = useContext(ToastContext);

  const loadGames = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await api.getGames();
      setGames(data.games || []);
    } catch (err) {
      setError(err.message || 'Failed to load games');
      if (!silent) addToast('Could not load games', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => { loadGames(); }, [loadGames]);

  const handleRefresh = () => { setRefreshing(true); loadGames(true); };

  const handleBuyTicket = async (gameId) => {
    try {
      const result = await api.buyTicket(gameId);
      addToast(`Ticket #${result.ticket.position} purchased!`, 'success');
      reloadPlayer();
      navigate('tickets');
    } catch (err) {
      const msg = err.message === 'INSUFFICIENT_BALANCE' ? 'Insufficient balance. Please deposit first.'
        : err.message === 'GAME_SOLD_OUT' ? 'This game is sold out!'
        : err.message || 'Failed to buy ticket';
      addToast(msg, 'error');
    }
  };

  const activeGames = useMemo(() => games.filter(g => g.status === 'active' || g.status === 'upcoming'), [games]);
  const totalPrizePool = useMemo(() => games.reduce((sum, g) => sum + Number(g.prize_pool || 0), 0), [games]);
  const totalTicketsSold = useMemo(() => games.reduce((sum, g) => sum + Number(g.tickets_sold || 0), 0), [games]);

  return (
    <div className="home-orbit min-h-full">
      {/* Hero */}
      <div className="px-4 pb-2 pt-6">
        <div className="relative mb-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center backdrop-blur">
          <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-12 h-36 w-36 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative animate-scale-in">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-cyan-500/20 to-cyan-600/5 shadow-[0_0_24px_rgba(34,211,238,0.2)]">
              <Sparkles size={28} className="text-cyan-300" />
            </div>
            <h1 className="text-2xl font-black text-white" style={{ textShadow: '0 0 18px rgba(103,232,249,0.3)' }}>BetBingo</h1>
            <p className="mt-1 text-sm text-slate-400">Try your luck, win big!</p>
          </div>
          {player && (
            <div className="mx-auto mt-3 inline-flex animate-fade-in-up items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-emerald-300 backdrop-blur transition-all hover:border-emerald-300/20 hover:bg-emerald-400/10" style={{ animationDelay: '0.2s' }}>
              <Wallet size={12} />
              <span className="font-semibold">{Number(player.wallet_balance).toFixed(0)} ETB</span>
            </div>
          )}
        </div>

        {/* Stats strip */}
        {!loading && games.length > 0 && (
          <div className="mb-5 grid grid-cols-3 gap-2 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-center backdrop-blur">
              <p className="text-[10px] text-slate-400">Active</p>
              <p className="text-sm font-bold text-cyan-300">{activeGames.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-center backdrop-blur">
              <p className="text-[10px] text-slate-400">Tickets</p>
              <p className="text-sm font-bold text-white">{totalTicketsSold}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-center backdrop-blur">
              <p className="text-[10px] text-slate-400">Prize Pool</p>
              <p className="text-sm font-bold text-emerald-300">{totalPrizePool.toFixed(0)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Games list */}
      <div className="px-4 pb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-white/90">
            <span className="inline-flex items-center gap-1.5">
              <Zap size={14} className="text-cyan-300" />
              Games
            </span>
            {!loading && activeGames.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold text-cyan-300">{activeGames.length}</span>
            )}
          </h2>
          <button onClick={handleRefresh} disabled={refreshing}
            className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 transition-all hover:border-cyan-300/20 hover:text-cyan-300 active:scale-95 disabled:opacity-50">
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center backdrop-blur">
            <p className="text-sm text-red-300">{error}</p>
            <button onClick={() => loadGames()} className="mt-3 rounded-xl bg-white/10 px-4 py-2 text-xs font-medium text-white backdrop-blur hover:bg-white/20 active:scale-95">Try Again</button>
          </div>
        ) : games.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center backdrop-blur">
            <Gamepad2 size={36} className="mx-auto mb-3 text-slate-500" />
            <p className="text-sm font-medium text-slate-400">No games available</p>
            <p className="mt-1 text-xs text-slate-500">Check back soon for new games</p>
          </div>
        ) : (
          <div className="space-y-3">
            {games.map((game, index) => {
              const pct = game.max_tickets > 0 ? Math.round((game.tickets_sold / game.max_tickets) * 100) : 0;
              return (
                <div
                  key={game.id}
                  className="group animate-slide-up cursor-pointer rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur transition-all duration-200 hover:border-cyan-300/20 hover:bg-white/[0.07] hover:shadow-[0_0_24px_rgba(34,211,238,0.08)]"
                  style={{ animationDelay: `${index * 80}ms` }}
                  onClick={() => navigate('games')}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white truncate">{game.title}</h3>
                        {game.scheduled_draw_at && <CountdownTimer targetDate={game.scheduled_draw_at} />}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Ticket size={11} className="text-cyan-400" />
                          {game.ticket_price} ETB
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <TrendingUp size={11} className="text-slate-500" />
                          {game.tickets_sold}/{game.max_tickets}
                        </span>
                        <span className="inline-flex items-center gap-1 text-amber-300/80">
                          <Trophy size={11} />
                          {Number(game.prize_pool).toFixed(0)} ETB
                        </span>
                      </div>
                      <ProgressBar current={game.tickets_sold} max={game.max_tickets} />
                      <p className="mt-1 text-[10px] text-slate-500">{pct}% filled</p>
                    </div>
                    <div className="ml-3 shrink-0">
                      {game.status === 'active' ? (
                        <button onClick={(e) => { e.stopPropagation(); handleBuyTicket(game.id); }}
                          className="rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 px-3.5 py-2 text-xs font-bold text-white shadow-[0_0_12px_rgba(34,211,238,0.2)] transition-all duration-200 hover:from-cyan-500 hover:to-cyan-400 hover:shadow-[0_0_20px_rgba(34,211,238,0.35)] active:scale-90">
                          Buy
                        </button>
                      ) : (
                        <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-medium text-slate-400">{game.status}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
