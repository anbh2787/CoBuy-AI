import { Group, User, Expense } from './types';

// Initial default mock users representing simulated Google Logged-In accounts
export const DEFAULT_USERS: User[] = [
  {
    id: 'user-anuj',
    name: 'Anuj Bhagat',
    email: 'anujbhagat@google.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Anuj',
    paymentHandleUpi: 'anuj@okaxis',
    paymentHandleVenmo: '@anuj-bhagat'
  },
  {
    id: 'user-alice',
    name: 'Alice Cooper',
    email: 'alice@example.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
    paymentHandleUpi: 'alice@okhdfcbank',
    paymentHandleVenmo: '@alice-cooper'
  },
  {
    id: 'user-bob',
    name: 'Bob Sharma',
    email: 'bob@example.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
    paymentHandleUpi: 'bob@okicici',
    paymentHandleVenmo: '@bob-sharma'
  },
  {
    id: 'user-gemini',
    name: 'Gemini AI',
    email: 'gemini@google.ai',
    avatar: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=GeminiAI'
  }
];

export const INITIAL_GROUPS: Group[] = [
  {
    id: 'grp_tahoewg',
    inviteCode: 'tahoe-2026-vip',
    title: 'Lake Tahoe Weekend Cabin 🏔️',
    description: 'Ski rental, groceries, and dining cabin getaway expense tracker.',
    members: [DEFAULT_USERS[0], DEFAULT_USERS[1], DEFAULT_USERS[2]],
    expenses: [
      {
        id: 'exp-1',
        groupId: 'grp_tahoewg',
        title: 'Cabin Booking & Cleaning Fee',
        amount: 360,
        paidByUserId: 'user-alice',
        paidByName: 'Alice Cooper',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
        notes: 'Prepaid via card for 3 nights',
        splits: [
          { userId: 'user-anuj', userName: 'Anuj Bhagat', amountOwed: 120, percentage: 33.33 },
          { userId: 'user-alice', userName: 'Alice Cooper', amountOwed: 120, percentage: 33.33 },
          { userId: 'user-bob', userName: 'Bob Sharma', amountOwed: 120, percentage: 33.33 },
        ]
      },
      {
        id: 'exp-2',
        groupId: 'grp_tahoewg',
        title: 'Dinner at Alpine Pizza & Brews',
        amount: 90,
        paidByUserId: 'user-anuj',
        paidByName: 'Anuj Bhagat',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
        splits: [
          { userId: 'user-anuj', userName: 'Anuj Bhagat', amountOwed: 30 },
          { userId: 'user-alice', userName: 'Alice Cooper', amountOwed: 30 },
          { userId: 'user-bob', userName: 'Bob Sharma', amountOwed: 30 },
        ]
      }
    ],
    settlements: [],
    messages: [
      {
        id: 'msg-1',
        groupId: 'grp_tahoewg',
        senderId: 'user-alice',
        senderName: 'Alice Cooper',
        senderAvatar: DEFAULT_USERS[1].avatar,
        content: 'Hey guys! Just paid the $360 cabin rental for the 3 of us. I let Gemini log it.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
      },
      {
        id: 'msg-2',
        groupId: 'grp_tahoewg',
        senderId: 'user-gemini',
        senderName: 'Gemini AI',
        senderAvatar: DEFAULT_USERS[3].avatar,
        content: '✅ Logged **Cabin Booking & Cleaning Fee** for **$360.00**, split equally between Alice Cooper, Anuj Bhagat, and Bob Sharma ($120.00 each).',
        isAiResponse: true,
        structuredExpense: {
          id: 'exp-1',
          groupId: 'grp_tahoewg',
          title: 'Cabin Booking & Cleaning Fee',
          amount: 360,
          paidByUserId: 'user-alice',
          paidByName: 'Alice Cooper',
          createdAt: new Date().toISOString(),
          splits: [
            { userId: 'user-anuj', userName: 'Anuj Bhagat', amountOwed: 120 },
            { userId: 'user-alice', userName: 'Alice Cooper', amountOwed: 120 },
            { userId: 'user-bob', userName: 'Bob Sharma', amountOwed: 120 },
          ]
        },
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18 + 5000).toISOString(),
      },
      {
        id: 'msg-3',
        groupId: 'grp_tahoewg',
        senderId: 'user-anuj',
        senderName: 'Anuj Bhagat',
        senderAvatar: DEFAULT_USERS[0].avatar,
        content: '@Gemini log $90 paid by Anuj for dinner at Alpine Pizza split equally among everyone.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      },
      {
        id: 'msg-4',
        groupId: 'grp_tahoewg',
        senderId: 'user-gemini',
        senderName: 'Gemini AI',
        senderAvatar: DEFAULT_USERS[3].avatar,
        content: '✅ Logged **Dinner at Alpine Pizza & Brews** ($90.00) paid by Anuj Bhagat and split equally across all 3 members ($30.00 per person).',
        isAiResponse: true,
        structuredExpense: {
          id: 'exp-2',
          groupId: 'grp_tahoewg',
          title: 'Dinner at Alpine Pizza & Brews',
          amount: 90,
          paidByUserId: 'user-anuj',
          paidByName: 'Anuj Bhagat',
          createdAt: new Date().toISOString(),
          splits: [
            { userId: 'user-anuj', userName: 'Anuj Bhagat', amountOwed: 30 },
            { userId: 'user-alice', userName: 'Alice Cooper', amountOwed: 30 },
            { userId: 'user-bob', userName: 'Bob Sharma', amountOwed: 30 },
          ]
        },
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5 + 3000).toISOString(),
      }
    ]
  },
  {
    id: 'grp_goa2026',
    inviteCode: 'goa-fun-chat',
    title: 'Goa Beach Resort & Drinks 🌴',
    description: 'All resort, scooter rental, and shack food expenses.',
    members: [DEFAULT_USERS[0], DEFAULT_USERS[2]],
    expenses: [],
    settlements: [],
    messages: [
      {
        id: 'msg-goa-1',
        groupId: 'grp_goa2026',
        senderId: 'user-gemini',
        senderName: 'Gemini AI',
        senderAvatar: DEFAULT_USERS[3].avatar,
        content: '👋 Welcome to the Goa Beach Resort group! Mention **@Gemini** with any expense or simply upload a **receipt photo**, and I will parse the itemized lines and update your settlement balance tables immediately!',
        isAiResponse: true,
        createdAt: new Date().toISOString(),
      }
    ]
  }
];

class StorageManager {
  private STORAGE_KEY = 'split_chat_groups_v1';
  private USER_KEY = 'split_chat_active_user_v1';

  getGroups(): Group[] {
    if (typeof window === 'undefined') return INITIAL_GROUPS;
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (!data) {
      this.saveGroups(INITIAL_GROUPS);
      return INITIAL_GROUPS;
    }
    try {
      return JSON.parse(data);
    } catch (e) {
      return INITIAL_GROUPS;
    }
  }

  saveGroups(groups: Group[]) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(groups));
    }
  }

  getGroupById(groupId: string): Group | undefined {
    const groups = this.getGroups();
    return groups.find(g => g.id === groupId || g.inviteCode === groupId);
  }

  updateGroup(updatedGroup: Group) {
    const groups = this.getGroups();
    const idx = groups.findIndex(g => g.id === updatedGroup.id);
    if (idx !== -1) {
      groups[idx] = updatedGroup;
      this.saveGroups(groups);
    }
  }

  getActiveUser(): User {
    if (typeof window === 'undefined') return DEFAULT_USERS[0];
    const userJson = localStorage.getItem(this.USER_KEY);
    if (!userJson) return DEFAULT_USERS[0];
    try {
      return JSON.parse(userJson);
    } catch {
      return DEFAULT_USERS[0];
    }
  }

  setActiveUser(user: User) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    }
  }
}

export const store = new StorageManager();
