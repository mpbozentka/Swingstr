import { useEffect } from 'react';

// Translate human P numbers exactly once at the transport boundary.
function publicResult(value) {
  if (Array.isArray(value)) return value.map(publicResult);
  if (!value || typeof value !== 'object') return value;
  const result = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, publicResult(item)]));
  if (value.kind === 'positions') { result.from = value.from + 1; result.to = value.to + 1; }
  if (Number.isInteger(value.index) && typeof value.label === 'string') result.position = value.index + 1;
  return result;
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function waitForVideo(pane, ready) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const video = pane()?.getVideoElement();
    if (video?.error) throw new Error('The saved video could not be decoded.');
    if (video && ready(video)) return video;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('Video did not become ready in time.');
}

export function useSwingstrControl({
  leftRef, rightRef, students, view, layout, sync, activeScreen, tool, color, lineWidth,
  setView, setLayout, setSync, setActiveScreen, setTool, setColor, setLineWidth,
  togglePlay, scrubTo, seek, changeSpeed, openSavedVideo, workflow,
}) {
  useEffect(() => {
    const desktop = window.swingstrDesktop;
    if (!desktop?.onControlCommand) return undefined;
    const pane = (side = activeScreen) => (side === 'left' ? leftRef : rightRef).current;
    const handle = async (name, args) => {
      const side = args.side ?? activeScreen;
      const target = () => pane(side);
      switch (name) {
        case 'get_state':
          return {
            view, layout, sync, activeScreen, tool, color, lineWidth,
            coordinateSystem: 'normalized video coordinates, x/y 0..1; angle p1 is the vertex',
            left: pane('left')?.getControlState() ?? null,
            right: pane('right')?.getControlState() ?? null,
            sources: Object.fromEntries(Object.entries(workflow.sources()).map(([side, source]) => [side, { ...source, resolvedSelection: workflow.resolved(side) }])), comparison: workflow.comparison,
            selections: workflow.selections, exportCapabilities: { type: workflow.recordingType, silent: true, nativeSaving: !!desktop.saveExport }, jobs: workflow.jobs,
          };
        case 'list_swings':
          return students.map((student) => ({
            studentId: student.id, name: student.name,
            swings: (student.videos ?? []).map((video) => ({ swingId: video.id, label: video.label, source: video.source, date: video.date })),
          }));
        case 'open_swing': {
          const student = students.find((s) => s.id === args.studentId);
          const swing = student?.videos?.find((v) => v.id === args.swingId);
          if (!swing) throw new Error('Saved swing not found. Use list_swings for current IDs.');
          if (swing.source !== 'idb') throw new Error('Direct control currently opens local saved files only. Open remote/Drive clips through the app.');
          pane(side)?.pause();
          if (!await openSavedVideo(side, swing)) throw new Error('Could not open the saved swing. Check the app message.');
          await settle();
          await waitForVideo(target, (v) => v.readyState >= 2 && v.videoWidth > 0);
          target().clearShapes();
          return { opened: true, side, label: swing.label, ...target().getControlState() };
        }
        case 'configure_view':
          if (args.layout) setLayout(args.layout);
          if (args.sync != null) setSync(args.sync);
          if (args.side) {
            setActiveScreen(args.side);
            if (args.side === 'right') setLayout('split');
          }
          setView('analyze');
          break;
        case 'select_tool': setTool(args.tool); break;
        case 'set_style':
          if (args.color) setColor(args.color);
          if (args.width != null) setLineWidth(args.width);
          break;
        case 'playback': {
          if (!target()?.hasVideo) throw new Error('Open a video in the active analyzer pane first.');
          const aligned = workflow.comparison.mode === 'aligned';
          const playing = aligned ? workflow.playing : target().getControlState().playing;
          if ((args.action === 'play' && !playing) || (args.action === 'pause' && playing)) togglePlay();
          if (args.action === 'play' && !aligned) await waitForVideo(target, (v) => !v.paused && v.readyState >= 2);
          if (args.action === 'pause' && !aligned) await waitForVideo(target, (v) => v.paused);
          if (args.action === 'speed') changeSpeed(args.rate);
          if (args.action === 'seek' || args.action === 'step') {
            if (sync) { pane('left')?.pause(); pane('right')?.pause(); }
            else target().pause();
            if (args.action === 'seek') scrubTo(Math.min(args.seconds, target().duration));
            else seek(args.frames / (args.fps ?? 30));
            await waitForVideo(target, (v) => !v.seeking && v.readyState >= 2);
          }
          await settle();
          return target().getControlState();
        }
        case 'get_frame': {
          await waitForVideo(target, (v) => !v.seeking && v.readyState >= 2);
          const dataUrl = await target().getSnapshot();
          if (!dataUrl) throw new Error('Could not capture the current video frame.');
          const state = target().getControlState();
          return { side, time: state.time, width: state.width, height: state.height, dataUrl };
        }
        case 'set_marker': return workflow.mark(args.side, args.position, args.time);
        case 'remove_marker': return workflow.unmark(args.side, args.position);
        case 'seek_position': return workflow.seekPosition(args.position, args.target);
        case 'set_segment': return workflow.setSegment(args.side, { ...args.selection, ...(args.selection.kind === 'positions' ? { from: args.selection.from - 1, to: args.selection.to - 1 } : {}), paddingBefore: args.paddingBefore ?? 0, paddingAfter: args.paddingAfter ?? 0 });
        case 'clear_segment': return workflow.clearSegment(args.side);
        case 'configure_comparison': return workflow.configureComparison(args);
        case 'remove_drawing': return target().removeDrawing(args.id);
        case 'start_export':
          if (!desktop.saveExport) throw new Error('MCP export requires desktop native output.');
          return workflow.startExport(args);
        case 'get_export_status': return workflow.getExportStatus(args.jobId);
        case 'cancel_export': return workflow.cancelExport(args.jobId);
        case 'draw_shape':
        case 'update_shape':
          return target()?.putControlShape({ ...args, visibility: args.visibility?.kind === 'positions' ? { ...args.visibility, from: args.visibility.from - 1, to: args.visibility.to - 1 } : args.visibility }, { color, width: lineWidth }) ?? Promise.reject(new Error('Open the analyzer before drawing.'));
        default: throw new Error(`Unsupported Swingstr command: ${name}`);
      }
      await settle();
      return { ok: true };
    };
    return desktop.onControlCommand(async (name, args) => {
      const result = await handle(name, args);
      await settle();
      return publicResult(result);
    });
  }, [leftRef, rightRef, students, view, layout, sync, activeScreen, tool, color, lineWidth,
    setView, setLayout, setSync, setActiveScreen, setTool, setColor, setLineWidth,
    togglePlay, scrubTo, seek, changeSpeed, openSavedVideo, workflow]);
}
