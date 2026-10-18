import { resolveSegment } from './annotationTiming.js';
export const PRESETS = { portrait: [1080, 1920], square: [1080, 1080], landscape: [1920, 1080] };
const bounded = (n, max, label) => { if (!Number.isFinite(n) || n < 0 || n > max) throw new Error(`${label} must be 0–${max}.`); return n; };
export function resolveExportPlan(options, sources, comparison = { mode: 'independent' }) {
  const { source = 'left', preset = 'portrait', speed = 1, repeats = 1, annotations = 'clean', holds = {}, title = '', paneLabels = {}, framing = {} } = options;
  if (!['left', 'right', 'both'].includes(source) || !PRESETS[preset] || ![1, 0.5, 0.25].includes(speed) || ![1, 3, 5].includes(repeats) || !['clean', 'annotated'].includes(annotations)) throw new Error('Invalid export recipe.');
  const sides = source === 'both' ? ['left', 'right'] : [source];
  const panes = sides.map((side) => {
    const s = sources[side];
    if (!s?.ready) throw new Error(`Load a ready ${side} source.`);
    const range = resolveSegment(s.selection, s.markers, s.duration);
    const anchor = source === 'both' && comparison.mode === 'aligned' ? s.markers.find((m) => m.index === comparison.anchorPosition - 1)?.time : range.start;
    if (!Number.isFinite(anchor) || anchor < range.start || anchor > range.end) throw new Error(`${side}: alignment checkpoint must be marked inside the selection.`);
    const crop = framing[side]?.crop ?? { x: 0, y: 0, w: 1, h: 1 };
    if (![crop.x, crop.y, crop.w, crop.h].every(Number.isFinite) || crop.x < 0 || crop.y < 0 || crop.w <= 0 || crop.h <= 0 || crop.x + crop.w > 1 || crop.y + crop.h > 1) throw new Error('Crop must be a positive rectangle inside the source.');
    const fit = framing[side]?.fit ?? 'contain';
    if (!['contain', 'crop'].includes(fit)) throw new Error('Fit must be contain or crop.');
    return { ...s, side, ...range, anchor, framing: { fit, crop } };
  });
  const start = Math.min(...panes.map((p) => p.start - p.anchor));
  const end = Math.max(...panes.map((p) => p.end - p.anchor));
  const events = [{ at: start, seconds: bounded(holds.startSeconds ?? 0, 3, 'Start hold') }, { at: end, seconds: bounded(holds.endSeconds ?? 0, 3, 'End hold') }];
  if (holds.checkpoint) {
    const times = panes.map((p) => {
      const time = p.markers.find((m) => m.index === holds.checkpoint.position - 1)?.time;
      if (!Number.isFinite(time) || time < p.start || time > p.end) throw new Error('Hold checkpoint must exist inside every selection.');
      return time - p.anchor;
    });
    if (times.some((t) => Math.abs(t - times[0]) > 0.00001)) throw new Error('Checkpoint holds must coincide under the selected alignment.');
    events.push({ at: times[0], seconds: bounded(holds.checkpoint.seconds, 3, 'Checkpoint hold') });
  }
  events.sort((a, b) => a.at - b.at);
  const phases = [];
  let cursor = start;
  const combined = events.reduce((list, event) => {
    const last = list.at(-1);
    if (last && Math.abs(last.at - event.at) < 1e-9) last.seconds += event.seconds;
    else list.push({ ...event });
    return list;
  }, []);
  for (const event of combined) {
    if (event.at > cursor) phases.push({ kind: 'move', from: cursor, to: event.at, duration: (event.at - cursor) / speed });
    if (event.seconds) phases.push({ kind: 'hold', from: event.at, to: event.at, duration: event.seconds });
    cursor = event.at;
  }
  const passDuration = phases.reduce((n, p) => n + p.duration, 0);
  const [width, height] = PRESETS[preset];
  return { source, preset, speed, repeats, annotations, title, paneLabels, comparison, panes, phases, passDuration, expectedDuration: passDuration * repeats, width, height, silent: true };
}
export function mapExportTime(plan, outputTime) {
  let t = Math.min(Math.max(0, outputTime), plan.expectedDuration - 1e-8) % plan.passDuration;
  let phase = plan.phases.at(-1);
  for (const candidate of plan.phases) { phase = candidate; if (t < phase.duration) break; t -= phase.duration; }
  const relative = phase.kind === 'hold' ? phase.from : phase.from + t * plan.speed;
  return plan.panes.map((p) => ({ side: p.side, time: Math.max(p.start, Math.min(p.end, relative + p.anchor)), held: relative + p.anchor < p.start - 1e-7 || relative + p.anchor > p.end + 1e-7, freeze: phase.kind === 'hold' }));
}
