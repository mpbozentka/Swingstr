import React, { useEffect, useRef, useState } from 'react';
import { ChartLine, ChevronDown, ChevronUp } from 'lucide-react';
import { GRAPH_METRICS, computeMetricValue } from '../utils/swingAngles';
import { sampleFrameAtTime } from '../constants/pose';
import { KEY_MARKER_INDICES } from '../constants/markers';

// sky-600 / purple-600 — pair validated for CVD separation and contrast on
// the dark surface (dataviz skill's validate_palette.js); the brighter
// sky-400 skeleton accent fails its lightness band for chart marks.
const TRACE_COLORS = { left: '#0284c7', right: '#9333ea' };
const GRID_COLOR = '#1f2937'; // gray-800 — one step off the gray-900 surface
const TICK_COLOR = '#6b7280'; // gray-500 — axis text stays a text token, never a series color
const PLAYHEAD_COLOR = '#e5e7eb';
// rose-400 for the key checkpoints (P1/P4/P7) — distinct hue from the
// sky/purple traces, the amber sync accent, and the emerald trim accent.
const KEY_MARKER_COLOR = '#fb7185';
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
 * One SVG chart: traces for `sides`, grid, trim shading, marker lines,
 * playhead, click/drag seek. `dual` = the linked overlay (each trace
 * normalized to 0–100% of its own trim); otherwise the X axis spans the full
 * video, mirroring the timeline slider. Extracted from the panel body so
 * Independent split mode can render two of these side by side.
 */
function GraphChart({
  sides,
  dual,
  metric,
  poseState,
  handedness,
  trims,
  markers,
  activeScreen,
  globalTime,
  globalDuration,
  onSeek,
}) {
  const [width, setWidth] = useState(0);
  const wrapRef = useRef(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  // Marker lines: a single-side chart annotates its own side; the linked
  // overlay annotates only the active pane's markers (same rule as the
  // playhead) — both sides' sets on one shared chart would be unreadable.
  const markerSeries = dual
    ? series.find((s) => s.side === activeScreen) ?? null
    : series[0] ?? null;
  const markerLines = markerSeries ? (markers?.[markerSeries.side] ?? []) : [];

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

  return (
    <div ref={wrapRef}>
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
          {markerLines.map((m) => {
            const frac = fracOfT(markerSeries, m.time);
            // In dual mode a marker outside the trim maps past 0..1 — skip it
            // rather than clamp, or it would pile up misleadingly at the edge.
            if (frac < 0 || frac > 1) return null;
            const x = xOfFrac(frac);
            const isKey = KEY_MARKER_INDICES.has(m.index);
            // Key checkpoints (P1/P4/P7) overshoot the plot box a few px so
            // they read as distinct even right next to a plain tick.
            return (
              <line
                key={m.id}
                x1={x} x2={x}
                y1={isKey ? MARGIN.top - 4 : MARGIN.top}
                y2={isKey ? MARGIN.top + plotH + 4 : MARGIN.top + plotH}
                stroke={isKey ? KEY_MARKER_COLOR : TICK_COLOR}
                strokeWidth={isKey ? 2 : 1}
              />
            );
          })}
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
  );
}

/**
 * One column of Independent split mode: its own metric pills, its own live
 * readout (active pane only), its own full-duration chart — sits directly
 * under its video pane.
 */
function GraphColumn({
  side,
  metricKey,
  onMetricChange,
  poseState,
  viewTypes,
  handedness,
  trims,
  markers,
  activeScreen,
  globalTime,
  globalDuration,
  onSeek,
}) {
  const metrics = GRAPH_METRICS[viewTypes[side]] ?? [];
  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0];
  if (!metric) return <div className="flex-1 min-w-0" />;

  const isActive = side === activeScreen;
  let liveValue = null;
  if (isActive) {
    const { frames, videoWidth, videoHeight } = poseState[side];
    const liveFrame = sampleFrameAtTime(frames, globalTime);
    liveValue = liveFrame
      ? computeMetricValue(liveFrame, metric.key, { handedness: handedness[side], videoWidth, videoHeight })
      : null;
  }
  const activePill = side === 'left'
    ? 'bg-sky-600/30 text-sky-400 border-sky-600/50'
    : 'bg-purple-600/30 text-purple-400 border-purple-600/50';

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 pb-1 flex-wrap">
        {metrics.map((m) => (
          <button
            key={m.key}
            onClick={() => onMetricChange(m.key)}
            className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors border ${
              m.key === metric.key
                ? activePill
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border-gray-700'
            }`}
          >
            {m.label}
          </button>
        ))}
        <div className="flex-1" />
        {isActive && (
          <span
            className="flex items-center gap-1.5 font-mono text-[11px] text-gray-300"
            title={`${metric.label} at the playhead`}
          >
            <span
              className={`inline-block w-3 h-0.5 rounded ${side === 'left' ? 'bg-sky-600' : 'bg-purple-600'}`}
              aria-hidden="true"
            />
            {liveValue == null ? '—' : `${liveValue.toFixed(0)}°`}
          </span>
        )}
      </div>
      <GraphChart
        sides={[side]}
        dual={false}
        metric={metric}
        poseState={poseState}
        handedness={handedness}
        trims={trims}
        markers={markers}
        activeScreen={activeScreen}
        globalTime={globalTime}
        globalDuration={globalDuration}
        onSeek={onSeek}
      />
    </div>
  );
}

/**
 * Gears-style angle-over-time chart (plan section 7): collapsible panel
 * between the video panes and the footer, hand-rolled SVG. Single analyzed
 * pane (or single layout) → one full-duration chart for the active pane. In
 * split layout with both panes analyzed there are two modes: "Linked" (same
 * view type only) overlays both traces normalized to 0–100% of their own
 * trim; "Independent" gives each pane its own chart, metric picker, and
 * axis. Set markers draw as vertical lines, with P1/P4/P7 called out.
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
  markers,
  layout,
}) {
  const [open, setOpen] = useState(true);
  const [metricKey, setMetricKey] = useState(null); // shared picker (single / linked)
  const [metricKeys, setMetricKeys] = useState({ left: null, right: null }); // per-column pickers (independent)
  const [splitModePref, setSplitModePref] = useState('linked'); // linked is today's behavior — keep it the default

  const eligible = ['left', 'right'].filter((s) =>
    poseState[s].status === 'done' && (poseState[s].frames?.length ?? 0) >= 2 && viewTypes[s]);
  const bothEligible = layout === 'split' && eligible.length === 2;
  // Linked only makes sense when both panes share a view type — the metric
  // list is per-view-type, so a shared picker across two types has no menu.
  const canLink = bothEligible && viewTypes.left === viewTypes.right;
  const splitMode = canLink ? splitModePref : 'independent';
  const independent = bothEligible && splitMode === 'independent';
  const dual = bothEligible && splitMode === 'linked';

  const sides = dual
    ? eligible
    : eligible.includes(activeScreen) ? [activeScreen] : eligible.slice(0, 1);
  const viewType = sides.length ? viewTypes[sides[0]] : null;
  const metrics = GRAPH_METRICS[viewType] ?? [];
  // Falls back to the first metric (the view type's default) whenever the
  // stored key isn't valid for the current view type.
  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0];

  if (!independent && !metric) return null;

  // Live value of the graphed metric at the playhead — fills the header's
  // right side in single-trace mode (dual mode puts the legend there;
  // independent mode moves the readout into each column).
  let liveValue = null;
  const singleActive = !independent && !dual && sides[0] === activeScreen;
  if (singleActive) {
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
        {!independent && (
          <>
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
          </>
        )}
        <div className="flex-1" />
        {canLink && (
          <div
            className="flex items-center rounded-full border border-gray-700 overflow-hidden text-[11px] font-medium"
            role="group"
            aria-label="Split graph mode"
          >
            {[['independent', 'Independent'], ['linked', 'Linked']].map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setSplitModePref(mode)}
                aria-pressed={splitMode === mode}
                className={`px-2 py-0.5 transition-colors ${
                  splitMode === mode
                    ? 'bg-gray-700 text-gray-200'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {dual && (
          <div className="flex items-center gap-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 rounded bg-sky-600" aria-hidden="true" />L
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 rounded bg-purple-600" aria-hidden="true" />R
            </span>
            <span className="text-gray-500">time normalized 0–100% per swing</span>
          </div>
        )}
        {singleActive && (
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
        )}
      </div>

      {open && (
        independent ? (
          <div className="px-4 pb-2 flex gap-4">
            {['left', 'right'].map((side) => (
              <GraphColumn
                key={side}
                side={side}
                metricKey={metricKeys[side]}
                onMetricChange={(k) => setMetricKeys((prev) => ({ ...prev, [side]: k }))}
                poseState={poseState}
                viewTypes={viewTypes}
                handedness={handedness}
                trims={trims}
                markers={markers}
                activeScreen={activeScreen}
                globalTime={globalTime}
                globalDuration={globalDuration}
                onSeek={onSeek}
              />
            ))}
          </div>
        ) : (
          <div className="px-4 pb-2">
            <GraphChart
              sides={sides}
              dual={dual}
              metric={metric}
              poseState={poseState}
              handedness={handedness}
              trims={trims}
              markers={markers}
              activeScreen={activeScreen}
              globalTime={globalTime}
              globalDuration={globalDuration}
              onSeek={onSeek}
            />
          </div>
        )
      )}
    </div>
  );
}
