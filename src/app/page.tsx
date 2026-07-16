'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Group, User } from '@/lib/types';
import { supabase } from '@/lib/supabaseClient';
import { fetchUserPrivateGroups, createPrivateGroup, syncGoogleProfileToDatabase } from '@/lib/sync';
import { Plus, Users, Sparkles, Camera, CreditCard, Lock, ArrowRight, Loader2, Video, ShoppingBag, X, ChevronRight } from 'lucide-react';

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
      console.error('Google Sign-In failed:', e);
    }
  };

  const handleCreateRoom = async (e?: React.FormEvent, presetTitle?: string, presetDesc?: string) => {
    if (e) e.preventDefault();
    if (!activeUser) {
      handleGoogleLogin();
      return;
    }

    const titleToUse = (presetTitle || newTitle || "CoBuy Room").trim();
    const descToUse = (presetDesc || newDesc || "Shared collaborative group").trim();

    setIsCreating(true);
    try {
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
      
      {/* SECTION 1: HERO SHOWCASE (ZERO TEXT CLUTTER) */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 w-full pt-10 sm:pt-14 flex flex-col items-center text-center">
        
        <h1 className="text-4xl sm:text-6xl font-extrabold text-[#22252A] tracking-tight leading-tight">
          Shop on Live Video. <br />
          <span className="text-[#2B4C7E]">Consult AI. Split Instantly.</span>
        </h1>

        {/* COMPACT DASHBOARD CARD */}
        <div className="mt-8 w-full max-w-md bg-white border border-amber-900/15 rounded-[28px] p-5 shadow-sm">
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
      <section className="max-w-5xl mx-auto px-4 sm:px-6 w-full mt-12">
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
              <Loader2 className="w-5 h-5 animate-spin text-[#2B4C7E]" />
            </div>
          ) : privateGroups.length === 0 ? (
            <div className="bg-white border border-amber-900/10 rounded-2xl p-6 text-center text-xs font-bold text-slate-400">
              No active spaces yet. Tap "New CoBuy Room" above to begin.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {privateGroups.map(room => (
                <Link
                  key={room.id}
                  href={`/group/${room.id}`}
                  className="bg-white hover:bg-[#F4F1EA] border border-amber-900/15 rounded-2xl p-4 flex items-center justify-between transition shadow-xs group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#2B4C7E] text-white flex items-center justify-center font-bold text-base shrink-0">
                      {room.title.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-[#22252A] truncate">
                        {room.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium truncate flex items-center gap-1">
                        <Users className="w-3 h-3 text-[#2B4C7E]" /> {room.members.length} members
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* CREATE ROOM MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-amber-900/15 rounded-[28px] w-full max-w-sm p-6 shadow-xl text-[#22252A] relative">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 p-1 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-extrabold flex items-center gap-2 mb-4">
              ✨ New CoBuy Workspace
            </h3>

            <form onSubmit={(e) => handleCreateRoom(e)} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#22252A] block mb-1">Room Title:</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Living Room Furniture"
                  className="w-full bg-slate-50 border border-amber-900/15 rounded-xl px-3 py-2.5 text-sm text-[#22252A] font-medium focus:outline-none focus:ring-2 focus:ring-[#2B4C7E] transition"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="bg-[#2B4C7E] hover:bg-[#203960] text-white font-bold px-5 py-2 rounded-xl text-xs transition shadow-xs flex items-center gap-1.5"
                >
                  {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
