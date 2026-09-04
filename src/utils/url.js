/**
 * Validate a user-supplied URL for use as a <video> source.
 * Allows only http(s); rejects javascript:, data:, file:, etc. so we don't
 * persist garbage into the student CRM and don't surprise the snapshot path
 * with non-CORS URIs.
 */
export function parseVideoUrl(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  return parsed.toString();
}

function youtubeHost(hostname) {
  const host = String(hostname || '').replace(/^www\./, '').toLowerCase();
  return (
    host === 'youtu.be' ||
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtube-nocookie.com' ||
    host.endsWith('.youtube.com')
  );
}

export function isYouTubeUrl(input) {
  const url = parseVideoUrl(input);
  if (!url) return false;
  return youtubeHost(new URL(url).hostname);
}

/** 11-character video id, or null if this isn't a watch/shorts/embed URL. */
export function extractYouTubeId(input) {
  const url = parseVideoUrl(input);
  if (!url) return null;
  const parsed = new URL(url);
  if (!youtubeHost(parsed.hostname)) return null;
  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  if (host === 'youtu.be') {
    const id = parsed.pathname.split('/').filter(Boolean)[0] || '';
    return id.slice(0, 11) || null;
  }
  const fromQuery = parsed.searchParams.get('v');
  if (fromQuery) return fromQuery;
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (['shorts', 'embed', 'live', 'v'].includes(parts[0]) && parts[1]) return parts[1];
  return null;
}
