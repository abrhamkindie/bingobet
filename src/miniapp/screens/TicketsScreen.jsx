import React, { useContext, useMemo, useState } from 'react';
import { Ticket, Trophy, Sparkles, Plus, Clock, Hash } from 'lucide-react';
import * as api from '../api.js';
import { ToastContext } from '../App.jsx';
import { useResource } from '../hooks/useResource.js';
import { fmtETB } from '../i18n.js';
import ScreenShell from '../components/ui/ScreenShell.jsx';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import Sheet from '../components/ui/Sheet.jsx';
import SegmentedTabs from '../components/ui/SegmentedTabs.jsx';
import NumberBall from '../components/ui/NumberBall.jsx';
import { SkeletonCard, EmptyState, ErrorState } from '../components/ui/states.jsx';

export default function TicketsScreen({ navigate }) {
  const { addToast } = useContext(ToastContext);
  const { data, loading, error, refreshing, reload } = useResource(() => api.getTickets({ limit: 50 }), []);
  const [filter, setFilter] = useState('all');
  const [detail, setDetail] = useState(null);

  const tickets = data?.tickets || [];

  const stats = useMemo(() => {
    const won = tickets.filter((t) => t.status === 'won');
    return {
      total: tickets.length,
      won: won.length,
      lost: tickets.filter((t) => t.status === 'lost').length,
      active: tickets.filter((t) => t.status === 'active' || t.status === 'pending').length,
      totalWon: won.reduce((s, t) => s + Number(t.prize_amount || 0), 0),
    };
  }, [tickets]);

  const filtered = useMemo(() => {
    if (filter === 'won') return tickets.filter((t) => t.status === 'won');
    if (filter === 'lost') return tickets.filter((t) => t.status === 'lost');
    if (filter === 'active') return tickets.filter((t) => t.status === 'active' || t.status === 'pending');
    return tickets;
  }, [tickets, filter]);

  return (
    <ScreenShell title="My Tickets" Icon={Ticket} onRefresh={reload} refreshing={refreshing || loading}>
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : tickets.length === 0 ? (
        <EmptyState
          Icon={Ticket}
          title="No tickets yet"
          text="Buy one and try your luck!"
          action={<Button onClick={() => navigate('games')}><Plus size={16} /> Buy Ticket</Button>}
        />
      ) : (
        <>
          <SegmentedTabs
            className="mb-4"
            value={filter}
            onChange={setFilter}
            items={[
              { key: 'all', label: 'All', count: stats.total },
              { key: 'active', label: 'Active', count: stats.active },
              { key: 'won', label: 'Won', count: stats.won },
              { key: 'lost', label: 'Lost', count: stats.lost },
            ]}
          />

          {stats.won > 0 && (
            <div className="mb-3 animate-scale-in rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-center">
              <p className="inline-flex items-center gap-1.5 text-xs text-emerald-200">
                <Sparkles size={13} className="text-emerald-300" />
                Won <span className="font-black">{fmtETB(stats.totalWon)} ETB</span> across {stats.won} ticket{stats.won > 1 ? 's' : ''}!
              </p>
            </div>
          )}

          <div className="space-y-3">
            {filtered.map((ticket, i) => (
              <TicketRow key={ticket.id} ticket={ticket} index={i} onOpen={() => setDetail(ticket)} />
            ))}
            {filtered.length === 0 && (
              <EmptyState Icon={Ticket} title={`No ${filter} tickets`} text="Try a different filter." />
            )}
          </div>

          <button
            onClick={() => navigate('games')}
            className="mt-4 w-full rounded-2xl border border-dashed border-white/12 py-3.5 text-sm font-bold text-slate-400 transition hover:border-coin-400/25 hover:text-coin-300 active:scale-[0.99]"
          >
            <span className="inline-flex items-center gap-1.5"><Plus size={15} /> Buy more tickets</span>
          </button>
        </>
      )}

      <TicketDetailSheet ticket={detail} onClose={() => setDetail(null)} />
    </ScreenShell>
  );
}

function TicketRow({ ticket, index, onOpen }) {
  const isWinner = ticket.status === 'won';
  return (
    <Card interactive onClick={onOpen} className={`animate-slide-up p-4 ${isWinner ? 'border-emerald-500/25 bg-emerald-500/[0.05]' : ''}`} style={{ animationDelay: `${index * 40}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-black text-white">{ticket.game_title}</span>
            {isWinner && <Trophy size={14} className="shrink-0 text-coin-400" />}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-slate-400">
            <span className="inline-flex items-center gap-0.5 font-bold text-coin-300/90"><Hash size={11} />{ticket.position}</span>
            <span className="text-slate-600">·</span>
            <span className="truncate">{ticket.numbers?.join(' · ')}</span>
          </div>
        </div>
        <div className="shrink-0">
          {isWinner ? (
            <Badge tone="emerald" glow>{fmtETB(ticket.prize_amount)} ETB</Badge>
          ) : (
            <Badge tone={ticket.status === 'lost' ? 'red' : 'neutral'}>{ticket.status}</Badge>
          )}
        </div>
      </div>
    </Card>
  );
}

function TicketDetailSheet({ ticket, onClose }) {
  if (!ticket) return null;
  const isWinner = ticket.status === 'won';
  const drawn = ticket.drawn_numbers || [];
  const matchSet = new Set(drawn);

  return (
    <Sheet open={!!ticket} onClose={onClose} title={ticket.game_title}>
      <div className="mb-4 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-sm font-bold text-coin-300"><Hash size={13} /> Ticket {ticket.position}</span>
        {isWinner ? (
          <Badge tone="emerald" glow>Won {fmtETB(ticket.prize_amount)} ETB</Badge>
        ) : (
          <Badge tone={ticket.status === 'lost' ? 'red' : 'neutral'}>{ticket.status}</Badge>
        )}
      </div>

      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Your numbers</p>
      <div className="flex flex-wrap gap-2">
        {ticket.numbers?.map((n, i) => (
          <NumberBall key={i} value={n} state={matchSet.has(n) ? 'match' : 'drawn'} size={44} />
        ))}
      </div>

      {drawn.length > 0 && (
        <>
          <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wider text-slate-400">Drawn numbers</p>
          <div className="flex flex-wrap gap-2">
            {drawn.map((n, i) => (
              <NumberBall key={i} value={n} state="drawn" size={36} />
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-400">
            Matched <span className="font-black text-white">{ticket.matched_count ?? 0}</span> number{ticket.matched_count === 1 ? '' : 's'}
          </p>
        </>
      )}

      {ticket.scheduled_draw_at && (
        <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-slate-500">
          <Clock size={12} /> Draw {new Date(ticket.scheduled_draw_at).toLocaleString()}
        </p>
      )}
    </Sheet>
  );
}
