import React, { useEffect, useRef, useState } from 'react';
import { ChartLine, ChevronDown, ChevronUp } from 'lucide-react';
import { GRAPH_METRICS, computeMetricValue } from '../utils/swingAngles';
import { sampleFrameAtTime } from '../constants/pose';

// sky-600 / purple-600 — pair validated for CVD separation and contrast on
// the dark surface (dataviz skill's validate_palette.js); the brighter
// sky-400 skeleton accent fails its lightness band for chart marks.
const TRACE_COLORS = { left: '#0284c7', right: '#9333ea' };
const GRID_COLOR = '#1f2937'; // gray-800 — one step off the gray-900 surface
const TICK_COLOR = '#6b7280'; // gray-500 — axis text stays a text token, never a series color
const PLAYHEAD_COLOR = '#e5e7eb';
const TRIM_SHADE_OPACITY = 0.4; // matches the timeline slider's cut-region shading
const PLOT_HEIGHT = 120; // 160 in the original plan — shrunk after layout QA so landscape video keeps more height
const MARGIN = { top: 8, right: 10, bottom: 18, left: 38 };

function niceTicks(min, max) {
  let lo = min;
  let hi = max;
  if (hi - lo < 1) { lo -= 1; hi += 1; } // flat trace — give the axis some room
  const steps = [1, 2, 5, 10, 15, 20, 30, 45, 60, 90, 180];
  const step = steps.find((s) => (hi - lo) / s <= 4) ?? 180;
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);
  return { lo, hi, ticks };
}

// One <path> per trace with a pen-lift (M) at detection gaps — a <polyline>
// would draw a false segment straight across frames where the golfer wasn't
// detected.
function buildPath(points, xOfT, yOf) {
  let d = '';
  let pen = false;
  points.forEach((p) => {
    if (p.v == null) { pen = false; return; }
    d += `${pen ? 'L' : 'M'}${xOfT(p.t).toFixed(1)},${yOf(p.v).toFixed(1)}`;
    pen = true;
  });
  return d;
}

/**
 * Gears-style angle-over-time chart (plan section 7): collapsible panel
 * between the video panes and the footer, hand-rolled SVG, one metric at a
 * time. Single analyzed pane → X axis spans the FULL video with trimmed-out
 * regions shaded, mirroring the timeline slider below so the graph playhead
 * and the slider thumb move in lockstep (changed from trim-only after layout
 * QA). Both panes analyzed with the same view tag → both traces, each
 * normalized to 0–100% of its own trim so different-length swings align
 * (noted visibly in the header).
 */
export default function SwingGraphPanel({
  poseState,
  viewTypes,
  handedness,
  activeScreen,
  trims,
  globalTime,
  globalDuration,
  onSeek,
}) {
  const [open, setOpen] = useState(true);
  const [metricKey, setMetricKey] = useState(null);
  const [width, setWidth] = useState(0);
  const wrapRef = useRef(null);
  const draggingRef = useRef(false);

  const eligible = ['left', 'right'].filter((s) =>
    poseState[s].status === 'done' && (poseState[s].frames?.length ?? 0) >= 2 && viewTypes[s]);
  const dual = eligible.length === 2 && viewTypes.left === viewTypes.right;
  const sides = dual
    ? eligible
    : eligible.includes(activeScreen) ? [activeScreen] : eligible.slice(0, 1);
  const viewType = sides.length ? viewTypes[sides[0]] : null;
  const metrics = GRAPH_METRICS[viewType] ?? [];
  // Falls back to the first metric (the view type's default) whenever the
  // stored key isn't valid for the current view type.
  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0];

  const hasChart = open && !!metric;
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasChart]);

  if (!metric) return null;

  // Cheap enough to rebuild per render (≤ ~240 small trig calls) — not worth
  // memo bookkeeping.
  const series = sides.map((side) => {
    const { frames, videoWidth, videoHeight } = poseState[side];
    if (!videoWidth) return null;
    const ctx = { handedness: handedness[side], videoWidth, videoHeight };
    return {
      side,
      t0: frames[0].t,
      t1: frames[frames.length - 1].t,
      points: frames.map((f) => ({ t: f.t, v: computeMetricValue(f, metric.key, ctx) })),
    };
  }).filter(Boolean);

  const ys = [];
  series.forEach((s) => s.points.forEach((p) => { if (p.v != null) ys.push(p.v); }));
  const { lo, hi, ticks } = ys.length ? niceTicks(Math.min(...ys), Math.max(...ys)) : {};

  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotH = PLOT_HEIGHT - MARGIN.top - MARGIN.bottom;
  const yOf = (v) => MARGIN.top + ((hi - v) / (hi - lo || 1)) * plotH;
  const xOfFrac = (f) => MARGIN.left + f * plotW;
  const clamp01 = (f) => Math.max(0, Math.min(1, f));

  // Single-trace X axis spans the whole video, mirroring the timeline slider
  // below so the graph playhead and the slider thumb move in lockstep; the
  // un-analyzed (trimmed-out) regions get shaded like the timeline. Dual mode
  // keeps per-swing 0–100% normalization instead. The max() covers the
  // display-only case where the graphed side isn't the one driving
  // globalDuration.
  const dur = !dual && series.length ? Math.max(globalDuration || 0, series[0].t1) : 0;
  const fracOfT = (s, t) => (dual ? (t - s.t0) / (s.t1 - s.t0 || 1) : t / (dur || 1));

  const shadeRects = [];
  if (!dual && series.length && dur > 0) {
    const { start, end } = trims?.[series[0].side] ?? {};
    if (start > 0) shadeRects.push([0, start / dur]);
    if (end != null && end < dur) shadeRects.push([end / dur, 1]);
  }

  // Playhead + click/drag seeking key off the active pane — globalTime and
  // the clamped-seek flow both belong to it. If the graphed trace is the
  // inactive pane's, the chart is display-only until that pane is activated.
  const phSeries = series.find((s) => s.side === activeScreen) ?? null;
  const phFrac = phSeries ? clamp01(fracOfT(phSeries, globalTime)) : null;

  const seekFromEvent = (e) => {
    if (!phSeries || !onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = clamp01((e.clientX - rect.left - MARGIN.left) / (plotW || 1));
    onSeek(dual ? phSeries.t0 + frac * (phSeries.t1 - phSeries.t0) : frac * dur);
  };

  const xLabels = dual
    ? ['0%', '50%', '100%']
    : [0, dur / 2, dur].map((t) => `${t.toFixed(1)}s`);

  // Live value of the graphed metric at the playhead — fills the header's
  // right side in single-trace mode (dual mode puts the legend there).
  let liveValue = null;
  if (!dual && phSeries) {
    const { frames, videoWidth, videoHeight } = poseState[activeScreen];
    const liveFrame = sampleFrameAtTime(frames, globalTime);
    liveValue = liveFrame
      ? computeMetricValue(liveFrame, metric.key, { handedness: handedness[activeScreen], videoWidth, videoHeight })
      : null;
  }

  return (
    <div className="bg-gray-900 border-t border-gray-800 shrink-0 z-20">
      <div className="flex items-center gap-2 px-4 py-1.5">
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors"
          title={open ? 'Collapse angle graph' : 'Expand angle graph'}
        >
          <ChartLine size={14} className="text-sky-400" />
          Angle graph
          {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        <div className="w-px h-4 bg-gray-700" />
        {metrics.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetricKey(m.key)}
            className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors border ${
              m.key === metric.key
                ? 'bg-sky-600/30 text-sky-400 border-sky-600/50'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border-gray-700'
            }`}
          >
            {m.label}
          </button>
        ))}
        <div className="flex-1" />
        {dual ? (
          <div className="flex items-center gap-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 rounded bg-sky-600" aria-hidden="true" />L
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 rounded bg-purple-600" aria-hidden="true" />R
            </span>
            <span className="text-gray-500">time normalized 0–100% per swing</span>
          </div>
        ) : (
          phSeries && (
            <span
              className="flex items-center gap-1.5 font-mono text-[11px] text-gray-300"
              title={`${metric.label} at the playhead`}
            >
              <span
                className={`inline-block w-3 h-0.5 rounded ${activeScreen === 'left' ? 'bg-sky-600' : 'bg-purple-600'}`}
                aria-hidden="true"
              />
              {liveValue == null ? '—' : `${liveValue.toFixed(0)}°`}
            </span>
          )
        )}
      </div>

      {open && (
        <div ref={wrapRef} className="px-4 pb-2">
          {ys.length ? (
            <svg
              width={width}
              height={PLOT_HEIGHT}
              className={`block touch-none ${phSeries ? 'cursor-crosshair' : ''}`}
              onPointerDown={(e) => {
                if (!phSeries) return;
                draggingRef.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
                seekFromEvent(e);
              }}
              onPointerMove={(e) => { if (draggingRef.current) seekFromEvent(e); }}
              onPointerUp={() => { draggingRef.current = false; }}
              onPointerCancel={() => { draggingRef.current = false; }}
            >
              {ticks.map((v) => (
                <g key={v}>
                  <line
                    x1={MARGIN.left} x2={width - MARGIN.right}
                    y1={yOf(v)} y2={yOf(v)}
                    stroke={GRID_COLOR} strokeWidth="1"
                  />
                  <text
                    x={MARGIN.left - 6} y={yOf(v) + 3}
                    textAnchor="end" fontSize="10" fill={TICK_COLOR}
                    fontFamily="ui-monospace, monospace"
                  >
                    {v}°
                  </text>
                </g>
              ))}
              {shadeRects.map(([a, b], i) => (
                <rect
                  key={i}
                  x={xOfFrac(a)} y={MARGIN.top}
                  width={Math.max(0, xOfFrac(b) - xOfFrac(a))} height={plotH}
                  fill="#000" opacity={TRIM_SHADE_OPACITY}
                />
              ))}
              {xLabels.map((label, i) => (
                <text
                  key={label + i}
                  x={xOfFrac(i / 2)} y={PLOT_HEIGHT - 4}
                  textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}
                  fontSize="10" fill={TICK_COLOR}
                  fontFamily="ui-monospace, monospace"
                >
                  {label}
                </text>
              ))}
              {series.map((s) => (
                <path
                  key={s.side}
                  d={buildPath(s.points, (t) => xOfFrac(clamp01(fracOfT(s, t))), yOf)}
                  fill="none"
                  stroke={TRACE_COLORS[s.side]}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
              {phFrac != null && (
                <line
                  x1={xOfFrac(phFrac)} x2={xOfFrac(phFrac)}
                  y1={MARGIN.top} y2={MARGIN.top + plotH}
                  stroke={PLAYHEAD_COLOR} strokeWidth="1" opacity="0.7"
                />
              )}
            </svg>
          ) : (
            <div className="h-[120px] flex items-center justify-center text-xs text-gray-500">
              No pose data for this metric — the landmarks weren't visible enough.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
