# ⛳️ Swingstr

Swingstr is a privacy-focused, professional golf swing analysis platform built for the modern instructor. It combines powerful video comparison tools with a lightweight student CRM, all wrapped in a sleek, responsive interface.

## 🚀 Key Features

### 🎥 Pro Video Analysis
- **Split-Screen Comparison** — compare two swings side-by-side (Student vs. Pro).
- **Synchronized Playback** — link videos and play, pause, and scrub together. A drift-correction loop keeps them tempo-locked during play (no manual re-syncing every few seconds).
- **Sync Points** — set a per-video reference frame (e.g. impact) and the linked playback offsets the right video to keep the two events aligned.
- **Precision Control** — frame-by-frame stepping (0.05s), variable playback speed (0.25x–2.0x), and independent zooming/panning per screen.
- **Global Scrubber** — full-width timeline for navigation that doesn't obscure the video.

### ✏️ Telestration Suite
- Lines, Angles (3-click), Circles, Boxes, and Freehand drawing.
- **Privacy Blur** — dedicated "Eye Off" tool to blur faces or sensitive details before sharing.
- Adjustable stroke color and thickness via pop-up menus.
- **Selection & Edit** — click any shape to select; drag handles to reshape; click empty space to deselect.

### 🗂️ Student Library (CRM)
- Profile management — create, edit, delete student profiles.
- **Persistent Video Locker** — saved videos go into IndexedDB so they survive a refresh (not blob URLs that die with the tab).
- Auto-saving Coach's Notes (debounced).

### 🎯 Swing Sequence Export
- Generate a 5/8/10-frame strip (single video) or grid (both videos compared).
- Use evenly-spaced frames or your set markers as the source.
- Annotations are mapped through the letterbox so they land on the right pixel even when the video aspect ratio differs from the cell.

### 💻 Modern Tech Stack
- **Framework:** React 19 + Vite
- **Styling:** Tailwind CSS (dark mode optimized)
- **Icons:** Lucide React
- **Persistence:** Versioned localStorage for metadata, IndexedDB for video blobs

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation
```bash
git clone https://github.com/mpbozentka/Swingstr.git
cd Swingstr
npm install
npm run dev
```

Open http://localhost:5173

### Scripts
- `npm run dev` — start the dev server
- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build
- `npm run lint` — ESLint + react-hooks rules

## 🎮 Controls & Shortcuts

| Action | Shortcut |
| --- | --- |
| Play / Pause | Space |
| Next / Prev frame | → / ← |
| Set marker at current time | Shift + 1..0 (1 = Address … 0 = Finish) |
| Jump to marker | 1..0 |
| Zoom in/out (active screen) | + / − buttons in header |
| Pan | Move tool + click & drag |
| Sync videos | "Linked" button |
| Set sync point | L / R crosshair buttons |

## 📂 Project Structure

```
Swingstr/
├── public/
│   ├── swingstr-logo.jpg     # Header logo
│   └── swingstr-icon.jpg     # Favicon (256x256)
├── src/
│   ├── App.jsx               # Top-level state and routing
│   ├── main.jsx              # React entry point
│   ├── index.css             # Tailwind directives + global styles
│   ├── types.js              # Shared JSDoc typedefs
│   ├── components/
│   │   ├── AnalyzerView.jsx  # Main analysis layout (header/main/footer)
│   │   ├── ScreenPane.jsx    # One half of the split view
│   │   ├── VideoCanvas.jsx   # Video + drawing overlay + pointer handlers
│   │   ├── MarkerBar.jsx     # Marker timeline strip
│   │   ├── StudentLibrary.jsx
│   │   ├── SwingSequenceModal.jsx
│   │   ├── SaveModal.jsx
│   │   ├── EditStudentModal.jsx
│   │   ├── ConfirmDialog.jsx
│   │   ├── UrlPromptModal.jsx
│   │   ├── Toast.jsx
│   │   ├── ToolMenu.jsx
│   │   ├── StyleMenu.jsx
│   │   ├── SpeedMenu.jsx
│   │   └── ui/Button.jsx     # Reusable button primitives
│   ├── hooks/
│   │   ├── useVideoSources.js
│   │   ├── useMarkers.js
│   │   └── useDebouncedEffect.js
│   ├── utils/
│   │   ├── storage.js                 # IndexedDB + versioned localStorage
│   │   ├── url.js                     # Video URL validation
│   │   ├── shapeRenderer.js           # Canvas drawing for all shape types
│   │   ├── shapeEditing.js            # Hit-testing and handle math
│   │   └── swingSequenceExport.js     # Multi-frame grid composition
│   └── constants/
│       └── markers.js
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

## Local MCP control

The desktop app exposes its existing controls through a private Unix socket
at `~/Library/Application Support/Swingstr/control/bridge.sock`. The socket
accepts only validated, named commands, is restricted to the current Mac user,
and starts/stops with Swingstr. It does not open a network control port. The
public website has no command listener or library access.

After `npm install` and `npm run build`, open the desktop app. Register the
stdio MCP server using absolute paths to your Node executable and this repo:

```sh
codex mcp add swingstr -- /absolute/path/to/node /absolute/path/to/Swingstr/mcp/server.mjs
```

Reload Codex's MCP connections, or restart Codex if the tools do not appear.
Swingstr must be running when a tool is called. The connection uses the
standard [Codex MCP configuration](https://developers.openai.com/codex/mcp).

Available tools: `get_state`, `get_frame`, `list_swings`, `open_swing`,
`playback`, `select_tool`, `set_style`, `configure_view`, `draw_shape`, and
`update_shape`. Saved swing listing returns IDs, student names and clip labels,
without contact details or coaching notes. Opening by ID currently supports
local saved files; remote/Drive videos can still be opened through the app.
No student-library save, library delete, upload or arbitrary code execution tool is exposed. Explicit exports save new files outside the library; remove_drawing removes one temporary annotation.

Drawings use normalized video coordinates: top left is `{x: 0, y: 0}` and
bottom right is `{x: 1, y: 1}`. `get_frame` returns a native-resolution JPEG
with drawings and its timestamp. For example:

```json
{"type":"line","points":[{"x":0.61,"y":0.61},{"x":0.61,"y":0.92}]}
```

Line, vertical line, circle and box use two points; a circle uses center and
radius endpoint. Angles use vertex, first arm endpoint, second arm endpoint.
Frame stepping uses `frames / fps` seconds (30 fps by default), matching the
app's time-based stepping rather than promising decoded frame indexing.
Playback honors the app's active pane, linking and trim controls. Drawings
pause their selected pane and remain temporary source-relative analysis overlays. New drawings use a decoded-frame scope when supported, with explicit range and throughout-source scopes available. Opening a
saved swing clears that pane's drawings after the new video is ready.

Run `npm test` for protocol, validation, coordinate mapping and existing
measurement/storage regressions. The protocol test connects a real MCP client
over stdio to an isolated socket; it never reads or edits the saved library.

## Short clips and comparison exports

Mark each swing independently using the P menu or P + digit. Linking playback
never copies or replaces the other swing's markers. Jump both requires that
position in both sources, including when using linked marker navigation.
Previous/next in linked or aligned mode visits common checkpoints only.

The segment bar chooses literal source seconds or position references, with
0–2 seconds of optional padding. Apply it separately to each pane. Existing
In/Out controls use the same selection state. Checkpoint selections follow
marker edits; deleting a referenced marker leaves an unresolved selection and
blocks export until repaired. Clear selection restores the full timeline.

Align playback at a marked position inside both selections, normally P7.
The common clock preserves equal speed and holds the shorter boundaries,
labeling those frames Held. Drawing, seeking and changing speed pause that
clock. Jump both can navigate outside a selection.

Choose the drawing scope before drawing: This decoded frame, Time range,
Checkpoint range, or Throughout source. The drawing list includes hidden and
unresolved annotations for repair or individual removal. Apply to selected
changes its scope and angle-number setting. Shapes stay attached to the source
through layout changes, letterboxing, resizing, zoom and export framing. New
angles have no numeric label. Defaults are dark teal, rust and brown; custom
colors remain available. Frame mode is unavailable without decoded identity;
frame stepping itself remains a time estimate.

Export > Video uses the current per-pane selections (full source if cleared).
Choose source, portrait/square/landscape canvas, speed, 1/3/5 encoded passes,
clean or annotated output, start/checkpoint/end holds, optional title/labels,
and contain/crop framing. Crop values are normalized source fractions. The
recipe preview shows resolved bounds, anchor times, actual output dimensions,
expected duration, format and silent audio. It does not enable player looping.

Recording uses separate media elements and redraws eligible annotations, so
editor time, rate, play state, view, zoom and overlays remain intact. Keep the
window visible during real-time recording. Output is 30 fps and silent;
MediaRecorder is not a frame-perfect offline encoder. A source decode timeout,
source replacement, excessive drift or failed artifact check fails the job.
Use slow motion for high-frame-rate footage and inspect important frame-only
drawings in the saved file.

Desktop recording saves a new file in Movies/Swingstr Exports. Save / Download
can also choose a destination with the native dialog. Collisions get a new
filename; checkout and student-library destinations are rejected. Website
recording creates a temporary Blob and downloads only on the user's Save /
Download action. It does not persist videos or video links into browser
library storage. Recordings and source footage remain excluded from Git and
Vercel uploads.

Additional MCP tools:

- `set_marker`, `remove_marker`, `seek_position`: explicit side and human
  P positions 1–10; `seek_position` accepts left/right/both.
- `set_segment`, `clear_segment`: source times or human P positions, with
  optional before/after padding. Current state includes resolved bounds/errors.
- `configure_comparison`: independent or aligned with anchorPosition.
- `remove_drawing`: one stable ID. draw_shape/update_shape accept visibility
  and showAngleLabel; update_shape accepts ID or the existing index.
- `start_export`: source, preset, speed, repeats, annotations, optional holds,
  title, paneLabels, per-pane framing, and destination exports/dialog.
- `get_export_status`, `cancel_export`: session job ID. Start responds promptly;
  status includes progress and verified dimensions/duration/format/saved path.

Only one export job is active at a time across UI and MCP. Movie bytes never
travel through the private control socket. A renderer reload discards unfinished
jobs; querying an old ID returns an interrupted/unknown-session error. Refresh
MCP tool discovery after restarting the updated desktop app.

Example: mark each source's P5–P8, seek_position P6 both, add scoped drawings,
set both segments P5→P8, configure_comparison aligned at P7, then start_export
both/portrait/0.5/3/annotated. Poll get_export_status and return the saved path.
Exports never publish automatically.

## 🔮 Roadmap

- Desktop app (Electron) for unlimited local storage.
- Saved-video playback in the Student Library (the persistence layer is in place; the playback UI is next).
- Voiceover recording (screen + microphone) for remote video lessons.
- Pinch-to-zoom on touch.
- Undo/Redo for shapes.

Built with 💜 by a Golf Pro & Bitcoin Maxi.
