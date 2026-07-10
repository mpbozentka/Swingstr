// Copies the MediaPipe WASM runtime out of node_modules and fetches the pose
// model file into public/mediapipe/. Both must be served same-origin (no CDN
// loading at runtime) per Swingstr's privacy design. Runs on `npm install`
// and is safe to re-run — it skips work that's already done.
import { existsSync, mkdirSync, copyFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';
import path from 'node:path';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const wasmSrcDir = path.join(rootDir, 'node_modules/@mediapipe/tasks-vision/wasm');
const wasmDestDir = path.join(rootDir, 'public/mediapipe/wasm');
const modelDestPath = path.join(rootDir, 'public/mediapipe/pose_landmarker_full.task');
const modelUrl = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task';

function copyWasm() {
  if (!existsSync(wasmSrcDir)) {
    console.warn('[setup-mediapipe] node_modules/@mediapipe/tasks-vision/wasm not found — skipping WASM copy.');
    return;
  }
  mkdirSync(wasmDestDir, { recursive: true });
  for (const file of readdirSync(wasmSrcDir)) {
    copyFileSync(path.join(wasmSrcDir, file), path.join(wasmDestDir, file));
  }
  console.log('[setup-mediapipe] Copied WASM runtime to public/mediapipe/wasm/');
}

async function fetchModel() {
  if (existsSync(modelDestPath)) {
    console.log('[setup-mediapipe] Pose model already present, skipping download.');
    return;
  }
  console.log('[setup-mediapipe] Downloading pose_landmarker_full.task (~9MB)...');
  const res = await fetch(modelUrl);
  if (!res.ok) {
    console.warn(`[setup-mediapipe] Model download failed (${res.status}) — pose analysis won't work until public/mediapipe/pose_landmarker_full.task exists. Re-run "npm run setup-mediapipe" once network access is available.`);
    return;
  }
  mkdirSync(path.dirname(modelDestPath), { recursive: true });
  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(modelDestPath, buffer);
  console.log('[setup-mediapipe] Saved public/mediapipe/pose_landmarker_full.task');
}

copyWasm();
await fetchModel();
