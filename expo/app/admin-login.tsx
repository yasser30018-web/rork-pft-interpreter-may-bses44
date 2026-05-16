import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Shield, Eye, EyeOff, Lock, Mail, Smartphone, ChevronRight, ArrowLeft } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/providers/ThemeProvider";
import { supabase } from "@/lib/supabase";
import { isLockedOut, setOtpExpiry, isRecoverySetupDone, setAdminId, trackAdminOtpSent } from "@/utils/adminOtp";

const ADMIN_SESSION_KEY = "pulmolab_admin_session";
const MAX_OTP_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

type LoginStep = "credentials" | "method_select";

export default function AdminLoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { scaledFont } = useTheme();

  const [step, setStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedMethod, setSelectedMethod] = useState<"email" | "sms" | null>(null);
  const [adminPhone, setAdminPhone] = useState<string>("");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const methodFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    const checkSession = async () => {
      const session = await AsyncStorage.getItem(ADMIN_SESSION_KEY);
      if (session) {
        console.log("Admin session found, redirecting to dashboard");
        router.replace("/admin" as never);
      }
    };
    void checkSession();
  }, [router]);

  const animateMethodStep = useCallback(() => {
    methodFade.setValue(0);
    Animated.timing(methodFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [methodFade]);

  const handleCredentials = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }

    const lockout = await isLockedOut();
    if (lockout.locked) {
      const mins = Math.ceil(lockout.remainingMs / 60000);
      Alert.alert("Account Locked", `Too many failed attempts. Try again in ${mins} minute(s).`);
      return;
    }

    setIsLoading(true);
    try {
      console.log("[AdminLogin] Verifying admin credentials via Supabase");
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        console.error("[AdminLogin] Credential verification failed:", error.message);
        Alert.alert("Access Denied", "Invalid admin credentials.");
        return;
      }

      const userRole = data.user?.user_metadata?.role;
      if (userRole !== "admin" && userRole !== "owner") {
        console.log("[AdminLogin] User is not admin, role:", userRole);
        Alert.alert("Access Denied", "This account does not have admin privileges.");
        await supabase.auth.signOut();
        return;
      }

      if (data.user?.id) {
        await setAdminId(data.user.id);
      }

      const phoneFromMeta = data.user?.user_metadata?.contact_number as string | undefined;
      const formattedPhone = phoneFromMeta?.startsWith("+") ? phoneFromMeta : "+966" + (phoneFromMeta ?? "");
      setAdminPhone(formattedPhone);

      await supabase.auth.signOut();
      console.log("[AdminLogin] Credentials valid, signed out session before OTP step");
      setStep("method_select");
      animateMethodStep();

      if (Platform.OS !== "web") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (err: unknown) {
      console.error("[AdminLogin] Credential check error:", err);
      const message = err instanceof Error ? err.message : "Authentication failed.";
      Alert.alert("Error", message);
    } finally {
      setIsLoading(false);
    }
  }, [email, password, animateMethodStep]);

  const handleSendOtp = useCallback(async (method: "email" | "sms") => {
    setSelectedMethod(method);
    setIsLoading(true);

    try {
      const rateCheck = await trackAdminOtpSent(method);
      if (!rateCheck.allowed) {
        Alert.alert("Rate Limited", "Too many OTP requests. Please wait a few minutes before trying again.");
        setIsLoading(false);
        setSelectedMethod(null);
        return;
      }

      const adminEmail = email.trim();

      let lastError: { message?: string; status?: number } | null = null;
      let otpSent = false;

      for (let attempt = 1; attempt <= MAX_OTP_RETRIES; attempt++) {
        console.log(`[AdminLogin] OTP send attempt ${attempt}/${MAX_OTP_RETRIES} via ${method}`);

        if (method === "email") {
          const { error } = await supabase.auth.signInWithOtp({ email: adminEmail });
          if (!error) {
            otpSent = true;
            break;
          }
          lastError = error;
          console.warn(`[AdminLogin] Email OTP attempt ${attempt} failed:`, error.status, error.message);
        } else {
          const phone = adminPhone?.startsWith("+") ? adminPhone : "+966" + (adminPhone ?? "");
          const { error } = await supabase.auth.signInWithOtp({ phone });
          if (!error) {
            otpSent = true;
            break;
          }
          lastError = error;
          console.warn(`[AdminLogin] SMS OTP attempt ${attempt} failed:`, error.status, error.message);
        }

        const isRetryable = lastError?.status === 504 || lastError?.status === 502 || lastError?.status === 503;
        if (!isRetryable || attempt === MAX_OTP_RETRIES) {
          break;
        }
        console.log(`[AdminLogin] Retrying in ${RETRY_DELAY_MS}ms...`);
        await delay(RETRY_DELAY_MS);
      }

      if (!otpSent) {
        const msg = lastError?.message || "Gateway timeout";
        const status = lastError?.status || "unknown";
        console.error(`[AdminLogin] OTP failed after retries: ${status} - ${msg}`);
        Alert.alert(
          "Error",
          status === 504 || status === 502 || status === 503
            ? "The email service is temporarily unavailable. Please try again in a moment."
            : `Failed to send ${method === "email" ? "email" : "SMS"} code: ${msg}`
        );
        setIsLoading(false);
        setSelectedMethod(null);
        return;
      }

      const expiresAt = await setOtpExpiry();
      console.log("[AdminLogin] OTP sent, expires at:", new Date(expiresAt).toISOString());

      const setupDone = await isRecoverySetupDone();

      router.push({
        pathname: "/admin-otp" as never,
        params: {
          method,
          email: adminEmail,
          phone: adminPhone,
          needsRecoverySetup: setupDone ? "false" : "true",
        },
      });
    } catch (err: unknown) {
      console.error("[AdminLogin] OTP send error:", err);
      const message = err instanceof Error ? err.message : "Failed to send verification code.";
      Alert.alert("Error", message);
    } finally {
      setIsLoading(false);
      setSelectedMethod(null);
    }
  }, [router, email, adminPhone]);

  const handleUseRecoveryCode = useCallback(() => {
    const adminEmail = email.trim();

    router.push({
      pathname: "/admin-otp" as never,
      params: {
        method: "recovery",
        email: adminEmail,
        phone: adminPhone,
        needsRecoverySetup: "false",
      },
    });
  }, [router, email, adminPhone]);

  const maskedEmail = email.trim()
    ? email.trim().replace(
        /^(.{2})(.*)(@.*)$/,
        (_m, a, b, c) => a + (b as string).replace(/./g, "•") + c
      )
    : "ad••••@••••.com";
  const maskedPhone = "+•••••••••••";

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: "#0c1222" }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 }]}>
        <Animated.View style={[styles.inner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.iconWrapper}>
            <View style={styles.shieldBg}>
              <Shield color="#22d3ee" size={40} />
            </View>
          </View>

          {step === "credentials" && (
            <>
              <Text style={[styles.title, { fontSize: scaledFont(26) }]}>Admin Dashboard</Text>
              <Text style={[styles.subtitle, { fontSize: scaledFont(13) }]}>Secure access for application owner only</Text>

              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { fontSize: scaledFont(11) }]}>EMAIL</Text>
                  <View style={styles.inputRow}>
                    <Mail color="#4a5568" size={18} />
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="Enter admin email"
                      placeholderTextColor="#4a5568"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      style={[styles.input, { fontSize: scaledFont(15) }]}
                      testID="admin-email-input"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { fontSize: scaledFont(11) }]}>PASSWORD</Text>
                  <View style={styles.inputRow}>
                    <Lock color="#4a5568" size={18} />
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Enter password"
                      placeholderTextColor="#4a5568"
                      secureTextEntry={!showPassword}
                      style={[styles.input, { fontSize: scaledFont(15) }]}
                      testID="admin-password-input"
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      {showPassword ? <EyeOff color="#64748b" size={18} /> : <Eye color="#64748b" size={18} />}
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => void handleCredentials()}
                  style={[styles.primaryBtn, isLoading && styles.btnDisabled]}
                  activeOpacity={0.8}
                  disabled={isLoading}
                  testID="admin-login-btn"
                >
                  <Text style={[styles.primaryBtnText, { fontSize: scaledFont(15) }]}>
                    Continue to Verification
                  </Text>
                  <ChevronRight color="#fff" size={18} />
                </TouchableOpacity>
              </View>
            </>
          )}

          {step === "method_select" && (
            <Animated.View style={[styles.methodContainer, { opacity: methodFade }]}>
              <TouchableOpacity onPress={() => setStep("credentials")} style={styles.backRow}>
                <ArrowLeft color="#64748b" size={18} />
                <Text style={styles.backText}>Back</Text>
              </TouchableOpacity>

              <Text style={[styles.title, { fontSize: scaledFont(22) }]}>Two-Factor Verification</Text>
              <Text style={[styles.subtitle, { fontSize: scaledFont(13), marginBottom: 28 }]}>
                Choose how to receive your 6-digit code
              </Text>

              <TouchableOpacity
                style={[styles.methodCard, selectedMethod === "email" && styles.methodCardActive]}
                activeOpacity={0.7}
                onPress={() => void handleSendOtp("email")}
                disabled={isLoading}
                testID="admin-otp-method-email"
              >
                <View style={[styles.methodIconBg, { backgroundColor: "rgba(34,211,238,0.1)" }]}>
                  <Mail color="#22d3ee" size={22} />
                </View>
                <View style={styles.methodInfo}>
                  <Text style={styles.methodTitle}>Email</Text>
                  <Text style={styles.methodDesc}>{maskedEmail}</Text>
                </View>
                {isLoading && selectedMethod === "email" ? (
                  <ActivityIndicator color="#22d3ee" size="small" />
                ) : (
                  <ChevronRight color="#4a5568" size={18} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.methodCard, selectedMethod === "sms" && styles.methodCardActive]}
                activeOpacity={0.7}
                onPress={() => void handleSendOtp("sms")}
                disabled={isLoading}
                testID="admin-otp-method-sms"
              >
                <View style={[styles.methodIconBg, { backgroundColor: "rgba(16,185,129,0.1)" }]}>
                  <Smartphone color="#10b981" size={22} />
                </View>
                <View style={styles.methodInfo}>
                  <Text style={styles.methodTitle}>SMS</Text>
                  <Text style={styles.methodDesc}>{maskedPhone}</Text>
                </View>
                {isLoading && selectedMethod === "sms" ? (
                  <ActivityIndicator color="#10b981" size="small" />
                ) : (
                  <ChevronRight color="#4a5568" size={18} />
                )}
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.recoveryBtn}
                activeOpacity={0.7}
                onPress={() => handleUseRecoveryCode()}
                disabled={isLoading}
                testID="admin-use-recovery-code"
              >
                <Lock color="#f59e0b" size={16} />
                <Text style={styles.recoveryBtnText}>Use Recovery Code</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  inner: { alignItems: "center" },
  iconWrapper: { marginBottom: 28 },
  shieldBg: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "rgba(34,211,238,0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(34,211,238,0.2)",
  },
  title: { color: "#e8eaf0", fontWeight: "800" as const, letterSpacing: -0.5, textAlign: "center" as const },
  subtitle: { color: "#64748b", marginTop: 8, marginBottom: 36, textAlign: "center" as const },
  form: { width: "100%" },
  inputGroup: { marginBottom: 20 },
  inputLabel: { color: "#64748b", fontWeight: "700" as const, letterSpacing: 2, marginBottom: 8 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1a1d27",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#2a2e3d",
  },
  input: { flex: 1, color: "#e8eaf0", fontWeight: "500" as const },
  primaryBtn: {
    backgroundColor: "#0d9488",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" as const },
  btnDisabled: { opacity: 0.6 },
  methodContainer: { width: "100%", alignItems: "center" },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginBottom: 20,
    paddingVertical: 4,
  },
  backText: { color: "#64748b", fontSize: 14, fontWeight: "500" as const },
  methodCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#1a1d27",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: "#2a2e3d",
    marginBottom: 12,
  },
  methodCardActive: {
    borderColor: "#22d3ee",
    backgroundColor: "rgba(34,211,238,0.04)",
  },
  methodIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  methodInfo: { flex: 1 },
  methodTitle: { color: "#e8eaf0", fontSize: 16, fontWeight: "700" as const },
  methodDesc: { color: "#64748b", fontSize: 12, marginTop: 2 },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginVertical: 16,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#2a2e3d" },
  dividerText: { color: "#4a5568", fontSize: 11, fontWeight: "700" as const, letterSpacing: 2 },
  recoveryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: "rgba(245,158,11,0.08)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.2)",
  },
  recoveryBtnText: { color: "#f59e0b", fontSize: 14, fontWeight: "600" as const },
});
