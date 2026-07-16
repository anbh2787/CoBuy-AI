'use client';

import React, { useState } from 'react';
import { Group, User, SimplifiedDebt } from '@/lib/types';
import { calculateMemberBalances, simplifyDebts } from '@/lib/debt';
import { generatePaymentLinks } from '@/lib/payments';
import { ArrowRight, CheckCircle2, QrCode, Wallet, CreditCard, ShieldCheck } from 'lucide-react';

interface SettlementTableProps {
  group: Group;
  currentUser: User;
  onRecordSettlement: (fromUser: User, toUser: User, amount: number, method: string) => void;
}

export default function SettlementTable({ group, currentUser, onRecordSettlement }: SettlementTableProps) {
  const [selectedDebt, setSelectedDebt] = useState<SimplifiedDebt | null>(null);

  const balances = calculateMemberBalances(group.members, group.expenses, group.settlements);
  const simplifiedDebts = simplifyDebts(group.members, group.expenses, group.settlements);

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 text-slate-100 p-5 overflow-y-auto">
      <div className="pb-4 border-b border-slate-800">
        <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          Who Owes Whom Table
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Min-Cash-Flow graph calculation automatically compresses multiple group expenses into least transfers required.
        </p>
      </div>

      {/* Member Net Balance Section */}
      <div className="mt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Current Net Balances
        </h3>
        <div className="space-y-2.5">
          {balances.map(item => {
            const isPositive = item.netAmount > 0.01;
            const isNegative = item.netAmount < -0.01;
            const amountText = Math.abs(item.netAmount).toFixed(2);

            return (
              <div
                key={item.user.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-800/70 border border-slate-700/60"
              >
                <div className="flex items-center gap-3">
                  <img src={item.user.avatar} alt={item.user.name} className="w-8 h-8 rounded-full" />
                  <span className="font-medium text-sm text-slate-200">{item.user.name}</span>
                </div>
                <div className="text-right">
                  {isPositive ? (
                    <span className="text-emerald-400 font-bold text-sm">+${amountText} (Owed)</span>
                  ) : isNegative ? (
                    <span className="text-rose-400 font-bold text-sm">-${amountText} (Owes)</span>
                  ) : (
                    <span className="text-slate-400 font-semibold text-sm">$0.00 (Settled)</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Simplified Transfers Matrix */}
      <div className="mt-6 flex-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Simplified Actionable Settlements
        </h3>
        {simplifiedDebts.length === 0 ? (
          <div className="p-6 text-center bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
            <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="font-semibold text-sm text-slate-200">All balances are completely settled!</p>
            <p className="text-xs text-slate-400 mt-1">No group members currently owe each other any funds.</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {simplifiedDebts.map((debt, i) => (
              <div key={i} className="p-4 rounded-2xl bg-slate-800 border border-slate-700/80 flex flex-col gap-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-rose-400">{debt.fromUser.name}</span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  <span className="font-bold text-emerald-400">{debt.toUser.name}</span>
                  <span className="font-black text-white px-2.5 py-1 bg-slate-900 rounded-lg text-sm">
                    ${debt.amount.toFixed(2)}
                  </span>
                </div>

                <button
                  onClick={() => setSelectedDebt(debt)}
                  className="w-full mt-1 bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs py-2 rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  Settle / Pay Online
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settle Up Interactive Drawer / Modal */}
      {selectedDebt && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 text-white shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-brand-400" /> Settle Up Debt
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              Pay <strong className="text-slate-200">{selectedDebt.toUser.name}</strong> to immediately clear this group obligation.
            </p>

            <div className="my-5 p-4 bg-slate-800 rounded-2xl text-center border border-slate-700">
              <span className="text-xs uppercase text-slate-400 tracking-wider">Amount Due</span>
              <div className="text-4xl font-black text-brand-400 mt-1">${selectedDebt.amount.toFixed(2)}</div>
            </div>

            {/* Native Deep Payment Links */}
            <div className="space-y-2.5 text-sm">
              {generatePaymentLinks(selectedDebt.toUser, selectedDebt.amount, group.title).upiLink && (
                <a
                  href={generatePaymentLinks(selectedDebt.toUser, selectedDebt.amount, group.title).upiLink}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow transition"
                >
                  <QrCode className="w-5 h-5" /> Pay instantly via UPI (GPay / PhonePe)
                </a>
              )}

              {generatePaymentLinks(selectedDebt.toUser, selectedDebt.amount, group.title).venmoLink && (
                <a
                  href={generatePaymentLinks(selectedDebt.toUser, selectedDebt.amount, group.title).venmoLink}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow transition"
                >
                  Pay via Venmo ({selectedDebt.toUser.paymentHandleVenmo || '@user'})
                </a>
              )}

              <a
                href={generatePaymentLinks(selectedDebt.toUser, selectedDebt.amount, group.title).paypalLink}
                target="_blank"
                rel="noreferrer"
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition"
              >
                Pay via PayPal Link
              </a>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col gap-2">
              <button
                onClick={() => {
                  onRecordSettlement(selectedDebt.fromUser, selectedDebt.toUser, selectedDebt.amount, 'Direct Mobile Pay');
                  setSelectedDebt(null);
                }}
                className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold py-2.5 rounded-xl transition text-sm flex items-center justify-center gap-2 border border-emerald-500/40"
              >
                <CheckCircle2 className="w-4 h-4" /> Mark Paid inside Group Ledger
              </button>
              
              <button
                onClick={() => setSelectedDebt(null)}
                className="w-full text-slate-400 hover:text-white py-2 text-xs font-medium transition"
              >
                Cancel / Close Modal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
