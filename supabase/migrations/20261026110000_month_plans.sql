-- Monthly plan: how much income you expect and how much you want to save.
-- month is always the first day of the month (e.g. 2026-10-01).
CREATE TABLE IF NOT EXISTS month_plans (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month           date NOT NULL CHECK (extract(day FROM month) = 1),
  expected_income numeric(10, 2) NOT NULL DEFAULT 0,
  savings_goal    numeric(10, 2) NOT NULL DEFAULT 0,
  UNIQUE(user_id, month)
);

ALTER TABLE month_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can select own month plans" ON month_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own month plans" ON month_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own month plans" ON month_plans FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own month plans" ON month_plans FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Per-month category limits. They override the defaults in expense_budgets
-- for that month only; a category with no row here falls back to the default.
CREATE TABLE IF NOT EXISTS month_budgets (
  id       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month    date NOT NULL CHECK (extract(day FROM month) = 1),
  category text NOT NULL,
  amount   numeric(10, 2) NOT NULL,
  UNIQUE(user_id, month, category)
);

ALTER TABLE month_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can select own month budgets" ON month_budgets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own month budgets" ON month_budgets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own month budgets" ON month_budgets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own month budgets" ON month_budgets FOR DELETE TO authenticated USING (auth.uid() = user_id);
