import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSegment, annotationVisible, validateVisibility } from '../src/utils/annotationTiming.js';
import { resolveExportPlan, mapExportTime } from '../src/utils/exportPlan.js';
import { calculateAngle, renderShape } from '../src/utils/shapeRenderer.js';
import { mapShape } from '../src/utils/controlShapes.js';
import { updateShapeWithHandle, getHandlesForShape, hitTestShape } from '../src/utils/shapeEditing.js';
import { validateCommand } from '../mcp/tools.mjs';
const source = (start = 0.3, end = 1.5, anchor = 1) => ({ ready: true, duration: 3, sourceId: 'test', selection: { kind: 'times', start, end }, markers: [{ index: 4, time: start }, { index: 6, time: anchor }, { index: 7, time: end }], drawings: [] });

test('selections preserve checkpoint references, reject invalid bounds and clamp padding', () => {
  const markers = [{ index: 4, time: 0.2 }, { index: 7, time: 1.5 }];
  assert.deepEqual(resolveSegment({ kind: 'positions', from: 4, to: 7, paddingBefore: 2, paddingAfter: 2 }, markers, 3), { start: 0, end: 3 });
  markers[1].time = 2;
  assert.equal(resolveSegment({ kind: 'positions', from: 4, to: 7 }, markers, 3).end, 2);
  for (const [start, end] of [[2, 1], [1, 1], [NaN, 1], [-1, 1], [0, 4]]) assert.throws(() => resolveSegment({ kind: 'times', start, end }, [], 3));
  assert.throws(() => resolveSegment({ kind: 'positions', from: 4, to: 7 }, [], 3), /Mark P5 and P8/);
});
test('literal ranges are half-open and frames require exact decoded timestamps', () => {
  const frameShape = { visibility: { kind: 'frame', mediaTime: .5 } };
  assert.equal(annotationVisible(frameShape, { time: .5, frame: { mediaTime: .5 } }), true);
  assert.equal(annotationVisible(frameShape, { time: .5, frame: { mediaTime: .533333 } }), false);
  assert.equal(annotationVisible(frameShape, { time: .5 }), false);
  assert.equal(annotationVisible({ visibility: { kind: 'range', start: .5, end: 1 } }, { time: 1 }), false);
  assert.equal(annotationVisible({ visibility: { kind: 'positions', from: 4, to: 7 } }, { time: 1, frame: { mediaTime: 1 }, markers: [{ index: 4, time: .5 }, { index: 7, time: 1 }] }), true);
  assert.equal(annotationVisible({ visibility: { kind: 'positions', from: 4, to: 7 } }, { time: .7, markers: [] }), false);
  assert.equal(annotationVisible({}, { time: 9 }), true);
});
test('repeats encode forward passes with holds in output seconds', () => {
  const plan = resolveExportPlan({ speed: .5, repeats: 3, holds: { endSeconds: .4 } }, { left: source() });
  assert.ok(Math.abs(plan.expectedDuration - 8.4) < 1e-9);
  assert.equal(mapExportTime(plan, 2.6)[0].time, 1.5);
  assert.ok(Math.abs(mapExportTime(plan, 2.8)[0].time - .3) < 1e-9);
  const coincident = resolveExportPlan({ holds: { startSeconds: .2, checkpoint: { position: 5, seconds: .4 }, endSeconds: .1 } }, { left: source() });
  assert.ok(Math.abs(coincident.expectedDuration - 1.9) < 1e-9);
  assert.equal(coincident.phases.filter((p) => p.kind === 'hold' && p.from === 0).length, 1);
});
test('comparison uses union, equal tempo and explicit held boundaries', () => {
  const plan = resolveExportPlan({ source: 'both', speed: .5 }, { left: source(.2, 1.8, 1), right: source(.8, 2, 1.2) }, { mode: 'aligned', anchorPosition: 7 });
  assert.equal(plan.passDuration, 3.2);
  const first = mapExportTime(plan, 0); assert.equal(first[1].held, true);
  const impact = mapExportTime(plan, 1.6); assert.ok(Math.abs(impact[0].time - 1) < 1e-9); assert.ok(Math.abs(impact[1].time - 1.2) < 1e-9);
  assert.throws(() => resolveExportPlan({ source: 'both', holds: { checkpoint: { position: 5, seconds: 1 } } }, { left: source(), right: source(.8, 2, 1.2) }, { mode: 'aligned', anchorPosition: 7 }), /coincide/);
  assert.throws(() => resolveExportPlan({ source: 'both' }, { left: source(), right: source(.8, 1.1, 1.2) }, { mode: 'aligned', anchorPosition: 7 }), /inside/);
});
test('angle defaults are hidden, geometry and metadata survive editing', () => {
  const shape = { type: 'angle', p1: { x: .1, y: .2 }, p2: { x: .9, y: .2 }, p3: { x: .9, y: .8 }, color: '#155e75', width: 3, id: 'stable', visibility: { kind: 'all' } };
  const px = mapShape(shape, ({x,y})=>({x:x*1920,y:y*1080}));
  assert.notEqual(calculateAngle(px.p1,px.p2,px.p3),calculateAngle(shape.p1,shape.p2,shape.p3));
  assert.equal(updateShapeWithHandle(px,'p2',{x:50,y:60}).id,'stable');
  let labels=0; const ctx = new Proxy({}, { get: (_obj,key)=>key==='fillText'?()=>labels++:()=>{}, set:()=>true });
  renderShape(ctx,px,{zoomLevel:1}); assert.equal(labels,0);
  renderShape(ctx,{...px,showAngleLabel:true},{zoomLevel:1}); assert.equal(labels,1);
});
test('MCP strict schemas reject scope, destination and recipe errors', () => {
  assert.throws(()=>validateCommand('set_marker',{position:6,time:1}));
  assert.throws(()=>validateCommand('set_segment',{side:'left',selection:{kind:'positions',from:0,to:8}}));
  const args={source:'left',preset:'portrait',speed:.5,repeats:3,annotations:'clean'};
  assert.throws(()=>validateCommand('start_export',{...args,destination:'/private/source.mp4'}));
  assert.throws(()=>validateCommand('start_export',{...args,holds:{endSeconds:4}}));
  assert.throws(()=>validateCommand('start_export',{...args,framing:{left:{crop:{x:.5,y:0,w:.8,h:1}}}}));
});

test('all shapes retain normalized content geometry, IDs and scope across differently sized video rectangles', () => {
  for (const type of ['line', 'vline', 'rect', 'blur', 'circle', 'free', 'angle']) {
    const base = { type, id: type, visibility: { kind: 'range', start: .2, end: .8 }, width: 3, color: '#155e75', start: { x: .2, y: .3 }, end: { x: .7, y: .8 }, p1: { x: .2, y: .3 }, p2: { x: .7, y: .3 }, p3: { x: .7, y: .8 }, points: [{ x: .2, y: .3 }, { x: .7, y: .8 }] };
    for (const r of [{ x: 350, y: 0, w: 600, h: 900 }, { x: 0, y: 200, w: 1920, h: 1080 }]) {
      const shown = mapShape(base, ({ x, y }) => ({ x: r.x + x * r.w, y: r.y + y * r.h }));
      const restored = mapShape(shown, ({ x, y }) => ({ x: (x - r.x) / r.w, y: (y - r.y) / r.h }));
      assert.equal(restored.id, base.id); assert.deepEqual(restored.visibility, base.visibility); assert.equal(restored.width, 3);
      assert.ok(Math.abs(restored.start.x - base.start.x) < 1e-12); assert.ok(Math.abs(restored.end.y - base.end.y) < 1e-12);
    }
  }
});

test('drawing scopes reject unavailable precision and out-of-source timing', () => {
  assert.throws(() => validateVisibility({ kind: 'frame', mediaTime: .5 }, 3, false), /unsupported/);
  assert.throws(() => validateVisibility({ kind: 'range', start: 2, end: 4 }, 3, true), /source duration/);
  assert.throws(() => validateVisibility({ kind: 'positions', from: 4.5, to: 7 }, 3, true), /positions/);
});

test('emoji stamps remain selectable, movable, resizable and render at export resolution', () => {
  for (const emoji of ['✅', '❌']) {
    const shape = { type: 'emoji', emoji, id: 'stamp', color: '#ff3333', width: 3,
      start: { x: .2, y: .3 }, end: { x: .3, y: .4 }, visibility: { kind: 'all' } };
    const shown = mapShape(shape, ({ x, y }) => ({ x: x * 1000, y: y * 1000 }));
    assert.equal(hitTestShape({ x: 250, y: 350 }, shown, 1), true);
    assert.equal(hitTestShape({ x: 500, y: 500 }, shown, 1), false);
    assert.equal(getHandlesForShape(shown, 1).length, 5);
    const moved = updateShapeWithHandle(shown, 'move', { x: 500, y: 600 });
    assert.deepEqual(moved.start, { x: 450, y: 550 });
    assert.deepEqual(moved.end, { x: 550, y: 650 });
    const resized = updateShapeWithHandle(moved, 'br', { x: 650, y: 750 });
    assert.equal(resized.emoji, emoji);
    assert.equal(resized.id, 'stamp');
    assert.deepEqual(resized.visibility, shape.visibility);
    const calls = [];
    const ctx = { save() {}, restore() {}, beginPath() {}, fillText(...args) { calls.push(args); } };
    renderShape(ctx, resized, { zoomLevel: 1 });
    assert.deepEqual(calls, [[emoji, 550, 650]]);
    assert.match(ctx.font, /^200px "Apple Color Emoji"/);
    const exported = mapShape(resized, ({ x, y }) => ({ x: x * 2, y: y * 2 }));
    renderShape(ctx, exported, { zoomLevel: 1 });
    assert.deepEqual(calls[1], [emoji, 1100, 1300]);
    assert.match(ctx.font, /^400px/);
  }
});
