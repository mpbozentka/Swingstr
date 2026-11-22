import { z } from 'zod';

const side = z.enum(['left', 'right']).optional();
const point = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict();
const style = {
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  width: z.number().min(1).max(20).optional(),
};
const position = z.number().int().min(1).max(10);
const requiredSide = z.enum(['left', 'right']);
const seconds = z.number().finite().min(0);
const visibility = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }).strict(),
  z.object({ kind: z.literal('frame'), mediaTime: seconds }).strict(),
  z.object({ kind: z.literal('range'), start: seconds, end: seconds }).strict().refine((a) => a.end > a.start, 'Range must be ordered.'),
  z.object({ kind: z.literal('positions'), from: position, to: position }).strict(),
]);
const crop = z.object({ x: seconds.max(1), y: seconds.max(1), w: z.number().positive().max(1), h: z.number().positive().max(1) }).strict().refine((c) => c.x + c.w <= 1 && c.y + c.h <= 1, 'Crop exceeds source.');
const framing = z.object({ fit: z.enum(['contain', 'crop']).optional(), crop: crop.optional() }).strict();
const frameNumber = z.number().int().min(0);
const imageOptions = {
  crop: crop.optional(),
  grid: z.union([z.boolean(), z.number().int().min(2).max(40)]).optional(),
  annotations: z.boolean().optional(),
};
const shape = {
  type: z.enum(['line', 'vline', 'angle', 'circle', 'rect', 'free']),
  points: z.array(point).min(2).max(1000),
  ...style,
  visibility: visibility.optional(),
  showAngleLabel: z.boolean().optional(),
};
export const toolDefinitions = {
  get_state: { description: 'Read Swingstr playback, view, selected tool, video dimensions, drawings and any half-placed drawing (pendingDrawing). Drawing coordinates are normalized video coordinates, x/y from 0 to 1.', schema: z.object({}).strict(), readOnly: true },
  get_frame: { description: 'See the current decoded video frame with drawings, including half-placed angle points. Returns time, frameIndex and fps. Full native resolution unless you narrow it: crop {x,y,w,h} (normalized to the whole video) zooms into a region such as the hands or the ball; maxWidth caps the image width for quick checks; grid true (or a target line count) overlays labelled lines in whole-video normalized coordinates, so a label can be passed straight to draw_shape; annotations false hides drawings. Waits for pending seeks.', schema: z.object({ side, ...imageOptions, maxWidth: z.number().int().min(64).max(4096).optional() }).strict(), readOnly: true },
  get_frames: { description: 'See several moments of one pane in a single numbered contact sheet, without moving the visible video. Choose exactly one of: frames (frame numbers), frameRange {from, to, step} (consecutive frames, e.g. to pick P4), times (seconds) or positions (P numbers that are marked). Up to 24 tiles. Each tile is captioned with its tile number, frame number, time and any P position, and the response lists them. tileWidth (default 320) and columns set the layout; crop, grid and annotations work as in get_frame.', schema: z.object({ side, frames: z.array(frameNumber).min(1).max(24).optional(), frameRange: z.object({ from: frameNumber, to: frameNumber, step: z.number().int().min(1).max(120).optional() }).strict().refine((r) => r.to >= r.from, 'frameRange.to must be at or after from.').optional(), times: z.array(seconds).min(1).max(24).optional(), positions: z.array(position).min(1).max(10).optional(), tileWidth: z.number().int().min(80).max(800).optional(), columns: z.number().int().min(1).max(8).optional(), ...imageOptions }).strict().refine((a) => ['frames', 'frameRange', 'times', 'positions'].filter((k) => a[k] != null).length === 1, 'Choose exactly one of frames, frameRange, times or positions.').refine((a) => !a.frameRange || Math.floor((a.frameRange.to - a.frameRange.from) / (a.frameRange.step ?? 1)) + 1 <= 24, 'frameRange covers more than 24 tiles; raise step or narrow it.'), readOnly: true },
  list_swings: { description: 'List saved swing IDs and labels grouped by student name. Omits student contact details and notes.', schema: z.object({}).strict(), readOnly: true },
  open_swing: { description: 'Open a saved local swing by studentId and swingId from list_swings. Waits until the video is ready. Replaces the selected pane; drawings in that pane are cleared.', schema: z.object({ studentId: z.string().min(1), swingId: z.string().min(1), side }).strict() },
  playback: { description: 'Play, pause, seek, step by signed frames, or set speed. Uses existing active/synced playback controls. Seek takes seconds or an exact frame number (frame, using the measured frame rate; frame numbers match the scrubber and get_state frameIndex). Without fps, frame stepping moves exactly that many frames using the measured frame rate of the video; with fps, it moves frames / fps seconds. Returns time, frameIndex and fps.', schema: z.object({ action: z.enum(['play', 'pause', 'seek', 'step', 'speed']), seconds: z.number().min(0).optional(), frame: frameNumber.optional(), frames: z.number().int().min(-300).max(300).optional(), fps: z.number().min(1).max(240).optional(), rate: z.number().min(0.1).max(4).optional() }).strict().superRefine((a, ctx) => {
    if (a.action === 'seek') {
      if ((a.seconds == null) === (a.frame == null)) ctx.addIssue({ code: 'custom', message: 'seek needs exactly one of seconds or frame' });
      return;
    }
    if (a.frame != null) ctx.addIssue({ code: 'custom', message: 'frame is only used with seek' });
    const required = { step: 'frames', speed: 'rate' }[a.action];
    if (required && a[required] == null) ctx.addIssue({ code: 'custom', message: `${required} is required for ${a.action}` });
  }) },
  select_tool: { description: 'Select an existing Swingstr drawing or move tool.', schema: z.object({ tool: z.enum(['move', 'select', 'line', 'vline', 'angle', 'circle', 'rect', 'free']) }).strict() },
  set_style: { description: 'Set stroke color and thickness for subsequent drawings.', schema: z.object(style).strict() },
  configure_view: { description: 'Choose active pane, single/split layout, and linked playback.', schema: z.object({ side, layout: z.enum(['single', 'split']).optional(), sync: z.boolean().optional() }).strict() },
  draw_shape: { description: 'Add a drawing in normalized video coordinates (0..1). Line/vertical line/box: two points. Circle: center then radius endpoint. Angle: vertex then two arm endpoints. Freehand: ordered points. Pauses the selected pane. Returns shape index.', schema: z.object({ side, ...shape }).strict().superRefine(validatePointCount) },
  update_shape: { description: 'Replace an existing drawing by index from get_state, using the same normalized video coordinate format as draw_shape.', schema: z.object({ side, index: z.number().int().min(0).optional(), id: z.string().min(1).optional(), ...shape }).strict().superRefine(validatePointCount).refine((a) => a.id || a.index != null, 'Provide id or index.') },
};

Object.assign(toolDefinitions, {
  set_marker: { description: 'Set one P1–P10 checkpoint on one pane, at a time in seconds or at an exact frame number (frame, preferred; matches the scrubber and get_state frameIndex). Replaces that position if already marked. Returns time and frameIndex.', schema: z.object({ side: requiredSide, position, time: seconds.optional(), frame: frameNumber.optional() }).strict().refine((a) => (a.time == null) !== (a.frame == null), 'Provide exactly one of time or frame.') },
  remove_marker: { description: 'Remove one checkpoint and report unresolved references.', schema: z.object({ side: requiredSide, position }).strict() },
  seek_position: { description: 'Pause and seek to own decoded checkpoints. Both requires both markers before either pane moves.', schema: z.object({ position, target: z.enum(['left', 'right', 'both']) }).strict() },
  set_segment: { description: 'Set a non-destructive source-time or checkpoint selection with explicit padding.', schema: z.object({ side: requiredSide, selection: z.discriminatedUnion('kind', [z.object({ kind: z.literal('times'), start: seconds, end: seconds }).strict(), z.object({ kind: z.literal('positions'), from: position, to: position }).strict()]), paddingBefore: seconds.max(2).optional(), paddingAfter: seconds.max(2).optional() }).strict() },
  clear_segment: { description: 'Clear only the explicit pane selection.', schema: z.object({ side: requiredSide }).strict() },
  configure_comparison: { description: 'Align at a marked checkpoint with equal speed and labeled held boundaries.', schema: z.object({ mode: z.enum(['independent', 'aligned']), anchorPosition: position.optional() }).strict().refine((a) => a.mode !== 'aligned' || a.anchorPosition != null, 'Aligned comparison needs anchorPosition.') },
  remove_drawing: { description: 'Remove only one drawing by stable ID.', schema: z.object({ side: requiredSide, id: z.string().min(1) }).strict() },
  start_export: { description: 'Snapshot the validated recipe and promptly return a job ID. Silent local export, no publishing.', schema: z.object({ source: z.enum(['left', 'right', 'both']), preset: z.enum(['portrait', 'square', 'landscape']), speed: z.union([z.literal(1), z.literal(0.5), z.literal(0.25)]), repeats: z.union([z.literal(1), z.literal(3), z.literal(5)]), annotations: z.enum(['clean', 'annotated']), holds: z.object({ startSeconds: seconds.max(3).optional(), endSeconds: seconds.max(3).optional(), checkpoint: z.object({ position, seconds: seconds.max(3) }).strict().optional() }).strict().optional(), title: z.string().max(200).optional(), paneLabels: z.object({ left: z.string().max(100).optional(), right: z.string().max(100).optional() }).strict().optional(), framing: z.object({ left: framing.optional(), right: framing.optional() }).strict().optional(), destination: z.enum(['exports', 'dialog']).optional() }).strict() },
  get_export_status: { description: 'Read session export status, progress, saved path and verified metadata.', schema: z.object({ jobId: z.string().min(1) }).strict(), readOnly: true },
  cancel_export: { description: 'Idempotently cancel an active export and release its media resources.', schema: z.object({ jobId: z.string().min(1) }).strict() },
});

const studentFields = {
  email: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  notes: z.string().max(20000).optional(),
};
Object.assign(toolDefinitions, {
  load_video: { description: 'Load a new video into a pane for analysis. Give an absolute local file path (mp4/mov/m4v/webm) or an http(s)/YouTube URL. YouTube clips are downloaded first, which can take a minute. Waits until the video is ready. Replaces the pane and clears its drawings. Does not save to the library; use save_swing for that.', schema: z.object({ side, path: z.string().min(1).optional(), url: z.string().url().optional() }).strict().refine((a) => Boolean(a.path) !== Boolean(a.url), 'Provide exactly one of path or url.').refine((a) => !a.path || a.path.startsWith('/'), 'path must be absolute.') },
  save_swing: { description: 'Save the video in a pane to a student profile in the local Swingstr Library with a label. Give studentId (from list_swings) or newStudentName to create the student. Returns the new swingId.', schema: z.object({ side, label: z.string().trim().min(1).max(120), studentId: z.string().min(1).optional(), newStudentName: z.string().trim().min(1).max(120).optional() }).strict().refine((a) => Boolean(a.studentId) !== Boolean(a.newStudentName), 'Provide exactly one of studentId or newStudentName.') },
  create_student: { description: 'Create a student profile. Returns its studentId.', schema: z.object({ name: z.string().trim().min(1).max(120), ...studentFields }).strict() },
  update_student: { description: 'Change a student profile\'s name, email, phone or coaching notes. Omitted fields are unchanged.', schema: z.object({ studentId: z.string().min(1), name: z.string().trim().min(1).max(120).optional(), ...studentFields }).strict() },
  get_student: { description: 'Read one student profile including contact details, coaching notes and saved swings.', schema: z.object({ studentId: z.string().min(1) }).strict(), readOnly: true },
});

const templateName = z.string().trim().min(1).max(80);
const applyMode = z.enum(['replace', 'add']).optional();
Object.assign(toolDefinitions, {
  save_annotations: { description: 'Save the pane\'s current P1–P10 checkpoints and drawings to the saved swing open in that pane (opened with open_swing or just saved with save_swing), replacing what that swing had stored. Optional notes are stored with the swing. Fails if the pane is not showing a saved swing.', schema: z.object({ side, notes: z.string().max(20000).optional() }).strict() },
  load_annotations: { description: 'Put a saved swing\'s stored drawings onto the pane. From the same swing that is open, it also restores its checkpoints (an undo back to the saved version). From a different swing, only drawings are copied by default (its checkpoint times belong to another video); drawings tied to one frame or time range become whole-swing drawings, and P-position ranges follow this pane\'s own markers. mode replace (default) or add.', schema: z.object({ side, studentId: z.string().min(1), swingId: z.string().min(1), includeMarkers: z.boolean().optional(), mode: applyMode }).strict() },
  save_template: { description: 'Save the pane\'s current drawings as a named template, such as "face-on iron address", in the local Swingstr Library. Coordinates are saved as drawn. Fails if the name exists unless replace is true.', schema: z.object({ side, name: templateName, description: z.string().max(500).optional(), replace: z.boolean().optional() }).strict() },
  list_templates: { description: 'List saved drawing templates with their descriptions and drawing counts.', schema: z.object({}).strict(), readOnly: true },
  apply_template: { description: 'Draw a saved template onto the pane. Lines land at the coordinates they were saved with, so check the frame and move each one to fit this golfer with update_shape. mode replace (default) clears existing drawings first; add keeps them. Returns the new drawings with their IDs.', schema: z.object({ side, name: templateName, mode: applyMode }).strict() },
});

// Commands that may wait on downloads or large file reads.
export const commandTimeouts = { load_video: 300000, save_swing: 120000, get_frames: 150000 };

function validatePointCount(a, ctx) {
  const count = a.type === 'angle' ? 3 : 2;
  if (a.type !== 'free' && a.points.length !== count) ctx.addIssue({ code: 'custom', message: `${a.type} requires ${count} points` });
}

export function validateCommand(name, args) {
  const tool = toolDefinitions[name];
  if (!tool) throw new Error(`Unknown Swingstr command: ${name}`);
  return tool.schema.parse(args);
}
