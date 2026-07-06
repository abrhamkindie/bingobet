import React from 'react';
import { useTelegram } from '../../hooks/useTelegram.js';

/**
 * Pill segmented control.
 * @param {{key,label,count?}[]} items
 */
export default function SegmentedTabs({ items, value, onChange, className = '' }) {
  const { haptic } = useTelegram();
  return (
    <div className={`flex gap-1.5 rounded-2xl border border-white/10 bg-black/20 p-1 ${className}`}>
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            onClick={() => { if (!active) { haptic('select'); onChange(it.key); } }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold transition-all duration-200 active:scale-95 ${
              active
                ? 'bg-gradient-to-b from-teal-300 to-teal-500 text-teal-950 shadow-teal-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {it.label}
            {it.count != null && (
              <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-amber-950/20 text-amber-950' : 'bg-white/10 text-slate-300'}`}>
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
