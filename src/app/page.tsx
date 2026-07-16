'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Group, User } from '@/lib/types';
import { supabase } from '@/lib/supabaseClient';
import { fetchUserPrivateGroups, createPrivateGroup, syncGoogleProfileToDatabase } from '@/lib/sync';
import { PlusCircle, Share2, Users, Sparkles, LogIn, ShieldCheck, Camera, CreditCard, Lock, ArrowRight, Loader2, MessageSquare } from 'lucide-react';

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

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !activeUser) return;

    setIsCreating(true);
    const result = await createPrivateGroup(newTitle, newDesc, activeUser);
    setIsCreating(false);

    if (result) {
      setPrivateGroups([result, ...privateGroups]);
      setShowCreateModal(false);
      setNewTitle('');
      setNewDesc('');
      router.push(`/group/${result.id}`);
    } else {
      alert("Unable to create room inside Supabase. Verify database connection.");
    }
  };

  // 1. LOADING SCREEN
  if (isLoadingAuth) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-950">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin mb-4" />
        <p className="text-sm text-slate-400 font-medium animate-pulse">Checking authenticated session...</p>
      </div>
    );
  }

  // 2. STUNNING HERO LANDING FOR UNAUTHENTICATED USERS (GOOGLE LOGIN IN THE CENTER)
  if (!activeUser) {
    return (
      <div className="flex-1 flex flex-col items-center justify-between min-h-[calc(100vh-65px)] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-12 text-center relative overflow-hidden">
        {/* Glow backdrop decorative blobs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/4 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[450px] bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl w-full mx-auto flex flex-col items-center z-10 my-auto">
          {/* Top badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs sm:text-sm font-bold shadow-xl mb-6">
            <Sparkles className="w-4 h-4 text-brand-400" />
            <span>Next-Generation AI Social Shopping & Settlement Engine</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-none max-w-4xl">
            Collaborate, Buy, & <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-emerald-400 to-indigo-400">Split effortlessly</span> right inside chat.
          </h1>

          <p className="mt-6 text-base sm:text-xl text-slate-300 max-w-2xl font-normal leading-relaxed">
            Invite friends to private, secure chatrooms. Discuss shopping ideas, snap pictures of live receipts, let Google Gemini parse itemized lines, and settle up instantaneously via native mobile payment deep links.
          </p>

          {/* CENTERPIECE GOOGLE LOGIN ACTION BOX */}
          <div className="mt-10 p-2 bg-gradient-to-r from-emerald-500/30 via-teal-500/30 to-brand-500/30 rounded-3xl p-1.5 shadow-2xl animate-pulse">
            <div className="bg-slate-950 px-8 py-8 sm:px-12 sm:py-10 rounded-2xl border border-white/15 flex flex-col items-center max-w-lg shadow-2xl">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-3 flex items-center gap-1.5">
                <Lock className="w-4 h-4" /> Secure Private Room Authentication
              </span>
              
              <p className="text-sm text-slate-300 mb-6 font-medium">
                Sign in with your verified Google profile to access your private rooms or create shareable WhatsApp links.
              </p>

              <button
                onClick={handleGoogleLogin}
                className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black px-8 py-4 rounded-2xl text-base sm:text-lg shadow-2xl transition transform hover:scale-[1.02] flex items-center justify-center gap-3"
              >
                <LogIn className="w-6 h-6 text-slate-950" />
                <span>Continue with Google Account</span>
              </button>

              <p className="text-[11px] text-slate-500 mt-4 flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> End-to-end encrypted session. Zero spam guaranteed.
              </p>
            </div>
          </div>
        </div>

        {/* FEATURE WALKTHROUGH CARDS FOR HACKATHON PRESENTATION */}
        <div className="max-w-6xl w-full mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 z-10 text-left">
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-3xl p-6 shadow-xl backdrop-blur-md">
            <div className="w-12 h-12 rounded-2xl bg-brand-500/20 text-brand-400 flex items-center justify-center mb-4">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Private Collaborative Rooms</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Create dedicated chat tabs for weekend cabin getaways, shopping lists, or group vacations. Only verified invited members can ever enter your isolated room.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-3xl p-6 shadow-xl backdrop-blur-md">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
              <Camera className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Multimodal Gemini Vision</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Snap a picture right on your smartphone camera. Gemini 1.5 extracts itemized prices, calculates tips/taxes, and splits costs proportionally right inside chat.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-3xl p-6 shadow-xl backdrop-blur-md">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
              <CreditCard className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Min-Cash-Flow 1-Click Pay</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Our graph algorithm compresses complex circular debts into minimum transfers. Settle instantly on mobile using embedded UPI (`upi://`) or Venmo links!
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 3. LOGGED IN PRIVATE DASHBOARD (EXCLUSIVELY YOUR PRIVATE ROOMS)
  return (
    <div className="max-w-7xl mx-auto w-full px-4 py-8 sm:px-6">
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-8 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            Your Private Rooms <Lock className="w-6 h-6 text-emerald-400" />
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Exclusively displaying private expenserooms tied to your verified Google profile (`{activeUser.email}`).
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 hover:opacity-95 text-white font-extrabold py-3.5 px-6 rounded-2xl flex items-center gap-2.5 transition shadow-xl shadow-brand-500/25 text-sm"
        >
          <PlusCircle className="w-5 h-5" /> + Create Private Expense Room
        </button>
      </div>

      {/* Private Rooms Roster */}
      {loadingGroups ? (
        <div className="py-24 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
          <span className="text-sm font-medium">Loading your private encrypted rooms from Supabase...</span>
        </div>
      ) : privateGroups.length === 0 ? (
        <div className="my-12 p-12 bg-slate-900/60 rounded-3xl border border-dashed border-slate-800 text-center max-w-2xl mx-auto shadow-xl">
          <Sparkles className="w-12 h-12 text-brand-400 mx-auto mb-3 opacity-80" />
          <h3 className="text-xl font-bold text-white">No Private Rooms Found</h3>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            You currently haven't joined or created any private chatrooms. Create a room right now to generate your shareable WhatsApp invite code!
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-6 bg-brand-600 hover:bg-brand-500 text-white font-bold py-3 px-6 rounded-2xl transition shadow-lg text-sm inline-flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" /> Start New Private Group
          </button>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {privateGroups.map(g => (
            <div
              key={g.id}
              className="bg-slate-900/90 border border-slate-800/90 hover:border-brand-500/60 rounded-3xl p-6 flex flex-col justify-between transition-all duration-200 shadow-xl group"
            >
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-3">
                  <span className="flex items-center gap-1.5 bg-slate-800 py-1 px-3 rounded-full text-emerald-400 border border-emerald-500/20">
                    <Lock className="w-3 h-3 text-emerald-400" /> Private Room ({g.members.length} friends)
                  </span>
                  <span className="text-slate-400">{g.expenses.length} expenses</span>
                </div>

                <h2 className="text-xl font-extrabold text-white group-hover:text-brand-400 transition mt-2 truncate">
                  {g.title}
                </h2>
                <p className="text-sm text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                  {g.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <Link
                  href={`/join/${g.inviteCode}`}
                  className="text-xs text-slate-400 hover:text-brand-400 font-medium flex items-center gap-1 transition"
                  title="View and copy shareable WhatsApp invite code"
                >
                  <Share2 className="w-3.5 h-3.5" /> Code: <strong className="text-slate-200">{g.inviteCode}</strong>
                </Link>

                <Link
                  href={`/group/${g.id}`}
                  className="bg-slate-800 hover:bg-brand-600 text-slate-200 hover:text-white font-bold px-4 py-2.5 rounded-2xl text-sm transition flex items-center gap-1.5 shadow"
                >
                  Enter Room <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal to create a new private room */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 text-white shadow-2xl relative">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Lock className="w-5 h-5 text-emerald-400" /> New Private Expense Room
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Creates a secure room in Supabase table `groups` and equips you with an instant viral WhatsApp link.
            </p>

            <form onSubmit={handleCreateGroup} className="mt-5 space-y-4">
              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">Room Title / Occasion</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Goa Beach Vacation Resort 2026 🌴"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">Room Description / Budget Goal</label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="e.g. Collaborative tab for suites, scooter hire, and shack dining."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl transition shadow flex items-center gap-2 text-sm"
                >
                  {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create & Enroll immediately'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
