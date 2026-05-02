/**
 * Persistence layer for Swingstr.
 *
 * Two stores:
 *   - localStorage: small, structured metadata (students, video records).
 *     Versioned so we can migrate the shape over time without crashing on load.
 *   - IndexedDB:    raw video Blobs. Blob URLs are tied to document lifetime,
 *     so a URL stored in localStorage is a dead pointer after refresh. We keep
 *     the actual Blob in IDB and reconstruct an object URL on demand.
 */

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

export async function saveVideoBlob(videoId, blob) {
  await idbPut(videoId, blob);
}

export async function loadVideoBlob(videoId) {
  return idbGet(videoId);
}

export async function deleteVideoBlob(videoId) {
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
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ version: SCHEMA_VERSION, students })
    );
  } catch (err) {
    console.warn('[storage] failed to persist students', err);
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
