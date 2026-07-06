import React, { useContext, useState, useMemo } from 'react';
import { Zap, Ticket, Trophy, Gamepad2, ArrowUpRight, Sparkles } from 'lucide-react';
import * as api from '../api.js';
import { PlayerContext, ToastContext } from '../App.jsx';
import { useResource } from '../hooks/useResource.js';
import { fmtETB, t } from '../i18n.js';
import Coin from '../components/ui/Coin.jsx';
import CircleHero from '../components/ui/CircleHero.jsx';
import Button from '../components/ui/Button.jsx';
import StatTile from '../components/ui/StatTile.jsx';
import { SkeletonCard, EmptyState, ErrorState } from '../components/ui/states.jsx';
import GameCard from '../components/GameCard.jsx';
import BuyConfirmSheet from '../components/BuyConfirmSheet.jsx';
import DailyRewardCard from '../components/DailyRewardCard.jsx';

export default function HomeScreen({ navigate }) {
  const { player } = useContext(PlayerContext);
  const { addToast } = useContext(ToastContext);
  const { data, loading, error, refreshing, reload } = useResource(() => api.getGames(), []);
  const [buyGame, setBuyGame] = useState(null);

  const games = data?.games || [];
  const activeGames = useMemo(
    () => games.filter((g) => g.status === 'active' || g.status === 'upcoming'),
    [games]
  );
  const featured = activeGames[0];
  const rest = featured ? activeGames.slice(1) : activeGames;
  const totalPrizePool = useMemo(() => games.reduce((s, g) => s + Number(g.prize_pool || 0), 0), [games]);
  const totalTicketsSold = useMemo(() => games.reduce((s, g) => s + Number(g.tickets_sold || 0), 0), [games]);

  return (
    <div className="coin-bg min-h-full px-4 pb-28 pt-3">
      {/* Hero */}
      <div className="relative mb-4 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-teal-500/15 to-cyan-700/[0.06] p-5 text-center backdrop-blur">
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-coin-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-10 h-36 w-36 rounded-full bg-teal-500/12 blur-3xl" />
        <div className="relative flex flex-col items-center">
          <CircleHero size={196}>
            <Coin size={104} floating>₿</Coin>
          </CircleHero>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.2em] text-teal-300/80">{t.balance}</p>
          <h1 className="mt-1 text-4xl font-black text-white text-glow-gold">
            {fmtETB(player?.wallet_balance)} <span className="text-lg text-coin-300">ETB</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">{t.tagline}</p>

          <div className="mt-4 grid w-full grid-cols-2 gap-2.5">
            <Button variant="gold" onClick={() => navigate('deposit')}>
              <ArrowUpRight size={16} /> {t.deposit}
            </Button>
            <Button onClick={() => navigate('games')}>
              <Gamepad2 size={16} /> {t.play}
            </Button>
          </div>
        </div>
      </div>

      {/* Daily reward */}
      <div className="mb-4">
        <DailyRewardCard />
      </div>

      {/* Stats */}
      {!loading && games.length > 0 && (
        <div className="mb-5 grid grid-cols-3 gap-2.5">
          <StatTile label="Active" value={activeGames.length} tone="coin" Icon={Zap} />
          <StatTile label="Tickets" value={totalTicketsSold} Icon={Ticket} />
          <StatTile label="Prizes" value={fmtETB(totalPrizePool)} tone="emerald" Icon={Trophy} />
        </div>
      )}

      {/* Featured game — now with direct Buy action */}
      {!loading && featured && (
        <div className="relative mb-5 overflow-hidden rounded-3xl border border-coin-400/25 bg-gradient-to-br from-coin-500/20 to-amber-700/10 p-5 text-left">
          <span className="shine-sweep" />
          <div className="relative flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-coin-500/25 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-coin-100">
                <Sparkles size={10} /> Featured
              </span>
              <h3 className="mt-2 text-xl font-black text-white">{featured.title}</h3>
              <p className="mt-0.5 text-sm text-coin-200">
                Prize pool {fmtETB(featured.prize_pool)} ETB · {fmtETB(featured.ticket_price)} ETB per ticket
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setBuyGame(featured)}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-coin-400 to-amber-500 px-5 py-2.5 text-sm font-black text-amber-950 shadow-md shadow-amber-800/20 transition active:scale-95"
                >
                  <Ticket size={15} /> Buy Now
                </button>
                <button
                  onClick={() => navigate('games')}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-300 backdrop-blur transition active:scale-95 hover:bg-white/10"
                >
                  Details
                </button>
              </div>
            </div>
            <Coin size={48} floating className="shrink-0">₿</Coin>
          </div>
        </div>
      )}

      {/* Games list */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="inline-flex items-center gap-1.5 text-base font-black text-white">
          <Zap size={15} className="text-coin-300" /> Live Games
        </h2>
        <button
          onClick={() => reload(true)}
          disabled={refreshing}
          className="text-xs font-bold text-slate-400 transition hover:text-coin-300 active:scale-95 disabled:opacity-50"
        >
          {refreshing ? 'Refreshing…' : t.refresh}
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : activeGames.length === 0 ? (
        <EmptyState
          Icon={Gamepad2}
          title="No games running"
          text="New games drop regularly — check back soon."
          action={<Button variant="secondary" size="sm" onClick={() => reload()}>Refresh</Button>}
        />
      ) : (
        <div className="space-y-3">
          {rest.length === 0 && featured && (
            <GameCard game={featured} index={0} onView={() => navigate('games')} onBuy={setBuyGame} />
          )}
          {rest.map((game, i) => (
            <GameCard
              key={game.id}
              game={game}
              index={i}
              onView={() => navigate('games')}
              onBuy={setBuyGame}
            />
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
    </div>
  );
}
