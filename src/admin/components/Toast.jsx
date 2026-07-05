import React from 'react';

const config = {
  success: { icon: '✓', border: 'border-emerald-200', iconBg: 'bg-emerald-500', text: 'text-emerald-700' },
  error:   { icon: '✕', border: 'border-red-200', iconBg: 'bg-red-500', text: 'text-red-700' },
  warning: { icon: '!', border: 'border-amber-200', iconBg: 'bg-amber-500', text: 'text-amber-700' },
  info:    { icon: 'i', border: 'border-indigo-200', iconBg: 'bg-primary', text: 'text-primary' },
};

export default function Toast({ toasts, removeToast }) {
  if (!toasts || !toasts.length) return null;
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm max-md:left-4 max-md:right-4 max-md:max-w-none">
      {toasts.map(t => {
        const c = config[t.type] || config.info;
        return (
          <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-white border ${c.border} shadow-pop text-sm animate-toast-in`}>
            <div className={`w-7 h-7 rounded-xl ${c.iconBg} flex items-center justify-center text-white text-xs font-bold shrink-0`}>{c.icon}</div>
            <span className={`flex-1 ${c.text} text-xs font-medium`}>{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="bg-transparent border-0 text-muted-2 cursor-pointer text-lg p-0 leading-none hover:text-ink transition-colors">&times;</button>
          </div>
        );
      })}
    </div>
  );
}
