import { useEffect } from 'react';
import { encodeConfigToHash } from '../utils/designConfig.js';

// Mirrors the current design config into the URL hash so the page can be shared
// or bookmarked. Writes are debounced and use replaceState so slider drags don't
// flood browser history or feel sluggish. `config` should be a memoized object.
export function useDesignUrlSync(config) {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const timer = setTimeout(() => {
      const next = `#${encodeConfigToHash(config)}`;
      if (window.location.hash !== next) {
        window.history.replaceState(null, '', next);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [config]);
}
