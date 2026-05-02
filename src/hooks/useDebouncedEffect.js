import { useEffect } from 'react';

/**
 * Run `effect` only after `value` has been stable for `delay` ms. Useful for
 * debouncing localStorage writes (every keystroke in a notes textarea would
 * otherwise serialize the whole CRM). Trailing-only — leading edge is skipped.
 */
export function useDebouncedEffect(effect, deps, delay) {
  useEffect(() => {
    const handle = setTimeout(effect, delay);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delay]);
}
