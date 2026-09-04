import { useCallback, useState } from 'react';
import { DEFAULT_MARKER_LABELS } from '../constants/markers';

const newId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

/**
 * Per-side marker state. Keeps the marker-mutation logic out of App so it can
 * grow (e.g. drag-to-reorder, custom labels) without dragging the main
 * component along with it. Navigation lives in App, which is the only place
 * that knows about sync/active-screen and can move both videos at once.
 */
export function useMarkers() {
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

  // Markers point at moments in one specific video. When that side gets a new
  // video they describe nothing, so they're dropped — but only for that side.
  // Returning `prev` unchanged when the side is already empty avoids a pointless
  // re-render on every mount.
  const clearSide = useCallback((side) => {
    setMarkers((prev) => (prev[side].length === 0 ? prev : { ...prev, [side]: [] }));
  }, []);

  return { markers, setMarker, removeMarker, clearSide };
}
