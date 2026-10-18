// No nominal-FPS frame identities. A failed decode is a failed capture.
export function seekDecoded(video, time, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Cancelled', 'AbortError'));
    const source = video.currentSrc || video.src;
    const nonce = (video._swingstrSeekNonce ?? 0) + 1;
    video._swingstrSeekNonce = nonce;
    let callback, timer;
    const cleanup = () => { clearTimeout(timer); video.removeEventListener('seeked', onSeek); video.removeEventListener('error', onError); signal?.removeEventListener('abort', onAbort); if (callback != null) video.cancelVideoFrameCallback?.(callback); };
    const fail = (error) => { cleanup(); reject(error); };
    const onAbort = () => fail(new DOMException('Cancelled', 'AbortError'));
    const onError = () => fail(new Error('Source video could not be decoded.'));
    const done = (frame) => { if (video._swingstrSeekNonce !== nonce) return fail(new Error('Seek replaced by a newer request.')); cleanup(); resolve(frame); };
    const onSeek = () => {
      if (video.readyState < 2) return;
      if (!video.requestVideoFrameCallback) done({ unsupported: true, time: video.currentTime });
      // The callback was registered before seeking, to catch this decoded frame.
    };
    timer = setTimeout(() => fail(new Error('Decoded frame timed out. No stale frame was exported.')), 5000);
    signal?.addEventListener('abort', onAbort, { once: true });
    video.addEventListener('error', onError, { once: true });
    video.addEventListener('seeked', onSeek);
    if (Math.abs(video.currentTime - time) < 1e-7 && video.readyState >= 2 && !video.seeking) {
      done(video._swingstrFrame ?? { unsupported: true, time: video.currentTime });
      return;
    }
    if (video.requestVideoFrameCallback) callback = video.requestVideoFrameCallback((_now, metadata) => {
      if (video._swingstrSeekNonce !== nonce || (video.currentSrc || video.src) !== source) return fail(new Error('Seek replaced by a newer request or source.'));
      video._swingstrFrame = { mediaTime: metadata.mediaTime, presentedFrames: metadata.presentedFrames };
      done(video._swingstrFrame);
    });
    video.currentTime = time;
  });
}
export async function createExportVideo(src, signal) {
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous'; video.muted = true; video.playsInline = true; video.preload = 'auto';
  await new Promise((resolve, reject) => {
    let initialCallback;
    const cleanup = () => { clearTimeout(timer); video.onloadeddata = null; video.onerror = null; if (initialCallback != null) video.cancelVideoFrameCallback?.(initialCallback); signal?.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Export source load timed out.')); }, 10000);
    video.onloadeddata = () => { if (!video.requestVideoFrameCallback) { cleanup(); resolve(); } };
    if (video.requestVideoFrameCallback) initialCallback = video.requestVideoFrameCallback((_now, metadata) => { video._swingstrFrame = { mediaTime: metadata.mediaTime, presentedFrames: metadata.presentedFrames }; cleanup(); resolve(); });
    video.onerror = () => { cleanup(); reject(new Error('Export source could not be loaded.')); };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) return abort();
    video.src = src;
  }).catch((error) => { video.removeAttribute('src'); video.load(); throw error; });
  return video;
}
export function releaseVideo(video) { video.pause(); video._swingstrCallbacks?.forEach((id) => video.cancelVideoFrameCallback?.(id)); video.removeAttribute('src'); video.load(); }
