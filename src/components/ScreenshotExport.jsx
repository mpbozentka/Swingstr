import React, { useState, useEffect, useRef } from 'react';
import { Download, Camera } from 'lucide-react';
import { paintExportFrame } from '../utils/videoClipExport';
import { createExportVideo, seekDecoded, releaseVideo } from '../utils/decodedVideo';

// A still of the current frame, drawn straight from the source video, so the
// scrubber, playback bar and other on-screen controls never appear in it.
const RATIOS = [
  { value: 'original', label: 'Match video' },
  { value: '9:16', label: '9:16', size: [1080, 1920] },
  { value: '4:5', label: '4:5', size: [1080, 1350] },
  { value: '1:1', label: '1:1', size: [1080, 1080] },
  { value: '16:9', label: '16:9', size: [1920, 1080] },
];
const TITLE_HEIGHT = 90;

function screenshotSize(ratio, panes, title) {
  const preset = RATIOS.find((r) => r.value === ratio);
  if (preset.size) return { width: preset.size[0], height: preset.size[1], stacked: preset.size[1] > preset.size[0] };
  // Match video: the zoomed area at full resolution, panes side by side at a shared height.
  const dims = panes.map((p) => ({ w: p.width * p.framing.crop.w, h: p.height * p.framing.crop.h }));
  const height = Math.round(Math.max(...dims.map((d) => d.h)));
  const width = Math.round(dims.reduce((sum, d) => sum + d.w * (height / d.h), 0));
  return { width, height: height + (title ? TITLE_HEIGHT : 0), stacked: false };
}

const Choice = ({ options, value, onChange }) => (
  <div className="mt-2 flex flex-wrap gap-1">
    {options.map((o) => (
      <button
        key={o.value}
        onClick={() => !o.disabled && onChange(o.value)}
        disabled={o.disabled}
        className={`flex-1 min-w-[3.5rem] py-2 px-2 rounded-lg text-sm font-medium transition-colors ${
          value === o.value ? 'bg-purple-600 text-white' : o.disabled ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);
const Label = ({ children }) => <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">{children}</label>;

export default function ScreenshotExport({ workflow }) {
  const initial = workflow.sources();
  const [source, setSource] = useState(initial.left?.ready ? 'left' : 'right');
  const [ratio, setRatio] = useState('original');
  const [fit, setFit] = useState('contain');
  const [drawings, setDrawings] = useState(true);
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState('png');
  const [error, setError] = useState('');
  const [size, setSize] = useState(null);
  const canvas = useRef(null);

  // Capture the playheads once when the panel opens so the still matches what
  // was on screen, even if the videos keep playing behind the dialog.
  const [snapshot] = useState(() => ({ left: initial.left?.time, right: initial.right?.time }));

  useEffect(() => {
    const abort = new AbortController();
    const videos = [];
    setError('');
    (async () => {
      try {
        const sides = source === 'both' ? ['left', 'right'] : [source];
        const sources = workflow.sources();
        const panes = sides.map((side) => {
          const s = sources[side];
          if (!s?.ready) throw new Error(`Load a ${side} video first.`);
          return { ...s, side, framing: { fit: ratio === 'original' ? 'contain' : fit, crop: s.viewCrop ?? { x: 0, y: 0, w: 1, h: 1 } } };
        });
        const { width, height, stacked } = screenshotSize(ratio, panes, title);
        for (const pane of panes) videos.push(await createExportVideo(pane.src, abort.signal));
        const times = panes.map((p) => snapshot[p.side] ?? p.time);
        const frames = await Promise.all(videos.map((v, i) => seekDecoded(v, times[i], abort.signal)));
        if (abort.signal.aborted || !canvas.current) return;
        const plan = { width, height, title, panes, paneLabels: {}, annotations: drawings ? 'annotated' : 'clean', preset: stacked ? 'portrait' : 'landscape' };
        canvas.current.width = width;
        canvas.current.height = height;
        paintExportFrame(canvas.current.getContext('2d'), plan, videos, panes.map((p, i) => ({ side: p.side, time: frames[i]?.mediaTime ?? times[i], held: false })), frames);
        setSize({ width, height });
      } catch (e) {
        if (e.name !== 'AbortError') { console.error('Screenshot failed:', e); setError(e.message); }
      } finally {
        videos.forEach(releaseVideo);
      }
    })();
    return () => abort.abort();
    // workflow.sources() is read fresh inside; snapshot is fixed for the panel's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, ratio, fit, drawings, title]);

  const download = () => {
    const ext = format === 'png' ? 'png' : 'jpg';
    const link = document.createElement('a');
    link.download = `swing-screenshot-${Date.now()}.${ext}`;
    link.href = canvas.current.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', 0.95);
    link.click();
  };

  return (
    <>
      <div className="sequence-settings w-72 shrink-0 border-r border-gray-700 p-4 overflow-y-auto space-y-5">
        <div>
          <Label>Video Source</Label>
          <Choice
            value={source}
            onChange={setSource}
            options={[
              { value: 'left', label: 'Left', disabled: !initial.left?.ready },
              { value: 'right', label: 'Right', disabled: !initial.right?.ready },
              { value: 'both', label: 'Both', disabled: !(initial.left?.ready && initial.right?.ready) },
            ]}
          />
        </div>

        <div>
          <Label>Ratio</Label>
          <Choice value={ratio} onChange={setRatio} options={RATIOS} />
          <p className="text-[10px] text-gray-500 mt-1.5">
            {ratio === 'original' ? 'Same shape and zoom as the video on screen.' : '9:16 Stories/Reels · 4:5 Instagram feed · 1:1 square · 16:9 widescreen'}
          </p>
        </div>

        {ratio !== 'original' && (
          <div>
            <Label>Framing</Label>
            <Choice value={fit} onChange={setFit} options={[{ value: 'contain', label: 'Fit (bars)' }, { value: 'crop', label: 'Fill (crop)' }]} />
          </div>
        )}

        <div className="space-y-3">
          <Label>Options</Label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={drawings}
              onChange={(e) => setDrawings(e.target.checked)}
              className="rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
            />
            <span className="text-sm text-gray-300">Include drawings</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Optional title"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div>
          <Label>Format</Label>
          <Choice value={format} onChange={setFormat} options={[{ value: 'png', label: 'PNG' }, { value: 'jpeg', label: 'JPEG' }]} />
        </div>
      </div>

      <div className="sequence-preview flex-1 min-w-0 flex flex-col items-center justify-center p-4 overflow-auto bg-gray-950 gap-4">
        {error ? (
          <div role="alert" className="text-center text-red-400 text-sm">{error}</div>
        ) : null}
        <canvas ref={canvas} className={`max-h-[60vh] max-w-full rounded-lg border border-gray-700 ${error ? 'hidden' : ''}`} />
        {!error && size && (
          <>
            <p className="text-xs text-gray-500">{size.width}×{size.height}</p>
            <button
              onClick={download}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors"
            >
              <Download size={18} />
              Download {format === 'png' ? 'PNG' : 'JPEG'}
            </button>
          </>
        )}
        {!error && !size && <Camera size={48} className="text-gray-500 opacity-30" />}
      </div>
    </>
  );
}
