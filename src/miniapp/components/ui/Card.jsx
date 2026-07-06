import React from 'react';

/** Frosted violet surface card. `interactive` adds press/hover affordance. */
export default function Card({
  children,
  interactive = false,
  className = '',
  onClick,
  style,
  ...rest
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      style={style}
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl ${
        interactive
          ? 'text-left transition-all duration-200 hover:border-teal-400/25 hover:bg-white/[0.07] active:scale-[0.99]'
          : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
