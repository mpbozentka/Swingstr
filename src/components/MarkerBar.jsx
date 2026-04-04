import React, { useState } from 'react';
import { Bookmark, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';

const DEFAULT_MARKER_LABELS = [
  'Address', 'Takeaway', 'Halfway Back', 'Top', 'Transition',
  'Downswing', 'Halfway Down', 'Impact', 'Follow-Through', 'Finish',
];

export { DEFAULT_MARKER_LABELS };

export default function MarkerBar({
  markers,
  duration,
  onJumpTo,
  onSetMarker,
  onRemoveMarker,
  onPrev,
  onNext,
  currentTime,
}) {
  const [showSlots, setShowSlots] = useState(false);

  const sortedMarkers = [...markers].sort((a, b) => a.time - b.time);

  return (
    <div className="w-full px-4 flex items-center gap-2 py-1">
      {/* Prev marker */}
      <button
        onClick={onPrev}
        className="text-gray-400 hover:text-purple-400 transition-colors shrink-0"
        title="Previous Marker"
      >
        <ChevronLeft size={16} />
      </button>

      {/* Marker timeline strip */}
      <div className="flex-1 relative h-6 flex items-center">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-gray-700 rounded" />

        {duration > 0 && sortedMarkers.map((m) => {
          const pct = (m.time / duration) * 100;
          const isNear = Math.abs(m.time - currentTime) < 0.1;
          return (
            <button
              key={m.index}
              onClick={() => onJumpTo(m.index)}
              className="absolute group"
              style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
              title={`${m.label} (${m.time.toFixed(2)}s)`}
            >
              <div
                className={`w-3 h-3 rotate-45 border-2 transition-all ${
                  isNear
                    ? 'bg-purple-500 border-purple-300 scale-125'
                    : 'bg-purple-600 border-purple-400 hover:bg-purple-500 hover:scale-110'
                }`}
              />
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {m.label}
              </div>
            </button>
          );
        })}
      </div>

      {/* Next marker */}
      <button
        onClick={onNext}
        className="text-gray-400 hover:text-purple-400 transition-colors shrink-0"
        title="Next Marker"
      >
        <ChevronRight size={16} />
      </button>

      {/* Set marker dropdown */}
      <div className="relative shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowSlots(!showSlots);
          }}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
          title="Set Marker at Current Time"
        >
          <Plus size={12} />
          <Bookmark size={12} />
        </button>

        {showSlots && (
          <div
            className="absolute bottom-full right-0 mb-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-2 z-50 w-56"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs text-gray-400 font-medium mb-1 px-1">
              Set marker at {currentTime.toFixed(2)}s
            </div>
            <div className="max-h-60 overflow-y-auto">
              {DEFAULT_MARKER_LABELS.map((label, i) => {
                const existing = markers.find((m) => m.index === i);
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between hover:bg-gray-700 rounded px-2 py-1.5 group"
                  >
                    <button
                      onClick={() => {
                        onSetMarker(i, currentTime);
                        setShowSlots(false);
                      }}
                      className="flex-1 text-left text-sm text-gray-200"
                    >
                      <span className="text-purple-400 font-mono text-xs mr-2">
                        {i === 9 ? '0' : i + 1}
                      </span>
                      {label}
                      {existing && (
                        <span className="text-gray-500 text-xs ml-2">
                          ({existing.time.toFixed(2)}s)
                        </span>
                      )}
                    </button>
                    {existing && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveMarker(i);
                        }}
                        className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="text-[10px] text-gray-500 mt-1 px-1 border-t border-gray-700 pt-1">
              Tip: Shift+1-0 to set, 1-0 to jump
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
