/**
 * Persistence layer for Swingstr.
 *
 * Browser:
 *   - localStorage: small, structured metadata (students, video records).
 *     Versioned so we can migrate the shape over time without crashing on load.
 *   - IndexedDB:    raw video Blobs. Blob URLs are tied to document lifetime,
 *     so a URL stored in localStorage is a dead pointer after refresh. We keep
 *     the actual Blob in IDB and reconstruct an object URL on demand.
 *
 * Desktop app:
 *   - ~/Documents/Swingstr Library/students.json
 *   - ~/Documents/Swingstr Library/videos/<Student Name>/<label>__<id>.mp4
 */

function desktopApi() {
  return typeof window !== 'undefined' ? window.swingstrDesktop : null
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

async function idbPut(key, blob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
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
 * video on disk — the app still finds it by id either way. The browser has no
 * folders to file it in, so IndexedDB ignores it.
 */
export async function saveVideoBlob(videoId, blob, meta) {
  const desktop = desktopApi();
  if (desktop?.saveVideo) {
    const buffer = await blob.arrayBuffer();
    await desktop.saveVideo(videoId, buffer, extForBlob(blob), meta);
    return;
  }
  await idbPut(videoId, blob);
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
  if (parsed && parsed.version === SCHEMA_VERSION) return parsed;
  return { version: SCHEMA_VERSION, students: DEFAULT_STUDENTS };
}

export function loadStudents() {
  const desktop = desktopApi();
  if (desktop?.loadStudents) {
    try {
      const payload = desktop.loadStudents();
      if (payload) return migrate(payload).students;
    } catch (err) {
      console.warn('[storage] failed to read desktop library; falling back', err);
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

export function saveStudents(students) {
  const payload = { version: SCHEMA_VERSION, students };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[storage] failed to persist students', err);
  }
  const desktop = desktopApi();
  if (desktop?.saveStudents) {
    desktop.saveStudents(payload).catch((err) => {
      console.warn('[storage] failed to write desktop library', err);
    });
  }
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
