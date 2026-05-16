import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
} from "react-native";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Wrench, Calculator, Stethoscope, HeartPulse, Gauge, Ruler } from "lucide-react-native";
import { useTheme } from "@/providers/ThemeProvider";

const TOOLS = [
  { title: "6MWT Calculator", desc: "Six-minute walk test distance prediction & interpretation", icon: Ruler, color: "#f59e0b", status: "coming_soon" as const },
  { title: "BODE Index", desc: "Body-mass, airflow Obstruction, Dyspnea, Exercise capacity index for COPD", icon: Calculator, color: "#10b981", status: "coming_soon" as const },
  { title: "mMRC Dyspnea Scale", desc: "Modified Medical Research Council dyspnea grading", icon: Stethoscope, color: "#3b82f6", status: "coming_soon" as const },
  { title: "Wells Score (PE)", desc: "Clinical prediction rule for pulmonary embolism", icon: HeartPulse, color: "#ef4444", status: "coming_soon" as const },
  { title: "A-a Gradient", desc: "Alveolar-arterial oxygen gradient calculation", icon: Gauge, color: "#8b5cf6", status: "coming_soon" as const },
  { title: "O2 Delivery Calculator", desc: "Calculate oxygen delivery and content", icon: Calculator, color: "#06b6d4", status: "coming_soon" as const },
];

export default function ToolsScreen() {
  const insets = useSafeAreaInsets();
  const { colors, scaledFont } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <Stack.Screen
        options={{
          title: "Pulmo Tools",
          headerStyle: { backgroundColor: colors.bgHeader },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: "700", fontSize: 16 },
        }}
      />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={[styles.heroCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Wrench color="#f59e0b" size={40} />
            <Text style={[styles.heroTitle, { color: colors.text, fontSize: scaledFont(22) }]}>Pulmonary Tools</Text>
            <Text style={[styles.heroSubtitle, { color: colors.textMuted, fontSize: scaledFont(13) }]}>
              Clinical calculators and scoring systems for pulmonary medicine
            </Text>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textDim, fontSize: scaledFont(11) }]}>AVAILABLE TOOLS</Text>

          {TOOLS.map((tool) => {
            const IconComp = tool.icon;
            return (
              <View key={tool.title} style={[styles.toolCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <View style={[styles.toolIconContainer, { backgroundColor: tool.color + "15" }]}>
                  <IconComp color={tool.color} size={22} />
                </View>
                <View style={styles.toolContent}>
                  <View style={styles.toolTitleRow}>
                    <Text style={[styles.toolTitle, { color: colors.text, fontSize: scaledFont(14) }]}>{tool.title}</Text>
                    <View style={styles.statusBadge}>
                      <Text style={[styles.statusText, { fontSize: scaledFont(8) }]}>SOON</Text>
                    </View>
                  </View>
                  <Text style={[styles.toolDesc, { color: colors.textMuted, fontSize: scaledFont(11) }]}>{tool.desc}</Text>
                </View>
              </View>
            );
          })}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: 16 },
  heroCard: { borderRadius: 20, padding: 28, alignItems: "center", borderWidth: 1, marginBottom: 24 },
  heroTitle: { fontWeight: "800" as const, marginTop: 14, letterSpacing: -0.5 },
  heroSubtitle: { marginTop: 8, textAlign: "center" as const, lineHeight: 20 },
  sectionLabel: { letterSpacing: 3, fontWeight: "700" as const, marginBottom: 12 },
  toolCard: { borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 14 },
  toolIconContainer: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  toolContent: { flex: 1 },
  toolTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  toolTitle: { fontWeight: "700" as const, flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: "rgba(245,158,11,0.12)", borderWidth: 1, borderColor: "rgba(245,158,11,0.25)" },
  statusText: { color: "#f59e0b", fontWeight: "700" as const, letterSpacing: 1 },
  toolDesc: { lineHeight: 16 },
});
