import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ShieldCheck, ArrowLeft, RefreshCw, Mail, Smartphone, KeyRound, Clock, AlertTriangle } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import {
  isLockedOut,
  recordFailedAttempt,
  resetLockout,
  getOtpExpiry,
  setOtpExpiry,
  verifyRecoveryCode,
  onAdminOtpSuccess,
  trackAdminOtpSent,
} from "@/utils/adminOtp";

const OTP_LENGTH = 6;
const ADMIN_SESSION_KEY = "pulmolab_admin_session";
const RESEND_COOLDOWN = 60;

export default function AdminOTPScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    method: string;
    email: string;
    phone: string;
    needsRecoverySetup: string;
  }>();

  const method = (params.method ?? "email") as "email" | "sms" | "recovery";
  const email = params.email ?? "";
  const phone = params.phone ?? "";
  const needsRecoverySetup = params.needsRecoverySetup === "true";

  const [mode, setMode] = useState<"otp" | "recovery">(method === "recovery" ? "recovery" : "otp");
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [recoveryInput, setRecoveryInput] = useState<string>("");
  const [resendCountdown, setResendCountdown] = useState<number>(RESEND_COOLDOWN);
  const [expiryCountdown, setExpiryCountdown] = useState<number>(300);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isResending, setIsResending] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [lockRemainingMs, setLockRemainingMs] = useState<number>(0);
  const [attemptsLeft, setAttemptsLeft] = useState<number>(3);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [fadeAnim]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  useEffect(() => {
    const checkLock = async () => {
      const lockState = await isLockedOut();
      if (lockState.locked) {
        setIsLocked(true);
        setLockRemainingMs(lockState.remainingMs);
      }
    };
    void checkLock();
  }, []);

  useEffect(() => {
    if (!isLocked || lockRemainingMs <= 0) return;
    const timer = setInterval(() => {
      setLockRemainingMs((prev) => {
        if (prev <= 1000) {
          setIsLocked(false);
          setAttemptsLeft(3);
          clearInterval(timer);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isLocked, lockRemainingMs]);

  useEffect(() => {
    const initExpiry = async () => {
      if (mode === "otp") {
        const expiresAt = await getOtpExpiry();
        const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
        setExpiryCountdown(remaining);
      }
    };
    void initExpiry();
  }, [mode]);

  useEffect(() => {
    if (expiryCountdown <= 0 || mode !== "otp") return;
    const timer = setInterval(() => setExpiryCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [expiryCountdown, mode]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  useEffect(() => {
    if (mode === "otp") {
      setTimeout(() => inputRefs.current[0]?.focus(), 600);
    }
  }, [mode]);

  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, []);

  const formatLockTime = useCallback((ms: number) => {
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, []);

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleSuccess = useCallback(async () => {
    if (Platform.OS !== "web") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    await resetLockout();
    await AsyncStorage.setItem(
      ADMIN_SESSION_KEY,
      JSON.stringify({ loggedIn: true, at: new Date().toISOString() })
    );
    console.log("[AdminOTP] Admin verified, redirecting");

    if (needsRecoverySetup) {
      router.replace("/admin-recovery-setup" as never);
    } else if (mode === "recovery") {
      Alert.alert(
        "Security Notice",
        "You used a recovery code to sign in. Please verify your email/phone settings are up to date.",
        [{ text: "Continue", onPress: () => router.replace("/admin" as never) }]
      );
    } else {
      router.replace("/admin" as never);
    }
  }, [needsRecoverySetup, mode, router]);

  const handleFailure = useCallback(async () => {
    if (Platform.OS !== "web") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    triggerShake();

    const result = await recordFailedAttempt();
    if (result.locked) {
      setIsLocked(true);
      setLockRemainingMs(15 * 60 * 1000);
      Alert.alert("Account Locked", "Too many failed attempts. Your account is locked for 15 minutes.");
    } else {
      setAttemptsLeft(result.attemptsLeft);
      Alert.alert("Verification Failed", `Invalid code. ${result.attemptsLeft} attempt(s) remaining.`);
    }
  }, [triggerShake]);

  const handleVerifyOtp = useCallback(async (code: string) => {
    if (isLocked || isVerifying) return;
    if (expiryCountdown <= 0) {
      Alert.alert("Code Expired", "Your verification code has expired. Please request a new one.");
      return;
    }

    console.log("[AdminOTP] Verifying OTP code, method:", method);
    setIsVerifying(true);

    try {
      if (method === "email") {
        const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
        console.log("[AdminOTP] Email verify response:", JSON.stringify(data, null, 2));
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: "sms" });
        console.log("[AdminOTP] SMS verify response:", JSON.stringify(data, null, 2));
        if (error) throw error;
      }

      await onAdminOtpSuccess();
      await handleSuccess();
    } catch (err: unknown) {
      console.error("[AdminOTP] Verification failed:", err);
      setOtp(Array(OTP_LENGTH).fill(""));
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
      await handleFailure();
    } finally {
      setIsVerifying(false);
    }
  }, [email, phone, method, isLocked, isVerifying, expiryCountdown, handleSuccess, handleFailure]);

  const handleVerifyRecovery = useCallback(async () => {
    if (isLocked || isVerifying) return;
    const code = recoveryInput.trim();
    if (!code) {
      Alert.alert("Error", "Please enter a recovery code.");
      return;
    }

    console.log("[AdminOTP] Verifying recovery code");
    setIsVerifying(true);

    try {
      const valid = await verifyRecoveryCode(code);
      if (valid) {
        await handleSuccess();
      } else {
        setRecoveryInput("");
        await handleFailure();
      }
    } catch (err: unknown) {
      console.error("[AdminOTP] Recovery verification error:", err);
      await handleFailure();
    } finally {
      setIsVerifying(false);
    }
  }, [recoveryInput, isLocked, isVerifying, handleSuccess, handleFailure]);

  const handleOtpChange = useCallback(
    (text: string, index: number) => {
      if (isLocked || isVerifying) return;
      const newOtp = [...otp];
      newOtp[index] = text.slice(-1);
      setOtp(newOtp);

      if (text && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      if (newOtp.every((d) => d !== "") && newOtp.join("").length === OTP_LENGTH) {
        setTimeout(() => void handleVerifyOtp(newOtp.join("")), 200);
      }
    },
    [otp, isLocked, isVerifying, handleVerifyOtp]
  );

  const handleKeyPress = useCallback(
    (index: number, key: string) => {
      if (key === "Backspace" && otp[index] === "" && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = "";
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      }
    },
    [otp]
  );

  const handleResend = useCallback(async () => {
    if (resendCountdown > 0 || isResending || isLocked) return;

    setIsResending(true);
    try {
      const channel = method === "sms" ? "sms" as const : "email" as const;
      const rateCheck = await trackAdminOtpSent(channel);
      if (!rateCheck.allowed) {
        Alert.alert("Rate Limited", "Too many OTP requests. Please wait before trying again.");
        setIsResending(false);
        return;
      }

      if (method === "email") {
        console.log("[AdminOTP] Resending email OTP to:", email);
        const { error } = await supabase.auth.signInWithOtp({ email });
        if (error) throw error;
      } else {
        console.log("[AdminOTP] Resending SMS OTP to:", phone);
        const { error } = await supabase.auth.signInWithOtp({ phone });
        if (error) throw error;
      }

      const expiresAt = await setOtpExpiry();
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setExpiryCountdown(remaining);
      setResendCountdown(RESEND_COOLDOWN);
      setOtp(Array(OTP_LENGTH).fill(""));

      if (Platform.OS !== "web") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      Alert.alert("Code Sent", `A new code has been sent via ${method === "email" ? "email" : "SMS"}.`);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      console.error("[AdminOTP] Resend failed:", err);
      const message = err instanceof Error ? err.message : "Failed to resend code.";
      Alert.alert("Error", message);
    } finally {
      setIsResending(false);
    }
  }, [resendCountdown, email, phone, method, isResending, isLocked]);

  const methodIcon = method === "sms" ? Smartphone : Mail;
  const methodLabel = method === "sms" ? "SMS" : "Email";
  const maskedTarget = method === "sms"
    ? phone.replace(/(\+\d{1})(\d{6})(\d{4})/, "$1••••••$3")
    : email.replace(/^(.{2})(.*)(@.*)$/, (_m, a, b, c) => a + (b as string).replace(/./g, "•") + c);

  const expiryColor = expiryCountdown > 120 ? "#22d3ee" : expiryCountdown > 60 ? "#f59e0b" : "#ef4444";
  const MethodIcon = methodIcon;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="admin-otp-back">
          <ArrowLeft color="#64748b" size={22} />
        </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
          <View style={styles.iconWrapper}>
            <Animated.View style={[styles.shieldBg, { transform: [{ scale: pulseAnim }] }]}>
              <ShieldCheck color="#22d3ee" size={40} />
            </Animated.View>
          </View>

          {mode === "otp" && (
            <>
              <Text style={styles.title}>Admin Verification</Text>
              <View style={styles.methodBadge}>
                <MethodIcon color={method === "sms" ? "#10b981" : "#22d3ee"} size={14} />
                <Text style={styles.methodBadgeText}>via {methodLabel}</Text>
              </View>
              <Text style={styles.subtitle}>Enter the 6-digit code sent to</Text>
              <Text style={styles.targetText}>{maskedTarget}</Text>

              <View style={[styles.expiryBadge, { backgroundColor: expiryColor + "14", borderColor: expiryColor + "30" }]}>
                <Clock color={expiryColor} size={14} />
                <Text style={[styles.expiryText, { color: expiryColor }]}>
                  {expiryCountdown > 0 ? `Code expires in ${formatTime(expiryCountdown)}` : "Code expired — request a new one"}
                </Text>
              </View>

              {isLocked && (
                <View style={styles.lockedBanner}>
                  <AlertTriangle color="#ef4444" size={16} />
                  <View style={styles.lockedTextWrap}>
                    <Text style={styles.lockedTitle}>Account Locked</Text>
                    <Text style={styles.lockedDesc}>
                      Too many failed attempts. Try again in {formatLockTime(lockRemainingMs)}
                    </Text>
                  </View>
                </View>
              )}

              {!isLocked && attemptsLeft < 3 && (
                <View style={styles.warningBadge}>
                  <AlertTriangle color="#f59e0b" size={13} />
                  <Text style={styles.warningText}>
                    {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining before lockout
                  </Text>
                </View>
              )}

              <Animated.View style={[styles.otpRow, { transform: [{ translateX: shakeAnim }] }]}>
                {otp.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={(ref) => { inputRefs.current[i] = ref; }}
                    value={digit}
                    onChangeText={(text) => handleOtpChange(text, i)}
                    onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
                    keyboardType="number-pad"
                    maxLength={1}
                    editable={!isLocked && !isVerifying && expiryCountdown > 0}
                    style={[
                      styles.otpInput,
                      {
                        backgroundColor: digit ? "rgba(34,211,238,0.08)" : "#1a1d27",
                        borderColor: digit ? "#22d3ee" : "#2a2e3d",
                      },
                    ]}
                    testID={`admin-otp-input-${i}`}
                  />
                ))}
              </Animated.View>

              {isVerifying && (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#22d3ee" size="small" />
                  <Text style={styles.loadingText}>Verifying...</Text>
                </View>
              )}

              <View style={styles.resendRow}>
                <Text style={styles.resendLabel}>Didn't receive the code?</Text>
                <TouchableOpacity
                  onPress={() => void handleResend()}
                  disabled={resendCountdown > 0 || isResending || isLocked}
                  style={styles.resendBtn}
                  testID="admin-otp-resend"
                >
                  {isResending ? (
                    <ActivityIndicator color="#22d3ee" size="small" />
                  ) : (
                    <RefreshCw color={resendCountdown > 0 ? "#4a5568" : "#22d3ee"} size={14} />
                  )}
                  <Text style={[styles.resendText, { color: resendCountdown > 0 ? "#4a5568" : "#22d3ee" }]}>
                    {resendCountdown > 0 ? `Resend in ${formatTime(resendCountdown)}` : "Resend Code"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.switchBtn}
                activeOpacity={0.7}
                onPress={() => setMode("recovery")}
                testID="admin-otp-switch-recovery"
              >
                <KeyRound color="#f59e0b" size={16} />
                <Text style={styles.switchBtnText}>Use Recovery Code</Text>
              </TouchableOpacity>
            </>
          )}

          {mode === "recovery" && (
            <>
              <Text style={styles.title}>Recovery Code</Text>
              <Text style={styles.subtitle}>Enter one of your backup recovery codes</Text>

              {isLocked && (
                <View style={styles.lockedBanner}>
                  <AlertTriangle color="#ef4444" size={16} />
                  <View style={styles.lockedTextWrap}>
                    <Text style={styles.lockedTitle}>Account Locked</Text>
                    <Text style={styles.lockedDesc}>
                      Too many failed attempts. Try again in {formatLockTime(lockRemainingMs)}
                    </Text>
                  </View>
                </View>
              )}

              {!isLocked && attemptsLeft < 3 && (
                <View style={styles.warningBadge}>
                  <AlertTriangle color="#f59e0b" size={13} />
                  <Text style={styles.warningText}>
                    {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining before lockout
                  </Text>
                </View>
              )}

              <Animated.View style={[styles.recoveryInputWrap, { transform: [{ translateX: shakeAnim }] }]}>
                <KeyRound color="#4a5568" size={18} />
                <TextInput
                  value={recoveryInput}
                  onChangeText={setRecoveryInput}
                  placeholder="XXXXX-XXXXX"
                  placeholderTextColor="#4a5568"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={styles.recoveryTextInput}
                  editable={!isLocked && !isVerifying}
                  testID="admin-recovery-input"
                />
              </Animated.View>

              <TouchableOpacity
                style={[styles.verifyBtn, (isLocked || isVerifying) && styles.btnDisabled]}
                activeOpacity={0.8}
                onPress={() => void handleVerifyRecovery()}
                disabled={isLocked || isVerifying}
                testID="admin-recovery-verify-btn"
              >
                {isVerifying ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.verifyBtnText}>Verify Recovery Code</Text>
                )}
              </TouchableOpacity>

              {method !== "recovery" && (
                <>
                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <TouchableOpacity
                    style={styles.switchBtn}
                    activeOpacity={0.7}
                    onPress={() => setMode("otp")}
                    testID="admin-otp-switch-otp"
                  >
                    <ShieldCheck color="#22d3ee" size={16} />
                    <Text style={[styles.switchBtnText, { color: "#22d3ee" }]}>Use OTP Code Instead</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Security Info</Text>
            <Text style={styles.infoText}>
              {mode === "otp"
                ? "• Code is valid for 5 minutes\n• Maximum 3 attempts before 15-min lockout\n• Each code is single-use only\n• Check spam folder for email codes"
                : "• Each recovery code is single-use\n• Codes cannot be reused once consumed\n• Maximum 3 attempts before 15-min lockout\n• Update your email/phone after recovery login"}
            </Text>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0c1222" },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  backBtn: { padding: 8, alignSelf: "flex-start", marginBottom: 16 },
  iconWrapper: { alignSelf: "center", marginBottom: 20 },
  shieldBg: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "rgba(34,211,238,0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(34,211,238,0.2)",
  },
  title: {
    color: "#e8eaf0",
    fontWeight: "800" as const,
    fontSize: 24,
    textAlign: "center" as const,
    letterSpacing: -0.5,
  },
  methodBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "rgba(34,211,238,0.08)",
  },
  methodBadgeText: { color: "#94a3b8", fontSize: 12, fontWeight: "600" as const },
  subtitle: {
    color: "#64748b",
    textAlign: "center" as const,
    marginTop: 12,
    fontSize: 13,
    lineHeight: 20,
  },
  targetText: {
    color: "#22d3ee",
    textAlign: "center" as const,
    fontWeight: "600" as const,
    fontSize: 14,
    marginTop: 4,
    marginBottom: 16,
  },
  expiryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  expiryText: { fontWeight: "600" as const, fontSize: 13 },
  lockedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
    backgroundColor: "rgba(239,68,68,0.08)",
    borderColor: "rgba(239,68,68,0.2)",
  },
  lockedTextWrap: { flex: 1 },
  lockedTitle: { color: "#ef4444", fontWeight: "700" as const, fontSize: 14, marginBottom: 2 },
  lockedDesc: { color: "#94a3b8", fontSize: 12, lineHeight: 18 },
  warningBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(245,158,11,0.1)",
    marginBottom: 16,
  },
  warningText: { color: "#f59e0b", fontSize: 12, fontWeight: "600" as const },
  otpRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 24 },
  otpInput: {
    width: 48,
    height: 58,
    borderRadius: 14,
    borderWidth: 2,
    textAlign: "center" as const,
    fontWeight: "700" as const,
    fontSize: 24,
    color: "#e8eaf0",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  loadingText: { color: "#64748b", fontWeight: "500" as const, fontSize: 13 },
  resendRow: { alignItems: "center", marginBottom: 20 },
  resendLabel: { color: "#64748b", marginBottom: 8, fontSize: 13 },
  resendBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  resendText: { fontWeight: "600" as const, fontSize: 13 },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#2a2e3d" },
  dividerText: { color: "#4a5568", fontSize: 11, fontWeight: "700" as const, letterSpacing: 2 },
  switchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "rgba(245,158,11,0.08)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.2)",
    marginBottom: 20,
  },
  switchBtnText: { color: "#f59e0b", fontSize: 14, fontWeight: "600" as const },
  recoveryInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1a1d27",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: "#2a2e3d",
    marginTop: 24,
    marginBottom: 16,
  },
  recoveryTextInput: {
    flex: 1,
    color: "#e8eaf0",
    fontWeight: "700" as const,
    fontSize: 18,
    letterSpacing: 2,
  },
  verifyBtn: {
    backgroundColor: "#0d9488",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 8,
  },
  verifyBtnText: { color: "#fff", fontWeight: "700" as const, fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
  infoCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "#1a1d27",
    borderColor: "#2a2e3d",
    marginTop: 8,
  },
  infoTitle: { color: "#94a3b8", fontWeight: "700" as const, marginBottom: 8, fontSize: 12 },
  infoText: { color: "#64748b", lineHeight: 20, fontSize: 11 },
});
