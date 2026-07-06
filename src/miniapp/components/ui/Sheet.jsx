import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useTelegram } from '../../hooks/useTelegram.js';

/**
 * Bottom-sheet modal. Renders nothing when `open` is false.
 * Closes on backdrop tap, ✕, Escape, and the Telegram BackButton.
 */
export default function Sheet({ open, onClose, title, children, footer }) {
  const { showBackButton } = useTelegram();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const detach = showBackButton(() => onClose?.());
    return () => { document.removeEventListener('keydown', onKey); detach?.(); };
  }, [open, onClose, showBackButton]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in-up"
        style={{ animationDuration: '0.2s' }}
      />
      <div className="relative flex max-h-[85vh] w-full max-w-md flex-col animate-slide-up rounded-t-3xl border-t border-white/12 bg-night-900/95 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-[0_-20px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-white/20" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <h3 className="text-base font-black text-white">{title}</h3>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/8 text-slate-300 transition hover:bg-white/15 active:scale-90"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[70vh] flex-1 overflow-y-auto px-5 pb-4 pt-1 min-h-0">{children}</div>
        {footer && <div className="border-t border-white/8 px-5 pt-4">{footer}</div>}
      </div>
    </div>
  );
}
