CREATE TABLE IF NOT EXISTS to_buy_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  quantity numeric(10, 2) NOT NULL DEFAULT 1,
  price numeric(10, 2) NOT NULL DEFAULT 0,
  urgency text NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  bought boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE to_buy_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own to_buy_items"
  ON to_buy_items FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own to_buy_items"
  ON to_buy_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own to_buy_items"
  ON to_buy_items FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own to_buy_items"
  ON to_buy_items FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
