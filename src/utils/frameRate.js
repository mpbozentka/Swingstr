// Browsers don't expose a video's frame rate. For MP4/MOV (what phones and
// yt-dlp produce) read it from the container: the video track's media
// timescale divided by its most common sample duration (stts). That's exact
// and needs no playback.

const COMMON_RATES = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 90, 100, 119.88, 120, 240];

export function snapRate(fps) {
  const near = COMMON_RATES.reduce((a, b) => (Math.abs(b - fps) < Math.abs(a - fps) ? b : a));
  return Math.abs(near - fps) / near < 0.015 ? near : Math.round(fps * 100) / 100;
}

function boxes(view, start, end) {
  const out = [];
  let p = start;
  while (p + 8 <= end) {
    let size = view.getUint32(p);
    const type = String.fromCharCode(view.getUint8(p + 4), view.getUint8(p + 5), view.getUint8(p + 6), view.getUint8(p + 7));
    let header = 8;
    if (size === 1) { size = Number(view.getBigUint64(p + 8)); header = 16; }
    else if (size === 0) size = end - p;
    if (size < header || p + size > end) break;
    out.push({ type, start: p + header, end: p + size });
    p += size;
  }
  return out;
}

const child = (view, box, type) => boxes(view, box.start, box.end).find((b) => b.type === type);

function rateFromMoov(view, moov) {
  for (const trak of boxes(view, moov.start, moov.end).filter((b) => b.type === 'trak')) {
    const mdia = child(view, trak, 'mdia');
    const hdlr = mdia && child(view, mdia, 'hdlr');
    if (!hdlr) continue;
    const handler = String.fromCharCode(...[8, 9, 10, 11].map((o) => view.getUint8(hdlr.start + o)));
    if (handler !== 'vide') continue;
    const mdhd = child(view, mdia, 'mdhd');
    const version = view.getUint8(mdhd.start);
    const timescale = view.getUint32(mdhd.start + (version === 1 ? 20 : 12));
    const stts = child(view, child(view, child(view, mdia, 'minf'), 'stbl'), 'stts');
    const entries = view.getUint32(stts.start + 4);
    let best = { count: 0, delta: 0 };
    for (let i = 0; i < entries; i++) {
      const count = view.getUint32(stts.start + 8 + i * 8);
      const delta = view.getUint32(stts.start + 12 + i * 8);
      if (count > best.count && delta > 0) best = { count, delta };
    }
    if (timescale && best.delta) return snapRate(timescale / best.delta);
  }
  return null;
}

async function readBytes(blob, start, end) {
  return new DataView(await blob.slice(start, end).arrayBuffer());
}

/** Frame rate from an MP4/MOV container, or null if it can't be read. */
export async function frameRateFromContainer(src, signal) {
  try {
    const blob = await (await fetch(src, { signal })).blob();
    // Walk top-level box headers without loading the whole file; moov can sit
    // at the start or the end.
    let p = 0;
    while (p + 16 <= blob.size) {
      const head = await readBytes(blob, p, p + 16);
      let size = head.getUint32(0);
      const type = String.fromCharCode(head.getUint8(4), head.getUint8(5), head.getUint8(6), head.getUint8(7));
      let header = 8;
      if (size === 1) { size = Number(head.getBigUint64(8)); header = 16; }
      else if (size === 0) size = blob.size - p;
      if (size < header) return null;
      if (type === 'moov') {
        const view = await readBytes(blob, p, p + size);
        return rateFromMoov(view, { start: header, end: size });
      }
      p += size;
    }
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
  }
  return null;
}
