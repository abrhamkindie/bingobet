import React from 'react';

export default function Toast({ toasts, removeToast }) {
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          onClick={() => removeToast(toast.id)}
          className={`cursor-pointer rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all ${
            toast.type === 'success' ? 'bg-emerald-600 text-white' :
            toast.type === 'error' ? 'bg-red-600 text-white' :
            'bg-slate-700 text-white'
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
