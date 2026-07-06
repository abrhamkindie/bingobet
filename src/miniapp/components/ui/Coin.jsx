import React from 'react';

/**
 * Glossy gold coin disc. Used for the Home hero and inline accents.
 * `spin` triggers a one-shot flip (e.g. on daily claim / win).
 */
export default function Coin({ size = 64, spin = false, floating = false, children, className = '' }) {
  return (
    <div
      className={`coin-disc relative grid place-items-center rounded-full ${floating ? 'animate-float' : ''} ${spin ? 'animate-coin-spin' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      {/* inner ring */}
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
