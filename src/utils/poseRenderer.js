/**
 * Skeleton overlay rendering — mirrors the ctx/options shape of
 * shapeRenderer.js so it composes with the same canvas transform.
 */
import {
  LANDMARK,
  POSE_CONNECTIONS,
  POSE_POINT_INDICES,
  VISIBILITY_THRESHOLD,
  SKELETON_COLOR,
  SKELETON_LINE_WIDTH,
  SKELETON_POINT_RADIUS,
  midpoint,
} from '../constants/pose';

function isVisible(lm) {
  return !!lm && (lm.visibility ?? 1) >= VISIBILITY_THRESHOLD;
}

// Landmarks are normalized [0,1] video coordinates; map through the same
// letterbox rect the rest of VideoCanvas uses.
function toCanvasPoint(lm, videoRect) {
  return {
    x: videoRect.x + lm.x * videoRect.w,
    y: videoRect.y + lm.y * videoRect.h,
  };
}

/** Draws one connection segment if both endpoints are visible enough. */
function drawSegment(ctx, a, b, videoRect) {
  if (!isVisible(a) || !isVisible(b)) return;
  const pa = toCanvasPoint(a, videoRect);
  const pb = toCanvasPoint(b, videoRect);
  ctx.beginPath();
  ctx.moveTo(pa.x, pa.y);
  ctx.lineTo(pb.x, pb.y);
  ctx.stroke();
}

/**
 * Draws the cached pose frame's skeleton into ctx. Call inside the same
 * pan/zoom-transformed save/restore block VideoCanvas uses for shapes, and
 * before shapes render so telestration stays visually on top.
 */
export function renderSkeleton(ctx, frame, { videoRect, zoomLevel }) {
  const landmarks = frame?.landmarks;
  if (!landmarks) return;

  ctx.save();
  ctx.strokeStyle = SKELETON_COLOR;
  ctx.lineWidth = SKELETON_LINE_WIDTH / zoomLevel;

  POSE_CONNECTIONS.forEach(([aIdx, bIdx]) => {
    drawSegment(ctx, landmarks[aIdx], landmarks[bIdx], videoRect);
  });

  // Derived "spine": shoulder midpoint -> hip midpoint.
  const lShoulder = landmarks[LANDMARK.LEFT_SHOULDER];
  const rShoulder = landmarks[LANDMARK.RIGHT_SHOULDER];
  const lHip = landmarks[LANDMARK.LEFT_HIP];
  const rHip = landmarks[LANDMARK.RIGHT_HIP];
  if (isVisible(lShoulder) && isVisible(rShoulder) && isVisible(lHip) && isVisible(rHip)) {
    drawSegment(ctx, midpoint(lShoulder, rShoulder), midpoint(lHip, rHip), videoRect);
  }

  const pointRadius = SKELETON_POINT_RADIUS / zoomLevel;
  ctx.fillStyle = '#ffffff';
  POSE_POINT_INDICES.forEach((idx) => {
    const lm = landmarks[idx];
    if (!isVisible(lm)) return;
    const p = toCanvasPoint(lm, videoRect);
    ctx.beginPath();
    ctx.arc(p.x, p.y, pointRadius, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}
