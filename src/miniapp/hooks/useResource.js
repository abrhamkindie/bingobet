import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Centralizes the load / empty / error / retry pattern used by every screen.
 *
 * @param {() => Promise<any>} fetcher async data loader
 * @param {Array} deps dependency list; refetches when it changes
 * @param {{ immediate?: boolean }} [opts]
 * @returns {{ data, loading, error, refreshing, reload, setData }}
 */
export function useResource(fetcher, deps = [], { immediate = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const mounted = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (mounted.current) setData(result);
      return result;
    } catch (err) {
      if (mounted.current) setError(err);
      throw err;
    } finally {
      if (mounted.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => {
    if (immediate) load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, refreshing, error, reload: load, setData };
}
