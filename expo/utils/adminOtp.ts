import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import {
  hashValue,
  generateSecureRandom,
  createAdminOtpRecord,
  incrementAdminOtpAttempts,
  markAdminOtpUsed,
  storeAdminRecoveryCodes,
  verifyAdminRecoveryCode as dbVerifyRecoveryCode,
  getRemainingAdminRecoveryCodes,
  checkOtpRateLimit,
  logAuthEvent,
} from "@/utils/supabaseDb";

const LOCKOUT_KEY = "pulmolab_admin_lockout";
const RECOVERY_CODES_KEY = "pulmolab_admin_recovery_codes";
const RECOVERY_SETUP_KEY = "pulmolab_admin_recovery_setup_done";
const OTP_EXPIRY_KEY = "pulmolab_admin_otp_expiry";
const ADMIN_ID_KEY = "pulmolab_admin_id";

const MAX_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const OTP_EXPIRY_MS = 5 * 60 * 1000;

interface LockoutState {
  attempts: number;
  lockedUntil: number | null;
  lastAttemptAt: number;
}

interface RecoveryCode {
  hash: string;
  used: boolean;
}

async function hashCode(code: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    code
  );
  return digest;
}

function generateRandomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments: string[] = [];
  for (let s = 0; s < 2; s++) {
    let segment = "";
    for (let i = 0; i < 5; i++) {
      const randomBytes = new Uint8Array(1);
      if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues) {
        globalThis.crypto.getRandomValues(randomBytes);
      } else {
        randomBytes[0] = Math.floor(Math.random() * 256);
      }
      segment += chars[randomBytes[0] % chars.length];
    }
    segments.push(segment);
  }
  return segments.join("-");
}

export async function getAdminId(): Promise<string> {
  const stored = await AsyncStorage.getItem(ADMIN_ID_KEY);
  if (stored) return stored;
  return "admin_default";
}

export async function setAdminId(id: string): Promise<void> {
  await AsyncStorage.setItem(ADMIN_ID_KEY, id);
}

export async function getLockoutState(): Promise<LockoutState> {
  try {
    const raw = await AsyncStorage.getItem(LOCKOUT_KEY);
    if (raw) {
      const state = JSON.parse(raw) as LockoutState;
      if (state.lockedUntil && Date.now() > state.lockedUntil) {
        const reset: LockoutState = { attempts: 0, lockedUntil: null, lastAttemptAt: 0 };
        await AsyncStorage.setItem(LOCKOUT_KEY, JSON.stringify(reset));
        return reset;
      }
      return state;
    }
  } catch (e) {
    console.error("[AdminOTP] Error reading lockout state:", e);
  }
  return { attempts: 0, lockedUntil: null, lastAttemptAt: 0 };
}

export async function isLockedOut(): Promise<{ locked: boolean; remainingMs: number }> {
  const state = await getLockoutState();
  if (state.lockedUntil && Date.now() < state.lockedUntil) {
    return { locked: true, remainingMs: state.lockedUntil - Date.now() };
  }
  return { locked: false, remainingMs: 0 };
}

export async function recordFailedAttempt(): Promise<{ locked: boolean; attemptsLeft: number }> {
  const state = await getLockoutState();
  const newAttempts = state.attempts + 1;
  console.log("[AdminOTP] Failed attempt #" + newAttempts);

  const adminId = await getAdminId();
  const dbResult = await incrementAdminOtpAttempts(adminId);
  void logAuthEvent(adminId, "otp_failed", `Admin OTP failed attempt #${newAttempts}`);

  if (newAttempts >= MAX_ATTEMPTS) {
    const lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    const updated: LockoutState = { attempts: newAttempts, lockedUntil, lastAttemptAt: Date.now() };
    await AsyncStorage.setItem(LOCKOUT_KEY, JSON.stringify(updated));
    console.log("[AdminOTP] Account locked for 15 minutes");
    void logAuthEvent(adminId, "account_locked", "Admin account locked after 3 failed OTP attempts");
    return { locked: true, attemptsLeft: 0 };
  }

  const updated: LockoutState = { attempts: newAttempts, lockedUntil: null, lastAttemptAt: Date.now() };
  await AsyncStorage.setItem(LOCKOUT_KEY, JSON.stringify(updated));
  return dbResult.locked ? { locked: true, attemptsLeft: 0 } : { locked: false, attemptsLeft: MAX_ATTEMPTS - newAttempts };
}

export async function resetLockout(): Promise<void> {
  const reset: LockoutState = { attempts: 0, lockedUntil: null, lastAttemptAt: 0 };
  await AsyncStorage.setItem(LOCKOUT_KEY, JSON.stringify(reset));
  console.log("[AdminOTP] Lockout reset");
}

export async function setOtpExpiry(): Promise<number> {
  const expiresAt = Date.now() + OTP_EXPIRY_MS;
  await AsyncStorage.setItem(OTP_EXPIRY_KEY, String(expiresAt));
  return expiresAt;
}

export async function getOtpExpiry(): Promise<number> {
  const raw = await AsyncStorage.getItem(OTP_EXPIRY_KEY);
  if (raw) return parseInt(raw, 10);
  return Date.now() + OTP_EXPIRY_MS;
}

export async function isRecoverySetupDone(): Promise<boolean> {
  const val = await AsyncStorage.getItem(RECOVERY_SETUP_KEY);
  return val === "true";
}

export async function trackAdminOtpSent(channel: "email" | "sms"): Promise<{ allowed: boolean }> {
  const adminId = await getAdminId();
  const rateCheck = await checkOtpRateLimit(adminId, "admin_otp");
  if (!rateCheck.allowed) {
    console.log("[AdminOTP] Rate limit exceeded, wait", rateCheck.remainingSeconds, "seconds");
    return { allowed: false };
  }

  const otpHash = await hashValue(`admin_otp_${Date.now()}_${generateSecureRandom(8)}`);
  await createAdminOtpRecord(adminId, channel, otpHash);
  void logAuthEvent(adminId, "otp_generated", `Admin OTP sent via ${channel}`);
  return { allowed: true };
}

export async function onAdminOtpSuccess(): Promise<void> {
  const adminId = await getAdminId();
  await markAdminOtpUsed(adminId);
  void logAuthEvent(adminId, "otp_verified", "Admin OTP verified successfully");
}

export async function generateRecoveryCodes(): Promise<string[]> {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    codes.push(generateRandomCode());
  }

  const hashedCodes: RecoveryCode[] = [];
  const dbHashes: string[] = [];
  for (const code of codes) {
    const h = await hashCode(code);
    hashedCodes.push({ hash: h, used: false });
    dbHashes.push(h);
  }

  await AsyncStorage.setItem(RECOVERY_CODES_KEY, JSON.stringify(hashedCodes));
  await AsyncStorage.setItem(RECOVERY_SETUP_KEY, "true");

  const adminId = await getAdminId();
  await storeAdminRecoveryCodes(adminId, dbHashes);
  void logAuthEvent(adminId, "recovery_codes_generated", "10 admin recovery codes generated");

  console.log("[AdminOTP] Generated 10 recovery codes, stored hashed versions");
  return codes;
}

export async function verifyRecoveryCode(inputCode: string): Promise<boolean> {
  try {
    const inputHash = await hashCode(inputCode.toUpperCase().trim());
    const adminId = await getAdminId();

    const dbResult = await dbVerifyRecoveryCode(adminId, inputHash);
    if (dbResult) {
      const raw = await AsyncStorage.getItem(RECOVERY_CODES_KEY);
      if (raw) {
        const codes = JSON.parse(raw) as RecoveryCode[];
        for (let i = 0; i < codes.length; i++) {
          if (!codes[i].used && codes[i].hash === inputHash) {
            codes[i].used = true;
            await AsyncStorage.setItem(RECOVERY_CODES_KEY, JSON.stringify(codes));
            break;
          }
        }
      }
      void logAuthEvent(adminId, "recovery_code_used", "Admin recovery code verified and consumed");
      console.log("[AdminOTP] Recovery code verified via Supabase");
      return true;
    }

    const raw = await AsyncStorage.getItem(RECOVERY_CODES_KEY);
    if (!raw) return false;
    const codes = JSON.parse(raw) as RecoveryCode[];

    for (let i = 0; i < codes.length; i++) {
      if (!codes[i].used && codes[i].hash === inputHash) {
        codes[i].used = true;
        await AsyncStorage.setItem(RECOVERY_CODES_KEY, JSON.stringify(codes));
        console.log("[AdminOTP] Recovery code verified via local fallback (index " + i + ")");
        void logAuthEvent(adminId, "recovery_code_used", "Admin recovery code verified (local fallback)");
        return true;
      }
    }

    console.log("[AdminOTP] Recovery code verification failed");
    return false;
  } catch (e) {
    console.error("[AdminOTP] Error verifying recovery code:", e);
    return false;
  }
}

export async function getRemainingRecoveryCodes(): Promise<number> {
  try {
    const adminId = await getAdminId();
    const dbCount = await getRemainingAdminRecoveryCodes(adminId);
    if (dbCount > 0) return dbCount;

    const raw = await AsyncStorage.getItem(RECOVERY_CODES_KEY);
    if (!raw) return 0;
    const codes = JSON.parse(raw) as RecoveryCode[];
    return codes.filter((c) => !c.used).length;
  } catch {
    return 0;
  }
}

export function formatRecoveryCodesForDownload(codes: string[]): string {
  const lines = [
    "PulmoLab Admin Recovery Codes",
    "Generated: " + new Date().toISOString(),
    "========================================",
    "",
    "Each code is single-use. Store these safely.",
    "These codes will NOT be shown again.",
    "",
    ...codes.map((c, i) => `${(i + 1).toString().padStart(2, " ")}. ${c}`),
    "",
    "========================================",
    "If you lose these codes, contact support.",
  ];
  return lines.join("\n");
}
