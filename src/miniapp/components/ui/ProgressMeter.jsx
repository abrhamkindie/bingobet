import React from 'react';

const TONES = {
  teal: 'from-teal-300 to-teal-500',
  coin: 'from-coin-300 to-coin-500',
  emerald: 'from-emerald-400 to-emerald-500',
  cyan: 'from-cyan-300 to-teal-500',
};

/** Energy-bar style fill meter (repurposed for ticket sales / progress). */
export default function ProgressMeter({ current, max, tone = 'teal', showShine = true, className = '' }) {
  const pct = max > 0 ? Math.min((Number(current) / Number(max)) * 100, 100) : 0;
  return (
    <div className={`relative h-2.5 overflow-hidden rounded-full bg-black/40 ring-1 ring-inset ring-white/5 ${className}`}>
      <div
        className={`animate-progress relative h-full rounded-full bg-gradient-to-r ${TONES[tone] || TONES.coin}`}
        style={{ width: `${pct}%` }}
      >
        {showShine && pct > 0 && <span className="shine-sweep" />}
      </div>
    </div>
  );
}
