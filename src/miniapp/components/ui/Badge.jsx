import React from 'react';

const TONES = {
  coin: 'border-coin-400/25 bg-coin-500/15 text-coin-200',
  emerald: 'border-emerald-400/25 bg-emerald-500/15 text-emerald-200',
  red: 'border-rose-400/25 bg-rose-500/15 text-rose-200',
  violet: 'border-violet-400/25 bg-violet-500/15 text-violet-200',
  neutral: 'border-white/10 bg-white/10 text-slate-300',
};

export default function Badge({ children, tone = 'neutral', Icon, className = '', glow = false }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TONES[tone] || TONES.neutral} ${glow ? 'animate-pulse-glow' : ''} ${className}`}
    >
      {Icon && <Icon size={10} />} {children}
    </span>
  );
}
