import React from 'react';
import { UserPlus, Pencil, Trash2, StickyNote } from 'lucide-react';
import { Button } from './ui/Button';
import EditStudentModal from './EditStudentModal';

export default function StudentLibrary({
  students,
  setStudents,
  editingStudent,
  setEditingStudent,
  onBack,
}) {
  const deleteStudent = (id) => {
    if (confirm('Delete student?')) {
      setStudents(students.filter((s) => s.id !== id));
    }
  };

  const saveEditedStudent = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const updated = {
      ...editingStudent,
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
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

  return (
    <div className="h-screen w-screen bg-gray-900 text-gray-100 flex flex-col font-sans relative">
      <EditStudentModal
        student={editingStudent}
        onSave={saveEditedStudent}
        onClose={() => setEditingStudent(null)}
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
        <div className="max-w-5xl mx-auto">
          <div className="bg-gray-800 p-6 rounded-xl mb-8 border border-gray-700">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <UserPlus size={20} /> Add New Student
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const newStudent = {
                  id: Date.now(),
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
                className="bg-gray-900 border border-gray-700 rounded px-4 py-2 flex-1"
              />
              <input
                name="email"
                placeholder="Email"
                className="bg-gray-900 border border-gray-700 rounded px-4 py-2 flex-1"
              />
              <input
                name="phone"
                placeholder="Phone"
                className="bg-gray-900 border border-gray-700 rounded px-4 py-2 flex-1"
              />
              <button
                type="submit"
                className="bg-purple-600 px-6 py-2 rounded hover:bg-purple-500 font-bold"
              >
                Add
              </button>
            </form>
          </div>
          <div className="grid gap-6">
            {students.map((student) => (
              <div
                key={student.id}
                className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 flex flex-col"
              >
                <div className="p-4 bg-gray-700/50 flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{student.name}</h3>
                    <p className="text-sm text-gray-400">
                      {student.email} • {student.phone}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingStudent(student)}
                      className="p-2 bg-gray-600 hover:bg-gray-500 rounded"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => deleteStudent(student.id)}
                      className="p-2 bg-red-900/50 hover:bg-red-600 rounded text-red-200"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="px-4 pt-4">
                  <div className="flex items-center gap-2 mb-2 text-sm text-gray-400">
                    <StickyNote size={14} /> <span>Coach's Notes</span>
                  </div>
                  <textarea
                    className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-sm text-gray-300 focus:border-purple-500 outline-none transition-colors resize-none h-24"
                    placeholder="Add notes..."
                    value={student.notes || ''}
                    onChange={(e) =>
                      handleUpdateNotes(student.id, e.target.value)
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
