import React, { useEffect, useRef, useState } from 'react';
import { Globe, X } from 'lucide-react';

/**
 * Replaces window.prompt() for the "Load video from URL" flow. Validates on
 * submit and surfaces inline errors instead of routing through alert(). Esc
 * cancels; Enter submits.
 *
 * Parent should unmount this when closed (conditional render) so each open
 * starts with a fresh input — that's why we don't reset state on close here.
 */
function UrlPromptBody({ onSubmit, onClose }) {
  const inputRef = useRef(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const submit = () => {
    const result = onSubmit?.(value.trim());
    if (result?.error) setError(result.error);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="url-prompt-title"
      className="fixed inset-0 z-[150] bg-black/70 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 p-6 rounded-xl border border-gray-700 w-[28rem] max-w-[90vw] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Globe size={18} className="text-purple-400" />
            <h3 id="url-prompt-title" className="font-bold text-base">Load Video from URL</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
        <input
          ref={inputRef}
          type="url"
          inputMode="url"
          placeholder="https://example.com/video.mp4"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 mb-2 focus:outline-none focus:border-purple-500"
        />
        {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
        <p className="text-[11px] text-gray-500 mb-4">
          Direct mp4/mov URL. Server must allow cross-origin or snapshot/blur won't work.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-gray-300 hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!value.trim()}
            className="px-4 py-2 rounded font-bold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Load
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UrlPromptModal({ open, onSubmit, onClose }) {
  if (!open) return null;
  return <UrlPromptBody onSubmit={onSubmit} onClose={onClose} />;
}
