import { supabase } from './supabaseClient';
import { Group, User, Message, Expense, ExpenseSplit, Settlement } from './types';

export const AI_AVATAR = 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=GeminiAI';

/**
 * Syncs verified Google profile cleanly into Supabase `profiles` table
 */
export async function syncGoogleProfileToDatabase(user: any): Promise<User | null> {
  if (!user || !user.id) return null;

  const profileData: User = {
    id: user.id,
    name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Member',
    email: user.email || 'guest@example.com',
    avatar: user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
    paymentHandleUpi: user.user_metadata?.payment_handle_upi || '',
    paymentHandleVenmo: user.user_metadata?.payment_handle_venmo || ''
  };

  try {
    // Non-blocking background sync right into Supabase profiles table
    supabase.from('profiles').upsert({
      id: profileData.id,
      email: profileData.email,
      full_name: profileData.name,
      avatar_url: profileData.avatar,
      payment_handle_upi: profileData.paymentHandleUpi,
      payment_handle_venmo: profileData.paymentHandleVenmo,
    }, { onConflict: 'email' }).then(({ error }) => {
      if (error) console.warn("Background profile sync note:", error.message);
    });
  } catch (err) {
    console.warn("Database sync note:", err);
  }

  return profileData;
}

/**
 * Fetches exclusively private chat rooms where the current user is recorded in `group_members`
 */
export async function fetchUserPrivateGroups(userId: string): Promise<Group[]> {
  try {
    // 1. Get room IDs where user is explicitly a member
    const { data: memberRows, error: memberErr } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId);

    if (memberErr || !memberRows || memberRows.length === 0) return [];

    const groupIds = memberRows.map(m => m.group_id);

    // 2. Fetch complete private group structures along with members and expenses
    const { data: groupRows, error: grpErr } = await supabase
      .from('groups')
      .select(`
        *,
        group_members (
          user_id,
          joined_at,
          profiles (*)
        ),
        expenses (
          *,
          expense_splits (*)
        ),
        settlements (*),
        messages (*)
      `)
      .in('id', groupIds)
      .order('created_at', { ascending: false });

    if (grpErr || !groupRows) return [];

    return groupRows.map(g => {
      const mappedMembers = (g.group_members || []).map((gm: any) => ({
        id: gm.user_id,
        name: gm.profiles?.full_name || 'Member',
        email: gm.profiles?.email || '',
        avatar: gm.profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${gm.user_id}`,
        paymentHandleUpi: gm.profiles?.payment_handle_upi || '',
        paymentHandleVenmo: gm.profiles?.payment_handle_venmo || ''
      }));

      return {
        id: g.id,
        inviteCode: g.invite_code,
        title: g.title,
        description: g.description || '',
        members: mappedMembers,
        expenses: (g.expenses || []).map((ex: any) => ({
          id: ex.id,
          groupId: ex.group_id,
          title: ex.title,
          amount: Number(ex.amount),
          paidByUserId: ex.paid_by_user_id,
          paidByName: ex.paid_by_name,
          createdAt: ex.created_at,
          receiptImageUrl: ex.receipt_image_url || undefined,
          splits: (ex.expense_splits || []).map((sp: any) => ({
            userId: sp.user_id,
            userName: sp.user_name,
            amountOwed: Number(sp.amount_owed)
          }))
        })),
        settlements: (g.settlements || []).map((st: any) => ({
          id: st.id,
          groupId: st.group_id,
          fromUserId: st.from_user_id,
          fromUserName: st.from_user_name,
          toUserId: st.to_user_id,
          toUserName: st.to_user_name,
          amount: Number(st.amount),
          paymentMethod: st.payment_method || 'Mobile Pay',
          settledAt: st.settled_at
        })),
        messages: (g.messages || []).map((ms: any) => {
          const senderMem = mappedMembers.find((m: any) => m.id === ms.sender_id);
          let cleanContent = ms.content || '';
          let recoveredProducts: any[] | undefined = undefined;
          if (cleanContent.includes('<!--SHOPPY_DATA:')) {
            const parts = cleanContent.split('<!--SHOPPY_DATA:');
            cleanContent = parts[0].trim();
            try {
              const jsonStr = parts[1].split('-->')[0];
              recoveredProducts = JSON.parse(jsonStr);
            } catch (e) { /* no-op */ }
          }
          return {
            id: ms.id,
            groupId: ms.group_id,
            senderId: ms.sender_id,
            senderName: ms.sender_name,
            senderAvatar: ms.is_ai_response ? AI_AVATAR : (senderMem?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${ms.sender_name}`),
            content: cleanContent,
            imageUrl: ms.image_url || undefined,
            isAiResponse: ms.is_ai_response,
            structuredProducts: recoveredProducts,
            createdAt: ms.created_at
          };
        }).sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      };
    });
  } catch (err) {
    console.error('Error loading user private rooms:', err);
    return [];
  }
}

/**
 * Loads a single specific room by ID or invite_code straight from Supabase
 */
export async function fetchGroupByCodeOrId(identifier: string): Promise<Group | null> {
  try {
    let query = supabase
      .from('groups')
      .select(`
        *,
        group_members (
          user_id,
          profiles (*)
        ),
        expenses (
          *,
          expense_splits (*)
        ),
        settlements (*),
        messages (*)
      `);

    if (identifier.length === 36 && identifier.includes('-')) {
      query = query.or(`id.eq.${identifier},invite_code.eq.${identifier}`);
    } else {
      query = query.eq('invite_code', identifier);
    }

    const { data: groupRows, error } = await query.limit(1);

    if (error || !groupRows || groupRows.length === 0) return null;
    const g = groupRows[0];

    const mappedMembers = (g.group_members || []).map((gm: any) => ({
      id: gm.user_id,
      name: gm.profiles?.full_name || 'Member',
      email: gm.profiles?.email || '',
      avatar: gm.profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${gm.user_id}`,
      paymentHandleUpi: gm.profiles?.payment_handle_upi || '',
      paymentHandleVenmo: gm.profiles?.payment_handle_venmo || ''
    }));

    return {
      id: g.id,
      inviteCode: g.invite_code,
      title: g.title,
      description: g.description || '',
      members: mappedMembers,
      expenses: (g.expenses || []).map((ex: any) => ({
        id: ex.id,
        groupId: ex.group_id,
        title: ex.title,
        amount: Number(ex.amount),
        paidByUserId: ex.paid_by_user_id,
        paidByName: ex.paid_by_name,
        createdAt: ex.created_at,
        receiptImageUrl: ex.receipt_image_url || undefined,
        splits: (ex.expense_splits || []).map((sp: any) => ({
          userId: sp.user_id,
          userName: sp.user_name,
          amountOwed: Number(sp.amount_owed)
        }))
      })),
      settlements: (g.settlements || []).map((st: any) => ({
        id: st.id,
        groupId: st.group_id,
        fromUserId: st.from_user_id,
        fromUserName: st.from_user_name,
        toUserId: st.to_user_id,
        toUserName: st.to_user_name,
        amount: Number(st.amount),
        paymentMethod: st.payment_method || 'Mobile Pay',
        settledAt: st.settled_at
      })),
      messages: (g.messages || []).map((ms: any) => {
        const senderMem = mappedMembers.find((m: any) => m.id === ms.sender_id);
        let cleanContent = ms.content || '';
        let recoveredProducts: any[] | undefined = undefined;
        if (cleanContent.includes('<!--SHOPPY_DATA:')) {
          const parts = cleanContent.split('<!--SHOPPY_DATA:');
          cleanContent = parts[0].trim();
          try {
            const jsonStr = parts[1].split('-->')[0];
            recoveredProducts = JSON.parse(jsonStr);
          } catch (e) { /* no-op */ }
        }
        return {
          id: ms.id,
          groupId: ms.group_id,
          senderId: ms.sender_id,
          senderName: ms.sender_name,
          senderAvatar: ms.is_ai_response ? AI_AVATAR : (senderMem?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${ms.sender_name}`),
          content: cleanContent,
          imageUrl: ms.image_url || undefined,
          isAiResponse: ms.is_ai_response,
          structuredProducts: recoveredProducts,
          createdAt: ms.created_at
        };
      }).sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    };
  } catch (err) {
    console.error('Error fetching group by ID/Code:', err);
    return null;
  }
}

/**
 * Creates a new completely private room and enrolls the creator immediately
 */
export async function createPrivateGroup(title: string, description: string, creator: User): Promise<Group | null> {
  try {
    const inviteCode = title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .substring(0, 16) + '-' + Math.floor(1000 + Math.random() * 9000);

    const { data: newGrp, error: grpErr } = await supabase.from('groups').insert({
      invite_code: inviteCode,
      title,
      description,
      created_by: creator.id
    }).select().single();

    if (grpErr || !newGrp) {
      console.error('Failed to create group row in DB:', grpErr?.message);
      return null;
    }

    // Enroll creator immediately in group_members table
    await supabase.from('group_members').insert({
      group_id: newGrp.id,
      user_id: creator.id
    });

    // Send introductory Gemini AI welcoming greeting
    const introText = `👋 Welcome to our private group **${title}**! Share ideas, upload receipt photos directly from your camera, or type \`@Gemini log $50 for dinner paid by ${creator.name}\`. I will keep the real-time settlement ledger accurate and zeroed out!`;
    
    await supabase.from('messages').insert({
      group_id: newGrp.id,
      sender_id: creator.id,
      sender_name: 'Gemini AI',
      content: introText,
      is_ai_response: true
    });

    return {
      id: newGrp.id,
      inviteCode: newGrp.invite_code,
      title: newGrp.title,
      description: newGrp.description || '',
      members: [creator],
      expenses: [],
      settlements: [],
      messages: [{
        id: 'init-' + Date.now(),
        groupId: newGrp.id,
        senderId: 'user-gemini',
        senderName: 'Gemini AI',
        senderAvatar: AI_AVATAR,
        content: introText,
        isAiResponse: true,
        createdAt: new Date().toISOString()
      }]
    };
  } catch (e) {
    console.error('Group creation failure:', e);
    return null;
  }
}

/**
 * Uploads a smartphone camera capture directly to Supabase storage bucket 'receipts'
 */
export async function uploadReceiptToCloud(file: File, rawBase64Fallback?: string): Promise<string> {
  try {
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `camera-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

    const { error } = await supabase.storage
      .from('receipts')
      .upload(fileName, file, { cacheControl: '3600', upsert: true });

    if (error) {
      console.warn('Storage bucket note:', error.message);
      return rawBase64Fallback || '';
    }

    const { data: { publicUrl } } = supabase.storage
      .from('receipts')
      .getPublicUrl(fileName);

    return publicUrl || rawBase64Fallback || '';
  } catch (e) {
    return rawBase64Fallback || '';
  }
}

/**
 * Updates a user's payout handles inside profiles table
 */
export async function updatePaymentHandles(userId: string, upi: string, venmo: string) {
  try {
    await supabase.from('profiles').update({
      payment_handle_upi: upi,
      payment_handle_venmo: venmo
    }).eq('id', userId);
  } catch (e) {
    console.error("Unable to update payment handles:", e);
  }
}
