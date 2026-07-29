# CoBuy AI — Google Meet Add-on

Everything an agent or developer needs to work on the Meet integration. Read this before
touching `src/app/meet/**`, `src/lib/meetAddon.ts`, or `meet-addon-manifest.json`.

## The one architectural fact that governs everything

**A Meet add-on iframe cannot read the Meet call's audio or video.** The Add-ons SDK gives you a
side panel, a main stage, shared activity state, and frame-to-frame messaging — nothing more. There
is no API to reach participants' camera tracks.

So CoBuy AI runs **its own WebRTC call inside the add-on** (`src/components/VideoCallModal.tsx`,
signalled over Supabase Realtime). Gemini analyses *that* stream, not Meet's. Do not describe the
product as "AI watching your Meet call" — it is not, and a reviewer who knows Meet will catch it.

The only route to the real Meet media is the **Meet Media API**, which is allowlist-gated and
generally needs corporate sponsorship. Assume it is unavailable.

## Layout

| Path | Role |
|---|---|
| `src/app/meet/panel/page.tsx` | Side panel. Name field, "Start shopping", mirrors AI answers. |
| `src/app/meet/stage/page.tsx` | Main stage. Renders the studio for the shared room. |
| `src/lib/meetAddon.ts` | SDK bootstrap, frame-type aware clients, local identity, room key. |
| `src/app/meet/layout.tsx` | Chrome-free shell (the app navbar hides itself on `/meet`). |
| `meet-addon-manifest.json` | Source of truth for the deployment JSON in the Cloud console. |

**Room key:** taken from Meet's own `meetingId` via `getMeetingInfo()`. It is identical for every
participant, so both ends join the same signalling channel with nothing to type. The activity's
`additionalData` carries it too, as a fallback.

## Required config

`NEXT_PUBLIC_MEET_CLOUD_PROJECT_NUMBER=740104195038` — Meet rejects the session with
`InvalidCloudProjectNumber` without it. It is a build-time inline, so **changing it requires a
redeploy**, not just an env edit. Set in Vercel project `split-chat`.

Local builds also need `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` set to
anything non-empty, or prerender dies in `src/lib/supabaseClient.ts` (`createClient` throws at
import time). This affects `/` and `/_not-found` too — it is not a Meet-specific problem.

## Google Cloud

- Project **OSMO**, id `gen-lang-client-0480961873`, number `740104195038`.
- Marketplace SDK → **HTTP Deployments** → deployment `123`.
- The manifest must contain an `addOns.meet.web` block with `sidePanelUri`, `mainStageUri`, and
  `addOnOrigins`. Without it the add-on registers as a generic Workspace add-on and **never appears
  in Meet at all**. These field names are confirmed — the API validated and accepted them.
- `/meet/*` is served with `Content-Security-Policy: frame-ancestors https://meet.google.com` (see
  `next.config.js`). Do not add `X-Frame-Options`; it would block the embed.

## Adding a tester — and the trap

1. Cloud console → Google Auth Platform → **Audience** → add the address under **Test users**
   (publishing status is "Testing", so only test users can authorise the app).
2. IAM → **Grant access** → role **`roles/gsuiteaddons.tester`** (Google Workspace Add-ons Tester).
   That role carries exactly `deployments.install` / `uninstall` / `installStatus` / `execute`.
3. That tester signs in, opens the HTTP Deployments page, and clicks **Install** on row `123`.
4. Meet → **Activities → Add-ons → CoBuy AI**.

**Both people in a call must have installed it**, or the panel appears only on one side.

**The trap:** the Tester role alone cannot *view* the Marketplace SDK console page (it lacks
`serviceusage.services.get`), so the Install button is unreachable. Pair it with Viewer, or use
an account that already has broader project access.

**The bigger trap — Workspace domains block the install.** Installing succeeds on consumer Gmail
accounts and fails with `permission denied` on Google Workspace accounts (e.g. `@getosmo.app`,
`@google.com`), because Workspace admins gate unverified third-party add-ons. Project Owner does
**not** override this. To unblock a domain: admin.google.com → Security → API controls → Manage
Third-Party App Access → trust OAuth client
`740104195038-fag8nv6b7egmbvqumo1jcgj5ug3a7fah.apps.googleusercontent.com`.

**Known-working test accounts (2026-07-29):** `anbh27@gmail.com`, `cobuyai123@gmail.com`.
Use consumer Gmail accounts for demos unless a domain has been explicitly allowlisted.

## Verified working

In a live call: the add-on lists under Activities; the side panel establishes a session and prints
the meeting code; "Start shopping" fires `startActivity` and Meet opens the studio on the main
stage; AI answers relay main stage → side panel via `notifySidePanel`.

## Open defect

The studio's video is **black** on the main stage — Gemini itself reported "completely black
picture". Cause not yet isolated: either Meet holds the camera while its own video is on, or the
add-on iframe is not granted camera permission. Test by turning Meet's camera off first, then
reopening the activity. Measure it; do not guess.

## Repo gotcha

The original `package-lock.json` resolved to an internal Google Artifact Registry proxy
(`us-npm.pkg.dev/artifact-foundry-prod/...`) that returns 401 outside that environment, so
`npm install` failed outright. It was rebuilt against public npm. If you see E401 on install with
no auth configured, check the lockfile's `resolved` URLs before anything else.
