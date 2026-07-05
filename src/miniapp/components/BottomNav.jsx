import React from 'react';

const tabs = [
  {
    id: 'home',
    label: 'Home',
    icon: (active) => (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: 'map',
    label: 'Map',
    icon: (active) => (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    id: 'bookings',
    label: 'Bookings',
    icon: (active) => (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: (active) => (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

export default function BottomNav({ screen, navigate }) {
  return (
    <nav className="relative border-t border-white/5 bg-black/80 backdrop-blur-2xl safe-area-bottom">
      {/* Top glow line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
      
      <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
        {tabs.map((tab) => {
          const active = screen === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.id)}
              className={`relative flex flex-1 flex-col items-center gap-1 rounded-2xl px-3 py-2 transition-all duration-300 ${
                active
                  ? 'text-cyan-400'
                  : 'text-slate-500 active:text-slate-300'
              }`}
            >
              {/* Active background glow */}
              {active && (
                <div className="absolute inset-0 rounded-2xl bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.2)]" />
              )}
              
              <div className={`relative z-10 transition-all duration-300 ${active ? 'scale-110 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]' : ''}`}>
                {tab.icon(active)}
              </div>
              <span className={`relative z-10 text-[10px] font-medium transition-all duration-300 ${
                active ? 'text-cyan-400 text-glow-cyan' : 'text-slate-500'
              }`}>
                {tab.label}
              </span>
              
              {/* Active indicator dot */}
              {active && (
                <div className="absolute -bottom-0.5 left-1/2 h-1 w-4 -translate-x-1/2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
