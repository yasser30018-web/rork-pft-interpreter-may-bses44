import React, { useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Animated,
  Dimensions,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  ScrollText,
  ShieldAlert,
  Settings,
  LogOut,
  TrendingUp,
  TrendingDown,
  UserCheck,
  Clock,
  DollarSign,
  AlertTriangle,
  XCircle,
  BarChart3,
} from "lucide-react-native";
import { useTheme } from "@/providers/ThemeProvider";
import { adminFetchAllUsers, adminFetchAllSubscriptions } from "@/utils/adminApi";
import type { AdminTab } from "@/types/admin";

const ADMIN_SESSION_KEY = "pulmolab_admin_session";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface TabItem {
  id: AdminTab;
  label: string;
  icon: React.ComponentType<{ color: string; size: number }>;
  route: string | null;
}

const TABS: TabItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, route: null },
  { id: "users", label: "Users", icon: Users, route: "/admin-users" },
  { id: "subscriptions", label: "Subs", icon: CreditCard, route: "/admin-subscriptions" },
  { id: "events", label: "Events", icon: ScrollText, route: "/admin-events" },
  { id: "security", label: "Security", icon: ShieldAlert, route: "/admin-security" },
  { id: "config", label: "Config", icon: Settings, route: "/admin-config" },
];

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  iconBg,
  trend,
  trendPositive,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ color: string; size: number }>;
  iconColor: string;
  iconBg: string;
  trend?: string;
  trendPositive?: boolean;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: "#1a1d27", borderColor: "#2a2e3d" }]}>
      <View style={styles.statHeader}>
        <View style={[styles.statIconWrap, { backgroundColor: iconBg }]}>
          <Icon color={iconColor} size={18} />
        </View>
        {trend && (
          <View style={[styles.trendBadge, { backgroundColor: trendPositive ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)" }]}>
            {trendPositive ? <TrendingUp color="#10b981" size={10} /> : <TrendingDown color="#ef4444" size={10} />}
            <Text style={[styles.trendText, { color: trendPositive ? "#10b981" : "#ef4444" }]}>{trend}</Text>
          </View>
        )}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );
}

function MiniBarChart({ totalUsers, totalSubs }: { totalUsers: number; totalSubs: number }) {
  const maxVal = Math.max(totalUsers, totalSubs, 1);
  const barWidth = Math.min(36, (SCREEN_WIDTH - 120) / 2 - 8);

  return (
    <View style={[styles.chartCard, { backgroundColor: "#1a1d27", borderColor: "#2a2e3d" }]}>
      <View style={styles.chartHeader}>
        <BarChart3 color="#22d3ee" size={18} />
        <Text style={styles.chartTitle}>Overview</Text>
      </View>
      <View style={styles.chartLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#0d9488" }]} />
          <Text style={styles.legendLabel}>Users</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#22d3ee" }]} />
          <Text style={styles.legendLabel}>Subscribers</Text>
        </View>
      </View>
      <View style={styles.chartBars}>
        <View style={styles.barGroup}>
          <View style={styles.barPair}>
            <View
              style={[
                styles.bar,
                {
                  height: (totalUsers / maxVal) * 80,
                  width: barWidth,
                  backgroundColor: "#0d9488",
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                },
              ]}
            />
          </View>
          <Text style={styles.barLabel}>{totalUsers}</Text>
        </View>
        <View style={styles.barGroup}>
          <View style={styles.barPair}>
            <View
              style={[
                styles.bar,
                {
                  height: (totalSubs / maxVal) * 80,
                  width: barWidth,
                  backgroundColor: "#22d3ee",
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                },
              ]}
            />
          </View>
          <Text style={styles.barLabel}>{totalSubs}</Text>
        </View>
      </View>
    </View>
  );
}

export default function AdminDashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { scaledFont } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const checkAuth = async () => {
      const session = await AsyncStorage.getItem(ADMIN_SESSION_KEY);
      if (!session) {
        console.log("No admin session, redirecting to login");
        router.replace("/admin-login" as never);
      }
    };
    void checkAuth();
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [router, fadeAnim]);

  const handleLogout = useCallback(() => {
    Alert.alert("Sign Out", "End your admin session?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem(ADMIN_SESSION_KEY);
          router.replace("/admin-login" as never);
        },
      },
    ]);
  }, [router]);

  const handleTabPress = useCallback(
    (tab: TabItem) => {
      if (tab.route) {
        router.push(tab.route as never);
      }
    },
    [router]
  );

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const result = await adminFetchAllUsers();
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    refetchInterval: 30000,
  });

  const subsQuery = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: async () => {
      const result = await adminFetchAllSubscriptions();
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    refetchInterval: 30000,
  });

  const stats = React.useMemo(() => {
    const users = usersQuery.data ?? [];
    const subs = subsQuery.data ?? [];
    const activeSubs = subs.filter((s) => s.status === "active").length;
    const trialUsers = subs.filter((s) => s.status === "trial").length;
    const cancelledThisMonth = subs.filter((s) => s.status === "cancelled").length;
    const monthlyRevenue = subs.reduce((sum, s) => {
      if (s.status === "active") {
        return sum + (s.plan_id === "monthly" ? 5.99 : s.plan_id === "yearly" ? 59.99 / 12 : 0);
      }
      return sum;
    }, 0);
    return {
      totalUsers: users.length,
      activeSubscribers: activeSubs,
      trialUsers,
      monthlyRevenue,
      monthlyGrowth: 0,
      subscriberGrowth: 0,
      cancelledThisMonth,
      failedPayments: 0,
    };
  }, [usersQuery.data, subsQuery.data]);

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View>
          <Text style={[styles.topBarTitle, { fontSize: scaledFont(20) }]}>Admin Panel</Text>
          <Text style={[styles.topBarSubtitle, { fontSize: scaledFont(11) }]}>PulmoLab Management</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} testID="admin-logout">
          <LogOut color="#ef4444" size={18} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsRow}
          >
            {TABS.map((tab) => {
              const IconComp = tab.icon;
              const isActive = tab.id === "overview";
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => handleTabPress(tab)}
                  style={[
                    styles.tabChip,
                    isActive && styles.tabChipActive,
                  ]}
                  activeOpacity={0.7}
                >
                  <IconComp color={isActive ? "#fff" : "#64748b"} size={14} />
                  <Text style={[styles.tabLabel, isActive && styles.tabLabelActive, { fontSize: scaledFont(11) }]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.statsGrid}>
            <StatCard
              title="Total Users"
              value={String(stats.totalUsers)}
              icon={Users}
              iconColor="#22d3ee"
              iconBg="rgba(34,211,238,0.12)"
              trend={`+${stats.monthlyGrowth}%`}
              trendPositive
            />
            <StatCard
              title="Active Subs"
              value={String(stats.activeSubscribers)}
              icon={UserCheck}
              iconColor="#10b981"
              iconBg="rgba(16,185,129,0.12)"
              trend={`+${stats.subscriberGrowth}%`}
              trendPositive
            />
            <StatCard
              title="Free Trial"
              value={String(stats.trialUsers)}
              icon={Clock}
              iconColor="#f59e0b"
              iconBg="rgba(245,158,11,0.12)"
            />
            <StatCard
              title="Monthly Revenue"
              value={`$${stats.monthlyRevenue.toFixed(2)}`}
              icon={DollarSign}
              iconColor="#0d9488"
              iconBg="rgba(13,148,136,0.12)"
              subtitle="Estimated MRR"
            />
            <StatCard
              title="Cancelled"
              value={String(stats.cancelledThisMonth)}
              subtitle="This month"
              icon={XCircle}
              iconColor="#f97316"
              iconBg="rgba(249,115,22,0.12)"
            />
            <StatCard
              title="Failed Payments"
              value={String(stats.failedPayments)}
              subtitle="Requires attention"
              icon={AlertTriangle}
              iconColor="#ef4444"
              iconBg="rgba(239,68,68,0.12)"
            />
          </View>

          <MiniBarChart totalUsers={stats.totalUsers} totalSubs={stats.activeSubscribers + stats.trialUsers} />

          <View style={styles.quickActions}>
            <Text style={[styles.sectionTitle, { fontSize: scaledFont(12) }]}>QUICK ACTIONS</Text>
            {TABS.filter((t) => t.route).map((tab) => {
              const IconComp = tab.icon;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => handleTabPress(tab)}
                  style={styles.actionRow}
                  activeOpacity={0.7}
                >
                  <View style={styles.actionLeft}>
                    <View style={styles.actionIcon}>
                      <IconComp color="#22d3ee" size={18} />
                    </View>
                    <Text style={styles.actionLabel}>{tab.label}</Text>
                  </View>
                  <Text style={styles.actionArrow}>›</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0c1222" },
  flex: { flex: 1 },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1d27",
  },
  topBarTitle: { color: "#e8eaf0", fontWeight: "800" as const, letterSpacing: -0.5 },
  topBarSubtitle: { color: "#64748b", marginTop: 2 },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(239,68,68,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: 16 },
  tabsRow: { gap: 8, paddingBottom: 16, paddingHorizontal: 2 },
  tabChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#1a1d27",
    borderWidth: 1,
    borderColor: "#2a2e3d",
  },
  tabChipActive: {
    backgroundColor: "#0d9488",
    borderColor: "#0d9488",
  },
  tabLabel: { color: "#64748b", fontWeight: "600" as const },
  tabLabelActive: { color: "#fff" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    width: (SCREEN_WIDTH - 42) / 2,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  statHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  trendText: { fontSize: 10, fontWeight: "700" as const },
  statValue: { color: "#e8eaf0", fontSize: 22, fontWeight: "800" as const, letterSpacing: -0.5 },
  statTitle: { color: "#94a3b8", fontSize: 12, fontWeight: "500" as const, marginTop: 4 },
  statSubtitle: { color: "#4a5568", fontSize: 10, marginTop: 2 },
  chartCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  chartHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  chartTitle: { color: "#e8eaf0", fontSize: 14, fontWeight: "700" as const },
  chartLegend: { flexDirection: "row", gap: 16, marginBottom: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: "#64748b", fontSize: 11 },
  chartBars: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: 100,
  },
  barGroup: { alignItems: "center" },
  barPair: { flexDirection: "row", alignItems: "flex-end", gap: 2 },
  bar: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  barLabel: { color: "#64748b", fontSize: 10, marginTop: 6, fontWeight: "500" as const },
  quickActions: {
    backgroundColor: "#1a1d27",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2a2e3d",
    overflow: "hidden" as const,
  },
  sectionTitle: {
    color: "#64748b",
    fontWeight: "700" as const,
    letterSpacing: 2,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: "#252936",
  },
  actionLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  actionIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "rgba(34,211,238,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { color: "#e8eaf0", fontSize: 13, fontWeight: "600" as const },
  actionArrow: { color: "#4a5568", fontSize: 18 },
});
