-- Fix RLS policy for auth_events so the client can log audit events.
--
-- The previous policy was too restrictive and rejected all client-side inserts
-- (including legitimate ones like login_failed, login_attempt, signup, etc.).
--
-- We need to allow inserts in these cases:
--   1. Pre-auth events with user_id = NULL (e.g. login_failed before session exists)
--   2. Authenticated user logging their own events (user_id = auth.uid())
--
-- This is an append-only audit log; only inserts are allowed for clients.
-- Reads are still restricted (admins use edge functions with service role).

ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;

-- Drop any existing INSERT policies so we can recreate a clean one.
DROP POLICY IF EXISTS "Users can insert their own events" ON public.auth_events;
DROP POLICY IF EXISTS "auth_events_insert_self" ON public.auth_events;
DROP POLICY IF EXISTS "auth_events_insert_anon" ON public.auth_events;
DROP POLICY IF EXISTS "auth_events_client_insert" ON public.auth_events;

-- Allow authenticated users to insert events for themselves or anonymous (null) rows.
CREATE POLICY "auth_events_client_insert_authenticated"
  ON public.auth_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IS NULL
    OR user_id = auth.uid()
  );

-- Allow anonymous (pre-auth) clients to insert events with no user_id.
-- This covers login_failed for unknown users, signup attempts, etc.
CREATE POLICY "auth_events_client_insert_anon"
  ON public.auth_events
  FOR INSERT
  TO anon
  WITH CHECK (
    user_id IS NULL
  );
