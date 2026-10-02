import { cp, mkdir, access, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const assets = new URL('public/mediapipe/', root);
await mkdir(assets, { recursive: true });
await cp(new URL('node_modules/@mediapipe/tasks-vision/wasm/', root), new URL('wasm/', assets), { recursive: true });
await cp(new URL('node_modules/@mediapipe/tasks-vision/vision_bundle.js', root), new URL('vision_bundle.js', assets));
const model = new URL('pose_landmarker_full.task', assets);
try {
  await access(model);
} catch {
  const response = await fetch('https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task');
  if (!response.ok) throw new Error(`Model download failed: ${response.status}`);
  await writeFile(model, Buffer.from(await response.arrayBuffer()));
}
console.log(`Local pose assets ready: ${fileURLToPath(assets)}`);
