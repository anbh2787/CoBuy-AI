'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { syncGoogleProfileToDatabase, updatePaymentHandles } from '@/lib/sync';
import { User } from '@/lib/types';
import { Sparkles, CreditCard, LogIn, LogOut, CheckCircle, X, Shield } from 'lucide-react';

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
    }, 1200);
  };

  return (
    <>
      <header className="bg-slate-950/95 border-b border-slate-800/80 sticky top-0 z-40 backdrop-blur-md h-16 flex items-center shadow-lg">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 flex items-center justify-between">
          
          <Link href="/" className="flex items-center gap-2.5 group transition">
            {/* OFFICIAL GOOGLE 4-COLOR AI SPARKLE BADGE */}
            <div className="relative p-2 rounded-2xl bg-slate-900 border border-slate-700/80 group-hover:scale-105 transition shadow-md flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 opacity-20 bg-gradient-to-r from-[#4285F4] via-[#EA4335] to-[#34A853]" />
              <Sparkles className="w-5 h-5 text-amber-400 z-10" />
            </div>
            
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-white text-lg tracking-tight">
                Google <span className="bg-gradient-to-r from-[#4285F4] via-[#EA4335] to-[#34A853] bg-clip-text text-transparent">CoBuy AI</span>
              </span>
            </div>

            <span className="hidden xl:flex items-center gap-1 text-[11px] font-mono text-slate-400 border border-slate-800 rounded-xl px-2.5 py-0.5 ml-2">
              ✨ Gemini Live & Google Meet Core
            </span>
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            {currentUser ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 transition text-slate-300 text-xs font-bold"
                  title="Configure instant receiving UPI, Google Pay & Venmo payment links"
                >
                  <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden md:inline">Google Pay & Links</span>
                </button>

                <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-8 h-8 rounded-full border border-slate-700 shrink-0 object-cover"
                  />
                  <span className="font-extrabold text-white text-xs hidden lg:inline max-w-[140px] truncate">
                    {currentUser.name}
                  </span>
                </div>

                <button
                  onClick={handleGoogleLogout}
                  className="text-slate-400 hover:text-rose-400 transition p-1.5 rounded-xl hover:bg-rose-500/10"
                  title="Sign out from Google"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleGoogleLogin}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-black px-4 py-2 rounded-2xl text-xs sm:text-sm transition shadow-lg flex items-center gap-2 group active:scale-95"
              >
                <div className="flex gap-0.5 items-center">
                  <span className="w-2 h-2 rounded-full bg-[#4285F4]" />
                  <span className="w-2 h-2 rounded-full bg-[#EA4335]" />
                  <span className="w-2 h-2 rounded-full bg-[#FBBC05]" />
                  <span className="w-2 h-2 rounded-full bg-[#34A853]" />
                </div>
                <span>Continue with Google</span>
              </button>
            )}
          </div>
        </div>
      </header>
      
      {/* GOOGLE MATERIAL YOU VERIFICATION MODAL (`Payment Links Setup`) */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-[#202124] border border-slate-700/80 rounded-[28px] w-full max-w-md p-6 sm:p-7 text-white shadow-2xl relative my-auto shrink-0">
            <button
              onClick={() => setShowPaymentModal(false)}
              className="absolute right-5 top-5 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-blue-400 text-xs font-extrabold uppercase tracking-widest mb-1.5">
              <Shield className="w-4 h-4" /> Google Wallet & Receiver Verification
            </div>
            <h3 className="text-2xl font-black flex items-center gap-2 tracking-tight">
              Payment & UPI Link Profiles
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Set up your personal receiving IDs. When someone taps "Settle" inside any group table, our system opens native deep links directly to Google Pay, Paytm, or PayPal!
            </p>

            <form onSubmit={handleSaveHandles} className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-slate-300 block mb-1.5">
                  UPI Virtual ID (India / Google Pay):
                </label>
                <input
                  type="text"
                  value={upi}
                  onChange={(e) => setUpi(e.target.value)}
                  placeholder="e.g. anujbhagat@okaxis or phone@paytm"
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-500 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Generates instant deep payment links (`upi://pay?pa=...`) right for Google Pay, PhonePe, and Paytm.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-slate-300 block mb-1.5">
                  Venmo Handle / PayPal (US & Global):
                </label>
                <input
                  type="text"
                  value={venmo}
                  onChange={(e) => setVenmo(e.target.value)}
                  placeholder="e.g. @anuj-bhagat or paypal.me/anuj"
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-500 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Connects instant cross-border settlement checkout web triggers.
                </p>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savedSuccess}
                  className="bg-gradient-to-r from-[#4285F4] via-[#EA4335] to-[#34A853] hover:opacity-95 text-white font-black px-6 py-3 rounded-2xl transition shadow-xl text-sm flex items-center gap-2 active:scale-95"
                >
                  {savedSuccess ? (
                    <>
                      <CheckCircle className="w-4 h-4" /> Profile Updated!
                    </>
                  ) : (
                    "Save Payment Links"
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
