'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Group, User } from '@/lib/types';
import { supabase } from '@/lib/supabaseClient';
import { fetchUserPrivateGroups, createPrivateGroup, syncGoogleProfileToDatabase } from '@/lib/sync';
import { PlusCircle, Share2, Users, Sparkles, LogIn, ShieldCheck, Camera, CreditCard, Lock, ArrowRight, Loader2, MessageSquare, Video, ShoppingBag, DollarSign, Check, ChevronRight } from 'lucide-react';

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

  useEffect(() => {
    let isMounted = true;
    const fallbackTimer = setTimeout(() => { if (isMounted) setIsLoadingAuth(false); }, 1800);

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
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
    } catch (e) {
      console.error('Google Sign-In action failed:', e);
    }
  };

  const handleCreateRoom = async (e?: React.FormEvent, presetTitle?: string, presetDesc?: string) => {
    if (e) e.preventDefault();
    if (!activeUser || isCreating) return;

    const finalTitle = presetTitle || newTitle || 'Google CoBuy Video & Shopping Room';
    const finalDesc = presetDesc || newDesc || 'Shared real-time shopping review & instant splits';

    setIsCreating(true);
    try {
      const g = await createPrivateGroup(finalTitle, finalDesc, activeUser);
      if (g) {
        setShowCreateModal(false);
        setNewTitle('');
        setNewDesc('');
        router.push(`/group/${g.id}`);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCodeInput.trim();
    if (!cleaned) return;
    router.push(`/join/${cleaned}`);
  };

  const presetWorkspaces = [
    {
      title: '💻 Tech & Gadget Hardware Hub',
      desc: 'Point your camera at consumer tech across live video, review prices out loud, and split group costs.',
      badgeColor: 'text-[#2B4C7E] bg-[#2B4C7E]/10 border-[#2B4C7E]/20',
      icon: '💻'
    },
    {
      title: '✈️ Stays & Group Travel Discovery',
      desc: 'Ask @SHOPPY for multi-option Airbnb and flight decks inside interactive horizontal snap carousels.',
      badgeColor: 'text-[#C45A45] bg-[#C45A45]/10 border-[#C45A45]/20',
      icon: '✈️'
    },
    {
      title: '🛍️ Live Mall Walkthrough & Fashion',
      desc: 'Stream store aisles with friends on WebRTC video right while Gemini evaluates quality & sizing.',
      badgeColor: 'text-[#D99B26] bg-[#D99B26]/10 border-[#D99B26]/20',
      icon: '👗'
    },
    {
      title: '🍷 Dinner Table & Receipt Reconciler',
      desc: 'Snap itemized bills after dining. @SPLITTY extracts line items and computes minimum group debts.',
      badgeColor: 'text-[#4A7C59] bg-[#4A7C59]/10 border-[#4A7C59]/20',
      icon: '🧾'
    },
  ];

  return (
    <div className="min-h-screen bg-[#F9F7F1] text-[#22252A] flex flex-col pb-24">
      
      {/* SECTION 1: WARM CREAM HERO SHOWCASE */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 w-full pt-10 sm:pt-16 flex flex-col items-center text-center">
        
        {/* Google AI & WebRTC Core Indicator Chip */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-amber-900/15 text-xs font-extrabold text-[#22252A] shadow-xs mb-6">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#4285F4]" />
            <span className="w-2 h-2 rounded-full bg-[#EA4335]" />
            <span className="w-2 h-2 rounded-full bg-[#FBBC05]" />
            <span className="w-2 h-2 rounded-full bg-[#34A853]" />
          </div>
          <span className="font-black">Google CoBuy AI</span>
          <span className="text-slate-400">•</span>
          <span className="text-[#2B4C7E]">Real-Time Multimodal Video & Shopping Studio</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-[#22252A] tracking-tight leading-none sm:leading-[1.1] max-w-5xl">
          Shop Together across Video. <br className="hidden sm:block" />
          <span className="text-[#2B4C7E]">
            Consult with AI & Settle in Seconds.
          </span>
        </h1>

        <p className="text-sm sm:text-lg text-slate-600 max-w-3xl mt-5 font-medium leading-relaxed">
          Say goodbye to disjointed shopping links right scattered inside chat apps. Launch an interactive WebRTC video space where your autonomous twin-AI copilot evaluates store items out loud across your camera right (`Option A Touch & Speak`), curates horizontal consensus carousels across chat right right right upon ending your call (`@SHOPPY`), right alongside reconciling group bills automatically (`@SPLITTY`).
        </p>

        {/* MILD WHITE GEOMETRIC ROOM CREATION CARD */}
        <div className="mt-8 sm:mt-12 w-full max-w-xl bg-white border border-amber-900/15 rounded-[32px] p-4 sm:p-6 shadow-md">
          {isLoadingAuth ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-[#2B4C7E]" />
              <span className="text-xs font-bold">Connecting Google Wallet & Profile...</span>
            </div>
          ) : activeUser ? (
            <div className="flex flex-col gap-4">
              <button
                onClick={() => setShowCreateModal(true)}
                disabled={isCreating}
                className="w-full py-4 px-6 rounded-2xl bg-[#2B4C7E] hover:bg-[#203960] text-white font-black text-base transition shadow-md flex items-center justify-center gap-2.5 active:scale-95"
              >
                {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlusCircle className="w-6 h-6 text-white" />}
                <span>Create Live Video & Shopping Room</span>
              </button>

              <form onSubmit={handleJoinByCode} className="flex gap-2">
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  placeholder="Paste room invitation code..."
                  className="flex-1 bg-[#F9F7F1] border border-amber-900/15 rounded-2xl px-4 py-3 text-sm text-[#22252A] placeholder:text-slate-400 font-bold focus:outline-none focus:ring-2 focus:ring-[#2B4C7E] transition"
                />
                <button
                  type="submit"
                  className="px-5 rounded-2xl bg-white hover:bg-slate-50 border border-amber-900/15 font-bold text-[#22252A] text-sm transition active:scale-95 flex items-center gap-1 shadow-xs"
                >
                  <span>Join</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-3">
              <p className="text-xs text-slate-600 font-medium">
                Sign directly using your Google Account to host shared live video studios & interactive shopping carousels.
              </p>
              <button
                onClick={handleGoogleLogin}
                className="w-full py-4 rounded-2xl bg-[#2B4C7E] hover:bg-[#203960] text-white font-black text-base transition shadow-md flex items-center justify-center gap-3 active:scale-95"
              >
                <div className="flex gap-1 items-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#4285F4]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#EA4335]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FBBC05]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#34A853]" />
                </div>
                <span>Continue with Google</span>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* SECTION 2: INSTANT GOOGLE COBUY WORKSPACE PRESETS (`Click-to-Launch`) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 w-full mt-14 sm:mt-18">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-[#22252A] tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-6 rounded-full bg-[#2B4C7E]" />
              Quick-Launch Collaborative Rooms
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Select any verified template right below to instantly open a multi-person video studio & group chat room.
            </p>
          </div>
          {activeUser && privateGroups.length > 0 && (
            <span className="text-xs font-bold text-slate-700 border border-amber-900/15 rounded-xl px-3 py-1 bg-white shadow-xs">
              {privateGroups.length} Active Workspaces Open
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {presetWorkspaces.map((preset, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                if (!activeUser) {
                  handleGoogleLogin();
                } else {
                  handleCreateRoom(undefined, preset.title, preset.desc);
                }
              }}
              className="bg-white hover:bg-white/95 border border-amber-900/10 rounded-[28px] p-5 text-left transition duration-200 hover:shadow-md flex flex-col justify-between shadow-sm active:scale-95 group"
            >
              <div>
                <span className="text-3xl mb-3 block">{preset.icon}</span>
                <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-md mb-2 border ${preset.badgeColor}`}>
                  Google Template
                </span>
                <h3 className="font-extrabold text-[#22252A] text-base tracking-tight mb-1.5 group-hover:text-[#2B4C7E] transition">
                  {preset.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  {preset.desc}
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-amber-900/10 flex items-center justify-between text-xs font-black text-[#2B4C7E]">
                <span>Deploy Room</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* SECTION 3: THREE PILLARS OF GOOGLE COBUY AI */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 w-full mt-16 sm:mt-24">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white border border-amber-900/10 text-[#2B4C7E] text-xs font-bold uppercase tracking-widest mb-2 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#D99B26]" /> Powered by Gemini Multimodal & Lens Core
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-[#22252A] tracking-tight">
            One Studio. Three Autonomous AI Co-Pilots.
          </h2>
          <p className="text-sm text-slate-600 mt-2 font-medium">
            Bridging real-time physical video inspection, group consensus buying decks, and automated bill reconciliation.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* PILLAR 1: LIVE VIDEO CONSULTATION & AUDIO */}
          <div className="bg-white border border-amber-900/10 rounded-[32px] p-6 sm:p-8 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#2B4C7E]/10 border border-[#2B4C7E]/20 flex items-center justify-center mb-5 text-[#2B4C7E]">
                <Video className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-[#22252A] mb-2">
                1. Gemini Live Video Studio
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Hop on multi-person HD video. Point your smartphone directly at physical merchandise or retail displays. Tap our circular **`✨`** button right right across your bar and ask: *"Gemini, look at this package out loud—does it match our group requirements?"* right inside the call!
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-amber-900/10 flex items-center gap-2 text-xs font-bold text-[#2B4C7E]">
              <Check className="w-4 h-4" /> Option A Touch & Talk + Factual Grounding
            </div>
          </div>

          {/* PILLAR 2: @SHOPPY INTERACTIVE DISCOVERY DECKS */}
          <div className="bg-white border border-amber-900/10 rounded-[32px] p-6 sm:p-8 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#C45A45]/10 border border-[#C45A45]/20 flex items-center justify-center mb-5 text-[#C45A45]">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-[#22252A] mb-2">
                2. @SHOPPY Buying Carousels
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Whenever you finish evaluating items across video, or right when you mention `@SHOPPY` directly right in chat (`"@SHOPPY compare top gaming monitors under $400"`), our engine populates horizontal snap decks complete right with **`❤️ Vote`**, **`🔍 Discuss`**, right right alongside **`🔗 Checkout Link`** actions!
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-amber-900/10 flex items-center gap-2 text-xs font-bold text-[#C45A45]">
              <Check className="w-4 h-4" /> Auto-Generated directly after camera sessions
            </div>
          </div>

          {/* PILLAR 3: @SPLITTY OPTICAL RECEIPT RECONCILER */}
          <div className="bg-white border border-amber-900/10 rounded-[32px] p-6 sm:p-8 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#4A7C59]/10 border border-[#4A7C59]/20 flex items-center justify-center mb-5 text-[#4A7C59]">
                <DollarSign className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-[#22252A] mb-2">
                3. @SPLITTY Neural Ledgers
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                When checking out together, snap a picture right of the receipt right right across your device. `@SPLITTY` extracts individual item prices via high-precision optical AI, normalizes currency exchange rates (`JPY to USD`), and calculates exact min-cash-flow settling tables.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-amber-900/10 flex items-center gap-2 text-xs font-bold text-[#4A7C59]">
              <Check className="w-4 h-4" /> Min-Cash-Flow Settle Board & Deep Links
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: USER ACTIVE WORKSPACES LIST */}
      {activeUser && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 w-full mt-16">
          <div className="bg-white border border-amber-900/10 rounded-[32px] p-6 sm:p-8 shadow-sm">
            <div className="flex items-center justify-between border-b border-amber-900/10 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <img src={activeUser.avatar} alt="Avatar" className="w-10 h-10 rounded-full border border-amber-900/15 object-cover" />
                <div>
                  <h3 className="font-extrabold text-[#22252A] text-lg tracking-tight">
                    Your Collaborative Rooms
                  </h3>
                  <p className="text-xs text-slate-500">
                    Signed in as {activeUser.name} ({activeUser.email})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 rounded-2xl bg-[#2B4C7E] hover:bg-[#203960] text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition shadow-sm"
              >
                <PlusCircle className="w-4 h-4 text-white" /> Create Custom Space
              </button>
            </div>

            {loadingGroups ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin text-[#2B4C7E]" />
                <span className="text-xs font-bold">Loading your active Google CoBuy studios...</span>
              </div>
            ) : privateGroups.length === 0 ? (
              <div className="py-12 text-center text-slate-500 max-w-sm mx-auto">
                <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="text-sm font-bold text-[#22252A]">No active collaborative rooms found.</p>
                <p className="text-xs text-slate-500 mt-1">Select any preset right above or click below to launch your first room!</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-5 py-3 px-6 rounded-2xl bg-[#2B4C7E] hover:bg-[#203960] font-bold text-white text-xs sm:text-sm transition shadow-md"
                >
                  Create Initial Workspace
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {privateGroups.map(room => (
                  <Link
                    key={room.id}
                    href={`/group/${room.id}`}
                    className="bg-[#F9F7F1] hover:bg-[#F4F1EA] border border-amber-900/10 rounded-2xl p-5 transition flex flex-col justify-between group shadow-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[11px] font-mono text-slate-600 bg-white px-2 py-0.5 rounded-lg border border-amber-900/10 shadow-xs">
                          Code: {room.inviteCode || room.id.slice(0, 8)}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-[#4A7C59] font-extrabold">
                          <span className="w-2 h-2 rounded-full bg-[#4A7C59] animate-pulse" /> Active Studio
                        </span>
                      </div>
                      <h4 className="font-extrabold text-[#22252A] text-base tracking-tight group-hover:text-[#2B4C7E] transition truncate">
                        {room.title}
                      </h4>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                        {room.description || 'Collaborative shopping space & video room.'}
                      </p>
                    </div>
                    <div className="mt-5 pt-3 border-t border-amber-900/10 flex items-center justify-between text-xs font-bold text-[#2B4C7E]">
                      <span>Open Video & AI Studio</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* CREATE CUSTOM ROOM MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[160] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-[#F9F7F1] border border-amber-900/10 rounded-[32px] w-full max-w-md p-6 sm:p-8 text-[#22252A] shadow-2xl relative my-auto shrink-0">
            <h3 className="text-2xl font-black text-[#22252A] tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-6 bg-[#2B4C7E] rounded-full" /> Create Shopping Space
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Give your room a descriptive name (*e.g. Tokyo Group Vacation* or *VR Setup Split*).
            </p>

            <form onSubmit={(e) => handleCreateRoom(e)} className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-extrabold text-[#22252A] block mb-1.5">
                  Room Title:
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Pixel 9 Pro & Gadget Haul"
                  className="w-full bg-white border border-amber-900/15 rounded-2xl px-4 py-3 text-sm text-[#22252A] placeholder:text-slate-400 font-bold focus:outline-none focus:ring-2 focus:ring-[#2B4C7E] transition shadow-xs"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-[#22252A] block mb-1.5">
                  Target or Purpose:
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="e.g. Compare store gear over live camera"
                  className="w-full bg-white border border-amber-900/15 rounded-2xl px-4 py-3 text-sm text-[#22252A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2B4C7E] transition shadow-xs"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-amber-900/10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="bg-[#2B4C7E] hover:bg-[#203960] text-white font-black px-6 py-3 rounded-2xl transition shadow-md text-sm flex items-center gap-2 active:scale-95"
                >
                  {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Launch Studio</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
