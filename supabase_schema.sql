-- ============================================================================
-- SUPABASE POSTGRESQL SCHEMA FOR SPLIT-CHAT AI
-- ============================================================================
-- Execute this SQL inside your Supabase project SQL Editor when ready to host live!

-- 1. Profiles (Linked to Google Auth/NextAuth Users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  payment_handle_upi TEXT,
  payment_handle_venmo TEXT,
  payment_handle_paypal TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Chat Groups / Rooms
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Group Members
CREATE TABLE IF NOT EXISTS group_members (
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

-- 4. Chat Messages (Text + Images + AI Action Metadata)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES profiles(id) NOT NULL,
  sender_name TEXT NOT NULL,
  content TEXT,
  image_url TEXT,
  is_ai_response BOOLEAN DEFAULT false,
  structured_expense_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  paid_by_user_id UUID REFERENCES profiles(id) NOT NULL,
  paid_by_name TEXT NOT NULL,
  title TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  receipt_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Expense Splits (How the expense is divided among members)
CREATE TABLE IF NOT EXISTS expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  user_name TEXT NOT NULL,
  amount_owed NUMERIC(10, 2) NOT NULL,
  share_percentage NUMERIC(5, 2)
);

-- 7. Settlements (Payments executed between members)
CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  from_user_id UUID REFERENCES profiles(id) NOT NULL,
  from_user_name TEXT NOT NULL,
  to_user_id UUID REFERENCES profiles(id) NOT NULL,
  to_user_name TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  payment_method TEXT, -- e.g., 'UPI', 'Venmo', 'Cash'
  settled_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime Sync on Messages, Expenses, and Settlements
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE expense_splits;
ALTER PUBLICATION supabase_realtime ADD TABLE settlements;
