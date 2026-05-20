# Swingstr — Future Features

---

## AI / Hermes Integration

The goal: turn Swingstr into the single place where a lesson ends and everything downstream happens automatically — notes captured, email drafted, video saved, student record updated.

### End-of-Lesson Flow
- "End Lesson" button in the analyzer that kicks off a post-lesson workflow:
  1. Prompt for lesson notes (text input, or pull from Apple Notes via Hermes)
  2. Save the current video(s) to the student's Google Drive folder
  3. Send notes + video reference to Hermes → get a draft recap email back
  4. Review and approve the draft inside Swingstr
  5. Send (or save as Gmail draft) without ever leaving the app
- Everything attached to the student record automatically

### Hermes Bridge
- Hermes already has the lesson recap pipeline, student data, and email drafting
- Swingstr has the video + real-time analysis
- The bridge: a shared student ID / folder structure so both tools are looking at the same data
- Could be as simple as a webhook — Swingstr posts `{ studentId, videoUrl, notes }` to a Hermes endpoint after a lesson
- Or tighter: Swingstr reads existing Hermes student data so you're not managing two separate student lists

### In-App Notes
- Simple lesson notes field that appears alongside the analyzer (not buried in the library)
- Auto-timestamped, attached to the loaded video
- Could pre-populate the Hermes recap draft

---

## Student Portal

Students get their own view — they can watch their videos and use the analyzer, but can't see other students or modify anything.

### Access Model
- Each student gets a secure link (generated from their profile)
- Options to explore: magic link via email, or Google sign-in restricted to their email address
- Link is scoped to that student only — they can't browse to another student's data
- Sessions can be time-limited if needed

### What Students Can Do
- Watch their own saved videos
- Use the full analyzer: pause, frame-by-frame, draw lines, set markers
- View their lesson recap notes
- Can NOT: see other students, save/delete videos, modify their profile

### What Students Cannot Do
- Access the student library
- Upload new videos (view-only on what the instructor has saved)
- See any other student's name, video, or data
- Modify any stored data

### Implementation Notes
- Likely needs a lightweight backend or Supabase for auth-gated access
- Alternative simpler path: Google sign-in where student's email is matched to their profile — no new backend needed, just Drive folder permissions
- Student view is essentially a stripped-down version of the current analyzer with a fixed video source

---

## Other Ideas

- **Voice notes** — record a quick audio note during a lesson, auto-transcribed and sent to Hermes
- **Lesson history timeline** — visual timeline per student showing video thumbnails and recap dates
- **Side-by-side progress comparison** — auto-load "first lesson" vs "latest lesson" for a student with one click
- **Swing metrics overlay** — AI-detected tempo, hip turn, spine angle annotations (longer term)
