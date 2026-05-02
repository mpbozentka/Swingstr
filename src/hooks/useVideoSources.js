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

  const uploadUrl = useCallback((side) => {
    const raw = prompt('Enter Direct Video URL (mp4/mov):');
    if (!raw) return;
    const url = parseVideoUrl(raw);
    if (!url) {
      alert('That URL is not a valid http(s) video URL.');
      return;
    }
    releaseObjectUrl(`video:${side}`);
    setSource(side, url, null);
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
    handleUpload: uploadFile,
    handleUrlUpload: uploadUrl,
    handleClearVideo: clear,
  };
}
