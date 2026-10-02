import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analyzePose } from '../utils/poseAnalysis';
import { smoothPoseFrames } from '../utils/practiceMetrics';

const EMPTY = { status: 'idle', progress: 0, frames: null };

export function usePoseAnalysis({ leftRef, rightRef, leftVideo, rightVideo, trims, onToast }) {
  const [results, setResults] = useState({ left: null, right: null });
  const [running, setRunning] = useState(null);
  const jobRef = useRef(null);

  useEffect(() => {
    const job = jobRef.current;
    if (job && job.source !== (job.side === 'left' ? leftVideo : rightVideo)) job.controller.abort();
  }, [leftVideo, rightVideo]);
  useEffect(() => () => jobRef.current?.controller.abort(), []);

  const analyze = useCallback(async (side) => {
    if (jobRef.current) return;
    const source = side === 'left' ? leftVideo : rightVideo;
    const video = (side === 'left' ? leftRef : rightRef).current?.getVideoElement();
    const job = { side, source, controller: new AbortController() };
    jobRef.current = job;
    // Pause both panes so the existing linked-playback loop cannot seek the decoder.
    leftRef.current?.pause();
    rightRef.current?.pause();
    setRunning(side);
    setResults((prev) => ({ ...prev, [side]: { ...EMPTY, source, status: 'analyzing' } }));
    try {
      const data = await analyzePose(video, trims[side], job.controller.signal, (progress) => {
        setResults((prev) => ({ ...prev, [side]: { ...prev[side], progress } }));
      });
      if (!job.controller.signal.aborted) {
        setResults((prev) => ({ ...prev, [side]: { ...data, source, status: 'done', progress: 1 } }));
      }
    } catch (error) {
      const cancelled = error.name === 'AbortError';
      setResults((prev) => ({ ...prev, [side]: { ...EMPTY, source, status: cancelled ? 'idle' : 'error', error: cancelled ? null : error.message } }));
      if (!cancelled) onToast({ message: error.message, kind: 'error' });
    } finally {
      jobRef.current = null;
      setRunning(null);
    }
  }, [leftRef, rightRef, leftVideo, rightVideo, trims, onToast]);

  const cancel = useCallback(() => jobRef.current?.controller.abort(), []);
  const leftFrames = useMemo(() => smoothPoseFrames(results.left?.frames), [results.left?.frames]);
  const rightFrames = useMemo(() => smoothPoseFrames(results.right?.frames), [results.right?.frames]);
  return {
    left: results.left?.source === leftVideo ? { ...results.left, frames: leftFrames } : EMPTY,
    right: results.right?.source === rightVideo ? { ...results.right, frames: rightFrames } : EMPTY,
    running, analyze, cancel,
  };
}
