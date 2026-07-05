import React from 'react';
import { Home, Gamepad2, Radio, Ticket, User } from 'lucide-react';

const tabs = [
  { key: 'home', label: 'Home', Icon: Home },
  { key: 'games', label: 'Games', Icon: Gamepad2 },
  { key: 'draw', label: 'Live', Icon: Radio },
  { key: 'tickets', label: 'Tickets', Icon: Ticket },
  { key: 'profile', label: 'Profile', Icon: User },
];

export default function BottomNav({ screen, navigate }) {
  return (
    <nav className="safe-area-bottom z-40 flex items-center justify-around border-t border-white/10 bg-black/90 px-1 pb-1 pt-2 backdrop-blur-2xl">
      {tabs.map(tab => {
        const active = screen === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => navigate(tab.key)}
            className="relative flex flex-1 flex-col items-center gap-0.5 px-2 py-1 transition-all duration-200 active:scale-95"
          >
            <div
              className={`rounded-xl p-2 transition-all duration-300 ${
                active
                  ? 'bg-cyan-500/15 shadow-[0_0_14px_rgba(34,211,238,0.2)]'
                  : 'opacity-60 hover:opacity-90'
              }`}
            >
              <tab.Icon
                size={20}
                className={`transition-all duration-300 ${
                  active ? 'text-cyan-300' : 'text-slate-400'
                }`}
              />
            </div>
            <span
              className={`text-[10px] font-semibold transition-all duration-300 ${
                active
                  ? 'translate-y-0 text-cyan-300 opacity-100'
                  : 'translate-y-0 text-slate-500 opacity-70'
              }`}
            >
              {tab.label}
            </span>
            {active && <div className="nav-glow" />}
          </button>
        );
      })}
    </nav>
  );
}
