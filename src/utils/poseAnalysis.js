function checkAbort(signal) {
  if (signal.aborted) throw new DOMException('Analysis cancelled', 'AbortError');
}

// Register before seeking, clean up even when a frame callback never arrives.
function seekFrame(video, time, signal) {
  checkAbort(signal);
  if (Math.abs(video.currentTime - time) < 0.001 && video.readyState >= 2) {
    return Promise.resolve(video.currentTime);
  }
  return new Promise((resolve, reject) => {
    let frameId, frameTime, timer;
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      if (frameId != null) video.cancelVideoFrameCallback(frameId);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      signal.removeEventListener('abort', onAbort);
    };
    const finish = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(frameTime ?? video.currentTime);
    };
    const onAbort = () => finish(new DOMException('Analysis cancelled', 'AbortError'));
    const onError = () => finish(new Error('The video could not be decoded.'));
    const onSeeked = () => {
      clearTimeout(timer);
      // Seeking to an already presented native frame may not produce rVFC.
      timer = setTimeout(() => finish(), 100);
    };
    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });
    signal.addEventListener('abort', onAbort, { once: true });
    if (video.requestVideoFrameCallback) {
      frameId = video.requestVideoFrameCallback((_now, metadata) => {
        frameTime = metadata.mediaTime;
        if (!video.seeking) finish();
      });
    }
    timer = setTimeout(() => finish(new Error('Video seeking timed out. Try a local video file.')), 5000);
    video.currentTime = time;
  });
}

function workerRequest(worker, message, signal, transfer = []) {
  checkAbort(signal);
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      signal.removeEventListener('abort', onAbort);
    };
    const fail = (error) => { cleanup(); reject(error); };
    const onMessage = ({ data }) => {
      cleanup();
      if (data.error) reject(new Error(data.error));
      else resolve(data);
    };
    const onError = () => fail(new Error('Body tracking could not load. Run npm run setup:pose and try again.'));
    const onAbort = () => fail(new DOMException('Analysis cancelled', 'AbortError'));
    const timer = setTimeout(() => fail(new Error('Body tracking timed out. Try again.')), 60000);
    worker.addEventListener('message', onMessage, { once: true });
    worker.addEventListener('error', onError, { once: true });
    signal.addEventListener('abort', onAbort, { once: true });
    worker.postMessage(message, transfer);
  });
}

export async function analyzePose(video, trim, signal, onProgress) {
  if (!video?.videoWidth || !Number.isFinite(video.duration)) throw new Error('Load a video before analyzing.');
  const start = trim.start ?? 0;
  const end = trim.end ?? video.duration;
  if (end <= start) throw new Error('Trim a valid swing range first.');
  if (end - start > 30) throw new Error('Trim the clip to 30 seconds or less before analyzing.');
  const source = video.currentSrc;
  const originalTime = video.currentTime;
  const worker = new Worker('/pose-worker.js');
  video.pause();
  try {
    await workerRequest(worker, { type: 'init' }, signal);
    const frames = [];
    const steps = Math.ceil((end - start) * 30);
    for (let i = 0; i <= steps; i++) {
      checkAbort(signal);
      if (video.currentSrc !== source) throw new DOMException('Video replaced', 'AbortError');
      const t = await seekFrame(video, Math.min(end, start + i / 30), signal);
      if (frames.length && t <= frames[frames.length - 1].t) continue;
      const image = await createImageBitmap(video);
      const result = await workerRequest(worker, { type: 'frame', image }, signal, [image]);
      frames.push({ t, landmarks: result.landmarks });
      if (i % 5 === 0 || i === steps) onProgress(i / steps);
    }
    if (!frames.some((f) => f.landmarks)) throw new Error('No golfer detected. Use a clear, full-body video.');
    return { frames, width: video.videoWidth, height: video.videoHeight };
  } finally {
    worker.terminate();
    if (video.currentSrc === source) video.currentTime = originalTime;
  }
}
