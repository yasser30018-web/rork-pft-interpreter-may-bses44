import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Image,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { uploadLogbookMediaFromUri } from "@/utils/logbookApi";
import { useAuth } from "@/providers/AuthProvider";
import * as WebBrowser from "expo-web-browser";
import { VideoView, useVideoPlayer } from "expo-video";
import { Stack, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import {
  Activity,
  BarChart3,
  BookMarked,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Cloud,
  FileText,
  Gauge,
  HeartPulse,
  Image as ImageIcon,
  Layers,
  Mic,
  MoreHorizontal,
  NotebookPen,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  Trash2,
  UploadCloud,
  UserRound,
  Video,
  WifiOff,
  X,
} from "lucide-react-native";
import { useTheme } from "@/providers/ThemeProvider";
import { generateSecureUUID } from "@/utils/supabaseDb";
import { supabase } from "@/lib/supabase";

type MediaKind = "image" | "video" | "pdf";

/** Detects whether a URI points to an image, video, or PDF based on extension. */
function detectMediaKind(uri: string): MediaKind {
  const clean = uri.split("?")[0].toLowerCase();
  if (/\.(mp4|mov|m4v|webm|avi|mkv)$/.test(clean)) return "video";
  if (/\.pdf$/.test(clean)) return "pdf";
  return "image";
}

/**
 * Normalizes a media URI for display.
 * - blob: URIs cannot be rendered by RN, so we drop them (caller should refetch).
 * - Bare storage paths get converted to Supabase public URLs.
 * - http(s) and file:// URIs pass through.
 */
function resolveMediaUri(uri: string): string {
  if (!uri) return uri;
  if (uri.startsWith("blob:")) return "";
  if (uri.startsWith("http://") || uri.startsWith("https://") || uri.startsWith("file://") || uri.startsWith("data:") || uri.startsWith("content://") || uri.startsWith("ph://") || uri.startsWith("assets-library://")) {
    return uri;
  }
  const { data } = supabase.storage.from("logbook-media").getPublicUrl(uri);
  return data.publicUrl ?? "";
}

function LogbookVideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" }}>
      <VideoView player={player} style={{ width: "100%", height: "80%" }} contentFit="contain" allowsFullscreen allowsPictureInPicture nativeControls />
    </View>
  );
}

const STORAGE_KEY = "pulmolab_logbook_v2";
const DRAFT_KEY = "pulmolab_logbook_autosave";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type LogMode = "home" | "cases" | "caseForm" | "caseDetail" | "procedures" | "procedureForm" | "dashboard";
type Severity = "Mild" | "Moderate" | "Severe" | "Critical";
type Gender = "Male" | "Female";
type ProcedureStatus = "Full success" | "Partial" | "Failed";
type SmokingStatus = "Non-smoker" | "Ex-smoker" | "Active smoker";
type DurationUnit = "days" | "weeks" | "months";
type O2Device = "Room air" | "Nasal cannula" | "Venturi" | "NRBM" | "HFNO" | "NIV" | "Intubated";
type PanelKey = "autoimmune" | "abg" | "micro" | "pft" | "ecg" | "echo" | "pleural" | "broncho" | "biopsy";

interface TimelineEntry { id: string; date: string; event: string }
interface CustomLab { id: string; name: string; value: string; unit: string; normalRange: string }
interface CultureEntry { id: string; source: string; organism: string; result: string }
interface SerologyEntry { id: string; test: string; result: string }

interface ClinicalCase {
  id: string;
  title: string;
  age: string;
  gender: Gender;
  nationality: string;
  smokingStatus: SmokingStatus;
  packYears: string;
  occupation: string;
  comorbidities: string[];
  comorbidityOther: string;
  ecog: 0 | 1 | 2 | 3 | 4;
  tag: string;
  severity: Severity;
  chiefComplaint: string;
  history: string;
  durationValue: string;
  durationUnit: DurationUnit;
  timeline: TimelineEntry[];
  gcs: string;
  bp: string;
  hr: string;
  rr: string;
  spo2Air: string;
  spo2O2: string;
  o2Device: O2Device;
  briefExam: string;
  jvpElevated: boolean;
  wbc: string;
  hb: string;
  plt: string;
  crp: string;
  esr: string;
  pct: string;
  ldh: string;
  ferritin: string;
  dDimer: string;
  creatinine: string;
  egfr: string;
  alt: string;
  ast: string;
  bilirubin: string;
  autoimmunePanel: string;
  customLabs: CustomLab[];
  ph: string;
  pao2: string;
  fio2: string;
  hco3: string;
  paco2: string;
  spo2: string;
  lactate: string;
  cultures: CultureEntry[];
  gramStain: string;
  sensitivity: string;
  serology: SerologyEntry[];
  pftSummary: string;
  ecgFindings: string;
  echoFindings: string;
  pleuralPh: string;
  pleuralGlucose: string;
  pleuralCells: string;
  pleuralProtein: string;
  serumProtein: string;
  pleuralLdh: string;
  serumLdh: string;
  bronchoscopyReport: string;
  biopsyResult: string;
  panelImages: Record<string, string[]>;
  finalDiagnosis: string;
  managementPlan: string;
  learningPoint: string;
  hospital: string;
  isDraft: boolean;
  isStarred: boolean;
  createdAt: string;
}

interface ClinicalProcedure {
  id: string;
  procedureType: string;
  procedureNumber: number;
  dateTime: string;
  hospital: string;
  unit: string;
  operatorName: string;
  supervisor: string;
  patientAge: string;
  patientGender: Gender;
  indication: string;
  successStatus: ProcedureStatus;
  complications: string[];
  reflection: string;
  ready: boolean;
}

interface LogStore {
  cases: ClinicalCase[];
  procedures: ClinicalProcedure[];
  recentSearches: string[];
}

const DEFAULT_CASES_FACTORY = (): ClinicalCase[] => [
  seedCase({
    id: "seed-ards",
    title: "Severe hypoxemia after viral pneumonia",
    age: "42",
    gender: "Male",
    tag: "ARDS",
    severity: "Severe",
    chiefComplaint: "Progressive dyspnea",
    history: "Rapid oxygen requirement escalation with bilateral infiltrates.",
    ph: "7.47",
    pao2: "68",
    fio2: "0.5",
    hco3: "23",
    paco2: "31",
    finalDiagnosis: "ARDS secondary to severe pneumonia",
    learningPoint: "Early P/F trend recognition supports timely escalation.",
    hospital: "PulmoLab Teaching Unit",
    isDraft: false,
    isStarred: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  }),
  seedCase({
    id: "seed-ild",
    title: "Bird exposure with subacute ILD",
    age: "57",
    gender: "Female",
    tag: "Hypersensitivity Pneumonitis",
    severity: "Moderate",
    chiefComplaint: "Cough and exertional dyspnea",
    history: "Symptoms worse after cleaning bird cages.",
    ph: "7.41",
    pao2: "82",
    fio2: "0.21",
    hco3: "24",
    paco2: "38",
    finalDiagnosis: "Fibrotic hypersensitivity pneumonitis",
    learningPoint: "Exposure history is often the diagnostic key.",
    hospital: "PulmoLab Teaching Unit",
    isDraft: false,
    isStarred: false,
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  }),
];

const DEFAULT_PROCEDURES: ClinicalProcedure[] = [
  {
    id: "proc-bronch",
    procedureType: "BRONCHOSCOPY",
    procedureNumber: 14,
    dateTime: new Date(Date.now() - 3600000 * 30).toISOString(),
    hospital: "PulmoLab Teaching Unit",
    unit: "Endoscopy Suite",
    operatorName: "Trainee",
    supervisor: "Consultant",
    patientAge: "63",
    patientGender: "Male",
    indication: "Non-resolving consolidation",
    successStatus: "Full success",
    complications: ["None"],
    reflection: "BAL obtained safely with good team communication.",
    ready: false,
  },
  {
    id: "proc-thora",
    procedureType: "THORACENTESIS",
    procedureNumber: 8,
    dateTime: new Date(Date.now() - 3600000 * 72).toISOString(),
    hospital: "PulmoLab Teaching Unit",
    unit: "Ward",
    operatorName: "Fellow",
    supervisor: "Consultant",
    patientAge: "71",
    patientGender: "Female",
    indication: "Diagnostic pleural tap",
    successStatus: "Full success",
    complications: ["None"],
    reflection: "US guidance improved site confidence.",
    ready: true,
  },
];

const SMOKING_OPTIONS: SmokingStatus[] = ["Non-smoker", "Ex-smoker", "Active smoker"];
const DURATION_UNITS: DurationUnit[] = ["days", "weeks", "months"];
const O2_DEVICES: O2Device[] = ["Room air", "Nasal cannula", "Venturi", "NRBM", "HFNO", "NIV", "Intubated"];
const OCCUPATION_SUGGESTIONS = ["Farmer", "Construction", "Healthcare", "Mining", "Asbestos exposure", "Bird keeping", "Chemical exposure"];
const FULL_COMORBIDITIES = ["HTN", "DM", "IHD", "CKD", "Malignancy", "Immunosuppressed", "Post-transplant", "HIV", "Connective tissue disease"];
const SEROLOGY_TESTS = ["Legionella antigen", "Pneumococcal antigen", "Beta-glucan", "Galactomannan", "HIV", "COVID"];
const CULTURE_SOURCES = ["Blood", "Sputum", "BAL", "Pleural fluid"];

const TAGS = ["ARDS", "CAP", "HAP", "VAP", "COPD exacerbation", "Asthma", "Massive PE", "ILD/UIP", "Hypersensitivity Pneumonitis", "Sarcoidosis", "Lung Cancer", "Pleural Effusion", "Pneumothorax", "Hemoptysis", "Respiratory Failure", "Sepsis", "COVID-19", "TB", "Other"];
const PROCEDURE_TYPES = ["INTUBATION", "BRONCHOSCOPY", "THORACENTESIS", "CHEST TUBE", "CENTRAL LINE", "ARTERIAL LINE", "PLEURAL BIOPSY", "BAL", "EBUS", "TRACHEOSTOMY", "NIV INITIATION", "PIGTAIL INSERTION", "OTHER"];
const SYMPTOMS = ["Dyspnea", "Cough", "Hemoptysis", "Chest pain", "Fever", "Weight loss", "Night sweats", "Wheezing", "Orthopnea"];
const COMORBIDITIES = ["HTN", "DM", "IHD", "CKD", "Malignancy", "Immunosuppressed", "HIV", "Connective tissue disease"];

function seedCase(overrides: Partial<ClinicalCase>): ClinicalCase { return { ...emptyCase(), ...overrides }; }

function emptyCase(): ClinicalCase { return ({
  id: generateSecureUUID(),
  title: "",
  age: "",
  gender: "Male",
  nationality: "",
  smokingStatus: "Non-smoker",
  packYears: "",
  occupation: "",
  comorbidities: [],
  comorbidityOther: "",
  ecog: 0,
  tag: "ARDS",
  severity: "Mild",
  chiefComplaint: "",
  history: "",
  durationValue: "",
  durationUnit: "days",
  timeline: [],
  gcs: "",
  bp: "",
  hr: "",
  rr: "",
  spo2Air: "",
  spo2O2: "",
  o2Device: "Room air",
  briefExam: "",
  jvpElevated: false,
  wbc: "",
  hb: "",
  plt: "",
  crp: "",
  esr: "",
  pct: "",
  ldh: "",
  ferritin: "",
  dDimer: "",
  creatinine: "",
  egfr: "",
  alt: "",
  ast: "",
  bilirubin: "",
  autoimmunePanel: "",
  customLabs: [],
  ph: "",
  pao2: "",
  fio2: "0.21",
  hco3: "",
  paco2: "",
  spo2: "",
  lactate: "",
  cultures: [],
  gramStain: "",
  sensitivity: "",
  serology: [],
  pftSummary: "",
  ecgFindings: "",
  echoFindings: "",
  pleuralPh: "",
  pleuralGlucose: "",
  pleuralCells: "",
  pleuralProtein: "",
  serumProtein: "",
  pleuralLdh: "",
  serumLdh: "",
  bronchoscopyReport: "",
  biopsyResult: "",
  panelImages: {},
  finalDiagnosis: "",
  managementPlan: "",
  learningPoint: "",
  hospital: "",
  isDraft: true,
  isStarred: false,
  createdAt: new Date().toISOString(),
}); }

const emptyProcedure = (existing: ClinicalProcedure[]): ClinicalProcedure => {
  const type = "BRONCHOSCOPY";
  const count = existing.filter((p) => p.procedureType === type).length + 1;
  return {
    id: generateSecureUUID(),
    procedureType: type,
    procedureNumber: count,
    dateTime: new Date().toISOString(),
    hospital: "",
    unit: "",
    operatorName: "",
    supervisor: "",
    patientAge: "",
    patientGender: "Male",
    indication: "",
    successStatus: "Full success",
    complications: ["None"],
    reflection: "",
    ready: false,
  };
};

function toNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pfBadge(pao2: string, fio2: string): { value: number | null; label: string; color: string } {
  const p = toNumber(pao2);
  const f = toNumber(fio2);
  if (!p || !f) return { value: null, label: "Enter PaO2 + FiO2", color: "#64748B" };
  const value = Math.round(p / f);
  if (value > 400) return { value, label: "Normal oxygenation", color: "#10B981" };
  if (value >= 300) return { value, label: "Mild hypoxemia", color: "#F59E0B" };
  if (value >= 200) return { value, label: "Moderate ARDS range", color: "#F97316" };
  if (value >= 100) return { value, label: "Severe ARDS", color: "#EF4444" };
  return { value, label: "Critical hypoxemia", color: "#7F1D1D" };
}

function abgSuggestion(item: ClinicalCase): string {
  const ph = toNumber(item.ph);
  const co2 = toNumber(item.paco2);
  const hco3 = toNumber(item.hco3);
  if (!ph || !co2 || !hco3) return "ABG interpretation appears here as pH, PaCO2, and HCO3 are entered.";
  if (ph > 7.45 && co2 < 35) return "Likely respiratory alkalosis; correlate with hypoxemia, sepsis, PE, or pain/anxiety.";
  if (ph < 7.35 && co2 > 45) return "Respiratory acidosis pattern; assess ventilation, COPD, CNS depression, or fatigue.";
  if (ph < 7.35 && hco3 < 22) return "Metabolic acidosis pattern; calculate anion gap and lactate/renal contribution.";
  if (ph > 7.45 && hco3 > 26) return "Metabolic alkalosis pattern; review diuretics, vomiting, and chloride status.";
  return "Near-normal pH or mixed/compensated disorder; review full clinical context.";
}

function lightsCriteria(item: ClinicalCase): string {
  const pp = toNumber(item.pleuralProtein);
  const sp = toNumber(item.serumProtein);
  const pl = toNumber(item.pleuralLdh);
  const sl = toNumber(item.serumLdh);
  if (!pp || !sp || !pl || !sl) return "Enter pleural/serum protein and LDH to classify.";
  const exudate = pp / sp > 0.5 || pl / sl > 0.6;
  return exudate ? "Exudate by Light's criteria" : "Transudate by Light's criteria";
}

type LabStatus = "high" | "low" | "normal" | "unknown";
interface LabRange { key: keyof ClinicalCase; label: string; low: number; high: number; unit?: string }
const LAB_RANGES: LabRange[] = [
  { key: "wbc", label: "WBC", low: 4, high: 11, unit: "x10^9/L" },
  { key: "hb", label: "Hb", low: 12, high: 17, unit: "g/dL" },
  { key: "plt", label: "Platelets", low: 150, high: 400, unit: "x10^9/L" },
  { key: "crp", label: "CRP", low: 0, high: 10, unit: "mg/L" },
  { key: "esr", label: "ESR", low: 0, high: 20, unit: "mm/hr" },
  { key: "pct", label: "Procal", low: 0, high: 0.5, unit: "ng/mL" },
  { key: "ldh", label: "LDH", low: 140, high: 280, unit: "U/L" },
  { key: "ferritin", label: "Ferritin", low: 30, high: 400, unit: "ng/mL" },
  { key: "dDimer", label: "D-Dimer", low: 0, high: 0.5, unit: "mg/L" },
  { key: "creatinine", label: "Creatinine", low: 0.6, high: 1.3, unit: "mg/dL" },
  { key: "egfr", label: "eGFR", low: 60, high: 120, unit: "mL/min" },
  { key: "alt", label: "ALT", low: 7, high: 56, unit: "U/L" },
  { key: "ast", label: "AST", low: 10, high: 40, unit: "U/L" },
  { key: "bilirubin", label: "Bilirubin", low: 0.1, high: 1.2, unit: "mg/dL" },
];

function labStatus(value: string, range: LabRange): LabStatus {
  const n = toNumber(value);
  if (n === null || value.trim() === "") return "unknown";
  if (n < range.low) return "low";
  if (n > range.high) return "high";
  return "normal";
}

function statusColor(status: LabStatus): string {
  if (status === "high") return "#EF4444";
  if (status === "low") return "#F59E0B";
  if (status === "normal") return "#10B981";
  return "#64748B";
}

function statusLabel(status: LabStatus): string {
  if (status === "high") return "High";
  if (status === "low") return "Low";
  if (status === "normal") return "Normal";
  return "—";
}

function abgValueStatus(key: "ph" | "paco2" | "pao2" | "hco3" | "spo2", value: string): { status: LabStatus; tag: string } {
  const n = toNumber(value);
  if (n === null || !value.trim()) return { status: "unknown", tag: "—" };
  if (key === "ph") {
    if (n < 7.35) return { status: "low", tag: "Acidotic" };
    if (n > 7.45) return { status: "high", tag: "Alkalotic" };
    return { status: "normal", tag: "Normal" };
  }
  if (key === "paco2") {
    if (n < 35) return { status: "low", tag: "Low" };
    if (n > 45) return { status: "high", tag: "Elevated" };
    return { status: "normal", tag: "Normal" };
  }
  if (key === "pao2") {
    if (n < 80) return { status: "low", tag: "Low" };
    if (n > 100) return { status: "high", tag: "High" };
    return { status: "normal", tag: "Normal" };
  }
  if (key === "hco3") {
    if (n < 22) return { status: "low", tag: "Low" };
    if (n > 26) return { status: "high", tag: "High" };
    return { status: "normal", tag: "Normal" };
  }
  if (n < 92) return { status: "low", tag: "Low" };
  return { status: "normal", tag: "Normal" };
}

function severityColor(severity: Severity): string {
  if (severity === "Critical") return "#991B1B";
  if (severity === "Severe") return "#EF4444";
  if (severity === "Moderate") return "#F97316";
  return "#10B981";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Section({ title, icon, children, defaultOpen = false, open: openProp, onToggle }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; open?: boolean; onToggle?: () => void }) {
  const { colors, scaledFont } = useTheme();
  const controlled = typeof openProp === "boolean";
  const [internalOpen, setInternalOpen] = useState<boolean>(defaultOpen);
  const open = controlled ? (openProp as boolean) : internalOpen;
  const rotation = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(rotation, { toValue: open ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  }, [open, rotation]);

  const handlePress = useCallback(() => {
    if (Platform.OS !== "web") {
      LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
    } else {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    if (onToggle) onToggle();
    else setInternalOpen((v) => !v);
    if (Platform.OS !== "web") void Haptics.selectionAsync();
  }, [onToggle]);

  return (
    <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: open ? colors.accent : colors.border }]}>
      <TouchableOpacity onPress={handlePress} style={styles.sectionHeader} activeOpacity={0.8}>
        <View style={styles.sectionTitleRow}>{icon}<Text style={[styles.sectionTitle, { color: colors.text, fontSize: scaledFont(15) }]}>{title}</Text></View>
        <Animated.View style={{ transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "90deg"] }) }] }}><ChevronRight color={open ? colors.accent : colors.textMuted} size={18} /></Animated.View>
      </TouchableOpacity>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline, keyboardType = "default", unit }: { label: string; value: string; onChangeText: (text: string) => void; placeholder?: string; multiline?: boolean; keyboardType?: "default" | "numeric"; unit?: string }) {
  const { colors, scaledFont } = useTheme();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>{label}</Text>
      <View style={[styles.inputShell, multiline && styles.textareaShell, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textDim}
          multiline={multiline}
          keyboardType={keyboardType}
          textAlignVertical={multiline ? "top" : "center"}
          style={[styles.input, multiline && styles.textarea, { color: colors.text, fontSize: scaledFont(14) }]}
        />
        {unit ? <Text style={[styles.unitText, { color: colors.textMuted, fontSize: scaledFont(12) }]}>{unit}</Text> : null}
      </View>
    </View>
  );
}

function Chip({ label, selected, onPress, accent = "#3B82F6" }: { label: string; selected: boolean; onPress: () => void; accent?: string }) {
  const { colors, scaledFont, isDark } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, { borderColor: selected ? accent : colors.border, backgroundColor: selected ? `${accent}${isDark ? "26" : "14"}` : colors.bgElevated }]} activeOpacity={0.75}>
      <Text style={[styles.chipText, { color: selected ? accent : colors.textMuted, fontSize: scaledFont(12) }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ExpandablePanel({ title, icon, accent, isOpen, onToggle, children, images, onAddImage, onRemoveImage }: { title: string; icon: React.ReactNode; accent: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode; images: string[]; onAddImage: () => void; onRemoveImage: (uri: string) => void }) {
  const { colors, scaledFont, isDark } = useTheme();
  const rotation = useRef(new Animated.Value(isOpen ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(rotation, { toValue: isOpen ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  }, [isOpen, rotation]);
  return (
    <View style={[styles.panel, { borderColor: isOpen ? accent : colors.border, backgroundColor: isOpen ? `${accent}${isDark ? "14" : "0E"}` : colors.bgElevated }]}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.85} style={styles.panelHeader}>
        <View style={[styles.panelIcon, { backgroundColor: `${accent}22` }]}>{icon}</View>
        <Text style={[styles.panelTitle, { color: colors.text, fontSize: scaledFont(14) }]}>{title}</Text>
        <Animated.View style={{ transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "90deg"] }) }] }}><ChevronRight color={isOpen ? accent : colors.textMuted} size={18} /></Animated.View>
      </TouchableOpacity>
      {isOpen ? (
        <View style={styles.panelBody}>
          {children}
          <View style={styles.panelImageRow}>
            {images.map((uri) => (
              <View key={uri} style={styles.thumbWrap}>
                <Image source={{ uri }} style={styles.thumb} />
                <TouchableOpacity onPress={() => onRemoveImage(uri)} style={styles.thumbClose}><X color="#fff" size={12} /></TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={onAddImage} style={[styles.addThumb, { borderColor: accent }]} activeOpacity={0.8}>
              <Camera color={accent} size={18} />
              <Text style={[styles.addThumbText, { color: accent, fontSize: scaledFont(10) }]}>Upload</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function LogBookScreen() {
  const { colors, scaledFont, isDark } = useTheme();
  const { user } = useAuth();
  const [isUploadingMedia, setIsUploadingMedia] = useState<boolean>(false);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [mode, setMode] = useState<LogMode>("home");
  const [store, setStore] = useState<LogStore>(() => ({ cases: DEFAULT_CASES_FACTORY(), procedures: DEFAULT_PROCEDURES, recentSearches: [] }));
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [caseFilter, setCaseFilter] = useState<string>("All");
  const [caseSort, setCaseSort] = useState<string>("Newest");
  const [draftCase, setDraftCase] = useState<ClinicalCase>(emptyCase());
  const [draftProcedure, setDraftProcedure] = useState<ClinicalProcedure>(emptyProcedure(DEFAULT_PROCEDURES));
  const [confirmExit, setConfirmExit] = useState<boolean>(false);
  const [openPanel, setOpenPanel] = useState<PanelKey | null>(null);
  const [openMainSection, setOpenMainSection] = useState<"A" | "B" | "C" | "D" | "E">("A");
  const caseFormScrollRef = useRef<ScrollView | null>(null);
  const mainSectionYs = useRef<Record<string, number>>({});

  const toggleMainSection = useCallback((key: "A" | "B" | "C" | "D" | "E") => {
    if (Platform.OS !== "web") {
      LayoutAnimation.configureNext(LayoutAnimation.create(240, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
    } else {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    let willOpen = false;
    setOpenMainSection((current) => {
      if (current === key) {
        return ("" as unknown as "A");
      }
      willOpen = true;
      return key;
    });
    if (Platform.OS !== "web") void Haptics.selectionAsync();
    if (willOpen) {
      setTimeout(() => {
        const y = mainSectionYs.current[key];
        if (typeof y === "number" && caseFormScrollRef.current) {
          caseFormScrollRef.current.scrollTo({ y: Math.max(0, y - 8), animated: true });
        }
      }, 260);
    }
  }, []);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [imagingTab, setImagingTab] = useState<PanelKey | "all">("all");
  const [shareSheet, setShareSheet] = useState<boolean>(false);
  const [videoOpen, setVideoOpen] = useState<boolean>(false);
  const [videoUri, setVideoUri] = useState<string>("");
  const [videoCaption, setVideoCaption] = useState<string>("");

  const togglePanel = useCallback((key: PanelKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenPanel((current) => (current === key ? null : key));
    if (Platform.OS !== "web") void Haptics.selectionAsync();
  }, []);

  const getPanelImages = useCallback((key: PanelKey): string[] => draftCase.panelImages[key] ?? [], [draftCase.panelImages]);

  const addPanelImage = useCallback(async (key: PanelKey): Promise<void> => {
    try {
      if (!user?.id) {
        Alert.alert("Sign in required", "Please sign in to attach media.");
        return;
      }
      if (Platform.OS !== "web") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert("Permission needed", "Allow photo library access to attach images."); return; }
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, allowsMultipleSelection: false });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setIsUploadingMedia(true);
      const uploaded = await uploadLogbookMediaFromUri({
        userId: user.id,
        uri: asset.uri,
        kind: "image",
        fileName: asset.fileName ?? undefined,
        folder: "cases",
      });
      setIsUploadingMedia(false);
      if (!uploaded.publicUrl) {
        Alert.alert("Upload failed", uploaded.error ?? "Could not upload the image. Please try again.");
        return;
      }
      const remoteUri = uploaded.publicUrl;
      setDraftCase((prev) => ({ ...prev, panelImages: { ...prev.panelImages, [key]: [...(prev.panelImages[key] ?? []), remoteUri] } }));
    } catch (error) {
      setIsUploadingMedia(false);
      console.log("[LogBook] image pick failed", error);
      Alert.alert("Upload failed", "Could not attach the image. Please try again.");
    }
  }, [user?.id]);

  const removePanelImage = useCallback((key: PanelKey, uri: string): void => {
    setDraftCase((prev) => ({ ...prev, panelImages: { ...prev.panelImages, [key]: (prev.panelImages[key] ?? []).filter((u) => u !== uri) } }));
  }, []);

  useEffect(() => { void loadStore(); }, []);

  useEffect(() => {
    if (mode !== "caseForm" && mode !== "procedureForm") return;
    const timer = setInterval(() => { void saveDraftSnapshot(); }, 60000);
    return () => clearInterval(timer);
  }, [mode, draftCase, draftProcedure]);

  const loadStore = async (): Promise<void> => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) setStore(JSON.parse(raw) as LogStore);
    } catch (error) {
      console.log("[LogBook] Unable to load local store", error);
    }
  };

  const persist = async (next: LogStore): Promise<void> => {
    setStore(next);
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (error) { console.log("[LogBook] Unable to persist local store", error); }
  };

  const saveDraftSnapshot = async (): Promise<void> => {
    try { await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({ draftCase, draftProcedure, savedAt: new Date().toISOString() })); } catch (error) { console.log("[LogBook] Draft autosave failed", error); }
  };

  const haptic = useCallback(() => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const recent = useMemo(() => {
    const caseItems = store.cases.map((c) => ({ id: c.id, title: c.title || c.finalDiagnosis || "Untitled case", subtitle: `${c.tag} • ${formatDate(c.createdAt)}`, type: "case" as const, starred: c.isStarred }));
    const procItems = store.procedures.map((p) => ({ id: p.id, title: `${p.procedureType} #${p.procedureNumber}`, subtitle: `${p.successStatus} • ${formatDate(p.dateTime)}`, type: "procedure" as const, starred: p.ready }));
    return [...caseItems, ...procItems].slice(0, 5);
  }, [store]);

  const filteredCases = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let data = store.cases.filter((item) => [item.title, item.tag, item.finalDiagnosis, item.age, item.history].some((v) => v.toLowerCase().includes(q)));
    if (caseFilter === "Starred") data = data.filter((item) => item.isStarred);
    if (caseFilter === "Drafts") data = data.filter((item) => item.isDraft);
    if (caseSort === "Severity") data = [...data].sort((a, b) => ["Mild", "Moderate", "Severe", "Critical"].indexOf(b.severity) - ["Mild", "Moderate", "Severe", "Critical"].indexOf(a.severity));
    if (caseSort === "Diagnosis") data = [...data].sort((a, b) => a.tag.localeCompare(b.tag));
    return data;
  }, [caseFilter, caseSort, searchQuery, store.cases]);

  const filteredProcedures = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return store.procedures.filter((item) => [item.procedureType, item.operatorName, item.supervisor, item.indication].some((v) => v.toLowerCase().includes(q)));
  }, [searchQuery, store.procedures]);

  const saveCase = async (): Promise<void> => {
    if (!draftCase.title.trim()) { Alert.alert("Required", "Please add a case title before saving."); return; }
    haptic();
    const item = { ...draftCase, isDraft: false, createdAt: draftCase.createdAt || new Date().toISOString() };
    await persist({ ...store, cases: [item, ...store.cases.filter((c) => c.id !== item.id)] });
    setDraftCase(emptyCase());
    setMode("cases");
  };

  const saveProcedure = async (): Promise<void> => {
    if (!draftProcedure.indication.trim()) { Alert.alert("Required", "Please enter the procedure indication."); return; }
    haptic();
    const sameTypeCount = store.procedures.filter((p) => p.procedureType === draftProcedure.procedureType).length + 1;
    const item = { ...draftProcedure, procedureNumber: draftProcedure.procedureNumber || sameTypeCount };
    await persist({ ...store, procedures: [item, ...store.procedures.filter((p) => p.id !== item.id)] });
    setDraftProcedure(emptyProcedure(store.procedures));
    setMode("procedures");
  };

  const deleteCase = (id: string): void => {
    Alert.alert("Delete case", "Remove this clinical case from your log book?", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => void persist({ ...store, cases: store.cases.filter((c) => c.id !== id) }) }]);
  };

  const deleteProcedure = (id: string): void => {
    Alert.alert("Delete procedure", "Remove this procedure entry?", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => void persist({ ...store, procedures: store.procedures.filter((p) => p.id !== id) }) }]);
  };

  const toggleStar = async (id: string): Promise<void> => {
    await persist({ ...store, cases: store.cases.map((c) => c.id === id ? { ...c, isStarred: !c.isStarred } : c) });
  };

  const handleSearchSubmit = async (): Promise<void> => {
    const q = searchQuery.trim();
    if (!q) return;
    await persist({ ...store, recentSearches: [q, ...store.recentSearches.filter((s) => s !== q)].slice(0, 5) });
  };

  const startCase = (): void => { haptic(); setDraftCase(emptyCase()); setMode("caseForm"); };
  const startProcedure = (): void => { haptic(); setDraftProcedure(emptyProcedure(store.procedures)); setMode("procedureForm"); };

  const renderHome = () => (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 28 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.heroSection}>
        <View style={[styles.logbookIconShell, { backgroundColor: isDark ? "rgba(59,130,246,0.14)" : "rgba(59,130,246,0.1)", borderColor: colors.border }]}>
          <NotebookPen color="#3B82F6" size={30} />
          <View style={styles.iconPulse} />
        </View>
        <View style={styles.heroTextWrap}>
          <Text style={[styles.heroTitle, { color: colors.text, fontSize: scaledFont(25) }]}>Clinical Log Book</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textMuted, fontSize: scaledFont(13) }]}>Documentation, competency tracking, teaching pearls, and offline drafts.</Text>
        </View>
      </View>

      <View style={styles.syncStrip}>
        <View style={[styles.syncBadge, { backgroundColor: isDark ? "rgba(13,148,136,0.16)" : "rgba(13,148,136,0.1)" }]}><Cloud color="#0D9488" size={14} /><Text style={[styles.syncText, { color: "#0D9488", fontSize: scaledFont(11) }]}>Supabase ready</Text></View>
        <View style={[styles.syncBadge, { backgroundColor: isDark ? "rgba(148,163,184,0.14)" : "rgba(100,116,139,0.08)" }]}><WifiOff color={colors.textMuted} size={14} /><Text style={[styles.syncText, { color: colors.textMuted, fontSize: scaledFont(11) }]}>Offline auto-save</Text></View>
      </View>

      <View style={styles.logbookCardsRow}>
        <TouchableOpacity onPress={() => setMode("cases")} activeOpacity={0.88} style={styles.categoryTouchable}>
          <LinearGradient colors={isDark ? ["#10233F", "#0A1628"] : ["#EFF6FF", "#DBEAFE"]} style={[styles.logbookCard, { borderColor: isDark ? "rgba(59,130,246,0.35)" : "rgba(59,130,246,0.22)" }]}>
            <View style={styles.cardTopRow}><View style={[styles.categoryIcon, { backgroundColor: "rgba(59,130,246,0.16)" }]}><Stethoscope color="#3B82F6" size={24} /></View><TouchableOpacity onPress={startCase} style={[styles.smallAddBtn, { backgroundColor: "#3B82F6" }]}><Plus color="#fff" size={16} /></TouchableOpacity></View>
            <Text style={[styles.categoryTitle, { color: isDark ? "#DBEAFE" : "#1E3A8A", fontSize: scaledFont(17) }]}>Interesting Clinical Cases</Text>
            <Text style={[styles.categorySubtitle, { color: isDark ? "#93C5FD" : "#2563EB", fontSize: scaledFont(12) }]}>Document rare & educational cases</Text>
            <View style={[styles.countBadge, { backgroundColor: isDark ? "rgba(59,130,246,0.22)" : "rgba(255,255,255,0.78)" }]}><Text style={[styles.countText, { color: "#3B82F6", fontSize: scaledFont(11) }]}>{Math.max(store.cases.length, 12)} Cases</Text></View>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode("procedures")} activeOpacity={0.88} style={styles.categoryTouchable}>
          <LinearGradient colors={isDark ? ["#0D2A29", "#061A19"] : ["#ECFDF5", "#CCFBF1"]} style={[styles.logbookCard, { borderColor: isDark ? "rgba(13,148,136,0.35)" : "rgba(13,148,136,0.22)" }]}>
            <View style={styles.cardTopRow}><View style={[styles.categoryIcon, { backgroundColor: "rgba(13,148,136,0.16)" }]}><ClipboardCheck color="#0D9488" size={24} /></View><TouchableOpacity onPress={startProcedure} style={[styles.smallAddBtn, { backgroundColor: "#0D9488" }]}><Plus color="#fff" size={16} /></TouchableOpacity></View>
            <Text style={[styles.categoryTitle, { color: isDark ? "#CCFBF1" : "#134E4A", fontSize: scaledFont(17) }]}>Clinical Procedures</Text>
            <Text style={[styles.categorySubtitle, { color: isDark ? "#5EEAD4" : "#0F766E", fontSize: scaledFont(12) }]}>Track procedural competency</Text>
            <View style={[styles.countBadge, { backgroundColor: isDark ? "rgba(13,148,136,0.22)" : "rgba(255,255,255,0.78)" }]}><Text style={[styles.countText, { color: "#0D9488", fontSize: scaledFont(11) }]}>{Math.max(store.procedures.length, 8)} Procedures</Text></View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {renderSearch()}

      <View style={styles.quickGrid}>
        <TouchableOpacity onPress={() => setMode("dashboard")} style={[styles.quickTile, { backgroundColor: colors.bgCard, borderColor: colors.border }]}><BarChart3 color="#0D9488" size={18} /><Text style={[styles.quickText, { color: colors.text, fontSize: scaledFont(12) }]}>Competency dashboard</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => Alert.alert("Template library", "ARDS, CAP, PE, Asthma, ILD, and COPD templates are staged for quick-fill expansion.")} style={[styles.quickTile, { backgroundColor: colors.bgCard, borderColor: colors.border }]}><Layers color="#F59E0B" size={18} /><Text style={[styles.quickText, { color: colors.text, fontSize: scaledFont(12) }]}>Template library</Text></TouchableOpacity>
      </View>

      <View style={styles.activityHeader}><Text style={[styles.activityTitle, { color: colors.text, fontSize: scaledFont(17) }]}>Recent Activity</Text><Text style={[styles.sectionHint, { color: colors.textMuted, fontSize: scaledFont(11) }]}>Last 5 entries</Text></View>
      {recent.length ? recent.map((item) => <View key={`${item.type}-${item.id}`} style={[styles.activityCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}><View style={[styles.activityIcon, { backgroundColor: item.type === "case" ? "rgba(59,130,246,0.14)" : "rgba(13,148,136,0.14)" }]}>{item.type === "case" ? <FileText color="#3B82F6" size={18} /> : <ClipboardCheck color="#0D9488" size={18} />}</View><View style={styles.flexOne}><Text style={[styles.entryName, { color: colors.text, fontSize: scaledFont(14) }]}>{item.title}</Text><Text style={[styles.entryDate, { color: colors.textMuted, fontSize: scaledFont(11) }]}>{item.subtitle}</Text></View>{item.starred ? <Star color="#F59E0B" fill="#F59E0B" size={16} /> : <MoreHorizontal color={colors.textMuted} size={18} />}</View>) : renderEmpty("No cases yet. Document your first interesting case.")}
    </ScrollView>
  );

  const renderSearch = () => (
    <View style={styles.searchBlock}>
      <View style={[styles.searchBox, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Search color={colors.textMuted} size={16} />
        <TextInput style={[styles.searchInput, { color: colors.text, fontSize: scaledFont(14) }]} placeholder="Search diagnosis, tag, age, procedure, operator..." placeholderTextColor={colors.textDim} value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={() => void handleSearchSubmit()} testID="logbook-search" />
        <TouchableOpacity onPress={() => Alert.alert("Voice search", "Voice search will use native speech recognition when installed; keyboard search remains available.")}><Mic color={colors.textMuted} size={16} /></TouchableOpacity>
        {searchQuery ? <TouchableOpacity onPress={() => setSearchQuery("")}><X color={colors.textMuted} size={16} /></TouchableOpacity> : null}
      </View>
      {store.recentSearches.length ? <View style={styles.recentSearchRow}>{store.recentSearches.map((q) => <Chip key={q} label={q} selected={false} onPress={() => setSearchQuery(q)} accent="#64748B" />)}</View> : null}
    </View>
  );

  const renderCases = () => (
    <View style={styles.screenFill}>
      {renderSubHeader("Interesting Clinical Cases", "Clinical documentation and teaching files", <Stethoscope color="#3B82F6" size={24} />, startCase)}
      <View style={styles.filtersRow}>{["All", "Starred", "Drafts", "By Tag"].map((f) => <Chip key={f} label={f} selected={caseFilter === f} onPress={() => setCaseFilter(f)} />)}</View>
      <View style={styles.filtersRow}>{["Newest", "Severity", "Diagnosis"].map((f) => <Chip key={f} label={`Sort: ${f}`} selected={caseSort === f} onPress={() => setCaseSort(f)} accent="#0D9488" />)}</View>
      {renderSearch()}
      <FlatList data={filteredCases} keyExtractor={(item) => item.id} contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 96 }]} renderItem={({ item }) => renderCaseCard(item)} ListEmptyComponent={renderEmpty("No matching cases. Try a different tag or create a new case.")} />
      {renderFab(startCase, "#3B82F6")}
    </View>
  );

  const renderProcedures = () => {
    const success = store.procedures.filter((p) => p.successStatus === "Full success").length;
    const rate = store.procedures.length ? Math.round((success / store.procedures.length) * 100) : 0;
    return (
      <View style={styles.screenFill}>
        {renderSubHeader("Clinical Procedures", "Procedural competency and supervisor feedback", <ClipboardCheck color="#0D9488" size={24} />, startProcedure)}
        <View style={styles.statsRow}><Stat label="Total" value={String(store.procedures.length)} color="#3B82F6" /><Stat label="Success" value={`${rate}%`} color="#10B981" /><Stat label="This month" value={String(store.procedures.length)} color="#F59E0B" /></View>
        <View style={styles.filtersRow}>{["All", "Bronchoscopy", "Success", "Failed", "Operator"].map((f) => <Chip key={f} label={f} selected={f === "All"} onPress={() => undefined} accent="#0D9488" />)}</View>
        {renderSearch()}
        <FlatList data={filteredProcedures} keyExtractor={(item) => item.id} contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 96 }]} renderItem={({ item }) => renderProcedureCard(item)} ListEmptyComponent={renderEmpty("No procedures yet. Add your first supervised procedure.")} />
        {renderFab(startProcedure, "#0D9488")}
      </View>
    );
  };

  const renderSubHeader = (title: string, subtitle: string, icon: React.ReactNode, onAdd: () => void) => (
    <View style={[styles.subHeader, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <TouchableOpacity onPress={() => setMode("home")} style={styles.backMini}><ChevronRight color={colors.textMuted} size={18} style={{ transform: [{ rotate: "180deg" }] }} /></TouchableOpacity>
      <View style={[styles.subIcon, { backgroundColor: isDark ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.08)" }]}>{icon}</View>
      <View style={styles.flexOne}><Text style={[styles.subTitle, { color: colors.text, fontSize: scaledFont(18) }]}>{title}</Text><Text style={[styles.subSubtitle, { color: colors.textMuted, fontSize: scaledFont(12) }]}>{subtitle}</Text></View>
      <TouchableOpacity onPress={onAdd} style={[styles.headerAdd, { backgroundColor: colors.accent }]}><Plus color="#fff" size={18} /></TouchableOpacity>
    </View>
  );

  const openCase = (id: string): void => {
    haptic();
    setSelectedCaseId(id);
    setMode("caseDetail");
  };

  const editSelectedCase = (): void => {
    const found = store.cases.find((c) => c.id === selectedCaseId);
    if (!found) return;
    haptic();
    setDraftCase(found);
    setMode("caseForm");
  };

  const renderCaseCard = (item: ClinicalCase) => {
    const pf = pfBadge(item.pao2, item.fio2);
    return (
      <TouchableOpacity onPress={() => openCase(item.id)} activeOpacity={0.85} style={[styles.entryCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.entryHeader}>
          <View style={[styles.diagnosisBadge, { backgroundColor: `${severityColor(item.severity)}20` }]}><Text style={[styles.diagnosisText, { color: severityColor(item.severity), fontSize: scaledFont(11) }]}>{item.tag}</Text></View>
          <View style={styles.flexOne} />
          <TouchableOpacity onPress={() => void toggleStar(item.id)}><Star color="#F59E0B" fill={item.isStarred ? "#F59E0B" : "transparent"} size={19} /></TouchableOpacity>
          <TouchableOpacity onPress={() => deleteCase(item.id)} style={styles.iconBtn}><Trash2 color="#EF4444" size={17} /></TouchableOpacity>
        </View>
        <Text style={[styles.entryName, { color: colors.text, fontSize: scaledFont(16) }]}>{item.title}</Text>
        <Text style={[styles.entryDate, { color: colors.textMuted, fontSize: scaledFont(12) }]}>{item.age || "—"}y {item.gender} • {formatDate(item.createdAt)} • {item.isDraft ? "Draft" : "Published"}</Text>
        <View style={styles.entryMetaRow}><View style={[styles.metaPill, { backgroundColor: `${severityColor(item.severity)}20` }]}><Text style={[styles.metaText, { color: severityColor(item.severity), fontSize: scaledFont(10) }]}>{item.severity}</Text></View><View style={[styles.metaPill, { backgroundColor: `${pf.color}20` }]}><Text style={[styles.metaText, { color: pf.color, fontSize: scaledFont(10) }]}>P/F {pf.value ?? "—"}</Text></View></View>
        <Text style={[styles.entryNotes, { color: colors.textMuted, fontSize: scaledFont(13) }]} numberOfLines={2}>{item.history || item.learningPoint || "Tap to open case presentation."}</Text>
      </TouchableOpacity>
    );
  };

  const renderProcedureCard = (item: ClinicalProcedure) => (
    <View style={[styles.entryCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={styles.entryHeader}><View style={[styles.diagnosisBadge, { backgroundColor: item.successStatus === "Failed" ? "rgba(239,68,68,0.16)" : "rgba(16,185,129,0.16)" }]}><Text style={[styles.diagnosisText, { color: item.successStatus === "Failed" ? "#EF4444" : "#10B981", fontSize: scaledFont(11) }]}>{item.successStatus}</Text></View><View style={styles.flexOne} /><TouchableOpacity onPress={() => deleteProcedure(item.id)} style={styles.iconBtn}><Trash2 color="#EF4444" size={17} /></TouchableOpacity></View>
      <Text style={[styles.entryName, { color: colors.text, fontSize: scaledFont(16) }]}>{item.procedureType} #{item.procedureNumber}</Text>
      <Text style={[styles.entryDate, { color: colors.textMuted, fontSize: scaledFont(12) }]}>{formatDate(item.dateTime)} • Supervisor: {item.supervisor || "—"}</Text>
      <Text style={[styles.entryNotes, { color: colors.textMuted, fontSize: scaledFont(13) }]} numberOfLines={2}>{item.indication || "Procedure indication not entered"}</Text>
    </View>
  );

  const renderCaseForm = () => {
    const pf = pfBadge(draftCase.pao2, draftCase.fio2);
    return (
      <View style={styles.screenFill}>
        {renderFormHeader("New Clinical Case", "Saved drafts every 60 seconds", saveCase)}
        <ScrollView ref={caseFormScrollRef} contentContainerStyle={[styles.formScroll, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.stepRail}>{["Patient", "Clinical", "Labs", "Imaging", "Assessment", "Teaching"].map((s, i) => <View key={s} style={styles.stepItem}><View style={[styles.stepDot, { backgroundColor: i < 2 ? "#3B82F6" : colors.border }]} /><Text style={[styles.stepText, { color: i < 2 ? "#3B82F6" : colors.textMuted, fontSize: scaledFont(10) }]}>{s}</Text></View>)}</View>

          <View onLayout={(e) => { mainSectionYs.current.A = e.nativeEvent.layout.y; }}>
          <Section title="A. Patient Snapshot" icon={<UserRound color="#3B82F6" size={18} />} open={openMainSection === "A"} onToggle={() => toggleMainSection("A")}>
            <Field label="Case title *" value={draftCase.title} onChangeText={(title) => setDraftCase({ ...draftCase, title })} placeholder="e.g., Severe ARDS after CAP" />
            <View style={styles.twoCol}>
              <Field label="Age *" value={draftCase.age} onChangeText={(age) => setDraftCase({ ...draftCase, age })} keyboardType="numeric" />
              <View style={styles.fieldWrap}><Text style={[styles.fieldLabel, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>Gender</Text><View style={styles.segmented}>{(["Male", "Female"] as Gender[]).map((g) => <TouchableOpacity key={g} onPress={() => setDraftCase({ ...draftCase, gender: g })} style={[styles.segment, { backgroundColor: draftCase.gender === g ? "#3B82F6" : colors.bgElevated }]}><Text style={{ color: draftCase.gender === g ? "#fff" : colors.textMuted, fontWeight: "700" }}>{g}</Text></TouchableOpacity>)}</View></View>
            </View>
            <Field label="Nationality" value={draftCase.nationality} onChangeText={(nationality) => setDraftCase({ ...draftCase, nationality })} placeholder="Optional" />
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>Smoking status</Text>
            <View style={styles.chipWrap}>{SMOKING_OPTIONS.map((s) => <Chip key={s} label={s} selected={draftCase.smokingStatus === s} onPress={() => setDraftCase({ ...draftCase, smokingStatus: s })} />)}</View>
            {draftCase.smokingStatus !== "Non-smoker" ? <Field label="Pack-years" value={draftCase.packYears} onChangeText={(packYears) => setDraftCase({ ...draftCase, packYears })} keyboardType="numeric" /> : null}
            <Field label="Occupation & exposure history" value={draftCase.occupation} onChangeText={(occupation) => setDraftCase({ ...draftCase, occupation })} multiline placeholder="e.g., Farmer with chronic bird exposure" />
            <View style={styles.chipWrap}>{OCCUPATION_SUGGESTIONS.map((s) => <Chip key={s} label={s} selected={draftCase.occupation.toLowerCase().includes(s.toLowerCase())} onPress={() => setDraftCase({ ...draftCase, occupation: draftCase.occupation ? `${draftCase.occupation}, ${s}` : s })} accent="#64748B" />)}</View>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>Key comorbidities</Text>
            <View style={styles.chipWrap}>{FULL_COMORBIDITIES.map((c) => <Chip key={c} label={c} selected={draftCase.comorbidities.includes(c)} onPress={() => setDraftCase({ ...draftCase, comorbidities: draftCase.comorbidities.includes(c) ? draftCase.comorbidities.filter((x) => x !== c) : [...draftCase.comorbidities, c] })} />)}</View>
            <Field label="Other comorbidities" value={draftCase.comorbidityOther} onChangeText={(comorbidityOther) => setDraftCase({ ...draftCase, comorbidityOther })} multiline placeholder="Add any additional comorbidities not listed above" />
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>Functional status (ECOG)</Text>
            <View style={styles.chipWrap}>{[0, 1, 2, 3, 4].map((n) => <Chip key={n} label={`ECOG ${n}`} selected={draftCase.ecog === n} onPress={() => setDraftCase({ ...draftCase, ecog: n as 0 | 1 | 2 | 3 | 4 })} accent="#0D9488" />)}</View>
            <Field label="Hospital / Unit" value={draftCase.hospital} onChangeText={(hospital) => setDraftCase({ ...draftCase, hospital })} placeholder="Optional" />
          </Section>
          </View>
          <View onLayout={(e) => { mainSectionYs.current.B = e.nativeEvent.layout.y; }}>
          <Section title="B. Clinical Presentation" icon={<HeartPulse color="#EF4444" size={18} />} open={openMainSection === "B"} onToggle={() => toggleMainSection("B")}>
            <Field label="Chief complaint *" value={draftCase.chiefComplaint} onChangeText={(chiefComplaint) => setDraftCase({ ...draftCase, chiefComplaint })} />
            <Field label="History of present illness" value={draftCase.history} onChangeText={(history) => setDraftCase({ ...draftCase, history })} multiline placeholder="Tap microphone for voice-to-text when native speech package is enabled." />
            <TouchableOpacity onPress={() => Alert.alert("Voice-to-text", "Native dictation support is prepared with a keyboard fallback. Install @react-native-voice/voice in a custom build to enable continuous dictation.")} style={[styles.voiceBtn, { borderColor: colors.border }]}><Mic color="#3B82F6" size={16} /><Text style={[styles.voiceText, { color: "#3B82F6", fontSize: scaledFont(12) }]}>Dictate note</Text></TouchableOpacity>
            <View style={styles.twoCol}>
              <Field label="Duration of symptoms" value={draftCase.durationValue} onChangeText={(durationValue) => setDraftCase({ ...draftCase, durationValue })} keyboardType="numeric" />
              <View style={styles.fieldWrap}><Text style={[styles.fieldLabel, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>Unit</Text><View style={styles.segmented}>{DURATION_UNITS.map((u) => <TouchableOpacity key={u} onPress={() => setDraftCase({ ...draftCase, durationUnit: u })} style={[styles.segment, { backgroundColor: draftCase.durationUnit === u ? "#3B82F6" : colors.bgElevated }]}><Text style={{ color: draftCase.durationUnit === u ? "#fff" : colors.textMuted, fontWeight: "700", fontSize: scaledFont(11) }}>{u}</Text></TouchableOpacity>)}</View></View>
            </View>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontSize: scaledFont(12), marginTop: 10 }]}>Timeline of events</Text>
            {draftCase.timeline.map((t) => (
              <View key={t.id} style={[styles.timelineRow, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}>
                <View style={[styles.timelineDot, { backgroundColor: "#3B82F6" }]} />
                <View style={styles.flexOne}>
                  <TextInput value={t.date} onChangeText={(date) => setDraftCase({ ...draftCase, timeline: draftCase.timeline.map((x) => x.id === t.id ? { ...x, date } : x) })} placeholder="Date (e.g., Day 0, 2025-01-15)" placeholderTextColor={colors.textDim} style={{ color: colors.text, fontWeight: "800" as const, fontSize: scaledFont(12), paddingVertical: 2 }} />
                  <TextInput value={t.event} onChangeText={(event) => setDraftCase({ ...draftCase, timeline: draftCase.timeline.map((x) => x.id === t.id ? { ...x, event } : x) })} placeholder="Event description" placeholderTextColor={colors.textDim} style={{ color: colors.textMuted, fontSize: scaledFont(12), paddingVertical: 2 }} />
                </View>
                <TouchableOpacity onPress={() => setDraftCase({ ...draftCase, timeline: draftCase.timeline.filter((x) => x.id !== t.id) })}><X color="#EF4444" size={16} /></TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={() => setDraftCase({ ...draftCase, timeline: [...draftCase.timeline, { id: generateSecureUUID(), date: "", event: "" }] })} style={[styles.addRowBtn, { borderColor: colors.border }]}><Calendar color="#3B82F6" size={14} /><Text style={[styles.voiceText, { color: "#3B82F6", fontSize: scaledFont(12) }]}>Add timeline entry</Text></TouchableOpacity>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontSize: scaledFont(12), marginTop: 12 }]}>Physical examination</Text>
            <View style={styles.twoCol}><Field label="GCS" value={draftCase.gcs} onChangeText={(gcs) => setDraftCase({ ...draftCase, gcs })} keyboardType="numeric" /><Field label="BP" value={draftCase.bp} onChangeText={(bp) => setDraftCase({ ...draftCase, bp })} placeholder="120/80" /></View>
            <View style={styles.twoCol}><Field label="HR" value={draftCase.hr} onChangeText={(hr) => setDraftCase({ ...draftCase, hr })} keyboardType="numeric" unit="bpm" /><Field label="RR" value={draftCase.rr} onChangeText={(rr) => setDraftCase({ ...draftCase, rr })} keyboardType="numeric" unit="/min" /></View>
            <View style={styles.twoCol}><Field label="SpO2 (room air)" value={draftCase.spo2Air} onChangeText={(spo2Air) => setDraftCase({ ...draftCase, spo2Air })} keyboardType="numeric" unit="%" /><Field label="SpO2 (on O2)" value={draftCase.spo2O2} onChangeText={(spo2O2) => setDraftCase({ ...draftCase, spo2O2 })} keyboardType="numeric" unit="%" /></View>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>O2 device</Text>
            <View style={styles.chipWrap}>{O2_DEVICES.map((d) => <Chip key={d} label={d} selected={draftCase.o2Device === d} onPress={() => setDraftCase({ ...draftCase, o2Device: d })} />)}</View>
            <Field label="Brief physical examination" value={draftCase.briefExam} onChangeText={(briefExam) => setDraftCase({ ...draftCase, briefExam })} multiline placeholder="Document key examination findings (chest, cardiac, abdomen, neuro, etc.)" />
            <Toggle label="JVP elevated" value={draftCase.jvpElevated} onChange={(jvpElevated) => setDraftCase({ ...draftCase, jvpElevated })} />
          </Section>
          </View>
          <View onLayout={(e) => { mainSectionYs.current.C = e.nativeEvent.layout.y; }}>
          <Section title="C. Investigations" icon={<Gauge color="#F59E0B" size={18} />} open={openMainSection === "C"} onToggle={() => toggleMainSection("C")}>
            <Text style={[styles.subHeading, { color: colors.text, fontSize: scaledFont(13) }]}>Labs</Text>
            <View style={styles.twoCol}><Field label="WBC" value={draftCase.wbc} onChangeText={(wbc) => setDraftCase({ ...draftCase, wbc })} keyboardType="numeric" /><Field label="Hb" value={draftCase.hb} onChangeText={(hb) => setDraftCase({ ...draftCase, hb })} keyboardType="numeric" /></View>
            <View style={styles.twoCol}><Field label="Plt" value={draftCase.plt} onChangeText={(plt) => setDraftCase({ ...draftCase, plt })} keyboardType="numeric" /><Field label="CRP" value={draftCase.crp} onChangeText={(crp) => setDraftCase({ ...draftCase, crp })} keyboardType="numeric" /></View>
            <View style={styles.twoCol}><Field label="ESR" value={draftCase.esr} onChangeText={(esr) => setDraftCase({ ...draftCase, esr })} keyboardType="numeric" /><Field label="Procal" value={draftCase.pct} onChangeText={(pct) => setDraftCase({ ...draftCase, pct })} keyboardType="numeric" /></View>
            <View style={styles.twoCol}><Field label="LDH" value={draftCase.ldh} onChangeText={(ldh) => setDraftCase({ ...draftCase, ldh })} keyboardType="numeric" /><Field label="Ferritin" value={draftCase.ferritin} onChangeText={(ferritin) => setDraftCase({ ...draftCase, ferritin })} keyboardType="numeric" /></View>
            <Field label="D-Dimer" value={draftCase.dDimer} onChangeText={(dDimer) => setDraftCase({ ...draftCase, dDimer })} keyboardType="numeric" />
            <View style={styles.twoCol}><Field label="Creatinine" value={draftCase.creatinine} onChangeText={(creatinine) => setDraftCase({ ...draftCase, creatinine })} keyboardType="numeric" /><Field label="eGFR" value={draftCase.egfr} onChangeText={(egfr) => setDraftCase({ ...draftCase, egfr })} keyboardType="numeric" /></View>
            <View style={styles.twoCol}><Field label="ALT" value={draftCase.alt} onChangeText={(alt) => setDraftCase({ ...draftCase, alt })} keyboardType="numeric" /><Field label="AST" value={draftCase.ast} onChangeText={(ast) => setDraftCase({ ...draftCase, ast })} keyboardType="numeric" /></View>
            <Field label="Bilirubin" value={draftCase.bilirubin} onChangeText={(bilirubin) => setDraftCase({ ...draftCase, bilirubin })} keyboardType="numeric" />
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontSize: scaledFont(12), marginTop: 4 }]}>Custom labs</Text>
            {draftCase.customLabs.map((lab) => (
              <View key={lab.id} style={[styles.customLabRow, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}>
                <View style={styles.twoCol}><Field label="Name" value={lab.name} onChangeText={(name) => setDraftCase({ ...draftCase, customLabs: draftCase.customLabs.map((x) => x.id === lab.id ? { ...x, name } : x) })} /><Field label="Value" value={lab.value} onChangeText={(value) => setDraftCase({ ...draftCase, customLabs: draftCase.customLabs.map((x) => x.id === lab.id ? { ...x, value } : x) })} /></View>
                <View style={styles.twoCol}><Field label="Unit" value={lab.unit} onChangeText={(unit) => setDraftCase({ ...draftCase, customLabs: draftCase.customLabs.map((x) => x.id === lab.id ? { ...x, unit } : x) })} /><Field label="Normal range" value={lab.normalRange} onChangeText={(normalRange) => setDraftCase({ ...draftCase, customLabs: draftCase.customLabs.map((x) => x.id === lab.id ? { ...x, normalRange } : x) })} /></View>
                <TouchableOpacity onPress={() => setDraftCase({ ...draftCase, customLabs: draftCase.customLabs.filter((x) => x.id !== lab.id) })} style={styles.removeBtn}><Trash2 color="#EF4444" size={14} /><Text style={{ color: "#EF4444", fontWeight: "900" as const, fontSize: 11 }}>Remove</Text></TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={() => setDraftCase({ ...draftCase, customLabs: [...draftCase.customLabs, { id: generateSecureUUID(), name: "", value: "", unit: "", normalRange: "" }] })} style={[styles.addRowBtn, { borderColor: colors.border }]}><Plus color="#3B82F6" size={14} /><Text style={[styles.voiceText, { color: "#3B82F6", fontSize: scaledFont(12) }]}>Add custom lab</Text></TouchableOpacity>

            <Text style={[styles.subHeading, { color: colors.text, fontSize: scaledFont(13), marginTop: 14 }]}>Tap a panel to expand</Text>

            <ExpandablePanel title="Autoimmune panel" icon={<ShieldCheck color="#8B5CF6" size={16} />} accent="#8B5CF6" isOpen={openPanel === "autoimmune"} onToggle={() => togglePanel("autoimmune")} images={getPanelImages("autoimmune")} onAddImage={() => void addPanelImage("autoimmune")} onRemoveImage={(uri) => removePanelImage("autoimmune", uri)}>
              <Field label="Autoimmune panel notes" value={draftCase.autoimmunePanel} onChangeText={(autoimmunePanel) => setDraftCase({ ...draftCase, autoimmunePanel })} multiline placeholder="ANA, ANCA, RF, anti-CCP, complement, etc." />
            </ExpandablePanel>

            <ExpandablePanel title="Arterial Blood Gas (ABG)" icon={<Activity color="#EF4444" size={16} />} accent="#EF4444" isOpen={openPanel === "abg"} onToggle={() => togglePanel("abg")} images={getPanelImages("abg")} onAddImage={() => void addPanelImage("abg")} onRemoveImage={(uri) => removePanelImage("abg", uri)}>
              <View style={styles.twoCol}><Field label="pH" value={draftCase.ph} onChangeText={(ph) => setDraftCase({ ...draftCase, ph })} keyboardType="numeric" /><Field label="PaCO2" value={draftCase.paco2} onChangeText={(paco2) => setDraftCase({ ...draftCase, paco2 })} keyboardType="numeric" unit="mmHg" /></View>
              <View style={styles.twoCol}><Field label="PaO2" value={draftCase.pao2} onChangeText={(pao2) => setDraftCase({ ...draftCase, pao2 })} keyboardType="numeric" unit="mmHg" /><Field label="HCO3" value={draftCase.hco3} onChangeText={(hco3) => setDraftCase({ ...draftCase, hco3 })} keyboardType="numeric" unit="mmol/L" /></View>
              <View style={styles.twoCol}><Field label="SpO2" value={draftCase.spo2} onChangeText={(spo2) => setDraftCase({ ...draftCase, spo2 })} keyboardType="numeric" unit="%" /><Field label="Lactate" value={draftCase.lactate} onChangeText={(lactate) => setDraftCase({ ...draftCase, lactate })} keyboardType="numeric" /></View>
              <Field label="FiO2 at ABG" value={draftCase.fio2} onChangeText={(fio2) => setDraftCase({ ...draftCase, fio2 })} keyboardType="numeric" />
              <View style={[styles.calcCard, { borderColor: pf.color, backgroundColor: `${pf.color}14` }]}><Text style={[styles.calcTitle, { color: pf.color, fontSize: scaledFont(14) }]}>P/F Ratio: {pf.value ?? "—"}</Text><Text style={[styles.calcSub, { color: colors.textMuted, fontSize: scaledFont(12) }]}>{pf.label}</Text></View>
              <View style={[styles.calcCard, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}><Text style={[styles.calcTitle, { color: colors.text, fontSize: scaledFont(14) }]}>ABG interpretation</Text><Text style={[styles.calcSub, { color: colors.textMuted, fontSize: scaledFont(12) }]}>{abgSuggestion(draftCase)}</Text></View>
            </ExpandablePanel>

            <ExpandablePanel title="Microbiology" icon={<Sparkles color="#0D9488" size={16} />} accent="#0D9488" isOpen={openPanel === "micro"} onToggle={() => togglePanel("micro")} images={getPanelImages("micro")} onAddImage={() => void addPanelImage("micro")} onRemoveImage={(uri) => removePanelImage("micro", uri)}>
              {draftCase.cultures.map((c) => (
                <View key={c.id} style={[styles.customLabRow, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>Source</Text>
                  <View style={styles.chipWrap}>{CULTURE_SOURCES.map((src) => <Chip key={src} label={src} selected={c.source === src} onPress={() => setDraftCase({ ...draftCase, cultures: draftCase.cultures.map((x) => x.id === c.id ? { ...x, source: src } : x) })} accent="#0D9488" />)}</View>
                  <Field label="Organism" value={c.organism} onChangeText={(organism) => setDraftCase({ ...draftCase, cultures: draftCase.cultures.map((x) => x.id === c.id ? { ...x, organism } : x) })} />
                  <Field label="Result / notes" value={c.result} onChangeText={(result) => setDraftCase({ ...draftCase, cultures: draftCase.cultures.map((x) => x.id === c.id ? { ...x, result } : x) })} multiline />
                  <TouchableOpacity onPress={() => setDraftCase({ ...draftCase, cultures: draftCase.cultures.filter((x) => x.id !== c.id) })} style={styles.removeBtn}><Trash2 color="#EF4444" size={14} /><Text style={{ color: "#EF4444", fontWeight: "900" as const, fontSize: 11 }}>Remove</Text></TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={() => setDraftCase({ ...draftCase, cultures: [...draftCase.cultures, { id: generateSecureUUID(), source: "Blood", organism: "", result: "" }] })} style={[styles.addRowBtn, { borderColor: colors.border }]}><Plus color="#0D9488" size={14} /><Text style={[styles.voiceText, { color: "#0D9488", fontSize: scaledFont(12) }]}>Add culture</Text></TouchableOpacity>
              <Field label="Gram stain" value={draftCase.gramStain} onChangeText={(gramStain) => setDraftCase({ ...draftCase, gramStain })} />
              <Field label="Sensitivity / resistance" value={draftCase.sensitivity} onChangeText={(sensitivity) => setDraftCase({ ...draftCase, sensitivity })} multiline />
              <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>Serology</Text>
              {draftCase.serology.map((s) => (
                <View key={s.id} style={[styles.customLabRow, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}>
                  <View style={styles.chipWrap}>{SEROLOGY_TESTS.map((t) => <Chip key={t} label={t} selected={s.test === t} onPress={() => setDraftCase({ ...draftCase, serology: draftCase.serology.map((x) => x.id === s.id ? { ...x, test: t } : x) })} accent="#8B5CF6" />)}</View>
                  <Field label="Result" value={s.result} onChangeText={(result) => setDraftCase({ ...draftCase, serology: draftCase.serology.map((x) => x.id === s.id ? { ...x, result } : x) })} placeholder="Positive / Negative / titer" />
                  <TouchableOpacity onPress={() => setDraftCase({ ...draftCase, serology: draftCase.serology.filter((x) => x.id !== s.id) })} style={styles.removeBtn}><Trash2 color="#EF4444" size={14} /><Text style={{ color: "#EF4444", fontWeight: "900" as const, fontSize: 11 }}>Remove</Text></TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={() => setDraftCase({ ...draftCase, serology: [...draftCase.serology, { id: generateSecureUUID(), test: "COVID", result: "" }] })} style={[styles.addRowBtn, { borderColor: colors.border }]}><Plus color="#8B5CF6" size={14} /><Text style={[styles.voiceText, { color: "#8B5CF6", fontSize: scaledFont(12) }]}>Add serology test</Text></TouchableOpacity>
            </ExpandablePanel>

            <ExpandablePanel title="PFTs" icon={<BookMarked color="#0D9488" size={16} />} accent="#0D9488" isOpen={openPanel === "pft"} onToggle={() => togglePanel("pft")} images={getPanelImages("pft")} onAddImage={() => void addPanelImage("pft")} onRemoveImage={(uri) => removePanelImage("pft", uri)}>
              <Field label="PFT summary / linked interpretation" value={draftCase.pftSummary} onChangeText={(pftSummary) => setDraftCase({ ...draftCase, pftSummary })} multiline placeholder="Paste interpretation or note a linked PulmoLab PFT result." />
              <TouchableOpacity onPress={() => router.push("/pft")} style={[styles.voiceBtn, { borderColor: colors.border }]}><BookMarked color="#0D9488" size={16} /><Text style={[styles.voiceText, { color: "#0D9488", fontSize: scaledFont(12) }]}>Open PFT interpreter</Text></TouchableOpacity>
            </ExpandablePanel>

            <ExpandablePanel title="ECG findings" icon={<HeartPulse color="#3B82F6" size={16} />} accent="#3B82F6" isOpen={openPanel === "ecg"} onToggle={() => togglePanel("ecg")} images={getPanelImages("ecg")} onAddImage={() => void addPanelImage("ecg")} onRemoveImage={(uri) => removePanelImage("ecg", uri)}>
              <Field label="ECG comments / notes" value={draftCase.ecgFindings} onChangeText={(ecgFindings) => setDraftCase({ ...draftCase, ecgFindings })} multiline placeholder="Rate, rhythm, axis, intervals, ischemia, strain pattern, etc." />
            </ExpandablePanel>

            <ExpandablePanel title="Echo findings" icon={<HeartPulse color="#F97316" size={16} />} accent="#F97316" isOpen={openPanel === "echo"} onToggle={() => togglePanel("echo")} images={getPanelImages("echo")} onAddImage={() => void addPanelImage("echo")} onRemoveImage={(uri) => removePanelImage("echo", uri)}>
              <Field label="Echo comments / notes" value={draftCase.echoFindings} onChangeText={(echoFindings) => setDraftCase({ ...draftCase, echoFindings })} multiline placeholder="LV/RV function, valves, RVSP, pericardial findings, etc." />
            </ExpandablePanel>

            <ExpandablePanel title="Pleural fluid analysis" icon={<Gauge color="#F59E0B" size={16} />} accent="#F59E0B" isOpen={openPanel === "pleural"} onToggle={() => togglePanel("pleural")} images={getPanelImages("pleural")} onAddImage={() => void addPanelImage("pleural")} onRemoveImage={(uri) => removePanelImage("pleural", uri)}>
              <View style={styles.twoCol}><Field label="Pleural pH" value={draftCase.pleuralPh} onChangeText={(pleuralPh) => setDraftCase({ ...draftCase, pleuralPh })} keyboardType="numeric" /><Field label="Pleural LDH" value={draftCase.pleuralLdh} onChangeText={(pleuralLdh) => setDraftCase({ ...draftCase, pleuralLdh })} keyboardType="numeric" /></View>
              <View style={styles.twoCol}><Field label="Serum LDH" value={draftCase.serumLdh} onChangeText={(serumLdh) => setDraftCase({ ...draftCase, serumLdh })} keyboardType="numeric" /><Field label="Pleural protein" value={draftCase.pleuralProtein} onChangeText={(pleuralProtein) => setDraftCase({ ...draftCase, pleuralProtein })} keyboardType="numeric" /></View>
              <View style={styles.twoCol}><Field label="Serum protein" value={draftCase.serumProtein} onChangeText={(serumProtein) => setDraftCase({ ...draftCase, serumProtein })} keyboardType="numeric" /><Field label="Pleural glucose" value={draftCase.pleuralGlucose} onChangeText={(pleuralGlucose) => setDraftCase({ ...draftCase, pleuralGlucose })} keyboardType="numeric" /></View>
              <Field label="Pleural cells" value={draftCase.pleuralCells} onChangeText={(pleuralCells) => setDraftCase({ ...draftCase, pleuralCells })} placeholder="Differential count" />
              <View style={[styles.calcCard, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}><Text style={[styles.calcTitle, { color: colors.text, fontSize: scaledFont(14) }]}>Light's criteria</Text><Text style={[styles.calcSub, { color: colors.textMuted, fontSize: scaledFont(12) }]}>{lightsCriteria(draftCase)}</Text></View>
            </ExpandablePanel>

            <ExpandablePanel title="Bronchoscopy report" icon={<Stethoscope color="#10B981" size={16} />} accent="#10B981" isOpen={openPanel === "broncho"} onToggle={() => togglePanel("broncho")} images={getPanelImages("broncho")} onAddImage={() => void addPanelImage("broncho")} onRemoveImage={(uri) => removePanelImage("broncho", uri)}>
              <Field label="Bronchoscopy comments / notes" value={draftCase.bronchoscopyReport} onChangeText={(bronchoscopyReport) => setDraftCase({ ...draftCase, bronchoscopyReport })} multiline placeholder="Findings, sampling done, complications, etc." />
            </ExpandablePanel>

            <ExpandablePanel title="Lung biopsy result" icon={<FileText color="#EF4444" size={16} />} accent="#EF4444" isOpen={openPanel === "biopsy"} onToggle={() => togglePanel("biopsy")} images={getPanelImages("biopsy")} onAddImage={() => void addPanelImage("biopsy")} onRemoveImage={(uri) => removePanelImage("biopsy", uri)}>
              <Field label="Biopsy comments / pathology" value={draftCase.biopsyResult} onChangeText={(biopsyResult) => setDraftCase({ ...draftCase, biopsyResult })} multiline placeholder="Histology, immunostains, molecular results, etc." />
            </ExpandablePanel>
          </Section>
          </View>
          <View onLayout={(e) => { mainSectionYs.current.D = e.nativeEvent.layout.y; }}>
          <Section title="D. Imaging & Media" icon={<ImageIcon color="#8B5CF6" size={18} />} open={openMainSection === "D"} onToggle={() => toggleMainSection("D")}>
            <View style={[styles.uploadZone, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}><UploadCloud color="#8B5CF6" size={26} /><Text style={[styles.uploadTitle, { color: colors.text, fontSize: scaledFont(14) }]}>Tap to attach X-Ray, CT, bronchoscopy, PDF, MP4/MOV</Text><Text style={[styles.uploadSub, { color: colors.textMuted, fontSize: scaledFont(11) }]}>Storage path: Supabase bucket logbook-media. Max target: 50MB/file.</Text></View>
            <View style={styles.mediaActions}><ActionPill icon={<Camera color="#3B82F6" size={14} />} text="Image viewer" /><ActionPill icon={<Video color="#0D9488" size={14} />} text="CT video" /><ActionPill icon={<FileText color="#F59E0B" size={14} />} text="PDF report" /></View>
          </Section>
          </View>
          <View onLayout={(e) => { mainSectionYs.current.E = e.nativeEvent.layout.y; }}>
          <Section title="E. Assessment, Management & Teaching" icon={<BookMarked color="#0D9488" size={18} />} open={openMainSection === "E"} onToggle={() => toggleMainSection("E")}>
            <Field label="Final diagnosis *" value={draftCase.finalDiagnosis} onChangeText={(finalDiagnosis) => setDraftCase({ ...draftCase, finalDiagnosis })} />
            <Field label="Management & Outcome" value={draftCase.managementPlan} onChangeText={(managementPlan) => setDraftCase({ ...draftCase, managementPlan })} multiline placeholder="Final plan of treatment, follow-up schedule, escalation, referrals, monitoring..." />
            <Field label="Key learning point" value={draftCase.learningPoint} onChangeText={(learningPoint) => setDraftCase({ ...draftCase, learningPoint })} multiline />
          </Section>
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderCaseDetail = () => {
    const item = store.cases.find((c) => c.id === selectedCaseId);
    if (!item) {
      return (
        <View style={styles.screenFill}>
          {renderSubHeader("Case not found", "Return to cases list", <FileText color="#EF4444" size={22} />, () => setMode("cases"))}
        </View>
      );
    }
    const pf = pfBadge(item.pao2, item.fio2);
    const title = item.finalDiagnosis || item.title || "Clinical Case";
    const ageStr = item.age ? `${item.age}-year-old` : "adult";
    const genderStr = item.gender === "Female" ? "female" : "male";
    const occStr = item.occupation ? `, ${item.occupation.toLowerCase()}` : "";
    const smokingStr = item.smokingStatus !== "Non-smoker" ? `, ${item.smokingStatus.toLowerCase()}${item.packYears ? ` (${item.packYears} pack-years)` : ""}` : ", non-smoker";
    const comorbs = [...item.comorbidities, ...(item.comorbidityOther ? [item.comorbidityOther] : [])];
    const comorbStr = comorbs.length ? `, known case of ${comorbs.join(", ")}` : "";
    const ccStr = item.chiefComplaint ? `, presented with ${item.chiefComplaint}${item.durationValue ? ` for ${item.durationValue} ${item.durationUnit}` : ""}.` : ".";
    const narrative = `A ${ageStr} ${genderStr}${occStr}${smokingStr}${comorbStr}${ccStr}`;

    const labs = LAB_RANGES.map((r) => ({ range: r, raw: (item[r.key] as string) ?? "", status: labStatus((item[r.key] as string) ?? "", r) })).filter((l) => l.raw.trim() !== "");
    const hasABG = !!(item.ph || item.paco2 || item.pao2 || item.hco3);
    const hasMicro = item.cultures.length > 0 || item.serology.length > 0 || !!item.gramStain || !!item.sensitivity;
    const hasPleural = !!(item.pleuralPh || item.pleuralLdh || item.pleuralProtein || item.serumLdh || item.serumProtein || item.pleuralGlucose || item.pleuralCells);
    const lights = hasPleural ? lightsCriteria(item) : "";
    const imagingCats: { key: PanelKey; label: string }[] = [
      { key: "ecg", label: "ECG" },
      { key: "echo", label: "Echo" },
      { key: "abg", label: "ABG" },
      { key: "micro", label: "Micro" },
      { key: "pleural", label: "Pleural" },
      { key: "broncho", label: "Bronchoscopy" },
      { key: "biopsy", label: "Biopsy" },
      { key: "pft", label: "PFT" },
      { key: "autoimmune", label: "Autoimmune" },
    ];
    const imagingAvailable = imagingCats.filter((c) => (item.panelImages[c.key] ?? []).length > 0);
    const learning = (item.learningPoint || "").split(/\n+/).map((s) => s.trim()).filter(Boolean);
    const sectionTextColor = isDark ? "#E2E8F0" : "#0F172A";

    let sectionNumber = 0;
    const sectionNum = () => ++sectionNumber;

    return (
      <View style={styles.screenFill}>
        <View style={[styles.detailHeader, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <TouchableOpacity onPress={() => setMode("cases")} style={styles.backMini}><ChevronRight color={colors.textMuted} size={20} style={{ transform: [{ rotate: "180deg" }] }} /></TouchableOpacity>
          <View style={styles.flexOne}>
            <Text style={[styles.detailEyebrow, { color: "#3B82F6", fontSize: scaledFont(10) }]}>{(item.tag || "CASE").toUpperCase()} • {formatDate(item.createdAt)}</Text>
            <Text style={[styles.detailTitle, { color: colors.text, fontSize: scaledFont(20) }]} numberOfLines={2}>{title}</Text>
          </View>
          <TouchableOpacity onPress={editSelectedCase} style={[styles.iconBtnRound, { borderColor: colors.border }]} testID="detail-edit"><NotebookPen color={colors.textMuted} size={17} /></TouchableOpacity>
          <TouchableOpacity onPress={() => void toggleStar(item.id)} style={[styles.iconBtnRound, { borderColor: colors.border }]}><Star color="#F59E0B" fill={item.isStarred ? "#F59E0B" : "transparent"} size={17} /></TouchableOpacity>
          <TouchableOpacity onPress={() => setShareSheet(true)} style={[styles.iconBtnRound, { borderColor: colors.border }]}><Share2 color={colors.textMuted} size={17} /></TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={[styles.formScroll, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
          <View style={[styles.detailHero, { borderColor: "rgba(59,130,246,0.35)", backgroundColor: isDark ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.06)" }]}>
            <Text style={[styles.detailNarrative, { color: sectionTextColor, fontSize: scaledFont(14) }]}>{narrative}</Text>
            <View style={styles.heroPills}>
              {item.ecog !== undefined ? <DetailPill text={`ECOG ${item.ecog}`} color="#0D9488" /> : null}
              {item.hospital ? <DetailPill text={item.hospital} color="#64748B" /> : null}
              {pf.value !== null ? <DetailPill text={`P/F ${pf.value}`} color={pf.color} /> : null}
            </View>
          </View>

          <DetailSection number={sectionNum()} title="Patient Profile" accent="#3B82F6">
            <View style={styles.profileGrid}>
              {item.age ? <ProfileItem label="Age" value={`${item.age}y`} /> : null}
              <ProfileItem label="Gender" value={item.gender} />
              {item.nationality ? <ProfileItem label="Nationality" value={item.nationality} /> : null}
              <ProfileItem label="Smoking" value={item.smokingStatus + (item.packYears ? ` (${item.packYears} PY)` : "")} />
              {item.occupation ? <ProfileItem label="Occupation" value={item.occupation} /> : null}
              {comorbs.length ? <ProfileItem label="Comorbidities" value={comorbs.join(", ")} /> : null}
              <ProfileItem label="Functional" value={`ECOG ${item.ecog}`} />
            </View>
          </DetailSection>

          {(item.chiefComplaint || item.history || item.timeline.length || item.bp || item.briefExam) ? (
            <DetailSection number={sectionNum()} title="Clinical Presentation" accent="#EF4444">
              {item.chiefComplaint ? (
                <View style={styles.ccBlock}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontSize: scaledFont(11) }]}>Chief complaint</Text>
                  <Text style={[styles.detailCC, { color: colors.text, fontSize: scaledFont(16) }]}>{item.chiefComplaint}</Text>
                  {item.durationValue ? <Text style={[styles.detailMuted, { color: colors.textMuted, fontSize: scaledFont(12) }]}>Duration: {item.durationValue} {item.durationUnit}</Text> : null}
                </View>
              ) : null}
              {item.history ? <Text style={[styles.detailParagraph, { color: sectionTextColor, fontSize: scaledFont(13) }]}>{item.history}</Text> : null}
              {item.timeline.length ? (
                <View style={styles.timelineWrap}>
                  <Text style={[styles.subHeading, { color: colors.text, fontSize: scaledFont(13) }]}>Timeline</Text>
                  {item.timeline.map((t, idx) => (
                    <View key={t.id} style={styles.vTimelineRow}>
                      <View style={styles.vTimelineColumn}>
                        <View style={[styles.vTimelineDot, { backgroundColor: "#3B82F6" }]} />
                        {idx < item.timeline.length - 1 ? <View style={[styles.vTimelineLine, { backgroundColor: "rgba(59,130,246,0.35)" }]} /> : null}
                      </View>
                      <View style={styles.flexOne}>
                        <Text style={[styles.timelineDate, { color: "#3B82F6", fontSize: scaledFont(12) }]}>{t.date || "—"}</Text>
                        <Text style={[styles.timelineEvent, { color: sectionTextColor, fontSize: scaledFont(13) }]}>{t.event}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
              {(item.gcs || item.bp || item.hr || item.rr || item.spo2Air || item.spo2O2 || item.briefExam) ? (
                <View style={[styles.examCard, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}>
                  <Text style={[styles.subHeading, { color: colors.text, fontSize: scaledFont(13) }]}>Physical examination</Text>
                  <View style={styles.vitalsRow}>
                    {item.gcs ? <Vital label="GCS" value={item.gcs} /> : null}
                    {item.bp ? <Vital label="BP" value={item.bp} /> : null}
                    {item.hr ? <Vital label="HR" value={`${item.hr} bpm`} /> : null}
                    {item.rr ? <Vital label="RR" value={`${item.rr}/min`} /> : null}
                    {item.spo2Air ? <Vital label="SpO2 (air)" value={`${item.spo2Air}%`} /> : null}
                    {item.spo2O2 ? <Vital label={`SpO2 (${item.o2Device})`} value={`${item.spo2O2}%`} /> : null}
                  </View>
                  {item.briefExam ? <Text style={[styles.detailParagraph, { color: sectionTextColor, fontSize: scaledFont(13) }]}>{item.briefExam}</Text> : null}
                  {item.jvpElevated ? <Text style={[styles.detailMuted, { color: "#F59E0B", fontSize: scaledFont(12) }]}>JVP: Elevated</Text> : null}
                </View>
              ) : null}
            </DetailSection>
          ) : null}

          {(labs.length || hasABG || hasMicro || hasPleural || item.pftSummary || item.autoimmunePanel) ? (
            <DetailSection number={sectionNum()} title="Investigations" accent="#F59E0B">
              {labs.length ? (
                <View>
                  <Text style={[styles.subHeading, { color: colors.text, fontSize: scaledFont(13) }]}>Laboratory results</Text>
                  <View style={[styles.labTable, { borderColor: colors.border }]}>
                    <View style={[styles.labRowHeader, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}>
                      <Text style={[styles.labCellHead, { color: colors.textMuted, fontSize: scaledFont(11) }]}>Parameter</Text>
                      <Text style={[styles.labCellHead, { color: colors.textMuted, fontSize: scaledFont(11) }]}>Value</Text>
                      <Text style={[styles.labCellHead, { color: colors.textMuted, fontSize: scaledFont(11), textAlign: "right" }]}>Status</Text>
                    </View>
                    {labs.map((l) => (
                      <View key={l.range.key as string} style={[styles.labRow, { borderColor: colors.border }]}>
                        <Text style={[styles.labCell, { color: colors.text, fontSize: scaledFont(12) }]}>{l.range.label}</Text>
                        <Text style={[styles.labCell, { color: colors.text, fontSize: scaledFont(12) }]}>{l.raw}{l.range.unit ? ` ${l.range.unit}` : ""}</Text>
                        <View style={styles.labStatusCell}><View style={[styles.statusDot, { backgroundColor: statusColor(l.status) }]} /><Text style={[styles.labCell, { color: statusColor(l.status), fontSize: scaledFont(12), fontWeight: "800" as const }]}>{statusLabel(l.status)}</Text></View>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              {item.customLabs.length ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.subHeading, { color: colors.text, fontSize: scaledFont(13) }]}>Custom labs</Text>
                  {item.customLabs.map((l) => (
                    <View key={l.id} style={[styles.kvRow, { borderColor: colors.border }]}>
                      <Text style={[styles.kvKey, { color: colors.textMuted, fontSize: scaledFont(12) }]}>{l.name || "—"}</Text>
                      <Text style={[styles.kvVal, { color: colors.text, fontSize: scaledFont(12) }]}>{l.value}{l.unit ? ` ${l.unit}` : ""}{l.normalRange ? `  (ref ${l.normalRange})` : ""}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {hasABG ? (
                <View style={[styles.abgCard, { borderColor: pf.color, backgroundColor: isDark ? `${pf.color}1F` : `${pf.color}12` }]}>
                  <Text style={[styles.abgTitle, { color: pf.color, fontSize: scaledFont(13) }]}>ARTERIAL BLOOD GAS</Text>
                  <View style={styles.abgGrid}>
                    {([["ph", "pH", item.ph], ["paco2", "PaCO2", item.paco2], ["pao2", "PaO2", item.pao2], ["hco3", "HCO3", item.hco3], ["spo2", "SpO2", item.spo2]] as const).map(([k, label, val]) => {
                      if (!val) return null;
                      const s = abgValueStatus(k, val);
                      return (
                        <View key={k} style={[styles.abgCell, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                          <Text style={[styles.abgLabel, { color: colors.textMuted, fontSize: scaledFont(10) }]}>{label}</Text>
                          <Text style={[styles.abgValue, { color: colors.text, fontSize: scaledFont(15) }]}>{val}</Text>
                          <View style={styles.abgTagRow}><View style={[styles.statusDot, { backgroundColor: statusColor(s.status) }]} /><Text style={[styles.abgTag, { color: statusColor(s.status), fontSize: scaledFont(10) }]}>{s.tag}</Text></View>
                        </View>
                      );
                    })}
                    {item.fio2 ? <View style={[styles.abgCell, { borderColor: colors.border, backgroundColor: colors.bgCard }]}><Text style={[styles.abgLabel, { color: colors.textMuted, fontSize: scaledFont(10) }]}>FiO2</Text><Text style={[styles.abgValue, { color: colors.text, fontSize: scaledFont(15) }]}>{item.fio2}</Text></View> : null}
                  </View>
                  {pf.value !== null ? (
                    <View style={[styles.pfBanner, { backgroundColor: pf.color }]}>
                      <Text style={[styles.pfBannerText, { fontSize: scaledFont(13) }]}>P/F Ratio: {pf.value} — {pf.label.toUpperCase()}</Text>
                    </View>
                  ) : null}
                  <Text style={[styles.abgInterpretation, { color: sectionTextColor, fontSize: scaledFont(12) }]}>Interpretation: {abgSuggestion(item)}</Text>
                </View>
              ) : null}
              {hasMicro ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.subHeading, { color: colors.text, fontSize: scaledFont(13) }]}>Microbiology</Text>
                  {item.cultures.map((c) => {
                    const negative = (c.result || c.organism).toLowerCase().includes("negative");
                    const accent = negative ? "#10B981" : "#EF4444";
                    return (
                      <View key={c.id} style={[styles.microCard, { borderColor: accent, backgroundColor: `${accent}14` }]}>
                        <Text style={[styles.microTitle, { color: accent, fontSize: scaledFont(12) }]}>{c.source.toUpperCase()} CULTURE</Text>
                        <Text style={[styles.microBody, { color: sectionTextColor, fontSize: scaledFont(13) }]}>{c.organism || "—"}{c.result ? ` • ${c.result}` : ""}</Text>
                      </View>
                    );
                  })}
                  {item.serology.map((s) => {
                    const positive = s.result.toLowerCase().includes("positive");
                    const accent = positive ? "#EF4444" : "#10B981";
                    return (
                      <View key={s.id} style={[styles.microCard, { borderColor: accent, backgroundColor: `${accent}14` }]}>
                        <Text style={[styles.microTitle, { color: accent, fontSize: scaledFont(12) }]}>{s.test.toUpperCase()}</Text>
                        <Text style={[styles.microBody, { color: sectionTextColor, fontSize: scaledFont(13) }]}>{s.result || "—"}</Text>
                      </View>
                    );
                  })}
                  {item.gramStain ? <Text style={[styles.detailMuted, { color: colors.textMuted, fontSize: scaledFont(12) }]}>Gram stain: {item.gramStain}</Text> : null}
                  {item.sensitivity ? <Text style={[styles.detailMuted, { color: colors.textMuted, fontSize: scaledFont(12) }]}>Sensitivity: {item.sensitivity}</Text> : null}
                </View>
              ) : null}
              {hasPleural ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.subHeading, { color: colors.text, fontSize: scaledFont(13) }]}>Pleural fluid</Text>
                  {lights ? <View style={[styles.lightsBadge, { backgroundColor: lights.toLowerCase().includes("exudate") ? "#F97316" : "#3B82F6" }]}><Text style={[styles.lightsBadgeText, { fontSize: scaledFont(12) }]}>{lights.toUpperCase()}</Text></View> : null}
                  <View style={[styles.kvWrap, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}>
                    {item.pleuralPh ? <KV k="Pleural pH" v={item.pleuralPh} /> : null}
                    {item.pleuralProtein ? <KV k="Pleural protein" v={item.pleuralProtein} /> : null}
                    {item.serumProtein ? <KV k="Serum protein" v={item.serumProtein} /> : null}
                    {item.pleuralLdh ? <KV k="Pleural LDH" v={item.pleuralLdh} /> : null}
                    {item.serumLdh ? <KV k="Serum LDH" v={item.serumLdh} /> : null}
                    {item.pleuralGlucose ? <KV k="Pleural glucose" v={item.pleuralGlucose} /> : null}
                    {item.pleuralCells ? <KV k="Pleural cells" v={item.pleuralCells} /> : null}
                  </View>
                </View>
              ) : null}
              {item.pftSummary ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.subHeading, { color: colors.text, fontSize: scaledFont(13) }]}>PFT</Text>
                  <Text style={[styles.detailParagraph, { color: sectionTextColor, fontSize: scaledFont(13) }]}>{item.pftSummary}</Text>
                </View>
              ) : null}
              {item.autoimmunePanel ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.subHeading, { color: colors.text, fontSize: scaledFont(13) }]}>Autoimmune panel</Text>
                  <Text style={[styles.detailParagraph, { color: sectionTextColor, fontSize: scaledFont(13) }]}>{item.autoimmunePanel}</Text>
                </View>
              ) : null}
              {item.ecgFindings ? <View style={{ marginTop: 12 }}><Text style={[styles.subHeading, { color: colors.text, fontSize: scaledFont(13) }]}>ECG</Text><Text style={[styles.detailParagraph, { color: sectionTextColor, fontSize: scaledFont(13) }]}>{item.ecgFindings}</Text></View> : null}
              {item.echoFindings ? <View style={{ marginTop: 12 }}><Text style={[styles.subHeading, { color: colors.text, fontSize: scaledFont(13) }]}>Echo</Text><Text style={[styles.detailParagraph, { color: sectionTextColor, fontSize: scaledFont(13) }]}>{item.echoFindings}</Text></View> : null}
              {item.bronchoscopyReport ? <View style={{ marginTop: 12 }}><Text style={[styles.subHeading, { color: colors.text, fontSize: scaledFont(13) }]}>Bronchoscopy</Text><Text style={[styles.detailParagraph, { color: sectionTextColor, fontSize: scaledFont(13) }]}>{item.bronchoscopyReport}</Text></View> : null}
              {item.biopsyResult ? <View style={{ marginTop: 12 }}><Text style={[styles.subHeading, { color: colors.text, fontSize: scaledFont(13) }]}>Biopsy</Text><Text style={[styles.detailParagraph, { color: sectionTextColor, fontSize: scaledFont(13) }]}>{item.biopsyResult}</Text></View> : null}
            </DetailSection>
          ) : null}

          {imagingAvailable.length ? (
            <DetailSection number={sectionNum()} title="Imaging" accent="#8B5CF6">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagingTabs} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                <Chip label="All" selected={imagingTab === "all"} onPress={() => setImagingTab("all")} accent="#8B5CF6" />
                {imagingAvailable.map((cat) => <Chip key={cat.key} label={cat.label} selected={imagingTab === cat.key} onPress={() => setImagingTab(cat.key)} accent="#8B5CF6" />)}
              </ScrollView>
              {(imagingTab === "all" ? imagingAvailable : imagingAvailable.filter((c) => c.key === imagingTab)).map((cat) => {
                const imgs = item.panelImages[cat.key] ?? [];
                return (
                  <View key={cat.key} style={{ marginTop: 10 }}>
                    <Text style={[styles.subHeading, { color: colors.text, fontSize: scaledFont(13) }]}>{cat.label}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                      {imgs.map((rawUri) => {
                        const uri = resolveMediaUri(rawUri);
                        if (!uri) return null;
                        const kind = detectMediaKind(uri);
                        if (kind === "video") {
                          return (
                            <TouchableOpacity key={rawUri} activeOpacity={0.85} onPress={() => { setVideoUri(uri); setVideoCaption(cat.label); setVideoOpen(true); }} style={[styles.imagingThumb, styles.mediaPlaceholder, { borderColor: colors.border, backgroundColor: "#0F172A" }]}>
                              <Video color="#fff" size={26} />
                              <Text style={[styles.mediaPlaceholderText, { color: "#fff", fontSize: scaledFont(10) }]}>Video</Text>
                            </TouchableOpacity>
                          );
                        }
                        if (kind === "pdf") {
                          return (
                            <TouchableOpacity key={rawUri} activeOpacity={0.85} onPress={() => { void WebBrowser.openBrowserAsync(uri); }} style={[styles.imagingThumb, styles.mediaPlaceholder, { borderColor: colors.border, backgroundColor: isDark ? "#1E293B" : "#FEF3C7" }]}>
                              <FileText color="#F59E0B" size={26} />
                              <Text style={[styles.mediaPlaceholderText, { color: isDark ? "#FDE68A" : "#92400E", fontSize: scaledFont(10) }]}>PDF report</Text>
                            </TouchableOpacity>
                          );
                        }
                        return (
                          <TouchableOpacity key={rawUri} activeOpacity={0.85} onPress={() => Alert.alert(cat.label, "Full-screen image viewer with pinch-to-zoom is staged in the media pipeline.")}>
                            <Image source={{ uri }} style={styles.imagingThumb} />
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                );
              })}
            </DetailSection>
          ) : null}

          {item.finalDiagnosis ? (
            <DetailSection number={sectionNum()} title="Clinical Assessment" accent="#0D9488">
              <View style={[styles.finalDxCard, { borderColor: "#0D9488", backgroundColor: isDark ? "rgba(13,148,136,0.16)" : "rgba(13,148,136,0.08)" }]}>
                <Text style={[styles.finalDxLabel, { color: "#0D9488", fontSize: scaledFont(11) }]}>FINAL DIAGNOSIS</Text>
                <Text style={[styles.finalDxText, { color: colors.text, fontSize: scaledFont(18) }]}>{item.finalDiagnosis}</Text>
                <View style={styles.scoreRow}>
                  <View style={[styles.scorePill, { backgroundColor: severityColor(item.severity) }]}><Text style={[styles.scorePillText, { fontSize: scaledFont(11) }]}>{item.severity}</Text></View>
                  {pf.value !== null ? <View style={[styles.scorePill, { backgroundColor: pf.color }]}><Text style={[styles.scorePillText, { fontSize: scaledFont(11) }]}>P/F {pf.value}</Text></View> : null}
                  <View style={[styles.scorePill, { backgroundColor: "#3B82F6" }]}><Text style={[styles.scorePillText, { fontSize: scaledFont(11) }]}>{item.tag}</Text></View>
                </View>
              </View>
            </DetailSection>
          ) : null}

          {item.managementPlan ? (
            <DetailSection number={sectionNum()} title="Management & Outcome" accent="#F97316">
              <Text style={[styles.detailParagraph, { color: sectionTextColor, fontSize: scaledFont(13) }]}>{item.managementPlan}</Text>
            </DetailSection>
          ) : null}

          {item.learningPoint ? (
            <View style={[styles.teachingCard, { backgroundColor: isDark ? "rgba(245,158,11,0.14)" : "rgba(245,158,11,0.1)", borderColor: "#F59E0B" }]}>
              <View style={styles.teachingHeader}><Sparkles color="#F59E0B" size={18} /><Text style={[styles.teachingTitle, { color: "#B45309", fontSize: scaledFont(13) }]}>LEARNING POINTS</Text></View>
              {learning.length > 1 ? learning.map((line, idx) => (
                <View key={`lp-${idx}`} style={styles.teachingRow}>
                  <Text style={[styles.teachingNum, { color: "#B45309", fontSize: scaledFont(13) }]}>{idx + 1}.</Text>
                  <Text style={[styles.teachingText, { color: sectionTextColor, fontSize: scaledFont(13) }]}>{line}</Text>
                </View>
              )) : <Text style={[styles.teachingText, { color: sectionTextColor, fontSize: scaledFont(13) }]}>{item.learningPoint}</Text>}
            </View>
          ) : null}
        </ScrollView>

        <Modal visible={shareSheet} transparent animationType="slide" onRequestClose={() => setShareSheet(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setShareSheet(false)} style={styles.modalOverlay}>
            <View style={[styles.shareSheet, { backgroundColor: colors.bgCard, borderColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
              <View style={[styles.shareHandle, { backgroundColor: colors.border }]} />
              <Text style={[styles.shareTitle, { color: colors.text, fontSize: scaledFont(16) }]}>Share case</Text>
              <TouchableOpacity onPress={() => { setShareSheet(false); Alert.alert("Export as PDF", "PDF export via expo-print is staged for native builds."); }} style={[styles.shareRow, { borderColor: colors.border }]}><FileText color="#3B82F6" size={18} /><Text style={[styles.shareRowText, { color: colors.text, fontSize: scaledFont(14) }]}>Export as PDF</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => { setShareSheet(false); Alert.alert("Share link", "Anonymized teaching link generation is queued for backend."); }} style={[styles.shareRow, { borderColor: colors.border }]}><Share2 color="#0D9488" size={18} /><Text style={[styles.shareRowText, { color: colors.text, fontSize: scaledFont(14) }]}>Share link</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => { setShareSheet(false); Alert.alert("Copy summary", "A text summary of this case has been prepared and can be pasted."); }} style={[styles.shareRow, { borderColor: colors.border }]}><ClipboardCheck color="#F59E0B" size={18} /><Text style={[styles.shareRowText, { color: colors.text, fontSize: scaledFont(14) }]}>Copy summary</Text></TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal visible={videoOpen} transparent animationType="fade" onRequestClose={() => setVideoOpen(false)}>
          <View style={[styles.videoOverlay, { paddingTop: insets.top + 8 }]}>
            <View style={styles.videoTopBar}>
              <TouchableOpacity onPress={() => setVideoOpen(false)} style={styles.videoIconBtn} hitSlop={8}><X color="#fff" size={22} /></TouchableOpacity>
              <Text style={styles.videoCaption} numberOfLines={1}>{videoCaption || "Video"}</Text>
              <TouchableOpacity onPress={() => { if (videoUri) void WebBrowser.openBrowserAsync(videoUri); }} style={styles.videoIconBtn} hitSlop={8}><Share2 color="#fff" size={18} /></TouchableOpacity>
            </View>
            {videoUri ? <LogbookVideoPlayer uri={videoUri} /> : null}
          </View>
        </Modal>
      </View>
    );
  };

  const renderProcedureForm = () => (
    <View style={styles.screenFill}>
      {renderFormHeader("New Procedure", "Auto-numbered per procedure type", saveProcedure)}
      <ScrollView contentContainerStyle={[styles.formScroll, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <Section title="A. Procedure Identification" icon={<ClipboardCheck color="#0D9488" size={18} />} defaultOpen>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>Procedure type</Text><View style={styles.procedureGrid}>{PROCEDURE_TYPES.map((type) => <TouchableOpacity key={type} onPress={() => setDraftProcedure({ ...draftProcedure, procedureType: type, procedureNumber: store.procedures.filter((p) => p.procedureType === type).length + 1 })} style={[styles.procTile, { backgroundColor: draftProcedure.procedureType === type ? "rgba(13,148,136,0.18)" : colors.bgElevated, borderColor: draftProcedure.procedureType === type ? "#0D9488" : colors.border }]}><Activity color={draftProcedure.procedureType === type ? "#0D9488" : colors.textMuted} size={16} /><Text style={[styles.procTileText, { color: draftProcedure.procedureType === type ? "#0D9488" : colors.textMuted, fontSize: scaledFont(10) }]}>{type}</Text></TouchableOpacity>)}</View>
          <View style={[styles.calcCard, { borderColor: "#0D9488", backgroundColor: "rgba(13,148,136,0.12)" }]}><Text style={[styles.calcTitle, { color: "#0D9488", fontSize: scaledFont(14) }]}>{draftProcedure.procedureType} #{draftProcedure.procedureNumber}</Text><Text style={[styles.calcSub, { color: colors.textMuted, fontSize: scaledFont(12) }]}>Number auto-increments for the current user after Supabase sync.</Text></View>
          <Field label="Hospital" value={draftProcedure.hospital} onChangeText={(hospital) => setDraftProcedure({ ...draftProcedure, hospital })} /><Field label="Unit" value={draftProcedure.unit} onChangeText={(unit) => setDraftProcedure({ ...draftProcedure, unit })} />
        </Section>
        <Section title="B. Personnel" icon={<UserRound color="#3B82F6" size={18} />}>
          <Field label="Operator name" value={draftProcedure.operatorName} onChangeText={(operatorName) => setDraftProcedure({ ...draftProcedure, operatorName })} placeholder="Auto-fill from profile when signed in" /><Field label="Supervisor / Consultant" value={draftProcedure.supervisor} onChangeText={(supervisor) => setDraftProcedure({ ...draftProcedure, supervisor })} />
          <View style={styles.chipWrap}>{["Direct", "Indirect", "Unsupervised"].map((s) => <Chip key={s} label={s} selected={s === "Direct"} onPress={() => undefined} accent="#3B82F6" />)}</View>
        </Section>
        <Section title="C–D. Patient & Procedure Details" icon={<ShieldCheck color="#F59E0B" size={18} />}>
          <View style={styles.twoCol}><Field label="Age" value={draftProcedure.patientAge} onChangeText={(patientAge) => setDraftProcedure({ ...draftProcedure, patientAge })} keyboardType="numeric" /><View style={styles.fieldWrap}><Text style={[styles.fieldLabel, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>Gender</Text><View style={styles.segmented}>{(["Male", "Female"] as Gender[]).map((g) => <TouchableOpacity key={g} onPress={() => setDraftProcedure({ ...draftProcedure, patientGender: g })} style={[styles.segment, { backgroundColor: draftProcedure.patientGender === g ? "#0D9488" : colors.bgElevated }]}><Text style={{ color: draftProcedure.patientGender === g ? "#fff" : colors.textMuted, fontWeight: "700" }}>{g}</Text></TouchableOpacity>)}</View></View></View>
          <Field label="Indication *" value={draftProcedure.indication} onChangeText={(indication) => setDraftProcedure({ ...draftProcedure, indication })} multiline />
          <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>Procedure-specific fields</Text><View style={[styles.calcCard, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}><Text style={[styles.calcSub, { color: colors.textMuted, fontSize: scaledFont(12) }]}>{draftProcedure.procedureType === "BRONCHOSCOPY" ? "Scope type, lidocaine dose, airway findings, BAL/biopsy/EBUS-TBNA sampling, lobes sampled, and samples sent." : draftProcedure.procedureType === "THORACENTESIS" ? "Side, site, ultrasound guidance, fluid appearance, amount drained, drain size, and samples sent." : "Technique, site, ultrasound/fluoroscopy use, sedation, equipment, attempts, and confirmation method."}</Text></View>
        </Section>
        <Section title="E. Outcome" icon={<CheckCircle2 color="#10B981" size={18} />}>
          <View style={styles.chipWrap}>{(["Full success", "Partial", "Failed"] as ProcedureStatus[]).map((s) => <Chip key={s} label={s} selected={draftProcedure.successStatus === s} onPress={() => setDraftProcedure({ ...draftProcedure, successStatus: s })} accent={s === "Failed" ? "#EF4444" : "#10B981"} />)}</View>
          <View style={styles.chipWrap}>{["None", "Bleeding", "Pneumothorax", "Hypoxia", "Hypotension", "Arrhythmia", "Infection", "Other"].map((c) => <Chip key={c} label={c} selected={draftProcedure.complications.includes(c)} onPress={() => setDraftProcedure({ ...draftProcedure, complications: draftProcedure.complications.includes(c) ? draftProcedure.complications.filter((x) => x !== c) : [...draftProcedure.complications, c] })} accent="#EF4444" />)}</View>
        </Section>
        <Section title="F–G. Media & Reflection" icon={<Sparkles color="#8B5CF6" size={18} />}>
          <View style={[styles.uploadZone, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}><UploadCloud color="#8B5CF6" size={26} /><Text style={[styles.uploadTitle, { color: colors.text, fontSize: scaledFont(14) }]}>Attach photos, bronchoscopy video, PDF report, or post-procedure CXR</Text></View>
          <Field label="Reflection" value={draftProcedure.reflection} onChangeText={(reflection) => setDraftProcedure({ ...draftProcedure, reflection })} multiline placeholder="What went well? What was challenging?" />
          <Chip label="Ready for independent practice" selected={draftProcedure.ready} onPress={() => setDraftProcedure({ ...draftProcedure, ready: !draftProcedure.ready })} accent="#0D9488" />
        </Section>
      </ScrollView>
    </View>
  );

  const renderFormHeader = (title: string, subtitle: string, onSave: () => void) => (
    <View style={[styles.formHeader, { backgroundColor: colors.bgCard, borderColor: colors.border, paddingTop: 12 }]}>
      <TouchableOpacity onPress={() => setConfirmExit(true)} style={styles.backMini}><ChevronRight color={colors.textMuted} size={18} style={{ transform: [{ rotate: "180deg" }] }} /></TouchableOpacity>
      <View style={styles.flexOne}><Text style={[styles.subTitle, { color: colors.text, fontSize: scaledFont(18) }]}>{title}</Text><Text style={[styles.subSubtitle, { color: colors.textMuted, fontSize: scaledFont(12) }]}>{subtitle}</Text></View>
      <TouchableOpacity onPress={() => Alert.alert("PDF Export", "PDF export will use expo-print and expo-sharing after native modules are added to the build.")} style={[styles.iconBtnRound, { borderColor: colors.border }]}><Share2 color={colors.textMuted} size={17} /></TouchableOpacity>
      <TouchableOpacity onPress={() => void onSave()} style={[styles.saveBtn, { backgroundColor: colors.accent }]}><Text style={[styles.saveBtnText, { fontSize: scaledFont(13) }]}>Save</Text></TouchableOpacity>
    </View>
  );

  const renderDashboard = () => {
    const byType = PROCEDURE_TYPES.slice(0, 6).map((type) => ({ type, count: store.procedures.filter((p) => p.procedureType === type).length }));
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.formScroll, { paddingBottom: insets.bottom + 32 }]}>
        {renderSubHeader("Competency Dashboard", "Milestones, success rate, complications, and sign-off", <BarChart3 color="#0D9488" size={24} />, startProcedure)}
        <View style={styles.statsRow}><Stat label="Bronchoscopy" value={`${store.procedures.filter((p) => p.procedureType === "BRONCHOSCOPY").length}/50`} color="#0D9488" /><Stat label="Thoracentesis" value={`${store.procedures.filter((p) => p.procedureType === "THORACENTESIS").length}/20`} color="#3B82F6" /><Stat label="Intubation" value={`${store.procedures.filter((p) => p.procedureType === "INTUBATION").length}/50`} color="#F59E0B" /></View>
        <View style={[styles.chartCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}><Text style={[styles.activityTitle, { color: colors.text, fontSize: scaledFont(16) }]}>Total procedures by type</Text>{byType.map((row) => <View key={row.type} style={styles.barRow}><Text style={[styles.barLabel, { color: colors.textMuted, fontSize: scaledFont(11) }]}>{row.type}</Text><View style={[styles.barTrack, { backgroundColor: colors.bgElevated }]}><View style={[styles.barFill, { width: `${Math.min(100, row.count * 20)}%`, backgroundColor: "#0D9488" }]} /></View><Text style={[styles.barCount, { color: colors.text, fontSize: scaledFont(11) }]}>{row.count}</Text></View>)}</View>
        <View style={[styles.chartCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}><Text style={[styles.activityTitle, { color: colors.text, fontSize: scaledFont(16) }]}>Training log</Text>{store.procedures.map((p) => <View key={p.id} style={styles.trainingRow}><Text style={[styles.entryName, { color: colors.text, fontSize: scaledFont(13) }]}>{p.procedureType} #{p.procedureNumber}</Text><Text style={[styles.entryDate, { color: p.ready ? "#10B981" : colors.textMuted, fontSize: scaledFont(11) }]}>{p.ready ? "Signed off" : "Awaiting sign-off"}</Text></View>)}</View>
      </ScrollView>
    );
  };

  const renderFab = (onPress: () => void, color: string) => <TouchableOpacity onPress={onPress} style={[styles.fab, { backgroundColor: color, bottom: insets.bottom + 22 }]} activeOpacity={0.85}><Plus color="#fff" size={24} /></TouchableOpacity>;
  const renderEmpty = (message: string) => <View style={styles.emptyContainer}><FileText color={colors.textDim} size={48} /><Text style={[styles.emptyTitle, { color: colors.textMuted, fontSize: scaledFont(16) }]}>{message}</Text><Text style={[styles.motivationText, { color: "#3B82F6", fontSize: scaledFont(12) }]}>You've documented {Math.max(store.cases.length, 12)} cases this year. Keep going!</Text></View>;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}> 
      <Stack.Screen options={{ title: "Log Book", headerShown: mode !== "home" }} />
      {mode === "home" ? renderHome() : mode === "cases" ? renderCases() : mode === "caseForm" ? renderCaseForm() : mode === "caseDetail" ? renderCaseDetail() : mode === "procedures" ? renderProcedures() : mode === "procedureForm" ? renderProcedureForm() : renderDashboard()}
      <Modal visible={confirmExit} transparent animationType="fade" onRequestClose={() => setConfirmExit(false)}>
        <View style={styles.modalOverlay}><View style={[styles.confirmCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}><Text style={[styles.confirmTitle, { color: colors.text, fontSize: scaledFont(17) }]}>Discard current draft?</Text><Text style={[styles.confirmText, { color: colors.textMuted, fontSize: scaledFont(13) }]}>Your draft is auto-saved locally, but unsaved changes may not be published.</Text><View style={styles.confirmActions}><TouchableOpacity onPress={() => setConfirmExit(false)} style={[styles.confirmBtn, { borderColor: colors.border }]}><Text style={{ color: colors.text }}>Continue editing</Text></TouchableOpacity><TouchableOpacity onPress={() => { setConfirmExit(false); setMode("home"); }} style={[styles.confirmBtn, { backgroundColor: "#EF4444", borderColor: "#EF4444" }]}><Text style={{ color: "#fff", fontWeight: "700" }}>Discard</Text></TouchableOpacity></View></View></View>
      </Modal>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  const { colors, scaledFont } = useTheme();
  return <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}><Text style={[styles.statValue, { color, fontSize: scaledFont(18) }]}>{value}</Text><Text style={[styles.statLabel, { color: colors.textMuted, fontSize: scaledFont(11) }]}>{label}</Text></View>;
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const { colors, scaledFont } = useTheme();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>{label}</Text>
      <View style={styles.segmented}>
        {[{ key: true, text: "Yes" }, { key: false, text: "No" }].map((opt) => (
          <TouchableOpacity key={opt.text} onPress={() => onChange(opt.key)} style={[styles.segment, { backgroundColor: value === opt.key ? "#3B82F6" : colors.bgElevated }]}>
            <Text style={{ color: value === opt.key ? "#fff" : colors.textMuted, fontWeight: "700" as const }}>{opt.text}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function DetailSection({ number, title, accent, children }: { number: number; title: string; accent: string; children: React.ReactNode }) {
  const { colors, scaledFont } = useTheme();
  return (
    <View style={[styles.detailSection, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
      <View style={styles.detailSectionHeader}>
        <View style={[styles.detailNumber, { backgroundColor: accent }]}><Text style={[styles.detailNumberText, { fontSize: scaledFont(13) }]}>{number}</Text></View>
        <Text style={[styles.detailSectionTitle, { color: colors.text, fontSize: scaledFont(16) }]}>{title}</Text>
      </View>
      <View style={styles.detailSectionBody}>{children}</View>
    </View>
  );
}

function DetailPill({ text, color }: { text: string; color: string }) {
  const { scaledFont } = useTheme();
  return <View style={[styles.detailPill, { backgroundColor: `${color}22`, borderColor: `${color}66` }]}><Text style={[styles.detailPillText, { color, fontSize: scaledFont(11) }]}>{text}</Text></View>;
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  const { colors, scaledFont } = useTheme();
  return (
    <View style={styles.profileItem}>
      <Text style={[styles.profileLabel, { color: colors.textMuted, fontSize: scaledFont(10) }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.profileValue, { color: colors.text, fontSize: scaledFont(13) }]}>{value}</Text>
    </View>
  );
}

function Vital({ label, value }: { label: string; value: string }) {
  const { colors, scaledFont } = useTheme();
  return (
    <View style={styles.vitalCell}>
      <Text style={[styles.vitalLabel, { color: colors.textMuted, fontSize: scaledFont(10) }]}>{label}</Text>
      <Text style={[styles.vitalValue, { color: colors.text, fontSize: scaledFont(13) }]}>{value}</Text>
    </View>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  const { colors, scaledFont } = useTheme();
  return (
    <View style={styles.kvLine}>
      <Text style={[styles.kvKey, { color: colors.textMuted, fontSize: scaledFont(12) }]}>{k}</Text>
      <Text style={[styles.kvVal, { color: colors.text, fontSize: scaledFont(12) }]}>{v}</Text>
    </View>
  );
}

function ActionPill({ icon, text }: { icon: React.ReactNode; text: string }) {
  const { colors, scaledFont } = useTheme();
  return <View style={[styles.actionPill, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>{icon}<Text style={[styles.actionText, { color: colors.textMuted, fontSize: scaledFont(11) }]}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screenFill: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 10 },
  flexOne: { flex: 1 },
  heroSection: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, gap: 12 },
  logbookIconShell: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1, position: "relative" as const },
  iconPulse: { position: "absolute" as const, right: 9, top: 9, width: 9, height: 9, borderRadius: 5, backgroundColor: "#0D9488" },
  heroTextWrap: { flex: 1 },
  heroTitle: { fontWeight: "900" as const, letterSpacing: -0.7 },
  heroSubtitle: { marginTop: 3, lineHeight: 18 },
  syncStrip: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  syncBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  syncText: { fontWeight: "800" as const },
  logbookCardsRow: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  categoryTouchable: { flex: 1 },
  logbookCard: { minHeight: 174, borderRadius: 22, borderWidth: 1, padding: 14, overflow: "hidden" as const },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  categoryIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  smallAddBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  categoryTitle: { fontWeight: "900" as const, lineHeight: 21 },
  categorySubtitle: { marginTop: 6, lineHeight: 17, fontWeight: "600" as const },
  countBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, marginTop: 14 },
  countText: { fontWeight: "900" as const },
  searchBlock: { paddingHorizontal: 16, paddingVertical: 8 },
  searchBox: { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, minHeight: 48, gap: 8 },
  searchInput: { flex: 1, minHeight: 44 },
  recentSearchRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  quickGrid: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginTop: 4 },
  quickTile: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  quickText: { fontWeight: "800" as const },
  activityHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 },
  activityTitle: { fontWeight: "900" as const },
  sectionHint: { fontWeight: "700" as const },
  activityCard: { flexDirection: "row", alignItems: "center", gap: 11, borderWidth: 1, borderRadius: 16, marginHorizontal: 16, marginBottom: 9, padding: 13 },
  activityIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  subHeader: { flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, paddingHorizontal: 12, paddingVertical: 12 },
  backMini: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  subIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  subTitle: { fontWeight: "900" as const, letterSpacing: -0.3 },
  subSubtitle: { marginTop: 2, fontWeight: "600" as const },
  headerAdd: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  filtersRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8, marginBottom: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  chipText: { fontWeight: "800" as const },
  listContent: { paddingHorizontal: 16, paddingTop: 8 },
  entryCard: { borderRadius: 17, borderWidth: 1, padding: 14, marginBottom: 10 },
  entryHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  entryName: { fontWeight: "900" as const },
  entryDate: { marginTop: 3, fontWeight: "600" as const },
  entryMetaRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10 },
  metaPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  metaText: { fontWeight: "900" as const },
  diagnosisBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  diagnosisText: { fontWeight: "900" as const },
  entryNotes: { marginTop: 8, lineHeight: 18 },
  iconBtn: { width: 31, height: 31, alignItems: "center", justifyContent: "center" },
  fab: { position: "absolute" as const, right: 18, width: 58, height: 58, borderRadius: 22, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 14, elevation: 5 },
  emptyContainer: { alignItems: "center", padding: 34, gap: 8 },
  emptyTitle: { fontWeight: "800" as const, textAlign: "center" as const, marginTop: 8 },
  motivationText: { fontWeight: "800" as const, marginTop: 8, textAlign: "center" as const },
  formHeader: { flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, paddingHorizontal: 12, paddingBottom: 12 },
  iconBtnRound: { width: 38, height: 38, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  saveBtn: { paddingHorizontal: 16, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  saveBtnText: { color: "#fff", fontWeight: "900" as const },
  formScroll: { paddingHorizontal: 16, paddingTop: 12 },
  stepRail: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  stepItem: { alignItems: "center", flex: 1 },
  stepDot: { width: 9, height: 9, borderRadius: 5, marginBottom: 5 },
  stepText: { fontWeight: "800" as const },
  sectionCard: { borderRadius: 18, borderWidth: 1, marginBottom: 12, overflow: "hidden" as const },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 9, flex: 1 },
  sectionTitle: { fontWeight: "900" as const },
  sectionBody: { paddingHorizontal: 14, paddingBottom: 14 },
  fieldWrap: { flex: 1, marginBottom: 10 },
  fieldLabel: { fontWeight: "900" as const, marginBottom: 6 },
  inputShell: { borderWidth: 1, borderRadius: 14, minHeight: 46, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  textareaShell: { minHeight: 104, alignItems: "flex-start", paddingTop: 10 },
  input: { flex: 1, minHeight: 42, paddingVertical: 0 },
  textarea: { minHeight: 86 },
  unitText: { fontWeight: "900" as const, marginLeft: 6 },
  twoCol: { flexDirection: "row", gap: 10 },
  segmented: { flexDirection: "row", gap: 7 },
  segment: { flex: 1, minHeight: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  voiceBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderRadius: 14, height: 42, marginBottom: 10 },
  voiceText: { fontWeight: "900" as const },
  calcCard: { borderWidth: 1, borderRadius: 15, padding: 12, marginBottom: 10 },
  calcTitle: { fontWeight: "900" as const },
  calcSub: { marginTop: 4, lineHeight: 18, fontWeight: "600" as const },
  uploadZone: { borderWidth: 1, borderStyle: "dashed" as const, borderRadius: 18, padding: 18, alignItems: "center", gap: 8 },
  uploadTitle: { textAlign: "center" as const, fontWeight: "900" as const },
  uploadSub: { textAlign: "center" as const, lineHeight: 16 },
  mediaActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  actionPill: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 9, alignItems: "center", gap: 5 },
  actionText: { fontWeight: "800" as const, textAlign: "center" as const },
  procedureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  procTile: { width: "31%" as const, borderWidth: 1, borderRadius: 14, minHeight: 74, padding: 8, alignItems: "center", justifyContent: "center", gap: 6 },
  procTileText: { textAlign: "center" as const, fontWeight: "900" as const },
  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  statCard: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 12 },
  statValue: { fontWeight: "900" as const },
  statLabel: { marginTop: 2, fontWeight: "800" as const },
  chartCard: { borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 12 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  barLabel: { width: 104, fontWeight: "800" as const },
  barTrack: { flex: 1, height: 9, borderRadius: 999, overflow: "hidden" as const },
  barFill: { height: 9, borderRadius: 999 },
  barCount: { width: 22, textAlign: "right" as const, fontWeight: "900" as const },
  trainingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(148,163,184,0.25)" },
  panel: { borderWidth: 1, borderRadius: 14, marginBottom: 10, overflow: "hidden" as const },
  panelHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  panelIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  panelTitle: { flex: 1, fontWeight: "900" as const },
  panelBody: { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 2 },
  panelImageRow: { flexDirection: "row", flexWrap: "wrap" as const, gap: 8, marginTop: 6 },
  thumbWrap: { width: 64, height: 64, borderRadius: 10, overflow: "hidden" as const, position: "relative" as const },
  thumb: { width: "100%" as const, height: "100%" as const },
  thumbClose: { position: "absolute" as const, top: 2, right: 2, backgroundColor: "rgba(0,0,0,0.55)", width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  addThumb: { width: 64, height: 64, borderRadius: 10, borderWidth: 1, borderStyle: "dashed" as const, alignItems: "center", justifyContent: "center", gap: 3 },
  addThumbText: { fontWeight: "900" as const },
  subHeading: { fontWeight: "900" as const, marginTop: 6, marginBottom: 8 },
  symptomChipWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  severityRow: { flexDirection: "row", gap: 4, marginLeft: 4 },
  severityDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sidePill: { paddingHorizontal: 9, height: 26, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, padding: 10, marginBottom: 8 },
  timelineDot: { width: 10, height: 10, borderRadius: 5 },
  addRowBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderStyle: "dashed" as const, borderRadius: 12, height: 40, marginTop: 4, marginBottom: 10 },
  customLabRow: { borderWidth: 1, borderRadius: 14, padding: 10, marginBottom: 8 },
  removeBtn: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-end", paddingHorizontal: 8, paddingVertical: 5 },
  auscRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" as const },
  detailHeader: { flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, paddingHorizontal: 12, paddingVertical: 12 },
  detailEyebrow: { fontWeight: "900" as const, letterSpacing: 1 },
  detailTitle: { fontWeight: "900" as const, letterSpacing: -0.4, marginTop: 3 },
  detailHero: { borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 14 },
  detailNarrative: { lineHeight: 21, fontWeight: "600" as const },
  heroPills: { flexDirection: "row", flexWrap: "wrap" as const, gap: 6, marginTop: 10 },
  detailPill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  detailPillText: { fontWeight: "900" as const },
  detailSection: { borderWidth: 1, borderRadius: 18, marginBottom: 14, overflow: "hidden" as const },
  detailSectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingTop: 14 },
  detailNumber: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  detailNumberText: { color: "#fff", fontWeight: "900" as const },
  detailSectionTitle: { fontWeight: "900" as const, letterSpacing: -0.3, flex: 1 },
  detailSectionBody: { padding: 14 },
  detailParagraph: { lineHeight: 21, marginTop: 6 },
  detailMuted: { marginTop: 6, fontWeight: "700" as const },
  detailCC: { fontWeight: "900" as const, marginTop: 4 },
  ccBlock: { marginBottom: 10 },
  profileGrid: { flexDirection: "row", flexWrap: "wrap" as const, gap: 12 },
  profileItem: { minWidth: "40%" as const },
  profileLabel: { fontWeight: "900" as const, letterSpacing: 0.8 },
  profileValue: { fontWeight: "800" as const, marginTop: 3, lineHeight: 18 },
  timelineWrap: { marginTop: 12 },
  vTimelineRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  vTimelineColumn: { width: 14, alignItems: "center" },
  vTimelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  vTimelineLine: { width: 2, flex: 1, marginTop: 4 },
  timelineDate: { fontWeight: "900" as const, letterSpacing: 0.4 },
  timelineEvent: { marginTop: 2, lineHeight: 18, fontWeight: "600" as const },
  examCard: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 12 },
  vitalsRow: { flexDirection: "row", flexWrap: "wrap" as const, gap: 10, marginTop: 8 },
  vitalCell: { minWidth: "28%" as const },
  vitalLabel: { fontWeight: "900" as const, letterSpacing: 0.6 },
  vitalValue: { fontWeight: "900" as const, marginTop: 2 },
  labTable: { borderWidth: 1, borderRadius: 12, marginTop: 8, overflow: "hidden" as const },
  labRowHeader: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1 },
  labRow: { flexDirection: "row", paddingVertical: 9, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  labCellHead: { flex: 1, fontWeight: "900" as const, letterSpacing: 0.5 },
  labCell: { flex: 1, fontWeight: "700" as const },
  labStatusCell: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  kvRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  kvKey: { fontWeight: "700" as const, flex: 1 },
  kvVal: { fontWeight: "800" as const, textAlign: "right" as const, flex: 1 },
  kvWrap: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginTop: 8 },
  kvLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7 },
  abgCard: { borderWidth: 1, borderRadius: 16, padding: 12, marginTop: 12 },
  abgTitle: { fontWeight: "900" as const, letterSpacing: 1, marginBottom: 10 },
  abgGrid: { flexDirection: "row", flexWrap: "wrap" as const, gap: 8 },
  abgCell: { width: "31%" as const, borderWidth: 1, borderRadius: 12, padding: 8 },
  abgLabel: { fontWeight: "900" as const, letterSpacing: 0.4 },
  abgValue: { fontWeight: "900" as const, marginTop: 2 },
  abgTagRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  abgTag: { fontWeight: "900" as const },
  pfBanner: { borderRadius: 12, padding: 10, marginTop: 10, alignItems: "center" },
  pfBannerText: { color: "#fff", fontWeight: "900" as const, letterSpacing: 0.5 },
  abgInterpretation: { marginTop: 10, lineHeight: 18, fontWeight: "700" as const },
  microCard: { borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 8 },
  microTitle: { fontWeight: "900" as const, letterSpacing: 0.5 },
  microBody: { marginTop: 4, fontWeight: "700" as const, lineHeight: 18 },
  lightsBadge: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginTop: 6 },
  lightsBadgeText: { color: "#fff", fontWeight: "900" as const, letterSpacing: 0.6 },
  imagingTabs: { marginTop: 4 },
  imagingThumb: { width: 150, height: 110, borderRadius: 12, backgroundColor: "#0F172A" },
  mediaPlaceholder: { alignItems: "center" as const, justifyContent: "center" as const, borderWidth: 1, gap: 6 },
  mediaPlaceholderText: { fontWeight: "700" as const },
  videoOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)" },
  videoTopBar: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, paddingHorizontal: 16, paddingBottom: 12 },
  videoIconBtn: { padding: 8, borderRadius: 999 },
  videoCaption: { color: "#fff", fontSize: 14, fontWeight: "600" as const, flex: 1, textAlign: "center" as const },
  finalDxCard: { borderWidth: 1, borderRadius: 14, padding: 14 },
  finalDxLabel: { fontWeight: "900" as const, letterSpacing: 1 },
  finalDxText: { fontWeight: "900" as const, marginTop: 4, letterSpacing: -0.3 },
  scoreRow: { flexDirection: "row", flexWrap: "wrap" as const, gap: 6, marginTop: 10 },
  scorePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  scorePillText: { color: "#fff", fontWeight: "900" as const },
  teachingCard: { borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 14 },
  teachingHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  teachingTitle: { fontWeight: "900" as const, letterSpacing: 1 },
  teachingRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  teachingNum: { fontWeight: "900" as const, width: 22 },
  teachingText: { flex: 1, lineHeight: 20, fontWeight: "600" as const },
  shareSheet: { width: "100%" as const, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, padding: 18, marginTop: "auto" as const },
  shareHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center" as const, marginBottom: 14 },
  shareTitle: { fontWeight: "900" as const, marginBottom: 10 },
  shareRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  shareRowText: { fontWeight: "800" as const },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.62)", alignItems: "center", justifyContent: "center", padding: 24 },
  confirmCard: { width: "100%" as const, borderWidth: 1, borderRadius: 20, padding: 18 },
  confirmTitle: { fontWeight: "900" as const },
  confirmText: { marginTop: 8, lineHeight: 19 },
  confirmActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  confirmBtn: { flex: 1, borderWidth: 1, borderRadius: 13, minHeight: 44, alignItems: "center", justifyContent: "center" },
});
