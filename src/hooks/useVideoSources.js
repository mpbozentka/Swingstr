import { useCallback, useEffect, useState } from 'react';
import {
  registerObjectUrl,
  releaseObjectUrl,
  releaseAllObjectUrls,
} from '../utils/storage';
import { isYouTubeUrl, parseVideoUrl } from '../utils/url';

/**
 * Owns the left/right video sources. Keeps both the playable URL (object URL
 * for File uploads, plain http(s) for remote) and, for local uploads, the
 * underlying File so callers can persist the raw bytes.
 *
 * Object URLs are routed through the registry in storage.js so they're
 * revoked on replace/clear and on unmount. Without that, every upload leaks
 * one allocation per video for the rest of the session.
 */
export function useVideoSources({ onClear } = {}) {
  const [left, setLeft] = useState(null);
  const [right, setRight] = useState(null);
  const [leftFile, setLeftFile] = useState(null);
  const [rightFile, setRightFile] = useState(null);
  const [leftDriveFileId, setLeftDriveFileId] = useState(null);
  const [rightDriveFileId, setRightDriveFileId] = useState(null);

  useEffect(() => releaseAllObjectUrls, []);

  const setSource = (side, url, file) => {
    if (side === 'left') {
      setLeft(url);
      setLeftFile(file);
    } else {
      setRight(url);
      setRightFile(file);
    }
  };

  const uploadFile = useCallback((side, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = registerObjectUrl(`video:${side}`, file);
    setSource(side, url, file);
  }, []);

  /**
   * Accepts a raw URL string from the parent (which owns the prompt UI) and
   * returns either an error string (caller surfaces it) or null on success.
   * YouTube URLs are downloaded by the desktop app, then loaded as a local file.
   */
  const uploadUrl = useCallback(async (side, raw) => {
    const url = parseVideoUrl(raw);
    if (!url) return { error: 'Not a valid http(s) video URL.' };

    if (isYouTubeUrl(url)) {
      const desktop = typeof window !== 'undefined' ? window.swingstrDesktop : null;
      if (!desktop?.downloadYouTube) {
        return { error: 'YouTube links only work in the Swingstr desktop app.' };
      }
      try {
        const result = await desktop.downloadYouTube(url);
        if (result?.error) return { error: result.error };
        const res = await fetch(result.playUrl);
        if (!res.ok) return { error: "Downloaded, but couldn't load the clip." };
        const blob = await res.blob();
        const file = new File(
          [blob],
          result.fileName || 'youtube.mp4',
          { type: blob.type || 'video/mp4' }
        );
        releaseObjectUrl(`video:${side}`);
        const objectUrl = registerObjectUrl(`video:${side}`, file);
        setSource(side, objectUrl, file);
        return null;
      } catch (err) {
        return { error: err?.message || "Couldn't download that YouTube clip." };
      }
    }

    releaseObjectUrl(`video:${side}`);
    setSource(side, url, null);
    return null;
  }, []);

  const loadDriveVideo = useCallback((side, blob, driveFileId) => {
    const url = registerObjectUrl(`video:${side}`, blob);
    setSource(side, url, null);
    if (side === 'left') setLeftDriveFileId(driveFileId);
    else setRightDriveFileId(driveFileId);
  }, []);

  const clear = useCallback((side) => {
    releaseObjectUrl(`video:${side}`);
    setSource(side, null, null);
    if (side === 'left') setLeftDriveFileId(null);
    else setRightDriveFileId(null);
    onClear?.(side);
  }, [onClear]);

  return {
    leftVideo: left,
    rightVideo: right,
    leftFile,
    rightFile,
    leftDriveFileId,
    rightDriveFileId,
    handleUpload: uploadFile,
    handleUrlUpload: uploadUrl,
    handleDriveLoad: loadDriveVideo,
    handleClearVideo: clear,
  };
}
