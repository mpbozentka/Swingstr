import React, { useEffect } from 'react';
import { Check, AlertTriangle } from 'lucide-react';

const KIND_STYLES = {
  success: 'bg-green-600/90 text-white',
  error: 'bg-red-600/90 text-white',
  info: 'bg-gray-700/90 text-white',
};

/**
 * Lightweight, non-blocking notification. Auto-dismisses; one toast at a time
 * is plenty for this app, so callers manage a single piece of toast state and
 * pass it in. Swaps in for the previous alert('Saved!') flow.
 */
export default function Toast({ message, kind = 'info', onDismiss, duration = 1800 }) {
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(() => onDismiss?.(), duration);
    return () => clearTimeout(t);
  }, [message, duration, onDismiss]);

  if (!message) return null;
  const Icon = kind === 'success' ? Check : kind === 'error' ? AlertTriangle : null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-4 py-2 rounded-full shadow-2xl backdrop-blur ${KIND_STYLES[kind]}`}
    >
      {Icon && <Icon size={16} />}
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}
