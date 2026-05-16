import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@/providers/ThemeProvider";
import type { DifferentialDiagnosis } from "@/types/pft";

interface DifferentialCardProps {
  dx: DifferentialDiagnosis;
}

export default React.memo(function DifferentialCard({ dx }: DifferentialCardProps) {
  const { colors, scaledFont } = useTheme();

  return (
    <View style={[styles.container, { borderColor: dx.color + "35", backgroundColor: dx.color + "10" }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: dx.color, fontSize: scaledFont(14) }]} numberOfLines={2}>{dx.dx}</Text>
        <View style={[styles.probBadge, { backgroundColor: dx.color + "25", borderColor: dx.color + "40" }]}>
          <Text style={[styles.probText, { color: dx.color, fontSize: scaledFont(9) }]}>{dx.prob}</Text>
        </View>
      </View>

      {dx.evidence.length > 0 && (
        <View style={styles.evidenceContainer}>
          {dx.evidence.map((e, j) => (
            <Text key={j} style={[styles.evidenceText, { color: colors.textSecondary, fontSize: scaledFont(11) }]}>{"\u2192"} {e}</Text>
          ))}
        </View>
      )}

      <View style={[styles.notesContainer, { borderLeftColor: dx.color + "60", backgroundColor: colors.bg }]}>
        <Text style={[styles.notesText, { color: colors.textMuted, fontSize: scaledFont(10) }]}>{dx.notes}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { padding: 16, borderRadius: 14, marginBottom: 10, borderWidth: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { fontWeight: "600" as const, flex: 1, paddingRight: 8 },
  probBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  probText: { fontWeight: "600" as const },
  evidenceContainer: { marginTop: 8 },
  evidenceText: { marginBottom: 3, paddingLeft: 4 },
  notesContainer: { marginTop: 8, padding: 8, paddingLeft: 10, borderRadius: 6, borderLeftWidth: 2 },
  notesText: { lineHeight: 15 },
});
