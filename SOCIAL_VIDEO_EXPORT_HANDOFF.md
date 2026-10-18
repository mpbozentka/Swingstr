# Swingstr: short swing clips, timed drawings, matched positions, and social export

Implementation handoff prepared October 14, 2026. This is a plan, not a report of implemented features.

## Assignment and success criteria

Extend Swingstr so Mitchell can select a short part of a swing, loop it, draw only on the relevant frames, compare independently marked positions in two swings, and export the result through either the interface or MCP.

The primary acceptance workflow is:

1. Open two saved swings, mark each video's P5, P6, P7, and P8 independently.
2. Jump both panes to their own P6 without changing either set of markers.
3. Draw on the arms with dark colors and no numeric angle labels. Make drawings appear only at a chosen frame or over a chosen interval.
4. Select P5 through P8 for each pane without modifying either original video.
5. Preview at half speed, with an optional impact alignment and visible indication of any frozen boundary frames.
6. Export a portrait comparison with annotations and three actual repetitions. The downloaded file plays those repetitions in an ordinary player with looping disabled.
7. Produce a clean version from the same selection. Restore the analysis view after success, cancellation, or failure.

Do not implement automatic anatomical tracking, shaft detection, or inferred 3D shoulder/hip rotation as part of this assignment. Timed drawings are manually positioned annotations; they do not automatically follow moving arms. A coach must validate checkpoint locations and drawings.

## Authority, repository, and preservation rules

- Working folder: `/Users/mitchellbozentka/Documents/ChatGPT/Swingstr`, currently resolving to `/Users/mitchellbozentka/Projects/golf/Swingstr`.
- Read the applicable `AGENTS.md` files before editing. Present a brief implementation plan before changing more than three files.
- Preserve all existing work. At inspection, these tracked files were modified: `README.md`, `electron/main.js`, `electron/preload.cjs`, `package-lock.json`, `package.json`, `src/App.jsx`, and `src/components/VideoCanvas.jsx`. These paths were untracked: `mcp/`, `src/hooks/useSwingstrControl.js`, `src/utils/controlShapes.js`, and `tests/control.test.mjs`. Inspect the current diff; this inventory may change.
- Do not reset, overwrite, stage, or discard another agent's work. Never delete files without asking Mitchell.
- Implementation and local validation are the intended next assignment. Do not commit until Mitchell confirms testing. Do not deploy or publish social posts.
- Keep saved videos and private student-library data out of Git and deployment uploads. Do not erase the local library as cleanup.
- Desktop library saving remains native-only. The website must not persist videos or video links into a student library, IndexedDB, or localStorage. Temporary analysis and user-initiated exports remain available on the website.
- Preserve the existing centered pose smoothing and confidence handling. This feature does not require changing pose measurements.
- Use synthetic test footage for committed fixtures. Real student footage is for local manual verification only.

## Verified starting point

These findings describe the inspected working tree, including its uncommitted MCP work. Recheck before implementation.

| Area | Existing behavior | Required change |
| --- | --- | --- |
| `src/App.jsx` | Per-pane trim boundaries, speed, sync points, P markers, and marker navigation already exist. | Extend these models and controls; do not create a second trim system. |
| `src/hooks/useMarkers.js` | P1–P10 use indices 0–9. Marker IDs are regenerated when set. | Refer to checkpoints by source identity plus position index, not the generated marker ID. |
| Marker setting | `setMarkerLinked` can copy a marker into the other pane when sync is enabled. | Default to independent marking; never silently overwrite the other swing's checkpoint. |
| Marker navigation | `mirrorSeekToMarker` uses the other pane's matching marker, then falls back to a timestamp offset. | Add strict matched-position navigation that reports missing markers instead of substituting timestamps. |
| `src/components/Timeline.jsx` | Shows markers, trim shading, and sync points on the active pane's clock. | Preserve marker side identity when clicking; consistently transform other-pane times into the active clock. |
| `src/components/VideoCanvas.jsx` | Implements virtual trim loops and exposes snapshots, frame capture, shapes, and export rendering. | Coordinate playback ownership and share time-aware drawing rendering across all capture paths. |
| Drawing geometry | Shapes are stored in pane/container pixels; MCP maps normalized source coordinates into that space. | Keep annotations attached to video content through resize, crop, layout changes, and exports. |
| `src/utils/shapeRenderer.js` | Angle drawings always render a numeric label. | Add an explicit label-display setting; default new angle drawings to no number. |
| `src/utils/videoClipExport.js` | Records live canvas playback, one pass, silent, MP4 if supported or WebM fallback. | Explicit selections, repetitions, holds, framing, clean/annotated output, cancellation, and reliable cleanup. |
| `src/components/ExportModal.jsx` | Video range is earliest/latest markers plus a 0.5-second pad, requiring two markers. Preview video loops. | User chooses the range and actual output repetitions; preview looping must not be confused with repeated footage. |
| `src/utils/swingSequenceExport.js` | Captures independent row times and renders annotations into PNG/JPEG sequences. | Apply the same drawing visibility and angle-label rules as live playback and video export. |
| `mcp/tools.mjs` and `useSwingstrControl.js` | Playback, shapes, view, frame capture, and opening saved swings exist. | Add marker, segment, comparison, timed-drawing, and asynchronous export controls. |
| `mcp/transport.mjs` | Private Unix socket, 16 MB message cap, 20-second command timeouts. | Export must return a job ID promptly; never hold a command open for the entire render or send video bytes over this socket. |

Current export risks to fix within this work: seeking can time out and continue with a stale frame; playback trim loops can interfere with recording; video export copies the live overlay canvas; restoration stores paused state but does not fully restore it. A completed export must never be reported after a failed frame capture.

## Product decisions and defaults

Use these defaults unless a verified platform limitation requires a documented adjustment:

- Selection: per-pane source start/end, optionally bound to marked positions. P5→P8 is the example, not a mandatory selection for every clip.
- Padding: zero by default. Allow explicit before/after padding from 0 to 2 seconds, clamped to source duration and displayed in the preview.
- Preview speed: 1×, 0.5×, 0.25×. Export speed is explicit and shown in the recipe.
- Export repetitions: 1, 3, or 5. Default 1. Repetition count means repeats encoded into the file.
- Output: clean or annotated. Default annotated when drawings exist; otherwise clean.
- Drawing palette: dark teal `#155e75`, dark rust `#9a3412`, dark brown `#854d0e`. Keep custom colors available. Optional thin contrasting outline is acceptable if needed for legibility; do not replace these with bright default colors.
- New angle drawings: numeric label off. Users may explicitly enable it. Existing shapes without this metadata should also render with numbers off for this workflow.
- Existing drawings without timing metadata: visible throughout their source, preserving their current behavior. New drawings default to “This frame” once reliable frame timing is available. Always show the selected timing scope before drawing.
- Social canvas presets: portrait 1080×1920, square 1080×1080, landscape 1920×1080. These are output choices, not claims about social-platform requirements.
- Default portrait comparison: vertically stacked panes. Landscape comparison: side by side. One source fills the available content region using contain by default.
- Default fit: contain, with explicit crop/reposition preview available. Never stretch a golfer to fit a box.
- Text: optional title and per-pane labels, such as “Before” and “After.” Never automatically insert a student's name or lesson date.
- Freeze holds: optional start, selected checkpoint, and end holds; each 0–3 seconds, default 0. One selected checkpoint hold per pass is sufficient for this version.
- Audio: silent output in this version, clearly stated in the export interface.
- No new cloud services, accounts, publishing integrations, or general-purpose video editor.

## Data and timing contracts

### Source identity and selections

Every loaded source needs a stable identity for its current session. A native saved swing may use its existing swing ID; temporary uploads need a generated source-session ID. Include a generation token so replacing a video cannot reuse old asynchronous results.

A segment is either `{ kind: 'times', start, end }` or `{ kind: 'positions', from: 4, to: 7 }`, with separate `paddingBefore` and `paddingAfter`. Position indices are zero-based internally, so 4→7 means P5→P8. UI and human-facing MCP responses must include the P labels.

- Seconds always refer to the original source timeline, independent of playback speed or trim.
- A time selection requires finite `0 <= start < end <= duration`.
- A position selection requires both positions to exist and their actual times to be ordered. Do not sort a reversed pair silently.
- A position-bound selection resolves against current markers for preview. Moving P7 updates a selection bound to P7; a literal timestamp selection stays fixed.
- Deleting a referenced marker makes the selection unresolved. Disable export with a precise explanation; retain the selection so the user can repair it.
- Clearing a selection restores access to the full source. Selecting another range must be possible outside the current trim, despite existing `seekTo` clamping.
- Opening or clearing a source resets only that pane's source-bound annotations, markers, selections, and comparison references. Preserve the other pane.
- Snapshot all resolved times and source-generation tokens when starting export. Later marker edits must not change an in-flight render.

### Drawing identity, geometry, and visibility

Add a stable drawing ID while preserving legacy index access for existing MCP callers. Do not identify drawings by their index in a filtered visible-shapes array.

Use a visibility union:

```js
{ kind: 'all' }
{ kind: 'frame', mediaTime: 1.234567 }
{ kind: 'range', start: 1.2, end: 1.5 }
{ kind: 'positions', from: 4, to: 6 }
```

All visibility belongs to the drawing's source. Ranges use `[start, end)`; a position range includes the decoded frame at its ending checkpoint, resolving that frame's end boundary when available. Document that distinction in the resolver and tests.

Implement one pure visibility resolver used by live overlays, hit testing, snapshots, sequence images, and video export. Clean export bypasses all analysis drawings, including angle numbers. It may retain explicitly requested titles and pane labels.

Frame-specific means the actual decoded source frame, not `Math.round(time * 30)`. Establish decoded frame identity using `requestVideoFrameCallback` metadata and verify that a seek resolves to the requested frame. A small timestamp comparison epsilon may absorb numeric error, but must not become a broad visibility window spanning multiple frames. During a freeze, preserve the held frame's identity.

Run a small timing proof before wiring the UI. If the supported runtime cannot reliably identify/seek a frame for a source, expose explicit time-range annotations for that source and report frame mode as unsupported. Do not silently call a nominal-FPS estimate “frame accurate.” Do not add a demuxing library without first documenting why the existing media APIs are inadequate.

Frame/timestamp drawings remain fixed when checkpoints move. Position-bound drawings follow the updated checkpoints. Missing referenced positions make those drawings unresolved and hidden, with an editable warning in the drawing controls.

Drawing editing must preserve ID, visibility, source identity, color, width, and label settings unless the corresponding field is intentionally changed. Hidden drawings cannot be selected or dragged through the canvas. A drawing list may still expose them for timing edits/removal.

For geometry, use normalized source-video coordinates as the canonical representation for new/converted shapes, with adapters to the existing renderer and editing handles. Convert legacy pane-pixel shapes exactly once using their original video rectangle, before layout changes. Keep stroke width as an intentional display/export style, not a fraction accidentally multiplied by aspect ratio. Test every supported shape, letterboxing, zoom/pan, resizing, and both comparison layouts. A layout change must not reposition an arm line relative to the arm.

Angle calculations must use source aspect ratio or source pixels. Calculating an angle directly in normalized coordinates distorts it for non-square videos. Turning a label off must not change the geometry.

### Matched positions versus continuous comparison

Provide independent controls for these operations:

1. **Jump to matching position:** pause both panes and seek each to its own P marker. P6 can be at 4.8 seconds on the left and 9.0 seconds on the right. Missing either marker returns an error without moving either pane. Previous/next matched position traverses only positions available in both panes.
2. **Align playback at a checkpoint:** choose a position present in both sources, normally P7. Play each source at the same chosen speed, with an offset aligning those checkpoints. Do not stretch one swing's tempo to make every position match.
3. **Independent playback:** preserve existing individual playback and selection controls.

Setting P6 on the left changes only the left marker, even when comparison playback is linked. Any existing marker-copy convenience must become an explicit operation, separate from playback synchronization.

For aligned comparison, define each source interval relative to its own anchor: `[start - anchor, end - anchor]`. The common interval is the union of both intervals. Map common relative time back into each source and clamp to its selected boundaries. When clamped, hold the boundary frame and display “Held” in preview and comparison output so a freeze cannot be mistaken for swing timing. This preserves both selected segments and equal playback speed.

One comparison controller owns the shared clock and loop boundary. Disable independent pane trim-loop resets while it owns playback. If an anchor is missing or outside the selected interval, require a corrected selection/anchor; do not invent a match. Matched navigation must be able to leave a trim selection without being silently clamped to the wrong frame.

## Export behavior and architecture

### Resolve a recipe before recording

Create a small pure export-plan utility, tentatively `src/utils/exportPlan.js`, which validates a recipe and maps output time to source time for each pane. Keep this separate from encoding and UI state.

The resolved recipe contains source identities, concrete per-pane ranges, comparison alignment, speed, repeat count, holds, framing/crop, dimensions, titles/labels, and annotation mode. All values must be visible in the export preview. The same recipe drives UI exports and MCP exports.

- Apply playback speed only to moving source intervals. Hold durations are output seconds.
- For one source, duration is `repeats * ((end - start) / speed + totalHoldSecondsPerPass)`.
- For aligned comparison, substitute the common relative interval length for `end - start`.
- Example: a 1.2-second segment at 0.5× repeated 3 times, with a 0.4-second end hold each pass, produces 8.4 seconds of output.
- Evaluate drawings against mapped source time/frame identity, never against output time. Repetition two must show the same annotations at the same source positions as repetition one.
- Each repeat restarts forward. Do not use a reverse “boomerang” loop for coaching playback.
- Start/checkpoint/end holds execute once per pass. Coincident holds combine into one hold with their summed duration; do not lose or duplicate time.

### Capture and restoration

Prefer a dedicated export media instance for each selected source so recording does not drive the user's visible analysis videos. Reuse the existing canvas/MediaRecorder path initially if it passes the artifact checks below. Do not promise offline rendering speed or frame-perfect encoding from MediaRecorder.

If the implementation must temporarily borrow live media elements, explicitly acquire playback ownership, suspend normal sync and trim loops, and lock conflicting controls until cleanup. Snapshot both videos' current time, paused/playing state, rate, selection, active pane, sync mode, zoom/pan, and overlay state. Restore all of it in `finally`, including failures before recording starts. Independent export elements must likewise release their own resources without changing the editor.

Wait for decoded frames before painting, including initial seek, each loop restart, and freeze transitions. A timeout produces a failed export, not a stale-frame success. Check the source-generation token before every asynchronous result is applied.

Render annotations freshly from the source-time resolver and normalized geometry. Do not copy a potentially stale live overlay canvas or capture selection handles, toolbars, markers, or timeline controls. Use the same framing transform for source pixels and drawings.

Provide progress and cancellation. Stop media tracks, RAFs, intervals, recorder callbacks, and temporary export media; revoke temporary object URLs when no longer needed. A second export must work immediately after a cancelled or failed export. Do not delete completed output files as cleanup.

### Format, destination, and output verification

- Prefer supported MP4. If unsupported, show “WebM” before exporting and save with the correct extension and MIME type. Never rename WebM bytes to `.mp4`.
- The first version may remain MediaRecorder-based. If local artifact checks reveal dropped frames or timing errors that prevent a faithful coaching clip, document the failure and propose a separate native encoder path. Do not silently install an external service or add a large encoding dependency.
- Desktop: save a new output file using a narrow native export API. Support a destination selected through a native dialog or a configured export directory. Return the actual saved path to MCP.
- Generate a new filename on collision. Do not overwrite source media or an existing export implicitly. Keep export files separate from the student library and repository.
- Website: user-initiated Blob download only; no student-library persistence.
- Show actual dimensions, duration, format, and silent-audio status in the result. Verify the artifact itself, not only the preview or recorder completion event.
- The app's preview may loop, but the exported file must contain the requested repeated passes even when the external player's loop option is off.

## MCP contract

Extend `mcp/tools.mjs` with strict schemas and `src/hooks/useSwingstrControl.js` with matching handlers. Preserve existing tool names and input compatibility. New names below are the proposed implementation contract; keep them consistent in code, docs, and tests.

| Tool | Inputs and result |
| --- | --- |
| `get_state` extension | Per-pane source ID/generation, decoded frame identity or unsupported status, marker index/label/time, selection definition and resolved bounds, timing-aware drawings with stable IDs, comparison mode, and export capabilities/status. |
| `set_marker` | `{side, position: 1..10, time}`; require an explicit side; return the saved marker and source identity. Only change that pane. |
| `remove_marker` | `{side, position: 1..10}`; return affected unresolved selections/drawings, if any. |
| `seek_position` | `{position: 1..10, target: 'left'|'right'|'both'}`; `both` is strict matched navigation; return actual decoded times for each pane after seeking. |
| `set_segment` | `{side, selection: {kind:'times',start,end} | {kind:'positions',from:1..10,to:1..10}, paddingBefore?, paddingAfter?}`; return resolved source bounds or a precise validation error. Convert human P numbers to internal indices once at the boundary. |
| `clear_segment` | `{side}`; remove only that pane's virtual selection. |
| `configure_comparison` | `{mode:'independent'|'aligned', anchorPosition?:1..10}`; validate both sources before changing state. |
| Drawing tool extensions | Add `visibility` and `showAngleLabel`; return stable drawing IDs. Preserve existing index-based updates. Prefer ID-based updates for new callers. Position values exposed through MCP are 1–10. |
| `remove_drawing` | `{side, id}`; remove only that annotation. A separate clear operation requires explicit scope; avoid broad implicit deletion. |
| `start_export` | `{source:'left'|'right'|'both', preset:'portrait'|'square'|'landscape', speed:1|0.5|0.25, repeats:1|3|5, annotations:'clean'|'annotated', holds?, title?, paneLabels?, framing?, destination?}`; use current validated selections; snapshot them and return `{jobId,status:'queued',resolvedRecipe,expectedDuration}` promptly. |
| `get_export_status` | `{jobId}`; return queued/running/completed/failed/cancelled, progress, and on completion actual path, MIME type, dimensions, duration, and warnings. |
| `cancel_export` | `{jobId}`; idempotently cancel the job and release its resources. |

Define `holds` as `{startSeconds, checkpoint?:{position:1..10,seconds}, endSeconds}`. All durations must be finite and in the UI's allowed bounds. For both-source checkpoint holds, require that checkpoint in both panes and use the aligned common clock; reject a request whose two checkpoints do not coincide under the selected alignment. Recommend holding at the alignment anchor.

For framing, expose the same contain/crop choice and normalized source crop rectangle used by the UI, separately per pane. Reject zero-area or out-of-bounds crops. Destination inputs must resolve through the constrained native export destination API, not arbitrary filesystem writes passed through the renderer.

Allow one active export job at a time in this version. Reject a concurrent start with the active job ID; do not silently queue multiple long recordings. Keep status/results in memory for the current application session. A renderer reload invalidates unfinished jobs with a clear interrupted state, rather than leaving them running forever.

The existing socket timeout is compatible with this design because start/status/cancel are short commands. Never stream base64 movie data through it. Retain the private same-user socket and existing validation; do not open a network control port.

Example agent interaction: open left and right swings → inspect decoded frames → set each pane's P5–P8 independently → seek both to P6 → draw timed arm lines → set each segment P5–P8 → align at P7 → start portrait annotated export at 0.5× with three repeats → poll job status → return the saved file. Do not automatically publish the result.

## Ordered implementation stages and file ownership map

Implement in these stages, verifying each before moving on. Keep abstractions small and specific to this workflow.

### Stage 0: establish the baseline and prove frame timing

Read current diffs and relevant instructions. Run `npm test`, `npm run lint`, and `npm run build`; record pre-existing failures separately. Inspect the live desktop version and supported media APIs. Use a synthetic frame-numbered clip to establish decoded timestamps and reliable seek/capture behavior, including a variable-frame-rate sample if available.

Completion: baseline recorded; exact-frame support/fallback rules demonstrated; existing source/library behavior understood. No claim of validated frame precision without this evidence.

### Stage 1: segment and comparison state

Primary files: `src/App.jsx`, `src/hooks/useMarkers.js`, `src/components/AnalyzerView.jsx`, `src/components/Timeline.jsx`, and the existing pane playback controls in `src/components/ScreenPane.jsx` / `src/components/VideoCanvas.jsx` as needed. Add one small pure timing utility if shared logic warrants it.

Implement independent marker edits, explicit selection modes, strict matched seeks, and the shared aligned playback controller. Surface missing markers and resolved selection times. Ensure timeline marker clicks carry their source side, and other-pane sync indicators use the active clock correctly.

Completion: independently mark both swings, jump P5/P6/P7/P8, loop each chosen segment, align impact without changing tempo, and clear the selection to regain full-video navigation.

### Stage 2: stable, time-aware annotations

Primary files: `src/components/VideoCanvas.jsx`, `src/utils/shapeRenderer.js`, `src/utils/shapeEditing.js`, `src/utils/controlShapes.js`, `src/components/StyleMenu.jsx`, and the smallest suitable drawing-scope control. Update `src/types.js` if it documents these shapes. Add `src/utils/annotationTiming.js` only for shared timing resolution.

Implement stable IDs, source-relative geometry conversion, timing scope editing, angle-label toggle, and dark palette defaults. Thread decoded frame identity through rendering. Apply visibility before hit testing without reindexing shape identity. Preserve metadata during edits.

Completion: a line appears on its selected frame, a second line spans P5→P7, and a persistent reference stays visible throughout. All remain geometrically correct after layout changes. No angle numbers appear by default.

### Stage 3: shared export recipe and media rendering

Primary files: `src/utils/videoClipExport.js`, new `src/utils/exportPlan.js`, `src/utils/swingSequenceExport.js`, `src/components/VideoCanvas.jsx`, and `src/components/ExportModal.jsx`.

Implement recipe validation/mapping, explicit source choice, repeated passes, holds, clean/annotated rendering, fixed dimensions, comparison layout, title/pane labels, and crop preview. Fix stale capture and cleanup/restoration paths. Use the same timing resolver for stills and sequences.

Completion: export and inspect portrait/square/landscape artifacts; counts, duration, geometry, source-time annotations, and holds match the recipe. Cancellation and capture failure restore usability.

### Stage 4: desktop output and asynchronous MCP

Primary files: `electron/main.js`, `electron/preload.cjs`, `mcp/tools.mjs`, `src/hooks/useSwingstrControl.js`, and only necessary changes to `mcp/server.mjs` / `mcp/transport.mjs`.

Add constrained native export saving and job lifecycle. Expose the contracts above, including capability reporting and decoded seek results. Existing tools must continue working. Extend the real MCP stdio/socket integration test; its current hard-coded tool count of 10 must be updated to assert the expected registered tool names rather than an incidental count.

Completion: an MCP client runs the full example interaction, receives a job ID before the socket timeout, cancels one render, and completes another with a readable local output path.

### Stage 5: regression checks and coach review package

Primary files: existing `tests/control.test.mjs`, new focused Node tests for timing/export-plan logic, and `README.md` for user controls and MCP documentation. Use existing testing conventions; add a browser-test framework only if the current toolchain cannot validate the required behavior.

Complete the acceptance matrix below. Provide Mitchell with local sample exports, a short click-by-click review procedure, known limits, and exact changed files. Stop before commit or deployment pending his testing confirmation.

## Acceptance matrix

| Check | Required evidence |
| --- | --- |
| Source preservation | Hash local test source files before and after trim/export; bytes and native library records remain unchanged. No source overwrite on export filename collision. |
| Marker independence | Setting left P6 while comparison is aligned leaves right P6 unchanged. Replacing a marker does not break a position-bound reference. |
| Strict matching | Different left/right P6 times seek correctly; missing either produces no partial movement or fallback. Previous/next traverses common positions. |
| Selection validation | Missing, reversed, nonfinite, equal, and out-of-duration bounds fail predictably. Boundary padding clamps visibly. Clearing trim permits full-source seeking. |
| Tempo and comparison | Distinct swing durations preserve their relative timing at a common rate; P7 coincides; held boundaries are labeled; panes restart together. |
| Frame timing | Numbered frames show frame-specific drawings only on the selected decoded frame, including seek, playback, pause, freeze, and repeat. Unsupported precision is reported. |
| Range timing | Exercise exact start/end boundaries, moved/deleted checkpoints, repeats, half speed, and quarter speed. No source-time/output-time confusion. |
| Geometry | Every existing shape type survives single/split, resize, letterboxing, zoom/pan, portrait crop, and export; normalized-coordinate angles use source aspect ratio. |
| Hidden shapes | Hidden drawings cannot intercept clicks; ID updates target the intended drawing after visibility changes or other removals. |
| Drawing parity | Live view, snapshot, sequence image, and annotated video show the same eligible shapes with identical label settings. Clean output contains no analysis overlays. |
| Encoded repetition | External player with loop disabled shows exactly 1/3/5 passes. The 1.2-second, half-speed, three-repeat, 0.4-second-end-hold example measures approximately 8.4 seconds. |
| Timing tolerance | Inspect encoded duration with a local media probe when available. Target within two output frames or 100 ms, whichever is larger; report actual error. Visual boundary frames must still be correct. |
| Social framing | Verify actual 1080×1920, 1080×1080, and 1920×1080 output, correct contain/crop geometry, unclipped labels, and no editor controls. |
| Format truth | Decode the resulting container, verify MIME/extension and silent audio. Test unsupported MP4 fallback explicitly. |
| Job lifecycle | Start responds within the existing command timeout; progress advances; cancel is idempotent; failed jobs have actionable errors; concurrent start is rejected. |
| Cleanup | Successful, cancelled, timed-out, source-replaced, and failed renders release resources. Editor time/rate/play state/view are preserved or exactly restored. A subsequent export succeeds. |
| Storage boundaries | Website export does not save videos or video links into browser library storage. Desktop local library remains intact. No private media appears in staged files or the production build. |
| Existing functions | Existing MCP playback/drawing/open commands, still exports, sequences, local saved-video loading, and pose overlay behavior continue to work. |

Run `npm test`, `npm run lint`, and `npm run build` after implementation. Report baseline failures separately from regressions. A passed unit suite does not substitute for opening the rendered movie and inspecting its frames.

For local coach review, Jessica's before/after chipping is a good candidate because arm structure is the visual subject. Re-establish checkpoints from the footage; earlier conversational timestamps were approximate, not validated P markers. Do not put her footage, identity, or source paths into committed fixtures or public output by default.

## Definition of completion and handback

Return a concise implementation report containing:

1. Implemented controls and MCP tools, with any deviations from this plan explained.
2. Exact modified files and preservation of the pre-existing dirty worktree.
3. Test/build/lint results plus actual exported-artifact dimensions, duration, format, repeat count, and frame checks.
4. Local links to one clean clip, one annotated clip, and one matched before/after comparison using permitted local test footage.
5. Remaining limitations, especially frame precision, variable-frame-rate behavior, MediaRecorder timing, and silent audio.
6. Mitchell's short testing checklist and the explicit status: awaiting coach testing; not committed, deployed, or published.

Defer batch exports, automatic landmark tracking, audio/voiceover, automatic captions, arbitrary multi-shot timelines, optical-flow interpolation, phase-normalized retiming, and automatic social posting. A clean → annotated slow-motion → clean sequence can be assembled from the first version's exports; a single-file multi-pass recipe is a later enhancement after these fundamentals are validated.
