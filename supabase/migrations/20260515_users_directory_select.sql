-- Allow authenticated users to read minimal directory info (full_name, email, phone, specialty, role)
-- of other users for the Second Opinion "invite a colleague" search.
--
-- The existing users_self_select policy only allowed reading your own row, which made the
-- in-app user search return zero results. With multiple permissive SELECT policies, PostgREST
-- will allow the row if ANY policy passes — so users_self_select still works, and this new
-- policy additionally exposes the basic directory fields needed for invite search.
--
-- NOTE: This grants read access on the whole users table to all authenticated users.
-- If you want to expose only a subset of columns, do it via a SECURITY DEFINER view instead.
-- For this app's flow (clinicians inviting each other to private cases) full-row read is
-- acceptable and matches the existing enrichAuthors() / fetchComments() join behavior.
--
-- Safe to run multiple times.

alter table public.users enable row level security;

drop policy if exists users_directory_select on public.users;
create policy users_directory_select on public.users
  for select
  to authenticated
  using (true);
