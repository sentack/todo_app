-- Allow authenticated users to insert and update their own row in users table
CREATE POLICY "Users can insert own row" ON public.users
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own row" ON public.users
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
