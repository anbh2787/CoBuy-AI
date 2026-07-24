'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Group, User } from '@/lib/types';
import { supabase } from '@/lib/supabaseClient';
import { fetchUserPrivateGroups, createPrivateGroup, syncGoogleProfileToDatabase } from '@/lib/sync';
import { Plus, Users, Sparkles, Camera, CreditCard, Lock, ArrowRight, Loader2, Video, ShoppingBag, X, ChevronRight, RefreshCw, Globe, Volume2, Mic, MicOff } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [privateGroups, setPrivateGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');

  // STEP 5: HOMEPAGE LIVE VIEWFINDER MIRROR & INTERACTIVE STUDIO STATE
  const [isViewfinderActive, setIsViewfinderActive] = useState<boolean>(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  const [isHomeAiProcessing, setIsHomeAiProcessing] = useState(false);
  const [isHomeAiSpeaking, setIsHomeAiSpeaking] = useState(false);
  const [isHomeVoiceRecording, setIsHomeVoiceRecording] = useState(false);
  const [homeStatus, setHomeStatus] = useState<string>('Tap ANY viewfinder item to target • Tap ✨ to speak • Tap 🌐 for AR');
  const [isHomeTranslateArActive, setIsHomeTranslateArActive] = useState(false);
  const [homeArTranslations, setHomeArTranslations] = useState<any[]>([]);
  const [homeTouchTarget, setHomeTouchTarget] = useState<{ x: number; y: number; label?: string; isLoading?: boolean } | null>(null);
  const [homeQuestionInput, setHomeQuestionInput] = useState('');
  const [homeAiAnswer, setHomeAiAnswer] = useState<string | null>(null);

  const homeVideoRef = useRef<HTMLVideoElement | null>(null);
  const homeStreamRef = useRef<MediaStream | null>(null);
  const homeAudioChunksRef = useRef<Blob[]>([]);
  const homeMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const homeArIntervalRef = useRef<any>(null);
  const homeTimeoutRef = useRef<any>(null);

  const speakWithHumanVoice = async (text: string, onFinish?: () => void) => {
    try {
      if (typeof window === 'undefined') return;
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
      } catch (e) { /* no-op */ }
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
      const humanVoice = voices.find(v => v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Google US English') || v.name.includes('Samantha') || v.name.includes('Jenny')) || voices.find(v => v.lang.startsWith('en')) || voices[0];
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

  const startHomeViewfinder = async (mode: 'user' | 'environment') => {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        if (homeStreamRef.current) {
          homeStreamRef.current.getTracks().forEach(t => t.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        homeStreamRef.current = stream;
        if (homeVideoRef.current) {
          homeVideoRef.current.srcObject = stream;
          homeVideoRef.current.play().catch(() => {});
        }
        setIsViewfinderActive(true);
      }
    } catch (err) {
      console.warn('Could not launch homepage camera preview track:', err);
      setIsViewfinderActive(false);
    }
  };

  const stopHomeViewfinder = () => {
    if (homeTimeoutRef.current) clearTimeout(homeTimeoutRef.current);
    if (homeArIntervalRef.current) clearInterval(homeArIntervalRef.current);
    if (homeMediaRecorderRef.current && homeMediaRecorderRef.current.state === 'recording') {
      try { homeMediaRecorderRef.current.stop(); } catch (err) { /* no-op */ }
    }
    if (homeStreamRef.current) {
      homeStreamRef.current.getTracks().forEach(t => t.stop());
      homeStreamRef.current = null;
    }
    setIsViewfinderActive(false);
  };

  // LIVE AR TRANSLATION LOOP FOR HOMEPAGE
  useEffect(() => {
    if (isHomeTranslateArActive && isViewfinderActive) {
      setHomeStatus('🌐 AR Translate Active: Scanning physical signage & labels right now...');
      homeArIntervalRef.current = setInterval(async () => {
        if (!homeVideoRef.current) return;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = homeVideoRef.current.videoWidth || 1280;
          canvas.height = homeVideoRef.current.videoHeight || 720;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(homeVideoRef.current, 0, 0, canvas.width, canvas.height);
          const base64Frame = canvas.toDataURL('image/jpeg', 0.82);
          if (!base64Frame || base64Frame === 'data:,' || base64Frame.length < 3000) return;

          const response = await fetch('/api/translate-ar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ frameBase64: base64Frame, targetLanguage: 'English' })
          });
          const data = await response.json();
          if (data && Array.isArray(data.translations) && data.translations.length > 0) {
            setHomeArTranslations(data.translations);
          }
        } catch (e) { /* no-op */ }
      }, 2200);
    } else {
      if (homeArIntervalRef.current) clearInterval(homeArIntervalRef.current);
      if (!isHomeTranslateArActive && isViewfinderActive) {
        setHomeStatus('Tap ANY viewfinder item to target • Tap ✨ to speak • Tap 🌐 for AR');
        setHomeArTranslations([]);
      }
    }
    return () => { if (homeArIntervalRef.current) clearInterval(homeArIntervalRef.current); };
  }, [isHomeTranslateArActive, isViewfinderActive]);

  // TOUCH TO IDENTIFY ON HOMEPAGE
  const handleHomeTouchIdentify = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (isHomeAiProcessing || isHomeVoiceRecording || !homeVideoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    if (homeTouchTarget && Math.abs(homeTouchTarget.x - clickX) < 8 && Math.abs(homeTouchTarget.y - clickY) < 8) {
      setHomeTouchTarget(null);
      if (homeTimeoutRef.current) clearTimeout(homeTimeoutRef.current);
      return;
    }

    if (homeTimeoutRef.current) clearTimeout(homeTimeoutRef.current);
    const newTarget = { x: Math.round(clickX), y: Math.round(clickY), isLoading: true };
    setHomeTouchTarget(newTarget);
    setIsHomeAiProcessing(true);
    setIsHomeAiSpeaking(false);
    setHomeStatus('Scanning target item beneath crosshair...');

    setTimeout(async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = homeVideoRef.current?.videoWidth || 1280;
        canvas.height = homeVideoRef.current?.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        if (!ctx || !homeVideoRef.current) { setIsHomeAiProcessing(false); return; }
        ctx.drawImage(homeVideoRef.current, 0, 0, canvas.width, canvas.height);
        const base64Frame = canvas.toDataURL('image/jpeg', 0.88);

        const response = await fetch('/api/live-call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            frameBase64: base64Frame,
            touchTarget: { x: newTarget.x, y: newTarget.y },
            currentUserName: activeUser?.name || 'Explorer'
          })
        });
        const data = await response.json();
        const reply = data.spokenReply || 'I verified your targeted view right now!';
        const targetLabel = data.telemetry?.targetLabel || reply.split('.')[0] || 'Target Item';

        setIsHomeAiProcessing(false);
        setIsHomeAiSpeaking(true);
        setHomeStatus(`Target confirmed: ${targetLabel}`);
        setHomeTouchTarget({ x: newTarget.x, y: newTarget.y, label: targetLabel, isLoading: false });

        speakWithHumanVoice(reply, () => setIsHomeAiSpeaking(false));

        if (homeTimeoutRef.current) clearTimeout(homeTimeoutRef.current);
        homeTimeoutRef.current = setTimeout(() => {
          setHomeTouchTarget(null);
        }, 5000);
      } catch (err: any) {
        setIsHomeAiProcessing(false);
        setHomeStatus('Scan exception: ' + (err?.message || 'timeout'));
      }
    }, 110);
  };

  // VOICE QUESTION ON HOMEPAGE
  const handleHomeTapAndSpeakToggle = async () => {
    if (isHomeAiProcessing || !homeVideoRef.current) return;
    if (isHomeVoiceRecording && homeMediaRecorderRef.current) {
      setIsHomeVoiceRecording(false);
      try { homeMediaRecorderRef.current.stop(); } catch (e) {}
      return;
    }

    if (typeof MediaRecorder !== 'undefined') {
      try {
        homeAudioChunksRef.current = [];
        let audioStream: MediaStream;
        try {
          audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch (micErr) {
          handleHomeAskGoogle(undefined, "Describe what physical object appears right inside this camera view out loud.");
          return;
        }

        let recorder = new MediaRecorder(audioStream);
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) homeAudioChunksRef.current.push(e.data);
        };
        recorder.onstop = async () => {
          setIsHomeVoiceRecording(false);
          audioStream.getTracks().forEach(t => { try { t.stop(); } catch(e){} });
          setHomeStatus('Evaluating visual parameters out loud...');
          const audioBlob = new Blob(homeAudioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            setIsHomeAiProcessing(true);
            try {
              const canvas = document.createElement('canvas');
              canvas.width = homeVideoRef.current?.videoWidth || 1280;
              canvas.height = homeVideoRef.current?.videoHeight || 720;
              const ctx = canvas.getContext('2d');
              if (ctx && homeVideoRef.current) ctx.drawImage(homeVideoRef.current, 0, 0, canvas.width, canvas.height);
              const base64Frame = canvas.toDataURL('image/jpeg', 0.88);

              const response = await fetch('/api/live-call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ frameBase64: base64Frame, audioBase64: base64Audio, currentUserName: activeUser?.name || 'Explorer' })
              });
              const data = await response.json();
              const reply = data.spokenReply || 'Observation complete!';
              setIsHomeAiProcessing(false);
              setIsHomeAiSpeaking(true);
              setHomeAiAnswer(reply);
              setHomeStatus(`Observation: "${reply}"`);
              speakWithHumanVoice(reply, () => setIsHomeAiSpeaking(false));
            } catch (err) { setIsHomeAiProcessing(false); }
          };
          reader.readAsDataURL(audioBlob);
        };
        recorder.start(100);
        homeMediaRecorderRef.current = recorder;
        setIsHomeVoiceRecording(true);
        setHomeStatus('🎙️ Listening... Speak your question aloud (auto-sends in 4s or tap ✨ again)');

        setTimeout(() => {
          if (recorder.state === 'recording') {
            try { recorder.stop(); } catch (e) {}
          }
        }, 4200);
      } catch (e) {
        handleHomeAskGoogle(undefined, "Describe what physical object appears right inside this camera view out loud.");
      }
    }
  };

  const handleHomeAskGoogle = async (e?: React.FormEvent, customQuestion?: string) => {
    if (e) e.preventDefault();
    if (isHomeAiProcessing || !homeVideoRef.current) return;
    const qText = customQuestion || homeQuestionInput.trim() || 'Describe what appears right inside this camera view out loud.';
    setHomeQuestionInput('');
    setIsHomeAiProcessing(true);
    setIsHomeAiSpeaking(false);
    setHomeAiAnswer(null);
    setHomeStatus(`Consulting Google AI: "${qText}"...`);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = homeVideoRef.current?.videoWidth || 1280;
      canvas.height = homeVideoRef.current?.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx || !homeVideoRef.current) { setIsHomeAiProcessing(false); return; }
      ctx.drawImage(homeVideoRef.current, 0, 0, canvas.width, canvas.height);
      const base64Frame = canvas.toDataURL('image/jpeg', 0.88);

      const response = await fetch('/api/live-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frameBase64: base64Frame,
          questionText: qText,
          currentUserName: activeUser?.name || 'Explorer'
        })
      });
      const data = await response.json();
      const reply = data.spokenReply || 'Observation complete right now!';
      setIsHomeAiProcessing(false);
      setIsHomeAiSpeaking(true);
      setHomeAiAnswer(reply);
      setHomeStatus(`AI Answer: "${reply}"`);
      speakWithHumanVoice(reply, () => setIsHomeAiSpeaking(false));
    } catch (err: any) {
      setIsHomeAiProcessing(false);
      setHomeStatus('Google AI error: ' + (err?.message || 'network timeout'));
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fallbackTimer = setTimeout(() => { if (isMounted) setIsLoadingAuth(false); }, 1500);

    const initSession = async () => {
      setIsLoadingAuth(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && isMounted) {
          const profile = await syncGoogleProfileToDatabase(session.user);
          setActiveUser(profile);
          if (profile) {
            setLoadingGroups(true);
            const userRooms = await fetchUserPrivateGroups(profile.id);
            if (isMounted) { setPrivateGroups(userRooms); setLoadingGroups(false); }
          }
        } else if (isMounted) {
          setActiveUser(null);
        }
      } finally {
        if (isMounted) setIsLoadingAuth(false);
      }
    };
    initSession();

    // SMART CAMERA LENS AUTODETECTION (Mobile vs Desktop)
    const isMobileDevice = typeof window !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const initialMode: 'user' | 'environment' = isMobileDevice ? 'environment' : 'user';
    setCameraFacing(initialMode);
    startHomeViewfinder(initialMode);

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      setIsLoadingAuth(false);
      if (session?.user) {
        const profile = await syncGoogleProfileToDatabase(session.user);
        setActiveUser(profile);
        if (profile) {
          setLoadingGroups(true);
          const userRooms = await fetchUserPrivateGroups(profile.id);
          if (isMounted) { setPrivateGroups(userRooms); setLoadingGroups(false); }
        }
      } else {
        setActiveUser(null);
        setPrivateGroups([]);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimer);
      authListener.subscription.unsubscribe();
      stopHomeViewfinder();
    };
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href }
      });
    } catch (err) {
      console.error('Login prompt error:', err);
    }
  };

  const handleCreateRoom = async (e?: React.FormEvent, customTitle?: string, customDesc?: string) => {
    if (e) e.preventDefault();
    if (!activeUser) {
      await handleGoogleLogin();
      return;
    }

    const titleToUse = customTitle || newTitle.trim() || `${activeUser.name}'s Studio Room`;
    const descToUse = customDesc !== undefined ? customDesc : (newDesc.trim() || 'Collaborative Video Studio & AI Ledger');

    setIsCreating(true);
    try {
      stopHomeViewfinder();
      const created = await createPrivateGroup(titleToUse, descToUse, activeUser);
      if (created) {
        router.push(`/group/${created.id}`);
      }
    } catch (err) {
      console.error('Create room error:', err);
    } finally {
      setIsCreating(false);
      setShowCreateModal(false);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    stopHomeViewfinder();
    router.push(`/join/${joinCodeInput.trim()}`);
  };

  const presetWorkspaces = [
    { title: 'Tech & Gadget Hub', icon: '📱', color: 'bg-[#2B4C7E]/10 border-[#2B4C7E]/20' },
    { title: 'Group Stays & Trips', icon: '🏖️', color: 'bg-[#4A7C59]/10 border-[#4A7C59]/20' },
    { title: 'Live Fashion & Mall', icon: '🛍️', color: 'bg-[#D99B26]/10 border-[#D99B26]/20' },
    { title: 'Dinner & Expense Tab', icon: '🍷', color: 'bg-[#C45A45]/10 border-[#C45A45]/20' }
  ];

  return (
    <div className="min-h-screen bg-[#F9F7F1] text-[#22252A] flex flex-col pb-20">
      
      {/* SECTION 1: HERO SHOWCASE + STEP 5 LIVE VIEWFINDER MIRROR */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 w-full pt-6 sm:pt-10 flex flex-col items-center text-center">
        
        <h1 className="text-3xl sm:text-5xl font-extrabold text-[#22252A] tracking-tight leading-tight mb-5">
          Shop on Live Video. <br />
          <span className="text-[#2B4C7E]">Consult AI. Split Instantly.</span>
        </h1>

        {/* STEP 5: HOMEPAGE LIVE STUDIO VIEWFINDER MIRROR (FULL INTERACTIVE STUDIO) */}
        <div
          onClick={handleHomeTouchIdentify}
          className="w-full max-w-2xl bg-slate-950 border-2 border-amber-900/20 rounded-[32px] overflow-hidden shadow-2xl relative flex flex-col justify-end min-h-[280px] sm:min-h-[380px] max-h-[460px] cursor-crosshair select-none"
        >
          {isViewfinderActive ? (
            <video
              ref={homeVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover transition duration-200 pointer-events-none"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-slate-400 p-6 pointer-events-auto">
              <Camera className="w-12 h-12 text-slate-600 mb-2 animate-pulse" />
              <p className="text-xs font-black text-white">Camera Mirror Paused or Permission Required</p>
              <button
                type="button"
                onClick={() => startHomeViewfinder('user')}
                className="mt-3 bg-brand-600 text-white text-xs font-extrabold px-4 py-2 rounded-xl border border-brand-400 shadow-lg"
              >
                Allow Camera Preview
              </button>
            </div>
          )}

          {/* TOUCH TARGET RING ON HOMEPAGE */}
          {homeTouchTarget && (
            <div
              style={{ left: `${homeTouchTarget.x}%`, top: `${homeTouchTarget.y}%`, transform: 'translate(-50%, -50%)' }}
              className="absolute z-30 flex flex-col items-center pointer-events-none animate-in zoom-in-75 duration-200"
            >
              <div className="w-11 h-11 rounded-full border-2 border-amber-400 bg-amber-400/25 ring-4 ring-amber-400/30 animate-ping absolute inset-0" />
              <div className="w-11 h-11 rounded-full border-2 border-white flex items-center justify-center bg-black/45 backdrop-blur-xs relative shadow-2xl">
                <span className="text-sm">🎯</span>
              </div>
              {homeTouchTarget.isLoading ? (
                <span className="mt-1.5 bg-slate-900/90 text-amber-300 border border-slate-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-xl whitespace-nowrap">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Identifying...
                </span>
              ) : homeTouchTarget.label ? (
                <span className="mt-1.5 bg-[#22252A]/95 text-white border-2 border-amber-400 px-3.5 py-1.5 rounded-2xl text-xs font-black shadow-2xl whitespace-nowrap tracking-tight flex items-center gap-1 text-center">
                  <span className="text-amber-400 font-extrabold text-[10px] uppercase">🎯</span>
                  <span>{homeTouchTarget.label}</span>
                </span>
              ) : null}
            </div>
          )}

          {/* AR OPTICAL TRANSLATION CARD ON HOMEPAGE */}
          {homeArTranslations.slice(0, 1).map((item, idx) => (
            <div
              key={idx}
              style={{ left: `${Math.min(Math.max(item.x || 48, 20), 60)}%`, top: `${Math.min(Math.max(item.y || 48, 20), 70)}%`, transform: 'translate(-50%, -50%)' }}
              className="absolute z-20 w-[88%] max-w-[320px] p-3 sm:p-4 rounded-3xl bg-[#22252A]/90 backdrop-blur-xl border border-amber-400/80 text-amber-300 shadow-2xl animate-in zoom-in-95 duration-150 pointer-events-none flex flex-col gap-2 text-left"
            >
              <div className="font-extrabold text-white text-xs sm:text-sm tracking-tight border-b border-white/10 pb-1.5 flex items-center gap-1.5">
                <span>🏷️</span><span className="truncate">{item.title || item.translation}</span>
              </div>
              {item.features && <div className="text-[11px] sm:text-xs font-semibold text-slate-200 leading-tight"><strong className="text-emerald-400 font-bold">Features:</strong> {item.features}</div>}
              {item.instructions && <div className="text-[11px] sm:text-xs font-semibold text-slate-200 leading-tight"><strong className="text-amber-300 font-bold">How to Use:</strong> {item.instructions}</div>}
              {item.precautions && <div className="text-[11px] sm:text-xs font-bold text-rose-300 bg-rose-950/40 p-2 rounded-xl border border-rose-500/30 leading-tight"><strong className="text-rose-400 uppercase">Caution:</strong> {item.precautions}</div>}
            </div>
          ))}

          {/* VIEWFINDER OVERLAY HEADER */}
          <div className="relative z-10 p-3 bg-gradient-to-b from-black/80 via-black/30 to-transparent flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-2 px-3 py-1 bg-black/60 backdrop-blur-md rounded-xl border border-slate-700">
              <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shrink-0" />
              <span className="text-xs font-extrabold text-white tracking-tight uppercase">Live Studio Viewfinder</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsHomeTranslateArActive(!isHomeTranslateArActive); }}
                className={`p-2 px-3 rounded-xl font-extrabold text-xs transition flex items-center gap-1.5 active:scale-95 shadow-lg ${
                  isHomeTranslateArActive ? 'bg-gradient-to-tr from-[#4285F4] via-[#34A853] to-[#FBBC05] text-white border border-white animate-pulse' : 'bg-black/60 hover:bg-black/80 backdrop-blur-md border border-slate-700 text-amber-300'
                }`}
                title="Toggle Real-Time AR Optical Translate"
              >
                <Globe className="w-3.5 h-3.5" /> <span>AR Translate</span>
              </button>

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleHomeTapAndSpeakToggle(); }}
                className={`p-2 px-3 rounded-xl font-extrabold text-xs transition flex items-center gap-1.5 active:scale-95 shadow-lg ${
                  isHomeVoiceRecording ? 'bg-rose-600 text-white animate-bounce ring-2 ring-rose-400' : 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white hover:opacity-95'
                }`}
                title="Tap & Talk Voice Question"
              >
                {isHomeAiProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Sparkles className="w-3.5 h-3.5 text-white" />}
                <span>{isHomeVoiceRecording ? 'Listening...' : 'Ask AI'}</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const next = cameraFacing === 'user' ? 'environment' : 'user';
                  setCameraFacing(next);
                  startHomeViewfinder(next);
                }}
                className="p-2 px-3 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md border border-slate-700 text-amber-400 font-extrabold text-xs transition flex items-center gap-1.5 active:scale-95 shadow-lg"
                title="Flip Camera Lens"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Flip
              </button>
            </div>
          </div>

          <div className="flex-1" />

          {/* AI ANSWER DISPLAY CARD ON HOMEPAGE */}
          {homeAiAnswer && (
            <div className="relative z-30 mx-3 sm:mx-5 mb-2 p-3.5 rounded-2xl bg-slate-950/95 backdrop-blur-2xl border-2 border-amber-400 text-white shadow-2xl animate-in zoom-in-95 duration-150 pointer-events-auto flex flex-col gap-1.5 text-left">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="font-black text-xs text-amber-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Google Gemini Answer
                </span>
                <button onClick={(e) => { e.stopPropagation(); setHomeAiAnswer(null); }} className="text-slate-400 hover:text-white p-1 text-xs font-bold">✕</button>
              </div>
              <p className="text-xs font-semibold leading-relaxed text-slate-100">{homeAiAnswer}</p>
            </div>
          )}

          {/* VIEWFINDER BOTTOM LAUNCH ACTION BAR */}
          <div className="relative z-10 p-4 sm:p-5 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent flex flex-col sm:flex-row items-center justify-between gap-3 pointer-events-auto">
            <div className="text-left min-w-0">
              <p className="text-white font-black text-sm sm:text-base truncate">Ready to invite your friends?</p>
              <p className="text-slate-300 text-xs font-medium truncate">{homeStatus}</p>
            </div>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleCreateRoom(undefined, activeUser ? `${activeUser.name}'s Video Studio` : "Shared CoBuy Room"); }}
              disabled={isCreating}
              className="w-full sm:w-auto py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-600 to-brand-600 hover:opacity-95 text-white font-black text-sm transition shadow-2xl flex items-center justify-center gap-2 active:scale-95 shrink-0 border border-white/20"
            >
              {isCreating ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : <Video className="w-5 h-5 text-white animate-bounce" />}
              <span>🚀 Open Studio Room</span>
            </button>
          </div>
        </div>

        {/* PROMINENT ALWAYS-OPEN PUBLIC DEMO ROOM BANNER (ZERO LOGIN REQUIRED) */}
        <div className="mt-5 w-full max-w-2xl bg-gradient-to-r from-emerald-500 via-teal-600 to-brand-600 rounded-[28px] p-1 shadow-2xl">
          <div className="bg-slate-950/95 backdrop-blur-xl rounded-[26px] p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping shrink-0" />
                <h3 className="font-black text-white text-base sm:text-lg">🌐 Always-Open Public Demo Room</h3>
              </div>
              <p className="text-slate-300 text-xs font-medium leading-relaxed">
                No sign-in required! Enter instantly as a Guest Explorer to test live AR, touch pointers, and AI voice with anyone connected right now.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                stopHomeViewfinder();
                router.push('/group/public-demo-room');
              }}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-sm transition shadow-lg shrink-0 flex items-center justify-center gap-2 active:scale-95"
            >
              <span>⚡ Enter Public Room</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* COMPACT DASHBOARD CARD */}
        <div className="mt-6 w-full max-w-md bg-white border border-amber-900/15 rounded-[28px] p-5 shadow-sm">
          {isLoadingAuth ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-[#2B4C7E]" />
            </div>
          ) : activeUser ? (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setShowCreateModal(true)}
                disabled={isCreating}
                className="w-full py-3.5 px-5 rounded-2xl bg-[#2B4C7E] hover:bg-[#203960] text-white font-bold text-sm transition shadow-sm flex items-center justify-center gap-2 active:scale-95"
              >
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-5 h-5" />}
                <span>New CoBuy Room</span>
              </button>

              <form onSubmit={handleJoinByCode} className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  placeholder="Invite code..."
                  className="flex-1 bg-[#F9F7F1] border border-amber-900/15 rounded-xl px-3.5 py-2.5 text-xs text-[#22252A] placeholder:text-slate-400 font-bold focus:outline-none focus:ring-2 focus:ring-[#2B4C7E] transition"
                />
                <button
                  type="submit"
                  className="px-4 rounded-xl bg-white hover:bg-slate-50 border border-amber-900/15 font-bold text-xs text-[#22252A] transition active:scale-95 flex items-center gap-1 shadow-xs"
                >
                  <span>Join</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-2">
              <button
                onClick={handleGoogleLogin}
                className="bg-white hover:bg-slate-50 text-slate-700 font-semibold px-6 py-3 rounded-full border border-slate-300 shadow-sm flex items-center gap-3 text-sm transition active:scale-95 w-full justify-center"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Sign in with Google</span>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* SECTION 2: INSTANT TEMPLATES */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 w-full mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-extrabold text-[#22252A] uppercase tracking-wider flex items-center gap-2">
            ⚡ Quick Launch Rooms
          </h2>
          {activeUser && privateGroups.length > 0 && (
            <span className="text-xs font-bold text-[#2B4C7E]">
              {privateGroups.length} open
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {presetWorkspaces.map((preset, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                if (!activeUser) {
                  handleGoogleLogin();
                } else {
                  handleCreateRoom(undefined, preset.title, "Shared room");
                }
              }}
              className={`p-4 rounded-2xl border bg-white hover:bg-slate-50 transition text-left shadow-xs flex flex-col justify-between gap-3 active:scale-95`}
            >
              <span className="text-2xl">{preset.icon}</span>
              <span className="font-bold text-xs text-[#22252A] leading-tight truncate">
                {preset.title}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* SECTION 3: YOUR ACTIVE ROOMS */}
      {activeUser && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 w-full mt-10">
          <h2 className="text-sm font-extrabold text-[#22252A] uppercase tracking-wider mb-3">
            📂 Your Workspaces
          </h2>

          {loadingGroups ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#2B4C7E]" />
            </div>
          ) : privateGroups.length === 0 ? (
            <div className="bg-white border border-amber-900/15 rounded-3xl p-8 text-center text-slate-500 text-sm font-medium shadow-xs">
              No active rooms found. Use the live viewfinder right above to invite your group!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {privateGroups.map(grp => (
                <Link
                  key={grp.id}
                  href={`/group/${grp.id}`}
                  className="bg-white border border-amber-900/15 hover:border-[#2B4C7E] rounded-3xl p-5 transition shadow-xs hover:shadow-md flex items-center justify-between group"
                >
                  <div className="min-w-0 pr-4 text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-extrabold text-[#22252A] text-base truncate group-hover:text-[#2B4C7E] transition">
                        {grp.title}
                      </span>
                      <span className="bg-[#4A7C59]/15 text-[#4A7C59] border border-[#4A7C59]/20 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase shrink-0">
                        Private
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{grp.description}</p>
                    <div className="flex items-center gap-4 mt-2.5 text-[11px] text-slate-400 font-bold">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-brand-400" /> {grp.members.length} members
                      </span>
                      <span>•</span>
                      <span>{grp.messages.length} interactions</span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-[#2B4C7E] transition shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* MODAL: NEW PRIVATE ROOM */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-amber-900/15 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-amber-900/10">
              <h3 className="font-extrabold text-[#22252A] text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-brand-400" /> New Workspace
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white p-1">✕</button>
            </div>
            <form onSubmit={(e) => handleCreateRoom(e)} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Room Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Tokyo Trip 2026 / IKEA Haul"
                  className="w-full bg-[#F9F7F1] border border-amber-900/15 rounded-xl px-4 py-2.5 text-sm text-[#22252A] placeholder:text-slate-400 font-bold focus:outline-none focus:ring-2 focus:ring-[#2B4C7E]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Description</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="What is this workspace for?"
                  className="w-full bg-[#F9F7F1] border border-amber-900/15 rounded-xl px-4 py-2.5 text-sm text-[#22252A] placeholder:text-slate-400 font-bold focus:outline-none focus:ring-2 focus:ring-[#2B4C7E]"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#22252A] font-bold text-sm">Cancel</button>
                <button type="submit" disabled={isCreating || !newTitle.trim()} className="flex-1 bg-[#2B4C7E] hover:bg-[#203960] text-white font-extrabold py-3 px-4 rounded-xl text-sm shadow-md flex items-center justify-center gap-2">
                  {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Launch Room</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
