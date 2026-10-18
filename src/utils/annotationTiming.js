// Source seconds, never output seconds. Frame mode requires decoded mediaTime.
export function resolveSegment(selection, markers, duration) {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Video duration is unavailable.');
  if (!selection) return { start: 0, end: duration };
  const { paddingBefore = 0, paddingAfter = 0 } = selection;
  if (![paddingBefore, paddingAfter].every((n) => Number.isFinite(n) && n >= 0 && n <= 2)) throw new Error('Padding must be 0–2 seconds.');
  let { start, end } = selection;
  if (selection.kind === 'positions') {
    if (![selection.from, selection.to].every((n) => Number.isInteger(n) && n >= 0 && n <= 9)) throw new Error('Choose P positions 1–10.');
    start = markers.find((m) => m.index === selection.from)?.time;
    end = markers.find((m) => m.index === selection.to)?.time;
    if (start == null || end == null) throw new Error(`Mark P${selection.from + 1} and P${selection.to + 1} to resolve this selection.`);
  } else if (selection.kind !== 'times') throw new Error('Unknown selection kind.');
  if (![start, end].every(Number.isFinite) || start < 0 || end > duration || start >= end) throw new Error('Selection requires 0 <= start < end <= source duration.');
  return { start: Math.max(0, start - paddingBefore), end: Math.min(duration, end + paddingAfter) };
}

export function annotationVisible(shape, { time, frame, markers = [] }) {
  const sampleTime = Number.isFinite(frame?.mediaTime) ? frame.mediaTime : time;
  const scope = shape.visibility ?? { kind: 'all' };
  if (scope.kind === 'all') return true;
  if (scope.kind === 'frame') return Number.isFinite(frame?.mediaTime) && Math.abs(frame.mediaTime - scope.mediaTime) < 0.00001;
  if (scope.kind === 'range') return sampleTime >= scope.start && sampleTime < scope.end;
  if (scope.kind === 'positions') {
    const start = markers.find((m) => m.index === scope.from)?.time;
    const end = markers.find((m) => m.index === scope.to)?.time;
    // Include the decoded checkpoint frame; literal time ranges remain half-open.
    return start != null && end != null && end >= start && sampleTime >= start && (sampleTime < end || (Number.isFinite(frame?.mediaTime) && frame.mediaTime <= end));
  }
  return false;
}

export function validateVisibility(scope, duration, frameSupported) {
  if (!scope || scope.kind === 'all') return;
  if (scope.kind === 'frame') {
    if (!frameSupported) throw new Error('Decoded frame mode unsupported. Choose a time range.');
    if (!Number.isFinite(scope.mediaTime) || scope.mediaTime < 0 || scope.mediaTime > duration) throw new Error('Frame timestamp must be inside the source.');
  } else if (scope.kind === 'range') {
    if (![scope.start, scope.end].every(Number.isFinite) || scope.start < 0 || scope.start >= scope.end || scope.end > duration) throw new Error('Drawing range requires 0 <= start < end <= source duration.');
  } else if (scope.kind === 'positions') {
    if (![scope.from, scope.to].every((n) => Number.isInteger(n) && n >= 0 && n <= 9)) throw new Error('Choose P positions 1–10.');
  } else throw new Error('Unknown drawing scope.');
}
