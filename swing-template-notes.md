# Swing template skill — running notes

Mitchell's instructions for drawing analysis templates in Swingstr. These notes
become a skill once the template is complete.

## General

- Views: face-on (started 2026-11-02). Down-the-line: not covered yet.
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
- **Camera reference marks** (yellow `#ffdd00`, width 3, whole swing, kept
  apart from the red analysis lines):
  1. **Ball circle:** a small circle around the ball at address
     (center (0.497, 0.703), radius about 0.015 of the width). If the ball
     moves out of the circle before impact, the camera moved.
  2. **Background mark:** a short vertical line on a fixed object in the
     background, here the middle flagstick on the putting green
     (x 0.329, y 0.464–0.496). It still works after impact, when the ball is
     gone. Pick something sharp and still: a flagstick, post or building
     edge, not trees or clouds.
- **Correcting for drift:** when reading a position, measure how far the
  references moved from address (Δx, Δy). Subtract that from what the golfer
  appears to do against the analysis lines before judging. Example: if the
  references shifted 14px toward the trail side of the screen and the head
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

### P2, P3, P5–P10

Not given yet.
