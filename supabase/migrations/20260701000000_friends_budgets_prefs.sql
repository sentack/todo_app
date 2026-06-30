-- Friends table
CREATE TABLE IF NOT EXISTS friends (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, name)
);

ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can select own friends" ON friends FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own friends" ON friends FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own friends" ON friends FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own friends" ON friends FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Expense budgets table
CREATE TABLE IF NOT EXISTS expense_budgets (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category      text NOT NULL,
  monthly_limit numeric(10,2) NOT NULL,
  UNIQUE(user_id, category)
);

ALTER TABLE expense_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can select own budgets" ON expense_budgets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own budgets" ON expense_budgets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budgets" ON expense_budgets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own budgets" ON expense_budgets FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Add due_date to todos
ALTER TABLE todos ADD COLUMN IF NOT EXISTS due_date date;

-- Add currency preference to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'ETB';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_todos_user_id      ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_due_date     ON todos(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date);
CREATE INDEX IF NOT EXISTS idx_friends_user_id    ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_user_id      ON debts(user_id);
CREATE INDEX IF NOT EXISTS idx_lendings_user_id   ON lendings(user_id);
CREATE INDEX IF NOT EXISTS idx_to_buy_user_id     ON to_buy_items(user_id);
