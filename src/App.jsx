import React, { useState, useRef, useEffect, useCallback } from 'react';
import StudentLibrary from './components/StudentLibrary';
import AnalyzerView from './components/AnalyzerView';

import { DEFAULT_MARKER_LABELS } from './components/MarkerBar';

const STORAGE_KEY = 'swingstr_students';
const DEFAULT_STUDENTS = [
  {
    id: 1,
    name: 'Demo Student',
    email: 'demo@golf.com',
    phone: '555-0123',
    videos: [],
    notes: 'Working on takeaway path.',
  },
];

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
  const [zooms, setZooms] = useState({ left: 1.0, right: 1.0 });

  const [globalTime, setGlobalTime] = useState(0);
  const [globalDuration, setGlobalDuration] = useState(0);

  const [students, setStudents] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_STUDENTS;
  });

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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
  }, [students]);

  const handleSetMarker = useCallback((side, index, time) => {
    setMarkers((prev) => {
      const sideMarkers = [...prev[side]];
      const existing = sideMarkers.findIndex((m) => m.index === index);
      const marker = {
        id: Date.now(),
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
    if (!e.target.files?.[0]) return;
    const url = URL.createObjectURL(e.target.files[0]);
    if (side === 'left') setLeftVideo(url);
    else setRightVideo(url);
  }, []);

  const handleUrlUpload = useCallback((side) => {
    const url = prompt('Enter Direct Video URL (mp4/mov):');
    if (url) {
      if (side === 'left') setLeftVideo(url);
      else setRightVideo(url);
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

  const handleClearVideo = useCallback((side) => {
    if (side === 'left') setLeftVideo(null);
    else setRightVideo(null);
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

  const saveToStudent = useCallback(() => {
    if (!saveData.studentId || !saveData.label) return;
    const targetVideo = activeScreen === 'left' ? leftVideo : rightVideo;
    if (targetVideo) {
      const newVideo = {
        id: Date.now(),
        label: saveData.label,
        date: new Date().toLocaleDateString(),
        url: targetVideo,
      };
      setStudents((prev) =>
        prev.map((s) =>
          s.id === parseInt(saveData.studentId, 10)
            ? { ...s, videos: [...(s.videos || []), newVideo] }
            : s
        )
      );
      setShowSaveModal(false);
      setSaveData({ studentId: '', label: '' });
      alert('Saved!');
    }
  }, [saveData, activeScreen, leftVideo, rightVideo]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seek(-0.05);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        seek(0.05);
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
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
