import test from 'node:test';
import assert from 'node:assert/strict';
import { seekDecoded } from '../src/utils/decodedVideo.js';
class TestVideo extends EventTarget {
  currentTime = 0;
  readyState = 2;
  callbacks = new Map();
  nextId = 0;
  requestVideoFrameCallback(fn) { const id = ++this.nextId; this.callbacks.set(id, fn); return id; }
  cancelVideoFrameCallback(id) { this.callbacks.delete(id); }
}
test('a superseded decoded seek cannot return stale success', async () => {
  const video = new TestVideo();
  const first = seekDecoded(video, .2);
  const rejected = assert.rejects(first, /newer request/);
  const second = seekDecoded(video, .4);
  video.callbacks.get(1)(0, { mediaTime: .2, presentedFrames: 1 });
  video.callbacks.get(2)(0, { mediaTime: .4, presentedFrames: 2 });
  await rejected;
  assert.equal((await second).mediaTime, .4);
  assert.equal(video.callbacks.size, 0);
});
test('cancelled decoded seeks release their callback and reject', async () => {
  const video = new TestVideo(), controller = new AbortController();
  const pending = seekDecoded(video, 1, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(video.callbacks.size, 0);
});
