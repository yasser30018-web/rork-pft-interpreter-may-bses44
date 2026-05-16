import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ShieldCheck, Copy, Download, CheckCircle, AlertTriangle } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { generateRecoveryCodes, formatRecoveryCodesForDownload } from "@/utils/adminOtp";

export default function AdminRecoverySetupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [codes, setCodes] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [acknowledged, setAcknowledged] = useState<boolean>(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const codesFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [fadeAnim]);

  useEffect(() => {
    const generate = async () => {
      try {
        console.log("[RecoverySetup] Generating 10 recovery codes");
        const generated = await generateRecoveryCodes();
        setCodes(generated);
        console.log("[RecoverySetup] Recovery codes generated successfully");
        Animated.timing(codesFade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      } catch (err) {
        console.error("[RecoverySetup] Error generating codes:", err);
        Alert.alert("Error", "Failed to generate recovery codes. Please try again.");
      } finally {
        setIsGenerating(false);
      }
    };
    void generate();
  }, [codesFade]);

  const handleCopy = useCallback(async () => {
    const text = formatRecoveryCodesForDownload(codes);
    await Clipboard.setStringAsync(text);
    setCopied(true);
    if (Platform.OS !== "web") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setTimeout(() => setCopied(false), 3000);
  }, [codes]);

  const handleDownload = useCallback(async () => {
    const text = formatRecoveryCodesForDownload(codes);
    await Clipboard.setStringAsync(text);
    setCopied(true);
    if (Platform.OS !== "web") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    Alert.alert(
      "Codes Copied",
      "Recovery codes have been copied to your clipboard. Paste them into a secure note or document for safekeeping."
    );
    setTimeout(() => setCopied(false), 3000);
  }, [codes]);

  const handleContinue = useCallback(() => {
    if (!acknowledged) {
      Alert.alert(
        "Save Your Codes",
        "Please confirm you have saved your recovery codes before continuing. These will NOT be shown again.",
        [
          { text: "Go Back", style: "cancel" },
          {
            text: "I've Saved Them",
            style: "destructive",
            onPress: () => {
              setAcknowledged(true);
              router.replace("/admin" as never);
            },
          },
        ]
      );
    } else {
      router.replace("/admin" as never);
    }
  }, [acknowledged, router]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        >
          <View style={styles.header}>
            <View style={styles.iconBg}>
              <ShieldCheck color="#22d3ee" size={36} />
            </View>
            <Text style={styles.title}>Recovery Codes</Text>
            <Text style={styles.subtitle}>
              Save these codes somewhere safe. Each code is single-use and will not be shown again.
            </Text>
          </View>

          <View style={styles.warningCard}>
            <AlertTriangle color="#f59e0b" size={18} />
            <Text style={styles.warningText}>
              If you lose access to your email and phone, these are the only way to recover your admin account.
            </Text>
          </View>

          {isGenerating ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color="#22d3ee" size="large" />
              <Text style={styles.loadingText}>Generating secure codes...</Text>
            </View>
          ) : (
            <Animated.View style={[styles.codesContainer, { opacity: codesFade }]}>
              <View style={styles.codesGrid}>
                {codes.map((code, index) => (
                  <View key={index} style={styles.codeRow}>
                    <Text style={styles.codeIndex}>{(index + 1).toString().padStart(2, "0")}</Text>
                    <View style={styles.codeBox}>
                      <Text style={styles.codeText}>{code}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, copied && styles.actionBtnSuccess]}
                  activeOpacity={0.7}
                  onPress={() => void handleCopy()}
                  testID="recovery-copy-btn"
                >
                  {copied ? <CheckCircle color="#10b981" size={18} /> : <Copy color="#22d3ee" size={18} />}
                  <Text style={[styles.actionBtnText, copied && { color: "#10b981" }]}>
                    {copied ? "Copied!" : "Copy All"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  activeOpacity={0.7}
                  onPress={() => void handleDownload()}
                  testID="recovery-download-btn"
                >
                  <Download color="#22d3ee" size={18} />
                  <Text style={styles.actionBtnText}>Save as Text</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>How Recovery Codes Work</Text>
            <Text style={styles.infoText}>
              • Each code can only be used once{"\n"}
              • After use, a code is permanently consumed{"\n"}
              • You have 10 codes — use them wisely{"\n"}
              • Store in a password manager or secure location{"\n"}
              • If all codes are used, contact support for new ones
            </Text>
          </View>

          <TouchableOpacity
            style={styles.continueBtn}
            activeOpacity={0.8}
            onPress={handleContinue}
            disabled={isGenerating}
            testID="recovery-continue-btn"
          >
            <Text style={styles.continueBtnText}>I've Saved My Codes — Continue</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0c1222" },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  header: { alignItems: "center", marginBottom: 24 },
  iconBg: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "rgba(34,211,238,0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(34,211,238,0.2)",
    marginBottom: 16,
  },
  title: {
    color: "#e8eaf0",
    fontWeight: "800" as const,
    fontSize: 24,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center" as const,
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "rgba(245,158,11,0.08)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.2)",
    marginBottom: 24,
  },
  warningText: {
    flex: 1,
    color: "#f59e0b",
    fontSize: 13,
    fontWeight: "500" as const,
    lineHeight: 20,
  },
  loadingWrap: { alignItems: "center", paddingVertical: 60, gap: 16 },
  loadingText: { color: "#64748b", fontSize: 14 },
  codesContainer: { marginBottom: 20 },
  codesGrid: { gap: 8 },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  codeIndex: {
    color: "#4a5568",
    fontSize: 12,
    fontWeight: "700" as const,
    width: 22,
    textAlign: "right" as const,
  },
  codeBox: {
    flex: 1,
    backgroundColor: "#1a1d27",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#2a2e3d",
  },
  codeText: {
    color: "#e8eaf0",
    fontSize: 16,
    fontWeight: "700" as const,
    letterSpacing: 2,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "rgba(34,211,238,0.08)",
    borderWidth: 1,
    borderColor: "rgba(34,211,238,0.2)",
  },
  actionBtnSuccess: {
    backgroundColor: "rgba(16,185,129,0.08)",
    borderColor: "rgba(16,185,129,0.2)",
  },
  actionBtnText: { color: "#22d3ee", fontSize: 13, fontWeight: "600" as const },
  infoCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "#1a1d27",
    borderColor: "#2a2e3d",
    marginBottom: 24,
  },
  infoTitle: { color: "#94a3b8", fontWeight: "700" as const, marginBottom: 8, fontSize: 12 },
  infoText: { color: "#64748b", lineHeight: 22, fontSize: 12 },
  continueBtn: {
    backgroundColor: "#0d9488",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  continueBtnText: { color: "#fff", fontWeight: "700" as const, fontSize: 16 },
});
