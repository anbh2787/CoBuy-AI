'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { syncGoogleProfileToDatabase, updatePaymentHandles } from '@/lib/sync';
import { User } from '@/lib/types';
import { Sparkles, CreditCard, LogOut, CheckCircle, X } from 'lucide-react';

export default function Navbar() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [upi, setUpi] = useState('');
  const [venmo, setVenmo] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await syncGoogleProfileToDatabase(session.user);
        setCurrentUser(profile);
        if (profile) {
          setUpi(profile.paymentHandleUpi || '');
          setVenmo(profile.paymentHandleVenmo || '');
        }
      } else {
        setCurrentUser(null);
      }
    };
    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await syncGoogleProfileToDatabase(session.user);
        setCurrentUser(profile);
        if (profile) {
          setUpi(profile.paymentHandleUpi || '');
          setVenmo(profile.paymentHandleVenmo || '');
        }
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.href,
      },
    });
  };

  const handleGoogleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleSaveHandles = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    await updatePaymentHandles(currentUser.id, upi, venmo);
    setCurrentUser(prev => prev ? { ...prev, paymentHandleUpi: upi, paymentHandleVenmo: venmo } : prev);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setShowPaymentModal(false);
    }, 1000);
  };

  return (
    <>
      <header className="bg-[#F9F7F1]/95 border-b border-amber-900/10 sticky top-0 z-40 backdrop-blur-md h-16 flex items-center shadow-sm">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 flex items-center justify-between">
          
          <Link href="/" className="flex items-center gap-2 group transition">
            <div className="p-2 rounded-xl bg-white border border-amber-900/10 shadow-xs flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#D99B26]" />
            </div>
            <span className="font-extrabold text-[#22252A] text-lg tracking-tight">
              Google <span className="text-[#2B4C7E]">CoBuy AI</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-amber-900/15 hover:bg-[#F4F1EA] transition text-[#22252A] text-xs font-bold shadow-xs active:scale-95"
                  title="Configure Payment IDs"
                >
                  <CreditCard className="w-3.5 h-3.5 text-[#2B4C7E]" />
                  <span>Pay IDs</span>
                </button>

                <div className="flex items-center gap-2 pl-2 border-l border-amber-900/10">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-8 h-8 rounded-full border border-amber-900/15 shrink-0 object-cover shadow-xs"
                  />
                  <span className="font-bold text-[#22252A] text-xs hidden sm:inline max-w-[120px] truncate">
                    {currentUser.name}
                  </span>
                </div>

                <button
                  onClick={handleGoogleLogout}
                  className="text-slate-500 hover:text-[#C45A45] p-2 rounded-full transition hover:bg-slate-100"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              /* OFFICIAL UNIVERSAL SIGN IN WITH GOOGLE BUTTON */
              <button
                onClick={handleGoogleLogin}
                className="bg-white hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 rounded-full border border-slate-300 shadow-sm flex items-center gap-2.5 text-xs sm:text-sm transition active:scale-95"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Sign in with Google</span>
              </button>
            )}
          </div>
        </div>
      </header>
      
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-amber-900/15 rounded-[28px] w-full max-w-sm p-6 text-[#22252A] shadow-xl relative my-auto">
            <button
              onClick={() => setShowPaymentModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 p-1 rounded-full transition"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-extrabold flex items-center gap-2 mb-4">
              💳 Payment IDs
            </h3>

            <form onSubmit={handleSaveHandles} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#22252A] block mb-1">
                  UPI Virtual ID (Google Pay / India):
                </label>
                <input
                  type="text"
                  value={upi}
                  onChange={(e) => setUpi(e.target.value)}
                  placeholder="anujbhagat@okaxis"
                  className="w-full bg-slate-50 border border-amber-900/15 rounded-xl px-3 py-2 text-sm text-[#22252A] font-medium focus:outline-none focus:ring-2 focus:ring-[#2B4C7E] transition"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#22252A] block mb-1">
                  Venmo / PayPal Handle (US & Global):
                </label>
                <input
                  type="text"
                  value={venmo}
                  onChange={(e) => setVenmo(e.target.value)}
                  placeholder="@anuj-bhagat"
                  className="w-full bg-slate-50 border border-amber-900/15 rounded-xl px-3 py-2 text-sm text-[#22252A] font-medium focus:outline-none focus:ring-2 focus:ring-[#2B4C7E] transition"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savedSuccess}
                  className="bg-[#2B4C7E] hover:bg-[#203960] text-white font-bold px-5 py-2 rounded-xl text-xs transition flex items-center gap-1.5"
                >
                  {savedSuccess ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-300" /> Saved
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
