-- Add email column to the existing users table for username-based login lookup
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email text;

-- Backfill email for any existing rows from auth.users
UPDATE public.users u
SET email = a.email
FROM auth.users a
WHERE u.id = a.id
  AND (u.email IS NULL OR u.email = '');

-- Allow unauthenticated reads so the login form can resolve username → email
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read users" ON public.users;
CREATE POLICY "Public can read users" ON public.users
  FOR SELECT TO public USING (true);
