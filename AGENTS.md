# Swingstr project instructions

## Measurement roadmap

Mitchell's requested measurement categories are recorded in
`mediapipe_implementation_plan.md`, under "Requested measurement roadmap
(2026-10-01)". Use that list as the eventual measurement scope, preserving
Setup posture, Down the line, and Face on as separate groups.

Define the component, reference, checkpoint, units, confidence requirements,
and coach-selected target before implementing each metric. Keep ambiguous
labels unresolved, including the two Setup posture Hands entries. Do not
invent their intended meanings or use undocumented competitor severity scores.

The current head-position preview is a 2D estimate with manual checkpoints.
Treat requested, implemented, and validated coverage as different states.
Follow the implementation plan's testing and staging workflow; do not commit
until Mitchell confirms testing.

## Overlay stability

Mitchell reported visible overlay jitter during testing. Keep centered
temporal smoothing in the replay and measurement path, with regression
checks for jitter reduction and preservation of fast movement. Preserve raw
confidence and missing detections; do not make uncertain points appear valid
or use a trailing filter that shifts the overlay behind the swing.

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
