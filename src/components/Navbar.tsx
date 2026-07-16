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
      <header className="bg-slate-950/95 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md h-16 flex items-center shadow-md">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group transition">
            <div className="bg-gradient-to-tr from-brand-600 to-purple-600 p-2 rounded-xl group-hover:scale-105 transition shadow-md">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-white text-lg tracking-tight hidden xs:inline sm:text-xl">
              CoBuy AI
            </span>
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            {currentUser ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 transition text-slate-300 text-xs font-bold"
                  title="Configure instant receiving UPI, Paytm & Venmo payment links"
                >
                  <CreditCard className="w-3.5 h-3.5 text-brand-400" />
                  <span className="hidden md:inline">Payment Links</span>
                </button>

                <div className="flex items-center gap-2 pl-1 border-l border-slate-800">
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
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black px-4.5 py-2 rounded-2xl text-xs sm:text-sm transition shadow-lg flex items-center gap-2"
              >
                <LogIn className="w-4 h-4 text-slate-950" /> Continue with Google
              </button>
            )}
          </div>
        </div>
      </header>

      {/* SETUP UPI/VENMO HANDLES POPUP - COMPLETELY CENTERED DIRECTLY RIGHT ON EVERY MOBILE & DESKTOP SCREEN */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 text-white shadow-2xl relative my-auto shrink-0">
            <button
              onClick={() => setShowPaymentModal(false)}
              className="absolute right-5 top-5 text-slate-400 hover:text-white p-1.5 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-brand-400 text-xs font-extrabold uppercase tracking-widest mb-1">
              <Shield className="w-4 h-4" /> Receiver Verification
            </div>
            <h3 className="text-2xl font-black flex items-center gap-2 tracking-tight">
              Setup UPI & Venmo Links
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Configure your exact receiving IDs. When someone taps "Settle" inside the financial summary table, our application triggers deep mobile links straight right onto their phone apps!
            </p>

            <form onSubmit={handleSaveHandles} className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-slate-300 block mb-1.5">
                  UPI ID / Virtual Address (India):
                </label>
                <input
                  type="text"
                  value={upi}
                  onChange={(e) => setUpi(e.target.value)}
                  placeholder="e.g. anujbhagat@okaxis or phone@paytm"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Generates instant native payment links (`upi://pay?pa=...`) for Google Pay, PhonePe, & Paytm!
                </p>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-slate-300 block mb-1.5">
                  Venmo Handle / PayPal (Global / US):
                </label>
                <input
                  type="text"
                  value={venmo}
                  onChange={(e) => setVenmo(e.target.value)}
                  placeholder="e.g. @anuj-bhagat or anuj-venmo"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Generates instant direct web links right for Venmo and PayPal.
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
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white font-black px-6 py-3 rounded-xl transition shadow-xl text-sm flex items-center gap-2"
                >
                  {savedSuccess ? (
                    <>
                      <CheckCircle className="w-4 h-4" /> Saved Successfully!
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
