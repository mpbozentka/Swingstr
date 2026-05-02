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

## 🔮 Roadmap

- Desktop app (Electron) for unlimited local storage.
- Saved-video playback in the Student Library (the persistence layer is in place; the playback UI is next).
- Voiceover recording (screen + microphone) for remote video lessons.
- Pinch-to-zoom on touch.
- Undo/Redo for shapes.

Built with 💜 by a Golf Pro & Bitcoin Maxi.
