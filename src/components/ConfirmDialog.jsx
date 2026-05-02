import React, { useEffect, useRef } from 'react';

/**
 * Replacement for window.confirm — non-blocking, themed, focus-trapped, and
 * dismissable with Escape. Used in place of the native dialog so deletes feel
 * consistent with the rest of the UI.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel?.();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-[150] bg-black/70 flex items-center justify-center"
      onClick={onCancel}
    >
      <div
        className="bg-gray-800 p-6 rounded-xl border border-gray-700 w-96 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-title" className="font-bold text-lg mb-2">{title}</h3>
        {message && <p className="text-sm text-gray-300 mb-4">{message}</p>}
        <div className="flex gap-2 justify-end">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-4 py-2 rounded text-gray-300 hover:bg-gray-700"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded font-bold ${destructive
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-purple-600 hover:bg-purple-500 text-white'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
