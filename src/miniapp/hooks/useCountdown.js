import { useEffect, useState } from 'react';

/**
 * Returns a live-updating human string for the time remaining until `target`.
 * Returns '' when there is no target, and 'Now' once the target has passed.
 */
export function useCountdown(target) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!target) { setLabel(''); return undefined; }
    const tick = () => {
      const diff = new Date(target).getTime() - Date.now();
      if (diff <= 0) { setLabel('Now'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (d > 0) setLabel(`${d}d ${h}h`);
      else if (h > 0) setLabel(`${h}h ${m}m`);
      else setLabel(`${m}m ${s}s`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [target]);

  return label;
}
