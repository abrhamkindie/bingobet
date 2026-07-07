import React from 'react';

const TONES = {
  teal: 'from-teal-300 to-teal-500',
  coin: 'from-coin-300 to-coin-500',
  emerald: 'from-emerald-400 to-emerald-500',
  cyan: 'from-cyan-300 to-teal-500',
};

export default function ProgressMeter({ current, max, tone = 'teal', className = '' }) {
  const pct = max > 0 ? Math.min((Number(current) / Number(max)) * 100, 100) : 0;
  return (
    <div className={`relative h-2.5 overflow-hidden rounded-full bg-black/40 ring-1 ring-inset ring-white/5 ${className}`}>
      <div
        className={`relative h-full rounded-full bg-gradient-to-r ${TONES[tone] || TONES.coin}`}
        style={{ width: `${pct}%` }}
      >
        {pct > 0 && (
          <span
            className="absolute inset-y-0 w-2/5 bg-gradient-to-r from-transparent via-white/35 to-transparent animate-[shine_2.6s_ease-in-out_infinite]"
            style={{ transform: 'translateX(-120%) skewX(-18deg)' }}
          />
        )}
      </div>
    </div>
  );
}
