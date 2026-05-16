import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Alert,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Shield,
  Lock,
  Mail,
  Smartphone,
  Key,
  ChevronRight,
  AlertTriangle,
} from "lucide-react-native";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";

export default function SecurityScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, scaledFont } = useTheme();
  const { user } = useAuth();

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const handleChangeEmail = () => {
    Alert.alert(
      "Change Email",
      "To change your email, we will send a verification code to both your current and new email address.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Proceed", onPress: () => console.log("Change email flow") },
      ]
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <Stack.Screen
        options={{
          title: "Account Security",
          headerStyle: { backgroundColor: colors.bgHeader },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: "700" as const, fontSize: 16 },
        }}
      />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={[styles.heroCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={[styles.heroIcon, { backgroundColor: colors.accent + "15" }]}>
              <Shield color={colors.accent} size={32} />
            </View>
            <Text style={[styles.heroTitle, { color: colors.text, fontSize: scaledFont(18) }]}>
              Account Security
            </Text>
            <Text style={[styles.heroDesc, { color: colors.textMuted, fontSize: scaledFont(12) }]}>
              Manage your security settings and login preferences
            </Text>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textDim, fontSize: scaledFont(11) }]}>
            SECURITY OPTIONS
          </Text>

          <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => router.push("/change-password" as never)}
              style={styles.menuRow}
            >
              <View style={styles.menuLeft}>
                <View style={[styles.menuIcon, { backgroundColor: colors.accent + "15" }]}>
                  <Lock color={colors.accent} size={18} />
                </View>
                <View>
                  <Text style={[styles.menuTitle, { color: colors.text, fontSize: scaledFont(14) }]}>Change Password</Text>
                  <Text style={[styles.menuDesc, { color: colors.textMuted, fontSize: scaledFont(11) }]}>Update your account password</Text>
                </View>
              </View>
              <ChevronRight color={colors.textDim} size={18} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <TouchableOpacity onPress={handleChangeEmail} style={styles.menuRow}>
              <View style={styles.menuLeft}>
                <View style={[styles.menuIcon, { backgroundColor: colors.violet + "15" }]}>
                  <Mail color={colors.violet} size={18} />
                </View>
                <View>
                  <Text style={[styles.menuTitle, { color: colors.text, fontSize: scaledFont(14) }]}>Change Email</Text>
                  <Text style={[styles.menuDesc, { color: colors.textMuted, fontSize: scaledFont(11) }]}>{user?.email ?? "Not set"}</Text>
                </View>
              </View>
              <ChevronRight color={colors.textDim} size={18} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textDim, fontSize: scaledFont(11) }]}>
            DEVICE & LOGIN
          </Text>

          <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.menuRow}>
              <View style={styles.menuLeft}>
                <View style={[styles.menuIcon, { backgroundColor: colors.cyan + "15" }]}>
                  <Smartphone color={colors.cyan} size={18} />
                </View>
                <View>
                  <Text style={[styles.menuTitle, { color: colors.text, fontSize: scaledFont(14) }]}>Device Login Policy</Text>
                  <Text style={[styles.menuDesc, { color: colors.textMuted, fontSize: scaledFont(11) }]}>One device login at a time</Text>
                </View>
              </View>
              <View style={[styles.activeBadge, { backgroundColor: colors.green + "15" }]}>
                <Text style={[styles.activeText, { color: colors.green, fontSize: scaledFont(10) }]}>ACTIVE</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.menuRow}>
              <View style={styles.menuLeft}>
                <View style={[styles.menuIcon, { backgroundColor: colors.amber + "15" }]}>
                  <Key color={colors.amber} size={18} />
                </View>
                <View>
                  <Text style={[styles.menuTitle, { color: colors.text, fontSize: scaledFont(14) }]}>OTP Verification</Text>
                  <Text style={[styles.menuDesc, { color: colors.textMuted, fontSize: scaledFont(11) }]}>6-digit code via Email or SMS</Text>
                </View>
              </View>
              <View style={[styles.activeBadge, { backgroundColor: colors.green + "15" }]}>
                <Text style={[styles.activeText, { color: colors.green, fontSize: scaledFont(10) }]}>ENABLED</Text>
              </View>
            </View>
          </View>

          <View style={[styles.infoCard, { backgroundColor: colors.amber + "10", borderColor: colors.amber + "30" }]}>
            <AlertTriangle color={colors.amber} size={18} />
            <Text style={[styles.infoText, { color: colors.textSecondary, fontSize: scaledFont(11) }]}>
              If you sign in from a new device, your previous session will be automatically logged out for security.
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
  content: { padding: 16 },
  heroCard: { borderRadius: 18, padding: 24, alignItems: "center", borderWidth: 1, marginBottom: 24 },
  heroIcon: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  heroTitle: { fontWeight: "800" as const, letterSpacing: -0.3 },
  heroDesc: { marginTop: 4, textAlign: "center" as const, lineHeight: 18 },
  sectionLabel: { letterSpacing: 3, fontWeight: "700" as const, marginBottom: 10, marginTop: 4 },
  card: { borderRadius: 16, borderWidth: 1, marginBottom: 20, overflow: "hidden" as const },
  menuRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  menuLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  menuIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  menuTitle: { fontWeight: "600" as const },
  menuDesc: { marginTop: 2 },
  divider: { height: 1, marginHorizontal: 16 },
  activeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  activeText: { fontWeight: "700" as const, letterSpacing: 0.5 },
  infoCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  infoText: { flex: 1, lineHeight: 18 },
});
