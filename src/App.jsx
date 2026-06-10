import React, { useState, useRef, useEffect, useCallback } from 'react';
import StudentLibrary from './components/StudentLibrary';
import AnalyzerView from './components/AnalyzerView';
import Toast from './components/Toast';
import UrlPromptModal from './components/UrlPromptModal';

import { loadStudents, saveStudents, saveVideoBlob, loadVideoBlob } from './utils/storage';
import { useDebouncedEffect } from './hooks/useDebouncedEffect';
import { useVideoSources } from './hooks/useVideoSources';
import { useMarkers } from './hooks/useMarkers';
import { useGoogleAuth } from './hooks/useGoogleAuth';
import { useGoogleDrive } from './hooks/useGoogleDrive';

const newId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function Swingstr() {
  const [view, setView] = useState('analyze');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSequenceModal, setShowSequenceModal] = useState(false);
  const [layout, setLayout] = useState('single');
  const [sync, setSync] = useState(false);
  const [activeScreen, setActiveScreen] = useState('left');
  const [isPlaying, setIsPlaying] = useState(false);
  const [zooms, setZooms] = useState({ left: 1.0, right: 1.0 });

  const [globalTime, setGlobalTime] = useState(0);
  const [globalDuration, setGlobalDuration] = useState(0);
  // Stable getter for the rAF-driven marker jump helpers; reading from this
  // ref avoids re-creating the hook callbacks on every globalTime change.
  const globalTimeRef = useRef(0);
  useEffect(() => { globalTimeRef.current = globalTime; }, [globalTime]);
  const getGlobalTime = useCallback(() => globalTimeRef.current, []);

  const [students, setStudents] = useState(() => loadStudents());
  const [saveData, setSaveData] = useState({ studentId: '', label: '' });
  const [editingStudent, setEditingStudent] = useState(null);

  const [syncPoints, setSyncPoints] = useState({ left: null, right: null });
  const [toast, setToast] = useState(null); // { message, kind }
  // Side currently waiting on a URL input (null when modal closed)
  const [urlPromptSide, setUrlPromptSide] = useState(null);
  const [tool, setTool] = useState('move');
  const [color, setColor] = useState('#ef4444');
  const [lineWidth, setLineWidth] = useState(3);
  const [speed, setSpeed] = useState(1.0);
  const [activeMenu, setActiveMenu] = useState(null);
  const [showSkeleton, setShowSkeleton] = useState(false);

  const leftRef = useRef();
  const rightRef = useRef();

  const handleSourceClear = useCallback((side) => {
    setSyncPoints((prev) => ({ ...prev, [side]: null }));
    if (side === activeScreen) {
      setGlobalTime(0);
      setGlobalDuration(0);
      setIsPlaying(false);
    }
  }, [activeScreen]);

  const googleAuth = useGoogleAuth();

  const {
    leftVideo, rightVideo, leftFile, rightFile,
    leftDriveFileId, rightDriveFileId,
    handleUpload, handleUrlUpload: setUrlSource, handleDriveLoad, handleBlobLoad, handleClearVideo,
  } = useVideoSources({ onClear: handleSourceClear });

  const { streamFile } = useGoogleDrive(googleAuth.accessToken);

  // Load a video record saved in a student's library back into the analyzer.
  const loadSavedVideo = useCallback(async (side, record) => {
    try {
      if (record.driveFileId) {
        if (!googleAuth.isSignedIn) {
          setToast({ message: 'Sign in with Google to load this Drive video.', kind: 'error' });
          return false;
        }
        const blob = await streamFile(record.driveFileId);
        handleDriveLoad(side, blob, record.driveFileId);
      } else if (record.remoteUrl) {
        const result = setUrlSource(side, record.remoteUrl);
        if (result?.error) {
          setToast({ message: result.error, kind: 'error' });
          return false;
        }
      } else {
        const blob = await loadVideoBlob(record.videoId ?? record.id);
        if (!blob) {
          setToast({ message: 'Video not found in browser storage — it may have been cleared.', kind: 'error' });
          return false;
        }
        handleBlobLoad(side, blob);
      }
      if (side === 'right') setLayout('split');
      setActiveScreen(side);
      setView('analyze');
      return true;
    } catch (err) {
      console.warn('[loadSavedVideo] failed', err);
      setToast({
        message: err.message === 'SESSION_EXPIRED'
          ? 'Google session expired — sign out and sign in again.'
          : `Couldn't load video: ${err.message}`,
        kind: 'error',
      });
      return false;
    }
  }, [googleAuth.isSignedIn, streamFile, handleDriveLoad, setUrlSource, handleBlobLoad]);

  const requestUrlUpload = useCallback((side) => {
    setUrlPromptSide(side);
  }, []);

  const handleUrlSubmit = useCallback((raw) => {
    if (!urlPromptSide) return null;
    const result = setUrlSource(urlPromptSide, raw);
    if (!result) setUrlPromptSide(null);
    return result;
  }, [urlPromptSide, setUrlSource]);

  const {
    markers,
    setMarker: handleSetMarker,
    removeMarker: handleRemoveMarker,
    jumpTo: jumpToMarker,
    jumpRelative: jumpRelativeMarker,
  } = useMarkers({ leftRef, rightRef, getGlobalTime, setGlobalTime });

  // Debounced — every keystroke in a student's notes textarea would otherwise
  // serialize the whole CRM (#21).
  useDebouncedEffect(() => saveStudents(students), [students], 300);

  const handleSetSyncPoint = useCallback((side) => {
    const ref = side === 'left' ? leftRef : rightRef;
    const time = ref.current?.currentTime ?? 0;
    setSyncPoints((prev) => ({ ...prev, [side]: time }));
  }, []);

  const handleClearSyncPoint = useCallback((side) => {
    setSyncPoints((prev) => ({ ...prev, [side]: null }));
  }, []);

  const hasSyncOffset = sync && syncPoints.left != null && syncPoints.right != null;
  const syncOffset = hasSyncOffset ? syncPoints.left - syncPoints.right : 0;

  // Drift correction loop (#6): different decode timings would let the two
  // videos visibly slip apart over a few seconds of synced playback. While
  // playing in sync, run a per-frame check and snap the right video back
  // when it drifts more than ~1 frame at 30fps. The snap is gentle enough
  // that the user only sees an occasional tiny re-seek, not stutter.
  useEffect(() => {
    if (!sync || !isPlaying) return undefined;
    let frame = 0;
    const DRIFT_THRESHOLD = 0.06;
    const tick = () => {
      const left = leftRef.current;
      const right = rightRef.current;
      if (left && right) {
        const lt = left.currentTime;
        const expected = Math.max(0, lt - syncOffset);
        const drift = right.currentTime - expected;
        if (Number.isFinite(drift) && Math.abs(drift) > DRIFT_THRESHOLD) {
          right.seekTo(expected);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [sync, isPlaying, syncOffset]);

  const adjustZoom = useCallback((delta) => {
    setZooms((prev) => {
      const current = prev[activeScreen];
      const newVal = Math.max(1.0, Math.min(4.0, current + delta));
      return { ...prev, [activeScreen]: newVal };
    });
  }, [activeScreen]);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      const newState = !prev;
      if (sync) {
        if (newState && hasSyncOffset) {
          // Pre-seek right video to maintain offset before playing
          const leftTime = leftRef.current?.currentTime ?? 0;
          const rightTarget = Math.max(0, leftTime - syncOffset);
          rightRef.current?.seekTo(rightTarget);
        }
        if (newState) {
          leftRef.current?.play();
          rightRef.current?.play();
        } else {
          leftRef.current?.pause();
          rightRef.current?.pause();
        }
      } else {
        const target = activeScreen === 'left' ? leftRef : rightRef;
        if (newState) target.current?.play();
        else target.current?.pause();
      }
      return newState;
    });
  }, [sync, activeScreen, hasSyncOffset, syncOffset]);

  const seek = useCallback((amount) => {
    if (sync) {
      leftRef.current?.seekRelative(amount);
      rightRef.current?.seekRelative(amount);
    } else {
      const target = activeScreen === 'left' ? leftRef : rightRef;
      target.current?.seekRelative(amount);
    }
  }, [sync, activeScreen]);

  const changeSpeed = useCallback((newSpeed) => {
    setSpeed(newSpeed);
    leftRef.current?.setPlaybackRate(newSpeed);
    rightRef.current?.setPlaybackRate(newSpeed);
  }, []);

  const clearShapes = useCallback(() => {
    const target = activeScreen === 'left' ? leftRef : rightRef;
    target.current?.clearShapes();
  }, [activeScreen]);

  const handleSnapshot = useCallback(async () => {
    const target = activeScreen === 'left' ? leftRef : rightRef;
    if (!target.current) return;
    const dataUrl = await target.current.getSnapshot();
    if (dataUrl) {
      const link = document.createElement('a');
      link.download = `swingstr-${Date.now()}.jpg`;
      link.href = dataUrl;
      link.click();
    }
  }, [activeScreen]);

  const handleTimeUpdate = useCallback((time, dur) => {
    setGlobalTime(time);
    setGlobalDuration(dur);
  }, []);

  const handleLinkedScrub = useCallback((time) => {
    if (sync) {
      leftRef.current?.seekTo(time);
      rightRef.current?.seekTo(hasSyncOffset ? Math.max(0, time - syncOffset) : time);
    }
  }, [sync, hasSyncOffset, syncOffset]);

  const handleGlobalScrub = useCallback((e) => {
    const t = parseFloat(e.target.value);
    setGlobalTime(t);
    if (sync) {
      leftRef.current?.seekTo(t);
      rightRef.current?.seekTo(hasSyncOffset ? Math.max(0, t - syncOffset) : t);
    } else {
      if (activeScreen === 'left') leftRef.current?.seekTo(t);
      else rightRef.current?.seekTo(t);
    }
  }, [sync, activeScreen, hasSyncOffset, syncOffset]);

  const saveToStudent = useCallback(async () => {
    if (!saveData.studentId || !saveData.label.trim()) return;
    const targetFile = activeScreen === 'left' ? leftFile : rightFile;
    const targetVideo = activeScreen === 'left' ? leftVideo : rightVideo;
    const targetDriveFileId = activeScreen === 'left' ? leftDriveFileId : rightDriveFileId;
    if (!targetVideo) {
      setToast({ message: 'No video loaded on the active screen.', kind: 'error' });
      return;
    }

    const videoId = newId();
    const baseRecord = { id: videoId, label: saveData.label, date: new Date().toLocaleDateString() };
    // Drive videos store only the file ID — re-fetched from Drive on demand.
    // Local uploads go to IndexedDB. Remote URLs stored as-is.
    const record = targetDriveFileId
      ? { ...baseRecord, driveFileId: targetDriveFileId, source: 'drive' }
      : targetFile
        ? { ...baseRecord, videoId, source: 'idb' }
        : { ...baseRecord, remoteUrl: targetVideo, source: 'remote' };

    if (targetFile) {
      try {
        await saveVideoBlob(videoId, targetFile);
      } catch (err) {
        console.warn('[saveToStudent] IndexedDB write failed', err);
        setToast({ message: "Couldn't save locally — browser may be in private mode or out of space.", kind: 'error' });
        return;
      }
    }

    setStudents((prev) =>
      prev.map((s) =>
        s.id === saveData.studentId
          ? { ...s, videos: [...(s.videos || []), record] }
          : s
      )
    );
    setShowSaveModal(false);
    setSaveData({ studentId: '', label: '' });
    setToast({ message: 'Saved to student library.', kind: 'success' });
  }, [saveData, activeScreen, leftFile, rightFile, leftVideo, rightVideo, leftDriveFileId, rightDriveFileId]);

  useEffect(() => {
    const isTextish = (el) =>
      !!el && (el.matches?.(':where(input, textarea, select, [contenteditable=""], [contenteditable="true"])') ?? false);

    const handleKeyDown = (e) => {
      if (isTextish(document.activeElement)) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seek(-0.05);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        seek(0.05);
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        if (!e.repeat) togglePlay();
        return;
      }
      // Block setting/jumping on auto-repeat to avoid spamming the decoder
      // (#9). Arrow seeks above still respond to repeat.
      if (e.repeat) return;
      const shiftDigit = e.shiftKey && e.code?.match(/^Digit([0-9])$/);
      const digitMatch = e.key.match(/^[0-9]$/);
      if (shiftDigit) {
        const keyIndex = shiftDigit[1] === '0' ? 9 : parseInt(shiftDigit[1], 10) - 1;
        e.preventDefault();
        handleSetMarker(activeScreen, keyIndex, globalTime);
      } else if (digitMatch && !e.metaKey && !e.altKey && !e.ctrlKey && !e.shiftKey) {
        const keyIndex = e.key === '0' ? 9 : parseInt(e.key, 10) - 1;
        e.preventDefault();
        jumpToMarker(activeScreen, keyIndex);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [seek, togglePlay, handleSetMarker, jumpToMarker, activeScreen, globalTime]);

  const toastEl = (
    <Toast
      message={toast?.message}
      kind={toast?.kind}
      onDismiss={() => setToast(null)}
    />
  );

  if (view === 'library') {
    return (
      <>
        <StudentLibrary
          students={students}
          setStudents={setStudents}
          editingStudent={editingStudent}
          setEditingStudent={setEditingStudent}
          onBack={() => setView('analyze')}
          onToast={(t) => setToast(t)}
          isSignedIn={googleAuth.isSignedIn}
          accessToken={googleAuth.accessToken}
          onDriveLoad={handleDriveLoad}
          onLoadSavedVideo={loadSavedVideo}
        />
        {toastEl}
      </>
    );
  }

  return (
    <>
    <AnalyzerView
      onOpenLibrary={() => setView('library')}
      layout={layout}
      setLayout={setLayout}
      sync={sync}
      setSync={setSync}
      activeScreen={activeScreen}
      setActiveScreen={setActiveScreen}
      zooms={zooms}
      adjustZoom={adjustZoom}
      leftRef={leftRef}
      rightRef={rightRef}
      leftVideo={leftVideo}
      rightVideo={rightVideo}
      onUpload={handleUpload}
      onUrlUpload={requestUrlUpload}
      onClearVideo={handleClearVideo}
      tool={tool}
      setTool={setTool}
      color={color}
      setColor={setColor}
      lineWidth={lineWidth}
      setLineWidth={setLineWidth}
      speed={speed}
      changeSpeed={changeSpeed}
      activeMenu={activeMenu}
      setActiveMenu={setActiveMenu}
      showSkeleton={showSkeleton}
      setShowSkeleton={setShowSkeleton}
      isPlaying={isPlaying}
      togglePlay={togglePlay}
      seek={seek}
      clearShapes={clearShapes}
      onSnapshot={handleSnapshot}
      openSaveModal={() => setShowSaveModal(true)}
      globalTime={globalTime}
      globalDuration={globalDuration}
      onGlobalScrub={handleGlobalScrub}
      onTimeUpdate={handleTimeUpdate}
      onLinkedScrub={handleLinkedScrub}
      showSequenceModal={showSequenceModal}
      setShowSequenceModal={setShowSequenceModal}
      markers={markers}
      syncPoints={syncPoints}
      hasSyncOffset={hasSyncOffset}
      onSetSyncPoint={handleSetSyncPoint}
      onClearSyncPoint={handleClearSyncPoint}
      activeMarkers={markers[activeScreen]}
      onSetMarker={(index, time) => handleSetMarker(activeScreen, index, time)}
      onRemoveMarker={(index) => handleRemoveMarker(activeScreen, index)}
      onJumpToMarker={(index) => jumpToMarker(activeScreen, index)}
      onPrevMarker={() => jumpRelativeMarker(activeScreen, -1)}
      onNextMarker={() => jumpRelativeMarker(activeScreen, +1)}
      students={students}
      showSaveModal={showSaveModal}
      setShowSaveModal={setShowSaveModal}
      saveData={saveData}
      setSaveData={setSaveData}
      saveToStudent={saveToStudent}
      isSignedIn={googleAuth.isSignedIn}
      userEmail={googleAuth.userEmail}
      accessToken={googleAuth.accessToken}
      onSignIn={googleAuth.signIn}
      onSignOut={googleAuth.signOut}
      onDriveLoad={handleDriveLoad}
    />
    <UrlPromptModal
      open={!!urlPromptSide}
      onSubmit={handleUrlSubmit}
      onClose={() => setUrlPromptSide(null)}
    />
    {toastEl}
    </>
  );
}
