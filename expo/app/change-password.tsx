import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  Animated,
  ScrollView,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Lock, Eye, EyeOff, Check, X, ShieldCheck } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/providers/ThemeProvider";

export default function ChangePasswordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, scaledFont } = useTheme();

  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showCurrent, setShowCurrent] = useState<boolean>(false);
  const [showNew, setShowNew] = useState<boolean>(false);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const rules = [
    { label: "At least 8 characters", met: newPassword.length >= 8 },
    { label: "At least one uppercase letter", met: /[A-Z]/.test(newPassword) },
    { label: "At least one number", met: /[0-9]/.test(newPassword) },
    { label: "Passwords match", met: newPassword.length > 0 && newPassword === confirmPassword },
  ];

  const allRulesMet = rules.every((r) => r.met) && currentPassword.length > 0;

  const handleSubmit = useCallback(() => {
    if (!allRulesMet) {
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }

    if (Platform.OS !== "web") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    Alert.alert("Password Changed", "Your password has been updated successfully.", [
      { text: "OK", onPress: () => router.back() },
    ]);
  }, [allRulesMet, router]);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <Stack.Screen
        options={{
          title: "Change Password",
          headerStyle: { backgroundColor: colors.bgHeader },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: "700" as const, fontSize: 16 },
        }}
      />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={[styles.iconCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={[styles.iconWrapper, { backgroundColor: colors.accent + "15" }]}>
              <ShieldCheck color={colors.accent} size={32} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaledFont(16) }]}>
              Update Your Password
            </Text>
            <Text style={[styles.cardDesc, { color: colors.textMuted, fontSize: scaledFont(12) }]}>
              Choose a strong password to secure your account
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>Current Password</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Lock color={colors.textDim} size={18} />
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrent}
                placeholder="Enter current password"
                placeholderTextColor={colors.textDim}
                style={[styles.input, { color: colors.text, fontSize: scaledFont(14) }]}
              />
              <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)}>
                {showCurrent ? <EyeOff color={colors.textDim} size={18} /> : <Eye color={colors.textDim} size={18} />}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>New Password</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Lock color={colors.textDim} size={18} />
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNew}
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                placeholderTextColor={colors.textDim}
                style={[styles.input, { color: colors.text, fontSize: scaledFont(14) }]}
              />
              <TouchableOpacity onPress={() => setShowNew(!showNew)}>
                {showNew ? <EyeOff color={colors.textDim} size={18} /> : <Eye color={colors.textDim} size={18} />}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>Confirm New Password</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Lock color={colors.textDim} size={18} />
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                placeholder="Re-enter new password"
                placeholderTextColor={colors.textDim}
                style={[styles.input, { color: colors.text, fontSize: scaledFont(14) }]}
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                {showConfirm ? <EyeOff color={colors.textDim} size={18} /> : <Eye color={colors.textDim} size={18} />}
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.rulesCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.rulesTitle, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>Password Requirements</Text>
            {rules.map((rule, i) => (
              <View key={i} style={styles.ruleRow}>
                {rule.met ? (
                  <View style={[styles.ruleIcon, { backgroundColor: colors.green + "20" }]}>
                    <Check color={colors.green} size={12} />
                  </View>
                ) : (
                  <View style={[styles.ruleIcon, { backgroundColor: colors.border }]}>
                    <X color={colors.textDim} size={12} />
                  </View>
                )}
                <Text style={[styles.ruleText, { color: rule.met ? colors.green : colors.textMuted, fontSize: scaledFont(12) }]}>
                  {rule.label}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!allRulesMet}
            style={[styles.submitBtn, { backgroundColor: allRulesMet ? colors.accent : colors.bgElevated }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.submitText, { color: allRulesMet ? "#fff" : colors.textDim, fontSize: scaledFont(15) }]}>
              Update Password
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: 16 },
  iconCard: { borderRadius: 18, padding: 24, alignItems: "center", borderWidth: 1, marginBottom: 24 },
  iconWrapper: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  cardTitle: { fontWeight: "700" as const, letterSpacing: -0.3 },
  cardDesc: { marginTop: 4, textAlign: "center" as const },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontWeight: "600" as const, marginBottom: 8 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  input: { flex: 1 },
  rulesCard: { borderRadius: 14, padding: 16, borderWidth: 1, marginBottom: 24 },
  rulesTitle: { fontWeight: "700" as const, marginBottom: 12 },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  ruleIcon: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  ruleText: { fontWeight: "500" as const },
  submitBtn: { paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  submitText: { fontWeight: "700" as const },
});
