'use client';

import React from 'react';
import { ShoppyItem } from '@/lib/types';
import { Heart, ExternalLink, MessageSquare, Sparkles, Star } from 'lucide-react';

interface ShoppyGridProps {
  products: ShoppyItem[];
  currentUserName: string;
  onVote: (productId: string) => void;
  onDiscuss: (item: ShoppyItem) => void;
}

export default function ShoppyGrid({ products, currentUserName, onVote, onDiscuss }: ShoppyGridProps) {
  if (!products || products.length === 0) return null;

  return (
    <div className="mt-4 w-full">
      <div className="flex items-center gap-2 text-xs font-extrabold text-[#2B4C7E] uppercase tracking-wider mb-3">
        <Sparkles className="w-4 h-4 text-[#D99B26]" /> @SHOPPY AI — Curated Visual Recommendations
      </div>

      <div className="flex gap-4 overflow-x-auto py-2 px-1 pb-3 snap-x no-scrollbar">
        {products.map((item) => {
          const hasVoted = item.votes && item.votes.includes(currentUserName);
          const voteCount = item.votes ? item.votes.length : 0;

          return (
            <div
              key={item.id}
              className="w-64 sm:w-72 shrink-0 bg-white border border-amber-900/15 rounded-[28px] overflow-hidden shadow-sm flex flex-col justify-between transition hover:border-[#2B4C7E]/40 snap-start text-[#22252A]"
            >
              <div>
                {/* Visual Image Header */}
                <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover transition hover:scale-105 duration-300"
                  />
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-xl border border-amber-900/10 text-xs font-black text-[#22252A] flex items-center gap-1 shadow-xs">
                    <Star className="w-3 h-3 text-[#D99B26] fill-[#D99B26]" />
                    <span>{item.rating || '4.8'}</span>
                  </div>

                  <div className="absolute top-3 right-3 bg-[#2B4C7E]/95 text-white border border-transparent px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase tracking-wider truncate max-w-[110px] shadow-xs">
                    {item.vendor || 'Vendor'}
                  </div>
                </div>

                {/* Details Container */}
                <div className="p-4.5 space-y-2">
                  <h4 className="font-extrabold text-[#22252A] text-base leading-snug tracking-tight line-clamp-2 min-h-[3.2rem]">
                    {item.title}
                  </h4>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-lg font-black text-[#4A7C59]">
                      {item.price || `$${item.numericPrice}`}
                    </span>
                    {voteCount > 0 && (
                      <span className="bg-[#C45A45]/15 text-[#C45A45] border border-[#C45A45]/25 px-2.5 py-0.5 rounded-full text-xs font-extrabold flex items-center gap-1">
                        ❤️ {voteCount} {voteCount === 1 ? 'Vote' : 'Votes'}
                      </span>
                    )}
                  </div>

                  {/* Consensus Voters display block */}
                  {item.votes && item.votes.length > 0 && (
                    <div className="pt-2 border-t border-amber-900/10 text-xs text-slate-500 truncate">
                      <strong className="text-slate-700 font-bold">Voted by:</strong> {item.votes.join(', ')}
                    </div>
                  )}
                </div>
              </div>

              {/* ACTION BUTTONS TOOLBAR */}
              <div className="p-4 pt-2 space-y-2 bg-[#F9F7F1]/70 border-t border-amber-900/10">
                <div className="flex items-center gap-2">
                  {/* VOTE TOGGLE */}
                  <button
                    type="button"
                    onClick={() => onVote(item.id)}
                    className={`flex-1 py-2.5 px-3 rounded-2xl font-bold text-xs transition flex items-center justify-center gap-1.5 border shadow-xs active:scale-95 ${
                      hasVoted
                        ? 'bg-[#C45A45] text-white border-[#C45A45]'
                        : 'bg-white hover:bg-slate-50 text-[#22252A] border-amber-900/15'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${hasVoted ? 'fill-white' : 'text-[#C45A45]'}`} />
                    <span>{hasVoted ? 'Voted' : 'Vote'}</span>
                  </button>

                  {/* DISCUSS IN CHAT */}
                  <button
                    type="button"
                    onClick={() => onDiscuss(item)}
                    className="flex-1 py-2.5 px-3 rounded-2xl bg-white hover:bg-slate-50 text-[#2B4C7E] font-bold text-xs transition border border-amber-900/15 flex items-center justify-center gap-1.5 shadow-xs active:scale-95"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-[#2B4C7E]" />
                    <span>Discuss</span>
                  </button>
                </div>

                {/* OPEN PROVIDER CHECKOUT LINK */}
                <a
                  href={item.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-2xl bg-[#2B4C7E] hover:bg-[#203960] text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-xs block active:scale-95"
                >
                  <span>Verify on Store & Buy</span>
                  <ExternalLink className="w-3.5 h-3.5 text-amber-300" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
