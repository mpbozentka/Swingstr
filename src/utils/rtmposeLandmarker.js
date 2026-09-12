/**
 * RTMPose pose engine — the experimental alternative to MediaPipe.
 *
 * Unlike MediaPipe (one model that finds the body and its joints in a single
 * call), RTMPose is "top-down": a small detector finds the person's box, then
 * the pose model runs on a warped crop of just that box. Two models, two
 * inference calls per frame, and a fair amount of pixel bookkeeping in
 * between — that bookkeeping is what most of this file is.
 *
 * Everything here mirrors the official preprocessing declared in the models'
 * own `pipeline.json` (shipped inside the OpenMMLab release zips). Deviating
 * from it silently degrades accuracy, so the constants below are transcribed
 * rather than tuned.
 *
 * Output is normalized into the same 33-slot BlazePose landmark array
 * MediaPipe produces, so the renderer, angle math and markers need no changes.
 */
import * as ort from 'onnxruntime-web';
import { LANDMARK } from '../constants/pose';

const BASE = '/rtmpose';

// --- Detector (rtmdet-nano), from its pipeline.json -------------------------
const DET_SIZE = 320;
const DET_PAD_VAL = 114;
// Normalize with to_rgb:false — the tensor stays in B,G,R channel order.
const DET_MEAN_BGR = [103.53, 116.28, 123.675];
const DET_STD_BGR = [57.375, 57.12, 58.395];
const DET_SCORE_THRESHOLD = 0.3;

// --- Pose (rtmpose-m halpe26), from its pipeline.json -----------------------
const POSE_W = 192;
const POSE_H = 256;
const BBOX_PADDING = 1.25;
const SIMCC_SPLIT_RATIO = 2.0;
// Normalize with to_rgb:true — tensor is R,G,B.
const POSE_MEAN_RGB = [123.675, 116.28, 103.53];
const POSE_STD_RGB = [58.395, 57.12, 57.375];

/**
 * Halpe26 keypoint index -> BlazePose landmark slot. Halpe26 has no
 * small-toe equivalent in the drawn skeleton, so FOOT_INDEX takes the big
 * toe. Face and hand points are dropped, exactly as the MediaPipe path drops
 * BlazePose 0-10 and 17-22.
 */
const HALPE26_TO_BLAZEPOSE = Object.freeze([
  [5, LANDMARK.LEFT_SHOULDER],
  [6, LANDMARK.RIGHT_SHOULDER],
  [7, LANDMARK.LEFT_ELBOW],
  [8, LANDMARK.RIGHT_ELBOW],
  [9, LANDMARK.LEFT_WRIST],
  [10, LANDMARK.RIGHT_WRIST],
  [11, LANDMARK.LEFT_HIP],
  [12, LANDMARK.RIGHT_HIP],
  [13, LANDMARK.LEFT_KNEE],
  [14, LANDMARK.RIGHT_KNEE],
  [15, LANDMARK.LEFT_ANKLE],
  [16, LANDMARK.RIGHT_ANKLE],
  [24, LANDMARK.LEFT_HEEL],
  [25, LANDMARK.RIGHT_HEEL],
  [20, LANDMARK.LEFT_FOOT_INDEX],
  [21, LANDMARK.RIGHT_FOOT_INDEX],
]);

const BLAZEPOSE_SLOT_COUNT = 33;

let sessionsPromise = null;

/**
 * Loads (once) both ONNX sessions. WebGPU first — on CPU-only WASM the pose
 * model runs several times slower, and we can't use WASM threads because
 * multi-threading needs cross-origin isolation headers the app doesn't set.
 */
export function getRtmposeSessions() {
  if (!sessionsPromise) {
    sessionsPromise = (async () => {
      // wasmPaths is deliberately left alone: Vite resolves ORT's runtime out
      // of node_modules in dev and emits it into the bundle for the build, so
      // it's already served same-origin either way. Pointing this at a copy
      // under public/ actually breaks dev — Vite refuses to transform public
      // files, and ORT loads its glue via an import Vite rewrites.
      //
      // Threads stay at 1: multi-threaded WASM needs cross-origin isolation
      // headers the app doesn't send. WebGPU is where the speed comes from.
      ort.env.wasm.numThreads = 1;

      const providers = navigator.gpu ? ['webgpu', 'wasm'] : ['wasm'];
      const opts = { executionProviders: providers, graphOptimizationLevel: 'all' };

      const [detector, pose] = await Promise.all([
        ort.InferenceSession.create(`${BASE}/rtmdet-nano.onnx`, opts),
        ort.InferenceSession.create(`${BASE}/rtmpose-m-halpe26.onnx`, opts),
      ]);
      return { detector, pose, backend: providers[0] };
    })();
    sessionsPromise.catch(() => { sessionsPromise = null; }); // allow retry on failure
  }
  return sessionsPromise;
}

// Scratch canvases, reused across every frame of an analysis run — allocating
// a 320x320 and a 192x256 canvas per frame would churn hundreds of them.
let detCanvas = null;
let poseCanvas = null;

function scratch(existing, w, h) {
  if (existing) return existing;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/**
 * Letterbox the frame into 320x320: scale to fit, pad the leftover right/
 * bottom edge with 114 grey, then normalize into a B,G,R planar tensor.
 * Returns the tensor plus the scale factor needed to map boxes back.
 */
function preprocessDetector(video) {
  detCanvas = scratch(detCanvas, DET_SIZE, DET_SIZE);
  const ctx = detCanvas.getContext('2d', { willReadFrequently: true });
  const ratio = Math.min(DET_SIZE / video.videoWidth, DET_SIZE / video.videoHeight);
  const w = Math.floor(video.videoWidth * ratio);
  const h = Math.floor(video.videoHeight * ratio);

  ctx.fillStyle = `rgb(${DET_PAD_VAL},${DET_PAD_VAL},${DET_PAD_VAL})`;
  ctx.fillRect(0, 0, DET_SIZE, DET_SIZE);
  ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, w, h);

  const { data } = ctx.getImageData(0, 0, DET_SIZE, DET_SIZE);
  const plane = DET_SIZE * DET_SIZE;
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i += 1) {
    const p = i * 4;
    out[i] = (data[p + 2] - DET_MEAN_BGR[0]) / DET_STD_BGR[0];             // B
    out[plane + i] = (data[p + 1] - DET_MEAN_BGR[1]) / DET_STD_BGR[1];     // G
    out[2 * plane + i] = (data[p] - DET_MEAN_BGR[2]) / DET_STD_BGR[2];     // R
  }
  return { tensor: new ort.Tensor('float32', out, [1, 3, DET_SIZE, DET_SIZE]), ratio };
}

/**
 * Picks the person box to pose. NMS and score sorting are already baked into
 * the exported graph, so the first person-labelled row is the most confident
 * one. Boxes come back in letterboxed 320x320 space; divide by `ratio` to get
 * source-video pixels.
 */
function pickPersonBox(results, ratio) {
  const dets = results.dets.data;
  const labels = results.labels.data;
  const count = results.dets.dims[1];
  for (let i = 0; i < count; i += 1) {
    if (Number(labels[i]) !== 0) continue; // 0 = person
    const o = i * 5;
    const score = dets[o + 4];
    if (score < DET_SCORE_THRESHOLD) break; // rows are score-sorted
    return {
      x1: dets[o] / ratio,
      y1: dets[o + 1] / ratio,
      x2: dets[o + 2] / ratio,
      y2: dets[o + 3] / ratio,
      score,
    };
  }
  return null;
}

/**
 * Box -> the square-ish source rectangle the pose model wants: expand by 1.25,
 * then stretch the short side until the rect matches the model's 192:256
 * aspect, so the warp never distorts the golfer.
 */
function boxToCropRect(box) {
  const cx = (box.x1 + box.x2) / 2;
  const cy = (box.y1 + box.y2) / 2;
  let w = (box.x2 - box.x1) * BBOX_PADDING;
  let h = (box.y2 - box.y1) * BBOX_PADDING;

  const aspect = POSE_W / POSE_H;
  if (w > h * aspect) h = w / aspect;
  else w = h * aspect;

  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** Warp the crop into 192x256 and normalize into an R,G,B planar tensor. */
function preprocessPose(video, rect) {
  poseCanvas = scratch(poseCanvas, POSE_W, POSE_H);
  const ctx = poseCanvas.getContext('2d', { willReadFrequently: true });

  // The padded rect routinely runs off the edge of the frame. drawImage
  // clips rather than pads, so pre-fill black — which is what the reference
  // cv2.warpAffine pads with.
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, POSE_W, POSE_H);
  ctx.drawImage(video, rect.x, rect.y, rect.w, rect.h, 0, 0, POSE_W, POSE_H);

  const { data } = ctx.getImageData(0, 0, POSE_W, POSE_H);
  const plane = POSE_W * POSE_H;
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i += 1) {
    const p = i * 4;
    out[i] = (data[p] - POSE_MEAN_RGB[0]) / POSE_STD_RGB[0];               // R
    out[plane + i] = (data[p + 1] - POSE_MEAN_RGB[1]) / POSE_STD_RGB[1];   // G
    out[2 * plane + i] = (data[p + 2] - POSE_MEAN_RGB[2]) / POSE_STD_RGB[2]; // B
  }
  return new ort.Tensor('float32', out, [1, 3, POSE_H, POSE_W]);
}

/**
 * SimCC decode. Instead of a heatmap, RTMPose predicts each joint's X and Y
 * as two 1-D probability strips at 2x resolution; the peak bin of each strip,
 * halved, is the coordinate in crop space. Confidence is the mean of the two
 * peak heights. A non-positive peak means the joint wasn't found at all.
 */
function decodeSimcc(simccX, simccY, rect) {
  const [, numKeypoints, binsX] = simccX.dims;
  const binsY = simccY.dims[2];
  const xs = simccX.data;
  const ys = simccY.data;

  const scaleX = rect.w / POSE_W;
  const scaleY = rect.h / POSE_H;
  const out = [];

  for (let k = 0; k < numKeypoints; k += 1) {
    let bestX = 0;
    let maxX = -Infinity;
    for (let b = 0; b < binsX; b += 1) {
      const v = xs[k * binsX + b];
      if (v > maxX) { maxX = v; bestX = b; }
    }
    let bestY = 0;
    let maxY = -Infinity;
    for (let b = 0; b < binsY; b += 1) {
      const v = ys[k * binsY + b];
      if (v > maxY) { maxY = v; bestY = b; }
    }

    const score = (maxX + maxY) / 2;
    const found = maxX > 0 && maxY > 0;
    out.push({
      x: rect.x + (bestX / SIMCC_SPLIT_RATIO) * scaleX,
      y: rect.y + (bestY / SIMCC_SPLIT_RATIO) * scaleY,
      score: found ? score : 0,
    });
  }
  return out;
}

/**
 * Reshape Halpe26 keypoints into the 33-slot BlazePose array the rest of the
 * app indexes into. Untouched slots (face, hands) stay at zero visibility so
 * the renderer's visibility check skips them, same as an undetected joint.
 *
 * `score` becomes `visibility`, clamped to [0,1] — SimCC peaks are unbounded
 * logits, and downstream code compares visibility against a 0-1 threshold.
 */
function toBlazePoseSlots(keypoints, videoWidth, videoHeight) {
  const landmarks = Array.from({ length: BLAZEPOSE_SLOT_COUNT }, () => ({
    x: 0, y: 0, z: 0, visibility: 0,
  }));
  for (const [src, dest] of HALPE26_TO_BLAZEPOSE) {
    const kp = keypoints[src];
    if (!kp) continue;
    landmarks[dest] = {
      x: kp.x / videoWidth,
      y: kp.y / videoHeight,
      z: 0, // RTMPose is 2D — no depth, see the note on `world` below
      visibility: Math.max(0, Math.min(1, kp.score)),
    };
  }
  return landmarks;
}

/**
 * Detect one frame. Returns `{ landmarks, world }` shaped exactly like the
 * MediaPipe path's cache entries. `world` is always null: RTMPose is a 2-D
 * model, so the metrics derived from 3-D world coordinates (shoulder turn,
 * hip turn) have nothing to compute from and correctly report as unavailable.
 */
export async function detectRtmpose(sessions, video) {
  const { tensor: detInput, ratio } = preprocessDetector(video);
  const detOut = await sessions.detector.run({ input: detInput });
  const box = pickPersonBox(detOut, ratio);
  if (!box) return { landmarks: null, world: null };

  const rect = boxToCropRect(box);
  const poseInput = preprocessPose(video, rect);
  const poseOut = await sessions.pose.run({ input: poseInput });
  const keypoints = decodeSimcc(poseOut.simcc_x, poseOut.simcc_y, rect);

  return {
    landmarks: toBlazePoseSlots(keypoints, video.videoWidth, video.videoHeight),
    world: null,
  };
}
