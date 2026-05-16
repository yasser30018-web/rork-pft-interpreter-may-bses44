import React, { useRef, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import type { PFTValues } from "@/types/pft";
import { FIELDS } from "@/constants/pftData";
import { useTheme } from "@/providers/ThemeProvider";

interface SectionTabsProps {
  activeSection: number;
  onSectionChange: (index: number) => void;
  values: PFTValues;
}

export default React.memo(function SectionTabs({ activeSection, onSectionChange, values }: SectionTabsProps) {
  const scrollRef = useRef<ScrollView>(null);
  const { colors, scaledFont } = useTheme();

  const handlePress = useCallback((index: number) => {
    onSectionChange(index);
  }, [onSectionChange]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scrollView}
      contentContainerStyle={styles.container}
    >
      {FIELDS.map((s, i) => {
        const sectionFilled = s.fields.filter(f => values[f.key] !== "").length;
        const isActive = activeSection === i;
        return (
          <TouchableOpacity
            key={i}
            onPress={() => handlePress(i)}
            activeOpacity={0.7}
            style={[
              styles.tab,
              { borderColor: colors.border },
              isActive && { borderColor: colors.accent, backgroundColor: colors.tabActiveBg },
            ]}
          >
            <Text style={[
              styles.tabText,
              { color: colors.textMuted, fontSize: scaledFont(10) },
              isActive && { color: colors.accentLight },
            ]}>
              {s.section}
            </Text>
            {sectionFilled > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                <Text style={styles.badgeText}>{sectionFilled}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  scrollView: { maxHeight: 52 },
  container: { flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingVertical: 8, alignItems: "center" as const },
  tab: { paddingHorizontal: 14, height: 34, borderRadius: 10, borderWidth: 1, position: "relative" as const, justifyContent: "center" as const, alignItems: "center" as const, flexShrink: 0 },
  tabText: { letterSpacing: 0.3, fontWeight: "500" as const },
  badge: { position: "absolute" as const, top: -5, right: -5, width: 16, height: 16, borderRadius: 8, alignItems: "center" as const, justifyContent: "center" as const },
  badgeText: { fontSize: 9, color: "#fff", fontWeight: "700" as const },
});
