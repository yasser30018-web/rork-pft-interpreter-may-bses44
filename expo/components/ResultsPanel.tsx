import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { RotateCcw } from "lucide-react-native";
import type { PFTResult } from "@/types/pft";
import { SEVERITY_SCALE } from "@/constants/pftData";
import { useTheme } from "@/providers/ThemeProvider";
import PatternBanner from "./PatternBanner";
import FVCurveView from "./FVCurveView";
import DifferentialCard from "./DifferentialCard";

interface ResultsPanelProps {
  result: PFTResult;
  onReset: () => void;
}

export default React.memo(function ResultsPanel({ result, onReset }: ResultsPanelProps) {
  const { colors, scaledFont } = useTheme();

  return (
    <View style={styles.container}>
      <PatternBanner pattern={result.pattern} severity={result.severity} />

      {result.fvCurve && <FVCurveView curveType={result.fvCurve} />}

      {result.bdResponse && (
        <View style={[
          styles.bdCard,
          {
            backgroundColor: result.bdResponse === "significant" ? (colors.greenBg || "#f0fdf4") : (colors.orangeBg || "#fff7ed"),
            borderColor: result.bdResponse === "significant" ? colors.green + "40" : colors.orange + "40",
          },
        ]}>
          <Text style={[styles.bdLabel, { color: colors.textDim, fontSize: scaledFont(10) }]}>BRONCHODILATOR RESPONSE</Text>
          <Text style={[
            styles.bdValue,
            { color: result.bdResponse === "significant" ? colors.green : colors.orange, fontSize: scaledFont(14) },
          ]}>
            {result.bdResponse === "significant"
              ? "Significant — Suggests Asthma"
              : "Not Significant"}
          </Text>
          <Text style={[styles.bdHint, { color: colors.textMuted, fontSize: scaledFont(10) }]}>
            {result.bdResponse === "not_significant"
              ? "Absent response does NOT exclude asthma — responsiveness varies"
              : "> 12% AND >200mL in FEV1 or FVC"}
          </Text>
        </View>
      )}

      {result.pearls.length > 0 && (
        <View style={[styles.pearlsCard, { backgroundColor: colors.bgElevated, borderColor: colors.borderAccent }]}>
          <Text style={[styles.sectionLabel, { color: colors.textDim, fontSize: scaledFont(10) }]}>CLINICAL PEARLS</Text>
          {result.pearls.map((p, i) => (
            <View key={i} style={[styles.pearlRow, { borderLeftColor: colors.accent }]}>
              <Text style={[styles.pearlText, { color: colors.textSecondary, fontSize: scaledFont(11) }]}>{p}</Text>
            </View>
          ))}
        </View>
      )}

      {result.differentials.length > 0 && (
        <View style={styles.dxSection}>
          <Text style={[styles.sectionLabel, { color: colors.textDim, fontSize: scaledFont(10) }]}>DIFFERENTIAL DIAGNOSIS</Text>
          {result.differentials.map((dx, i) => (
            <DifferentialCard key={i} dx={dx} />
          ))}
        </View>
      )}

      {result.differentials.length === 0 && result.pattern === "normal" && (
        <View style={[styles.normalCard, { backgroundColor: colors.greenBg || "#f0fdf4", borderColor: colors.green + "40" }]}>
          <Text style={styles.normalIcon}>{"✅"}</Text>
          <Text style={[styles.normalTitle, { color: colors.green, fontSize: scaledFont(18) }]}>Normal PFT</Text>
          <Text style={[styles.normalDesc, { color: colors.textMuted, fontSize: scaledFont(11) }]}>
            All entered values are within normal limits. No significant PFT abnormality detected.
          </Text>
        </View>
      )}

      <View style={[styles.severityCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.textDim, fontSize: scaledFont(10) }]}>SEVERITY SCALE (FEV1 % Predicted)</Text>
        {SEVERITY_SCALE.map(s => (
          <View key={s.label} style={[styles.severityRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.severityLabel, { color: s.color, fontSize: scaledFont(12) }]}>{s.label}</Text>
            <Text style={[styles.severityRange, { color: colors.textDim, fontSize: scaledFont(12) }]}>{s.range}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity onPress={onReset} style={[styles.resetButton, { borderColor: colors.borderAccent }]} activeOpacity={0.7}>
        <RotateCcw size={14} color={colors.textDim} />
        <Text style={[styles.resetText, { color: colors.textDim, fontSize: scaledFont(12) }]}>Reset All Values</Text>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingBottom: 40 },
  bdCard: { padding: 14, borderRadius: 12, marginBottom: 12, borderWidth: 1 },
  bdLabel: { letterSpacing: 1, fontWeight: "600" as const },
  bdValue: { marginTop: 6, fontWeight: "600" as const },
  bdHint: { marginTop: 4 },
  pearlsCard: { padding: 14, borderRadius: 12, marginBottom: 12, borderWidth: 1 },
  sectionLabel: { letterSpacing: 1.5, marginBottom: 10, fontWeight: "600" as const },
  pearlRow: { paddingLeft: 8, borderLeftWidth: 2, marginBottom: 6 },
  pearlText: { lineHeight: 16 },
  dxSection: { marginBottom: 12 },
  normalCard: { padding: 20, borderRadius: 14, borderWidth: 1, alignItems: "center", marginBottom: 12 },
  normalIcon: { fontSize: 36 },
  normalTitle: { fontWeight: "700" as const, marginTop: 8 },
  normalDesc: { marginTop: 6, textAlign: "center" as const, lineHeight: 16 },
  severityCard: { padding: 16, borderRadius: 12, marginBottom: 14, borderWidth: 1 },
  severityRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1 },
  severityLabel: { fontWeight: "500" as const },
  severityRange: { fontVariant: ["tabular-nums"] },
  resetButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 20 },
  resetText: {},
});
