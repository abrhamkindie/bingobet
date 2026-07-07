import React from 'react';
import { AlertCircle, Loader2, WifiOff } from 'lucide-react';
import Button from './Button.jsx';
import { errorMessage } from '../../i18n.js';

export function Spinner({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div
        className="grid h-12 w-12 place-items-center rounded-full"
        style={{
          background: 'radial-gradient(circle at 35% 28%, #fef9c3 0%, #fcd34d 30%, #f59e0b 62%, #b45309 100%)',
          boxShadow:
            '0 0 0 3px rgba(180, 83, 9, 0.55), 0 0 0 6px rgba(251, 191, 36, 0.18), 0 10px 30px rgba(180, 83, 9, 0.45), inset 0 3px 8px rgba(255, 255, 255, 0.65), inset 0 -6px 12px rgba(146, 64, 14, 0.55)',
        }}
      >
        <Loader2 size={22} className="animate-spin text-amber-900/80" />
      </div>
      {label && <p className="mt-4 text-sm text-slate-400">{label}</p>}
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return (
    <div
      className={`rounded-2xl bg-white/[0.05] animate-shimmer ${className}`}
      style={{
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)',
        backgroundSize: '200% 100%',
      }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Skeleton className="h-5 w-36" />
          <div className="mt-2 flex gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="mt-3 h-2.5 w-full" />
        </div>
        <Skeleton className="h-9 w-16" />
      </div>
    </div>
  );
}

export function EmptyState({ Icon, title, text, action }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.02] px-5 py-10 text-center backdrop-blur">
      {Icon && (
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/5">
          <Icon size={24} className="text-slate-400" />
        </div>
      )}
      <p className="text-sm font-bold text-white">{title}</p>
      {text && <p className="mx-auto mt-1.5 max-w-xs text-xs leading-5 text-slate-400">{text}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, compact = false }) {
  const offline = error?.code === 'NETWORK' || error?.code === 'TIMEOUT';
  const Icon = offline ? WifiOff : AlertCircle;
  return (
    <div className={`rounded-3xl border border-rose-500/20 bg-rose-500/[0.05] ${compact ? 'p-5' : 'p-8'} text-center backdrop-blur`}>
      <Icon size={compact ? 26 : 32} className="mx-auto mb-3 text-rose-300" />
      <p className="text-sm text-rose-200">{errorMessage(error)}</p>
      {onRetry && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" size="sm" onClick={onRetry}>Try Again</Button>
        </div>
      )}
    </div>
  );
}
