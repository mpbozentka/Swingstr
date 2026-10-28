# Swingstr project instructions

## Analysis-first interface

Keep the top video-editing bar hidden by default and available through an
explicit show/hide toggle. Swing analysis is the primary workflow; segment
editing and comparison setup should not permanently occupy the video view.
Keep drawing and playback controls available when the editing bar is hidden.
Do not overlay the drawing-scope, drawing-list, or angle-number settings bar
on the video. Mitchell requested its removal on 2026-10-27 because it
covered the analysis view.
Use bright ROYGBIV drawing presets so annotations stand out on video
(Mitchell’s preference, 2026-10-28).

## Analysis scope

Mitchell removed Practice focus and all automatic body tracking on 2026-10-14.
Keep Swingstr focused on manual video review, comparison, drawings, checkpoints,
trimming, and exports. Do not reintroduce body tracking, skeleton overlays,
automatic body measurements, or their models and runtime dependencies unless
Mitchell explicitly requests them again.

Do not commit until Mitchell confirms testing.

## Saved videos and deployment

Mitchell requires saved swing videos to be excluded from GitHub and Vercel
deployments. Keep video files and private student-library data out of source
control and deployment uploads. Verify the production bundle contains no
saved clips. Browser storage and the desktop's local Swingstr Library are
device data, not deployment inputs; do not erase that library as a deployment
cleanup step.

The deployed website must not save videos or video links to a student library,
including browser IndexedDB and localStorage. Keep library saving available
only through the desktop app's native storage API. Guard the storage functions
as well as the Save control, hide the website's student library, and preserve
existing device data. Temporary analysis and user-initiated exports remain
available on the website.
