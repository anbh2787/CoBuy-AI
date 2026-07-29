# CoBuy AI: Architecture Pivot to Chrome Extension

## 1. Executive Summary & The Fatal Flaw of Meet Add-ons
The previous architecture attempted to build CoBuy AI as a standard Google Workspace Meet Add-on (Next.js iframe). This approach fundamentally failed because it violates hard browser security boundaries:
1. **Cross-Origin DOM Blocking:** The Add-on iframe (`split-chat-mu.vercel.app`) cannot execute `parent.document.querySelector('video')` to grab Meet's video feed. The browser's Same-Origin Policy (SOP) blocks cross-origin iframes from accessing the parent DOM.
2. **Permissions-Policy Constraints:** Google Meet intentionally does NOT provide the `allow="camera; microphone; display-capture"` attributes to third-party iframes. Calling `navigator.mediaDevices.getUserMedia()` inside the Add-on inherently throws a `NotAllowedError`.
3. **Restricted Interactive Area ("The Tiny Box"):** Add-ons are sandboxed inside specific designated zones (Side Panel or Main Stage). They cannot float over the entire screen or listen to clicks overlapping the main video feed.

**Conclusion:** A Google Meet Add-on is mechanically incapable of satisfying the user requirement: *"It should always be recording from the moment video starts. And I should be able to simply click [anywhere on the video]."*

## 2. Why a Chrome Extension Solves Everything (Deep Justification)
To achieve continuous video integration and native "tap anywhere" overlay functionality within Google Meet, we must migrate the client application to a **Chrome Extension (Manifest V3)**.

Here is the deep technical justification for why this works:

### A. Total DOM Access via Content Scripts
Unlike iframes, a Chrome Extension **Content Script** runs in the context of the host page (`meet.google.com`).
* **Frame Extraction:** The Content script can query the DOM `document.querySelectorAll('video')`, locate the active speaker, and pipe that exact `<video>` feed into a hidden HTML5 `<canvas>`.
* **Zero Permission Errors:** Because the extraction happens natively on the Canvas object rather than invoking a new `getUserMedia()` request, it completely bypasses camera permissions. The video is already streaming; we just snapshot the canvas.

### B. Unrestricted UI Injection & Z-Index (The "Tap Anywhere" Solution)
A Content Script can inject a floating, transparent `<div>` overlay *directly on top* of the Google Meet video grid.
* Users can "tap anywhere" on the video.
* The transparent overlay intercepts the click `(e.clientX, e.clientY)`.
* We dynamically calculate the relative `(x%, y%)` coordinates based on the underlying video element's bounding box and fire the frame + coordinates to Gemini.

### C. Unified Audio Hooks
By utilizing standard DOM MediaRecorder within the `meet.google.com` context (or the `chrome.tabCapture` API from a background service worker), the extension has full access to the user's microphone array without relying on delegated iframe permissions.

## 3. Chrome Extension Architecture Plan

The CoBuy AI architecture will consist of two parts:
1. **The Backend (Unchanged):** The existing Vercel Next.js app (`/api/live-call`, `/api/voice-logs`, `/api/tts`) will remain the server-side brain for Gemini routing and PCM-to-WAV conversion.
2. **The New Client (Extension):** A localized Chrome Extension injected into Google Meet.

### Component Breakdown
* **`manifest.json` (V3):**
  * **Permissions:** `"scripting"`, `"activeTab"`, `"tabCapture"`, `"storage"`.
  * **Host Permissions:** `"*://meet.google.com/*"`, `"*://split-chat-mu.vercel.app/*"`.
  * **Content Scripts:** Injecting `content.js` and `styles.css` into Google Meet.
* **`content.js` (The Core Engine):**
  * **UI Injection:** Builds a custom CoBuy UI (Floating Action Button + "Ask Voice Question" button + Result popover) directly in the Meet DOM.
  * **Click Interception Layer:** A dynamic `position: absolute; z-index: 9999;` transparent grid over the active video.
  * **The Frame Snapshotter:**
    ```javascript
    function captureActiveVideoFrame() {
      const video = document.querySelector('video'); // Selects Meet's active video
      if (!video) return null;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.85);
    }
    ```
  * **Network Layer:** Shoots the Base64 frame + click coordinates via `fetch()` to `https://split-chat-mu.vercel.app/api/live-call`.

## 4. Implementation Steps for Claude (Execution Orders)

**Claude, follow this exact sequence to migrate the client:**

1. **Scaffold the Extension:** Create a new `/extension` directory in the root of the existing repository.
2. **Manifest V3 Setup:** Write an aggressive `manifest.json` targeting `meet.google.com`.
3. **Content Script Injection (Stage 1 - UI):** Write `content.js`. Inject a visible but unintrusive CoBuy AI box (similar to the Side Panel UI) directly into the bottom-right of the Meet screen. Inject a transparent listener overlay directly above the main video feed.
4. **Touch-to-Identify Hook (Stage 2 - Video):** Implement the `captureActiveVideoFrame()` logic. On click of the transparent overlay, capture the video frame, grab the X/Y coordinates, and POST to the deployed `/api/live-call` endpoint. Display the result in the injected UI.
5. **Continuous Voice AI (Stage 3 - Audio):** Hook into `navigator.mediaDevices.getUserMedia({audio: true})` natively inside the `meet.google.com` domain. Render the PCM buffer to WAV and POST to `/api/live-call`. Include the neural TTS playback handler.
6. **Telemetry & RCA:** Ensure the Content Script continues tracking all user actions back to `/api/voice-logs`.

By breaking out of the iframe, CoBuy AI will achieve 100% video integration seamlessly into the user's existing Google Meet workflow.
