import React, { useCallback, useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import type { FieldConfig, PFTValues } from "@/types/pft";
import { useTheme } from "@/providers/ThemeProvider";

interface FieldInputProps {
  field: FieldConfig;
  value: string;
  onChange: (key: keyof PFTValues, value: string) => void;
}

export default React.memo(function FieldInput({ field, value, onChange }: FieldInputProps) {
  const [focused, setFocused] = useState(false);
  const { colors, scaledFont } = useTheme();
  const isFilled = value !== "";

  const handleChange = useCallback((text: string) => {
    onChange(field.key, text);
  }, [onChange, field.key]);

  return (
    <View style={[
      styles.container,
      { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle },
      isFilled && { backgroundColor: colors.bgCardActive, borderColor: colors.borderActive },
      focused && { borderColor: colors.accent },
    ]}>
      <View style={styles.header}>
        <View style={styles.labelRow}>
          <Text style={[
            styles.label,
            { color: colors.textSecondary, fontSize: scaledFont(12) },
            isFilled && { color: colors.accentSoft },
          ]}>
            {field.label}{field.mandatory && <Text style={styles.mandatoryStar}> *</Text>}
          </Text>
          {field.critical && (
            <View style={[styles.keyBadge, { borderColor: colors.red + "40" }]}>
              <Text style={[styles.keyBadgeText, { color: colors.red, fontSize: scaledFont(8) }]}>KEY</Text>
            </View>
          )}
        </View>
        <Text style={[styles.unit, { color: colors.textDim, fontSize: scaledFont(10) }]}>{field.unit}</Text>
      </View>

      <TextInput
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={field.placeholder}
        placeholderTextColor={colors.textDim}
        keyboardType="numeric"
        style={[
          styles.input,
          { color: colors.textMuted, borderBottomColor: colors.borderAccent, fontSize: scaledFont(13) },
          isFilled && { fontSize: scaledFont(18), color: colors.text, borderBottomColor: colors.accent },
          focused && { borderBottomColor: colors.accentLight },
        ]}
      />

      <Text style={[styles.hint, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>{field.hint}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { marginBottom: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  label: { fontWeight: "500" as const },
  keyBadge: { borderWidth: 1, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  keyBadgeText: { fontWeight: "700" as const, letterSpacing: 0.5 },
  unit: {},
  input: { paddingVertical: 4, borderBottomWidth: 1, fontVariant: ["tabular-nums"] },
  hint: { marginTop: 6 },
  mandatoryStar: { color: "#e74c3c", fontSize: 13, fontWeight: "700" as const },
});
