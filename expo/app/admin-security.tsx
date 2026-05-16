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
  ShieldAlert,
  ShieldX,
  KeyRound,
  Lock,
  AlertOctagon,
  ChevronLeft,
  RefreshCw,
  ScrollText,
} from "lucide-react-native";
import { useTheme } from "@/providers/ThemeProvider";
import { adminFetchAuthEvents } from "@/utils/adminApi";
import type { AuthEventRecord } from "@/utils/supabaseDb";

type SecFilter = "all" | "failed" | "otp" | "session" | "admin";

const SEC_TYPE_MAP: Record<string, { label: string; color: string; icon: React.ComponentType<{ color: string; size: number }>; category: SecFilter }> = {
  login_failed: { label: "Failed Login", color: "#ef4444", icon: ShieldX, category: "failed" },
  login_blocked_unverified: { label: "Login Blocked", color: "#ef4444", icon: ShieldAlert, category: "failed" },
  otp_verified: { label: "OTP Verified", color: "#10b981", icon: KeyRound, category: "otp" },
  device_otp_sent: { label: "Device OTP Sent", color: "#f59e0b", icon: KeyRound, category: "otp" },
  device_verified: { label: "Device Verified", color: "#10b981", icon: KeyRound, category: "otp" },
  session_terminated: { label: "Session Terminated", color: "#f97316", icon: AlertOctagon, category: "session" },
  session_kicked: { label: "Session Kicked", color: "#ef4444", icon: AlertOctagon, category: "session" },
  session_expired_401: { label: "Session Expired", color: "#64748b", icon: Lock, category: "session" },
  admin_delete_user: { label: "Admin Delete", color: "#ef4444", icon: ShieldAlert, category: "admin" },
  admin_suspend_user: { label: "Admin Suspend", color: "#f59e0b", icon: ShieldAlert, category: "admin" },
  admin_reactivate_user: { label: "Admin Reactivate", color: "#10b981", icon: ShieldAlert, category: "admin" },
  session_terminated_notification: { label: "Termination Notice", color: "#f97316", icon: AlertOctagon, category: "session" },
};

const DEFAULT_META = { label: "Event", color: "#64748b", icon: ScrollText, category: "all" as SecFilter };

const SECURITY_EVENT_TYPES = new Set(Object.keys(SEC_TYPE_MAP));

const SEC_FILTERS: { id: SecFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "failed", label: "Failed Logins" },
  { id: "otp", label: "OTP" },
  { id: "session", label: "Sessions" },
  { id: "admin", label: "Admin" },
];

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffH = Math.floor((now.getTime() - d.getTime()) / 3600000);
  if (diffH < 1) return "Just now";
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function SecurityCard({ event }: { event: AuthEventRecord }) {
  const meta = SEC_TYPE_MAP[event.event_type] ?? DEFAULT_META;
  const IconComp = meta.icon;
  const [expanded, setExpanded] = useState<boolean>(false);

  return (
    <TouchableOpacity
      onPress={() => setExpanded(!expanded)}
      style={styles.secCard}
      activeOpacity={0.7}
    >
      <View style={styles.secCardTop}>
        <View style={[styles.secIconWrap, { backgroundColor: meta.color + "18" }]}>
          <IconComp color={meta.color} size={16} />
        </View>
        <View style={styles.secCardInfo}>
          <View style={styles.secTopRow}>
            <Text style={[styles.secLabel, { color: meta.color }]}>{meta.label}</Text>
            <Text style={styles.secTime}>{formatTimestamp(event.created_at)}</Text>
          </View>
          <Text style={styles.secUser} numberOfLines={1}>{event.details}</Text>
        </View>
      </View>

      {expanded && (
        <View style={styles.secDetails}>
          <View style={styles.secDivider} />
          <View style={styles.secDetailRow}>
            <Text style={styles.secDetailLabel}>Event Type</Text>
            <Text style={styles.secDetailValue}>{event.event_type}</Text>
          </View>
          <View style={styles.secDetailRow}>
            <Text style={styles.secDetailLabel}>IP Address</Text>
            <Text style={styles.secDetailValue}>{event.ip_address}</Text>
          </View>
          <View style={styles.secDetailRow}>
            <Text style={styles.secDetailLabel}>User ID</Text>
            <Text style={styles.secDetailValue}>{event.user_id ?? "N/A"}</Text>
          </View>
          <View style={styles.secDetailRow}>
            <Text style={styles.secDetailLabel}>Details</Text>
            <Text style={styles.secDetailValueWide}>{event.details}</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function AdminSecurityScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { scaledFont } = useTheme();
  const [filter, setFilter] = useState<SecFilter>("all");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const eventsQuery = useQuery({
    queryKey: ["admin-security-events"],
    queryFn: async () => {
      const result = await adminFetchAuthEvents(200);
      if (result.error) throw new Error(result.error);
      return result.data.filter((e) => SECURITY_EVENT_TYPES.has(e.event_type));
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const securityEvents = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);

  const filtered = useMemo(() => {
    if (filter === "all") return securityEvents;
    return securityEvents.filter((e) => {
      const meta = SEC_TYPE_MAP[e.event_type];
      return meta?.category === filter;
    });
  }, [filter, securityEvents]);

  const threatSummary = useMemo(() => {
    const failed = securityEvents.filter((e) => e.event_type === "login_failed" || e.event_type === "login_blocked_unverified").length;
    const sessionIssues = securityEvents.filter((e) => e.event_type === "session_kicked" || e.event_type === "session_terminated").length;
    const adminActions = securityEvents.filter((e) => e.event_type.startsWith("admin_")).length;
    return { failed, sessionIssues, adminActions };
  }, [securityEvents]);

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["admin-security-events"] });
  }, [queryClient]);

  const isLoading = eventsQuery.isLoading;

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: "Security Monitor",
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
        <View style={styles.threatRow}>
          <View style={[styles.threatChip, { backgroundColor: "rgba(239,68,68,0.12)" }]}>
            <ShieldX color="#ef4444" size={16} />
            <Text style={[styles.threatVal, { color: "#ef4444" }]}>{threatSummary.failed}</Text>
            <Text style={styles.threatLabel}>Failed</Text>
          </View>
          <View style={[styles.threatChip, { backgroundColor: "rgba(249,115,22,0.12)" }]}>
            <AlertOctagon color="#f97316" size={16} />
            <Text style={[styles.threatVal, { color: "#f97316" }]}>{threatSummary.sessionIssues}</Text>
            <Text style={styles.threatLabel}>Sessions</Text>
          </View>
          <View style={[styles.threatChip, { backgroundColor: "rgba(245,158,11,0.12)" }]}>
            <ShieldAlert color="#f59e0b" size={16} />
            <Text style={[styles.threatVal, { color: "#f59e0b" }]}>{threatSummary.adminActions}</Text>
            <Text style={styles.threatLabel}>Admin</Text>
          </View>
        </View>

        <View style={styles.filterRow}>
          {SEC_FILTERS.map((f) => {
            const isActive = filter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setFilter(f.id)}
                style={[
                  styles.filterChip,
                  isActive && { backgroundColor: "#22d3ee", borderColor: "#22d3ee" },
                ]}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterLabel, isActive && styles.filterLabelActive, { fontSize: scaledFont(11) }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.countRow}>
          <Text style={styles.countText}>
            {isLoading ? "Loading..." : `${filtered.length} event${filtered.length !== 1 ? "s" : ""}`}
          </Text>
          {eventsQuery.isFetching && !isLoading ? (
            <ActivityIndicator size="small" color="#22d3ee" style={styles.fetchingIndicator} />
          ) : null}
        </View>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#22d3ee" />
            <Text style={styles.loadingText}>Loading security events...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={eventsQuery.isRefetching && !isLoading}
                onRefresh={handleRefresh}
                tintColor="#22d3ee"
                colors={["#22d3ee"]}
              />
            }
          >
            {filtered.map((event, index) => (
              <SecurityCard key={`${event.created_at}-${index}`} event={event} />
            ))}
            {filtered.length === 0 && !isLoading && (
              <View style={styles.emptyState}>
                <ScrollText color="#2a2e3d" size={48} />
                <Text style={styles.emptyText}>No security events found</Text>
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
  threatRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  threatChip: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
    gap: 2,
  },
  threatVal: { fontSize: 16, fontWeight: "800" as const },
  threatLabel: { color: "#4a5568", fontSize: 9, fontWeight: "500" as const },
  filterRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6, paddingHorizontal: 16, paddingVertical: 10 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#1a1d27",
    borderWidth: 1,
    borderColor: "#2a2e3d",
  },
  filterLabel: { color: "#64748b", fontWeight: "600" as const },
  filterLabelActive: { color: "#fff" },
  countRow: { paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center" },
  countText: { color: "#4a5568", fontSize: 12, fontWeight: "600" as const },
  fetchingIndicator: { marginLeft: 8 },
  list: { paddingHorizontal: 16, gap: 8 },
  secCard: {
    backgroundColor: "#1a1d27",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2a2e3d",
    padding: 14,
  },
  secCardTop: { flexDirection: "row", gap: 12 },
  secIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  secCardInfo: { flex: 1 },
  secTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  secLabel: { fontSize: 12, fontWeight: "700" as const },
  secTime: { color: "#4a5568", fontSize: 10 },
  secUser: { color: "#a0aec0", fontSize: 12, fontWeight: "500" as const },
  secDetails: { marginTop: 8 },
  secDivider: { height: 1, backgroundColor: "#252936", marginBottom: 10 },
  secDetailRow: { flexDirection: "row", marginBottom: 8 },
  secDetailLabel: { color: "#4a5568", fontSize: 10, fontWeight: "600" as const, width: 80, textTransform: "uppercase" as const, letterSpacing: 0.5 },
  secDetailValue: { color: "#a0aec0", fontSize: 12, flex: 1 },
  secDetailValueWide: { color: "#a0aec0", fontSize: 12, flex: 1, lineHeight: 18 },
  emptyState: { paddingVertical: 60, alignItems: "center", gap: 12 },
  emptyText: { color: "#4a5568", fontSize: 14 },
  loadingState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingTop: 80 },
  loadingText: { color: "#64748b", fontSize: 14 },
});
