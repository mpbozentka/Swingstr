# Swing Position Markers (P1–P10) — Implementation Spec

Follow-up spec, written 2026-07-11 after Mitch tested Phase 2/3 of the
MediaPipe pose work (`mediapipe_implementation_plan.md`) and asked for four
changes to the existing marker system and the angle graph. This is a
separate feature area from the pose plan — the marker system predates the
pose work — but it touches `SwingGraphPanel.jsx`, which the pose plan built.

This document was produced through a clarifying-question pass with Mitch;
his answers are baked into the decisions below, not left open. If you hit a
spot where the code doesn't match what's described here, stop and ask rather
than improvising — same rule as the pose plan.

**Do not start until Mitch tells you to.** This doc is a handoff artifact,
not a go-ahead.

---

## 0. The four changes, in one line each

1. Rename the 10 marker slots from descriptive names (Address, Takeaway, …)
   to the standard golf **P-system**: P1–P10.
2. Replace `Shift+digit` (set marker) with a true **P+digit** key chord;
   add a new **P+arrow** chord to step between set markers.
3. Draw a vertical line on the angle graph at each marker's time, with
   **P1 / P4 / P7** (Address / Top / Impact) visually called out.
4. In split-screen, let Mitch choose between **two independent graphs**
   (one per pane, own metric, own axis — for comparing e.g. a DTL clip
   against a FO clip) or a **linked comparison** (today's existing
   normalized overlay — for before/after clips of the same view).

---

## 1. Codebase context — what already exists

Don't rebuild any of this; it's already there and working.

- **`src/constants/markers.js`** — exports `DEFAULT_MARKER_LABELS`, an array
  of 10 strings. `MarkerBar` and `useMarkers` both key off array index
  (0–9), not the label text, so relabeling is just swapping the array
  contents.
- **`src/hooks/useMarkers.js`** — per-side marker state:
  `markers = { left: [], right: [] }`, each entry
  `{ id, index, time, label }`. Exposes `setMarker(side, index, time)`,
  `removeMarker(side, index)`, `jumpTo(side, index)`,
  `jumpRelative(side, direction)` (already does prev/next-by-time — it's
  just not wired to a keyboard shortcut yet, only to `MarkerBar`'s chevron
  buttons).
- **`src/components/MarkerBar.jsx`** — the timeline-row UI: prev/next
  chevrons, the marker diamonds, and a "set marker" dropdown listing all 10
  slots. Each dropdown row currently shows a leading index number
  (`i === 9 ? '0' : i + 1`) next to the label text — this becomes redundant
  once the label itself is "P1" etc. (see §2). Footer tip text at line ~137
  currently reads "Shift+1-0 to set, 1-0 to jump" — needs updating (§3).
- **`src/App.jsx`** — owns the global keydown handler (~line 330–368,
  inside a `useEffect`). Currently: plain arrows = frame-step seek
  (±0.05s, responds to key repeat), space = play/pause, `Shift+digit` =
  set marker at `globalTime` on `activeScreen`, plain `digit` = jump to
  that marker. Markers are wired in via `handleSetMarker`, `jumpToMarker`,
  `jumpRelativeMarker` (destructured from `useMarkers()` around line
  111–115). `markers` (the full `{left, right}` object) is already passed
  down to `AnalyzerView` as a prop (line 440) — no new plumbing needed
  there for §4's marker-line drawing.
- **`src/components/SwingGraphPanel.jsx`** — built in the pose-plan Phase
  3 work. Renders one `<svg>` chart. When both panes are analyzed with a
  matching `viewType`, it already does a "dual" overlay: two traces (sky =
  left, purple = right), both normalized to 0–100% of their own trim so
  differently-timed swings align — this is exactly what §4 calls "Linked"
  mode below; it already exists, it just needs a marker-lines layer and to
  be gated behind an explicit toggle instead of being automatic. When the
  panes don't share a view type (or only one is analyzed), it currently
  falls back to showing **only the active pane's** graph — this is the
  behavior Mitch flagged as the problem: "it currently changes the graph
  depending on which video is selected."
  - Key internals to reuse: `niceTicks(min, max)`, `buildPath(points,
    xOfT, yOf)` (pen-lifts at detection gaps), the `series` builder
    (per-side `{ side, t0, t1, points }`), `fracOfT(s, t)` (per-series
    time→0..1 fraction), `xOfFrac(frac)`, `MARGIN`, `PLOT_HEIGHT`.
- **`src/utils/swingAngles.js`** — `computeMetricValue`, `GRAPH_METRICS`
  (per view type). Not touched by this spec.

---

## 2. Rename marker slots to the P-system

Mitch confirmed: use the **actual standard P-system**, not a straight
reorder of the current descriptive labels. In practice this is simpler
than it sounds — the label becomes the literal string `"P1"`…`"P10"`,
nothing more:

```js
// src/constants/markers.js
export const DEFAULT_MARKER_LABELS = Object.freeze([
  'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10',
]);
```

Because the 10 slots are just chronological, user-set checkpoints (nothing
in the code enforces what "should" happen at slot 7 — Mitch sets it
himself wherever he scrubs to), this is a pure text swap. Slot order
doesn't change. What changes is that "P7" now unambiguously means Impact
in Mitch's own vocabulary, and he'll set it there himself — no reordering
of the underlying array needed.

Also update, since the label now already says "P1":

- **`MarkerBar.jsx`** dropdown rows (~line 111): drop the separate leading
  index-number span (`{i === 9 ? '0' : i + 1}`) — it's now redundant with
  the label text itself. Keep everything else (existing-time suffix,
  remove button) as-is.
- The JSDoc comment above `DEFAULT_MARKER_LABELS` — update it to say what
  the array actually is now (10 P-system slots), not "descriptive labels."
- If `src/types.js` has a `Marker` typedef with example label strings in
  its comment, update those too (quick grep, not a functional change).

Do not touch `useMarkers.js` or the marker-setting logic — index-based
storage doesn't change at all.

---

## 3. Keyboard shortcuts: P+digit and P+arrow

Mitch confirmed:
- **True simultaneous key-hold** (not sequential) — must physically hold P
  down while pressing the digit/arrow.
- **P+digit replaces `Shift+digit` entirely** — the old shortcut stops
  working.
- Plain digit-alone (jump to marker) is unchanged.
- Plain arrow-alone (0.05s frame step) is unchanged when P is *not* held.

### The tricky part: there's no native "is P held" flag

Unlike Shift/Ctrl/Alt/Meta, browsers don't expose a modifier flag for
letter keys — you have to track it by hand with keydown/keyup. This is new
plumbing (no `keyup` listener exists anywhere in `App.jsx` today).

```js
// Tracks whether P is currently physically held — no native modifier flag
// exists for letter keys, so this is tracked by hand. Reset on keyup AND
// on window blur: if the tab loses focus while P is physically down (e.g.
// alt-tab), the keyup event never fires, and without the blur reset this
// would get stuck "true" forever, silently turning every future digit
// press into a "set marker" until the user taps P again to toggle it off.
const pHeldRef = useRef(false);

useEffect(() => {
  const handleKeyUp = (e) => {
    if (e.code === 'KeyP') pHeldRef.current = false;
  };
  const handleBlur = () => { pHeldRef.current = false; };
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('blur', handleBlur);
  return () => {
    window.removeEventListener('keyup', handleKeyUp);
    window.removeEventListener('blur', handleBlur);
  };
}, []);
```

Then inside the existing `handleKeyDown` (same `isTextish` early-return
guard applies — don't fire any of this while a text input/textarea is
focused):

```js
if (e.code === 'KeyP') {
  pHeldRef.current = true; // a lone P does nothing on its own — no preventDefault
  return;
}

if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
  const dir = e.key === 'ArrowRight' ? 1 : -1;
  if (pHeldRef.current) {
    if (e.repeat) return; // one marker per press — do NOT let this repeat-fire
    e.preventDefault();
    jumpRelativeMarker(activeScreen, dir);
    return;
  }
  e.preventDefault();
  seek(dir * 0.05);
  return;
}

if (e.key === ' ') {
  e.preventDefault();
  if (!e.repeat) togglePlay();
  return;
}

if (e.repeat) return; // blocks setting/jumping on auto-repeat (unchanged)

const pDigit = pHeldRef.current && e.code?.match(/^Digit([0-9])$/);
const digitMatch = e.key.match(/^[0-9]$/);
if (pDigit) {
  const keyIndex = pDigit[1] === '0' ? 9 : parseInt(pDigit[1], 10) - 1;
  e.preventDefault();
  handleSetMarker(activeScreen, keyIndex, globalTime);
} else if (digitMatch && !e.metaKey && !e.altKey && !e.ctrlKey && !e.shiftKey) {
  const keyIndex = e.key === '0' ? 9 : parseInt(e.key, 10) - 1;
  e.preventDefault();
  jumpToMarker(activeScreen, keyIndex);
}
```

This fully replaces the old `shiftDigit` block — delete it, don't leave it
dead-code alongside the new logic. Add `jumpRelativeMarker` to the
`useEffect`'s dependency array (it's already destructured from
`useMarkers()` in `App.jsx`, just not currently used in this handler).

**Why P+arrow needs its own repeat guard but plain-arrow doesn't:**
plain-arrow frame-stepping is *supposed* to rapid-fire while held (that's
how scrubbing-by-holding works). P+arrow jumping between markers is a
single discrete action — if it repeat-fired the same way, holding the
combo for half a second could blow past five markers instead of stepping
to one.

Update `MarkerBar.jsx`'s footer tip text (~line 137) from
`"Shift+1-0 to set, 1-0 to jump"` to something like
`"Hold P + 1-0 to set, 1-0 to jump, P + ←/→ to step markers"`.

---

## 4. Marker lines on the angle graph

Add a constant marking which slots get visually called out:

```js
// src/constants/markers.js
// 0-based indices of the checkpoints worth calling out on the angle graph:
// Address, Top of backswing, Impact — the three positions golf instruction
// references most. Matches P1 / P4 / P7 in the standard P-system.
export const KEY_MARKER_INDICES = new Set([0, 3, 6]);
```

Mitch's call on styling: **no text labels** on the graph (too busy at 120px
tall with up to 10 markers) — instead, P1/P4/P7 get a distinct color/weight
and the other 7 stay as plain neutral ticks.

Per marker `m` in a side's `markers[side]` array, for that side's graph
(see §5 for which graph(s) that means), map `m.time` through that graph's
own `fracOfT`/`xOfFrac` (same functions already used for the trace and
playhead — marker `.time` and pose-frame `.t` are both raw video
`currentTime` seconds, same domain, no conversion needed) and draw a
vertical line spanning the plot height:

- Non-key markers (7 of the 10): thin (`strokeWidth 1`), neutral —
  reuse `TICK_COLOR` (`#6b7280`, already defined in the file) so it doesn't
  compete with the trace colors.
- Key markers (P1/P4/P7): thicker (`strokeWidth 2`) and a distinct accent
  — suggest `#fb7185` (rose-400): it doesn't collide with the existing
  sky/purple trace colors, the amber "sync" accent, or the emerald "trim"
  accent used elsewhere in the app. Extend these lines a few px above and
  below the plot box (e.g. `MARGIN.top - 4` to `MARGIN.top + plotH + 4`) so
  they read as distinct even next to a non-key tick. If the `dataviz`
  skill's palette validator is available, run the new color through it
  before committing to the exact hex — the existing sky/purple trace pair
  in this file has a comment noting it was validated that way; match the
  practice.

**Which side's markers to draw, per mode:**
- **Independent** graphs (§5): each graph is already scoped to one side —
  draw that side's own markers, no ambiguity.
- **Linked** overlay (one shared chart, two traces): draw only the
  **active pane's** markers, consistent with how the existing playhead
  line already only tracks the active pane's series (`phSeries` in the
  current code). Drawing both sides' marker sets on one shared chart (up to
  20 lines) would be unreadable; this keeps the annotation layer legible
  while the two traces still carry the actual comparison.

---

## 5. Split-screen: Independent vs. Linked graphs

Mitch confirmed: build **both**, as a toggle. His use case for each:
- **Independent** — e.g. one pane is a face-on clip, the other down-the-
  line; different metrics entirely, no reason to force them onto one axis.
- **Linked** — e.g. before/after clips of the *same* view, where seeing
  the two traces normalized and overlaid is the point.

### Toggle visibility and default

Only relevant when `layout === 'split'` and both sides are "eligible"
(analysis done, ≥2 frames, view type tagged — this is exactly the existing
`eligible` array already computed in the file). If only one side is
eligible, or `layout === 'single'`, nothing changes — same single-graph
behavior as today, no toggle shown.

When both are eligible:
- If `viewTypes.left !== viewTypes.right`, **Linked isn't meaningful** —
  don't show the toggle at all, just render Independent mode. (The
  existing `GRAPH_METRICS` lookup is per-view-type; a shared metric picker
  across two different view types would either break or need a separate
  "shared metrics only" list — out of scope, not what Mitch asked for.)
- If `viewTypes.left === viewTypes.right`, show a small segmented toggle
  ("Independent" / "Linked") in the panel header. **Default to Linked** —
  that's the existing behavior Mitch already tested and liked; don't
  change the out-of-the-box appearance for a case that already works,
  just make Independent available as a click away.

```js
const canLink = viewTypes.left === viewTypes.right;
const [splitModePref, setSplitModePref] = useState('linked');
const splitMode = canLink ? splitModePref : 'independent';
```

### Rendering

**Recommended refactor:** pull the existing "single graph for one side"
rendering (metric-picker pill row, the `<svg>` chart itself, the live
readout value) out into an inner component — e.g. `GraphColumn({ side,
metricKey, onMetricChange, poseState, trims, markers, activeScreen,
globalTime, globalDuration, onSeek })`. This is very close to what the
current "not dual" fallback path already renders for a single side; the
refactor just makes it reusable instead of hardcoded to one side.

- **Linked mode:** unchanged from today — the existing dual-overlay chart
  (one `<svg>`, two normalized traces, shared metric picker), plus the new
  marker-lines layer from §4 (active-pane markers only).
- **Independent mode:** render **two** `<GraphColumn>` instances in a
  `flex` row (mirroring the video panes' own side-by-side layout in
  `<main>`), each `flex-1` so a graph sits directly under its own video
  pane. Each column needs its **own** metric-picker state — replace the
  single `metricKey` state with something like
  `metricKeys = { left: null, right: null }`, one column reading/writing
  its own slot. Each column's chart uses the same full-duration,
  trim-shaded X axis that today's single-pane case already uses (not the
  0–100%-normalized axis — that normalization only makes sense when
  comparing two traces on one shared chart).

Everything else — collapse/expand chevron, the panel's outer container —
stays a single shared control for the whole panel; don't make Independent
mode have two separate collapse buttons.

---

## 6. Suggested build order

Not a hard requirement, but a sane sequence to test incrementally rather
than as one giant diff:

1. §2 label rename (trivial, ~5 min, no behavior change to verify beyond
   "the labels now say P1–P10 everywhere").
2. §3 keyboard chords (self-contained in `App.jsx` + the `MarkerBar` tip
   text) — test P+digit and P+arrow thoroughly before moving on; this is
   the part most likely to have edge cases (stuck `pHeldRef`, repeat
   firing, focus-loss).
3. §4 marker lines on the graph (needs `markers` threaded into
   `SwingGraphPanel` — one new prop, already available in `AnalyzerView`).
4. §5 Independent/Linked toggle — the biggest structural change, do it
   last once the simpler pieces are proven.

## 7. Acceptance checklist

- MarkerBar dropdown shows "P1" … "P10" with no redundant leading number.
- Holding P and pressing 1–9/0 sets that P-slot at the current time on the
  active pane; releasing P and pressing a bare digit still jumps to that
  slot; `Shift+digit` no longer does anything.
- Holding P and tapping → / ← steps to the next/previous *set* marker on
  the active pane; a single tap moves one marker regardless of how long P
  is held afterward; holding both down does not rapid-fire through markers.
- Alt-tabbing away while physically holding P, then coming back and
  pressing a bare digit, jumps (doesn't accidentally set) — confirms the
  blur reset works.
- Angle graph shows a vertical line per set marker; P1/P4/P7 are visually
  distinct from the other 7; no text labels on the lines.
- Split-screen, both panes analyzed with the **same** view type: toggle
  appears, defaults to Linked (today's existing overlay behavior,
  unchanged), switching to Independent shows two separate full-width-under-
  each-pane graphs with independent metric pickers.
- Split-screen, panes analyzed with **different** view types: no toggle
  shown, two independent graphs render directly.
- Single-pane layout, or only one side analyzed: no toggle, no change from
  current behavior.
- `npm run lint` (no NEW errors beyond the pre-existing two in
  `DrivePickerModal.jsx`/`EditStudentModal.jsx`) and `npm run build` pass.

## 8. Process notes

Same standing rules as always: new branch, stage but don't commit until
Mitch tests and confirms, explain changes in plain English (what the
shortcuts do and what to click — not code mechanics), don't expand scope
beyond what's written here. If something here turns out to conflict with
the actual code once you're in it, stop and say so rather than
improvising a fix.
