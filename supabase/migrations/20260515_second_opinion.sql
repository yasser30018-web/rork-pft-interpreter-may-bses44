-- =====================================================================
-- PulmoLab — Second Opinion module
-- Schema, RLS policies, indexes, and storage bucket.
-- Safe to run multiple times (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- Push-notification structure is prepared but inert until enabled.
-- =====================================================================

-- Required extensions ---------------------------------------------------
create extension if not exists "pgcrypto";

-- =====================================================================
-- 1. CASES
-- =====================================================================
create table if not exists public.second_opinion_cases (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.users(id) on delete cascade,
  visibility             text not null check (visibility in ('public','private')),
  status                 text not null default 'open' check (status in ('open','resolved','follow_up')),
  key_question           text not null,
  patient_age            integer,
  patient_gender         text,
  smoking_status         text,
  bmi                    numeric,
  comorbidities          jsonb,
  clinical_presentation  jsonb,
  labs                   jsonb,
  abg                    jsonb,
  pf_ratio               numeric,
  microbiology           jsonb,
  differentials          jsonb,
  final_impression       text,
  management             jsonb,
  tags                   text[],
  comment_count          integer not null default 0,
  helpful_count          integer not null default 0,
  view_count             integer not null default 0,
  privacy_confirmed      boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_so_cases_user_id     on public.second_opinion_cases (user_id);
create index if not exists idx_so_cases_visibility  on public.second_opinion_cases (visibility);
create index if not exists idx_so_cases_status      on public.second_opinion_cases (status);
create index if not exists idx_so_cases_created_at  on public.second_opinion_cases (created_at desc);

-- =====================================================================
-- 2. MEDIA
-- =====================================================================
create table if not exists public.second_opinion_media (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references public.second_opinion_cases(id) on delete cascade,
  media_type    text not null,
  category      text,
  storage_path  text not null,
  caption       text,
  uploaded_at   timestamptz not null default now()
);

create index if not exists idx_so_media_case_id on public.second_opinion_media (case_id);

-- =====================================================================
-- 3. INVITES (private cases)
-- =====================================================================
create table if not exists public.second_opinion_invites (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references public.second_opinion_cases(id) on delete cascade,
  invited_user_id uuid not null references public.users(id) on delete cascade,
  invited_by      uuid not null references public.users(id) on delete cascade,
  status          text not null default 'pending' check (status in ('pending','viewed')),
  created_at      timestamptz not null default now(),
  unique (case_id, invited_user_id)
);

create index if not exists idx_so_invites_invited_user on public.second_opinion_invites (invited_user_id);
create index if not exists idx_so_invites_case_id      on public.second_opinion_invites (case_id);

-- =====================================================================
-- 4. COMMENTS
-- =====================================================================
create table if not exists public.second_opinion_comments (
  id                uuid primary key default gen_random_uuid(),
  case_id           uuid not null references public.second_opinion_cases(id) on delete cascade,
  user_id           uuid not null references public.users(id) on delete cascade,
  parent_comment_id uuid references public.second_opinion_comments(id) on delete cascade,
  content           text not null check (char_length(content) <= 1000),
  image_path        text,
  helpful_count     integer not null default 0,
  is_edited         boolean not null default false,
  edited_at         timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists idx_so_comments_case_id    on public.second_opinion_comments (case_id);
create index if not exists idx_so_comments_user_id    on public.second_opinion_comments (user_id);
create index if not exists idx_so_comments_parent     on public.second_opinion_comments (parent_comment_id);
create index if not exists idx_so_comments_created_at on public.second_opinion_comments (created_at);

-- =====================================================================
-- 5. HELPFUL VOTES (unique per user per comment, no self-voting)
-- =====================================================================
create table if not exists public.second_opinion_helpful (
  id          uuid primary key default gen_random_uuid(),
  comment_id  uuid not null references public.second_opinion_comments(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (comment_id, user_id)
);

create index if not exists idx_so_helpful_comment on public.second_opinion_helpful (comment_id);
create index if not exists idx_so_helpful_user    on public.second_opinion_helpful (user_id);

-- =====================================================================
-- 6. BOOKMARKS (unique per user per case)
-- =====================================================================
create table if not exists public.second_opinion_bookmarks (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references public.second_opinion_cases(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (case_id, user_id)
);

create index if not exists idx_so_bookmarks_user on public.second_opinion_bookmarks (user_id);
create index if not exists idx_so_bookmarks_case on public.second_opinion_bookmarks (case_id);

-- =====================================================================
-- 7. NOTIFICATIONS (prepared structure — inert until enabled)
--    Not wired to any trigger yet. Safe to leave empty.
-- =====================================================================
create table if not exists public.second_opinion_notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  type         text not null check (type in (
                  'new_comment','reply','helpful_milestone',
                  'private_invite','case_resolved'
                )),
  case_id      uuid references public.second_opinion_cases(id) on delete cascade,
  comment_id   uuid references public.second_opinion_comments(id) on delete cascade,
  actor_id     uuid references public.users(id) on delete set null,
  payload      jsonb,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists idx_so_notif_user_id    on public.second_opinion_notifications (user_id);
create index if not exists idx_so_notif_is_read    on public.second_opinion_notifications (is_read);
create index if not exists idx_so_notif_created_at on public.second_opinion_notifications (created_at desc);

-- =====================================================================
-- 8. updated_at trigger for cases
-- =====================================================================
create or replace function public.so_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_so_cases_updated_at on public.second_opinion_cases;
create trigger trg_so_cases_updated_at
  before update on public.second_opinion_cases
  for each row execute function public.so_set_updated_at();

-- =====================================================================
-- 9. ROW LEVEL SECURITY
-- =====================================================================
alter table public.second_opinion_cases         enable row level security;
alter table public.second_opinion_media         enable row level security;
alter table public.second_opinion_invites       enable row level security;
alter table public.second_opinion_comments      enable row level security;
alter table public.second_opinion_helpful       enable row level security;
alter table public.second_opinion_bookmarks     enable row level security;
alter table public.second_opinion_notifications enable row level security;

-- Helper: can a user see a given case?
create or replace function public.so_can_view_case(case_row public.second_opinion_cases)
returns boolean
language sql
stable
as $$
  select
    case_row.visibility = 'public'
    or case_row.user_id = auth.uid()
    or exists (
      select 1 from public.second_opinion_invites i
      where i.case_id = case_row.id and i.invited_user_id = auth.uid()
    );
$$;

-- ---- CASES policies --------------------------------------------------
drop policy if exists so_cases_select on public.second_opinion_cases;
create policy so_cases_select on public.second_opinion_cases
  for select using (
    visibility = 'public'
    or user_id = auth.uid()
    or exists (
      select 1 from public.second_opinion_invites i
      where i.case_id = second_opinion_cases.id
        and i.invited_user_id = auth.uid()
    )
  );

drop policy if exists so_cases_insert on public.second_opinion_cases;
create policy so_cases_insert on public.second_opinion_cases
  for insert with check (user_id = auth.uid() and privacy_confirmed = true);

drop policy if exists so_cases_update on public.second_opinion_cases;
create policy so_cases_update on public.second_opinion_cases
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists so_cases_delete on public.second_opinion_cases;
create policy so_cases_delete on public.second_opinion_cases
  for delete using (user_id = auth.uid());

-- ---- MEDIA policies --------------------------------------------------
drop policy if exists so_media_select on public.second_opinion_media;
create policy so_media_select on public.second_opinion_media
  for select using (
    exists (
      select 1 from public.second_opinion_cases c
      where c.id = second_opinion_media.case_id
        and public.so_can_view_case(c)
    )
  );

drop policy if exists so_media_insert on public.second_opinion_media;
create policy so_media_insert on public.second_opinion_media
  for insert with check (
    exists (
      select 1 from public.second_opinion_cases c
      where c.id = second_opinion_media.case_id and c.user_id = auth.uid()
    )
  );

drop policy if exists so_media_delete on public.second_opinion_media;
create policy so_media_delete on public.second_opinion_media
  for delete using (
    exists (
      select 1 from public.second_opinion_cases c
      where c.id = second_opinion_media.case_id and c.user_id = auth.uid()
    )
  );

-- ---- INVITES policies ------------------------------------------------
drop policy if exists so_invites_select on public.second_opinion_invites;
create policy so_invites_select on public.second_opinion_invites
  for select using (
    invited_user_id = auth.uid()
    or invited_by = auth.uid()
    or exists (
      select 1 from public.second_opinion_cases c
      where c.id = second_opinion_invites.case_id and c.user_id = auth.uid()
    )
  );

drop policy if exists so_invites_insert on public.second_opinion_invites;
create policy so_invites_insert on public.second_opinion_invites
  for insert with check (
    invited_by = auth.uid()
    and exists (
      select 1 from public.second_opinion_cases c
      where c.id = second_opinion_invites.case_id and c.user_id = auth.uid()
    )
  );

drop policy if exists so_invites_update on public.second_opinion_invites;
create policy so_invites_update on public.second_opinion_invites
  for update using (invited_user_id = auth.uid())
  with check (invited_user_id = auth.uid());

drop policy if exists so_invites_delete on public.second_opinion_invites;
create policy so_invites_delete on public.second_opinion_invites
  for delete using (
    invited_by = auth.uid()
    or exists (
      select 1 from public.second_opinion_cases c
      where c.id = second_opinion_invites.case_id and c.user_id = auth.uid()
    )
  );

-- ---- COMMENTS policies -----------------------------------------------
drop policy if exists so_comments_select on public.second_opinion_comments;
create policy so_comments_select on public.second_opinion_comments
  for select using (
    exists (
      select 1 from public.second_opinion_cases c
      where c.id = second_opinion_comments.case_id and public.so_can_view_case(c)
    )
  );

drop policy if exists so_comments_insert on public.second_opinion_comments;
create policy so_comments_insert on public.second_opinion_comments
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.second_opinion_cases c
      where c.id = second_opinion_comments.case_id and public.so_can_view_case(c)
    )
  );

drop policy if exists so_comments_update on public.second_opinion_comments;
create policy so_comments_update on public.second_opinion_comments
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists so_comments_delete on public.second_opinion_comments;
create policy so_comments_delete on public.second_opinion_comments
  for delete using (
    user_id = auth.uid()
    or exists (
      select 1 from public.second_opinion_cases c
      where c.id = second_opinion_comments.case_id and c.user_id = auth.uid()
    )
  );

-- ---- HELPFUL policies (no self-vote) ---------------------------------
drop policy if exists so_helpful_select on public.second_opinion_helpful;
create policy so_helpful_select on public.second_opinion_helpful
  for select using (
    exists (
      select 1
      from public.second_opinion_comments cm
      join public.second_opinion_cases c on c.id = cm.case_id
      where cm.id = second_opinion_helpful.comment_id and public.so_can_view_case(c)
    )
  );

drop policy if exists so_helpful_insert on public.second_opinion_helpful;
create policy so_helpful_insert on public.second_opinion_helpful
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.second_opinion_comments cm
      where cm.id = second_opinion_helpful.comment_id and cm.user_id <> auth.uid()
    )
  );

drop policy if exists so_helpful_delete on public.second_opinion_helpful;
create policy so_helpful_delete on public.second_opinion_helpful
  for delete using (user_id = auth.uid());

-- ---- BOOKMARKS policies ----------------------------------------------
drop policy if exists so_bookmarks_select on public.second_opinion_bookmarks;
create policy so_bookmarks_select on public.second_opinion_bookmarks
  for select using (user_id = auth.uid());

drop policy if exists so_bookmarks_insert on public.second_opinion_bookmarks;
create policy so_bookmarks_insert on public.second_opinion_bookmarks
  for insert with check (user_id = auth.uid());

drop policy if exists so_bookmarks_delete on public.second_opinion_bookmarks;
create policy so_bookmarks_delete on public.second_opinion_bookmarks
  for delete using (user_id = auth.uid());

-- ---- NOTIFICATIONS policies (prepared) -------------------------------
drop policy if exists so_notif_select on public.second_opinion_notifications;
create policy so_notif_select on public.second_opinion_notifications
  for select using (user_id = auth.uid());

drop policy if exists so_notif_update on public.second_opinion_notifications;
create policy so_notif_update on public.second_opinion_notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists so_notif_delete on public.second_opinion_notifications;
create policy so_notif_delete on public.second_opinion_notifications
  for delete using (user_id = auth.uid());

-- (Insert into notifications is intentionally restricted: only the
--  service role / future triggers will write here. No client insert policy.)

-- =====================================================================
-- 10. STORAGE BUCKET — second-opinion-media
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('second-opinion-media', 'second-opinion-media', true)
on conflict (id) do nothing;

-- Storage policies: path convention is "{case_id}/..." so the first
-- path segment links the object back to a case row.
drop policy if exists so_storage_select on storage.objects;
create policy so_storage_select on storage.objects
  for select using (
    bucket_id = 'second-opinion-media'
    and exists (
      select 1 from public.second_opinion_cases c
      where c.id::text = (storage.foldername(name))[1]
        and public.so_can_view_case(c)
    )
  );

drop policy if exists so_storage_insert on storage.objects;
create policy so_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'second-opinion-media'
    and exists (
      select 1 from public.second_opinion_cases c
      where c.id::text = (storage.foldername(name))[1]
        and c.user_id = auth.uid()
    )
  );

drop policy if exists so_storage_update on storage.objects;
create policy so_storage_update on storage.objects
  for update using (
    bucket_id = 'second-opinion-media'
    and exists (
      select 1 from public.second_opinion_cases c
      where c.id::text = (storage.foldername(name))[1]
        and c.user_id = auth.uid()
    )
  );

drop policy if exists so_storage_delete on storage.objects;
create policy so_storage_delete on storage.objects
  for delete using (
    bucket_id = 'second-opinion-media'
    and exists (
      select 1 from public.second_opinion_cases c
      where c.id::text = (storage.foldername(name))[1]
        and c.user_id = auth.uid()
    )
  );

-- =====================================================================
-- 11. REALTIME — enable for comments (live discussion)
-- =====================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'second_opinion_comments'
  ) then
    execute 'alter publication supabase_realtime add table public.second_opinion_comments';
  end if;
end $$;

-- =====================================================================
-- End of migration
-- =====================================================================
