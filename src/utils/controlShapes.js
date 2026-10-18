// MCP coordinates describe the video itself, independent of letterboxing,
// display zoom and pan. Existing Swingstr shapes use untransformed pane pixels.
export function mapShape(shape, mapPoint) {
  const result = { ...shape };
  for (const key of ['start', 'end', 'p1', 'p2', 'p3']) {
    if (shape[key]) result[key] = mapPoint(shape[key]);
  }
  if (shape.points) result.points = shape.points.map(mapPoint);
  return result;
}

export function shapeFromCommand(args, rect, defaults) {
  const points = args.points.map(({ x, y }) => ({ x: rect.x + x * rect.w, y: rect.y + y * rect.h }));
  const shape = { type: args.type, color: args.color ?? defaults.color, width: args.width ?? defaults.width };
  if (args.type === 'angle') return { ...shape, p1: points[0], p2: points[1], p3: points[2] };
  if (args.type === 'free') return { ...shape, points };
  return { ...shape, start: points[0], end: args.type === 'vline' ? { x: points[0].x, y: points[1].y } : points[1] };
}

export function shapeToVideo(shape, rect) {
  return mapShape(shape, ({ x, y }) => ({ x: (x - rect.x) / rect.w, y: (y - rect.y) / rect.h }));
}
