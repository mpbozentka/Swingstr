import React, { useState } from 'react';
import { UserPlus, ChevronRight } from 'lucide-react';
import { Button } from './ui/Button';
import EditStudentModal from './EditStudentModal';
import ConfirmDialog from './ConfirmDialog';
import DrivePickerModal from './DrivePickerModal';
import StudentDetail from './StudentDetail';
import { deleteVideoBlob } from '../utils/storage';
import { parseDriveFolderId } from '../hooks/useGoogleDrive';

const newId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function StudentLibrary({
  students,
  setStudents,
  editingStudent,
  setEditingStudent,
  onBack,
  onToast,
  isSignedIn,
  accessToken,
  onDriveLoad,
  onOpenVideo,
}) {
  const [pendingDelete, setPendingDelete] = useState(null);
  const [drivePickerStudent, setDrivePickerStudent] = useState(null);
  // Which student's page is open; null shows the name list.
  const [selectedId, setSelectedId] = useState(null);
  const selected = students.find((s) => s.id === selectedId) ?? null;

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const target = students.find((s) => s.id === pendingDelete.id);
    // Best-effort cleanup of any blobs this student owned.
    target?.videos?.forEach((v) => {
      if (v.videoId) deleteVideoBlob(v.videoId).catch(() => {});
    });
    setStudents(students.filter((s) => s.id !== pendingDelete.id));
    setPendingDelete(null);
    setSelectedId(null);
    onToast?.({ message: `Deleted ${target?.name ?? 'student'}.`, kind: 'info' });
  };

  const saveEditedStudent = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const rawFolder = formData.get('driveFolderInput')?.trim() || '';
    const driveFolderId = rawFolder ? (parseDriveFolderId(rawFolder) ?? editingStudent.driveFolderId ?? null) : null;
    const updated = {
      ...editingStudent,
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      driveFolderId,
    };
    setStudents(
      students.map((s) => (s.id === editingStudent.id ? updated : s))
    );
    setEditingStudent(null);
  };

  const handleUpdateNotes = (id, text) => {
    setStudents(
      students.map((s) => (s.id === id ? { ...s, notes: text } : s))
    );
  };

  const sortedStudents = [...students].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
  );

  return (
    <div className="h-screen w-screen bg-gray-900 text-gray-100 flex flex-col font-sans relative">
      <DrivePickerModal
        open={!!drivePickerStudent}
        accessToken={accessToken}
        initialFolderId={drivePickerStudent?.driveFolderId}
        onLoadVideo={(side, blob, fileId) => {
          onDriveLoad?.(side, blob, fileId);
          setDrivePickerStudent(null);
          onBack();
        }}
        onClose={() => setDrivePickerStudent(null)}
      />
      <EditStudentModal
        student={editingStudent}
        onSave={saveEditedStudent}
        onClose={() => setEditingStudent(null)}
      />
      <ConfirmDialog
        open={!!pendingDelete}
        title={pendingDelete ? `Delete ${pendingDelete.name}?` : ''}
        message="Their saved videos will also be removed. This can't be undone."
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
      <header className="h-16 border-b border-gray-800 flex items-center px-6 justify-between bg-gray-800">
        <div className="flex items-center gap-3">
          <img
            src="/swingstr-logo.jpg"
            alt="Swingstr"
            className="h-10 w-10 rounded-full border-2 border-purple-500 object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          <h1 className="text-xl font-bold tracking-tight">Student Library</h1>
        </div>
        <Button onClick={onBack}>Back to Analyzer</Button>
      </header>
      <div className="flex-1 overflow-auto p-8">
        {selected ? (
          <StudentDetail
            student={selected}
            onBack={() => setSelectedId(null)}
            onEdit={() => setEditingStudent(selected)}
            onDelete={() => setPendingDelete({ id: selected.id, name: selected.name })}
            onUpdateNotes={(text) => handleUpdateNotes(selected.id, text)}
            onOpenVideo={onOpenVideo}
            onBrowseDrive={() => setDrivePickerStudent(selected)}
            isSignedIn={isSignedIn}
          />
        ) : (
          <div className="max-w-3xl mx-auto">
            <div className="bg-gray-800 p-6 rounded-xl mb-8 border border-gray-700">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <UserPlus size={20} /> Add New Student
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  const newStudent = {
                    id: newId(),
                    name: formData.get('name'),
                    email: formData.get('email'),
                    phone: formData.get('phone'),
                    videos: [],
                    notes: '',
                  };
                  setStudents([...students, newStudent]);
                  e.target.reset();
                }}
                className="flex gap-4"
              >
                <input
                  name="name"
                  placeholder="Name"
                  required
                  className="bg-gray-900 border border-gray-700 rounded px-4 py-2 flex-1 min-w-0"
                />
                <input
                  name="email"
                  placeholder="Email"
                  className="bg-gray-900 border border-gray-700 rounded px-4 py-2 flex-1 min-w-0"
                />
                <input
                  name="phone"
                  placeholder="Phone"
                  className="bg-gray-900 border border-gray-700 rounded px-4 py-2 flex-1 min-w-0"
                />
                <button
                  type="submit"
                  className="bg-purple-600 px-6 py-2 rounded hover:bg-purple-500 font-bold"
                >
                  Add
                </button>
              </form>
            </div>
            {sortedStudents.length === 0 ? (
              <p className="text-sm text-gray-500 text-center">No students yet.</p>
            ) : (
              <ul className="bg-gray-800 rounded-xl border border-gray-700 divide-y divide-gray-700 overflow-hidden">
                {sortedStudents.map((student) => (
                  <li key={student.id}>
                    <button
                      onClick={() => setSelectedId(student.id)}
                      className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-700/60 transition-colors"
                    >
                      <span className="font-medium">{student.name || 'Unnamed student'}</span>
                      <ChevronRight size={18} className="text-gray-500" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
