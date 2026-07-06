import React from 'react';
import { Ticket, Trophy, Clock, Users } from 'lucide-react';
import Card from './ui/Card.jsx';
import Button from './ui/Button.jsx';
import Badge from './ui/Badge.jsx';
import ProgressMeter from './ui/ProgressMeter.jsx';
import { useCountdown } from '../hooks/useCountdown.js';
import { fmtETB } from '../i18n.js';

/** A single game row. `onView` opens detail; `onBuy` triggers the buy flow. */
export default function GameCard({ game, onView, onBuy, buying = false, index = 0 }) {
  const countdown = useCountdown(game.scheduled_draw_at);
  const pct = game.max_tickets > 0 ? Math.round((game.tickets_sold / game.max_tickets) * 100) : 0;
  const soldOut = game.tickets_sold >= game.max_tickets;
  const buyable = (game.status === 'active' || game.status === 'upcoming') && !soldOut;

  return (
    <Card
      interactive={!!onView}
      onClick={onView ? () => onView(game) : undefined}
      className="animate-slide-up p-4"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-black text-white">{game.title}</h3>
            {countdown && (
              <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-coin-300">
                <Clock size={10} /> {countdown}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Ticket size={11} className="text-coin-400" /> {fmtETB(game.ticket_price)} ETB
            </span>
            <span className="inline-flex items-center gap-1">
              <Users size={11} /> {game.tickets_sold}/{game.max_tickets}
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-300/90">
              <Trophy size={11} /> {fmtETB(game.prize_pool)} ETB
            </span>
          </div>
          <ProgressMeter current={game.tickets_sold} max={game.max_tickets} className="mt-2.5" />
          <p className="mt-1 text-[10px] text-slate-500">{pct}% filled</p>
        </div>

        <div className="shrink-0">
          {buyable ? (
            <Button
              size="sm"
              variant="gold"
              loading={buying}
              onClick={onBuy ? (e) => { e.stopPropagation(); onBuy(game); } : undefined}
            >
              <Ticket size={14} /> Buy
            </Button>
          ) : (
            <Badge tone={soldOut ? 'red' : 'neutral'}>{soldOut ? 'Sold out' : game.status}</Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
