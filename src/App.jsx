import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import StudentLibrary from './components/StudentLibrary';
import AnalyzerView from './components/AnalyzerView';
import Login from './components/Login';
import {
  getStudents,
  addStudent,
  updateStudent,
  updateStudentNotes,
  deleteStudent as deleteStudentApi,
  uploadVideo as uploadVideoApi,
} from './lib/supabaseServices';

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
  const { user, loading: authLoading, signIn, signUp, signOut, isConfigured } = useAuth();

  const [authError, setAuthError] = useState('');
  const [authLoadingAction, setAuthLoadingAction] = useState(false);

  const [view, setView] = useState('analyze');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [layout, setLayout] = useState('single');
  const [sync, setSync] = useState(false);
  const [activeScreen, setActiveScreen] = useState('left');
  const [isPlaying, setIsPlaying] = useState(false);

  const [leftVideo, setLeftVideo] = useState(null);
  const [rightVideo, setRightVideo] = useState(null);
  const leftVideoFileRef = useRef(null);
  const rightVideoFileRef = useRef(null);

  const [zooms, setZooms] = useState({ left: 1.0, right: 1.0 });
  const [globalTime, setGlobalTime] = useState(0);
  const [globalDuration, setGlobalDuration] = useState(0);

  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [saveData, setSaveData] = useState({ studentId: '', label: '' });
  const [editingStudent, setEditingStudent] = useState(null);

  const [tool, setTool] = useState('move');
  const [color, setColor] = useState('#ef4444');
  const [lineWidth, setLineWidth] = useState(3);
  const [speed, setSpeed] = useState(1.0);
  const [activeMenu, setActiveMenu] = useState(null);

  const leftRef = useRef();
  const rightRef = useRef();

  const isSupabaseMode = isConfigured && user;

  // Load students: from Supabase when logged in, else from localStorage
  useEffect(() => {
    if (authLoading) return;
    if (isConfigured && user) {
      setStudentsLoading(true);
      getStudents(user.id)
        .then(setStudents)
        .catch((err) => {
          console.error('Failed to load students', err);
          setStudents([]);
        })
        .finally(() => setStudentsLoading(false));
    } else if (!isConfigured) {
      const saved = localStorage.getItem(STORAGE_KEY);
      setStudents(saved ? JSON.parse(saved) : DEFAULT_STUDENTS);
    } else {
      setStudents([]);
    }
  }, [isConfigured, user, authLoading]);

  // Persist to localStorage only when not using Supabase
  useEffect(() => {
    if (!isConfigured && students.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
    }
  }, [isConfigured, students]);

  const handleAuthLogin = useCallback(async (email, password) => {
    setAuthError('');
    setAuthLoadingAction(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setAuthError(err.message || 'Sign in failed');
    } finally {
      setAuthLoadingAction(false);
    }
  }, [signIn]);

  const handleAuthRegister = useCallback(async (email, password) => {
    setAuthError('');
    setAuthLoadingAction(true);
    try {
      await signUp(email, password);
      setAuthError('');
    } catch (err) {
      setAuthError(err.message || 'Sign up failed');
    } finally {
      setAuthLoadingAction(false);
    }
  }, [signUp]);

  const handleUpload = useCallback((side, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (side === 'left') {
      setLeftVideo(url);
      leftVideoFileRef.current = file;
    } else {
      setRightVideo(url);
      rightVideoFileRef.current = file;
    }
  }, []);

  const handleUrlUpload = useCallback((side) => {
    const url = prompt('Enter Direct Video URL (mp4/mov):');
    if (url) {
      if (side === 'left') {
        setLeftVideo(url);
        leftVideoFileRef.current = null;
      } else {
        setRightVideo(url);
        rightVideoFileRef.current = null;
      }
    }
  }, []);

  const handleClearVideo = useCallback((side) => {
    if (side === 'left') {
      setLeftVideo(null);
      leftVideoFileRef.current = null;
    } else {
      setRightVideo(null);
      rightVideoFileRef.current = null;
    }
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
        newState
          ? (leftRef.current?.play(), rightRef.current?.play())
          : (leftRef.current?.pause(), rightRef.current?.pause());
      } else {
        const target = activeScreen === 'left' ? leftRef : rightRef;
        newState ? target.current?.play() : target.current?.pause();
      }
      return newState;
    });
  }, [sync, activeScreen]);

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
      rightRef.current?.seekTo(time);
    }
  }, [sync]);

  const handleGlobalScrub = useCallback((e) => {
    const t = parseFloat(e.target.value);
    setGlobalTime(t);
    if (sync) {
      leftRef.current?.seekTo(t);
      rightRef.current?.seekTo(t);
    } else {
      if (activeScreen === 'left') leftRef.current?.seekTo(t);
      else rightRef.current?.seekTo(t);
    }
  }, [sync, activeScreen]);

  const saveToStudent = useCallback(async () => {
    if (!saveData.studentId || !saveData.label) return;

    if (isSupabaseMode) {
      const file = activeScreen === 'left' ? leftVideoFileRef.current : rightVideoFileRef.current;
      if (!file) {
        alert('Save to student only works for videos you uploaded (not URLs). Upload a file first.');
        return;
      }
      try {
        await uploadVideoApi(user.id, saveData.studentId, file, saveData.label);
        setShowSaveModal(false);
        setSaveData({ studentId: '', label: '' });
        alert('Saved!');
      } catch (err) {
        console.error(err);
        alert(err.message || 'Failed to save video');
      }
      return;
    }

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
          String(s.id) === String(saveData.studentId)
            ? { ...s, videos: [...(s.videos || []), newVideo] }
            : s
        )
      );
      setShowSaveModal(false);
      setSaveData({ studentId: '', label: '' });
      alert('Saved!');
    }
  }, [saveData, activeScreen, leftVideo, rightVideo, isSupabaseMode, user]);

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
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [seek, togglePlay]);

  // Supabase configured but not logged in: show login
  if (isConfigured && !user && !authLoading) {
    return (
      <Login
        onLogin={handleAuthLogin}
        onRegister={handleAuthRegister}
        error={authError}
        loading={authLoadingAction}
      />
    );
  }

  // Auth still loading (and we need auth)
  if (isConfigured && authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  const persistApi = isSupabaseMode
    ? {
      addStudent: (userId, data) => addStudent(userId, data),
      updateStudent: (id, data) => updateStudent(id, data),
      updateNotes: (id, notes) => updateStudentNotes(id, notes),
      deleteStudent: (id) => deleteStudentApi(id),
    }
    : undefined;

  if (view === 'library') {
    return (
      <StudentLibrary
        students={students}
        setStudents={setStudents}
        editingStudent={editingStudent}
        setEditingStudent={setEditingStudent}
        onBack={() => setView('analyze')}
        persistApi={persistApi}
        userId={user?.id}
        loading={studentsLoading}
        onLogout={isSupabaseMode ? signOut : undefined}
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
      students={students}
      showSaveModal={showSaveModal}
      setShowSaveModal={setShowSaveModal}
      saveData={saveData}
      setSaveData={setSaveData}
      saveToStudent={saveToStudent}
      user={user}
      onLogout={isSupabaseMode ? signOut : undefined}
    />
  );
}
