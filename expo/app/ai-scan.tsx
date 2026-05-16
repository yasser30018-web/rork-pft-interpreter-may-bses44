import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  Easing,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Brain,
  Camera,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Scan,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  RotateCcw,
  Download,
  Save,
  History as HistoryIcon,
  Stethoscope,
  Activity,
  Layers,
  Trophy,
  FileText,
  Wand2,
} from "lucide-react-native";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import { analyzeHRCT } from "@/utils/hrctAnalyzer";
import type {
  ClinicalContext,
  Gender,
  HRCTAnalysis,
  HRCTHistoryItem,
  ImageType,
  SmokingStatus,
} from "@/types/hrct";

const HISTORY_KEY = "pulmolab_hrct_history_v1";
const SYMPTOM_OPTIONS = [
  "Dyspnea",
  "Cough",
  "Hemoptysis",
  "Fever",
  "Weight loss",
  "Chest pain",
  "Wheeze",
  "Pleuritic pain",
];

const IMAGE_TYPES: { id: ImageType; label: string; desc: string }[] = [
  { id: "cxr", label: "Chest X-Ray", desc: "Plain radiograph" },
  { id: "hrct", label: "HRCT", desc: "High-res CT chest" },
  { id: "ctpa", label: "CTPA", desc: "Pulmonary angiogram" },
];

const LOADING_STEPS = [
  { label: "Uploading image", icon: ImageIcon, until: 15 },
  { label: "Detecting patterns", icon: Scan, until: 35 },
  { label: "Analyzing distribution", icon: Layers, until: 60 },
  { label: "Applying diagnostic algorithm", icon: Activity, until: 85 },
  { label: "Generating report", icon: Sparkles, until: 100 },
];

export default function AIScanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, scaledFont, isDark } = useTheme();
  const { user } = useAuth();

  const [imageType, setImageType] = useState<ImageType>("hrct");
  const [contextOpen, setContextOpen] = useState<boolean>(false);
  const [ctx, setCtx] = useState<ClinicalContext>({ symptoms: [] });
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [pickedMime, setPickedMime] = useState<string>("image/jpeg");
  const [pickedBase64, setPickedBase64] = useState<string | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [result, setResult] = useState<HRCTAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  const haptic = useCallback((style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(style);
    }
  }, []);

  const pickImage = useCallback(
    async (fromCamera: boolean) => {
      haptic();
      try {
        if (fromCamera) {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert("Camera access needed", "Enable camera permission to capture an image.");
            return;
          }
          const res = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.9,
            base64: false,
          });
          if (res.canceled || !res.assets?.[0]) return;
          await processPicked(res.assets[0].uri);
        } else {
          const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.9,
            base64: false,
          });
          if (res.canceled || !res.assets?.[0]) return;
          await processPicked(res.assets[0].uri);
        }
      } catch (e) {
        console.log("[ai-scan] pick error", e);
        Alert.alert("Couldn't load image", "Please try again with a different image.");
      }
    },
    [haptic]
  );

  const processPicked = useCallback(async (uri: string) => {
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      setPickedUri(manipulated.uri);
      setPickedMime("image/jpeg");
      setPickedBase64(manipulated.base64 ?? null);
      setResult(null);
      setError(null);
    } catch (e) {
      console.log("[ai-scan] processPicked error", e);
      Alert.alert("Couldn't prepare image", "The image may be too large or corrupted.");
    }
  }, []);

  const toggleSymptom = useCallback((s: string) => {
    haptic();
    setCtx((prev) => {
      const list = prev.symptoms ?? [];
      const next = list.includes(s) ? list.filter((x) => x !== s) : [...list, s];
      return { ...prev, symptoms: next };
    });
  }, [haptic]);

  const runAnalysis = useCallback(async () => {
    if (!pickedBase64) {
      Alert.alert("Add an image first", "Pick or capture an image to analyze.");
      return;
    }
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setProgress(5);

    // Drive simulated progress while waiting
    let p = 5;
    const interval = setInterval(() => {
      p = Math.min(p + 4, 90);
      setProgress(p);
    }, 600);

    try {
      const analysis = await analyzeHRCT({
        imageBase64: pickedBase64,
        imageMime: pickedMime,
        imageType,
        context: ctx,
      });
      clearInterval(interval);
      setProgress(100);
      setResult(analysis);
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      // Persist to history
      await saveHistory({
        id: `${Date.now()}`,
        imageUri: pickedUri ?? "",
        imageType,
        context: ctx,
        result: analysis,
        createdAt: Date.now(),
      });
    } catch (e) {
      clearInterval(interval);
      const msg = e instanceof Error ? e.message : "Analysis failed.";
      setError(msg);
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setIsAnalyzing(false);
    }
  }, [pickedBase64, pickedMime, pickedUri, imageType, ctx, haptic]);

  const resetAll = useCallback(() => {
    haptic();
    setPickedUri(null);
    setPickedBase64(null);
    setResult(null);
    setError(null);
    setProgress(0);
  }, [haptic]);

  const exportPDF = useCallback(async () => {
    if (!result) return;
    haptic();
    try {
      const html = buildReportHTML(result, ctx, imageType, pickedUri);
      const file = await Print.printToFileAsync({ html });
      if (Platform.OS === "web") {
        Alert.alert("PDF generated", "Download started.");
        return;
      }
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", dialogTitle: "HRCT Report" });
      } else {
        Alert.alert("Saved", `PDF saved at ${file.uri}`);
      }
    } catch (e) {
      console.log("[ai-scan] pdf error", e);
      Alert.alert("Couldn't export PDF", "Please try again.");
    }
  }, [result, ctx, imageType, pickedUri, haptic]);

  const saveToLogbook = useCallback(() => {
    haptic();
    Alert.alert("Saved", "This analysis has been saved to your AI Scan history. Open Log Book to attach it to a case.");
    router.push("/logbook" as never);
  }, [haptic, router]);

  // ---------- RENDER ----------
  const showResults = !!result;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <Stack.Screen
        options={{
          title: "AI Scan",
          headerStyle: { backgroundColor: colors.bgHeader },
          headerTintColor: colors.text,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push("/ai-scan-history" as never)}
              style={{ marginRight: 6, padding: 6 }}
              testID="ai-history-btn"
            >
              <HistoryIcon color={colors.text} size={20} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO */}
        <View style={[styles.hero, { backgroundColor: isDark ? "#0F172A" : "#0d9488", borderColor: colors.border }]}>
          <View style={styles.heroRow}>
            <View style={[styles.heroIcon, { backgroundColor: "rgba(255,255,255,0.12)" }]}>
              <Brain color="#fff" size={26} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroTitle, { fontSize: scaledFont(20) }]}>HRCT Analyzer</Text>
              <Text style={[styles.heroSubtitle, { fontSize: scaledFont(12) }]}>
                Pattern Recognition & DDx
              </Text>
            </View>
            <View style={styles.aiBadge}>
              <Sparkles color="#fff" size={11} />
              <Text style={styles.aiBadgeText}>AI Assisted</Text>
            </View>
          </View>
        </View>

        {!showResults && (
          <>
            {/* STEP 1 — Image type */}
            <SectionHeader index={1} title="Image Type" colors={colors} scaledFont={scaledFont} />
            <View style={styles.typeRow}>
              {IMAGE_TYPES.map((t) => {
                const active = imageType === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => {
                      haptic();
                      setImageType(t.id);
                    }}
                    activeOpacity={0.85}
                    style={[
                      styles.typeChip,
                      {
                        backgroundColor: active ? colors.accent : colors.bgCard,
                        borderColor: active ? colors.accent : colors.border,
                      },
                    ]}
                    testID={`type-${t.id}`}
                  >
                    <Text
                      style={[
                        styles.typeChipLabel,
                        { color: active ? "#fff" : colors.text, fontSize: scaledFont(13) },
                      ]}
                    >
                      {t.label}
                    </Text>
                    <Text
                      style={[
                        styles.typeChipDesc,
                        { color: active ? "rgba(255,255,255,0.85)" : colors.textMuted, fontSize: scaledFont(10) },
                      ]}
                    >
                      {t.desc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* STEP 2 — Clinical context (collapsible) */}
            <SectionHeader index={2} title="Clinical Context" colors={colors} scaledFont={scaledFont} />
            <TouchableOpacity
              onPress={() => {
                haptic();
                setContextOpen((v) => !v);
              }}
              style={[styles.contextHeader, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
              activeOpacity={0.85}
              testID="toggle-context"
            >
              <View style={styles.row}>
                <Stethoscope color={colors.accent} size={16} />
                <Text style={[styles.contextHeaderLabel, { color: colors.text, fontSize: scaledFont(13) }]}>
                  {contextOpen ? "Hide clinical context" : "Add clinical context (optional)"}
                </Text>
              </View>
              {contextOpen ? <ChevronUp color={colors.textMuted} size={16} /> : <ChevronDown color={colors.textMuted} size={16} />}
            </TouchableOpacity>

            {contextOpen && (
              <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <View style={styles.fieldRow}>
                  <Field label="Age" colors={colors} scaledFont={scaledFont}>
                    <TextInput
                      keyboardType="numeric"
                      value={ctx.age ?? ""}
                      onChangeText={(v) => setCtx((p) => ({ ...p, age: v }))}
                      placeholder="e.g. 58"
                      placeholderTextColor={colors.textDim}
                      style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
                    />
                  </Field>
                  <Field label="Gender" colors={colors} scaledFont={scaledFont}>
                    <View style={styles.segment}>
                      {(["male", "female"] as Gender[]).map((g) => {
                        const active = ctx.gender === g;
                        return (
                          <TouchableOpacity
                            key={g}
                            onPress={() => setCtx((p) => ({ ...p, gender: g }))}
                            style={[
                              styles.segmentItem,
                              {
                                backgroundColor: active ? colors.accent : "transparent",
                                borderColor: colors.border,
                              },
                            ]}
                          >
                            <Text style={{ color: active ? "#fff" : colors.text, fontSize: scaledFont(12), fontWeight: "600" }}>
                              {g === "male" ? "M" : "F"}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </Field>
                </View>

                <Field label="Smoking status" colors={colors} scaledFont={scaledFont}>
                  <View style={styles.segment}>
                    {(["non", "ex", "active"] as SmokingStatus[]).map((s) => {
                      const active = ctx.smoking === s;
                      const label = s === "non" ? "Non-smoker" : s === "ex" ? "Ex-smoker" : "Active";
                      return (
                        <TouchableOpacity
                          key={s}
                          onPress={() => setCtx((p) => ({ ...p, smoking: s }))}
                          style={[
                            styles.segmentItem,
                            {
                              backgroundColor: active ? colors.accent : "transparent",
                              borderColor: colors.border,
                              flex: 1,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: active ? "#fff" : colors.text,
                              fontSize: scaledFont(11),
                              fontWeight: "600",
                            }}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </Field>

                <Field label="Brief clinical history" colors={colors} scaledFont={scaledFont}>
                  <TextInput
                    multiline
                    maxLength={200}
                    value={ctx.history ?? ""}
                    onChangeText={(v) => setCtx((p) => ({ ...p, history: v }))}
                    placeholder="e.g. 3-week dyspnea, occupational asbestos exposure"
                    placeholderTextColor={colors.textDim}
                    style={[
                      styles.input,
                      {
                        color: colors.text,
                        borderColor: colors.border,
                        backgroundColor: colors.bg,
                        minHeight: 64,
                        textAlignVertical: "top",
                      },
                    ]}
                  />
                </Field>

                <Text style={[styles.label, { color: colors.textMuted, fontSize: scaledFont(11) }]}>SYMPTOMS</Text>
                <View style={styles.chipsWrap}>
                  {SYMPTOM_OPTIONS.map((s) => {
                    const active = ctx.symptoms?.includes(s);
                    return (
                      <TouchableOpacity
                        key={s}
                        onPress={() => toggleSymptom(s)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: active ? colors.accent + "20" : colors.bg,
                            borderColor: active ? colors.accent : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: active ? colors.accent : colors.textMuted,
                            fontSize: scaledFont(11),
                            fontWeight: "600",
                          }}
                        >
                          {s}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Field label="Suspected diagnosis" colors={colors} scaledFont={scaledFont}>
                  <TextInput
                    value={ctx.suspicion ?? ""}
                    onChangeText={(v) => setCtx((p) => ({ ...p, suspicion: v }))}
                    placeholder="e.g. IPF vs NSIP"
                    placeholderTextColor={colors.textDim}
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
                  />
                </Field>
              </View>
            )}

            {/* STEP 3 — Upload */}
            <SectionHeader index={3} title="Upload Image" colors={colors} scaledFont={scaledFont} />
            {!pickedUri ? (
              <View style={[styles.uploadZone, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <View style={[styles.uploadIconWrap, { backgroundColor: colors.accent + "15" }]}>
                  <Scan color={colors.accent} size={32} />
                </View>
                <Text style={[styles.uploadTitle, { color: colors.text, fontSize: scaledFont(14) }]}>
                  Add an image to analyze
                </Text>
                <Text style={[styles.uploadDesc, { color: colors.textMuted, fontSize: scaledFont(11) }]}>
                  JPEG or PNG · auto-compressed before analysis
                </Text>
                <View style={styles.uploadActions}>
                  <TouchableOpacity
                    onPress={() => pickImage(true)}
                    style={[styles.uploadBtn, { backgroundColor: colors.accent }]}
                    activeOpacity={0.85}
                    testID="upload-camera"
                  >
                    <Camera color="#fff" size={16} />
                    <Text style={styles.uploadBtnText}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => pickImage(false)}
                    style={[styles.uploadBtn, { backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border }]}
                    activeOpacity={0.85}
                    testID="upload-gallery"
                  >
                    <ImageIcon color={colors.text} size={16} />
                    <Text style={[styles.uploadBtnText, { color: colors.text }]}>Gallery</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={[styles.thumbCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Image source={{ uri: pickedUri }} style={styles.thumb} resizeMode="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.thumbTitle, { color: colors.text, fontSize: scaledFont(13) }]}>
                    Ready to analyze
                  </Text>
                  <Text style={[styles.thumbDesc, { color: colors.textMuted, fontSize: scaledFont(11) }]}>
                    {imageType.toUpperCase()} · Image prepared
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <TouchableOpacity onPress={() => pickImage(false)} style={[styles.smallBtn, { borderColor: colors.border }]}>
                      <Text style={{ color: colors.textMuted, fontSize: scaledFont(11), fontWeight: "600" }}>Replace</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={resetAll} style={[styles.smallBtn, { borderColor: colors.border }]}>
                      <Text style={{ color: colors.red, fontSize: scaledFont(11), fontWeight: "600" }}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Analyze CTA */}
            {pickedUri && !isAnalyzing && (
              <TouchableOpacity
                onPress={runAnalysis}
                style={[styles.analyzeBtn, { backgroundColor: colors.accent }]}
                activeOpacity={0.9}
                testID="analyze-btn"
              >
                <Wand2 color="#fff" size={18} />
                <Text style={styles.analyzeBtnText}>Analyze with AI</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Loading */}
        {isAnalyzing && (
          <LoadingPanel
            progress={progress}
            progressAnim={progressAnim}
            colors={colors}
            scaledFont={scaledFont}
          />
        )}

        {/* Error */}
        {error && !isAnalyzing && (
          <View style={[styles.errorCard, { backgroundColor: colors.redBg, borderColor: colors.red }]}>
            <AlertTriangle color={colors.red} size={18} />
            <Text style={{ color: colors.red, flex: 1, fontSize: scaledFont(12), fontWeight: "600" }}>{error}</Text>
            <TouchableOpacity onPress={runAnalysis}>
              <RotateCcw color={colors.red} size={16} />
            </TouchableOpacity>
          </View>
        )}

        {/* Results */}
        {showResults && result && (
          <ResultsView
            result={result}
            imageUri={pickedUri}
            imageType={imageType}
            colors={colors}
            scaledFont={scaledFont}
            isDark={isDark}
            onNew={resetAll}
            onExport={exportPDF}
            onSave={saveToLogbook}
          />
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================
// Subcomponents
// ============================================================

function SectionHeader({
  index,
  title,
  colors,
  scaledFont,
}: {
  index: number;
  title: string;
  colors: ReturnType<typeof useTheme>["colors"];
  scaledFont: (n: number) => number;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.stepNum, { backgroundColor: colors.accent }]}>
        <Text style={styles.stepNumText}>{index}</Text>
      </View>
      <Text style={[styles.sectionTitle, { color: colors.text, fontSize: scaledFont(13) }]}>{title}</Text>
    </View>
  );
}

function Field({
  label,
  children,
  colors,
  scaledFont,
}: {
  label: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useTheme>["colors"];
  scaledFont: (n: number) => number;
}) {
  return (
    <View style={{ flex: 1, marginBottom: 12 }}>
      <Text style={[styles.label, { color: colors.textMuted, fontSize: scaledFont(11) }]}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function LoadingPanel({
  progress,
  progressAnim,
  colors,
  scaledFont,
}: {
  progress: number;
  progressAnim: Animated.Value;
  colors: ReturnType<typeof useTheme>["colors"];
  scaledFont: (n: number) => number;
}) {
  const widthInterp = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });
  return (
    <View style={[styles.loadingCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={styles.row}>
        <ActivityIndicator color={colors.accent} />
        <Text style={[styles.loadingTitle, { color: colors.text, fontSize: scaledFont(14) }]}>
          Running AI analysis…
        </Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: colors.bgElevated }]}>
        <Animated.View style={[styles.progressFill, { width: widthInterp, backgroundColor: colors.accent }]} />
      </View>
      <View style={{ marginTop: 14, gap: 10 }}>
        {LOADING_STEPS.map((s) => {
          const reached = progress >= s.until - 5;
          const active = progress < s.until && progress >= (LOADING_STEPS[LOADING_STEPS.indexOf(s) - 1]?.until ?? 0);
          const Icon = s.icon;
          const color = reached ? colors.accent : active ? colors.accent : colors.textDim;
          return (
            <View key={s.label} style={styles.row}>
              <Icon color={color} size={14} />
              <Text style={{ color, fontSize: scaledFont(12), fontWeight: "600" }}>{s.label}</Text>
              {reached && <CheckCircle2 color={colors.green} size={14} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function SeverityDot({ severity, colors }: { severity?: string; colors: ReturnType<typeof useTheme>["colors"] }) {
  const c =
    severity === "severe"
      ? colors.red
      : severity === "moderate"
      ? colors.amber
      : severity === "mild"
      ? colors.green
      : colors.textDim;
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />;
}

function UIPColor(category: string, colors: ReturnType<typeof useTheme>["colors"]) {
  const c = (category || "").toLowerCase();
  if (c.includes("alternative")) return colors.accent;
  if (c.includes("indeterminate")) return colors.amber;
  if (c.includes("probable")) return colors.orange;
  if (c === "uip" || c.startsWith("uip")) return colors.red;
  return colors.textMuted;
}

function ResultsView({
  result,
  imageUri,
  imageType,
  colors,
  scaledFont,
  isDark,
  onNew,
  onExport,
  onSave,
}: {
  result: HRCTAnalysis;
  imageUri: string | null;
  imageType: ImageType;
  colors: ReturnType<typeof useTheme>["colors"];
  scaledFont: (n: number) => number;
  isDark: boolean;
  onNew: () => void;
  onExport: () => void;
  onSave: () => void;
}) {
  const sev = (result.severity_overall ?? "").toLowerCase();
  const sevColor =
    sev === "critical"
      ? "#991B1B"
      : sev === "severe"
      ? colors.red
      : sev === "moderate"
      ? colors.amber
      : sev === "mild"
      ? colors.green
      : colors.textMuted;

  return (
    <View style={{ gap: 14 }}>
      {/* Header card */}
      <View style={[styles.reportHeader, { backgroundColor: "#0F172A" }]}>
        <View style={styles.row}>
          <Brain color="#fff" size={18} />
          <Text style={[styles.reportTitle, { fontSize: scaledFont(16) }]}>HRCT REPORT</Text>
          <View style={[styles.watermark, { backgroundColor: "rgba(245,158,11,0.18)", borderColor: "rgba(245,158,11,0.4)" }]}>
            <Text style={[styles.watermarkText, { fontSize: scaledFont(9) }]}>AI-ASSISTED</Text>
          </View>
        </View>
        {imageUri && <Image source={{ uri: imageUri }} style={styles.reportImage} resizeMode="cover" />}
        <View style={[styles.row, { marginTop: 12, flexWrap: "wrap" }]}>
          {result.image_quality && (
            <Badge label={`Quality: ${result.image_quality}`} bg="rgba(125,211,252,0.18)" fg="#7DD3FC" />
          )}
          {result.severity_overall && (
            <Badge label={`Overall: ${result.severity_overall}`} bg={sevColor + "22"} fg={sevColor} />
          )}
          <Badge label={imageType.toUpperCase()} bg="rgba(167,139,250,0.18)" fg="#A78BFA" />
        </View>
        {result.urgent && (
          <View style={styles.urgentBanner}>
            <AlertTriangle color="#fff" size={14} />
            <Text style={styles.urgentText}>URGENT · {result.urgent_reason ?? "Immediate clinical attention"}</Text>
          </View>
        )}
        {result.overall_impression && (
          <Text style={[styles.impression, { fontSize: scaledFont(12) }]}>{result.overall_impression}</Text>
        )}
      </View>

      {/* Section 1 — Primary patterns */}
      {result.primary_patterns && result.primary_patterns.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <SectionTitle title="1. Primary Patterns" icon={<Layers color={colors.accent} size={16} />} colors={colors} scaledFont={scaledFont} />
          {result.primary_patterns.map((p, i) => (
            <View key={i} style={[styles.patternRow, { borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }]}>
              <View style={[styles.row, { justifyContent: "space-between" }]}>
                <View style={[styles.row, { flex: 1 }]}>
                  <SeverityDot severity={p.severity} colors={colors} />
                  <Text style={[styles.patternName, { color: colors.accent, fontSize: scaledFont(13) }]}>
                    {p.pattern}
                  </Text>
                </View>
                {p.distribution && (
                  <View style={[styles.distBadge, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
                    <Text style={{ color: colors.textMuted, fontSize: scaledFont(10), fontWeight: "600" }}>
                      {p.distribution}
                    </Text>
                  </View>
                )}
              </View>
              {p.subtype ? (
                <Text style={[styles.patternSubtype, { color: colors.text, fontSize: scaledFont(12) }]}>{p.subtype}</Text>
              ) : null}
              <Text style={[styles.patternDesc, { color: colors.textMuted, fontSize: scaledFont(11) }]}>
                {p.description}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Section 2 — UIP */}
      {result.uip_classification?.applicable && (
        <View
          style={[
            styles.section,
            {
              backgroundColor: UIPColor(result.uip_classification.category, colors) + "15",
              borderColor: UIPColor(result.uip_classification.category, colors),
            },
          ]}
        >
          <SectionTitle title="2. UIP Classification (ATS 2018)" icon={<Activity color={UIPColor(result.uip_classification.category, colors)} size={16} />} colors={colors} scaledFont={scaledFont} />
          <Text style={[styles.uipCategory, { color: UIPColor(result.uip_classification.category, colors), fontSize: scaledFont(16) }]}>
            {result.uip_classification.category}
          </Text>
          {result.uip_classification.reasoning && (
            <Text style={{ color: colors.textMuted, fontSize: scaledFont(12), marginTop: 6, lineHeight: 18 }}>
              {result.uip_classification.reasoning}
            </Text>
          )}
        </View>
      )}

      {/* Section 3 — Secondary findings */}
      {result.secondary_findings && result.secondary_findings.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <SectionTitle title="3. Secondary Findings" icon={<Scan color={colors.amber} size={16} />} colors={colors} scaledFont={scaledFont} />
          {result.secondary_findings.map((f, i) => (
            <View key={i} style={[styles.findingRow, { borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }]}>
              <View style={[styles.findingDot, { backgroundColor: colors.amber }]} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: scaledFont(12), fontWeight: "700" }}>{f.finding}</Text>
                <Text style={{ color: colors.textMuted, fontSize: scaledFont(11), marginTop: 2, lineHeight: 16 }}>
                  {f.description}
                </Text>
                {f.significance ? (
                  <Text style={{ color: colors.textDim, fontSize: scaledFont(10), marginTop: 4, fontStyle: "italic" }}>
                    {f.significance}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Section 4 — DDx */}
      {result.differential_diagnosis && result.differential_diagnosis.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <SectionTitle title="4. Differential Diagnosis" icon={<Trophy color={colors.amber} size={16} />} colors={colors} scaledFont={scaledFont} />
          {result.differential_diagnosis.map((d, i) => {
            const probColor =
              d.probability === "High" ? colors.red : d.probability === "Moderate" ? colors.amber : colors.green;
            return (
              <View key={i} style={[styles.ddxCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                <View style={[styles.row, { justifyContent: "space-between" }]}>
                  <View style={[styles.row, { flex: 1 }]}>
                    <View style={[styles.medal, { backgroundColor: probColor + "20", borderColor: probColor }]}>
                      <Text style={{ color: probColor, fontWeight: "800", fontSize: scaledFont(11) }}>#{d.rank}</Text>
                    </View>
                    <Text style={{ color: colors.text, fontSize: scaledFont(14), fontWeight: "700", flex: 1 }} numberOfLines={2}>
                      {d.diagnosis}
                    </Text>
                  </View>
                  <View style={[styles.probBadge, { backgroundColor: probColor + "20" }]}>
                    <Text style={{ color: probColor, fontSize: scaledFont(10), fontWeight: "800", letterSpacing: 0.5 }}>
                      {d.probability.toUpperCase()}
                    </Text>
                  </View>
                </View>
                {d.supporting_features?.map((f, j) => (
                  <View key={`s-${j}`} style={[styles.row, { marginTop: 6 }]}>
                    <CheckCircle2 color={colors.green} size={12} />
                    <Text style={{ color: colors.textMuted, fontSize: scaledFont(11), flex: 1 }}>{f}</Text>
                  </View>
                ))}
                {d.against_features?.map((f, j) => (
                  <View key={`a-${j}`} style={[styles.row, { marginTop: 4 }]}>
                    <XCircle color={colors.red} size={12} />
                    <Text style={{ color: colors.textMuted, fontSize: scaledFont(11), flex: 1 }}>{f}</Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      )}

      {/* Section 5 — Algorithm pathway */}
      {result.pattern_based_algorithm && (
        <View style={[styles.section, { backgroundColor: colors.accent + "12", borderColor: colors.accent + "40" }]}>
          <SectionTitle title="5. Algorithm Pathway" icon={<Sparkles color={colors.accent} size={16} />} colors={colors} scaledFont={scaledFont} />
          <Text style={{ color: colors.text, fontSize: scaledFont(12), lineHeight: 18 }}>
            {result.pattern_based_algorithm}
          </Text>
        </View>
      )}

      {/* Section 6 — Recommendations */}
      {(result.additional_imaging_recommended?.length || result.clinical_correlation?.length) && (
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <SectionTitle title="6. Recommendations" icon={<Stethoscope color={colors.accent} size={16} />} colors={colors} scaledFont={scaledFont} />
          {result.additional_imaging_recommended?.length ? (
            <>
              <Text style={[styles.subLabel, { color: colors.textMuted, fontSize: scaledFont(11) }]}>FURTHER IMAGING</Text>
              {result.additional_imaging_recommended.map((r, i) => (
                <View key={i} style={[styles.row, { marginBottom: 4 }]}>
                  <View style={[styles.bulletDot, { backgroundColor: colors.accent }]} />
                  <Text style={{ color: colors.text, fontSize: scaledFont(12), flex: 1 }}>{r}</Text>
                </View>
              ))}
            </>
          ) : null}
          {result.clinical_correlation?.length ? (
            <>
              <Text style={[styles.subLabel, { color: colors.textMuted, fontSize: scaledFont(11), marginTop: 10 }]}>
                CLINICAL CORRELATION
              </Text>
              {result.clinical_correlation.map((r, i) => (
                <View key={i} style={[styles.row, { marginBottom: 4 }]}>
                  <View style={[styles.bulletDot, { backgroundColor: colors.amber }]} />
                  <Text style={{ color: colors.text, fontSize: scaledFont(12), flex: 1 }}>{r}</Text>
                </View>
              ))}
            </>
          ) : null}
        </View>
      )}

      {/* Disclaimer */}
      <Text style={[styles.disclaimer, { color: colors.textDim, fontSize: scaledFont(10) }]}>
        {result.disclaimer ??
          "AI-assisted HRCT analysis based on Lamm-Ahlfors pattern recognition algorithm and Fleischner Society guidelines. For educational use only — not a substitute for formal radiology reporting."}
      </Text>

      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity onPress={onSave} style={[styles.actionBtn, { backgroundColor: colors.accent }]} activeOpacity={0.9}>
          <Save color="#fff" size={15} />
          <Text style={styles.actionBtnText}>Save to Log Book</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onExport} style={[styles.actionBtn, { backgroundColor: colors.bgElevated, borderColor: colors.border, borderWidth: 1 }]} activeOpacity={0.9}>
          <Download color={colors.text} size={15} />
          <Text style={[styles.actionBtnText, { color: colors.text }]}>Export PDF</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={onNew} style={[styles.newBtn, { borderColor: colors.border }]} activeOpacity={0.9}>
        <RotateCcw color={colors.textMuted} size={14} />
        <Text style={{ color: colors.textMuted, fontWeight: "600", fontSize: scaledFont(12) }}>New Analysis</Text>
      </TouchableOpacity>
    </View>
  );
}

function SectionTitle({
  title,
  icon,
  colors,
  scaledFont,
}: {
  title: string;
  icon: React.ReactNode;
  colors: ReturnType<typeof useTheme>["colors"];
  scaledFont: (n: number) => number;
}) {
  return (
    <View style={[styles.row, { marginBottom: 10 }]}>
      {icon}
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: scaledFont(13), flex: 1 }}>{title}</Text>
    </View>
  );
}

function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

// ============================================================
// Helpers
// ============================================================

async function saveHistory(item: HRCTHistoryItem): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    const list: HRCTHistoryItem[] = raw ? JSON.parse(raw) : [];
    const next = [item, ...list].slice(0, 50);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch (e) {
    console.log("[ai-scan] saveHistory error", e);
  }
}

function buildReportHTML(
  result: HRCTAnalysis,
  context: ClinicalContext,
  imageType: ImageType,
  imageUri: string | null
): string {
  const ddx = (result.differential_diagnosis ?? [])
    .map(
      (d) =>
        `<div class="ddx"><div class="ddxHead"><strong>#${d.rank} ${d.diagnosis}</strong><span class="prob ${d.probability.toLowerCase()}">${d.probability}</span></div>${(d.supporting_features ?? []).map((f) => `<div class="ok">✓ ${f}</div>`).join("")}${(d.against_features ?? []).map((f) => `<div class="bad">✗ ${f}</div>`).join("")}</div>`
    )
    .join("");
  const patterns = (result.primary_patterns ?? [])
    .map(
      (p) =>
        `<li><strong>${p.pattern}</strong>${p.subtype ? ` — ${p.subtype}` : ""}${p.distribution ? ` (${p.distribution})` : ""}<br/>${p.description}</li>`
    )
    .join("");
  const findings = (result.secondary_findings ?? [])
    .map((f) => `<li><strong>${f.finding}:</strong> ${f.description}${f.significance ? ` <em>(${f.significance})</em>` : ""}</li>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"/><title>HRCT Report</title>
<style>
body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1a2e;padding:24px;}
h1{color:#0d9488;margin:0 0 4px;font-size:22px;}
h2{color:#0d9488;font-size:14px;margin:18px 0 6px;border-bottom:2px solid #0d9488;padding-bottom:4px;}
.meta{color:#64748b;font-size:11px;margin-bottom:14px;}
.ctx{background:#f8f9fb;padding:10px;border-radius:8px;font-size:11px;margin-bottom:14px;}
.impression{background:#0f172a;color:#fff;padding:12px;border-radius:8px;font-size:12px;margin-bottom:14px;}
.urgent{background:#991B1B;color:#fff;padding:10px;border-radius:6px;font-weight:700;font-size:12px;margin-bottom:14px;}
.uip{padding:12px;border-radius:8px;font-weight:700;font-size:14px;background:#fee2e2;color:#991b1b;margin-bottom:14px;}
.ddx{border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin-bottom:8px;font-size:11px;}
.ddxHead{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;}
.prob{padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;}
.prob.high{background:#fee2e2;color:#991b1b;}
.prob.moderate{background:#fef3c7;color:#92400e;}
.prob.low{background:#dcfce7;color:#166534;}
.ok{color:#166534;margin:2px 0;}
.bad{color:#991b1b;margin:2px 0;}
img{max-width:300px;border-radius:8px;margin:8px 0;}
.disclaimer{font-style:italic;color:#64748b;font-size:10px;border:1px solid #e2e8f0;padding:10px;border-radius:6px;margin-top:18px;}
ul{font-size:11px;line-height:1.6;}
.footer{text-align:center;color:#94a3b8;font-size:10px;margin-top:24px;}
</style></head><body>
<h1>PulmoLab · HRCT Analysis Report</h1>
<div class="meta">${new Date().toLocaleString()} · ${imageType.toUpperCase()}</div>
${context && Object.keys(context).length ? `<div class="ctx"><strong>Clinical context:</strong> ${context.age ? `Age ${context.age}; ` : ""}${context.gender ? `${context.gender}; ` : ""}${context.smoking ? `Smoking: ${context.smoking}; ` : ""}${context.symptoms?.length ? `Symptoms: ${context.symptoms.join(", ")}; ` : ""}${context.history ? `History: ${context.history}; ` : ""}${context.suspicion ? `Suspected: ${context.suspicion}` : ""}</div>` : ""}
${imageUri ? `<img src="${imageUri}"/>` : ""}
${result.urgent ? `<div class="urgent">URGENT — ${result.urgent_reason ?? ""}</div>` : ""}
${result.overall_impression ? `<div class="impression">${result.overall_impression}</div>` : ""}
${result.uip_classification?.applicable ? `<div class="uip">UIP: ${result.uip_classification.category}${result.uip_classification.reasoning ? `<br/><span style="font-weight:400;font-size:11px;">${result.uip_classification.reasoning}</span>` : ""}</div>` : ""}
<h2>Primary Patterns</h2><ul>${patterns || "<li>None identified</li>"}</ul>
<h2>Secondary Findings</h2><ul>${findings || "<li>None</li>"}</ul>
<h2>Differential Diagnosis</h2>${ddx}
${result.pattern_based_algorithm ? `<h2>Algorithm Pathway</h2><p style="font-size:11px;">${result.pattern_based_algorithm}</p>` : ""}
${result.additional_imaging_recommended?.length ? `<h2>Recommended Imaging</h2><ul>${result.additional_imaging_recommended.map((r) => `<li>${r}</li>`).join("")}</ul>` : ""}
${result.clinical_correlation?.length ? `<h2>Clinical Correlation</h2><ul>${result.clinical_correlation.map((r) => `<li>${r}</li>`).join("")}</ul>` : ""}
<div class="disclaimer">${result.disclaimer ?? "AI-assisted HRCT analysis. For educational use only — not a substitute for formal radiology reporting."}</div>
<div class="footer">Generated by PulmoLab AI — For educational use only</div>
</body></html>`;
}

// keep file-system import alive for future use
void FileSystem;

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: 16, gap: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  hero: { borderRadius: 18, padding: 18, borderWidth: 1, overflow: "hidden" },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  heroTitle: { color: "#fff", fontWeight: "800", letterSpacing: -0.3 },
  heroSubtitle: { color: "rgba(255,255,255,0.78)", marginTop: 2 },
  aiBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)" },
  aiBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  stepNum: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  stepNumText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  sectionTitle: { fontWeight: "800", letterSpacing: -0.2 },
  typeRow: { flexDirection: "row", gap: 8 },
  typeChip: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  typeChipLabel: { fontWeight: "800", letterSpacing: -0.2 },
  typeChipDesc: { marginTop: 2, fontWeight: "500" },
  contextHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 12, borderWidth: 1 },
  contextHeaderLabel: { fontWeight: "700" },
  card: { borderRadius: 14, padding: 14, borderWidth: 1 },
  fieldRow: { flexDirection: "row", gap: 10 },
  label: { letterSpacing: 1.5, fontWeight: "700", marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  segment: { flexDirection: "row", gap: 6 },
  segmentItem: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  uploadZone: { borderRadius: 16, borderWidth: 1, borderStyle: "dashed", padding: 24, alignItems: "center" },
  uploadIconWrap: { width: 64, height: 64, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  uploadTitle: { fontWeight: "700", marginBottom: 4 },
  uploadDesc: { marginBottom: 16, textAlign: "center" },
  uploadActions: { flexDirection: "row", gap: 10, width: "100%", justifyContent: "center" },
  uploadBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12 },
  uploadBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  thumbCard: { flexDirection: "row", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, alignItems: "center" },
  thumb: { width: 76, height: 76, borderRadius: 10, backgroundColor: "#000" },
  thumbTitle: { fontWeight: "700" },
  thumbDesc: { marginTop: 2 },
  smallBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  analyzeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 14, borderRadius: 14 },
  analyzeBtnText: { color: "#fff", fontWeight: "800", fontSize: 14, letterSpacing: 0.3 },
  loadingCard: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 10 },
  loadingTitle: { fontWeight: "700", flex: 1 },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden", marginTop: 6 },
  progressFill: { height: 6, borderRadius: 3 },
  errorCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  reportHeader: { padding: 16, borderRadius: 16, gap: 6 },
  reportTitle: { color: "#fff", fontWeight: "900", letterSpacing: 0.5, flex: 1 },
  watermark: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  watermarkText: { color: "#F59E0B", fontWeight: "800", letterSpacing: 1 },
  reportImage: { width: "100%", height: 160, borderRadius: 10, marginTop: 12, backgroundColor: "#000" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginRight: 6, marginBottom: 6 },
  badgeText: { fontWeight: "700", fontSize: 11, letterSpacing: 0.3 },
  urgentBanner: { flexDirection: "row", gap: 8, backgroundColor: "#991B1B", padding: 10, borderRadius: 8, alignItems: "center", marginTop: 10 },
  urgentText: { color: "#fff", fontWeight: "800", fontSize: 11, letterSpacing: 0.4, flex: 1 },
  impression: { color: "rgba(255,255,255,0.92)", marginTop: 12, lineHeight: 18 },
  section: { padding: 14, borderRadius: 14, borderWidth: 1 },
  patternRow: { paddingVertical: 10, gap: 4 },
  patternName: { fontWeight: "800", flex: 1, letterSpacing: -0.2 },
  patternSubtype: { fontWeight: "600", marginTop: 2 },
  patternDesc: { lineHeight: 16 },
  distBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  uipCategory: { fontWeight: "900", letterSpacing: -0.3 },
  findingRow: { flexDirection: "row", paddingVertical: 8, gap: 10 },
  findingDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  ddxCard: { padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  medal: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  probBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  subLabel: { letterSpacing: 1.5, fontWeight: "700", marginBottom: 6 },
  bulletDot: { width: 4, height: 4, borderRadius: 2 },
  disclaimer: { fontStyle: "italic", lineHeight: 14, textAlign: "center", paddingHorizontal: 8 },
  actionsRow: { flexDirection: "row", gap: 10 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12 },
  actionBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  newBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
});
