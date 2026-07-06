import React from 'react';

/** Compact labeled stat used in stat strips. */
export default function StatTile({ label, value, Icon, tone = 'default', className = '' }) {
  const valueTone =
    tone === 'coin' ? 'text-coin-300' :
    tone === 'emerald' ? 'text-emerald-300' :
    'text-white';
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center backdrop-blur ${className}`}>
      <p className="inline-flex items-center justify-center gap-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">
        {Icon && <Icon size={11} />} {label}
      </p>
      <p className={`mt-1 text-base font-black ${valueTone}`}>{value}</p>
    </div>
  );
}
