// Fetches the two RTMPose ONNX models into public/rtmpose/. Same privacy rule
// as setup-mediapipe.js: everything is served same-origin, nothing hits a CDN
// at runtime. Runs on `npm install` and is safe to re-run.
//
// Unlike the MediaPipe setup this does NOT copy a WASM runtime — Vite already
// resolves onnxruntime-web's runtime from node_modules in dev and emits it
// into the bundle for the build, so a second copy under public/ would just be
// ~40MB of duplication.
//
// RTMPose is a two-stage (top-down) pipeline, so there are two models:
//   1. rtmdet-nano  — finds the person box in the frame (~4MB zip)
//   2. rtmpose-m    — 26 body keypoints inside that box (~52MB zip)
// Both ship from OpenMMLab as .zip archives containing an end2end.onnx.
import { existsSync, mkdirSync, copyFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import os from 'node:os';
import path from 'node:path';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const destDir = path.join(rootDir, 'public/rtmpose');

const MODELS = [
  {
    name: 'rtmdet-nano.onnx',
    url: 'https://download.openmmlab.com/mmpose/v1/projects/rtmposev1/onnx_sdk/rtmdet_nano_8xb32-100e_coco-obj365-person-05d8511e.zip',
    label: 'person detector (~4MB)',
  },
  {
    name: 'rtmpose-m-halpe26.onnx',
    url: 'https://download.openmmlab.com/mmpose/v1/projects/rtmposev1/onnx_sdk/rtmpose-m_simcc-body7_pt-body7-halpe26_700e-256x192-4d3e73dd_20230605.zip',
    label: 'pose model (~52MB)',
  },
];

/**
 * Downloads a zip to a temp dir, unzips it, and moves the single end2end.onnx
 * it contains to `destPath`. `unzip` ships with macOS; on a box without it we
 * fail loudly rather than leaving a half-installed model behind.
 */
async function fetchModel({ name, url, label }) {
  const destPath = path.join(destDir, name);
  if (existsSync(destPath)) {
    console.log(`[setup-rtmpose] ${name} already present, skipping download.`);
    return;
  }
  console.log(`[setup-rtmpose] Downloading ${name} — ${label}...`);
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`[setup-rtmpose] Download failed (${res.status}) for ${url} — RTMPose analysis won't work until public/rtmpose/${name} exists. Re-run "npm run setup-rtmpose" once network access is available.`);
    return;
  }

  const tmpDir = path.join(os.tmpdir(), `swingstr-rtmpose-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  const zipPath = path.join(tmpDir, 'model.zip');
  try {
    writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
    execFileSync('unzip', ['-q', '-o', zipPath, '-d', tmpDir]);

    const onnx = findOnnx(tmpDir);
    if (!onnx) throw new Error(`no .onnx file inside ${url}`);
    mkdirSync(destDir, { recursive: true });
    copyFileSync(onnx, destPath);
    console.log(`[setup-rtmpose] Saved public/rtmpose/${name}`);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function findOnnx(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const hit = findOnnx(full);
      if (hit) return hit;
    } else if (entry.name.endsWith('.onnx')) {
      return full;
    }
  }
  return null;
}

for (const model of MODELS) {
  await fetchModel(model);
}
