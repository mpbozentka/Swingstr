import test from 'node:test';
import assert from 'node:assert/strict';
import { samplePose, measureHeadShift, assessTarget, smoothPoseFrames, drawPose } from '../src/utils/practiceMetrics.js';

function pose(headX = 0.5, headY = 0.2) {
  const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  points[7] = points[8] = { x: headX, y: headY, visibility: 0.9 };
  points[11] = { x: 0.4, y: 0.4, visibility: 0.9 };
  points[12] = { x: 0.6, y: 0.4, visibility: 0.9 };
  points[23] = { x: 0.4, y: 0.6, visibility: 0.9 };
  points[24] = { x: 0.6, y: 0.6, visibility: 0.9 };
  return points;
}
const markers = [{ index: 0, time: 0 }, { index: 3, time: 1 }];
const analysis = { width: 1000, height: 2000, frames: [{ t: 0, landmarks: pose() }, { t: 1, landmarks: pose(0.54, 0.18) }] };

test('head movement uses pixel aspect ratio and address torso length', () => {
  // A 400 px torso and a 40 px shift must be 10%, even in a portrait clip.
  assert.ok(Math.abs(measureHeadShift(analysis, markers, 3, 'horizontal').value - 10) < 1e-8);
  assert.ok(Math.abs(measureHeadShift(analysis, markers, 3, 'vertical').value - 10) < 1e-8);
  const resized = { ...analysis, width: 500, height: 1000 };
  assert.ok(Math.abs(measureHeadShift(resized, markers, 3, 'horizontal').value - 10) < 1e-8);
});

test('unreliable landmarks and missing, reversed, or uncovered markers cannot produce feedback', () => {
  const hiddenHead = pose(); hiddenHead[7] = { ...hiddenHead[7], visibility: 0.2 };
  const unclear = { ...analysis, frames: [{ t: 0, landmarks: hiddenHead }, analysis.frames[1]] };
  assert.match(measureHeadShift(unclear, markers, 3, 'horizontal').error, /unclear/);
  assert.match(measureHeadShift(analysis, [], 3, 'horizontal').error, /Set P1/);
  assert.match(measureHeadShift(analysis, [{ index: 0, time: 1 }, { index: 3, time: 0 }], 3, 'horizontal').error, /after P1/);
  assert.match(measureHeadShift(analysis, [markers[0], { index: 3, time: 2 }], 3, 'horizontal').error, /unclear/);
});

test('replay interpolation preserves conservative confidence and does not bridge detection gaps', () => {
  const a = pose(), b = pose(0.6); b[7].visibility = 0.7;
  const frames = [{ t: 0, landmarks: a }, { t: 0.1, landmarks: b }];
  assert.equal(samplePose(frames, 0.05)[7].x, 0.55);
  assert.equal(samplePose(frames, 0.05)[7].visibility, 0.7);
  assert.equal(samplePose(frames, -0.01), null);
  assert.equal(samplePose(frames, 0.11), null);
  assert.equal(samplePose([{ t: 0, landmarks: a }, { t: 0.1, landmarks: null }], 0.05), null);
  assert.equal(samplePose([{ t: 0, landmarks: a }, { t: 0.2, landmarks: b }], 0.1), null);
});

test('coach targets are explicit, ordered, inclusive, and directionally accurate', () => {
  assert.match(assessTarget({ value: 0 }, '', '', 3, 'horizontal').error, /both ends/);
  assert.match(assessTarget({ value: 0 }, 'nope', 10, 3, 'horizontal').error, /both ends/);
  assert.match(assessTarget({ value: 0 }, 10, -10, 3, 'horizontal').error, /lower target/);
  assert.equal(assessTarget({ value: -10 }, -10, 10, 3, 'horizontal').inZone, true);
  assert.equal(assessTarget({ value: 10 }, -10, 10, 3, 'horizontal').inZone, true);
  const outside = assessTarget({ value: -11 }, -10, 10, 6, 'vertical');
  assert.equal(outside.inZone, false);
  assert.match(outside.text, /P7: 11.0% down from P1/);
  assert.match(outside.text, /Outside your target/);
});

test('stationary joints do not zigzag with alternating frame-estimate noise', () => {
  const frames = Array.from({ length: 15 }, (_, i) => ({
    t: i / 30, landmarks: pose(0.5 + (i % 2 ? 0.008 : -0.008)),
  }));
  const smooth = smoothPoseFrames(frames);
  for (let i = 2; i < frames.length - 2; i++) {
    assert.ok(Math.abs(samplePose(smooth, frames[i].t)[7].x - 0.5) < 0.002,
      'Reduce visible stationary-joint jitter without a trailing filter');
  }
});

test('smoothing preserves fast linear movement without shifting frame times', () => {
  const frames = Array.from({ length: 15 }, (_, i) => ({
    t: i / 30, landmarks: pose(0.15 + i * 0.05, 0.2 + i * 0.03),
  }));
  const snapshot = structuredClone(frames), smooth = smoothPoseFrames(frames);
  for (let i = 2; i < frames.length - 2; i++) {
    assert.ok(Math.abs(smooth[i].landmarks[7].x - frames[i].landmarks[7].x) < 1e-10);
    assert.ok(Math.abs(smooth[i].landmarks[7].y - frames[i].landmarks[7].y) < 1e-10);
    assert.equal(smooth[i].t, frames[i].t);
  }
  assert.deepEqual(frames, snapshot, 'Keep raw frame estimates intact');
});

test('smoothing does not restore missing detections or upgrade low confidence', () => {
  const low = pose(0.9); low[7].visibility = 0.2;
  const frames = [
    { t: 0, landmarks: pose(0.5) },
    { t: 1 / 30, landmarks: low },
    { t: 2 / 30, landmarks: null },
    { t: 3 / 30, landmarks: pose(0.5) },
    { t: 1, landmarks: pose(0.9) },
  ];
  const smooth = smoothPoseFrames(frames);
  assert.equal(smooth[1].landmarks[7].visibility, 0.2);
  assert.equal(smooth[2].landmarks, null);
  assert.ok(Math.abs(smooth[0].landmarks[7].x - 0.5) < 1e-10, 'Unclear neighbors must not pull a confident head');
  assert.ok(Math.abs(smooth[3].landmarks[7].x - 0.5) < 1e-10, 'Do not blend across a detection or timestamp gap');
});

test('near-cutoff limbs fade instead of blinking fully on, and stay hidden below cutoff', () => {
  const strokeOpacity = [];
  const ctx = {
    save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, fill() {},
    stroke() { strokeOpacity.push(this.globalAlpha); },
  };
  const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  points[11].visibility = 0.95;
  points[13].visibility = 0.66;
  drawPose(ctx, points, { x: 0, y: 0, w: 100, h: 100 }, 1);
  assert.equal(strokeOpacity.length, 1);
  assert.ok(strokeOpacity[0] < 0.1, 'An uncertain arm must not pop on at full opacity');
  strokeOpacity.length = 0;
  points[13].visibility = 0.64;
  drawPose(ctx, points, { x: 0, y: 0, w: 100, h: 100 }, 1);
  assert.equal(strokeOpacity.length, 0);
});
