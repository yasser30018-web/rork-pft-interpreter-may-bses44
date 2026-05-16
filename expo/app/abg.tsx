import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronDown, ChevronUp, ArrowLeft, Zap, Trash2, BookOpen, FlaskConical } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/providers/ThemeProvider";
import { runABGEngine, REF_RANGES, FORMULAS, MIXED_PATTERNS } from "@/utils/abgEngine";
import type { ABGFields, ABGResult } from "@/types/abg";
import { DEFAULT_FIELDS, ABG_EXAMPLES } from "@/types/abg";

type TabId = "input" | "ref";
type SubTab = "summary" | "steps" | "ddx";
type UnitMode = "primary" | "secondary";

interface UnitOption {
  primary: string;
  secondary: string;
  toSecondary: number;
  primaryNormal: string;
  secondaryNormal: string;
  primaryPlaceholder: string;
  secondaryPlaceholder: string;
}

const UNIT_CONFIGS: Partial<Record<keyof ABGFields, UnitOption>> = {
  PaCO2: {
    primary: "mmHg", secondary: "kPa", toSecondary: 0.133322,
    primaryNormal: "35 – 45 mmHg", secondaryNormal: "4.7 – 6.0 kPa",
    primaryPlaceholder: "40", secondaryPlaceholder: "5.3",
  },
  HCO3: {
    primary: "mEq/L", secondary: "mmol/L", toSecondary: 1,
    primaryNormal: "22 – 26 mEq/L", secondaryNormal: "22 – 26 mmol/L",
    primaryPlaceholder: "24", secondaryPlaceholder: "24",
  },
  PaO2: {
    primary: "mmHg", secondary: "kPa", toSecondary: 0.133322,
    primaryNormal: "> 80 mmHg", secondaryNormal: "> 10.7 kPa",
    primaryPlaceholder: "95", secondaryPlaceholder: "12.7",
  },
  Na: {
    primary: "mEq/L", secondary: "mmol/L", toSecondary: 1,
    primaryNormal: "135 – 145 mEq/L", secondaryNormal: "135 – 145 mmol/L",
    primaryPlaceholder: "140", secondaryPlaceholder: "140",
  },
  K: {
    primary: "mEq/L", secondary: "mmol/L", toSecondary: 1,
    primaryNormal: "3.5 – 5.0 mEq/L", secondaryNormal: "3.5 – 5.0 mmol/L",
    primaryPlaceholder: "4.0", secondaryPlaceholder: "4.0",
  },
  Cl: {
    primary: "mEq/L", secondary: "mmol/L", toSecondary: 1,
    primaryNormal: "96 – 106 mEq/L", secondaryNormal: "96 – 106 mmol/L",
    primaryPlaceholder: "104", secondaryPlaceholder: "104",
  },
  albumin: {
    primary: "g/dL", secondary: "g/L", toSecondary: 10,
    primaryNormal: "3.5 – 5.5 g/dL", secondaryNormal: "35 – 55 g/L",
    primaryPlaceholder: "4.0", secondaryPlaceholder: "40",
  },
};

const STATIC_FIELD_INFO: Partial<Record<keyof ABGFields, { unit: string; normalRange: string; placeholder: string }>> = {
  pH: { unit: "", normalRange: "7.35 – 7.45", placeholder: "7.40" },
  SaO2: { unit: "%", normalRange: "95 – 100%", placeholder: "98" },
  FiO2: { unit: "", normalRange: "0.21 = RA", placeholder: "21" },
};

interface SectionDef {
  title: string;
  subtitle: string;
  color: string;
  fields: Array<{ label: string; key: keyof ABGFields }>;
}

const SECTIONS: SectionDef[] = [
  {
    title: "Acid-Base",
    subtitle: "Blood gas analysis",
    color: "#00C9A7",
    fields: [
      { label: "pH", key: "pH" },
      { label: "PaCO\u2082", key: "PaCO2" },
      { label: "HCO\u2083\u207B", key: "HCO3" },
    ],
  },
  {
    title: "Oxygenation",
    subtitle: "Gas exchange",
    color: "#3B82F6",
    fields: [
      { label: "PaO\u2082", key: "PaO2" },
      { label: "SaO\u2082", key: "SaO2" },
      { label: "FiO\u2082", key: "FiO2" },
    ],
  },
  {
    title: "Electrolytes",
    subtitle: "Chemistry panel",
    color: "#3B82F6",
    fields: [
      { label: "Na\u207A", key: "Na" },
      { label: "K\u207A", key: "K" },
      { label: "Cl\u207B", key: "Cl" },
      { label: "Albumin", key: "albumin" },
    ],
  },
];

function isCriticalWithUnit(key: string, value: string, mode: UnitMode, config?: UnitOption): boolean {
  if (!value) return false;
  let n = parseFloat(value);
  if (isNaN(n)) return false;
  if (config && mode === "secondary") {
    n = n / config.toSecondary;
  }
  if (key === "pH") return n < 7.20 || n > 7.60;
  if (key === "PaO2") return n < 60;
  if (key === "PaCO2") return n > 70 || n < 20;
  if (key === "HCO3") return n < 10;
  return false;
}

function phColor(dir: string): string {
  return dir === "acid" ? "#FF4757" : dir === "alkaline" ? "#3B82F6" : "#00C9A7";
}

function oxyColor(status: string): string {
  return status === "CRITICAL" || status === "FAILURE" ? "#FF4757" : status === "HYPO" || status === "LOWN" ? "#FFA502" : "#00C9A7";
}

function disorderColor(comp: string): string {
  if (comp === "respiratory") return "#FFA502";
  if (comp === "metabolic") return "#3B82F6";
  if (comp === "mixed" || comp === "mixed_or_comp") return "#8B5CF6";
  return "#00C9A7";
}

function compBadgeColor(s: string): string {
  return s === "Compensated" ? "#00C9A7" : s === "Uncompensated" ? "#FF4757" : "#FFA502";
}

export default function ABGScreen() {
  const insets = useSafeAreaInsets();
  const { colors, scaledFont, isDark } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [activeTab, setActiveTab] = useState<TabId>("input");
  const [fields, setFields] = useState<ABGFields>({ ...DEFAULT_FIELDS });
  const [unitModes, setUnitModes] = useState<Partial<Record<keyof ABGFields, UnitMode>>>({});
  const [result, setResult] = useState<ABGResult | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [interpreting, setInterpreting] = useState(false);
  const [subTab, setSubTab] = useState<SubTab>("summary");
  const [openSteps, setOpenSteps] = useState<Record<number, boolean>>({});
  const [openDdx, setOpenDdx] = useState<Record<number, boolean>>({});

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const canInterpret = useMemo(() => {
    const req: (keyof ABGFields)[] = ["pH", "PaCO2", "HCO3", "PaO2", "SaO2", "Na", "K", "Cl", "albumin"];
    return req.every((k) => fields[k] !== "");
  }, [fields]);

  const setField = useCallback((key: keyof ABGFields, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toPrimaryValue = useCallback((key: keyof ABGFields, value: string): number => {
    const config = UNIT_CONFIGS[key];
    const num = parseFloat(value);
    if (!config || isNaN(num)) return num;
    const mode = unitModes[key] || "primary";
    if (mode === "secondary") {
      return num / config.toSecondary;
    }
    return num;
  }, [unitModes]);

  const toggleUnit = useCallback((key: keyof ABGFields) => {
    const config = UNIT_CONFIGS[key];
    if (!config) return;
    if (Platform.OS !== "web") void Haptics.selectionAsync();

    setUnitModes((prev) => {
      const currentMode = prev[key] || "primary";
      const nextMode: UnitMode = currentMode === "primary" ? "secondary" : "primary";

      setFields((fPrev) => {
        const currentVal = fPrev[key];
        if (!currentVal || isNaN(parseFloat(currentVal))) return fPrev;
        const num = parseFloat(currentVal);
        const converted = currentMode === "primary"
          ? num * config.toSecondary
          : num / config.toSecondary;
        const decimals = config.toSecondary === 1 ? 1 : 2;
        return { ...fPrev, [key]: parseFloat(converted.toFixed(decimals)).toString() };
      });

      return { ...prev, [key]: nextMode };
    });
  }, []);

  const fillExample = useCallback((idx: number) => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFields({ ...ABG_EXAMPLES[idx].v });
    setUnitModes({});
  }, []);

  const clearAll = useCallback(() => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFields({ ...DEFAULT_FIELDS });
    setUnitModes({});
    setResult(null);
    setShowResults(false);
  }, []);

  const doInterpret = useCallback(() => {
    if (!canInterpret) return;
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setInterpreting(true);
    setTimeout(() => {
      const inp = {
        pH: parseFloat(fields.pH),
        PaCO2: toPrimaryValue("PaCO2", fields.PaCO2),
        HCO3: toPrimaryValue("HCO3", fields.HCO3),
        PaO2: toPrimaryValue("PaO2", fields.PaO2),
        SaO2: parseFloat(fields.SaO2),
        Na: toPrimaryValue("Na", fields.Na),
        K: toPrimaryValue("K", fields.K),
        Cl: toPrimaryValue("Cl", fields.Cl),
        albumin: toPrimaryValue("albumin", fields.albumin),
        FiO2: parseFloat(fields.FiO2) || 21,
      };
      console.log("[ABG] Interpreting with primary-unit values:", inp);
      const res = runABGEngine(inp);
      setResult(res);
      setShowResults(true);
      setSubTab("summary");
      setOpenSteps({});
      setOpenDdx({});
      setInterpreting(false);
    }, 350);
  }, [canInterpret, fields, toPrimaryValue]);

  const goBack = useCallback(() => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowResults(false);
  }, []);

  const toggleStep = useCallback((i: number) => {
    if (Platform.OS !== "web") void Haptics.selectionAsync();
    setOpenSteps((prev) => ({ ...prev, [i]: !prev[i] }));
  }, []);

  const toggleDdx = useCallback((i: number) => {
    if (Platform.OS !== "web") void Haptics.selectionAsync();
    setOpenDdx((prev) => ({ ...prev, [i]: !prev[i] }));
  }, []);

  const surfColor = isDark ? "#1C2535" : colors.bgCard;
  const surfElColor = isDark ? "#243043" : colors.bgElevated;
  const borderCol = isDark ? "#2A3548" : colors.border;
  const teal = "#00C9A7";

  const getFieldInfo = useCallback((key: keyof ABGFields) => {
    const unitConfig = UNIT_CONFIGS[key];
    const staticInfo = STATIC_FIELD_INFO[key];
    const mode: UnitMode = unitModes[key] || "primary";

    const currentUnit = unitConfig
      ? (mode === "primary" ? unitConfig.primary : unitConfig.secondary)
      : (staticInfo?.unit || "");

    const normalRange = unitConfig
      ? (mode === "primary" ? unitConfig.primaryNormal : unitConfig.secondaryNormal)
      : (staticInfo?.normalRange || "");

    const placeholder = unitConfig
      ? (mode === "primary" ? unitConfig.primaryPlaceholder : unitConfig.secondaryPlaceholder)
      : (staticInfo?.placeholder || "");

    return { unitConfig, mode, currentUnit, normalRange, placeholder, hasToggle: !!unitConfig };
  }, [unitModes]);

  const renderField = useCallback((fieldKey: keyof ABGFields, label: string) => {
    const val = fields[fieldKey];
    const { unitConfig, mode, currentUnit, normalRange, placeholder, hasToggle } = getFieldInfo(fieldKey);
    const crit = isCriticalWithUnit(fieldKey, val, mode, unitConfig);

    return (
      <View key={fieldKey} style={styles.fieldCol}>
        <View style={styles.fieldHeader}>
          <Text style={[styles.fieldLabel, { color: colors.text, fontSize: scaledFont(13) }]}>{label}</Text>
          <Text style={[styles.fieldNormal, { color: colors.textDim, fontSize: scaledFont(9.5) }]} numberOfLines={1}>{normalRange}</Text>
        </View>
        <View style={[
          styles.fieldInputWrap,
          {
            backgroundColor: isDark ? "#1A2332" : "#F7FAFB",
            borderColor: crit ? "rgba(255,71,87,0.6)" : (isDark ? "#2A3A4E" : "#D8E2E6"),
          },
          crit && { shadowColor: "#FF4757", shadowOpacity: 0.15, shadowRadius: 6 },
        ]}>
          <TextInput
            style={[
              styles.fieldInput,
              { color: colors.text, fontSize: scaledFont(15) },
            ]}
            value={val}
            onChangeText={(v) => setField(fieldKey, v)}
            placeholder={placeholder}
            placeholderTextColor={colors.textDim}
            keyboardType="decimal-pad"
            selectTextOnFocus
            testID={`abg-input-${fieldKey}`}
          />
          {hasToggle ? (
            <TouchableOpacity
              style={[
                styles.unitToggleBtn,
                { backgroundColor: isDark ? "#243043" : "#E4F2F5", borderColor: isDark ? "#2A3A4E" : "#B8D8DE" },
              ]}
              onPress={() => toggleUnit(fieldKey)}
              activeOpacity={0.7}
              testID={`abg-unit-toggle-${fieldKey}`}
            >
              <Text style={[styles.unitToggleText, { color: isDark ? "#4FC3F7" : "#00838F", fontSize: scaledFont(10) }]}>
                {currentUnit} ⇅
              </Text>
            </TouchableOpacity>
          ) : currentUnit ? (
            <Text style={[styles.unitStaticText, { color: colors.textDim, fontSize: scaledFont(11) }]}>{currentUnit}</Text>
          ) : null}
        </View>
      </View>
    );
  }, [fields, colors, scaledFont, isDark, setField, toggleUnit, getFieldInfo]);

  const renderSection = useCallback((section: SectionDef) => {
    const filledCount = section.fields.filter((f) => fields[f.key] !== "").length;
    return (
      <View key={section.title} style={[styles.sectionCard, { backgroundColor: isDark ? "#141D2B" : "#FFFFFF", borderColor: isDark ? "#1E2D3F" : "#E3EDF0" }]}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionDot, { backgroundColor: section.color }]} />
          <View style={styles.sectionHeaderText}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontSize: scaledFont(15) }]}>{section.title}</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textDim, fontSize: scaledFont(11) }]}>{section.subtitle}</Text>
          </View>
          <Text style={[styles.sectionCount, { color: colors.textDim, fontSize: scaledFont(12) }]}>{filledCount}/{section.fields.length}</Text>
        </View>
        <View style={styles.sectionFieldsGrid}>
          {section.fields.map((f) => renderField(f.key, f.label))}
        </View>
      </View>
    );
  }, [fields, colors, scaledFont, isDark, renderField]);

  const renderInputPage = () => (
    <Animated.View style={{ opacity: fadeAnim }}>
      <Text style={[styles.sectionLabel, { color: colors.textDim, fontSize: scaledFont(10) }]}>QUICK EXAMPLES — TAP TO FILL</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.examplesScroll} contentContainerStyle={styles.examplesContent}>
        {ABG_EXAMPLES.map((ex, i) => (
          <TouchableOpacity
            key={ex.label}
            style={[styles.exampleCard, { backgroundColor: surfColor, borderColor: borderCol }]}
            onPress={() => fillExample(i)}
            activeOpacity={0.7}
            testID={`abg-example-${ex.label}`}
          >
            <Text style={styles.exampleIcon}>{ex.icon}</Text>
            <Text style={[styles.exampleName, { color: colors.text, fontSize: scaledFont(12) }]}>{ex.label}</Text>
            <Text style={[styles.exampleDesc, { color: colors.textDim, fontSize: scaledFont(10) }]}>{ex.desc}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={{ marginTop: 14 }}>
        {SECTIONS.map(renderSection)}
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, !canInterpret && styles.primaryBtnDisabled]}
        onPress={doInterpret}
        disabled={!canInterpret}
        activeOpacity={0.8}
        testID="abg-interpret-btn"
      >
        <Zap color="#0A0F1A" size={18} />
        <Text style={[styles.primaryBtnText, { fontSize: scaledFont(15) }]}>Interpret ABG</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.secondaryBtn, { borderColor: borderCol, backgroundColor: surfColor }]} onPress={clearAll} activeOpacity={0.7}>
        <Trash2 color={colors.textMuted} size={14} />
        <Text style={[styles.secondaryBtnText, { color: colors.textMuted, fontSize: scaledFont(13) }]}>Clear All</Text>
      </TouchableOpacity>

      {!canInterpret && (
        <Text style={[styles.hint, { color: colors.textDim, fontSize: scaledFont(11) }]}>Complete all required fields to interpret</Text>
      )}

      <View style={[styles.divider, { backgroundColor: borderCol }]} />
      <Text style={[styles.disclaimer, { color: colors.textDim, fontSize: scaledFont(10.5) }]}>
        Based on Kaufman DA (ATS) and Palange & Ferrazza (ERS) systematic ABG interpretation frameworks. For educational and clinical decision support only.
      </Text>
      <Text style={[styles.disclaimerWarn, { color: colors.red, fontSize: scaledFont(11) }]}>
        Always correlate with clinical context. Not a substitute for clinical judgement.
      </Text>
    </Animated.View>
  );

  const renderRefPage = () => (
    <Animated.View style={{ opacity: fadeAnim }}>
      <Text style={[styles.sectionLabel, { color: colors.textDim, fontSize: scaledFont(10) }]}>NORMAL RANGES & CRITICAL VALUES</Text>
      {REF_RANGES.map((r) => (
        <View key={r.name} style={[styles.refCard, { backgroundColor: surfColor, borderColor: borderCol }]}>
          <View style={styles.refCardLeft}>
            <Text style={[styles.refName, { color: colors.text, fontSize: scaledFont(13) }]}>{r.name}</Text>
            <Text style={[styles.refNormal, { color: teal, fontSize: scaledFont(11) }]}>{r.normal}</Text>
            <Text style={[styles.refCrit, { color: colors.red, fontSize: scaledFont(11) }]}>{r.crit}</Text>
          </View>
          <Text style={[styles.refSrc, { color: colors.textDim, fontSize: scaledFont(9) }]}>{r.src}</Text>
        </View>
      ))}

      <View style={[styles.divider, { backgroundColor: borderCol }]} />
      <Text style={[styles.sectionLabel, { color: colors.textDim, fontSize: scaledFont(10) }]}>KEY FORMULAS</Text>
      {FORMULAS.map((f) => (
        <View key={f.n} style={[styles.formulaCard, { backgroundColor: surfColor, borderColor: borderCol }]}>
          <Text style={[styles.formulaName, { color: colors.textMuted, fontSize: scaledFont(11) }]}>{f.n}</Text>
          <Text style={[styles.formulaVal, { color: teal, fontSize: scaledFont(12) }]}>{f.f}</Text>
        </View>
      ))}

      <View style={[styles.divider, { backgroundColor: borderCol }]} />
      <Text style={[styles.sectionLabel, { color: colors.textDim, fontSize: scaledFont(10) }]}>MIXED DISORDER PATTERNS</Text>
      {MIXED_PATTERNS.map((m) => (
        <View key={m.p} style={[styles.mixedCard, { backgroundColor: surfElColor, borderColor: borderCol }]}>
          <Text style={[styles.mixedPat, { color: colors.text, fontSize: scaledFont(12) }]}>{m.p}</Text>
          <View style={styles.mixedTags}>
            <View style={[styles.mixedTag, { backgroundColor: isDark ? "#243043" : colors.bgCardActive }]}>
              <Text style={[styles.mixedTagText, { color: colors.textDim, fontSize: scaledFont(10) }]}>pH {m.pH}</Text>
            </View>
            <View style={[styles.mixedTag, { backgroundColor: isDark ? "#243043" : colors.bgCardActive }]}>
              <Text style={[styles.mixedTagText, { color: colors.textDim, fontSize: scaledFont(10) }]}>HCO3 {m.HCO3}</Text>
            </View>
            <View style={[styles.mixedTag, { backgroundColor: isDark ? "#243043" : colors.bgCardActive }]}>
              <Text style={[styles.mixedTagText, { color: colors.textDim, fontSize: scaledFont(10) }]}>CO2 {m.CO2}</Text>
            </View>
          </View>
          <Text style={[styles.mixedEx, { color: colors.textDim, fontSize: scaledFont(11) }]}>{m.ex}</Text>
        </View>
      ))}

      <View style={[styles.divider, { backgroundColor: borderCol }]} />
      <View style={[styles.srcBox]}>
        <Text style={[styles.srcTitle, { fontSize: scaledFont(12) }]}>Sources</Text>
        <Text style={[styles.srcText, { color: colors.textMuted, fontSize: scaledFont(11) }]}>
          {"• Kaufman DA. Interpretation of Arterial Blood Gases. ATS (American Thoracic Society).\n• Palange P, Ferrazza AM. Interpreting Arterial Blood Gases. ERS (European Respiratory Society) Breathe 2017.\n• Berend K, de Vries APJ, Gans ROB. Physiological approach to assessment of acid–base disturbances. NEJM 2014."}
        </Text>
      </View>
    </Animated.View>
  );

  const renderPHGauge = () => {
    if (!result) return null;
    const pH = result.inp.pH;
    const pct = Math.min(96, Math.max(4, ((pH - 7.0) / (7.8 - 7.0)) * 100));
    const col = pH < 7.20 || pH > 7.60 ? "#FF4757" : pH < 7.35 || pH > 7.45 ? "#FFA502" : "#22C55E";

    const segments = [
      { flex: 1, color: "#D32F2F" },
      { flex: 0.6, color: "#E65100" },
      { flex: 0.8, color: "#F9A825" },
      { flex: 1, color: "#4CAF50" },
      { flex: 0.8, color: "#F9A825" },
      { flex: 0.6, color: "#E65100" },
      { flex: 1, color: "#D32F2F" },
    ];

    const labels = [
      { v: "7.00", c: "#4FC3F7" },
      { v: "7.20", c: "#4FC3F7" },
      { v: "7.35", c: "#66BB6A" },
      { v: "7.40", c: "#FFA726" },
      { v: "7.45", c: "#66BB6A" },
      { v: "7.60", c: "#4FC3F7" },
      { v: "7.80", c: "#4FC3F7" },
    ];

    return (
      <View style={[styles.gaugeWrap, { backgroundColor: isDark ? "#1A2332" : "#2C3545", borderColor: isDark ? "#2A3A4E" : "#3A4A5E" }]}>
        <View style={styles.gaugeTop}>
          <Text style={[styles.gaugeLbl, { color: "#4FC3F7", fontSize: scaledFont(11) }]}>PH LEVEL</Text>
          <Text style={[styles.phBig, { color: col, fontSize: scaledFont(34) }]}>{pH}</Text>
        </View>
        <View style={styles.gaugeBarOuter}>
          <View style={styles.gaugeBarSegments}>
            {segments.map((seg, i) => (
              <View
                key={i}
                style={[
                  styles.gaugeSegment,
                  {
                    flex: seg.flex,
                    backgroundColor: seg.color,
                    borderTopLeftRadius: i === 0 ? 6 : 0,
                    borderBottomLeftRadius: i === 0 ? 6 : 0,
                    borderTopRightRadius: i === segments.length - 1 ? 6 : 0,
                    borderBottomRightRadius: i === segments.length - 1 ? 6 : 0,
                  },
                ]}
              />
            ))}
          </View>
          <View style={[styles.gaugeMarkerWrap, { left: `${pct}%` as any }]}>
            <View style={styles.gaugeMarkerOuter}>
              <View style={[styles.gaugeMarkerInner, { backgroundColor: col }]} />
            </View>
          </View>
        </View>
        <View style={styles.gaugeLabels}>
          {labels.map((z) => (
            <Text key={z.v} style={[styles.gaugeLabelItem, { color: z.c, fontSize: scaledFont(10) }]}>{z.v}</Text>
          ))}
        </View>
      </View>
    );
  };

  const renderCritAlerts = () => {
    if (!result || result.crits.length === 0) return null;
    const hasCrit = result.crits.some((c) => c.t === "C");
    return (
      <View style={[styles.alertBox, { borderColor: hasCrit ? "rgba(255,71,87,0.30)" : "rgba(255,165,2,0.30)", backgroundColor: hasCrit ? "rgba(255,71,87,0.08)" : "rgba(255,165,2,0.08)" }]}>
        <View style={styles.alertHeader}>
          <Text style={{ fontSize: 16 }}>{hasCrit ? "🚨" : "⚡"}</Text>
          <Text style={[styles.alertTitle, { color: hasCrit ? "#FF4757" : "#FFA502", fontSize: scaledFont(10) }]}>CRITICAL ALERTS</Text>
        </View>
        {result.crits.map((c, i) => (
          <View key={i} style={[styles.alertItem, { borderLeftColor: c.t === "C" ? "#FF4757" : "#FFA502" }]}>
            <Text style={[styles.alertItemText, { color: c.t === "C" ? "#FF4757" : "#D4850A", fontSize: scaledFont(12) }]}>
              {c.t === "C" ? "⚠ " : "→ "}{c.m}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderMetricCard = (label: string, value: string, unit: string, normal: string, borderColor: string, valueColor: string) => (
    <View style={[styles.metCard, { backgroundColor: surfColor, borderColor: borderColor + "44" }]}>
      <Text style={[styles.metLabel, { color: colors.textDim, fontSize: scaledFont(9.5) }]}>{label}</Text>
      <Text style={[styles.metValue, { color: valueColor, fontSize: scaledFont(20) }]}>
        {value}
        {unit ? <Text style={[styles.metUnit, { fontSize: scaledFont(12) }]}> {unit}</Text> : null}
      </Text>
      <Text style={[styles.metSub, { color: colors.textDim, fontSize: scaledFont(10) }]}>{normal}</Text>
    </View>
  );

  const renderBadge = (label: string, color: string) => (
    <View key={label} style={[styles.badge, { backgroundColor: color + "2E" }]}>
      <Text style={[styles.badgeText, { color, fontSize: scaledFont(10) }]}>{label}</Text>
    </View>
  );

  const renderSummary = () => {
    if (!result) return null;
    const { phR, comp, AG, corrR, agElev, delta, oxy, inp } = result;
    const pc = phColor(phR.dir);
    const oc = oxyColor(oxy.status);
    const co2A = inp.PaCO2 > 45 || inp.PaCO2 < 35;
    const hco3A = inp.HCO3 < 22 || inp.HCO3 > 26;

    return (
      <View>
        <View style={styles.metGrid}>
          {renderMetricCard("pH", String(inp.pH), "", "Normal: 7.35–7.45", pc, pc)}
          {renderMetricCard("PaCO2", String(inp.PaCO2), "mmHg", "Normal: 35–45", co2A ? "#FFA502" : teal, co2A ? "#FFA502" : teal)}
        </View>
        <View style={[styles.metGrid, { marginTop: 0 }]}>
          {renderMetricCard("HCO3", String(inp.HCO3), "mEq/L", "Normal: 22–26", hco3A ? "#FFA502" : teal, hco3A ? "#FFA502" : teal)}
          {renderMetricCard("PaO2", String(inp.PaO2), "mmHg", oxy.ARDS ? oxy.ARDS.split("(")[0].trim() : oxy.status.toLowerCase(), oc, oc)}
        </View>

        <View style={[styles.card, { backgroundColor: surfColor, borderColor: borderCol }]}>
          <Text style={[styles.cardTitle, { color: colors.textDim, fontSize: scaledFont(9.5) }]}>COMPENSATION</Text>
          <Text style={[styles.cardVal, { color: colors.text, fontSize: scaledFont(14) }]}>{comp.label}</Text>
          {comp.exp?.formula ? (
            <View style={[styles.formulaBox, { backgroundColor: surfElColor }]}>
              <Text style={[styles.formulaBoxText, { color: teal, fontSize: scaledFont(12) }]}>{comp.exp.formula}</Text>
            </View>
          ) : null}
          {comp.exp?.lo != null ? (
            <Text style={[styles.cardNote, { color: colors.textMuted, fontSize: scaledFont(11) }]}>
              Expected PaCO2: {comp.exp.lo}–{comp.exp.hi} mmHg  Actual: {inp.PaCO2} mmHg
            </Text>
          ) : null}
          {comp.exp?.ex != null ? (
            <Text style={[styles.cardNote, { color: colors.textMuted, fontSize: scaledFont(11) }]}>
              Expected PaCO2: {comp.exp.range} mmHg  Actual: {inp.PaCO2} mmHg
            </Text>
          ) : null}
          {comp.exp?.acute ? (
            <Text style={[styles.cardNote, { color: colors.textMuted, fontSize: scaledFont(11) }]}>
              Expected HCO3 — Acute: {comp.exp.acute.lo}–{comp.exp.acute.hi} / Chronic: {comp.exp.chronic?.lo ?? ""}–{comp.exp.chronic?.hi ?? ""} mEq/L  Actual: {inp.HCO3} mEq/L
            </Text>
          ) : null}
          {comp.note ? (
            <Text style={[styles.cardNote, { color: "#FFA502", marginTop: 6, fontSize: scaledFont(11) }]}>⚡ {comp.note}</Text>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: surfColor, borderColor: borderCol }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.textDim, fontSize: scaledFont(9.5) }]}>ANION GAP ANALYSIS</Text>
            {agElev ? renderBadge("ELEVATED", "#FF4757") : renderBadge("Normal", teal)}
          </View>
          <View style={styles.agRow}>
            <View style={styles.agCol}>
              <Text style={[styles.agNum, { color: agElev ? "#FF4757" : teal, fontSize: scaledFont(22) }]}>{AG}</Text>
              <Text style={[styles.agLabel, { color: colors.textDim, fontSize: scaledFont(9.5) }]}>MEASURED</Text>
            </View>
            <View style={[styles.agCol, styles.agColBorder, { borderLeftColor: borderCol }]}>
              <Text style={[styles.agNum, { color: agElev ? "#FF4757" : teal, fontSize: scaledFont(22) }]}>{corrR.corrAG}</Text>
              <Text style={[styles.agLabel, { color: colors.textDim, fontSize: scaledFont(9.5) }]}>CORRECTED</Text>
              <Text style={[styles.agSub, { color: colors.textDim, fontSize: scaledFont(9.5) }]}>+{corrR.corr} alb corr</Text>
            </View>
            <View style={[styles.agCol, styles.agColBorder, { borderLeftColor: borderCol }]}>
              <Text style={[styles.agNum, { color: colors.textMuted, fontSize: scaledFont(22) }]}>{corrR.normalAG}</Text>
              <Text style={[styles.agLabel, { color: colors.textDim, fontSize: scaledFont(9.5) }]}>NORMAL</Text>
              <Text style={[styles.agSub, { color: colors.textDim, fontSize: scaledFont(9.5) }]}>±2 mEq/L</Text>
            </View>
          </View>
        </View>

        {delta ? (
          <View style={[styles.card, { backgroundColor: surfColor, borderColor: borderCol }]}>
            <Text style={[styles.cardTitle, { color: colors.textDim, fontSize: scaledFont(9.5) }]}>DELTA RATIO (Δ/Δ)</Text>
            <Text style={[styles.cardVal, { color: colors.text, fontSize: scaledFont(14) }]}>{delta.interp}</Text>
            <Text style={[styles.cardNote, { color: colors.textMuted, fontSize: scaledFont(11) }]}>
              ΔAG = {delta.dAG} | ΔHCO3 = {delta.dHCO3} | Ratio = {delta.ratio ?? "N/A"}
            </Text>
            {delta.mixed ? renderBadge(delta.mixed, "#FFA502") : null}
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: surfColor, borderColor: borderCol }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.textDim, fontSize: scaledFont(9.5) }]}>OXYGENATION</Text>
            {renderBadge(oxy.status, oxyColor(oxy.status))}
          </View>
          <Text style={[styles.cardVal, { color: colors.text, fontSize: scaledFont(14) }]}>{oxy.label}</Text>
          <View style={styles.oxyRow}>
            <Text style={[styles.oxyItem, { color: colors.textDim, fontSize: scaledFont(11) }]}>PaO2: {inp.PaO2} mmHg</Text>
            <Text style={[styles.oxyItem, { color: colors.textDim, fontSize: scaledFont(11) }]}>SaO2: {inp.SaO2}%</Text>
            {oxy.PF !== null ? <Text style={[styles.oxyItem, { color: colors.textDim, fontSize: scaledFont(11) }]}>P/F: {oxy.PF}</Text> : null}
          </View>
          {oxy.ARDS ? (
            <Text style={[styles.cardNote, { color: "#FF4757", marginTop: 6, fontSize: scaledFont(11) }]}>⚠ {oxy.ARDS}</Text>
          ) : null}
        </View>
      </View>
    );
  };

  const renderSteps = () => {
    if (!result) return null;
    return (
      <View style={[styles.card, { backgroundColor: surfColor, borderColor: borderCol }]}>
        <Text style={[styles.cardNote, { color: colors.textMuted, marginBottom: 12, fontSize: scaledFont(11) }]}>
          Tap each step to expand clinical reasoning and formulas.
        </Text>
        {result.steps.map((s, i) => {
          const open = openSteps[i] ?? false;
          return (
            <TouchableOpacity key={i} style={styles.stepItem} onPress={() => toggleStep(i)} activeOpacity={0.7}>
              <View style={styles.stepNum}>
                <Text style={[styles.stepNumText, { fontSize: scaledFont(11) }]}>{s.n}</Text>
              </View>
              <View style={styles.stepBody}>
                <Text style={[styles.stepTitle, { color: colors.text, fontSize: scaledFont(13) }]}>{s.title}</Text>
                <Text style={[styles.stepFinding, { color: teal, fontSize: scaledFont(11.5) }]}>{s.finding}</Text>
                {open ? (
                  <View style={[styles.stepDetail, { backgroundColor: surfElColor }]}>
                    <Text style={[styles.stepDetailText, { color: colors.textMuted, fontSize: scaledFont(11) }]}>{s.detail}</Text>
                  </View>
                ) : null}
              </View>
              {open ? <ChevronUp color={colors.textDim} size={14} /> : <ChevronDown color={colors.textDim} size={14} />}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderDdx = () => {
    if (!result) return null;
    if (result.ddx.length === 0) {
      return (
        <View style={[styles.card, { backgroundColor: surfColor, borderColor: borderCol, alignItems: "center" as const, paddingVertical: 30 }]}>
          <Text style={[{ color: colors.textDim, fontSize: scaledFont(13) }]}>No differential diagnosis for this pattern.</Text>
        </View>
      );
    }
    return (
      <View>
        <Text style={[styles.cardNote, { color: colors.textMuted, marginBottom: 10, fontSize: scaledFont(11) }]}>
          Tap categories to expand. Sources: ATS Tables 2–5 and ERS Tables 4–5.
        </Text>
        {result.ddx.map((g, gi) => {
          const open = openDdx[gi] ?? false;
          return (
            <View key={gi} style={[styles.ddxCat, { backgroundColor: surfElColor, borderColor: borderCol }]}>
              <TouchableOpacity style={styles.ddxHeader} onPress={() => toggleDdx(gi)} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ddxCatName, { color: g.col, fontSize: scaledFont(12) }]}>{g.cat}</Text>
                  <Text style={[styles.ddxCatCount, { color: colors.textDim, fontSize: scaledFont(10) }]}>{g.items.length} possible causes</Text>
                </View>
                {open ? <ChevronUp color={colors.textDim} size={14} /> : <ChevronDown color={colors.textDim} size={14} />}
              </TouchableOpacity>
              {open ? g.items.map((item, ii) => (
                <View key={ii} style={[styles.ddxItem, { borderTopColor: borderCol }]}>
                  <View style={[styles.ddxDot, { backgroundColor: g.col }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.ddxCause, { color: colors.textMuted, fontSize: scaledFont(12) }]}>{item.c}</Text>
                    <Text style={[styles.ddxDetail, { color: colors.textDim, fontSize: scaledFont(11) }]}>{item.d}</Text>
                    <Text style={[styles.ddxSrc, { color: colors.textDim, fontSize: scaledFont(10) }]}>{item.s}</Text>
                  </View>
                </View>
              )) : null}
            </View>
          );
        })}
      </View>
    );
  };

  const renderResultsPage = () => {
    if (!result) return null;
    const dc = disorderColor(result.prim.comp);

    return (
      <View style={styles.resultsWrap}>
        <View style={[styles.backBar, { borderBottomColor: borderCol, backgroundColor: colors.bg, paddingTop: insets.top + 12 }]}>
          <TouchableOpacity style={[styles.backBtn, { backgroundColor: surfColor, borderColor: borderCol }]} onPress={goBack} activeOpacity={0.7}>
            <ArrowLeft color={colors.textMuted} size={16} />
            <Text style={[styles.backBtnText, { color: colors.textMuted, fontSize: scaledFont(13) }]}>Back</Text>
          </TouchableOpacity>
          <Text style={[styles.backInfo, { color: colors.textDim, fontSize: scaledFont(11) }]} numberOfLines={1}>
            pH {fields.pH}   PaCO2 {fields.PaCO2}   HCO3 {fields.HCO3}   PaO2 {fields.PaO2}
          </Text>
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
          {renderPHGauge()}
          {renderCritAlerts()}

          <View style={[styles.banner, { borderColor: dc + "44", backgroundColor: dc + "0A" }]}>
            <View style={styles.bannerTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.bannerLabel, { fontSize: scaledFont(10) }]}>PRIMARY DISORDER</Text>
                <Text style={[styles.bannerVal, { color: colors.text, fontSize: scaledFont(18) }]}>{result.prim.label}</Text>
              </View>
              {renderBadge(result.phR.label, phColor(result.phR.dir))}
            </View>
            <View style={styles.badgeRow}>
              {renderBadge(result.compShort, compBadgeColor(result.compShort))}
              {result.agElev ? renderBadge("Elevated AG", "#FF4757") : null}
              {result.oxy.ARDS ? renderBadge(result.oxy.ARDS.split("(")[0].trim(), "#FF4757") : null}
              {result.delta?.mixed ? renderBadge(result.delta.mixed, "#FFA502") : null}
            </View>
          </View>

          <View style={styles.subTabs}>
            {(["summary", "steps", "ddx"] as SubTab[]).map((tab, idx) => {
              const labels = ["Summary", "Reasoning", "DDx"];
              const isActive = subTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.subTab,
                    { borderColor: isActive ? "rgba(0,201,167,0.45)" : borderCol, backgroundColor: isActive ? "rgba(0,201,167,0.12)" : surfColor },
                  ]}
                  onPress={() => { setSubTab(tab); setOpenSteps({}); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.subTabText, { color: isActive ? teal : colors.textMuted, fontSize: scaledFont(12) }]}>{labels[idx]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {subTab === "summary" && renderSummary()}
          {subTab === "steps" && renderSteps()}
          {subTab === "ddx" && renderDdx()}
        </ScrollView>
      </View>
    );
  };

  if (showResults && result) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <Stack.Screen
          options={{
            title: "ABG Results",
            headerStyle: { backgroundColor: colors.bgHeader },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: "700" as const, fontSize: 16 },
            headerShown: false,
          }}
        />
        {renderResultsPage()}
        {interpreting && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={teal} />
            <Text style={[styles.loadingText, { fontSize: scaledFont(13) }]}>Analysing ABG values…</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <Stack.Screen
        options={{
          title: "ABG Interpreter",
          headerStyle: { backgroundColor: colors.bgHeader },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: "700" as const, fontSize: 16 },
        }}
      />
      <View style={[styles.tabBar, { borderBottomColor: borderCol }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "input" && styles.tabBtnActive]}
          onPress={() => setActiveTab("input")}
          activeOpacity={0.7}
        >
          <FlaskConical color={activeTab === "input" ? teal : colors.textDim} size={14} />
          <Text style={[styles.tabBtnText, { color: activeTab === "input" ? teal : colors.textDim, fontSize: scaledFont(12) }]}>Interpret</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "ref" && styles.tabBtnActive]}
          onPress={() => setActiveTab("ref")}
          activeOpacity={0.7}
        >
          <BookOpen color={activeTab === "ref" ? teal : colors.textDim} size={14} />
          <Text style={[styles.tabBtnText, { color: activeTab === "ref" ? teal : colors.textDim, fontSize: scaledFont(12) }]}>Reference</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === "input" ? renderInputPage() : renderRefPage()}
      </ScrollView>

      {interpreting && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={teal} />
          <Text style={[styles.loadingText, { fontSize: scaledFont(13) }]}>Analysing ABG values…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  page: { padding: 16 },
  tabBar: { flexDirection: "row" as const, borderBottomWidth: 1 },
  tabBtn: { flex: 1, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabBtnActive: { borderBottomColor: "#00C9A7" },
  tabBtnText: { fontWeight: "600" as const, letterSpacing: 0.3 },
  sectionLabel: { fontWeight: "700" as const, letterSpacing: 1.5, textTransform: "uppercase" as const, marginBottom: 10, marginTop: 4 },
  examplesScroll: { marginBottom: 4 },
  examplesContent: { gap: 8, paddingBottom: 6 },
  exampleCard: { borderRadius: 12, padding: 10, paddingHorizontal: 12, borderWidth: 1.5, minWidth: 88 },
  exampleIcon: { fontSize: 18, marginBottom: 4 },
  exampleName: { fontWeight: "700" as const },
  exampleDesc: { marginTop: 2, lineHeight: 14 },
  divider: { height: 1, marginVertical: 18 },

  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: 14,
    gap: 10,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontWeight: "700" as const,
  },
  sectionSubtitle: {
    marginTop: 1,
  },
  sectionCount: {
    fontWeight: "600" as const,
  },
  sectionFieldsGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 8,
  },
  fieldCol: {
    width: "31%" as any,
    minWidth: 90,
    flexGrow: 1,
  },
  fieldHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "baseline" as const,
    marginBottom: 5,
    gap: 2,
  },
  fieldLabel: {
    fontWeight: "700" as const,
  },
  fieldNormal: {
    flexShrink: 1,
  },
  fieldInputWrap: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingLeft: 10,
    paddingRight: 4,
    minHeight: 44,
  },
  fieldInput: {
    flex: 1,
    paddingVertical: 10,
    fontVariant: ["tabular-nums"],
  },
  unitToggleBtn: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 5,
    marginLeft: 4,
  },
  unitToggleText: {
    fontWeight: "700" as const,
    letterSpacing: 0.2,
  },
  unitStaticText: {
    marginLeft: 4,
    marginRight: 4,
    fontWeight: "500" as const,
  },

  primaryBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 18,
    backgroundColor: "#00C9A7",
  },
  primaryBtnDisabled: { opacity: 0.35 },
  primaryBtnText: { color: "#0A0F1A", fontWeight: "700" as const, letterSpacing: 0.3 },
  secondaryBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
  },
  secondaryBtnText: { fontWeight: "600" as const },
  hint: { textAlign: "center" as const, marginTop: 8 },
  disclaimer: { textAlign: "center" as const, lineHeight: 17, paddingHorizontal: 8 },
  disclaimerWarn: { textAlign: "center" as const, fontWeight: "600" as const, marginTop: 4 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,15,26,0.88)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 14,
    zIndex: 999,
  },
  loadingText: { color: "#00C9A7", fontWeight: "600" as const },
  resultsWrap: { flex: 1 },
  backBar: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 13, paddingVertical: 8 },
  backBtnText: { fontWeight: "600" as const },
  backInfo: { flex: 1 },
  gaugeWrap: { borderRadius: 16, padding: 14, paddingHorizontal: 16, marginBottom: 10, borderWidth: 1 },
  gaugeTop: { flexDirection: "row" as const, alignItems: "baseline" as const, justifyContent: "space-between" as const, marginBottom: 6 },
  gaugeLbl: { fontWeight: "700" as const, letterSpacing: 1, textTransform: "uppercase" as const },
  phBig: { fontWeight: "800" as const, letterSpacing: -1 },
  gaugeBarOuter: { marginVertical: 8, marginBottom: 18, position: "relative" as const },
  gaugeBarSegments: {
    height: 12,
    borderRadius: 6,
    flexDirection: "row" as const,
    overflow: "hidden" as const,
  },
  gaugeSegment: {
    height: 12,
  },
  gaugeMarkerWrap: {
    position: "absolute" as const,
    top: -5,
    marginLeft: -11,
  },
  gaugeMarkerOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 2,
    borderColor: "#1A2332",
  },
  gaugeMarkerInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  gaugeLabels: { flexDirection: "row" as const, justifyContent: "space-between" as const },
  gaugeLabelItem: { fontWeight: "600" as const },
  alertBox: { borderWidth: 1, borderRadius: 14, padding: 13, paddingHorizontal: 14, marginBottom: 10 },
  alertHeader: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, marginBottom: 8 },
  alertTitle: { fontWeight: "700" as const, letterSpacing: 1, textTransform: "uppercase" as const },
  alertItem: { borderLeftWidth: 2, paddingVertical: 4, paddingLeft: 12, marginBottom: 5 },
  alertItemText: { lineHeight: 19 },
  banner: { borderWidth: 1, borderRadius: 16, padding: 15, paddingHorizontal: 16, marginBottom: 10 },
  bannerTop: { flexDirection: "row" as const, alignItems: "flex-start" as const, justifyContent: "space-between" as const, gap: 8, marginBottom: 8 },
  bannerLabel: { fontWeight: "700" as const, letterSpacing: 1.2, color: "#00C9A7", textTransform: "uppercase" as const, marginBottom: 5 },
  bannerVal: { fontWeight: "700" as const, lineHeight: 24 },
  badgeRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6, marginTop: 4 },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontWeight: "700" as const, letterSpacing: 0.3 },
  subTabs: { flexDirection: "row" as const, gap: 8, marginBottom: 12 },
  subTab: { flex: 1, paddingVertical: 9, paddingHorizontal: 6, borderRadius: 8, borderWidth: 1, alignItems: "center" as const },
  subTabText: { fontWeight: "700" as const },
  metGrid: { flexDirection: "row" as const, gap: 9, marginBottom: 10 },
  metCard: { flex: 1, borderRadius: 12, padding: 11, paddingHorizontal: 13, borderWidth: 1 },
  metLabel: { fontWeight: "700" as const, letterSpacing: 0.8, textTransform: "uppercase" as const, marginBottom: 3 },
  metValue: { fontWeight: "700" as const },
  metUnit: { fontWeight: "400" as const },
  metSub: { marginTop: 2, lineHeight: 14 },
  card: { borderRadius: 16, padding: 13, paddingHorizontal: 15, marginBottom: 9, borderWidth: 1 },
  cardHeader: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, marginBottom: 8 },
  cardTitle: { fontWeight: "700" as const, letterSpacing: 1.2, textTransform: "uppercase" as const },
  cardVal: { fontWeight: "500" as const, lineHeight: 22 },
  cardNote: { lineHeight: 17, marginTop: 6 },
  formulaBox: { borderRadius: 8, padding: 7, paddingHorizontal: 10, marginTop: 8 },
  formulaBoxText: { fontWeight: "600" as const, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  agRow: { flexDirection: "row" as const, alignItems: "stretch" as const, marginTop: 8 },
  agCol: { flex: 1, alignItems: "center" as const, paddingVertical: 8, paddingHorizontal: 4 },
  agColBorder: { borderLeftWidth: 1 },
  agNum: { fontWeight: "800" as const },
  agLabel: { fontWeight: "700" as const, letterSpacing: 0.5, textTransform: "uppercase" as const, marginTop: 2 },
  agSub: { marginTop: 1 },
  oxyRow: { flexDirection: "row" as const, gap: 16, marginTop: 8, flexWrap: "wrap" as const },
  oxyItem: {},
  stepItem: { flexDirection: "row" as const, gap: 10, marginBottom: 12 },
  stepNum: { width: 26, height: 26, borderRadius: 7, backgroundColor: "rgba(0,201,167,0.15)", borderWidth: 1, borderColor: "rgba(0,201,167,0.3)", alignItems: "center" as const, justifyContent: "center" as const, marginTop: 2 },
  stepNumText: { fontWeight: "700" as const, color: "#00C9A7" },
  stepBody: { flex: 1 },
  stepTitle: { fontWeight: "600" as const },
  stepFinding: { marginTop: 3, lineHeight: 18 },
  stepDetail: { borderRadius: 8, padding: 8, paddingHorizontal: 10, marginTop: 6 },
  stepDetailText: { lineHeight: 18 },
  ddxCat: { borderRadius: 12, marginBottom: 8, overflow: "hidden" as const, borderWidth: 1 },
  ddxHeader: { flexDirection: "row" as const, alignItems: "center" as const, padding: 11, paddingHorizontal: 13 },
  ddxCatName: { fontWeight: "700" as const },
  ddxCatCount: { marginTop: 2 },
  ddxItem: { flexDirection: "row" as const, gap: 9, padding: 9, paddingHorizontal: 13, borderTopWidth: 1 },
  ddxDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  ddxCause: { fontWeight: "600" as const },
  ddxDetail: { marginTop: 2, lineHeight: 17 },
  ddxSrc: { marginTop: 2, fontStyle: "italic" as const },
  refCard: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, borderRadius: 12, padding: 11, paddingHorizontal: 13, marginBottom: 7, borderWidth: 1 },
  refCardLeft: { flex: 1 },
  refName: { fontWeight: "700" as const, marginBottom: 2 },
  refNormal: {},
  refCrit: { marginTop: 1 },
  refSrc: {},
  formulaCard: { borderRadius: 12, padding: 10, paddingHorizontal: 13, marginBottom: 6, borderWidth: 1 },
  formulaName: { marginBottom: 3 },
  formulaVal: { fontWeight: "600" as const, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  mixedCard: { borderRadius: 12, padding: 11, paddingHorizontal: 13, marginBottom: 7, borderWidth: 1 },
  mixedPat: { fontWeight: "700" as const, marginBottom: 4 },
  mixedTags: { flexDirection: "row" as const, gap: 5, flexWrap: "wrap" as const, marginBottom: 5 },
  mixedTag: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  mixedTagText: { fontWeight: "600" as const },
  mixedEx: { lineHeight: 17 },
  srcBox: { backgroundColor: "rgba(0,201,167,0.07)", borderWidth: 1, borderColor: "rgba(0,201,167,0.25)", borderRadius: 12, padding: 13, paddingHorizontal: 14 },
  srcTitle: { fontWeight: "700" as const, color: "#00C9A7", marginBottom: 6 },
  srcText: { lineHeight: 20 },
});
