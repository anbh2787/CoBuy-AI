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
