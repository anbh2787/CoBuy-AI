'use client';

import React, { useState } from 'react';
import { Camera, Sparkles, X, Loader2 } from 'lucide-react';
import { uploadReceiptToCloud } from '@/lib/sync';

interface ReceiptUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (cloudOrPreviewUrl: string, note: string, rawBase64ForAi?: string) => void;
}

const PRESET_RECEIPTS = [
  {
    title: 'Dinner Bill (Pizza & Beer)',
    amount: '$84.50',
    url: 'https://images.unsplash.com/photo-1554415707-c18de3d9742f?auto=format&fit=crop&w=600&q=80',
  },
  {
    title: 'Groceries (Fruits, Wine, Bakery)',
    amount: '$142.20',
    url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
  },
  {
    title: 'Ski Rental & Pass',
    amount: '$220.00',
    url: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=600&q=80',
  }
];

export default function ReceiptUploadModal({ isOpen, onClose, onSubmit }: ReceiptUploadModalProps) {
  const [selectedImage, setSelectedImage] = useState(PRESET_RECEIPTS[0].url);
  const [customUrl, setCustomUrl] = useState('');
  const [note, setNote] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [capturedFileName, setCapturedFileName] = useState('');
  const [capturedBase64, setCapturedBase64] = useState<string | undefined>(undefined);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setCapturedFileName(file.name);

    try {
      // 1. Capture Base64 pixel stream directly for Gemini 3.5 neural parsing
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        setCapturedBase64(base64Data);
        setSelectedImage(base64Data);

        // 2. Upload straight directly right to public 'receipts' Supabase Storage bucket for permanent chat history viewing across devices
        try {
          const permanentCloudUrl = await uploadReceiptToCloud(file);
          setCustomUrl(permanentCloudUrl);
        } catch (storageErr) {
          console.warn("Storage warning, continuing right with direct Base64 representation:", storageErr);
          setCustomUrl(base64Data);
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Camera upload processing failure:", err);
      setIsUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetUrl = customUrl.trim() ? customUrl : selectedImage;
    onSubmit(targetUrl, note || 'Uploaded real itemized camera photo for Gemini 3.5 parsing.', capturedBase64);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-6 text-white shadow-2xl relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 text-slate-400 hover:text-white p-1 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-extrabold flex items-center gap-2">
          <Camera className="w-6 h-6 text-brand-400" /> Snap Photo & Gemini Scan
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Camera captures transmit high-resolution Base64 visual streams right into Gemini 3.5 and upload permanently right across Supabase Storage.
        </p>

        <div className="mt-5 p-4 bg-gradient-to-br from-slate-800 to-slate-900 border border-brand-500/40 rounded-2xl">
          <span className="text-xs font-black uppercase tracking-wider text-brand-400 block mb-2">
            📸 Snap Photo on Camera or Gallery
          </span>
          <div className="relative flex flex-col sm:flex-row items-center justify-between gap-3">
            <label className="w-full bg-brand-600 hover:bg-brand-500 text-white text-xs sm:text-sm font-bold py-3.5 px-4 rounded-xl text-center cursor-pointer transition shadow-lg flex items-center justify-center gap-2">
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" /> Saving directly right to Supabase Storage...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" /> Open Smartphone Camera / Gallery
                </>
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="hidden"
              />
            </label>
            {capturedFileName && !isUploading && (
              <span className="text-[11px] text-emerald-400 font-extrabold truncate max-w-[200px]">
                ✓ Saved: {capturedFileName}
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
              Or choose instant sample high-res receipts right right here:
            </label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {PRESET_RECEIPTS.map((rec, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => {
                    setSelectedImage(rec.url);
                    setCustomUrl('');
                    setCapturedFileName('');
                    setCapturedBase64(undefined);
                  }}
                  className={`p-2 rounded-2xl border text-left transition relative overflow-hidden ${
                    selectedImage === rec.url && !customUrl
                      ? 'border-brand-500 bg-brand-500/15 ring-1 ring-brand-500'
                      : 'border-slate-700 bg-slate-800/60 hover:bg-slate-800'
                  }`}
                >
                  <img src={rec.url} alt={rec.title} className="w-full h-16 object-cover rounded-xl mb-1.5" />
                  <p className="text-xs font-bold text-slate-200 truncate">{rec.title}</p>
                  <p className="text-[11px] text-brand-400 font-extrabold">{rec.amount}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Conversational instructions for Gemini AI:
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder='e.g. "This bill is in Japanese Yen (¥), Bob got sushi, Anuj paid"'
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 hover:opacity-95 disabled:opacity-50 text-white font-black px-6 py-3 rounded-xl transition shadow-xl text-sm flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-white" /> Extract & Verify with Gemini
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
