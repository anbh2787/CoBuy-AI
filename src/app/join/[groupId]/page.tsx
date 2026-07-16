'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Group, User } from '@/lib/types';
import { supabase } from '@/lib/supabaseClient';
import { syncGoogleProfileToDatabase, fetchGroupByCodeOrId } from '@/lib/sync';
import { Sparkles, ArrowRight, ShieldCheck, Users, LogIn, Lock, Loader2 } from 'lucide-react';

interface PageProps {
  params: { groupId: string };
}

export default function JoinGroupPage({ params }: PageProps) {
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const checkUserAndRoom = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      let profile: User | null = null;
      if (session?.user) {
        profile = await syncGoogleProfileToDatabase(session.user);
        setCurrentUser(profile);
      }

      const found = await fetchGroupByCodeOrId(params.groupId);
      setGroup(found);
      setLoading(false);
    };
    checkUserAndRoom();
  }, [params.groupId]);

  const handleGoogleSignIn = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.href,
        },
      });
    } catch (e) {
      console.error('Google sign in error:', e);
    }
  };

  const handleConfirmJoin = async () => {
    if (!group || !currentUser) return;

    // Insert user right into group_members inside live Supabase DB
    try {
      await supabase.from('group_members').upsert({
        group_id: group.id,
        user_id: currentUser.id
      });
    } catch (err) {
      console.error("Group enrollment failure:", err);
    }

    router.push(`/group/${group.id}`);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-950">
        <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-3" />
        <p className="text-sm text-slate-400 font-medium">Verifying encrypted invite token (`{params.groupId}`)...</p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-950">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl">
          <p className="text-lg font-bold text-rose-400">Private Room Not Found</p>
          <p className="text-sm text-slate-400 mt-2">
            The link (`{params.groupId}`) may be invalid, deleted, or expired.
          </p>
          <button
            onClick={() => router.push('/')}
            className="mt-6 bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-2xl text-sm font-bold transition"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const isAlreadyJoined = currentUser ? group.members.some(m => m.id === currentUser.id) : false;

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-slate-950 to-slate-900">
      <div className="max-w-md w-full bg-slate-900/95 border border-slate-700 rounded-3xl p-7 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/15 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

        <div className="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 text-xs font-black py-1.5 px-3 rounded-full mb-4 border border-emerald-500/30 shadow-sm uppercase tracking-wider">
          <Lock className="w-3.5 h-3.5" /> Private Room Invitation
        </div>

        <h1 className="text-2xl font-black text-white tracking-tight">{group.title}</h1>
        <p className="text-sm text-slate-400 mt-2 leading-relaxed">{group.description}</p>

        {/* Current Members Panel */}
        <div className="my-6 p-4 bg-slate-800/80 rounded-2xl border border-slate-700/60 flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400 flex items-center gap-1.5 font-bold">
              <Users className="w-4 h-4 text-emerald-400" /> Private Room Members
            </span>
            <span className="font-bold text-slate-200">{group.members.length} participants</span>
          </div>
          <div className="flex -space-x-2 overflow-hidden py-1">
            {group.members.map(m => (
              <img key={m.id} className="inline-block h-8 w-8 rounded-full ring-2 ring-slate-800" src={m.avatar} alt={m.name} title={m.name} />
            ))}
          </div>
        </div>

        {/* Authentication or Instant Enter Button */}
        {!currentUser ? (
          <div className="p-5 bg-slate-950/80 rounded-2xl border border-white/10 text-center shadow-inner">
            <p className="text-xs text-slate-300 font-bold uppercase tracking-wider mb-3">
              Google Account Verification Required
            </p>
            <p className="text-xs text-slate-400 mb-5">
              To keep shared receipts, expenses, and payment VPAs strictly confidential, please verify your identity before entering this private room.
            </p>
            <button
              onClick={handleGoogleSignIn}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black py-3.5 px-6 rounded-2xl shadow-xl transition flex items-center justify-center gap-2.5 text-base"
            >
              <LogIn className="w-5 h-5 text-slate-950" /> Continue with Google
            </button>
          </div>
        ) : (
          <div>
            <div className="p-4 bg-slate-950/70 rounded-2xl border border-emerald-500/40 text-left mb-6">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <ShieldCheck className="w-3.5 h-3.5" /> Ready to Enter ({currentUser.email})
              </span>
              <div className="flex items-center gap-3">
                <img src={currentUser.avatar} alt={currentUser.name} className="w-10 h-10 rounded-full border border-emerald-500" />
                <div>
                  <p className="text-sm font-bold text-white">{currentUser.name}</p>
                  <span className="text-[11px] text-slate-400 font-medium">Verified Google Session</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleConfirmJoin}
              className="w-full bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 hover:opacity-95 text-white font-black py-4 px-6 rounded-2xl shadow-2xl shadow-brand-500/25 text-base transition flex items-center justify-center gap-2.5"
            >
              {isAlreadyJoined ? 'Re-Enter Private Room' : 'Confirm Membership & Enter'} <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        <p className="text-center text-[11px] text-slate-500 mt-4 flex items-center justify-center gap-1 font-medium">
          <ShieldCheck className="w-3.5 h-3.5" /> Supabase Realtime synchronized calculation engine.
        </p>
      </div>
    </div>
  );
}
