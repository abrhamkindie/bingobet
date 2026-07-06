import React from 'react';
import { Check, X, AlertTriangle, Info } from 'lucide-react';

const typeConfig = {
  success: { bg: 'border-emerald-400/30 bg-emerald-600/90', Icon: Check },
  error: { bg: 'border-rose-400/30 bg-rose-600/90', Icon: X },
  warning: { bg: 'border-amber-400/30 bg-amber-600/90', Icon: AlertTriangle },
  info: { bg: 'border-white/12 bg-night-800/95', Icon: Info },
};

export default function Toast({ toasts, removeToast }) {
  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-28 z-[70] flex flex-col gap-2">
      {toasts.map((toast) => {
        const { bg, Icon } = typeConfig[toast.type] || typeConfig.info;
        return (
          <div
            key={toast.id}
            onClick={() => removeToast(toast.id)}
            className={`pointer-events-auto flex animate-toast-in items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${bg}`}
          >
            <Icon size={16} className="shrink-0 text-white/90" />
            <span className="flex-1 text-sm font-semibold text-white">{toast.message}</span>
            <X size={14} className="shrink-0 cursor-pointer text-white/50 hover:text-white" />
          </div>
        );
      })}
    </div>
  );
}
