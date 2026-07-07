import React, { useMemo } from 'react';
import { Home, Radio, Ticket, User, Dice5 } from 'lucide-react';
import { useTelegram } from '../hooks/useTelegram.js';

const tabs = [
  { key: 'home', label: 'Home', Icon: Home },
  { key: 'draw', label: 'Live', Icon: Radio },
  { key: 'games', label: 'Play', Icon: Dice5, center: true },
  { key: 'tickets', label: 'Tickets', Icon: Ticket },
  { key: 'profile', label: 'Me', Icon: User },
];

export default function BottomNav({ screen, navigate }) {
  const { haptic } = useTelegram();

  const isActive = (key) =>
    screen === key ||
    (key === 'profile' && ['deposit', 'withdraw', 'referrals'].includes(screen)) ||
    (key === 'games' && ['keno', 'spin', 'roulette', 'leaderboard'].includes(screen));

  // Compute the active index for the sliding indicator
  const activeIdx = useMemo(() => tabs.findIndex((t) => isActive(t.key)), [screen]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(env(safe-area-inset-bottom),0.5rem)]">
      <nav className="pointer-events-auto relative mx-3 mb-1 flex w-full max-w-md items-center justify-around rounded-3xl border border-white/[0.07] bg-night-900/80 px-2 py-1.5 shadow-[0_-8px_40px_rgba(0,0,0,0.55)] backdrop-blur-2xl">

        {/* ── Sliding active indicator (pill) ── */}
        {activeIdx >= 0 && (
          <span
            className="absolute bottom-2.5 h-4 w-10 rounded-full bg-teal-500/15 shadow-[0_0_12px_rgba(45,212,191,0.15)] transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)] pointer-events-none"
            style={{
              left: `calc(${activeIdx} * (100% / ${tabs.length}) + (100% / ${tabs.length} - 2.5rem) / 2)`,
              width: '2.5rem',
            }}
          />
        )}

        {tabs.map((tab) => {
          const active = isActive(tab.key);

          if (tab.center) {
            return (
              <button
                key={tab.key}
                onClick={() => { haptic('medium'); navigate(tab.key); }}
                className="relative flex flex-1 flex-col items-center transition-transform duration-200 hover:scale-105 active:scale-95"
              >
                {/* Outer glow ring */}
                {active && (
                  <span
                    className="absolute -inset-1 rounded-full animate-pulse-ring pointer-events-none"
                    style={{
                      background: 'radial-gradient(circle, rgba(45,212,191,0.25) 0%, transparent 70%)',
                    }}
                  />
                )}
                <div
                  className={`-mt-9 grid h-[4.25rem] w-[4.25rem] place-items-center rounded-full border-[3px] border-night-900 bg-gradient-to-b from-teal-300 to-teal-600 transition-all duration-300 active:scale-90 ${
                    active
                      ? 'ring-[3px] ring-teal-300/40 shadow-[0_0_35px_rgba(45,212,191,0.5)]'
                      : 'shadow-[0_4px_12px_rgba(45,212,191,0.15)] hover:shadow-[0_0_25px_rgba(45,212,191,0.3)]'
                  }`}
                >
                  <tab.Icon size={28} className="text-teal-950" strokeWidth={2.8} />
                </div>
                <span
                  className={`-mt-1.5 text-[10px] font-bold transition-all duration-300 ${
                    active ? 'text-teal-200 scale-105' : 'text-slate-400'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={tab.key}
              onClick={() => { if (!active) haptic('light'); navigate(tab.key); }}
              className="relative z-10 flex flex-1 flex-col items-center gap-1 py-1.5 transition-all duration-200 active:scale-90"
            >
              <div
                className={`grid h-9 w-11 place-items-center rounded-2xl transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                  active
                    ? 'scale-110'
                    : ''
                }`}
              >
                <tab.Icon
                  size={19}
                  className={`transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                    active ? 'text-white scale-110 drop-shadow-[0_0_6px_rgba(45,212,191,0.4)]' : 'text-slate-400'
                  }`}
                  strokeWidth={active ? 2.8 : 2}
                />
              </div>
              <span
                className={`text-[10px] font-bold transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                  active ? 'text-white' : 'text-slate-500'
                }`}
              >
                {tab.label}
              </span>

              {/* Small active dot */}
              {active && (
                <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.6)] animate-fade-in" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
