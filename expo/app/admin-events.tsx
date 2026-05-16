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
  PlayCircle,
  CreditCard,
  RefreshCw,
  XCircle,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ScrollText,
  ShieldAlert,
  KeyRound,
  LogIn,
  LogOut,
  UserPlus,
} from "lucide-react-native";
import { useTheme } from "@/providers/ThemeProvider";
import { adminFetchAuthEvents, adminFetchAllUsers } from "@/utils/adminApi";
import type { AuthEventRecord } from "@/utils/supabaseDb";

type EventFilter = "all" | "login" | "signup" | "otp" | "session" | "admin" | "other";

const EVENT_TYPE_MAP: Record<string, { label: string; color: string; icon: React.ComponentType<{ color: string; size: number }>; category: EventFilter }> = {
  login_attempt: { label: "Login Attempt", color: "#22d3ee", icon: LogIn, category: "login" },
  login_failed: { label: "Login Failed", color: "#ef4444", icon: AlertTriangle, category: "login" },
  login_blocked_unverified: { label: "Login Blocked", color: "#ef4444", icon: ShieldAlert, category: "login" },
  signup: { label: "New Signup", color: "#10b981", icon: UserPlus, category: "signup" },
  otp_verified: { label: "OTP Verified", color: "#10b981", icon: KeyRound, category: "otp" },
  device_otp_sent: { label: "Device OTP Sent", color: "#f59e0b", icon: KeyRound, category: "otp" },
  device_verified: { label: "Device Verified", color: "#10b981", icon: KeyRound, category: "otp" },
  session_created: { label: "Session Created", color: "#0d9488", icon: PlayCircle, category: "session" },
  session_terminated: { label: "Session Terminated", color: "#f97316", icon: XCircle, category: "session" },
  session_kicked: { label: "Session Kicked", color: "#ef4444", icon: XCircle, category: "session" },
  session_expired_401: { label: "Session Expired", color: "#64748b", icon: Clock, category: "session" },
  logout: { label: "Logout", color: "#64748b", icon: LogOut, category: "session" },
  admin_delete_user: { label: "Admin Delete User", color: "#ef4444", icon: ShieldAlert, category: "admin" },
  admin_suspend_user: { label: "Admin Suspend", color: "#f59e0b", icon: ShieldAlert, category: "admin" },
  admin_reactivate_user: { label: "Admin Reactivate", color: "#10b981", icon: ShieldAlert, category: "admin" },
  session_terminated_notification: { label: "Termination Notice", color: "#f97316", icon: CreditCard, category: "session" },
};

const DEFAULT_META = { label: "Event", color: "#64748b", icon: ScrollText, category: "other" as EventFilter };

const FILTER_OPTIONS: { id: EventFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "login", label: "Login" },
  { id: "signup", label: "Signup" },
  { id: "otp", label: "OTP" },
  { id: "session", label: "Session" },
  { id: "admin", label: "Admin" },
];

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) return "Just now";
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function EventCard({ event, userName }: { event: AuthEventRecord; userName: string }) {
  const meta = EVENT_TYPE_MAP[event.event_type] ?? DEFAULT_META;
  const IconComp = meta.icon;

  return (
    <View style={styles.eventCard}>
      <View style={[styles.eventIconWrap, { backgroundColor: meta.color + "18" }]}>
        <IconComp color={meta.color} size={16} />
      </View>
      <View style={styles.eventContent}>
        <View style={styles.eventTopRow}>
          <Text style={[styles.eventLabel, { color: meta.color }]}>{meta.label}</Text>
          <Text style={styles.eventTime}>{formatTimestamp(event.created_at)}</Text>
        </View>
        <Text style={styles.eventUser}>{userName}</Text>
        <Text style={styles.eventDetails} numberOfLines={2}>{event.details}</Text>
      </View>
    </View>
  );
}

export default function AdminEventsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { scaledFont } = useTheme();
  const [filter, setFilter] = useState<EventFilter>("all");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const eventsQuery = useQuery({
    queryKey: ["admin-auth-events"],
    queryFn: async () => {
      const result = await adminFetchAuthEvents(200);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const result = await adminFetchAllUsers();
      if (result.error) throw new Error(result.error);
      return result.data;
    },
  });

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    (usersQuery.data ?? []).forEach((u) => map.set(u.id, u.full_name || u.email));
    return map;
  }, [usersQuery.data]);

  const filtered = useMemo(() => {
    const events = eventsQuery.data ?? [];
    if (filter === "all") return events;
    return events.filter((e) => {
      const meta = EVENT_TYPE_MAP[e.event_type];
      return meta?.category === filter;
    });
  }, [filter, eventsQuery.data]);

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["admin-auth-events"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  }, [queryClient]);

  const isLoading = eventsQuery.isLoading;

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: "Auth Events",
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
        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map((f) => {
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
            <Text style={styles.loadingText}>Loading events...</Text>
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
              <EventCard
                key={`${event.created_at}-${index}`}
                event={event}
                userName={event.user_id ? (userMap.get(event.user_id) ?? "Unknown") : "System"}
              />
            ))}
            {filtered.length === 0 && !isLoading && (
              <View style={styles.emptyState}>
                <ScrollText color="#2a2e3d" size={48} />
                <Text style={styles.emptyText}>No events found</Text>
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
  filterRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
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
  countRow: { paddingHorizontal: 16, paddingVertical: 8, flexDirection: "row", alignItems: "center" },
  countText: { color: "#4a5568", fontSize: 12, fontWeight: "600" as const },
  fetchingIndicator: { marginLeft: 8 },
  list: { paddingHorizontal: 16, gap: 8 },
  eventCard: {
    backgroundColor: "#1a1d27",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2a2e3d",
    flexDirection: "row",
    padding: 14,
    gap: 12,
  },
  eventIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  eventContent: { flex: 1 },
  eventTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  eventLabel: { fontSize: 12, fontWeight: "700" as const },
  eventTime: { color: "#4a5568", fontSize: 10 },
  eventUser: { color: "#a0aec0", fontSize: 13, fontWeight: "500" as const, marginBottom: 4 },
  eventDetails: { color: "#4a5568", fontSize: 11, lineHeight: 16 },
  emptyState: { paddingVertical: 60, alignItems: "center", gap: 12 },
  emptyText: { color: "#4a5568", fontSize: 14 },
  loadingState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingTop: 80 },
  loadingText: { color: "#64748b", fontSize: 14 },
});
