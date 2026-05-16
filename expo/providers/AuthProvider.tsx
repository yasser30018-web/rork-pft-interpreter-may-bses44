import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import createContextHook from "@nkzw/create-context-hook";
import { supabase } from "@/lib/supabase";
import type { UserProfile, SubscriptionInfo } from "@/types/user";
import type { Session, AuthError } from "@supabase/supabase-js";
import {
  getDeviceToken,
  saveDeviceToken,
  clearDeviceToken,
  generateDeviceToken,
  getSessionToken,
  saveSessionToken,
  clearSessionToken,
  generateSessionToken,
  isDeviceTrusted,
  getDeviceName,
} from "@/utils/deviceToken";
import {
  hashValue,
  createUserSession,
  validateUserSession,
  checkDeviceTrusted,
  invalidateAllUserSessions,
  createUserOtpRecord,
  markUserOtpUsed,
  upsertUserRecord,
  markUserVerified,
  logAuthEvent,
  generateSecureRandom,
  isUserVerified,
  checkUserLoginLockout,
  sendSessionTerminationNotification,
  upsertSubscriptionRecord,
  fetchSubscriptionForUser,
} from "@/utils/supabaseDb";
import { ensurePublicUserRow } from "@/utils/secondOpinionApi";

const PROFILE_KEY = "pulmolab_auth_profile";
const SUB_KEY = "pulmolab_subscription";

const DEFAULT_SUBSCRIPTION: SubscriptionInfo = {
  status: "none",
  planId: null,
  expiresAt: null,
  trialEndsAt: null,
};

export interface DeviceCheckResult {
  trusted: boolean;
  requiresOtp: boolean;
  otpMethod: "email" | "sms";
  email?: string;
  phone?: string;
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [subscription, setSubscription] = useState<SubscriptionInfo>(DEFAULT_SUBSCRIPTION);
  const [sessionLoading, setSessionLoading] = useState<boolean>(true);
  const [requiresDeviceOtp, setRequiresDeviceOtp] = useState<boolean>(false);
  const [sessionKicked, setSessionKicked] = useState<boolean>(false);
  const appStateRef = useRef(AppState.currentState);
  const sessionCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    console.log("[Auth] Initializing Supabase session listener");

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      console.log("[Auth] Initial session:", currentSession ? "found" : "none");
      setSession(currentSession);
      setSessionLoading(false);
    }).catch((err) => {
      console.error("[Auth] Error getting initial session:", err);
      setSessionLoading(false);
    });

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        console.log("[Auth] Auth state changed:", _event, newSession ? "session exists" : "no session");
        setSession(newSession);
        if (!newSession) {
          setUser(null);
          setIsAuthenticated(false);
          setRequiresDeviceOtp(false);
        }
      }
    );

    return () => {
      authSub.unsubscribe();
    };
  }, []);

  const forceLogout = useCallback(async () => {
    console.log("[Auth] Force logout triggered");
    try {
      if (session?.user?.id) {
        await invalidateAllUserSessions(session.user.id);
        void logAuthEvent(session.user.id, "session_terminated", "Force logout - all sessions invalidated");
      }
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[Auth] Force logout sign out error:", err);
    }
    await AsyncStorage.removeItem(PROFILE_KEY);
    await clearSessionToken();
    setUser(null);
    setIsAuthenticated(false);
    setSession(null);
    setRequiresDeviceOtp(false);
    queryClient.clear();
  }, [queryClient, session]);

  const validateSessionOnServer = useCallback(async () => {
    if (!session?.user) return;
    try {
      const localSessionToken = await getSessionToken();
      if (!localSessionToken) return;

      const sessionHash = await hashValue(localSessionToken);
      const isValid = await validateUserSession(session.user.id, sessionHash);

      if (!isValid) {
        console.log("[Auth] Session invalidated on server - another device logged in");
        setSessionKicked(true);
        void sendSessionTerminationNotification(
          session.user.id,
          session.user.email ?? ""
        );
        void logAuthEvent(session.user.id, "session_kicked", "Session terminated by new device login");
        await forceLogout();
        return;
      }

      const { data: userData, error } = await supabase.auth.getUser();
      if (error) {
        console.error("[Auth] Session validation error:", error.message);
        const msg = error.message.toLowerCase();
        if (
          msg.includes("401") ||
          msg.includes("invalid") ||
          msg.includes("jwt") ||
          msg.includes("token") ||
          msg.includes("expired") ||
          msg.includes("not authorized")
        ) {
          console.log("[Auth] Session invalidated by Supabase auth (401)");
          setSessionKicked(true);
          void logAuthEvent(session.user.id, "session_expired_401", `Auth error: ${error.message}`);
          await forceLogout();
        }
        return;
      }

      const storedSessionToken = userData?.user?.user_metadata?.active_session_token;
      if (storedSessionToken && localSessionToken !== storedSessionToken) {
        console.log("[Auth] Session was replaced by another device login (metadata check)");
        setSessionKicked(true);
        void sendSessionTerminationNotification(
          session.user.id,
          session.user.email ?? ""
        );
        void logAuthEvent(session.user.id, "session_kicked", "Session replaced by another device (metadata)");
        await forceLogout();
      }
    } catch (err) {
      console.error("[Auth] Error validating session:", err);
    }
  }, [session, forceLogout]);

  useEffect(() => {
    if (!isAuthenticated || !session || requiresDeviceOtp) return;

    const handleAppStateChange = (nextAppState: string) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === "active") {
        console.log("[Auth] App returned to foreground, validating session");
        void validateSessionOnServer();
      }
      appStateRef.current = nextAppState as typeof appStateRef.current;
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);

    sessionCheckIntervalRef.current = setInterval(() => {
      void validateSessionOnServer();
    }, 60000);

    return () => {
      sub.remove();
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }
    };
  }, [isAuthenticated, session, requiresDeviceOtp, validateSessionOnServer]);

  const profileQuery = useQuery({
    queryKey: ["auth-profile", session?.user?.id],
    queryFn: async () => {
      if (!session?.user) return null;
      const stored = await AsyncStorage.getItem(PROFILE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as UserProfile;
        if (parsed.id === session.user.id) {
          return parsed;
        }
      }
      const fallback: UserProfile = {
        id: session.user.id,
        fullName: session.user.user_metadata?.full_name ?? session.user.email?.split("@")[0] ?? "User",
        nationalId: session.user.user_metadata?.national_id ?? "",
        medicalSpecialty: session.user.user_metadata?.specialty ?? "",
        role: session.user.user_metadata?.role ?? "Resident",
        contactNumber: session.user.user_metadata?.contact_number ?? "",
        profileImageUri: null,
        email: session.user.email ?? "",
      };
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(fallback));
      return fallback;
    },
    enabled: !!session?.user && !requiresDeviceOtp,
  });

  const subQuery = useQuery({
    queryKey: ["subscription-info", session?.user?.id],
    queryFn: async () => {
      if (session?.user?.id) {
        console.log("[Auth] Fetching subscription from database for user:", session.user.id);
        const result = await fetchSubscriptionForUser(session.user.id);
        if (result.data) {
          const sub: SubscriptionInfo = {
            status: (result.data.status as SubscriptionInfo["status"]) ?? "none",
            planId: result.data.plan_id,
            expiresAt: result.data.expires_at,
            trialEndsAt: result.data.trial_ends_at,
          };
          await AsyncStorage.setItem(SUB_KEY, JSON.stringify(sub));
          console.log("[Auth] Subscription loaded from DB:", sub.status);
          return sub;
        }
      }
      const stored = await AsyncStorage.getItem(SUB_KEY);
      if (stored) {
        return JSON.parse(stored) as SubscriptionInfo;
      }
      return DEFAULT_SUBSCRIPTION;
    },
  });

  useEffect(() => {
    if (profileQuery.data !== undefined && !requiresDeviceOtp) {
      setUser(profileQuery.data);
      setIsAuthenticated(profileQuery.data !== null);
    }
  }, [profileQuery.data, requiresDeviceOtp]);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || requiresDeviceOtp) return;
    void ensurePublicUserRow(uid).catch((err) => {
      console.error("[Auth] ensurePublicUserRow failed:", err);
    });
  }, [session?.user?.id, requiresDeviceOtp]);

  useEffect(() => {
    if (!session) {
      setUser(null);
      setIsAuthenticated(false);
    }
  }, [session]);

  useEffect(() => {
    if (subQuery.data) {
      setSubscription(subQuery.data);
    }
  }, [subQuery.data]);

  const saveProfileMutation = useMutation({
    mutationFn: async (profile: UserProfile) => {
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      return profile;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(["auth-profile", profile.id], profile);
    },
  });

  const saveSubMutation = useMutation({
    mutationFn: async (sub: SubscriptionInfo) => {
      await AsyncStorage.setItem(SUB_KEY, JSON.stringify(sub));
      if (session?.user?.id) {
        console.log("[Auth] Syncing subscription to database, status:", sub.status);
        const result = await upsertSubscriptionRecord(
          session.user.id,
          sub.status,
          sub.planId,
          sub.expiresAt,
          sub.trialEndsAt
        );
        if (!result.success) {
          console.error("[Auth] Failed to sync subscription to DB:", result.error);
        }
      }
      return sub;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["subscription-info"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
    },
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      console.log("[Auth] Signing in with email:", email);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        void logAuthEvent(null, "login_failed", `Failed login attempt for ${email}: ${error.message}`);
        throw error;
      }

      if (data.user) {
        const lockout = await checkUserLoginLockout(data.user.id);
        if (lockout.locked) {
          await supabase.auth.signOut();
          const mins = Math.ceil(lockout.remainingSeconds / 60);
          throw new Error(`Account temporarily locked. Too many failed attempts. Try again in ${mins} minute(s).`);
        }

        const verified = await isUserVerified(data.user.id);
        if (!verified) {
          console.log("[Auth] User not verified, blocking login");
          await supabase.auth.signOut();
          void logAuthEvent(data.user.id, "login_blocked_unverified", `Unverified account login blocked: ${email}`);
          throw new Error("Your account has not been verified. Please complete email/SMS verification first.");
        }
      }

      void logAuthEvent(data.user?.id ?? null, "login_attempt", `Email login for ${email}`);
      return data;
    },
  });

  const signUpMutation = useMutation({
    mutationFn: async ({
      email,
      password,
      metadata,
    }: {
      email: string;
      password: string;
      metadata: Record<string, string>;
    }) => {
      console.log("[Auth] Signing up with email:", email);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata },
      });
      console.log("[Auth] SignUp response - data:", JSON.stringify(data, null, 2));
      if (error) {
        console.error("[Auth] SignUp error:", error.message, error.status);
        throw error;
      }
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        throw new Error("An account with this email already exists. Please sign in instead.");
      }
      if (!data.user) {
        throw new Error("Sign up failed. No user was returned. Please try again.");
      }

      await upsertUserRecord(
        data.user.id,
        metadata.full_name ?? "",
        email,
        metadata.contact_number || null,
        "email",
        false
      );

      void logAuthEvent(data.user.id, "signup", `New user signup: ${email}`);
      console.log("[Auth] SignUp successful, user id:", data.user.id);
      return data;
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async ({ email, token }: { email: string; token: string }) => {
      console.log("[Auth] Verifying OTP for:", email);
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "signup",
      });
      if (error) {
        console.error("[Auth] VerifyOTP error:", error.message, error.status);
        throw error;
      }

      if (data.user) {
        await markUserVerified(data.user.id);
        await markUserOtpUsed(data.user.id);
        void logAuthEvent(data.user.id, "otp_verified", "Email OTP verified for signup");
      }

      return data;
    },
  });

  const resendOtpMutation = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      console.log("[Auth] Resending OTP to:", email);
      const { data, error } = await supabase.auth.resend({
        type: "signup",
        email,
      });
      if (error) {
        console.error("[Auth] Resend OTP error:", error.message, error.status);
        throw error;
      }
      return data;
    },
  });

  const phoneOtpMutation = useMutation({
    mutationFn: async ({ phone }: { phone: string }) => {
      console.log("[Auth] Sending phone OTP to:", phone);
      const { data, error } = await supabase.auth.signInWithOtp({ phone });
      if (error) {
        console.error("[Auth] Phone OTP error:", error.message, error.status);
        throw error;
      }
      return data;
    },
  });

  const verifyPhoneOtpMutation = useMutation({
    mutationFn: async ({ phone, token }: { phone: string; token: string }) => {
      console.log("[Auth] Verifying phone OTP for:", phone);
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: "sms",
      });
      if (error) {
        console.error("[Auth] Verify phone OTP error:", error.message, error.status);
        throw error;
      }

      if (data.user) {
        await markUserOtpUsed(data.user.id);
        void logAuthEvent(data.user.id, "otp_verified", "SMS OTP verified");
      }

      return data;
    },
  });

  const resendPhoneOtpMutation = useMutation({
    mutationFn: async ({ phone }: { phone: string }) => {
      console.log("[Auth] Resending phone OTP to:", phone);
      const { data, error } = await supabase.auth.signInWithOtp({ phone });
      if (error) {
        console.error("[Auth] Resend phone OTP error:", error.message, error.status);
        throw error;
      }
      return data;
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      console.log("[Auth] Signing out");
      if (session?.user?.id) {
        await invalidateAllUserSessions(session.user.id);
        void logAuthEvent(session.user.id, "logout", "User signed out");
      }
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      await AsyncStorage.removeItem(PROFILE_KEY);
      await clearDeviceToken();
      await clearSessionToken();
    },
    onSuccess: () => {
      setUser(null);
      setIsAuthenticated(false);
      setSession(null);
      setRequiresDeviceOtp(false);
      queryClient.clear();
    },
  });

  const activateSessionTokens = useCallback(
    async (userId: string): Promise<{ sessionToken: string; deviceToken: string }> => {
      const newSessionToken = generateSessionToken();
      await saveSessionToken(newSessionToken);

      const newDeviceToken = await generateDeviceToken();
      await saveDeviceToken(newDeviceToken);

      const sessionHash = await hashValue(newSessionToken);
      const deviceHash = await hashValue(newDeviceToken);
      const deviceName = getDeviceName();

      await createUserSession(userId, sessionHash, deviceHash, deviceName);

      await supabase.auth.updateUser({
        data: {
          trusted_device_token: newDeviceToken,
          trusted_device_at: new Date().toISOString(),
          active_session_token: newSessionToken,
          last_login_at: new Date().toISOString(),
        },
      });

      void logAuthEvent(userId, "session_created", `New session created on ${deviceName}`);

      return { sessionToken: newSessionToken, deviceToken: newDeviceToken };
    },
    []
  );

  const checkDeviceAndLogin = useCallback(
    async (email: string, password: string): Promise<DeviceCheckResult> => {
      console.log("[Auth] Device-based login check for:", email);

      const loginData = await loginMutation.mutateAsync({ email, password });
      const userData = loginData.user;

      if (!userData) {
        throw new Error("Login failed. No user returned.");
      }

      const previousEmail = userData.email ?? email;
      void sendSessionTerminationNotification(userData.id, previousEmail);

      const localDeviceToken = await getDeviceToken();
      const storedDeviceToken = userData.user_metadata?.trusted_device_token as string | undefined;
      const storedDeviceTimestamp = userData.user_metadata?.trusted_device_at as string | undefined;
      const _contactNumber = userData.user_metadata?.contact_number as string | undefined;

      let trusted = isDeviceTrusted(localDeviceToken, storedDeviceToken, storedDeviceTimestamp);

      if (trusted && localDeviceToken) {
        const deviceHash = await hashValue(localDeviceToken);
        const dbTrusted = await checkDeviceTrusted(userData.id, deviceHash);
        trusted = dbTrusted;
        if (!dbTrusted) {
          console.log("[Auth] Device not trusted in Supabase DB, falling back to metadata check");
          trusted = false;
        }
      }

      if (trusted) {
        console.log("[Auth] Device is trusted, granting access directly");
        await activateSessionTokens(userData.id);

        setRequiresDeviceOtp(false);
        return {
          trusted: true,
          requiresOtp: false,
          otpMethod: "email",
          email: userData.email,
        };
      }

      console.log("[Auth] Device not recognized, OTP required");
      setRequiresDeviceOtp(true);

      const otpTrackingHash = await hashValue(`device_otp_${Date.now()}_${generateSecureRandom(8)}`);
      await createUserOtpRecord(userData.id, "email", otpTrackingHash);

      console.log("[Auth] Sending device OTP via email to:", userData.email);
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: userData.email ?? email,
      });
      if (otpError) {
        console.error("[Auth] Error sending device OTP email:", otpError.message);
      }
      void logAuthEvent(userData.id, "device_otp_sent", `Device OTP sent via email`);

      return {
        trusted: false,
        requiresOtp: true,
        otpMethod: "email",
        email: userData.email,
      };
    },
    [loginMutation, activateSessionTokens]
  );

  const completeDeviceOtpVerification = useCallback(
    async (otpCode: string, method: "email" | "sms", contact: string) => {
      console.log("[Auth] Completing device OTP verification, method:", method, "contact:", contact);

      let verifyResult;
      if (method === "sms") {
        const { data, error } = await supabase.auth.verifyOtp({
          phone: contact,
          token: otpCode,
          type: "sms",
        });
        if (error) throw error;
        verifyResult = data;
      } else {
        const { data, error } = await supabase.auth.verifyOtp({
          email: contact,
          token: otpCode,
          type: "email",
        });
        if (error) throw error;
        verifyResult = data;
      }

      console.log("[Auth] Device OTP verified successfully");

      const userId = verifyResult.user?.id ?? session?.user?.id;
      if (userId) {
        await activateSessionTokens(userId);
        await markUserOtpUsed(userId);
        void logAuthEvent(userId, "device_verified", `Device verified via ${method} OTP`);
      }

      setRequiresDeviceOtp(false);
      console.log("[Auth] Device registered and session activated");

      return verifyResult;
    },
    [session, activateSessionTokens]
  );

  const resendDeviceOtp = useCallback(
    async (method: "email" | "sms", contact: string) => {
      console.log("[Auth] Resending device OTP via", method, "to:", contact);
      if (method === "sms") {
        const { error } = await supabase.auth.signInWithOtp({ phone: contact });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({ email: contact });
        if (error) throw error;
      }
      console.log("[Auth] Device OTP resent successfully");
    },
    []
  );

  const dismissSessionKicked = useCallback(() => {
    setSessionKicked(false);
  }, []);

  const verifyOtp = useCallback(
    async (email: string, token: string) => {
      return verifyOtpMutation.mutateAsync({ email, token });
    },
    [verifyOtpMutation]
  );

  const resendOtp = useCallback(
    async (email: string) => {
      return resendOtpMutation.mutateAsync({ email });
    },
    [resendOtpMutation]
  );

  const sendPhoneOtp = useCallback(
    async (phone: string) => {
      return phoneOtpMutation.mutateAsync({ phone });
    },
    [phoneOtpMutation]
  );

  const verifyPhoneOtp = useCallback(
    async (phone: string, token: string) => {
      return verifyPhoneOtpMutation.mutateAsync({ phone, token });
    },
    [verifyPhoneOtpMutation]
  );

  const resendPhoneOtp = useCallback(
    async (phone: string) => {
      return resendPhoneOtpMutation.mutateAsync({ phone });
    },
    [resendPhoneOtpMutation]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      return loginMutation.mutateAsync({ email, password });
    },
    [loginMutation]
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      metadata: Record<string, string>
    ) => {
      return signUpMutation.mutateAsync({ email, password, metadata });
    },
    [signUpMutation]
  );

  const logout = useCallback(async () => {
    return logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const updateProfile = useCallback(
    (updates: Partial<UserProfile>) => {
      if (!user) return;
      const updated = { ...user, ...updates };
      setUser(updated);
      saveProfileMutation.mutate(updated);
    },
    [user, saveProfileMutation]
  );

  const updateProfileImage = useCallback(
    (uri: string | null) => {
      if (!user) return;
      const updated = { ...user, profileImageUri: uri };
      setUser(updated);
      saveProfileMutation.mutate(updated);
    },
    [user, saveProfileMutation]
  );

  const updateSubscription = useCallback(
    (sub: SubscriptionInfo) => {
      setSubscription(sub);
      saveSubMutation.mutate(sub);
    },
    [saveSubMutation]
  );

  const resetLoginError = useCallback(() => {
    loginMutation.reset();
  }, [loginMutation]);

  const resetSignUpError = useCallback(() => {
    signUpMutation.reset();
  }, [signUpMutation]);

  const resetVerifyOtpError = useCallback(() => {
    verifyOtpMutation.reset();
  }, [verifyOtpMutation]);

  const resetPhoneOtpError = useCallback(() => {
    phoneOtpMutation.reset();
  }, [phoneOtpMutation]);

  const resetVerifyPhoneOtpError = useCallback(() => {
    verifyPhoneOtpMutation.reset();
  }, [verifyPhoneOtpMutation]);

  return useMemo(
    () => ({
      user,
      session,
      isAuthenticated: isAuthenticated && !requiresDeviceOtp,
      subscription,
      isLoading: sessionLoading || profileQuery.isLoading,
      loginLoading: loginMutation.isPending,
      signUpLoading: signUpMutation.isPending,
      logoutLoading: logoutMutation.isPending,
      verifyOtpLoading: verifyOtpMutation.isPending,
      resendOtpLoading: resendOtpMutation.isPending,
      loginError: loginMutation.error as AuthError | null,
      signUpError: signUpMutation.error as AuthError | null,
      verifyOtpError: verifyOtpMutation.error as AuthError | null,
      phoneOtpLoading: phoneOtpMutation.isPending,
      verifyPhoneOtpLoading: verifyPhoneOtpMutation.isPending,
      resendPhoneOtpLoading: resendPhoneOtpMutation.isPending,
      phoneOtpError: phoneOtpMutation.error as AuthError | null,
      verifyPhoneOtpError: verifyPhoneOtpMutation.error as AuthError | null,
      requiresDeviceOtp,
      sessionKicked,
      login,
      signUp,
      verifyOtp,
      resendOtp,
      sendPhoneOtp,
      verifyPhoneOtp,
      resendPhoneOtp,
      logout,
      updateProfile,
      updateProfileImage,
      updateSubscription,
      resetLoginError,
      resetSignUpError,
      resetVerifyOtpError,
      resetPhoneOtpError,
      resetVerifyPhoneOtpError,
      checkDeviceAndLogin,
      completeDeviceOtpVerification,
      resendDeviceOtp,
      dismissSessionKicked,
      forceLogout,
    }),
    [
      user,
      session,
      isAuthenticated,
      requiresDeviceOtp,
      subscription,
      sessionLoading,
      profileQuery.isLoading,
      loginMutation.isPending,
      signUpMutation.isPending,
      logoutMutation.isPending,
      verifyOtpMutation.isPending,
      resendOtpMutation.isPending,
      loginMutation.error,
      signUpMutation.error,
      verifyOtpMutation.error,
      phoneOtpMutation.isPending,
      verifyPhoneOtpMutation.isPending,
      resendPhoneOtpMutation.isPending,
      phoneOtpMutation.error,
      verifyPhoneOtpMutation.error,
      sessionKicked,
      login,
      signUp,
      verifyOtp,
      resendOtp,
      sendPhoneOtp,
      verifyPhoneOtp,
      resendPhoneOtp,
      logout,
      updateProfile,
      updateProfileImage,
      updateSubscription,
      resetLoginError,
      resetSignUpError,
      resetVerifyOtpError,
      resetPhoneOtpError,
      resetVerifyPhoneOtpError,
      checkDeviceAndLogin,
      completeDeviceOtpVerification,
      resendDeviceOtp,
      dismissSessionKicked,
      forceLogout,
    ]
  );
});
