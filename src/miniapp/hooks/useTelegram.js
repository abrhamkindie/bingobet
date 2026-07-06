import { useCallback, useEffect, useRef } from 'react';

/**
 * Thin wrapper over the Telegram WebApp SDK with safe no-ops when the SDK is
 * absent (e.g. local browser dev). Provides haptics, BackButton and MainButton.
 */
export function useTelegram() {
  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;

  const haptic = useCallback((style = 'light') => {
    try {
      const h = tg?.HapticFeedback;
      if (!h) return;
      if (style === 'success' || style === 'error' || style === 'warning') {
        h.notificationOccurred(style);
      } else if (style === 'select') {
        h.selectionChanged();
      } else {
        h.impactOccurred(style); // 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
      }
    } catch { /* ignore */ }
  }, [tg]);

  const showBackButton = useCallback((cb) => {
    const bb = tg?.BackButton;
    if (!bb) return () => {};
    bb.show();
    bb.onClick(cb);
    return () => { try { bb.offClick(cb); bb.hide(); } catch { /* ignore */ } };
  }, [tg]);

  return { tg, haptic, showBackButton, ready: !!tg };
}

/**
 * Declaratively bind the Telegram BackButton to a callback while mounted.
 * Falls back to nothing when the SDK is missing.
 */
export function useBackButton(active, onBack) {
  const { showBackButton } = useTelegram();
  const cbRef = useRef(onBack);
  cbRef.current = onBack;

  useEffect(() => {
    if (!active) return undefined;
    const handler = () => cbRef.current?.();
    return showBackButton(handler);
  }, [active, showBackButton]);
}
