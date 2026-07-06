import React from 'react';
import { Settings, Plus } from 'lucide-react';
import { fmtETB } from '../i18n.js';
import { useTelegram } from '../hooks/useTelegram.js';

/** Cosmetic level derived from lifetime activity. */
function levelFor(player) {
  return 1 + Math.floor((Number(player?.total_tickets_bought || 0)) / 3);
}

/** Persistent top bar: avatar + name + level (left), gold balance + settings (right). */
export default function TopBar({ player, navigate }) {
  const { haptic } = useTelegram();
  const initials = (player?.name || player?.username || 'B').slice(0, 1).toUpperCase();

  return (
    <div className="safe-top sticky top-0 z-30 px-4 pt-3">
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-night-900/70 px-3 py-2 backdrop-blur-xl">
        {/* Identity */}
        <button
          onClick={() => { haptic('light'); navigate('profile'); }}
          className="flex min-w-0 items-center gap-2.5 transition active:scale-95"
        >
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-teal-300/25 bg-gradient-to-br from-teal-400/30 to-cyan-600/10 text-sm font-black text-white">
            {initials}
          </div>
          <div className="min-w-0 text-left">
            <p className="truncate text-sm font-black leading-tight text-white">{player?.name || 'Player'}</p>
            <p className="text-[10px] font-bold leading-tight text-teal-300/80">Level {levelFor(player)}</p>
          </div>
        </button>

        {/* Balance + settings */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => { haptic('light'); navigate('deposit'); }}
            className="flex items-center gap-1.5 rounded-xl border border-coin-400/20 bg-coin-500/10 py-1.5 pl-2 pr-2.5 transition active:scale-95"
          >
            <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-coin-300 to-coin-600 text-[10px] font-black text-amber-900">₿</span>
            <span className="text-sm font-black text-white">{fmtETB(player?.wallet_balance)}</span>
            <span className="grid h-4 w-4 place-items-center rounded-full bg-coin-500/25 text-coin-200"><Plus size={11} strokeWidth={3} /></span>
          </button>
          <button
            onClick={() => { haptic('light'); navigate('profile'); }}
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:text-white active:scale-90"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
