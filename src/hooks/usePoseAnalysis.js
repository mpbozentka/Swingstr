import { useCallback, useRef, useState } from 'react';
import { getPoseLandmarker, tryStartAnalysis, endAnalysis } from '../utils/poseLandmarker';
import { getRtmposeSessions, detectRtmpose } from '../utils/rtmposeLandmarker';

export const POSE_ENGINES = Object.freeze({
  mediapipe: 'MediaPipe',
  rtmpose: 'RTMPose',
});

/**
 * Both engines reduce to the same call: give me a frame, get back
 * `{ landmarks, world }`. MediaPipe detects synchronously off an
 * already-loaded model; RTMPose runs two ONNX models and is async. Loading
 * happens once here, outside the per-frame loop.
 */
async function loadDetector(engine) {
  if (engine === 'rtmpose') {
    const sessions = await getRtmposeSessions();
    return (vid) => detectRtmpose(sessions, vid);
  }
  const landmarker = await getPoseLandmarker();
  return (vid) => {
    const result = landmarker.detect(vid);
    return { landmarks: result.landmarks?.[0] ?? null, world: result.worldLandmarks?.[0] ?? null };
  };
}

const STEP = 1 / 30; // seconds of *playback* time per sample — see plan 5.4
const SMOOTH_KERNEL = [0.1, 0.2, 0.4, 0.2, 0.1]; // MUST stay symmetric — see smoothFrames
const PROGRESS_UPDATE_EVERY = 5; // throttle re-renders during the seek-step loop

const idleSideState = Object.freeze({
  status: 'idle',
  progress: 0,
  frames: null,
  showSkeleton: false,
  // Pixel dims of the analyzed video, captured at analysis time — angle math
  // needs them for aspect correction (plan 9.9), and consumers outside
  // VideoCanvas (the graph panel) can't read the <video> element in render.
  videoWidth: null,
  videoHeight: null,
  // Which engine produced `frames` — the two aren't interchangeable (RTMPose
  // has no 3-D output), so the UI needs to say which one you're looking at.
  engine: null,
});

function blendCoords(curr, neighbors, key) {
  return curr.map((lm, li) => {
    let w = 0;
    let x = 0;
    let y = 0;
    let z = 0;
    neighbors.forEach(({ weight, frame }) => {
      const p = frame?.[key]?.[li];
      if (!p) return;
      w += weight;
      x += weight * p.x;
      y += weight * p.y;
      z += weight * p.z;
    });
    if (w === 0) return lm;
    return { x: x / w, y: y / w, z: z / w, visibility: lm.visibility };
  });
}

/**
 * Zero-lag smoothing: blend each frame with its RAW neighbors on both sides
 * using SMOOTH_KERNEL (centered on the frame itself). A one-sided filter
 * (EMA) drags the skeleton behind fast motion; symmetric weights cancel that
 * phase lag — affordable because all frames are already cached when this
 * runs. Near a detection gap or the range edges the weights renormalize over
 * whatever neighbors exist. `visibility` is left unsmoothed — it's a
 * confidence score, not a position.
 */
function smoothFrames(frames) {
  const half = (SMOOTH_KERNEL.length - 1) / 2;
  return frames.map((f, i) => {
    if (!f.landmarks) return f;
    const neighbors = SMOOTH_KERNEL.map((weight, k) => ({ weight, frame: frames[i + k - half] }));
    const landmarks = blendCoords(f.landmarks, neighbors, 'landmarks');
    const world = f.world ? blendCoords(f.world, neighbors, 'world') : null;
    return { ...f, landmarks, world };
  });
}

/**
 * Seek the (paused) video to `t` and resolve with the timestamp of the frame
 * that is actually on screen afterwards. requestVideoFrameCallback fires on
 * real frame presentation and reports the frame's exact mediaTime — so cache
 * entries get stamped with the time of the frame the detector saw, not the
 * time we asked for, and we never detect a stale frame. Registered BEFORE
 * the seek so a fast presentation can't slip past; raced against a timeout
 * because it never fires when the seek lands on the already-presented frame.
 * Fallback for browsers without rVFC: 'seeked' + two rAFs (decode settle).
 */
async function seekAndSettle(vid, t) {
  const presented = typeof vid.requestVideoFrameCallback === 'function'
    ? new Promise((resolve) => vid.requestVideoFrameCallback((_now, meta) => resolve(meta.mediaTime)))
    : null;

  vid.currentTime = t;
  await new Promise((resolve) => {
    vid.addEventListener('seeked', resolve, { once: true });
  });

  if (presented) {
    const mediaTime = await Promise.race([
      presented,
      new Promise((resolve) => setTimeout(() => resolve(null), 100)),
    ]);
    return mediaTime ?? vid.currentTime;
  }

  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return vid.currentTime;
}

/**
 * Per-side pose analysis: seek-step through the trimmed range, run
 * PoseLandmarker on each step, cache the results. Playback/scrubbing never
 * runs live detection — it just looks up this cache (see plan section 3).
 */
export function usePoseAnalysis({ leftRef, rightRef, trims, onToast }) {
  const [poseState, setPoseState] = useState({ left: { ...idleSideState }, right: { ...idleSideState } });
  const [engine, setEngine] = useState('mediapipe');
  const abortRef = useRef({ left: false, right: false });

  const updateSide = useCallback((side, patch) => {
    setPoseState((prev) => ({ ...prev, [side]: { ...prev[side], ...patch } }));
  }, []);

  const analyze = useCallback(async (side) => {
    const ref = side === 'left' ? leftRef : rightRef;
    const handle = ref.current;
    const vid = handle?.getVideoElement?.();
    if (!handle?.hasVideo || !vid) {
      onToast?.({ message: 'Load a video before analyzing.', kind: 'error' });
      return;
    }
    if (vid.videoWidth === 0) {
      onToast?.({ message: "Browser can't decode this video format.", kind: 'error' });
      return;
    }
    if (!tryStartAnalysis()) {
      onToast?.({ message: 'Another analysis is already running — wait for it to finish.', kind: 'error' });
      return;
    }

    abortRef.current[side] = false;
    updateSide(side, { status: 'analyzing', progress: 0, frames: null });

    const wasPlaying = !vid.paused;
    const resumeTime = vid.currentTime;
    vid.pause();

    try {
      const detect = await loadDetector(engine);
      const trim = trims[side] || {};
      const start = trim.start ?? 0;
      const end = trim.end ?? vid.duration;
      const frames = [];
      let stepCount = 0;

      for (let t = start; t <= end; t += STEP) {
        if (abortRef.current[side]) break;

        const mediaTime = await seekAndSettle(vid, t);

        stepCount += 1;
        if (stepCount % PROGRESS_UPDATE_EVERY === 0) {
          updateSide(side, { progress: Math.min(1, (t - start) / (end - start || 1)) });
        }

        // Sub-30fps sources: consecutive steps can land on the same native
        // frame — skip duplicates so cache timestamps stay strictly increasing.
        if (frames.length && mediaTime <= frames[frames.length - 1].t) continue;

        const { landmarks, world } = await detect(vid);
        frames.push({ t: mediaTime, landmarks, world });
      }

      if (abortRef.current[side]) {
        updateSide(side, { status: 'idle', progress: 0, frames: null });
      } else {
        updateSide(side, {
          status: 'done',
          progress: 1,
          frames: smoothFrames(frames),
          showSkeleton: true,
          videoWidth: vid.videoWidth,
          videoHeight: vid.videoHeight,
          engine,
        });
      }
    } catch (err) {
      console.error('[usePoseAnalysis] analysis failed', err);
      onToast?.({ message: `Pose analysis failed: ${err.message}`, kind: 'error' });
      updateSide(side, { status: 'error', progress: 0, frames: null });
    } finally {
      endAnalysis();
      vid.currentTime = resumeTime;
      if (wasPlaying) vid.play().catch(() => {});
    }
  }, [leftRef, rightRef, trims, onToast, updateSide, engine]);

  const cancelAnalysis = useCallback((side) => {
    abortRef.current[side] = true;
  }, []);

  const toggleSkeleton = useCallback((side) => {
    setPoseState((prev) => ({ ...prev, [side]: { ...prev[side], showSkeleton: !prev[side].showSkeleton } }));
  }, []);

  const clearAnalysis = useCallback((side) => {
    abortRef.current[side] = true;
    updateSide(side, { ...idleSideState });
  }, [updateSide]);

  // Switching engines invalidates nothing already cached — old frames stay
  // viewable and stamped with the engine that made them.
  const toggleEngine = useCallback(() => {
    setEngine((prev) => (prev === 'mediapipe' ? 'rtmpose' : 'mediapipe'));
  }, []);

  return { poseState, engine, toggleEngine, analyze, cancelAnalysis, toggleSkeleton, clearAnalysis };
}
