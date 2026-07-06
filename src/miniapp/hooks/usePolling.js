import { useEffect, useRef } from 'react';

/**
 * Calls `fn` every `intervalMs`, but ONLY while `active` is true and the tab is
 * visible. Prevents runaway background polling on slow/metered connections.
 *
 * @param {() => void} fn
 * @param {number} intervalMs
 * @param {boolean} active whether polling should run (e.g. screen is visible)
 */
export function usePolling(fn, intervalMs, active = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!active) return undefined;

    let timer = null;
    const tick = () => { if (document.visibilityState === 'visible') fnRef.current(); };

    const start = () => {
      if (timer) return;
      timer = setInterval(tick, intervalMs);
    };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') { fnRef.current(); start(); }
      else stop();
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [intervalMs, active]);
}
