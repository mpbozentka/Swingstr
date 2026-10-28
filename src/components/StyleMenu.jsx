import React from 'react';

const STROKE_COLORS = [
  { name: 'Red', value: '#ff3333' },
  { name: 'Orange', value: '#ff9500' },
  { name: 'Yellow', value: '#ffff00' },
  { name: 'Green', value: '#00ff00' },
  { name: 'Blue', value: '#0080ff' },
  { name: 'Indigo', value: '#6366ff' },
  { name: 'Violet', value: '#bf00ff' },
];

export default function StyleMenu({ color, setColor, lineWidth, setLineWidth, positionClass = 'absolute bottom-16 left-32' }) {
  return (
    <div className={`${positionClass} bg-gray-900/70 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 p-4 w-64 z-50`}>
      <div className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">
        Stroke Color
      </div>
      <div className="flex gap-2 mb-4">
        {STROKE_COLORS.map(({ name, value: c }) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            aria-label={`${name} stroke color`}
            title={name}
            aria-pressed={color === c}
            className={`w-6 h-6 shrink-0 rounded-full border-2 transition-transform hover:scale-110 ${color === c
                ? 'border-white scale-110 ring-2 ring-purple-500'
                : 'border-transparent'
              }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <input aria-label="Custom stroke color" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
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
          aria-label="Stroke thickness"
          className="flex-1 accent-purple-500 h-1 bg-gray-600 rounded-lg cursor-pointer"
        />
      </div>
    </div>
  );
}
