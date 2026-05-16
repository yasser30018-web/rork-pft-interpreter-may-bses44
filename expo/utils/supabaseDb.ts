import { supabase } from "@/lib/supabase";
import * as Crypto from "expo-crypto";

export interface AdminOtpRecord {
  admin_id: string;
  otp_hash: string;
  channel: "email" | "sms";
  expires_at: string;
  attempts: number;
  used: boolean;
  created_at: string;
  ip_address: string;
}

export interface AdminRecoveryCodeRecord {
  admin_id: string;
  code_hash: string;
  used: boolean;
  used_at: string | null;
  created_at: string;
}

export interface UserOtpRecord {
  user_id: string;
  otp_hash: string;
  channel: "email" | "sms";
  expires_at: string;
  attempts: number;
  used: boolean;
  created_at: string;
  ip_address: string;
}

export interface UserSessionRecord {
  id?: string;
  user_id: string;
  session_token_hash: string;
  device_token_hash: string;
  device_name: string;
  trusted_at: string;
  expires_at: string;
  ip_address: string;
  last_used_at: string;
  is_active: boolean;
}

export interface UsersRecord {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  password_hash: string;
  otp_channel: "email" | "sms";
  is_verified: boolean;
  created_at: string;
}

export async function hashValue(value: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    value
  );
  return digest;
}

export function generateSecureRandom(length: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export function generateSecureUUID(): string {
  const hex = "0123456789abcdef";
  const bytes = new Uint8Array(36);
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 36; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let uuid = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += "-";
    } else if (i === 14) {
      uuid += "4";
    } else if (i === 19) {
      uuid += hex[(bytes[i] % 4) + 8];
    } else {
      uuid += hex[bytes[i] % 16];
    }
  }
  return uuid;
}

export async function createAdminOtpRecord(
  adminId: string,
  channel: "email" | "sms",
  otpHash: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    console.log("[SupabaseDb] Creating admin OTP record, channel:", channel);

    await supabase
      .from("admin_otp")
      .update({ used: true })
      .eq("admin_id", adminId)
      .eq("used", false);

    const { error } = await supabase.from("admin_otp").insert({
      admin_id: adminId,
      otp_hash: otpHash,
      channel,
      expires_at: expiresAt,
      attempts: 0,
      used: false,
      created_at: new Date().toISOString(),
      ip_address: "client",
    });

    if (error) {
      console.error("[SupabaseDb] Error creating admin OTP record:", error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error("[SupabaseDb] createAdminOtpRecord error:", err);
    return { success: false, error: String(err) };
  }
}

export async function incrementAdminOtpAttempts(
  adminId: string
): Promise<{ locked: boolean; attemptsLeft: number }> {
  try {
    const { data, error } = await supabase
      .from("admin_otp")
      .select("*")
      .eq("admin_id", adminId)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.error("[SupabaseDb] Error fetching admin OTP for increment:", error?.message);
      return { locked: false, attemptsLeft: 3 };
    }

    const newAttempts = (data.attempts ?? 0) + 1;
    await supabase
      .from("admin_otp")
      .update({ attempts: newAttempts })
      .eq("admin_id", adminId)
      .eq("used", false)
      .eq("created_at", data.created_at);

    if (newAttempts >= 3) {
      return { locked: true, attemptsLeft: 0 };
    }
    return { locked: false, attemptsLeft: 3 - newAttempts };
  } catch (err) {
    console.error("[SupabaseDb] incrementAdminOtpAttempts error:", err);
    return { locked: false, attemptsLeft: 2 };
  }
}

export async function markAdminOtpUsed(adminId: string): Promise<void> {
  try {
    await supabase
      .from("admin_otp")
      .update({ used: true })
      .eq("admin_id", adminId)
      .eq("used", false);
    console.log("[SupabaseDb] Admin OTP marked as used");
  } catch (err) {
    console.error("[SupabaseDb] markAdminOtpUsed error:", err);
  }
}

export async function storeAdminRecoveryCodes(
  adminId: string,
  codeHashes: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("[SupabaseDb] Storing", codeHashes.length, "admin recovery codes");

    await supabase
      .from("admin_recovery_codes")
      .delete()
      .eq("admin_id", adminId);

    const records = codeHashes.map((hash) => ({
      admin_id: adminId,
      code_hash: hash,
      used: false,
      used_at: null,
      created_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("admin_recovery_codes").insert(records);
    if (error) {
      console.error("[SupabaseDb] Error storing recovery codes:", error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error("[SupabaseDb] storeAdminRecoveryCodes error:", err);
    return { success: false, error: String(err) };
  }
}

export async function verifyAdminRecoveryCode(
  adminId: string,
  codeHash: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("admin_recovery_codes")
      .select("*")
      .eq("admin_id", adminId)
      .eq("code_hash", codeHash)
      .eq("used", false)
      .limit(1);

    if (error || !data || data.length === 0) {
      console.log("[SupabaseDb] Recovery code not found or already used");
      return false;
    }

    await supabase
      .from("admin_recovery_codes")
      .update({ used: true, used_at: new Date().toISOString() })
      .eq("admin_id", adminId)
      .eq("code_hash", codeHash)
      .eq("used", false);

    console.log("[SupabaseDb] Recovery code verified and marked used");
    return true;
  } catch (err) {
    console.error("[SupabaseDb] verifyAdminRecoveryCode error:", err);
    return false;
  }
}

export async function getRemainingAdminRecoveryCodes(adminId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("admin_recovery_codes")
      .select("id")
      .eq("admin_id", adminId)
      .eq("used", false);

    if (error || !data) return 0;
    return data.length;
  } catch {
    return 0;
  }
}

export async function createUserOtpRecord(
  userId: string,
  channel: "email" | "sms",
  otpHash: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    console.log("[SupabaseDb] Creating user OTP record, channel:", channel);

    await supabase
      .from("user_otp")
      .update({ used: true })
      .eq("user_id", userId)
      .eq("used", false);

    const { error } = await supabase.from("user_otp").insert({
      user_id: userId,
      otp_hash: otpHash,
      channel,
      expires_at: expiresAt,
      attempts: 0,
      used: false,
      created_at: new Date().toISOString(),
      ip_address: "client",
    });

    if (error) {
      console.error("[SupabaseDb] Error creating user OTP record:", error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error("[SupabaseDb] createUserOtpRecord error:", err);
    return { success: false, error: String(err) };
  }
}

export async function incrementUserOtpAttempts(
  userId: string
): Promise<{ locked: boolean; attemptsLeft: number }> {
  try {
    const { data, error } = await supabase
      .from("user_otp")
      .select("*")
      .eq("user_id", userId)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return { locked: false, attemptsLeft: 3 };
    }

    const newAttempts = (data.attempts ?? 0) + 1;
    await supabase
      .from("user_otp")
      .update({ attempts: newAttempts })
      .eq("user_id", userId)
      .eq("used", false)
      .eq("created_at", data.created_at);

    if (newAttempts >= 3) {
      return { locked: true, attemptsLeft: 0 };
    }
    return { locked: false, attemptsLeft: 3 - newAttempts };
  } catch (err) {
    console.error("[SupabaseDb] incrementUserOtpAttempts error:", err);
    return { locked: false, attemptsLeft: 2 };
  }
}

export async function markUserOtpUsed(userId: string): Promise<void> {
  try {
    await supabase
      .from("user_otp")
      .update({ used: true })
      .eq("user_id", userId)
      .eq("used", false);
    console.log("[SupabaseDb] User OTP marked as used");
  } catch (err) {
    console.error("[SupabaseDb] markUserOtpUsed error:", err);
  }
}

export async function createUserSession(
  userId: string,
  sessionTokenHash: string,
  deviceTokenHash: string,
  deviceName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("[SupabaseDb] Deactivating all existing sessions for user:", userId);
    await supabase
      .from("user_sessions")
      .update({ is_active: false })
      .eq("user_id", userId)
      .eq("is_active", true);

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    console.log("[SupabaseDb] Creating new session for user:", userId);
    const { error } = await supabase.from("user_sessions").insert({
      user_id: userId,
      session_token_hash: sessionTokenHash,
      device_token_hash: deviceTokenHash,
      device_name: deviceName,
      trusted_at: now,
      expires_at: expiresAt,
      ip_address: "client",
      last_used_at: now,
      is_active: true,
    });

    if (error) {
      console.error("[SupabaseDb] Error creating user session:", error.message);
      return { success: false, error: error.message };
    }
    console.log("[SupabaseDb] User session created successfully");
    return { success: true };
  } catch (err) {
    console.error("[SupabaseDb] createUserSession error:", err);
    return { success: false, error: String(err) };
  }
}

export async function validateUserSession(
  userId: string,
  sessionTokenHash: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("user_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("session_token_hash", sessionTokenHash)
      .eq("is_active", true)
      .limit(1);

    if (error || !data || data.length === 0) {
      console.log("[SupabaseDb] Session not found or inactive");
      return false;
    }

    const session = data[0];
    const expiresAt = new Date(session.expires_at).getTime();
    if (Date.now() > expiresAt) {
      console.log("[SupabaseDb] Session expired");
      await supabase
        .from("user_sessions")
        .update({ is_active: false })
        .eq("user_id", userId)
        .eq("session_token_hash", sessionTokenHash);
      return false;
    }

    await supabase
      .from("user_sessions")
      .update({ last_used_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("session_token_hash", sessionTokenHash);

    return true;
  } catch (err) {
    console.error("[SupabaseDb] validateUserSession error:", err);
    return false;
  }
}

export async function checkDeviceTrusted(
  userId: string,
  deviceTokenHash: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("user_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("device_token_hash", deviceTokenHash)
      .eq("is_active", true)
      .limit(1);

    if (error || !data || data.length === 0) {
      console.log("[SupabaseDb] Device not trusted - no matching active session");
      return false;
    }

    const session = data[0];
    const trustedAt = new Date(session.trusted_at).getTime();
    const daysSinceTrust = (Date.now() - trustedAt) / (1000 * 60 * 60 * 24);

    if (daysSinceTrust > 30) {
      console.log("[SupabaseDb] Device trust expired after", Math.floor(daysSinceTrust), "days");
      return false;
    }

    console.log("[SupabaseDb] Device is trusted, days:", Math.floor(daysSinceTrust));
    return true;
  } catch (err) {
    console.error("[SupabaseDb] checkDeviceTrusted error:", err);
    return false;
  }
}

export async function invalidateAllUserSessions(userId: string): Promise<void> {
  try {
    await supabase
      .from("user_sessions")
      .update({ is_active: false })
      .eq("user_id", userId)
      .eq("is_active", true);
    console.log("[SupabaseDb] All sessions invalidated for user:", userId);
  } catch (err) {
    console.error("[SupabaseDb] invalidateAllUserSessions error:", err);
  }
}

export async function logAuthEvent(
  userId: string | null,
  eventType: string,
  details: string
): Promise<void> {
  try {
    console.log("[SupabaseDb] Auth event:", eventType, "user:", userId, "details:", details);

    // If there is no active session (e.g. during logout or signup before
    // the session is established), pass user_id as NULL so the insert is
    // not rejected by RLS. Otherwise only keep the user_id when it matches
    // the currently authenticated user.
    let safeUserId: string | null = null;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUid = sessionData?.session?.user?.id ?? null;
      if (currentUid && userId && currentUid === userId) {
        safeUserId = userId;
      } else {
        safeUserId = null;
      }
    } catch {
      safeUserId = null;
    }

    const { error } = await supabase.from("auth_events").insert({
      user_id: safeUserId,
      event_type: eventType,
      details: safeUserId === null && userId ? `[uid:${userId}] ${details}` : details,
      ip_address: "client",
      created_at: new Date().toISOString(),
    });
    if (error) {
      console.error("[SupabaseDb] logAuthEvent insert error:", error.message);
    }
  } catch (err) {
    console.error("[SupabaseDb] logAuthEvent error:", err);
  }
}

export async function checkUserLoginLockout(
  userId: string
): Promise<{ locked: boolean; remainingSeconds: number }> {
  try {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("auth_events")
      .select("created_at")
      .eq("user_id", userId)
      .eq("event_type", "login_failed")
      .gte("created_at", fifteenMinAgo)
      .order("created_at", { ascending: false });

    if (error || !data) return { locked: false, remainingSeconds: 0 };

    if (data.length >= 3) {
      const oldest = new Date(data[data.length - 1].created_at).getTime();
      const unlockAt = oldest + 15 * 60 * 1000;
      const remaining = Math.max(0, Math.ceil((unlockAt - Date.now()) / 1000));
      if (remaining > 0) {
        console.log("[SupabaseDb] User login locked, remaining:", remaining, "seconds");
        return { locked: true, remainingSeconds: remaining };
      }
    }
    return { locked: false, remainingSeconds: 0 };
  } catch (err) {
    console.error("[SupabaseDb] checkUserLoginLockout error:", err);
    return { locked: false, remainingSeconds: 0 };
  }
}

export async function sendSessionTerminationNotification(
  userId: string,
  userEmail: string
): Promise<void> {
  try {
    console.log("[SupabaseDb] Sending session termination notification to:", userEmail);
    const { error } = await supabase.from("auth_events").insert({
      user_id: userId,
      event_type: "session_terminated_notification",
      details: `Session terminated. Notification queued for ${userEmail}. If this wasn't you, change your password immediately.`,
      ip_address: "client",
      created_at: new Date().toISOString(),
    });
    if (error) {
      console.error("[SupabaseDb] Notification log error:", error.message);
    }
  } catch (err) {
    console.error("[SupabaseDb] sendSessionTerminationNotification error:", err);
  }
}

export async function upsertUserRecord(
  userId: string,
  fullName: string,
  email: string,
  phone: string | null,
  otpChannel: "email" | "sms",
  isVerified: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("[SupabaseDb] Upserting user record for:", email);
    const { error } = await supabase.from("users").upsert(
      {
        id: userId,
        full_name: fullName,
        email,
        phone,
        password_hash: "managed_by_supabase_auth",
        otp_channel: otpChannel,
        is_verified: isVerified,
        created_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      console.error("[SupabaseDb] Error upserting user:", error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error("[SupabaseDb] upsertUserRecord error:", err);
    return { success: false, error: String(err) };
  }
}

export async function markUserVerified(userId: string): Promise<void> {
  try {
    await supabase
      .from("users")
      .update({ is_verified: true })
      .eq("id", userId);
    console.log("[SupabaseDb] User marked as verified:", userId);
  } catch (err) {
    console.error("[SupabaseDb] markUserVerified error:", err);
  }
}

export async function isUserVerified(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("is_verified")
      .eq("id", userId)
      .limit(1)
      .single();

    if (error || !data) return true;
    return data.is_verified === true;
  } catch {
    return true;
  }
}

export async function fetchAllUsers(): Promise<{ data: UsersRecord[]; error?: string }> {
  try {
    console.log("[SupabaseDb] Fetching all users from database");
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[SupabaseDb] Error fetching users:", error.message);
      return { data: [], error: error.message };
    }
    console.log("[SupabaseDb] Fetched", data?.length ?? 0, "users");
    return { data: data ?? [] };
  } catch (err) {
    console.error("[SupabaseDb] fetchAllUsers error:", err);
    return { data: [], error: String(err) };
  }
}

export async function deleteUserRecord(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("[SupabaseDb] Deleting user record:", userId);

    await supabase.from("user_sessions").delete().eq("user_id", userId);
    await supabase.from("user_otp").delete().eq("user_id", userId);
    await supabase.from("auth_events").delete().eq("user_id", userId);
    await supabase.from("subscriptions").delete().eq("user_id", userId);

    const { error } = await supabase.from("users").delete().eq("id", userId);
    if (error) {
      console.error("[SupabaseDb] Error deleting user:", error.message);
      return { success: false, error: error.message };
    }
    console.log("[SupabaseDb] User deleted successfully:", userId);
    return { success: true };
  } catch (err) {
    console.error("[SupabaseDb] deleteUserRecord error:", err);
    return { success: false, error: String(err) };
  }
}

export async function updateUserStatus(
  userId: string,
  isVerified: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("[SupabaseDb] Updating user status:", userId, "verified:", isVerified);
    const { error } = await supabase
      .from("users")
      .update({ is_verified: isVerified })
      .eq("id", userId);

    if (error) {
      console.error("[SupabaseDb] Error updating user status:", error.message);
      return { success: false, error: error.message };
    }
    if (!isVerified) {
      await supabase
        .from("user_sessions")
        .update({ is_active: false })
        .eq("user_id", userId)
        .eq("is_active", true);
    }
    console.log("[SupabaseDb] User status updated successfully");
    return { success: true };
  } catch (err) {
    console.error("[SupabaseDb] updateUserStatus error:", err);
    return { success: false, error: String(err) };
  }
}

export interface SubscriptionRecord {
  user_id: string;
  status: "active" | "trial" | "expired" | "cancelled" | "none";
  plan_id: string | null;
  expires_at: string | null;
  trial_ends_at: string | null;
  updated_at: string;
  created_at: string;
}

export async function upsertSubscriptionRecord(
  userId: string,
  status: string,
  planId: string | null,
  expiresAt: string | null,
  trialEndsAt: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("[SupabaseDb] Upserting subscription for user:", userId, "status:", status);
    const now = new Date().toISOString();
    const { error } = await supabase.from("subscriptions").upsert(
      {
        user_id: userId,
        status,
        plan_id: planId,
        expires_at: expiresAt,
        trial_ends_at: trialEndsAt,
        updated_at: now,
        created_at: now,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      console.error("[SupabaseDb] Error upserting subscription:", error.message);
      return { success: false, error: error.message };
    }
    console.log("[SupabaseDb] Subscription upserted successfully");
    return { success: true };
  } catch (err) {
    console.error("[SupabaseDb] upsertSubscriptionRecord error:", err);
    return { success: false, error: String(err) };
  }
}

export async function fetchSubscriptionForUser(
  userId: string
): Promise<{ data: SubscriptionRecord | null; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[SupabaseDb] Error fetching subscription:", error.message);
      return { data: null, error: error.message };
    }
    return { data: data ?? null };
  } catch (err) {
    console.error("[SupabaseDb] fetchSubscriptionForUser error:", err);
    return { data: null, error: String(err) };
  }
}

export async function fetchAllSubscriptions(): Promise<{ data: SubscriptionRecord[]; error?: string }> {
  try {
    console.log("[SupabaseDb] Fetching all subscriptions from database");
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[SupabaseDb] Error fetching subscriptions:", error.message);
      return { data: [], error: error.message };
    }
    console.log("[SupabaseDb] Fetched", data?.length ?? 0, "subscriptions");
    return { data: data ?? [] };
  } catch (err) {
    console.error("[SupabaseDb] fetchAllSubscriptions error:", err);
    return { data: [], error: String(err) };
  }
}

export async function deleteSubscriptionRecord(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("[SupabaseDb] Deleting subscription for user:", userId);
    const { error } = await supabase
      .from("subscriptions")
      .delete()
      .eq("user_id", userId);

    if (error) {
      console.error("[SupabaseDb] Error deleting subscription:", error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error("[SupabaseDb] deleteSubscriptionRecord error:", err);
    return { success: false, error: String(err) };
  }
}

export interface AuthEventRecord {
  id?: string;
  user_id: string | null;
  event_type: string;
  details: string;
  ip_address: string;
  created_at: string;
}

export async function fetchAuthEvents(
  limit: number = 100
): Promise<{ data: AuthEventRecord[]; error?: string }> {
  try {
    console.log("[SupabaseDb] Fetching auth events from database");
    const { data, error } = await supabase
      .from("auth_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[SupabaseDb] Error fetching auth events:", error.message);
      return { data: [], error: error.message };
    }
    console.log("[SupabaseDb] Fetched", data?.length ?? 0, "auth events");
    return { data: data ?? [] };
  } catch (err) {
    console.error("[SupabaseDb] fetchAuthEvents error:", err);
    return { data: [], error: String(err) };
  }
}

export async function checkOtpRateLimit(
  userId: string,
  table: "admin_otp" | "user_otp"
): Promise<{ allowed: boolean; remainingSeconds: number }> {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const idColumn = table === "admin_otp" ? "admin_id" : "user_id";

    const { data, error } = await supabase
      .from(table)
      .select("created_at")
      .eq(idColumn, userId)
      .gte("created_at", tenMinutesAgo)
      .order("created_at", { ascending: false });

    if (error || !data) {
      return { allowed: true, remainingSeconds: 0 };
    }

    if (data.length >= 5) {
      const oldestInWindow = new Date(data[data.length - 1].created_at).getTime();
      const windowEnd = oldestInWindow + 10 * 60 * 1000;
      const remaining = Math.max(0, Math.ceil((windowEnd - Date.now()) / 1000));
      console.log("[SupabaseDb] OTP rate limit hit, remaining:", remaining, "seconds");
      return { allowed: false, remainingSeconds: remaining };
    }

    return { allowed: true, remainingSeconds: 0 };
  } catch (err) {
    console.error("[SupabaseDb] checkOtpRateLimit error:", err);
    return { allowed: true, remainingSeconds: 0 };
  }
}
