import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { decode as decodeBase64 } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";

export type CaseVisibility = "public" | "private";
export type CaseStatus = "open" | "resolved" | "follow_up";
export type Gender = "Male" | "Female";

export interface SecondOpinionCase {
  id: string;
  user_id: string;
  visibility: CaseVisibility;
  status: CaseStatus;
  key_question: string;
  patient_age: number | null;
  patient_gender: string | null;
  smoking_status: string | null;
  bmi: number | null;
  comorbidities: string[] | null;
  clinical_presentation: Record<string, unknown> | null;
  labs: Record<string, unknown> | null;
  abg: Record<string, unknown> | null;
  pf_ratio: number | null;
  microbiology: Record<string, unknown> | null;
  differentials: { rank: number; diagnosis: string; reasoning?: string }[] | null;
  final_impression: string | null;
  management: Record<string, unknown> | null;
  tags: string[] | null;
  comment_count: number;
  helpful_count: number;
  view_count: number;
  privacy_confirmed: boolean;
  created_at: string;
  updated_at: string;
  // joined
  author_name?: string;
  author_role?: string;
  author_specialty?: string;
  thumbnail_url?: string | null;
  bookmarked?: boolean;
}

export interface SecondOpinionMedia {
  id: string;
  case_id: string;
  media_type: string;
  category: string | null;
  storage_path: string;
  caption: string | null;
  uploaded_at: string;
  public_url?: string;
}

export interface SecondOpinionComment {
  id: string;
  case_id: string;
  user_id: string;
  parent_comment_id: string | null;
  content: string;
  image_path: string | null;
  helpful_count: number;
  is_edited: boolean;
  edited_at: string | null;
  created_at: string;
  author_name?: string;
  author_role?: string;
  author_specialty?: string;
  helpful_by_me?: boolean;
}

export interface PublicUserLite {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  specialty?: string | null;
  role?: string | null;
}

const CASES = "second_opinion_cases";
const MEDIA = "second_opinion_media";
const INVITES = "second_opinion_invites";
const COMMENTS = "second_opinion_comments";
const HELPFUL = "second_opinion_helpful";
const BOOKMARKS = "second_opinion_bookmarks";

const STORAGE_BUCKET = "second-opinion-media";

function logErr(scope: string, err: unknown) {
  console.error(`[SecondOpinion] ${scope}:`, err);
}

/**
 * Returns true if a string looks like a remote, displayable URL (http/https).
 * blob:, file:, content:, data:, ph-asset: URIs are local/ephemeral and must be
 * uploaded to Supabase Storage before they can be shared between users.
 */
export function isRemoteUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^https?:\/\//i.test(value);
}

function inferContentType(uri: string, kind: "image" | "video" | "pdf"): string {
  const lower = uri.toLowerCase();
  if (kind === "pdf") return "application/pdf";
  if (kind === "video") {
    if (lower.endsWith(".mov") || lower.endsWith(".qt")) return "video/quicktime";
    return "video/mp4";
  }
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function inferExtension(uri: string, kind: "image" | "video" | "pdf"): string {
  const match = /\.([a-zA-Z0-9]{2,5})(?:\?|#|$)/.exec(uri);
  if (match) return match[1].toLowerCase();
  if (kind === "pdf") return "pdf";
  if (kind === "video") return "mp4";
  return "jpg";
}

/**
 * Uploads a locally-picked media URI (blob:, file:, content:, etc.) to the
 * second-opinion-media bucket and returns the public URL that any user can
 * load via `<Image source={{ uri }} />`.
 */
export async function uploadSecondOpinionMedia(params: {
  userId: string;
  uri: string;
  kind: "image" | "video" | "pdf";
  fileName?: string;
  onProgress?: (stage: "reading" | "uploading" | "done") => void;
}): Promise<{ publicUrl: string | null; storagePath: string | null; error?: string }> {
  try {
    if (isRemoteUrl(params.uri)) {
      return { publicUrl: params.uri, storagePath: null };
    }
    const contentType = params.fileName?.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : inferContentType(params.uri, params.kind);
    const ext = inferExtension(params.fileName ?? params.uri, params.kind);
    const safeName = (params.fileName ?? `media.${ext}`).replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${params.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

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
      // On native (Expo Go), `fetch(file://...)` returns a blob that Supabase
      // uploads as 0 bytes. Read the file as base64 and convert to ArrayBuffer.
      const base64 = await FileSystem.readAsStringAsync(params.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      body = decodeBase64(base64);
    }

    params.onProgress?.("uploading");
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, body, { contentType: resolvedContentType, upsert: false });
    if (error) {
      logErr("uploadSecondOpinionMedia", error.message);
      return { publicUrl: null, storagePath: null, error: error.message };
    }
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
    params.onProgress?.("done");
    return { publicUrl: data.publicUrl ?? null, storagePath };
  } catch (err) {
    logErr("uploadSecondOpinionMedia", err);
    return { publicUrl: null, storagePath: null, error: String(err) };
  }
}

/** Returns the public URL for a storage path inside the second-opinion-media bucket. */
export function getSecondOpinionPublicUrl(storagePath: string): string | null {
  try {
    if (isRemoteUrl(storagePath)) return storagePath;
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
    return data.publicUrl ?? null;
  } catch (err) {
    logErr("getSecondOpinionPublicUrl", err);
    return null;
  }
}

/**
 * Ensure a row exists in public.users for the given auth user.
 * The second_opinion_cases.user_id FK references public.users(id), so we must
 * guarantee the row exists before inserting a case. Safe to call repeatedly.
 */
export async function ensurePublicUserRow(userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (existing) return { ok: true };

    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;
    const email = authUser?.email ?? "";
    const fullName =
      (authUser?.user_metadata?.full_name as string | undefined) ??
      email.split("@")[0] ??
      "User";
    const phone = (authUser?.user_metadata?.contact_number as string | undefined) ?? authUser?.phone ?? null;

    const { error } = await supabase.from("users").upsert(
      {
        id: userId,
        full_name: fullName,
        email,
        phone,
        password_hash: "managed_by_supabase_auth",
        otp_channel: "email",
        is_verified: true,
        created_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (error) {
      logErr("ensurePublicUserRow", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    logErr("ensurePublicUserRow", err);
    return { ok: false, error: String(err) };
  }
}

export async function fetchPublicCases(filter: "all" | "open" | "resolved" | "mine" | "saved", userId: string | null, search: string): Promise<SecondOpinionCase[]> {
  try {
    let query = supabase.from(CASES).select("*").order("created_at", { ascending: false }).limit(50);
    if (filter === "open") query = query.eq("status", "open");
    if (filter === "resolved") query = query.eq("status", "resolved");
    if (filter === "mine" && userId) query = query.eq("user_id", userId);
    if (filter !== "mine") query = query.eq("visibility", "public");
    if (search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`key_question.ilike.${term},final_impression.ilike.${term}`);
    }
    const { data, error } = await query;
    if (error) {
      logErr("fetchPublicCases", error.message);
      return [];
    }
    const cases = (data ?? []) as SecondOpinionCase[];
    if (filter === "saved" && userId) {
      const { data: bks } = await supabase.from(BOOKMARKS).select("case_id").eq("user_id", userId);
      const ids = new Set((bks ?? []).map((b: { case_id: string }) => b.case_id));
      const filtered = cases.filter((c) => ids.has(c.id));
      return enrichAuthors(filtered);
    }
    return enrichAuthors(cases);
  } catch (err) {
    logErr("fetchPublicCases", err);
    return [];
  }
}

export async function fetchPrivateInvitedCases(userId: string): Promise<SecondOpinionCase[]> {
  try {
    const { data: invites, error } = await supabase.from(INVITES).select("case_id").eq("invited_user_id", userId);
    if (error || !invites?.length) return [];
    const ids = invites.map((i: { case_id: string }) => i.case_id);
    const { data: cases } = await supabase.from(CASES).select("*").in("id", ids);
    return enrichAuthors((cases ?? []) as SecondOpinionCase[]);
  } catch (err) {
    logErr("fetchPrivateInvitedCases", err);
    return [];
  }
}

async function enrichAuthors(cases: SecondOpinionCase[]): Promise<SecondOpinionCase[]> {
  if (!cases.length) return cases;
  const ids = Array.from(new Set(cases.map((c) => c.user_id)));
  const { data: users } = await supabase.from("users").select("id,full_name,email").in("id", ids);
  const map = new Map<string, { full_name: string }>();
  (users ?? []).forEach((u: { id: string; full_name: string }) => map.set(u.id, u));
  return cases.map((c) => ({ ...c, author_name: map.get(c.user_id)?.full_name ?? "Anonymous" }));
}

export async function fetchCaseById(caseId: string): Promise<SecondOpinionCase | null> {
  try {
    const { data, error } = await supabase.from(CASES).select("*").eq("id", caseId).maybeSingle();
    if (error || !data) return null;
    const enriched = await enrichAuthors([data as SecondOpinionCase]);
    return enriched[0] ?? null;
  } catch (err) {
    logErr("fetchCaseById", err);
    return null;
  }
}

export interface CreateCasePayload {
  user_id: string;
  visibility: CaseVisibility;
  key_question: string;
  patient_age: number | null;
  patient_gender: string | null;
  smoking_status: string | null;
  bmi: number | null;
  comorbidities: string[];
  clinical_presentation: Record<string, unknown>;
  labs: Record<string, unknown>;
  abg: Record<string, unknown>;
  pf_ratio: number | null;
  microbiology: Record<string, unknown>;
  differentials: { rank: number; diagnosis: string; reasoning?: string }[];
  final_impression: string;
  management: Record<string, unknown>;
  tags: string[];
}

export async function createCase(payload: CreateCasePayload, invitedUserIds: string[]): Promise<{ id: string | null; error?: string }> {
  try {
    const ensured = await ensurePublicUserRow(payload.user_id);
    if (!ensured.ok) {
      return { id: null, error: ensured.error ?? "Could not initialize user profile" };
    }
    const { data, error } = await supabase
      .from(CASES)
      .insert({
        ...payload,
        status: "open",
        privacy_confirmed: true,
        comment_count: 0,
        helpful_count: 0,
        view_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) {
      logErr("createCase", error.message);
      return { id: null, error: error.message };
    }
    const caseId = (data as { id: string }).id;
    if (payload.visibility === "private" && invitedUserIds.length) {
      const rows = invitedUserIds.map((uid) => ({
        case_id: caseId,
        invited_user_id: uid,
        invited_by: payload.user_id,
        status: "pending",
        created_at: new Date().toISOString(),
      }));
      await supabase.from(INVITES).insert(rows);
    }
    return { id: caseId };
  } catch (err) {
    logErr("createCase", err);
    return { id: null, error: String(err) };
  }
}

export async function updateCase(caseId: string, payload: Partial<CreateCasePayload>, invitedUserIds?: string[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from(CASES)
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", caseId);
    if (error) {
      logErr("updateCase", error.message);
      return false;
    }
    if (invitedUserIds && payload.visibility === "private") {
      await supabase.from(INVITES).delete().eq("case_id", caseId);
      if (invitedUserIds.length) {
        const rows = invitedUserIds.map((uid) => ({
          case_id: caseId,
          invited_user_id: uid,
          invited_by: payload.user_id,
          status: "pending",
          created_at: new Date().toISOString(),
        }));
        await supabase.from(INVITES).insert(rows);
      }
    }
    return true;
  } catch (err) {
    logErr("updateCase", err);
    return false;
  }
}

export async function updateCaseStatus(caseId: string, status: CaseStatus): Promise<boolean> {
  try {
    const { error } = await supabase.from(CASES).update({ status, updated_at: new Date().toISOString() }).eq("id", caseId);
    if (error) {
      logErr("updateCaseStatus", error.message);
      return false;
    }
    return true;
  } catch (err) {
    logErr("updateCaseStatus", err);
    return false;
  }
}

export async function deleteCase(caseId: string): Promise<boolean> {
  try {
    await supabase.from(COMMENTS).delete().eq("case_id", caseId);
    await supabase.from(INVITES).delete().eq("case_id", caseId);
    await supabase.from(BOOKMARKS).delete().eq("case_id", caseId);
    await supabase.from(MEDIA).delete().eq("case_id", caseId);
    const { error } = await supabase.from(CASES).delete().eq("id", caseId);
    if (error) {
      logErr("deleteCase", error.message);
      return false;
    }
    return true;
  } catch (err) {
    logErr("deleteCase", err);
    return false;
  }
}

export async function incrementViewCount(caseId: string, viewerId: string | null, ownerId: string): Promise<void> {
  try {
    if (viewerId && viewerId === ownerId) return;
    const { data } = await supabase.from(CASES).select("view_count").eq("id", caseId).maybeSingle();
    const current = (data as { view_count: number } | null)?.view_count ?? 0;
    await supabase.from(CASES).update({ view_count: current + 1 }).eq("id", caseId);
  } catch (err) {
    logErr("incrementViewCount", err);
  }
}

export async function fetchComments(caseId: string, currentUserId: string | null): Promise<SecondOpinionComment[]> {
  try {
    const { data, error } = await supabase
      .from(COMMENTS)
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });
    if (error) {
      logErr("fetchComments", error.message);
      return [];
    }
    const comments = (data ?? []) as SecondOpinionComment[];
    if (!comments.length) return comments;
    const userIds = Array.from(new Set(comments.map((c) => c.user_id)));
    const { data: users } = await supabase.from("users").select("id,full_name").in("id", userIds);
    const map = new Map<string, { full_name: string }>();
    (users ?? []).forEach((u: { id: string; full_name: string }) => map.set(u.id, u));
    let helpfulSet = new Set<string>();
    if (currentUserId) {
      const { data: hf } = await supabase
        .from(HELPFUL)
        .select("comment_id")
        .eq("user_id", currentUserId)
        .in("comment_id", comments.map((c) => c.id));
      helpfulSet = new Set((hf ?? []).map((h: { comment_id: string }) => h.comment_id));
    }
    return comments.map((c) => ({
      ...c,
      author_name: map.get(c.user_id)?.full_name ?? "User",
      helpful_by_me: helpfulSet.has(c.id),
    }));
  } catch (err) {
    logErr("fetchComments", err);
    return [];
  }
}

export async function postComment(caseId: string, userId: string, content: string, parentCommentId: string | null): Promise<{ id: string | null; error?: string }> {
  try {
    const ensured = await ensurePublicUserRow(userId);
    if (!ensured.ok) {
      return { id: null, error: ensured.error ?? "Could not initialize user profile" };
    }
    const { data, error } = await supabase
      .from(COMMENTS)
      .insert({
        case_id: caseId,
        user_id: userId,
        parent_comment_id: parentCommentId,
        content: content.trim().slice(0, 1000),
        helpful_count: 0,
        is_edited: false,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) {
      logErr("postComment", error.message);
      return { id: null, error: error.message };
    }
    const { data: caseData } = await supabase.from(CASES).select("comment_count").eq("id", caseId).maybeSingle();
    const cur = (caseData as { comment_count: number } | null)?.comment_count ?? 0;
    await supabase.from(CASES).update({ comment_count: cur + 1 }).eq("id", caseId);
    return { id: (data as { id: string }).id };
  } catch (err) {
    logErr("postComment", err);
    return { id: null, error: String(err) };
  }
}

export async function editComment(commentId: string, content: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from(COMMENTS)
      .update({ content: content.trim().slice(0, 1000), is_edited: true, edited_at: new Date().toISOString() })
      .eq("id", commentId);
    if (error) return false;
    return true;
  } catch (err) {
    logErr("editComment", err);
    return false;
  }
}

export async function deleteComment(commentId: string, caseId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from(COMMENTS).delete().eq("id", commentId);
    if (error) return false;
    const { data } = await supabase.from(CASES).select("comment_count").eq("id", caseId).maybeSingle();
    const cur = (data as { comment_count: number } | null)?.comment_count ?? 0;
    await supabase.from(CASES).update({ comment_count: Math.max(0, cur - 1) }).eq("id", caseId);
    return true;
  } catch (err) {
    logErr("deleteComment", err);
    return false;
  }
}

export async function toggleHelpful(commentId: string, userId: string): Promise<{ helpful: boolean; count: number }> {
  try {
    await ensurePublicUserRow(userId);
    const { data: existing } = await supabase
      .from(HELPFUL)
      .select("id")
      .eq("comment_id", commentId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      await supabase.from(HELPFUL).delete().eq("id", (existing as { id: string }).id);
    } else {
      await supabase.from(HELPFUL).insert({
        comment_id: commentId,
        user_id: userId,
        created_at: new Date().toISOString(),
      });
    }
    const { count } = await supabase
      .from(HELPFUL)
      .select("*", { count: "exact", head: true })
      .eq("comment_id", commentId);
    const newCount = count ?? 0;
    await supabase.from(COMMENTS).update({ helpful_count: newCount }).eq("id", commentId);
    return { helpful: !existing, count: newCount };
  } catch (err) {
    logErr("toggleHelpful", err);
    return { helpful: false, count: 0 };
  }
}

export async function toggleBookmark(caseId: string, userId: string): Promise<boolean> {
  try {
    await ensurePublicUserRow(userId);
    const { data: existing } = await supabase
      .from(BOOKMARKS)
      .select("id")
      .eq("case_id", caseId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      await supabase.from(BOOKMARKS).delete().eq("id", (existing as { id: string }).id);
      return false;
    }
    await supabase.from(BOOKMARKS).insert({
      case_id: caseId,
      user_id: userId,
      created_at: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    logErr("toggleBookmark", err);
    return false;
  }
}

export async function isBookmarked(caseId: string, userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from(BOOKMARKS)
      .select("id")
      .eq("case_id", caseId)
      .eq("user_id", userId)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

export async function searchUsers(query: string, excludeUserId: string | null): Promise<PublicUserLite[]> {
  try {
    const term = query.trim();
    if (term.length < 2) return [];
    let q = supabase
      .from("users_search")
      .select("id, full_name, phone, email")
      .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`)
      .limit(20);
    if (excludeUserId) q = q.neq("id", excludeUserId);
    const { data, error } = await q;
    if (error) {
      logErr("searchUsers", error.message);
      return [];
    }
    return (data ?? []) as PublicUserLite[];
  } catch (err) {
    logErr("searchUsers", err);
    return [];
  }
}

function normalizePhone(value: string): string {
  return value.replace(/[^0-9]/g, "").replace(/^0+/, "");
}

export async function matchContactsByPhone(phoneNumbers: string[], excludeUserId: string | null): Promise<PublicUserLite[]> {
  try {
    const normalized = phoneNumbers.map(normalizePhone).filter((v) => v.length >= 6);
    if (!normalized.length) return [];
    const { data, error } = await supabase
      .from("users_search")
      .select("id, full_name, phone, email")
      .not("phone", "is", null);
    if (error) {
      logErr("matchContactsByPhone", error.message);
      return [];
    }
    const set = new Set(normalized.map((n) => n.slice(-9)));
    return ((data ?? []) as PublicUserLite[])
      .filter((u) => u.id !== excludeUserId)
      .filter((u) => {
        if (!u.phone) return false;
        const np = normalizePhone(u.phone);
        return np.length >= 6 && set.has(np.slice(-9));
      });
  } catch (err) {
    logErr("matchContactsByPhone", err);
    return [];
  }
}

export function subscribeToComments(caseId: string, onChange: () => void): () => void {
  try {
    const channel = supabase
      .channel(`so-comments-${caseId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: COMMENTS, filter: `case_id=eq.${caseId}` },
        () => onChange()
      )
      .subscribe();
    return () => {
      try {
        void supabase.removeChannel(channel);
      } catch {}
    };
  } catch (err) {
    logErr("subscribeToComments", err);
    return () => {};
  }
}

export { STORAGE_BUCKET };
