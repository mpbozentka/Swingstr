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
