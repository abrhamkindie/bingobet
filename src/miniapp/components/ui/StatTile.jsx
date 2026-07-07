import React from 'react';

/** Compact labeled stat used in stat strips. */
export default function StatTile({ label, value, Icon, tone = 'default', color, size = 'md', className = '' }) {
  const valueTone = color || (
    tone === 'coin' ? 'text-coin-300' :
    tone === 'emerald' ? 'text-emerald-300' :
    tone === 'slate' ? 'text-slate-200' :
    tone === 'amber' ? 'text-amber-300' :
    tone === 'rose' ? 'text-rose-300' :
    'text-white'
  );
  const isCompact = size === 'sm';
  return (
    <div className={`${isCompact ? 'rounded-xl px-2 py-1.5' : 'rounded-2xl p-3'} border border-white/10 bg-white/[0.03] text-center backdrop-blur ${className}`}>
      <p className={`inline-flex items-center justify-center gap-1 ${isCompact ? 'text-[9px]' : 'text-[10px]'} font-medium uppercase tracking-wider text-slate-400`}>
        {Icon && <Icon size={11} />} {label}
      </p>
      <p className={`mt-1 ${isCompact ? 'text-xs font-black leading-tight' : 'text-base font-black'} ${valueTone}`}>{value}</p>
    </div>
  );
}
