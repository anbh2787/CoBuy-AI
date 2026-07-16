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
      {/* WARM CREAM NAVIGATION BAR (`bg-[#F9F7F1]` with soft elevated border) */}
      <header className="bg-[#F9F7F1]/95 border-b border-amber-900/10 sticky top-0 z-40 backdrop-blur-md h-16 flex items-center shadow-sm">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 flex items-center justify-between">
          
          <Link href="/" className="flex items-center gap-2.5 group transition">
            <div className="relative p-2 rounded-2xl bg-white border border-amber-900/10 shadow-sm group-hover:scale-105 transition flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#D99B26]" />
            </div>
            
            <div className="flex items-center gap-1.5">
              <span className="font-black text-[#22252A] text-lg tracking-tight">
                Google <span className="text-[#2B4C7E]">CoBuy AI</span>
              </span>
            </div>

            <span className="hidden xl:flex items-center gap-1.5 text-[11px] font-bold text-[#4A7C59] bg-white border border-[#4A7C59]/20 rounded-xl px-2.5 py-0.5 ml-2 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4A7C59] animate-pulse" /> Collaborative Video & Vision
            </span>
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            {currentUser ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-amber-900/10 hover:bg-[#F4F1EA] transition text-[#22252A] text-xs font-bold shadow-xs"
                  title="Configure instant receiving UPI, Google Pay & Venmo payment links"
                >
                  <CreditCard className="w-3.5 h-3.5 text-[#2B4C7E]" />
                  <span className="hidden md:inline">Google Pay & Links</span>
                </button>

                <div className="flex items-center gap-2 pl-2 border-l border-amber-900/10">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-8 h-8 rounded-full border border-amber-900/10 shrink-0 object-cover shadow-xs"
                  />
                  <span className="font-extrabold text-[#22252A] text-xs hidden lg:inline max-w-[140px] truncate">
                    {currentUser.name}
                  </span>
                </div>

                <button
                  onClick={handleGoogleLogout}
                  className="text-slate-500 hover:text-[#C45A45] transition p-1.5 rounded-xl hover:bg-[#C45A45]/10"
                  title="Sign out from Google"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleGoogleLogin}
                className="bg-[#2B4C7E] hover:bg-[#203960] text-white font-black px-4.5 py-2 rounded-2xl text-xs sm:text-sm transition shadow-sm flex items-center gap-2 group active:scale-95"
              >
                <div className="flex gap-1 items-center">
                  <span className="w-2 h-2 rounded-full bg-[#4285F4]" />
                  <span className="w-2 h-2 rounded-full bg-[#EA4335]" />
                  <span className="w-2 h-2 rounded-full bg-[#FBBC05]" />
                  <span className="w-2 h-2 rounded-full bg-[#34A853]" />
                </div>
                <span>Sign directly with Google</span>
              </button>
            )}
          </div>
        </div>
      </header>
      
      {/* RECEIVER VERIFICATION PAYMENT LINKS MODAL (`Mild editorial white container right across warm modal backdrop`) */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-[#F9F7F1] border border-amber-900/10 rounded-[28px] w-full max-w-md p-6 sm:p-7 text-[#22252A] shadow-2xl relative my-auto shrink-0">
            <button
              onClick={() => setShowPaymentModal(false)}
              className="absolute right-5 top-5 text-slate-500 hover:text-slate-900 p-1.5 rounded-xl hover:bg-black/5 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-1.5 text-[#2B4C7E] text-xs font-extrabold uppercase tracking-widest mb-1.5">
              <Shield className="w-4 h-4" /> Google Wallet & Receiver Setup
            </div>
            <h3 className="text-2xl font-black flex items-center gap-2 tracking-tight">
              Payment & UPI Link Profiles
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Set up your personal receiving IDs. When someone taps "Settle" inside any collaborative table, our system triggers native deep links straight to Google Pay, Paytm, or PayPal!
            </p>

            <form onSubmit={handleSaveHandles} className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-extrabold text-[#22252A] block mb-1.5">
                  UPI Virtual ID (India / Google Pay):
                </label>
                <input
                  type="text"
                  value={upi}
                  onChange={(e) => setUpi(e.target.value)}
                  placeholder="e.g. anujbhagat@okaxis or phone@paytm"
                  className="w-full bg-white border border-amber-900/15 rounded-2xl px-4 py-3 text-sm text-[#22252A] placeholder:text-slate-400 font-bold focus:outline-none focus:ring-2 focus:ring-[#2B4C7E] transition shadow-xs"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Generates direct payment links (`upi://pay?pa=...`) for Google Pay and PhonePe.
                </p>
              </div>

              <div>
                <label className="text-xs font-extrabold text-[#22252A] block mb-1.5">
                  Venmo Handle / PayPal (US & Global):
                </label>
                <input
                  type="text"
                  value={venmo}
                  onChange={(e) => setVenmo(e.target.value)}
                  placeholder="e.g. @anuj-bhagat or paypal.me/anuj"
                  className="w-full bg-white border border-amber-900/15 rounded-2xl px-4 py-3 text-sm text-[#22252A] placeholder:text-slate-400 font-bold focus:outline-none focus:ring-2 focus:ring-[#2B4C7E] transition shadow-xs"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Connects cross-border checkout triggers.
                </p>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-amber-900/10">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savedSuccess}
                  className="bg-[#2B4C7E] hover:bg-[#203960] text-white font-black px-6 py-3 rounded-2xl transition shadow-md text-sm flex items-center gap-2 active:scale-95"
                >
                  {savedSuccess ? (
                    <>
                      <CheckCircle className="w-4 h-4" /> Profile Saved!
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
