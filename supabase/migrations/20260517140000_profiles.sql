-- Profiles table for username ↔ email mapping
CREATE TABLE IF NOT EXISTS profiles (
  id        uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username  text UNIQUE NOT NULL,
  email     text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Public read so unauthenticated users can look up email by username during login
CREATE POLICY "Public profiles are viewable" ON profiles
  FOR SELECT TO public USING (true);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user is inserted.
-- Falls back to the part before @ as username if none was provided.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
      SPLIT_PART(NEW.email, '@', 1)
    ),
    NEW.email
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
