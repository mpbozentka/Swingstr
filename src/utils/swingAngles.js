import { LANDMARK } from '../constants/pose';

const VISIBILITY_THRESHOLD = 0.5;

const deg = (r) => (r * 180) / Math.PI;

// angle of segment a->b measured from vertical (0deg = straight up)
function tiltFromVertical(a, b) {
  return deg(Math.atan2(b.x - a.x, -(b.y - a.y)));
}

// interior angle at joint b formed by a-b-c
function jointAngle(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  return deg(Math.acos(
    (v1.x * v2.x + v1.y * v2.y) /
    (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1)
  ));
}

function visible(lm) {
  return !!lm && (lm.visibility ?? 1) >= VISIBILITY_THRESHOLD;
}

// Normalized [0,1] coords are anisotropic — scale by video pixel dims before
// any angle math, or a 45deg spine reads as ~56deg on a 9:16 video (plan 9.9).
function px(lm, videoWidth, videoHeight) {
  return { x: lm.x * videoWidth, y: lm.y * videoHeight, z: lm.z, visibility: lm.visibility };
}

function midX(a, b, videoWidth) {
  return (a.x * videoWidth + b.x * videoWidth) / 2;
}

/**
 * Graphable metrics per view type (plan section 7). Order matters: the first
 * entry is the default trace (spine for DTL, shoulder tilt for face-on).
 * Head sway is excluded — it's a % of frame width and the graph's Y axis is
 * degrees only.
 */
export const GRAPH_METRICS = Object.freeze({
  dtl: [
    { key: 'spine', label: 'Spine' },
    { key: 'kneeFlexL', label: 'Knee L' },
    { key: 'kneeFlexR', label: 'Knee R' },
    { key: 'shoulderTurn', label: 'Sh. turn (est.)' },
    { key: 'hipTurn', label: 'Hip turn (est.)' },
  ],
  'face-on': [
    { key: 'shoulderTilt', label: 'Shoulder tilt' },
    { key: 'hipLine', label: 'Hip line' },
    { key: 'leadArm', label: 'Lead arm' },
    { key: 'shoulderTurn', label: 'Sh. turn (est.)' },
    { key: 'hipTurn', label: 'Hip turn (est.)' },
  ],
});

/**
 * Numeric value (degrees) of one metric for one cached frame, or null when
 * any input landmark is below the visibility threshold. Single source of
 * truth for the angle formulas — the readout card formats these values, the
 * graph panel plots them.
 */
export function computeMetricValue(frame, key, { handedness, videoWidth, videoHeight }) {
  const lm = frame?.landmarks;
  if (!lm || !videoWidth || !videoHeight) return null;
  const P = (i) => px(lm[i], videoWidth, videoHeight);

  switch (key) {
    case 'spine': {
      const ok = visible(lm[LANDMARK.LEFT_SHOULDER]) && visible(lm[LANDMARK.RIGHT_SHOULDER])
        && visible(lm[LANDMARK.LEFT_HIP]) && visible(lm[LANDMARK.RIGHT_HIP]);
      if (!ok) return null;
      const shoulderMid = {
        x: midX(lm[LANDMARK.LEFT_SHOULDER], lm[LANDMARK.RIGHT_SHOULDER], videoWidth),
        y: (lm[LANDMARK.LEFT_SHOULDER].y + lm[LANDMARK.RIGHT_SHOULDER].y) / 2 * videoHeight,
      };
      const hipMid = {
        x: midX(lm[LANDMARK.LEFT_HIP], lm[LANDMARK.RIGHT_HIP], videoWidth),
        y: (lm[LANDMARK.LEFT_HIP].y + lm[LANDMARK.RIGHT_HIP].y) / 2 * videoHeight,
      };
      return tiltFromVertical(hipMid, shoulderMid);
    }

    case 'kneeFlexL':
    case 'kneeFlexR': {
      const side = key === 'kneeFlexL' ? 'LEFT' : 'RIGHT';
      const h = LANDMARK[`${side}_HIP`];
      const k = LANDMARK[`${side}_KNEE`];
      const a = LANDMARK[`${side}_ANKLE`];
      if (!(visible(lm[h]) && visible(lm[k]) && visible(lm[a]))) return null;
      return 180 - jointAngle(P(h), P(k), P(a));
    }

    case 'shoulderTilt':
    case 'hipLine': {
      const [ri, li] = key === 'shoulderTilt'
        ? [LANDMARK.RIGHT_SHOULDER, LANDMARK.LEFT_SHOULDER]
        : [LANDMARK.RIGHT_HIP, LANDMARK.LEFT_HIP];
      if (!(visible(lm[ri]) && visible(lm[li]))) return null;
      const a = P(ri);
      const b = P(li);
      return deg(Math.atan2(b.y - a.y, b.x - a.x));
    }

    case 'leadArm': {
      const leadSide = handedness === 'LH' ? 'RIGHT' : 'LEFT';
      const s = LANDMARK[`${leadSide}_SHOULDER`];
      const e = LANDMARK[`${leadSide}_ELBOW`];
      const w = LANDMARK[`${leadSide}_WRIST`];
      if (!(visible(lm[s]) && visible(lm[e]) && visible(lm[w]))) return null;
      return jointAngle(P(s), P(e), P(w));
    }

    // Rotation estimates from world landmarks (meters, hip-centered) —
    // always labeled "est." in the UI since this isn't mocap-grade.
    case 'shoulderTurn':
    case 'hipTurn': {
      const world = frame.world;
      const [li, ri] = key === 'shoulderTurn'
        ? [LANDMARK.LEFT_SHOULDER, LANDMARK.RIGHT_SHOULDER]
        : [LANDMARK.LEFT_HIP, LANDMARK.RIGHT_HIP];
      if (!world || !(visible(lm[li]) && visible(lm[ri]))) return null;
      return deg(Math.atan2(world[ri].z - world[li].z, world[ri].x - world[li].x));
    }

    default:
      return null;
  }
}

/**
 * Builds the readout rows for one cached pose frame. Rows are ordered
 * view-specific-first, rotation-estimates-last, and the caller should slice
 * to 5 (plan 6.3's row cap) — face-on naturally produces 6 candidates, so the
 * lowest-priority row (hip turn) is the one that gets dropped by that slice.
 * Any metric whose input landmark is below the visibility threshold renders
 * "—" instead of a number.
 */
export function computeSwingAngles({ frame, addressFrame, viewType, handedness, videoWidth, videoHeight }) {
  if (!frame?.landmarks || !viewType || !videoWidth || !videoHeight) return [];
  const ctx = { handedness, videoWidth, videoHeight };
  const fmt = (v) => (v == null ? '—' : `${v.toFixed(0)}°`);
  const rows = [];

  if (viewType === 'dtl') {
    rows.push({ label: 'Spine', value: fmt(computeMetricValue(frame, 'spine', ctx)) });
    rows.push({ label: 'Knee flex L', value: fmt(computeMetricValue(frame, 'kneeFlexL', ctx)) });
    rows.push({ label: 'Knee flex R', value: fmt(computeMetricValue(frame, 'kneeFlexR', ctx)) });
  }

  if (viewType === 'face-on') {
    rows.push({ label: 'Shoulder tilt', value: fmt(computeMetricValue(frame, 'shoulderTilt', ctx)) });
    rows.push({ label: 'Hip line', value: fmt(computeMetricValue(frame, 'hipLine', ctx)) });
    rows.push({ label: 'Lead arm', value: fmt(computeMetricValue(frame, 'leadArm', ctx)) });

    // Head sway — % of frame width relative to address, not a degree metric,
    // so it stays here rather than in computeMetricValue/the graph.
    const lm = frame.landmarks;
    const addrLm = addressFrame?.landmarks;
    const currOk = visible(lm[LANDMARK.LEFT_SHOULDER]) && visible(lm[LANDMARK.RIGHT_SHOULDER]);
    const addrOk = addrLm && visible(addrLm[LANDMARK.LEFT_SHOULDER]) && visible(addrLm[LANDMARK.RIGHT_SHOULDER]);
    if (currOk && addrOk) {
      const currX = midX(lm[LANDMARK.LEFT_SHOULDER], lm[LANDMARK.RIGHT_SHOULDER], videoWidth);
      const addrX = midX(addrLm[LANDMARK.LEFT_SHOULDER], addrLm[LANDMARK.RIGHT_SHOULDER], videoWidth);
      rows.push({ label: 'Head sway (rel.)', value: `${(((currX - addrX) / videoWidth) * 100).toFixed(1)}%` });
    } else {
      rows.push({ label: 'Head sway (rel.)', value: '—' });
    }
  }

  rows.push({ label: 'Shoulder turn (est.)', value: fmt(computeMetricValue(frame, 'shoulderTurn', ctx)) });
  rows.push({ label: 'Hip turn (est.)', value: fmt(computeMetricValue(frame, 'hipTurn', ctx)) });

  return rows;
}
