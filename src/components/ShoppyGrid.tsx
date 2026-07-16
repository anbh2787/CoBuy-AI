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
      <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-widest text-amber-400 mb-2">
        <Sparkles className="w-4 h-4" /> @SHOPPY AI — Interactive Discovery Snap Carousel
      </div>

      <div className="flex gap-4 overflow-x-auto py-2 px-1 pb-3 snap-x no-scrollbar">
        {products.map((item) => {
          const hasVoted = item.votes && item.votes.includes(currentUserName);
          const voteCount = item.votes ? item.votes.length : 0;

          return (
            <div
              key={item.id}
              className="w-64 sm:w-72 shrink-0 bg-slate-900 border border-slate-700/90 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between transition hover:border-amber-500/50 snap-start"
            >
              <div>
                {/* Visual Image Header */}
                <div className="relative h-40 w-full bg-slate-950 overflow-hidden">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover transition hover:scale-105 duration-300"
                  />
                  <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-xl border border-slate-700/80 text-[11px] font-black text-amber-300 flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span>{item.rating || '⭐ 4.8'}</span>
                  </div>

                  <div className="absolute top-3 right-3 bg-slate-900/90 border border-slate-700 px-2.5 py-1 rounded-xl text-[10px] font-extrabold text-slate-300 uppercase tracking-wider truncate max-w-[110px]">
                    {item.vendor || 'Vendor'}
                  </div>
                </div>

                {/* Details Container */}
                <div className="p-4.5 space-y-2">
                  <h4 className="font-extrabold text-white text-base leading-snug tracking-tight truncate">
                    {item.title}
                  </h4>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-black text-emerald-400">
                      {item.price || `$${item.numericPrice}`}
                    </span>
                    {voteCount > 0 && (
                      <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full text-[11px] font-extrabold flex items-center gap-1">
                        ❤️ {voteCount} {voteCount === 1 ? 'Vote' : 'Votes'}
                      </span>
                    )}
                  </div>

                  {/* Consensus Voters display block */}
                  {item.votes && item.votes.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 truncate">
                      <strong className="text-slate-300">Voted by:</strong> {item.votes.join(', ')}
                    </div>
                  )}
                </div>
              </div>

              {/* ACTION BUTTONS TOOLBAR */}
              <div className="p-4 pt-1 space-y-2 bg-slate-900/90 border-t border-slate-800/60">
                <div className="flex items-center gap-2">
                  {/* VOTE TOGGLE */}
                  <button
                    type="button"
                    onClick={() => onVote(item.id)}
                    className={`flex-1 py-2.5 px-3 rounded-2xl font-black text-xs transition flex items-center justify-center gap-1.5 border shadow-md ${
                      hasVoted
                        ? 'bg-rose-600/30 text-rose-300 border-rose-500/60 ring-1 ring-rose-500'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${hasVoted ? 'fill-rose-400 text-rose-400' : 'text-slate-400'}`} />
                    <span>{hasVoted ? 'Voted!' : 'Vote'}</span>
                  </button>

                  {/* DISCUSS / ASK FURTHER */}
                  <button
                    type="button"
                    onClick={() => onDiscuss(item)}
                    className="py-2.5 px-3 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-brand-400 font-extrabold text-xs transition flex items-center gap-1.5"
                    title="Insert prompt asking @SHOPPY right right about this choice"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Discuss</span>
                  </button>
                </div>

                {/* OPEN REAL PROVIDER WEBSITE */}
                <a
                  href={item.externalUrl || 'https://www.google.com/search?q=' + encodeURIComponent(item.title)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:opacity-95 text-slate-950 font-black py-2.5 px-4 rounded-2xl transition text-xs flex items-center justify-center gap-2 shadow-lg"
                >
                  <ExternalLink className="w-4 h-4 text-slate-950" />
                  <span>Open Provider Web Link</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
