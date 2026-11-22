// Frame math and still-image rendering for agent control (get_frame,
// get_frames). Pure helpers are exported for tests; drawAgentFrame needs a
// 2D canvas context.
import { renderShape } from './shapeRenderer.js';
import { mapShape } from './controlShapes.js';

// Frame k is shown from k/fps until (k+1)/fps. The epsilon keeps a time that
// sits exactly on a boundary from rounding down to the previous frame.
export const frameAt = (t, fps) => Math.floor(t * fps + 1e-3);

// Where frame k is sought: 1 ms after it starts, matching the frame-step
// buttons, so the decoder can't land on the previous frame.
export const frameStartTime = (frame, fps) => frame / fps + 0.001;

/**
 * fps and frame index for a pane, counted from the playhead time exactly as
 * the scrubber counts it. The decoded frame's own timestamp isn't used: it
 * updates a moment after a seek finishes, and at 29.97/59.94 fps a frame's
 * exact start time can round down to the previous frame number.
 */
export function frameInfo({ time }, fps) {
  if (!fps) return { fps: null, frameIndex: null, frameRateNote: 'Frame rate is still being measured; use seconds.' };
  return { fps, frameIndex: frameAt(time, fps) };
}

const FULL = { x: 0, y: 0, w: 1, h: 1 };

/** Source rectangle (pixels) and output size for a normalized crop. */
export function outputSize(crop, videoWidth, videoHeight, maxWidth) {
  const c = crop ?? FULL;
  const sx = c.x * videoWidth, sy = c.y * videoHeight;
  const sw = Math.max(1, c.w * videoWidth), sh = Math.max(1, c.h * videoHeight);
  const scale = maxWidth ? Math.min(1, maxWidth / sw) : 1;
  return { sx, sy, sw, sh, scale, width: Math.max(1, Math.round(sw * scale)), height: Math.max(1, Math.round(sh * scale)) };
}

const STEPS = [0.5, 0.25, 0.2, 0.1, 0.05, 0.025, 0.02, 0.01, 0.005];
const round = (n) => Math.round(n * 10000) / 10000;

/**
 * Grid lines inside a crop, labelled in full-video normalized coordinates so a
 * label can be passed straight to draw_shape. Picks the round step that gives
 * the line count closest to `target` across the wider side of the crop.
 */
export function gridLines(crop, target = 10) {
  const c = crop ?? FULL;
  const span = Math.max(c.w, c.h);
  const step = STEPS.reduce((best, s) => (Math.abs(span / s - target) < Math.abs(span / best - target) ? s : best));
  const along = (start, size) => {
    const out = [];
    for (let v = Math.ceil(round(start / step)) * step; v <= start + size + 1e-9; v += step) out.push(round(v));
    return out;
  };
  return { step, xs: along(c.x, c.w), ys: along(c.y, c.h) };
}

/** Tile positions for a contact sheet. */
export function sheetLayout(count, tileWidth, tileHeight, columns) {
  const cols = Math.max(1, Math.min(count, columns ?? Math.ceil(Math.sqrt(count))));
  const rows = Math.ceil(count / cols);
  const gap = 4;
  return {
    columns: cols,
    rows,
    width: cols * tileWidth + (cols - 1) * gap,
    height: rows * tileHeight + (rows - 1) * gap,
    tiles: Array.from({ length: count }, (_, i) => ({ x: (i % cols) * (tileWidth + gap), y: Math.floor(i / cols) * (tileHeight + gap) })),
  };
}

function drawLabel(ctx, text, x, y, size, align = 'left') {
  ctx.font = `600 ${size}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
  const w = ctx.measureText(text).width + size * 0.6;
  const h = size * 1.4;
  const left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(left, y, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, left + size * 0.3, y + h / 2);
}

function drawGrid(ctx, crop, dest, size, target) {
  const { xs, ys } = gridLines(crop, target);
  const c = crop ?? FULL;
  const px = (v) => dest.x + ((v - c.x) / c.w) * dest.w;
  const py = (v) => dest.y + ((v - c.y) / c.h) * dest.h;
  const line = (x0, y0, x1, y1) => {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.stroke();
  };
  xs.forEach((v) => line(px(v), dest.y, px(v), dest.y + dest.h));
  ys.forEach((v) => line(dest.x, py(v), dest.x + dest.w, py(v)));
  const label = (v) => String(v).replace(/^0(?=\.)/, '');
  // Edge lines would have half-cut labels, and the top y label would sit on
  // the x labels, so those go unlabelled.
  const room = size * 1.6;
  xs.filter((v) => px(v) > dest.x + room && px(v) < dest.x + dest.w - room)
    .forEach((v) => drawLabel(ctx, label(v), px(v), dest.y + 2, size, 'center'));
  ys.filter((v) => py(v) > dest.y + room * 1.5 && py(v) < dest.y + dest.h - room)
    .forEach((v) => drawLabel(ctx, label(v), dest.x + 2, py(v) - size * 0.7, size));
}

/**
 * Draw one video frame (cropped and scaled) into dest on ctx, with optional
 * drawings, unfinished angle points, grid and caption.
 */
export function drawAgentFrame(ctx, source, {
  videoWidth, videoHeight, crop, dest, shapes = [], pendingPoints = [], pendingColor = '#ef4444', grid, caption,
}) {
  const box = outputSize(crop, videoWidth, videoHeight);
  const scale = dest.w / box.sw;
  ctx.save();
  ctx.beginPath(); ctx.rect(dest.x, dest.y, dest.w, dest.h); ctx.clip();
  ctx.drawImage(source, box.sx, box.sy, box.sw, box.sh, dest.x, dest.y, dest.w, dest.h);
  const toDest = ({ x, y }) => ({ x: dest.x + (x * videoWidth - box.sx) * scale, y: dest.y + (y * videoHeight - box.sy) * scale });
  const videoRect = { x: dest.x - box.sx * scale, y: dest.y - box.sy * scale, w: videoWidth * scale, h: videoHeight * scale };
  // Strokes shrink with the image but stay at least half their drawn width,
  // so lines remain visible in small contact-sheet tiles.
  const zoomLevel = 1 / Math.min(1, Math.max(scale, 0.5));
  shapes.forEach((shape) => renderShape(ctx, mapShape(shape, toDest), { zoomLevel, video: source, videoRect }));
  if (pendingPoints.length) {
    ctx.fillStyle = pendingColor;
    const r = Math.max(4, dest.w / 180);
    pendingPoints.forEach((p) => { const q = toDest(p); ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill(); });
  }
  const labelSize = Math.max(10, Math.min(18, Math.round(dest.w / 40)));
  if (grid) drawGrid(ctx, crop, dest, labelSize, grid === true ? 10 : grid);
  if (caption) drawLabel(ctx, caption, dest.x + 2, dest.y + dest.h - labelSize * 1.4 - 2, labelSize);
  ctx.restore();
}
