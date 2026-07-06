import React from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useTelegram, useBackButton } from '../../hooks/useTelegram.js';

/**
 * Standard screen wrapper: consistent padding + optional section header
 * (title, back button, right-slot / refresh). The persistent balance top-bar
 * lives in App.jsx above all screens.
 */
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
  // Wire the Telegram hardware back button when a back handler is present.
  useBackButton(!!onBack, () => onBack?.());

  return (
    <div className={`coin-bg min-h-full px-4 pb-28 pt-4 ${className}`}>
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
