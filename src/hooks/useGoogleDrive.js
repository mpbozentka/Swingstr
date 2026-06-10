const DRIVE_API = 'https://www.googleapis.com/drive/v3';

const VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
  'video/mpeg',
  'video/3gpp',
  'video/x-ms-wmv',
];

const FOLDER_MIME = 'application/vnd.google-apps.folder';

export function parseDriveFolderId(input) {
  if (!input) return null;
  // Full URL: https://drive.google.com/drive/folders/{id}
  const match = input.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Raw ID (alphanumeric + hyphens/underscores, typically 25-50 chars)
  if (/^[a-zA-Z0-9_-]{10,}$/.test(input.trim())) return input.trim();
  return null;
}

/**
 * Pull the human-readable reason out of a failed Drive API response. Google
 * returns a JSON body like { error: { message: "...has not been used in
 * project... or it is disabled" } } even when the request expected raw bytes,
 * so surfacing that message turns an opaque "403" into an actionable one.
 */
async function describeError(res) {
  let detail = '';
  try {
    const body = await res.json();
    detail = body?.error?.message || '';
  } catch {
    /* non-JSON body — fall back to the status code alone */
  }
  return detail ? `${detail} (${res.status})` : `Drive API error: ${res.status}`;
}

export function useGoogleDrive(accessToken) {
  const authHeaders = () => ({
    Authorization: `Bearer ${accessToken}`,
  });

  const listFolder = async (folderId) => {
    const mimeQuery = VIDEO_MIME_TYPES.map((m) => `mimeType='${m}'`).join(' or ');
    const q = `'${folderId}' in parents and trashed=false and (mimeType='${FOLDER_MIME}' or ${mimeQuery})`;
    const params = new URLSearchParams({
      q,
      fields: 'files(id,name,mimeType,size,modifiedTime)',
      orderBy: 'folder,name',
      pageSize: '200',
    });
    const res = await fetch(`${DRIVE_API}/files?${params}`, {
      headers: authHeaders(),
    });
    if (res.status === 401) throw new Error('SESSION_EXPIRED');
    if (!res.ok) throw new Error(await describeError(res));
    const data = await res.json();
    return data.files || [];
  };

  const streamFile = async (fileId) => {
    const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
      headers: authHeaders(),
    });
    if (res.status === 401) throw new Error('SESSION_EXPIRED');
    if (!res.ok) throw new Error(await describeError(res));
    return res.blob();
  };

  return { listFolder, streamFile };
}
