export const POSE_CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 29], [29, 31], [27, 31], [28, 30], [30, 32], [28, 32],
];

export function smoothPoseFrames(frames) {
  if (!frames) return frames;
  // Centered on the original frame, so smoothing doesn't trail fast motion.
  const weights = [0.4, 0.2, 0.1];
  return frames.map((frame, i) => {
    if (!frame.landmarks) return frame;
    return {
      ...frame,
      landmarks: frame.landmarks.map((point, landmark) => {
        if ((point.visibility ?? 0) < 0.65) return { ...point };
        const neighbors = [{ point, weight: weights[0] }];
        for (const direction of [-1, 1]) {
          for (let distance = 1; distance <= 2; distance++) {
            const next = frames[i + direction * distance];
            const previous = frames[i + direction * (distance - 1)];
            const candidate = next?.landmarks?.[landmark];
            if (!candidate || (candidate.visibility ?? 0) < 0.65 || Math.abs(next.t - previous.t) > 0.12) break;
            neighbors.push({ point: candidate, weight: weights[distance] });
          }
        }
        const total = neighbors.reduce((sum, neighbor) => sum + neighbor.weight, 0);
        const smoothed = { ...point };
        for (const axis of ['x', 'y', 'z']) {
          if (point[axis] == null) continue;
          smoothed[axis] = neighbors.reduce((sum, neighbor) => sum + neighbor.point[axis] * neighbor.weight, 0) / total;
        }
        // Keep the actual frame confidence; smoothing cannot validate a point.
        return smoothed;
      }),
    };
  });
}

export function samplePose(frames, time) {
  if (!frames?.length || time < frames[0].t || time > frames[frames.length - 1].t) return null;
  let low = 0, high = frames.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (frames[mid].t <= time) low = mid;
    else high = mid - 1;
  }
  const a = frames[low], b = frames[low + 1];
  if (!a.landmarks) return null;
  if (!b || time === a.t) return a.landmarks;
  if (!b.landmarks || b.t - a.t > 0.12) return null;
  const weight = (time - a.t) / (b.t - a.t);
  return a.landmarks.map((point, i) => ({
    x: point.x + (b.landmarks[i].x - point.x) * weight,
    y: point.y + (b.landmarks[i].y - point.y) * weight,
    visibility: Math.min(point.visibility ?? 0, b.landmarks[i].visibility ?? 0),
  }));
}

function visible(points, indices) {
  return indices.every((i) => points?.[i] && (points[i].visibility ?? 0) >= 0.65);
}

export function measureHeadShift(analysis, markers, checkpoint, axis) {
  const address = markers.find((m) => m.index === 0);
  const target = markers.find((m) => m.index === checkpoint);
  if (!address || !target) return { error: `Set P1 and P${checkpoint + 1} on this video.` };
  if (target.time <= address.time) return { error: 'The selected checkpoint must be after P1.' };
  if (!analysis?.frames) return { error: 'Analyze the clip to measure head position.' };
  const a = samplePose(analysis.frames, address.time);
  const b = samplePose(analysis.frames, target.time);
  if (!visible(a, [7, 8, 11, 12, 23, 24]) || !visible(b, [7, 8])) {
    return { error: 'Head position is unclear at these markers. Check the overlay or choose a clearer clip.' };
  }
  const mid = (points, left, right) => ({
    x: (points[left].x + points[right].x) * analysis.width / 2,
    y: (points[left].y + points[right].y) * analysis.height / 2,
  });
  const shoulders = mid(a, 11, 12), hips = mid(a, 23, 24);
  const torso = Math.hypot(shoulders.x - hips.x, shoulders.y - hips.y);
  if (torso < 10) return { error: 'The golfer is too small in this frame to measure.' };
  const headA = mid(a, 7, 8), headB = mid(b, 7, 8);
  const value = (axis === 'horizontal' ? headB.x - headA.x : headA.y - headB.y) / torso * 100;
  return { value, time: target.time, addressHead: headA, torso };
}

export function assessTarget(measurement, min, max, checkpoint, axis) {
  if (measurement.error) return measurement;
  if (min === '' || max === '' || !Number.isFinite(Number(min)) || !Number.isFinite(Number(max))) {
    return { error: 'Set both ends of your practice target to get feedback.' };
  }
  if (Number(min) > Number(max)) return { error: 'The lower target must be at or below the upper target.' };
  const value = measurement.value;
  const inZone = value >= Number(min) && value <= Number(max);
  const direction = axis === 'horizontal' ? (value < 0 ? 'screen left' : 'screen right') : (value < 0 ? 'down' : 'up');
  const movement = Math.abs(value).toFixed(1);
  return {
    ...measurement, inZone,
    text: `Head at P${checkpoint + 1}: ${movement}% ${direction} from P1. ${inZone ? 'Within your target.' : 'Outside your target.'}`,
  };
}

export function drawPose(ctx, points, rect, zoom) {
  if (!points) return;
  const isVisible = (i) => (points[i]?.visibility ?? 0) >= 0.65;
  const opacity = (...indices) => Math.min(1, (Math.min(...indices.map((i) => points[i].visibility)) - 0.65) / 0.2);
  const xy = (i) => [rect.x + points[i].x * rect.w, rect.y + points[i].y * rect.h];
  ctx.save();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2 / zoom;
  for (const [a, b] of POSE_CONNECTIONS) {
    if (!isVisible(a) || !isVisible(b)) continue;
    ctx.globalAlpha = opacity(a, b);
    ctx.beginPath(); ctx.moveTo(...xy(a)); ctx.lineTo(...xy(b)); ctx.stroke();
  }
  ctx.fillStyle = 'white';
  for (const i of new Set(POSE_CONNECTIONS.flat())) {
    if (!isVisible(i)) continue;
    ctx.globalAlpha = opacity(i);
    ctx.beginPath(); ctx.arc(...xy(i), 3 / zoom, 0, Math.PI * 2); ctx.fill();
  }
  if (isVisible(7) && isVisible(8)) {
    ctx.globalAlpha = opacity(7, 8);
    const a = xy(7), b = xy(8);
    ctx.strokeStyle = 'white';
    ctx.beginPath();
    ctx.arc((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 7 / zoom, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
