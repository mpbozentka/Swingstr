import React, { useState } from 'react';
import { ArrowLeft, Pencil, Trash2, StickyNote, HardDrive, Film } from 'lucide-react';

const SOURCE_LABELS = { idb: 'Saved file', drive: 'Google Drive', remote: 'Web link' };

/**
 * One student's page: contact info, coach's notes, and their saved videos.
 * Opening a video hands it to the analyzer on the chosen screen.
 */
export default function StudentDetail({
  student,
  onBack,
  onEdit,
  onDelete,
  onUpdateNotes,
  onOpenVideo,
  onBrowseDrive,
  isSignedIn,
}) {
  const [openingId, setOpeningId] = useState(null);
  const videos = student.videos || [];
  const contact = [student.email, student.phone].filter(Boolean).join(' • ');

  const open = async (side, video) => {
    setOpeningId(video.id + side);
    try {
      await onOpenVideo(side, video);
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6"
      >
        <ArrowLeft size={16} /> All students
      </button>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">{student.name}</h2>
          {contact && <p className="text-sm text-gray-400 mt-1">{contact}</p>}
        </div>
        <div className="flex gap-2 items-center">
          {isSignedIn && student.driveFolderId && (
            <button
              onClick={onBrowseDrive}
              title="Browse this student's Google Drive videos"
              className="flex items-center gap-1 px-2 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-xs font-medium"
            >
              <HardDrive size={14} />
              Browse Drive
            </button>
          )}
          <button
            onClick={onEdit}
            aria-label={`Edit ${student.name}`}
            className="p-2 bg-gray-600 hover:bg-gray-500 rounded"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={onDelete}
            aria-label={`Delete ${student.name}`}
            className="p-2 bg-red-900/50 hover:bg-red-600 rounded text-red-200"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
        <div className="flex items-center gap-2 mb-3 text-sm text-gray-400">
          <StickyNote size={14} /> <span>Coach's Notes</span>
        </div>
        <textarea
          className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-sm text-gray-300 focus:border-purple-500 outline-none transition-colors resize-y h-40"
          placeholder="Add notes..."
          value={student.notes || ''}
          onChange={(e) => onUpdateNotes(e.target.value)}
        />
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-3 text-sm text-gray-400">
          <Film size={14} /> <span>Saved Videos ({videos.length})</span>
        </div>
        {videos.length === 0 ? (
          <p className="text-sm text-gray-500">
            No saved videos yet. In the analyzer, use Save to add one to this student.
          </p>
        ) : (
          <ul className="divide-y divide-gray-700">
            {[...videos].reverse().map((video) => {
              const needsDrive = video.source === 'drive' && !isSignedIn;
              const unplayable = video.legacy || needsDrive;
              return (
                <li key={video.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{video.label || 'Untitled'}</p>
                    <p className="text-xs text-gray-500">
                      {video.date}
                      {SOURCE_LABELS[video.source] && ` • ${SOURCE_LABELS[video.source]}`}
                      {video.legacy && ' • Old record, file no longer available'}
                      {needsDrive && ' • Sign in to Google to open'}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {['left', 'right'].map((side) => (
                      <button
                        key={side}
                        onClick={() => open(side, video)}
                        disabled={unplayable || !!openingId}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {openingId === video.id + side ? 'Opening…' : `Open ${side === 'left' ? 'Left' : 'Right'}`}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
