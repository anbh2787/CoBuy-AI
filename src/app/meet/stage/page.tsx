'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import VideoCallModal from '@/components/VideoCallModal';
import { User } from '@/lib/types';
import {
  describeMeetError,
  getLocalIdentity,
  initMeetAddon,
  isFramed,
  roomIdFor,
  type MeetContext,
} from '@/lib/meetAddon';

type StagePhase = 'booting' | 'live' | 'outside' | 'error';

/**
 * Resolves the room every participant shares, in order of reliability:
 * the ?room= param Meet copied from the activity's mainStageUrl, then the
 * activity's additionalData, then the meeting id itself.
 */
async function resolveRoomId(ctx: MeetContext): Promise<string> {
  if (typeof window !== 'undefined') {
    const fromUrl = new URLSearchParams(window.location.search).get('room');
    if (fromUrl) return fromUrl;
  }

  try {
    const startingState = await ctx.mainStage?.getActivityStartingState();
    if (startingState?.additionalData) {
      const parsed = JSON.parse(startingState.additionalData) as { room?: string };
      if (parsed?.room) return parsed.room;
    }
  } catch {
    /* no activity state — fall through to the meeting id */
  }

  return roomIdFor(ctx.meetingId);
}

export default function MeetMainStage() {
  const [phase, setPhase] = useState<StagePhase>('booting');
  const [errorText, setErrorText] = useState('');
  const [roomId, setRoomId] = useState('');
  const [identity, setIdentity] = useState<User | null>(null);

  const ctxRef = useRef<MeetContext | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!isFramed()) {
        if (!cancelled) setPhase('outside');
        return;
      }

      try {
        const ctx = await initMeetAddon();
        if (cancelled) return;
        ctxRef.current = ctx;

        const room = await resolveRoomId(ctx);
        if (cancelled) return;

        const local = getLocalIdentity();
        setRoomId(room);
        setIdentity({ id: local.id, name: local.name, email: '', avatar: '' });
        setPhase('live');
      } catch (error) {
        if (cancelled) return;
        setErrorText(describeMeetError(error));
        setPhase('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /** Mirror every AI answer into the side panel so both frames stay in sync. */
  const handleAiAnswer = useCallback(
    (payload: { userSaid?: string; aiAnswer: string }) => {
      ctxRef.current?.mainStage?.notifySidePanel(JSON.stringify(payload)).catch(() => {
        /* side panel may be closed — non-fatal */
      });
    },
    [],
  );

  const handleClose = useCallback(() => {
    ctxRef.current?.mainStage?.closeAddon().catch(() => {
      /* already closing */
    });
  }, []);

  if (phase === 'booting') {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950 text-slate-400 text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Starting CoBuy AI…
      </div>
    );
  }

  if (phase === 'outside') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-center px-6 gap-2">
        <p className="text-white font-bold text-sm">Open CoBuy AI from inside a Meet call.</p>
        <p className="text-slate-400 text-xs max-w-sm">
          Join a Google Meet call, open <strong>Activities</strong>, pick CoBuy AI, then press
          Start shopping.
        </p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-center px-6 gap-2">
        <p className="text-amber-300 font-bold text-sm flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4" /> Meet refused the session
        </p>
        <p className="text-slate-400 text-xs font-mono break-words max-w-md">{errorText}</p>
      </div>
    );
  }

  return (
    <VideoCallModal
      isOpen
      onClose={handleClose}
      groupId={roomId}
      groupTitle="CoBuy AI"
      currentUser={identity}
      roomMembers={identity ? [identity] : []}
      onAiAnswer={handleAiAnswer}
    />
  );
}
