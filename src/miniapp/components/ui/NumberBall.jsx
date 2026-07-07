import React from 'react';

export default function NumberBall({ value, state = 'pending', size = 52, delay = 0 }) {
  const isFilled = state === 'drawn' || state === 'latest' || state === 'match';
  const base = 'grid place-items-center rounded-full font-black transition-all duration-500';
  const style = { width: size, height: size, fontSize: size * 0.38, animationDelay: `${delay}ms` };

  let tone = 'border border-white/10 bg-white/[0.04] text-slate-600 scale-90';
  if (state === 'drawn') {
    tone = 'text-amber-900/80 animate-number-pop';
    Object.assign(style, {
      background: 'radial-gradient(circle at 35% 28%, #fef9c3 0%, #fcd34d 30%, #f59e0b 62%, #b45309 100%)',
      boxShadow:
        '0 0 0 3px rgba(180, 83, 9, 0.55), 0 0 0 6px rgba(251, 191, 36, 0.18), 0 10px 30px rgba(180, 83, 9, 0.45), inset 0 3px 8px rgba(255, 255, 255, 0.65), inset 0 -6px 12px rgba(146, 64, 14, 0.55)',
    });
  }
  if (state === 'latest') {
    tone = 'text-amber-900/80 animate-number-pop animate-float';
    Object.assign(style, {
      background: 'radial-gradient(circle at 35% 28%, #fef9c3 0%, #fcd34d 30%, #f59e0b 62%, #b45309 100%)',
      boxShadow:
        '0 0 0 3px rgba(180, 83, 9, 0.55), 0 0 0 6px rgba(251, 191, 36, 0.18), 0 10px 30px rgba(180, 83, 9, 0.45), inset 0 3px 8px rgba(255, 255, 255, 0.65), inset 0 -6px 12px rgba(146, 64, 14, 0.55), 0 0 44px rgba(251, 191, 36, 0.45)',
    });
  }
  if (state === 'match') {
    tone = 'text-emerald-950 animate-number-pop shadow-[0_0_18px_rgba(16,185,129,0.5)]';
    Object.assign(style, {
      background: 'linear-gradient(135deg, #6ee7b7 0%, #10b981 100%)',
    });
  }

  return (
    <div className={`${base} ${tone}`} style={style}>
      {isFilled && value != null ? String(value).padStart(2, '0') : '?'}
    </div>
  );
}
