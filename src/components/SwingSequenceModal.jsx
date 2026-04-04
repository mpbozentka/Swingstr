import React, { useState, useCallback } from 'react';
import { X, Download, Loader2, LayoutGrid } from 'lucide-react';
import { DEFAULT_MARKER_LABELS } from './MarkerBar';
import {
  generateSwingSequence,
  getEvenFrameTimes,
  getMarkerFrameTimes,
} from '../utils/swingSequenceExport';

export default function SwingSequenceModal({
  show,
  onClose,
  leftRef,
  rightRef,
  leftVideo,
  rightVideo,
  leftMarkers,
  rightMarkers,
}) {
  const [source, setSource] = useState('left');
  const [frameCount, setFrameCount] = useState(5);
  const [selectionMethod, setSelectionMethod] = useState('even');
  const [showLabels, setShowLabels] = useState(true);
  const [showTitle, setShowTitle] = useState(true);
  const [titleText, setTitleText] = useState('Swing Sequence');
  const [format, setFormat] = useState('jpeg');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState(null);

  const hasLeft = !!leftVideo;
  const hasRight = !!rightVideo;
  const hasBoth = hasLeft && hasRight;

  const getFrameTimes = useCallback((markers, ref) => {
    const duration = ref?.current?.duration ?? 0;
    if (duration <= 0) return [];
    if (selectionMethod === 'markers' && markers.length > 0) {
      return getMarkerFrameTimes(markers, duration, frameCount);
    }
    return getEvenFrameTimes(duration, frameCount);
  }, [selectionMethod, frameCount]);

  const getLabels = useCallback((markers) => {
    if (!showLabels) return [];
    if (selectionMethod === 'markers' && markers.length > 0) {
      const sorted = [...markers].sort((a, b) => a.time - b.time);
      const labels = sorted.slice(0, frameCount).map((m) => m.label);
      // Pad with numbered labels if needed
      while (labels.length < frameCount) {
        labels.push(`Frame ${labels.length + 1}`);
      }
      return labels;
    }
    // Default labels for even spacing
    if (frameCount <= 5) {
      return ['Setup', 'Takeaway', 'Top', 'Impact', 'Finish'].slice(0, frameCount);
    }
    if (frameCount <= 8) {
      return ['Address', 'Takeaway', 'Halfway', 'Top', 'Transition', 'Impact', 'Follow-Through', 'Finish'].slice(0, frameCount);
    }
    return DEFAULT_MARKER_LABELS.slice(0, frameCount);
  }, [showLabels, selectionMethod, frameCount]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setProgress(0);
    setPreview(null);

    try {
      const primaryRef = source === 'right' ? rightRef : leftRef;
      const primaryMarkers = source === 'right' ? rightMarkers : leftMarkers;
      const frameTimes = getFrameTimes(primaryMarkers, primaryRef);

      let rightFrameTimes = frameTimes;
      if (source === 'both') {
        rightFrameTimes = getFrameTimes(rightMarkers, rightRef);
      }

      const labels = getLabels(primaryMarkers);

      const dataUrl = await generateSwingSequence({
        leftRef: source === 'right' ? rightRef : leftRef,
        rightRef: source === 'both' ? rightRef : null,
        source: source === 'both' ? 'both' : 'left',
        frameTimes,
        rightFrameTimes,
        labels,
        showLabels,
        showTitle,
        titleText,
        format,
        onProgress: setProgress,
      });

      setPreview(dataUrl);
    } catch (err) {
      console.error('Swing sequence generation failed:', err);
      alert('Failed to generate swing sequence. Make sure a video is loaded.');
    } finally {
      setGenerating(false);
    }
  }, [source, leftRef, rightRef, leftMarkers, rightMarkers, getFrameTimes, getLabels, showLabels, showTitle, titleText, format]);

  const handleDownload = useCallback(() => {
    if (!preview) return;
    const link = document.createElement('a');
    link.download = `swing-sequence-${Date.now()}.${format === 'png' ? 'png' : 'jpg'}`;
    link.href = preview;
    link.click();
  }, [preview, format]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[90vw] max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <LayoutGrid size={20} className="text-purple-400" />
            <h2 className="text-lg font-bold text-white">Swing Sequence Export</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Config panel */}
          <div className="w-72 shrink-0 border-r border-gray-700 p-4 overflow-y-auto space-y-5">
            {/* Video source */}
            <div>
              <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Video Source</label>
              <div className="mt-2 space-y-1">
                {[
                  { value: 'left', label: 'Left Video', disabled: !hasLeft },
                  { value: 'right', label: 'Right Video', disabled: !hasRight },
                  { value: 'both', label: 'Both (Comparison)', disabled: !hasBoth },
                ].map(({ value, label, disabled }) => (
                  <button
                    key={value}
                    onClick={() => !disabled && setSource(value)}
                    disabled={disabled}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      source === value
                        ? 'bg-purple-600 text-white'
                        : disabled
                        ? 'text-gray-600 cursor-not-allowed'
                        : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Frame count */}
            <div>
              <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Frames</label>
              <div className="mt-2 flex gap-1">
                {[5, 8, 10].map((n) => (
                  <button
                    key={n}
                    onClick={() => setFrameCount(n)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      frameCount === n
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Selection method */}
            <div>
              <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Frame Selection</label>
              <div className="mt-2 space-y-1">
                <button
                  onClick={() => setSelectionMethod('even')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectionMethod === 'even' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  Even Spacing
                </button>
                <button
                  onClick={() => setSelectionMethod('markers')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectionMethod === 'markers' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  From Markers
                  <span className="text-xs text-gray-500 ml-1">
                    ({(source === 'right' ? rightMarkers : leftMarkers).length} set)
                  </span>
                </button>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Options</label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={(e) => setShowLabels(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-300">Show Labels</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showTitle}
                  onChange={(e) => setShowTitle(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-300">Title Bar</span>
              </label>

              {showTitle && (
                <input
                  type="text"
                  value={titleText}
                  onChange={(e) => setTitleText(e.target.value)}
                  placeholder="Title text..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500"
                />
              )}
            </div>

            {/* Format */}
            <div>
              <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Format</label>
              <div className="mt-2 flex gap-1">
                {['jpeg', 'png'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium uppercase transition-colors ${
                      format === f
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              {generating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {Math.round(progress * 100)}%
                </>
              ) : (
                <>
                  <LayoutGrid size={18} />
                  Generate
                </>
              )}
            </button>
          </div>

          {/* Preview panel */}
          <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-auto bg-gray-950">
            {preview ? (
              <div className="space-y-4 w-full">
                <img
                  src={preview}
                  alt="Swing Sequence Preview"
                  className="w-full rounded-lg border border-gray-700"
                />
                <button
                  onClick={handleDownload}
                  className="mx-auto flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors"
                >
                  <Download size={18} />
                  Download {format.toUpperCase()}
                </button>
              </div>
            ) : (
              <div className="text-center text-gray-500">
                <LayoutGrid size={48} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Configure settings and click Generate</p>
                <p className="text-xs mt-1 text-gray-600">
                  {source === 'both' ? `${frameCount}x2 grid` : `${frameCount}x1 strip`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
