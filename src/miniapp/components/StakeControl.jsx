import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { fmtETB } from '../i18n.js';

const CHIPS = [10, 50, 100, 500];

export default function StakeControl({ value, onChange, min = 10, max = 1000, balance = 0, disabled = false }) {
  const clamp = (v) => Math.max(min, Math.min(max, Math.floor(v) || min));
  const step = (delta) => onChange(clamp(value + delta));

  return (
    <div className={disabled ? 'pointer-events-none opacity-60' : ''}>
      <div className="flex items-center gap-2">
        <button
          onClick={() => step(-10)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white transition-all duration-150 hover:border-white/20 hover:bg-white/[0.08] active:scale-90"
        >
          <Minus size={18} />
        </button>
        <div className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-teal-400/25 bg-teal-500/[0.06] py-2.5 shadow-[0_0_12px_rgba(45,212,191,0.05)]">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-coin-300 to-coin-600 text-[11px] font-black text-amber-900">₿</span>
          <span className="text-xl font-black text-white">{fmtETB(value)}</span>
          <span className="text-xs font-bold text-coin-300">ETB</span>
        </div>
        <button
          onClick={() => step(10)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white transition-all duration-150 hover:border-white/20 hover:bg-white/[0.08] active:scale-90"
        >
          <Plus size={18} />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-2">
        {CHIPS.map((c) => (
          <button
            key={c}
            onClick={() => onChange(clamp(c))}
            className={`rounded-xl border py-2 text-xs font-bold transition-all duration-150 active:scale-95 ${
              value === c
                ? 'border-teal-400/40 bg-teal-500/15 text-teal-200 shadow-[0_0_8px_rgba(45,212,191,0.15)]'
                : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-teal-400/25 hover:bg-teal-500/5 hover:text-teal-200'
            }`}
          >
            {c}
          </button>
        ))}
        <button
          onClick={() => onChange(clamp(Math.min(max, balance)))}
          className="rounded-xl border border-white/10 bg-white/[0.03] py-2 text-xs font-bold text-slate-300 transition-all duration-150 hover:border-coin-400/25 hover:bg-coin-500/5 hover:text-coin-200 active:scale-95"
        >
          Max
        </button>
      </div>
    </div>
  );
}
