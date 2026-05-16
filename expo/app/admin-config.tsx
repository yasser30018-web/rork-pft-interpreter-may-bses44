import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Animated,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DollarSign,
  Clock,
  Shield,
  Smartphone,
  Save,
  RotateCcw,
  Download,
  ChevronLeft,
  Mail,
  MessageSquare,
  Upload,
  Sliders,
} from "lucide-react-native";
import { useTheme } from "@/providers/ThemeProvider";
import { useSystemConfig } from "@/providers/SystemConfigProvider";
import type { SystemConfig } from "@/types/admin";

function ConfigInput({
  label,
  value,
  onChangeText,
  prefix,
  suffix,
  keyboardType = "numeric",
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  prefix?: string;
  suffix?: string;
  keyboardType?: "numeric" | "decimal-pad";
}) {
  return (
    <View style={styles.configField}>
      <Text style={styles.configLabel}>{label}</Text>
      <View style={styles.configInputRow}>
        {prefix && <Text style={styles.configPrefix}>{prefix}</Text>}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          style={styles.configInput}
          placeholderTextColor="#4a5568"
        />
        {suffix && <Text style={styles.configSuffix}>{suffix}</Text>}
      </View>
    </View>
  );
}

export default function AdminConfigScreen() {
  const insets = useSafeAreaInsets();
  const { scaledFont } = useTheme();
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const { config: savedConfig, updateConfig, resetConfig } = useSystemConfig();
  const [config, setConfig] = useState(savedConfig);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  useEffect(() => {
    setConfig(savedConfig);
  }, [savedConfig]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const updateField = useCallback(<K extends keyof SystemConfig>(key: K, value: SystemConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    updateConfig(config);
    Alert.alert("Configuration Saved", "System configuration has been updated successfully.");
    setHasChanges(false);
    console.log("Admin config saved:", config);
  }, [config, updateConfig]);

  const handleReset = useCallback(() => {
    Alert.alert("Reset Configuration", "Restore all settings to defaults?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: () => {
          resetConfig();
          setHasChanges(false);
        },
      },
    ]);
  }, [resetConfig]);

  const handleExportLogs = useCallback(() => {
    Alert.alert("Export", "System logs exported successfully (demo).");
  }, []);

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: "System Config",
          headerStyle: { backgroundColor: "#0c1222" },
          headerTintColor: "#e8eaf0",
          headerTitleStyle: { fontWeight: "700" as const, fontSize: 16 },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
              <ChevronLeft color="#e8eaf0" size={22} />
              <Text style={styles.backText}>Admin</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <DollarSign color="#0d9488" size={18} />
              <Text style={[styles.sectionTitle, { fontSize: scaledFont(13) }]}>Subscription Pricing</Text>
            </View>
            <View style={styles.sectionCard}>
              <ConfigInput
                label="Monthly Plan Price"
                value={String(config.monthlyPrice)}
                onChangeText={(t) => updateField("monthlyPrice", parseFloat(t) || 0)}
                prefix="$"
                suffix="/month"
                keyboardType="decimal-pad"
              />
              <View style={styles.fieldDivider} />
              <ConfigInput
                label="Yearly Plan Price"
                value={String(config.yearlyPrice)}
                onChangeText={(t) => updateField("yearlyPrice", parseFloat(t) || 0)}
                prefix="$"
                suffix="/year"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Clock color="#f59e0b" size={18} />
              <Text style={[styles.sectionTitle, { fontSize: scaledFont(13) }]}>Free Trial</Text>
            </View>
            <View style={styles.sectionCard}>
              <ConfigInput
                label="Trial Duration"
                value={String(config.trialDurationDays)}
                onChangeText={(t) => updateField("trialDurationDays", parseInt(t, 10) || 0)}
                suffix="days"
              />
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Shield color="#22d3ee" size={18} />
              <Text style={[styles.sectionTitle, { fontSize: scaledFont(13) }]}>OTP & Rate Limiting</Text>
            </View>
            <View style={styles.sectionCard}>
              <ConfigInput
                label="Max OTP Requests"
                value={String(config.otpRateLimitPerWindow)}
                onChangeText={(t) => updateField("otpRateLimitPerWindow", parseInt(t, 10) || 0)}
                suffix={`per ${config.otpWindowMinutes} min`}
              />
              <View style={styles.fieldDivider} />
              <ConfigInput
                label="Rate Limit Window"
                value={String(config.otpWindowMinutes)}
                onChangeText={(t) => updateField("otpWindowMinutes", parseInt(t, 10) || 0)}
                suffix="minutes"
              />
              <View style={styles.fieldDivider} />
              <ConfigInput
                label="Max Failed OTP Attempts"
                value={String(config.maxFailedOtpAttempts)}
                onChangeText={(t) => updateField("maxFailedOtpAttempts", parseInt(t, 10) || 0)}
                suffix="attempts"
              />
              <View style={styles.fieldDivider} />
              <ConfigInput
                label="Lockout Duration"
                value={String(config.lockoutDurationMinutes)}
                onChangeText={(t) => updateField("lockoutDurationMinutes", parseInt(t, 10) || 0)}
                suffix="minutes"
              />
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Sliders color="#22d3ee" size={18} />
              <Text style={[styles.sectionTitle, { fontSize: scaledFont(13) }]}>App Controls</Text>
            </View>
            <View style={styles.sectionCard}>
              <View style={styles.switchRow}>
                <View style={styles.switchLabelRow}>
                  <View style={[styles.switchIconWrap, { backgroundColor: "rgba(16,185,129,0.12)" }]}>
                    <Mail color="#10b981" size={16} />
                  </View>
                  <View>
                    <Text style={styles.switchLabel}>Email Verification</Text>
                    <Text style={styles.switchDesc}>OTP via email during authentication</Text>
                  </View>
                </View>
                <Switch
                  value={config.emailVerificationEnabled}
                  onValueChange={(v) => updateField("emailVerificationEnabled", v)}
                  trackColor={{ false: "#2a2e3d", true: "rgba(16,185,129,0.5)" }}
                  thumbColor={config.emailVerificationEnabled ? "#10b981" : "#64748b"}
                />
              </View>
              <View style={styles.fieldDivider} />
              <View style={styles.switchRow}>
                <View style={styles.switchLabelRow}>
                  <View style={[styles.switchIconWrap, { backgroundColor: "rgba(139,92,246,0.12)" }]}>
                    <MessageSquare color="#8b5cf6" size={16} />
                  </View>
                  <View>
                    <Text style={styles.switchLabel}>SMS Verification</Text>
                    <Text style={styles.switchDesc}>OTP via SMS during authentication</Text>
                  </View>
                </View>
                <Switch
                  value={config.smsVerificationEnabled}
                  onValueChange={(v) => updateField("smsVerificationEnabled", v)}
                  trackColor={{ false: "#2a2e3d", true: "rgba(139,92,246,0.5)" }}
                  thumbColor={config.smsVerificationEnabled ? "#8b5cf6" : "#64748b"}
                />
              </View>
              <View style={styles.fieldDivider} />
              <View style={styles.switchRow}>
                <View style={styles.switchLabelRow}>
                  <View style={[styles.switchIconWrap, { backgroundColor: "rgba(245,158,11,0.12)" }]}>
                    <Upload color="#f59e0b" size={16} />
                  </View>
                  <View>
                    <Text style={styles.switchLabel}>Allow File Uploads</Text>
                    <Text style={styles.switchDesc}>Users can upload PDFs to their library</Text>
                  </View>
                </View>
                <Switch
                  value={config.allowFileUploads}
                  onValueChange={(v) => updateField("allowFileUploads", v)}
                  trackColor={{ false: "#2a2e3d", true: "rgba(245,158,11,0.5)" }}
                  thumbColor={config.allowFileUploads ? "#f59e0b" : "#64748b"}
                />
              </View>
              {!config.emailVerificationEnabled && !config.smsVerificationEnabled && (
                <View style={styles.warningBanner}>
                  <Text style={styles.warningText}>Both verification methods are disabled. Users will not receive OTP codes during authentication.</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Smartphone color="#a78bfa" size={18} />
              <Text style={[styles.sectionTitle, { fontSize: scaledFont(13) }]}>Security Policies</Text>
            </View>
            <View style={styles.sectionCard}>
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>Single Device Policy</Text>
                  <Text style={styles.switchDesc}>Only allow one active device per user</Text>
                </View>
                <Switch
                  value={config.singleDevicePolicy}
                  onValueChange={(v) => updateField("singleDevicePolicy", v)}
                  trackColor={{ false: "#2a2e3d", true: "rgba(13,148,136,0.5)" }}
                  thumbColor={config.singleDevicePolicy ? "#0d9488" : "#64748b"}
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Download color="#64748b" size={18} />
              <Text style={[styles.sectionTitle, { fontSize: scaledFont(13) }]}>Data & Logs</Text>
            </View>
            <View style={styles.sectionCard}>
              <TouchableOpacity onPress={handleExportLogs} style={styles.exportRow}>
                <Download color="#22d3ee" size={16} />
                <Text style={styles.exportText}>Export System Logs</Text>
              </TouchableOpacity>
              <View style={styles.fieldDivider} />
              <TouchableOpacity onPress={handleExportLogs} style={styles.exportRow}>
                <Download color="#22d3ee" size={16} />
                <Text style={styles.exportText}>Export User Data</Text>
              </TouchableOpacity>
              <View style={styles.fieldDivider} />
              <TouchableOpacity onPress={handleExportLogs} style={styles.exportRow}>
                <Download color="#22d3ee" size={16} />
                <Text style={styles.exportText}>Export Subscription Reports</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
              <RotateCcw color="#f97316" size={16} />
              <Text style={styles.resetBtnText}>Reset Defaults</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.saveBtn, !hasChanges && styles.saveBtnDisabled]}
              disabled={!hasChanges}
            >
              <Save color="#fff" size={16} />
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0c1222" },
  flex: { flex: 1 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2, marginLeft: -8 },
  backText: { color: "#e8eaf0", fontSize: 16, fontWeight: "500" as const },
  content: { padding: 16 },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionTitle: { color: "#94a3b8", fontWeight: "700" as const, letterSpacing: 1, textTransform: "uppercase" as const },
  sectionCard: {
    backgroundColor: "#1a1d27",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2a2e3d",
    padding: 16,
  },
  configField: { marginBottom: 4 },
  configLabel: { color: "#64748b", fontSize: 11, fontWeight: "600" as const, marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: 0.5 },
  configInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#252936",
    borderRadius: 10,
    paddingHorizontal: 14,
    gap: 6,
  },
  configPrefix: { color: "#0d9488", fontSize: 16, fontWeight: "700" as const },
  configInput: { flex: 1, color: "#e8eaf0", fontSize: 16, fontWeight: "600" as const, paddingVertical: 12 },
  configSuffix: { color: "#4a5568", fontSize: 12 },
  fieldDivider: { height: 1, backgroundColor: "#252936", marginVertical: 14 },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switchLabelRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  switchIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  switchLabel: { color: "#e8eaf0", fontSize: 14, fontWeight: "600" as const },
  switchDesc: { color: "#4a5568", fontSize: 11, marginTop: 2 },
  warningBanner: {
    marginTop: 14,
    backgroundColor: "rgba(239,68,68,0.1)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
  },
  warningText: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "500" as const,
    lineHeight: 18,
  },
  exportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  exportText: { color: "#22d3ee", fontSize: 14, fontWeight: "600" as const },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  resetBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.3)",
    backgroundColor: "rgba(249,115,22,0.08)",
  },
  resetBtnText: { color: "#f97316", fontSize: 13, fontWeight: "700" as const },
  saveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#0d9488",
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" as const },
});
