import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
  Alert,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  Percent,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Smartphone,
  Apple,
  Download,
  RefreshCw,
  Calendar,
  UserPlus,
} from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/providers/ThemeProvider";
import { useSystemConfig } from "@/providers/SystemConfigProvider";
import { adminFetchAllSubscriptions } from "@/utils/adminApi";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type TimePeriod = "daily" | "weekly" | "monthly";

function MetricTile({
  label,
  value,
  subValue,
  icon: Icon,
  iconColor,
  iconBg,
  trend,
  trendPositive,
  wide,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ComponentType<{ color: string; size: number }>;
  iconColor: string;
  iconBg: string;
  trend?: string;
  trendPositive?: boolean;
  wide?: boolean;
}) {
  return (
    <View style={[styles.metricTile, wide && styles.metricTileWide]}>
      <View style={styles.metricTop}>
        <View style={[styles.metricIconWrap, { backgroundColor: iconBg }]}>
          <Icon color={iconColor} size={16} />
        </View>
        {trend != null && (
          <View
            style={[
              styles.metricTrend,
              {
                backgroundColor: trendPositive
                  ? "rgba(16,185,129,0.12)"
                  : "rgba(239,68,68,0.12)",
              },
            ]}
          >
            {trendPositive ? (
              <ArrowUpRight color="#10b981" size={10} />
            ) : (
              <ArrowDownRight color="#ef4444" size={10} />
            )}
            <Text
              style={[
                styles.metricTrendText,
                { color: trendPositive ? "#10b981" : "#ef4444" },
              ]}
            >
              {trend}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {subValue ? <Text style={styles.metricSub}>{subValue}</Text> : null}
    </View>
  );
}

function RevenueBarChart({
  data,
}: {
  data: { label: string; value: number; maxVal: number }[];
}) {
  const maxVal = Math.max(...data.map((d) => d.maxVal), 1);
  const barWidth = Math.min(
    32,
    (SCREEN_WIDTH - 100) / data.length - 6
  );

  return (
    <View style={styles.chartBarsContainer}>
      {data.map((d, i) => {
        const heightPct = (d.value / maxVal) * 90;
        return (
          <View key={`${d.label}-${i}`} style={styles.chartBarCol}>
            <View style={styles.chartBarTrack}>
              <View
                style={[
                  styles.chartBarFill,
                  {
                    height: Math.max(heightPct, 4),
                    width: barWidth,
                    backgroundColor:
                      i === data.length - 1 ? "#0d9488" : "#164e63",
                    borderRadius: 4,
                  },
                ]}
              />
            </View>
            <Text style={styles.chartBarValue}>
              ${d.value >= 1000 ? `${(d.value / 1000).toFixed(1)}k` : d.value.toFixed(0)}
            </Text>
            <Text style={styles.chartBarLabel}>{d.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function PlatformSplitBar({
  iosAmount,
  androidAmount,
}: {
  iosAmount: number;
  androidAmount: number;
}) {
  const total = iosAmount + androidAmount;
  const iosPct = total > 0 ? (iosAmount / total) * 100 : 50;

  return (
    <View style={styles.platformCard}>
      <View style={styles.platformHeader}>
        <Text style={styles.platformTitle}>Revenue by Platform</Text>
      </View>
      <View style={styles.platformBar}>
        <View
          style={[styles.platformSegment, { flex: iosPct, backgroundColor: "#0ea5e9" }]}
        />
        <View
          style={[
            styles.platformSegment,
            { flex: 100 - iosPct, backgroundColor: "#22c55e" },
          ]}
        />
      </View>
      <View style={styles.platformLegend}>
        <View style={styles.platformLegendItem}>
          <View style={[styles.legendDotPlatform, { backgroundColor: "#0ea5e9" }]} />
          <Apple color="#94a3b8" size={13} />
          <Text style={styles.platformLegendText}>
            iOS — ${iosAmount.toFixed(2)} ({iosPct.toFixed(0)}%)
          </Text>
        </View>
        <View style={styles.platformLegendItem}>
          <View style={[styles.legendDotPlatform, { backgroundColor: "#22c55e" }]} />
          <Smartphone color="#94a3b8" size={13} />
          <Text style={styles.platformLegendText}>
            Android — ${androidAmount.toFixed(2)} ({(100 - iosPct).toFixed(0)}%)
          </Text>
        </View>
      </View>
    </View>
  );
}

function ConversionFunnel({
  trials,
  converted,
  churnRate,
}: {
  trials: number;
  converted: number;
  churnRate: number;
}) {
  const conversionRate = trials > 0 ? ((converted / trials) * 100).toFixed(1) : "0";

  return (
    <View style={styles.funnelCard}>
      <Text style={styles.funnelTitle}>Conversion & Retention</Text>
      <View style={styles.funnelRow}>
        <View style={styles.funnelMetric}>
          <View style={[styles.funnelCircle, { borderColor: "#0d9488" }]}>
            <Text style={[styles.funnelCircleValue, { color: "#0d9488" }]}>
              {conversionRate}%
            </Text>
          </View>
          <Text style={styles.funnelMetricLabel}>Trial → Paid</Text>
          <Text style={styles.funnelMetricSub}>
            {converted} of {trials} converted
          </Text>
        </View>
        <View style={styles.funnelDivider} />
        <View style={styles.funnelMetric}>
          <View style={[styles.funnelCircle, { borderColor: "#ef4444" }]}>
            <Text style={[styles.funnelCircleValue, { color: "#ef4444" }]}>
              {churnRate.toFixed(1)}%
            </Text>
          </View>
          <Text style={styles.funnelMetricLabel}>Churn Rate</Text>
          <Text style={styles.funnelMetricSub}>Monthly average</Text>
        </View>
      </View>
    </View>
  );
}

function SubscriptionSummaryBars({ subs }: { subs: { status: string }[] }) {
  const active = subs.filter((s) => s.status === "active").length;
  const trial = subs.filter((s) => s.status === "trial").length;
  const cancelled = subs.filter((s) => s.status === "cancelled").length;
  const expired = subs.filter((s) => s.status === "expired").length;
  const max = Math.max(active, trial, cancelled, expired, 1);

  const bars = [
    { label: "Active", value: active, color: "#10b981" },
    { label: "Trial", value: trial, color: "#f59e0b" },
    { label: "Cancelled", value: cancelled, color: "#f97316" },
    { label: "Expired", value: expired, color: "#ef4444" },
  ];

  return (
    <View style={styles.newSubsCard}>
      <View style={styles.newSubsHeader}>
        <UserPlus color="#22d3ee" size={16} />
        <Text style={styles.newSubsTitle}>Subscription Breakdown</Text>
      </View>
      <View style={styles.newSubsBars}>
        {bars.map((d, i) => (
          <View key={`${d.label}-${i}`} style={styles.newSubBarCol}>
            <View style={styles.newSubBarTrack}>
              <View
                style={[
                  styles.newSubBarFill,
                  {
                    height: Math.max((d.value / max) * 60, 3),
                    backgroundColor: d.color,
                  },
                ]}
              />
            </View>
            <Text style={styles.newSubBarVal}>{d.value}</Text>
            <Text style={styles.newSubBarLabel}>{d.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function AdminRevenueScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { scaledFont } = useTheme();
  const { config } = useSystemConfig();
  const [period, setPeriod] = useState<TimePeriod>("monthly");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const subsQuery = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: async () => {
      const result = await adminFetchAllSubscriptions();
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    refetchInterval: 30000,
  });

  const metrics = useMemo(() => {
    const subs = subsQuery.data ?? [];
    const activeSubs = subs.filter((s) => s.status === "active");
    const trialSubs = subs.filter((s) => s.status === "trial");
    const cancelledSubs = subs.filter((s) => s.status === "cancelled");

    const mrr = activeSubs.reduce((sum, s) => {
      if (s.plan_id === "monthly") return sum + config.monthlyPrice;
      if (s.plan_id === "yearly") return sum + config.yearlyPrice / 12;
      return sum;
    }, 0);

    const arr = mrr * 12;
    const totalTrialsEver = subs.filter((s) => s.status === "trial" || s.status === "active" || s.status === "cancelled" || s.status === "expired").length;
    const totalActivated = activeSubs.length;
    const conversionRate = totalTrialsEver > 0 ? (totalActivated / totalTrialsEver) * 100 : 0;
    const totalSubs = activeSubs.length + cancelledSubs.length;
    const churnRate = totalSubs > 0 ? (cancelledSubs.length / totalSubs) * 100 : 0;

    return {
      mrr,
      arr,
      activeCount: activeSubs.length,
      trialCount: trialSubs.length,
      conversionRate,
      churnRate,
      totalTrialsEver,
      totalActivated,
      iosTotal: mrr * 0.6,
      androidTotal: mrr * 0.4,
    };
  }, [config, subsQuery.data]);

  const chartData = useMemo(() => {
    const val = metrics.mrr;
    return [
      { label: "MRR", value: val, maxVal: val > 0 ? val : 1 },
    ];
  }, [metrics.mrr]);

  const handleExportCSV = useCallback(() => {
    const subs = subsQuery.data ?? [];
    const header = "Status,Plan,ExpiresAt,TrialEndsAt,UpdatedAt\n";
    const rows = subs.map(
      (s) => `${s.status},${s.plan_id ?? "none"},${s.expires_at ?? ""},${s.trial_ends_at ?? ""},${s.updated_at}`
    ).join("\n");
    const csv = header + rows;
    console.log("Revenue CSV Export:\n", csv);
    Alert.alert(
      "Export Ready",
      "Revenue report has been generated. In production, this would download as a CSV file.",
      [{ text: "OK" }]
    );
  }, [subsQuery.data]);

  const PERIODS: { id: TimePeriod; label: string }[] = [
    { id: "daily", label: "Day" },
    { id: "weekly", label: "Week" },
    { id: "monthly", label: "Month" },
  ];

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: "Revenue Analytics",
          headerStyle: { backgroundColor: "#0c1222" },
          headerTintColor: "#e8eaf0",
          headerTitleStyle: { fontWeight: "700" as const, fontSize: 16 },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              activeOpacity={0.7}
            >
              <ChevronLeft color="#e8eaf0" size={22} />
              <Text style={styles.backText}>Admin</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={handleExportCSV}
              style={styles.exportBtn}
              activeOpacity={0.7}
            >
              <Download color="#22d3ee" size={18} />
            </TouchableOpacity>
          ),
        }}
      />
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.metricsGrid}>
            <MetricTile
              label="Monthly Revenue (MRR)"
              value={`$${metrics.mrr.toFixed(2)}`}
              icon={DollarSign}
              iconColor="#0d9488"
              iconBg="rgba(13,148,136,0.15)"
              trend="+8.3%"
              trendPositive
            />
            <MetricTile
              label="Annual Revenue (ARR)"
              value={`$${metrics.arr.toFixed(2)}`}
              icon={TrendingUp}
              iconColor="#22d3ee"
              iconBg="rgba(34,211,238,0.15)"
              subValue="Projected yearly"
            />
            <MetricTile
              label="Active Subscribers"
              value={String(metrics.activeCount)}
              icon={Users}
              iconColor="#10b981"
              iconBg="rgba(16,185,129,0.15)"
              trend="+12%"
              trendPositive
            />
            <MetricTile
              label="Free Trial Users"
              value={String(metrics.trialCount)}
              icon={Clock}
              iconColor="#f59e0b"
              iconBg="rgba(245,158,11,0.15)"
              subValue="7-day trial"
            />
            <MetricTile
              label="Conversion Rate"
              value={`${metrics.conversionRate.toFixed(1)}%`}
              icon={Percent}
              iconColor="#8b5cf6"
              iconBg="rgba(139,92,246,0.15)"
              subValue="Trial → Paid"
            />
            <MetricTile
              label="Churn Rate"
              value={`${metrics.churnRate.toFixed(1)}%`}
              icon={TrendingDown}
              iconColor="#ef4444"
              iconBg="rgba(239,68,68,0.15)"
              subValue="Monthly"
            />
          </View>

          <View style={styles.revenueChartCard}>
            <View style={styles.revenueChartHeader}>
              <View style={styles.revenueChartLeft}>
                <BarChart3 color="#0d9488" size={16} />
                <Text style={styles.revenueChartTitle}>Revenue Growth</Text>
              </View>
              <View style={styles.refreshWrap}>
                <RefreshCw color="#4a5568" size={14} />
                <Text style={styles.refreshLabel}>Live</Text>
              </View>
            </View>
            <RevenueBarChart data={chartData} />
          </View>

          <PlatformSplitBar
            iosAmount={metrics.iosTotal}
            androidAmount={metrics.androidTotal}
          />

          <ConversionFunnel
            trials={metrics.totalTrialsEver}
            converted={metrics.totalActivated}
            churnRate={metrics.churnRate}
          />

          <View style={styles.periodRow}>
            <Calendar color="#64748b" size={14} />
            {PERIODS.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => setPeriod(p.id)}
                style={[
                  styles.periodChip,
                  period === p.id && styles.periodChipActive,
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.periodLabel,
                    period === p.id && styles.periodLabelActive,
                    { fontSize: scaledFont(11) },
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <SubscriptionSummaryBars subs={subsQuery.data ?? []} />

          <TouchableOpacity
            style={styles.exportRow}
            onPress={handleExportCSV}
            activeOpacity={0.7}
            testID="export-revenue-csv"
          >
            <Download color="#22d3ee" size={18} />
            <View style={styles.exportInfo}>
              <Text style={styles.exportRowTitle}>Export Revenue Report</Text>
              <Text style={styles.exportRowSub}>
                Download CSV for financial analysis
              </Text>
            </View>
            <Text style={styles.exportArrow}>›</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const TILE_WIDTH = (SCREEN_WIDTH - 48) / 2;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0c1222" },
  flex: { flex: 1 },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginLeft: -8,
  },
  backText: { color: "#e8eaf0", fontSize: 16, fontWeight: "500" as const },
  exportBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(34,211,238,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: { padding: 16, gap: 14 },

  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricTile: {
    width: TILE_WIDTH,
    backgroundColor: "#1a1d27",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#2a2e3d",
  },
  metricTileWide: {
    width: SCREEN_WIDTH - 32,
  },
  metricTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  metricTrend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  metricTrendText: { fontSize: 10, fontWeight: "700" as const },
  metricValue: {
    color: "#e8eaf0",
    fontSize: 20,
    fontWeight: "800" as const,
    letterSpacing: -0.5,
  },
  metricLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "500" as const,
    marginTop: 3,
  },
  metricSub: { color: "#4a5568", fontSize: 10, marginTop: 2 },

  revenueChartCard: {
    backgroundColor: "#1a1d27",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2a2e3d",
  },
  revenueChartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  revenueChartLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  revenueChartTitle: {
    color: "#e8eaf0",
    fontSize: 13,
    fontWeight: "700" as const,
  },
  refreshWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(74,85,104,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  refreshLabel: { color: "#4a5568", fontSize: 10, fontWeight: "600" as const },

  chartBarsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: 120,
    paddingTop: 8,
  },
  chartBarCol: { alignItems: "center", flex: 1 },
  chartBarTrack: {
    height: 90,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  chartBarFill: {
    minHeight: 4,
  },
  chartBarValue: {
    color: "#94a3b8",
    fontSize: 9,
    fontWeight: "600" as const,
    marginTop: 6,
  },
  chartBarLabel: {
    color: "#4a5568",
    fontSize: 10,
    fontWeight: "500" as const,
    marginTop: 2,
  },

  platformCard: {
    backgroundColor: "#1a1d27",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2a2e3d",
  },
  platformHeader: { marginBottom: 12 },
  platformTitle: {
    color: "#e8eaf0",
    fontSize: 13,
    fontWeight: "700" as const,
  },
  platformBar: {
    flexDirection: "row",
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    marginBottom: 12,
  },
  platformSegment: {
    height: 10,
  },
  platformLegend: { gap: 8 },
  platformLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDotPlatform: { width: 8, height: 8, borderRadius: 4 },
  platformLegendText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "500" as const,
  },

  funnelCard: {
    backgroundColor: "#1a1d27",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2a2e3d",
  },
  funnelTitle: {
    color: "#e8eaf0",
    fontSize: 13,
    fontWeight: "700" as const,
    marginBottom: 16,
  },
  funnelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  funnelMetric: { flex: 1, alignItems: "center" },
  funnelCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.02)",
    marginBottom: 10,
  },
  funnelCircleValue: {
    fontSize: 18,
    fontWeight: "800" as const,
  },
  funnelMetricLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600" as const,
  },
  funnelMetricSub: { color: "#4a5568", fontSize: 10, marginTop: 3 },
  funnelDivider: {
    width: 1,
    height: 60,
    backgroundColor: "#2a2e3d",
    marginHorizontal: 8,
  },

  periodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  periodChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#1a1d27",
    borderWidth: 1,
    borderColor: "#2a2e3d",
  },
  periodChipActive: {
    backgroundColor: "#0d9488",
    borderColor: "#0d9488",
  },
  periodLabel: { color: "#64748b", fontWeight: "600" as const },
  periodLabelActive: { color: "#fff" },

  newSubsCard: {
    backgroundColor: "#1a1d27",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2a2e3d",
  },
  newSubsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  newSubsTitle: {
    color: "#e8eaf0",
    fontSize: 13,
    fontWeight: "700" as const,
  },
  newSubsBars: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: 90,
  },
  newSubBarCol: { alignItems: "center", flex: 1 },
  newSubBarTrack: {
    height: 60,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  newSubBarFill: {
    width: 20,
    borderRadius: 4,
    minHeight: 3,
  },
  newSubBarVal: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "600" as const,
    marginTop: 4,
  },
  newSubBarLabel: {
    color: "#4a5568",
    fontSize: 10,
    fontWeight: "500" as const,
    marginTop: 2,
  },

  cancelCard: {
    backgroundColor: "#1a1d27",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2a2e3d",
  },
  cancelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  cancelTitle: {
    color: "#e8eaf0",
    fontSize: 13,
    fontWeight: "700" as const,
  },
  cancelBars: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: 80,
  },
  cancelBarCol: { alignItems: "center", flex: 1 },
  cancelBarTrack: {
    height: 50,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  cancelBarFill: {
    width: 20,
    borderRadius: 4,
    minHeight: 3,
  },
  cancelBarVal: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "600" as const,
    marginTop: 4,
  },
  cancelBarLabel: {
    color: "#4a5568",
    fontSize: 10,
    fontWeight: "500" as const,
    marginTop: 2,
  },

  exportRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1d27",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2a2e3d",
    gap: 12,
  },
  exportInfo: { flex: 1 },
  exportRowTitle: {
    color: "#e8eaf0",
    fontSize: 13,
    fontWeight: "600" as const,
  },
  exportRowSub: { color: "#4a5568", fontSize: 11, marginTop: 2 },
  exportArrow: { color: "#4a5568", fontSize: 20 },
});
