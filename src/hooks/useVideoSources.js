import { useCallback, useEffect, useState } from 'react';
import {
  registerObjectUrl,
  releaseObjectUrl,
  releaseAllObjectUrls,
} from '../utils/storage';
import { parseVideoUrl } from '../utils/url';

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

  // driveFileId is set explicitly on every source change — leaving a stale ID
  // behind made "Save to Student" record the previous Drive file instead of
  // the video actually on screen.
  const setSource = (side, url, file, driveFileId = null) => {
    if (side === 'left') {
      setLeft(url);
      setLeftFile(file);
      setLeftDriveFileId(driveFileId);
    } else {
      setRight(url);
      setRightFile(file);
      setRightDriveFileId(driveFileId);
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
   */
  const uploadUrl = useCallback((side, raw) => {
    const url = parseVideoUrl(raw);
    if (!url) return { error: 'Not a valid http(s) video URL.' };
    releaseObjectUrl(`video:${side}`);
    setSource(side, url, null);
    return null;
  }, []);

  const loadDriveVideo = useCallback((side, blob, driveFileId) => {
    const url = registerObjectUrl(`video:${side}`, blob);
    setSource(side, url, null, driveFileId);
  }, []);

  /** Load a Blob (e.g. a saved video pulled back out of IndexedDB). The blob
   *  doubles as the `file` so re-saving the video works like a fresh upload. */
  const loadBlobVideo = useCallback((side, blob) => {
    const url = registerObjectUrl(`video:${side}`, blob);
    setSource(side, url, blob);
  }, []);

  const clear = useCallback((side) => {
    releaseObjectUrl(`video:${side}`);
    setSource(side, null, null);
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
    handleBlobLoad: loadBlobVideo,
    handleClearVideo: clear,
  };
}
