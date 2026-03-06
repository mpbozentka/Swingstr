/**
 * Data layer: students → lessons → swings (Analyzr-style).
 * Uses localStorage with optional Supabase when env is set.
 */

import { DEFAULT_STUDENTS, STORAGE_KEY, STORAGE_KEY_LEGACY } from './constants';

function ensureLessons(student) {
  if (student.lessons && student.lessons.length > 0) return student;
  const migrated = {
    ...student,
    lessons: [
      {
        id: student.id * 1000 + 1,
        lesson_date: new Date().toISOString().slice(0, 10),
        notes: '',
        swings: (student.videos || []).map((v) => ({
          id: v.id,
          label: v.label || 'Swing',
          date: v.date || new Date().toLocaleDateString(),
          url: v.url,
          view_tag: '',
          swing_type: '',
          location: '',
          club_type: '',
          high_speed: false,
          color_label: '',
          markers: [],
        })),
      },
    ],
  };
  delete migrated.videos;
  return migrated;
}

export function loadStudents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return (data.students || []).map(ensureLessons);
    }
    const legacy = localStorage.getItem(STORAGE_KEY_LEGACY);
    if (legacy) {
      const legacyStudents = JSON.parse(legacy);
      const migrated = legacyStudents.map(ensureLessons);
      saveStudents(migrated);
      localStorage.removeItem(STORAGE_KEY_LEGACY);
      return migrated;
    }
  } catch (e) {
    console.warn('loadStudents error', e);
  }
  return DEFAULT_STUDENTS.map(ensureLessons);
}

export function saveStudents(students) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ students }));
  } catch (e) {
    console.warn('saveStudents error', e);
  }
}

export function addLesson(studentId, students, setStudents) {
  const student = students.find((s) => s.id === studentId);
  if (!student) return;
  const newLesson = {
    id: Date.now(),
    lesson_date: new Date().toISOString().slice(0, 10),
    notes: '',
    swings: [],
  };
  setStudents(
    students.map((s) =>
      s.id === studentId ? { ...s, lessons: [...(s.lessons || []), newLesson] } : s
    )
  );
}

export function addSwing(lessonId, studentId, swing, students, setStudents) {
  const newSwing = {
    id: Date.now(),
    label: swing.label || 'Swing',
    date: new Date().toLocaleDateString(),
    url: swing.url,
    view_tag: swing.view_tag || '',
    swing_type: swing.swing_type || '',
    location: swing.location || '',
    club_type: swing.club_type || '',
    high_speed: swing.high_speed || false,
    color_label: swing.color_label || '',
    markers: swing.markers || [],
  };
  setStudents(
    students.map((s) => {
      if (s.id !== studentId) return s;
      return {
        ...s,
        lessons: (s.lessons || []).map((l) => {
          if (l.id !== lessonId) return l;
          return { ...l, swings: [...(l.swings || []), newSwing] };
        }),
      };
    })
  );
}

export function updateSwingMarkers(studentId, lessonId, swingId, markers, students, setStudents) {
  setStudents(
    students.map((s) => {
      if (s.id !== studentId) return s;
      return {
        ...s,
        lessons: (s.lessons || []).map((l) => {
          if (l.id !== lessonId) return l;
          return {
            ...l,
            swings: (l.swings || []).map((sw) =>
              sw.id === swingId ? { ...sw, markers: [...markers] } : sw
            ),
          };
        }),
      };
    })
  );
}
