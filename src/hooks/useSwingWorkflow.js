import { useState, useRef, useEffect } from 'react';
import { resolveSegment } from '../utils/annotationTiming';
import { resolveExportPlan, mapExportTime } from '../utils/exportPlan';
import { recordClip, pickRecordingType } from '../utils/videoClipExport';

export function useSwingWorkflow({ leftRef, rightRef, markers, setMarker, removeMarker, leftVideo, rightVideo }) {
  const [selections, setSelections] = useState({ left: null, right: null });
  const [comparison, setComparison] = useState({ mode: 'independent' });
  const [held, setHeld] = useState({});
  const [playing, setPlaying] = useState(false);
  const [jobs, setJobs] = useState({});
  const jobRef = useRef({});
  const activeJob = useRef(null);
  const clock = useRef(null);
  const pauseComparison = () => { clock.current?.controller?.abort(); setPlaying(false); };
  const sourceRef = useRef({ left: leftVideo, right: rightVideo });
  useEffect(() => { sourceRef.current = { left: leftVideo, right: rightVideo }; }, [leftVideo, rightVideo]);
  useEffect(() => { setSelections((s) => ({ ...s, left: null })); setComparison({ mode: 'independent' }); clock.current?.controller?.abort(); setPlaying(false); }, [leftVideo]);
  useEffect(() => { setSelections((s) => ({ ...s, right: null })); setComparison({ mode: 'independent' }); clock.current?.controller?.abort(); setPlaying(false); }, [rightVideo]);
  useEffect(() => () => { activeJob.current?.controller.abort(); }, []);
  const pane = (side) => (side === 'left' ? leftRef : rightRef).current;
  const sources = () => Object.fromEntries(['left', 'right'].map((side) => [side, { ...pane(side)?.getControlState(), markers: markers[side], selection: selections[side] }]));
  const resolved = (side) => { try { return { ...resolveSegment(selections[side], markers[side], pane(side)?.duration), error: null }; } catch (error) { return { start: null, end: null, error: error.message }; } };
  const setSegment = (side, selection) => { const bounds = resolveSegment(selection, markers[side], pane(side)?.duration); setSelections((s) => ({ ...s, [side]: selection })); pauseComparison(); return { selection, ...bounds }; };
  const clearSegment = (side) => { setSelections((s) => ({ ...s, [side]: null })); pauseComparison(); return { cleared: side }; };
  const configureComparison = (config) => {
    if (config.mode === 'aligned') resolveExportPlan({ source: 'both' }, sources(), config);
    pauseComparison(); leftRef.current?.pause(); rightRef.current?.pause(); setComparison(config); return config;
  };
  const seekPosition = async (position, target) => {
    const sides = target === 'both' ? ['left', 'right'] : [target];
    const times = sides.map((side) => { const marker = markers[side].find((m) => m.index === position - 1); if (!marker || !pane(side)?.getControlState().ready) throw new Error(`${side}: P${position} is missing. Neither pane moved.`); return marker.time; });
    pauseComparison(); sides.forEach((side) => pane(side).pause());
    return Promise.all(sides.map(async (side, i) => ({ side, ...await pane(side).seekSource(times[i]) })));
  };
  const mark = (side, position, time) => {
    if (!pane(side)?.hasVideo || !Number.isFinite(time) || time < 0 || time > pane(side).duration) throw new Error('Marker must be inside a loaded source.');
    setMarker(side, position - 1, time); pauseComparison();
    return { side, sourceId: pane(side).getControlState().sourceId, position, label: `P${position}`, time };
  };
  const unmark = (side, position) => {
    removeMarker(side, position - 1); pauseComparison();
    return { side, position, affectedSelection: selections[side]?.kind === 'positions' && [selections[side].from, selections[side].to].includes(position - 1), affectedDrawings: pane(side)?.getShapes().filter((s) => s.visibility?.kind === 'positions' && [s.visibility.from, s.visibility.to].includes(position - 1)).map((s) => s.id) };
  };
  const toggleAligned = (speed) => {
    if (playing) { pauseComparison(); return; }
    const plan = resolveExportPlan({ source: 'both', speed }, sources(), comparison);
    leftRef.current.pause(); rightRef.current.pause(); clock.current = { began: performance.now(), plan, controller: new AbortController() }; setPlaying(true);
  };
  useEffect(() => {
    if (!playing || !clock.current) return undefined;
    let stopped = false, timer;
    const controller = clock.current.controller;
    const tick = async () => {
      const { began, plan } = clock.current;
      const mapped = mapExportTime(plan, ((performance.now() - began) / 1000) % plan.passDuration);
      try {
        await Promise.all(mapped.map(({ side, time }) => (side === 'left' ? leftRef : rightRef).current.seekSource(time, controller.signal)));
        if (!stopped) setHeld(Object.fromEntries(mapped.map((m) => [m.side, m.held])));
      } catch { if (!stopped) setPlaying(false); }
      if (!stopped) timer = setTimeout(tick, 1000 / 30);
    };
    tick();
    return () => { stopped = true; controller.abort(); clearTimeout(timer); setHeld({}); };
  }, [playing, leftRef, rightRef]);
  const recipe = (options) => resolveExportPlan(options, sources(), comparison);
  const updateJob = (job) => { jobRef.current[job.jobId] = job; setJobs({ ...jobRef.current }); };
  const startExport = (options) => {
    if (activeJob.current) throw new Error(`Export already active: ${activeJob.current.jobId}`);
    const plan = structuredClone(recipe(options));

    const jobId = crypto.randomUUID(), controller = new AbortController();
    activeJob.current = { jobId, controller };
    const initial = { jobId, status: 'queued', progress: 0, resolvedRecipe: plan, expectedDuration: plan.expectedDuration };
    updateJob(initial);
    setTimeout(async () => {
      try {
        updateJob({ ...initial, status: 'running' });
        const result = await recordClip({ plan, signal: controller.signal, isCurrent: () => plan.panes.every((p) => sourceRef.current[p.side] === p.src), onProgress: (progress) => updateJob({ ...initial, status: 'running', progress }) });
        if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        const saved = window.swingstrDesktop?.saveExport ? await window.swingstrDesktop.saveExport({ bytes: await result.blob.arrayBuffer(), ext: result.ext, destination: options.destination ?? 'exports' }) : {};
        if (saved.cancelled) updateJob({ ...initial, status: 'cancelled', progress: 1 });
        else { const { blob: _blob, ...metadata } = result; updateJob({ ...initial, status: 'completed', progress: 1, ...metadata, ...saved }); jobRef.current[jobId].result = result; }
      } catch (error) { updateJob({ ...initial, progress: jobRef.current[jobId]?.progress ?? 0, status: error.name === 'AbortError' ? 'cancelled' : 'failed', error: error.message }); }
      finally { activeJob.current = null; }
    }, 0);
    return initial;
  };
  const getExportStatus = (jobId) => { const job = jobRef.current[jobId]; if (!job) throw new Error('Unknown job or interrupted renderer session.'); const { result: _result, ...status } = job; return status; };
  const getExportResult = (jobId) => jobRef.current[jobId]?.result;
  const cancelExport = (jobId) => { const job = getExportStatus(jobId); if (activeJob.current?.jobId === jobId) activeJob.current.controller.abort(); return job; };
  return { selections, comparison, held, playing, jobs: Object.fromEntries(Object.entries(jobs).map(([id, { result: _result, ...job }]) => [id, job])), sources, resolved, setSegment, clearSegment, configureComparison, seekPosition, mark, unmark, toggleAligned, pauseComparison, recipe, startExport, getExportStatus, getExportResult, cancelExport, recordingType: pickRecordingType() };
}
