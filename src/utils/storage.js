/**
 * Persistence layer for Swingstr.
 *
 * Browser:
 *   - Videos are loaded temporarily for analysis. Library saving is disabled.
 *   - Existing browser library data is left untouched.
 *
 * Desktop app:
 *   - ~/Documents/Swingstr Library/students.json
 *   - ~/Documents/Swingstr Library/videos/<Student Name>/<label>__<id>.mp4
 */

function desktopApi() {
  return typeof window !== 'undefined' ? window.swingstrDesktop : null
}

export function videoSavingEnabled() {
  const desktop = desktopApi();
  return Boolean(desktop?.enabled && desktop?.saveVideo && desktop?.saveStudents);
}

function extForBlob(blob) {
  const name = typeof blob?.name === 'string' ? blob.name : ''
  const named = name.match(/\.(mp4|mov|webm|m4v|avi)$/i)
  if (named) return named[0].toLowerCase()
  const type = blob?.type || ''
  if (type.includes('webm')) return '.webm'
  if (type.includes('quicktime')) return '.mov'
  return '.mp4'
}

const LS_KEY = 'swingstr_students';
const SCHEMA_VERSION = 2;

const IDB_NAME = 'swingstr';
const IDB_STORE = 'videos';
const IDB_VERSION = 1;

const DEFAULT_STUDENTS = [
  {
    id: 'demo-student',
    name: 'Demo Student',
    email: 'demo@golf.com',
    phone: '555-0123',
    videos: [],
    notes: 'Working on takeaway path.',
  },
];

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * `meta` ({ studentName, label }) only shapes where the desktop app files the
 * video on disk. The website cannot save videos to a library.
 */
export async function saveVideoBlob(videoId, blob, meta) {
  if (!videoSavingEnabled()) {
    throw new Error('Video saving is available only in the desktop app.');
  }
  const desktop = desktopApi();
  const buffer = await blob.arrayBuffer();
  await desktop.saveVideo(videoId, buffer, extForBlob(blob), meta);
}

export async function loadVideoBlob(videoId) {
  const desktop = desktopApi();
  if (desktop?.loadVideo) {
    const result = await desktop.loadVideo(videoId);
    if (!result?.buffer) return null;
    return new Blob([result.buffer]);
  }
  return idbGet(videoId);
}

export async function deleteVideoBlob(videoId) {
  const desktop = desktopApi();
  if (desktop?.deleteVideo) {
    await desktop.deleteVideo(videoId);
    return;
  }
  return idbDelete(videoId);
}

/**
 * Migrate a pre-versioned or v1 students payload up to the current schema.
 * v1 stored a `url` (blob URL string) on each video, which dies on refresh —
 * those records can no longer be played, so we strip the dead URL field and
 * mark them as legacy so the UI can warn.
 */
function migrate(parsed) {
  if (Array.isArray(parsed)) {
    return {
      version: SCHEMA_VERSION,
      students: parsed.map((s) => ({
        ...s,
        id: String(s.id),
        videos: (s.videos || []).map((v) => {
          const { url, ...rest } = v;
          const base = { ...rest, id: String(rest.id ?? '') };
          if (url && !v.videoId) return { ...base, legacy: true };
          return base;
        }),
      })),
    };
  }
  if (Array.isArray(parsed?.students)) return { ...parsed, version: SCHEMA_VERSION };
  // Anything else is a file we don't understand. Treating it as "no
  // students" would let the next save overwrite it, so refuse instead.
  throw new Error('the student library is in a format Swingstr does not recognise');
}

// Set when the desktop library exists but couldn't be read. While set, the
// app shows an empty list and never saves, so the file on disk is left alone.
let loadError = null;

export function libraryLoadError() {
  return loadError;
}

export function loadStudents() {
  loadError = null;
  if (!videoSavingEnabled()) return DEFAULT_STUDENTS;
  const desktop = desktopApi();
  if (desktop?.loadStudents) {
    try {
      const payload = desktop.loadStudents();
      if (payload?.loadError) throw new Error(payload.loadError);
      if (payload) return migrate(payload).students;
    } catch (err) {
      console.error('[storage] failed to read desktop library; saving is paused', err);
      loadError = err.message;
      return [];
    }
  }
  if (typeof localStorage === 'undefined') return DEFAULT_STUDENTS;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_STUDENTS;
    const parsed = JSON.parse(raw);
    return migrate(parsed).students;
  } catch (err) {
    console.warn('[storage] failed to parse stored students; using defaults', err);
    return DEFAULT_STUDENTS;
  }
}

/**
 * Returns a promise that rejects if the desktop library write fails, so the
 * caller can tell the user. Does nothing while a failed load is unresolved.
 */
export async function saveStudents(students) {
  if (!videoSavingEnabled()) return;
  if (loadError) {
    console.warn('[storage] not saving: the student library failed to load');
    return;
  }
  const payload = { version: SCHEMA_VERSION, students };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[storage] failed to persist students', err);
  }
  const desktop = desktopApi();
  if (desktop?.saveStudents) await desktop.saveStudents(payload);
}

/* ──────────────────────────────────────────────────────────────────────────
 * Object URL registry
 * Blob URLs are leaked unless explicitly revoked; this keeps a small map
 * keyed by an arbitrary slot name so callers can register/replace/release
 * without managing the URL lifecycle by hand.
 * ────────────────────────────────────────────────────────────────────────── */
const urlRegistry = new Map();

export function registerObjectUrl(slot, blobOrFile) {
  releaseObjectUrl(slot);
  const url = URL.createObjectURL(blobOrFile);
  urlRegistry.set(slot, url);
  return url;
}

export function releaseObjectUrl(slot) {
  const prev = urlRegistry.get(slot);
  if (prev) {
    URL.revokeObjectURL(prev);
    urlRegistry.delete(slot);
  }
}

export function releaseAllObjectUrls() {
  for (const url of urlRegistry.values()) URL.revokeObjectURL(url);
  urlRegistry.clear();
}
