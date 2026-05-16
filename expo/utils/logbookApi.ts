import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { decode as decodeBase64 } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";

export type LogbookMediaType = "image" | "video" | "pdf";
export type LogbookMediaCategory = "xray" | "ct" | "bronchoscopy" | "us" | "path" | "other";

export interface LogbookUploadResult {
  storagePath: string;
  publicUrl: string | null;
}

/** Uploads Log Book media into the dedicated Supabase Storage bucket under a user-scoped path. */
export async function uploadLogbookMedia(params: {
  userId: string;
  entityId: string;
  entityType: "case" | "procedure";
  fileName: string;
  file: Blob | ArrayBuffer;
  contentType: string;
}): Promise<LogbookUploadResult> {
  const safeFileName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${params.userId}/${params.entityType}s/${params.entityId}/${Date.now()}-${safeFileName}`;
  const { error } = await supabase.storage
    .from("logbook-media")
    .upload(storagePath, params.file, { contentType: params.contentType, upsert: false });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from("logbook-media").getPublicUrl(storagePath);
  return { storagePath, publicUrl: data.publicUrl ?? null };
}

function inferLogbookContentType(uri: string, kind: LogbookMediaType): string {
  const lower = uri.toLowerCase();
  if (kind === "pdf") return "application/pdf";
  if (kind === "video") {
    if (lower.endsWith(".mov") || lower.endsWith(".qt")) return "video/quicktime";
    return "video/mp4";
  }
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function inferLogbookExtension(uri: string, kind: LogbookMediaType): string {
  const match = /\.([a-zA-Z0-9]{2,5})(?:\?|#|$)/.exec(uri);
  if (match) return match[1].toLowerCase();
  if (kind === "pdf") return "pdf";
  if (kind === "video") return "mp4";
  return "jpg";
}

/**
 * Uploads a locally-picked URI (file://, content://, blob:, ...) to the
 * logbook-media bucket. Reads native files via expo-file-system + base64 so
 * Expo Go uploads do not end up as 0-byte files.
 */
export async function uploadLogbookMediaFromUri(params: {
  userId: string;
  uri: string;
  kind: LogbookMediaType;
  fileName?: string;
  folder?: string;
  onProgress?: (stage: "reading" | "uploading" | "done") => void;
}): Promise<LogbookUploadResult & { error?: string }> {
  try {
    if (/^https?:\/\//i.test(params.uri)) {
      return { storagePath: params.uri, publicUrl: params.uri };
    }
    const ext = inferLogbookExtension(params.fileName ?? params.uri, params.kind);
    const safeName = (params.fileName ?? `media.${ext}`).replace(/[^a-zA-Z0-9._-]/g, "_");
    const folder = params.folder ?? "uploads";
    const storagePath = `${params.userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
    const contentType = inferLogbookContentType(params.fileName ?? params.uri, params.kind);

    params.onProgress?.("reading");
    let body: ArrayBuffer | Blob;
    let resolvedContentType = contentType;
    if (Platform.OS === "web") {
      const res = await fetch(params.uri);
      const blob = await res.blob();
      if (blob.type && blob.type !== "application/octet-stream") {
        resolvedContentType = blob.type;
      }
      body = blob;
    } else {
      const base64 = await FileSystem.readAsStringAsync(params.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      body = decodeBase64(base64);
    }

    params.onProgress?.("uploading");
    const { error } = await supabase.storage
      .from("logbook-media")
      .upload(storagePath, body, { contentType: resolvedContentType, upsert: false });
    if (error) {
      return { storagePath: "", publicUrl: null, error: error.message };
    }
    const { data } = supabase.storage.from("logbook-media").getPublicUrl(storagePath);
    params.onProgress?.("done");
    return { storagePath, publicUrl: data.publicUrl ?? null };
  } catch (err) {
    return { storagePath: "", publicUrl: null, error: String(err) };
  }
}

/** Creates the minimum RLS-safe case record for the authenticated user. */
export async function createClinicalCase(payload: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from("clinical_cases").insert(payload);
  if (error) throw new Error(error.message);
}

/** Creates the minimum RLS-safe procedure record for the authenticated user. */
export async function createClinicalProcedure(payload: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from("clinical_procedures").insert(payload);
  if (error) throw new Error(error.message);
}

/** Fetches only the signed-in user's cases through Supabase RLS. */
export async function fetchMyClinicalCases(userId: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from("clinical_cases")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Fetches only the signed-in user's procedures through Supabase RLS. */
export async function fetchMyClinicalProcedures(userId: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from("clinical_procedures")
    .select("*")
    .eq("user_id", userId)
    .order("date_time", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export const LOGBOOK_SUPABASE_SQL = `
create table if not exists public.clinical_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  patient_age int,
  patient_gender text,
  smoking_status text,
  pack_years numeric,
  bmi numeric,
  comorbidities jsonb default '[]'::jsonb,
  chief_complaint text,
  history text,
  symptoms jsonb default '[]'::jsonb,
  vitals jsonb default '{}'::jsonb,
  exam_findings jsonb default '{}'::jsonb,
  labs jsonb default '{}'::jsonb,
  abg jsonb default '{}'::jsonb,
  pf_ratio numeric,
  abg_interpretation text,
  microbiology jsonb default '{}'::jsonb,
  pft_result_id uuid,
  ecg_findings text,
  echo_findings text,
  pleural_fluid jsonb default '{}'::jsonb,
  lights_criteria text,
  differentials jsonb default '[]'::jsonb,
  final_diagnosis text,
  icd_code text,
  diagnostic_certainty text,
  severity jsonb default '{}'::jsonb,
  management jsonb default '{}'::jsonb,
  vent_settings jsonb default '{}'::jsonb,
  medications jsonb default '[]'::jsonb,
  clinical_outcome text,
  los_days int,
  learning_points jsonb default '[]'::jsonb,
  clinical_pearls jsonb default '[]'::jsonb,
  pitfalls text,
  guidelines jsonb default '[]'::jsonb,
  teaching_rating int,
  suitable_grand_rounds boolean,
  tags text[] default '{}',
  custom_tags text[] default '{}',
  visibility text default 'private',
  is_draft boolean default true,
  is_starred boolean default false,
  attending text,
  hospital text,
  admission_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.case_media (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.clinical_cases(id) on delete cascade,
  media_type text not null,
  category text not null,
  storage_path text not null,
  caption text,
  thumbnail_path text,
  file_size bigint,
  uploaded_at timestamptz default now()
);

create table if not exists public.clinical_procedures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  procedure_type text,
  procedure_number int,
  date_time timestamptz,
  hospital text,
  unit text,
  operator_name text,
  operator_role text,
  supervisor text,
  supervision_level text,
  patient_age int,
  patient_gender text,
  patient_diagnosis text,
  asa_score text,
  indication text,
  urgency text,
  technique text,
  site text,
  us_guided boolean,
  fluoroscopy boolean,
  sedation text,
  sedation_agent text,
  procedure_details jsonb default '{}'::jsonb,
  success_status text,
  failure_reason text,
  complications text[] default '{}',
  complication_severity text,
  complication_management text,
  patient_status_post text,
  reflection jsonb default '{}'::jsonb,
  competency_score int,
  supervisor_feedback text,
  ready_for_independent boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.procedure_media (
  id uuid primary key default gen_random_uuid(),
  procedure_id uuid not null references public.clinical_procedures(id) on delete cascade,
  media_type text not null,
  storage_path text not null,
  caption text,
  uploaded_at timestamptz default now()
);

create table if not exists public.case_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  description text,
  color text,
  case_ids uuid[] default '{}',
  created_at timestamptz default now()
);

alter table public.clinical_cases enable row level security;
alter table public.case_media enable row level security;
alter table public.clinical_procedures enable row level security;
alter table public.procedure_media enable row level security;
alter table public.case_collections enable row level security;

create policy "Users manage own clinical cases" on public.clinical_cases for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own procedures" on public.clinical_procedures for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own collections" on public.case_collections for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own case media" on public.case_media for all using (exists (select 1 from public.clinical_cases c where c.id = case_id and c.user_id = auth.uid())) with check (exists (select 1 from public.clinical_cases c where c.id = case_id and c.user_id = auth.uid()));
create policy "Users manage own procedure media" on public.procedure_media for all using (exists (select 1 from public.clinical_procedures p where p.id = procedure_id and p.user_id = auth.uid())) with check (exists (select 1 from public.clinical_procedures p where p.id = procedure_id and p.user_id = auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logbook-media', 'logbook-media', false, 52428800, array['image/jpeg','image/png','application/pdf','video/mp4','video/quicktime'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
`;
