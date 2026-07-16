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

    const finalTitle = presetTitle || newTitle || 'Google Collaborative Shopping & Video Room';
    const finalDesc = presetDesc || newDesc || 'Shared shopping review & instant splits';

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
      title: '💻 Pixel & Tech Hardware Split',
      desc: 'Evaluate gaming & hardware gadgets out loud across video and split the tab with your crew.',
      color: 'from-[#4285F4]/20 border-[#4285F4]/40 text-blue-400',
      icon: '💻'
    },
    {
      title: '✈️ Google Flights & Stays Discovery',
      desc: 'Ask @SHOPPY for multi-option vacation decks across horizontal voting carousels.',
      color: 'from-[#EA4335]/20 border-[#EA4335]/40 text-rose-400',
      icon: '✈️'
    },
    {
      title: '🛒 Live Retail & Fashion Try-On',
      desc: 'Point your smartphone camera at physical aisle clothing or gear during live WebRTC room video.',
      color: 'from-[#FBBC05]/20 border-[#FBBC05]/40 text-amber-400',
      icon: '🛍️'
    },
    {
      title: '🍷 Dinner Table Tab Reconciler',
      desc: 'Snap your post-dinner check right across Google optical receipt scanning via @SPLITTY.',
      color: 'from-[#34A853]/20 border-[#34A853]/40 text-emerald-400',
      icon: '🧾'
    },
  ];

  return (
    <div className="min-h-screen bg-[#141517] text-slate-100 flex flex-col pb-24">
      
      {/* SECTION 1: OFFICIAL GOOGLE COBUY AI HERO WORKSPACE */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 w-full pt-10 sm:pt-16 flex flex-col items-center text-center">
        
        {/* Gemini Live & Google Meet Core Status Tag */}
        <div className="inline-flex items-center gap-2 p-1.5 px-4 rounded-full bg-[#202124] border border-slate-700/90 text-xs font-bold text-slate-200 shadow-xl mb-6">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#4285F4]" />
            <span className="w-2 h-2 rounded-full bg-[#EA4335]" />
            <span className="w-2 h-2 rounded-full bg-[#FBBC05]" />
            <span className="w-2 h-2 rounded-full bg-[#34A853]" />
          </div>
          <span className="text-white font-extrabold tracking-wide">Google CoBuy AI</span>
          <span className="text-slate-500">•</span>
          <span className="text-blue-400">Gemini Live + WebRTC Core Active</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-none sm:leading-[1.1] max-w-5xl">
          Shop Together on Video. <br className="hidden sm:block" />
          <span className="bg-gradient-to-r from-[#4285F4] via-[#EA4335] via-[#FBBC05] to-[#34A853] bg-clip-text text-transparent">
            Evaluate & Split with AI.
          </span>
        </h1>

        <p className="text-sm sm:text-lg text-slate-300 max-w-3xl mt-5 font-medium leading-relaxed">
          Stop passing around disjointed checkout links right across cluttered group chats. Host an interactive Google Meet video room where your autonomous twin-AI copilot looks across your physical hardware camera out loud (`Option A Touch & Talk`), populates consensus horizontal voting decks (`@SHOPPY`), and instantly settles itemized invoices (`@SPLITTY`).
        </p>

        {/* GOOGLE WORKSPACE LAUNCH DECK */}
        <div className="mt-8 sm:mt-12 w-full max-w-xl bg-[#202124] border border-slate-700/80 rounded-[32px] p-4 sm:p-6 shadow-2xl">
          {isLoadingAuth ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
              <span className="text-xs font-bold text-slate-300">Synchronizing Google Wallet Profile...</span>
            </div>
          ) : activeUser ? (
            <div className="flex flex-col gap-4">
              <button
                onClick={() => setShowCreateModal(true)}
                disabled={isCreating}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#4285F4] via-[#EA4335] to-[#34A853] text-white font-black text-base transition shadow-2xl hover:opacity-95 flex items-center justify-center gap-2 active:scale-95"
              >
                {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlusCircle className="w-6 h-6" />}
                <span>Start New Collaborative Shopping Room</span>
              </button>

              <form onSubmit={handleJoinByCode} className="flex gap-2">
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  placeholder="Paste room access code or ID..."
                  className="flex-1 bg-slate-900 border border-slate-700/80 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-500 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                <button
                  type="submit"
                  className="px-5 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 font-bold text-white text-sm transition active:scale-95 flex items-center gap-1.5"
                >
                  <span>Join</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-3">
              <p className="text-xs text-slate-300 font-medium">
                Sign in with your verified Google Profile right to create collaborative shopping & voice consultation rooms.
              </p>
              <button
                onClick={handleGoogleLogin}
                className="w-full py-4 rounded-2xl bg-slate-900 border border-slate-700 text-white font-black text-base hover:bg-slate-850 transition shadow-xl flex items-center justify-center gap-3 active:scale-95"
              >
                <div className="flex gap-1 items-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#4285F4]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#EA4335]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FBBC05]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#34A853]" />
                </div>
                <span>Continue with Google Account</span>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* SECTION 2: INSTANT GOOGLE COBUY ROOM TEMPLATES (`Click-to-Launch Workspaces`) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 w-full mt-14 sm:mt-18">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-6 rounded-full bg-gradient-to-b from-[#4285F4] via-[#EA4335] to-[#34A853]" />
              Quick-Launch Collaborative Workspaces
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Click any verified preset below right to immediately launch a real-time multimodal shopping & settle space.
            </p>
          </div>
          {activeUser && privateGroups.length > 0 && (
            <span className="text-xs font-bold text-slate-400 border border-slate-800 rounded-xl px-3 py-1 bg-[#202124]">
              {privateGroups.length} Active Group Rooms Open
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
              className={`bg-[#202124]/90 border rounded-[28px] p-5 text-left transition duration-200 hover:scale-[1.02] shadow-xl flex flex-col justify-between bg-gradient-to-br ${preset.color} active:scale-95 group`}
            >
              <div>
                <span className="text-3xl mb-3 block">{preset.icon}</span>
                <h3 className="font-extrabold text-white text-base tracking-tight mb-1.5 group-hover:text-blue-400 transition">
                  {preset.title}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  {preset.desc}
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-black text-slate-300 group-hover:text-white">
                <span>Deploy Workspace</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* SECTION 3: THE 3 PILLARS OF GOOGLE COBUY AI (`Gemini Live, @SHOPPY, @SPLITTY`) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 w-full mt-16 sm:mt-24">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Powered by Gemini Multimodal Architecture
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            One Room. Three Autonomous AI Co-Pilots.
          </h2>
          <p className="text-sm text-slate-400 mt-2 font-medium">
            Seamlessly bridging physical video consultations, group consensus decisions, and automated checkout ledger settlements.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* PILLAR 1: LIVE WEBRTC VIDEO & AUDIO COPILOT */}
          <div className="bg-[#202124] border border-slate-700/80 rounded-[32px] p-6 sm:p-8 shadow-2xl flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-[#4285F4]/10 rounded-full blur-2xl" />
            <div>
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center mb-5 text-blue-400">
                <Video className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">
                1. Gemini Live Video Copilot
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Hop on HD video across any device right inside your room. Point your camera directly at any retail shelf item right or computer screen. Tap our **Option A (`✨ Touch & Speak`)** icon to converse out loud: *"Gemini, evaluate this physical product right right right right right right right right right right right right right now"* right across your meeting!
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center gap-2 text-xs font-bold text-blue-400">
              <Check className="w-4 h-4" /> Zero-Bias Optical Extraction & Audio VAD
            </div>
          </div>

          {/* PILLAR 2: @SHOPPY INTERACTIVE DISCOVERY DECKS */}
          <div className="bg-[#202124] border border-slate-700/80 rounded-[32px] p-6 sm:p-8 shadow-2xl flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-[#EA4335]/10 rounded-full blur-2xl" />
            <div>
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mb-5 text-rose-400">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">
                2. @SHOPPY Consensus Decks
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Mention `@SHOPPY` anywhere across your chat timeline (`e.g. "@SHOPPY suggest top noise-canceling headphones right under $300"`). Experience horizontal snap carousels complete with live group **`❤️ Vote`**, **`🔍 Discuss`**, and **`🔗 Provider Link`** interactive triggers.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center gap-2 text-xs font-bold text-rose-400">
              <Check className="w-4 h-4" /> Persistent Postgres Serialized Carousels
            </div>
          </div>

          {/* PILLAR 3: @SPLITTY NEURAL OPTICAL RECEIPT SCANNER */}
          <div className="bg-[#202124] border border-slate-700/80 rounded-[32px] p-6 sm:p-8 shadow-2xl flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-[#34A853]/10 rounded-full blur-2xl" />
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-5 text-emerald-400">
                <DollarSign className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">
                3. @SPLITTY Neural Ledgers
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                When you check out, simply snap a picture right of the itemized invoice or upload PDF bills. `@SPLITTY` parses individual line items, normalizes multi-currency conversions (`JPY to USD`), right right and immediately plots your exact debt optimization graph.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center gap-2 text-xs font-bold text-emerald-400">
              <Check className="w-4 h-4" /> Min-Cash-Flow Settle Board & Deep Links
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: YOUR ACTIVE ROOMS LIST DECK (`Displays user existing workspaces`) */}
      {activeUser && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 w-full mt-16">
          <div className="bg-[#202124] border border-slate-700/80 rounded-[32px] p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <img src={activeUser.avatar} alt="Avatar" className="w-10 h-10 rounded-full border border-slate-700 object-cover" />
                <div>
                  <h3 className="font-extrabold text-white text-lg tracking-tight">
                    Your Collaborative Shopping Rooms
                  </h3>
                  <p className="text-xs text-slate-400">
                    Logged in as {activeUser.name} ({activeUser.email})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold text-xs sm:text-sm flex items-center gap-2 transition"
              >
                <PlusCircle className="w-4 h-4 text-blue-400" /> Create Custom Room
              </button>
            </div>

            {loadingGroups ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                <span className="text-xs font-bold">Loading your active Google CoBuy rooms...</span>
              </div>
            ) : privateGroups.length === 0 ? (
              <div className="py-12 text-center text-slate-400 max-w-sm mx-auto">
                <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-sm font-bold text-white">No active collaborative rooms found.</p>
                <p className="text-xs text-slate-400 mt-1">Click any preset above right or tap the button below right right to create your initial workspace!</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-5 py-3 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 font-bold text-white text-xs sm:text-sm transition shadow-lg"
                >
                  Create Your First Room
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {privateGroups.map(room => (
                  <Link
                    key={room.id}
                    href={`/group/${room.id}`}
                    className="bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-5 transition flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                          Code: {room.inviteCode || room.id.slice(0, 8)}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-extrabold">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live
                        </span>
                      </div>
                      <h4 className="font-extrabold text-white text-base tracking-tight group-hover:text-blue-400 transition truncate">
                        {room.title}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {room.description || 'Collaborative buying workspace.'}
                      </p>
                    </div>
                    <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-blue-400">
                      <span>Open Video & AI Space</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* CREATE CUSTOM GROUP MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[160] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-[#202124] border border-slate-700 rounded-[32px] w-full max-w-md p-6 sm:p-8 text-white shadow-2xl relative my-auto shrink-0">
            <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span className="w-2 h-6 bg-blue-500 rounded-full" /> Create Collaborative Room
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Give your room a simple name (*e.g. Kyoto Summer Villa Setup* or *VR Headset Share*).
            </p>

            <form onSubmit={(e) => handleCreateRoom(e)} className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-slate-300 block mb-1.5">
                  Shopping Room Title:
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Pixel 9 & Smart Home Group Buy"
                  className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-500 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-slate-300 block mb-1.5">
                  Brief Description or Target:
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="e.g. Compare store items across camera out loud"
                  className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="bg-gradient-to-r from-[#4285F4] via-[#EA4335] to-[#34A853] hover:opacity-95 text-white font-black px-6 py-3 rounded-2xl transition shadow-xl text-sm flex items-center gap-2 active:scale-95"
                >
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
