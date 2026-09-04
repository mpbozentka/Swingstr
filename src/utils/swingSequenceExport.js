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
 * @param {string} options.orientation - 'horizontal' (frames across) or 'vertical' (frames stacked)
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
  orientation = 'horizontal',
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

  // Columns are driven by the caller's frame list. A row may have a null time
  // where that video has no marker for the column (comparison mode, one swing
  // missing a position) — that cell renders as an empty placeholder.
  const numFrames = Math.max(...timeArrays.map((t) => t?.length ?? 0), 0);
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
      const time = times?.[i];
      const result = time == null ? null : await ref.current?.captureFrameAtTime(time);
      rowFrames.push(result);
      captured++;
      onProgress?.(captured / totalCaptures);
    }

    // Restore original position
    ref.current?.seekTo(originalTime);
    capturedRows.push(rowFrames);
  }

  // Determine frame dimensions from the first frame that captured anywhere in
  // the grid — row 0 may lead with an empty cell.
  const firstFrame = capturedRows.flat().find((f) => f?.canvas);
  if (!firstFrame) throw new Error('No frames could be captured');

  const frameW = firstFrame.canvas.width;
  const frameH = firstFrame.canvas.height;

  // Grid layout. Horizontal runs frames across and videos down; vertical is
  // the transpose — frames stacked P1-at-top, one column per video.
  const vertical = orientation === 'vertical';
  const gap = 4;
  const labelHeight = showLabels ? 32 : 0;
  const titleHeight = showTitle ? 48 : 0;
  const cellW = frameW;
  const cellH = frameH + labelHeight;

  const gridCols = vertical ? rows : numFrames;
  const gridRows = vertical ? numFrames : rows;

  const gridW = gridCols * cellW + (gridCols - 1) * gap;
  const gridH = titleHeight + gridRows * cellH + (gridRows - 1) * gap;

  // Cap both dimensions — a 10-frame vertical strip busts the height budget
  // long before it comes near the width one.
  const MAX_PX = 8000;
  const scale = Math.min(1, MAX_PX / gridW, MAX_PX / gridH);

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
      const frame = capturedRows[row]?.[col];
      const x = (vertical ? row : col) * (cellW + gap);
      const y = titleHeight + (vertical ? col : row) * (cellH + gap);

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
        ctx.fillText('Not marked', x + cellW / 2, y + frameH / 2);
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
      const x = vertical ? i * (cellW + gap) + pad : pad;
      const y = vertical ? titleHeight + pad : titleHeight + i * (cellH + gap) + pad;
      ctx.fillText(label, x, y);
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
 * One column per marker the user actually placed — one marker gives one frame,
 * ten give ten. Single video: columns run in time order. Comparison: columns are
 * the union of P-slots either video has, sorted by slot, so P3 sits above P3 and
 * a swing missing that position gets an empty cell instead of a shifted grid.
 *
 * @returns {{index:number,label:string,primaryTime:number|null,secondaryTime:number|null}[]}
 */
export function getMarkerColumns({ primaryMarkers = [], secondaryMarkers = null, labelFor }) {
  if (!secondaryMarkers) {
    return [...primaryMarkers]
      .sort((a, b) => a.time - b.time)
      .map((m) => ({
        index: m.index,
        label: m.label ?? labelFor?.(m.index) ?? `P${m.index + 1}`,
        primaryTime: m.time,
        secondaryTime: null,
      }));
  }

  const indices = [...new Set(
    [...primaryMarkers, ...secondaryMarkers].map((m) => m.index)
  )].sort((a, b) => a - b);

  return indices.map((index) => {
    const primary = primaryMarkers.find((m) => m.index === index);
    const secondary = secondaryMarkers.find((m) => m.index === index);
    return {
      index,
      label: primary?.label ?? secondary?.label ?? labelFor?.(index) ?? `P${index + 1}`,
      primaryTime: primary?.time ?? null,
      secondaryTime: secondary?.time ?? null,
    };
  });
}
