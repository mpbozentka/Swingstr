# MediaPipe Pose Analysis — Implementation Spec

Research + phased implementation spec for adding computer-vision swing
analysis to Swingstr. Written 2026-07-10, updated after Phase 0 shipped.

This document is written so any competent model or developer can implement it
without re-deriving decisions. Follow it exactly; deviations should be flagged
to Mitch, not silently improvised. When something in the codebase contradicts
this doc, trust the code and say so.

---

## 1. Decision and rationale

**Use MediaPipe Pose Landmarker** (`@mediapipe/tasks-vision`, Google, free,
Apache-2.0, runs entirely in-browser).

The 33 landmarks it tracks are not a downside — we simply don't draw or use
the face and hand points. Nothing else client-side offers:

- **3D world coordinates** per landmark (meters, hip-centered origin), not
  just 2D pixels. This is what lets us estimate rotation (e.g. shoulder turn
  from a face-on view), where a pure 2D model can't distinguish rotation from
  foreshortening.
- Per-landmark `visibility` score (0–1) for hiding low-confidence points.
- No server, no upload, no subscription — preserves Swingstr's
  privacy-focused, everything-stays-local design.
- `detectForVideo()` mode built for stepping through video frames.

### Alternatives considered (do not revisit)

| Option | Verdict |
|---|---|
| MoveNet Thunder (TensorFlow.js) | 17 keypoints, fast, but **2D only** — no rotation data. Rejected. |
| Sportsbox.ai | Proves the category works on iPhone slo-mo, but proprietary, mocap-trained, app-only. No API. |

### Expectation-setting

MediaPipe will NOT match Sportsbox's biomechanics numbers (pelvis sway in
inches, chest turn in true degrees — that needs a mocap-trained model). What
we CAN get reliably: stick-figure overlay, 2D angles (spine tilt, shoulder
line, hip line, lead-arm angle, knee flex), rough 3D rotation estimates, and
Gears-style angle-over-time graphs. Do not promise or label outputs as
mocap-grade measurements.

---

## 2. Codebase context (read before writing code)

Stack: Vite + React 19 (JS, not TS), Tailwind, no state library. Plain JS
with JSDoc typedefs in `src/types.js`. Videos are `<video>` elements fed by
blob/object URLs (local upload, Google Drive fetch) or remote URLs.

Key files and patterns the implementation must reuse:

- **`src/App.jsx`** — top-level state owner. Everything (playback, sync,
  trims, markers) lives here as `useState` and flows down as props. Left and
  right video panes are addressed via `leftRef` / `rightRef`, which expose an
  imperative handle (see below). Per-side state uses the shape
  `{ left: ..., right: ... }` keyed by side string (`'left'` / `'right'`).
- **`src/components/VideoCanvas.jsx`** — owns the `<video>` element and the
  annotation `<canvas>`. Exposes via `useImperativeHandle`: `play`, `pause`,
  `seekRelative(s)`, `seekTo(t)` (both clamp to trim), `setPlaybackRate`,
  `clearShapes`, `getSnapshot`, `captureFrameAtTime(t)`, `getShapes`,
  `hasVideo`, getters `currentTime` / `duration`.
  - **Pattern: ref mirrors.** Props/state that imperative handlers or async
    loops need are mirrored into refs (`shapesRef`, `trimRef`) so closures
    never go stale. Follow this pattern for anything the analysis loop reads.
  - **`captureFrameAtTime(t)`** already implements the seek-and-wait recipe:
    pause → set `currentTime` → await `'seeked'` event (once) → await two
    nested `requestAnimationFrame`s so the frame is actually decoded → draw
    to an offscreen canvas. The analysis loop uses the same recipe.
  - **`computeVideoRect(vid, container)`** maps the letterboxed video into
    container pixels: `{ x, y, w, h }`. Landmarks are normalized [0,1] video
    coordinates, so canvas position = `videoRect.x + lm.x * videoRect.w`,
    `videoRect.y + lm.y * videoRect.h`. Reuse this — do not write a second
    letterbox calculation.
  - The `draw()` callback renders all shapes each frame inside a
    save/translate/scale block for pan+zoom. Skeleton drawing goes inside
    this same transform block so it pans/zooms with the video.
- **`src/components/AnalyzerView.jsx`** — pure presentation; header, panes,
  footer timeline. Trim buttons (In/Out/clear, emerald) sit after the
  duration label in the timeline row — the Analyze button goes in this
  cluster too.
- **`src/components/ScreenPane.jsx`** — thin wrapper, spreads unknown props
  into VideoCanvas. New per-pane props usually need no change here.
- **Trim state (Phase 0, shipped):** `trims = { left: { start, end }, right:
  { start, end } }` in App.jsx, values in seconds or null. Passed to panes as
  `trimStart` / `trimEnd`. VideoCanvas keeps them in `trimRef` and enforces
  loop-back via a rAF loop. **The analysis pass must read the trim and only
  process `[trimStart ?? 0, trimEnd ?? duration]`.**
- **Toasts:** `setToast({ message, kind: 'error' | 'success' })` in App.jsx.
  Use for analysis failures. Fail loud — no silent catch-and-continue.
- **Styling:** Tailwind only, dark theme (`bg-gray-800/900`, purple accent
  `purple-500/600`, amber = sync, emerald = trim). Suggest **sky/cyan** as
  the pose-feature accent so features stay visually distinguishable.
- Existing lint errors in `DrivePickerModal.jsx` and `EditStudentModal.jsx`
  are pre-existing; don't fix them in a pose PR, and don't add new ones.

Workflow rules (from Mitch's global config — non-negotiable): work on a new
branch; stage but don't commit until Mitch confirms testing; explain changes
in plain English; ask before adding dependencies beyond the ones this doc
already approves; never commit `.env`-like files.

### Rules for the implementing agent (also non-negotiable)

1. **One phase per session, then stop.** Implement exactly the phase Mitch
   asked for, run lint + build, stage the changes, summarize in plain
   English what to test and how, and STOP. Do not start the next phase, do
   not "get a head start" on later sections. Mitch tests manually; the task
   isn't done until he says so.
2. **No subagents, no parallel work.** Do not spawn agents, background
   tasks, or parallel workstreams for any part of this plan. One focused
   session working sequentially is the intended (and cheapest) path.
3. **Three-strikes rule on bugs.** If you've attempted the same bug three
   times without clear progress, STOP. Do not keep looping on variations.
   Tell Mitch: what the bug is, what you tried, and that he should re-run
   this in a stronger model (`/model fable` or `/model opus`). A stuck
   session burns more tokens than a model switch.
4. **When reality contradicts this doc** (an API changed, a file moved, a
   step doesn't work as written), say so explicitly and ask before
   improvising. Do not silently deviate from the spec.

---

## 3. Core architecture: analyze once, play back instantly

One-time analysis pass per video → cached per-frame landmarks → playback and
scrubbing just look up the cache. Never run detection live during playback
(too slow at slo-mo frame counts, and scrubbing would stutter).

```
[Analyze button] → seek-step through trimmed range
                 → detectForVideo() per step
                 → smooth landmark trajectories
                 → cache: Array<{ t, landmarks, worldLandmarks }>
[Playback/scrub] → binary-search cache by currentTime
                 → draw skeleton + compute angles from cached frame
```

Cache invalidation: the cache belongs to a specific video source. Key it by
the `src` string (object URLs are unique per load). Clear it when the video
is cleared or replaced. Changing the trim after analysis leaves the cache
valid (it just covers a wider/narrower range than the new trim) — offer
re-analysis but don't force it.

---

## 4. Phase 0 — Trim in/out points ✅ SHIPPED (2026-07-10)

Virtual (non-destructive) per-side trim. In/Out buttons in the timeline row,
shaded cut regions on the timeline, playback loops inside the window, seeks
clamp. See `git log 177faca` and Section 2 for where it lives. The only thing
later phases need from it: read `trims[side]` to bound the analysis range.

---

## 5. Phase 1 — Skeleton overlay

### 5.1 Dependency and assets (approved — no need to re-ask)

```bash
npm install @mediapipe/tasks-vision
```

Two asset groups must be served **same-origin** (privacy requirement — no
CDN loading at runtime):

1. **WASM runtime:** copy `node_modules/@mediapipe/tasks-vision/wasm/*` into
   `public/mediapipe/wasm/`. (A `postinstall` script or a one-time manual copy
   is fine; document whichever in the README.)
2. **Model file:** download `pose_landmarker_full.task` (~9 MB) from Google's
   model page (https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker#models)
   into `public/mediapipe/pose_landmarker_full.task`.
   - Use **full**, not lite (jittery) and not heavy (~30 MB, marginal gain).
   - If the file is too big for the repo's taste, gitignore it and add a
     fetch script — but keep runtime loading same-origin.

### 5.2 Landmarker setup (new file: `src/utils/poseLandmarker.js`)

```js
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

let landmarkerPromise = null; // singleton — model load is ~1s, do it once

export function getPoseLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
      return PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: '/mediapipe/pose_landmarker_full.task',
          delegate: 'GPU', // falls back to CPU automatically if unavailable
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    })();
    landmarkerPromise.catch(() => { landmarkerPromise = null; }); // allow retry
  }
  return landmarkerPromise;
}
```

Gotchas:
- `detectForVideo(videoEl, timestampMs)` **requires strictly increasing
  timestamps** across calls on the same landmarker instance. Use
  `Math.round(t * 1000)` from video time and, because a *second* analysis
  (other pane, or re-run) would restart at a smaller timestamp, keep a
  module-level monotonic counter: `ts = Math.max(lastTs + 1, Math.round(t*1000)); lastTs = ts;`
  Failing this throws or silently returns empty results depending on version.
- Only ONE analysis may run at a time (GPU contention + the timestamp rule).
  Guard with a module-level `isAnalyzing` flag; disable both Analyze buttons
  while true.
- Result shape: `result.landmarks[0]` = 33 `{x, y, z, visibility}` normalized
  to the video frame; `result.worldLandmarks[0]` = 33 `{x, y, z, visibility}`
  in meters, hip-midpoint origin. Either array can be empty (no person
  detected) — store `null` for that frame and skip it when drawing.

### 5.3 Landmark subset (body only — the answer to "I don't need 33 points")

Indices used (BlazePose numbering). Everything else (0–10 face, 17–22
hands/fingers) is ignored entirely:

| Index | Point | Index | Point |
|---|---|---|---|
| 11 | left shoulder | 12 | right shoulder |
| 13 | left elbow | 14 | right elbow |
| 15 | left wrist | 16 | right wrist |
| 23 | left hip | 24 | right hip |
| 25 | left knee | 26 | right knee |
| 27 | left ankle | 28 | right ankle |
| 29 | left heel | 30 | right heel |
| 31 | left foot index | 32 | right foot index |

Skeleton connections to draw (pairs of indices):

```
[11,12], [11,13], [13,15], [12,14], [14,16],   // shoulders + arms
[11,23], [12,24], [23,24],                     // torso
[23,25], [25,27], [24,26], [26,28],            // legs
[27,29], [29,31], [27,31], [28,30], [30,32], [28,32]  // feet
```

Plus two derived points: shoulder midpoint ((11+12)/2) and hip midpoint
((23+24)/2), connected as the "spine" segment. Skip drawing any point or
segment whose endpoint `visibility < 0.5`.

Put indices, connections, and drawing constants in a new
`src/constants/pose.js`.

### 5.4 Analysis pass (new hook: `src/hooks/usePoseAnalysis.js`)

State per side: `{ status: 'idle'|'analyzing'|'done'|'error', progress: 0–1,
frames: Array<Frame> | null }` where
`Frame = { t: number, landmarks: Array|null, world: Array|null }`.

Algorithm (mirrors the existing `captureFrameAtTime` recipe):

1. Read the video element via the pane ref. Abort with a toast if no video.
2. `wasPlaying = !vid.paused`; pause. Remember `resumeTime = vid.currentTime`.
3. Range: `start = trims[side].start ?? 0`, `end = trims[side].end ?? vid.duration`.
4. Step size: `1/30` s. (iPhone slo-mo exports play at 30 or 60 fps on the
   timeline regardless of capture fps; 30 samples/s of *playback* time is
   plenty because the motion is already slowed. Do NOT try to read the true
   frame rate — the browser doesn't expose it reliably.)
5. Loop `t` from start to end:
   - `vid.currentTime = t`; `await` the `'seeked'` event (`{ once: true }`);
     `await` two nested rAFs (decode settle — same as captureFrameAtTime).
   - `const res = landmarker.detectForVideo(vid, monotonicTs(t))`
   - Push `{ t, landmarks: res.landmarks[0] ?? null, world: res.worldLandmarks[0] ?? null }`.
   - Update `progress = (t - start) / (end - start)` — but throttle state
     updates to ~every 5th frame to avoid re-render churn.
   - Check an `abortRef` each iteration so a Cancel button / video clear can
     stop the loop cleanly.
6. Smooth (5.5), set `status: 'done'`, restore `vid.currentTime = resumeTime`,
   resume playback if `wasPlaying`.
7. Wrap the whole thing in try/catch → toast the error message, `status: 'error'`.

Expected duration: a 15 s slo-mo clip trimmed to 4 s ≈ 120 frames ≈ 15–40 s
on an M1 (seek latency dominates, not inference). This is why the trim
feature exists — analysis MUST respect it.

### 5.5 Smoothing

Exponential moving average per coordinate, applied index-by-index across
frames after the pass (simpler than One-Euro and adequate here):

```
smoothed[i] = alpha * raw[i] + (1 - alpha) * smoothed[i-1]   // alpha = 0.5
```

Apply to both `landmarks` and `world`. Reset the EMA chain whenever a frame
has `null` landmarks (don't smooth across detection gaps). Keep `visibility`
unsmoothed (take the raw value).

### 5.6 Drawing the overlay

In `VideoCanvas.draw()`, after shapes render (inside the same
pan/zoom-transformed context):

1. New props: `poseFrames` (the cached array or null) and `showSkeleton`
   (bool). Mirror `poseFrames` into a ref (existing pattern).
2. Find the frame: binary search `poseFrames` for greatest `t <=
   vid.currentTime` (frames are sorted; linear scan is acceptable at ~120
   frames but write the binary search — it's 10 lines).
3. For each connection pair, if both endpoints' `visibility >= 0.5`, draw a
   line from `(videoRect.x + a.x * videoRect.w, videoRect.y + a.y * videoRect.h)`
   to the same mapping of `b`. Then draw a small filled circle per point.
4. Style: 2px lines (`/zoomLevel` like existing handle code), color
   `#38bdf8` (sky-400), points 3px radius white fill. Skeleton draws UNDER
   user shapes (call it before the shapes loop) so telestration stays on top.
5. The existing rAF-per-draw-change effect only redraws when React state
   changes; during playback the trim-enforcement rAF loop already runs — add
   `draw()` (or a redraw trigger) to that loop when `showSkeleton` is on so
   the skeleton tracks the playhead between React renders.

### 5.7 UI wiring

- **Analyze button** per pane: in the timeline-row control cluster
  (AnalyzerView), acts on the active screen like the trim buttons. Lucide
  icon: `Activity` or `PersonStanding`. States: idle ("Analyze"), analyzing
  (spinner + % from progress, plus a Cancel affordance), done (toggles
  skeleton visibility on/off — sky accent when visible).
- State lives in App.jsx via `usePoseAnalysis` (per-side, same
  `{left, right}` shape as trims); VideoCanvas gets `poseFrames` +
  `showSkeleton` per side through ScreenPane's prop spread.
- Clearing/replacing a video clears its analysis (wire into
  `handleSourceClear`, exactly where trim reset lives).

### 5.8 Phase 1 acceptance checklist

- Analyze a trimmed DTL slo-mo clip → progress advances → skeleton appears.
- Scrub anywhere in the trim: skeleton tracks with zero visible lag.
- Play at 0.25x–1x: skeleton stays glued to the golfer (≤ ~1 frame behind).
- Pan/zoom: skeleton moves with the video, not the container.
- No face or finger points drawn anywhere.
- Clip with the golfer walking out of frame: skeleton disappears for those
  frames, no crash, no console spam.
- Second video analyzed after the first (split screen): works; simultaneous
  analysis is impossible (button disabled).
- Clearing the video clears the skeleton and cache.
- `npm run lint` (no NEW errors) and `npm run build` pass.

---

## 6. Phase 2 — Live angle readouts

### 6.1 View tagging

Per-side state in App: `viewType: 'dtl' | 'face-on' | null`. Two-button
toggle next to the Analyze button (labels "DTL" / "FO"). No auto-detection
in this phase. Angles render only when both `viewType` is set and analysis
is done.

### 6.2 Angle math (new file: `src/utils/swingAngles.js`)

All 2D angles from *normalized image* landmarks; correct for aspect ratio
first (`x * videoWidth, y * videoHeight`) or angles will be wrong on
non-square video. Helper:

```js
const deg = (r) => (r * 180) / Math.PI;
// angle of segment a→b measured from vertical (0° = straight up)
function tiltFromVertical(a, b) {
  return deg(Math.atan2(b.x - a.x, -(b.y - a.y))); // y axis points down
}
// interior angle at joint b formed by a–b–c
function jointAngle(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  return deg(Math.acos(
    (v1.x * v2.x + v1.y * v2.y) /
    (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1)
  ));
}
```

**DTL view:** spine angle = `tiltFromVertical(hipMid, shoulderMid)`;
knee flex = `180 - jointAngle(hip, knee, ankle)` per leg (trail leg is the
one nearer the camera — just show both, labeled L/R);
lead-arm/shaft plane is out of scope until club tracking exists — skip.

**Face-on view:** shoulder tilt = `tiltFromVertical`-style angle of the
shoulder line (12→11) from *horizontal* (`deg(Math.atan2(dy, dx))`);
hip line = same for 24→23; lead-arm angle = `jointAngle(shoulder, elbow,
wrist)` on the lead side (lead side = user's golfer handedness — add a
small "RH/LH" toggle defaulting RH, lead arm = left);
head sway = shoulder-midpoint x-drift from its address value (report in %
of frame width, honestly labeled "relative").

**Rotation estimates (3D, both views):** shoulder turn =
`deg(Math.atan2(z12 - z11, x12 - x11))` from *world* landmarks, reported as
"est. turn" — labeled as an estimate in the UI. Same formula on 23/24 for
hip turn.

Skip any metric whose input landmark has `visibility < 0.5` (render "—").

### 6.3 Display

Small readout card overlaid top-left of the pane (under the ACTIVE badge):
metric name + value in mono font, updating from the same cached frame the
skeleton uses. Keep it to ≤ 5 rows per view type. Toggleable with the
skeleton (one button controls both in this phase).

---

## 7. Phase 3 — Gears-style graphs

- Collapsible panel between `<main>` and the footer (height ~160px), one
  chart, hand-rolled SVG — **no chart library** (bundle stays lean; the
  dataviz needs are two polylines and a playhead).
- X axis = time within trim; Y = degrees. One `<polyline>` per metric,
  metric picker as small pill buttons (default: spine angle for DTL,
  shoulder tilt for FO).
- Playhead: vertical line at `globalTime`, updates via the existing
  `onTimeUpdate` flow. Click/drag on the SVG → `seekTo` that time (reuse the
  clamped seek — it already respects trim).
- Split-screen comparison: when both panes are analyzed and share a view
  type, draw both traces (left = sky solid, right = purple solid), legend
  "L" / "R". Time axes normalized 0–100% of each trim so different-length
  swings align; note this normalization visibly in the UI.
- Before building, read the `dataviz` skill (`~/.claude/skills`) for color
  and axis conventions.

---

## 8. Phase 4 — Later (do not build until basics are validated)

Auto-detect swing positions from cached data: address = last near-zero
wrist-speed frame before sustained motion; top = max lead-wrist height
(min y); impact = wrist speed max near return to address height; finish =
motion settles. Wire into the existing markers system (`useMarkers`) as
suggested marker placements, not automatic writes.

---

## 9. Known gotchas (pre-answered so you don't debug them from scratch)

1. **`detectForVideo` timestamps must strictly increase** per landmarker
   instance — see 5.2. Symptom of violation: empty results or thrown
   `INVALID_ARGUMENT`.
2. **Seek-settle:** reading the video element immediately after `seeked`
   can grab the *previous* frame. Always await two nested rAFs after the
   event (existing `captureFrameAtTime` does this — copy it).
3. **HEVC iPhone videos:** Chrome on macOS decodes HEVC only on Apple
   Silicon w/ recent Chrome; Safari always does. If `videoWidth === 0`
   after metadata, toast "Browser can't decode this video format" rather
   than analyzing garbage.
4. **React StrictMode double-invokes effects in dev.** The landmarker
   singleton + `isAnalyzing` guard handle this; don't create the landmarker
   inside a component effect.
5. **Object URLs are per-load unique** — using `src` as the cache key means
   re-loading the same file re-analyzes. Acceptable; do not try to hash file
   contents.
6. **Do not run detection during playback** as a "shortcut" — scrubbing
   backwards violates the timestamp rule and inference can't keep up with
   240fps-origin footage.
7. **GPU delegate failure** (older machines/browsers): MediaPipe falls back
   to CPU automatically but 3–5× slower. Don't special-case it; the
   progress bar covers the UX.
8. **Normalized landmarks ignore letterboxing** — they're relative to the
   video frame, not the container. Always map through `computeVideoRect`.
9. **Aspect ratio in angle math** — normalized coords are anisotropic;
   multiply by video pixel dims before computing angles (6.2) or a 45° spine
   reads as ~56° on a 9:16 video.
10. **Memory:** ~120 frames × 33 landmarks × 2 arrays ≈ trivial (<1 MB).
    Do NOT persist analysis to IndexedDB in these phases — re-analysis is
    cheap enough and persistence adds invalidation complexity. Revisit only
    if Mitch asks.

---

## 10. Sources

- MediaPipe Pose Landmarker web guide — https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js
- Pose Landmarker overview + model files — https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker
- @mediapipe/tasks-vision — https://www.npmjs.com/package/@mediapipe/tasks-vision
- BlazePose research blog — https://research.google/blog/on-device-real-time-body-pose-tracking-with-mediapipe-blazepose/
- Model comparison — https://medium.com/@zh.milo/recent-research-on-pose-detection-models-blazepose-movenet-and-more-7be0e30778d8
- Sportsbox AI (category reference) — https://www.sportsbox.ai/
