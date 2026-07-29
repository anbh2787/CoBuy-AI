'use client';

import type {
  AddonSession,
  FrameOpenReason,
  FrameType,
  MeetMainStageClient,
  MeetSidePanelClient,
} from '@googleworkspace/meet-addons/meet.addons';

/**
 * Google Cloud project number that owns the Workspace Marketplace deployment.
 * Meet rejects the session with `InvalidCloudProjectNumber` if this is missing
 * or does not match the project the add-on was deployed from.
 */
export const CLOUD_PROJECT_NUMBER =
  process.env.NEXT_PUBLIC_MEET_CLOUD_PROJECT_NUMBER || '';

export interface MeetContext {
  frameType: FrameType;
  session: AddonSession;
  sidePanel: MeetSidePanelClient | null;
  mainStage: MeetMainStageClient | null;
  meetingId: string;
  meetingCode: string;
  openReason: FrameOpenReason;
}

export interface LocalIdentity {
  id: string;
  name: string;
}

const IDENTITY_KEY = 'cobuy_meet_identity';

/** Framed is necessary but NOT sufficient for "running inside Meet". */
export function isFramed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true; // cross-origin parent access threw, so we are framed
  }
}

export function appOrigin(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL || '';
}

/** Main stage URL Meet opens for everyone who joins the activity. */
export function stageUrl(roomId: string): string {
  return `${appOrigin()}/meet/stage?room=${encodeURIComponent(roomId)}`;
}

export function panelUrl(): string {
  return `${appOrigin()}/meet/panel`;
}

/**
 * Shared room key for the call. `meetingId` is globally unique and identical
 * for every participant, so both ends land on the same WebRTC signalling
 * channel without passing a code around by hand.
 */
export function roomIdFor(meetingId: string): string {
  return `meet-${meetingId}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Per-browser identity for WebRTC signalling. The side panel and the main
 * stage are separate iframes, so this is persisted rather than passed down.
 */
export function getLocalIdentity(): LocalIdentity {
  const fallback: LocalIdentity = { id: 'guest', name: 'Shopper' };
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(IDENTITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalIdentity>;
      if (parsed?.id) {
        return { id: parsed.id, name: parsed.name || fallback.name };
      }
    }
  } catch {
    /* storage blocked — fall through to a fresh identity */
  }

  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `u-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const identity: LocalIdentity = { id, name: fallback.name };
  saveLocalIdentity(identity);
  return identity;
}

export function saveLocalIdentity(identity: LocalIdentity): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    /* non-fatal: identity just resets on reload */
  }
}

export function setLocalDisplayName(name: string): LocalIdentity {
  const next = { ...getLocalIdentity(), name: name.trim() || 'Shopper' };
  saveLocalIdentity(next);
  return next;
}

/**
 * Boots the add-on session for whichever frame we are in.
 *
 * Resolving is the only trustworthy proof that we are really running as a Meet
 * add-on — an iframe check alone is true inside any embed.
 */
export async function initMeetAddon(): Promise<MeetContext> {
  if (!CLOUD_PROJECT_NUMBER) {
    throw new Error(
      'NEXT_PUBLIC_MEET_CLOUD_PROJECT_NUMBER is not set — Meet refuses the session without it.',
    );
  }

  const { meet } = await import('@googleworkspace/meet-addons/meet.addons');

  const frameType = meet.addon.getFrameType();
  const session = await meet.addon.createAddonSession({
    cloudProjectNumber: CLOUD_PROJECT_NUMBER,
  });

  const sidePanel =
    frameType === 'SIDE_PANEL' ? await session.createSidePanelClient() : null;
  const mainStage =
    frameType === 'MAIN_STAGE' ? await session.createMainStageClient() : null;

  const client = sidePanel ?? mainStage;
  if (!client) throw new Error(`Unsupported Meet frame type: ${frameType}`);

  const [meetingInfo, openReason] = await Promise.all([
    client.getMeetingInfo(),
    client.getFrameOpenReason(),
  ]);

  return {
    frameType,
    session,
    sidePanel,
    mainStage,
    meetingId: meetingInfo.meetingId,
    meetingCode: meetingInfo.meetingCode,
    openReason,
  };
}

/**
 * Ask the browser directly which policy-controlled features this iframe actually has,
 * and post the answer to the server log.
 *
 * This settles, with no user gesture and no guessing, whether Meet delegates `camera` and
 * `display-capture` to the add-on's origin. `allowsFeature()` is the authoritative check —
 * it reflects the parent's `allow` attribute, which is the thing we cannot see or set.
 */
export async function reportPermissionsProbe(frameType: string): Promise<void> {
  if (typeof window === 'undefined') return;

  const policy: any =
    (document as any).permissionsPolicy || (document as any).featurePolicy || null;

  const allows = (feature: string): string => {
    try {
      if (!policy?.allowsFeature) return 'no-policy-api';
      return String(policy.allowsFeature(feature));
    } catch {
      return 'threw';
    }
  };

  const queryPermission = async (name: string): Promise<string> => {
    try {
      const result = await navigator.permissions.query({ name: name as PermissionName });
      return result.state;
    } catch (error) {
      return `threw:${(error as Error)?.name || 'unknown'}`;
    }
  };

  let deviceCount = -1;
  let labelledDevices = -1;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter(d => d.kind === 'videoinput');
    deviceCount = videoInputs.length;
    labelledDevices = videoInputs.filter(d => !!d.label).length;
  } catch {
    /* enumeration itself can be refused; -1 records that */
  }

  const payload = {
    frameType,
    origin: window.location.origin,
    framed: window.self !== window.top,
    policyApi: policy ? (('permissionsPolicy' in document) ? 'permissionsPolicy' : 'featurePolicy') : 'none',
    allowsCamera: allows('camera'),
    allowsMicrophone: allows('microphone'),
    allowsDisplayCapture: allows('display-capture'),
    // Feature existence is not permission, but a missing function rules it out entirely.
    hasGetDisplayMedia: typeof navigator.mediaDevices?.getDisplayMedia === 'function',
    hasGetUserMedia: typeof navigator.mediaDevices?.getUserMedia === 'function',
    permissionCamera: await queryPermission('camera'),
    permissionMicrophone: await queryPermission('microphone'),
    videoInputCount: deviceCount,
    videoInputsWithLabels: labelledDevices,
    allowedFeatures: (() => {
      try {
        return policy?.allowedFeatures ? policy.allowedFeatures().join(',') : 'n/a';
      } catch {
        return 'threw';
      }
    })(),
    ua: navigator.userAgent,
  };

  try {
    await fetch('/api/voice-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'PERMISSIONS_PROBE',
        userName: getLocalIdentity().name,
        userSaid: `probe:${frameType}`,
        aiAnswer: 'n/a',
        details: JSON.stringify(payload),
      }),
    });
  } catch {
    /* best effort */
  }
}

/** Meet errors carry a machine-readable `errorType`; surface it when present. */
export function describeMeetError(error: unknown): string {
  const errorType = (error as { errorType?: string } | null)?.errorType;
  const message = error instanceof Error ? error.message : String(error);
  return errorType ? `${errorType}: ${message}` : message;
}
