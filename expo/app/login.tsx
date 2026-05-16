import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Mail, Eye, EyeOff, Shield, ArrowRight } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useSystemConfig } from "@/providers/SystemConfigProvider";
import type { UserRole } from "@/types/user";

const ROLES: UserRole[] = ["Consultant", "Fellow", "Resident", "Nurse"];

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, scaledFont } = useTheme();
  const { signUp, checkDeviceAndLogin, loginLoading, signUpLoading, phoneOtpLoading, loginError, signUpError, resetLoginError, resetSignUpError, resetPhoneOtpError } = useAuth();
  const { config: appConfig } = useSystemConfig();
  const [deviceCheckLoading, setDeviceCheckLoading] = useState<boolean>(false);

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [fullName, setFullName] = useState<string>("");
  const [specialty, setSpecialty] = useState<string>("");
  const [role, setRole] = useState<UserRole>("Resident");
  const [contactNumber, setContactNumber] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 40, friction: 8 }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const validatePassword = useCallback((pw: string): string[] => {
    const issues: string[] = [];
    if (pw.length < 8) issues.push("At least 8 characters");
    if (!/[A-Z]/.test(pw)) issues.push("At least one uppercase letter");
    if (!/[0-9]/.test(pw)) issues.push("At least one number");
    return issues;
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = "Invalid email format";

    if (!password.trim()) newErrors.password = "Password is required";
    else {
      const pwIssues = validatePassword(password);
      if (pwIssues.length > 0) newErrors.password = pwIssues.join(", ");
    }

    if (mode === "signup") {
      if (!fullName.trim()) newErrors.fullName = "Full name is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [email, password, mode, fullName, validatePassword]);

  const isSubmitting = loginLoading || signUpLoading || phoneOtpLoading || deviceCheckLoading;
  const authError = mode === "login" ? loginError : signUpError;

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }

    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    resetLoginError();
    resetSignUpError();
    resetPhoneOtpError();

    try {
      if (mode === "signup") {
        await signUp(email.trim(), password, {
          full_name: fullName.trim(),
          specialty: specialty.trim(),
          role,
          contact_number: contactNumber.trim(),
        });

        if (appConfig.emailVerificationEnabled) {
          console.log("[Login] Sign up successful, redirecting to Email OTP");
          router.push({ pathname: "/otp" as never, params: { email: email.trim(), method: "email", flow: "signup" } });
        } else if (appConfig.smsVerificationEnabled && contactNumber.trim()) {
          console.log("[Login] Sign up successful, redirecting to SMS OTP");
          router.push({ pathname: "/otp" as never, params: { email: email.trim(), phone: contactNumber.trim(), method: "sms", flow: "signup" } });
        } else {
          console.log("[Login] Sign up successful, verification disabled — redirecting to login");
          Alert.alert("Account Created", "Your account has been created. Please sign in.");
          setMode("login");
        }
      } else {
        setDeviceCheckLoading(true);
        try {
          console.log("[Login] Starting device-based login check");
          const deviceResult = await checkDeviceAndLogin(email.trim(), password);

          if (deviceResult.trusted) {
            console.log("[Login] Device trusted, access granted directly");
            router.replace("/" as never);
          } else if (!appConfig.emailVerificationEnabled && !appConfig.smsVerificationEnabled) {
            console.log("[Login] New device detected but all verification disabled, granting access");
            router.replace("/" as never);
          } else {
            const otpMethod = appConfig.emailVerificationEnabled ? "email" : "sms";
            console.log("[Login] New device detected, OTP required via:", otpMethod);
            router.push({
              pathname: "/otp" as never,
              params: {
                email: deviceResult.email ?? email.trim(),
                phone: deviceResult.phone ?? "",
                method: otpMethod,
                flow: "device",
              },
            });
          }
        } finally {
          setDeviceCheckLoading(false);
        }
      }
    } catch (err: unknown) {
      console.error("[Login] Auth error:", err);
      const message = err instanceof Error ? err.message : "Authentication failed. Please try again.";
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      if (message.includes("already exists")) {
        setMode("login");
        Alert.alert("Account Exists", "An account with this email already exists. Please sign in with your password.");
      } else {
        Alert.alert("Error", message);
      }
    }
  }, [validateForm, mode, fullName, specialty, role, contactNumber, email, password, signUp, checkDeviceAndLogin, router, resetLoginError, resetSignUpError, resetPhoneOtpError, appConfig]);

  const handleContactChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^0-9]/g, "");
    if (cleaned.length <= 10) {
      setContactNumber(cleaned);
    }
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={styles.logoSection}>
              <View style={[styles.logoIcon, { backgroundColor: colors.accent + "15" }]}>
                <Shield color={colors.accent} size={32} />
              </View>
              <Text style={[styles.logoText, { color: colors.text, fontSize: scaledFont(28) }]}>
                Pulmo<Text style={{ color: colors.accentLight }}>Lab</Text>
              </Text>
              <Text style={[styles.logoSubtitle, { color: colors.textMuted, fontSize: scaledFont(13) }]}>
                Clinical Pulmonary Tools
              </Text>
            </View>

            <View style={[styles.modeToggle, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => setMode("login")}
                style={[styles.modeButton, mode === "login" && { backgroundColor: colors.accent }]}
              >
                <Text style={[styles.modeText, { color: mode === "login" ? "#fff" : colors.textMuted, fontSize: scaledFont(13) }]}>
                  Sign In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMode("signup")}
                style={[styles.modeButton, mode === "signup" && { backgroundColor: colors.accent }]}
              >
                <Text style={[styles.modeText, { color: mode === "signup" ? "#fff" : colors.textMuted, fontSize: scaledFont(13) }]}>
                  Sign Up
                </Text>
              </TouchableOpacity>
            </View>

            {mode === "signup" && (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>Full Name</Text>
                  <TextInput
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Dr. John Smith"
                    placeholderTextColor={colors.textDim}
                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: errors.fullName ? colors.red : colors.border, color: colors.text, fontSize: scaledFont(14) }]}
                    testID="input-fullname"
                  />
                  {errors.fullName ? <Text style={[styles.errorText, { fontSize: scaledFont(11) }]}>{errors.fullName}</Text> : null}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>Medical Specialty <Text style={{ color: colors.textDim, fontWeight: "400" as const }}>(Optional)</Text></Text>
                  <TextInput
                    value={specialty}
                    onChangeText={setSpecialty}
                    placeholder="e.g. Pulmonology"
                    placeholderTextColor={colors.textDim}
                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text, fontSize: scaledFont(14) }]}
                    testID="input-specialty"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>Role</Text>
                  <View style={styles.roleRow}>
                    {ROLES.map((r) => (
                      <TouchableOpacity
                        key={r}
                        onPress={() => setRole(r)}
                        style={[
                          styles.roleChip,
                          { borderColor: role === r ? colors.accent : colors.border, backgroundColor: role === r ? colors.accent + "15" : colors.bgCard },
                        ]}
                      >
                        <Text style={[styles.roleChipText, { color: role === r ? colors.accent : colors.textMuted, fontSize: scaledFont(11) }]}>{r}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>Contact Number <Text style={{ color: colors.textDim, fontWeight: "400" as const }}>(Optional)</Text></Text>
                  <TextInput
                    value={contactNumber}
                    onChangeText={handleContactChange}
                    placeholder="05XXXXXXXX"
                    placeholderTextColor={colors.textDim}
                    keyboardType="phone-pad"
                    maxLength={10}
                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text, fontSize: scaledFont(14) }]}
                    testID="input-phone"
                  />
                </View>
              </>
            )}

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>Email</Text>
              <View style={styles.inputWithIcon}>
                <Mail color={colors.textDim} size={18} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your@email.com"
                  placeholderTextColor={colors.textDim}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[styles.inputInner, { color: colors.text, fontSize: scaledFont(14) }]}
                  testID="input-email"
                />
              </View>
              <View style={[styles.inputBorder, { backgroundColor: colors.inputBg, borderColor: errors.email ? colors.red : colors.border }]} />
              {errors.email ? <Text style={[styles.errorText, { fontSize: scaledFont(11) }]}>{errors.email}</Text> : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>Password</Text>
              <View style={styles.inputWithIcon}>
                <Shield color={colors.textDim} size={18} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  placeholderTextColor={colors.textDim}
                  secureTextEntry={!showPassword}
                  style={[styles.inputInner, { color: colors.text, fontSize: scaledFont(14) }]}
                  testID="input-password"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff color={colors.textDim} size={18} /> : <Eye color={colors.textDim} size={18} />}
                </TouchableOpacity>
              </View>
              <View style={[styles.inputBorder, { backgroundColor: colors.inputBg, borderColor: errors.password ? colors.red : colors.border }]} />
              {errors.password ? <Text style={[styles.errorText, { fontSize: scaledFont(11) }]}>{errors.password}</Text> : null}
            </View>

            {authError ? (
              <View style={[styles.authErrorBanner, { backgroundColor: "#ef444415", borderColor: "#ef444440" }]}>
                <Text style={[styles.authErrorText, { fontSize: scaledFont(12) }]}>
                  {authError.message}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={[styles.submitBtn, { backgroundColor: colors.accent, opacity: isSubmitting ? 0.7 : 1 }]}
              activeOpacity={0.8}
              testID="submit-button"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={[styles.submitText, { fontSize: scaledFont(15) }]}>
                    {mode === "login" ? "Sign In" : "Create Account"}
                  </Text>
                  <ArrowRight color="#fff" size={18} />
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: 24 },
  logoSection: { alignItems: "center", marginBottom: 32 },
  logoIcon: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  logoText: { fontWeight: "800" as const, letterSpacing: -1 },
  logoSubtitle: { marginTop: 4 },
  modeToggle: { flexDirection: "row", borderRadius: 14, padding: 4, marginBottom: 24, borderWidth: 1 },
  modeButton: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  modeText: { fontWeight: "600" as const },
  fieldGroup: { marginBottom: 18 },
  fieldLabel: { fontWeight: "600" as const, marginBottom: 8 },
  input: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, borderWidth: 1 },
  inputWithIcon: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 13 },
  inputInner: { flex: 1 },
  inputBorder: { height: 1, marginTop: -1, borderBottomWidth: 1, borderRadius: 12 },
  errorText: { color: "#ef4444", marginTop: 4 },
  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roleChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  roleChipText: { fontWeight: "600" as const },
  authErrorBanner: { padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  authErrorText: { color: "#ef4444", fontWeight: "500" as const, textAlign: "center" as const },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: 14, marginTop: 8 },
  submitText: { color: "#fff", fontWeight: "700" as const },
});
