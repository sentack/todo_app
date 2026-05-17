-- RPC to resolve username → email by joining public.users with auth.users.
-- SECURITY DEFINER lets it access auth.users without the caller needing elevated privileges.
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT a.email INTO v_email
  FROM public.users u
  JOIN auth.users a ON a.id = u.id
  WHERE LOWER(u.username) = LOWER(p_username)
  LIMIT 1;
  RETURN v_email;
END;
$$;

-- Allow unauthenticated callers (login form runs before a session exists)
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon, authenticated;
