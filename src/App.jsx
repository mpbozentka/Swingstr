import React, { useState, useRef, useEffect, useCallback } from 'react';
import StudentLibrary from './components/StudentLibrary';
import AnalyzerView from './components/AnalyzerView';
import Toast from './components/Toast';
import UrlPromptModal from './components/UrlPromptModal';
import { NEW_STUDENT } from './components/SaveModal';

import { loadStudents, saveStudents, saveVideoBlob, loadVideoBlob, videoSavingEnabled } from './utils/storage';
import { useDebouncedEffect } from './hooks/useDebouncedEffect';
import { useVideoSources } from './hooks/useVideoSources';
import { useMarkers } from './hooks/useMarkers';
import { useGoogleAuth } from './hooks/useGoogleAuth';
import { useGoogleDrive } from './hooks/useGoogleDrive';
import { useSwingWorkflow } from './hooks/useSwingWorkflow';
import { useSwingstrControl } from './hooks/useSwingstrControl';

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
  // Reading the playhead from this ref instead of `globalTime` keeps the
  // marker-step callback from being rebuilt on every timeupdate.
  const globalTimeRef = useRef(0);
  useEffect(() => { globalTimeRef.current = globalTime; }, [globalTime]);

  const [students, setStudents] = useState(() => loadStudents());
  const [saveData, setSaveData] = useState({ studentId: '', label: '', newStudentName: '' });
  const [editingStudent, setEditingStudent] = useState(null);

  const [syncPoints, setSyncPoints] = useState({ left: null, right: null });
  // Virtual trim range per side: { start, end } in seconds, either may be
  // null. The video file is never modified — playback and scrubbing are
  // confined to this window.
  const [toast, setToast] = useState(null); // { message, kind }
  // Side currently waiting on a URL input (null when modal closed)
  const [urlPromptSide, setUrlPromptSide] = useState(null);
  const [tool, setTool] = useState('move');
  const [color, setColor] = useState('#ff3333');
  const [lineWidth, setLineWidth] = useState(3);
  const [speed, setSpeed] = useState(1.0);
  const [activeMenu, setActiveMenu] = useState(null);

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
    handleUpload, handleUrlUpload: setUrlSource, handleDriveLoad, handleClearVideo,
  } = useVideoSources({ onClear: handleSourceClear });

  const requestUrlUpload = useCallback((side) => {
    setUrlPromptSide(side);
  }, []);

  const handleUrlSubmit = useCallback(async (raw) => {
    if (!urlPromptSide) return null;
    const result = await setUrlSource(urlPromptSide, raw);
    if (!result) setUrlPromptSide(null);
    return result;
  }, [urlPromptSide, setUrlSource]);

  const { streamFile: streamDriveFile } = useGoogleDrive(googleAuth.accessToken);

  // Opens a video saved on a student's page into the analyzer. Each record
  // type lives somewhere different: app storage, Google Drive, or a web link.
  const openSavedVideo = useCallback(async (side, video) => {
    try {
      if (video.source === 'idb') {
        const blob = await loadVideoBlob(video.videoId);
        if (!blob) throw new Error("the saved file wasn't found");
        const file = new File([blob], video.label || 'saved-video.mp4', { type: blob.type || 'video/mp4' });
        handleUpload(side, { target: { files: [file] } });
      } else if (video.source === 'drive') {
        const blob = await streamDriveFile(video.driveFileId);
        handleDriveLoad(side, blob, video.driveFileId);
      } else if (video.remoteUrl) {
        const result = await setUrlSource(side, video.remoteUrl);
        if (result?.error) throw new Error(result.error);
      } else {
        throw new Error('this video has no file attached');
      }
    } catch (err) {
      console.error('[openSavedVideo] failed', err);
      const reason = err.message === 'SESSION_EXPIRED' ? 'Google sign-in expired — sign in again' : err.message;
      setToast({ message: `Couldn't open "${video.label}": ${reason}`, kind: 'error' });
      return;
    }
    if (side === 'right') setLayout('split');
    setActiveScreen(side);
    setView('analyze');
    return true;
  }, [handleUpload, handleDriveLoad, setUrlSource, streamDriveFile]);

  const {
    markers,
    setMarker: handleSetMarker,
    removeMarker: handleRemoveMarker,
    clearSide: clearMarkers,
  } = useMarkers();

  // P-markers are timestamps into one particular swing. Loading a new video
  // into a side clears that side's markers; the other side keeps its own, so
  // left and right can hold different swings each with their own positions.
  useEffect(() => { clearMarkers('left'); }, [leftVideo, clearMarkers]);
  useEffect(() => { clearMarkers('right'); }, [rightVideo, clearMarkers]);

  const workflow = useSwingWorkflow({ leftRef, rightRef, markers, setMarker: handleSetMarker, removeMarker: handleRemoveMarker, leftVideo, rightVideo });
  const trims = Object.fromEntries(['left', 'right'].map((side) => [side, workflow.selections[side] ? workflow.resolved(side) : { start: null, end: null }]));

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

  const handleSetTrim = ((bound) => {
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
    try { workflow.setSegment(activeScreen, { kind: 'times', start: cur.start ?? 0, end: cur.end ?? ref.current.duration, [bound]: time }); } catch (error) { setToast({ message: error.message, kind: 'error' }); }
  });

  const handleClearTrim = (() => {
    workflow.clearSegment(activeScreen);
  });

  const hasSyncOffset = sync && syncPoints.left != null && syncPoints.right != null;
  const syncOffset = hasSyncOffset ? syncPoints.left - syncPoints.right : 0;

  const reportError = (error) => setToast({ message: error.message, kind: 'error' });
  const setMarkerIndependent = useCallback((side, index, time) => {
    handleSetMarker(side, index, time);
  }, [handleSetMarker]);
  const goToMarker = (index, side = activeScreen) => {
    workflow.seekPosition(index + 1, sync || workflow.comparison.mode === 'aligned' ? 'both' : side).catch(reportError);
  };

  // Step to the neighbouring checkpoint in `direction`. The 0.05s dead zone
  // keeps a marker we're already parked on from counting as "the next one".
  const stepMarker = ((direction) => {
    const now = globalTimeRef.current;
    const list = markers[activeScreen].filter((m) => !(sync || workflow.comparison.mode === 'aligned') || markers[activeScreen === 'left' ? 'right' : 'left'].some((other) => other.index === m.index));
    const candidates = direction > 0
      ? list.filter((m) => m.time > now + 0.05).sort((a, b) => a.time - b.time)
      : list.filter((m) => m.time < now - 0.05).sort((a, b) => b.time - a.time);
    const next = candidates[0];
    if (!next) return;
    workflow.seekPosition(next.index + 1, sync || workflow.comparison.mode === 'aligned' ? 'both' : activeScreen).catch(reportError);
  });

  // Drift correction loop (#6): different decode timings would let the two
  // videos visibly slip apart over a few seconds of synced playback. While
  // playing in sync, run a per-frame check and snap the right video back
  // when it drifts more than ~1 frame at 30fps. The snap is gentle enough
  // that the user only sees an occasional tiny re-seek, not stutter.
  useEffect(() => {
    if (!sync || !isPlaying || workflow.comparison.mode === 'aligned') return undefined;
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
  }, [sync, isPlaying, syncOffset, workflow.comparison.mode]);

  const adjustZoom = useCallback((delta) => {
    setZooms((prev) => {
      const current = prev[activeScreen];
      const newVal = Math.max(1.0, Math.min(4.0, current + delta));
      return { ...prev, [activeScreen]: newVal };
    });
  }, [activeScreen]);

  const togglePlay = (() => {
    if (workflow.comparison.mode === 'aligned') { try { workflow.toggleAligned(speed); } catch (error) { reportError(error); } return; }
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
  });

  const seek = ((amount) => {
    workflow.pauseComparison();
    if (sync) {
      leftRef.current?.seekRelative(amount);
      rightRef.current?.seekRelative(amount);
    } else {
      const target = activeScreen === 'left' ? leftRef : rightRef;
      target.current?.seekRelative(amount);
    }
  });

  const changeSpeed = ((newSpeed) => {
    workflow.pauseComparison();
    setSpeed(newSpeed);
    leftRef.current?.setPlaybackRate(newSpeed);
    rightRef.current?.setPlaybackRate(newSpeed);
  });

  const clearShapes = useCallback(() => {
    const target = activeScreen === 'left' ? leftRef : rightRef;
    target.current?.clearShapes();
  }, [activeScreen]);

  const handleTimeUpdate = useCallback((time, dur) => {
    setGlobalTime(time);
    setGlobalDuration(dur);
  }, []);

  // Keep isPlaying honest: the active video reports every play/pause, whoever
  // caused it. Without this, drawing on a playing video left the app thinking
  // it was still playing, so the next spacebar press "paused" an already-paused
  // video and appeared to do nothing.
  const handlePlayStateChange = useCallback((playing) => {
    setIsPlaying(playing);
  }, []);

  const handleLinkedScrub = useCallback((time) => {
    if (sync) {
      leftRef.current?.seekTo(time);
      rightRef.current?.seekTo(hasSyncOffset ? Math.max(0, time - syncOffset) : time);
    }
  }, [sync, hasSyncOffset, syncOffset]);

  // Used by the timeline slider: clamp to the
  // active side's trim window so the UI doesn't visually jump ahead and snap
  // back on the next timeupdate, then seek whichever panes the current
  // sync/active state says should move.
  const scrubTo = ((raw) => {
    workflow.pauseComparison();
    let t = raw;
    const trim = trims[activeScreen];
    if (trim.start != null) t = Math.max(trim.start, t);
    if (trim.end != null) t = Math.min(trim.end, t);
    setGlobalTime(t);
    if (sync) {
      leftRef.current?.seekTo(activeScreen === 'right' && hasSyncOffset ? t + syncOffset : t);
      rightRef.current?.seekTo(activeScreen === 'left' && hasSyncOffset ? Math.max(0, t - syncOffset) : t);
    } else {
      if (activeScreen === 'left') leftRef.current?.seekTo(t);
      else rightRef.current?.seekTo(t);
    }
  });

  const handleGlobalScrub = ((e) => {
    scrubTo(parseFloat(e.target.value));
  });

  useSwingstrControl({
    leftRef, rightRef, students, view, layout, sync, activeScreen, tool, color, lineWidth,
    setView, setLayout, setSync, setActiveScreen, setTool, setColor, setLineWidth,
    togglePlay, scrubTo, seek, changeSpeed, openSavedVideo, workflow,
  });

  const saveToStudent = useCallback(async () => {
    if (!videoSavingEnabled()) return;
    if (!saveData.studentId || !saveData.label) return;
    const isNewStudent = saveData.studentId === NEW_STUDENT;
    const newStudentName = saveData.newStudentName?.trim();
    if (isNewStudent && !newStudentName) return;
    const targetFile = activeScreen === 'left' ? leftFile : rightFile;
    const targetVideo = activeScreen === 'left' ? leftVideo : rightVideo;
    const targetDriveFileId = activeScreen === 'left' ? leftDriveFileId : rightDriveFileId;
    if (!targetVideo) return;

    const videoId = newId();
    const baseRecord = { id: videoId, label: saveData.label, date: new Date().toLocaleDateString() };
    // Drive videos store only the file ID — re-fetched from Drive on demand.
    // Local uploads go to the desktop library. Remote URLs stored as-is.
    const record = targetDriveFileId
      ? { ...baseRecord, driveFileId: targetDriveFileId, source: 'drive' }
      : targetFile
        ? { ...baseRecord, videoId, source: 'idb' }
        : { ...baseRecord, remoteUrl: targetVideo, source: 'remote' };

    if (targetFile) {
      try {
        // The student's name and the clip label shape the on-disk path in the
        // desktop app, so the file is findable in Finder without the app.
        const studentName = isNewStudent
          ? newStudentName
          : students.find((s) => s.id === saveData.studentId)?.name;
        await saveVideoBlob(videoId, targetFile, { studentName, label: saveData.label });
      } catch (err) {
        console.warn('[saveToStudent] desktop library write failed', err);
        setToast({ message: "Couldn't save the video.", kind: 'error' });
        return;
      }
    }

    if (isNewStudent) {
      setStudents((prev) => [
        ...prev,
        { id: newId(), name: newStudentName, email: '', phone: '', notes: '', videos: [record] },
      ]);
    } else {
      setStudents((prev) =>
        prev.map((s) =>
          s.id === saveData.studentId
            ? { ...s, videos: [...(s.videos || []), record] }
            : s
        )
      );
    }
    setShowSaveModal(false);
    setSaveData({ studentId: '', label: '', newStudentName: '' });
    setToast({ message: 'Saved to student library.', kind: 'success' });
  }, [saveData, students, activeScreen, leftFile, rightFile, leftVideo, rightVideo, leftDriveFileId, rightDriveFileId]);

  // Tracks whether P is currently physically held — no native modifier flag
  // exists for letter keys, so this is tracked by hand. Reset on keyup AND
  // on window blur: if the tab loses focus while P is physically down (e.g.
  // alt-tab), the keyup event never fires, and without the blur reset this
  // would get stuck "true" forever, silently turning every future digit
  // press into a "set marker" until the user taps P again to toggle it off.
  const pHeldRef = useRef(false);

  useEffect(() => {
    const handleKeyUp = (e) => {
      if (e.code === 'KeyP') pHeldRef.current = false;
    };
    const handleBlur = () => { pHeldRef.current = false; };
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useEffect(() => {
    const isTextish = (el) =>
      !!el && (el.matches?.(':where(input, textarea, select, [contenteditable=""], [contenteditable="true"])') ?? false);

    const handleKeyDown = (e) => {
      if (isTextish(document.activeElement)) return;
      if (e.code === 'KeyP') {
        pHeldRef.current = true; // a lone P does nothing on its own — no preventDefault
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        if (pHeldRef.current) {
          // One marker per press — stepping is a discrete action; letting it
          // repeat-fire would blow past several markers while the combo is held.
          if (e.repeat) return;
          e.preventDefault();
          stepMarker(dir);
          return;
        }
        e.preventDefault();
        seek(dir * 0.05);
        return;
      }
      // , . < > step checkpoints too, with or without P held — the shifted
      // pair is what the keycaps actually read, and nothing else uses them.
      if (e.key === ',' || e.key === '<' || e.key === '.' || e.key === '>') {
        if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
        e.preventDefault();
        stepMarker(e.key === '.' || e.key === '>' ? 1 : -1);
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        if (!e.repeat) togglePlay();
        return;
      }
      // Block setting/jumping on auto-repeat to avoid spamming the decoder
      // (#9). Plain-arrow seeks above still respond to repeat.
      if (e.repeat) return;
      const pDigit = pHeldRef.current && e.code?.match(/^Digit([0-9])$/);
      const digitMatch = e.key.match(/^[0-9]$/);
      if (pDigit) {
        const keyIndex = pDigit[1] === '0' ? 9 : parseInt(pDigit[1], 10) - 1;
        e.preventDefault();
        setMarkerIndependent(activeScreen, keyIndex, globalTime);
      } else if (digitMatch && !e.metaKey && !e.altKey && !e.ctrlKey && !e.shiftKey) {
        const keyIndex = e.key === '0' ? 9 : parseInt(e.key, 10) - 1;
        e.preventDefault();
        goToMarker(keyIndex);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const toastEl = (
    <Toast
      message={toast?.message}
      kind={toast?.kind}
      onDismiss={() => setToast(null)}
    />
  );

  if (view === 'library' && videoSavingEnabled()) {
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
          onOpenVideo={openSavedVideo}
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
      isPlaying={workflow.comparison.mode === 'aligned' ? workflow.playing : isPlaying}
      togglePlay={togglePlay}
      seek={seek}
      clearShapes={clearShapes}
      openSaveModal={() => { if (videoSavingEnabled()) setShowSaveModal(true); }}
      globalTime={globalTime}
      globalDuration={globalDuration}
      onGlobalScrub={handleGlobalScrub}
      onTimeUpdate={handleTimeUpdate}
      onPlayStateChange={handlePlayStateChange}
      onLinkedScrub={handleLinkedScrub}
      showSequenceModal={showSequenceModal}
      setShowSequenceModal={setShowSequenceModal}
      workflow={workflow}
      markers={markers}
      trims={trims}
      activeTrim={trims[activeScreen]}
      onSetTrim={handleSetTrim}
      onClearTrim={handleClearTrim}
      syncPoints={syncPoints}
      hasSyncOffset={hasSyncOffset}
      syncOffset={syncOffset}
      onSetSyncPoint={handleSetSyncPoint}
      onClearSyncPoint={handleClearSyncPoint}
      onSetMarker={(index, time) => setMarkerIndependent(activeScreen, index, time)}
      onRemoveMarker={(index) => handleRemoveMarker(activeScreen, index)}
      onJumpToMarker={goToMarker}
      onPrevMarker={() => stepMarker(-1)}
      onNextMarker={() => stepMarker(+1)}
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
