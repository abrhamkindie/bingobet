import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import * as api from '../api.js';
import { ToastContext } from '../App.jsx';
import { Ticket, RefreshCw, Plus, Trophy, AlertCircle, Sparkles, Clock } from 'lucide-react';

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-5 w-40 rounded-lg bg-white/[0.08]" />
          <div className="mt-2 h-4 w-28 rounded-lg bg-white/[0.05]" />
        </div>
        <div className="h-5 w-20 rounded-lg bg-white/[0.08]" />
      </div>
    </div>
  );
}

export default function TicketsScreen({ navigate }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const { addToast } = useContext(ToastContext);

  const loadTickets = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await api.getTickets({ limit: 50 });
      setTickets(data.tickets || []);
    } catch (err) {
      setError('Failed to load tickets');
      addToast('Could not load tickets', 'error');
    } finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => { loadTickets(); }, [loadTickets]);
  const handleBuyMore = () => navigate('games');

  const stats = useMemo(() => {
    const total = tickets.length;
    const won = tickets.filter(t => t.status === 'won').length;
    const lost = tickets.filter(t => t.status === 'lost').length;
    const active = tickets.filter(t => t.status === 'active' || t.status === 'pending').length;
    const totalWon = tickets.reduce((s, t) => s + Number(t.prize_amount || 0), 0);
    return { total, won, lost, active, totalWon };
  }, [tickets]);

  const filtered = useMemo(() => {
    if (filter === 'won') return tickets.filter(t => t.status === 'won');
    if (filter === 'lost') return tickets.filter(t => t.status === 'lost');
    if (filter === 'active') return tickets.filter(t => t.status === 'active' || t.status === 'pending');
    return tickets;
  }, [tickets, filter]);

  const filters = [
    { key: 'all', label: 'All', count: stats.total },
    { key: 'active', label: 'Active', count: stats.active },
    { key: 'won', label: 'Won', count: stats.won },
    { key: 'lost', label: 'Lost', count: stats.lost },
  ];

  return (
    <div className="min-h-full bg-gradient-dark px-4 pb-6 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ticket size={18} className="text-cyan-300" />
          <h2 className="text-lg font-bold text-white/90">
            My Tickets
            {!loading && tickets.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-300">{tickets.length}</span>
            )}
          </h2>
        </div>
        <button onClick={loadTickets} disabled={loading}
          className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 transition-all hover:border-cyan-300/20 hover:text-cyan-300 active:scale-95 disabled:opacity-50">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center backdrop-blur">
          <AlertCircle size={32} className="mx-auto mb-3 text-red-300" />
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={loadTickets} className="mt-3 rounded-xl bg-white/10 px-4 py-2 text-xs font-medium text-white backdrop-blur hover:bg-white/20 active:scale-95">Try Again</button>
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center backdrop-blur">
          <Ticket size={36} className="mx-auto mb-3 text-slate-500" />
          <p className="text-sm font-medium text-slate-400">No tickets yet</p>
          <p className="mt-1 text-xs text-slate-500">Buy one now and try your luck!</p>
          <button onClick={handleBuyMore}
            className="mx-auto mt-4 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_16px_rgba(34,211,238,0.2)] transition-all hover:from-cyan-500 hover:to-cyan-400 active:scale-95">
            <Plus size={16} /> Buy Ticket
          </button>
        </div>
      ) : (
        <div>
          {/* Stats summary */}
          <div className="mb-4 grid grid-cols-4 gap-2 animate-fade-in-up">
            {filters.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`rounded-xl border p-2 text-center backdrop-blur transition-all active:scale-95 ${
                  filter === f.key
                    ? 'border-cyan-300/30 bg-cyan-500/10'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                }`}>
                <p className="text-lg font-bold text-white">{f.count}</p>
                <p className={`text-[9px] font-medium uppercase tracking-wider ${filter === f.key ? 'text-cyan-300' : 'text-slate-400'}`}>{f.label}</p>
              </button>
            ))}
          </div>

          {/* Win count banner */}
          {stats.won > 0 && (
            <div className="mb-3 animate-scale-in rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-center backdrop-blur">
              <p className="inline-flex items-center gap-1 text-xs text-emerald-300/80">
                <Sparkles size={12} className="shrink-0 text-emerald-300" />
                You've won <span className="font-bold text-emerald-200">{stats.totalWon.toFixed(0)} ETB</span> across <span className="font-bold text-emerald-200">{stats.won}</span> ticket{stats.won > 1 ? 's' : ''}!
              </p>
            </div>
          )}

          {/* Ticket list */}
          <div className="space-y-3">
            {filtered.map((ticket, index) => {
              const isWinner = ticket.status === 'won';
              return (
                <div key={ticket.id}
                  className={`group animate-slide-up rounded-2xl border p-4 backdrop-blur transition-all duration-200 ${
                    isWinner
                      ? 'border-emerald-500/20 bg-emerald-500/[0.04] hover:border-emerald-400/30'
                      : 'border-white/10 bg-white/[0.04] hover:border-white/20'
                  }`}
                  style={{ animationDelay: `${index * 40}ms` }}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-bold text-white">{ticket.game_title}</span>
                        {isWinner && <Trophy size={14} className="shrink-0 text-amber-400" />}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-slate-400">
                        <span className="font-medium text-cyan-300/80">#{ticket.position}</span>
                        <span className="text-slate-600">—</span>
                        <span>{ticket.numbers?.join(', ')}</span>
                        {ticket.draw_time && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-300/60"><Clock size={9} /> {new Date(ticket.draw_time).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="ml-3 shrink-0 text-right">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                        isWinner ? 'bg-emerald-500/15 text-emerald-300 animate-pulse-glow' : ticket.status === 'lost' ? 'bg-red-500/10 text-red-300' : 'bg-white/10 text-slate-300'
                      }`}>
                        {isWinner ? `${Number(ticket.prize_amount).toFixed(0)} ETB` : ticket.status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Buy more */}
          <button onClick={handleBuyMore}
            className="group mt-4 w-full rounded-2xl border border-dashed border-white/10 py-3.5 text-sm text-slate-400 backdrop-blur transition-all hover:border-cyan-300/20 hover:text-cyan-300 active:scale-[0.98]">
            <span className="inline-flex items-center gap-1.5"><Plus size={14} /> Buy More Tickets</span>
          </button>
        </div>
      )}
    </div>
  );
}
