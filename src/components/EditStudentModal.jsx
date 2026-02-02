import React from 'react';

export default function EditStudentModal({ student, onSave, onClose }) {
  if (!student) return null;
  return (
    <div className="absolute inset-0 z-[100] bg-black/70 flex items-center justify-center">
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 w-96 shadow-2xl">
        <h3 className="font-bold text-lg mb-4">Edit Profile</h3>
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
