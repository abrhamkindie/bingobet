import React from 'react';

export const selectClass = 'control px-3 py-1.5';
export const inputClass = 'w-full px-3 py-2 field rounded-lg text-ink text-sm placeholder:text-muted-2';
export const textareaClass = 'w-full px-3 py-2 field rounded-lg text-ink text-sm placeholder:text-muted-2 resize-y';
export const checkboxClass = 'w-4 h-4 rounded border-line bg-surface-input text-brand focus:ring-brand/20';

export function StatusBadge({ status }) {
  const m = {
    pending_approval: ['bg-warning-soft text-amber-700 border-amber-200', 'Pending'],
    approved: ['bg-emerald-50 text-emerald-700 border-emerald-200', 'Approved'],
    rejected: ['bg-red-50 text-red-700 border-red-200', 'Rejected'],
    suspended: ['bg-red-50 text-red-700 border-red-200', 'Suspended'],
    active: ['bg-emerald-50 text-emerald-700 border-emerald-200', 'Active'],
    reserved: ['bg-blue-50 text-blue-700 border-blue-200', 'Reserved'],
    confirmed: ['bg-blue-50 text-blue-700 border-blue-200', 'Confirmed'],
    completed: ['bg-emerald-50 text-emerald-700 border-emerald-200', 'Completed'],
    cancelled: ['bg-red-50 text-red-700 border-red-200', 'Cancelled'],
    in_progress: ['bg-warning-soft text-amber-700 border-amber-200', 'In Progress'],
    paid: ['bg-emerald-50 text-emerald-700 border-emerald-200', 'Paid'],
    unpaid: ['bg-warning-soft text-amber-700 border-amber-200', 'Unpaid'],
    refunded: ['bg-violet-50 text-violet-700 border-violet-200', 'Refunded'],
    pending: ['bg-warning-soft text-amber-700 border-amber-200', 'Pending'],
    open: ['bg-warning-soft text-amber-700 border-amber-200', 'Open'],
    resolved: ['bg-emerald-50 text-emerald-700 border-emerald-200', 'Resolved'],
    closed: ['bg-slate-100 text-slate-600 border-slate-200', 'Closed'],
    driver: ['bg-blue-50 text-blue-700 border-blue-200', 'Driver'],
    host: ['bg-emerald-50 text-emerald-700 border-emerald-200', 'Host'],
    admin: ['bg-warning-soft text-amber-700 border-amber-200', 'Admin'],
    superadmin: ['bg-red-50 text-red-700 border-red-200', 'Superadmin'],
    sent: ['bg-emerald-50 text-emerald-700 border-emerald-200', 'Sent'],
  };
  const s = m[status] || ['bg-slate-100 text-slate-600 border-slate-200', status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap ${s[0]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s[0].includes('emerald') ? 'bg-emerald-500' : s[0].includes('red') ? 'bg-red-500' : s[0].includes('amber') ? 'bg-amber-500' : s[0].includes('blue') ? 'bg-blue-500' : s[0].includes('violet') ? 'bg-violet-500' : 'bg-slate-400'}`}></span>
      {s[1]}
    </span>
  );
}

export function KpiCard({ label, value, icon, color, trend }) {
  const hue = (color || 'blue').match(/from-(\w+)-/)?.[1] || 'blue';
  const chip = {
    blue: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    purple: 'bg-violet-50 text-violet-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    sky: 'bg-sky-50 text-sky-600',
    rose: 'bg-red-50 text-red-600',
    green: 'bg-emerald-50 text-emerald-600',
  }[hue] || 'bg-blue-50 text-blue-600';
  return (
    <div className="card card-hover rounded-xl p-5 relative overflow-hidden group">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl ${chip} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>{icon}</div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${trend >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'}`}>
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">{trend >= 0 ? <path d="M6 2l4 6H2z"/> : <path d="M6 10l4-6H2z"/>}</svg>
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <div className="text-[11px] text-muted font-semibold mb-1 uppercase tracking-[0.08em]">{label}</div>
      <div className="text-2xl font-bold text-ink leading-tight tracking-tight tabular-nums">{value}</div>
    </div>
  );
}

export function LoadingSpinner({ text }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted text-sm gap-4">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 border-2 border-primary/20 rounded-full animate-spin-slow"></div>
        <div className="absolute inset-1 border-2 border-transparent border-t-primary rounded-full animate-spin-slow" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
      </div>
      <span className="text-xs text-muted">{text || 'Loading...'}</span>
    </div>
  );
}

export function EmptyState({ text }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted gap-4">
      <div className="w-16 h-16 rounded-xl bg-surface-muted border border-line flex items-center justify-center">
        <svg className="w-8 h-8 text-muted-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
      </div>
      <p className="text-sm text-muted">{text || 'No data found'}</p>
    </div>
  );
}

export function formatDate(d) {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-ET', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatDateShort(d) {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-ET', { month: 'short', day: 'numeric' });
}

export function formatCurrency(n) {
  if (n == null) return '\u2014';
  return Number(n).toLocaleString('en-ET', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ETB';
}

export function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

export function PageHeader({ eyebrow, title, description, actions, meta }) {
  return (
    <div className="mb-5 rounded-xl border border-line bg-white p-6 shadow-card">
      <div className="flex items-start justify-between gap-4 max-md:flex-col">
        <div className="min-w-0">
          {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">{eyebrow}</p>}
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">{title}</h1>
          {description && <p className="mt-1 text-sm leading-6 text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2 max-md:w-full max-md:flex-wrap">{actions}</div>}
      </div>
      {meta && <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-4">{meta}</div>}
    </div>
  );
}

export function Toolbar({ children, resultText }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3.5 shadow-sm max-md:flex-col max-md:items-stretch">
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {resultText && <div className="text-xs font-medium text-muted">{resultText}</div>}
    </div>
  );
}

export function DetailGrid({ items }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {items.map(([label, value], i) => (
        <div key={i} className="rounded-lg border border-line bg-surface-muted p-4">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-muted">{label}</div>
          <div className="break-words text-sm text-ink">{value}</div>
        </div>
      ))}
    </div>
  );
}

export function MetricPill({ label, value }) {
  return (
    <div className="rounded-lg border border-line bg-surface-muted px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink tabular-nums">{value}</p>
    </div>
  );
}

