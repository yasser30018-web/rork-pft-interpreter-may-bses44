-- Allow authenticated users to insert/update their own row in public.users.
-- Needed because second_opinion_* tables have FKs to public.users(id),
-- and the client calls ensurePublicUserRow() before inserting cases/comments.
--
-- Safe to run multiple times.

alter table public.users enable row level security;

-- SELECT: a user can read their own row (kept narrow; broaden if needed).
drop policy if exists users_self_select on public.users;
create policy users_self_select on public.users
  for select
  to authenticated
  using (id = auth.uid());

-- INSERT: a user can create their own row, but only with their own auth id.
drop policy if exists users_self_insert on public.users;
create policy users_self_insert on public.users
  for insert
  to authenticated
  with check (id = auth.uid());

-- UPDATE: a user can update their own row.
drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
