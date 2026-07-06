import React from 'react';
import { Loader2 } from 'lucide-react';
import { useTelegram } from '../../hooks/useTelegram.js';

/**
 * Chunky, tactile button.
 *  - primary  : glossy gold 3D press (the tap-to-earn hero action)
 *  - secondary: violet raised
 *  - ghost    : outline
 *  - danger   : red
 *  - subtle   : low-emphasis text
 */
const VARIANTS = {
  primary: 'btn-aqua text-teal-950',
  gold: 'btn-coin text-amber-950',
  secondary:
    'bg-white/[0.06] border border-white/10 text-white hover:bg-white/10 active:scale-[0.98]',
  ghost:
    'border border-white/15 text-white/90 hover:border-white/25 hover:bg-white/5 active:scale-[0.98]',
  danger:
    'bg-gradient-to-b from-rose-500 to-rose-600 text-white shadow-[0_4px_0_0_#9f1239] active:translate-y-0.5 active:shadow-[0_1px_0_0_#9f1239]',
  subtle: 'text-slate-300 hover:text-white active:scale-95',
};

const SIZES = {
  sm: 'px-3.5 py-2 text-xs rounded-xl',
  md: 'px-5 py-3 text-sm rounded-2xl',
  lg: 'px-6 py-4 text-base rounded-2xl',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  disabled = false,
  haptic = 'medium',
  className = '',
  onClick,
  type = 'button',
  ...rest
}) {
  const { haptic: fireHaptic } = useTelegram();

  const handleClick = (e) => {
    if (disabled || loading) return;
    if (haptic) fireHaptic(haptic);
    onClick?.(e);
  };

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={disabled || loading}
      className={`relative inline-flex items-center justify-center gap-2 font-bold tracking-tight transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}
