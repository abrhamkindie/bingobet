import React from 'react';

export default function Coin({ size = 64, spin = false, floating = false, children, className = '' }) {
  return (
    <div
      className={`relative grid place-items-center rounded-full ${floating ? 'animate-float' : ''} ${spin ? 'animate-coin-spin' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        background: 'radial-gradient(circle at 35% 28%, #fef9c3 0%, #fcd34d 30%, #f59e0b 62%, #b45309 100%)',
        boxShadow:
          '0 0 0 3px rgba(180, 83, 9, 0.55), 0 0 0 6px rgba(251, 191, 36, 0.18), 0 10px 30px rgba(180, 83, 9, 0.45), inset 0 3px 8px rgba(255, 255, 255, 0.65), inset 0 -6px 12px rgba(146, 64, 14, 0.55)',
      }}
    >
      <div
        className="absolute rounded-full border border-amber-200/40"
        style={{ inset: Math.max(4, size * 0.11) }}
      />
      <span
        className="relative font-black text-amber-900/80"
        style={{ fontSize: size * 0.42, textShadow: '0 1px 0 rgba(255,255,255,0.4)' }}
      >
        {children ?? '₿'}
      </span>
    </div>
  );
}
