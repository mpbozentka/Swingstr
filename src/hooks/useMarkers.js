import { useCallback, useState } from 'react';
import { DEFAULT_MARKER_LABELS } from '../constants/markers';

const newId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

/**
 * Per-side marker state plus jump helpers. Keeps the marker-mutation logic
 * out of App so it can grow (e.g. drag-to-reorder, custom labels) without
 * dragging the main component along with it.
 */
export function useMarkers({ leftRef, rightRef, getGlobalTime, setGlobalTime }) {
  const [markers, setMarkers] = useState({ left: [], right: [] });

  const setMarker = useCallback((side, index, time) => {
    setMarkers((prev) => {
      const sideMarkers = [...prev[side]];
      const existing = sideMarkers.findIndex((m) => m.index === index);
      const marker = {
        id: newId(),
        index,
        time,
        label: DEFAULT_MARKER_LABELS[index],
      };
      if (existing >= 0) sideMarkers[existing] = marker;
      else sideMarkers.push(marker);
      return { ...prev, [side]: sideMarkers };
    });
  }, []);

  const removeMarker = useCallback((side, index) => {
    setMarkers((prev) => ({
      ...prev,
      [side]: prev[side].filter((m) => m.index !== index),
    }));
  }, []);

  const seekSide = useCallback((side, time) => {
    const ref = side === 'left' ? leftRef : rightRef;
    ref.current?.seekTo(time);
    setGlobalTime(time);
  }, [leftRef, rightRef, setGlobalTime]);

  const jumpTo = useCallback((side, index) => {
    setMarkers((prev) => {
      const m = prev[side].find((mm) => mm.index === index);
      if (m) seekSide(side, m.time);
      return prev;
    });
  }, [seekSide]);

  const jumpRelative = useCallback((side, direction) => {
    const currentTime = getGlobalTime();
    setMarkers((prev) => {
      const candidates = direction > 0
        ? prev[side].filter((m) => m.time > currentTime + 0.05).sort((a, b) => a.time - b.time)
        : prev[side].filter((m) => m.time < currentTime - 0.05).sort((a, b) => b.time - a.time);
      if (candidates[0]) seekSide(side, candidates[0].time);
      return prev;
    });
  }, [getGlobalTime, seekSide]);

  return { markers, setMarker, removeMarker, jumpTo, jumpRelative };
}
