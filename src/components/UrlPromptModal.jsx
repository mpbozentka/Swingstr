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
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (busy) window.swingstrDesktop?.cancelYouTube?.();
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, busy]);

  useEffect(() => {
    const desktop = typeof window !== 'undefined' ? window.swingstrDesktop : null;
    if (!desktop?.onYouTubeProgress) return undefined;
    return desktop.onYouTubeProgress((data) => setProgress(data));
  }, []);

  const close = () => {
    if (busy) window.swingstrDesktop?.cancelYouTube?.();
    onClose?.();
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await onSubmit?.(value.trim());
      if (result?.error) setError(result.error);
    } catch (err) {
      setError(err?.message || "Couldn't load that URL.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="url-prompt-title"
      className="fixed inset-0 z-[150] bg-black/70 flex items-center justify-center"
      onClick={close}
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
            onClick={close}
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
          placeholder="YouTube link or https://example.com/video.mp4"
          value={value}
          disabled={busy}
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !busy) { e.preventDefault(); submit(); } }}
          className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 mb-2 focus:outline-none focus:border-purple-500 disabled:opacity-60"
        />
        {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
        {busy && (
          <div className="mb-3">
            <div className="h-1.5 bg-gray-900 rounded overflow-hidden">
              <div
                className="h-full bg-purple-500 transition-all"
                style={{ width: `${Math.max(4, progress?.percent ?? 8)}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              {progress?.status || 'Downloading from YouTube…'}
            </p>
          </div>
        )}
        <p className="text-[11px] text-gray-500 mb-4">
          YouTube links download into Swingstr Library, then play. Direct mp4/mov URLs still work.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={close}
            className="px-4 py-2 rounded text-gray-300 hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!value.trim() || busy}
            className="px-4 py-2 rounded font-bold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Downloading…' : 'Load'}
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
