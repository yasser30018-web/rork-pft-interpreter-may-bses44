import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Brain, Trash2, ChevronRight } from "lucide-react-native";
import { useTheme } from "@/providers/ThemeProvider";
import type { HRCTHistoryItem } from "@/types/hrct";

const HISTORY_KEY = "pulmolab_hrct_history_v1";

export default function AIScanHistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, scaledFont } = useTheme();
  const [items, setItems] = useState<HRCTHistoryItem[]>([]);

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(HISTORY_KEY);
      setItems(raw ? (JSON.parse(raw) as HRCTHistoryItem[]) : []);
    } catch (e) {
      console.log("[ai-history] load", e);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const clearAll = useCallback(() => {
    Alert.alert("Clear history?", "All saved AI analyses will be removed from this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem(HISTORY_KEY);
          setItems([]);
        },
      },
    ]);
  }, []);

  const remove = useCallback(async (id: string) => {
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  }, [items]);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <Stack.Screen
        options={{
          title: "AI Scan History",
          headerStyle: { backgroundColor: colors.bgHeader },
          headerTintColor: colors.text,
          headerRight: () =>
            items.length > 0 ? (
              <TouchableOpacity onPress={clearAll} style={{ marginRight: 6, padding: 6 }}>
                <Trash2 color={colors.red} size={18} />
              </TouchableOpacity>
            ) : null,
        }}
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {items.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Brain color={colors.textDim} size={36} />
            <Text style={[styles.emptyTitle, { color: colors.text, fontSize: scaledFont(14) }]}>
              No analyses yet
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.textMuted, fontSize: scaledFont(11) }]}>
              Your past HRCT analyses will appear here.
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/ai-scan" as never)}
              style={[styles.cta, { backgroundColor: colors.accent }]}
            >
              <Text style={styles.ctaText}>Run New Analysis</Text>
            </TouchableOpacity>
          </View>
        ) : (
          items.map((it) => {
            const top = it.result.differential_diagnosis?.[0]?.diagnosis ?? it.result.overall_impression ?? "Analysis";
            const sev = it.result.severity_overall ?? "";
            const sevColor =
              sev.toLowerCase() === "severe" || sev.toLowerCase() === "critical"
                ? colors.red
                : sev.toLowerCase() === "moderate"
                ? colors.amber
                : sev.toLowerCase() === "mild"
                ? colors.green
                : colors.textMuted;
            return (
              <View key={it.id} style={[styles.item, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                {it.imageUri ? (
                  <Image source={{ uri: it.imageUri }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.thumb, { backgroundColor: colors.bgElevated, alignItems: "center", justifyContent: "center" }]}>
                    <Brain color={colors.textDim} size={20} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontSize: scaledFont(13), fontWeight: "800" }}>
                    {top}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: scaledFont(11), marginTop: 2 }}>
                    {new Date(it.createdAt).toLocaleString()} · {it.imageType.toUpperCase()}
                  </Text>
                  {!!sev && (
                    <View style={[styles.sevBadge, { backgroundColor: sevColor + "20" }]}>
                      <Text style={{ color: sevColor, fontWeight: "700", fontSize: scaledFont(10), letterSpacing: 0.4 }}>
                        {sev.toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => remove(it.id)} style={{ padding: 6 }}>
                  <Trash2 color={colors.textMuted} size={16} />
                </TouchableOpacity>
                <ChevronRight color={colors.textDim} size={16} />
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, gap: 10 },
  empty: { padding: 28, alignItems: "center", borderRadius: 16, borderWidth: 1, gap: 8 },
  emptyTitle: { fontWeight: "800", marginTop: 8 },
  emptyDesc: { textAlign: "center", lineHeight: 16 },
  cta: { marginTop: 12, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12 },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1 },
  thumb: { width: 56, height: 56, borderRadius: 10 },
  sevBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 6 },
});
