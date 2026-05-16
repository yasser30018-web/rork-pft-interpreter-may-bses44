import React, { useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  Modal,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Activity, Droplets, Wrench, BookOpen, User, Shield, LogIn, ClipboardList, AlertTriangle, Brain, Users } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";

const { width } = Dimensions.get("window");
const CARD_GAP = 8;
const NUM_COLUMNS = 2;
const GRID_PADDING = 20;
const CARD_SIZE = (width - GRID_PADDING * 2 - CARD_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const ICON_SIZE = 18;
const ICON_CONTAINER_SIZE = ICON_SIZE + 10;

interface DashboardItem {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ color: string; size: number }>;
  route: string;
  gradient: [string, string];
  iconBg: string;
}

const DASHBOARD_ITEMS: DashboardItem[] = [
  {
    id: "pft",
    title: "PFT",
    subtitle: "Interpretation",
    icon: Activity,
    route: "/pft",
    gradient: ["#0d9488", "#0f766e"],
    iconBg: "rgba(13,148,136,0.15)",
  },
  {
    id: "abg",
    title: "ABG",
    subtitle: "Analysis",
    icon: Droplets,
    route: "/abg",
    gradient: ["#3b82f6", "#2563eb"],
    iconBg: "rgba(59,130,246,0.15)",
  },
  {
    id: "tools",
    title: "Pulmo",
    subtitle: "Tools",
    icon: Wrench,
    route: "/tools",
    gradient: ["#f59e0b", "#d97706"],
    iconBg: "rgba(245,158,11,0.15)",
  },
  {
    id: "sources",
    title: "Sources",
    subtitle: "PDF Library",
    icon: BookOpen,
    route: "/sources",
    gradient: ["#8b5cf6", "#7c3aed"],
    iconBg: "rgba(139,92,246,0.15)",
  },
  {
    id: "logbook",
    title: "LogBook",
    subtitle: "Patient Records",
    icon: ClipboardList,
    route: "/logbook",
    gradient: ["#e11d48", "#be123c"],
    iconBg: "rgba(225,29,72,0.15)",
  },
  {
    id: "ai-scan",
    title: "AI Scan",
    subtitle: "HRCT Analyzer",
    icon: Brain,
    route: "/ai-scan",
    gradient: ["#0ea5e9", "#0284c7"],
    iconBg: "rgba(14,165,233,0.15)",
  },
  {
    id: "second-opinion",
    title: "2nd Opinion",
    subtitle: "Peer Discussion",
    icon: Users,
    route: "/second-opinion",
    gradient: ["#8b5cf6", "#7c3aed"],
    iconBg: "rgba(139,92,246,0.15)",
  },
];

function DashboardCard({ item, index }: { item: DashboardItem; index: number }) {
  const router = useRouter();
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay: index * 100,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }),
    ]).start();
  }, []);

  const handlePress = () => {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push(item.route as never);
  };

  const IconComponent = item.icon;

  return (
    <Animated.View style={[{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
        testID={`dashboard-card-${item.id}`}
      >
        <View style={[styles.cardIconContainer, { backgroundColor: item.iconBg, width: ICON_CONTAINER_SIZE, height: ICON_CONTAINER_SIZE }]}>
          <IconComponent color={item.gradient[0]} size={ICON_SIZE} />
        </View>
        <View style={styles.cardTextContainer}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
          <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>{item.subtitle}</Text>
        </View>
        <View style={[styles.cardAccentLine, { backgroundColor: item.gradient[0] }]} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, scaledFont, isDark } = useTheme();
  const { user, isAuthenticated, sessionKicked, dismissSessionKicked } = useAuth();
  const titleFade = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(titleFade, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(titleSlide, {
        toValue: 0,
        useNativeDriver: true,
        tension: 40,
        friction: 8,
      }),
    ]).start();
  }, []);

  const handleDismissKicked = useCallback(() => {
    dismissSessionKicked();
    router.push("/login" as never);
  }, [dismissSessionKicked, router]);

  const handleProfilePress = () => {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push("/profile" as never);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <Modal
        visible={sessionKicked}
        transparent
        animationType="fade"
        onRequestClose={handleDismissKicked}
      >
        <View style={styles.kickedOverlay}>
          <View style={[styles.kickedCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={[styles.kickedIconWrap, { backgroundColor: colors.red + "15" }]}>
              <AlertTriangle color={colors.red} size={32} />
            </View>
            <Text style={[styles.kickedTitle, { color: colors.text, fontSize: scaledFont(18) }]}>
              Session Ended
            </Text>
            <Text style={[styles.kickedMessage, { color: colors.textMuted, fontSize: scaledFont(13) }]}>
              Your account was signed in from a new device. If this wasn't you, change your password immediately.
            </Text>
            <View style={[styles.kickedWarning, { backgroundColor: colors.amber + '10', borderColor: colors.amber + '30' }]}>
              <AlertTriangle color={colors.amber} size={14} />
              <Text style={[styles.kickedWarningText, { color: colors.amber, fontSize: scaledFont(11) }]}>
                Only one active session is allowed. All previous sessions have been terminated.
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleDismissKicked}
              style={[styles.kickedBtn, { backgroundColor: colors.accent }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.kickedBtnText, { fontSize: scaledFont(14) }]}>Sign In Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerSection}>
          <Animated.View style={[styles.headerContent, { opacity: titleFade, transform: [{ translateY: titleSlide }] }]}>
            <View style={styles.headerRow}>
              <View>
                <View style={styles.logoRow}>
                  <View style={[styles.logoDot, { backgroundColor: colors.accent }]} />
                  <Text style={[styles.logoText, { color: colors.text, fontSize: scaledFont(28) }]}>
                    Pulmo<Text style={[styles.logoAccent, { color: colors.accentLight }]}>Lab</Text>
                  </Text>
                </View>
                <Text style={[styles.headerSubtitle, { color: colors.textMuted, fontSize: scaledFont(13) }]}>Clinical Pulmonary Tools</Text>
              </View>

              <TouchableOpacity
                onPress={handleProfilePress}
                style={[styles.profileBtn, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}
                activeOpacity={0.7}
                testID="profile-button"
              >
                {isAuthenticated && user?.profileImageUri ? (
                  <Image
                    source={{ uri: user.profileImageUri }}
                    style={styles.profileImage}
                    contentFit="cover"
                  />
                ) : (
                  <User color={colors.textMuted} size={20} />
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>

          <View style={styles.headerDecoration}>
            <View style={[styles.decorLine1, { backgroundColor: colors.accentLight }]} />
            <View style={[styles.decorLine2, { backgroundColor: colors.accentLight }]} />
            <View style={[styles.decorLine3, { backgroundColor: colors.accentLight }]} />
          </View>
        </View>

        <View style={styles.gridContainer}>
          <Text style={[styles.sectionLabel, { color: colors.textDim, fontSize: scaledFont(11) }]}>TOOLS</Text>
          <View style={styles.grid}>
            {DASHBOARD_ITEMS.map((item, index) => (
              <DashboardCard key={item.id} item={item} index={index} />
            ))}
          </View>

          {!isAuthenticated && (
            <TouchableOpacity
              onPress={() => {
                if (Platform.OS !== "web") {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                router.push("/login" as never);
              }}
              style={[styles.signInBtn, { backgroundColor: colors.accent }]}
              activeOpacity={0.8}
              testID="dashboard-sign-in-btn"
            >
              <LogIn color="#fff" size={18} />
              <Text style={[styles.signInBtnText, { fontSize: scaledFont(14) }]}>Sign In / Sign Up</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.footerDivider, { backgroundColor: colors.border }]} />
          <Text style={[styles.footerText, { color: isDark ? colors.textMuted : "#2d2d2e", fontSize: scaledFont(10) }]}>Coded by Dr.Yasser Alnajrani</Text>
          <Text style={[styles.footerVersion, { color: isDark ? colors.textDim : "#2d2d2e", fontSize: scaledFont(9) }]}>All Rights Reserved</Text>
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== "web") {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              router.push("/admin-login" as never);
            }}
            style={[styles.adminBtn, { borderColor: colors.border }]}
            activeOpacity={0.7}
            testID="admin-dashboard-btn"
          >
            <Shield color={colors.textMuted} size={14} />
            <Text style={[styles.adminBtnText, { color: colors.textMuted, fontSize: scaledFont(11) }]}>Admin Dashboard</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    position: "relative" as const,
    overflow: "hidden" as const,
  },
  headerContent: {
    zIndex: 2,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  logoText: {
    fontWeight: "800" as const,
    letterSpacing: -1,
  },
  logoAccent: {},
  headerSubtitle: {
    marginTop: 6,
    marginLeft: 20,
    letterSpacing: 0.5,
  },
  profileBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    overflow: "hidden" as const,
  },
  profileImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  headerDecoration: {
    position: "absolute" as const,
    top: 0,
    right: 0,
    bottom: 0,
    width: 120,
    opacity: 0.08,
  },
  decorLine1: {
    position: "absolute" as const,
    top: 10,
    right: 20,
    width: 60,
    height: 2,
    borderRadius: 1,
  },
  decorLine2: {
    position: "absolute" as const,
    top: 24,
    right: 30,
    width: 40,
    height: 2,
    borderRadius: 1,
  },
  decorLine3: {
    position: "absolute" as const,
    top: 38,
    right: 15,
    width: 70,
    height: 2,
    borderRadius: 1,
  },
  gridContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sectionLabel: {
    letterSpacing: 3,
    fontWeight: "700" as const,
    marginBottom: 10,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: CARD_GAP,
    columnGap: CARD_GAP,
  },
  card: {
    width: CARD_SIZE,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingTop: 9,
    paddingBottom: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden" as const,
    position: "relative" as const,
    aspectRatio: 1.85,
  },
  cardIconContainer: {
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTextContainer: {
    marginTop: 3,
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "700" as const,
    letterSpacing: -0.2,
    lineHeight: 14,
    textAlign: "center" as const,
  },
  cardSubtitle: {
    fontSize: 9.5,
    marginTop: 1,
    lineHeight: 12,
    textAlign: "center" as const,
  },
  cardAccentLine: {
    position: "absolute" as const,
    bottom: 0,
    left: 14,
    right: 14,
    height: 2,
    borderRadius: 1,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    alignItems: "center",
  },
  footerDivider: {
    width: 36,
    height: 2,
    borderRadius: 1,
    marginBottom: 8,
  },
  footerText: {
    letterSpacing: 0.5,
  },
  footerVersion: {
    marginTop: 4,
  },
  adminBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  adminBtnText: {
    fontWeight: "600" as const,
  },
  signInBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 10,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  signInBtnText: {
    color: "#fff",
    fontWeight: "700" as const,
  },
  kickedOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  kickedCard: {
    width: "100%" as const,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
  },
  kickedIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  kickedTitle: {
    fontWeight: "800" as const,
    textAlign: "center" as const,
    marginBottom: 10,
  },
  kickedMessage: {
    textAlign: "center" as const,
    lineHeight: 20,
    marginBottom: 24,
  },
  kickedBtn: {
    width: "100%" as const,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  kickedBtnText: {
    color: "#fff",
    fontWeight: "700" as const,
  },
  kickedWarning: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    width: "100%" as const,
  },
  kickedWarningText: {
    flex: 1,
    fontWeight: "500" as const,
    lineHeight: 18,
  },
});
