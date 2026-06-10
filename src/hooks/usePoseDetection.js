import { useRef, useState, useCallback, useEffect } from 'react';

// MediaPipe Tasks Vision is loaded straight from a CDN at runtime so this POC
// adds no npm dependency. The model weights download once and inference runs
// entirely on-device — no frames ever leave the browser.
const VERSION = '0.10.35';
const VISION_CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const VISION_ESM = `${VISION_CDN}/vision_bundle.mjs`;
const WASM_PATH = `${VISION_CDN}/wasm`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export function usePoseDetection() {
  const landmarkerRef = useRef(null);
  const initPromise = useRef(null);
  // idle | loading | ready | error
  const [status, setStatus] = useState('idle');

  const init = useCallback(async () => {
    if (landmarkerRef.current) return landmarkerRef.current;
    if (initPromise.current) return initPromise.current;
    setStatus('loading');
    initPromise.current = (async () => {
      const vision = await import(/* @vite-ignore */ VISION_ESM);
      const { FilesetResolver, PoseLandmarker } = vision;
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
      const make = (delegate) =>
        PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate },
          runningMode: 'IMAGE',
          numPoses: 1,
        });
      // Prefer GPU; fall back to CPU if the device/driver won't allow it.
      let landmarker;
      try {
        landmarker = await make('GPU');
      } catch {
        landmarker = await make('CPU');
      }
      landmarkerRef.current = landmarker;
      setStatus('ready');
      return landmarker;
    })().catch((e) => {
      console.error('Pose init failed', e);
      setStatus('error');
      initPromise.current = null;
      throw e;
    });
    return initPromise.current;
  }, []);

  // Runs detection on whatever frame the <video> is currently showing.
  // Returns the array of 33 landmarks (normalized 0–1) or null.
  const detect = useCallback(
    async (videoEl) => {
      if (!videoEl || videoEl.videoWidth === 0) return null;
      const landmarker = await init();
      if (!landmarker) return null;
      const res = landmarker.detect(videoEl);
      return res?.landmarks?.[0] ?? null;
    },
    [init]
  );

  useEffect(
    () => () => {
      try {
        landmarkerRef.current?.close?.();
      } catch {
        /* noop */
      }
    },
    []
  );

  return { detect, init, status };
}
