# Swing template skill — running notes

Mitchell's instructions for drawing analysis templates in Swingstr. These notes
become a skill once the template is complete.

## General

- Views: face-on (started 2026-11-02). Down-the-line: P1–P10 bookmarks only
  (2026-11-02); no lines yet.
- Club: iron (started here). Driver and wedges: not covered yet.
- Default style: red `#ff3333`, width 3 (what Mitchell used).
- **Every line shows for the entire swing** (`visibility: {kind: "all"}`).
  Never limit a line to one frame or position, and don't ask. Mitchell will
  say when he wants a line hidden. When he draws lines himself, Swingstr may
  save them as single-frame; switch them to "all" without asking.

## Face-on, iron

### P1: Address

Mitchell drew three lines:

1. **Ball line.** A vertical line from the golf ball straight up past the head.
   - **What it checks:** with an iron, the line should go up through roughly
     the lead ear, give or take.
2. **Lead thigh line.** Along the outside of the lead thigh. It follows the
   thigh's angle, so it does not have to be vertical.
   - **What it checks:** nothing yet. It is a starting reference.
3. **Trail thigh line.** Along the outside of the trail thigh, following the
   thigh's angle.
   - **What it checks:** nothing yet. It is a starting reference.
4. **Head height line.** A short horizontal line along the top of the head.
   - **What it checks:** vertical head motion through the swing (head
     dropping or rising compared with address).

Example placement on a 1080×1920 portrait video, in normalized coordinates:

- Ball line: `vline`, x 0.497, from y 0.705 up to y 0.303.
- Lead thigh: `line` from (0.538, 0.462) to (0.564, 0.539). In this video the
  lead side is on the right of the screen.
- Trail thigh: `line` from (0.393, 0.466) to (0.388, 0.535).
- Head height: `line` from (0.418, 0.328) to (0.492, 0.328), touching the top
  of the hair and spanning roughly the head's width.

What the example swing showed: the ball line ran at the lead ear, so the ball
position was correct.

## P1–P10 bookmarks (all videos)

Set Swingstr checkpoint markers on P1–P10 for every swing (`set_marker`).
Find each frame by scanning the video with `playback seek` + `get_frame`, then
narrow down to the exact frame around fast moments (impact). Videos may be
slow motion, so don't assume real-time timing.

| P | Position | How to find it face-on |
|---|---|---|
| P1 | Address | Golfer set over the ball before the takeaway starts |
| P2 | Takeaway, shaft parallel | Shaft horizontal, clubhead toward the trail side |
| P3 | Lead arm parallel (backswing) | Lead arm horizontal across the chest |
| P4 | Top | Club at its furthest back, just before it changes direction |
| P5 | Lead arm parallel (downswing) | Lead arm horizontal on the way down |
| P6 | Shaft parallel (downswing) | Shaft horizontal, hands around the trail thigh |
| P7 | Impact | Clubhead at the ball; ball just starting to leave |
| P8 | Shaft parallel (follow-through) | Shaft horizontal toward the target side |
| P9 | Trail arm parallel (follow-through) | Trail arm horizontal, club pointing up |
| P10 | Finish | Final held position |

Example (2026-11-02 swing, 60 fps slow motion), after Mitchell's corrections:
P1 0.00s, P2 2.80 → 1–2 frames later, P3 4.10 (I had 3.70), P4 5.50, P5 6.20,
P6 6.40 → 1 frame earlier, P7 6.583, P8 6.85 → 1 frame later, P9 7.067,
P10 8.283.
Mitchell's adjusted P2, P6 and P8 show different frames in Swingstr, but the
marker times reported to Claude (`get_state`, `seek_position`) still read
2.80, 6.40 and 6.85. Mitchell's on-screen frame is the truth. The time Claude
reads back may not reflect a nudge of a frame or so; possibly a Swingstr bug
worth checking later.

### Mitchell's corrections to my first pass (learn from these)

- **P3 was badly off.** I picked a frame where the lead arm still pointed
  down about 20–25° (3.70s). True P3 (4.10s) has the lead arm horizontal from
  shoulder to hands, with the shaft hinged up close to vertical. Judge the
  **arm line from shoulder to hands**, not the club or general look. If the
  hands are clearly below the lead shoulder, it isn't P3 yet.
- **Parallel positions (P2, P6, P8) need frame-by-frame checking.** I was a
  frame or two off on all three. P2 was early, P6 late and P8 early. Step one
  frame at a time (60 fps = 0.0167s) around each position and pick the frame
  where the shaft is closest to horizontal. Don't stop at the first frame that
  looks roughly right.
- In general, check every P position frame by frame before setting it, not
  just impact.
- **P4 with an active transition** (Rory, 2026-11-02): some golfers start
  the downswing by lowering the body a lot while the hands look still at the
  top. The hands staying put does not mean the downswing hasn't started. Watch
  for the body starting to drop and set P4 before it; when unsure, go earlier.
  I was late on P4 in both views (face-on by about 7 frames at 43.8 fps).

Swingstr note: after a `playback seek`, `get_state`'s frame time can show the
previous frame. Trust the time in `get_frame`'s response.

## Camera movement check (all videos)

Mitchell films handheld on his phone, so the camera drifts a little during the
swing. Camera movement must never be read as golfer movement.

- **Main check:** compare the ball line with the golf ball through the swing.
  The ball doesn't move until impact, so if the ball moves against the line,
  the camera moved. In the 2026-11-02 example, at the top (5.42s) the ball line
  sat in front of the ball (toward the target): the ball was about 14px left
  and 17px higher than at address, so the camera had moved.
- **Camera reference: the ball only** (Mitchell, 2026-11-02, both views).
  Don't add a background mark.
  - **Ball circle:** a small yellow circle (`#ffdd00`, width 3, whole swing,
    kept apart from the red analysis lines) around the ball at address. In
    the face-on example: center (0.497, 0.703), radius about 0.015 of the
    width. If the ball moves out of the circle before impact, the camera
    moved.
- **Correcting for drift:** when reading a position, measure how far the ball
  moved from the circle (Δx, Δy). Subtract that from what the golfer
  appears to do against the analysis lines before judging. Example: if the
  ball shifted 14px toward the trail side of the screen and the head
  also looks 14px toward the trail side of the ball line, the head didn't
  actually move.
  Report the camera drift along with the finding.

### P4: Top of the backswing

Read these against the P1 lines, after subtracting camera drift:

- **Head height (head line):** the head should stay fairly steady, neither
  rising nor dropping against the head line.
- **Head side to side (ball line):** the head may move slightly away from the
  target (toward the trail side). That's acceptable.
- **Trail thigh line:** the trail thigh must **not** slide into and past the
  line. If it goes past, the golfer has swayed the hips away from the target.
  This is a fault.
- **Lead thigh line:** the lead thigh can move away from its line (toward the
  trail side). That's acceptable.
- **Trail foot and ankle (sway check, look every time):** compare the trail
  shoe at P4 with P1. If the **bottom of the shoe shows at the toes/instep**
  where it was flat at address, and the **ankle has rolled pressure onto the
  outside of the trail foot**, the hips have slid away from the target. That
  is a sway even when the thigh line looks borderline. The trail shin leaning
  away from the target over the outside of the foot goes with it.
  - Crop and compare the trail foot at P1 and P4 side by side. Small details
    like the shoe sole are easy to miss on the full frame.
  - Don't let the camera correction talk me out of a sway. Drift correction
    is for the lines; the foot and ankle don't depend on camera position.

Example read (2026-11-02 swing, P4 at 5.50s): the camera had drifted about
14px toward the trail side and 17px up.
- Head top looks about 15px above the line, which is the drift, so the head
  height held. ✓
- The head moved about 6px away from the target after drift. ✓
- Trail side: **swayed. ✗** I first called it OK, because the thigh was only
  about 4px past its line after drift. Mitchell corrected me. At P4 the trail
  shoe's sole is showing at the toes and the ankle has rolled pressure to the
  outside of the foot, so the hips slid away from the target. Lesson: a
  borderline thigh-line reading plus a rolled trail foot means sway.
- The lead thigh moved away from its line. ✓ (allowed)

### P7: Impact

Mitchell's teaching philosophy (`~/Brain/golf-instruction/raw/articles/MPB-Golf-Coaching-Philosophy.md`)
starts at impact, so the template's checks start at P7 and work backward.
Every check has to connect to an impact alignment: speed, face, path,
impact point, or the ball-first check.

1. **Shaft lean (look at this first).** The shaft should lean forward by
   some amount at impact, with the handle ahead of the clubhead toward the
   target.
   - **How much:** not given yet.
   - **How to draw it:** not given yet.
   - **What it tells:** not given yet.

### P2, P3, P5, P6, P8–P10

Not given yet.

## Down-the-line: P1–P10 bookmarks

Same P1–P10 definitions as face-on, with these down-the-line adjustments from
Mitchell's corrections on 2026-11-02.

### Rules

- **P1, address:** the frame before the club moves at all. If the clubhead
  has already moved behind the ball, it's too late. In the example, Mitchell
  put P1 at the very start of the video (0.00s).
- **P2 and P6, perspective:** the camera sits higher than the hands, so the
  shaft looks flattest a few frames *after* real P2 and a frame *before* real
  P6. Don't pick the frame where the shaft looks most horizontal on screen.
  Mitchell's P2 had the clubhead outside the hands, but the shaft didn't look
  fully flat yet. That's the correct P2 look from this camera height.
- **P3:** same rule as face-on: lead arm level from shoulder to hands. I was 2
  frames early.
- **P4, top:** the last frame before the downswing starts. If the golfer is
  already pulling the club down, it's too late. I was 2–3 frames late.
- **P5:** I was 1 frame late.
- **P6:** there may be no perfect shaft-parallel frame. Pick the closest one,
  allowing for the perspective issue above.
- **P7, impact:** if no frame shows the club exactly at the ball, use **the
  frame just before contact**. My frame still had the club about a foot from
  the ball. Zoom in on the clubhead and the ball. Don't judge from the full
  frame.
- **P8 and P9:** the club and arms are mostly hidden behind the body from
  down the line, so these are hard to judge. Both of mine were too early.
  Lean later rather than earlier.
- **P10, finish:** the golfer has to have settled back down, not just reached
  the high finish. Mine was early.

- **P3 and P5, perspective:** with the camera above the hands, the lead arm
  points roughly toward the camera at P3 and P5, so a level arm shows the
  hands *below* the lead shoulder on screen. Don't wait for the hands to reach
  shoulder height. On the Rory swing (60 fps), my P3 was 12 frames late
  (hands at shoulder height) and Mitchell's was where the hands were at mid
  chest; my P5 was 6 frames early: "the hands a little too high and hadn't gotten
  low enough to be parallel to the ground." His P5 has the hands back at mid
  chest.
- **P6, when the shaft points at the camera:** on a camera behind and above
  the golfer, the shaft points straight at the lens near P6. True P6 is after
  that frame. On the Rory swing I took one frame after and was still 2 frames
  early; take about 3 frames after.

### Frame steps

In this video, Mitchell's one-frame corrections moved the marker about 0.05s,
not 1/60s. Step with Swingstr's own frame step and count frames that way.
Don't assume 0.0167s per frame.

### Example: 2026-11-02 swing, down the line

| P | Mine | Mitchell's | What he said |
|---|---|---|---|
| P1 | 1.250 | 0.000 | Not close; the club was already a foot behind the ball |
| P2 | 3.083 | 2.933 | 3–4 frames late (camera above the hands) |
| P3 | 4.117 | 4.217 | 2 frames early |
| P4 | 5.917 | 5.817 | 2–3 frames late; already forcing the club down |
| P5 | 6.668 | 6.568 | 1 frame late |
| P6 | 6.768 | 6.818 | 1 frame early; same perspective issue as P2 |
| P7 | 6.918 | 6.968 | 1 frame early; club still about a foot from the ball |
| P8 | 7.252 | 7.352 | Too early; the club is hard to see |
| P9 | 7.418 | 7.602 | Too early; can't see the arms |
| P10 | 8.285 | 8.735 | A touch early; he hadn't settled yet |

Mitchell's times were read back from Swingstr (`get_state`) after he moved
the markers.

### Camera reference mark, down the line

**Use only the ball as the reference** (Mitchell, 2026-11-02). Don't add a
background mark.

- **Ball circle:** a small circle around the ball at address, drawn at P1 in
  yellow `#ffdd00`, width 3, for the whole swing, and kept apart from the
  analysis lines. In the example: center (0.629, 0.597), radius 0.015 of the
  width.
- The ball doesn't move until impact, so any shift between the ball and the
  circle before then is the camera. Measure it on a zoomed crop.

Example drift (2026-11-02 swing):

| Moment | Ball vs. circle |
|---|---|
| P4 5.817s | about 7px right, 19px up |
| P7 6.968s | about 7px right, 21px up (clubhead just behind the ball) |

The camera tilted during the backswing and stayed there. From down the line,
a 20px vertical drift is enough to fake a head or posture change against a
head-height or spine line. Subtract it before judging any line.

## Example: Rory, 2026-11-02 (YouTube clips)

Two clips loaded side by side: face-on on the left (43.8 fps slow motion) and
down the line from behind on the right (60 fps). Mitchell: "other than that it
was pretty good." Rory has a very active transition and lowers his body a lot,
which makes P4 hard to read.

| View | P | Mine | Mitchell's | What he said |
|---|---|---|---|---|
| Face-on | P4 | 5.479 (frame 240) | 5.329 (frame 233) | A little late |
| DTL | P3 | 2.536 (frame 152) | 2.336 (frame 140) | A little late |
| DTL | P5 | 3.803 (frame 228) | 3.903 (frame 234) | Hands a little too high; the lead arm wasn't low enough to be parallel yet |
| DTL | P6 | 4.136 (frame 248) | 4.170 (frame 250) | Too early |

He also said DTL P4 (3.403, frame 204) was a little late, but that marker
was not moved.

Unchanged and accepted, face-on: P1 0.346, P2 2.513, P3 3.608, P5 6.346,
P6 6.871, P7 7.144 (clubhead just behind the ball; the ball is gone on the
next frame), P8 7.760 (club off the frame edge, estimated), P9 8.217,
P10 11.046. DTL: P1 0.786 (before a small waggle), P2 1.886, P7 4.270
(first frame with the clubhead at the ball), P8 4.553 (hidden, estimated),
P9 4.836, P10 6.103.

Swingstr marker moves by Mitchell again came in steps of about 0.05s.
