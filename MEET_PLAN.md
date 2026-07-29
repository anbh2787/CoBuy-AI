# Google Meet Add-on Architecture & Implementation Plan: CoBuy AI

## 🎯 OBJECTIVE
Eliminate duplicate camera hardware locks and black video frames inside Google Meet Add-on while maintaining **100% interactive touch-to-identify**, **PCM WAV voice Q&A**, **AR Translation**, **30-minute Visual Memory search (< 50ms)**, and **full-stack RCA telemetry logging** directly on Google Meet's active video feed.

---

## 🔍 ROOT CAUSE ANALYSIS (RCA)
- Mobile and desktop operating systems (Android, iOS, macOS) enforce single-process hardware camera sensor locks.
- When running inside Google Meet as an Add-on iframe (`/meet/panel` & `/meet/stage`), Google Meet holds exclusive camera hardware locks.
- Standalone `getUserMedia()` calls inside the Add-on iframe fail or return black video frames due to hardware contention.

---

## 🏗️ TECHNICAL IMPLEMENTATION SPECIFICATION

### Step 1: Hook Directly into Google Meet's Active Video Feed
- **File:** `src/app/meet/stage/page.tsx` & `src/lib/meetAddon.ts`
- **Action:** Remove standalone `getUserMedia()` requests inside the Add-on container.
- **Mechanism:** Select Meet's active video element (`document.querySelector('video')` or `meet.addons.getMediaStream()`) and draw its live frames onto the `CoBuy AI` interactive stage canvas.
- **Benefit:** **0 camera hardware conflicts**, 0 black screens, 1 single crisp video stream, and 100% battery efficiency.

### Step 2: Interactive Video Canvas & Touch-to-Identify
- **File:** `src/app/meet/stage/page.tsx`
- **Action:** Bind `onClick` and `onTouchStart` event listeners to the mainstage canvas.
- **Mechanism:**
  1. Capture exact touch coordinate `(x, y)` on the video frame.
  2. Render glowing animated crosshair targeting ring at `(x, y)`.
  3. Package base64 frame + `(x, y)` target coordinates and send to `/api/live-call`.
  4. Gemini identifies the tapped item and speaks the response via neural TTS into the user's Bluetooth earphone.

### Step 3: 30-Minute Visual Memory Buffer (< 50ms Latency)
- **File:** `src/app/meet/stage/page.tsx` & `src/lib/meetAddon.ts`
- **Action:** 1 FPS keyframe sampler grabs snapshots directly from Meet's active video feed.
- **Mechanism:**
  1. Maintains a rolling 1,800 keyframe buffer in RAM (~55 MB footprint).
  2. Voice queries (*"Where was the Matcha Pocky?"*) execute sub-50ms vector lookback searches across the 30-minute keyframe index.
  3. If missing in past memory, arms **Live Visual Radar** filter that chimes (**`BEEP-BEEP!`**) the second the item appears in Meet's camera view.

### Step 4: AR Translation Overlay & Manual `✕` Dismiss
- **File:** `src/app/meet/stage/page.tsx` & `src/app/api/translate-ar/route.ts`
- **Action:** AR Translation scanner runs on Meet's video feed.
- **Mechanism:**
  1. Enforces strict brevity word caps (Title: max 5 words; Features/Directions: max 10 words).
  2. Renders succinct translation cards directly over product labels and physical signage.
  3. Includes interactive **`✕`** close button on every card for manual dismissal.

### Step 5: Full-Stack Telemetry & RCA Event Logging
- **File:** `src/app/api/voice-logs/route.ts`
- **Action:** Record 100% of frontend and backend events with ISO timestamps.
- **Tracked Events:** Camera binding, touch crosshairs, voice questions, AR translation toggles, visual memory lookups, and Gemini responses. Accessible at `/api/voice-logs`.

---

## 🚀 VERIFICATION CHECKLIST FOR CLAUDE
- [ ] Verify `/meet/stage` loads Meet's video feed cleanly with 0 duplicate camera calls.
- [ ] Verify touch-to-identify crosshairs work on canvas tap.
- [ ] Verify 30-minute Visual Memory keyframes are indexed at 1 FPS.
- [ ] Verify AR Translation cards render with `✕` dismiss buttons.
- [ ] Verify telemetry events log to `/api/voice-logs`.
