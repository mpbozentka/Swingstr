/**
 * Shared shape rendering for live canvas and snapshot export.
 * Options: { zoomLevel, video?, videoRect? } — videoRect used for blur drawImage.
 */

export function calculateAngle(p1, p2, p3) {
  const angle1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  const angle2 = Math.atan2(p3.y - p1.y, p3.x - p1.x);
  let angle = (angle2 - angle1) * (180 / Math.PI);
  if (angle < 0) angle += 360;
  if (angle > 180) angle = 360 - angle;
  return Math.round(angle);
}

export function renderShape(ctx, shape, { zoomLevel, video, videoRect, blurPx = 12 }) {
  ctx.save();
  ctx.strokeStyle = shape.color;
  ctx.lineWidth = shape.width / zoomLevel;
  ctx.beginPath();

  switch (shape.type) {
    case 'line':
      ctx.moveTo(shape.start.x, shape.start.y);
      ctx.lineTo(shape.end.x, shape.end.y);
      ctx.stroke();
      break;
    case 'rect':
      ctx.strokeRect(
        shape.start.x,
        shape.start.y,
        shape.end.x - shape.start.x,
        shape.end.y - shape.start.y
      );
      break;
    case 'circle': {
      const r = Math.sqrt(
        Math.pow(shape.end.x - shape.start.x, 2) +
        Math.pow(shape.end.y - shape.start.y, 2)
      );
      ctx.beginPath();
      ctx.arc(shape.start.x, shape.start.y, r, 0, 2 * Math.PI);
      ctx.stroke();
      break;
    }
    case 'blur': {
      const cX = (shape.start.x + shape.end.x) / 2;
      const cY = (shape.start.y + shape.end.y) / 2;
      const rX = Math.abs(shape.end.x - shape.start.x) / 2;
      const rY = Math.abs(shape.end.y - shape.start.y) / 2;
      ctx.beginPath();
      ctx.ellipse(cX, cY, rX, rY, 0, 0, 2 * Math.PI);
      ctx.clip();
      ctx.filter = `blur(${blurPx}px)`;
      if (video && videoRect) {
        try {
          ctx.drawImage(
            video,
            videoRect.x,
            videoRect.y,
            videoRect.w,
            videoRect.h
          );
        } catch (e) {
          console.warn('Blur drawImage failed (e.g. CORS):', e.message);
        }
      }
      ctx.filter = 'none';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1 / zoomLevel;
      ctx.stroke();
      break;
    }
    case 'free':
      if (shape.points?.length > 0) {
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        shape.points.forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.stroke();
      }
      break;
    case 'angle':
      ctx.fillStyle = shape.color;
      ctx.beginPath();
      ctx.arc(shape.p1.x, shape.p1.y, 4 / zoomLevel, 0, Math.PI * 2);
      ctx.fill();
      if (shape.p2) {
        ctx.moveTo(shape.p1.x, shape.p1.y);
        ctx.lineTo(shape.p2.x, shape.p2.y);
      }
      if (shape.p3) {
        ctx.moveTo(shape.p1.x, shape.p1.y);
        ctx.lineTo(shape.p3.x, shape.p3.y);
      }
      ctx.stroke();
      if (shape.p2 && shape.p3) {
        const ang = calculateAngle(shape.p1, shape.p2, shape.p3);
        ctx.font = `bold ${14 / zoomLevel}px sans-serif`;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillText(`${ang}°`, shape.p1.x + 10, shape.p1.y + 20);
      }
      break;
    default:
      break;
  }

  ctx.restore();
}
