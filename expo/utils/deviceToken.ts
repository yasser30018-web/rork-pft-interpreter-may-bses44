import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateSecureUUID, hashValue } from "@/utils/supabaseDb";

const DEVICE_TOKEN_KEY = "pulmolab_device_token";
const SESSION_TOKEN_KEY = "pulmolab_session_token";
const TRUST_DURATION_DAYS = 30;

async function secureGet(key: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return AsyncStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  } catch (err) {
    console.error("[DeviceToken] secureGet error:", err);
    return AsyncStorage.getItem(key);
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      await AsyncStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch (err) {
    console.error("[DeviceToken] secureSet error:", err);
    await AsyncStorage.setItem(key, value);
  }
}

async function secureDelete(key: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      await AsyncStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch (err) {
    console.error("[DeviceToken] secureDelete error:", err);
    await AsyncStorage.removeItem(key);
  }
}

export async function getDeviceToken(): Promise<string | null> {
  const token = await secureGet(DEVICE_TOKEN_KEY);
  console.log("[DeviceToken] getDeviceToken:", token ? "found" : "none");
  return token;
}

export async function saveDeviceToken(token: string): Promise<void> {
  console.log("[DeviceToken] saveDeviceToken");
  await secureSet(DEVICE_TOKEN_KEY, token);
}

export async function clearDeviceToken(): Promise<void> {
  console.log("[DeviceToken] clearDeviceToken");
  await secureDelete(DEVICE_TOKEN_KEY);
}

export async function generateDeviceToken(): Promise<string> {
  const token = `dev_${generateSecureUUID()}_${Date.now()}`;
  console.log("[DeviceToken] generateDeviceToken:", token.slice(0, 20) + "...");
  return token;
}

export async function getDeviceTokenHash(): Promise<string | null> {
  const token = await getDeviceToken();
  if (!token) return null;
  return hashValue(token);
}

export async function getSessionToken(): Promise<string | null> {
  const token = await secureGet(SESSION_TOKEN_KEY);
  console.log("[DeviceToken] getSessionToken:", token ? "found" : "none");
  return token;
}

export async function saveSessionToken(token: string): Promise<void> {
  console.log("[DeviceToken] saveSessionToken");
  await secureSet(SESSION_TOKEN_KEY, token);
}

export async function clearSessionToken(): Promise<void> {
  console.log("[DeviceToken] clearSessionToken");
  await secureDelete(SESSION_TOKEN_KEY);
}

export function generateSessionToken(): string {
  const token = `sess_${generateSecureUUID()}_${Date.now()}`;
  console.log("[DeviceToken] generateSessionToken:", token.slice(0, 20) + "...");
  return token;
}

export async function getSessionTokenHash(): Promise<string | null> {
  const token = await getSessionToken();
  if (!token) return null;
  return hashValue(token);
}

export function isDeviceTrusted(
  localToken: string | null,
  storedToken: string | undefined,
  storedTimestamp: string | undefined
): boolean {
  if (!localToken || !storedToken || !storedTimestamp) {
    console.log("[DeviceToken] isDeviceTrusted: missing token or timestamp, not trusted");
    return false;
  }

  if (localToken !== storedToken) {
    console.log("[DeviceToken] isDeviceTrusted: tokens don't match, not trusted");
    return false;
  }

  const trustedAt = new Date(storedTimestamp).getTime();
  const now = Date.now();
  const daysSinceTrust = (now - trustedAt) / (1000 * 60 * 60 * 24);

  if (daysSinceTrust > TRUST_DURATION_DAYS) {
    console.log("[DeviceToken] isDeviceTrusted: trust expired after", Math.floor(daysSinceTrust), "days");
    return false;
  }

  console.log("[DeviceToken] isDeviceTrusted: device is trusted, days since trust:", Math.floor(daysSinceTrust));
  return true;
}

export function isSessionValid(
  localSessionToken: string,
  serverSessionToken: string
): boolean {
  const valid = localSessionToken === serverSessionToken;
  console.log("[DeviceToken] isSessionValid:", valid);
  return valid;
}

export function getDeviceName(): string {
  if (Platform.OS === "ios") return "iOS Device";
  if (Platform.OS === "android") return "Android Device";
  return "Web Browser";
}
