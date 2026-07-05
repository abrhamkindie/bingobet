import React from 'react';
import { Check, X, AlertTriangle, Info } from 'lucide-react';

const typeConfig = {
  success: {
    bg: 'bg-emerald-600/90 border-emerald-500/30',
    Icon: Check,
  },
  error: {
    bg: 'bg-red-600/90 border-red-500/30',
    Icon: X,
  },
  warning: {
    bg: 'bg-amber-600/90 border-amber-500/30',
    Icon: AlertTriangle,
  },
  info: {
    bg: 'bg-slate-800/90 border-white/10',
    Icon: Info,
  },
};

export default function Toast({ toasts, removeToast }) {
  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-24 left-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t => {
        const config = typeConfig[t.type] || typeConfig.info;
        const { bg, Icon: IconComp } = config;
        return (
          <div
            key={t.id}
            onClick={() => removeToast(t.id)}
            className={`pointer-events-auto flex animate-toast-in items-center gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-xl ${bg}`}
          >
            <IconComp size={16} className="shrink-0 text-white/80" />
            <span className="flex-1 text-sm font-medium text-white">{t.message}</span>
            <X size={14} className="shrink-0 cursor-pointer text-white/50 hover:text-white" />
          </div>
        );
      })}
    </div>
  );
}
