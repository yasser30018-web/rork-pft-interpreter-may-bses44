-- =====================================================================
-- PulmoLab — Second Opinion: fix infinite recursion in RLS policies
--
-- Cause:
--   second_opinion_cases.SELECT policy referenced second_opinion_invites,
--   and second_opinion_invites.SELECT policy referenced second_opinion_cases.
--   Each policy triggered the other's RLS check → infinite recursion.
--
-- Fix:
--   Use SECURITY DEFINER helper functions that bypass RLS to answer the
--   "can this user see this case?" / "is this user the case owner?"
--   questions. Policies then call these helpers instead of doing
--   cross-table EXISTS queries that re-enter RLS.
--
-- Safe to run multiple times.
-- =====================================================================

-- ---- Helpers (SECURITY DEFINER, bypass RLS) --------------------------

create or replace function public.so_is_case_owner(p_case_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.second_opinion_cases c
    where c.id = p_case_id and c.user_id = p_user_id
  );
$$;

create or replace function public.so_is_invited(p_case_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.second_opinion_invites i
    where i.case_id = p_case_id and i.invited_user_id = p_user_id
  );
$$;

create or replace function public.so_can_view_case_id(p_case_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.second_opinion_cases c
    where c.id = p_case_id
      and (
        c.visibility = 'public'
        or c.user_id = p_user_id
        or exists (
          select 1 from public.second_opinion_invites i
          where i.case_id = c.id and i.invited_user_id = p_user_id
        )
      )
  );
$$;

grant execute on function public.so_is_case_owner(uuid, uuid)     to authenticated, anon;
grant execute on function public.so_is_invited(uuid, uuid)        to authenticated, anon;
grant execute on function public.so_can_view_case_id(uuid, uuid)  to authenticated, anon;

-- Replace the old row-based helper so it no longer re-enters RLS.
create or replace function public.so_can_view_case(case_row public.second_opinion_cases)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case_row.visibility = 'public'
    or case_row.user_id = auth.uid()
    or public.so_is_invited(case_row.id, auth.uid());
$$;

grant execute on function public.so_can_view_case(public.second_opinion_cases) to authenticated, anon;

-- =====================================================================
-- Rewrite policies to use the SECURITY DEFINER helpers
-- =====================================================================

-- ---- CASES -----------------------------------------------------------
drop policy if exists so_cases_select on public.second_opinion_cases;
create policy so_cases_select on public.second_opinion_cases
  for select using (
    visibility = 'public'
    or user_id = auth.uid()
    or public.so_is_invited(id, auth.uid())
  );

-- ---- MEDIA -----------------------------------------------------------
drop policy if exists so_media_select on public.second_opinion_media;
create policy so_media_select on public.second_opinion_media
  for select using (
    public.so_can_view_case_id(case_id, auth.uid())
  );

drop policy if exists so_media_insert on public.second_opinion_media;
create policy so_media_insert on public.second_opinion_media
  for insert with check (
    public.so_is_case_owner(case_id, auth.uid())
  );

drop policy if exists so_media_delete on public.second_opinion_media;
create policy so_media_delete on public.second_opinion_media
  for delete using (
    public.so_is_case_owner(case_id, auth.uid())
  );

-- ---- INVITES ---------------------------------------------------------
drop policy if exists so_invites_select on public.second_opinion_invites;
create policy so_invites_select on public.second_opinion_invites
  for select using (
    invited_user_id = auth.uid()
    or invited_by = auth.uid()
    or public.so_is_case_owner(case_id, auth.uid())
  );

drop policy if exists so_invites_insert on public.second_opinion_invites;
create policy so_invites_insert on public.second_opinion_invites
  for insert with check (
    invited_by = auth.uid()
    and public.so_is_case_owner(case_id, auth.uid())
  );

drop policy if exists so_invites_delete on public.second_opinion_invites;
create policy so_invites_delete on public.second_opinion_invites
  for delete using (
    invited_by = auth.uid()
    or public.so_is_case_owner(case_id, auth.uid())
  );

-- ---- COMMENTS --------------------------------------------------------
drop policy if exists so_comments_select on public.second_opinion_comments;
create policy so_comments_select on public.second_opinion_comments
  for select using (
    public.so_can_view_case_id(case_id, auth.uid())
  );

drop policy if exists so_comments_insert on public.second_opinion_comments;
create policy so_comments_insert on public.second_opinion_comments
  for insert with check (
    user_id = auth.uid()
    and public.so_can_view_case_id(case_id, auth.uid())
  );

drop policy if exists so_comments_delete on public.second_opinion_comments;
create policy so_comments_delete on public.second_opinion_comments
  for delete using (
    user_id = auth.uid()
    or public.so_is_case_owner(case_id, auth.uid())
  );

-- ---- HELPFUL ---------------------------------------------------------
drop policy if exists so_helpful_select on public.second_opinion_helpful;
create policy so_helpful_select on public.second_opinion_helpful
  for select using (
    exists (
      select 1 from public.second_opinion_comments cm
      where cm.id = second_opinion_helpful.comment_id
        and public.so_can_view_case_id(cm.case_id, auth.uid())
    )
  );

-- ---- STORAGE (bucket second-opinion-media) ---------------------------
drop policy if exists so_storage_select on storage.objects;
create policy so_storage_select on storage.objects
  for select using (
    bucket_id = 'second-opinion-media'
    and public.so_can_view_case_id(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  );

drop policy if exists so_storage_insert on storage.objects;
create policy so_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'second-opinion-media'
    and public.so_is_case_owner(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  );

drop policy if exists so_storage_update on storage.objects;
create policy so_storage_update on storage.objects
  for update using (
    bucket_id = 'second-opinion-media'
    and public.so_is_case_owner(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  );

drop policy if exists so_storage_delete on storage.objects;
create policy so_storage_delete on storage.objects
  for delete using (
    bucket_id = 'second-opinion-media'
    and public.so_is_case_owner(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  );

-- =====================================================================
-- End of fix
-- =====================================================================
