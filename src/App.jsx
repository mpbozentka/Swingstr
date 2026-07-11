import React, { useState, useRef, useEffect, useCallback } from 'react';
import StudentLibrary from './components/StudentLibrary';
import AnalyzerView from './components/AnalyzerView';
import Toast from './components/Toast';
import UrlPromptModal from './components/UrlPromptModal';

import { loadStudents, saveStudents, saveVideoBlob } from './utils/storage';
import { useDebouncedEffect } from './hooks/useDebouncedEffect';
import { useVideoSources } from './hooks/useVideoSources';
import { useMarkers } from './hooks/useMarkers';
import { useGoogleAuth } from './hooks/useGoogleAuth';
import { usePoseAnalysis } from './hooks/usePoseAnalysis';

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
  // Virtual trim range per side: { start, end } in seconds, either may be
  // null. The video file is never modified — playback and scrubbing are
  // confined to this window, and the future pose-analysis pass will only
  // process frames inside it.
  const [trims, setTrims] = useState({ left: { start: null, end: null }, right: { start: null, end: null } });
  // Phase 2: per-side camera-angle tag driving which angle formulas apply
  // (plan 6.1) — user-set, no auto-detection. Handedness only affects which
  // arm counts as "lead" for the face-on lead-arm angle.
  const [viewTypes, setViewTypes] = useState({ left: null, right: null });
  const [handedness, setHandedness] = useState({ left: 'RH', right: 'RH' });
  const [toast, setToast] = useState(null); // { message, kind }
  // Side currently waiting on a URL input (null when modal closed)
  const [urlPromptSide, setUrlPromptSide] = useState(null);
  const [tool, setTool] = useState('move');
  const [color, setColor] = useState('#ef4444');
  const [lineWidth, setLineWidth] = useState(3);
  const [speed, setSpeed] = useState(1.0);
  const [activeMenu, setActiveMenu] = useState(null);

  const leftRef = useRef();
  const rightRef = useRef();

  const {
    poseState,
    analyze: analyzePose,
    cancelAnalysis: cancelPoseAnalysis,
    toggleSkeleton: togglePoseSkeleton,
    clearAnalysis: clearPoseAnalysis,
  } = usePoseAnalysis({ leftRef, rightRef, trims, onToast: setToast });

  const handleSourceClear = useCallback((side) => {
    setSyncPoints((prev) => ({ ...prev, [side]: null }));
    setTrims((prev) => ({ ...prev, [side]: { start: null, end: null } }));
    clearPoseAnalysis(side);
    if (side === activeScreen) {
      setGlobalTime(0);
      setGlobalDuration(0);
      setIsPlaying(false);
    }
  }, [activeScreen, clearPoseAnalysis]);

  const googleAuth = useGoogleAuth();

  const {
    leftVideo, rightVideo, leftFile, rightFile,
    leftDriveFileId, rightDriveFileId,
    handleUpload, handleUrlUpload: setUrlSource, handleDriveLoad, handleClearVideo,
  } = useVideoSources({ onClear: handleSourceClear });

  // Pose cache is keyed to a specific video, not a side — loading a new
  // video into a side that already has an analysis must drop the stale
  // skeleton rather than draw it over unrelated footage (plan section 3).
  // handleSourceClear covers the explicit clear-button path; this covers
  // replace-in-place (upload/URL/Drive over an existing video).
  useEffect(() => { clearPoseAnalysis('left'); }, [leftVideo, clearPoseAnalysis]);
  useEffect(() => { clearPoseAnalysis('right'); }, [rightVideo, clearPoseAnalysis]);

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

  const handleSetTrim = useCallback((bound) => {
    const ref = activeScreen === 'left' ? leftRef : rightRef;
    if (!ref.current?.hasVideo) return;
    const time = ref.current.currentTime;
    const cur = trims[activeScreen];
    if (bound === 'start' && cur.end != null && time >= cur.end) {
      setToast({ message: 'Trim start must be before the trim end.', kind: 'error' });
      return;
    }
    if (bound === 'end' && cur.start != null && time <= cur.start) {
      setToast({ message: 'Trim end must be after the trim start.', kind: 'error' });
      return;
    }
    setTrims((prev) => ({ ...prev, [activeScreen]: { ...prev[activeScreen], [bound]: time } }));
  }, [activeScreen, trims]);

  const handleClearTrim = useCallback(() => {
    setTrims((prev) => ({ ...prev, [activeScreen]: { start: null, end: null } }));
  }, [activeScreen]);

  const handleSetViewType = useCallback((vt) => {
    setViewTypes((prev) => ({ ...prev, [activeScreen]: prev[activeScreen] === vt ? null : vt }));
  }, [activeScreen]);

  const handleToggleHandedness = useCallback(() => {
    setHandedness((prev) => ({ ...prev, [activeScreen]: prev[activeScreen] === 'RH' ? 'LH' : 'RH' }));
  }, [activeScreen]);

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

  // Shared by the timeline slider and the angle-graph panel: clamp to the
  // active side's trim window so the UI doesn't visually jump ahead and snap
  // back on the next timeupdate, then seek whichever panes the current
  // sync/active state says should move.
  const scrubTo = useCallback((raw) => {
    let t = raw;
    const trim = trims[activeScreen];
    if (trim.start != null) t = Math.max(trim.start, t);
    if (trim.end != null) t = Math.min(trim.end, t);
    setGlobalTime(t);
    if (sync) {
      leftRef.current?.seekTo(t);
      rightRef.current?.seekTo(hasSyncOffset ? Math.max(0, t - syncOffset) : t);
    } else {
      if (activeScreen === 'left') leftRef.current?.seekTo(t);
      else rightRef.current?.seekTo(t);
    }
  }, [sync, activeScreen, hasSyncOffset, syncOffset, trims]);

  const handleGlobalScrub = useCallback((e) => {
    scrubTo(parseFloat(e.target.value));
  }, [scrubTo]);

  const saveToStudent = useCallback(async () => {
    if (!saveData.studentId || !saveData.label) return;
    const targetFile = activeScreen === 'left' ? leftFile : rightFile;
    const targetVideo = activeScreen === 'left' ? leftVideo : rightVideo;
    const targetDriveFileId = activeScreen === 'left' ? leftDriveFileId : rightDriveFileId;
    if (!targetVideo) return;

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
      isPlaying={isPlaying}
      togglePlay={togglePlay}
      seek={seek}
      clearShapes={clearShapes}
      onSnapshot={handleSnapshot}
      openSaveModal={() => setShowSaveModal(true)}
      globalTime={globalTime}
      globalDuration={globalDuration}
      onGlobalScrub={handleGlobalScrub}
      onGraphSeek={scrubTo}
      onTimeUpdate={handleTimeUpdate}
      onLinkedScrub={handleLinkedScrub}
      showSequenceModal={showSequenceModal}
      setShowSequenceModal={setShowSequenceModal}
      markers={markers}
      trims={trims}
      activeTrim={trims[activeScreen]}
      onSetTrim={handleSetTrim}
      onClearTrim={handleClearTrim}
      poseState={poseState}
      activePose={poseState[activeScreen]}
      poseBusy={poseState.left.status === 'analyzing' || poseState.right.status === 'analyzing'}
      onAnalyze={() => analyzePose(activeScreen)}
      onCancelAnalysis={() => cancelPoseAnalysis(activeScreen)}
      onToggleSkeleton={() => togglePoseSkeleton(activeScreen)}
      viewTypes={viewTypes}
      handedness={handedness}
      activeViewType={viewTypes[activeScreen]}
      activeHandedness={handedness[activeScreen]}
      onSetViewType={handleSetViewType}
      onToggleHandedness={handleToggleHandedness}
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
