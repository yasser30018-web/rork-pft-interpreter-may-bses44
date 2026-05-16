import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Wind, TrendingDown, Zap, AlertTriangle, Search, Cloud, CheckCircle, Clipboard } from "lucide-react-native";
import type { SeverityInfo, CombinedPattern } from "@/types/pft";
import { PATTERN_INFO } from "@/constants/pftData";
import { useTheme } from "@/providers/ThemeProvider";

interface PatternBannerProps {
  pattern: CombinedPattern;
  severity: SeverityInfo | null;
}

const ICON_MAP: Record<string, React.ComponentType<{ color: string; size: number }>> = {
  wind: Wind,
  "trending-down": TrendingDown,
  zap: Zap,
  "alert-triangle": AlertTriangle,
  search: Search,
  cloud: Cloud,
  "check-circle": CheckCircle,
  clipboard: Clipboard,
};

export default React.memo(function PatternBanner({ pattern, severity }: PatternBannerProps) {
  const { colors, scaledFont } = useTheme();
  const info = PATTERN_INFO[pattern ?? "empty"] ?? PATTERN_INFO.empty;
  const IconComponent = ICON_MAP[info.icon] ?? Clipboard;

  return (
    <View style={[styles.container, { borderColor: info.color + "50" }]}>
      <View style={[styles.innerGlow, { backgroundColor: info.color + "15" }]} />
      <View style={styles.content}>
        <IconComponent color={info.color} size={32} />
        <Text style={[styles.label, { color: info.color, fontSize: scaledFont(22) }]}>{info.label}</Text>
        <Text style={[styles.desc, { color: colors.textMuted, fontSize: scaledFont(12) }]}>{info.desc}</Text>
        {severity && (
          <View style={[styles.severityBadge, { backgroundColor: severity.bg, borderColor: severity.color + "40" }]}>
            <Text style={[styles.severityLabel, { color: severity.color, fontSize: scaledFont(9) }]}>SEVERITY (FEV1)</Text>
            <Text style={[styles.severityValue, { color: severity.color, fontSize: scaledFont(18) }]}>{severity.label}</Text>
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { borderRadius: 18, marginBottom: 12, borderWidth: 1, overflow: "hidden" as const, position: "relative" as const },
  innerGlow: { ...StyleSheet.absoluteFillObject },
  content: { padding: 20, alignItems: "flex-start" },
  label: { fontWeight: "800" as const, marginTop: 8, letterSpacing: -0.5 },
  desc: { marginTop: 4, lineHeight: 18 },
  severityBadge: { marginTop: 14, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  severityLabel: { letterSpacing: 1, fontWeight: "600" as const },
  severityValue: { fontWeight: "700" as const, marginTop: 2 },
});
