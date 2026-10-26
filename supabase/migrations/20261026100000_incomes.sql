-- Incomes: money you earned (salary, freelance, gifts...).
-- Loans are NOT incomes — borrowed money stays in debts, repayments received stay in lendings.
CREATE TABLE IF NOT EXISTS incomes (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount      numeric(10, 2) NOT NULL,
  description text,
  source      text NOT NULL DEFAULT 'Salary',
  date        date NOT NULL DEFAULT CURRENT_DATE,
  created_at  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE incomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own incomes" ON incomes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own incomes" ON incomes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own incomes" ON incomes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own incomes" ON incomes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_incomes_user_date ON incomes(user_id, date);
