import React, { useState, useEffect, useContext, useCallback } from 'react';
import * as api from '../api.js';
import { ToastContext } from '../App.jsx';
import { Gamepad2, Ticket, Trophy, ArrowLeft, RefreshCw, ShoppingCart, Sparkles, DollarSign, Target, ChevronRight, TrendingUp } from 'lucide-react';

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-5 w-36 rounded-lg bg-white/[0.08]" />
          <div className="mt-2 flex gap-3">
            <div className="h-4 w-16 rounded-lg bg-white/[0.05]" />
            <div className="h-4 w-20 rounded-lg bg-white/[0.05]" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-16 rounded-lg bg-white/[0.08]" />
          <div className="h-8 w-16 rounded-lg bg-white/[0.08]" />
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ current, max }) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 animate-progress" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function GamesScreen({ navigate }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [buying, setBuying] = useState(null);
  const { addToast } = useContext(ToastContext);

  const loadGames = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await api.getGames({ limit: 50 });
      setGames(data.games || []);
    } catch (err) { setError(err.message || 'Failed to load games'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadGames(); }, [loadGames]);

  const handleBuy = async (gameId) => {
    setBuying(gameId);
    try {
      await api.buyTicket(gameId);
      addToast('Ticket purchased!', 'success');
      setSelected(null);
      navigate('tickets');
    } catch (err) {
      addToast(err.message === 'INSUFFICIENT_BALANCE' ? 'Insufficient balance. Deposit first.'
        : err.message === 'GAME_SOLD_OUT' ? 'Sold out!'
        : err.message || 'Failed', 'error');
    } finally { setBuying(null); }
  };

  if (selected) {
    const game = selected;
    const tiers = game.prize_tiers || [];
    const pct = game.max_tickets > 0 ? Math.round((game.tickets_sold / game.max_tickets) * 100) : 0;

    return (
      <div className="min-h-full bg-gradient-dark px-4 pb-6 pt-4">
        <button onClick={() => setSelected(null)}
          className="group mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-400 transition-all hover:text-cyan-300">
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
          Back to Games
        </button>

        <div className="animate-scale-in overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur">
          <div className="relative bg-gradient-to-br from-cyan-600/20 to-cyan-800/10 px-5 pb-5 pt-6">
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-400/10 shadow-[0_0_14px_rgba(34,211,238,0.12)]">
                <Trophy size={22} className="text-cyan-300" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{game.title}</h2>
                <p className="mt-0.5 text-sm text-slate-400">{game.description}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-5">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400"><DollarSign size={12} /> Price</div>
              <p className="mt-1 text-lg font-bold text-white">{game.ticket_price} <span className="text-sm font-medium text-cyan-300">ETB</span></p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400"><Ticket size={12} /> Sold</div>
              <p className="mt-1 text-lg font-bold text-white">{game.tickets_sold}<span className="text-sm font-medium text-slate-400">/{game.max_tickets}</span></p>
              <ProgressBar current={game.tickets_sold} max={game.max_tickets} />
              <p className="mt-0.5 text-[10px] text-slate-500">{pct}% filled</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400"><Sparkles size={12} /> Pool</div>
              <p className="mt-1 text-lg font-bold text-emerald-300">{game.prize_pool.toFixed(0)} <span className="text-sm font-medium text-emerald-300/70">ETB</span></p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400"><Target size={12} /> Numbers</div>
              <p className="mt-1 text-lg font-bold text-white">{game.number_min}-{game.number_max}</p>
            </div>
          </div>

          {tiers.length > 0 && (
            <div className="border-t border-white/[0.06] px-5 pb-5 pt-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Prize Tiers</p>
              <div className="space-y-1.5">
                {tiers.map((tier, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.02] px-3.5 py-2.5 transition-all hover:border-cyan-300/10 hover:bg-cyan-400/[0.03]" style={{ animationDelay: `${i * 50}ms` }}>
                    <span className="text-sm text-slate-300">Match {tier.match}</span>
                    <span className="text-sm font-bold text-cyan-300">
                      {tier.is_jackpot ? <span className="inline-flex items-center gap-1"><Sparkles size={14} /> JACKPOT</span> : `${tier.payout_multiplier}x`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(game.status === 'active' || game.status === 'upcoming') && (
            <div className="border-t border-white/[0.06] px-5 pb-5 pt-4">
              <button onClick={() => handleBuy(game.id)} disabled={buying === game.id}
                className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 py-3.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(34,211,238,0.2)] transition-all duration-200 hover:from-cyan-500 hover:to-cyan-400 hover:shadow-[0_0_30px_rgba(34,211,238,0.35)] active:scale-[0.98] disabled:opacity-60">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <span className="relative inline-flex items-center gap-2">
                  {buying === game.id ? (
                    <><RefreshCw size={16} className="animate-spin" /> Buying...</>
                  ) : (
                    <><ShoppingCart size={16} /> Buy Ticket — {game.ticket_price} ETB</>
                  )}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-dark px-4 pb-6 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white/90">
          <span className="inline-flex items-center gap-1.5">
            <Gamepad2 size={18} className="text-cyan-300" /> Games
          </span>
          {!loading && games.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-300">{games.length}</span>
          )}
        </h2>
        <button onClick={loadGames} disabled={loading}
          className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 transition-all hover:border-cyan-300/20 hover:text-cyan-300 active:scale-95 disabled:opacity-50">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center backdrop-blur">
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={loadGames} className="mt-3 rounded-xl bg-white/10 px-4 py-2 text-xs font-medium text-white backdrop-blur hover:bg-white/20 active:scale-95">Try Again</button>
        </div>
      ) : games.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center backdrop-blur">
          <Gamepad2 size={36} className="mx-auto mb-3 text-slate-500" />
          <p className="text-sm font-medium text-slate-400">No games available</p>
        </div>
      ) : (
        <div className="space-y-3">
          {games.map((game, index) => (
            <div key={game.id} className="group animate-slide-up rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur transition-all duration-200 hover:border-cyan-300/20 hover:bg-white/[0.07]" style={{ animationDelay: `${index * 60}ms` }}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white truncate">{game.title}</h3>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1"><DollarSign size={10} /> {game.ticket_price} ETB</span>
                    <span className="inline-flex items-center gap-1"><TrendingUp size={10} /> {game.tickets_sold}/{game.max_tickets}</span>
                    <span className="text-emerald-300/70">{Number(game.prize_pool).toFixed(0)} ETB</span>
                  </div>
                  <ProgressBar current={game.tickets_sold} max={game.max_tickets} />
                </div>
                <div className="ml-3 shrink-0 flex gap-2">
                  <button onClick={() => setSelected(game)}
                    className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 backdrop-blur transition-all hover:border-white/20 hover:bg-white/10 active:scale-95">View</button>
                  {(game.status === 'active' || game.status === 'upcoming') && (
                    <button onClick={() => handleBuy(game.id)} disabled={buying === game.id}
                      className="rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-[0_0_10px_rgba(34,211,238,0.15)] transition-all hover:from-cyan-500 hover:to-cyan-400 hover:shadow-[0_0_16px_rgba(34,211,238,0.3)] active:scale-95 disabled:opacity-60">
                      {buying === game.id ? '...' : 'Buy'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
