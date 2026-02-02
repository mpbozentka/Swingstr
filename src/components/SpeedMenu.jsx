import React from 'react';

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0];

export default function SpeedMenu({ speed, changeSpeed, onClose }) {
  return (
    <div className="absolute bottom-16 right-40 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-2 flex flex-col gap-1 w-32 z-50">
      <div className="text-xs font-bold text-gray-500 px-2 mb-1 uppercase tracking-wider">
        Playback Speed
      </div>
      {SPEED_OPTIONS.map((r) => (
        <button
          key={r}
          onClick={() => {
            changeSpeed(r);
            onClose();
          }}
          className={`flex items-center justify-between px-3 py-2 rounded hover:bg-gray-700 text-sm ${speed === r ? 'bg-purple-900/50 text-purple-400 font-bold' : 'text-gray-300'
            }`}
        >
          <span>{r}x</span>
          {speed === r && (
            <div className="w-2 h-2 rounded-full bg-purple-500" />
          )}
        </button>
      ))}
    </div>
  );
}
