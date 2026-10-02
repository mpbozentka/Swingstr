import React, { useState } from 'react';
import { Activity, Volume2, X, Crosshair } from 'lucide-react';
import { assessTarget, measureHeadShift } from '../utils/practiceMetrics';

export default function PracticePanel({ open, analysis, busy, hasVideo, markers, onAnalyze, onCancel, onSetMarker, onJumpToMarker, onClose, showOverlay, onOverlayChange }) {
  const [view, setView] = useState('dtl');
  const [checkpoint, setCheckpoint] = useState(3);
  const [axis, setAxis] = useState('horizontal');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const measurement = measureHeadShift(analysis, markers, checkpoint, axis);
  const result = assessTarget(measurement, min, max, checkpoint, axis);
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const mark = (index) => markers.find((m) => m.index === index);
  const inputClass = 'w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:border-sky-400 outline-none';
  const setPosition = (index) => {
    if (busy) return;
    onSetMarker(index);
  };

  return (
    <aside aria-label="Practice focus" className={`${open ? '' : 'hidden'} w-80 shrink-0 border-l border-gray-800 bg-gray-950 text-gray-200 overflow-y-auto p-4 space-y-5`} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-sky-400">Practice focus</p>
          <h2 className="font-semibold text-lg text-white mt-1">Head position</h2>
        </div>
        <button onClick={onClose} disabled={busy} aria-label="Close practice focus" className="p-2 rounded-lg hover:bg-gray-800 disabled:opacity-40"><X size={18} /></button>
      </div>
      <p className="text-xs text-gray-400 leading-relaxed">Upload a swing, confirm two positions, and compare visible head movement with your practice target.</p>
      <label className="block text-xs text-gray-400">Camera view
        <select value={view} onChange={(e) => setView(e.target.value)} className={`${inputClass} mt-2`}>
          <option value="dtl">Down the line</option><option value="face-on">Face on</option>
        </select>
      </label>
      <p className="text-xs text-gray-500">Keep the camera fixed at hand height. {view === 'dtl' ? 'Align it through the hands toward the target.' : 'Face the golfer squarely.'} Include the whole body.</p>
      <button onClick={onAnalyze} disabled={!hasVideo || busy} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-sky-500 text-gray-950 font-semibold text-sm hover:bg-sky-400 disabled:opacity-40">
        <Activity size={16} />{analysis.status === 'done' ? 'Analyze again' : 'Analyze clip'}
      </button>
      {analysis.status === 'analyzing' && (
        <div role="status" className="space-y-2">
          <div className="flex justify-between text-xs"><span>Tracking body movement</span><span>{Math.round(analysis.progress * 100)}%</span></div>
          <progress value={analysis.progress} max="1" className="w-full h-2 accent-sky-400" />
          <button onClick={onCancel} className="text-xs text-gray-400 underline">Cancel analysis</button>
        </div>
      )}
      {busy && analysis.status !== 'analyzing' && <p className="text-xs text-gray-400">The other video is being analyzed.</p>}
      {analysis.error && <p role="alert" className="text-sm text-amber-300">{analysis.error}</p>}
      {analysis.status === 'done' && (
        <div className="space-y-2">
          <label className="flex gap-2 text-xs"><input type="checkbox" checked={showOverlay} onChange={(e) => onOverlayChange(e.target.checked)} />Show body overlay</label>
          <p className="text-xs text-gray-500">The white ring marks the estimated head center.</p>
        </div>
      )}
      <div className="border-t border-gray-800 pt-4 space-y-3">
        <label className="block text-xs text-gray-400">Compare P1 with
          <select value={checkpoint} onChange={(e) => setCheckpoint(Number(e.target.value))} className={`${inputClass} mt-2`}>
            {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => <option key={p} value={p - 1}>P{p}{p === 4 ? ' · Top of backswing' : p === 7 ? ' · Impact' : ''}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[0, checkpoint].map((index) => <button key={index} onClick={() => setPosition(index)} disabled={!hasVideo || busy} className="rounded-lg border border-gray-700 px-2 py-2 text-xs hover:bg-gray-800 disabled:opacity-40"><Crosshair size={12} className="inline mr-1" />Set P{index + 1} here{mark(index) && <span className="block text-sky-400 mt-1">{mark(index).time.toFixed(2)}s</span>}</button>)}
        </div>
        <p className="text-xs text-gray-500">Scrub to address and set P1. Then scrub to the selected position and set its marker.</p>
        <label className="block text-xs text-gray-400">Movement to monitor
          <select value={axis} onChange={(e) => setAxis(e.target.value)} className={`${inputClass} mt-2`}><option value="horizontal">Screen left / right</option><option value="vertical">Up / down</option></select>
        </label>
      </div>
      <div className="border-t border-gray-800 pt-4 space-y-3">
        <p className="text-xs text-gray-400">Your target · % of torso length at P1</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-gray-500">Lower<input type="number" step="0.1" value={min} onChange={(e) => setMin(e.target.value)} placeholder="Set limit" className={`${inputClass} mt-1`} /></label>
          <label className="text-xs text-gray-500">Upper<input type="number" step="0.1" value={max} onChange={(e) => setMax(e.target.value)} placeholder="Set limit" className={`${inputClass} mt-1`} /></label>
        </div>
        <p className="text-xs text-gray-500">Negative means {axis === 'horizontal' ? 'screen left' : 'down'}; positive means {axis === 'horizontal' ? 'screen right' : 'up'}. Choose the range for this golfer.</p>
        <div role="status" className={`rounded-xl border p-3 ${result.error ? 'border-gray-700 bg-gray-900' : result.inZone ? 'border-emerald-600/50 bg-emerald-950/40' : 'border-amber-600/50 bg-amber-950/40'}`}>
          {measurement.value != null && <p className="text-2xl font-semibold text-white mb-2">{measurement.value > 0 ? '+' : ''}{measurement.value.toFixed(1)}%</p>}
          <p className={`text-sm leading-relaxed ${result.error ? 'text-gray-400' : result.inZone ? 'text-emerald-300' : 'text-amber-300'}`}>{result.error || result.text}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onJumpToMarker(checkpoint)} disabled={!mark(checkpoint) || busy} className="flex-1 rounded-lg border border-gray-700 px-2 py-2 text-xs hover:bg-gray-800 disabled:opacity-40">Review P{checkpoint + 1}</button>
          <button onClick={() => {
            window.speechSynthesis.cancel();
            const speech = new SpeechSynthesisUtterance(result.text);
            speech.rate = 1;
            window.speechSynthesis.speak(speech);
          }} disabled={!!result.error || !canSpeak || busy} className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-gray-700 px-2 py-2 text-xs hover:bg-gray-800 disabled:opacity-40"><Volume2 size={14} />Hear feedback</button>
        </div>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">A 2D head estimate from this camera view. Check the overlay before using the result. Analysis stays on this device. Targets and results are session-only in this first version.</p>
    </aside>
  );
}
