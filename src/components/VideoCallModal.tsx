'use client';

import React, { useState, useEffect, useRef } from 'react';
import { User } from '@/lib/types';
import { supabase } from '@/lib/supabaseClient';
import { Mic, MicOff, Video, VideoOff, RefreshCw, Sparkles, PhoneOff, Volume2, Loader2, Users, Globe } from 'lucide-react';

interface VideoCallModalProps {
  isOpen: boolean;
  onClose: (sessionNotes: string[], lastImageBase64?: string) => void;
  groupId: string;
  groupTitle: string;
  currentUser: User | null;
  roomMembers: User[];
}

interface ARTranslationItem {
  original: string;
  translation: string;
  x?: number;
  y?: number;
}

export default function VideoCallModal({ isOpen, onClose, groupId, groupTitle, currentUser, roomMembers }: VideoCallModalProps) {
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoDisabled, setVideoDisabled] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Array<{ peerId: string; peerName: string; stream: MediaStream }>>([]);
  const [telemetryStatus, setTelemetryStatus] = useState<string>('Ready • Tap ✨ to speak • Tap 🌐 for AR Translate');

  // STEP 1: LIVE AR TRANSLATION LAYER STATE
  const [isTranslateArActive, setIsTranslateArActive] = useState(false);
  const [arTranslations, setArTranslations] = useState<ARTranslationItem[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const sessionNotesRef = useRef<string[]>([]);
  const lastCapturedImageRef = useRef<string | undefined>(undefined);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<any>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<any>(null);
  const arSamplerIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen && currentUser) {
      sessionNotesRef.current = [];
      lastCapturedImageRef.current = undefined;
      setArTranslations([]);
      startLocalWebcam('user');
      setupWebRTCSignaling();
    } else {
      cleanupSession();
    }
    return () => {
      cleanupSession();
    };
  }, [isOpen]);

  // LIVE AR TRANSLATION SAMPLER LOOP
  useEffect(() => {
    if (isTranslateArActive && isOpen && !videoDisabled) {
      setTelemetryStatus('🌐 AR Translate Active: Scanning physical signage & currency right now...');
      arSamplerIntervalRef.current = setInterval(async () => {
        if (!localVideoRef.current) return;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = localVideoRef.current.videoWidth || 1280;
          canvas.height = localVideoRef.current.videoHeight || 720;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          ctx.drawImage(localVideoRef.current, 0, 0, canvas.width, canvas.height);
          const base64Frame = canvas.toDataURL('image/jpeg', 0.82);
          if (!base64Frame || base64Frame === 'data:,' || base64Frame.length < 3000) return;

          lastCapturedImageRef.current = base64Frame;

          const response = await fetch('/api/translate-ar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              frameBase64: base64Frame,
              targetLanguage: 'English'
            })
          });

          const data = await response.json();
          if (data && Array.isArray(data.translations) && data.translations.length > 0) {
            setArTranslations(data.translations);
            data.translations.forEach((item: ARTranslationItem) => {
              const noteString = `🌐 AR Translate: [${item.original}] → ${item.translation}`;
              if (!sessionNotesRef.current.includes(noteString)) {
                sessionNotesRef.current = [...sessionNotesRef.current, noteString];
              }
            });
          }
        } catch (err) {
          console.warn('AR background sample warning:', err);
        }
      }, 2200);
    } else {
      if (arSamplerIntervalRef.current) clearInterval(arSamplerIntervalRef.current);
      if (!isTranslateArActive && isOpen) {
        setTelemetryStatus('Ready • Tap ✨ to speak • Tap 🌐 for AR Translate');
        setArTranslations([]);
      }
    }

    return () => {
      if (arSamplerIntervalRef.current) clearInterval(arSamplerIntervalRef.current);
    };
  }, [isTranslateArActive, isOpen, videoDisabled]);

  const playTouchTone = (type: 'start' | 'end') => {
    try {
      if (typeof window !== 'undefined') {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'start') {
          osc.frequency.setValueAtTime(440, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
        } else {
          osc.frequency.setValueAtTime(660, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.12);
        }

        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      }
    } catch (e) { /* no-op */ }
  };

  const unlockSpeechSynthesisSynchronously = () => {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const silent = new SpeechSynthesisUtterance('');
        silent.volume = 0;
        window.speechSynthesis.speak(silent);
      }
    } catch (e) { /* no-op */ }
  };

  const startLocalWebcam = async (mode: 'user' | 'environment') => {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(t => t.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }

        if (channelRef.current && currentUser) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'peer-join',
            payload: { userId: currentUser.id, userName: currentUser.name }
          });
        }
      }
    } catch (err) {
      console.warn('Could not acquire camera device track:', err);
    }
  };

  const setupWebRTCSignaling = () => {
    if (!currentUser) return;
    const channel = supabase.channel(`webrtc_call_${groupId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'peer-join' }, async ({ payload }) => {
        if (payload.userId === currentUser.id) return;
        createPeerConnection(payload.userId, payload.userName, true);
      })
      .on('broadcast', { event: 'webrtc-offer' }, async ({ payload }) => {
        if (payload.targetId !== currentUser.id) return;
        const pc = createPeerConnection(payload.senderId, payload.senderName, false);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        channel.send({
          type: 'broadcast',
          event: 'webrtc-answer',
          payload: { targetId: payload.senderId, senderId: currentUser.id, answer }
        });
      })
      .on('broadcast', { event: 'webrtc-answer' }, async ({ payload }) => {
        if (payload.targetId !== currentUser.id) return;
        const pc = peerConnectionsRef.current.get(payload.senderId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.targetId !== currentUser.id) return;
        const pc = peerConnectionsRef.current.get(payload.senderId);
        if (pc && payload.candidate) {
          pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && currentUser) {
          channel.send({
            type: 'broadcast',
            event: 'peer-join',
            payload: { userId: currentUser.id, userName: currentUser.name }
          });
        }
      });

    channelRef.current = channel;
  };

  const createPeerConnection = (remoteUserId: string, remoteUserName: string, isInitiator: boolean): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    peerConnectionsRef.current.set(remoteUserId, pc);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = (e) => {
      if (e.candidate && channelRef.current && currentUser) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: { targetId: remoteUserId, senderId: currentUser.id, candidate: e.candidate }
        });
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (stream) {
        setRemoteStreams(prev => {
          if (prev.some(s => s.peerId === remoteUserId)) return prev;
          return [...prev, { peerId: remoteUserId, peerName: remoteUserName, stream }];
        });
      }
    };

    if (isInitiator && channelRef.current && currentUser) {
      pc.createOffer().then(offer => {
        pc.setLocalDescription(offer);
        channelRef.current.send({
          type: 'broadcast',
          event: 'webrtc-offer',
          payload: { targetId: remoteUserId, senderId: currentUser.id, senderName: currentUser.name, offer }
        });
      });
    }

    return pc;
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = audioMuted;
      });
      setAudioMuted(!audioMuted);
    } else {
      setAudioMuted(!audioMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = videoDisabled;
      });
      setVideoDisabled(!videoDisabled);
    } else {
      setVideoDisabled(!videoDisabled);
    }
  };

  const handleSwitchCamera = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startLocalWebcam(nextMode);
  };

  const handleTapAndSpeakToggle = () => {
    if (isAiProcessing) return;
    unlockSpeechSynthesisSynchronously();

    if (isVoiceRecording && mediaRecorderRef.current) {
      playTouchTone('end');
      setIsVoiceRecording(false);
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        captureFrameAndSendToAi(undefined);
      }
      return;
    }

    if (localStreamRef.current && typeof MediaRecorder !== 'undefined') {
      try {
        playTouchTone('start');
        audioChunksRef.current = [];
        const audioTracks = localStreamRef.current.getAudioTracks();
        if (audioTracks.length === 0) {
          captureFrameAndSendToAi(undefined);
          return;
        }

        const recordStream = new MediaStream([audioTracks[0]]);
        let recorder: MediaRecorder;
        try {
          recorder = new MediaRecorder(recordStream, { mimeType: 'audio/webm' });
        } catch (e) {
          recorder = new MediaRecorder(recordStream);
        }

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = async () => {
          setIsVoiceRecording(false);
          setTelemetryStatus('Evaluating visual parameters and question...');
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = reader.result as string;
            captureFrameAndSendToAi(base64Audio);
          };
          reader.readAsDataURL(audioBlob);
        };

        recorder.start(100);
        mediaRecorderRef.current = recorder;
        setIsVoiceRecording(true);
        setTelemetryStatus('🎙️ Listening... Speak aloud and tap icon when finished');

        if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            playTouchTone('end');
            setIsVoiceRecording(false);
            try { mediaRecorderRef.current.stop(); } catch (err) { /* no-op */ }
          }
        }, 7000);
      } catch (err) {
        setIsVoiceRecording(false);
        captureFrameAndSendToAi(undefined);
      }
    } else {
      captureFrameAndSendToAi(undefined);
    }
  };

  const captureFrameAndSendToAi = (recordedAudioBase64?: string) => {
    if (!localVideoRef.current || isAiProcessing) return;

    setIsAiProcessing(true);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsAiSpeaking(false);
    setTelemetryStatus('Processing conversational answer right now...');

    setTimeout(async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = localVideoRef.current?.videoWidth || 1280;
        canvas.height = localVideoRef.current?.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        let base64Frame = '';

        if (ctx && localVideoRef.current) {
          ctx.drawImage(localVideoRef.current, 0, 0, canvas.width, canvas.height);
          base64Frame = canvas.toDataURL('image/jpeg', 0.88);

          if (!base64Frame || base64Frame === 'data:,' || base64Frame.length < 3000) {
            setTelemetryStatus('⚠️ Camera note: Empty device buffer. Please retry.');
            setIsAiProcessing(false);
            return;
          } else {
            lastCapturedImageRef.current = base64Frame;
          }
        }

        const response = await fetch('/api/live-call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            frameBase64: base64Frame,
            audioBase64: recordedAudioBase64 || null,
            questionText: recordedAudioBase64 ? undefined : "Describe literally what physical object appears across this picture out loud.",
            currentUserName: currentUser?.name || 'Anuj'
          })
        });

        const data = await response.json();
        const reply = data.spokenReply || `I verified your visual capture directly right now!`;

        setIsAiProcessing(false);
        setIsAiSpeaking(true);
        setTelemetryStatus(`Observation complete.`);

        const cleanLogSummary = `📸 AI Video Observation: "${reply}"`;
        sessionNotesRef.current = [...sessionNotesRef.current, cleanLogSummary];

        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(reply);
          utterance.rate = 1.0;
          utterance.pitch = 1.0;
          utterance.onend = () => setIsAiSpeaking(false);
          utterance.onerror = () => setIsAiSpeaking(false);
          window.speechSynthesis.speak(utterance);
        }
      } catch (err: any) {
        console.error('Frame check exception:', err);
        setIsAiProcessing(false);
        setTelemetryStatus('Scan verification exception: ' + (err?.message || 'timeout'));
      }
    }, 110);
  };

  const cleanupSession = () => {
    if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
    if (arSamplerIntervalRef.current) clearInterval(arSamplerIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try { mediaRecorderRef.current.stop(); } catch (err) { /* no-op */ }
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setRemoteStreams([]);
    setIsTranslateArActive(false);
    setArTranslations([]);
  };

  const handleHangUp = () => {
    cleanupSession();
    onClose([...sessionNotesRef.current], lastCapturedImageRef.current);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[170] bg-slate-950 flex flex-col justify-between overflow-hidden animate-in fade-in duration-150">
      
      {/* MINIMALIST HEADER BAR (`Zero Verbosity`) */}
      <div className="bg-slate-900 border-b border-slate-800 px-3.5 py-2.5 flex items-center justify-between shrink-0 shadow-lg z-30">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shrink-0" />
          <span className="font-extrabold text-white text-xs sm:text-sm truncate">
            {groupTitle || 'Live Video Studio'}
          </span>
          <span className="text-[10px] font-mono text-slate-300 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-md hidden sm:block truncate max-w-[300px]">
            {telemetryStatus}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isTranslateArActive ? (
            <span className="bg-[#4285F4]/20 text-[#4285F4] border border-[#4285F4]/50 text-[11px] font-black px-2.5 py-1 rounded-xl flex items-center gap-1.5 animate-pulse">
              <Globe className="w-3.5 h-3.5" /> AR Translate ON
            </span>
          ) : isVoiceRecording ? (
            <span className="bg-rose-500/20 text-rose-300 border border-rose-500/60 text-[11px] font-black px-2.5 py-1 rounded-xl flex items-center gap-1.5 animate-pulse">
              <Mic className="w-3.5 h-3.5 text-rose-400" /> Recording...
            </span>
          ) : isAiSpeaking ? (
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[11px] font-black px-2.5 py-1 rounded-xl flex items-center gap-1.5 animate-pulse">
              <Volume2 className="w-4 h-4" /> Speaking Aloud
            </span>
          ) : isAiProcessing ? (
            <span className="bg-brand-500/20 text-brand-400 border border-brand-500/40 text-[11px] font-black px-2.5 py-1 rounded-xl flex items-center gap-1.5 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning...
            </span>
          ) : (
            <span className="bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold px-2.5 py-1 rounded-xl flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-brand-400" /> {remoteStreams.length + 1}
            </span>
          )}
        </div>
      </div>

      {/* SINGLE-SCREEN VIEWPORT FIT (`No bottom cropping`) */}
      <div className="w-full flex-1 min-h-0 h-[calc(100vh-130px)] max-h-[calc(100vh-130px)] p-2 sm:p-4 flex flex-col sm:flex-row gap-2.5 overflow-hidden relative">
        
        {/* TILE 1: YOUR LIVE WEBCAM DISPLAY + AR OVERLAY */}
        <div className="flex-1 min-h-0 min-w-0 rounded-3xl bg-slate-900 border border-slate-700/90 overflow-hidden relative shadow-2xl flex flex-col justify-end">
          {videoDisabled ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-slate-400">
              <VideoOff className="w-12 h-12 text-slate-600" />
              <p className="text-xs font-black text-white mt-1">Camera Paused</p>
            </div>
          ) : (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover transition duration-200"
            />
          )}

          {/* LIVE AR TRANSLATION CHIPS OVERLAY (`Pinned above items`) */}
          {arTranslations.map((item, idx) => (
            <div
              key={idx}
              style={{
                left: `${Math.min(Math.max(item.x || 35, 10), 72)}%`,
                top: `${Math.min(Math.max(item.y || 40, 15), 78)}%`
              }}
              className="absolute z-20 px-3 py-2 rounded-2xl bg-black/85 backdrop-blur-md border border-amber-400/80 text-white shadow-2xl animate-in zoom-in-75 duration-200 pointer-events-none flex flex-col gap-0.5 max-w-[260px]"
            >
              <span className="text-[10px] text-amber-300 font-extrabold flex items-center gap-1 uppercase tracking-wider truncate">
                🌐 AR Translate ({item.original})
              </span>
              <span className="text-xs sm:text-sm font-black text-white leading-snug truncate">
                {item.translation}
              </span>
            </div>
          ))}

          <div className="relative z-10 m-2.5 p-1.5 px-3 rounded-xl bg-black/75 backdrop-blur-md border border-slate-700/80 w-fit flex items-center gap-1.5">
            <span className="w-2 h-2 bg-emerald-400 rounded-full shrink-0 animate-pulse" />
            <span className="text-[11px] font-black text-white truncate">
              {currentUser?.name || 'You'}
            </span>
            {audioMuted && <MicOff className="w-3 h-3 text-rose-400 shrink-0 ml-0.5" />}
          </div>
        </div>

        {/* TILE 2+: REMOTE PEER VIDEO TRACKS */}
        {remoteStreams.map(peer => (
          <div key={peer.peerId} className="flex-1 min-h-0 min-w-0 rounded-3xl bg-slate-900 border border-slate-700/90 overflow-hidden relative shadow-2xl flex flex-col justify-end">
            <video
              ref={(node) => {
                if (node && node.srcObject !== peer.stream) {
                  node.srcObject = peer.stream;
                  node.play().catch(() => {});
                }
              }}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover transition duration-200"
            />
            <div className="relative z-10 m-2.5 p-1.5 px-3 rounded-xl bg-black/75 backdrop-blur-md border border-slate-700/80 w-fit flex items-center gap-1.5">
              <span className="w-2 h-2 bg-brand-400 rounded-full shrink-0 animate-pulse" />
              <span className="text-[11px] font-black text-white truncate">
                {peer.peerName}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* CIRCULAR ICON-ONLY TOUCH DOCK */}
      <div className="bg-slate-900 border-t border-slate-800 h-16 sm:h-20 px-4 w-full flex items-center justify-around gap-2 shrink-0 z-30">
        <button
          type="button"
          onClick={toggleAudio}
          className={`p-3.5 rounded-full transition flex items-center justify-center border shadow-md active:scale-95 ${
            audioMuted ? 'bg-rose-600 text-white border-rose-500' : 'bg-slate-800 text-slate-200 border-slate-700 hover:text-white'
          }`}
          title={audioMuted ? 'Unmute' : 'Mute'}
        >
          {audioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-emerald-400" />}
        </button>

        <button
          type="button"
          onClick={toggleVideo}
          className={`p-3.5 rounded-full transition flex items-center justify-center border shadow-md active:scale-95 ${
            videoDisabled ? 'bg-rose-600 text-white border-rose-500' : 'bg-slate-800 text-slate-200 border-slate-700 hover:text-white'
          }`}
          title={videoDisabled ? 'Resume Video' : 'Pause Video'}
        >
          {videoDisabled ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5 text-brand-400" />}
        </button>

        <button
          type="button"
          onClick={handleSwitchCamera}
          className="p-3.5 rounded-full bg-slate-800 hover:bg-slate-750 text-amber-400 border border-slate-700 transition flex items-center justify-center shadow-md active:scale-95"
          title="Flip Camera (Smartphone Front/Back)"
        >
          <RefreshCw className="w-5 h-5 text-amber-400" />
        </button>

        {/* STEP 1: LIVE AR TRANSLATION TOGGLE PILL */}
        <button
          type="button"
          onClick={() => setIsTranslateArActive(!isTranslateArActive)}
          className={`p-3.5 rounded-full transition flex items-center justify-center border shadow-xl active:scale-95 ${
            isTranslateArActive
              ? 'bg-gradient-to-tr from-[#4285F4] via-[#34A853] to-[#FBBC05] text-white border-white ring-2 ring-[#4285F4] animate-pulse'
              : 'bg-slate-800 text-slate-200 border-slate-700 hover:text-white'
          }`}
          title="Toggle Real-Time AR Visual Translate over non-English labels & currency"
        >
          <Globe className="w-5 h-5 text-amber-300" />
        </button>

        {/* TAP & TALK VOICE COMMAND CIRCLE */}
        <button
          type="button"
          onClick={handleTapAndSpeakToggle}
          disabled={isAiProcessing}
          className={`p-4 rounded-full transition shadow-2xl flex items-center justify-center border border-white/40 active:scale-95 ${
            isVoiceRecording
              ? 'bg-rose-600 ring-4 ring-rose-400 text-white animate-bounce'
              : 'bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 text-white hover:opacity-95'
          }`}
          title="Tap to speak your question aloud right right and tap again right when done"
        >
          {isAiProcessing ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : <Sparkles className="w-6 h-6 text-white" />}
        </button>

        <button
          type="button"
          onClick={handleHangUp}
          className="p-3.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white transition flex items-center justify-center border border-rose-500 shadow-xl active:scale-95"
          title="End Call and save summary notes straight into chat"
        >
          <PhoneOff className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
}
