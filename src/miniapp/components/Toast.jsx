import React from 'react';

const typeStyles = {
  success: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]',
  error: 'bg-rose-500/20 border-rose-500/30 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.2)]',
  info: 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]',
  warning: 'bg-amber-500/20 border-amber-500/30 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]',
};

export default function Toast({ toasts = [], removeToast }) {
  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => removeToast(t.id)}
          className={`pointer-events-auto w-full max-w-sm rounded-xl border px-4 py-3 text-sm font-medium text-white shadow-xl backdrop-blur-sm transition-all duration-300 ${typeStyles[t.type] || typeStyles.info}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
