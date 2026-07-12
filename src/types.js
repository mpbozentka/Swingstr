/**
 * Shared JSDoc typedefs. Lower-cost alternative to a full TypeScript
 * migration — VS Code will infer these inside files that import or reference
 * them via `@type` annotations. (#18)
 */

/**
 * @typedef {{ x: number, y: number }} Point
 */

/**
 * Per-side marker. `index` is 0..9 (matches the keyboard shortcut and the
 * ordering of DEFAULT_MARKER_LABELS).
 *
 * @typedef {Object} Marker
 * @property {string} id
 * @property {number} index
 * @property {number} time     - Seconds into the video
 * @property {string} label    - Display label ("P1"…"P10")
 */

/**
 * @typedef {'line' | 'rect' | 'circle' | 'blur' | 'free' | 'angle'} ShapeType
 */

/**
 * Discriminated union over shape types. Some fields are only present on
 * certain types — `start`/`end` for line/rect/circle/blur, `points` for free,
 * `p1`/`p2`/`p3` for angle.
 *
 * @typedef {Object} Shape
 * @property {ShapeType} type
 * @property {string} color
 * @property {number} width
 * @property {Point} [start]
 * @property {Point} [end]
 * @property {Point[]} [points]
 * @property {Point} [p1]
 * @property {Point} [p2]
 * @property {Point} [p3]
 */

/**
 * @typedef {Object} VideoRecord
 * @property {string} id
 * @property {string} label
 * @property {string} date
 * @property {'idb' | 'remote'} source
 * @property {string} [videoId]   - IndexedDB key when source==='idb'
 * @property {string} [remoteUrl] - http(s) URL when source==='remote'
 * @property {boolean} [legacy]   - Migrated v1 record with no recoverable URL
 */

/**
 * @typedef {Object} Student
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string} phone
 * @property {VideoRecord[]} videos
 * @property {string} notes
 */

/**
 * Letterbox rect (in container/canvas pixels) where the video is actually
 * drawn after object-contain. Used to map shape coords ↔ video-pixel coords
 * during snapshot/sequence export.
 *
 * @typedef {{ x: number, y: number, w: number, h: number }} VideoRect
 */

export {};
