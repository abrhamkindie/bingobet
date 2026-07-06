import React from 'react';

/**
 * Coin-styled drawn number.
 *  - state 'pending' : hollow slot with '?'
 *  - state 'drawn'   : gold coin
 *  - state 'latest'  : gold coin, extra glow + float
 *  - state 'match'   : emerald (player matched this number)
 */
export default function NumberBall({ value, state = 'pending', size = 52, delay = 0, small = false }) {
  const isFilled = state === 'drawn' || state === 'latest' || state === 'match';
  const base = 'grid place-items-center rounded-full font-black transition-all duration-500';
  const style = { width: size, height: size, fontSize: size * 0.38, animationDelay: `${delay}ms` };

  let tone = 'border border-white/10 bg-white/[0.04] text-slate-600 scale-90';
  if (state === 'drawn') tone = 'coin-disc text-amber-900/80 animate-number-pop';
  if (state === 'latest') tone = 'coin-disc text-amber-900/80 animate-number-pop animate-float shadow-coin-lg';
  if (state === 'match') tone =
    'text-emerald-950 animate-number-pop bg-gradient-to-br from-emerald-300 to-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.5)]';

  return (
    <div className={`${base} ${tone} ${small ? '' : ''}`} style={style}>
      {isFilled && value != null ? String(value).padStart(2, '0') : '?'}
    </div>
  );
}
