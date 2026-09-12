/**
 * Records a clip of the live analyzer panes — video, telestration,
 * zoom and pan — between two marker times, and returns it as a downloadable
 * file.
 *
 * The browser can only record in real time, so a 6s clip takes ~6s (longer at
 * reduced speed). MP4 is used when the browser can encode it; otherwise WebM.
 */

const MP4_TYPES = [
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4;codecs=avc1',
  'video/mp4',
];
const WEBM_TYPES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

/** Best available container/codec, MP4 preferred. */
export function pickRecordingType() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const t of [...MP4_TYPES, ...WEBM_TYPES]) {
    if (MediaRecorder.isTypeSupported(t)) {
      return { mimeType: t, ext: t.startsWith('video/mp4') ? 'mp4' : 'webm' };
    }
  }
  return { mimeType: '', ext: 'webm' };
}

/** Marker span (earliest → latest) padded by `pad` seconds, clamped to the video. */
export function getMarkerRange(markers, duration, pad = 0.5) {
  if (!markers || markers.length < 2) return null;
  const times = markers.map((m) => m.time).sort((a, b) => a - b);
  const start = Math.max(0, times[0] - pad);
  const end = Math.min(duration || times[times.length - 1] + pad, times[times.length - 1] + pad);
  if (!(end > start)) return null;
  return { start, end };
}

const evenize = (n) => Math.max(2, Math.round(n / 2) * 2);

const waitForSeek = (vid, time) => new Promise((resolve) => {
  if (!vid) return resolve();
  const done = () => resolve();
  vid.addEventListener('seeked', done, { once: true });
  vid.currentTime = time;
  // Guard against a seek that never fires (already at that exact time).
  setTimeout(done, 400);
});

/**
 * @param {Object} opts
 * @param {Object} opts.primaryRef   - pane driving the timeline
 * @param {Object} [opts.secondaryRef] - second pane for side-by-side output
 * @param {number} opts.startTime    - primary-timeline start (seconds)
 * @param {number} opts.endTime      - primary-timeline end (seconds)
 * @param {number} [opts.secondaryOffset] - secondaryTime = primaryTime - offset
 * @param {number} [opts.speed]      - playback rate while recording
 * @param {number} [opts.paneHeight] - output height per pane
 * @param {function} [opts.onProgress] - 0..1
 * @returns {Promise<{blob: Blob, ext: string, mimeType: string}>}
 */
export async function recordClip({
  primaryRef,
  secondaryRef = null,
  startTime,
  endTime,
  secondaryOffset = 0,
  speed = 1,
  paneHeight = 720,
  onProgress,
}) {
  const primary = primaryRef?.current;
  const secondary = secondaryRef?.current;
  if (!primary?.hasVideo) throw new Error('No video loaded to export.');

  const type = pickRecordingType();
  if (!type) throw new Error('This browser cannot record video.');

  const panes = [primary, secondary].filter((p) => p?.hasVideo);
  const videos = panes.map((p) => p.getVideoElement()).filter(Boolean);
  if (videos.length === 0) throw new Error('No video loaded to export.');

  // Lay panes out left-to-right at a common height.
  const gap = panes.length > 1 ? 8 : 0;
  const rects = [];
  let x = 0;
  for (const pane of panes) {
    const size = pane.getPaneSize?.() || { w: 16, h: 9 };
    const aspect = size.h > 0 ? size.w / size.h : 16 / 9;
    const w = evenize(paneHeight * aspect);
    rects.push({ x, y: 0, w, h: paneHeight });
    x += w + gap;
  }
  const totalW = evenize(x - gap);
  const totalH = evenize(paneHeight);

  const canvas = document.createElement('canvas');
  canvas.width = totalW;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d');

  // Remember playback state so the analyzer is left as we found it.
  const restore = videos.map((v) => ({ v, time: v.currentTime, rate: v.playbackRate, paused: v.paused }));
  videos.forEach((v) => v.pause());

  const primaryVid = videos[0];
  const secondaryVid = videos[1] || null;

  await waitForSeek(primaryVid, startTime);
  if (secondaryVid) {
    await waitForSeek(secondaryVid, Math.max(0, startTime - secondaryOffset));
  }

  videos.forEach((v) => { v.playbackRate = speed; });

  const stream = canvas.captureStream(60);
  const recorder = new MediaRecorder(stream, {
    ...(type.mimeType ? { mimeType: type.mimeType } : {}),
    videoBitsPerSecond: 12_000_000,
  });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  let frames = 0;
  let stopReason = 'none';

  const finished = new Promise((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: type.mimeType || 'video/webm' }));
    recorder.onerror = (e) => reject(e.error || new Error('Recording failed.'));
  });

  const span = Math.max(0.01, endTime - startTime);
  let raf = 0;
  let timer = 0;
  let stopped = false;

  const stop = (reason) => {
    if (stopped) return;
    stopped = true;
    stopReason = reason;
    cancelAnimationFrame(raf);
    clearInterval(timer);
    videos.forEach((v) => v.pause());
    if (recorder.state !== 'inactive') recorder.stop();
  };

  const step = () => {
    if (stopped) return;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, totalW, totalH);
    panes.forEach((pane, i) => pane.drawExportFrame?.(ctx, rects[i]));

    // Keep the second video pinned to its sync-offset position; decode
    // timing otherwise lets the two swings drift apart mid-record.
    if (secondaryVid) {
      const want = Math.max(0, primaryVid.currentTime - secondaryOffset);
      if (Math.abs(secondaryVid.currentTime - want) > 0.08) {
        secondaryVid.currentTime = want;
      }
    }

    frames++;
    onProgress?.(Math.max(0, Math.min(1, (primaryVid.currentTime - startTime) / span)));
    if (primaryVid.currentTime >= endTime || primaryVid.ended) stop('reached-end');
  };

  // Two clocks drive the compositing loop: rAF for smooth 60fps while the
  // window is visible, and an interval as a floor. A backgrounded window
  // throttles rAF to nothing, and without the interval the recording would
  // silently produce an empty file.
  const tick = () => {
    if (stopped) return;
    step();
    if (!stopped) raf = requestAnimationFrame(tick);
  };

  // Paint one frame before recording so the encoder has dimensions from the
  // very first chunk, and stream data in slices rather than one blob at stop.
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, totalW, totalH);
  panes.forEach((pane, i) => pane.drawExportFrame?.(ctx, rects[i]));
  recorder.start(250);
  await Promise.all(videos.map((v) => v.play().catch((e) => {
    console.warn('recordClip: play() rejected', e?.name, e?.message);
  })));
  raf = requestAnimationFrame(tick);
  timer = setInterval(step, 1000 / 30);

  // Hard ceiling so a stalled video can't record forever.
  const guard = setTimeout(() => stop('guard-timeout'), ((span / Math.max(0.1, speed)) + 10) * 1000);

  let blob;
  try {
    blob = await finished;
    console.debug('recordClip:', { stopReason, frames, chunks: chunks.length, bytes: blob.size, totalW, totalH });
    // Too few composited frames means the browser starved the draw loop
    // (window hidden or minimised) and the file would be unusable.
    if (frames < Math.max(4, span * 2)) {
      throw new Error('Recording stalled — keep the Swingstr window visible and in front while the clip records, then try again.');
    }
  } finally {
    clearTimeout(guard);
    stream.getTracks().forEach((t) => t.stop());
    restore.forEach(({ v, time, rate }) => {
      v.playbackRate = rate;
      v.currentTime = time;
    });
  }

  return { blob, ext: type.ext, mimeType: type.mimeType };
}
