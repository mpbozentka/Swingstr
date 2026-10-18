import { mapExportTime } from './exportPlan.js';
import { annotationVisible } from './annotationTiming.js';
import { mapShape } from './controlShapes.js';
import { renderShape } from './shapeRenderer.js';
import { createExportVideo, seekDecoded, releaseVideo } from './decodedVideo.js';

export function pickRecordingType() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const mimeType of ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
    if (MediaRecorder.isTypeSupported(mimeType)) return { mimeType, ext: mimeType.startsWith('video/mp4') ? 'mp4' : 'webm' };
  }
  return null;
}
export function paintExportFrame(ctx, plan, videos, mapped, frames) {
  ctx.fillStyle = '#0b1015'; ctx.fillRect(0, 0, plan.width, plan.height);
  const top = plan.title ? 90 : 0;
  const stacked = plan.preset !== 'landscape';
  plan.panes.forEach((pane, i) => {
    const video = videos[i];
    const count = plan.panes.length;
    const box = stacked ? { x: 0, y: top + i * (plan.height - top) / count, w: plan.width, h: (plan.height - top) / count } : { x: i * plan.width / count, y: top, w: plan.width / count, h: plan.height - top };
    const c = pane.framing.crop;
    const sw = video.videoWidth * c.w, sh = video.videoHeight * c.h;
    const scale = pane.framing.fit === 'crop' ? Math.max(box.w / sw, box.h / sh) : Math.min(box.w / sw, box.h / sh);
    const rect = { x: box.x + (box.w - sw * scale) / 2 - c.x * video.videoWidth * scale, y: box.y + (box.h - sh * scale) / 2 - c.y * video.videoHeight * scale, w: video.videoWidth * scale, h: video.videoHeight * scale };
    ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
    ctx.drawImage(video, rect.x, rect.y, rect.w, rect.h);
    if (plan.annotations === 'annotated') for (const shape of pane.drawings) {
      if (annotationVisible(shape, { time: mapped[i].time, frame: frames[i], markers: pane.markers })) renderShape(ctx, mapShape(shape, ({ x, y }) => ({ x: rect.x + x * rect.w, y: rect.y + y * rect.h })), { zoomLevel: 1, video, videoRect: rect });
    }
    ctx.font = 'bold 32px sans-serif'; ctx.textBaseline = 'top';
    const label = [plan.paneLabels[pane.side], mapped[i].held ? 'Held' : ''].filter(Boolean).join(' • ');
    if (label) { ctx.fillStyle = '#000b'; ctx.fillRect(box.x + 16, box.y + 16, Math.min(box.w - 32, ctx.measureText(label).width + 24), 48); ctx.fillStyle = '#fff'; ctx.fillText(label, box.x + 28, box.y + 24, box.w - 56); }
    ctx.restore();
  });
  if (plan.title) { ctx.font = 'bold 36px sans-serif'; ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(plan.title, 24, 45, plan.width - 48); }
}
export async function recordClip({ plan, signal, onProgress, isCurrent = () => true }) {
  const type = pickRecordingType();
  if (!type) throw new Error('No supported video recorder.');
  const videos = [], frames = [];
  let stream, recorder, finished, encoderError;
  try {
    for (const pane of plan.panes) videos.push(await createExportVideo(pane.src, signal));
    const canvas = document.createElement('canvas'); canvas.width = plan.width; canvas.height = plan.height;
    const ctx = canvas.getContext('2d');
    let previous = [];
    const callbackIds = [];
    videos.forEach((video, i) => {
      if (!video.requestVideoFrameCallback) return;
      const tick = (_now, metadata) => { frames[i] = { mediaTime: metadata.mediaTime, presentedFrames: metadata.presentedFrames }; video._swingstrFrame = frames[i]; callbackIds[i] = video.requestVideoFrameCallback(tick); video._swingstrCallbacks = [callbackIds[i]]; };
      callbackIds[i] = video.requestVideoFrameCallback(tick); video._swingstrCallbacks = [callbackIds[i]];
    });
    const draw = async (time) => {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      if (encoderError) throw encoderError;
      if (!isCurrent()) throw new Error('Source replaced during export. Start a new export.');
      const mapped = mapExportTime(plan, time);
      await Promise.all(videos.map(async (video, i) => {
        const m = mapped[i], before = previous[i];
        const transition = !before || m.time < before.time - 0.001 || m.freeze !== before.freeze || m.held !== before.held;
        if (transition) {
          video.pause(); frames[i] = await seekDecoded(video, m.time, signal);
          if (!m.freeze && !m.held) { video.playbackRate = plan.speed; await video.play(); }
        }
        if (!m.freeze && !m.held && video.readyState < 2) throw new Error('Export decoder stalled.');
        if (frames[i]?.mediaTime != null && Math.abs(frames[i].mediaTime - m.time) > 0.15) throw new Error('Decoded source drift exceeded 150 ms.');
      }));
      previous = mapped;
      if (!isCurrent()) throw new Error('Source replaced during frame capture.');
      paintExportFrame(ctx, plan, videos, mapped.map((m, i) => ({ ...m, time: frames[i]?.mediaTime ?? m.time })), frames);
    };
    await draw(0);
    stream = canvas.captureStream(30);
    recorder = new MediaRecorder(stream, { mimeType: type.mimeType, videoBitsPerSecond: 12_000_000 });
    const chunks = [];
    finished = new Promise((resolve, reject) => { recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); }; recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType })); recorder.onerror = (e) => { encoderError = e.error ?? new Error('Video encoder failed.'); reject(encoderError); }; });
    finished.catch(() => {});
    recorder.start(250);
    const began = performance.now();
    for (let index = 1; index < Math.ceil(plan.expectedDuration * 30); index++) {
      await draw(index / 30);
      const delay = began + index / 30 * 1000 - performance.now();
      if (delay < -250) throw new Error('Rendering fell behind by more than 250 ms. Keep the window visible; a native encoder may be needed for this source.');
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      onProgress?.(index / (plan.expectedDuration * 30));
    }
    const delay = began + plan.expectedDuration * 1000 - performance.now();
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    recorder.stop();
    const blob = await finished;
    const url = URL.createObjectURL(blob);
    let duration, width, height;
    try {
      const probe = await createExportVideo(url, signal);
      try {
        if (!Number.isFinite(probe.duration)) { await seekDecoded(probe, 1e10, signal); }
        duration = probe.duration; width = probe.videoWidth; height = probe.videoHeight;
      } finally { releaseVideo(probe); }
    } finally { URL.revokeObjectURL(url); }
    if (!Number.isFinite(duration) || Math.abs(duration - plan.expectedDuration) > 0.1 || width !== plan.width || height !== plan.height) throw new Error(`Encoded artifact did not match recipe: ${width}×${height}, ${duration}s; expected ${plan.expectedDuration}s.`);
    onProgress?.(1);
    return { blob, ext: type.ext, mimeType: blob.type, width, height, duration, silent: true, warnings: ['MediaRecorder output at 30 fps; silent audio.'] };
  } finally {
    if (recorder?.state !== 'inactive' && recorder) { recorder.stop(); await finished.catch(() => {}); }
    stream?.getTracks().forEach((track) => track.stop());
    videos.forEach(releaseVideo);
  }
}
