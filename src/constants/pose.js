/**
 * BlazePose landmark indices used for the body-only skeleton overlay. Face
 * (0-10) and hand/finger (17-22) points are tracked by MediaPipe but never
 * drawn or used.
 */
export const LANDMARK = Object.freeze({
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
});

/** Pairs of landmark indices to draw as skeleton line segments. */
export const POSE_CONNECTIONS = Object.freeze([
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // shoulders + arms
  [11, 23], [12, 24], [23, 24],                     // torso
  [23, 25], [25, 27], [24, 26], [26, 28],           // legs
  [27, 29], [29, 31], [27, 31], [28, 30], [30, 32], [28, 32], // feet
]);

/** Indices actually drawn as points — face (0-10) and hand (17-22) excluded. */
export const POSE_POINT_INDICES = Object.freeze(Object.values(LANDMARK));

export const VISIBILITY_THRESHOLD = 0.5;
export const SKELETON_COLOR = '#38bdf8'; // sky-400 — pose-feature accent

/**
 * The skeleton is drawn in the colour of the engine that produced it, so you
 * can tell at a glance which model you're looking at — the whole point of
 * having two. Falls back to the MediaPipe colour for frames cached before
 * engine stamping existed.
 */
export const SKELETON_ENGINE_COLORS = Object.freeze({
  mediapipe: SKELETON_COLOR, // sky
  rtmpose: '#fbbf24',        // amber-400
});

export function skeletonColorFor(engine) {
  return SKELETON_ENGINE_COLORS[engine] ?? SKELETON_COLOR;
}

/** Same two colours as Tailwind classes + plain names, for the rail button. */
export const SKELETON_ENGINE_UI = Object.freeze({
  mediapipe: { dotClassName: 'bg-sky-400', colorName: 'blue' },
  rtmpose: { dotClassName: 'bg-amber-400', colorName: 'amber' },
});
export const SKELETON_LINE_WIDTH = 2;
export const SKELETON_POINT_RADIUS = 3;

/** Midpoint of two landmarks, used to derive the shoulder/hip "spine" points. */
export function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    visibility: Math.min(a.visibility, b.visibility),
  };
}

function lerpLandmarks(a, b, f) {
  return a.map((la, i) => {
    const lb = b[i];
    return {
      x: la.x + (lb.x - la.x) * f,
      y: la.y + (lb.y - la.y) * f,
      z: la.z + (lb.z - la.z) * f,
      visibility: Math.min(la.visibility ?? 1, lb.visibility ?? 1),
    };
  });
}

/**
 * Interpolated cache lookup: binary-search the two cached frames bracketing
 * `time` and lerp between them. Snapping to the frame with `t <= time`
 * (the old behavior) left the skeleton up to one sample step (~33ms)
 * behind the video — always behind, never ahead. `frames` must be sorted
 * ascending by `t` — the analysis pass guarantees this since it steps
 * forward through the trim range. Returns null if frames is empty or time
 * is before the first frame.
 */
export function sampleFrameAtTime(frames, time) {
  if (!frames || frames.length === 0) return null;
  if (time < frames[0].t) return null;
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (frames[mid].t <= time) lo = mid;
    else hi = mid - 1;
  }
  const a = frames[lo];
  const b = frames[lo + 1];
  if (!b || !a.landmarks || !b.landmarks) return a;
  const span = b.t - a.t;
  if (span <= 0) return a;
  const f = Math.min(1, (time - a.t) / span);
  return {
    t: time,
    landmarks: lerpLandmarks(a.landmarks, b.landmarks, f),
    world: a.world && b.world ? lerpLandmarks(a.world, b.world, f) : a.world,
  };
}
