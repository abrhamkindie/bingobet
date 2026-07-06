import React from 'react';
import { Home, Radio, Ticket, User, Dice5 } from 'lucide-react';
import { useTelegram } from '../hooks/useTelegram.js';

// Center slot (index 2) is the raised "Play" button → Games hub.
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
    (key === 'games' && ['keno', 'spin', 'leaderboard'].includes(screen));

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(env(safe-area-inset-bottom),0.5rem)]">
      <nav className="pointer-events-auto mx-3 mb-1 flex w-full max-w-md items-center justify-around rounded-3xl border border-white/12 bg-night-900/85 px-2 py-2 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        {tabs.map((tab) => {
          const active = isActive(tab.key);

          if (tab.center) {
            return (
              <button
                key={tab.key}
                onClick={() => { haptic('medium'); navigate(tab.key); }}
                className="relative flex flex-1 flex-col items-center"
              >
                <div className={`-mt-8 grid h-16 w-16 place-items-center rounded-full border-4 border-night-900 bg-gradient-to-b from-teal-300 to-teal-600 shadow-teal transition active:scale-90 ${active ? 'ring-2 ring-teal-300/50' : ''}`}>
                  <tab.Icon size={26} className="text-teal-950" strokeWidth={2.6} />
                </div>
                <span className={`-mt-1 text-[10px] font-bold ${active ? 'text-teal-200' : 'text-slate-400'}`}>{tab.label}</span>
              </button>
            );
          }

          return (
            <button
              key={tab.key}
              onClick={() => { if (!active) haptic('light'); navigate(tab.key); }}
              className="relative flex flex-1 flex-col items-center gap-1 py-1 transition active:scale-90"
            >
              <div className={`grid h-9 w-11 place-items-center rounded-2xl transition-all duration-300 ${active ? 'bg-teal-500/15' : ''}`}>
                <tab.Icon size={19} className={active ? 'text-teal-300' : 'text-slate-400'} strokeWidth={active ? 2.6 : 2} />
              </div>
              <span className={`text-[10px] font-bold ${active ? 'text-teal-200' : 'text-slate-500'}`}>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
