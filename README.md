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

## Practice focus preview

Competitor feature evidence and timestamped YouTube demos are documented in
[`swing_coach_research.md`](swing_coach_research.md).

The first Swing Coach-inspired practice flow measures visible head movement
between P1 and a checkpoint you mark. It uses MediaPipe locally and does not
upload the clip or its pose data. This is a 2D estimate for review, not a
validated biomechanical measurement.

1. Run `npm install`, then `npm run dev`. Installation copies the pose runtime
   and downloads Google's full pose model once. If assets are missing, run
   `npm run setup:pose`. After setup, analysis needs no network connection.
2. Upload a clear full-body swing. Trim clips longer than 30 seconds.
3. Open **Practice focus** and click **Analyze clip**. Analysis pauses both
   videos and temporarily locks replay controls. Cancel restores the frame.
4. Scrub to address and set P1. Select a checkpoint, scrub to that position,
   and set its marker. Confirm that the white head ring follows the golfer.
5. Choose horizontal or vertical movement and enter your lower and upper
   limits. Units are percent of the shoulder-to-hip length at P1, measured
   in image pixels. Horizontal signs mean screen left/right, vertical signs
   mean down/up. These are coach-selected limits, not universal swing ideals.
6. Review the checkpoint or select **Hear feedback** for system speech.

Targets reset when switching videos; analysis is cached only for the current
session. Camera capture, automatic swing positions, club tracking, drill
recommendations, and saved progress reports are not implemented yet.
Body estimates can be wrong even when confidence is high. Test several known
swings and camera views before relying on the result for coaching.
Replay and measurements use a centered five-frame blend to reduce detection
jitter. It keeps raw confidence, leaves missing detections unavailable, and
does not blend across detection gaps.
Points and lines fade near the confidence cutoff instead of switching on
at full opacity.

Run `npm test` for measurement and detection-gap checks, `npm run build` for
the production bundle, and `npm run desktop:build` to try the desktop version.

## 🔮 Roadmap

- Desktop app (Electron) for unlimited local storage.
- Saved-video playback in the Student Library (the persistence layer is in place; the playback UI is next).
- Voiceover recording (screen + microphone) for remote video lessons.
- Pinch-to-zoom on touch.
- Undo/Redo for shapes.

Built with 💜 by a Golf Pro & Bitcoin Maxi.
