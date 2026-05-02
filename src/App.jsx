import React, { useState, useRef, useEffect, useCallback } from 'react';
import StudentLibrary from './components/StudentLibrary';
import AnalyzerView from './components/AnalyzerView';

import { DEFAULT_MARKER_LABELS } from './components/MarkerBar';
import {
  loadStudents,
  saveStudents,
  saveVideoBlob,
  registerObjectUrl,
  releaseObjectUrl,
  releaseAllObjectUrls,
} from './utils/storage';
import { parseVideoUrl } from './utils/url';
import { useDebouncedEffect } from './hooks/useDebouncedEffect';

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

  const [leftVideo, setLeftVideo] = useState(null);
  const [rightVideo, setRightVideo] = useState(null);
  // Hold the underlying File alongside the object URL so we can persist the
  // raw bytes (not the dead blob URL) when saving to a student.
  const [leftFile, setLeftFile] = useState(null);
  const [rightFile, setRightFile] = useState(null);
  const [zooms, setZooms] = useState({ left: 1.0, right: 1.0 });

  const [globalTime, setGlobalTime] = useState(0);
  const [globalDuration, setGlobalDuration] = useState(0);

  const [students, setStudents] = useState(() => loadStudents());

  const [saveData, setSaveData] = useState({ studentId: '', label: '' });
  const [editingStudent, setEditingStudent] = useState(null);

  const [markers, setMarkers] = useState({ left: [], right: [] });
  const [syncPoints, setSyncPoints] = useState({ left: null, right: null });

  const [tool, setTool] = useState('move');
  const [color, setColor] = useState('#ef4444');
  const [lineWidth, setLineWidth] = useState(3);
  const [speed, setSpeed] = useState(1.0);
  const [activeMenu, setActiveMenu] = useState(null);

  const leftRef = useRef();
  const rightRef = useRef();

  // Debounced — every keystroke in a student's notes textarea would otherwise
  // serialize the whole CRM (#21).
  useDebouncedEffect(() => saveStudents(students), [students], 300);

  // Revoke any outstanding blob URLs when the app unmounts so we don't leak
  // memory across the tab's lifetime (#4).
  useEffect(() => releaseAllObjectUrls, []);

  const handleSetMarker = useCallback((side, index, time) => {
    setMarkers((prev) => {
      const sideMarkers = [...prev[side]];
      const existing = sideMarkers.findIndex((m) => m.index === index);
      const marker = {
        id: newId(),
        index,
        time,
        label: DEFAULT_MARKER_LABELS[index],
      };
      if (existing >= 0) {
        sideMarkers[existing] = marker;
      } else {
        sideMarkers.push(marker);
      }
      return { ...prev, [side]: sideMarkers };
    });
  }, []);

  const handleRemoveMarker = useCallback((side, index) => {
    setMarkers((prev) => ({
      ...prev,
      [side]: prev[side].filter((m) => m.index !== index),
    }));
  }, []);

  const jumpToMarker = useCallback((side, index) => {
    const marker = markers[side].find((m) => m.index === index);
    if (!marker) return;
    const ref = side === 'left' ? leftRef : rightRef;
    ref.current?.seekTo(marker.time);
    setGlobalTime(marker.time);
  }, [markers]);

  const jumpToPrevMarker = useCallback(() => {
    const sideMarkers = markers[activeScreen]
      .filter((m) => m.time < globalTime - 0.05)
      .sort((a, b) => b.time - a.time);
    if (sideMarkers.length > 0) {
      const m = sideMarkers[0];
      const ref = activeScreen === 'left' ? leftRef : rightRef;
      ref.current?.seekTo(m.time);
      setGlobalTime(m.time);
    }
  }, [markers, activeScreen, globalTime]);

  const jumpToNextMarker = useCallback(() => {
    const sideMarkers = markers[activeScreen]
      .filter((m) => m.time > globalTime + 0.05)
      .sort((a, b) => a.time - b.time);
    if (sideMarkers.length > 0) {
      const m = sideMarkers[0];
      const ref = activeScreen === 'left' ? leftRef : rightRef;
      ref.current?.seekTo(m.time);
      setGlobalTime(m.time);
    }
  }, [markers, activeScreen, globalTime]);

  const handleUpload = useCallback((side, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = registerObjectUrl(`video:${side}`, file);
    if (side === 'left') {
      setLeftVideo(url);
      setLeftFile(file);
    } else {
      setRightVideo(url);
      setRightFile(file);
    }
  }, []);

  const handleUrlUpload = useCallback((side) => {
    const raw = prompt('Enter Direct Video URL (mp4/mov):');
    if (!raw) return;
    const url = parseVideoUrl(raw);
    if (!url) {
      alert('That URL is not a valid http(s) video URL.');
      return;
    }
    // Remote URL — revoke any prior blob URL for this slot since we're switching
    // to a non-blob source.
    releaseObjectUrl(`video:${side}`);
    if (side === 'left') {
      setLeftVideo(url);
      setLeftFile(null);
    } else {
      setRightVideo(url);
      setRightFile(null);
    }
  }, []);

  const handleSetSyncPoint = useCallback((side) => {
    const ref = side === 'left' ? leftRef : rightRef;
    const time = ref.current?.currentTime ?? 0;
    setSyncPoints((prev) => ({ ...prev, [side]: time }));
  }, []);

  const handleClearSyncPoint = useCallback((side) => {
    setSyncPoints((prev) => ({ ...prev, [side]: null }));
  }, []);

  // Compute sync offset when both sync points are set
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

  const handleClearVideo = useCallback((side) => {
    releaseObjectUrl(`video:${side}`);
    if (side === 'left') {
      setLeftVideo(null);
      setLeftFile(null);
    } else {
      setRightVideo(null);
      setRightFile(null);
    }
    setSyncPoints((prev) => ({ ...prev, [side]: null }));
    if (side === activeScreen) {
      setGlobalTime(0);
      setGlobalDuration(0);
      setIsPlaying(false);
    }
  }, [activeScreen]);

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
        newState
          ? (leftRef.current?.play(), rightRef.current?.play())
          : (leftRef.current?.pause(), rightRef.current?.pause());
      } else {
        const target = activeScreen === 'left' ? leftRef : rightRef;
        newState ? target.current?.play() : target.current?.pause();
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
    if (!saveData.studentId || !saveData.label) return;
    const targetFile = activeScreen === 'left' ? leftFile : rightFile;
    const targetVideo = activeScreen === 'left' ? leftVideo : rightVideo;
    if (!targetVideo) return;

    const videoId = newId();
    // Local file uploads get persisted to IndexedDB so they survive a refresh.
    // Remote http(s) URLs are stored as-is — there's no Blob to keep.
    const record = targetFile
      ? { id: videoId, label: saveData.label, date: new Date().toLocaleDateString(), videoId, source: 'idb' }
      : { id: videoId, label: saveData.label, date: new Date().toLocaleDateString(), remoteUrl: targetVideo, source: 'remote' };

    if (targetFile) {
      try {
        await saveVideoBlob(videoId, targetFile);
      } catch (err) {
        console.warn('[saveToStudent] IndexedDB write failed', err);
        alert("Couldn't save the video locally. The browser may be in private mode or out of storage.");
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
  }, [saveData, activeScreen, leftFile, rightFile, leftVideo, rightVideo]);

  useEffect(() => {
    const isTextish = (el) =>
      !!el && (el.matches?.(':where(input, textarea, select, [contenteditable=""], [contenteditable="true"])') ?? false);

    const handleKeyDown = (e) => {
      if (isTextish(document.activeElement)) return;
      // Block setting/jumping on auto-repeat to avoid spamming the decoder
      // (#9). Arrows/space still seek/toggle on repeat — that's expected.
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
      if (e.repeat) return;
      // Marker shortcuts: 1-9,0 maps to index 0-9
      // Shift+digit: set marker at current time, plain digit: jump to marker
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

  if (view === 'library') {
    return (
      <StudentLibrary
        students={students}
        setStudents={setStudents}
        editingStudent={editingStudent}
        setEditingStudent={setEditingStudent}
        onBack={() => setView('analyze')}
      />
    );
  }

  return (
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
      onUrlUpload={handleUrlUpload}
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
      onTimeUpdate={handleTimeUpdate}
      onLinkedScrub={handleLinkedScrub}
      showSequenceModal={showSequenceModal}
      setShowSequenceModal={setShowSequenceModal}
      allMarkers={markers}
      syncPoints={syncPoints}
      hasSyncOffset={hasSyncOffset}
      onSetSyncPoint={handleSetSyncPoint}
      onClearSyncPoint={handleClearSyncPoint}
      markers={markers[activeScreen]}
      onSetMarker={(index, time) => handleSetMarker(activeScreen, index, time)}
      onRemoveMarker={(index) => handleRemoveMarker(activeScreen, index)}
      onJumpToMarker={(index) => jumpToMarker(activeScreen, index)}
      onPrevMarker={jumpToPrevMarker}
      onNextMarker={jumpToNextMarker}
      students={students}
      showSaveModal={showSaveModal}
      setShowSaveModal={setShowSaveModal}
      saveData={saveData}
      setSaveData={setSaveData}
      saveToStudent={saveToStudent}
    />
  );
}
