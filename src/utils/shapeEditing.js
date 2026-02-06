/**
 * Shape editing utilities: hit testing and handle definitions.
 * All coordinates in logical/shape space.
 */

const HIT_RADIUS = 12;

function dist(p1, p2) {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  if (lenSq !== 0) param = dot / lenSq;
  let xx, yy;
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }
  return dist({ x: px, y: py }, { x: xx, y: yy });
}

function pointInRect(px, py, x, y, w, h, pad) {
  const minX = Math.min(x, x + w);
  const maxX = Math.max(x, x + w);
  const minY = Math.min(y, y + h);
  const maxY = Math.max(y, y + h);
  return px >= minX - pad && px <= maxX + pad && py >= minY - pad && py <= maxY + pad;
}

export function getHandlesForShape(shape, zoomLevel) {
  const r = Math.max(HIT_RADIUS / zoomLevel, 6);
  const handles = [];
  switch (shape.type) {
    case 'line':
      handles.push({ id: 'start', x: shape.start.x, y: shape.start.y, r });
      handles.push({ id: 'end', x: shape.end.x, y: shape.end.y, r });
      break;
    case 'rect':
    case 'blur': {
      const minX = Math.min(shape.start.x, shape.end.x);
      const maxX = Math.max(shape.start.x, shape.end.x);
      const minY = Math.min(shape.start.y, shape.end.y);
      const maxY = Math.max(shape.start.y, shape.end.y);
      handles.push({ id: 'tl', x: minX, y: minY, r });
      handles.push({ id: 'tr', x: maxX, y: minY, r });
      handles.push({ id: 'br', x: maxX, y: maxY, r });
      handles.push({ id: 'bl', x: minX, y: maxY, r });
      break;
    }
    case 'circle': {
      const cx = shape.start.x;
      const cy = shape.start.y;
      const rad = Math.sqrt((shape.end.x - cx) ** 2 + (shape.end.y - cy) ** 2);
      const angle = Math.atan2(shape.end.y - cy, shape.end.x - cx);
      handles.push({ id: 'center', x: cx, y: cy, r });
      handles.push({ id: 'edge', x: cx + rad * Math.cos(angle), y: cy + rad * Math.sin(angle), r });
      break;
    }
    case 'angle':
      handles.push({ id: 'p1', x: shape.p1.x, y: shape.p1.y, r });
      if (shape.p2) handles.push({ id: 'p2', x: shape.p2.x, y: shape.p2.y, r });
      if (shape.p3) handles.push({ id: 'p3', x: shape.p3.x, y: shape.p3.y, r });
      break;
    case 'free': {
      if (shape.points?.length > 0) {
        const cx = shape.points.reduce((s, p) => s + p.x, 0) / shape.points.length;
        const cy = shape.points.reduce((s, p) => s + p.y, 0) / shape.points.length;
        handles.push({ id: 'move', x: cx, y: cy, r: r * 1.5 });
      }
      break;
    }
    default:
      break;
  }
  return handles;
}

export function hitTestHandle(pos, shape, zoomLevel) {
  const handles = getHandlesForShape(shape, zoomLevel);
  for (const h of handles) {
    if (dist(pos, { x: h.x, y: h.y }) <= h.r) return h.id;
  }
  return null;
}

export function hitTestShape(pos, shape, zoomLevel) {
  switch (shape.type) {
    case 'line':
      return distToSegment(pos.x, pos.y, shape.start.x, shape.start.y, shape.end.x, shape.end.y) <= HIT_RADIUS / zoomLevel;
    case 'rect': {
      const x = shape.start.x;
      const y = shape.start.y;
      const w = shape.end.x - shape.start.x;
      const h = shape.end.y - shape.start.y;
      const pad = HIT_RADIUS / zoomLevel;
      return pointInRect(pos.x, pos.y, x, y, w, h, pad * 2);
    }
    case 'circle': {
      const cx = shape.start.x;
      const cy = shape.start.y;
      const rad = Math.sqrt((shape.end.x - cx) ** 2 + (shape.end.y - cy) ** 2);
      const d = dist(pos, { x: cx, y: cy });
      return Math.abs(d - rad) <= HIT_RADIUS / zoomLevel;
    }
    case 'blur': {
      const x = Math.min(shape.start.x, shape.end.x);
      const y = Math.min(shape.start.y, shape.end.y);
      const w = Math.abs(shape.end.x - shape.start.x);
      const h = Math.abs(shape.end.y - shape.start.y);
      const pad = HIT_RADIUS / zoomLevel;
      return pos.x >= x - pad && pos.x <= x + w + pad && pos.y >= y - pad && pos.y <= y + h + pad;
    }
    case 'angle': {
      const hitLine = (p1, p2) => distToSegment(pos.x, pos.y, p1.x, p1.y, p2.x, p2.y) <= HIT_RADIUS / zoomLevel;
      return (shape.p2 && hitLine(shape.p1, shape.p2)) || (shape.p3 && hitLine(shape.p1, shape.p3));
    }
    case 'free': {
      if (!shape.points?.length) return false;
      for (let i = 0; i < shape.points.length - 1; i++) {
        const p1 = shape.points[i];
        const p2 = shape.points[i + 1];
        if (distToSegment(pos.x, pos.y, p1.x, p1.y, p2.x, p2.y) <= HIT_RADIUS / zoomLevel) return true;
      }
      return dist(pos, shape.points[0]) <= HIT_RADIUS / zoomLevel;
    }
    default:
      return false;
  }
}

export function findShapeAtPos(pos, shapes, zoomLevel) {
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (hitTestShape(pos, shapes[i], zoomLevel)) return i;
  }
  return -1;
}

export function updateShapeWithHandle(shape, handleId, newPos) {
  const next = { ...shape };
  switch (shape.type) {
    case 'line':
      if (handleId === 'start') next.start = { ...newPos };
      else if (handleId === 'end') next.end = { ...newPos };
      break;
    case 'rect':
    case 'blur': {
      const minX = Math.min(shape.start.x, shape.end.x);
      const maxX = Math.max(shape.start.x, shape.end.x);
      const minY = Math.min(shape.start.y, shape.end.y);
      const maxY = Math.max(shape.start.y, shape.end.y);
      if (handleId === 'tl') { next.start = { x: newPos.x, y: newPos.y }; next.end = { x: maxX, y: maxY }; }
      else if (handleId === 'tr') { next.start = { x: minX, y: newPos.y }; next.end = { x: newPos.x, y: maxY }; }
      else if (handleId === 'br') { next.start = { x: minX, y: minY }; next.end = { x: newPos.x, y: newPos.y }; }
      else if (handleId === 'bl') { next.start = { x: newPos.x, y: minY }; next.end = { x: maxX, y: newPos.y }; }
      break;
    }
    case 'circle':
      if (handleId === 'center') {
        const dx = newPos.x - shape.start.x;
        const dy = newPos.y - shape.start.y;
        next.start = { ...newPos };
        next.end = { x: shape.end.x + dx, y: shape.end.y + dy };
      } else if (handleId === 'edge') {
        next.end = { ...newPos };
      }
      break;
    case 'angle':
      if (handleId === 'p1') next.p1 = { ...newPos };
      else if (handleId === 'p2') next.p2 = { ...newPos };
      else if (handleId === 'p3') next.p3 = { ...newPos };
      break;
    case 'free':
      if (handleId === 'move' && shape.points?.length) {
        const n = shape.points.length;
        const oldCx = shape.points.reduce((s, p) => s + p.x, 0) / n;
        const oldCy = shape.points.reduce((s, p) => s + p.y, 0) / n;
        const dx = newPos.x - oldCx;
        const dy = newPos.y - oldCy;
        next.points = shape.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
      }
      break;
    default:
      break;
  }
  return next;
}
