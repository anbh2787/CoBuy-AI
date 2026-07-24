'use client';

import React, { useState, useEffect, useRef } from 'react';
import { User } from '@/lib/types';
import { supabase } from '@/lib/supabaseClient';
import { Mic, MicOff, Video, VideoOff, RefreshCw, Sparkles, PhoneOff, Volume2, Loader2, Users, Globe, Activity, MessageSquare } from 'lucide-react';

interface VideoCallModalProps {
  isOpen: boolean;
  onClose: (sessionNotes: string[], lastImageBase64?: string) => void;
  groupId: string;
  groupTitle: string;
  currentUser: User | null;
  roomMembers: User[];
  messages?: any[];
  onSendMessage?: (text: string) => void;
}

interface ARTranslationItem {
  title?: string;
  features?: string;
  instructions?: string;
  precautions?: string;
  original?: string;
  translation?: string;
  x?: number;
  y?: number;
}

interface TouchTargetState {
  x: number;
  y: number;
  label?: string;
  isLoading?: boolean;
  authorName?: string;
}

interface RcaLogEntry {
  time: string;
  event: string;
  details: string;
}

export default function VideoCallModal({ isOpen, onClose, groupId, groupTitle, currentUser, roomMembers, messages, onSendMessage }: VideoCallModalProps) {
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoDisabled, setVideoDisabled] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Array<{ peerId: string; peerName: string; stream: MediaStream }>>([]);
  const [telemetryStatus, setTelemetryStatus] = useState<string>('Tap ANY video item to target • Tap ✨ to speak • Tap 🌐 for AR');

  // STEP 1: LIVE AR TRANSLATION LAYER STATE & TARGETED PEER MAP
  const [isTranslateArActive, setIsTranslateArActive] = useState(false);
  const [arTranslations, setArTranslations] = useState<ARTranslationItem[]>([]);
  const [remoteArMap, setRemoteArMap] = useState<Record<string, ARTranslationItem[]>>({});

  // STEP 2 & 3: LOCAL + REMOTE TOUCH TARGET BOUNDING STATE
  const [activeTouchTarget, setActiveTouchTarget] = useState<TouchTargetState | null>(null);
  const [remoteTouchMap, setRemoteTouchMap] = useState<Record<string, TouchTargetState | null>>({});

  // STEP 4: IMMERSIVE FULL-SCREEN TRANSLUCENT CHAT DRAWER STATE
  const [isChatOverlayOpen, setIsChatOverlayOpen] = useState(false);
  const [drawerInput, setDrawerInput] = useState('');

  // DIAGNOSTIC WEBRTC INSTRUMENTATION & RCA PANEL STATE
  const [rcaLogs, setRcaLogs] = useState<RcaLogEntry[]>([]);
  const [showRcaPanel, setShowRcaPanel] = useState<boolean>(false);

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
  const targetTimeoutRef = useRef<any>(null);

  const logRcaInstrument = (event: string, details: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.info(`[WebRTC RCA Telemetry • ${timestamp}] ${event}: ${details}`);
    setRcaLogs(prev => [...prev.slice(-35), { time: timestamp, event, details }]);
  };

  useEffect(() => {
    let isMounted = true;
    if (isOpen && currentUser) {
      sessionNotesRef.current = [];
      lastCapturedImageRef.current = undefined;
      setArTranslations([]);
      setActiveTouchTarget(null);
      setRemoteTouchMap({});
      setRcaLogs([]);

      const initStudioSequence = async () => {
        logRcaInstrument('INIT_START', `User ${currentUser.name} (${currentUser.id}) opened studio inside room ${groupId}. Acquiring camera tracks strictly prior to channel signaling...`);
        const isMobile = typeof window !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const initialMode = isMobile ? 'environment' : 'user';
        setFacingMode(initialMode);
        const cameraReady = await startLocalWebcam(initialMode);
        if (!isMounted) return;
        logRcaInstrument('INIT_CAMERA', cameraReady ? 'Local hardware webcam tracks loaded right successfully' : 'Warning: Local hardware device returned zero stream tracks');
        setupWebRTCSignaling();
      };

      initStudioSequence();
    } else {
      cleanupSession();
    }
    return () => {
      isMounted = false;
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
            if (channelRef.current && currentUser) {
              channelRef.current.send({
                type: 'broadcast',
                event: 'ar-sync',
                payload: { peerId: currentUser.id, translations: data.translations }
              });
            }
            data.translations.forEach((item: ARTranslationItem) => {
              const fullDetails = `🌐 AR Translation Complete:\n• Item & Brand: ${item.title || item.translation || 'Product'}\n• Highlights: ${item.features || 'N/A'}\n• Directions: ${item.instructions || 'N/A'}\n• Precautions: ${item.precautions || 'N/A'}`;
              if (!sessionNotesRef.current.some(note => note.includes(item.title || item.translation || 'Item'))) {
                sessionNotesRef.current = [...sessionNotesRef.current, fullDetails];
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
        setTelemetryStatus('Tap ANY video item to target • Tap ✨ to speak • Tap 🌐 for AR');
        setArTranslations([]);
        if (channelRef.current && currentUser) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'ar-sync',
            payload: { peerId: currentUser.id, translations: [] }
          });
        }
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

  const speakWithHumanVoice = async (text: string, onFinish?: () => void) => {
    try {
      if (typeof window === 'undefined') return;
      
      // Attempt immediate High-Def Cloud MP3 Audio Stream (`Zero Monotone OS limitations`)
      try {
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.audioUrl) {
            const audio = new Audio(data.audioUrl);
            audio.onended = () => { if (onFinish) onFinish(); };
            audio.onerror = () => { fallbackToWebSpeech(text, onFinish); };
            await audio.play();
            return;
          }
        }
      } catch (networkErr) {
        console.warn("Cloud high-def TTS unreachable, applying high-fidelity local voice fallback right now:", networkErr);
      }

      fallbackToWebSpeech(text, onFinish);
    } catch (e) {
      if (onFinish) onFinish();
    }
  };

  const fallbackToWebSpeech = (text: string, onFinish?: () => void) => {
    try {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        if (onFinish) onFinish();
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const humanVoice = voices.find(v => v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Google US English') || v.name.includes('Samantha') || v.name.includes('Jenny') || v.name.includes('Aria')) || voices.find(v => v.lang.startsWith('en') && !v.name.includes('Desktop')) || voices[0];
      if (humanVoice) utterance.voice = humanVoice;
      utterance.rate = 1.05;
      utterance.pitch = 1.02;
      utterance.onend = () => { if (onFinish) onFinish(); };
      utterance.onerror = () => { if (onFinish) onFinish(); };
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      if (onFinish) onFinish();
    }
  };

  const startLocalWebcam = async (mode: 'user' | 'environment'): Promise<boolean> => {
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
        return true;
      }
      return false;
    } catch (err: any) {
      logRcaInstrument('CAMERA_ERROR', `Could not attach physical device track: ${err?.message || err}`);
      return false;
    }
  };

  const setupWebRTCSignaling = () => {
    if (!currentUser) return;
    const channel = supabase.channel(`webrtc_call_${groupId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'peer-join' }, async ({ payload }) => {
        if (payload.userId === currentUser.id) return;
        logRcaInstrument('PEER_JOIN', `New entrant detected: ${payload.userName} (${payload.userId}). Creating initiator offer connection...`);
        const stalePc = peerConnectionsRef.current.get(payload.userId);
        if (stalePc) {
          stalePc.close();
          peerConnectionsRef.current.delete(payload.userId);
        }
        createPeerConnection(payload.userId, payload.userName, true);
      })
      .on('broadcast', { event: 'webrtc-offer' }, async ({ payload }) => {
        if (payload.targetId !== currentUser.id) return;
        logRcaInstrument('WEBRTC_OFFER', `Received remote SDP offer directly from ${payload.senderName}. Generating SDP answer right right now...`);
        const stalePc = peerConnectionsRef.current.get(payload.senderId);
        if (stalePc && stalePc.signalingState !== 'stable') {
          stalePc.close();
          peerConnectionsRef.current.delete(payload.senderId);
        }
        const pc = peerConnectionsRef.current.get(payload.senderId) || createPeerConnection(payload.senderId, payload.senderName, false);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        channel.send({
          type: 'broadcast',
          event: 'webrtc-answer',
          payload: { targetId: payload.senderId, senderId: currentUser.id, answer }
        });
        logRcaInstrument('SDP_ANSWER_SENT', `Transmitted SDP answer back directly to ${payload.senderName}.`);
      })
      .on('broadcast', { event: 'webrtc-answer' }, async ({ payload }) => {
        if (payload.targetId !== currentUser.id) return;
        logRcaInstrument('WEBRTC_ANSWER', `Received remote SDP answer ACK right from ${payload.senderId}. Setting remote description right now...`);
        const pc = peerConnectionsRef.current.get(payload.senderId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
        } else {
          logRcaInstrument('RCA_WARNING', `Received SDP answer for unknown connection ID ${payload.senderId}`);
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.targetId !== currentUser.id) return;
        const pc = peerConnectionsRef.current.get(payload.senderId);
        if (pc && payload.candidate) {
          pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
        }
      })
      .on('broadcast', { event: 'peer-leave' }, async ({ payload }) => {
        if (payload.userId === currentUser.id) return;
        logRcaInstrument('PEER_LEAVE', `User ${payload.userName || payload.userId} left call. Cleaning remote stream tile right now...`);
        const pc = peerConnectionsRef.current.get(payload.userId);
        if (pc) {
          pc.close();
          peerConnectionsRef.current.delete(payload.userId);
        }
        setRemoteStreams(prev => prev.filter(s => s.peerId !== payload.userId));
      })
      .on('broadcast', { event: 'ar-sync' }, ({ payload }) => {
        if (payload.peerId && payload.translations) {
          setRemoteArMap(prev => ({ ...prev, [payload.peerId]: payload.translations }));
        }
      })
      .on('broadcast', { event: 'touch-target-sync' }, ({ payload }) => {
        if (payload.peerId) {
          if (payload.peerId === currentUser.id) {
            setActiveTouchTarget(payload.target || null);
          } else {
            setRemoteTouchMap(prev => ({ ...prev, [payload.peerId]: payload.target }));
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && currentUser) {
          logRcaInstrument('CHANNEL_SUCCEEDED', `Signaling subscribed directly inside room webrtc_call_${groupId}. Announcing presence right via peer-join...`);
          channel.send({
            type: 'broadcast',
            event: 'peer-join',
            payload: { userId: currentUser.id, userName: currentUser.name }
          });
        } else {
          logRcaInstrument('CHANNEL_STATUS', `Supabase status right now: ${status}`);
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

    pc.onconnectionstatechange = () => {
      logRcaInstrument('CONN_STATE', `Link right with ${remoteUserName} changed to ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        logRcaInstrument('RCA_RECOVERY', `Connection dropped with ${remoteUserName}. Retrying connection cleanup right now.`);
      }
    };

    if (localStreamRef.current && localStreamRef.current.getTracks().length > 0) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
      logRcaInstrument('TRACKS_ATTACHED', `Attached ${localStreamRef.current.getTracks().length} physical video/audio tracks straight to ${remoteUserName}.`);
    } else {
      logRcaInstrument('RCA_ERROR', `createPeerConnection run while localStreamRef has zero active tracks for ${remoteUserName}!`);
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
        logRcaInstrument('REMOTE_TRACK_RECEIVED', `Received active live video track straight from peer ${remoteUserName}! Displaying across tile right now.`);
        setRemoteStreams(prev => {
          const filtered = prev.filter(s => s.peerId !== remoteUserId);
          return [...filtered, { peerId: remoteUserId, peerName: remoteUserName, stream }];
        });
      }
    };

    if (isInitiator && channelRef.current && currentUser) {
      pc.createOffer().then(offer => {
        pc.setLocalDescription(offer);
        channelRef.current!.send({
          type: 'broadcast',
          event: 'webrtc-offer',
          payload: { targetId: remoteUserId, senderId: currentUser.id, senderName: currentUser.name, offer }
        });
      }).catch(err => {
        logRcaInstrument('SDP_OFFER_ERROR', `Failed generating offer right for ${remoteUserName}: ${err?.message}`);
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

  // STEP 2: LOCAL VIDEO TOUCH-TO-IDENTIFY
  const handleTouchIdentify = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (isAiProcessing || videoDisabled || isVoiceRecording) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    if (activeTouchTarget && Math.abs(activeTouchTarget.x - clickX) < 8 && Math.abs(activeTouchTarget.y - clickY) < 8) {
      setActiveTouchTarget(null);
      if (targetTimeoutRef.current) clearTimeout(targetTimeoutRef.current);
      if (channelRef.current && currentUser) {
        channelRef.current.send({ type: 'broadcast', event: 'touch-target-sync', payload: { peerId: currentUser.id, target: null } });
      }
      return;
    }

    if (targetTimeoutRef.current) clearTimeout(targetTimeoutRef.current);

    const newTarget: TouchTargetState = { x: Math.round(clickX), y: Math.round(clickY), isLoading: true, authorName: currentUser?.name || 'You' };
    setActiveTouchTarget(newTarget);
    playTouchTone('start');
    unlockSpeechSynthesisSynchronously();

    if (channelRef.current && currentUser) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'touch-target-sync',
        payload: { peerId: currentUser.id, target: newTarget }
      });
    }

    captureFrameAndSendToAi(undefined, { x: newTarget.x, y: newTarget.y });
  };

  // STEP 3: REMOTE PEER VIDEO TOUCH & SHARED POINTER EXTENSION
  const handleRemoteTouchIdentify = async (
    e: React.MouseEvent<HTMLDivElement>,
    remotePeerId: string,
    remotePeerName: string,
    remoteVideoEl: HTMLVideoElement | null
  ) => {
    if (isAiProcessing || isVoiceRecording) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    const existingTarget = remoteTouchMap[remotePeerId];
    if (existingTarget && Math.abs(existingTarget.x - clickX) < 8 && Math.abs(existingTarget.y - clickY) < 8) {
      setRemoteTouchMap(prev => ({ ...prev, [remotePeerId]: null }));
      if (channelRef.current && currentUser) {
        channelRef.current.send({ type: 'broadcast', event: 'touch-target-sync', payload: { peerId: remotePeerId, target: null } });
      }
      return;
    }

    const newTarget: TouchTargetState = { x: Math.round(clickX), y: Math.round(clickY), isLoading: true, authorName: currentUser?.name || 'You' };
    setRemoteTouchMap(prev => ({ ...prev, [remotePeerId]: newTarget }));
    playTouchTone('start');
    unlockSpeechSynthesisSynchronously();

    if (channelRef.current && currentUser) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'touch-target-sync',
        payload: { peerId: remotePeerId, target: { ...newTarget, authorName: currentUser?.name || 'Friend' } }
      });
    }

    if (!remoteVideoEl) return;

    setIsAiProcessing(true);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsAiSpeaking(false);
    setTelemetryStatus(`Inspecting item touched directly inside ${remotePeerName}'s video...`);

    setTimeout(async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = remoteVideoEl.videoWidth || 1280;
        canvas.height = remoteVideoEl.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        if (!ctx) { setIsAiProcessing(false); return; }

        ctx.drawImage(remoteVideoEl, 0, 0, canvas.width, canvas.height);
        const base64Frame = canvas.toDataURL('image/jpeg', 0.88);
        lastCapturedImageRef.current = base64Frame;

        const response = await fetch('/api/live-call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            frameBase64: base64Frame,
            touchTarget: { x: newTarget.x, y: newTarget.y },
            remotePeerName: remotePeerName,
            currentUserName: currentUser?.name || 'Anuj'
          })
        });

        const data = await response.json();
        const reply = data.spokenReply || `I verified your remote touch target right now!`;
        const targetLabel = data.telemetry?.targetLabel || reply.split('.')[0] || 'Target Item';

        setIsAiProcessing(false);
        setIsAiSpeaking(true);
        setTelemetryStatus(`Target across ${remotePeerName}'s view confirmed: ${targetLabel}`);

        const resolvedTarget: TouchTargetState = { x: newTarget.x, y: newTarget.y, label: targetLabel, isLoading: false, authorName: currentUser?.name || 'You' };
        setRemoteTouchMap(prev => ({ ...prev, [remotePeerId]: resolvedTarget }));
        if (channelRef.current && currentUser) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'touch-target-sync',
            payload: { peerId: remotePeerId, target: { ...resolvedTarget, authorName: currentUser.name } }
          });
        }

        setTimeout(() => {
          setRemoteTouchMap(prev => ({ ...prev, [remotePeerId]: null }));
          if (channelRef.current && currentUser) {
            channelRef.current.send({ type: 'broadcast', event: 'touch-target-sync', payload: { peerId: remotePeerId, target: null } });
          }
        }, 5000);

        const cleanLogSummary = `🎯 Targeted Item straight across ${remotePeerName}'s Video: "${reply}"`;
        sessionNotesRef.current = [...sessionNotesRef.current, cleanLogSummary];

        speakWithHumanVoice(reply, () => setIsAiSpeaking(false));
      } catch (err: any) {
        setIsAiProcessing(false);
        console.warn('Remote video check warning:', err);
      }
    }, 110);
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
          setTelemetryStatus('Evaluating visual parameters right now...');
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

  const captureFrameAndSendToAi = (recordedAudioBase64?: string, touchedCoords?: { x: number; y: number }) => {
    if (!localVideoRef.current || isAiProcessing) return;

    setIsAiProcessing(true);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsAiSpeaking(false);
    setTelemetryStatus(touchedCoords ? 'Scanning target item beneath crosshair...' : 'Processing conversational answer...');

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
            questionText: recordedAudioBase64 ? undefined : "Describe what physical object appears right inside this picture out loud.",
            touchTarget: touchedCoords || null,
            currentUserName: currentUser?.name || 'Anuj'
          })
        });

        const data = await response.json();
        const reply = data.spokenReply || `I verified your targeted view right now!`;
        const targetLabel = data.telemetry?.targetLabel || reply.split('.')[0] || 'Target Item';

        setIsAiProcessing(false);
        setIsAiSpeaking(true);
        setTelemetryStatus(touchedCoords ? `Target confirmed: ${targetLabel}` : `Observation complete.`);

        if (touchedCoords) {
          const resolvedTarget: TouchTargetState = { x: touchedCoords.x, y: touchedCoords.y, label: targetLabel, isLoading: false, authorName: currentUser?.name || 'You' };
          setActiveTouchTarget(resolvedTarget);
          if (channelRef.current && currentUser) {
            channelRef.current.send({
              type: 'broadcast',
              event: 'touch-target-sync',
              payload: { peerId: currentUser.id, target: resolvedTarget }
            });
          }

          if (targetTimeoutRef.current) clearTimeout(targetTimeoutRef.current);
          targetTimeoutRef.current = setTimeout(() => {
            setActiveTouchTarget(null);
            if (channelRef.current && currentUser) {
              channelRef.current.send({ type: 'broadcast', event: 'touch-target-sync', payload: { peerId: currentUser.id, target: null } });
            }
          }, 5000);
        }

        const cleanLogSummary = touchedCoords
          ? `🎯 Targeted Item from Video: "${reply}"`
          : `📸 AI Video Observation: "${reply}"`;
        sessionNotesRef.current = [...sessionNotesRef.current, cleanLogSummary];

        speakWithHumanVoice(reply, () => setIsAiSpeaking(false));
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
    if (targetTimeoutRef.current) clearTimeout(targetTimeoutRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try { mediaRecorderRef.current.stop(); } catch (err) { /* no-op */ }
    }

    if (channelRef.current && currentUser) {
      logRcaInstrument('PEER_LEAVE_TRANSMIT', 'Sending peer-leave explicit disconnect broadcast prior to cleanup');
      try {
        channelRef.current.send({
          type: 'broadcast',
          event: 'peer-leave',
          payload: { userId: currentUser.id, userName: currentUser.name }
        });
      } catch (e) { /* no-op */ }
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
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
    setRemoteStreams([]);
    setIsTranslateArActive(false);
    setArTranslations([]);
    setActiveTouchTarget(null);
    setRemoteTouchMap({});
  };

  const handleHangUp = () => {
    cleanupSession();
    onClose([...sessionNotesRef.current], lastCapturedImageRef.current);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[170] bg-slate-950 flex flex-col justify-between overflow-hidden animate-in fade-in duration-150">
      
      {/* MINIMALIST HEADER BAR (`Zero Verbosity + Diagnostic RCA & Chat Overlay Drawer`) */}
      <div className="bg-slate-900 border-b border-slate-800 px-3.5 py-2.5 flex items-center justify-between shrink-0 shadow-lg z-30">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shrink-0" />
          <span className="font-extrabold text-white text-xs sm:text-sm truncate">
            {groupTitle || 'Live Video Studio'}
          </span>
          <span className="text-[10px] font-mono text-slate-300 bg-slate-800 border border-slate-700 px-2.5 py-0.5 rounded-md hidden md:block truncate max-w-[280px]">
            {telemetryStatus}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* STEP 4: TRANSLUCENT FROSTED CHAT OVERLAY TOGGLE */}
          <button
            type="button"
            onClick={() => setIsChatOverlayOpen(!isChatOverlayOpen)}
            className={`text-[11px] font-extrabold px-2.5 py-1 rounded-xl border flex items-center gap-1.5 transition shadow-md active:scale-95 ${
              isChatOverlayOpen ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 border-emerald-400 font-black' : 'bg-slate-800 text-white border-slate-700 hover:bg-slate-750'
            }`}
            title="Toggle Translucent Frosted-Glass Chat Drawer over Video"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat ({messages?.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRcaPanel(!showRcaPanel)}
            className={`text-[11px] font-bold px-2 py-1 rounded-xl border flex items-center gap-1 transition ${
              showRcaPanel ? 'bg-brand-600 text-white border-brand-400' : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
            title="Inspect Factual WebRTC RCA Instrumentation Telemetry Logs"
          >
            <Activity className="w-3.5 h-3.5 text-brand-400" /> RCA ({rcaLogs.length})
          </button>

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

      {/* EXPANDABLE DIAGNOSTIC FACTUAL RCA PANEL */}
      {showRcaPanel && (
        <div className="bg-slate-900/95 backdrop-blur-xl border-b border-slate-700 max-h-56 overflow-y-auto px-4 py-3 z-50 shrink-0 text-xs font-mono text-slate-200 shadow-2xl animate-in slide-in-from-top-3 duration-150">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2 font-black text-white">
            <span>🔬 FACTUAL WEBRTC RCA DIAGNOSTIC TELEMETRY LOG</span>
            <button type="button" onClick={() => setShowRcaPanel(false)} className="text-slate-400 hover:text-white font-sans text-xs">✕ Close Panel</button>
          </div>
          {rcaLogs.length === 0 ? (
            <p className="text-slate-400 italic py-1">No diagnostic connection events recorded right inside this session yet.</p>
          ) : (
            <div className="space-y-1">
              {rcaLogs.map((log, index) => (
                <div key={index} className="flex gap-2 border-b border-slate-800/50 pb-1 leading-snug">
                  <span className="text-amber-400 shrink-0 font-bold">[{log.time}] {log.event}:</span>
                  <span className="text-slate-200 break-words">{log.details}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP 4: FULL-SCREEN IMMERSIVE TRANSLUCENT FROSTED CHAT DRAWER */}
      {isChatOverlayOpen && (
        <div className="absolute right-0 sm:right-3 top-12 sm:top-14 bottom-16 sm:bottom-20 w-full sm:w-[380px] bg-slate-950/85 backdrop-blur-2xl sm:rounded-3xl border-l sm:border sm:border-slate-700/80 shadow-2xl z-40 flex flex-col overflow-hidden animate-in slide-in-from-right-3 duration-200 pointer-events-auto">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between font-black text-white text-xs bg-slate-900/60 shrink-0">
            <span className="flex items-center gap-1.5 text-amber-300">💬 Immersive Studio Timeline</span>
            <button type="button" onClick={() => setIsChatOverlayOpen(false)} className="text-slate-400 hover:text-white p-1 text-xs">✕ Close</button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3 font-sans">
            {(!messages || messages.length === 0) && (
              <p className="text-xs text-slate-400 italic text-center py-8">No messages in this workspace yet. Touch objects across video or type below!</p>
            )}
            {(messages || []).map((m: any) => (
              <div key={m.id} className={`flex flex-col ${m.senderId === currentUser?.id ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] font-bold text-slate-400 mb-0.5 truncate max-w-[200px]">{m.senderName}</span>
                <div className={`p-3 rounded-2xl text-xs font-semibold max-w-[88%] leading-relaxed shadow-lg ${m.senderId === currentUser?.id ? 'bg-[#2B4C7E] text-white rounded-tr-none' : 'bg-slate-800 border border-slate-700 text-white rounded-tl-none'}`}>
                  <div className="whitespace-pre-wrap">{m.content ? m.content.replace(/<!--SHOPPY_DATA:[\s\S]*?-->/g, '') : ''}</div>
                </div>
              </div>
            ))}
          </div>

          {onSendMessage && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!drawerInput.trim()) return;
                onSendMessage(drawerInput.trim());
                setDrawerInput('');
              }}
              className="p-2.5 bg-slate-900/90 border-t border-slate-800 flex gap-2 shrink-0"
            >
              <input
                type="text"
                value={drawerInput}
                onChange={(e) => setDrawerInput(e.target.value)}
                placeholder="Message while on camera..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-400 transition"
              />
              <button type="submit" disabled={!drawerInput.trim()} className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black text-xs transition disabled:opacity-40 active:scale-95 shadow-md">Send</button>
            </form>
          )}
        </div>
      )}

      {/* SINGLE-SCREEN VIEWPORT FIT (`No bottom cropping`) */}
      <div className="w-full flex-1 min-h-0 h-[calc(100vh-130px)] max-h-[calc(100vh-130px)] p-2 sm:p-4 flex flex-col sm:flex-row gap-2.5 overflow-hidden relative">
        
        {/* TILE 1: YOUR LIVE WEBCAM DISPLAY + TOUCH-TO-IDENTIFY SURFACE */}
        <div
          onClick={handleTouchIdentify}
          className="flex-1 min-h-0 min-w-0 rounded-3xl bg-slate-900 border border-slate-700/90 overflow-hidden relative shadow-2xl flex flex-col justify-end cursor-crosshair sm:cursor-pointer select-none"
        >
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
              className="absolute inset-0 w-full h-full object-cover transition duration-200 pointer-events-none"
            />
          )}

          {/* STEP 2: INTERACTIVE TOUCH-TO-IDENTIFY TARGET RING (`5-Second Auto-Fade`) */}
          {activeTouchTarget && (
            <div
              style={{ left: `${activeTouchTarget.x}%`, top: `${activeTouchTarget.y}%`, transform: 'translate(-50%, -50%)' }}
              className="absolute z-30 flex flex-col items-center pointer-events-none animate-in zoom-in-75 duration-200"
            >
              <div className="w-11 h-11 rounded-full border-2 border-amber-400 bg-amber-400/25 ring-4 ring-amber-400/30 animate-ping absolute inset-0" />
              <div className="w-11 h-11 rounded-full border-2 border-white flex items-center justify-center bg-black/45 backdrop-blur-xs relative shadow-2xl">
                <span className="text-sm">🎯</span>
              </div>
              
              {activeTouchTarget.isLoading ? (
                <span className="mt-1.5 bg-slate-900/90 text-amber-300 border border-slate-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-xl whitespace-nowrap">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> {activeTouchTarget.authorName ? `${activeTouchTarget.authorName} targeting...` : `Identifying...`}
                </span>
              ) : activeTouchTarget.label ? (
                <span className="mt-1.5 bg-[#22252A]/95 text-white border-2 border-amber-400 px-3.5 py-1.5 rounded-2xl text-xs font-black shadow-2xl whitespace-nowrap tracking-tight flex flex-col sm:flex-row sm:items-center gap-1 text-center">
                  <span className="text-amber-400 font-extrabold text-[10px] uppercase">{activeTouchTarget.authorName && activeTouchTarget.authorName !== 'You' ? `${activeTouchTarget.authorName}:` : '🎯'}</span>
                  <span>{activeTouchTarget.label}</span>
                </span>
              ) : null}
            </div>
          )}

          {/* COMPREHENSIVE MULTI-SECTION OPTICAL OVERLAY CARD */}
          {arTranslations.slice(0, 1).map((item, idx) => (
            <div
              key={idx}
              style={{
                left: `${Math.min(Math.max(item.x || 48, 20), 60)}%`,
                top: `${Math.min(Math.max(item.y || 48, 20), 70)}%`,
                transform: 'translate(-50%, -50%)'
              }}
              className="absolute z-20 w-[88%] max-w-[320px] p-3 sm:p-4 rounded-3xl bg-[#22252A]/90 backdrop-blur-xl border border-amber-400/80 text-amber-300 shadow-2xl animate-in zoom-in-95 duration-150 pointer-events-none flex flex-col gap-2 text-left"
            >
              <div className="font-extrabold text-white text-xs sm:text-sm tracking-tight border-b border-white/10 pb-1.5 flex items-center gap-1.5">
                <span>🏷️</span>
                <span className="truncate">{item.title || item.translation}</span>
              </div>
              
              {item.features && (
                <div className="text-[11px] sm:text-xs font-semibold text-slate-200 leading-tight">
                  <strong className="text-emerald-400 font-bold">Features:</strong> {item.features}
                </div>
              )}
              
              {item.instructions && (
                <div className="text-[11px] sm:text-xs font-semibold text-slate-200 leading-tight">
                  <strong className="text-amber-300 font-bold">How to Use:</strong> {item.instructions}
                </div>
              )}

              {item.precautions && (
                <div className="text-[11px] sm:text-xs font-bold text-rose-300 bg-rose-950/40 p-2 rounded-xl border border-rose-500/30 leading-tight">
                  <strong className="text-rose-400 uppercase">Caution:</strong> {item.precautions}
                </div>
              )}
            </div>
          ))}

          <div className="relative z-10 m-2.5 p-1.5 px-3 rounded-xl bg-black/75 backdrop-blur-md border border-slate-700/80 w-fit flex items-center gap-1.5 pointer-events-none">
            <span className="w-2 h-2 bg-emerald-400 rounded-full shrink-0 animate-pulse" />
            <span className="text-[11px] font-black text-white truncate">
              {currentUser?.name || 'You'}
            </span>
            {audioMuted && <MicOff className="w-3 h-3 text-rose-400 shrink-0 ml-0.5" />}
          </div>
        </div>

        {/* TILE 2+: REMOTE PEER VIDEO TRACKS + STEP 3 REMOTE TOUCH INTERACTIVITY */}
        {remoteStreams.map(peer => {
          const peerArItems = remoteArMap[peer.peerId] || [];
          const peerTouchTarget = remoteTouchMap[peer.peerId];

          return (
            <div
              key={peer.peerId}
              onClick={(e) => handleRemoteTouchIdentify(e, peer.peerId, peer.peerName, e.currentTarget.querySelector('video'))}
              className="flex-1 min-h-0 min-w-0 rounded-3xl bg-slate-900 border border-slate-700/90 overflow-hidden relative shadow-2xl flex flex-col justify-end cursor-crosshair sm:cursor-pointer select-none"
            >
              <video
                ref={(node) => {
                  if (node && node.srcObject !== peer.stream) {
                    node.srcObject = peer.stream;
                    node.play().catch(() => {});
                  }
                }}
                autoPlay
                playsInline
                className="absolute inset-0 w-full h-full object-cover transition duration-200 pointer-events-none"
              />

              {/* STEP 3 REMOTE PEER TOUCH TARGET RING */}
              {peerTouchTarget && (
                <div
                  style={{ left: `${peerTouchTarget.x}%`, top: `${peerTouchTarget.y}%`, transform: 'translate(-50%, -50%)' }}
                  className="absolute z-30 flex flex-col items-center pointer-events-none animate-in zoom-in-75 duration-200"
                >
                  <div className="w-11 h-11 rounded-full border-2 border-amber-400 bg-amber-400/25 ring-4 ring-amber-400/30 animate-ping absolute inset-0" />
                  <div className="w-11 h-11 rounded-full border-2 border-white flex items-center justify-center bg-black/45 backdrop-blur-xs relative shadow-2xl">
                    <span className="text-sm">🎯</span>
                  </div>
                  
                  {peerTouchTarget.isLoading ? (
                    <span className="mt-1.5 bg-slate-900/90 text-amber-300 border border-slate-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-xl whitespace-nowrap">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> {peerTouchTarget.authorName ? `${peerTouchTarget.authorName} tapping...` : `Identifying...`}
                    </span>
                  ) : peerTouchTarget.label ? (
                    <span className="mt-1.5 bg-[#22252A]/95 text-white border-2 border-amber-400 px-3.5 py-1.5 rounded-2xl text-xs font-black shadow-2xl whitespace-nowrap tracking-tight flex flex-col sm:flex-row sm:items-center gap-1 text-center">
                      <span className="text-amber-400 font-extrabold text-[10px] uppercase">{peerTouchTarget.authorName && peerTouchTarget.authorName !== 'You' ? `${peerTouchTarget.authorName}'s pointer:` : '🎯'}</span>
                      <span>{peerTouchTarget.label}</span>
                    </span>
                  ) : null}
                </div>
              )}

              {/* TARGETED PEER AR OVERLAY */}
              {peerArItems.slice(0, 1).map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    left: `${Math.min(Math.max(item.x || 48, 20), 60)}%`,
                    top: `${Math.min(Math.max(item.y || 48, 20), 70)}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                  className="absolute z-20 w-[88%] max-w-[320px] p-3 sm:p-4 rounded-3xl bg-[#22252A]/90 backdrop-blur-xl border border-amber-400/80 text-amber-300 shadow-2xl animate-in zoom-in-95 duration-150 pointer-events-none flex flex-col gap-2 text-left"
                >
                  <div className="font-extrabold text-white text-xs sm:text-sm tracking-tight border-b border-white/10 pb-1.5 flex items-center gap-1.5">
                    <span>🏷️</span>
                    <span className="truncate">{item.title || item.translation}</span>
                  </div>
                  
                  {item.features && (
                    <div className="text-[11px] sm:text-xs font-semibold text-slate-200 leading-tight">
                      <strong className="text-emerald-400 font-bold">Features:</strong> {item.features}
                    </div>
                  )}
                  
                  {item.instructions && (
                    <div className="text-[11px] sm:text-xs font-semibold text-slate-200 leading-tight">
                      <strong className="text-amber-300 font-bold">How to Use:</strong> {item.instructions}
                    </div>
                  )}

                  {item.precautions && (
                    <div className="text-[11px] sm:text-xs font-bold text-rose-300 bg-rose-950/40 p-2 rounded-xl border border-rose-500/30 leading-tight">
                      <strong className="text-rose-400 uppercase">Caution:</strong> {item.precautions}
                    </div>
                  )}
                </div>
              ))}

              <div className="relative z-10 m-2.5 p-1.5 px-3 rounded-xl bg-black/75 backdrop-blur-md border border-slate-700/80 w-fit flex items-center gap-1.5 pointer-events-none">
                <span className="w-2 h-2 bg-brand-400 rounded-full shrink-0 animate-pulse" />
                <span className="text-[11px] font-black text-white truncate">
                  {peer.peerName}
                </span>
              </div>
            </div>
          );
        })}
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
          title="Toggle Real-Time AR Visual Translate over non-English labels"
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
          title="Tap to speak your question aloud and tap again right right right when done"
        >
          {isAiProcessing ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : <Sparkles className="w-6 h-6 text-white" />}
        </button>

        <button
          type="button"
          onClick={handleHangUp}
          className="p-3.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white transition flex items-center justify-center border border-rose-500 shadow-xl active:scale-95"
          title="End Call and save clean summary notes into group chat timeline"
        >
          <PhoneOff className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
}
