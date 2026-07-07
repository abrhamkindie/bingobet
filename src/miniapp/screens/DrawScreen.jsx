import React, { useCallback, useEffect, useState } from 'react';
import { Radio, Clock, CheckCircle2, Ticket, Trophy, ChevronRight, Sparkles, Users } from 'lucide-react';
import * as api from '../api.js';
import { usePolling } from '../hooks/usePolling.js';
import { useCountdown } from '../hooks/useCountdown.js';
import { fmtETB } from '../i18n.js';
import ScreenShell from '../components/ui/ScreenShell.jsx';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import NumberBall from '../components/ui/NumberBall.jsx';
import ProgressMeter from '../components/ui/ProgressMeter.jsx';
import { Spinner, EmptyState, ErrorState } from '../components/ui/states.jsx';
import BuyConfirmSheet from '../components/BuyConfirmSheet.jsx';

export default function DrawScreen({ navigate, active }) {
  const [state, setState] = useState({ loading: true, error: null, activeGame: null, drawn: [], completed: [] });
  const [showPast, setShowPast] = useState(false);
  const [buyGame, setBuyGame] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getGames();
      const games = data.games || [];
      const drawGame = games.find((g) => g.status === 'drawing') || games.find((g) => g.status === 'active');
      let drawn = [];
      if (drawGame) {
        try { drawn = (await api.getDrawnNumbers(drawGame.id)).numbers || []; } catch { /* ignore */ }
      }
      let completed = [];
      try { completed = (await api.getCompletedGames()).games || []; } catch { /* ignore */ }
      setState({ loading: false, error: null, activeGame: drawGame || null, drawn, completed });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err }));
    }
  }, []);

  useEffect(() => { if (active) load(); }, [active, load]);
  usePolling(load, 5000, active);

  const { loading, error, activeGame, drawn, completed } = state;

  if (loading) {
    return (
      <ScreenShell title="Live Draw" Icon={Radio}>
        <Spinner label="Loading draw\u2026" />
      </ScreenShell>
    );
  }

  const isDrawing = activeGame?.status === 'drawing';

  return (
    <ScreenShell title="Live Draw" Icon={Radio} onRefresh={load}>
      {error && !activeGame ? (
        <ErrorState error={error} onRetry={load} />
      ) : !activeGame && completed.length === 0 ? (
        <EmptyState Icon={Clock} title="No draws yet" text="Check back when a draw is scheduled." />
      ) : (
        <>
          {activeGame && isDrawing && drawn.length > 0 && (
            <ActiveDraw game={activeGame} drawn={drawn} onCheck={() => navigate('tickets')} />
          )}

          {activeGame && !isDrawing && (
            <UpcomingDraw game={activeGame} onBuy={setBuyGame} navigate={navigate} />
          )}

          {activeGame && isDrawing && drawn.length === 0 && (
            <UpcomingDraw game={activeGame} onBuy={setBuyGame} navigate={navigate} subtitle="Draw starting soon\u2026" />
          )}

          {!activeGame && completed.length > 0 && (
            <EmptyState Icon={Clock} title="No live draw right now" text="See recent results below." />
          )}

          {/* Past Results */}
          {completed.length > 0 && (
            <div className="mt-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
              <button
                onClick={() => setShowPast((s) => !s)}
                className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400 transition-all duration-200 hover:text-coin-300"
              >
                <Trophy size={13} />
                Past Results ({completed.length})
                <ChevronRight size={14} className={`transition-transform duration-300 ${showPast ? 'rotate-90' : ''}`} />
              </button>
              {showPast && (
                <div className="space-y-2">
                  {completed.slice(0, 10).map((game, i) => (
                    <PastResultCard key={game.id} game={game} index={i} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <BuyConfirmSheet
        game={buyGame}
        open={!!buyGame}
        onClose={() => setBuyGame(null)}
        onPurchased={() => navigate('tickets')}
        navigate={navigate}
      />
    </ScreenShell>
  );
}

/** Active draw — animated number balls being revealed, premium GameCard pattern */
function ActiveDraw({ game, drawn, onCheck }) {
  const total = game.numbers_to_draw;
  const complete = drawn.length >= total;
  const pct = Math.round((drawn.length / total) * 100);

  return (
    <div className="space-y-3">
      {/* ── Status header ── */}
      <div className="animate-slide-up" style={{ animationDelay: '0ms' }}>
        <Card className="group relative overflow-hidden p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(45,212,191,0.12)] hover:border-teal-400/40">
          {/* Gradient accent bar — left edge */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-teal-400 via-teal-500 to-emerald-500 rounded-l-3xl opacity-60 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="relative pl-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-coin-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                  <h3 className="truncate text-sm font-black text-white group-hover:text-teal-100 transition-colors duration-300">{game.title}</h3>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {complete ? 'Draw complete\u2026' : 'Draw in progress\u2026'}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] text-slate-400">Tickets</p>
                <p className="text-lg font-black text-white group-hover:text-teal-100 transition-colors duration-300">{game.tickets_sold}</p>
              </div>
            </div>

            {/* Animated progress */}
            {!complete && (
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-black/30 overflow-hidden ring-1 ring-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-coin-400 via-amber-400 to-coin-300 animate-progress shadow-[0_0_8px_rgba(251,191,36,0.25)]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-black text-coin-300 tabular-nums">{pct}%</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between">
                  <p className="text-[9px] text-slate-500">Drawn {drawn.length}/{total}</p>
                  <p className="text-[9px] text-slate-500">{total - drawn.length} remaining</p>
                </div>
              </div>
            )}
            {complete && (
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-300 animate-fade-in">
                <CheckCircle2 size={12} /> All numbers drawn
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── Number board ── */}
      <div className="animate-slide-up" style={{ animationDelay: '80ms' }}>
        <Card className="group relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(45,212,191,0.12)] hover:border-teal-400/40">
          {/* Gradient accent bar — left edge */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-teal-400 via-teal-500 to-emerald-500 rounded-l-3xl opacity-60 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="relative pl-2">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Drawn <span className="font-black text-white group-hover:text-teal-100 transition-colors duration-300">{drawn.length}</span>/{total}
              </p>
              {complete ? (
                <Badge tone="emerald" Icon={CheckCircle2} glow className="transition-transform duration-200 group-hover:scale-105">Complete</Badge>
              ) : (
                <Badge tone="coin" className="transition-transform duration-200 group-hover:scale-105">
                  <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-coin-300 mr-1" />
                  Live
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap justify-center gap-2.5">
              {Array.from({ length: total }, (_, i) => {
                const num = drawn[i];
                const isLatest = num !== undefined && i === drawn.length - 1;
                const isPending = num === undefined;
                return (
                  <div key={i} className="relative">
                    <NumberBall
                      value={num}
                      state={isPending ? 'pending' : isLatest ? 'latest' : 'drawn'}
                      size={54}
                      delay={i * 70}
                    />
                    {isPending && (
                      <span className="absolute -inset-1 rounded-full border-2 border-dashed border-teal-400/20 animate-pulse pointer-events-none" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* ── CTA ── */}
      <div className="animate-slide-up" style={{ animationDelay: '160ms' }}>
        <Button block size="lg" variant="gold" onClick={onCheck}>
          <Ticket size={17} /> Check My Tickets
        </Button>
      </div>
    </div>
  );
}

/**
 * Upcoming draw — premium card matching GameCard design language.
 */
function UpcomingDraw({ game, onBuy, subtitle, navigate }) {
  const countdown = useCountdown(game.scheduled_draw_at);
  const pct = game.max_tickets > 0 ? Math.round((game.tickets_sold / game.max_tickets) * 100) : 0;
  const soldOut = game.tickets_sold >= game.max_tickets;
  const isUrgent = !!countdown && !countdown.startsWith('d') && countdown !== 'Now';

  return (
    <div className="space-y-3">
      {/* ── Main card ── */}
      <div className="animate-slide-up" style={{ animationDelay: '0ms' }}>
        <Card
          className="group relative overflow-hidden p-4 transition-all duration-300 hover:shadow-[0_0_30px_rgba(45,212,191,0.18)] hover:border-teal-400/40 hover:-translate-y-1"
        >
          {/* Gradient accent bar — left edge */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-teal-400 via-teal-500 to-emerald-500 rounded-l-3xl opacity-60 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="relative flex items-start justify-between gap-3 pl-2">
            <div className="min-w-0 flex-1">
              {/* Title row with countdown */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-coin-500/25 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-coin-100">
                  <Sparkles size={9} />
                  {subtitle || 'Next Draw'}
                </span>
                <h3 className="truncate text-sm font-black text-white group-hover:text-teal-100 transition-colors duration-300">{game.title}</h3>
              </div>

              {/* Countdown badge */}
              {countdown && (
                <div className="mt-1.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold transition-all duration-300 ${
                      isUrgent
                        ? 'bg-amber-500/15 text-amber-300 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                        : 'bg-coin-500/10 text-coin-300'
                    }`}
                  >
                    <Clock size={9} className={isUrgent ? 'animate-pulse' : ''} />
                    {countdown === 'Now' ? 'Drawing' : countdown}
                  </span>
                </div>
              )}

              {/* Details row */}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
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
              {!soldOut ? (
                <Button
                  size="sm"
                  variant="gold"
                  onClick={() => onBuy?.(game)}
                  className="transition-transform duration-200 group-hover:scale-105"
                >
                  <Ticket size={14} /> Buy
                </Button>
              ) : (
                <Badge tone="red" className="transition-transform duration-200 group-hover:scale-105">
                  Sold out
                </Badge>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Quick info + check link */}
      <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
        <div className="flex items-center justify-between px-1">
          <p className="text-[10px] text-slate-500">
            {game.numbers_per_ticket} random numbers{' \u00b7 '}Match {game.numbers_to_draw} to win{' \u00b7 '}Max {game.max_tickets_per_player} per player
          </p>
          <button
            onClick={() => navigate?.('tickets')}
            className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 transition-all duration-200 hover:text-coin-300 active:scale-95 shrink-0"
          >
            My tickets <Ticket size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** One past result row — premium GameCard pattern */
function PastResultCard({ game, index }) {
  const hasWinners = (game.winner_count || 0) > 0;
  const numbers = game.drawn_numbers || [];

  return (
    <Card
      className="group relative overflow-hidden animate-slide-up p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(45,212,191,0.18)] hover:border-teal-400/40"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Gradient accent bar — left edge */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-teal-400 via-teal-500 to-emerald-500 rounded-l-3xl opacity-60 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative flex items-start justify-between gap-3 pl-2">
        <div className="min-w-0 flex-1">
          {/* Title row */}
          <div className="flex items-center gap-2">
            <h4 className="truncate text-sm font-black text-white group-hover:text-teal-100 transition-colors duration-300">{game.title}</h4>
            {hasWinners && (
              <Trophy size={13} className="shrink-0 text-coin-400 group-hover:text-coin-200 transition-colors duration-300" />
            )}
          </div>

          {/* Details row — inline chips */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1 rounded-md bg-coin-500/10 px-1.5 py-0.5 text-[10px] font-bold text-coin-300/90">
              <Trophy size={10} className="text-coin-400" /> {game.winner_count} winner{game.winner_count !== 1 ? 's' : ''}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="text-emerald-300/90 font-bold">{fmtETB(game.total_payout)} ETB</span>
              <span className="text-slate-500 text-[9px]">paid</span>
            </span>
          </div>

          {/* Winning numbers — inline */}
          {numbers.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mr-0.5">Won:</span>
              {numbers.map((n, idx) => (
                <NumberBall key={idx} value={n} state="drawn" size={26} />
              ))}
            </div>
          )}
        </div>

        {/* Result badge */}
        <div className="shrink-0 pt-0.5">
          {hasWinners ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[9px] font-bold text-emerald-300 transition-transform duration-200 group-hover:scale-105">
              Won
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-[9px] font-bold text-rose-300/70 transition-transform duration-200 group-hover:scale-105">
              No winners
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
