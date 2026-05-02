import { renderShape } from './shapeRenderer';

/**
 * Generates a swing sequence grid image from video frame captures.
 *
 * @param {Object} options
 * @param {Object} options.leftRef - Ref to left VideoCanvas
 * @param {Object} options.rightRef - Ref to right VideoCanvas (optional)
 * @param {string} options.source - 'left', 'right', or 'both'
 * @param {number[]} options.frameTimes - Array of timestamps to capture
 * @param {number[]} options.rightFrameTimes - Frame times for right video (when source='both')
 * @param {string[]} options.labels - Optional labels for each frame
 * @param {boolean} options.showLabels - Whether to render labels
 * @param {boolean} options.showTitle - Whether to render title bar
 * @param {string} options.titleText - Title text
 * @param {string} options.format - 'jpeg' or 'png'
 * @param {function} options.onProgress - Progress callback (0-1)
 * @returns {Promise<string>} Data URL of the generated image
 */
export async function generateSwingSequence({
  leftRef,
  rightRef,
  source,
  frameTimes,
  rightFrameTimes,
  labels,
  showLabels,
  showTitle,
  titleText,
  format = 'jpeg',
  onProgress,
}) {
  const refs = [];
  const timeArrays = [];

  if (source === 'left' || source === 'both') {
    refs.push(leftRef);
    timeArrays.push(frameTimes);
  }
  if (source === 'right') {
    refs.push(rightRef);
    timeArrays.push(frameTimes);
  }
  if (source === 'both' && rightRef) {
    refs.push(rightRef);
    timeArrays.push(rightFrameTimes || frameTimes);
  }

  const numFrames = frameTimes.length;
  const rows = refs.length;
  const totalCaptures = numFrames * rows;
  let captured = 0;

  // Capture all frames
  const capturedRows = [];
  for (let row = 0; row < rows; row++) {
    const ref = refs[row];
    const times = timeArrays[row];
    const rowFrames = [];

    // Save original time to restore later
    const originalTime = ref.current?.currentTime ?? 0;

    for (let i = 0; i < numFrames; i++) {
      const result = await ref.current?.captureFrameAtTime(times[i]);
      rowFrames.push(result);
      captured++;
      onProgress?.(captured / totalCaptures);
    }

    // Restore original position
    ref.current?.seekTo(originalTime);
    capturedRows.push(rowFrames);
  }

  // Determine frame dimensions from first captured frame
  const firstFrame = capturedRows[0]?.find((f) => f?.canvas);
  if (!firstFrame) throw new Error('No frames could be captured');

  const frameW = firstFrame.canvas.width;
  const frameH = firstFrame.canvas.height;

  // Grid layout
  const gap = 4;
  const labelHeight = showLabels ? 32 : 0;
  const titleHeight = showTitle ? 48 : 0;
  const cellW = frameW;
  const cellH = frameH + labelHeight;

  const gridW = numFrames * cellW + (numFrames - 1) * gap;
  const gridH = titleHeight + rows * cellH + (rows - 1) * gap;

  // Scale down if too large (max 8000px wide)
  const maxWidth = 8000;
  const scale = gridW > maxWidth ? maxWidth / gridW : 1;

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = Math.round(gridW * scale);
  finalCanvas.height = Math.round(gridH * scale);
  const ctx = finalCanvas.getContext('2d');

  // Background
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

  ctx.save();
  ctx.scale(scale, scale);

  // Title bar
  if (showTitle && titleText) {
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, gridW, titleHeight);
    ctx.fillStyle = '#e5e7eb';
    ctx.font = `bold ${Math.round(24)}px system-ui, -apple-system, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(titleText, 16, titleHeight / 2);

    // Date on right side
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
    ctx.fillStyle = '#9ca3af';
    ctx.font = `${Math.round(16)}px system-ui, -apple-system, sans-serif`;
    const dateWidth = ctx.measureText(dateStr).width;
    ctx.fillText(dateStr, gridW - dateWidth - 16, titleHeight / 2);
  }

  // Draw frames
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < numFrames; col++) {
      const frame = capturedRows[row][col];
      const x = col * (cellW + gap);
      const y = titleHeight + row * (cellH + gap);

      if (frame?.canvas) {
        ctx.drawImage(frame.canvas, x, y, cellW, frameH);

        // Render annotations on top — shapes are stored in the live view's
        // container-pixel space, so we need the frame's videoRect (the
        // letterboxed rect where the video lived in the live container) to
        // map them correctly into this cell's pixel space. (#5)
        if (frame.shapes?.length > 0 && frame.videoRect) {
          const vr = frame.videoRect;
          ctx.save();
          ctx.translate(x, y);
          ctx.scale(cellW / vr.w, frameH / vr.h);
          ctx.translate(-vr.x, -vr.y);
          // Pass a videoRect that matches the frame canvas so blur shapes
          // (which read videoRect for drawImage) cover the full cell.
          const cellVideoRect = { x: vr.x, y: vr.y, w: vr.w, h: vr.h };
          frame.shapes.forEach((shape) => {
            renderShape(ctx, shape, { zoomLevel: 1, videoRect: cellVideoRect });
          });
          ctx.restore();
        }
      } else {
        // Empty frame placeholder
        ctx.fillStyle = '#374151';
        ctx.fillRect(x, y, cellW, frameH);
        ctx.fillStyle = '#6b7280';
        ctx.font = `${Math.round(14)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No frame', x + cellW / 2, y + frameH / 2);
        ctx.textAlign = 'start';
      }

      // Label below frame
      if (showLabels && labels?.[col]) {
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(x, y + frameH, cellW, labelHeight);
        ctx.fillStyle = '#d1d5db';
        ctx.font = `bold ${Math.round(14)}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labels[col], x + cellW / 2, y + frameH + labelHeight / 2);
        ctx.textAlign = 'start';
      }
    }
  }

  // Row labels for comparison mode
  if (source === 'both' && rows === 2) {
    ctx.save();
    ctx.fillStyle = 'rgba(139, 92, 246, 0.8)';
    ctx.font = `bold ${Math.round(14)}px system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    const pad = 8;
    ['LEFT', 'RIGHT'].forEach((label, i) => {
      const y = titleHeight + i * (cellH + gap) + pad;
      ctx.fillText(label, pad, y);
    });
    ctx.restore();
  }

  // Watermark
  ctx.fillStyle = 'rgba(139, 92, 246, 0.4)';
  ctx.font = `bold ${Math.round(12)}px system-ui, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText('Swingstr', gridW - 8, gridH - 8);

  ctx.restore();

  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
  const quality = format === 'png' ? undefined : 0.92;
  return finalCanvas.toDataURL(mimeType, quality);
}

/**
 * Generates evenly-spaced frame times across a video duration.
 */
export function getEvenFrameTimes(duration, count) {
  if (duration <= 0 || count <= 0) return [];
  if (count === 1) return [duration / 2];
  const step = duration / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.min(i * step, duration));
}

/**
 * Gets frame times from markers, sorted by time.
 * Falls back to even spacing for missing frames.
 */
export function getMarkerFrameTimes(markers, duration, count) {
  const sorted = [...markers].sort((a, b) => a.time - b.time).map((m) => m.time);
  if (sorted.length >= count) return sorted.slice(0, count);
  // Fill remaining with even spacing
  const even = getEvenFrameTimes(duration, count);
  const merged = [...sorted];
  for (const t of even) {
    if (merged.length >= count) break;
    if (!merged.some((m) => Math.abs(m - t) < 0.05)) {
      merged.push(t);
    }
  }
  return merged.sort((a, b) => a - b).slice(0, count);
}
