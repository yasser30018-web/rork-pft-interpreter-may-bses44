import { supabase } from "@/lib/supabase";
import type { UsersRecord, SubscriptionRecord, AuthEventRecord } from "@/utils/supabaseDb";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";

async function getAdminHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data?.session?.access_token ?? "";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

async function adminFetch<T>(
  functionName: string,
  body?: Record<string, unknown>
): Promise<T> {
  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;
  const headers = await getAdminHeaders();

  console.log(`[AdminApi] Calling ${functionName}`);

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[AdminApi] ${functionName} failed:`, response.status, errorText);
    let errorMessage = `Admin API error: ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error) errorMessage = errorJson.error;
    } catch {
      if (errorText) errorMessage = errorText;
    }
    throw new Error(errorMessage);
  }

  const result = await response.json();
  console.log(`[AdminApi] ${functionName} success`);
  return result as T;
}

export async function adminFetchAllUsers(): Promise<{ data: UsersRecord[]; error?: string }> {
  try {
    const result = await adminFetch<{ data: UsersRecord[] }>("admin-fetch-users");
    console.log("[AdminApi] Fetched", result.data?.length ?? 0, "users");
    return { data: result.data ?? [] };
  } catch (err) {
    console.error("[AdminApi] adminFetchAllUsers error:", err);
    return { data: [], error: String(err) };
  }
}

export async function adminFetchAllSubscriptions(): Promise<{ data: SubscriptionRecord[]; error?: string }> {
  try {
    const result = await adminFetch<{ data: SubscriptionRecord[] }>("admin-fetch-subscriptions");
    console.log("[AdminApi] Fetched", result.data?.length ?? 0, "subscriptions");
    return { data: result.data ?? [] };
  } catch (err) {
    console.error("[AdminApi] adminFetchAllSubscriptions error:", err);
    return { data: [], error: String(err) };
  }
}

export async function adminFetchAuthEvents(
  limit: number = 200
): Promise<{ data: AuthEventRecord[]; error?: string }> {
  try {
    const result = await adminFetch<{ data: AuthEventRecord[] }>("admin-fetch-auth-events", { limit });
    console.log("[AdminApi] Fetched", result.data?.length ?? 0, "auth events");
    return { data: result.data ?? [] };
  } catch (err) {
    console.error("[AdminApi] adminFetchAuthEvents error:", err);
    return { data: [], error: String(err) };
  }
}

export async function adminDeleteUserRecord(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await adminFetch<{ success: boolean }>("admin-delete-user", { userId });
    console.log("[AdminApi] User deleted:", userId);
    return { success: result.success };
  } catch (err) {
    console.error("[AdminApi] adminDeleteUserRecord error:", err);
    return { success: false, error: String(err) };
  }
}

export async function adminDeleteSubscriptionRecord(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await adminFetch<{ success: boolean }>("admin-delete-subscription", { userId });
    console.log("[AdminApi] Subscription deleted for user:", userId);
    return { success: result.success };
  } catch (err) {
    console.error("[AdminApi] adminDeleteSubscriptionRecord error:", err);
    return { success: false, error: String(err) };
  }
}

export async function adminUpdateUserStatus(
  userId: string,
  isVerified: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await adminFetch<{ success: boolean }>("admin-update-user-status", {
      userId,
      isVerified,
    });
    console.log("[AdminApi] User status updated:", userId, "verified:", isVerified);
    return { success: result.success };
  } catch (err) {
    console.error("[AdminApi] adminUpdateUserStatus error:", err);
    return { success: false, error: String(err) };
  }
}
