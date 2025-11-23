⛳️ Swingstr

Swingstr is a privacy-focused, professional golf swing analysis platform built for the modern instructor. It combines powerful video comparison tools with a lightweight student CRM, all wrapped in a sleek, responsive interface.

🚀 Key Features

🎥 Pro Video Analysis

Split-Screen Comparison: Compare two swings side-by-side (e.g., Student vs. Pro).

Synchronized Playback: "Link" videos to play, pause, and scrub them simultaneously to check tempo match-ups.

Precision Control: Frame-by-frame stepping (0.05s), variable playback speed (0.25x - 2.0x), and independent zooming/panning.

Global Scrubber: Full-width timeline for easy navigation without obstructing the video view.

✏️ Telestration Suite

Standard Tools: Lines, Angles (3-click), Circles, Boxes, and Freehand drawing.

Privacy Blur: A dedicated "Eye Off" tool to blur faces or sensitive background details before sharing.

Customization: Adjust stroke color and thickness via pro-style popup menus.

🗂️ Student Library (CRM)

Profile Management: Create, edit, and delete student profiles.

Video Locker: Save analyzed videos directly to a student's history for quick retrieval.

Coach's Notes: Auto-saving text area for tracking drills, grip changes, and lesson goals.

💻 Modern Tech Stack

Framework: React 18 + Vite

Styling: Tailwind CSS (Dark Mode optimized)

Icons: Lucide React

Architecture: Single-file component structure for portability.

🛠️ Getting Started

Prerequisites

Node.js (v16 or higher)

npm or yarn

Installation

Clone the repository:

git clone [https://github.com/YOUR_USERNAME/swingstr-app.git](https://github.com/YOUR_USERNAME/swingstr-app.git)
cd swingstr-app


Install dependencies:

npm install


Run the development server:

npm run dev


Open your browser to http://localhost:5173

🎮 Controls & Shortcuts

Action

Shortcut / Control

Play / Pause

Spacebar or Bottom Play Button

Next Frame

Right Arrow

Prev Frame

Left Arrow

Zoom In/Out

+ / - buttons in Header (Active Screen Only)

Pan Video

Select "Move" tool + Click & Drag

Clear Video

Click the X button in top-right of video

Sync Views

Click "Unlinked/Linked" button in header

📂 Project Structure

Swingstr/
├── public/
│   └── swingstr-logo.jpg   # App Icon / Logo
├── src/
│   ├── App.jsx             # Main Application Logic (Single File)
│   ├── main.jsx            # React Entry Point
│   └── index.css           # Global Styles & Tailwind directives
├── index.html              # HTML Entry Point
├── vite.config.js          # Build Configuration
└── package.json            # Dependencies & Scripts


🔮 Future Roadmap

Desktop App (Electron): For local hard drive access and unlimited video storage.

Voiceover Recording: Record screen + microphone for remote video lessons.

Local Persistence: Auto-save student data to LocalStorage to prevent data loss on refresh.

Built with 💜 by a Golf Pro & Bitcoin Maxi.