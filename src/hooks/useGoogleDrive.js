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
    if (!res.ok) throw new Error(`Drive API error: ${res.status}`);
    const data = await res.json();
    return data.files || [];
  };

  const streamFile = async (fileId) => {
    const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
      headers: authHeaders(),
    });
    if (res.status === 401) throw new Error('SESSION_EXPIRED');
    if (!res.ok) throw new Error(`Drive download error: ${res.status}`);
    return res.blob();
  };

  return { listFolder, streamFile };
}
