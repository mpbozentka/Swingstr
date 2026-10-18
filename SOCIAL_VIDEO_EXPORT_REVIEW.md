# Social video export review · October 14, 2026

Implemented locally. Awaiting Mitchell's personal testing confirmation. Nothing has been staged, committed, pushed, deployed, or published. The existing installed desktop session and its drawings were not changed. The review launcher runs this checkout's current build after the running Swingstr app is quit.

## What is implemented

- Independent per-source checkpoints, strict matched seeks, common-position previous/next navigation in linked/aligned mode, and source-side timeline clicks.
- One virtual selection model used by the segment bar, In/Out controls, playback and exports. Literal source seconds or live checkpoint references; explicit padding; unresolved selections retained for repair. Clearing restores full-source navigation.
- A shared aligned comparison clock, equal speed, union of source-relative intervals, clamped boundaries labeled Held, and cancellation of pending comparison seeks when the user pauses, jumps, draws or changes speed.
- Stable source-relative drawing IDs and geometry, decoded-frame/range/position/throughout-source scopes, a hidden/unresolved drawing list, ID-based removal and updating, and dark palette/custom colors. Numeric angle labels default off. Snapshot and sequence capture share visibility with live/export rendering.
- Shared export recipes, 1/3/5 forward passes encoded into files, half/quarter speed, start/checkpoint/end holds, contain/crop preview, portrait/square/landscape dimensions, optional title/pane labels, clean/annotated modes, progress and cancellation. Output is silent.
- Dedicated export media, fresh annotation painting, decode timeouts/stale-seek rejection, source-generation checks, cleanup and artifact verification. Editor time, playing state, speed, view, zoom and overlays are not borrowed for recording.
- Native exclusive-create output outside the checkout/library, collision suffixes and dialog/configured destinations. Website output uses temporary Blobs and explicit downloads.
- MCP set_marker, remove_marker, seek_position, set_segment, clear_segment, configure_comparison, remove_drawing, start_export, get_export_status and cancel_export. Existing ten tools remain. get_state includes source identity, decoded identity/capability, markers, resolved selections, drawings, comparison and jobs. Human positions are 1–10 at the transport boundary. Start/status/cancel never carry movie bytes through the socket.

## Validation and artifacts

Baseline: 13/13 tests passed, build passed, full lint failed with 129 errors. Final: 24/24 tests pass, build passes, targeted lint for changed JS/JSX passes without warnings, Node syntax checks for native/MCP modules pass, git diff --check passes. Full lint still fails with 127 pre-existing errors, including nested .claude worktrees and unchanged Drive/student/YouTube files. No private videos or students.json appear in dist; nothing is staged.

Synthetic 640×360 numbered footage only. No private student footage was used. Source SHA-256 before/after: `74cb21e6a1f9feb0e9b0fd0a3828f4fd52676ecc5b72f5e1d9c73c75f717d510`.

| Artifact | Dimensions | Actual duration | Recipe | Container/audio |
|---|---|---|---|---|
| Clean | 1920×1080 | 8.365400 s | 1.2 s at half speed, 3 passes, 0.4 s end hold per pass; expected 8.4 s | H.264 MP4, no audio |
| Annotated | 1080×1080 | 8.365267 s | Same duration recipe | H.264 MP4, no audio |
| Comparison | 1080×1920 | 8.365433 s | Independent ranges aligned at P7, 3 passes, 0.4 s end hold per pass | H.264 MP4, no audio |
| Website five passes | 1920×1080 | 12.000000 s | 0.6 s at quarter speed, 5 passes, no holds | H.264 MP4, no audio |
| Start/checkpoint/end holds | 1080×1080 | 3.263700 s | Half speed, one pass, holds 0.2/0.3/0.4 s; expected 3.3 s | H.264 MP4, no audio |
| Forced fallback | 1080×1080 | Packet end 2.799 s | Half speed, 1 pass, 0.4 s end hold; expected 2.8 s | VP9 WebM, no audio; streaming container omits declared duration |

All measured duration errors are within the 100 ms target. ffprobe confirmed codecs, dimensions and absence of audio. Decoded comparison samples show P7 simultaneously (left frame 27 at 0.9 s, right frame 33 at 1.1 s), actual forward restarts in passes two/three, shorter boundaries labeled Held, and no editor controls or numeric angle labels. The VFR frame-only line appears on its selected decoded frame in each pass and is absent in sampled later frames: teal pixel counts 7040/0 at output 0.02/0.30, 2.82/3.10, 5.62/5.90 seconds. Decoded CFR seeks 0.500/0.510 both returned frame 0.500; VFR seeks 0.120/0.190 both returned frame 0.120, and 0.240 returned the next frame.

The real MCP stdio client connected through an isolated same-user Unix socket to an isolated Electron renderer with the actual preload and native saver. Start returned in 2 ms in the final run (3 ms earlier). Concurrent starts were rejected with the active ID, cancel was idempotent, and subsequent exports completed. Left P6 at 0.6 and right P6 at 0.8 sought independently; changing left P6 did not change right P6. Missing right P6 caused neither pane to move. Editor playheads matched before/after exports. Single/split transitions preserved right drawing IDs. Aligned preview play/pause was exercised after the cleanup change.

Replacing a source during render failed the job with an actionable error, and another export succeeded. A simulated decode timeout rejected capture instead of reporting success. Unit tests cover superseded/cancelled seeks and callback cleanup. Native output tests verify original bytes survive filename collisions and reject library/checkout destinations through symlinks. The actual website UI produced the five-pass download with editor time still 0, no IndexedDB databases, and only the existing `swingstr_bar_scale` localStorage entry. Existing smoothing/confidence/storage tests remain passing.

## Samples and testing

- [Clean clip](</Users/mitchellbozentka/Movies/Swingstr Exports/Review-2026-10-14-01a13c90/clean.mp4>)
- [Annotated clip](</Users/mitchellbozentka/Movies/Swingstr Exports/Review-2026-10-14-01a13c90/annotated.mp4>)
- [Matched comparison](</Users/mitchellbozentka/Movies/Swingstr Exports/Review-2026-10-14-01a13c90/comparison.mp4>)
- [Comparison frame sheet](</Users/mitchellbozentka/Movies/Swingstr Exports/Review-2026-10-14-01a13c90/comparison-final-frames.png>)
- [Frame-only VFR clip](</Users/mitchellbozentka/Movies/Swingstr Exports/Review-2026-10-14-01a13c90/frame-only-vfr.mp4>)
- [Five passes at quarter speed](</Users/mitchellbozentka/Movies/Swingstr Exports/Review-2026-10-14-01a13c90/five-passes-quarter-speed.mp4>)
- [Checkpoint holds](</Users/mitchellbozentka/Movies/Swingstr Exports/Review-2026-10-14-01a13c90/checkpoint-holds.mp4>)
- [WebM fallback](</Users/mitchellbozentka/Movies/Swingstr Exports/Review-2026-10-14-01a13c90/fallback.webm>)
- [Double-click review launcher](</Users/mitchellbozentka/Movies/Swingstr Exports/Review-2026-10-14-01a13c90/Open Swingstr Review.command>)
- [Numbered source fixture](</Users/mitchellbozentka/Movies/Swingstr Exports/Review-2026-10-14-01a13c90/numbered-source.mp4>)

1. Quit the currently running Swingstr app, then double-click **Open Swingstr Review.command**. It opens the updated local checkout with the existing native student library. It does not replace the installed app or deploy anything.
2. Open two swings, mark each P5/P6/P7/P8 separately, and use Jump both at P6. Confirm each lands on its own checkpoint. Change only left P6 and confirm right P6 stays put.
3. Select P5→P8 separately in each pane. Align at P7, choose half speed and play. Check tempo, held labels, both restarting together, previous/next positions, and clearing the selection.
4. Pick dark lines/angles and This decoded frame or a checkpoint range. Check visibility as you step, then switch layout and resize. Use the drawing list and Apply to selected to repair scope. Angle number starts off.
5. Export > Video: both, portrait, half speed, three encoded passes, annotated. Inspect the preview crop, record, then play the saved movie with the player's looping disabled. Make a clean version from the same selection. Cancel one recording and record again. Confirm editor time/rate/view and library remain intact.

## Limits and deviations

- Decoded identity uses requestVideoFrameCallback timestamps, not nominal-FPS rounding. Without that capability, frame mode is unavailable and frame drawings stay hidden; explicit time-range scopes remain available.
- VFR evidence covers one synthetic input, not every camera/container. All seven drawing types have geometry/metadata regression checks; actual exported examples use lines and angles. Real high-frame-rate student footage, all crop/zoom combinations, and coach-selected checkpoint placement still need Mitchell's review.
- MediaRecorder encodes in real time at 30 fps. It can drop frames and may skip a very brief selected frame at normal speed on high-frame-rate footage. Use slow motion and inspect the saved movie. Heavy sources/background windows can fail drift/timing checks; a separate native encoder would be the next step if coach testing shows fidelity failures. No encoding service/dependency was added.
- Movie duration is verified by a decoded browser probe before completion, plus ffprobe for the review artifacts. Streaming WebM may omit container duration; its packet-end and decoded duration differ by about one output frame.
- Review artifacts use synthetic footage. This avoids exposing any student while still proving repeat, hold and frame-scope behavior. Original videos and the real native library were not rewritten.
- Preview uses the same recipe through a scrub control; recording is real-time. No audio, anatomical tracking, automatic shaft detection, inferred 3D angles or automatic publishing was added.
- Jobs are in memory for this renderer session. Reloading destroys unfinished renderer work; old IDs return an unknown/interrupted-session error. Refresh MCP tool discovery when launching the updated desktop build.
- Confirmation from Mitchell remains required before any commit, push, deployment or publication. Automated checks are not that confirmation.

## Exact files changed by this implementation

- [README.md](</Users/mitchellbozentka/Projects/golf/Swingstr/README.md>)
- [electron/main.js](</Users/mitchellbozentka/Projects/golf/Swingstr/electron/main.js>)
- [electron/preload.cjs](</Users/mitchellbozentka/Projects/golf/Swingstr/electron/preload.cjs>)
- [electron/exportOutput.mjs](</Users/mitchellbozentka/Projects/golf/Swingstr/electron/exportOutput.mjs>)
- [mcp/tools.mjs](</Users/mitchellbozentka/Projects/golf/Swingstr/mcp/tools.mjs>)
- [src/App.jsx](</Users/mitchellbozentka/Projects/golf/Swingstr/src/App.jsx>)
- [src/components/AnalyzerView.jsx](</Users/mitchellbozentka/Projects/golf/Swingstr/src/components/AnalyzerView.jsx>)
- [src/components/ExportModal.jsx](</Users/mitchellbozentka/Projects/golf/Swingstr/src/components/ExportModal.jsx>)
- [src/components/ScreenPane.jsx](</Users/mitchellbozentka/Projects/golf/Swingstr/src/components/ScreenPane.jsx>)
- [src/components/StyleMenu.jsx](</Users/mitchellbozentka/Projects/golf/Swingstr/src/components/StyleMenu.jsx>)
- [src/components/Timeline.jsx](</Users/mitchellbozentka/Projects/golf/Swingstr/src/components/Timeline.jsx>)
- [src/components/VideoCanvas.jsx](</Users/mitchellbozentka/Projects/golf/Swingstr/src/components/VideoCanvas.jsx>)
- [src/components/SocialExport.jsx](</Users/mitchellbozentka/Projects/golf/Swingstr/src/components/SocialExport.jsx>)
- [src/components/SwingWorkflowControls.jsx](</Users/mitchellbozentka/Projects/golf/Swingstr/src/components/SwingWorkflowControls.jsx>)
- [src/hooks/useSwingWorkflow.js](</Users/mitchellbozentka/Projects/golf/Swingstr/src/hooks/useSwingWorkflow.js>)
- [src/hooks/useSwingstrControl.js](</Users/mitchellbozentka/Projects/golf/Swingstr/src/hooks/useSwingstrControl.js>)
- [src/types.js](</Users/mitchellbozentka/Projects/golf/Swingstr/src/types.js>)
- [src/utils/annotationTiming.js](</Users/mitchellbozentka/Projects/golf/Swingstr/src/utils/annotationTiming.js>)
- [src/utils/decodedVideo.js](</Users/mitchellbozentka/Projects/golf/Swingstr/src/utils/decodedVideo.js>)
- [src/utils/exportPlan.js](</Users/mitchellbozentka/Projects/golf/Swingstr/src/utils/exportPlan.js>)
- [src/utils/shapeRenderer.js](</Users/mitchellbozentka/Projects/golf/Swingstr/src/utils/shapeRenderer.js>)
- [src/utils/swingSequenceExport.js](</Users/mitchellbozentka/Projects/golf/Swingstr/src/utils/swingSequenceExport.js>)
- [src/utils/videoClipExport.js](</Users/mitchellbozentka/Projects/golf/Swingstr/src/utils/videoClipExport.js>)
- [tests/control.test.mjs](</Users/mitchellbozentka/Projects/golf/Swingstr/tests/control.test.mjs>)
- [tests/decodedVideo.test.mjs](</Users/mitchellbozentka/Projects/golf/Swingstr/tests/decodedVideo.test.mjs>)
- [tests/exportOutput.test.mjs](</Users/mitchellbozentka/Projects/golf/Swingstr/tests/exportOutput.test.mjs>)
- [tests/exportPlan.test.mjs](</Users/mitchellbozentka/Projects/golf/Swingstr/tests/exportPlan.test.mjs>)
- [SOCIAL_VIDEO_EXPORT_REVIEW.md](</Users/mitchellbozentka/Projects/golf/Swingstr/SOCIAL_VIDEO_EXPORT_REVIEW.md>) (this report)

Pre-existing tracked changes to package.json and package-lock.json were preserved and not edited by this implementation. The original MCP additions in README.md, electron/main.js, electron/preload.cjs, App.jsx and VideoCanvas.jsx were extended in place. The untracked mcp/server.mjs, mcp/transport.mjs and src/utils/controlShapes.js were preserved; mcp/tools.mjs, useSwingstrControl.js and tests/control.test.mjs were extended. SOCIAL_VIDEO_EXPORT_HANDOFF.md was read and retained unchanged. No file was deleted, reset, discarded or staged.

Next action: Mitchell tests the local build and reports any functional failure or confirms testing. Work remains uncommitted and undeployed.
