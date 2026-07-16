export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  paymentHandleUpi?: string;
  paymentHandleVenmo?: string;
}

export interface ExpenseSplit {
  userId: string;
  userName: string;
  amountOwed: number;
  percentage?: number;
}

export interface Expense {
  id: string;
  groupId: string;
  title: string;
  amount: number;
  currency?: string;
  originalAmount?: number;
  originalCurrency?: string;
  exchangeRate?: number;
  paidByUserId: string;
  paidByName: string;
  createdAt: string;
  splits: ExpenseSplit[];
  notes?: string;
  receiptImageUrl?: string;
}

export interface Settlement {
  id: string;
  groupId: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
  paymentMethod: string;
  settledAt: string;
}

export interface ShoppyItem {
  id: string;
  title: string;
  price: string;
  numericPrice: number;
  imageUrl: string;
  rating: string;
  vendor: string;
  externalUrl: string;
  votes: string[];
}

export interface Message {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  imageUrl?: string;
  isAiResponse?: boolean;
  structuredExpense?: Expense;
  structuredProducts?: ShoppyItem[];
  createdAt: string;
}

export interface Group {
  id: string;
  inviteCode: string;
  title: string;
  description: string;
  baseCurrency?: string;
  members: User[];
  expenses: Expense[];
  settlements: Settlement[];
  messages: Message[];
}

export interface SimplifiedDebt {
  fromUser: User;
  toUser: User;
  amount: number;
}

export interface MemberBalance {
  user: User;
  netAmount: number;
}
