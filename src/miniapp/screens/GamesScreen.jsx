import React, { useState } from 'react';
import { Gamepad2, Ticket, Trophy, Sparkles, Target, DollarSign, Grid3x3, Disc3, Cherry, ChevronRight, ChevronDown } from 'lucide-react';
import * as api from '../api.js';
import { useResource } from '../hooks/useResource.js';
import { fmtETB } from '../i18n.js';
import ScreenShell from '../components/ui/ScreenShell.jsx';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import ProgressMeter from '../components/ui/ProgressMeter.jsx';
import { SkeletonCard, EmptyState, ErrorState } from '../components/ui/states.jsx';
import GameCard from '../components/GameCard.jsx';
import BuyConfirmSheet from '../components/BuyConfirmSheet.jsx';

export default function GamesScreen({ navigate }) {
  const { data, loading, error, refreshing, reload } = useResource(() => api.getGames({ limit: 50 }), []);
  const [selected, setSelected] = useState(null);
  const [buyGame, setBuyGame] = useState(null);

  const games = data?.games || [];

  if (selected) {
    return (
      <GameDetail
        game={selected}
        onBack={() => setSelected(null)}
        onBuy={() => setBuyGame(selected)}
        buySheet={
          <BuyConfirmSheet
            game={buyGame}
            open={!!buyGame}
            onClose={() => setBuyGame(null)}
            onPurchased={() => { setSelected(null); navigate('tickets'); }}
            navigate={navigate}
          />
        }
      />
    );
  }

  return (
    <ScreenShell title="Games" Icon={Gamepad2} onRefresh={() => reload(true)} refreshing={refreshing}>
      {/* Instant game modes */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <ModeTile
          Icon={Disc3}
          title="Spin Wheel"
          subtitle="Instant · up to 50×"
          tone="teal"
          onClick={() => navigate('spin')}
        />
        <ModeTile
          Icon={Grid3x3}
          title="Keno"
          subtitle="Pick & match"
          tone="coin"
          onClick={() => navigate('keno')}
        />
        <ModeTile
          Icon={Cherry}
          title="Roulette"
          subtitle="Spin · 37 numbers · Multiple bets"
          tone="violet"
          onClick={() => navigate('roulette')}
        />
      </div>

      <div className="mb-1 flex items-center gap-2">
        <Ticket size={15} className="text-teal-300" />
        <h3 className="text-sm font-black text-white">Lottery Draws</h3>
        {!loading && games.length > 0 && (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-300">{games.length}</span>
        )}
      </div>
      <p className="mb-3 text-xs leading-4 text-slate-400">
        Buy a ticket to get 6 random numbers entered into the draw. Match the drawn numbers to win from the prize pool.
      </p>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : games.length === 0 ? (
        <EmptyState Icon={Gamepad2} title="No games available" text="Check back soon for new games." />
      ) : (
        <div className="space-y-3">
          {games.map((game, i) => (
            <GameCard key={game.id} game={game} index={i} onView={setSelected} onBuy={setBuyGame} />
          ))}
        </div>
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

function GameDetail({ game, onBack, onBuy, buySheet }) {
  const tiers = game.prize_tiers || [];
  const pct = game.max_tickets > 0 ? Math.round((game.tickets_sold / game.max_tickets) * 100) : 0;
  const soldOut = game.tickets_sold >= game.max_tickets;
  const buyable = (game.status === 'active' || game.status === 'upcoming') && !soldOut;

  return (
    <ScreenShell title={game.title} onBack={onBack}>
      <Card className="animate-scale-in">
        <div className="relative bg-gradient-to-br from-coin-500/20 to-amber-800/10 px-5 pb-5 pt-6">
          <span className="shine-sweep" />
          <div className="relative flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-coin-300/20 bg-coin-500/15 text-coin-200 shadow-coin-sm">
              <Trophy size={24} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black text-white">{game.title}</h2>
              {game.description && <p className="mt-0.5 text-sm text-slate-400">{game.description}</p>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-5">
          <Metric Icon={DollarSign} label="Price" value={`${fmtETB(game.ticket_price)} ETB`} />
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <Ticket size={12} /> Sold
            </div>
            <p className="mt-1 text-lg font-black text-white">
              {game.tickets_sold}<span className="text-sm font-bold text-slate-400">/{game.max_tickets}</span>
            </p>
            <ProgressMeter current={game.tickets_sold} max={game.max_tickets} className="mt-2" />
            <p className="mt-1 text-[10px] text-slate-500">{pct}% filled</p>
          </div>
          <Metric Icon={Sparkles} label="Prize pool" value={`${fmtETB(game.prize_pool)} ETB`} tone="emerald" />
          <Metric Icon={Target} label="Numbers" value={`${game.number_min}–${game.number_max}`} />
        </div>

        {tiers.length > 0 && (
          <div className="border-t border-white/[0.06] px-5 pb-5 pt-4">
            <p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-400">Prize Tiers</p>
            <div className="space-y-1.5">
              {tiers.map((tier, i) => (
                <div key={i} className="flex items-center justify-between rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-2.5">
                  <span className="text-sm text-slate-300">{tier.label || `Match ${tier.match}`}</span>
                  <span className="text-sm font-black text-coin-300">
                    {tier.is_jackpot ? (
                      <Badge tone="coin" Icon={Sparkles} glow>Jackpot</Badge>
                    ) : `${tier.payout_multiplier}×`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Buy button — placed BEFORE How it works so it's always visible */}
      {buyable ? (
        <div className="mt-4">
          <Button block size="lg" onClick={onBuy} variant="gold">
            <Ticket size={18} /> Buy Ticket — {fmtETB(game.ticket_price)} ETB
          </Button>
          <p className="mt-1.5 text-center text-[11px] text-slate-500">
            You'll get {game.numbers_per_ticket} random numbers · Max {game.max_tickets_per_player} per player
          </p>
        </div>
      ) : (
        <div className="mt-4 text-center">
          <Badge tone={soldOut ? 'red' : 'neutral'}>{soldOut ? 'Sold out' : `Status: ${game.status}`}</Badge>
        </div>
      )}

      {/* How it works */}
      <details className="mt-4 group">
        <summary className="flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 transition hover:border-white/20 hover:text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <span>How it works</span>
            <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="mt-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <ol className="space-y-2.5">
            {[
              `Buy a ticket for ${fmtETB(game.ticket_price)} ETB — you get ${game.numbers_per_ticket} random numbers.`,
              `At the draw, ${game.numbers_to_draw} numbers are picked from ${game.number_min}–${game.number_max}.`,
              'Match enough numbers and you win a share of the prize pool.',
              'Watch it unfold live on the Live tab; results land in My Tickets.',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-teal-500/15 text-[11px] font-black text-teal-300">{i + 1}</span>
                <span className="text-sm leading-5 text-slate-300">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </details>

      {buySheet}
    </ScreenShell>
  );
}

function ModeTile({ Icon, title, subtitle, tone = 'teal', onClick }) {
  const grad = tone === 'coin'
    ? 'from-coin-500/20 to-amber-700/10 border-coin-400/25'
    : tone === 'violet'
    ? 'from-violet-500/20 to-purple-700/10 border-violet-400/25'
    : 'from-teal-500/20 to-cyan-700/10 border-teal-400/25';
  const iconTone = tone === 'coin' ? 'text-coin-200 bg-coin-500/15' : tone === 'violet' ? 'text-violet-200 bg-violet-500/15' : 'text-teal-200 bg-teal-500/15';
  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden rounded-3xl border bg-gradient-to-br p-4 text-left transition active:scale-[0.98] ${grad}`}
    >
      <span className="shine-sweep" />
      <div className="relative">
        <div className={`mb-3 grid h-11 w-11 place-items-center rounded-2xl ${iconTone}`}>
          <Icon size={22} />
        </div>
        <p className="flex items-center gap-1 text-sm font-black text-white">{title} <ChevronRight size={14} className="text-white/50" /></p>
        <p className="text-[11px] text-slate-300/80">{subtitle}</p>
      </div>
    </button>
  );
}

function Metric({ Icon, label, value, tone = 'default' }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <Icon size={12} /> {label}
      </div>
      <p className={`mt-1 text-lg font-black ${tone === 'emerald' ? 'text-emerald-300' : 'text-white'}`}>{value}</p>
    </div>
  );
}
