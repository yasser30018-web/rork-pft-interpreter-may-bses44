-- Relax RLS on auth_events so legitimate client audit inserts never fail.
--
-- auth_events is an append-only audit log. The previous policy required
-- user_id = auth.uid(), which rejected valid events fired during transitional
-- states (signup before session, session_terminated after sign-out, kicked
-- sessions, cross-account login attempts, etc.).
--
-- New rules:
--   * anon role can insert rows with user_id IS NULL only.
--   * authenticated role can insert any row (user_id matching auth.uid(),
--     null, or another uid — client code coerces unknown uids to NULL).
-- Reads remain restricted (admins use service role via edge functions).

ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own events" ON public.auth_events;
DROP POLICY IF EXISTS "auth_events_insert_self" ON public.auth_events;
DROP POLICY IF EXISTS "auth_events_insert_anon" ON public.auth_events;
DROP POLICY IF EXISTS "auth_events_client_insert" ON public.auth_events;
DROP POLICY IF EXISTS "auth_events_client_insert_authenticated" ON public.auth_events;
DROP POLICY IF EXISTS "auth_events_client_insert_anon" ON public.auth_events;

CREATE POLICY "auth_events_client_insert_authenticated_v2"
  ON public.auth_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "auth_events_client_insert_anon_v2"
  ON public.auth_events
  FOR INSERT
  TO anon
  WITH CHECK (
    user_id IS NULL
  );
