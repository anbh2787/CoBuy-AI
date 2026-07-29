'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, ShoppingBag, Sparkles, Play, AlertTriangle } from 'lucide-react';
import {
  describeMeetError,
  getLocalIdentity,
  initMeetAddon,
  isFramed,
  panelUrl,
  roomIdFor,
  setLocalDisplayName,
  stageUrl,
  type MeetContext,
} from '@/lib/meetAddon';

type PanelPhase = 'booting' | 'ready' | 'live' | 'outside' | 'error';

interface StageUpdate {
  at: number;
  userSaid?: string;
  aiAnswer?: string;
}

export default function MeetSidePanel() {
  const [phase, setPhase] = useState<PanelPhase>('booting');
  const [errorText, setErrorText] = useState<string>('');
  const [meetingCode, setMeetingCode] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('Shopper');
  const [isStarting, setIsStarting] = useState(false);
  const [updates, setUpdates] = useState<StageUpdate[]>([]);

  const ctxRef = useRef<MeetContext | null>(null);
  const roomIdRef = useRef<string>('');

  useEffect(() => {
    setDisplayName(getLocalIdentity().name);
  }, []);

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
        roomIdRef.current = roomIdFor(ctx.meetingId);
        setMeetingCode(ctx.meetingCode);

        // Meet reloads the side panel once an activity begins, so both the initiator
        // (START_ACTIVITY) and everyone who accepts the invite (JOIN_ACTIVITY) come
        // back here with it already running — neither should see "Start shopping".
        const activityRunning =
          ctx.openReason === 'JOIN_ACTIVITY' || ctx.openReason === 'START_ACTIVITY';
        setPhase(activityRunning ? 'live' : 'ready');

        ctx.sidePanel?.on('frameToFrameMessage', (message) => {
          try {
            const parsed = JSON.parse(message.payload) as StageUpdate;
            setUpdates((prev) => [{ ...parsed, at: Date.now() }, ...prev].slice(0, 8));
          } catch {
            /* ignore malformed frame messages */
          }
        });
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

  const handleStart = useCallback(async () => {
    const ctx = ctxRef.current;
    if (!ctx?.sidePanel) return;

    setIsStarting(true);
    setErrorText('');
    setLocalDisplayName(displayName);

    try {
      await ctx.sidePanel.startActivity({
        mainStageUrl: stageUrl(roomIdRef.current),
        sidePanelUrl: panelUrl(),
        additionalData: JSON.stringify({ room: roomIdRef.current }),
      });
      setPhase('live');
    } catch (error) {
      const described = describeMeetError(error);
      // Someone else already started it — joining is the correct outcome.
      if (described.includes('ActivityIsOngoing')) {
        setPhase('live');
      } else {
        setErrorText(described);
      }
    } finally {
      setIsStarting(false);
    }
  }, [displayName]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-white px-3.5 py-4 gap-3.5">
      <header className="flex items-center gap-2 shrink-0">
        <ShoppingBag className="w-4 h-4 text-teal-400 shrink-0" />
        <span className="font-extrabold text-sm">CoBuy AI</span>
        {meetingCode && (
          <span className="ml-auto text-[10px] font-mono text-slate-400 truncate">
            {meetingCode}
          </span>
        )}
      </header>

      {phase === 'booting' && (
        <p className="text-xs text-slate-400 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Connecting to Meet…
        </p>
      )}

      {phase === 'outside' && (
        <div className="text-xs text-slate-300 leading-relaxed space-y-2">
          <p className="font-bold text-white">Open this from inside a Meet call.</p>
          <p className="text-slate-400">
            Join a Google Meet call, open <strong>Activities</strong>, then pick CoBuy AI.
            This page only works inside the Meet side panel.
          </p>
        </div>
      )}

      {phase === 'error' && (
        <div className="text-xs leading-relaxed space-y-2">
          <p className="font-bold text-amber-300 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Meet refused the session
          </p>
          <p className="text-slate-400 font-mono break-words">{errorText}</p>
        </div>
      )}

      {(phase === 'ready' || phase === 'live') && (
        <>
          <label className="text-[11px] font-bold text-slate-400 shrink-0">
            Your name
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onBlur={() => setLocalDisplayName(displayName)}
              className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-normal focus:outline-none focus:border-teal-500"
              placeholder="Shopper"
              maxLength={40}
            />
          </label>

          {phase === 'ready' ? (
            <button
              type="button"
              onClick={handleStart}
              disabled={isStarting}
              className="shrink-0 w-full bg-gradient-to-r from-indigo-500 to-teal-500 text-slate-950 font-black text-xs rounded-xl px-3 py-2.5 flex items-center justify-center gap-1.5 disabled:opacity-60 active:scale-[0.98] transition"
            >
              {isStarting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Starting…
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" /> Start shopping
                </>
              )}
            </button>
          ) : (
            <p className="shrink-0 text-[11px] text-teal-300 font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Live on the main stage
            </p>
          )}

          {errorText && (
            <p className="text-[11px] text-amber-300 font-mono break-words">{errorText}</p>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
            {updates.length === 0 ? (
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Tap an item on the main stage to ask about it. Answers show up here.
              </p>
            ) : (
              updates.map((update) => (
                <div
                  key={update.at}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2"
                >
                  {update.userSaid && (
                    <p className="text-[10px] text-slate-500 truncate">“{update.userSaid}”</p>
                  )}
                  {update.aiAnswer && (
                    <p className="text-[11px] text-slate-200 leading-snug">{update.aiAnswer}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
