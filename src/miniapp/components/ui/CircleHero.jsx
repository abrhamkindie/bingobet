import React from 'react';

/**
 * The signature glowing circular hero from the crypto-tap template.
 * Renders concentric teal glow rings with `children` centered inside.
 * `onTap` makes it interactive (used by tap-style interactions).
 */
export default function CircleHero({ size = 240, children, onTap, pulsing = true, className = '' }) {
  const Tag = onTap ? 'button' : 'div';
  return (
    <Tag
      onClick={onTap}
      className={`glow-ring relative grid place-items-center rounded-full ${onTap ? 'transition active:scale-95' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      {/* outer dashed ring */}
      <div className={`absolute inset-2 rounded-full border border-teal-300/20 ${pulsing ? 'animate-ring-pulse' : ''}`} />
      <div className="absolute inset-6 rounded-full border border-teal-300/10" />
      <div className="relative grid place-items-center">{children}</div>
    </Tag>
  );
}
