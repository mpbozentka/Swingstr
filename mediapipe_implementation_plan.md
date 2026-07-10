# MediaPipe Pose Analysis — Implementation Plan

Research + phased plan for adding computer-vision swing analysis to Swingstr.
Written 2026-07-10.

## Decision

**Use MediaPipe Pose Landmarker** (Google, free, runs entirely in-browser).

The 33 landmarks it tracks are not a downside — we simply don't draw the face
and hand points. Nothing else that runs client-side offers what it does:

- **3D world coordinates** per landmark, not just flat 2D pixels. This is what
  lets us estimate rotation (shoulder turn from a face-on view), where a pure
  2D model can't tell rotation from foreshortening.
- Per-landmark confidence/visibility scores.
- No server, no upload, no subscription — keeps Swingstr's privacy-focused,
  everything-stays-local design intact.
- A `detectForVideo()` mode built for stepping through video frames with
  timestamps.

### Alternatives considered

| Option | Verdict |
|---|---|
| **MoveNet Thunder** (TensorFlow.js) | 17 keypoints, fast, but **2D only** — no rotation data. Kills it for golf. |
| **Sportsbox.ai** | Proves the category works on iPhone slo-mo video, but proprietary, mocap-trained, app-only. No API to plug into Swingstr. |

### Expectation-setting

MediaPipe won't match Sportsbox's biomechanics numbers (pelvis sway in inches,
chest turn in true degrees — that needs their mocap-trained model). What we
*can* get reliably: stick-figure overlay, 2D angles (spine tilt, shoulder
line, hip line, lead-arm angle, knee flex), rough 3D rotation estimates, and
Gears-style angle-over-time graphs. For a lesson-tee teaching aid, that's the
useful 80%.

## Core architecture: analyze once, play back instantly

When the user hits "Analyze," run a one-time pass over the (trimmed) video:
step frame by frame, run pose detection, smooth the jitter, cache the skeleton
per frame. Takes roughly 10–30 seconds with a progress bar on an M1 Mac.
After that, playback and scrubbing just look up the cached skeleton for the
current time — zero lag at any scrub speed. (Same model Sportsbox uses:
analyze, then explore.)

iPhone slo-mo imports work fine — they export as normal video files, and more
frames per second of real motion actually improves tracking.

## Phase 0 — Trim in/out points (prerequisite, in progress)

Slo-mo clips have 10+ seconds of dead time around a ~2-second swing. Trimming
first means the analysis pass only processes the swing.

**Virtual trim, not re-encoding.** The file stays untouched; an in-point and
out-point define the active range. Playback loops within it, scrubbing clamps
to it, timeline regions outside the trim are shaded. Instant, reversible, and
the analysis pass later reads the same range.

UI: set-start / set-end / clear buttons, same pattern as the existing L/R
sync-point buttons. Scrub to just before the takeaway → set start; scrub to
just after the finish → set end.

Files touched:
1. **App.jsx** — trim state per side (like syncPoints), cleared when a video
   is cleared/replaced.
2. **AnalyzerView.jsx** — trim buttons in the header + shaded cut regions on
   the timeline.
3. **VideoCanvas.jsx** — enforce trim during playback (loop back at
   out-point, clamp seeks).
4. **ScreenPane.jsx** — pass-through props.

## Phase 1 — Skeleton overlay

- Add `@mediapipe/tasks-vision` (one new dependency, Google's official
  package). Ship the pose model file (`.task`) in `public/` so nothing loads
  from a CDN at analysis time.
- "Analyze" button per video pane. Steps through the trimmed range
  (seek → wait for `seeked` → `detectForVideo()`), smooths landmark jitter
  (moving average or One-Euro filter), caches results keyed by timestamp.
- Draw the stick figure on the existing annotation canvas, synced to playback
  and scrubbing. Filter to the ~17 body points that matter — no face mesh, no
  fingers.

## Phase 2 — Live angle readouts

- User tags each video as **down-the-line** or **face-on** (two-button
  choice; auto-detection can come later).
- Per view, show relevant angles updating live during playback:
  - **DTL:** spine angle, knee flex, arm/shaft plane.
  - **Face-on:** shoulder tilt, hip line, head position, lead-arm angle.

## Phase 3 — Gears-style graphs

- Collapsible panel under the video: angle traces across the whole swing with
  a playhead line that tracks scrubbing. Click a point on the graph → video
  jumps there.
- Comparison mode: with two videos split-screen, overlay both traces
  (before/after, or student vs. model) on one graph.

## Phase 4 — Later, if the basics earn it

- Auto-detect swing positions (address, top, impact, finish) from the motion
  data so P-position markers get set automatically.

## Practical notes

- Everything runs locally in the browser; GPU-accelerated via WebAssembly/
  WebGPU on the M1.
- Cached analysis could be persisted alongside saved student videos
  (IndexedDB) so re-opening a saved swing doesn't re-analyze. Decide when we
  get there.

## Sources

- [MediaPipe Pose Landmarker web guide](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js)
- [Pose Landmarker overview](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker)
- [@mediapipe/tasks-vision on npm](https://www.npmjs.com/package/@mediapipe/tasks-vision)
- [BlazePose research blog](https://research.google/blog/on-device-real-time-body-pose-tracking-with-mediapipe-blazepose/)
- [Pose model comparison](https://medium.com/@zh.milo/recent-research-on-pose-detection-models-blazepose-movenet-and-more-7be0e30778d8)
- [Sportsbox AI](https://www.sportsbox.ai/)
