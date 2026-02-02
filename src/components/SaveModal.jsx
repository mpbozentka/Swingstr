import React from 'react';

export default function SaveModal({
  show,
  onClose,
  students,
  saveData,
  setSaveData,
  onSave,
}) {
  if (!show) return null;
  return (
    <div
      className="absolute inset-0 z-[100] bg-black/70 flex items-center justify-center"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 w-96 shadow-2xl">
        <h3 className="font-bold text-lg mb-4">Save Video to Student</h3>
        <div className="space-y-4">
          <select
            className="w-full bg-gray-900 p-2 rounded border border-gray-600"
            onChange={(e) =>
              setSaveData((prev) => ({ ...prev, studentId: e.target.value }))
            }
            value={saveData.studentId}
          >
            <option value="">Select Student...</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            className="w-full bg-gray-900 p-2 rounded border border-gray-600"
            placeholder="Label"
            value={saveData.label}
            onChange={(e) =>
              setSaveData((prev) => ({ ...prev, label: e.target.value }))
            }
          />
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              className="flex-1 bg-purple-600 py-2 rounded font-bold hover:bg-purple-500"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
