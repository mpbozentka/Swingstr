import React from 'react';

const STROKE_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#a855f7',
  '#ffffff',
];

export default function StyleMenu({ color, setColor, lineWidth, setLineWidth }) {
  return (
    <div className="absolute bottom-16 left-32 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-4 w-64 z-50">
      <div className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">
        Stroke Color
      </div>
      <div className="flex gap-2 mb-4">
        {STROKE_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${color === c
                ? 'border-white scale-110 ring-2 ring-purple-500'
                : 'border-transparent'
              }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">
        Thickness
      </div>
      <div className="flex items-center gap-3">
        <div
          className="h-1 bg-white rounded"
          style={{ width: Math.max(2, lineWidth * 2) + 'px' }}
        />
        <input
          type="range"
          min="1"
          max="10"
          value={lineWidth}
          onChange={(e) => setLineWidth(parseInt(e.target.value, 10))}
          className="flex-1 accent-purple-500 h-1 bg-gray-600 rounded-lg cursor-pointer"
        />
      </div>
    </div>
  );
}
