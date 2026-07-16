'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Group, User } from '@/lib/types';
import { supabase } from '@/lib/supabaseClient';
import { fetchUserPrivateGroups, createPrivateGroup, syncGoogleProfileToDatabase } from '@/lib/sync';
import { Plus, Users, Sparkles, Camera, CreditCard, Lock, ArrowRight, Loader2, Video, ShoppingBag, X, ChevronRight, RefreshCw } from 'lucide-react';

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

  // STEP 5: HOMEPAGE LIVE VIEWFINDER MIRROR STATE
  const [isViewfinderActive, setIsViewfinderActive] = useState<boolean>(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const homeVideoRef = useRef<HTMLVideoElement | null>(null);
  const homeStreamRef = useRef<MediaStream | null>(null);

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
    if (homeStreamRef.current) {
      homeStreamRef.current.getTracks().forEach(t => t.stop());
      homeStreamRef.current = null;
    }
    setIsViewfinderActive(false);
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
    startHomeViewfinder('user');

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

        {/* STEP 5: HOMEPAGE LIVE STUDIO VIEWFINDER MIRROR */}
        <div className="w-full max-w-2xl bg-slate-950 border-2 border-amber-900/20 rounded-[32px] overflow-hidden shadow-2xl relative flex flex-col justify-end min-h-[260px] sm:min-h-[360px] max-h-[440px]">
          {isViewfinderActive ? (
            <video
              ref={homeVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover transition duration-200 pointer-events-none"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-slate-400 p-6">
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

          {/* VIEWFINDER OVERLAY HEADER */}
          <div className="relative z-10 p-3 bg-gradient-to-b from-black/80 via-black/30 to-transparent flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-2 px-3 py-1 bg-black/60 backdrop-blur-md rounded-xl border border-slate-700">
              <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shrink-0" />
              <span className="text-xs font-extrabold text-white tracking-tight uppercase">Live Studio Viewfinder</span>
            </div>

            <button
              type="button"
              onClick={() => {
                const next = cameraFacing === 'user' ? 'environment' : 'user';
                setCameraFacing(next);
                startHomeViewfinder(next);
              }}
              className="p-2 px-3 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md border border-slate-700 text-amber-400 font-extrabold text-xs transition flex items-center gap-1.5 active:scale-95 shadow-lg"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Flip
            </button>
          </div>

          <div className="flex-1" />

          {/* VIEWFINDER BOTTOM LAUNCH ACTION BAR */}
          <div className="relative z-10 p-4 sm:p-5 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-left min-w-0">
              <p className="text-white font-black text-sm sm:text-base truncate">Ready to invite your friends?</p>
              <p className="text-slate-300 text-xs font-medium truncate">Start instant group AR shopping session out right across this camera</p>
            </div>

            <button
              type="button"
              onClick={() => handleCreateRoom(undefined, activeUser ? `${activeUser.name}'s Video Studio` : "Shared CoBuy Room")}
              disabled={isCreating}
              className="w-full sm:w-auto py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-600 to-brand-600 hover:opacity-95 text-white font-black text-sm transition shadow-2xl flex items-center justify-center gap-2 active:scale-95 shrink-0 border border-white/20"
            >
              {isCreating ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : <Video className="w-5 h-5 text-white animate-bounce" />}
              <span>🚀 Open Studio Room</span>
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
