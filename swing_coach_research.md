# Swing Coach research for Swingstr

Researched October 1, 2026. Target: **Swing Coach - Golf**, developed by Swing Intelligence, Inc., including its Athletic Motion Golf and Danny Maude connections. This is a product research and implementation brief. Application code was not changed.

## What the product offers

Swing Coach's core experience is repeated camera capture followed by spoken feedback, without returning to the phone between swings. Advertised measurements cover setup alignment/posture; down-the-line swing plane, spine/head movement, hip depth, elbow and knee; and face-on shaft lean, release, spine tilt, shoulder, hip, head and knees. It recommends instruction from selected coaches, including Danny Maude and Shaun Webb. Promotional replay visibly shows body landmarks, club trace, target zones, timeline, position shortcuts, club type and coach portrait. These are advertised features and observed promotional UI, not a tested app session. [Official product site](https://swingintelligence.com/)

AMG's own partner page adds voice-guided camera positioning, selectable feedback areas, and red/yellow/green issue prioritization. Its roughly three-second analysis claim is a marketing claim, not an independently measured benchmark. The partner page also advertises 500 free swings; promotional eligibility was not tested. AMG confirms it is a separate company partnered with Swing Coach. [AMG product page](https://pages.athleticmotiongolf.com/swing-coach-2205), [AMG support explanation](https://help.athleticmotiongolf.com/support/solutions/articles/159000435369-what-is-the-swing-coach-app-)

The US App Store lists $14.99 monthly and $119.99 annually, iOS 18+, and version 2.3.0 dated September 14. Release notes document face-on analysis, numeric posture feedback, personalized coaching videos, pro-swing library, replay zoom, full club trace, sharing, manual club correction, dirty-lens detection, and account/swing/settings sync. Some account, sync and sharing features vary by country. The listing does not establish a complete free-versus-paid entitlement table. [US App Store listing and developer release notes](https://apps.apple.com/us/app/swing-coach-golf/id6739074629)

Danny Maude's own app link routes readers toward the App Store. His relationship is also listed on the official product site; this research does not establish that the app provides live access to Danny or a human coach. [Danny Maude app link](https://www.dannymaude.com/Swing-coach-app)

## How the analysis appears to work

The developer states ordinary feedback uses on-device computer vision and machine learning to detect body position, calculate measurements, and select feedback. It explicitly says it does not send swing videos to OpenAI, Anthropic or ElevenLabs to generate ordinary lessons. Recordings remain on the device unless features upload them; measurement/history data can reach Google Cloud even without video sync. This supports a local measurement-and-feedback architecture; exact models, thresholds, training data and measured accuracy remain undisclosed. [Developer privacy policy, sections 2 and 5](https://swingintelligence.com/privacy-policy)

Official Android development is paused over hardware limitations. The developer recommends iPhone 14 Pro/Pro Max as a camera-quality baseline and says daily feedback can operate offline, with connectivity needed for installation, updates and periodic subscription refresh. This is an important device-performance constraint for feature planning. [Official Android/device update](https://swingintelligence.com/android)

## Swingstr's starting point

Current source contains synchronized split-screen replay and adjustable sync points, manual P1-P10 markers, drawing/angle tools, trimming, exports, student profiles, notes and saved videos, plus Google Drive import. These are code-inspected capabilities, not a claim that every workflow passed a fresh runtime test. See [analyzer source](/Users/mitchellbozentka/Projects/golf/Swingstr/src/components/AnalyzerView.jsx), [marker definitions](/Users/mitchellbozentka/Projects/golf/Swingstr/src/constants/markers.js), [student library](/Users/mitchellbozentka/Projects/golf/Swingstr/src/components/StudentLibrary.jsx), and [Drive hook](/Users/mitchellbozentka/Projects/golf/Swingstr/src/hooks/useGoogleDrive.js).

The current application and dependency manifest do not contain a working pose-analysis pipeline, live practice camera flow, automatic swing capture or spoken coaching feedback. The older `mediapipe_implementation_plan.md` must not be treated as proof those features shipped. [Current package manifest](/Users/mitchellbozentka/Projects/golf/Swingstr/package.json)

## Recommended build order

| Priority | Deliverable | Completion evidence |
| --- | --- | --- |
| 1 | Uploaded-video body tracking, manually confirmed swing positions, coach-selected focus and target | Stable overlay on representative phone recordings; saved results survive reopening |
| 2 | One measurement card, target zone, brief spoken result and Mitchell's matching drill | Measurement matches reviewed frames; spoken cue accurately reflects it |
| 3 | Practice session history and comparison to each student's baseline | Repeated swings show their measurements with camera/setup context |
| 4 | Live camera setup, automatic swing segmentation and repeated audio feedback | Each swing captured once; low-confidence captures trigger a retry; latency measured |
| 5 | Clubhead/shaft tracking and club-dependent measurements | Separate detector validated on held-out swings across clubs and lighting |

Start with a desktop upload workflow because Swingstr already accepts video. A hands-free range experience also needs a camera capture path, likely a phone companion or browser capture workflow. Desktop analysis alone does not deliver that experience.

For the first prototype, use one camera-specific body measurement that Mitchell can manually label and explain, such as visible head displacement normalized to body size. Store the camera view, selected position, measurement, confidence and coach-set target alongside the clip. Support manual corrections. Keep unavailable or uncertain readings out of the spoken result.

Coach-set student targets are the practical advantage: Mitchell chooses the movement to monitor and the appropriate range for that student. A colored zone can then represent that actual lesson goal. A generic tour-player ideal should not silently determine whether a student's movement is acceptable.

## Feasibility and validation

Google's MediaPipe Pose Landmarker supports image/video body tracking with 33 landmarks. Its estimated 3D output is not laboratory ground truth, and its landmark list does not contain a golf club. JavaScript detection blocks the calling thread, so a worker is recommended for responsive UI. Body tracking is a plausible prototype foundation; club tracking is a separate problem. [Official web implementation documentation](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js), [landmark model documentation](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker)

Validate with consented Swingstr/student recordings and Mitchell's manual labels. Reserve clips that were not used to tune thresholds. Include both camera views, handedness, different clothing/backgrounds, partial swings, occlusion and low light. Compare landmark placement, position timing, measurement error and feedback correctness. For live practice, separately count missed/duplicate captures and measure swing-completion-to-audio latency.

Require a confidence cutoff and reviewable evidence frame before any automatic coaching claim. A pose overlay is insufficient evidence for accurate shaft lean, clubface direction, impact point or ball flight. Session changes also do not establish retained improvement. The next concrete step is an uploaded-video prototype with one manually validated body measurement, a student-specific target and spoken feedback.


## YouTube walkthroughs: UX evidence

Added October 1, 2026. Read five complete English auto-generated transcripts, approximately 41 minutes of video, and inspected selected demonstration frames. Captions can mishear app speech. Videos show versions available when filmed; they do not establish every screen in the current release. This is evidence from demonstrations, not hands-on testing of the installed app.

### Videos read

| Video | Channel | Approximate length | Useful evidence |
| --- | --- | --- | --- |
| [This AI Golf Swing App Is the Fastest Way We’ve Seen to Improve Your Swing](https://www.youtube.com/watch?v=Do05z9G-ev4) | Meandmygolf | 7:05 | Selecting feedback, camera guidance, replay and drill shortcut |
| [This is the Best Golf Swing Practice App (It’s Not Even Close)](https://www.youtube.com/watch?v=OwKl1QgyXzU) | Athletic Motion Golf | 8:33 | Repeated capture, alignment corrections and rehearsal swings |
| [This App Analyzes Your Swing and Builds Your Own Practice Plan (AMG Approved!)](https://www.youtube.com/watch?v=LKyyzp1W6Zk) | Athletic Motion Golf | 10:13 | Report structure and coach-led progression |
| [This AI Golf Swing APP Is The Fastest Way I've Seen To Improve Your Swing](https://www.youtube.com/watch?v=2nqdNYaHWY8) | Danny Maude | 10:29 | Multiple spoken checkpoints and issue-specific instruction |
| [A Golf Coach At Home? I Tried This... and You Won't Believe What Happened!](https://www.youtube.com/watch?v=wQ4HimLDM3I) | A Study in Golf | 4:57 | Selective audio and sensitivity to camera alignment |

### Screen and interaction map

| Screen or state | Demonstrated interaction | Evidence |
| --- | --- | --- |
| Feedback selection | Choose camera view, component and swing checkpoint. The visible settings panel uses grouped buttons, including setup, club release, spine tilt and shoulder. | [Meandmygolf, 1:10–1:23](https://www.youtube.com/watch?v=Do05z9G-ev4&t=70s); panel visually inspected at 1:13 |
| Camera positioning | Silhouette/arrow guidance and spoken positioning, then a ready cue. | [Meandmygolf, 1:30–1:51](https://www.youtube.com/watch?v=Do05z9G-ev4&t=90s) |
| Practice loop | Subsequent swings receive feedback without repeated record-button taps; positioning can be checked again after the golfer moves. | [AMG, 3:15–3:53 and 6:15–6:27](https://www.youtube.com/watch?v=OwKl1QgyXzU&t=195s) |
| Audio result | Component, checkpoint, direction and severity; an acceptable result gets a brief confirmation. | [AMG, 3:48–5:37](https://www.youtube.com/watch?v=OwKl1QgyXzU&t=228s) |
| Replay | Video remains primary, with a translucent plane band, tracking points, directional result, timeline and phase shortcuts. | [Meandmygolf, 2:45–3:06](https://www.youtube.com/watch?v=Do05z9G-ev4&t=165s); replay visually inspected at 2:55 |
| Coaching shortcut | Tap the coach portrait in the replay corner to open instruction for the detected issue. | [Meandmygolf, 2:56–3:13](https://www.youtube.com/watch?v=Do05z9G-ev4&t=176s) |
| Detailed report | Scroll grouped components with phase-by-phase rows and green/yellow/red status. The inspected report includes setup, swing plane and hand path. | [AMG report, 0:23–1:42](https://www.youtube.com/watch?v=LKyyzp1W6Zk&t=23s); report visually inspected at 0:35 |
| Drill, then retest | Issue-specific instruction leads back to rehearsal and normal swings; multiple selected checkpoints can be spoken after one swing. | [Danny Maude, 3:07–3:29 and 6:14–6:21](https://www.youtube.com/watch?v=2nqdNYaHWY8&t=187s) |

The demonstrated severity scale is 1–10 for deviation outside a target zone, rather than degrees. Lower deviations are closer; opposite directions are explicitly named. This research does not establish the mathematical conversion, zone widths or color cutoffs. [Meandmygolf, 2:14–2:44](https://www.youtube.com/watch?v=Do05z9G-ev4&t=134s)

The user review distinguishes broad tracking from selected spoken feedback: the golfer can isolate a component such as the trail elbow. Its alignment demonstration reports different results when the player changes aim relative to the camera. This supports a camera/setup dependency; it is not a controlled accuracy experiment. [A Study in Golf, 1:56–2:34 and 3:01–3:50](https://www.youtube.com/watch?v=wQ4HimLDM3I&t=116s)

AMG discusses choosing an earlier movement to work on and observing later checkpoints, rather than forcing every yellow result to green. That prioritization comes from the coaches in this demonstration; it does not prove the app automatically identifies causal chains. [AMG report, 1:49–2:18 and 8:20–9:40](https://www.youtube.com/watch?v=LKyyzp1W6Zk&t=109s)

### What to reproduce in Swingstr

The interaction design should keep four questions easy to answer: What am I practicing? Am I positioned correctly? What happened on that swing? What should I try next?

A proposed first experience is:

1. Select the student, camera view and one practice checkpoint.
2. Confirm a usable frame and position, with a clear explanation when measurement is unavailable.
3. Show the swing with one result card and a visible target region.
4. Speak the selected result briefly. Keep other measurements available in a separate report.
5. Open Mitchell's drill from that result and return to the same practice focus.
6. Save the result with the clip, then compare the next attempt against it.

This is a proposed Swingstr flow, not a claim about the competitor's exact navigation. Its first version can work on uploaded clips. Continuous capture needs a later camera workflow.

Preserve the distinction between movement measurement and coaching judgment. A selected practice target should not cause unrelated measurements to interrupt the golfer. The audio vocabulary should identify the actual component and position; the numeric scale needs its own documented calibration before we adopt it.

Student-specific targets remain a proposed adaptation. The videos discuss reference zones and selected feedback; they do not establish that golfers can edit the underlying numeric target boundaries. Do not present custom boundaries as verified competitor functionality.

Rehearsal, drill and normal-shot labels could make comparisons more useful, but these are proposed additions. The demonstrations show those different attempts; they do not establish automatic attempt classification in the app.

### Remaining UX gaps

The videos do not establish the exact onboarding/account flow, every preset, the current navigation hierarchy, report-row tap behavior, import limitations, free-tier gates, interrupted-capture recovery or low-confidence UI. Before claiming a complete replica, inspect those in the actual app. The available evidence is enough to specify a focused practice/replay/report/drill experience, without inventing the missing interactions.
