import { useEffect } from 'react';
import { frameAt, frameStartTime, frameInfo } from '../utils/agentFrames';
import { portableDrawings, upsertTemplate, findTemplate } from '../utils/swingAnnotations';

// Translate human P numbers exactly once at the transport boundary.
function publicResult(value) {
  if (Array.isArray(value)) return value.map(publicResult);
  if (!value || typeof value !== 'object') return value;
  const result = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, publicResult(item)]));
  if (value.kind === 'positions') { result.from = value.from + 1; result.to = value.to + 1; }
  if (Number.isInteger(value.index) && typeof value.label === 'string') result.position = value.index + 1;
  return result;
}
const videoType = (name) => (/\.webm$/i.test(name) ? 'video/webm' : /\.mov$/i.test(name) ? 'video/quicktime' : 'video/mp4');
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
  togglePlay, scrubTo, seek, stepFrames, changeSpeed, openSavedVideo, workflow,
  handleUpload, setUrlSource, saveSwing, setStudents, newId,
  leftFps, rightFps, captureAnnotations, applyAnnotations, paneSwing,
}) {
  useEffect(() => {
    const desktop = window.swingstrDesktop;
    if (!desktop?.onControlCommand) return undefined;
    const pane = (side = activeScreen) => (side === 'left' ? leftRef : rightRef).current;
    const fpsOf = (side) => (side === 'left' ? leftFps : rightFps);
    // Pane state plus the measured frame rate and the current frame number,
    // counted the same way as the scrubber.
    const paneState = (side) => {
      const state = pane(side)?.getControlState();
      return state ? { ...state, ...frameInfo(state, fpsOf(side)) } : null;
    };
    const requireFps = (side) => {
      const fps = fpsOf(side);
      if (!fps) throw new Error('The frame rate of this video is still being measured. Try again in a moment, or use seconds.');
      return fps;
    };
    const withFrame = (side, marker) => {
      const fps = fpsOf(side);
      return fps ? { ...marker, frameIndex: frameAt(marker.time, fps) } : marker;
    };
    const savedSwing = (side) => {
      const swingId = paneSwing(side);
      if (!swingId) return null;
      const student = students.find((s) => s.videos?.some((v) => v.id === swingId));
      const swing = student?.videos.find((v) => v.id === swingId);
      return swing ? { student, swing } : null;
    };
    const findSwing = (studentId, swingId) => {
      const student = students.find((s) => s.id === studentId);
      const swing = student?.videos?.find((v) => v.id === swingId);
      if (!swing) throw new Error('Saved swing not found. Use list_swings for current IDs.');
      return { student, swing };
    };
    const templateStore = () => {
      if (!desktop.loadTemplates || !desktop.saveTemplates) throw new Error('Templates are available only in the desktop app.');
      return desktop;
    };
    const handle = async (name, args) => {
      const side = args.side ?? activeScreen;
      const target = () => pane(side);
      switch (name) {
        case 'get_state':
          return {
            view, layout, sync, activeScreen, tool, color, lineWidth,
            coordinateSystem: 'normalized video coordinates, x/y 0..1; angle p1 is the vertex',
            frameNumbering: 'frameIndex counts from 0 at the measured fps and matches the scrubber; seek and set_marker accept frame',
            left: paneState('left'),
            right: paneState('right'),
            savedSwings: Object.fromEntries(['left', 'right'].map((s) => {
              const open = savedSwing(s);
              return [s, open ? { studentId: open.student.id, studentName: open.student.name, swingId: open.swing.id, label: open.swing.label } : null];
            })),
            sources: Object.fromEntries(Object.entries(workflow.sources()).map(([side, source]) => [side, { ...source, ...frameInfo(source, fpsOf(side)), markers: (source.markers ?? []).map((m) => withFrame(side, m)), resolvedSelection: workflow.resolved(side) }])), comparison: workflow.comparison,
            selections: workflow.selections, exportCapabilities: { type: workflow.recordingType, silent: true, nativeSaving: !!desktop.saveExport }, jobs: workflow.jobs,
          };
        case 'list_swings':
          return students.map((student) => ({
            studentId: student.id, name: student.name,
            swings: (student.videos ?? []).map((video) => ({ swingId: video.id, label: video.label, source: video.source, date: video.date })),
          }));
        case 'open_swing': {
          const { swing } = findSwing(args.studentId, args.swingId);
          if (swing.source !== 'idb') throw new Error('Direct control currently opens local saved files only. Open remote/Drive clips through the app.');
          pane(side)?.pause();
          if (!await openSavedVideo(side, swing)) throw new Error('Could not open the saved swing. Check the app message.');
          await settle();
          await waitForVideo(target, (v) => v.readyState >= 2 && v.videoWidth > 0);
          // The saved checkpoints and drawings come back with the swing. Put
          // them on explicitly so they're in place before this returns.
          applyAnnotations(side, { markers: swing.markers ?? [], drawings: swing.drawings ?? [] });
          await settle();
          return { opened: true, side, label: swing.label, restored: { markers: (swing.markers ?? []).length, drawings: (swing.drawings ?? []).length, notes: swing.notes ?? '' }, ...paneState(side) };
        }
        case 'load_video': {
          pane(side)?.pause();
          if (args.file) {
            const file = new File([args.file.buffer], args.file.fileName, { type: videoType(args.file.fileName) });
            handleUpload(side, { target: { files: [file] } });
          } else {
            const result = await setUrlSource(side, args.url);
            if (result?.error) throw new Error(result.error);
          }
          if (side === 'right') setLayout('split');
          setActiveScreen(side);
          setView('analyze');
          await settle();
          await waitForVideo(target, (v) => v.readyState >= 2 && v.videoWidth > 0);
          target().clearShapes();
          return { loaded: true, side, ...paneState(side) };
        }
        case 'save_swing': {
          const { studentId, record } = await saveSwing(side, args);
          return { saved: true, studentId, swingId: record.id, label: record.label, source: record.source };
        }
        case 'create_student': {
          const student = { id: newId(), name: args.name, email: args.email ?? '', phone: args.phone ?? '', notes: args.notes ?? '', videos: [] };
          setStudents((prev) => [...prev, student]);
          return { created: true, studentId: student.id, name: student.name };
        }
        case 'update_student': {
          if (!students.some((s) => s.id === args.studentId)) throw new Error('Student not found. Use list_swings for current IDs.');
          const { studentId, ...changes } = args;
          setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, ...changes } : s)));
          return { updated: true, studentId, changed: Object.keys(changes) };
        }
        case 'get_student': {
          const student = students.find((s) => s.id === args.studentId);
          if (!student) throw new Error('Student not found. Use list_swings for current IDs.');
          const { videos = [], ...profile } = student;
          return { ...profile, studentId: student.id, swings: videos.map((video) => ({ swingId: video.id, label: video.label, source: video.source, date: video.date })) };
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
            if (args.action === 'seek') {
              const seconds = args.frame != null ? frameStartTime(args.frame, requireFps(side)) : args.seconds;
              if (args.frame != null && seconds > target().duration) throw new Error(`Frame ${args.frame} is past the end of the video (last frame ${frameAt(target().duration, fpsOf(side)) - 1}).`);
              scrubTo(Math.min(seconds, target().duration));
            }
            else if (args.fps) seek(args.frames / args.fps);
            else stepFrames(args.frames);
            await waitForVideo(target, (v) => !v.seeking && v.readyState >= 2);
          }
          await settle();
          return paneState(side);
        }
        case 'get_frame': {
          await waitForVideo(target, (v) => !v.seeking && v.readyState >= 2);
          const image = await target().captureView(args);
          if (!image) throw new Error('Could not capture the current video frame.');
          const state = paneState(side);
          return { side, time: state.time, frameIndex: state.frameIndex, fps: state.fps, width: state.width, height: state.height, crop: args.crop ?? null, ...image };
        }
        case 'get_frames': {
          if (!target()?.hasVideo) throw new Error('Open a video in that pane first.');
          const fps = fpsOf(side);
          const markers = workflow.sources()[side]?.markers ?? [];
          let times;
          if (args.positions) {
            const missing = args.positions.filter((p) => !markers.some((m) => m.index === p - 1));
            if (missing.length) throw new Error(`Not marked on the ${side} pane: ${missing.map((p) => `P${p}`).join(', ')}.`);
            times = args.positions.map((p) => markers.find((m) => m.index === p - 1).time);
          } else if (args.times) {
            times = args.times;
          } else {
            requireFps(side);
            const frames = args.frames ?? Array.from({ length: Math.floor((args.frameRange.to - args.frameRange.from) / (args.frameRange.step ?? 1)) + 1 }, (_, i) => args.frameRange.from + i * (args.frameRange.step ?? 1));
            times = frames.map((f) => frameStartTime(f, fps));
          }
          const past = times.filter((t) => t > target().duration);
          if (past.length) throw new Error(`${past.length} requested moment(s) are past the end of the video (${target().duration.toFixed(3)} s${fps ? `, last frame ${frameAt(target().duration, fps) - 1}` : ''}).`);
          const positionAt = (time) => {
            const hit = markers.find((m) => (fps ? frameAt(m.time, fps) === frameAt(time, fps) : Math.abs(m.time - time) < 0.0005));
            return hit ? hit.index + 1 : null;
          };
          const items = times.map((time) => ({
            time,
            caption: (decoded, n) => {
              const p = positionAt(decoded);
              return [`#${n}`, fps ? `f${frameAt(decoded, fps)}` : null, `${decoded.toFixed(3)}s`, p ? `P${p}` : null].filter(Boolean).join('  ');
            },
          }));
          const sheet = await target().captureTimes(items, args);
          return {
            side, fps: fps ?? null, ...sheet,
            tiles: sheet.tiles.map((t) => ({ tile: t.tile, time: t.time, frameIndex: fps ? frameAt(t.time, fps) : null, pPosition: positionAt(t.time) })),
          };
        }
        case 'set_marker': {
          const time = args.frame != null ? frameStartTime(args.frame, requireFps(args.side)) : args.time;
          return withFrame(args.side, workflow.mark(args.side, args.position, time));
        }
        case 'save_annotations': {
          const open = savedSwing(side);
          if (!open) throw new Error(`The ${side} pane isn't showing a saved swing. Open one with open_swing, or save this video first with save_swing.`);
          const annotations = captureAnnotations(side);
          const changes = { ...annotations, ...(args.notes != null ? { notes: args.notes } : {}) };
          setStudents((prev) => prev.map((s) => (s.id !== open.student.id ? s : { ...s, videos: s.videos.map((v) => (v.id === open.swing.id ? { ...v, ...changes } : v)) })));
          return { saved: true, studentId: open.student.id, swingId: open.swing.id, label: open.swing.label, markers: annotations.markers.length, drawings: annotations.drawings.length, notesSaved: args.notes != null };
        }
        case 'load_annotations': {
          const { swing } = findSwing(args.studentId, args.swingId);
          const sameSwing = paneSwing(side) === swing.id;
          const includeMarkers = args.includeMarkers ?? sameSwing;
          const append = args.mode === 'add';
          const { drawings, convertedToWholeSwing } = sameSwing && !append
            ? { drawings: swing.drawings ?? [], convertedToWholeSwing: 0 }
            : portableDrawings(swing.drawings ?? []);
          applyAnnotations(side, { markers: includeMarkers ? (swing.markers ?? []) : null, drawings }, { append });
          await settle();
          return { applied: true, side, fromSwing: swing.label, sameSwing, drawings: drawings.length, markers: includeMarkers ? (swing.markers ?? []).length : 0, convertedToWholeSwing, ...(includeMarkers && !sameSwing ? { warning: 'Checkpoint times came from a different video; check them with get_frames positions.' } : {}) };
        }
        case 'save_template': {
          const store = templateStore();
          const shapes = target()?.getShapes() ?? [];
          if (!shapes.length) throw new Error(`The ${side} pane has no drawings to save.`);
          const { drawings, convertedToWholeSwing } = portableDrawings(shapes);
          const state = target().getControlState();
          const template = { name: args.name.trim(), description: args.description ?? '', savedAt: new Date().toISOString(), video: { width: state.width, height: state.height }, drawings };
          const templates = upsertTemplate(await store.loadTemplates(), template, { replace: args.replace });
          await store.saveTemplates(templates);
          return { saved: true, name: template.name, drawings: drawings.length, convertedToWholeSwing };
        }
        case 'list_templates': {
          const templates = await templateStore().loadTemplates();
          return templates.map((t) => ({ name: t.name, description: t.description, savedAt: t.savedAt, drawings: t.drawings.length, types: [...new Set(t.drawings.map((d) => d.type))] }));
        }
        case 'apply_template': {
          const template = findTemplate(await templateStore().loadTemplates(), args.name);
          const before = args.mode === 'add' ? (target()?.getShapes().length ?? 0) : 0;
          applyAnnotations(side, { markers: null, drawings: template.drawings }, { append: args.mode === 'add' });
          await settle();
          const added = (target()?.getShapes() ?? []).slice(before).map((shape, i) => ({ index: before + i, ...shape }));
          return { applied: true, side, name: template.name, drawings: added, note: 'Coordinates are as saved. Fit each line to this golfer with update_shape.' };
        }
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
    togglePlay, scrubTo, seek, stepFrames, changeSpeed, openSavedVideo, workflow,
    handleUpload, setUrlSource, saveSwing, setStudents, newId,
    leftFps, rightFps, captureAnnotations, applyAnnotations, paneSwing]);
}
