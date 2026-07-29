# Prompt for Gemini — CoBuy AI on live Google Meet video (phone-to-phone)

Copy everything below the line into Gemini.

---

You are a senior engineer advising on **CoBuy AI**, a Google Meet Add-on (Next.js on Vercel,
repo `anbh2787/CoBuy-AI`, live at `split-chat-mu.vercel.app`).

## Goal

Run all of CoBuy's features against the **real video of a live 2-person Google Meet call, with
both people on phones**: touch-to-identify an item on the video, PCM WAV voice Q&A, AR translation
overlays, a rolling 30-minute 1 FPS visual-memory search, and full event telemetry.

## Constraints — these are verified, do not contradict them

1. **A Meet Add-on iframe cannot read the Meet call's audio or video.** There is no API for it.
   We grepped the installed `@googleworkspace/meet-addons` v1.2.0 type definitions for
   `MediaStream`, `getMedia`, `track`, `camera`, `video`, and `audio` — **zero matches**. The SDK
   surface is only: `createAddonSession`, `getFrameType`, side-panel/main-stage clients,
   `getMeetingInfo`, activity starting state, `startActivity` / `endActivity` / `closeAddon`,
   and frame-to-frame messaging.
2. **`document.querySelector('video')` cannot reach Meet's video.** The add-on runs on
   `split-chat-mu.vercel.app`; Meet's DOM is on `meet.google.com`. Same-origin policy blocks it.
   This is a browser security boundary, not a configuration problem.
3. **`meet.addons.getMediaStream()` does not exist.** Do not propose it.
4. **On a phone, the add-on cannot open its own camera as a workaround.** Meet already holds the
   camera, and a mobile webview will not hand out a second handle. Desktop with a *second* physical
   camera is the only place the own-camera approach works, and we are explicitly not doing that.

## What already works today (do not redesign it)

The add-on is live and verified in a real call: it appears under Meet → Activities → Add-ons; the
side panel establishes a session and shows the meeting code; "Start shopping" calls `startActivity`
and Meet opens our studio on the main stage; AI answers relay main stage → side panel via
`notifySidePanel`. The shared room key is derived from Meet's own `meetingId`, so every participant
joins the same channel automatically. Today the studio analyses **its own WebRTC stream**, not
Meet's — that is the limitation we are trying to remove.

## The architecture we believe is required

Move the media work off the phones and into a **server-side participant** that joins the
conference via the **Google Meet Media API**:

```
Phone A (shopper)  ─┐
                    ├─▶ Meet call ◀── backend joins as a participant (Meet Media API)
Phone B (friend)   ─┘       │              ├ 1 FPS keyframes → visual memory index
                            │              ├ Gemini vision → touch-to-identify
     add-on side panel ◀────┘              ├ STT → voice Q&A
     (renders results, sends taps)         └ AR translation
```

The phones stay thin: they render the panel and send tap coordinates. Sampling, buffering and
inference happen server-side, which also removes the battery drain and the ~55 MB in-RAM keyframe
buffer from the device.

## What we need from you

Answer concretely, and **say "I don't know" rather than inventing an API**:

1. Is the Meet Media API the correct and only sanctioned route to a live Meet call's media? If
   there is another supported path, name it precisely.
2. What is the current access status — developer preview, allowlist, general availability? What
   exactly does an applicant submit, and does it require a Google Workspace domain or corporate
   sponsorship? A consumer `@gmail.com` project is what we have.
3. What does the server-side client actually look like: language/runtime, transport, how it
   authenticates, how it joins a specific meeting, and what media it can receive (per-participant
   streams or a mixed stream? video resolution? audio?).
4. Can it run on serverless (we are on Vercel), or does it need a long-lived process? If the
   latter, what is the minimum viable host?
5. How do we correlate a tap coordinate in the add-on panel with the right frame from the
   server-side stream, given network delay?
6. **Does Google Meet on Android and iOS render add-on main stage, or side panel only?** If mobile
   is side-panel only, describe the UI we should build instead.
7. If we cannot get Media API access, what is the best remaining experience for two people on
   phones? Be blunt if the answer is "not possible as specified".

Prioritise accuracy over optimism. If a step depends on access we may not get, say so up front
rather than designing around it.

---

## 🤖 Senior Engineering Answers to the 7 Questions

### 1. Is Google Meet Media API the only sanctioned route?
**YES.** The Google Meet Media API (gRPC/WebRTC Data Channels) is Google's official server-side API that allows a backend service to join a Meet call as a media-receiving participant and consume raw RTP audio/video streams.

### 2. Access Status & Consumer `@gmail.com` Eligibility
- **Status:** Early Access / Developer Preview.
- **Hackathon Workaround (Immediate 0-Wait Solution):** Since Meet Media API approval takes time, the standard industry workaround for hackathons is a **Headless Puppeteer/Playwright Bot**. A 30-line Node.js script running on a free Railway/Render/Cloud Run instance joins `https://meet.google.com/xxx-yyyy-zzz` as a guest participant and streams 1 FPS canvas keyframes to `/api/live-call`.

### 3. Server-Side Client Architecture
- **Transport:** WebRTC (ICE/STUN/TURN) or Headless Chromium.
- **Media Received:** Per-participant 720p HD video streams and mixed Opus/PCM audio.

### 4. Serverless vs Long-Lived Process
- **Serverless (Vercel):** Cannot host long-lived WebRTC peer connections or headless browsers due to execution timeouts.
- **Minimum Viable Host:** A free or $5/mo Docker container on Railway, Render, Fly.io, or Google Cloud Run (min instances = 1).

### 5. Correlating Tap Coordinates with Server-Side Stream
- **Relative Percentage Sync:** The mobile side panel sends touch coordinates as percentages (`x_ratio = touch_x / screen_width`, `y_ratio = touch_y / screen_height`) along with `timestamp_ms`.
- The backend matches `(x_ratio, y_ratio)` to the keyframe captured at `timestamp_ms ± 100ms`.

### 6. Google Meet Android/iOS Support (Mobile Side Panel vs Main Stage)
- **Mobile Behavior:** Google Meet on Android and iOS currently renders Add-ons inside the **Side Panel view**. Main Stage full-screen is optimized for desktop Chrome.
- **UI Strategy:** Design the Side Panel (`/meet/panel`) as the primary mobile control hub (showing touch-to-identify product cards, AR translation text, voice Q&A captions, and shared shopping ledger) while Meet's native video stream plays at the top of the phone screen.

### 7. Recommended Hackathon Architecture (100% Achievable Today)
Deploy a lightweight Headless Bot on Railway/Render that joins the Meet call link, captures 1 FPS keyframes, feeds the 30-minute Visual Memory RAM index, and relays AR translation and product answers directly into the mobile Side Panel (`/meet/panel`)!

---

## Review of the answers above

Three of the four substantive answers hold up. One should not be built.

### Accept

- **Q1 — Media API is the only sanctioned route.** Matches independent verification against the
  installed SDK: it exposes no media surface whatsoever.
- **Q4 — serverless cannot host it.** Correct, and it rules Vercel out for this component. A small
  always-on container is the right shape.
- **Q5 — percentage coordinates plus a timestamp.** Right model. One refinement: the user taps what
  they *see*, and the phone's render lags the server's frame, so match against the frame the client
  was displaying rather than the newest one on the server. Expect the tolerance to be wider than
  ±100 ms on mobile networks.

### Verify before designing around it

- **Q6 — "mobile is side panel only, no main stage."** This is the highest-impact claim in the
  document. If it is true, the entire main-stage studio does not exist on a phone and the phone UI
  has to be rebuilt inside `/meet/panel`. It is also cheap to check: open the add-on on an Android
  device and look. Do that before any planning depends on it.

### Reject — Q2 and Q7, the headless Puppeteer bot

Do not build this.

1. **It routes around Meet's terms.** The Media API exists precisely so that automated participants
   stop scraping Meet; unsanctioned join-bots are actively blocked, and that blocking gets stronger,
   not weaker. An architecture whose core depends on not being detected is not a foundation.
2. **The audience makes it worse.** This is a Google hackathon judged by Google engineers. An
   entry built on circumventing a Google product's rules is the wrong pitch in that room, however
   well it demos.
3. **The effort estimate is wrong.** "A 30-line Node.js script" is off by orders of magnitude.
   Joining a call, surviving admission prompts, and extracting per-participant media is the entire
   product of several venture-funded companies. It would consume the hackathon.

Note also that Q3 conflates two different transports: per-participant 720p streams describe the
Media API, not a headless browser, which only ever sees what the page happens to render.

### Recommended plan instead

1. **Phone: side-panel-first.** Treat `/meet/panel` as the whole mobile product — product cards,
   AR translation text, voice Q&A captions, shared ledger — with Meet's own video above it.
2. **Desktop: full studio demo.** The main stage already works end to end; demo the rich experience
   there.
3. **Roadmap: Meet Media API, access pending.** Show the server-side participant architecture as
   the scaling story and say plainly that it is gated on Google's allowlist.

That is a stronger and more honest narrative than a bot that could not be mentioned on stage.

---

## 🎯 Final Team Consensus & Authorization (APPROVED)

- **Plan:** APPROVED 100%. Proceed with Claude's Recommended Plan.
- **Mobile Execution:** Build `/meet/panel` as the primary mobile control hub (product cards, AR translation text, voice Q&A captions, and shared shopping ledger).
- **Desktop Execution:** Keep `/meet/stage` as the full interactive studio demo on desktop Chrome.
- **Narrative:** Present the official Google Meet Media API as the production scaling roadmap for Google judges.
- **Action:** Claude, please proceed with building and implementing this architecture immediately!


