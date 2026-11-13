import test from 'node:test';
import assert from 'node:assert/strict';
import { loadStudents, saveStudents, saveVideoBlob, videoSavingEnabled, libraryLoadError } from '../src/utils/storage.js';

function browserGlobal(t, name, value) {
  const original = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, name, original);
    else delete globalThis[name];
  });
}

test('website cannot persist clips or video links and does not touch an existing library', async (t) => {
  browserGlobal(t, 'window', {});
  const unexpectedStorage = () => { throw new Error('Website touched persistent library storage'); };
  browserGlobal(t, 'localStorage', { getItem: unexpectedStorage, setItem: unexpectedStorage });
  browserGlobal(t, 'indexedDB', { open: unexpectedStorage });

  assert.equal(videoSavingEnabled(), false);
  await assert.rejects(saveVideoBlob('clip', new Blob(['video'])), /only in the desktop app/);
  saveStudents([{ id: 'student', videos: [
    { source: 'idb', videoId: 'clip' },
    { source: 'drive', driveFileId: 'drive-clip' },
    { source: 'remote', remoteUrl: 'https://example.com/clip.mp4' },
  ] }]);
  assert.deepEqual(loadStudents().flatMap((student) => student.videos), []);
});

test('desktop library can still save and reopen videos and student records', async (t) => {
  const students = [{ id: 'student', name: 'Test Student', videos: [{ videoId: 'clip' }] }];
  const saveVideo = t.mock.fn(async () => {});
  const saveRecords = t.mock.fn(async () => {});
  browserGlobal(t, 'window', { swingstrDesktop: {
    enabled: true,
    saveVideo,
    saveStudents: saveRecords,
    loadStudents: () => ({ version: 2, students }),
  } });
  browserGlobal(t, 'localStorage', { setItem() {} });

  assert.equal(videoSavingEnabled(), true);
  const clip = new Blob(['video'], { type: 'video/mp4' });
  const meta = { studentName: 'Test Student', label: 'Swing' };
  await saveVideoBlob('clip', clip, meta);
  assert.deepEqual(saveVideo.mock.calls[0].arguments, ['clip', await clip.arrayBuffer(), '.mp4', meta]);
  saveStudents(students);
  assert.deepEqual(saveRecords.mock.calls[0].arguments, [{ version: 2, students }]);
  assert.deepEqual(loadStudents(), students);
});

test('an unreadable desktop library pauses saving instead of overwriting it', async (t) => {
  const saveRecords = t.mock.fn(async () => {});
  const setItem = t.mock.fn();
  browserGlobal(t, 'localStorage', { setItem, getItem: () => null });
  for (const payload of [{ loadError: 'students.json could not be read' }, { version: 99, somethingElse: true }]) {
    browserGlobal(t, 'window', { swingstrDesktop: {
      enabled: true,
      saveVideo: async () => {},
      saveStudents: saveRecords,
      loadStudents: () => payload,
    } });
    assert.deepEqual(loadStudents(), []);
    assert.ok(libraryLoadError());
    await saveStudents([{ id: 'demo-student', name: 'Demo Student', videos: [] }]);
  }
  assert.equal(saveRecords.mock.callCount(), 0);
  assert.equal(setItem.mock.callCount(), 0);
});

test('a failed desktop write is reported to the caller', async (t) => {
  browserGlobal(t, 'localStorage', { setItem() {} });
  browserGlobal(t, 'window', { swingstrDesktop: {
    enabled: true,
    saveVideo: async () => {},
    saveStudents: async () => { throw new Error('disk full'); },
    loadStudents: () => ({ version: 2, students: [] }),
  } });
  loadStudents();
  await assert.rejects(saveStudents([]), /disk full/);
});
