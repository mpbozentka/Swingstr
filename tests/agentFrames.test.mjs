import test from 'node:test';
import assert from 'node:assert/strict';
import { frameAt, frameStartTime, frameInfo, outputSize, gridLines, sheetLayout } from '../src/utils/agentFrames.js';
import { portableDrawings, upsertTemplate, findTemplate, serializeDrawings } from '../src/utils/swingAnnotations.js';
import { validateCommand } from '../mcp/tools.mjs';

test('seeking to a frame lands on that same frame for common phone rates', () => {
  for (const fps of [23.976, 29.97, 30, 59.94, 60, 119.88, 120, 240]) {
    for (const frame of [0, 1, 37, 214, 999]) assert.equal(frameAt(frameStartTime(frame, fps), fps), frame, `${fps} fps frame ${frame}`);
  }
});

test('frame info counts from the playhead like the scrubber and says when fps is unknown', () => {
  // A stale decoded timestamp from before a seek must not change the count.
  assert.deepEqual(frameInfo({ time: 2.001, frame: { mediaTime: 0 } }, 60), { fps: 60, frameIndex: 120 });
  assert.deepEqual(frameInfo({ time: 1.0, frame: { unsupported: true } }, 60), { fps: 60, frameIndex: 60 });
  assert.equal(frameInfo({ time: 1 }, null).frameIndex, null);
});

test('crop and size cap give the source rectangle and a proportional image', () => {
  const full = outputSize(undefined, 1920, 1080);
  assert.deepEqual([full.width, full.height, full.scale], [1920, 1080, 1]);
  const capped = outputSize(undefined, 1920, 1080, 640);
  assert.deepEqual([capped.width, capped.height], [640, 360]);
  const hands = outputSize({ x: 0.25, y: 0.5, w: 0.25, h: 0.25 }, 1920, 1080, 4000);
  assert.deepEqual([hands.sx, hands.sy, hands.width, hands.height, hands.scale], [480, 540, 480, 270, 1]);
});

test('grid lines are labelled in whole-video coordinates inside the crop', () => {
  const full = gridLines(undefined, 10);
  assert.equal(full.step, 0.1);
  assert.deepEqual(full.xs, [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
  const zoomed = gridLines({ x: 0.42, y: 0.3, w: 0.2, h: 0.1 }, 8);
  assert.equal(zoomed.step, 0.025);
  assert.equal(zoomed.xs[0], 0.425);
  assert.ok(zoomed.xs.every((v) => v >= 0.42 && v <= 0.62));
  assert.ok(zoomed.ys.every((v) => v >= 0.3 && v <= 0.4));
});

test('contact sheet layout fits every tile', () => {
  const sheet = sheetLayout(10, 320, 180);
  assert.equal(sheet.columns, 4);
  assert.equal(sheet.rows, 3);
  assert.deepEqual(sheet.tiles[4], { x: 0, y: 184 });
  assert.equal(sheetLayout(3, 100, 100, 8).columns, 3);
});

test('copying drawings to another video drops ids and keeps P-position ranges', () => {
  const { drawings, convertedToWholeSwing } = portableDrawings([
    { id: 'a', sourceId: 'blob:1', type: 'line', visibility: { kind: 'all' } },
    { id: 'b', type: 'line', visibility: { kind: 'frame', mediaTime: 1.2 } },
    { id: 'c', type: 'angle', visibility: { kind: 'positions', from: 0, to: 3 } },
  ]);
  assert.equal(convertedToWholeSwing, 1);
  assert.ok(drawings.every((d) => d.id == null && d.sourceId == null));
  assert.deepEqual(drawings.map((d) => d.visibility.kind), ['all', 'all', 'positions']);
  assert.deepEqual(serializeDrawings([{ id: 'x', sourceId: 'blob:2', type: 'line' }]), [{ id: 'x', type: 'line' }]);
});

test('templates are matched by name and never silently overwritten', () => {
  const one = upsertTemplate([], { name: 'Face-on iron address', drawings: [] });
  assert.throws(() => upsertTemplate(one, { name: 'face-on IRON address ', drawings: [{}] }), /already exists/);
  const replaced = upsertTemplate(one, { name: 'face-on iron address', drawings: [{}] }, { replace: true });
  assert.equal(replaced.length, 1);
  assert.equal(findTemplate(replaced, 'FACE-ON IRON ADDRESS').drawings.length, 1);
  assert.throws(() => findTemplate(replaced, 'dtl'), /Saved templates: face-on iron address/);
  assert.throws(() => findTemplate([], 'dtl'), /No templates are saved yet/);
});

test('new agent commands validate their inputs', () => {
  assert.doesNotThrow(() => validateCommand('get_frame', { crop: { x: 0.4, y: 0.5, w: 0.2, h: 0.2 }, grid: true, maxWidth: 640 }));
  assert.throws(() => validateCommand('get_frame', { crop: { x: 0.9, y: 0, w: 0.2, h: 0.5 } }));
  assert.throws(() => validateCommand('get_frame', { maxWidth: 10 }));
  assert.doesNotThrow(() => validateCommand('get_frames', { frameRange: { from: 200, to: 215 } }));
  assert.doesNotThrow(() => validateCommand('get_frames', { positions: [1, 4, 7], tileWidth: 240, columns: 3 }));
  assert.throws(() => validateCommand('get_frames', {}));
  assert.throws(() => validateCommand('get_frames', { frames: [1], times: [0.5] }));
  assert.throws(() => validateCommand('get_frames', { frameRange: { from: 0, to: 100 } }), /more than 24/);
  assert.doesNotThrow(() => validateCommand('get_frames', { frameRange: { from: 0, to: 100, step: 5 } }));
  assert.doesNotThrow(() => validateCommand('playback', { action: 'seek', frame: 214 }));
  assert.throws(() => validateCommand('playback', { action: 'seek', frame: 214, seconds: 1 }));
  assert.throws(() => validateCommand('playback', { action: 'step', frames: 1, frame: 3 }));
  assert.doesNotThrow(() => validateCommand('set_marker', { side: 'left', position: 4, frame: 120 }));
  assert.throws(() => validateCommand('set_marker', { side: 'left', position: 4 }));
  assert.throws(() => validateCommand('set_marker', { side: 'left', position: 4, frame: 1, time: 1 }));
  assert.doesNotThrow(() => validateCommand('save_annotations', { side: 'left', notes: 'P7 shaft lean' }));
  assert.doesNotThrow(() => validateCommand('load_annotations', { studentId: 's', swingId: 'v', mode: 'add' }));
  assert.throws(() => validateCommand('save_template', { name: ' ' }));
  assert.doesNotThrow(() => validateCommand('apply_template', { side: 'right', name: 'face-on iron address' }));
});
