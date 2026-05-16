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
import { ShieldCheck, ArrowLeft, RefreshCw, Smartphone, Clock, AlertTriangle } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";

const OTP_LENGTH = 6;
const MAX_ATTEMPTS = 3;
const LOCKOUT_SECONDS = 15 * 60;
const OTP_EXPIRY_SECONDS = 5 * 60;

export default function OTPScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { email, phone, method, flow } = useLocalSearchParams<{ email?: string; phone?: string; method?: string; flow?: string }>();
  const { colors, scaledFont } = useTheme();
  const { verifyOtp, resendOtp, verifyPhoneOtp, resendPhoneOtp, verifyOtpLoading, resendOtpLoading, verifyPhoneOtpLoading, resendPhoneOtpLoading, completeDeviceOtpVerification, resendDeviceOtp } = useAuth();
  const [deviceVerifying, setDeviceVerifying] = useState<boolean>(false);
  const [deviceResending, setDeviceResending] = useState<boolean>(false);

  const isSms = method === "sms";
  const isSignup = flow === "signup";
  const isDevice = flow === "device";
  const isVerifying = deviceVerifying || (isSms ? verifyPhoneOtpLoading : verifyOtpLoading);
  const isResending = deviceResending || (isSms ? resendPhoneOtpLoading : resendOtpLoading);

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [resendCountdown, setResendCountdown] = useState<number>(60);
  const [expiryCountdown, setExpiryCountdown] = useState<number>(OTP_EXPIRY_SECONDS);
  const [attempts, setAttempts] = useState<number>(0);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [lockoutCountdown, setLockoutCountdown] = useState<number>(0);
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const shouldPulse = expiryCountdown <= 30 && expiryCountdown > 0;

  useEffect(() => {
    if (shouldPulse) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [shouldPulse, pulseAnim]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  useEffect(() => {
    if (isExpired || expiryCountdown <= 0) {
      if (expiryCountdown <= 0 && !isExpired) {
        setIsExpired(true);
      }
      return;
    }
    const timer = setInterval(() => {
      setExpiryCountdown((c) => {
        if (c <= 1) {
          setIsExpired(true);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isExpired, expiryCountdown]);

  useEffect(() => {
    if (lockoutCountdown <= 0) {
      if (isLocked) {
        setIsLocked(false);
        setAttempts(0);
        console.log("[OTP] Lockout expired, resetting attempts");
      }
      return;
    }
    const timer = setInterval(() => setLockoutCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [lockoutCountdown, isLocked]);

  useEffect(() => {
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 600);
  }, []);

  const formatCountdown = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
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

  const handleVerify = useCallback(
    async (code: string) => {
      if (!email && !phone) {
        Alert.alert("Error", "Contact info not found. Please go back and try again.");
        return;
      }

      if (isExpired) {
        Alert.alert("Code Expired", "Your verification code has expired. Please request a new one.");
        return;
      }

      if (isLocked) {
        Alert.alert("Account Locked", `Too many incorrect attempts. Please wait ${formatCountdown(lockoutCountdown)} before trying again.`);
        return;
      }

      if (attempts >= MAX_ATTEMPTS) {
        setIsLocked(true);
        setLockoutCountdown(LOCKOUT_SECONDS);
        console.log("[OTP] Max attempts reached, locking for 15 minutes");
        Alert.alert(
          "Verification Blocked",
          "Too many incorrect attempts. Your account activation is blocked for 15 minutes."
        );
        return;
      }

      console.log("[OTP] Verifying code for:", isSms ? phone : email, "method:", method, "flow:", flow, "attempt:", attempts + 1);

      try {
        if (isDevice) {
          setDeviceVerifying(true);
          const contact = isSms && phone ? phone : (email ?? "");
          await completeDeviceOtpVerification(code, isSms ? "sms" : "email", contact);
          setDeviceVerifying(false);
        } else if (isSms && phone) {
          await verifyPhoneOtp(phone, code);
        } else if (email) {
          await verifyOtp(email, code);
        }
        console.log("[OTP] Verification successful");

        if (Platform.OS !== "web") {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        if (isSignup) {
          Alert.alert(
            "Welcome to PulmoLab!",
            "Your account has been successfully verified. You can now start using PulmoLab. If you did not create this account, contact support immediately.",
            [{ text: "Get Started", onPress: () => router.replace("/" as never) }]
          );
        } else if (isDevice) {
          Alert.alert(
            "Device Verified",
            "This device is now trusted. You won't need to verify again for 30 days.",
            [{ text: "Continue", onPress: () => router.replace("/" as never) }]
          );
        } else {
          router.replace("/" as never);
        }
      } catch (err: unknown) {
        setDeviceVerifying(false);
        console.error("[OTP] Verification failed:", err);
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        triggerShake();

        if (Platform.OS !== "web") {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }

        setOtp(Array(OTP_LENGTH).fill(""));
        setTimeout(() => inputRefs.current[0]?.focus(), 100);

        if (newAttempts >= MAX_ATTEMPTS) {
          setIsLocked(true);
          setLockoutCountdown(LOCKOUT_SECONDS);
          Alert.alert(
            "Verification Blocked",
            "Too many incorrect attempts. Your account activation is blocked for 15 minutes."
          );
        } else {
          const remaining = MAX_ATTEMPTS - newAttempts;
          const message = err instanceof Error ? err.message : "Invalid code. Please try again.";
          Alert.alert("Verification Failed", `${message}\n\n${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`);
        }
      }
    },
    [email, phone, isSms, method, flow, isSignup, isDevice, attempts, isLocked, isExpired, lockoutCountdown, verifyOtp, verifyPhoneOtp, completeDeviceOtpVerification, router, triggerShake, formatCountdown]
  );

  const handleOtpChange = useCallback(
    (text: string, index: number) => {
      if (isLocked || isVerifying || isExpired) return;
      const newOtp = [...otp];
      newOtp[index] = text.slice(-1);
      setOtp(newOtp);

      if (text && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      if (newOtp.every((d) => d !== "") && newOtp.join("").length === OTP_LENGTH) {
        setTimeout(() => void handleVerify(newOtp.join("")), 200);
      }
    },
    [otp, isLocked, isVerifying, isExpired, handleVerify]
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
    if (resendCountdown > 0 || isResending) return;
    if (!email && !phone) return;

    try {
      if (isDevice) {
        setDeviceResending(true);
        const contact = isSms && phone ? phone : (email ?? "");
        await resendDeviceOtp(isSms ? "sms" : "email", contact);
        setDeviceResending(false);
      } else if (isSms && phone) {
        await resendPhoneOtp(phone);
      } else if (email) {
        await resendOtp(email);
      }
      setResendCountdown(60);
      setExpiryCountdown(OTP_EXPIRY_SECONDS);
      setIsExpired(false);
      setOtp(Array(OTP_LENGTH).fill(""));
      if (Platform.OS !== "web") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      Alert.alert("Code Sent", isSms ? "A new verification code has been sent via SMS." : "A new verification code has been sent to your email.");
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      setDeviceResending(false);
      console.error("[OTP] Resend failed:", err);
      const message = err instanceof Error ? err.message : "Failed to resend code.";
      Alert.alert("Error", message);
    }
  }, [resendCountdown, email, phone, isSms, isDevice, resendOtp, resendPhoneOtp, resendDeviceOtp, isResending]);

  const maskedEmail = email
    ? email.replace(/^(.{2})(.*)(@.*)$/, (_m, a, b, c) => a + b.replace(/./g, "\u2022") + c)
    : "";

  const maskedPhone = phone
    ? phone.slice(0, 5) + "\u2022\u2022\u2022\u2022" + phone.slice(-2)
    : "";

  const expiryWarning = expiryCountdown <= 60 && expiryCountdown > 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="otp-back">
            <ArrowLeft color={colors.textSecondary} size={22} />
          </TouchableOpacity>

          <View style={[styles.iconWrapper, { backgroundColor: colors.accent + "15" }]}>
            {isSms ? <Smartphone color={colors.accent} size={40} /> : <ShieldCheck color={colors.accent} size={40} />}
          </View>

          <Text style={[styles.title, { color: colors.text, fontSize: scaledFont(24) }]}>
            {isDevice ? "New Device Detected" : isSms ? "Verify Your Phone" : "Verify Your Email"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted, fontSize: scaledFont(13) }]}>
            {isDevice
              ? `A verification code was sent ${isSms ? "via SMS to" : "to"}`
              : `Enter the 6-digit code sent ${isSms ? "via SMS to" : "to"}`}
          </Text>
          <Text style={[styles.emailText, { color: colors.accent, fontSize: scaledFont(14) }]}>
            {isSms ? maskedPhone : maskedEmail}
          </Text>

          <Animated.View style={[
            styles.expiryBadge,
            {
              backgroundColor: isExpired ? colors.red + "15" : expiryWarning ? colors.amber + "15" : colors.accent + "10",
              transform: [{ scale: expiryWarning ? pulseAnim : 1 }],
            },
          ]}>
            <Clock
              color={isExpired ? colors.red : expiryWarning ? colors.amber : colors.accent}
              size={14}
            />
            <Text style={[styles.expiryText, {
              color: isExpired ? colors.red : expiryWarning ? colors.amber : colors.accent,
              fontSize: scaledFont(12),
            }]}>
              {isExpired ? "Code expired — request a new one" : `Code expires in ${formatCountdown(expiryCountdown)}`}
            </Text>
          </Animated.View>

          {attempts > 0 && !isLocked && (
            <View style={[styles.attemptsBadge, { backgroundColor: colors.amber + "12", borderColor: colors.amber + "30" }]}>
              <AlertTriangle color={colors.amber} size={14} />
              <Text style={[styles.attemptsText, { color: colors.amber, fontSize: scaledFont(12) }]}>
                {MAX_ATTEMPTS - attempts} attempt{MAX_ATTEMPTS - attempts === 1 ? "" : "s"} remaining
              </Text>
            </View>
          )}

          <Animated.View style={[styles.otpRow, { transform: [{ translateX: shakeAnim }] }]}>
            {otp.map((digit, i) => (
              <TextInput
                key={i}
                ref={(ref) => {
                  inputRefs.current[i] = ref;
                }}
                value={digit}
                onChangeText={(text) => handleOtpChange(text, i)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
                keyboardType="number-pad"
                maxLength={1}
                editable={!isLocked && !isVerifying && !isExpired}
                style={[
                  styles.otpInput,
                  {
                    backgroundColor: isExpired ? colors.bgElevated : digit ? colors.accent + "10" : colors.inputBg,
                    borderColor: isExpired ? colors.border : digit ? colors.accent : colors.border,
                    color: isExpired ? colors.textDim : colors.text,
                    fontSize: scaledFont(24),
                    opacity: isExpired ? 0.5 : 1,
                  },
                ]}
                testID={`otp-input-${i}`}
              />
            ))}
          </Animated.View>

          {isVerifying && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.accent} size="small" />
              <Text style={[styles.loadingText, { color: colors.textMuted, fontSize: scaledFont(13) }]}>
                Verifying...
              </Text>
            </View>
          )}

          {isLocked && (
            <View style={[styles.lockedBanner, { backgroundColor: colors.red + "12", borderColor: colors.red + "25" }]}>
              <AlertTriangle color={colors.red} size={18} />
              <Text style={[styles.lockedTitle, { color: colors.red, fontSize: scaledFont(13) }]}>
                Verification Blocked
              </Text>
              <Text style={[styles.lockedText, { color: colors.red, fontSize: scaledFont(12) }]}>
                Too many failed attempts. Try again in {formatCountdown(lockoutCountdown)}
              </Text>
            </View>
          )}

          <View style={styles.resendRow}>
            <Text style={[styles.resendLabel, { color: colors.textMuted, fontSize: scaledFont(13) }]}>
              Didn't receive the code?
            </Text>
            <TouchableOpacity
              onPress={() => void handleResend()}
              disabled={resendCountdown > 0 || isResending || isLocked}
              style={styles.resendBtn}
              testID="otp-resend"
            >
              {isResending ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <RefreshCw color={resendCountdown > 0 || isLocked ? colors.textDim : colors.accent} size={14} />
              )}
              <Text style={[styles.resendText, { color: resendCountdown > 0 || isLocked ? colors.textDim : colors.accent, fontSize: scaledFont(13) }]}>
                {resendCountdown > 0 ? `Resend in ${formatCountdown(resendCountdown)}` : "Resend Code"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.infoTitle, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>Security Info</Text>
            <Text style={[styles.infoText, { color: colors.textMuted, fontSize: scaledFont(11) }]}>
              {isDevice
                ? `\u2022 We detected a login from an unrecognized device\n\u2022 Code is valid for 5 minutes\n\u2022 Maximum ${MAX_ATTEMPTS} attempts before 15-min lockout\n\u2022 Once verified, this device is trusted for 30 days\n\u2022 Only one active session is allowed at a time`
                : isSms
                  ? `\u2022 SMS may take up to 60 seconds to arrive\n\u2022 Code is valid for 5 minutes\n\u2022 Maximum ${MAX_ATTEMPTS} attempts before 15-min lockout\n\u2022 Each code is single-use only\n\u2022 Contact support if issues persist`
                  : `\u2022 Check your spam folder if you don't see the email\n\u2022 Code is valid for 5 minutes\n\u2022 Maximum ${MAX_ATTEMPTS} attempts before 15-min lockout\n\u2022 Each code is single-use only\n\u2022 Contact support if issues persist`
              }
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  backBtn: { padding: 8, alignSelf: "flex-start", marginBottom: 24 },
  iconWrapper: { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 20 },
  title: { fontWeight: "800" as const, textAlign: "center" as const, letterSpacing: -0.5 },
  subtitle: { textAlign: "center" as const, marginTop: 8, lineHeight: 20 },
  emailText: { textAlign: "center" as const, fontWeight: "600" as const, marginTop: 4, marginBottom: 16 },
  expiryBadge: { flexDirection: "row", alignSelf: "center", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginBottom: 12 },
  expiryText: { fontWeight: "600" as const },
  attemptsBadge: { flexDirection: "row", alignSelf: "center", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, marginBottom: 20 },
  attemptsText: { fontWeight: "600" as const },
  otpRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 28 },
  otpInput: { width: 48, height: 58, borderRadius: 14, borderWidth: 2, textAlign: "center" as const, fontWeight: "700" as const },
  loadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 },
  loadingText: { fontWeight: "500" as const },
  lockedBanner: { padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 20, alignItems: "center", gap: 6 },
  lockedTitle: { fontWeight: "700" as const },
  lockedText: { fontWeight: "500" as const, textAlign: "center" as const },
  resendRow: { alignItems: "center", marginBottom: 28 },
  resendLabel: { marginBottom: 8 },
  resendBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  resendText: { fontWeight: "600" as const },
  infoCard: { padding: 16, borderRadius: 14, borderWidth: 1 },
  infoTitle: { fontWeight: "700" as const, marginBottom: 8 },
  infoText: { lineHeight: 20 },
});
