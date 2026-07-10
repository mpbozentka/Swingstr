import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

let landmarkerPromise = null; // singleton — model load is ~1s, do it once

/**
 * Loads (once) and returns the shared PoseLandmarker instance. WASM and the
 * model file are served same-origin from public/mediapipe/ — no CDN fetch at
 * runtime, per Swingstr's privacy design.
 */
export function getPoseLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
      return PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: '/mediapipe/pose_landmarker_full.task',
          delegate: 'GPU', // falls back to CPU automatically if unavailable
        },
        // IMAGE mode on purpose: VIDEO mode's cross-frame tracking/smoothing
        // trails fast motion (a golf swing is the worst case) and needs the
        // monotonic-timestamp dance. Our analysis is an offline seek-step
        // pass, so each frame is detected independently instead.
        runningMode: 'IMAGE',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
      });
    })();
    landmarkerPromise.catch(() => { landmarkerPromise = null; }); // allow retry on failure
  }
  return landmarkerPromise;
}

// Only one analysis may run at a time — GPU contention on the shared
// landmarker instance.
let analyzing = false;

export function tryStartAnalysis() {
  if (analyzing) return false;
  analyzing = true;
  return true;
}

export function endAnalysis() {
  analyzing = false;
}
