import React, { useContext, useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Zap, Ticket, Trophy, Gamepad2, ArrowUpRight, Sparkles, ChevronRight,
  TrendingUp, Clock, Gift,
} from 'lucide-react';
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

// ── Shimmer sweep span (extracted to avoid repetition) ──

function ShimmerSweep() {
  return (
    <span className="absolute inset-0 overflow-hidden pointer-events-none rounded-[inherit]">
      <span
        className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-[shine_3s_ease-in-out_infinite]"
        style={{ transform: 'translateX(-150%) skewX(-18deg)' }}
      />
    </span>
  );
}

// ── Component ────────────────────────────────────────────

export default function HomeScreen({ navigate }) {
  const { player } = useContext(PlayerContext);
  const { addToast } = useContext(ToastContext);
  const { data, loading, error, refreshing, reload } = useResource(() => api.getGames(), []);
  const [buyGame, setBuyGame] = useState(null);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const carouselTimer = useRef(null);

  const games = data?.games || [];
  const activeGames = useMemo(
    () => games.filter((g) => g.status === 'active' || g.status === 'upcoming'),
    [games]
  );
  const featured = activeGames[0];
  const rest = featured ? activeGames.slice(1) : activeGames;
  const totalPrizePool = useMemo(() => games.reduce((s, g) => s + Number(g.prize_pool || 0), 0), [games]);
  const totalTicketsSold = useMemo(() => games.reduce((s, g) => s + Number(g.tickets_sold || 0), 0), [games]);

  // ── Carousel auto-rotate ──
  const carouselGames = useMemo(() => activeGames.slice(0, 5), [activeGames]);

  useEffect(() => {
    if (carouselGames.length <= 1) return;
    carouselTimer.current = setInterval(() => {
      setCarouselIdx((prev) => (prev + 1) % carouselGames.length);
    }, 4000);
    return () => clearInterval(carouselTimer.current);
  }, [carouselGames.length]);

  const goCarousel = useCallback((idx) => {
    setCarouselIdx(idx);
    clearInterval(carouselTimer.current);
    carouselTimer.current = setInterval(() => {
      setCarouselIdx((prev) => (prev + 1) % carouselGames.length);
    }, 4000);
  }, [carouselGames.length]);

  return (
    <div
      className="isolate min-h-full px-4 pb-28 pt-3"
      style={{
        background:
          'radial-gradient(circle at 50% -4%, rgba(45, 212, 191, 0.16), transparent 36%), radial-gradient(circle at 86% 14%, rgba(34, 211, 238, 0.12), transparent 34%), radial-gradient(circle at 8% 70%, rgba(251, 191, 36, 0.08), transparent 32%), linear-gradient(180deg, #0c1a16 0%, #091512 48%, #07110e 100%)',
      }}
    >
      {/* ════════════════════════════════════════════════════
          HERO SECTION
          ════════════════════════════════════════════════════ */}
      <div
        className="relative mb-4 overflow-hidden rounded-3xl border border-white/10 p-6 text-center backdrop-blur"
        style={{
          background: 'linear-gradient(165deg, rgba(45,212,191,0.12) 0%, rgba(20,184,166,0.04) 40%, rgba(251,191,36,0.06) 100%)',
        }}
      >
        {/* Animated gradient orbs */}
        <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-coin-400/10 blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="pointer-events-none absolute -bottom-16 -left-12 h-44 w-44 rounded-full bg-teal-400/10 blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
        <div className="pointer-events-none absolute top-1/2 left-1/3 h-32 w-32 rounded-full bg-violet-500/8 blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />

        <div className="relative z-10 flex flex-col items-center">
          {/* Coin with enhanced glow */}
          <div className="relative mb-2">
            <div className="absolute inset-0 rounded-full bg-coin-400/20 blur-xl animate-pulse-ring" />
            <CircleHero size={196}>
              <Coin size={104} floating>₿</Coin>
            </CircleHero>
          </div>

          {/* Balance */}
          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.25em] text-teal-300/70">{t.balance}</p>
          <h1
            className="mt-0.5 text-4xl font-black text-white tracking-tight"
            style={{ textShadow: '0 0 12px rgba(251, 191, 36, 0.55), 0 0 28px rgba(245, 158, 11, 0.3)' }}
          >
            {fmtETB(player?.wallet_balance)}{' '}
            <span className="text-lg font-bold text-coin-300">ETB</span>
          </h1>

          {/* Small stats row */}
          <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1">
              <TrendingUp size={12} className="text-emerald-400" />
              <span className="font-bold text-slate-300">{fmtETB(player?.total_won || 0)}</span> won
            </span>
            <span className="inline-flex items-center gap-1">
              <Gift size={12} className="text-coin-400" />
              <span className="font-bold text-slate-300">{player?.daily?.streak || 0}d</span> streak
            </span>
          </div>

          {/* Quick actions */}
          <div className="mt-4 grid w-full grid-cols-2 gap-3">
            <Button variant="gold" onClick={() => navigate('deposit')}>
              <ArrowUpRight size={16} /> {t.deposit}
            </Button>
            <Button onClick={() => navigate('games')}>
              <Gamepad2 size={16} /> {t.play}
            </Button>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          ANIMATED PRIZE CAROUSEL
          ════════════════════════════════════════════════════ */}
      {!loading && carouselGames.length > 0 && (
        <div className="relative mb-4 rounded-3xl overflow-hidden border border-white/10 bg-white/[0.03] backdrop-blur-sm">
          {/* Carousel slides */}
          <div className="relative h-28">
            {carouselGames.map((game, idx) => (
              <div
                key={game.id}
                className={`absolute inset-0 p-4 transition-all duration-700 ease-in-out ${
                  idx === carouselIdx
                    ? 'opacity-100 translate-x-0'
                    : idx < carouselIdx
                    ? 'opacity-0 -translate-x-4'
                    : 'opacity-0 translate-x-4'
                }`}
              >
                <div className="flex items-center gap-3 h-full">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-coin-400 to-amber-500 shadow-coin-sm">
                    <Trophy size={22} className="text-amber-950" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-coin-300/80">
                        Top Prize
                      </span>
                      {idx === 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-teal-500/15 px-1.5 py-0.5 text-[8px] font-bold text-teal-300">
                          <Sparkles size={8} /> Live
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm font-black text-white truncate">{game.title}</p>
                    <p className="text-xs text-coin-200 font-bold">
                      {fmtETB(game.prize_pool)} ETB prize pool
                    </p>
                  </div>
                  <button
                    onClick={() => { setBuyGame(game); }}
                    className="shrink-0 rounded-xl bg-gradient-to-r from-coin-400 to-amber-500 px-3.5 py-2 text-[11px] font-black text-amber-950 shadow-md active:scale-95 transition-transform"
                  >
                    <Ticket size={13} className="inline mr-1" />
                    Buy
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Dots indicator */}
          {carouselGames.length > 1 && (
            <div className="flex justify-center gap-1.5 pb-3">
              {carouselGames.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => goCarousel(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === carouselIdx
                      ? 'w-6 bg-coin-400'
                      : 'w-1.5 bg-white/20 hover:bg-white/40'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          DAILY REWARD
          ════════════════════════════════════════════════════ */}
      <div className="mb-4 animate-slide-up" style={{ animationDelay: '100ms' }}>
        <DailyRewardCard />
      </div>

      {/* ════════════════════════════════════════════════════
          STATS STRIP
          ════════════════════════════════════════════════════ */}
      {!loading && games.length > 0 && (
        <div className="mb-5 grid grid-cols-3 gap-2.5 animate-slide-up" style={{ animationDelay: '200ms' }}>
          <StatTile
            label="Active"
            value={activeGames.length}
            tone="coin"
            Icon={Zap}
            className="transition hover:border-coin-400/30 hover:bg-white/[0.06]"
          />
          <StatTile
            label="Tickets"
            value={totalTicketsSold}
            Icon={Ticket}
            className="transition hover:border-white/20 hover:bg-white/[0.06]"
          />
          <StatTile
            label="Prizes"
            value={fmtETB(totalPrizePool)}
            tone="emerald"
            Icon={Trophy}
            className="transition hover:border-emerald-400/30 hover:bg-white/[0.06]"
          />
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          FEATURED GAME
          ════════════════════════════════════════════════════ */}
      {!loading && featured && (
        <div
          className="relative mb-5 overflow-hidden rounded-3xl border border-coin-400/25 bg-gradient-to-br from-coin-500/20 to-amber-700/10 p-5 text-left animate-slide-up transition-all duration-300 hover:border-coin-400/40 hover:shadow-[0_0_30px_rgba(251,191,36,0.15)]"
          style={{ animationDelay: '300ms' }}
        >
          <ShimmerSweep />
          <div className="relative flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-coin-500/25 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-coin-100">
                  <Sparkles size={10} /> Featured
                </span>
                {featured.scheduled_draw_at && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-bold text-teal-300">
                    <Clock size={9} />
                    {new Date(featured.scheduled_draw_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
              <h3 className="mt-2 text-xl font-black text-white">{featured.title}</h3>
              <p className="mt-0.5 text-sm text-coin-200/90">
                <span className="font-bold text-coin-300">{fmtETB(featured.prize_pool)} ETB</span> prize pool ·{' '}
                {fmtETB(featured.ticket_price)} ETB per ticket
              </p>

              {/* Mini progress */}
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={() => setBuyGame(featured)}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-coin-400 to-amber-500 px-5 py-2.5 text-sm font-black text-amber-950 shadow-md shadow-amber-800/20 transition-all active:scale-95 hover:shadow-lg hover:shadow-amber-800/30"
                >
                  <Ticket size={15} /> Buy Now
                </button>
                <button
                  onClick={() => navigate('games')}
                  className="inline-flex items-center gap-1 rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-300 backdrop-blur transition-all active:scale-95 hover:bg-white/10 hover:border-white/25"
                >
                  Details <ChevronRight size={12} />
                </button>
              </div>
            </div>
            <Coin size={48} floating className="shrink-0 ml-3">₿</Coin>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          LIVE GAMES HEADER
          ════════════════════════════════════════════════════ */}
      <div className="mb-3 flex items-center justify-between animate-slide-up" style={{ animationDelay: '400ms' }}>
        <h2 className="inline-flex items-center gap-1.5 text-sm font-black text-white">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
          Live Games
          {!loading && activeGames.length > 0 && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-300">
              {activeGames.length}
            </span>
          )}
        </h2>
        <button
          onClick={() => reload(true)}
          disabled={refreshing}
          className="text-xs font-bold text-slate-400 transition-all hover:text-coin-300 active:scale-95 disabled:opacity-50 inline-flex items-center gap-1"
        >
          <svg className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
          </svg>
          {refreshing ? 'Refreshing' : t.refresh}
        </button>
      </div>

      {/* ════════════════════════════════════════════════════
          GAMES LIST / STATES
          ════════════════════════════════════════════════════ */}
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
          {/* If only featured exists, show it as a card too */}
          {rest.length === 0 && featured && (
            <div className="animate-slide-up" style={{ animationDelay: '500ms' }}>
              <GameCard game={featured} index={0} onView={() => navigate('games')} onBuy={setBuyGame} />
            </div>
          )}
          {rest.map((game, i) => (
            <div key={game.id} className="animate-slide-up" style={{ animationDelay: `${500 + i * 80}ms` }}>
              <GameCard
                game={game}
                index={i}
                onView={() => navigate('games')}
                onBuy={setBuyGame}
              />
            </div>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          BUY CONFIRM SHEET
          ════════════════════════════════════════════════════ */}
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
