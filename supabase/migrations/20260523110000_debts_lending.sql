-- Debts: money you owe to others
CREATE TABLE IF NOT EXISTS debts (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount       numeric(10, 2) NOT NULL,
  date         date NOT NULL DEFAULT CURRENT_DATE,
  deadline     date,
  person       text NOT NULL,
  amount_paid  numeric(10, 2) NOT NULL DEFAULT 0,
  paid_history jsonb NOT NULL DEFAULT '[]',
  created_at   timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own debts"  ON debts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own debts"  ON debts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own debts"  ON debts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own debts"  ON debts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Lendings: money others owe you
CREATE TABLE IF NOT EXISTS lendings (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount       numeric(10, 2) NOT NULL,
  date         date NOT NULL DEFAULT CURRENT_DATE,
  deadline     date,
  person       text NOT NULL,
  amount_paid  numeric(10, 2) NOT NULL DEFAULT 0,
  paid_history jsonb NOT NULL DEFAULT '[]',
  created_at   timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE lendings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own lendings" ON lendings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own lendings" ON lendings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own lendings" ON lendings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own lendings" ON lendings FOR DELETE TO authenticated USING (auth.uid() = user_id);
