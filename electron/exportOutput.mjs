import { mkdir, writeFile, realpath } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import path from 'node:path';

// Destinations are chosen by native code. Renderer inputs never contain paths.
export async function saveExportOutput(payload, { directory, checkout, library, chooseDestination }) {
  if (!['mp4', 'webm'].includes(payload.ext) || !['exports', 'dialog'].includes(payload.destination) || !(payload.bytes instanceof ArrayBuffer)) throw new Error('Invalid export payload.');
  await mkdir(directory, { recursive: true });
  let destination = path.join(directory, `swing-${Date.now()}.${payload.ext}`);
  if (payload.destination === 'dialog') {
    const result = await chooseDestination(destination, payload.ext);
    if (result.canceled) return { cancelled: true };
    destination = result.filePath;
    if (path.extname(destination).toLowerCase() !== `.${payload.ext}`) destination += `.${payload.ext}`;
  }
  const parent = await realpath(path.dirname(destination));
  const resolved = path.join(parent, path.basename(destination));
  for (const excluded of [checkout, library]) {
    const root = await realpath(excluded).catch((error) => { if (error.code === 'ENOENT') return path.resolve(excluded); throw error; });
    if (resolved === root || resolved.startsWith(root + path.sep)) throw new Error('Exports must stay outside the source checkout and student library.');
  }
  const extension = path.extname(resolved), base = resolved.slice(0, -extension.length);
  for (let n = 0; n < 1000; n++) {
    const candidate = n ? `${base}-${n}${extension}` : resolved;
    try { await writeFile(candidate, Buffer.from(payload.bytes), { flag: 'wx' }); return { path: candidate }; }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  throw new Error('Could not find a new export filename.');
}
