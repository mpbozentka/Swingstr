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
const shape = {
  type: z.enum(['line', 'vline', 'angle', 'circle', 'rect', 'free']),
  points: z.array(point).min(2).max(1000),
  ...style,
  visibility: visibility.optional(),
  showAngleLabel: z.boolean().optional(),
};
export const toolDefinitions = {
  get_state: { description: 'Read Swingstr playback, view, selected tool, video dimensions and drawings. Drawing coordinates are normalized video coordinates, x/y from 0 to 1.', schema: z.object({}).strict(), readOnly: true },
  get_frame: { description: 'See the current decoded video frame with drawings, at native video resolution. Use its dimensions to identify normalized drawing coordinates. Waits for pending seeks.', schema: z.object({ side }).strict(), readOnly: true },
  list_swings: { description: 'List saved swing IDs and labels grouped by student name. Omits student contact details and notes.', schema: z.object({}).strict(), readOnly: true },
  open_swing: { description: 'Open a saved local swing by studentId and swingId from list_swings. Waits until the video is ready. Replaces the selected pane; drawings in that pane are cleared.', schema: z.object({ studentId: z.string().min(1), swingId: z.string().min(1), side }).strict() },
  playback: { description: 'Play, pause, seek in seconds, step by signed frames, or set speed. Uses existing active/synced playback controls. Frame stepping is a time estimate using fps (default 30), not decoded frame indexing.', schema: z.object({ action: z.enum(['play', 'pause', 'seek', 'step', 'speed']), seconds: z.number().min(0).optional(), frames: z.number().int().min(-300).max(300).optional(), fps: z.number().min(1).max(240).optional(), rate: z.number().min(0.1).max(4).optional() }).strict().superRefine((a, ctx) => {
    const required = { seek: 'seconds', step: 'frames', speed: 'rate' }[a.action];
    if (required && a[required] == null) ctx.addIssue({ code: 'custom', message: `${required} is required for ${a.action}` });
  }) },
  select_tool: { description: 'Select an existing Swingstr drawing or move tool.', schema: z.object({ tool: z.enum(['move', 'select', 'line', 'vline', 'angle', 'circle', 'rect', 'free']) }).strict() },
  set_style: { description: 'Set stroke color and thickness for subsequent drawings.', schema: z.object(style).strict() },
  configure_view: { description: 'Choose active pane, single/split layout, and linked playback.', schema: z.object({ side, layout: z.enum(['single', 'split']).optional(), sync: z.boolean().optional() }).strict() },
  draw_shape: { description: 'Add a drawing in normalized video coordinates (0..1). Line/vertical line/box: two points. Circle: center then radius endpoint. Angle: vertex then two arm endpoints. Freehand: ordered points. Pauses the selected pane. Returns shape index.', schema: z.object({ side, ...shape }).strict().superRefine(validatePointCount) },
  update_shape: { description: 'Replace an existing drawing by index from get_state, using the same normalized video coordinate format as draw_shape.', schema: z.object({ side, index: z.number().int().min(0).optional(), id: z.string().min(1).optional(), ...shape }).strict().superRefine(validatePointCount).refine((a) => a.id || a.index != null, 'Provide id or index.') },
};

Object.assign(toolDefinitions, {
  set_marker: { description: 'Mark only the explicit source pane. P positions are 1–10.', schema: z.object({ side: requiredSide, position, time: seconds }).strict() },
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

function validatePointCount(a, ctx) {
  const count = a.type === 'angle' ? 3 : 2;
  if (a.type !== 'free' && a.points.length !== count) ctx.addIssue({ code: 'custom', message: `${a.type} requires ${count} points` });
}

export function validateCommand(name, args) {
  const tool = toolDefinitions[name];
  if (!tool) throw new Error(`Unknown Swingstr command: ${name}`);
  return tool.schema.parse(args);
}
