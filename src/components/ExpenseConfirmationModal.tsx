'use client';

import React, { useState, useEffect } from 'react';
import { Expense, ExpenseSplit, User } from '@/lib/types';
import { ShieldCheck, Sparkles, AlertTriangle, CheckCircle2, X, Users, DollarSign, RefreshCw } from 'lucide-react';

interface ExpenseConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (finalExpense: Expense) => void;
  draftExpense: Expense | null;
  allMembers: User[];
  baseCurrency: string;
}

export default function ExpenseConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  draftExpense,
  allMembers,
  baseCurrency = 'USD'
}: ExpenseConfirmationModalProps) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [splits, setSplits] = useState<ExpenseSplit[]>([]);
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal');

  useEffect(() => {
    if (draftExpense) {
      setTitle(draftExpense.title);
      setAmount(draftExpense.amount);

      if (draftExpense.splits && draftExpense.splits.length > 0) {
        setSplits(draftExpense.splits);
        const isEqual = draftExpense.splits.every(s => Math.abs(s.amountOwed - (draftExpense.amount / draftExpense.splits.length)) < 0.05);
        setSplitType(isEqual ? 'equal' : 'custom');
      } else {
        // Default to split equally across all existing members
        const count = allMembers.length || 1;
        const perPerson = Math.round((draftExpense.amount / count) * 100) / 100;
        const pct = Math.round((100 / count) * 100) / 100;
        setSplits(
          allMembers.map(m => ({
            userId: m.id,
            userName: m.name,
            amountOwed: perPerson,
            percentage: pct
          }))
        );
        setSplitType('equal');
      }
    }
  }, [draftExpense, allMembers]);

  if (!isOpen || !draftExpense) return null;

  const handleApplyEqualSplits = () => {
    setSplitType('equal');
    const count = allMembers.length || 1;
    const perPerson = Math.round((amount / count) * 100) / 100;
    const pct = Math.round((100 / count) * 100) / 100;
    setSplits(
      allMembers.map(m => ({
        userId: m.id,
        userName: m.name,
        amountOwed: perPerson,
        percentage: pct
      }))
    );
  };

  const handlePercentageChange = (userId: string, newPercentage: number) => {
    setSplitType('custom');
    setSplits(prev =>
      prev.map(s => {
        if (s.userId === userId) {
          const calculatedOwed = Math.round((amount * (newPercentage / 100)) * 100) / 100;
          return { ...s, percentage: newPercentage, amountOwed: calculatedOwed };
        }
        return s;
      })
    );
  };

  const handleCommit = (e: React.FormEvent) => {
    e.preventDefault();
    const confirmed: Expense = {
      ...draftExpense,
      title,
      amount,
      currency: baseCurrency,
      splits
    };
    onConfirm(confirmed);
  };

  const hasForeignCurrency = draftExpense.originalCurrency && draftExpense.originalCurrency.toUpperCase() !== baseCurrency.toUpperCase();

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-xl p-6 text-white shadow-2xl relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 text-slate-400 hover:text-white p-1 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-brand-400 font-extrabold text-xs uppercase tracking-widest mb-1">
          <Sparkles className="w-4 h-4" /> Human-in-the-Loop Verification
        </div>
        <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          Confirm AI Transaction Proposal
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Review Gemini's extracted amount, foreign currency conversion, and participant percentage shares right before saving directly into your real-time group ledger.
        </p>

        {/* FOREIGN CURRENCY CONVERSION ALERT NOTICE */}
        {hasForeignCurrency && (
          <div className="mt-5 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-start gap-3 shadow-lg">
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200">
              <strong className="font-bold block text-amber-400 text-sm mb-0.5">
                Foreign Currency Normalized (`{draftExpense.originalCurrency}`)
              </strong>
              Gemini visually parsed this bill as <strong className="text-white font-extrabold">{draftExpense.originalAmount} {draftExpense.originalCurrency}</strong>. 
              Because your group operates right in <strong className="text-white font-black">{baseCurrency}</strong>, it will automatically convert directly into <strong className="text-emerald-400 font-extrabold">${draftExpense.amount.toFixed(2)} {baseCurrency}</strong> inside the shared ledger.
            </div>
          </div>
        )}

        <form onSubmit={handleCommit} className="mt-6 space-y-5">
          {/* Main details box */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Transaction Title / Merchant
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Ledger Amount (`{baseCurrency}`)
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 font-bold text-brand-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={e => {
                    const val = parseFloat(e.target.value) || 0;
                    setAmount(val);
                    if (splitType === 'equal') {
                      const per = Math.round((val / (allMembers.length || 1)) * 100) / 100;
                      setSplits(prev => prev.map(s => ({ ...s, amountOwed: per })));
                    }
                  }}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3.5 py-2.5 text-base font-extrabold text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Paid By
              </label>
              <div className="bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-200 truncate flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{draftExpense.paidByName}</span>
              </div>
            </div>
          </div>

          {/* SPLIT % RATIO CONFIGURATOR */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-brand-400" /> Participant Split Allocation
              </label>

              <button
                type="button"
                onClick={handleApplyEqualSplits}
                className={`text-xs px-3 py-1 rounded-lg font-extrabold transition border ${
                  splitType === 'equal'
                    ? 'bg-brand-500/20 text-brand-400 border-brand-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                <RefreshCw className="w-3 h-3 inline mr-1" /> Split Equally across All
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {splits.map(split => {
                const pct = split.percentage !== undefined ? split.percentage : Math.round((split.amountOwed / (amount || 1)) * 100);

                return (
                  <div key={split.userId} className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 gap-3">
                    <span className="font-bold text-sm text-slate-200 truncate flex-1">{split.userName}</span>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1 text-xs">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          value={Math.round(pct)}
                          onChange={e => handlePercentageChange(split.userId, parseFloat(e.target.value) || 0)}
                          className="w-10 bg-transparent text-right font-black text-brand-400 focus:outline-none"
                        />
                        <span className="text-slate-400 font-bold ml-1">%</span>
                      </div>

                      <span className="text-xs font-extrabold text-emerald-400 min-w-[65px] text-right">
                        ${Number(split.amountOwed).toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 mt-2 italic">
              💡 Type directly in any percentage (%) field to manually assign exact proportional ratios before committing!
            </p>
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-2xl text-sm font-semibold text-slate-400 hover:text-white transition"
            >
              Discard Proposal
            </button>
            <button
              type="submit"
              className="bg-gradient-to-r from-emerald-600 via-teal-600 to-brand-600 hover:opacity-95 text-white font-black px-6 py-3.5 rounded-2xl transition shadow-xl text-sm sm:text-base flex items-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" /> Confirm & Commit straight right to Ledger
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
