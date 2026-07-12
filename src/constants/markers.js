/**
 * The 10 marker slots, labeled with the standard golf P-system (P1–P10).
 * Index 0..9 corresponds to keyboard shortcuts 1..9 then 0. Slots are
 * chronological, user-set checkpoints — nothing enforces what happens at a
 * given slot; the P-number is the vocabulary, not a constraint.
 */
export const DEFAULT_MARKER_LABELS = Object.freeze([
  'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10',
]);

// 0-based indices of the checkpoints worth calling out on the angle graph:
// Address, Top of backswing, Impact — the three positions golf instruction
// references most. Matches P1 / P4 / P7 in the standard P-system.
export const KEY_MARKER_INDICES = new Set([0, 3, 6]);
