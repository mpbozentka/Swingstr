import { useEffect } from 'react';

/**
 * Listen for Escape and call `onClose` while `active` is true. Mounted by
 * dialog components so users can dismiss with the keyboard. (#30)
 */
export function useEscapeClose(active, onClose) {
  useEffect(() => {
    if (!active) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, onClose]);
}
