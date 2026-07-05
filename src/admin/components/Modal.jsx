import React from 'react';

export default function Modal({ title, children, onClose }) {
  React.useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/40 z-[9000] flex items-center justify-center p-5" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white border border-line rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-card-lg animate-modal-in overflow-hidden">
        <div className="flex justify-between items-center px-6 py-4 border-b border-line">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="text-muted cursor-pointer transition-colors hover:text-ink w-8 h-8 rounded-lg hover:bg-surface-muted flex items-center justify-center">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
