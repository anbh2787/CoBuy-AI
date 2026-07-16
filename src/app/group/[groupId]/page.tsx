'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Group, Message, User, Expense, Settlement } from '@/lib/types';
import { supabase } from '@/lib/supabaseClient';
import { fetchGroupByCodeOrId, syncGoogleProfileToDatabase, uploadReceiptToCloud, AI_AVATAR } from '@/lib/sync';
import ExpenseCard from '@/components/ExpenseCard';
import SettlementTable from '@/components/SettlementTable';
import ExpenseConfirmationModal from '@/components/ExpenseConfirmationModal';
import ShoppyGrid from '@/components/ShoppyGrid';
import VideoCallModal from '@/components/VideoCallModal';
import { Send, Camera, Paperclip, Sparkles, Share2, Users, PanelsTopLeft, ArrowLeft, CheckCircle2, Lock, Loader2, LogIn, AtSign, FileText, Maximize2, X, Download, Video, PhoneCall } from 'lucide-react';
import Link from 'next/link';

interface PageProps {
  params: { groupId: string };
}

export default function GroupChatRoom({ params }: PageProps) {
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [showSidebarMobile, setShowSidebarMobile] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Human-in-the-loop confirmation modal state (@SPLITTY)
  const [pendingDraftExpense, setPendingDraftExpense] = useState<Expense | null>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);

  // Auto-complete mention states (@SHOPPY vs @SPLITTY vs participants)
  const [mentionSuggestions, setMentionSuggestions] = useState<{ id: string; name: string; subtitle: string; avatar: string; isAi?: boolean }[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Immersive full-screen document & photo viewer modal
  const [fullscreenViewer, setFullscreenViewer] = useState<{ type: 'image' | 'pdf'; url: string; title?: string } | null>(null);

  // Phase 6: Live Video & Multimodal AI Co-Pilot Call overlay state
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
  const [isCallActiveBanner, setIsCallActiveBanner] = useState(false);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initRoom = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      let profile: User | null = null;
      if (session?.user) {
        profile = await syncGoogleProfileToDatabase(session.user);
        setCurrentUser(profile);
      }

      const roomData = await fetchGroupByCodeOrId(params.groupId);
      setGroup(roomData);
      setLoading(false);
    };
    initRoom();

    const channel = supabase.channel(`private_room_${params.groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        if (payload.new && payload.new.content) {
          if (payload.new.content.includes('started a Live Group Video & AI Call')) {
            setIsCallActiveBanner(true);
          }
          setGroup(prev => {
            if (!prev) return prev;
            if (prev.messages.some(m => m.id === payload.new.id || m.content === payload.new.content)) return prev;
            if (payload.new.sender_id && !payload.new.is_ai_response && currentUser && payload.new.sender_id === currentUser.id) return prev;

            const member = prev.members.find(m => m.id === payload.new.sender_id);
            let cleanContent = payload.new.content || '';
            let recoveredProducts: any[] | undefined = undefined;
            if (cleanContent.includes('<!--SHOPPY_DATA:')) {
              const parts = cleanContent.split('<!--SHOPPY_DATA:');
              cleanContent = parts[0].trim();
              try {
                const jsonStr = parts[1].split('-->')[0];
                recoveredProducts = JSON.parse(jsonStr);
              } catch (e) { /* no-op */ }
            }
            const remoteMsg: Message = {
              id: payload.new.id || 'live-' + Date.now(),
              groupId: prev.id,
              senderId: payload.new.sender_id || 'remote',
              senderName: payload.new.sender_name || (member ? member.name : 'Member'),
              senderAvatar: payload.new.is_ai_response ? AI_AVATAR : (member ? member.avatar : `https://api.dicebear.com/7.x/avataaars/svg?seed=${payload.new.sender_name}`),
              content: cleanContent,
              imageUrl: payload.new.image_url || undefined,
              isAiResponse: payload.new.is_ai_response,
              structuredProducts: recoveredProducts,
              createdAt: payload.new.created_at || new Date().toISOString()
            };
            return { ...prev, messages: [...prev.messages, remoteMsg] };
          });
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'expenses' }, async payload => {
        if (payload.new && payload.new.amount) {
          const fresh = await fetchGroupByCodeOrId(params.groupId);
          if (fresh) setGroup(fresh);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'settlements' }, payload => {
        if (payload.new && payload.new.amount) {
          setGroup(prev => {
            if (!prev) return prev;
            if (prev.settlements.some(s => s.id === payload.new.id)) return prev;

            const remoteSet: Settlement = {
              id: payload.new.id || 'set-' + Date.now(),
              groupId: prev.id,
              fromUserId: payload.new.from_user_id,
              fromUserName: payload.new.from_user_name,
              toUserId: payload.new.to_user_id,
              toUserName: payload.new.to_user_name,
              amount: Number(payload.new.amount),
              paymentMethod: payload.new.payment_method || 'Mobile Pay',
              settledAt: payload.new.settled_at || new Date().toISOString()
            };
            return { ...prev, settlements: [...prev.settlements, remoteSet] };
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [params.groupId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [group?.messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMessageInput(val);

    if (!group) return;

    const match = val.match(/(^|\s)@([a-zA-Z0-9\s]*)$/);
    if (match) {
      const query = (match[2] || '').toLowerCase().trim();
      const candidates = [
        { id: 'shoppy', name: 'SHOPPY', subtitle: '🛍️ AI Discovery, Travel & Pre-Purchase Agent', avatar: AI_AVATAR, isAi: true },
        { id: 'splitty', name: 'SPLITTY', subtitle: '⚖️ AI Financial Co-Pilot & Receipt Engine', avatar: AI_AVATAR, isAi: true },
        ...group.members.map(m => ({ id: m.id, name: m.name, subtitle: 'Verified Participant', avatar: m.avatar, isAi: false }))
      ];

      const filtered = candidates.filter(c => c.name.toLowerCase().includes(query));
      setMentionSuggestions(filtered);
      setShowMentions(filtered.length > 0);
      setSelectedIndex(0);
    } else {
      setShowMentions(false);
    }
  };

  const handleSelectMention = (mentionName: string) => {
    const match = messageInput.match(/(^|\s)@([a-zA-Z0-9\s]*)$/);
    if (match && match.index !== undefined) {
      const prefix = messageInput.slice(0, match.index + match[1].length);
      setMessageInput(`${prefix}@${mentionName} `);
    } else {
      setMessageInput(prev => `${prev}@${mentionName} `);
    }
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showMentions && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((selectedIndex + 1) % mentionSuggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((selectedIndex - 1 + mentionSuggestions.length) % mentionSuggestions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectMention(mentionSuggestions[selectedIndex].name);
      } else if (e.key === 'Escape') {
        setShowMentions(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 p-6">
        <Loader2 className="w-10 h-10 text-brand-400 animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-400">Loading private encrypted workspace straight right right from Supabase...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-950">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl">
          <Lock className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-white">Private Room Locked</h2>
          <p className="text-sm text-slate-400 mt-2">
            Sign in right right with your verified Google account directly to access this collaborative space.
          </p>
          <button
            onClick={async () => {
              await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
            }}
            className="mt-6 w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black py-4 rounded-2xl text-base shadow-xl transition flex items-center justify-center gap-2"
          >
            <LogIn className="w-5 h-5 text-slate-950" /> Continue with Google
          </button>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-950">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl">
          <p className="text-lg font-bold text-rose-400">Private Room Not Found</p>
          <p className="text-sm text-slate-400 mt-2">This room identifier (`{params.groupId}`) does not exist inside Supabase right now.</p>
          <button onClick={() => router.push('/')} className="mt-6 bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-2xl font-bold text-sm">Back to Dashboard</button>
        </div>
      </div>
    );
  }

  const isAuthorizedMember = group.members.some(m => m.id === currentUser.id);
  if (!isAuthorizedMember) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-950">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl">
          <Lock className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h3 className="text-xl font-black text-white">Access Restricted</h3>
          <p className="text-sm text-slate-400 mt-2">
            Your verified profile (`{currentUser.email}`) is not enrolled right inside the member roster of <strong>{group.title}</strong> right now.
          </p>
          <button
            onClick={() => router.push(`/join/${group.inviteCode || group.id}`)}
            className="mt-6 bg-brand-600 hover:bg-brand-500 text-white font-bold py-3.5 px-6 rounded-2xl w-full shadow-lg transition"
          >
            Open Private Room Invitation &rarr;
          </button>
        </div>
      </div>
    );
  }

  // CLOSE CALL & COMMIT AI VISUAL NOTES TO CHAT TIMELINE PLUS AUTOMATIC @SHOPPY BUYING CAROUSEL
  const handleCloseVideoCallWithNotes = async (sessionNotes?: string[], lastImageBase64?: string) => {
    setIsVideoCallOpen(false);
    if (sessionNotes && sessionNotes.length > 0 && group && currentUser) {
      const summaryText = `📝 Post-Call AI Video Observations:\nDuring our meeting, Gemini Live evaluated our live stream and noted:\n\n${sessionNotes.map(note => `• ${note}`).join('\n\n')}`;
      
      const summaryMsg: Message = {
        id: 'postcall-' + Date.now(),
        groupId: group.id,
        senderId: 'user-splitty',
        senderName: '@GEMINI LIVE AI',
        senderAvatar: AI_AVATAR,
        content: summaryText,
        isAiResponse: true,
        createdAt: new Date().toISOString()
      };

      let nextGroup = { ...group, messages: [...group.messages, summaryMsg] };
      setGroup(nextGroup);

      try {
        await supabase.from('messages').insert({
          group_id: group.id,
          sender_id: currentUser.id,
          sender_name: '@GEMINI LIVE AI',
          content: summaryText,
          is_ai_response: true
        });
      } catch (err) {
        console.warn('Note persistence check note:', err);
      }

      // AUTOMATIC @SHOPPY POST-CALL BUYING CAROUSEL GENERATOR WITH IMAGE GROUNDING
      try {
        const observedItems = sessionNotes.join('. ');
        const shoppyPrompt = `Based on these items discovered during our live video evaluation (${observedItems}), find identical or highly similar products complete right with prices right and checkout links in our interactive deck!`;
        
        const shoppyRes = await fetch('/api/shoppy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageText: shoppyPrompt,
            imageBase64: lastImageBase64 || null,
            group: nextGroup,
            currentUserId: currentUser.id
          })
        });

        const shoppyData = await shoppyRes.json();
        if (shoppyData.structuredProducts && shoppyData.structuredProducts.length > 0) {
          const shoppyContent = `🛍️ @SHOPPY Post-Call Recommendations:\nBased on what our group just inspected across video together, here are matching buying choices with one-click consensus voting and verified checkouts right below!`;
          const shoppyMsg: Message = {
            id: 'post-shoppy-' + Date.now(),
            groupId: group.id,
            senderId: 'user-shoppy',
            senderName: '@SHOPPY AI',
            senderAvatar: AI_AVATAR,
            content: shoppyContent,
            isAiResponse: true,
            structuredProducts: shoppyData.structuredProducts,
            createdAt: new Date().toISOString()
          };

          setGroup(prev => prev ? { ...prev, messages: [...prev.messages, shoppyMsg] } : prev);

          const persistedString = `${shoppyContent}\n\n<!--SHOPPY_DATA:${JSON.stringify(shoppyData.structuredProducts)}-->`;
          await supabase.from('messages').insert({
            group_id: group.id,
            sender_id: currentUser.id,
            sender_name: '@SHOPPY AI',
            content: persistedString,
            is_ai_response: true
          });
        }
      } catch (shoppyErr) {
        console.warn('Post-call shoppy check note:', shoppyErr);
      }
    }
  };

  // START LIVE VIDEO & AI CALL ROOM BROADCAST
  const handleStartOrJoinVideoCall = async () => {
    setIsVideoCallOpen(true);
    if (!isCallActiveBanner && group && currentUser) {
      setIsCallActiveBanner(true);
      try {
        await supabase.from('messages').insert({
          group_id: group.id,
          sender_id: currentUser.id,
          sender_name: currentUser.name,
          content: `🟢 **${currentUser.name}** started a Live Group Video & AI Call in this room right now! Click the video icon right at the top right to hop directly inside!`,
          is_ai_response: false
        });
      } catch (err) { /* no-op */ }
    }
  };

  const handleInstantFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser || !group) return;

    setIsAiProcessing(true);

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const noteText = isPdf ? `Uploaded multi-page PDF invoice document (${file.name}) right for @SPLITTY neural extraction.` : `Captured live camera photo (${file.name}) directly right for @SPLITTY line item scanning.`;

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawBase64 = reader.result as string;
        
        let permanentUrl = rawBase64;
        try {
          const cloudPath = await uploadReceiptToCloud(file, rawBase64);
          if (cloudPath && !cloudPath.startsWith('blob:')) permanentUrl = cloudPath;
        } catch (storageErr) {
          console.warn("Storage upload note, continuing right with direct Base64 stream:", storageErr);
        }

        const userMsg: Message = {
          id: 'local-' + Date.now(),
          groupId: group.id,
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderAvatar: currentUser.avatar,
          content: noteText,
          imageUrl: permanentUrl,
          createdAt: new Date().toISOString()
        };

        const updatedMessages = [...group.messages, userMsg];
        let updatedGroup = { ...group, messages: updatedMessages };
        setGroup(updatedGroup);

        try {
          await supabase.from('messages').insert({
            group_id: group.id,
            sender_id: currentUser.id,
            sender_name: currentUser.name,
            content: noteText,
            image_url: permanentUrl || null,
            is_ai_response: false
          });
        } catch (err) { /* no-op */ }

        try {
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messageText: noteText,
              imageUrl: rawBase64,
              group: updatedGroup,
              currentUserId: currentUser.id
            })
          });

          const data = await response.json();
          
          const aiMsg: Message = {
            id: 'ai-' + Date.now(),
            groupId: group.id,
            senderId: 'user-splitty',
            senderName: '@SPLITTY AI',
            senderAvatar: AI_AVATAR,
            content: data.replyText,
            isAiResponse: true,
            createdAt: new Date().toISOString()
          };

          updatedGroup = {
            ...updatedGroup,
            messages: [...updatedGroup.messages, aiMsg]
          };
          setGroup(updatedGroup);

          try {
            await supabase.from('messages').insert({
              group_id: group.id,
              sender_id: currentUser.id,
              sender_name: '@SPLITTY AI',
              content: data.replyText,
              is_ai_response: true
            });
          } catch (e) { /* no-op */ }

          if (data.draftExpense) {
            setPendingDraftExpense({
              ...data.draftExpense,
              receiptImageUrl: permanentUrl
            });
            setShowConfirmationModal(true);
          }
        } catch (aiErr) {
          console.error("Neural processing note:", aiErr);
        } finally {
          setIsAiProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("FileUpload warning:", err);
      setIsAiProcessing(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageInput.trim() || !group || !currentUser) return;

    const textToSend = messageInput;
    setMessageInput('');
    setShowMentions(false);

    const userMsg: Message = {
      id: 'local-' + Date.now(),
      groupId: group.id,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      content: textToSend,
      createdAt: new Date().toISOString()
    };

    const updatedMessages = [...group.messages, userMsg];
    let updatedGroup = { ...group, messages: updatedMessages };
    setGroup(updatedGroup);

    try {
      await supabase.from('messages').insert({
        group_id: group.id,
        sender_id: currentUser.id,
        sender_name: currentUser.name,
        content: textToSend,
        is_ai_response: false
      });
    } catch (err) {
      console.warn("Message commit warning:", err);
    }

    const lower = textToSend.toLowerCase();
    const isShoppy = lower.includes('@shoppy');
    const isSplitty = lower.includes('@splitty') || lower.includes('@gemini') || lower.includes('paid') || textToSend.includes('$') || textToSend.includes('¥') || lower.includes('split');

    if (isShoppy) {
      setIsAiProcessing(true);
      try {
        const response = await fetch('/api/shoppy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageText: textToSend,
            group: updatedGroup,
            currentUserId: currentUser.id
          })
        });

        const data = await response.json();
        
        const shoppyMsg: Message = {
          id: 'ai-shoppy-' + Date.now(),
          groupId: group.id,
          senderId: 'user-shoppy',
          senderName: '@SHOPPY AI',
          senderAvatar: AI_AVATAR,
          content: data.replyText || 'Here are top curated choices fitting your parameters right below:',
          isAiResponse: true,
          structuredProducts: data.structuredProducts || [],
          createdAt: new Date().toISOString()
        };

        updatedGroup = {
          ...updatedGroup,
          messages: [...updatedGroup.messages, shoppyMsg]
        };
        setGroup(updatedGroup);

        try {
          const persistedString = `${shoppyMsg.content}\n\n<!--SHOPPY_DATA:${JSON.stringify(data.structuredProducts || [])}-->`;
          await supabase.from('messages').insert({
            group_id: group.id,
            sender_id: currentUser.id,
            sender_name: '@SHOPPY AI',
            content: persistedString,
            is_ai_response: true
          });
        } catch (e) { /* no-op */ }
      } catch (err) {
        console.error('Error calling @SHOPPY endpoint:', err);
      } finally {
        setIsAiProcessing(false);
      }
      return;
    }

    if (isSplitty) {
      setIsAiProcessing(true);
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageText: textToSend,
            group: updatedGroup,
            currentUserId: currentUser.id
          })
        });

        const data = await response.json();
        
        const aiMsg: Message = {
          id: 'ai-' + Date.now(),
          groupId: group.id,
          senderId: 'user-splitty',
          senderName: '@SPLITTY AI',
          senderAvatar: AI_AVATAR,
          content: data.replyText,
          isAiResponse: true,
          createdAt: new Date().toISOString()
        };

        updatedGroup = {
          ...updatedGroup,
          messages: [...updatedGroup.messages, aiMsg]
        };
        setGroup(updatedGroup);

        try {
          await supabase.from('messages').insert({
            group_id: group.id,
            sender_id: currentUser.id,
            sender_name: '@SPLITTY AI',
            content: data.replyText,
            is_ai_response: true
          });
        } catch (e) { /* no-op */ }

        if (data.draftExpense) {
          setPendingDraftExpense(data.draftExpense);
          setShowConfirmationModal(true);
        }
      } catch (err) {
        console.error('Error invoking @SPLITTY neural layer:', err);
      } finally {
        setIsAiProcessing(false);
      }
    }
  };

  const handleVoteProduct = (messageId: string, productId: string) => {
    if (!group || !currentUser) return;
    const updatedMessages = group.messages.map(msg => {
      if (msg.id === messageId && msg.structuredProducts) {
        const newProducts = msg.structuredProducts.map(p => {
          if (p.id === productId) {
            const hasVoted = p.votes && p.votes.includes(currentUser.name);
            const newVotes = hasVoted ? p.votes.filter(v => v !== currentUser.name) : [...(p.votes || []), currentUser.name];
            return { ...p, votes: newVotes };
          }
          return p;
        });
        return { ...msg, structuredProducts: newProducts };
      }
      return msg;
    });
    setGroup({ ...group, messages: updatedMessages });
  };

  const handleConfirmDraftExpense = async (confirmedExpense: Expense) => {
    setShowConfirmationModal(false);
    setPendingDraftExpense(null);
    if (!currentUser || !group) return;

    const finalExpenses = [...group.expenses, confirmedExpense];
    const commitCardMsg: Message = {
      id: 'ai-card-' + Date.now(),
      groupId: group.id,
      senderId: 'user-splitty',
      senderName: '@SPLITTY AI',
      senderAvatar: AI_AVATAR,
      content: `✅ **Verified & Committed:** **"${confirmedExpense.title}"** ($${confirmedExpense.amount.toFixed(2)} ${confirmedExpense.currency || 'USD'}) paid by **${confirmedExpense.paidByName}** directly right into our shared group ledger!`,
      isAiResponse: true,
      structuredExpense: confirmedExpense,
      createdAt: new Date().toISOString()
    };

    const updated = {
      ...group,
      messages: [...group.messages, commitCardMsg],
      expenses: finalExpenses
    };
    setGroup(updated);

    try {
      const { data: expRow, error: expErr } = await supabase.from('expenses').insert({
        group_id: group.id,
        paid_by_user_id: confirmedExpense.paidByUserId || currentUser.id,
        paid_by_name: confirmedExpense.paidByName || currentUser.name,
        title: confirmedExpense.title,
        amount: confirmedExpense.amount,
        currency: confirmedExpense.currency || 'USD',
        receipt_image_url: confirmedExpense.receiptImageUrl || null
      }).select().single();

      if (expErr) console.error("Expense persistence warning:", expErr.message);

      if (expRow && confirmedExpense.splits) {
        for (const s of confirmedExpense.splits) {
          await supabase.from('expense_splits').insert({
            expense_id: expRow.id,
            user_id: s.userId,
            user_name: s.userName,
            amount_owed: s.amountOwed,
            share_percentage: s.percentage || null
          });
        }
      }

      await supabase.from('messages').insert({
        group_id: group.id,
        sender_id: currentUser.id,
        sender_name: '@SPLITTY AI',
        content: commitCardMsg.content,
        image_url: confirmedExpense.receiptImageUrl || null,
        is_ai_response: true,
        structured_expense_id: expRow?.id || null
      });
    } catch (err) {
      console.error("Commit persistence warning:", err);
    }
  };

  const handleRecordSettlement = async (fromUser: User, toUser: User, amount: number, method: string) => {
    if (!group || !currentUser) return;

    const newSettlement: Settlement = {
      id: 'set-' + Date.now(),
      groupId: group.id,
      fromUserId: fromUser.id,
      fromUserName: fromUser.name,
      toUserId: toUser.id,
      toUserName: toUser.name,
      amount,
      paymentMethod: method,
      settledAt: new Date().toISOString()
    };

    const confirmationMsg: Message = {
      id: 'msg-set-' + Date.now(),
      groupId: group.id,
      senderId: 'user-splitty',
      senderName: '@SPLITTY AI',
      senderAvatar: AI_AVATAR,
      content: `🎉 **Debt Cleared:** ${fromUser.name} transferred **$${amount.toFixed(2)}** directly right to ${toUser.name}. Min-cash-flow summary board zeroed out!`,
      isAiResponse: true,
      createdAt: new Date().toISOString()
    };

    const updated = {
      ...group,
      settlements: [...group.settlements, newSettlement],
      messages: [...group.messages, confirmationMsg]
    };

    setGroup(updated);

    try {
      await supabase.from('settlements').insert({
        group_id: group.id,
        from_user_id: fromUser.id,
        from_user_name: fromUser.name,
        to_user_id: toUser.id,
        to_user_name: toUser.name,
        amount,
        payment_method: method
      });

      await supabase.from('messages').insert({
        group_id: group.id,
        sender_id: currentUser.id,
        sender_name: '@SPLITTY AI',
        content: confirmationMsg.content,
        is_ai_response: true
      });
    } catch (err) {
      console.error("Settlement saving note:", err);
    }
  };

  const handleCopyInvite = () => {
    const origin = window.location.origin;
    navigator.clipboard.writeText(`${origin}/join/${group.inviteCode || group.id}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  return (
    <div className="w-full h-[calc(100vh-64px)] max-h-[calc(100vh-64px)] flex flex-col md:flex-row overflow-hidden bg-[#F4F1EA] relative text-[#22252A]">
      {/* LEFT CHAT AREA */}
      <div className="flex-1 flex flex-col h-full max-h-full relative min-w-0 overflow-hidden shrink-0">
        
        {/* TOP RINGING BANNER IF CALL IS ACTIVE ACROSS THE GROUP */}
        {isCallActiveBanner && !isVideoCallOpen && (
          <div className="bg-gradient-to-r from-[#2B4C7E] via-[#3B5998] to-[#4A7C59] p-2.5 px-4 text-white font-extrabold text-xs flex items-center justify-between shadow-md animate-in slide-in-from-top duration-200 z-40">
            <span className="flex items-center gap-2 truncate">
              <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping shrink-0" />
              <span>🟢 Live Google CoBuy Studio Active inside this Workspace!</span>
            </span>
            <button
              onClick={() => setIsVideoCallOpen(true)}
              className="bg-white text-[#2B4C7E] hover:bg-slate-50 px-3 py-1.5 rounded-xl text-xs font-black transition shrink-0 flex items-center gap-1.5 shadow-md"
            >
              <PhoneCall className="w-3.5 h-3.5" /> Hop in Video Room
            </button>
          </div>
        )}

        {/* WARM CREAM STICKY HEADER (`bg-[#F9F7F1]`) */}
        <div className="bg-[#F9F7F1] border-b border-amber-900/10 px-3.5 sm:px-5 py-3 flex items-center justify-between shadow-xs z-30 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <Link href="/" className="text-slate-500 hover:text-[#22252A] transition p-1 rounded-lg shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="font-black text-[#22252A] text-sm sm:text-lg flex items-center gap-1.5 sm:gap-2 truncate">
                <span className="w-2 h-2 rounded-full bg-[#4A7C59] shrink-0 animate-pulse" />
                <span className="truncate">{group.title}</span>
              </h1>
              <span className="text-[11px] sm:text-xs text-slate-500 flex items-center gap-1.5 font-bold">
                <Users className="w-3.5 h-3.5 text-[#2B4C7E] shrink-0" /> {group.members.length} members connected across Google CoBuy
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* ICON-ONLY SHARE BUTTON */}
            <button
              onClick={handleCopyInvite}
              className="bg-white hover:bg-[#F4F1EA] text-[#2B4C7E] font-bold p-2.5 rounded-xl transition border border-amber-900/15 shadow-xs shrink-0"
              title="Copy room access invitation link"
            >
              {copiedLink ? <CheckCircle2 className="w-4 h-4 text-[#4A7C59] animate-in zoom-in-50" /> : <Share2 className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setShowSidebarMobile(true)}
              className="md:hidden bg-[#2B4C7E] hover:bg-[#203960] text-white font-extrabold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
              title="Open Settle Board & Ledger"
            >
              <PanelsTopLeft className="w-4 h-4 text-white" />
              <span>Settle Board</span>
            </button>
          </div>
        </div>

        {/* PROMINENT CENTRAL LIVE VIDEO STUDIO HERO CARD (KEY ELEMENT AMONG PARTICIPANTS) */}
        <div className="p-3.5 sm:px-6 pt-3.5 shrink-0 bg-[#F4F1EA]">
          <div className="bg-white border border-amber-900/15 rounded-[28px] p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-[#4285F4] via-[#EA4335] to-[#34A853]" />
            <div className="pl-2 sm:pl-3 flex flex-col gap-1 text-left w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-[#2B4C7E] tracking-wider flex items-center gap-1.5">
                  🎥 Live Collaborative Video Studio
                </span>
                <span className="text-[11px] font-bold bg-[#4A7C59]/15 text-[#4A7C59] px-2 py-0.5 rounded-lg border border-[#4A7C59]/25">
                  Option A Voice Engine
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium max-w-xl leading-relaxed">
                Stream store displays, physical items, or digital checkouts out loud with your group. Tap our circular **`✨`** command icon during the call to ask Gemini direct conversational questions out loud, and receive matching `@SHOPPY` buying decks upon ending the meeting!
              </p>
            </div>

            <button
              type="button"
              onClick={handleStartOrJoinVideoCall}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-[#2B4C7E] hover:bg-[#203960] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-md transition shrink-0 active:scale-95 group"
            >
              <Video className="w-4 h-4 text-amber-400 group-hover:scale-110 transition" />
              <span>Enter Live Video Studio &rarr;</span>
            </button>
          </div>
        </div>

        {/* CHAT TIMELINE REGION (`bg-[#F4F1EA]`) */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3.5 sm:px-6 py-3 space-y-5 bg-[#F4F1EA]">
          {group.messages.map(msg => {
            const isMe = msg.senderId === currentUser?.id && !msg.isAiResponse;
            const isBot = msg.isAiResponse;
            const isPdf = msg.imageUrl && (msg.imageUrl.includes('application/pdf') || msg.imageUrl.toLowerCase().endsWith('.pdf'));

            return (
              <div key={msg.id} className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                <img
                  src={msg.senderAvatar}
                  alt={msg.senderName}
                  className={`w-9 h-9 rounded-full shrink-0 border object-cover ${
                    isBot ? 'border-brand-500 bg-brand-500/15 p-0.5' : 'border-slate-700'
                  }`}
                />
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[88%] sm:max-w-[78%]`}>
                  <span className="text-xs text-slate-400 font-bold mb-1 flex items-center gap-1.5">
                    {msg.senderName}
                    {isBot && (
                      <span className="bg-brand-500/20 text-brand-400 text-[10px] px-2 py-0.5 rounded-md font-black uppercase tracking-wider">
                        AI Co-Pilot
                      </span>
                    )}
                  </span>

                  <div
                    className={`p-4 sm:p-5 rounded-3xl text-sm leading-relaxed shadow-sm ${
                      isMe
                        ? 'bg-[#2B4C7E] text-white rounded-tr-none'
                        : isBot
                        ? 'bg-white border border-amber-900/15 text-[#22252A] rounded-tl-none shadow-xs'
                        : 'bg-[#F9F7F1] border border-amber-900/10 text-[#22252A] rounded-tl-none'
                    }`}
                  >
                    {msg.imageUrl && (
                      <div className="mb-3">
                        {isPdf ? (
                          <div
                            onClick={() => setFullscreenViewer({ type: 'pdf', url: msg.imageUrl!, title: 'Attached PDF Invoice / Document' })}
                            className="p-4 rounded-2xl bg-slate-50 border border-amber-900/15 hover:border-[#2B4C7E] transition cursor-pointer flex items-center justify-between gap-3 shadow-xs group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="p-2.5 rounded-xl bg-[#C45A45]/15 border border-[#C45A45]/30 shrink-0">
                                <FileText className="w-7 h-7 text-[#C45A45]" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-extrabold text-[#22252A] text-sm truncate group-hover:text-[#2B4C7E] transition">
                                  Attached PDF Invoice Document
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  📑 Click to view full document across screen right now
                                </p>
                              </div>
                            </div>
                            <span className="text-xs text-[#2B4C7E] font-bold flex items-center gap-1 shrink-0 px-3 py-1.5 rounded-xl bg-white border border-amber-900/15 shadow-xs">
                              <Maximize2 className="w-3.5 h-3.5" /> Open PDF
                            </span>
                          </div>
                        ) : (
                          <div
                            onClick={() => setFullscreenViewer({ type: 'image', url: msg.imageUrl!, title: 'Attached Receipt Photo' })}
                            className="relative rounded-2xl overflow-hidden border border-amber-900/15 bg-slate-50 cursor-pointer max-h-80 flex items-center justify-center group shadow-xs"
                          >
                            <img src={msg.imageUrl} alt="Receipt Scan" className="max-h-80 w-auto object-contain rounded-lg transition group-hover:scale-[1.02]" />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white font-extrabold text-xs gap-1.5">
                              <Maximize2 className="w-4 h-4 text-amber-300" /> Click to Open Full-Screen Photo
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="whitespace-pre-wrap font-sans leading-relaxed text-[#22252A]">
                      {msg.content.replace(/\*\*/g, '').replace(/```[a-z]*\n[\s\S]*?\n```/g, '').replace(/<!--SHOPPY_DATA:[\s\S]*?-->/g, '')}
                    </div>

                    {msg.structuredExpense && <ExpenseCard expense={msg.structuredExpense} />}

                    {msg.structuredProducts && msg.structuredProducts.length > 0 && (
                      <ShoppyGrid
                        products={msg.structuredProducts}
                        currentUserName={currentUser?.name || 'Member'}
                        onVote={(productId) => handleVoteProduct(msg.id, productId)}
                        onDiscuss={(item) => setMessageInput(`@SHOPPY tell us more details right about "${item.title}" (${item.price}). `)}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {isAiProcessing && (
            <div className="flex items-center gap-3 text-brand-400 text-xs font-bold italic animate-pulse py-3 px-4 bg-brand-500/15 rounded-2xl border border-brand-500/30 max-w-md shadow-md">
              <Loader2 className="w-4 h-4 animate-spin text-brand-400 shrink-0" />
              <span>Twin AI Neural Co-Pilot is processing discovery choices & document pixels right now...</span>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* FLOATING @ MENTION AUTOCOMPLETE SELECTOR */}
        {showMentions && (
          <div className="absolute bottom-16 left-3 sm:left-24 w-72 max-h-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-y-auto z-40 p-1.5 divide-y divide-slate-800 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="p-2 text-[10px] font-extrabold uppercase text-slate-400 tracking-widest flex items-center gap-1">
              <AtSign className="w-3 h-3 text-brand-400" /> Select Co-Pilot or Participant (Tab/Enter)
            </div>
            {mentionSuggestions.map((s, idx) => (
              <button
                type="button"
                key={s.id}
                onClick={() => handleSelectMention(s.name)}
                className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left transition ${
                  idx === selectedIndex
                    ? 'bg-brand-500/25 border border-brand-500/40 text-white'
                    : 'hover:bg-slate-800 text-slate-200'
                }`}
              >
                <img src={s.avatar} alt={s.name} className={`w-8 h-8 rounded-full shrink-0 object-cover ${s.isAi ? 'p-0.5 border border-brand-400 bg-brand-500/10' : ''}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black truncate flex items-center gap-1">
                    @{s.name}
                    {s.isAi && <Sparkles className="w-3 h-3 text-brand-400 shrink-0" />}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">{s.subtitle}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* PINNED BOTTOM INPUT TOOLBAR IN WARM CREAM (`bg-[#F9F7F1]`) */}
        <div className="bg-[#F9F7F1] border-t border-amber-900/10 p-2.5 sm:p-3.5 shrink-0 z-30">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2 max-w-5xl mx-auto">
            
            {/* QUICK VIDEO & SCAN CHIP */}
            <button
              type="button"
              onClick={handleStartOrJoinVideoCall}
              className="px-3.5 py-3 rounded-2xl bg-[#2B4C7E] hover:bg-[#203960] text-white font-extrabold text-xs transition shadow-xs flex items-center gap-1.5 shrink-0 active:scale-95"
              title="Hop on Live Video & AI Studio right now"
            >
              <Video className="w-4 h-4 text-amber-300" />
              <span className="hidden sm:inline">Hop on Video</span>
            </button>

            <label
              title="Snap instant smartphone camera photo"
              className="p-3 rounded-2xl bg-white hover:bg-[#F4F1EA] text-[#C45A45] transition border border-amber-900/15 cursor-pointer flex items-center justify-center shrink-0 shadow-xs active:scale-95"
            >
              <Camera className="w-5 h-5" />
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleInstantFileUpload}
                disabled={isAiProcessing}
                className="hidden"
              />
            </label>

            <label
              title="Upload existing picture or PDF document"
              className="p-3 rounded-2xl bg-white hover:bg-[#F4F1EA] text-[#22252A] transition border border-amber-900/15 cursor-pointer flex items-center justify-center shrink-0 shadow-xs active:scale-95"
            >
              <Paperclip className="w-5 h-5 text-slate-600" />
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleInstantFileUpload}
                disabled={isAiProcessing}
                className="hidden"
              />
            </label>

            <div className="flex-1 relative min-w-0">
              <input
                ref={inputRef}
                type="text"
                value={messageInput}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder='Type "@SHOPPY compare..." or "@SPLITTY split..." or hop right inside video...'
                className="w-full bg-white border border-amber-900/15 rounded-2xl px-4 py-3 text-sm text-[#22252A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2B4C7E] transition font-sans shadow-xs"
              />
            </div>

            <button
              type="submit"
              disabled={isAiProcessing || !messageInput.trim()}
              className="bg-[#2B4C7E] hover:bg-[#203960] disabled:opacity-40 disabled:pointer-events-none text-white p-3 sm:px-5 sm:py-3 rounded-2xl transition shadow-md shrink-0 font-extrabold flex items-center gap-2 active:scale-95"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>

      {/* RIGHT PANEL: FINANCIAL BOARD (WARM CREAM & WHITE CONTAINER) */}
      <div
        className={`${
          showSidebarMobile ? 'flex flex-col fixed inset-0 z-50 bg-[#F4F1EA] overflow-hidden' : 'hidden'
        } md:flex md:flex-col md:relative md:w-[400px] md:h-full md:max-h-full shrink-0 border-l border-amber-900/10 min-h-0 overflow-hidden bg-[#F4F1EA] text-[#22252A]`}
      >
        {showSidebarMobile && (
          <div className="md:hidden p-4 bg-[#F9F7F1] border-b border-amber-900/10 shrink-0 z-50 flex items-center justify-between shadow-xs">
            <h3 className="text-sm sm:text-base font-black text-[#22252A] flex items-center gap-2 truncate">
              💰 Min-Cash-Flow Settle Board
            </h3>
            <button
              onClick={() => setShowSidebarMobile(false)}
              className="bg-[#2B4C7E] hover:bg-[#203960] text-white font-black px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
            >
              ← Back right to Chat (✕)
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <SettlementTable
            group={group}
            currentUser={currentUser}
            onRecordSettlement={handleRecordSettlement}
          />
        </div>
      </div>

      {/* HUMAN-IN-THE-LOOP VERIFICATION MODAL (@SPLITTY) */}
      <ExpenseConfirmationModal
        isOpen={showConfirmationModal}
        onClose={() => { setShowConfirmationModal(false); setPendingDraftExpense(null); }}
        onConfirm={handleConfirmDraftExpense}
        draftExpense={pendingDraftExpense}
        allMembers={group.members}
        baseCurrency={group.baseCurrency || 'USD'}
      />

      <VideoCallModal
        isOpen={isVideoCallOpen}
        onClose={(sessionNotes, lastImageBase64) => handleCloseVideoCallWithNotes(sessionNotes, lastImageBase64)}
        groupId={group.id}
        groupTitle={group.title}
        currentUser={currentUser}
        roomMembers={group.members}
      />

      {/* FULL-SCREEN IMMERSIVE PHOTO & PDF DOCUMENT LIGHTBOX VIEWER */}
      {fullscreenViewer && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-6xl flex items-center justify-between p-4 pb-2 text-white border-b border-slate-800 shrink-0 mb-3">
            <span className="font-black text-base sm:text-lg flex items-center gap-2 truncate">
              {fullscreenViewer.type === 'pdf' ? <FileText className="w-5 h-5 text-rose-400 shrink-0" /> : <Maximize2 className="w-5 h-5 text-brand-400 shrink-0" />}
              {fullscreenViewer.title || 'Document Viewer'}
            </span>
            <div className="flex items-center gap-3">
              <a
                href={fullscreenViewer.url}
                target="_blank"
                rel="noopener noreferrer"
                download={fullscreenViewer.type === 'pdf' ? 'document.pdf' : 'capture.jpg'}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 border border-slate-700 transition shadow-lg"
              >
                <Download className="w-3.5 h-3.5 text-brand-400" />
                <span>Open / Download in New Tab</span>
              </a>

              <button
                onClick={() => setFullscreenViewer(null)}
                className="bg-rose-600 hover:bg-rose-500 text-white p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-black flex items-center gap-1 transition shadow-xl"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Close</span>
              </button>
            </div>
          </div>

          <div className="w-full max-w-6xl flex-1 flex items-center justify-center overflow-hidden relative pb-4">
            {fullscreenViewer.type === 'pdf' ? (
              <iframe
                src={fullscreenViewer.url}
                title="Full-Screen PDF Document Viewer"
                className="w-full h-full rounded-2xl border border-slate-700 bg-white shadow-2xl"
              />
            ) : (
              <img
                src={fullscreenViewer.url}
                alt="Full Screen HD View"
                className="max-h-full max-w-full object-contain rounded-2xl shadow-2xl"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
