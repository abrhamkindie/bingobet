import React, { useCallback, useEffect, useState } from 'react';
import { Radio, Clock, CheckCircle2, Ticket, Trophy, ChevronRight, Sparkles, DollarSign, Users } from 'lucide-react';
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
      // Priority: drawing > active
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
        <Spinner label="Loading draw…" />
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
            <UpcomingDraw game={activeGame} onBuy={setBuyGame} />
          )}

          {activeGame && isDrawing && drawn.length === 0 && (
            <UpcomingDraw game={activeGame} onBuy={setBuyGame} subtitle="Draw starting soon…" />
          )}

          {!activeGame && completed.length > 0 && (
            <EmptyState Icon={Clock} title="No live draw right now" text="See recent results below." />
          )}

          {/* Past Results — always visible when there are completed games */}
          {completed.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setShowPast((s) => !s)}
                className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400 transition hover:text-coin-300"
              >
                <Trophy size={13} />
                Past Results ({completed.length})
                <ChevronRight size={14} className={`transition-transform ${showPast ? 'rotate-90' : ''}`} />
              </button>
              {showPast && (
                <div className="space-y-2">
                  {completed.slice(0, 10).map((game, i) => (
                    <Card key={game.id} className="animate-slide-up p-4" style={{ animationDelay: `${i * 50}ms` }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-black text-white">{game.title}</h4>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {game.winner_count} winner{game.winner_count !== 1 ? 's' : ''} · {fmtETB(game.total_payout)} ETB paid
                          </p>
                        </div>
                        <Trophy size={16} className="text-coin-400" />
                      </div>
                      {game.drawn_numbers && game.drawn_numbers.length > 0 && (
                        <>
                          <p className="mb-2 mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Winning numbers</p>
                          <div className="flex flex-wrap gap-1.5">
                            {game.drawn_numbers.map((n, idx) => (
                              <NumberBall key={idx} value={n} state="drawn" size={32} />
                            ))}
                          </div>
                        </>
                      )}
                    </Card>
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

/** Active draw in progress — shows animated number balls being drawn. */
function ActiveDraw({ game, drawn, onCheck }) {
  const total = game.numbers_to_draw;
  const complete = drawn.length >= total;

  return (
    <div className="animate-scale-in space-y-3">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black text-white">{game.title}</h3>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-coin-400 shadow-coin-sm" />
              <span className="text-xs text-slate-400">Draw in progress…</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Tickets</p>
            <p className="text-lg font-black text-white">{game.tickets_sold}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Drawn <span className="font-black text-white">{drawn.length}</span>/{total}
          </p>
          {complete && <Badge tone="emerald" Icon={CheckCircle2}>Complete</Badge>}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {Array.from({ length: total }, (_, i) => {
            const num = drawn[i];
            const isLatest = num !== undefined && i === drawn.length - 1;
            return (
              <NumberBall
                key={i}
                value={num}
                state={num === undefined ? 'pending' : isLatest ? 'latest' : 'drawn'}
                size={54}
                delay={i * 70}
              />
            );
          })}
        </div>
      </Card>

      <Button block size="lg" variant="secondary" onClick={onCheck}>
        <Ticket size={17} /> Check My Tickets
      </Button>
    </div>
  );
}

/** Upcoming draw — shows countdown, prize info, and a quick buy button. */
function UpcomingDraw({ game, onBuy, subtitle }) {
  const countdown = useCountdown(game.scheduled_draw_at);
  const pct = game.max_tickets > 0 ? Math.round((game.tickets_sold / game.max_tickets) * 100) : 0;
  const soldOut = game.tickets_sold >= game.max_tickets;

  return (
    <div className="animate-scale-in space-y-3">
      {/* Header card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-coin-500/20 to-amber-800/10 px-5 pb-4 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-coin-500/25 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-coin-100">
                <Sparkles size={10} /> Next Draw
              </span>
              <h3 className="mt-2 text-xl font-black text-white">{game.title}</h3>
            </div>
            <div className="text-right">
              {countdown ? (
                <div className="inline-flex items-center gap-1.5 rounded-xl border border-coin-400/20 bg-coin-500/10 px-3 py-1.5">
                  <Clock size={13} className="text-coin-300" />
                  <span className="font-black text-coin-200">{countdown}</span>
                </div>
              ) : (
                <Badge tone="coin" glow>Today</Badge>
              )}
            </div>
          </div>
          {subtitle && <p className="mt-2 text-sm text-coin-200">{subtitle}</p>}
        </div>

        <div className="grid grid-cols-3 gap-3 p-4">
          <div className="text-center">
            <DollarSign size={14} className="mx-auto text-coin-400" />
            <p className="mt-0.5 text-xs text-slate-400">Price</p>
            <p className="text-sm font-black text-white">{fmtETB(game.ticket_price)} ETB</p>
          </div>
          <div className="text-center">
            <Sparkles size={14} className="mx-auto text-emerald-400" />
            <p className="mt-0.5 text-xs text-slate-400">Prize</p>
            <p className="text-sm font-black text-emerald-300">{fmtETB(game.prize_pool)} ETB</p>
          </div>
          <div className="text-center">
            <Users size={14} className="mx-auto text-teal-400" />
            <p className="mt-0.5 text-xs text-slate-400">Sold</p>
            <p className="text-sm font-black text-white">{game.tickets_sold}</p>
          </div>
        </div>

        <div className="px-4 pb-4">
          <ProgressMeter current={game.tickets_sold} max={game.max_tickets} />
          <p className="mt-1 text-[10px] text-slate-500">{pct}% filled · {game.max_tickets - game.tickets_sold} left</p>
        </div>
      </Card>

      {/* Buy ticket CTA — opens BuyConfirmSheet directly */}
      {!soldOut ? (
        <Button block size="lg" variant="gold" onClick={() => onBuy?.(game)}>
          <Ticket size={18} /> Buy Ticket — {fmtETB(game.ticket_price)} ETB
        </Button>
      ) : (
        <div className="text-center">
          <Badge tone="red">Sold out</Badge>
        </div>
      )}

      {/* Quick info */}
      <p className="text-center text-xs text-slate-500">
        {game.numbers_per_ticket} random numbers · Match {game.numbers_to_draw} to win · Max {game.max_tickets_per_player} per player
      </p>

      {/* Check tickets link */}
      <div className="text-center">
        <button
          onClick={() => navigate('tickets')}
          className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 transition hover:text-coin-300"
        >
          <Ticket size={12} /> Check my tickets
        </button>
      </div>
    </div>
  );
}
