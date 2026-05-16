import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  Crown,
  Clock,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  RefreshCw,
  Users,
} from "lucide-react-native";
import { useTheme } from "@/providers/ThemeProvider";
import { adminFetchAllUsers, adminFetchAllSubscriptions } from "@/utils/adminApi";
import type { UsersRecord } from "@/utils/supabaseDb";

type SubFilter = "all" | "active" | "trial" | "expired" | "cancelled";

const FILTERS: { id: SubFilter; label: string; color: string }[] = [
  { id: "all", label: "All", color: "#22d3ee" },
  { id: "active", label: "Active", color: "#10b981" },
  { id: "trial", label: "Trial", color: "#f59e0b" },
  { id: "expired", label: "Expired", color: "#ef4444" },
  { id: "cancelled", label: "Cancelled", color: "#f97316" },
];

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface MergedSubUser {
  userId: string;
  fullName: string;
  email: string;
  status: string;
  planId: string | null;
  expiresAt: string | null;
  trialEndsAt: string | null;
  updatedAt: string;
}

const SUB_ICONS: Record<string, React.ComponentType<{ color: string; size: number }>> = {
  active: Crown,
  trial: Clock,
  expired: XCircle,
  cancelled: AlertTriangle,
  none: CreditCard,
};

function SubscriptionCard({ item }: { item: MergedSubUser }) {
  const IconComp = SUB_ICONS[item.status] ?? CreditCard;
  const statusColors: Record<string, { bg: string; text: string }> = {
    active: { bg: "rgba(16,185,129,0.15)", text: "#10b981" },
    trial: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b" },
    expired: { bg: "rgba(239,68,68,0.15)", text: "#ef4444" },
    cancelled: { bg: "rgba(249,115,22,0.15)", text: "#f97316" },
    none: { bg: "rgba(100,116,139,0.15)", text: "#64748b" },
  };
  const sc = statusColors[item.status] ?? statusColors.none;

  return (
    <View style={styles.subCard}>
      <View style={styles.subCardTop}>
        <View style={[styles.subIconWrap, { backgroundColor: sc.bg }]}>
          <IconComp color={sc.text} size={18} />
        </View>
        <View style={styles.subCardInfo}>
          <Text style={styles.subCardName} numberOfLines={1}>{item.fullName || "Unnamed User"}</Text>
          <Text style={styles.subCardEmail} numberOfLines={1}>{item.email}</Text>
        </View>
        <View style={[styles.subStatusBadge, { backgroundColor: sc.bg }]}>
          <Text style={[styles.subStatusText, { color: sc.text }]}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.subCardBottom}>
        <View style={styles.subDetail}>
          <Text style={styles.subDetailLabel}>Plan</Text>
          <Text style={styles.subDetailValue}>
            {item.planId ? item.planId.charAt(0).toUpperCase() + item.planId.slice(1) : "None"}
          </Text>
        </View>
        <View style={styles.subDetail}>
          <Text style={styles.subDetailLabel}>
            {item.status === "trial" ? "Trial Ends" : "Renewal"}
          </Text>
          <Text style={styles.subDetailValue}>
            {item.status === "trial" ? formatDate(item.trialEndsAt) : formatDate(item.expiresAt)}
          </Text>
        </View>
        <View style={styles.subDetail}>
          <Text style={styles.subDetailLabel}>Amount</Text>
          <Text style={styles.subDetailValue}>
            {item.planId === "monthly" ? "$5.99/mo" : item.planId === "yearly" ? "$59.99/yr" : "—"}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function AdminSubscriptionsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { scaledFont } = useTheme();
  const [filter, setFilter] = useState<SubFilter>("all");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const result = await adminFetchAllUsers();
      if (result.error) throw new Error(result.error);
      return result.data;
    },
  });

  const subsQuery = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: async () => {
      const result = await adminFetchAllSubscriptions();
      if (result.error) {
        console.error("[AdminSubs] Error fetching subscriptions:", result.error);
        throw new Error(result.error);
      }
      console.log("[AdminSubs] Loaded", result.data.length, "subscriptions from database");
      return result.data;
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const mergedData = useMemo(() => {
    const users = usersQuery.data ?? [];
    const subs = subsQuery.data ?? [];
    const userMap = new Map<string, UsersRecord>();
    users.forEach((u) => userMap.set(u.id, u));

    const merged: MergedSubUser[] = subs
      .filter((s) => s.status !== "none")
      .map((s) => {
        const user = userMap.get(s.user_id);
        return {
          userId: s.user_id,
          fullName: user?.full_name ?? "Unknown User",
          email: user?.email ?? "—",
          status: s.status,
          planId: s.plan_id,
          expiresAt: s.expires_at,
          trialEndsAt: s.trial_ends_at,
          updatedAt: s.updated_at,
        };
      });

    return merged;
  }, [usersQuery.data, subsQuery.data]);

  const filtered = useMemo(() => {
    if (filter === "all") return mergedData;
    return mergedData.filter((s) => s.status === filter);
  }, [filter, mergedData]);

  const summary = useMemo(() => {
    const active = mergedData.filter((s) => s.status === "active").length;
    const trial = mergedData.filter((s) => s.status === "trial").length;
    const expired = mergedData.filter((s) => s.status === "expired").length;
    const cancelled = mergedData.filter((s) => s.status === "cancelled").length;
    const monthlyRev = mergedData.reduce((sum, s) => {
      if (s.status === "active") {
        return sum + (s.planId === "monthly" ? 5.99 : s.planId === "yearly" ? 59.99 / 12 : 0);
      }
      return sum;
    }, 0);
    return { active, trial, expired, cancelled, monthlyRev };
  }, [mergedData]);

  const isLoading = usersQuery.isLoading || subsQuery.isLoading;
  const isError = usersQuery.isError || subsQuery.isError;
  const isFetching = usersQuery.isFetching || subsQuery.isFetching;

  const handleRefresh = useCallback(() => {
    console.log("[AdminSubs] Manual refresh triggered");
    void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
  }, [queryClient]);

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: "Subscriptions",
          headerStyle: { backgroundColor: "#0c1222" },
          headerTintColor: "#e8eaf0",
          headerTitleStyle: { fontWeight: "700" as const, fontSize: 16 },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
              <ChevronLeft color="#e8eaf0" size={22} />
              <Text style={styles.backText}>Admin</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={handleRefresh} style={styles.refreshHeaderBtn} activeOpacity={0.7}>
              <RefreshCw color="#22d3ee" size={18} />
            </TouchableOpacity>
          ),
        }}
      />
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        <View style={styles.topSection}>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryChip, { backgroundColor: "rgba(16,185,129,0.12)" }]}>
              <Text style={[styles.summaryValue, { color: "#10b981" }]}>{summary.active}</Text>
              <Text style={styles.summaryLabel}>Active</Text>
            </View>
            <View style={[styles.summaryChip, { backgroundColor: "rgba(245,158,11,0.12)" }]}>
              <Text style={[styles.summaryValue, { color: "#f59e0b" }]}>{summary.trial}</Text>
              <Text style={styles.summaryLabel}>Trial</Text>
            </View>
            <View style={[styles.summaryChip, { backgroundColor: "rgba(239,68,68,0.12)" }]}>
              <Text style={[styles.summaryValue, { color: "#ef4444" }]}>{summary.expired}</Text>
              <Text style={styles.summaryLabel}>Expired</Text>
            </View>
            <View style={[styles.summaryChip, { backgroundColor: "rgba(13,148,136,0.12)" }]}>
              <Text style={[styles.summaryValue, { color: "#0d9488" }]}>${summary.monthlyRev.toFixed(0)}</Text>
              <Text style={styles.summaryLabel}>MRR</Text>
            </View>
          </View>

          <View style={styles.filterRow}>
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f.id}
                onPress={() => setFilter(f.id)}
                style={[
                  styles.filterChip,
                  filter === f.id && { backgroundColor: f.color, borderColor: f.color },
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterLabel,
                    filter === f.id && styles.filterLabelActive,
                    { fontSize: scaledFont(11) },
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.countRow}>
            <Text style={styles.countText}>
              {isLoading ? "Loading..." : `${filtered.length} subscription${filtered.length !== 1 ? "s" : ""}`}
            </Text>
            {isFetching && !isLoading ? (
              <ActivityIndicator size="small" color="#22d3ee" style={styles.fetchingIndicator} />
            ) : null}
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#22d3ee" />
            <Text style={styles.loadingText}>Loading subscriptions...</Text>
          </View>
        ) : isError ? (
          <View style={styles.errorState}>
            <Text style={styles.errorText}>Failed to load subscriptions</Text>
            <TouchableOpacity onPress={handleRefresh} style={styles.retryBtn}>
              <RefreshCw color="#22d3ee" size={16} />
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isFetching && !isLoading}
                onRefresh={handleRefresh}
                tintColor="#22d3ee"
                colors={["#22d3ee"]}
              />
            }
          >
            {filtered.map((item) => (
              <SubscriptionCard key={item.userId} item={item} />
            ))}
            {filtered.length === 0 && !isLoading && (
              <View style={styles.emptyState}>
                <Users color="#2a2e3d" size={48} />
                <Text style={styles.emptyText}>
                  {filter !== "all" ? "No subscriptions match this filter" : "No subscriptions found"}
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0c1222" },
  flex: { flex: 1 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2, marginLeft: -8 },
  backText: { color: "#e8eaf0", fontSize: 16, fontWeight: "500" as const },
  refreshHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(34,211,238,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: -4,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  summaryChip: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  summaryValue: { fontSize: 15, fontWeight: "800" as const },
  summaryLabel: { color: "#64748b", fontSize: 9, marginTop: 1, fontWeight: "500" as const },
  topSection: { flexShrink: 0 },
  filterRow: { flexDirection: "row" as const, gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#1a1d27",
    borderWidth: 1,
    borderColor: "#2a2e3d",
    alignSelf: "center" as const,
  },
  filterLabel: { color: "#64748b", fontWeight: "600" as const },
  filterLabelActive: { color: "#fff" },
  countRow: { paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center" },
  countText: { color: "#64748b", fontSize: 12, fontWeight: "600" as const },
  fetchingIndicator: { marginLeft: 8 },
  list: { paddingHorizontal: 16, gap: 10 },
  subCard: {
    backgroundColor: "#1a1d27",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2a2e3d",
    padding: 16,
  },
  subCardTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  subIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  subCardInfo: { flex: 1 },
  subCardName: { color: "#e8eaf0", fontSize: 14, fontWeight: "700" as const },
  subCardEmail: { color: "#4a5568", fontSize: 11, marginTop: 2 },
  subStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  subStatusText: { fontSize: 10, fontWeight: "700" as const, textTransform: "uppercase" as const },
  subCardBottom: {
    flexDirection: "row",
    backgroundColor: "#252936",
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  subDetail: { flex: 1, alignItems: "center" },
  subDetailLabel: { color: "#4a5568", fontSize: 9, fontWeight: "600" as const, textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 4 },
  subDetailValue: { color: "#a0aec0", fontSize: 12, fontWeight: "600" as const },
  emptyState: { paddingVertical: 60, alignItems: "center", gap: 12 },
  emptyText: { color: "#4a5568", fontSize: 14 },
  loadingState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingTop: 80 },
  loadingText: { color: "#64748b", fontSize: 14 },
  errorState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 80 },
  errorText: { color: "#ef4444", fontSize: 16, fontWeight: "600" as const },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(34,211,238,0.1)",
    borderWidth: 1,
    borderColor: "rgba(34,211,238,0.3)",
    marginTop: 8,
  },
  retryBtnText: { color: "#22d3ee", fontSize: 13, fontWeight: "600" as const },
});
