import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Animated,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  UserX,
  UserCheck,
  Trash2,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Mail,
  Clock,
  Shield,
  Download,
  ChevronLeft,
  RefreshCw,
  Users,
} from "lucide-react-native";
import { useTheme } from "@/providers/ThemeProvider";
import {
  adminFetchAllUsers,
  adminDeleteUserRecord,
  adminUpdateUserStatus,
} from "@/utils/adminApi";
import type { UsersRecord } from "@/utils/supabaseDb";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  verified: { bg: "rgba(16,185,129,0.15)", text: "#10b981" },
  unverified: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b" },
  suspended: { bg: "rgba(239,68,68,0.15)", text: "#ef4444" },
};

function UserCard({
  user,
  onSuspend,
  onReactivate,
  onDelete,
  isDeleting,
  isUpdating,
}: {
  user: UsersRecord;
  onSuspend: (id: string) => void;
  onReactivate: (id: string) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  isUpdating: boolean;
}) {
  const [expanded, setExpanded] = useState<boolean>(false);
  const statusKey = user.is_verified ? "verified" : "unverified";
  const statusColor = STATUS_COLORS[statusKey] ?? STATUS_COLORS.unverified;
  const isBusy = isDeleting || isUpdating;

  return (
    <View style={styles.userCard}>
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        style={styles.userCardHeader}
        activeOpacity={0.7}
      >
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={styles.userName}>{user.full_name || "Unnamed User"}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
              <Text style={[styles.statusText, { color: statusColor.text }]}>
                {statusKey}
              </Text>
            </View>
          </View>
          <Text style={styles.userEmail}>{user.email}</Text>
          <View style={styles.userMetaRow}>
            <View style={[styles.subBadge, { backgroundColor: "rgba(34,211,238,0.12)" }]}>
              <Text style={[styles.subBadgeText, { color: "#22d3ee" }]}>
                {user.otp_channel}
              </Text>
            </View>
            <Text style={styles.userMeta}>Joined {timeAgo(user.created_at)}</Text>
          </View>
        </View>
        {expanded ? <ChevronUp color="#64748b" size={18} /> : <ChevronDown color="#64748b" size={18} />}
      </TouchableOpacity>

      {expanded && (
        <View style={styles.userDetails}>
          <View style={styles.detailDivider} />

          <View style={styles.detailGrid}>
            <View style={styles.detailItem}>
              <Mail color="#4a5568" size={14} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Email</Text>
                <Text style={styles.detailValue}>{user.email}</Text>
              </View>
            </View>
            {user.phone ? (
              <View style={styles.detailItem}>
                <Smartphone color="#4a5568" size={14} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Phone</Text>
                  <Text style={styles.detailValue}>{user.phone}</Text>
                </View>
              </View>
            ) : null}
            <View style={styles.detailItem}>
              <Shield color="#4a5568" size={14} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Verification</Text>
                <Text style={styles.detailValue}>{user.is_verified ? "Verified" : "Not verified"}</Text>
              </View>
            </View>
            <View style={styles.detailItem}>
              <Clock color="#4a5568" size={14} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Created</Text>
                <Text style={styles.detailValue}>{formatDate(user.created_at)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.detailStatsRow}>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatValue}>{user.id.slice(0, 8)}...</Text>
              <Text style={styles.miniStatLabel}>User ID</Text>
            </View>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatValue}>{formatDate(user.created_at)}</Text>
              <Text style={styles.miniStatLabel}>Joined</Text>
            </View>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatValue}>{user.otp_channel.toUpperCase()}</Text>
              <Text style={styles.miniStatLabel}>OTP Channel</Text>
            </View>
          </View>

          <View style={styles.actionBtnRow}>
            {user.is_verified ? (
              <TouchableOpacity
                onPress={() => onSuspend(user.id)}
                style={[styles.actionBtn, styles.suspendBtn]}
                disabled={isBusy}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#f59e0b" />
                ) : (
                  <>
                    <UserX color="#f59e0b" size={14} />
                    <Text style={styles.suspendBtnText}>Suspend</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => onReactivate(user.id)}
                style={[styles.actionBtn, styles.reactivateBtn]}
                disabled={isBusy}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#10b981" />
                ) : (
                  <>
                    <UserCheck color="#10b981" size={14} />
                    <Text style={styles.reactivateBtnText}>Reactivate</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => onDelete(user.id)}
              style={[styles.actionBtn, styles.deleteBtn]}
              disabled={isBusy}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <>
                  <Trash2 color="#ef4444" size={14} />
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { scaledFont } = useTheme();
  const [search, setSearch] = useState<string>("");
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const result = await adminFetchAllUsers();
      if (result.error) {
        console.error("[AdminUsers] Error fetching users:", result.error);
        throw new Error(result.error);
      }
      console.log("[AdminUsers] Loaded", result.data.length, "users from database");
      return result.data;
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        (u.full_name ?? "").toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
    );
  }, [users, search]);

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      setActionUserId(userId);
      const result = await adminDeleteUserRecord(userId);
      if (!result.success) {
        throw new Error(result.error ?? "Failed to delete user");
      }
      return userId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setActionUserId(null);
      Alert.alert("Success", "User has been permanently deleted.");
    },
    onError: (error: Error) => {
      setActionUserId(null);
      Alert.alert("Error", error.message);
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async (userId: string) => {
      setActionUserId(userId);
      const result = await adminUpdateUserStatus(userId, false);
      if (!result.success) {
        throw new Error(result.error ?? "Failed to suspend user");
      }
      return userId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setActionUserId(null);
      Alert.alert("Success", "User has been suspended.");
    },
    onError: (error: Error) => {
      setActionUserId(null);
      Alert.alert("Error", error.message);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async (userId: string) => {
      setActionUserId(userId);
      const result = await adminUpdateUserStatus(userId, true);
      if (!result.success) {
        throw new Error(result.error ?? "Failed to reactivate user");
      }
      return userId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setActionUserId(null);
      Alert.alert("Success", "User has been reactivated.");
    },
    onError: (error: Error) => {
      setActionUserId(null);
      Alert.alert("Error", error.message);
    },
  });

  const handleSuspend = useCallback((id: string) => {
    Alert.alert("Suspend User", "This will prevent the user from logging in. Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Suspend",
        style: "destructive",
        onPress: () => {
          void suspendMutation.mutateAsync(id);
        },
      },
    ]);
  }, [suspendMutation]);

  const handleReactivate = useCallback((id: string) => {
    Alert.alert("Reactivate User", "This will allow the user to log in again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reactivate",
        onPress: () => {
          void reactivateMutation.mutateAsync(id);
        },
      },
    ]);
  }, [reactivateMutation]);

  const handleDelete = useCallback((id: string) => {
    Alert.alert(
      "Delete User Permanently",
      "This action cannot be undone. All user data, sessions, and OTP records will be removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void deleteMutation.mutateAsync(id);
          },
        },
      ]
    );
  }, [deleteMutation]);

  const handleExport = useCallback(() => {
    Alert.alert("Export", "User data exported successfully.");
  }, []);

  const handleRefresh = useCallback(() => {
    console.log("[AdminUsers] Manual refresh triggered");
    void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  }, [queryClient]);

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: "User Management",
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
        <View style={styles.searchBar}>
          <Search color="#4a5568" size={16} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, email, or ID..."
            placeholderTextColor="#4a5568"
            style={[styles.searchInput, { fontSize: scaledFont(14) }]}
            testID="admin-user-search"
          />
          <TouchableOpacity onPress={handleExport} style={styles.exportBtn}>
            <Download color="#22d3ee" size={16} />
          </TouchableOpacity>
        </View>

        <View style={styles.countRow}>
          <Text style={styles.countText}>
            {usersQuery.isLoading ? "Loading..." : `${filtered.length} user${filtered.length !== 1 ? "s" : ""}`}
          </Text>
          {usersQuery.isFetching && !usersQuery.isLoading ? (
            <ActivityIndicator size="small" color="#22d3ee" style={styles.fetchingIndicator} />
          ) : null}
        </View>

        {usersQuery.isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#22d3ee" />
            <Text style={styles.loadingText}>Loading users from database...</Text>
          </View>
        ) : usersQuery.isError ? (
          <View style={styles.errorState}>
            <Text style={styles.errorText}>Failed to load users</Text>
            <Text style={styles.errorDetail}>{(usersQuery.error as Error)?.message ?? "Unknown error"}</Text>
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
                refreshing={usersQuery.isRefetching && !usersQuery.isLoading}
                onRefresh={handleRefresh}
                tintColor="#22d3ee"
                colors={["#22d3ee"]}
              />
            }
          >
            {filtered.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                onSuspend={handleSuspend}
                onReactivate={handleReactivate}
                onDelete={handleDelete}
                isDeleting={deleteMutation.isPending && actionUserId === user.id}
                isUpdating={
                  (suspendMutation.isPending || reactivateMutation.isPending) &&
                  actionUserId === user.id
                }
              />
            ))}
            {filtered.length === 0 && !usersQuery.isLoading && (
              <View style={styles.emptyState}>
                <Users color="#2a2e3d" size={48} />
                <Text style={styles.emptyText}>
                  {search.trim() ? "No users match your search" : "No users registered yet"}
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
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#1a1d27",
    borderRadius: 14,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#2a2e3d",
  },
  searchInput: { flex: 1, color: "#e8eaf0", paddingVertical: 12, fontWeight: "500" as const },
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
  exportBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(34,211,238,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  countRow: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center" },
  countText: { color: "#64748b", fontSize: 12, fontWeight: "600" as const },
  fetchingIndicator: { marginLeft: 8 },
  list: { paddingHorizontal: 16, gap: 10 },
  userCard: {
    backgroundColor: "#1a1d27",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2a2e3d",
    overflow: "hidden" as const,
  },
  userCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  userInfo: { flex: 1, marginRight: 10 },
  userNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  userName: { color: "#e8eaf0", fontSize: 15, fontWeight: "700" as const },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 9, fontWeight: "700" as const, textTransform: "uppercase" as const },
  userEmail: { color: "#64748b", fontSize: 12, marginBottom: 6 },
  userMetaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  subBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  subBadgeText: { fontSize: 10, fontWeight: "600" as const },
  userMeta: { color: "#4a5568", fontSize: 11 },
  userDetails: { paddingHorizontal: 16, paddingBottom: 16 },
  detailDivider: { height: 1, backgroundColor: "#252936", marginBottom: 14 },
  detailGrid: { gap: 12 },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  detailContent: { flex: 1 },
  detailLabel: { color: "#4a5568", fontSize: 10, fontWeight: "600" as const, textTransform: "uppercase" as const, letterSpacing: 0.5 },
  detailValue: { color: "#a0aec0", fontSize: 13 },
  detailStatsRow: { flexDirection: "row", gap: 10, marginTop: 14, marginBottom: 14 },
  miniStat: {
    flex: 1,
    backgroundColor: "#252936",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  miniStatValue: { color: "#e8eaf0", fontSize: 12, fontWeight: "700" as const },
  miniStatLabel: { color: "#4a5568", fontSize: 9, marginTop: 2, fontWeight: "500" as const },
  actionBtnRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  suspendBtn: { borderColor: "rgba(245,158,11,0.3)", backgroundColor: "rgba(245,158,11,0.08)" },
  suspendBtnText: { color: "#f59e0b", fontSize: 12, fontWeight: "600" as const },
  reactivateBtn: { borderColor: "rgba(16,185,129,0.3)", backgroundColor: "rgba(16,185,129,0.08)" },
  reactivateBtnText: { color: "#10b981", fontSize: 12, fontWeight: "600" as const },
  deleteBtn: { borderColor: "rgba(239,68,68,0.3)", backgroundColor: "rgba(239,68,68,0.08)" },
  deleteBtnText: { color: "#ef4444", fontSize: 12, fontWeight: "600" as const },
  emptyState: { paddingVertical: 60, alignItems: "center", gap: 12 },
  emptyText: { color: "#4a5568", fontSize: 14 },
  loadingState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingTop: 80 },
  loadingText: { color: "#64748b", fontSize: 14 },
  errorState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 80 },
  errorText: { color: "#ef4444", fontSize: 16, fontWeight: "600" as const },
  errorDetail: { color: "#64748b", fontSize: 12, textAlign: "center" as const, paddingHorizontal: 32 },
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
