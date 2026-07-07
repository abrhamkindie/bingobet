import React from 'react';

export default function CircleHero({ size = 240, children, onTap, pulsing = true, className = '' }) {
  const Tag = onTap ? 'button' : 'div';
  return (
    <Tag
      onClick={onTap}
      className={`relative grid place-items-center rounded-full ${onTap ? 'transition active:scale-95' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        background: 'radial-gradient(circle at 50% 42%, rgba(45, 212, 191, 0.18), rgba(13, 148, 136, 0.04) 55%, transparent 70%)',
        boxShadow:
          '0 0 0 1px rgba(94, 234, 212, 0.25), inset 0 0 60px rgba(45, 212, 191, 0.18), 0 0 60px rgba(45, 212, 191, 0.22)',
      }}
    >
      <div className={`absolute inset-2 rounded-full border border-teal-300/20 ${pulsing ? 'animate-ring-pulse' : ''}`} />
      <div className="absolute inset-6 rounded-full border border-teal-300/10" />
      <div className="relative grid place-items-center">{children}</div>
    </Tag>
  );
}
