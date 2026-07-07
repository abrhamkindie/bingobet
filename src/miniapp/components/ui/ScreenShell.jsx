import React from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useTelegram, useBackButton } from '../../hooks/useTelegram.js';

export default function ScreenShell({
  title,
  subtitle,
  Icon,
  onBack,
  onRefresh,
  refreshing = false,
  right,
  children,
  className = '',
}) {
  const { haptic } = useTelegram();
  useBackButton(!!onBack, () => onBack?.());

  return (
    <div
      className={`isolate min-h-full px-4 pb-28 pt-4 ${className}`}
      style={{
        background:
          'radial-gradient(circle at 50% -4%, rgba(45, 212, 191, 0.16), transparent 36%), radial-gradient(circle at 86% 14%, rgba(34, 211, 238, 0.12), transparent 34%), radial-gradient(circle at 8% 70%, rgba(251, 191, 36, 0.08), transparent 32%), linear-gradient(180deg, #0c1a16 0%, #091512 48%, #07110e 100%)',
      }}
    >
      {(title || onBack) && (
        <div className="mb-4 flex items-center gap-3">
          {onBack && (
            <button
              onClick={() => { haptic('light'); onBack(); }}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white backdrop-blur transition hover:bg-white/10 active:scale-90"
            >
              <ArrowLeft size={17} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-lg font-black text-white">
              {Icon && <Icon size={18} className="text-teal-300" />}
              <span className="truncate">{title}</span>
            </h2>
            {subtitle && <p className="truncate text-xs text-slate-400">{subtitle}</p>}
          </div>
          {right}
          {onRefresh && !right && (
            <button
              onClick={() => { haptic('light'); onRefresh(); }}
              disabled={refreshing}
              className="flex items-center gap-1 rounded-xl border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 transition hover:border-teal-400/25 hover:text-teal-300 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
