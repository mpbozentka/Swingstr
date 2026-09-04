import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { X, Download, Loader2, LayoutGrid, Film, Video } from 'lucide-react';
import { DEFAULT_MARKER_LABELS } from '../constants/markers';
import { useEscapeClose } from '../hooks/useEscapeClose';
import {
  generateSwingSequence,
  getEvenFrameTimes,
  getMarkerColumns,
} from '../utils/swingSequenceExport';
import { recordClip, getMarkerRange, pickRecordingType } from '../utils/videoClipExport';

// Lead-in / lead-out around the marker span so the clip doesn't start and
// end abruptly mid-swing.
const CLIP_PAD = 0.5;

export default function ExportModal({
  show,
  onClose,
  leftRef,
  rightRef,
  leftVideo,
  rightVideo,
  leftMarkers,
  rightMarkers,
  syncOffset = 0,
  playbackSpeed = 1,
}) {
  const [mode, setMode] = useState('sequence');
  const [source, setSource] = useState('left');
  const [frameCount, setFrameCount] = useState(5);
  const [selectionMethod, setSelectionMethod] = useState('even');
  const [showLabels, setShowLabels] = useState(true);
  const [showTitle, setShowTitle] = useState(true);
  const [titleText, setTitleText] = useState('Swing Sequence');
  const [orientation, setOrientation] = useState('horizontal');
  const [format, setFormat] = useState('jpeg');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState(null);

  // Video-clip export state
  const [clipSpeed, setClipSpeed] = useState(playbackSpeed || 1);
  const [recording, setRecording] = useState(false);
  const [recProgress, setRecProgress] = useState(0);
  const [clip, setClip] = useState(null); // { url, ext }
  const [clipError, setClipError] = useState(null);

  useEscapeClose(show, onClose);

  const hasLeft = !!leftVideo;
  const hasRight = !!rightVideo;
  const hasBoth = hasLeft && hasRight;

  // In "From Markers" mode the sequence has exactly one frame per marker the
  // user actually set — one marker, one frame; ten markers, ten frames. Never a
  // fixed 5/8/10, and never a subset.
  const primaryMarkers = source === 'right' ? rightMarkers : leftMarkers;
  const markerColumns = useMemo(() => getMarkerColumns({
    primaryMarkers,
    secondaryMarkers: source === 'both' ? rightMarkers : null,
    labelFor: (i) => DEFAULT_MARKER_LABELS[i],
  }), [primaryMarkers, rightMarkers, source]);
  const markerDriven = selectionMethod === 'markers' && markerColumns.length > 0;
  const effectiveFrameCount = markerDriven ? markerColumns.length : frameCount;

  // Markers are the point of a swing sequence. If any are set, open on them
  // rather than making the user notice the toggle before every export.
  useEffect(() => {
    if (!show) return;
    setSelectionMethod(
      leftMarkers.length > 0 || rightMarkers.length > 0 ? 'markers' : 'even'
    );
    // Only when the modal opens — don't stomp on the toggle mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  // ---- Video clip export -------------------------------------------------
  // The clip always covers the whole swing: earliest marker to latest, with a
  // half-second of breathing room on each end. One video loaded exports on its
  // own; two loaded export side by side, the second shifted by the sync offset
  // so the matching P-markers line up.
  const clipPrimaryRef = hasLeft ? leftRef : rightRef;
  const clipSecondaryRef = hasBoth ? rightRef : null;
  const clipMarkers = hasLeft ? leftMarkers : rightMarkers;
  const clipDuration = clipPrimaryRef?.current?.duration ?? 0;
  const clipRange = getMarkerRange(clipMarkers, clipDuration, CLIP_PAD);
  const clipSorted = [...clipMarkers].sort((a, b) => a.time - b.time);
  const recordingType = pickRecordingType();

  useEffect(() => {
    if (show) setClipSpeed(playbackSpeed || 1);
  }, [show, playbackSpeed]);

  // Revoke the object URL when a new clip replaces it or the modal unmounts.
  useEffect(() => () => { if (clip?.url) URL.revokeObjectURL(clip.url); }, [clip]);

  const handleRecord = useCallback(async () => {
    if (!clipRange) return;
    setClipError(null);
    setClip(null);
    setRecording(true);
    setRecProgress(0);
    try {
      const { blob, ext } = await recordClip({
        primaryRef: clipPrimaryRef,
        secondaryRef: clipSecondaryRef,
        startTime: clipRange.start,
        endTime: clipRange.end,
        secondaryOffset: syncOffset,
        speed: clipSpeed,
        onProgress: setRecProgress,
      });
      setClip({ url: URL.createObjectURL(blob), ext });
    } catch (err) {
      console.error('Video clip export failed:', err);
      setClipError(err.message || 'Recording failed.');
    } finally {
      setRecording(false);
    }
  }, [clipRange, clipPrimaryRef, clipSecondaryRef, syncOffset, clipSpeed]);

  const handleClipDownload = useCallback(() => {
    if (!clip) return;
    const link = document.createElement('a');
    link.download = `swing-clip-${Date.now()}.${clip.ext}`;
    link.href = clip.url;
    link.click();
  }, [clip]);

  const getEvenTimes = useCallback((ref) => {
    const duration = ref?.current?.duration ?? 0;
    if (duration <= 0) return [];
    return getEvenFrameTimes(duration, effectiveFrameCount);
  }, [effectiveFrameCount]);

  const getLabels = useCallback(() => {
    if (!showLabels) return [];
    if (markerDriven) return markerColumns.map((c) => c.label);
    // Default labels for even spacing
    if (effectiveFrameCount <= 5) {
      return ['Setup', 'Takeaway', 'Top', 'Impact', 'Finish'].slice(0, effectiveFrameCount);
    }
    if (effectiveFrameCount <= 8) {
      return ['Address', 'Takeaway', 'Halfway', 'Top', 'Transition', 'Impact', 'Follow-Through', 'Finish'].slice(0, effectiveFrameCount);
    }
    return DEFAULT_MARKER_LABELS.slice(0, effectiveFrameCount);
  }, [showLabels, markerDriven, markerColumns, effectiveFrameCount]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setProgress(0);
    setPreview(null);

    try {
      const primaryRef = source === 'right' ? rightRef : leftRef;

      // Marker mode: one column per placed marker, straight from markerColumns.
      // Even mode: evenly spaced across each video's own duration.
      const frameTimes = markerDriven
        ? markerColumns.map((c) => c.primaryTime)
        : getEvenTimes(primaryRef);

      let rightFrameTimes = frameTimes;
      if (source === 'both') {
        rightFrameTimes = markerDriven
          ? markerColumns.map((c) => c.secondaryTime)
          : getEvenTimes(rightRef);
      }

      const labels = getLabels();

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
        orientation,
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
  }, [source, leftRef, rightRef, markerDriven, markerColumns, getEvenTimes, getLabels, showLabels, showTitle, titleText, orientation, format]);

  const handleDownload = useCallback(() => {
    if (!preview) return;
    const link = document.createElement('a');
    link.download = `swing-sequence-${Date.now()}.${format === 'png' ? 'png' : 'jpg'}`;
    link.href = preview;
    link.click();
  }, [preview, format]);

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[90vw] max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Download size={20} className="text-purple-400" />
              <h2 id="export-modal-title" className="text-lg font-bold text-white">Export</h2>
            </div>
            <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
              {[
                { value: 'sequence', label: 'Sequence', icon: LayoutGrid },
                { value: 'video', label: 'Video', icon: Film },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setMode(value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    mode === value ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Config panel */}
          <div className="w-72 shrink-0 border-r border-gray-700 p-4 overflow-y-auto space-y-5">
            {mode === 'sequence' ? (
              <>
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
              {markerDriven ? (
                <div className="mt-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-300">
                  {effectiveFrameCount} <span className="text-gray-500">
                    — one per marker ({markerColumns.map((c) => c.label).join(', ')})
                  </span>
                </div>
              ) : (
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
              )}
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
                    ({markerColumns.length} set)
                  </span>
                </button>
              </div>
            </div>

            {/* Layout — vertical stacks the frames P1-at-top, one column per
                video; horizontal is the classic strip. */}
            <div>
              <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Layout</label>
              <div className="mt-2 flex gap-1">
                {[
                  { value: 'horizontal', label: 'Horizontal' },
                  { value: 'vertical', label: 'Vertical' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setOrientation(value)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      orientation === value
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-500 mt-1.5">
                {orientation === 'vertical'
                  ? 'First position on top, last at the bottom.'
                  : 'First position on the left, last on the right.'}
              </p>
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
              </>
            ) : (
              <>
                {/* Clip range */}
                <div>
                  <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Clip Range</label>
                  {clipRange ? (
                    <div className="mt-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-300">
                      {clipSorted[0].label} &rarr; {clipSorted[clipSorted.length - 1].label}
                      <div className="text-xs text-gray-500 mt-0.5">
                        {clipRange.start.toFixed(2)}s &ndash; {clipRange.end.toFixed(2)}s
                        {' '}({(clipRange.end - clipRange.start).toFixed(1)}s, incl. {CLIP_PAD}s buffer)
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-amber-400">
                      Set at least two markers to define a clip range.
                    </div>
                  )}
                </div>

                {/* Layout readout */}
                <div>
                  <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Layout</label>
                  <div className="mt-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-300">
                    {hasBoth ? 'Side by side' : 'Single video'}
                    <div className="text-xs text-gray-500 mt-0.5">
                      {hasBoth
                        ? `Right video offset by ${syncOffset.toFixed(2)}s to line up markers`
                        : 'Only one video loaded'}
                    </div>
                  </div>
                </div>

                {/* Speed */}
                <div>
                  <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Speed</label>
                  <div className="mt-2 flex gap-1">
                    {[1, 0.5, 0.25].map((sp) => (
                      <button
                        key={sp}
                        onClick={() => setClipSpeed(sp)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          clipSpeed === sp ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        {sp}x
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1.5">
                    Recorded in real time &mdash; this takes about
                    {' '}{clipRange ? Math.ceil((clipRange.end - clipRange.start) / clipSpeed) : 0}s.
                    No audio.
                  </p>
                </div>

                {/* Format */}
                <div>
                  <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Format</label>
                  <div className="mt-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-300 uppercase">
                    {recordingType?.ext || 'n/a'}
                    {recordingType && recordingType.ext !== 'mp4' && (
                      <span className="block text-[10px] normal-case text-amber-400 mt-0.5">
                        This browser can&rsquo;t record MP4 &mdash; falling back to WebM.
                      </span>
                    )}
                  </div>
                </div>

                {clipError && (
                  <p className="text-xs text-red-400">{clipError}</p>
                )}

                <button
                  onClick={handleRecord}
                  disabled={recording || !clipRange}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  {recording ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Recording {Math.round(recProgress * 100)}%
                    </>
                  ) : (
                    <>
                      <Video size={18} />
                      Record Clip
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          {/* Preview panel */}
          <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-auto bg-gray-950">
            {mode === 'video' ? (
              clip ? (
                <div className="space-y-4 w-full">
                  <video
                    src={clip.url}
                    controls
                    loop
                    className="w-full rounded-lg border border-gray-700 bg-black"
                  />
                  <button
                    onClick={handleClipDownload}
                    className="mx-auto flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors"
                  >
                    <Download size={18} />
                    Download {clip.ext.toUpperCase()}
                  </button>
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  <Film size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">
                    {recording ? 'Recording the clip — leave this window open…' : 'Set your options and click Record Clip'}
                  </p>
                  <p className="text-xs mt-1 text-gray-600">
                    {hasBoth ? 'Side-by-side, markers aligned' : 'Single video'}
                  </p>
                </div>
              )
            ) : preview ? (
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
                  {orientation === 'vertical'
                    ? (source === 'both' ? `2x${effectiveFrameCount} stacked grid` : `1x${effectiveFrameCount} vertical strip`)
                    : (source === 'both' ? `${effectiveFrameCount}x2 grid` : `${effectiveFrameCount}x1 strip`)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
