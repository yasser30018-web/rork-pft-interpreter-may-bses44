import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Wind, TrendingDown, Zap, AlertTriangle, Search, Cloud, CheckCircle, Clipboard, ChevronLeft, ChevronRight, Play, Lock } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import type { PFTValues } from "@/types/pft";
import { FIELDS, PATTERN_INFO, INITIAL_VALUES } from "@/constants/pftData";
import { interpretPFT } from "@/utils/interpretPFT";
import { useTheme } from "@/providers/ThemeProvider";
import SectionTabs from "@/components/SectionTabs";
import FieldInput from "@/components/FieldInput";
import ResultsPanel from "@/components/ResultsPanel";

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

export default function PFTScreen() {
  const insets = useSafeAreaInsets();
  const { colors, scaledFont } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [values, setValues] = useState<PFTValues>({ ...INITIAL_VALUES });
  const [activeSection, setActiveSection] = useState<number>(0);
  const [showResults, setShowResults] = useState<boolean>(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const resultsFadeAnim = useRef(new Animated.Value(0)).current;
  const patternFadeAnim = useRef(new Animated.Value(0)).current;

  const result = useMemo(() => interpretPFT(values), [values]);
  const filledCount = useMemo(() => Object.values(values).filter(v => v !== "").length, [values]);
  const totalFields = Object.keys(values).length;
  const hasAnyValue = filledCount > 0;
  const mandatoryFilled = values.fev1fvc !== "" && values.fvc !== "" && values.fev1 !== "" && values.tlc !== "";
  const missingMandatory = [
    values.fev1fvc === "" ? "FEV1/FVC Ratio" : null,
    values.fvc === "" ? "FVC" : null,
    values.fev1 === "" ? "FEV1" : null,
    values.tlc === "" ? "TLC" : null,
  ].filter(Boolean) as string[];
  const patternInfo = PATTERN_INFO[result.pattern ?? "empty"] ?? PATTERN_INFO.empty;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: filledCount / totalFields,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [filledCount, totalFields]);

  useEffect(() => {
    if (hasAnyValue) {
      patternFadeAnim.setValue(0);
      Animated.timing(patternFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [result.pattern, hasAnyValue]);

  useEffect(() => {
    if (showResults) {
      resultsFadeAnim.setValue(0);
      Animated.timing(resultsFadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [showResults]);

  const handleChange = useCallback((key: keyof PFTValues, val: string) => {
    setValues(prev => ({ ...prev, [key]: val }));
    setShowResults(false);
  }, []);

  const getMandatoryFieldsForSection = useCallback((sectionIndex: number) => {
    return FIELDS[sectionIndex].fields.filter(f => f.mandatory);
  }, []);

  const isSectionMandatoryComplete = useCallback((sectionIndex: number) => {
    const mandatoryFields = getMandatoryFieldsForSection(sectionIndex);
    if (mandatoryFields.length === 0) return true;
    return mandatoryFields.every(f => values[f.key] !== "");
  }, [values, getMandatoryFieldsForSection]);

  const getMissingSectionMandatory = useCallback((sectionIndex: number) => {
    const mandatoryFields = getMandatoryFieldsForSection(sectionIndex);
    return mandatoryFields.filter(f => values[f.key] === "").map(f => f.label);
  }, [values, getMandatoryFieldsForSection]);

  const canNavigateFrom = useCallback((fromSection: number) => {
    return isSectionMandatoryComplete(fromSection);
  }, [isSectionMandatoryComplete]);

  const handleSectionChange = useCallback((index: number) => {
    if (index > activeSection && !canNavigateFrom(activeSection)) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setActiveSection(index);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [activeSection, canNavigateFrom]);

  const handleInterpret = useCallback(() => {
    setShowResults(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 150);
  }, []);

  const handleReset = useCallback(() => {
    setValues({ ...INITIAL_VALUES });
    setShowResults(false);
    setActiveSection(0);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const handlePrevSection = useCallback(() => {
    setActiveSection(s => Math.max(0, s - 1));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleNextSection = useCallback(() => {
    if (!canNavigateFrom(activeSection)) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setActiveSection(s => Math.min(FIELDS.length - 1, s + 1));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [activeSection, canNavigateFrom]);

  const PatternIcon = ICON_MAP[patternInfo.icon] ?? Clipboard;

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <Stack.Screen
        options={{
          title: "PFT Interpretation",
          headerStyle: { backgroundColor: colors.bgHeader },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: "700", fontSize: 16 },
        }}
      />

      <View style={[styles.header, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <View style={[styles.patternDot, { backgroundColor: colors.bgElevated }]}>
              <PatternIcon color={patternInfo.color} size={14} />
            </View>
            <View>
              <Text style={[styles.patternLabel, { color: patternInfo.color, fontSize: scaledFont(13) }]}>
                {hasAnyValue ? patternInfo.label : "Ready"}
              </Text>
            </View>
          </View>
          <View style={styles.counterBox}>
            <Text style={[styles.counterValue, { color: colors.accentLight, fontSize: scaledFont(18) }]}>
              {filledCount}
              <Text style={[styles.counterTotal, { color: colors.textDark }]}>/{totalFields}</Text>
            </Text>
          </View>
        </View>

        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <Animated.View
            style={[styles.progressBar, { width: progressWidth, backgroundColor: colors.accent }]}
          />
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <SectionTabs
            activeSection={activeSection}
            onSectionChange={handleSectionChange}
            values={values}
          />

          <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textDim, fontSize: scaledFont(10) }]}>{FIELDS[activeSection].section}</Text>
            <Text style={[styles.sectionCount, { color: colors.textDim, fontSize: scaledFont(10) }]}>
              {FIELDS[activeSection].fields.filter(f => values[f.key] !== "").length}/{FIELDS[activeSection].fields.length}
            </Text>
          </View>

          <View style={styles.fieldsContainer}>
            {FIELDS[activeSection].fields.map(f => (
              <FieldInput
                key={f.key}
                field={f}
                value={values[f.key]}
                onChange={handleChange}
              />
            ))}
          </View>

          <View style={styles.navButtons}>
            {activeSection > 0 && (
              <TouchableOpacity
                onPress={handlePrevSection}
                style={[styles.navButtonBack, { backgroundColor: colors.bgCardActive, borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <ChevronLeft size={14} color={colors.accentLight} />
                <Text style={[styles.navButtonBackText, { color: colors.accentLight, fontSize: scaledFont(12) }]}>Back</Text>
              </TouchableOpacity>
            )}
            {activeSection < FIELDS.length - 1 ? (
              <View style={[activeSection === 0 ? styles.navButtonFull : { flex: 2 }]}>
                <TouchableOpacity
                  onPress={handleNextSection}
                  style={[
                    styles.navButtonNext,
                    { backgroundColor: colors.bgElevated, borderColor: colors.accent },
                    !canNavigateFrom(activeSection) && { backgroundColor: colors.bgCard, borderColor: colors.border },
                  ]}
                  activeOpacity={0.7}
                >
                  {!canNavigateFrom(activeSection) ? (
                    <Lock size={12} color={colors.textDim} />
                  ) : null}
                  <Text style={[
                    styles.navButtonNextText,
                    { color: colors.accentLight, fontSize: scaledFont(12) },
                    !canNavigateFrom(activeSection) && { color: colors.textDim },
                  ]}>
                    Next: {FIELDS[activeSection + 1].section}
                  </Text>
                  <ChevronRight size={14} color={canNavigateFrom(activeSection) ? colors.accentLight : colors.textDim} />
                </TouchableOpacity>
                {!canNavigateFrom(activeSection) && (
                  <Text style={[styles.mandatoryHint, { fontSize: scaledFont(10) }]}>
                    Fill required fields: {getMissingSectionMandatory(activeSection).join(", ")}
                  </Text>
                )}
              </View>
            ) : (
              <View style={[activeSection === 0 ? styles.navButtonFull : { flex: 2 }]}>
                <TouchableOpacity
                  onPress={handleInterpret}
                  disabled={!mandatoryFilled}
                  style={[
                    styles.interpretButton,
                    { backgroundColor: colors.accent },
                    !mandatoryFilled && { backgroundColor: colors.bgElevated },
                  ]}
                  activeOpacity={0.7}
                >
                  <Play size={14} color={mandatoryFilled ? "#fff" : colors.textDark} />
                  <Text style={[
                    styles.interpretButtonText,
                    { fontSize: scaledFont(13) },
                    !mandatoryFilled && { color: colors.textDark },
                  ]}>
                    {mandatoryFilled ? "INTERPRET PFT" : "Fill required fields"}
                  </Text>
                </TouchableOpacity>
                {!mandatoryFilled && missingMandatory.length > 0 && (
                  <Text style={[styles.mandatoryHint, { fontSize: scaledFont(10) }]}>
                    Required: {missingMandatory.join(", ")}
                  </Text>
                )}
              </View>
            )}
          </View>

          {hasAnyValue && !showResults && (
            <Animated.View style={[styles.livePreview, { opacity: patternFadeAnim, backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.livePreviewLabel, { color: colors.textDim, fontSize: scaledFont(10) }]}>LIVE PREVIEW</Text>
              <View style={styles.livePreviewRow}>
                <PatternIcon color={patternInfo.color} size={22} />
                <View style={styles.livePreviewInfo}>
                  <Text style={[styles.livePreviewTitle, { color: patternInfo.color, fontSize: scaledFont(13) }]}>
                    {patternInfo.label}
                  </Text>
                  <Text style={[styles.livePreviewDesc, { color: colors.textMuted, fontSize: scaledFont(10) }]}>{patternInfo.desc}</Text>
                </View>
              </View>
              {result.severity && (
                <View style={styles.livePreviewSeverity}>
                  <Text style={[styles.livePreviewSeverityLabel, { color: colors.textDim, fontSize: scaledFont(10) }]}>SEVERITY:</Text>
                  <View style={[styles.severityChip, { backgroundColor: result.severity.bg, borderColor: result.severity.color + "40" }]}>
                    <Text style={[styles.severityChipText, { color: result.severity.color, fontSize: scaledFont(11) }]}>
                      {result.severity.label}
                    </Text>
                  </View>
                </View>
              )}
            </Animated.View>
          )}

          {showResults && (
            <Animated.View style={{ opacity: resultsFadeAnim, transform: [{ translateY: resultsFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
              <View style={styles.resultsDivider}>
                <View style={[styles.resultsDividerLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.resultsDividerText, { color: colors.accentLight, fontSize: scaledFont(10) }]}>INTERPRETATION</Text>
                <View style={[styles.resultsDividerLine, { backgroundColor: colors.border }]} />
              </View>
              <ResultsPanel result={result} onReset={handleReset} />
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: { borderBottomWidth: 1, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  patternDot: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  patternLabel: { fontWeight: "600" as const },
  counterBox: { alignItems: "flex-end" },
  counterValue: { fontWeight: "600" as const, fontVariant: ["tabular-nums"] },
  counterTotal: { fontSize: 12 },
  progressTrack: { marginTop: 10, height: 3, borderRadius: 3, overflow: "hidden" as const },
  progressBar: { height: "100%", borderRadius: 3 },
  scrollContent: { flexGrow: 1 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 8, borderBottomWidth: 1, paddingBottom: 8 },
  sectionTitle: { letterSpacing: 2, textTransform: "uppercase" as const, fontWeight: "600" as const },
  sectionCount: { fontVariant: ["tabular-nums"] },
  fieldsContainer: { paddingHorizontal: 16 },
  navButtons: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginTop: 4, marginBottom: 16 },
  navButtonBack: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 13, borderWidth: 1, borderRadius: 12 },
  navButtonBackText: { fontWeight: "500" as const },
  navButtonNext: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 13, borderWidth: 1, borderRadius: 12 },
  navButtonFull: { flex: 1 },
  navButtonNextText: { fontWeight: "500" as const },
  interpretButton: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  interpretButtonText: { color: "#fff", fontWeight: "700" as const, letterSpacing: 0.5 },
  livePreview: { marginHorizontal: 16, padding: 14, borderWidth: 1, borderRadius: 14, marginBottom: 16 },
  livePreviewLabel: { letterSpacing: 1, marginBottom: 10, fontWeight: "600" as const },
  livePreviewRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  livePreviewInfo: { flex: 1 },
  livePreviewTitle: { fontWeight: "600" as const },
  livePreviewDesc: { marginTop: 2, lineHeight: 14 },
  livePreviewSeverity: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  livePreviewSeverityLabel: {},
  severityChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  severityChipText: { fontWeight: "500" as const },
  resultsDivider: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 16, gap: 10 },
  resultsDividerLine: { flex: 1, height: 1 },
  mandatoryHint: { color: "#e74c3c", textAlign: "center" as const, marginTop: 6 },
  resultsDividerText: { letterSpacing: 2, fontWeight: "600" as const },
});
