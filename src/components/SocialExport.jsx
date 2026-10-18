import React, { useState, useRef, useEffect } from 'react';
import { pickRecordingType, paintExportFrame } from '../utils/videoClipExport';
import { createExportVideo, seekDecoded, releaseVideo } from '../utils/decodedVideo';
import { mapExportTime } from '../utils/exportPlan';
export default function SocialExport({ workflow }) {
  const [options, setOptions] = useState({ source: workflow.sources().left?.ready ? 'left' : 'right', preset: 'portrait', speed: 1, repeats: 1, annotations: (workflow.sources().left?.drawings?.length || workflow.sources().right?.drawings?.length) ? 'annotated' : 'clean', holds: { startSeconds: 0, endSeconds: 0 }, title: '', paneLabels: {}, framing: {} });
  const [result, setResult] = useState(null), [error, setError] = useState(''), [progress, setProgress] = useState(0), [busy, setBusy] = useState(false);
  const controller = useRef(null), canvas = useRef(null);
  const [previewTime, setPreviewTime] = useState(0);
  const previewRef = useRef(null);
  useEffect(() => {
    if (result && window.matchMedia('(max-width: 1023px)').matches) previewRef.current?.scrollIntoView({ block: 'start' });
  }, [result]);
  let plan;
  try { plan = workflow.recipe(options); } catch (e) { plan = { error: e.message }; }
  const recipeKey = JSON.stringify(plan);
  useEffect(() => {
    if (plan.error) return undefined;
    const abort = new AbortController(); const videos = [];
    (async () => {
      try {
        for (const pane of plan.panes) videos.push(await createExportVideo(pane.src, abort.signal));
        const mapped = mapExportTime(plan, Math.min(previewTime, plan.expectedDuration));
        const frames = await Promise.all(videos.map((v, i) => seekDecoded(v, mapped[i].time, abort.signal)));
        if (!abort.signal.aborted && canvas.current) { canvas.current.width = plan.width; canvas.current.height = plan.height; paintExportFrame(canvas.current.getContext('2d'), plan, videos, mapped, frames); }
      } catch (e) { if (e.name !== 'AbortError') setError(e.message); }
      finally { videos.forEach(releaseVideo); }
    })();
    return () => abort.abort();
    // Recipe serialization tracks the complete snapshot without depending on object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeKey, previewTime]);
  // The job runner owns resources; closing this panel cancels its active job.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => (() => { controller.current?.abort(); if (controller.current?.jobId) workflow.cancelExport(controller.current.jobId); })(), []);
  useEffect(() => () => { if (result?.url) URL.revokeObjectURL(result.url); }, [result]);
  const set = (key, value) => setOptions((o) => ({ ...o, [key]: value }));
  const record = async () => {
    controller.current = new AbortController(); setBusy(true); setError(''); setProgress(0); setResult(null);
    try {
      const job = workflow.startExport({ ...options, destination: 'exports' });
      controller.current.jobId = job.jobId;
      let status;
      do {
        if (controller.current.signal.aborted) workflow.cancelExport(job.jobId);
        await new Promise((resolve) => setTimeout(resolve, 100));
        status = workflow.getExportStatus(job.jobId); setProgress(status.progress ?? 0);
      } while (['queued', 'running'].includes(status.status));
      if (status.status !== 'completed') throw new Error(status.error ?? 'Export cancelled.');
      const output = workflow.getExportResult(job.jobId);
      setResult({ ...output, path: status.path, url: URL.createObjectURL(output.blob) });
    } catch (e) { setError(e.name === 'AbortError' ? 'Export cancelled.' : e.message); } finally { setBusy(false); }
  };
  const download = async () => {
    if (window.swingstrDesktop?.saveExport) {
      try { const saved = await window.swingstrDesktop.saveExport({ bytes: await result.blob.arrayBuffer(), ext: result.ext, destination: 'dialog' }); if (saved.path) setResult((r) => ({ ...r, path: saved.path })); } catch (e) { setError(e.message); }
    } else { const link = document.createElement('a'); link.href = result.url; link.download = `swing-clip-${Date.now()}.${result.ext}`; link.click(); }
  };
  return <div className="video-export flex w-full gap-5 p-4 overflow-auto text-sm">
    <fieldset disabled={busy} className="video-export-settings w-72 shrink-0 space-y-3 max-h-[65vh] overflow-y-auto pr-2">
      {Object.entries({ source: ['left', 'right', 'both'], preset: ['portrait', 'square', 'landscape'], speed: [1, 0.5, 0.25], repeats: [1, 3, 5], annotations: ['clean', 'annotated'] }).map(([key, values]) => <label key={key} className="block">{({ source: 'Video source', preset: 'Canvas', speed: 'Playback speed', repeats: 'Encoded passes', annotations: 'Drawings' })[key]} <select aria-label={`Export ${key}`} className="bg-gray-800 p-2 rounded" value={options[key]} onChange={(e) => set(key, ['speed', 'repeats'].includes(key) ? Number(e.target.value) : e.target.value)}>{values.map((v) => <option key={v} value={v}>{v}{key === 'speed' ? '×' : ''}</option>)}</select></label>)}
      {['startSeconds', 'endSeconds'].map((key) => <label className="block" key={key}>{key === 'startSeconds' ? 'Start hold (seconds)' : 'End hold (seconds)'} <input className="bg-gray-800 w-16" type="number" min="0" max="3" step=".1" value={options.holds[key]} onChange={(e) => set('holds', { ...options.holds, [key]: Number(e.target.value) })} /></label>)}
      <label className="block"><input type="checkbox" checked={!!options.holds.checkpoint} onChange={(e) => set('holds', { ...options.holds, checkpoint: e.target.checked ? { position: 7, seconds: 1 } : undefined })} />Checkpoint hold</label>
      {options.holds.checkpoint && ['position', 'seconds'].map((key) => <label key={key}>{key === 'position' ? 'P position' : 'Hold seconds'}<input className="bg-gray-800 w-16" type="number" min={key === 'position' ? 1 : 0} max={key === 'position' ? 10 : 3} step={key === 'position' ? 1 : .1} value={options.holds.checkpoint[key]} onChange={(e) => set('holds', { ...options.holds, checkpoint: { ...options.holds.checkpoint, [key]: Number(e.target.value) } })} /></label>)}
      <input aria-label="Export title" className="bg-gray-800 p-2 w-full" placeholder="Optional title" value={options.title} onChange={(e) => set('title', e.target.value)} />
      {(options.source === 'both' ? ['left', 'right'] : [options.source]).map((side) => <div key={side} className="space-y-1">
        <input aria-label={`${side} label`} className="bg-gray-800 p-2 w-full" placeholder={`${side} label (optional)`} value={options.paneLabels[side] ?? ''} onChange={(e) => set('paneLabels', { ...options.paneLabels, [side]: e.target.value })} />
        <select aria-label={`${side} fit`} className="bg-gray-800" value={options.framing[side]?.fit ?? 'contain'} onChange={(e) => set('framing', { ...options.framing, [side]: { ...options.framing[side], fit: e.target.value } })}><option>contain</option><option>crop</option></select>
        <div className="grid grid-cols-2 gap-1">{['x', 'y', 'w', 'h'].map((key) => <label key={key}>{({x:'Left',y:'Top',w:'Width',h:'Height'})[key]} <input aria-label={`${side} crop ${key}`} className="bg-gray-800 w-12" type="number" step=".05" min="0" max="1" value={options.framing[side]?.crop?.[key] ?? (['w', 'h'].includes(key) ? 1 : 0)} onChange={(e) => set('framing', { ...options.framing, [side]: { ...options.framing[side], crop: { x: 0, y: 0, w: 1, h: 1, ...options.framing[side]?.crop, [key]: Number(e.target.value) } } })} /></label>)}</div>
        <p className="text-xs text-gray-400">Crop values are fractions of the source (0–1).</p>
      </div>)}
      <p>{workflow.comparison.mode === 'aligned' && options.source === 'both' ? `Aligned at P${workflow.comparison.anchorPosition}, equal speed` : 'Independent source timing'}</p>
      <p>{plan.error ?? `${plan.width}×${plan.height} • ${plan.expectedDuration.toFixed(3)}s • ${pickRecordingType()?.ext ?? 'unsupported'} • Silent audio`}</p>
      {plan.panes?.map((p) => <p key={p.side}>{p.side}: {p.start.toFixed(3)}–{p.end.toFixed(3)}s, anchor {p.anchor.toFixed(3)}s</p>)}
      <button className="bg-purple-600 p-3 rounded" disabled={!!plan.error || busy} onClick={record}>Record clip</button>
    </fieldset>
    <div ref={previewRef} className="video-export-preview flex-1 min-w-0 space-y-3">
      {busy && <><p>Recording {Math.round(progress * 100)}%</p><button onClick={() => controller.current.abort()}>Cancel export</button></>}
      {error && <p role="alert" className="text-red-400">{error}</p>}
      {result ? <><video controls src={result.url} onLoadedMetadata={() => {
        if (window.matchMedia('(max-width: 1023px)').matches) previewRef.current?.scrollIntoView({ block: 'start' });
      }} className="max-h-[60vh] w-full" /><p>{result.width}×{result.height} • {result.duration.toFixed(3)}s • {result.mimeType} • Silent audio</p><button onClick={download}>Save / Download</button>{result.path && <p>{result.path}</p>}</> : <><canvas ref={canvas} className="max-h-[60vh] w-full object-contain" /><label>Recipe preview <input aria-label="Export preview time" type="range" min="0" max={plan.expectedDuration ?? 1} step=".033333" value={previewTime} onChange={(e) => setPreviewTime(Number(e.target.value))} /></label><p>Preview the resolved recipe. Repetitions are encoded into the file.</p></>}
    </div>
  </div>;
}
