import React, { useState } from 'react';
export default function SwingWorkflowControls({ workflow, activeScreen, leftRef, rightRef }) {
  const [kind, setKind] = useState('positions');
  const [from, setFrom] = useState(5), [to, setTo] = useState(8);
  const [before, setBefore] = useState(0), [after, setAfter] = useState(0);
  const [anchor, setAnchor] = useState(7), [position, setPosition] = useState(6);
  const [error, setError] = useState('');
  const act = (fn) => { setError(''); try { Promise.resolve(fn()).catch((e) => setError(e.message)); } catch (e) { setError(e.message); } };
  const bounds = workflow.resolved(activeScreen);
  const pane = (activeScreen === 'left' ? leftRef : rightRef).current;
  const input = 'bg-gray-800 rounded px-1 w-16';
  return <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 flex flex-wrap items-center gap-3 text-xs">
    <strong>{activeScreen} segment</strong>
    <select aria-label="Segment kind" className={input + ' w-28'} value={kind} onChange={(e) => { setKind(e.target.value); setFrom(e.target.value === 'times' ? 0 : 5); setTo(e.target.value === 'times' ? pane?.duration ?? 1 : 8); }}><option value="positions">P positions</option><option value="times">Source seconds</option></select>
    <label>From <input aria-label="Segment from" className={input} type="number" step={kind === 'times' ? '.01' : '1'} value={from} onChange={(e) => setFrom(Number(e.target.value))} /></label>
    <label>To <input aria-label="Segment to" className={input} type="number" step={kind === 'times' ? '.01' : '1'} value={to} onChange={(e) => setTo(Number(e.target.value))} /></label>
    <label>Pad before <input className={input} type="number" min="0" max="2" step=".1" value={before} onChange={(e) => setBefore(Number(e.target.value))} /></label>
    <label>After <input className={input} type="number" min="0" max="2" step=".1" value={after} onChange={(e) => setAfter(Number(e.target.value))} /></label>
    <button onClick={() => act(() => workflow.setSegment(activeScreen, { ...(kind === 'times' ? { kind, start: from, end: to } : { kind, from: from - 1, to: to - 1 }), paddingBefore: before, paddingAfter: after }))}>Apply</button>
    <button onClick={() => workflow.clearSegment(activeScreen)}>Clear selection</button>
    <span>{bounds.error ?? `${bounds.start?.toFixed(2)}–${bounds.end?.toFixed(2)}s`}</span>
    <label>Match P<input className={input} type="number" min="1" max="10" value={position} onChange={(e) => setPosition(Number(e.target.value))} /></label><button onClick={() => act(() => workflow.seekPosition(position, 'both'))}>Jump both</button>
    <label>Align P<input className={input} type="number" min="1" max="10" value={anchor} onChange={(e) => setAnchor(Number(e.target.value))} /></label>
    <button onClick={() => act(() => workflow.configureComparison({ mode: workflow.comparison.mode === 'aligned' ? 'independent' : 'aligned', anchorPosition: anchor }))}>{workflow.comparison.mode === 'aligned' ? 'Independent playback' : 'Align playback'}</button>
    {error && <span role="alert" className="text-red-400">{error}</span>}
  </div>;
}
