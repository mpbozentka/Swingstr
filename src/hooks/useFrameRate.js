import { useEffect, useState } from 'react';
import { frameRateFromContainer, snapRate } from '../utils/frameRate';

const SAMPLES = 16;

// Fallback for files the container reader can't parse (WebM and the like):
// play a tiny, nearly invisible muted copy and read the decoded mediaTime of
// each presented frame. Chrome only reports frames for a video it composites,
// so the copy has to be in the page and on screen.
function measureByPlayback(src, signal) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    if (!video.requestVideoFrameCallback) return resolve(null);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('aria-hidden', 'true');
    video.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1';
    const times = [];
    let callback;
    const finish = (fps) => {
      clearTimeout(timer);
      if (callback != null) video.cancelVideoFrameCallback(callback);
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.remove();
      resolve(fps);
    };
    const timer = setTimeout(() => finish(null), 6000);
    signal.addEventListener('abort', () => finish(null), { once: true });
    const tick = (_now, meta) => {
      times.push(meta.mediaTime);
      if (times.length >= SAMPLES) {
        // Dropped frames only make gaps longer, so take the lower quartile.
        const gaps = times.slice(1).map((t, i) => t - times[i]).filter((g) => g > 0.0005).sort((a, b) => a - b);
        const gap = gaps[Math.floor(gaps.length / 4)];
        return finish(gap ? snapRate(1 / gap) : null);
      }
      callback = video.requestVideoFrameCallback(tick);
    };
    callback = video.requestVideoFrameCallback(tick);
    document.body.appendChild(video);
    video.src = src;
    video.play().catch(() => finish(null));
  });
}

/** Frame rate of a video source, or null while unknown or unmeasurable. */
export default function useFrameRate(src) {
  const [result, setResult] = useState({ src: null, fps: null });
  useEffect(() => {
    if (!src) return undefined;
    const controller = new AbortController();
    (async () => {
      const fps = (await frameRateFromContainer(src, controller.signal)) ?? (await measureByPlayback(src, controller.signal));
      if (!controller.signal.aborted) setResult({ src, fps });
    })().catch(() => {});
    return () => controller.abort();
  }, [src]);
  return result.src === src ? result.fps : null;
}
