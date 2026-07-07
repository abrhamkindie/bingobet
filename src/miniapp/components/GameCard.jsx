import React from 'react';
import { Ticket, Trophy, Clock, Users, Sparkles } from 'lucide-react';
import Card from './ui/Card.jsx';
import Button from './ui/Button.jsx';
import Badge from './ui/Badge.jsx';
import ProgressMeter from './ui/ProgressMeter.jsx';
import { useCountdown } from '../hooks/useCountdown.js';
import { fmtETB } from '../i18n.js';

export default function GameCard({ game, onView, onBuy, buying = false, index = 0 }) {
  const countdown = useCountdown(game.scheduled_draw_at);
  const pct = game.max_tickets > 0 ? Math.round((game.tickets_sold / game.max_tickets) * 100) : 0;
  const soldOut = game.tickets_sold >= game.max_tickets;
  const buyable = (game.status === 'active' || game.status === 'upcoming') && !soldOut;
  const isUrgent = !!countdown && !countdown.startsWith('d') && !countdown.startsWith('Now');

  return (
    <Card
      interactive={!!onView}
      onClick={onView ? () => onView(game) : undefined}
      className="group animate-slide-up p-4 transition-all duration-300 hover:shadow-[0_0_30px_rgba(45,212,191,0.18)] hover:border-teal-400/40 hover:-translate-y-1"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Gradient accent bar — left edge */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-teal-400 via-teal-500 to-emerald-500 rounded-l-3xl opacity-60 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative flex items-start justify-between gap-3 pl-2">
        <div className="min-w-0 flex-1">
          {/* Title row with countdown */}
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-black text-white group-hover:text-teal-100 transition-colors duration-300">{game.title}</h3>
            {countdown && (
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold transition-all duration-300 ${
                  isUrgent
                    ? 'bg-amber-500/15 text-amber-300 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                    : 'bg-coin-500/10 text-coin-300'
                }`}
              >
                <Clock size={9} className={isUrgent ? 'animate-pulse' : ''} />
                {countdown === 'Now' ? 'Drawing' : countdown}
              </span>
            )}
          </div>

          {/* Details row */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1 rounded-md bg-coin-500/10 px-1.5 py-0.5 text-[10px] font-bold text-coin-300/90">
              <Ticket size={10} className="text-coin-400" /> {fmtETB(game.ticket_price)} ETB
            </span>
            <span className="inline-flex items-center gap-1">
              <Users size={11} className="text-slate-500" />
              <span className="text-slate-400">{game.tickets_sold}</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-500">{game.max_tickets}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Sparkles size={10} className="text-emerald-400" />
              <span className="text-emerald-300/90 font-bold">{fmtETB(game.prize_pool)}</span>
              <span className="text-emerald-400/60 text-[9px]">pool</span>
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <ProgressMeter current={game.tickets_sold} max={game.max_tickets} />
            <div className="mt-1 flex items-center justify-between">
              <p className="text-[9px] text-slate-500">{pct}% filled</p>
              <p className="text-[9px] text-slate-500">{game.max_tickets - game.tickets_sold} left</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="shrink-0 pt-1">
          {buyable ? (
            <Button
              size="sm"
              variant="gold"
              loading={buying}
              onClick={onBuy ? (e) => { e.stopPropagation(); onBuy(game); } : undefined}
              className="transition-transform duration-200 group-hover:scale-105"
            >
              <Ticket size={14} /> Buy
            </Button>
          ) : (
            <Badge tone={soldOut ? 'red' : 'neutral'} className="transition-transform duration-200 group-hover:scale-105">
              {soldOut ? 'Sold out' : game.status}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
