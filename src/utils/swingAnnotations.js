// How checkpoints and drawings are stored with a saved swing, and how they're
// copied onto a different video (another swing or a named template).

export const serializeMarkers = (markers = []) => markers.map(({ index, time }) => ({ index, time }));

// Drawings are kept in normalized video coordinates; the pane-specific source
// id is dropped because it's a blob URL that won't exist next session.
export const serializeDrawings = (shapes = []) => shapes.map(({ sourceId: _sourceId, ...shape }) => shape);

/**
 * Drawings ready to go onto a different video. IDs are dropped so the copies
 * get fresh ones. A drawing tied to a moment in the original video (one frame
 * or a time range) means nothing on another clip, so it shows for the whole
 * swing instead; P-position ranges carry over, since they follow the new
 * clip's own markers.
 */
export function portableDrawings(drawings = []) {
  let converted = 0;
  const out = drawings.map(({ id: _id, sourceId: _sourceId, ...shape }) => {
    const kind = shape.visibility?.kind;
    if (kind === 'frame' || kind === 'range') {
      converted += 1;
      return { ...shape, visibility: { kind: 'all' } };
    }
    return shape;
  });
  return { drawings: out, convertedToWholeSwing: converted };
}

/** Insert or replace a template by name (case-insensitive). */
export function upsertTemplate(templates, template, { replace = false } = {}) {
  const key = template.name.trim().toLowerCase();
  const index = templates.findIndex((t) => t.name.trim().toLowerCase() === key);
  if (index >= 0 && !replace) throw new Error(`A template named "${templates[index].name}" already exists. Pass replace: true to overwrite it.`);
  const next = templates.slice();
  if (index >= 0) next[index] = template;
  else next.push(template);
  return next;
}

export function findTemplate(templates, name) {
  const key = name.trim().toLowerCase();
  const template = templates.find((t) => t.name.trim().toLowerCase() === key);
  if (!template) {
    const names = templates.map((t) => t.name);
    throw new Error(names.length ? `No template named "${name}". Saved templates: ${names.join(', ')}.` : `No template named "${name}". No templates are saved yet; use save_template.`);
  }
  return template;
}
