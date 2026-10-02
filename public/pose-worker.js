/* global importScripts, Vision */
// A classic worker lets MediaPipe load its WASM glue without blocking replay.
importScripts('/mediapipe/vision_bundle.js');
let landmarker;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      const files = await Vision.FilesetResolver.forVisionTasks('/mediapipe/wasm');
      landmarker = await Vision.PoseLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: '/mediapipe/pose_landmarker_full.task', delegate: 'CPU' },
        runningMode: 'IMAGE',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
      });
      self.postMessage({ ready: true });
    } else {
      const result = landmarker.detect(data.image);
      self.postMessage({ landmarks: result.landmarks[0] || null });
    }
  } catch (error) {
    self.postMessage({ error: error.message });
  } finally {
    data.image?.close();
  }
};
