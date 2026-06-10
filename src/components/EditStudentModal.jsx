import React from 'react';
import { useEscapeClose } from '../hooks/useEscapeClose';

export default function EditStudentModal({ student, onSave, onClose }) {
  useEscapeClose(!!student, onClose);
  if (!student) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-student-title"
      className="absolute inset-0 z-[100] bg-black/70 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 p-6 rounded-xl border border-gray-700 w-96 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="edit-student-title" className="font-bold text-lg mb-4">Edit Profile</h3>
        <form onSubmit={onSave} className="space-y-4">
          <input
            name="name"
            defaultValue={student.name}
            placeholder="Name"
            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2"
          />
          <input
            name="email"
            defaultValue={student.email}
            placeholder="Email"
            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2"
          />
          <input
            name="phone"
            defaultValue={student.phone}
            placeholder="Phone"
            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2"
          />
          <div>
            <label className="text-xs text-gray-400 block mb-1">Google Drive Folder (optional)</label>
            <input
              name="driveFolderInput"
              defaultValue={student.driveFolderId || ''}
              placeholder="Paste Drive folder URL or ID"
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-purple-600 py-2 rounded font-bold hover:bg-purple-500"
          >
            Save Changes
          </button>
        </form>
        <button
          onClick={onClose}
          className="mt-2 w-full text-gray-400 hover:text-white text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
