# ⛳️ Swingstr

Swingstr is a privacy-first golf swing analysis tool for instructors. Compare two swings side by side, draw on them frame by frame, pull video straight from Google Drive, and keep a lightweight library of your students — all in the browser, with no Swingstr server and nothing uploaded anywhere you don't control.

It runs on desktop and works on your phone.

## 🚀 Key Features

### 🎥 Pro Video Analysis
- **Split-Screen Comparison** — analyze one swing on its own, or compare two side by side (Student vs. Pro).
- **Synchronized Playback** — link two videos and play, pause, and scrub them together. A drift-correction loop keeps them tempo-locked during play, so you don't have to re-sync every few seconds.
- **Sync Points** — set a reference frame on each video (e.g. impact) and linked playback offsets the second video to keep those two moments aligned.
- **Precision Control** — frame-by-frame stepping (0.05s), variable playback speed (0.25x–2.0x), and independent zoom/pan per screen.
- **Global Scrubber** — full-width timeline for navigation that stays out of the way of the video.
- **Swing Markers** — tag key positions (Address → Finish) and jump straight to them with number keys.

### ✏️ Telestration Suite
- **Drawing tools** — Lines, Angles, Circles, Boxes, and Freehand.
- **Two-tap lines** — tap the start, tap the end. The line drops in selected, so you can grab either endpoint and nudge it into place. (Angles are a 3-tap version of the same idea.)
- **Touch-friendly editing** — select any shape and drag its handles to reshape it; the drag follows your finger the whole way on mobile.
- **Privacy Blur** — a dedicated tool to blur faces or anything sensitive before you share a clip.
- **Style controls** — adjustable stroke color and thickness from pop-up menus.

### ☁️ Google Drive Integration
- **Sign in with Google** to browse your Drive folders right inside the app.
- **Stream videos in** — load a swing straight from Drive into either screen without downloading it first.
- Optional: if you don't connect Google, everything else still works with local files and URLs.

### 🗂️ Student Library (CRM)
- **Profiles** — create, edit, and delete students.
- **Playable video locker** — save a swing to a student and it persists across refreshes (stored in IndexedDB, not throwaway blob URLs). Play saved videos back or send them straight into the analyzer.
- **Coach's Notes** — per-student notes that auto-save as you type.

### 🎯 Swing Sequence Export
- Generate a 5/8/10-frame strip (single video) or a grid (both videos compared).
- Use evenly-spaced frames or your own markers as the source frames.
- Annotations are mapped through the video's letterbox, so they land on the right pixel even when the clip's aspect ratio differs from the cell.

### 📱 Works on Mobile
- The analyzer header and toolbar adapt to small screens, so the controls stay reachable on an iPhone instead of running off the edge.
- Drawing and handle-dragging are built for touch.

## 💻 Tech Stack
- **Framework:** React 19 + Vite
- **Styling:** Tailwind CSS (dark mode optimized)
- **Icons:** Lucide React
- **Auth/Storage:** Google Identity Services + Drive API (optional), versioned localStorage for metadata, IndexedDB for video blobs
- **Backend:** none — it's a fully client-side app

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

### Enabling Google Drive (optional)
Drive browsing needs a Google OAuth Client ID. Without one, the app runs fine — the Google sign-in button just stays hidden.

1. Create an OAuth 2.0 Client ID at [console.cloud.google.com](https://console.cloud.google.com) → **Credentials**.
2. Copy `.env.example` to `.env` and fill in your ID:
   ```bash
   cp .env.example .env
   ```
   ```
   VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
   ```
3. Restart the dev server.

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
| Zoom in / out (active screen) | + / − buttons in header |
| Pan | Move tool + drag |
| Draw a line | Line tool → tap start, tap end |
| Sync two videos | "Linked" button |
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
│   │   ├── AnalyzerView.jsx       # Main analysis layout (header/main/footer)
│   │   ├── ScreenPane.jsx         # One half of the split view
│   │   ├── VideoCanvas.jsx        # Video + drawing overlay + pointer handlers
│   │   ├── MarkerBar.jsx          # Marker timeline strip
│   │   ├── StudentLibrary.jsx     # Student CRM + video locker
│   │   ├── GoogleAuthButton.jsx   # Google sign-in / sign-out
│   │   ├── DrivePickerModal.jsx   # Browse + load videos from Drive
│   │   ├── SwingSequenceModal.jsx
│   │   ├── SaveModal.jsx
│   │   ├── EditStudentModal.jsx
│   │   ├── ConfirmDialog.jsx
│   │   ├── UrlPromptModal.jsx
│   │   ├── Toast.jsx
│   │   ├── ToolMenu.jsx
│   │   ├── StyleMenu.jsx
│   │   ├── SpeedMenu.jsx
│   │   └── ui/Button.jsx          # Reusable button primitives
│   ├── hooks/
│   │   ├── useVideoSources.js
│   │   ├── useMarkers.js
│   │   ├── useGoogleAuth.js       # Google Identity Services sign-in
│   │   ├── useGoogleDrive.js      # Drive API: list folders, fetch videos
│   │   ├── useEscapeClose.js      # Esc-to-close for modals
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
- Voiceover recording (screen + microphone) for remote video lessons.
- Pinch-to-zoom on touch.
- Undo/Redo for shapes.

Built with 💜 by a PGA Golf Pro
