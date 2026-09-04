import React, { useState } from 'react';
import { Bookmark, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { DEFAULT_MARKER_LABELS } from '../constants/markers';

// One colour per video, used everywhere a bookmark is drawn. sky-400 and
// pink-400 sit far apart in hue and stay distinguishable to CVD viewers; both
// stay legible against the darkened glass of the floating control bar.
const SIDE_COLORS = { left: '#38bdf8', right: '#f472b6' };

/**
 * The single video timeline: playhead, trim shading, sync points, and every
 * bookmark from both videos on one track. Left-video bookmarks sit above the
 * track in blue, right-video bookmarks below it in pink.
 *
 * Times are always in the ACTIVE video's clock, because that's the video
 * feeding globalTime. The other video's bookmarks are shifted by the sync
 * offset into that clock, and are only shown when the two are actually linked
 * and synced — unmapped, their timestamps would be meaningless here.
 */
export default function Timeline({
  globalTime,
  globalDuration,
  onScrub,
  activeTrim,
  syncPoints,
  markers,
  activeScreen,
  sync,
  hasSyncOffset,
  syncOffset = 0,
  hasBothVideos,
  onJumpTo,
  onSetMarker,
  onRemoveMarker,
  onPrev,
  onNext,
}) {
  const [showSlots, setShowSlots] = useState(false);

  const otherSide = activeScreen === 'left' ? 'right' : 'left';
  const activeMarkers = markers[activeScreen] || [];
  const showOther = sync && hasSyncOffset && hasBothVideos;

  const plotted = [
    ...activeMarkers.map((m) => ({ ...m, side: activeScreen, t: m.time })),
    ...(showOther
      ? (markers[otherSide] || []).map((m) => ({
          ...m,
          side: otherSide,
          t: activeScreen === 'left' ? m.time + syncOffset : m.time - syncOffset,
        }))
      : []),
  ].filter((m) => globalDuration > 0 && m.t >= 0 && m.t <= globalDuration);

  const pct = (t) => `${(t / globalDuration) * 100}%`;

  return (
    <div className="w-full px-3 py-1 flex items-center gap-2">
      <button
        onClick={onPrev}
        className="text-gray-300 hover:text-purple-300 transition-colors shrink-0"
        title="Previous checkpoint (P + ← or <)"
        aria-label="Previous checkpoint"
      >
        <ChevronLeft size={16} />
      </button>

      <span className="text-xs font-mono text-gray-200 w-12 text-right shrink-0">
        {globalTime.toFixed(1)}s
      </span>

      <div className="flex-1 relative h-7 flex items-center">
        <input
          type="range"
          min="0"
          max={globalDuration || 100}
          step="0.01"
          value={globalTime}
          onChange={onScrub}
          aria-label="Video timeline"
          className="w-full h-1.5 bg-white/25 rounded-full appearance-none cursor-pointer accent-purple-400 hover:accent-purple-300"
        />

        {/* Trimmed-out regions shaded on the timeline */}
        {globalDuration > 0 && activeTrim.start != null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-1.5 left-0 bg-black/50 border-r-2 border-emerald-300/80 rounded-l-full z-10 pointer-events-none"
            style={{ width: pct(activeTrim.start) }}
            title={`Trim start: ${activeTrim.start.toFixed(2)}s`}
          />
        )}
        {globalDuration > 0 && activeTrim.end != null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-1.5 right-0 bg-black/50 border-l-2 border-emerald-300/80 rounded-r-full z-10 pointer-events-none"
            style={{ width: pct(Math.max(0, globalDuration - activeTrim.end)) }}
            title={`Trim end: ${activeTrim.end.toFixed(2)}s`}
          />
        )}

        {/* Sync points */}
        {globalDuration > 0 && syncPoints.left != null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-3 w-0.5 bg-amber-400/70 z-20 pointer-events-none"
            style={{ left: pct(syncPoints.left) }}
            title={`L sync: ${syncPoints.left.toFixed(2)}s`}
          />
        )}
        {globalDuration > 0 && syncPoints.right != null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-3 w-0.5 bg-amber-500/70 z-20 pointer-events-none"
            style={{ left: pct(syncPoints.right) }}
            title={`R sync: ${syncPoints.right.toFixed(2)}s`}
          />
        )}

        {/* Bookmarks — left video above the track, right video below it, so
            two markers at the same instant don't stack on top of each other. */}
        {plotted.map((m) => {
          const isNear = Math.abs(m.t - globalTime) < 0.1;
          const color = SIDE_COLORS[m.side];
          return (
            <button
              key={`${m.side}-${m.index}`}
              onClick={() => onJumpTo(m.index)}
              className={`absolute group z-30 ${m.side === 'left' ? 'top-0' : 'bottom-0'}`}
              style={{ left: pct(m.t), transform: 'translateX(-50%)' }}
              title={`${m.side === 'left' ? 'L' : 'R'} ${m.label} (${m.t.toFixed(2)}s)`}
            >
              <div
                className={`w-2.5 h-2.5 rotate-45 border transition-transform hover:scale-125 ${
                  isNear ? 'scale-125 border-white' : 'border-black/40'
                }`}
                style={{ backgroundColor: color }}
              />
              <div
                className={`absolute left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${
                  m.side === 'left' ? 'top-3' : 'bottom-3'
                }`}
                style={{ color }}
              >
                {m.label}
              </div>
            </button>
          );
        })}
      </div>

      <span className="text-xs font-mono text-gray-200 w-12 shrink-0">
        {globalDuration.toFixed(1)}s
      </span>

      {/* Which colour is which video — only worth the space when both are on
          the track at once. */}
      {showOther && (
        <div className="flex items-center gap-2 shrink-0 text-[10px]">
          <span className="flex items-center gap-1" style={{ color: SIDE_COLORS.left }}>
            <span className="w-2 h-2 rotate-45 inline-block" style={{ backgroundColor: SIDE_COLORS.left }} />L
          </span>
          <span className="flex items-center gap-1" style={{ color: SIDE_COLORS.right }}>
            <span className="w-2 h-2 rotate-45 inline-block" style={{ backgroundColor: SIDE_COLORS.right }} />R
          </span>
        </div>
      )}

      <button
        onClick={onNext}
        className="text-gray-300 hover:text-purple-300 transition-colors shrink-0"
        title="Next checkpoint (P + → or >)"
        aria-label="Next checkpoint"
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
          className="flex items-center gap-1 px-2 py-1 text-xs bg-white/10 hover:bg-white/20 border border-white/10 text-gray-200 rounded-lg transition-colors"
          title="Set bookmark at current time"
          aria-label="Set bookmark at current time"
          aria-expanded={showSlots}
          aria-haspopup="menu"
        >
          <Plus size={12} />
          <Bookmark size={12} />
        </button>

        {showSlots && (
          <div
            className="absolute bottom-full right-0 mb-2 bg-gray-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 p-2 z-50 w-56"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs text-gray-400 font-medium mb-1 px-1">
              Set bookmark at {globalTime.toFixed(2)}s
            </div>
            <div className="max-h-60 overflow-y-auto">
              {DEFAULT_MARKER_LABELS.map((label, i) => {
                const existing = activeMarkers.find((m) => m.index === i);
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between hover:bg-white/10 rounded-lg px-2 py-1.5 group"
                  >
                    <button
                      onClick={() => {
                        onSetMarker(i, globalTime);
                        setShowSlots(false);
                      }}
                      className="flex-1 text-left text-sm text-gray-200"
                    >
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
            <div className="text-[10px] text-gray-400 mt-1 px-1 border-t border-white/10 pt-1">
              Hold P + 1–0 to set, 1–0 to jump, P + ←/→ or &lt;/&gt; to step
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
