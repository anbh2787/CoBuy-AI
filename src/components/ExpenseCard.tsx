import React from 'react';
import { Expense } from '@/lib/types';
import { Receipt, CheckCircle2, Users, ArrowUpRight } from 'lucide-react';

interface ExpenseCardProps {
  expense: Expense;
}

export default function ExpenseCard({ expense }: ExpenseCardProps) {
  return (
    <div className="mt-3 bg-slate-900/95 border border-brand-500/30 rounded-2xl p-4 shadow-lg text-slate-200 w-full max-w-md">
      <div className="flex items-start justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-brand-500/20 text-brand-400">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-brand-400 tracking-wider uppercase">Structured Ledger Record</span>
            <h4 className="font-bold text-base text-white flex items-center gap-1.5">
              {expense.title}
            </h4>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-extrabold text-white">
            ${Number(expense.amount).toFixed(2)}
          </div>
          <span className="text-xs text-slate-400">paid by <strong className="text-slate-300">{expense.paidByName}</strong></span>
        </div>
      </div>

      {/* Split breakdown details */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-medium">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-slate-400" /> Split Breakdown ({expense.splits.length} people)
          </span>
          <span className="text-[11px]">Equal / Proportionate</span>
        </div>
        <div className="space-y-1.5 max-h-36 overflow-y-auto">
          {expense.splits.map((split, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm py-1 px-2.5 bg-slate-800/50 rounded-lg">
              <span className="text-slate-300 font-medium">{split.userName}</span>
              <span className="font-semibold text-slate-100">${Number(split.amountOwed).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Optional attached receipt thumbnail preview */}
      {expense.receiptImageUrl && (
        <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400 italic">Attached itemized receipt scanned</span>
          <a
            href={expense.receiptImageUrl}
            target="_blank"
            rel="noreferrer"
            className="text-brand-400 hover:underline flex items-center gap-1"
          >
            View Photo <ArrowUpRight className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}
