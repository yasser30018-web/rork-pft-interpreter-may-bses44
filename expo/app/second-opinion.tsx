import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
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
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import { VideoView, useVideoPlayer } from "expo-video";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  Activity,
  ArrowLeft,
  BookMarked,
  Bookmark,
  BookmarkCheck,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  Download,
  Edit3,
  Eye,
  FileText,
  Filter,
  Gauge,
  HeartPulse,
  Image as ImageIcon,
  Lock,
  MessageCircle,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Send,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  ThumbsUp,
  Trash2,
  TrendingDown,
  TrendingUp,
  UploadCloud,
  UserPlus,
  UserRound,
  Users,
  Video,
  X,
} from "lucide-react-native";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import {
  createCase,
  updateCase,
  deleteCase as deleteCaseApi,
  deleteComment,
  fetchCaseById,
  fetchComments,
  fetchPrivateInvitedCases,
  fetchPublicCases,
  incrementViewCount,
  isBookmarked,
  matchContactsByPhone,
  postComment,
  searchUsers,
  subscribeToComments,
  toggleBookmark,
  toggleHelpful,
  updateCaseStatus,
  uploadSecondOpinionMedia,
  type CaseStatus,
  type CaseVisibility,
  type PublicUserLite,
  type SecondOpinionCase,
  type SecondOpinionComment,
} from "@/utils/secondOpinionApi";

type Mode = "feed" | "create" | "detail";
type FeedFilter = "all" | "open" | "resolved" | "mine" | "saved";

const PURPLE = "#8B5CF6";
const PURPLE_DEEP = "#7C3AED";

const SYMPTOM_OPTIONS = ["Dyspnea", "Cough", "Hemoptysis", "Fever", "Weight loss", "Chest pain", "Wheeze", "Pleuritic pain"];
const COMORBIDITY_OPTIONS = ["HTN", "DM", "IHD", "CKD", "Malignancy", "Immunosuppressed", "HIV", "CTD"];
const SMOKING_OPTIONS = ["Non-smoker", "Ex-smoker", "Active smoker"] as const;
const DURATION_UNITS = ["days", "weeks", "months"] as const;
const O2_DEVICES = ["Room air", "Nasal cannula", "Venturi", "NRBM", "HFNO", "NIV", "Intubated"] as const;
const OCCUPATION_SUGGESTIONS = ["Farmer", "Construction", "Healthcare", "Mining", "Asbestos exposure", "Bird keeping", "Chemical exposure"];
const FULL_COMORBIDITIES = ["HTN", "DM", "IHD", "CKD", "Malignancy", "Immunosuppressed", "Post-transplant", "HIV", "Connective tissue disease"];
const SEROLOGY_TESTS = ["Legionella antigen", "Pneumococcal antigen", "Beta-glucan", "Galactomannan", "HIV", "COVID"];
const CULTURE_SOURCES = ["Blood", "Sputum", "BAL", "Pleural fluid"];

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type DraftGender = "Male" | "Female";
type SmokingStatus = (typeof SMOKING_OPTIONS)[number];
type DurationUnit = (typeof DURATION_UNITS)[number];
type O2Device = (typeof O2_DEVICES)[number];
type PanelKey = "autoimmune" | "abg" | "micro" | "pft" | "ecg" | "echo" | "pleural" | "broncho" | "biopsy";

interface TimelineEntry { id: string; date: string; event: string }
interface CustomLab { id: string; name: string; value: string; unit: string; normalRange: string }
interface CultureEntry { id: string; source: string; organism: string; result: string }
interface SerologyEntry { id: string; test: string; result: string }

interface DraftCase {
  age: string;
  gender: DraftGender;
  nationality: string;
  smokingStatus: SmokingStatus;
  packYears: string;
  occupation: string;
  comorbidities: string[];
  comorbidityOther: string;
  ecog: 0 | 1 | 2 | 3 | 4;
  hospital: string;
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
  topDiagnosis: string;
  managementPlan: string;
  learningPoint: string;
}

type GeneralMediaItem = { uri: string; type: "image" | "video" | "pdf"; name?: string };

function localId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function emptyDraft(): DraftCase {
  return {
    age: "", gender: "Male", nationality: "", smokingStatus: "Non-smoker", packYears: "", occupation: "",
    comorbidities: [], comorbidityOther: "", ecog: 0, hospital: "",
    chiefComplaint: "", history: "", durationValue: "", durationUnit: "days", timeline: [],
    gcs: "", bp: "", hr: "", rr: "", spo2Air: "", spo2O2: "", o2Device: "Room air", briefExam: "", jvpElevated: false,
    wbc: "", hb: "", plt: "", crp: "", esr: "", pct: "", ldh: "", ferritin: "", dDimer: "",
    creatinine: "", egfr: "", alt: "", ast: "", bilirubin: "",
    autoimmunePanel: "", customLabs: [],
    ph: "", pao2: "", fio2: "0.21", hco3: "", paco2: "", spo2: "", lactate: "",
    cultures: [], gramStain: "", sensitivity: "", serology: [],
    pftSummary: "", ecgFindings: "", echoFindings: "",
    pleuralPh: "", pleuralGlucose: "", pleuralCells: "", pleuralProtein: "", serumProtein: "", pleuralLdh: "", serumLdh: "",
    bronchoscopyReport: "", biopsyResult: "", panelImages: {},
    finalDiagnosis: "", topDiagnosis: "", managementPlan: "", learningPoint: "",
  };
}

function toNum(v: string): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pfBadge(pao2: string, fio2: string): { value: number | null; label: string; color: string } {
  const p = toNum(pao2);
  const f = toNum(fio2);
  if (!p || !f) return { value: null, label: "Enter PaO2 + FiO2", color: "#64748B" };
  const value = Math.round(p / f);
  if (value > 400) return { value, label: "Normal oxygenation", color: "#10B981" };
  if (value >= 300) return { value, label: "Mild hypoxemia", color: "#F59E0B" };
  if (value >= 200) return { value, label: "Moderate ARDS range", color: "#F97316" };
  if (value >= 100) return { value, label: "Severe ARDS", color: "#EF4444" };
  return { value, label: "Critical hypoxemia", color: "#7F1D1D" };
}

function abgSuggestion(d: DraftCase): string {
  const ph = toNum(d.ph);
  const co2 = toNum(d.paco2);
  const hco3 = toNum(d.hco3);
  if (!ph || !co2 || !hco3) return "ABG interpretation appears once pH, PaCO2, and HCO3 are entered.";
  if (ph > 7.45 && co2 < 35) return "Likely respiratory alkalosis; correlate with hypoxemia, sepsis, PE, or pain/anxiety.";
  if (ph < 7.35 && co2 > 45) return "Respiratory acidosis pattern; assess ventilation, COPD, CNS depression, or fatigue.";
  if (ph < 7.35 && hco3 < 22) return "Metabolic acidosis pattern; calculate anion gap and lactate/renal contribution.";
  if (ph > 7.45 && hco3 > 26) return "Metabolic alkalosis pattern; review diuretics, vomiting, and chloride status.";
  return "Near-normal pH or mixed/compensated disorder; review full clinical context.";
}

function lightsCriteria(d: DraftCase): string {
  const pp = toNum(d.pleuralProtein);
  const sp = toNum(d.serumProtein);
  const pl = toNum(d.pleuralLdh);
  const sl = toNum(d.serumLdh);
  if (!pp || !sp || !pl || !sl) return "Enter pleural/serum protein and LDH to classify.";
  const exudate = pp / sp > 0.5 || pl / sl > 0.6;
  return exudate ? "Exudate by Light's criteria" : "Transudate by Light's criteria";
}

type LabKey = "wbc" | "hb" | "plt" | "crp" | "esr" | "pct" | "ldh" | "ferritin" | "d_dimer" | "creatinine" | "egfr" | "alt" | "ast" | "bilirubin";
type LabStatus = "high" | "low" | "normal";

const LAB_META: Record<LabKey, { label: string; unit: string; low: number; high: number }> = {
  wbc: { label: "WBC", unit: "×10⁹/L", low: 4, high: 11 },
  hb: { label: "Hb", unit: "g/dL", low: 12, high: 17 },
  plt: { label: "Plt", unit: "×10⁹/L", low: 150, high: 400 },
  crp: { label: "CRP", unit: "mg/L", low: 0, high: 5 },
  esr: { label: "ESR", unit: "mm/h", low: 0, high: 20 },
  pct: { label: "Procal", unit: "ng/mL", low: 0, high: 0.5 },
  ldh: { label: "LDH", unit: "U/L", low: 140, high: 280 },
  ferritin: { label: "Ferritin", unit: "ng/mL", low: 20, high: 300 },
  d_dimer: { label: "D-Dimer", unit: "µg/mL", low: 0, high: 0.5 },
  creatinine: { label: "Creatinine", unit: "mg/dL", low: 0.6, high: 1.3 },
  egfr: { label: "eGFR", unit: "mL/min", low: 90, high: 200 },
  alt: { label: "ALT", unit: "U/L", low: 0, high: 40 },
  ast: { label: "AST", unit: "U/L", low: 0, high: 40 },
  bilirubin: { label: "Bilirubin", unit: "mg/dL", low: 0.2, high: 1.2 },
};

function getLabStatus(key: LabKey, raw: string | number | undefined): LabStatus | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  const r = LAB_META[key];
  if (n > r.high) return "high";
  if (n < r.low) return "low";
  return "normal";
}

function labStatusColor(s: LabStatus | null): string {
  if (s === "high") return "#EF4444";
  if (s === "low") return "#F59E0B";
  if (s === "normal") return "#10B981";
  return "#94A3B8";
}

function abgInterpretation(d: { ph?: string; paco2?: string; hco3?: string }): string {
  const ph = toNum(d.ph ?? "");
  const co2 = toNum(d.paco2 ?? "");
  const hco3 = toNum(d.hco3 ?? "");
  if (!ph || !co2 || !hco3) return "";
  if (ph < 7.35 && co2 > 45) return "Acute respiratory acidosis";
  if (ph > 7.45 && co2 < 35) return "Respiratory alkalosis";
  if (ph < 7.35 && hco3 < 22) return "Metabolic acidosis";
  if (ph > 7.45 && hco3 > 26) return "Metabolic alkalosis";
  return "Compensated / mixed disorder";
}

function pfSeverity(pf: number | null): string {
  if (!pf) return "";
  if (pf > 400) return "Normal";
  if (pf >= 300) return "Mild hypoxemia";
  if (pf >= 200) return "Moderate ARDS";
  if (pf >= 100) return "Severe ARDS";
  return "Critical hypoxemia";
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} d ago`;
  return new Date(iso).toLocaleDateString();
}

function roleColor(role: string | undefined): string {
  if (!role) return "#94A3B8";
  if (role === "Consultant") return "#F59E0B";
  if (role === "Specialist") return "#3B82F6";
  if (role === "Fellow" || role === "Resident") return "#0D9488";
  return "#94A3B8";
}

function haptic(style: "light" | "medium" = "light") {
  if (Platform.OS !== "web") {
    void Haptics.impactAsync(style === "light" ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
  }
}

// ===== Stable, module-scoped components (must NOT be redefined inside the screen,
// otherwise TextInput loses focus after every keystroke) =====

type ThemeColors = {
  text: string;
  textSecondary: string;
  textMuted: string;
  textDim: string;
  border: string;
  bgCard: string;
  bgElevated: string;
  bg: string;
};

const Chip = React.memo(function Chip({
  label,
  active,
  onPress,
  colors,
  scaledFont,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ThemeColors;
  scaledFont: (n: number) => number;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.optChip,
        { backgroundColor: active ? `${PURPLE}26` : colors.bgElevated, borderColor: active ? PURPLE : colors.border },
      ]}
    >
      <Text style={[styles.optChipText, { color: active ? PURPLE : colors.textSecondary, fontSize: scaledFont(12) }]}>{label}</Text>
    </TouchableOpacity>
  );
});

const Field = React.memo(function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  maxLength,
  colors,
  scaledFont,
  minHeight,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric";
  multiline?: boolean;
  maxLength?: number;
  colors: ThemeColors;
  scaledFont: (n: number) => number;
  minHeight?: number;
}) {
  const isDarkLabel = colors.text;
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: isDarkLabel, fontSize: scaledFont(13), fontWeight: "700" as const }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
        keyboardType={keyboardType ?? "default"}
        multiline={multiline}
        maxLength={maxLength}
        textAlignVertical={multiline ? "top" : "center"}
        style={[
          styles.input,
          multiline && styles.inputMulti,
          { backgroundColor: colors.bgElevated, borderColor: colors.border, color: colors.text, fontSize: scaledFont(13) },
          minHeight ? { minHeight } : null,
        ]}
      />
    </View>
  );
});

const SectionCard = React.memo(function SectionCard({
  title,
  children,
  colors,
  scaledFont,
}: {
  title: string;
  children: React.ReactNode;
  colors: ThemeColors;
  scaledFont: (n: number) => number;
}) {
  return (
    <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <Text style={[styles.sectionCardTitle, { color: colors.text, fontSize: scaledFont(13) }]}>{title}</Text>
      {children}
    </View>
  );
});

const Stat = React.memo(function Stat({
  label,
  value,
  colors,
  scaledFont,
}: {
  label: string;
  value: string;
  colors: ThemeColors;
  scaledFont: (n: number) => number;
}) {
  return (
    <View style={[styles.statCell, { borderColor: colors.border }]}>
      <Text style={[styles.statLabel, { color: colors.textMuted, fontSize: scaledFont(10) }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.text, fontSize: scaledFont(13) }]}>{value}</Text>
    </View>
  );
});

const VitalCell = React.memo(function VitalCell({
  label, value, colors, scaledFont,
}: { label: string; value: string; colors: ThemeColors; scaledFont: (n: number) => number; }) {
  return (
    <View style={styles.vitalCell}>
      <Text style={[styles.vitalLabel, { color: colors.textMuted, fontSize: scaledFont(10) }]}>{label}</Text>
      <Text style={[styles.vitalValue, { color: colors.text, fontSize: scaledFont(13) }]}>{value}</Text>
    </View>
  );
});

const ABGCell = React.memo(function ABGCell({
  label, value, normal, colors, scaledFont,
}: { label: string; value: string; normal: boolean; colors: ThemeColors; scaledFont: (n: number) => number; }) {
  const color = normal ? "#10B981" : "#EF4444";
  return (
    <View style={[styles.abgCell, { borderColor: color, backgroundColor: `${color}10` }]}>
      <Text style={[styles.abgCellLabel, { color: colors.textMuted, fontSize: scaledFont(10) }]}>{label}</Text>
      <Text style={[styles.abgCellValue, { color, fontSize: scaledFont(14) }]}>{value}</Text>
    </View>
  );
});

const LabeledBlock = React.memo(function LabeledBlock({
  label, body, colors, scaledFont,
}: { label: string; body: string; colors: ThemeColors; scaledFont: (n: number) => number; }) {
  return (
    <View style={styles.labeledBlock}>
      <Text style={[styles.labeledLabel, { color: colors.text, fontSize: scaledFont(12) }]}>{label}</Text>
      <Text style={[styles.labeledBody, { color: colors.text, fontSize: scaledFont(12) }]}>{body}</Text>
    </View>
  );
});

const ExpSection = React.memo(function ExpSection({
  title,
  icon,
  isOpen,
  onToggle,
  children,
  colors,
  scaledFont,
}: {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  colors: ThemeColors;
  scaledFont: (n: number) => number;
}) {
  return (
    <View style={[styles.expSectionCard, { backgroundColor: colors.bgCard, borderColor: isOpen ? PURPLE : colors.border }]}>
      <TouchableOpacity onPress={onToggle} style={styles.expSectionHeader} activeOpacity={0.85}>
        <View style={styles.expSectionTitleRow}>
          {icon}
          <Text style={[styles.expSectionTitle, { color: colors.text, fontSize: scaledFont(14) }]}>{title}</Text>
        </View>
        <ChevronRight color={isOpen ? PURPLE : colors.textMuted} size={18} style={isOpen ? styles.chevOpen : undefined} />
      </TouchableOpacity>
      {isOpen ? <View style={styles.expSectionBody}>{children}</View> : null}
    </View>
  );
});

const ExpPanel = React.memo(function ExpPanel({
  title,
  icon,
  accent,
  isOpen,
  onToggle,
  children,
  images,
  onAddImage,
  onRemoveImage,
  colors,
  scaledFont,
  isDark,
}: {
  title: string;
  icon: React.ReactNode;
  accent: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  images: string[];
  onAddImage: () => void;
  onRemoveImage: (uri: string) => void;
  colors: ThemeColors;
  scaledFont: (n: number) => number;
  isDark: boolean;
}) {
  return (
    <View style={[styles.panel, { borderColor: isOpen ? accent : colors.border, backgroundColor: isOpen ? `${accent}${isDark ? "14" : "0E"}` : colors.bgElevated }]}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.85} style={styles.panelHeader}>
        <View style={[styles.panelIcon, { backgroundColor: `${accent}22` }]}>{icon}</View>
        <Text style={[styles.panelTitle, { color: colors.text, fontSize: scaledFont(13) }]}>{title}</Text>
        <ChevronRight color={isOpen ? accent : colors.textMuted} size={16} style={isOpen ? styles.chevOpen : undefined} />
      </TouchableOpacity>
      {isOpen ? (
        <View style={styles.panelBody}>
          {children}
          <View style={styles.panelImageRow}>
            {images.map((uri) => (
              <View key={uri} style={styles.thumbWrap}>
                <Image source={{ uri }} style={styles.thumb} />
                <TouchableOpacity onPress={() => onRemoveImage(uri)} style={styles.thumbClose}>
                  <X color="#fff" size={12} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={onAddImage} style={[styles.addThumb, { borderColor: accent }]} activeOpacity={0.85}>
              <Camera color={accent} size={16} />
              <Text style={[styles.addThumbText, { color: accent, fontSize: scaledFont(10) }]}>Upload</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
});

const ToggleField = React.memo(function ToggleField({
  label,
  value,
  onChange,
  colors,
  scaledFont,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  colors: ThemeColors;
  scaledFont: (n: number) => number;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.text, fontSize: scaledFont(13), fontWeight: "700" as const }]}>{label}</Text>
      <View style={styles.segmented}>
        {[{ key: true, text: "Yes" }, { key: false, text: "No" }].map((opt) => (
          <TouchableOpacity
            key={opt.text}
            onPress={() => onChange(opt.key)}
            style={[styles.segment, { backgroundColor: value === opt.key ? PURPLE : colors.bgElevated, borderColor: value === opt.key ? PURPLE : colors.border }]}
          >
            <Text style={{ color: value === opt.key ? "#fff" : colors.textMuted, fontWeight: "700" as const, fontSize: scaledFont(12) }}>{opt.text}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

const ActionPill = React.memo(function ActionPill({
  icon,
  text,
  colors,
  scaledFont,
  onPress,
}: {
  icon: React.ReactNode;
  text: string;
  colors: ThemeColors;
  scaledFont: (n: number) => number;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={!onPress}
      style={[styles.actionPill, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}
    >
      {icon}
      <Text style={[styles.actionText, { color: colors.textMuted, fontSize: scaledFont(11) }]}>{text}</Text>
    </TouchableOpacity>
  );
});

function CaseVideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" }}>
      <VideoView
        player={player}
        style={{ width: "100%", height: "80%" }}
        contentFit="contain"
        allowsFullscreen
        allowsPictureInPicture
        nativeControls
      />
    </View>
  );
}

export default function SecondOpinionScreen() {
  const { colors, scaledFont, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const [mode, setMode] = useState<Mode>("feed");
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
  const [search, setSearch] = useState<string>("");
  const [cases, setCases] = useState<SecondOpinionCase[]>([]);
  const [loadingFeed, setLoadingFeed] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const [selectedCase, setSelectedCase] = useState<SecondOpinionCase | null>(null);
  const [comments, setComments] = useState<SecondOpinionComment[]>([]);
  const [loadingComments, setLoadingComments] = useState<boolean>(false);
  const [bookmarked, setBookmarked] = useState<boolean>(false);
  const [commentText, setCommentText] = useState<string>("");
  const [replyTo, setReplyTo] = useState<SecondOpinionComment | null>(null);
  const [posting, setPosting] = useState<boolean>(false);
  const [showOwnerMenu, setShowOwnerMenu] = useState<boolean>(false);

  // Create-case state
  const [visibility, setVisibility] = useState<CaseVisibility>("public");
  const [keyQuestion, setKeyQuestion] = useState<string>("");
  const [draft, setDraft] = useState<DraftCase>(() => emptyDraft());
  const [openMainSection, setOpenMainSection] = useState<"A" | "B" | "C" | "D" | "E" | "">("A");
  const [openPanel, setOpenPanel] = useState<PanelKey | null>(null);
  const [generalMedia, setGeneralMedia] = useState<GeneralMediaItem[]>([]);

  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);
  const [showShareSheet, setShowShareSheet] = useState<boolean>(false);
  const [viewerImages, setViewerImages] = useState<{ uri: string; caption?: string }[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number>(0);
  const [viewerOpen, setViewerOpen] = useState<boolean>(false);
  const [imagingTab, setImagingTab] = useState<string>("");
  const [videoOpen, setVideoOpen] = useState<boolean>(false);
  const [videoUri, setVideoUri] = useState<string>("");
  const [videoCaption, setVideoCaption] = useState<string>("");

  const [showPrivacyModal, setShowPrivacyModal] = useState<boolean>(false);
  const [showInviteSheet, setShowInviteSheet] = useState<boolean>(false);
  const [invited, setInvited] = useState<PublicUserLite[]>([]);
  const [inviteSearch, setInviteSearch] = useState<string>("");
  const [inviteResults, setInviteResults] = useState<PublicUserLite[]>([]);
  const [searchingInvite, setSearchingInvite] = useState<boolean>(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const createScrollRef = useRef<ScrollView | null>(null);
  const sectionYRef = useRef<Record<string, number>>({});

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  const loadFeed = useCallback(async () => {
    setLoadingFeed(true);
    try {
      let list: SecondOpinionCase[] = [];
      if (feedFilter === "mine" && user?.id) {
        const own = await fetchPublicCases("mine", user.id, search);
        const invitedCases = await fetchPrivateInvitedCases(user.id);
        const seen = new Set(own.map((c) => c.id));
        list = [...own, ...invitedCases.filter((c) => !seen.has(c.id))];
      } else {
        list = await fetchPublicCases(feedFilter, user?.id ?? null, search);
      }
      setCases(list);
    } finally {
      setLoadingFeed(false);
      setRefreshing(false);
    }
  }, [feedFilter, user?.id, search]);

  useEffect(() => {
    if (mode === "feed") void loadFeed();
  }, [mode, loadFeed]);

  const openCase = useCallback(async (c: SecondOpinionCase) => {
    haptic();
    setSelectedCase(c);
    setMode("detail");
    setLoadingComments(true);
    try {
      if (user?.id) {
        void incrementViewCount(c.id, user.id, c.user_id);
        const bk = await isBookmarked(c.id, user.id);
        setBookmarked(bk);
      }
      const cmts = await fetchComments(c.id, user?.id ?? null);
      setComments(cmts);
    } finally {
      setLoadingComments(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (mode !== "detail" || !selectedCase) return;
    const unsub = subscribeToComments(selectedCase.id, async () => {
      const cmts = await fetchComments(selectedCase.id, user?.id ?? null);
      setComments(cmts);
    });
    return () => unsub();
  }, [mode, selectedCase, user?.id]);

  const resetCreateForm = () => {
    setVisibility("public");
    setKeyQuestion("");
    setDraft(emptyDraft());
    setOpenMainSection("A");
    setOpenPanel(null);
    setInvited([]);
    setGeneralMedia([]);
    setEditingCaseId(null);
  };

  const prefillFromCase = useCallback((c: SecondOpinionCase) => {
    const cp = (c.clinical_presentation ?? {}) as Record<string, unknown>;
    const vitals = (cp.vitals ?? {}) as Record<string, string>;
    const labs = (c.labs ?? {}) as Record<string, unknown>;
    const abg = (c.abg ?? {}) as Record<string, string>;
    const micro = (c.microbiology ?? {}) as Record<string, unknown>;
    const pleural = (micro.pleural ?? {}) as Record<string, string>;
    const mgmt = (c.management ?? {}) as Record<string, string>;
    const panelImages = (cp.panel_images ?? {}) as Record<string, string[]>;
    const generalM = (cp.general_media ?? []) as GeneralMediaItem[];
    const sm = (c.smoking_status ?? "").toString();
    const py = sm.match(/\((\d+)\s*PY\)/);
    const smk = (sm.replace(/\s*\([^)]*\)/, "").trim() || "Non-smoker") as SmokingStatus;
    const dur = ((cp.duration as string) ?? "").split(" ");
    setDraft({
      age: c.patient_age ? String(c.patient_age) : "",
      gender: (c.patient_gender as DraftGender) ?? "Male",
      nationality: (cp.nationality as string) ?? "",
      smokingStatus: smk,
      packYears: py ? py[1] : "",
      occupation: (cp.occupation as string) ?? "",
      comorbidities: (c.comorbidities ?? []).filter((x) => FULL_COMORBIDITIES.includes(x)),
      comorbidityOther: (c.comorbidities ?? []).filter((x) => !FULL_COMORBIDITIES.includes(x)).join(", "),
      ecog: ((cp.ecog as 0 | 1 | 2 | 3 | 4) ?? 0),
      hospital: (cp.hospital as string) ?? "",
      chiefComplaint: (cp.chief_complaint as string) ?? "",
      history: (cp.history as string) ?? "",
      durationValue: dur[0] ?? "",
      durationUnit: ((DURATION_UNITS as readonly string[]).includes(dur[1]) ? (dur[1] as DurationUnit) : "days"),
      timeline: (cp.timeline as TimelineEntry[]) ?? [],
      gcs: vitals.gcs ?? "", bp: vitals.bp ?? "", hr: vitals.hr ?? "", rr: vitals.rr ?? "",
      spo2Air: vitals.spo2_air ?? "", spo2O2: vitals.spo2_o2 ?? "",
      o2Device: (vitals.o2_device as O2Device) ?? "Room air",
      briefExam: (cp.exam as string) ?? "",
      jvpElevated: !!cp.jvp_elevated,
      wbc: (labs.wbc as string) ?? "", hb: (labs.hb as string) ?? "", plt: (labs.plt as string) ?? "",
      crp: (labs.crp as string) ?? "", esr: (labs.esr as string) ?? "", pct: (labs.pct as string) ?? "",
      ldh: (labs.ldh as string) ?? "", ferritin: (labs.ferritin as string) ?? "",
      dDimer: (labs.d_dimer as string) ?? "",
      creatinine: (labs.creatinine as string) ?? "", egfr: (labs.egfr as string) ?? "",
      alt: (labs.alt as string) ?? "", ast: (labs.ast as string) ?? "", bilirubin: (labs.bilirubin as string) ?? "",
      autoimmunePanel: (labs.autoimmune_panel as string) ?? "",
      customLabs: (labs.custom_labs as CustomLab[]) ?? [],
      ph: abg.ph ?? "", pao2: abg.pao2 ?? "", fio2: abg.fio2 ?? "0.21", hco3: abg.hco3 ?? "",
      paco2: abg.paco2 ?? "", spo2: abg.spo2 ?? "", lactate: abg.lactate ?? "",
      cultures: (micro.cultures as CultureEntry[]) ?? [],
      gramStain: (micro.gram_stain as string) ?? "",
      sensitivity: (micro.sensitivity as string) ?? "",
      serology: (micro.serology as SerologyEntry[]) ?? [],
      pftSummary: (micro.pft_summary as string) ?? "",
      ecgFindings: (micro.ecg as string) ?? "", echoFindings: (micro.echo as string) ?? "",
      pleuralPh: pleural.ph ?? "", pleuralGlucose: pleural.glucose ?? "",
      pleuralCells: pleural.cells ?? "", pleuralProtein: pleural.protein ?? "",
      serumProtein: pleural.serum_protein ?? "", pleuralLdh: pleural.ldh ?? "",
      serumLdh: pleural.serum_ldh ?? "",
      bronchoscopyReport: (micro.bronchoscopy as string) ?? "",
      biopsyResult: (micro.biopsy as string) ?? "",
      panelImages,
      finalDiagnosis: c.final_impression ?? "",
      topDiagnosis: mgmt.top_diagnosis ?? "",
      managementPlan: mgmt.plan ?? "",
      learningPoint: mgmt.learning_point ?? "",
    });
    setVisibility(c.visibility);
    setKeyQuestion(c.key_question);
    setGeneralMedia(generalM);
    setEditingCaseId(c.id);
    setOpenMainSection("A");
    setOpenPanel(null);
    setMode("create");
  }, []);

  const pickGeneralMedia = useCallback(async (kind: "image" | "video" | "pdf") => {
    try {
      if (!user?.id) {
        Alert.alert("Sign in required", "Please sign in to attach media.");
        return;
      }
      let localUri = "";
      let name: string | undefined;
      if (kind === "pdf") {
        const res = await DocumentPicker.getDocumentAsync({ type: "application/pdf", multiple: false, copyToCacheDirectory: true });
        if (res.canceled || !res.assets?.length) return;
        const a = res.assets[0];
        localUri = a.uri;
        name = a.name;
      } else {
        if (Platform.OS !== "web") {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            Alert.alert("Permission needed", "Allow media library access to attach files.");
            return;
          }
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: kind === "video" ? ["videos"] : ["images"],
          quality: 0.7,
          allowsMultipleSelection: false,
        });
        if (result.canceled || !result.assets?.length) return;
        const asset = result.assets[0];
        localUri = asset.uri;
        name = asset.fileName ?? undefined;
      }
      const uploaded = await uploadSecondOpinionMedia({ userId: user.id, uri: localUri, kind, fileName: name });
      if (!uploaded.publicUrl) {
        Alert.alert("Upload failed", uploaded.error ?? "Could not upload the file. Please try again.");
        return;
      }
      setGeneralMedia((prev) => [...prev, { uri: uploaded.publicUrl as string, type: kind, name }]);
    } catch (err) {
      console.log("[SecondOpinion] pickGeneralMedia failed", err);
      Alert.alert("Upload failed", "Could not attach the file. Please try again.");
    }
  }, [user?.id]);

  const startCreate = () => {
    if (!isAuthenticated || !user?.id) {
      Alert.alert("Sign in required", "Please sign in to share a case.", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign In", onPress: () => router.push("/login" as never) },
      ]);
      return;
    }
    resetCreateForm();
    setMode("create");
    haptic("medium");
  };

  const computePf = (): number | null => {
    return pfBadge(draft.pao2, draft.fio2).value;
  };

  const handlePublish = () => {
    if (!keyQuestion.trim()) {
      Alert.alert("2nd Opinion Question required", "Please describe what you are asking about this case.");
      return;
    }
    setShowPrivacyModal(true);
  };

  const confirmAndPublish = async () => {
    if (!user?.id) return;
    setShowPrivacyModal(false);
    haptic("medium");
    const allComorbs = [
      ...draft.comorbidities,
      ...(draft.comorbidityOther.trim() ? [draft.comorbidityOther.trim()] : []),
    ];
    const payload = {
        user_id: user.id,
        visibility,
        key_question: keyQuestion.trim(),
        patient_age: draft.age ? Number(draft.age) : null,
        patient_gender: draft.gender,
        smoking_status: draft.smokingStatus + (draft.packYears ? ` (${draft.packYears} PY)` : ""),
        bmi: null,
        comorbidities: allComorbs,
        clinical_presentation: {
          chief_complaint: draft.chiefComplaint.trim(),
          history: draft.history.trim(),
          duration: draft.durationValue ? `${draft.durationValue} ${draft.durationUnit}` : "",
          timeline: draft.timeline,
          vitals: {
            gcs: draft.gcs,
            bp: draft.bp,
            hr: draft.hr,
            rr: draft.rr,
            spo2_air: draft.spo2Air,
            spo2_o2: draft.spo2O2,
            o2_device: draft.o2Device,
          },
          exam: draft.briefExam.trim(),
          jvp_elevated: draft.jvpElevated,
          nationality: draft.nationality,
          occupation: draft.occupation,
          ecog: draft.ecog,
          hospital: draft.hospital,
          panel_images: draft.panelImages,
          general_media: generalMedia,
        },
        labs: {
          wbc: draft.wbc, hb: draft.hb, plt: draft.plt, crp: draft.crp, esr: draft.esr,
          pct: draft.pct, ldh: draft.ldh, ferritin: draft.ferritin, d_dimer: draft.dDimer,
          creatinine: draft.creatinine, egfr: draft.egfr, alt: draft.alt, ast: draft.ast,
          bilirubin: draft.bilirubin, autoimmune_panel: draft.autoimmunePanel,
          custom_labs: draft.customLabs,
        },
        abg: {
          ph: draft.ph, paco2: draft.paco2, pao2: draft.pao2, hco3: draft.hco3,
          fio2: draft.fio2, spo2: draft.spo2, lactate: draft.lactate,
        },
        pf_ratio: computePf(),
        microbiology: {
          cultures: draft.cultures,
          gram_stain: draft.gramStain,
          sensitivity: draft.sensitivity,
          serology: draft.serology,
          pft_summary: draft.pftSummary,
          ecg: draft.ecgFindings,
          echo: draft.echoFindings,
          pleural: {
            ph: draft.pleuralPh, glucose: draft.pleuralGlucose, cells: draft.pleuralCells,
            protein: draft.pleuralProtein, serum_protein: draft.serumProtein,
            ldh: draft.pleuralLdh, serum_ldh: draft.serumLdh,
          },
          bronchoscopy: draft.bronchoscopyReport,
          biopsy: draft.biopsyResult,
        },
        differentials: [],
        final_impression: draft.finalDiagnosis.trim(),
        management: {
          plan: draft.managementPlan.trim(),
          learning_point: draft.learningPoint.trim(),
          top_diagnosis: draft.topDiagnosis.trim(),
        },
        tags: draft.comorbidities,
      } as const;
    if (editingCaseId) {
      const ok = await updateCase(editingCaseId, payload, invited.map((u) => u.id));
      if (!ok) {
        Alert.alert("Could not update", "Please try again.");
        return;
      }
      Alert.alert("Updated", "Your case has been updated.");
      const refreshed = await fetchCaseById(editingCaseId);
      resetCreateForm();
      if (refreshed) {
        setSelectedCase(refreshed);
        setMode("detail");
      } else {
        setMode("feed");
      }
      await loadFeed();
      return;
    }
    const result = await createCase(payload, invited.map((u) => u.id));
    if (!result.id) {
      Alert.alert("Could not publish", "Please try again. Check your connection and ensure the second_opinion tables exist in Supabase.");
      return;
    }
    Alert.alert(
      "Shared",
      visibility === "public"
        ? "Your case is now visible in the public feed."
        : `Your private case has been shared with ${invited.length} invited user${invited.length === 1 ? "" : "s"}.`
    );
    resetCreateForm();
    setMode("feed");
    await loadFeed();
  };

  const openImageViewer = (images: { uri: string; caption?: string }[], index: number) => {
    if (!images.length) return;
    haptic();
    setViewerImages(images);
    setViewerIndex(index);
    setViewerOpen(true);
  };

  const openVideoPlayer = (uri: string, caption?: string) => {
    if (!uri) return;
    haptic();
    setVideoUri(uri);
    setVideoCaption(caption ?? "");
    setVideoOpen(true);
  };

  const openPdf = async (uri: string) => {
    try {
      if (!uri) return;
      haptic();
      await WebBrowser.openBrowserAsync(uri);
    } catch (err) {
      console.log("[SecondOpinion] openPdf failed", err);
      Alert.alert("Unable to open PDF", "Please try again or open the link in your browser.");
    }
  };

  const buildCaseSummary = (c: SecondOpinionCase): string => {
    const lines: string[] = [];
    lines.push(`KEY QUESTION: ${c.key_question}`);
    lines.push("");
    const sex = c.patient_gender ? (c.patient_gender === "Male" ? "male" : "female") : "patient";
    const age = c.patient_age ? `${c.patient_age}-year-old` : "";
    const sm = c.smoking_status ? `, ${c.smoking_status.toLowerCase()}` : "";
    const co = (c.comorbidities ?? []).join(", ");
    const cp = (c.clinical_presentation ?? {}) as Record<string, unknown>;
    const cc = (cp.chief_complaint as string) ?? "";
    const dur = (cp.duration as string) ?? "";
    lines.push(`PATIENT: A ${age} ${sex}${sm}${co ? `, known case of ${co}` : ""}${cc ? `, presenting with ${cc}` : ""}${dur ? ` for ${dur}` : ""}.`);
    if (cp.history) lines.push(`\nHPI: ${cp.history as string}`);
    if (c.final_impression) lines.push(`\nFINAL DIAGNOSIS: ${c.final_impression}`);
    const mgmt = ((c.management ?? {}) as { plan?: string }).plan;
    if (mgmt) lines.push(`\nMANAGEMENT: ${mgmt}`);
    return lines.join("\n");
  };

  const handleCopySummary = async (c: SecondOpinionCase) => {
    try {
      const Clipboard = await import("expo-clipboard").catch(() => null);
      if (Clipboard) {
        await Clipboard.setStringAsync(buildCaseSummary(c));
        Alert.alert("Copied", "Case summary copied to clipboard.");
      } else {
        Alert.alert("Summary", buildCaseSummary(c));
      }
    } catch {
      Alert.alert("Summary", buildCaseSummary(c));
    }
    setShowShareSheet(false);
  };

  const handleShareLink = async (c: SecondOpinionCase) => {
    try {
      const { Share } = await import("react-native");
      await Share.share({ message: `${c.key_question}\n\n${buildCaseSummary(c)}`, title: "2nd Opinion case" });
    } catch (err) {
      console.log("[SecondOpinion] share failed", err);
    }
    setShowShareSheet(false);
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !user?.id || !selectedCase) return;
    setPosting(true);
    haptic();
    const { id, error } = await postComment(selectedCase.id, user.id, commentText, replyTo?.id ?? null);
    setPosting(false);
    if (!id) {
      Alert.alert("Could not post", error ?? "Please try again.");
      return;
    }
    setCommentText("");
    setReplyTo(null);
    const cmts = await fetchComments(selectedCase.id, user.id);
    setComments(cmts);
    setSelectedCase((prev) => (prev ? { ...prev, comment_count: prev.comment_count + 1 } : prev));
  };

  const handleToggleHelpful = async (c: SecondOpinionComment) => {
    if (!user?.id || c.user_id === user.id) return;
    haptic();
    const { helpful, count } = await toggleHelpful(c.id, user.id);
    setComments((prev) => prev.map((x) => (x.id === c.id ? { ...x, helpful_by_me: helpful, helpful_count: count } : x)));
  };

  const handleToggleBookmark = async () => {
    if (!user?.id || !selectedCase) return;
    haptic();
    const v = await toggleBookmark(selectedCase.id, user.id);
    setBookmarked(v);
  };

  const handleUpdateStatus = async (s: CaseStatus) => {
    if (!selectedCase) return;
    haptic();
    setShowOwnerMenu(false);
    const ok = await updateCaseStatus(selectedCase.id, s);
    if (ok) {
      setSelectedCase({ ...selectedCase, status: s });
      setCases((prev) => prev.map((c) => (c.id === selectedCase.id ? { ...c, status: s } : c)));
    }
  };

  const handleDeleteCase = () => {
    if (!selectedCase) return;
    setShowOwnerMenu(false);
    Alert.alert("Delete case", "This will permanently remove the case and all comments.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const ok = await deleteCaseApi(selectedCase.id);
          if (ok) {
            setMode("feed");
            setSelectedCase(null);
            await loadFeed();
          }
        },
      },
    ]);
  };

  const handleDeleteComment = (c: SecondOpinionComment) => {
    if (!selectedCase || c.user_id !== user?.id) return;
    Alert.alert("Delete comment", "Remove this comment?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteComment(c.id, selectedCase.id);
          const cmts = await fetchComments(selectedCase.id, user?.id ?? null);
          setComments(cmts);
          setSelectedCase((prev) => (prev ? { ...prev, comment_count: Math.max(0, prev.comment_count - 1) } : prev));
        },
      },
    ]);
  };

  const runInviteSearch = useCallback(async (q: string) => {
    setInviteSearch(q);
    if (q.trim().length < 2) {
      setInviteResults([]);
      return;
    }
    setSearchingInvite(true);
    try {
      const res = await searchUsers(q, user?.id ?? null);
      setInviteResults(res);
    } finally {
      setSearchingInvite(false);
    }
  }, [user?.id]);

  const toggleInvitee = (u: PublicUserLite) => {
    haptic();
    setInvited((prev) => (prev.find((p) => p.id === u.id) ? prev.filter((p) => p.id !== u.id) : [...prev, u]));
  };

  const handleScanContacts = async () => {
    try {
      const Contacts = await import("expo-contacts").catch(() => null);
      if (!Contacts || Platform.OS === "web") {
        Alert.alert("Not available", "Contacts access is not available on this platform. Use search instead.");
        return;
      }
      const perm = await Contacts.requestPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permission denied", "Use the search field to find PulmoLab users by name or phone.");
        return;
      }
      const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
      const phones: string[] = [];
      data.forEach((c: { phoneNumbers?: { number?: string }[] }) => {
        c.phoneNumbers?.forEach((p) => {
          if (p.number) phones.push(p.number);
        });
      });
      if (!phones.length) {
        Alert.alert("No phone numbers", "Your contacts had no phone numbers to match.");
        return;
      }
      const matches = await matchContactsByPhone(phones, user?.id ?? null);
      if (!matches.length) {
        Alert.alert("No matches", "None of your contacts are on PulmoLab yet.");
        return;
      }
      setInviteResults(matches);
      setInviteSearch("");
    } catch (err) {
      console.log("[SecondOpinion] contacts error", err);
      Alert.alert("Couldn't read contacts", "Use the search field instead.");
    }
  };

  // ===== RENDER =====
  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.bgCard, borderColor: colors.border, paddingTop: insets.top + 8 }]}>
      <TouchableOpacity
        onPress={() => {
          if (mode === "feed") router.back();
          else {
            setMode("feed");
            setSelectedCase(null);
          }
        }}
        style={styles.iconBtn}
      >
        <ArrowLeft color={colors.text} size={22} />
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <View style={styles.headerRow}>
          <View style={[styles.headerDot, { backgroundColor: PURPLE }]} />
          <Text style={[styles.headerTitle, { color: colors.text, fontSize: scaledFont(17) }]}>2nd Opinion</Text>
        </View>
        <Text style={[styles.headerSub, { color: colors.textMuted, fontSize: scaledFont(11) }]}>
          {mode === "create" ? "Share a clinical case" : mode === "detail" ? "Case discussion" : "Peer case discussions"}
        </Text>
      </View>
      {mode === "feed" ? (
        <TouchableOpacity onPress={startCreate} style={[styles.headerCta, { backgroundColor: PURPLE }]} activeOpacity={0.85}>
          <Plus color="#fff" size={18} />
        </TouchableOpacity>
      ) : mode === "detail" && selectedCase ? (
        <View style={styles.headerActions}>
          {selectedCase.user_id === user?.id ? (
            <TouchableOpacity onPress={() => prefillFromCase(selectedCase)} style={styles.iconBtn} hitSlop={6}>
              <Pencil color={colors.text} size={18} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={handleToggleBookmark} style={styles.iconBtn} hitSlop={6}>
            <Star color={bookmarked ? "#F59E0B" : colors.textMuted} size={20} fill={bookmarked ? "#F59E0B" : "transparent"} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowShareSheet(true)} style={styles.iconBtn} hitSlop={6}>
            <Share2 color={colors.text} size={18} />
          </TouchableOpacity>
          {selectedCase.user_id === user?.id ? (
            <TouchableOpacity onPress={() => setShowOwnerMenu(true)} style={styles.iconBtn} hitSlop={6}>
              <MoreVertical color={colors.text} size={20} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <View style={styles.iconBtn} />
      )}
    </View>
  );

  const renderPrivacyBanner = () => (
    <View style={[styles.privacyBanner, { backgroundColor: isDark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.4)" }]}>
      <ShieldAlert color="#EF4444" size={16} />
      <Text style={[styles.privacyText, { color: colors.text, fontSize: scaledFont(11) }]}>
        Do not include any patient-identifying information. This is a violation of app policy and medical ethics.
      </Text>
    </View>
  );

  const StatusBadge = ({ status }: { status: CaseStatus }) => {
    const map: Record<CaseStatus, { c: string; bg: string; label: string }> = {
      open: { c: "#F59E0B", bg: "rgba(245,158,11,0.16)", label: "OPEN" },
      resolved: { c: "#10B981", bg: "rgba(16,185,129,0.16)", label: "RESOLVED" },
      follow_up: { c: "#3B82F6", bg: "rgba(59,130,246,0.16)", label: "FOLLOW-UP" },
    };
    const v = map[status];
    return (
      <View style={[styles.statusBadge, { backgroundColor: v.bg }]}>
        <Text style={[styles.statusText, { color: v.c, fontSize: scaledFont(10) }]}>{v.label}</Text>
      </View>
    );
  };

  const renderCaseCard = (item: SecondOpinionCase) => {
    const snapshotParts: string[] = [];
    if (item.patient_gender) snapshotParts.push(item.patient_gender);
    if (item.patient_age) snapshotParts.push(`${item.patient_age}yr`);
    if (item.smoking_status && item.smoking_status !== "Non-smoker") snapshotParts.push(item.smoking_status);
    const syms = (item.clinical_presentation as { symptoms?: string[] } | null)?.symptoms ?? [];
    if (syms.length) snapshotParts.push(syms.slice(0, 2).join(" + "));
    return (
      <TouchableOpacity
        key={item.id}
        onPress={() => openCase(item)}
        activeOpacity={0.86}
        style={[styles.caseCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
      >
        <View style={[styles.caseAccent, { backgroundColor: PURPLE }]} />
        <View style={styles.caseCardInner}>
          <View style={styles.caseTopRow}>
            <StatusBadge status={item.status} />
            {item.visibility === "private" ? (
              <View style={[styles.privateBadge, { backgroundColor: "rgba(139,92,246,0.16)" }]}>
                <Lock color={PURPLE} size={10} />
                <Text style={[styles.privateBadgeText, { color: PURPLE, fontSize: scaledFont(9) }]}>PRIVATE</Text>
              </View>
            ) : null}
            <View style={styles.flexOne} />
            <Text style={[styles.timeText, { color: colors.textMuted, fontSize: scaledFont(10) }]}>{relativeTime(item.created_at)}</Text>
          </View>
          <Text style={[styles.questionText, { color: colors.text, fontSize: scaledFont(14) }]} numberOfLines={2}>
            “{item.key_question}”
          </Text>
          {snapshotParts.length ? (
            <Text style={[styles.snapshotText, { color: colors.textMuted, fontSize: scaledFont(12) }]} numberOfLines={1}>
              {snapshotParts.join(" · ")}
            </Text>
          ) : null}
          {item.final_impression ? (
            <Text style={[styles.impressionText, { color: colors.textSecondary, fontSize: scaledFont(11) }]} numberOfLines={1}>
              Final impression: {item.final_impression}
            </Text>
          ) : null}
          <View style={[styles.authorRow, { borderTopColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: PURPLE }]}>
              <Text style={styles.avatarText}>{(item.author_name ?? "U").charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.flexOne}>
              <Text style={[styles.authorName, { color: colors.text, fontSize: scaledFont(12) }]} numberOfLines={1}>
                {item.author_name ?? "Anonymous"}
              </Text>
            </View>
            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <MessageCircle color={colors.textMuted} size={13} />
                <Text style={[styles.metricText, { color: colors.textMuted, fontSize: scaledFont(11) }]}>{item.comment_count}</Text>
              </View>
              <View style={styles.metric}>
                <Eye color={colors.textMuted} size={13} />
                <Text style={[styles.metricText, { color: colors.textMuted, fontSize: scaledFont(11) }]}>{item.view_count}</Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFeed = () => (
    <View style={styles.screenFill}>
      <View style={styles.feedToolbar}>
        <View style={[styles.searchRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Search color={colors.textMuted} size={16} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search cases"
            placeholderTextColor={colors.textDim}
            style={[styles.searchInput, { color: colors.text, fontSize: scaledFont(13) }]}
            returnKeyType="search"
            onSubmitEditing={() => void loadFeed()}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
              <X color={colors.textMuted} size={16} />
            </TouchableOpacity>
          ) : null}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
          style={styles.filterScrollView}
        >
          {([
            { id: "all", label: "All" },
            { id: "open", label: "Open" },
            { id: "resolved", label: "Resolved" },
            { id: "mine", label: "Mine" },
            { id: "saved", label: "Saved" },
          ] as { id: FeedFilter; label: string }[]).map((f) => {
            const active = feedFilter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => {
                  haptic();
                  setFeedFilter(f.id);
                }}
                activeOpacity={0.85}
                style={[
                  styles.filterChip,
                  { backgroundColor: active ? PURPLE : colors.bgCard, borderColor: active ? PURPLE : colors.border },
                ]}
              >
                <Text style={[styles.filterChipText, { color: active ? "#fff" : colors.textSecondary, fontSize: scaledFont(12) }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loadingFeed && !refreshing ? (
        <View style={styles.centerFlex}>
          <ActivityIndicator color={PURPLE} />
        </View>
      ) : cases.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyIcon, { backgroundColor: "rgba(139,92,246,0.15)" }]}>
            <Users color={PURPLE} size={28} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text, fontSize: scaledFont(15) }]}>No cases yet</Text>
          <Text style={[styles.emptySub, { color: colors.textMuted, fontSize: scaledFont(12) }]}>
            Be the first to share a clinical case for peer discussion.
          </Text>
          <TouchableOpacity onPress={startCreate} style={[styles.emptyCta, { backgroundColor: PURPLE }]}>
            <Plus color="#fff" size={16} />
            <Text style={styles.emptyCtaText}>Share a case</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={cases}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderCaseCard(item)}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await loadFeed();
          }}
        />
      )}
    </View>
  );

  // === Create form ===
  const toggleMain = useCallback((key: "A" | "B" | "C" | "D" | "E") => {
    if (Platform.OS !== "web") {
      LayoutAnimation.configureNext(LayoutAnimation.create(260, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
    } else {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setOpenMainSection((cur) => {
      const next = cur === key ? "" : key;
      if (next) {
        setTimeout(() => {
          const y = sectionYRef.current[next];
          if (typeof y === "number" && createScrollRef.current) {
            createScrollRef.current.scrollTo({ y: Math.max(0, y - 8), animated: true });
          }
        }, 300);
      }
      return next;
    });
    haptic();
  }, []);

  const togglePanel = useCallback((key: PanelKey) => {
    if (Platform.OS !== "web") {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setOpenPanel((cur) => (cur === key ? null : key));
    haptic();
  }, []);

  const addPanelImage = useCallback(async (key: PanelKey) => {
    try {
      if (!user?.id) {
        Alert.alert("Sign in required", "Please sign in to attach media.");
        return;
      }
      if (Platform.OS !== "web") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission needed", "Allow photo library access to attach images.");
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, allowsMultipleSelection: false });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const uploaded = await uploadSecondOpinionMedia({
        userId: user.id,
        uri: asset.uri,
        kind: "image",
        fileName: asset.fileName ?? undefined,
      });
      if (!uploaded.publicUrl) {
        Alert.alert("Upload failed", uploaded.error ?? "Could not upload the image. Please try again.");
        return;
      }
      const remoteUri = uploaded.publicUrl;
      setDraft((prev) => ({
        ...prev,
        panelImages: { ...prev.panelImages, [key]: [...(prev.panelImages[key] ?? []), remoteUri] },
      }));
    } catch (err) {
      console.log("[SecondOpinion] image pick failed", err);
      Alert.alert("Upload failed", "Could not attach the image. Please try again.");
    }
  }, [user?.id]);

  const removePanelImage = useCallback((key: PanelKey, uri: string) => {
    setDraft((prev) => ({
      ...prev,
      panelImages: { ...prev.panelImages, [key]: (prev.panelImages[key] ?? []).filter((u) => u !== uri) },
    }));
  }, []);

  const getPanelImages = useCallback((key: PanelKey): string[] => draft.panelImages[key] ?? [], [draft.panelImages]);

  const renderCreate = () => {
    const pf = pfBadge(draft.pao2, draft.fio2);
    return (
      <KeyboardAvoidingView style={styles.screenFill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView ref={createScrollRef} contentContainerStyle={[styles.createScroll, { paddingBottom: insets.bottom + 120 }]} keyboardShouldPersistTaps="handled">
          {renderPrivacyBanner()}

          <SectionCard colors={colors} scaledFont={scaledFont} title="Visibility">
            <View style={styles.visibilityRow}>
              {(["public", "private"] as CaseVisibility[]).map((v) => {
                const active = visibility === v;
                return (
                  <TouchableOpacity
                    key={v}
                    onPress={() => {
                      haptic();
                      setVisibility(v);
                      if (v === "private" && invited.length === 0) {
                        setShowInviteSheet(true);
                      }
                    }}
                    activeOpacity={0.85}
                    style={[
                      styles.visCard,
                      { backgroundColor: active ? `${PURPLE}1A` : colors.bgElevated, borderColor: active ? PURPLE : colors.border },
                    ]}
                  >
                    <View style={[styles.visIcon, { backgroundColor: active ? PURPLE : "transparent", borderColor: PURPLE, borderWidth: active ? 0 : 1 }]}>
                      {v === "public" ? (
                        <Users color={active ? "#fff" : PURPLE} size={16} />
                      ) : (
                        <Lock color={active ? "#fff" : PURPLE} size={16} />
                      )}
                    </View>
                    <Text style={[styles.visTitle, { color: colors.text, fontSize: scaledFont(13) }]}>{v === "public" ? "Public" : "Private"}</Text>
                    <Text style={[styles.visSub, { color: colors.textMuted, fontSize: scaledFont(10) }]}>
                      {v === "public" ? "All PulmoLab users" : "Selected users only"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {visibility === "private" ? (
              <TouchableOpacity onPress={() => setShowInviteSheet(true)} style={[styles.inviteSummary, { borderColor: PURPLE }]}>
                <UserPlus color={PURPLE} size={14} />
                <Text style={[styles.inviteSummaryText, { color: PURPLE, fontSize: scaledFont(12) }]}>
                  {invited.length ? `${invited.length} invited · Manage` : "Add invitees"}
                </Text>
                <ChevronRight color={PURPLE} size={14} />
              </TouchableOpacity>
            ) : null}
          </SectionCard>

          <SectionCard colors={colors} scaledFont={scaledFont} title="2nd Opinion Question">
            <TextInput
              value={keyQuestion}
              onChangeText={setKeyQuestion}
              placeholder="e.g. Unusual CT pattern — any DDx suggestions?"
              placeholderTextColor={colors.textDim}
              multiline
              maxLength={250}
              style={[
                styles.input,
                styles.inputMulti,
                { backgroundColor: colors.bgElevated, borderColor: PURPLE, color: colors.text, fontSize: scaledFont(13), minHeight: 70 },
              ]}
            />
          </SectionCard>

          <View onLayout={(e) => { sectionYRef.current["A"] = e.nativeEvent.layout.y; }}>
          <ExpSection colors={colors} scaledFont={scaledFont} title="A. Patient Snapshot" icon={<UserRound color="#3B82F6" size={18} />} isOpen={openMainSection === "A"} onToggle={() => toggleMain("A")}>
            <View style={styles.row2}>
              <View style={styles.flexOne}>
                <Field colors={colors} scaledFont={scaledFont} label="Age" value={draft.age} onChangeText={(age) => setDraft({ ...draft, age })} keyboardType="numeric" placeholder="45" />
              </View>
              <View style={styles.flexOne}>
                <Text style={[styles.fieldLabel, { color: colors.text, fontSize: scaledFont(13), fontWeight: "700" as const }]}>Gender</Text>
                <View style={styles.segmented}>
                  {(["Male", "Female"] as DraftGender[]).map((g) => (
                    <TouchableOpacity
                      key={g}
                      onPress={() => setDraft({ ...draft, gender: g })}
                      style={[styles.segment, { backgroundColor: draft.gender === g ? PURPLE : colors.bgElevated, borderColor: draft.gender === g ? PURPLE : colors.border }]}
                    >
                      <Text style={{ color: draft.gender === g ? "#fff" : colors.textMuted, fontWeight: "700" as const, fontSize: scaledFont(12) }}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <Field colors={colors} scaledFont={scaledFont} label="Nationality" value={draft.nationality} onChangeText={(nationality) => setDraft({ ...draft, nationality })} placeholder="Optional" />
            <Text style={[styles.fieldLabel, { color: colors.text, fontSize: scaledFont(13), fontWeight: "700" as const }]}>Smoking status</Text>
            <View style={styles.chipsWrap}>
              {SMOKING_OPTIONS.map((s) => (
                <Chip colors={colors} scaledFont={scaledFont} key={s} label={s} active={draft.smokingStatus === s} onPress={() => setDraft({ ...draft, smokingStatus: s })} />
              ))}
            </View>
            {draft.smokingStatus !== "Non-smoker" ? (
              <Field colors={colors} scaledFont={scaledFont} label="Pack-years" value={draft.packYears} onChangeText={(packYears) => setDraft({ ...draft, packYears })} keyboardType="numeric" />
            ) : null}
            <Field colors={colors} scaledFont={scaledFont} label="Occupation & exposure history" value={draft.occupation} onChangeText={(occupation) => setDraft({ ...draft, occupation })} multiline placeholder="e.g., Farmer with chronic bird exposure" />
            <View style={styles.chipsWrap}>
              {OCCUPATION_SUGGESTIONS.map((s) => (
                <Chip colors={colors} scaledFont={scaledFont} key={s} label={s} active={draft.occupation.toLowerCase().includes(s.toLowerCase())} onPress={() => setDraft({ ...draft, occupation: draft.occupation ? `${draft.occupation}, ${s}` : s })} />
              ))}
            </View>
            <Text style={[styles.fieldLabel, { color: colors.text, fontSize: scaledFont(13), fontWeight: "700" as const }]}>Key comorbidities</Text>
            <View style={styles.chipsWrap}>
              {FULL_COMORBIDITIES.map((c) => (
                <Chip
                  colors={colors}
                  scaledFont={scaledFont}
                  key={c}
                  label={c}
                  active={draft.comorbidities.includes(c)}
                  onPress={() => setDraft({ ...draft, comorbidities: draft.comorbidities.includes(c) ? draft.comorbidities.filter((x) => x !== c) : [...draft.comorbidities, c] })}
                />
              ))}
            </View>
            <Field colors={colors} scaledFont={scaledFont} label="Other comorbidities" value={draft.comorbidityOther} onChangeText={(comorbidityOther) => setDraft({ ...draft, comorbidityOther })} multiline placeholder="Add any additional comorbidities not listed above" />
            <Text style={[styles.fieldLabel, { color: colors.text, fontSize: scaledFont(13), fontWeight: "700" as const }]}>Functional status (ECOG)</Text>
            <View style={styles.chipsWrap}>
              {[0, 1, 2, 3, 4].map((n) => (
                <Chip colors={colors} scaledFont={scaledFont} key={n} label={`ECOG ${n}`} active={draft.ecog === n} onPress={() => setDraft({ ...draft, ecog: n as 0 | 1 | 2 | 3 | 4 })} />
              ))}
            </View>
            <Field colors={colors} scaledFont={scaledFont} label="Hospital / Unit" value={draft.hospital} onChangeText={(hospital) => setDraft({ ...draft, hospital })} placeholder="Optional" />
          </ExpSection>
          </View>

          <View onLayout={(e) => { sectionYRef.current["B"] = e.nativeEvent.layout.y; }}>
          <ExpSection colors={colors} scaledFont={scaledFont} title="B. Clinical Presentation" icon={<HeartPulse color="#EF4444" size={18} />} isOpen={openMainSection === "B"} onToggle={() => toggleMain("B")}>
            <Field colors={colors} scaledFont={scaledFont} label="Chief complaint" value={draft.chiefComplaint} onChangeText={(chiefComplaint) => setDraft({ ...draft, chiefComplaint })} />
            <Field colors={colors} scaledFont={scaledFont} label="History of present illness" value={draft.history} onChangeText={(history) => setDraft({ ...draft, history })} multiline minHeight={130} placeholder="Brief, no identifiers" />
            <View style={styles.row2}>
              <View style={styles.flexOne}>
                <Field colors={colors} scaledFont={scaledFont} label="Duration" value={draft.durationValue} onChangeText={(durationValue) => setDraft({ ...draft, durationValue })} keyboardType="numeric" />
              </View>
              <View style={styles.flexOne}>
                <Text style={[styles.fieldLabel, { color: colors.text, fontSize: scaledFont(13), fontWeight: "700" as const }]}>Unit</Text>
                <View style={styles.segmented}>
                  {DURATION_UNITS.map((u) => (
                    <TouchableOpacity
                      key={u}
                      onPress={() => setDraft({ ...draft, durationUnit: u })}
                      style={[styles.segment, { backgroundColor: draft.durationUnit === u ? PURPLE : colors.bgElevated, borderColor: draft.durationUnit === u ? PURPLE : colors.border }]}
                    >
                      <Text style={{ color: draft.durationUnit === u ? "#fff" : colors.textMuted, fontWeight: "700" as const, fontSize: scaledFont(11) }}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <Text style={[styles.fieldLabel, { color: colors.text, fontSize: scaledFont(13), fontWeight: "700" as const, marginTop: 6 }]}>Timeline of events</Text>
            {draft.timeline.map((t) => (
              <View key={t.id} style={[styles.timelineRow, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}>
                <View style={[styles.timelineDot, { backgroundColor: PURPLE }]} />
                <View style={styles.flexOne}>
                  <TextInput
                    value={t.date}
                    onChangeText={(date) => setDraft({ ...draft, timeline: draft.timeline.map((x) => (x.id === t.id ? { ...x, date } : x)) })}
                    placeholder="Date (e.g., Day 0, 2025-01-15)"
                    placeholderTextColor={colors.textDim}
                    style={{ color: colors.text, fontWeight: "800" as const, fontSize: scaledFont(12), paddingVertical: 2 }}
                  />
                  <TextInput
                    value={t.event}
                    onChangeText={(event) => setDraft({ ...draft, timeline: draft.timeline.map((x) => (x.id === t.id ? { ...x, event } : x)) })}
                    placeholder="Event description"
                    placeholderTextColor={colors.textDim}
                    style={{ color: colors.textMuted, fontSize: scaledFont(12), paddingVertical: 2 }}
                  />
                </View>
                <TouchableOpacity onPress={() => setDraft({ ...draft, timeline: draft.timeline.filter((x) => x.id !== t.id) })}>
                  <X color="#EF4444" size={16} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              onPress={() => setDraft({ ...draft, timeline: [...draft.timeline, { id: localId(), date: "", event: "" }] })}
              style={[styles.addRowBtn, { borderColor: colors.border }]}
            >
              <Calendar color={PURPLE} size={14} />
              <Text style={[styles.voiceText, { color: PURPLE, fontSize: scaledFont(12) }]}>Add timeline entry</Text>
            </TouchableOpacity>
            <Text style={[styles.fieldLabel, { color: colors.text, fontSize: scaledFont(13), fontWeight: "700" as const, marginTop: 8 }]}>Physical examination</Text>
            <View style={styles.row2}>
              <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="GCS" value={draft.gcs} onChangeText={(gcs) => setDraft({ ...draft, gcs })} keyboardType="numeric" /></View>
              <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="BP" value={draft.bp} onChangeText={(bp) => setDraft({ ...draft, bp })} placeholder="120/80" /></View>
            </View>
            <View style={styles.row2}>
              <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="HR (bpm)" value={draft.hr} onChangeText={(hr) => setDraft({ ...draft, hr })} keyboardType="numeric" /></View>
              <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="RR (/min)" value={draft.rr} onChangeText={(rr) => setDraft({ ...draft, rr })} keyboardType="numeric" /></View>
            </View>
            <View style={styles.row2}>
              <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="SpO₂ (room air %)" value={draft.spo2Air} onChangeText={(spo2Air) => setDraft({ ...draft, spo2Air })} keyboardType="numeric" /></View>
              <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="SpO₂ (on O₂ %)" value={draft.spo2O2} onChangeText={(spo2O2) => setDraft({ ...draft, spo2O2 })} keyboardType="numeric" /></View>
            </View>
            <Text style={[styles.fieldLabel, { color: colors.text, fontSize: scaledFont(13), fontWeight: "700" as const }]}>O₂ device</Text>
            <View style={styles.chipsWrap}>
              {O2_DEVICES.map((d) => (
                <Chip colors={colors} scaledFont={scaledFont} key={d} label={d} active={draft.o2Device === d} onPress={() => setDraft({ ...draft, o2Device: d })} />
              ))}
            </View>
            <Field colors={colors} scaledFont={scaledFont} label="Brief physical examination" value={draft.briefExam} onChangeText={(briefExam) => setDraft({ ...draft, briefExam })} multiline minHeight={130} placeholder="Document key examination findings (chest, cardiac, abdomen, neuro, etc.)" />
          </ExpSection>
          </View>

          <View onLayout={(e) => { sectionYRef.current["C"] = e.nativeEvent.layout.y; }}>
          <ExpSection colors={colors} scaledFont={scaledFont} title="C. Investigations" icon={<Gauge color="#F59E0B" size={18} />} isOpen={openMainSection === "C"} onToggle={() => toggleMain("C")}>
            <Text style={[styles.subLabel, { color: colors.text, fontSize: scaledFont(12) }]}>Labs</Text>
            <View style={styles.row2}>
              <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="WBC" value={draft.wbc} onChangeText={(wbc) => setDraft({ ...draft, wbc })} keyboardType="numeric" placeholder="x10⁹/L" /></View>
              <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="Hb" value={draft.hb} onChangeText={(hb) => setDraft({ ...draft, hb })} keyboardType="numeric" placeholder="g/dL" /></View>
            </View>
            <View style={styles.row2}>
              <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="Plt" value={draft.plt} onChangeText={(plt) => setDraft({ ...draft, plt })} keyboardType="numeric" /></View>
              <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="CRP" value={draft.crp} onChangeText={(crp) => setDraft({ ...draft, crp })} keyboardType="numeric" placeholder="mg/L" /></View>
            </View>
            <View style={styles.row2}>
              <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="ESR" value={draft.esr} onChangeText={(esr) => setDraft({ ...draft, esr })} keyboardType="numeric" /></View>
              <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="Procal" value={draft.pct} onChangeText={(pct) => setDraft({ ...draft, pct })} keyboardType="numeric" /></View>
            </View>
            <View style={styles.row2}>
              <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="LDH" value={draft.ldh} onChangeText={(ldh) => setDraft({ ...draft, ldh })} keyboardType="numeric" placeholder="U/L" /></View>
              <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="Ferritin" value={draft.ferritin} onChangeText={(ferritin) => setDraft({ ...draft, ferritin })} keyboardType="numeric" /></View>
            </View>
            <Field colors={colors} scaledFont={scaledFont} label="D-Dimer" value={draft.dDimer} onChangeText={(dDimer) => setDraft({ ...draft, dDimer })} keyboardType="numeric" />
            <View style={styles.row2}>
              <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="Creatinine" value={draft.creatinine} onChangeText={(creatinine) => setDraft({ ...draft, creatinine })} keyboardType="numeric" placeholder="mg/dL" /></View>
              <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="eGFR" value={draft.egfr} onChangeText={(egfr) => setDraft({ ...draft, egfr })} keyboardType="numeric" /></View>
            </View>
            <View style={styles.row2}>
              <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="ALT" value={draft.alt} onChangeText={(alt) => setDraft({ ...draft, alt })} keyboardType="numeric" /></View>
              <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="AST" value={draft.ast} onChangeText={(ast) => setDraft({ ...draft, ast })} keyboardType="numeric" /></View>
            </View>
            <Field colors={colors} scaledFont={scaledFont} label="Bilirubin" value={draft.bilirubin} onChangeText={(bilirubin) => setDraft({ ...draft, bilirubin })} keyboardType="numeric" />

            <Text style={[styles.fieldLabel, { color: colors.text, fontSize: scaledFont(13), fontWeight: "700" as const, marginTop: 4 }]}>Custom labs</Text>
            {draft.customLabs.map((lab) => (
              <View key={lab.id} style={[styles.customLabRow, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}>
                <View style={styles.row2}>
                  <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="Name" value={lab.name} onChangeText={(name) => setDraft({ ...draft, customLabs: draft.customLabs.map((x) => (x.id === lab.id ? { ...x, name } : x)) })} /></View>
                  <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="Value" value={lab.value} onChangeText={(value) => setDraft({ ...draft, customLabs: draft.customLabs.map((x) => (x.id === lab.id ? { ...x, value } : x)) })} /></View>
                </View>
                <View style={styles.row2}>
                  <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="Unit" value={lab.unit} onChangeText={(unit) => setDraft({ ...draft, customLabs: draft.customLabs.map((x) => (x.id === lab.id ? { ...x, unit } : x)) })} /></View>
                  <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="Normal range" value={lab.normalRange} onChangeText={(normalRange) => setDraft({ ...draft, customLabs: draft.customLabs.map((x) => (x.id === lab.id ? { ...x, normalRange } : x)) })} /></View>
                </View>
                <TouchableOpacity onPress={() => setDraft({ ...draft, customLabs: draft.customLabs.filter((x) => x.id !== lab.id) })} style={styles.removeBtn}>
                  <Trash2 color="#EF4444" size={14} />
                  <Text style={{ color: "#EF4444", fontWeight: "900" as const, fontSize: 11 }}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={() => setDraft({ ...draft, customLabs: [...draft.customLabs, { id: localId(), name: "", value: "", unit: "", normalRange: "" }] })} style={[styles.addRowBtn, { borderColor: colors.border }]}>
              <Plus color={PURPLE} size={14} />
              <Text style={[styles.voiceText, { color: PURPLE, fontSize: scaledFont(12) }]}>Add custom lab</Text>
            </TouchableOpacity>

            <Text style={[styles.subLabel, { color: colors.text, fontSize: scaledFont(12), marginTop: 10 }]}>Tap a panel to expand</Text>

            <ExpPanel colors={colors} scaledFont={scaledFont} isDark={isDark} title="Autoimmune panel" icon={<ShieldCheck color="#8B5CF6" size={14} />} accent="#8B5CF6" isOpen={openPanel === "autoimmune"} onToggle={() => togglePanel("autoimmune")} images={getPanelImages("autoimmune")} onAddImage={() => void addPanelImage("autoimmune")} onRemoveImage={(uri) => removePanelImage("autoimmune", uri)}>
              <Field colors={colors} scaledFont={scaledFont} label="Autoimmune panel notes" value={draft.autoimmunePanel} onChangeText={(autoimmunePanel) => setDraft({ ...draft, autoimmunePanel })} multiline placeholder="ANA, ANCA, RF, anti-CCP, complement, etc." />
            </ExpPanel>

            <ExpPanel colors={colors} scaledFont={scaledFont} isDark={isDark} title="Arterial Blood Gas (ABG)" icon={<Activity color="#EF4444" size={14} />} accent="#EF4444" isOpen={openPanel === "abg"} onToggle={() => togglePanel("abg")} images={getPanelImages("abg")} onAddImage={() => void addPanelImage("abg")} onRemoveImage={(uri) => removePanelImage("abg", uri)}>
              <View style={styles.row2}>
                <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="pH" value={draft.ph} onChangeText={(ph) => setDraft({ ...draft, ph })} keyboardType="numeric" placeholder="7.40" /></View>
                <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="PaCO₂ (mmHg)" value={draft.paco2} onChangeText={(paco2) => setDraft({ ...draft, paco2 })} keyboardType="numeric" /></View>
              </View>
              <View style={styles.row2}>
                <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="PaO₂ (mmHg)" value={draft.pao2} onChangeText={(pao2) => setDraft({ ...draft, pao2 })} keyboardType="numeric" /></View>
                <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="HCO₃ (mmol/L)" value={draft.hco3} onChangeText={(hco3) => setDraft({ ...draft, hco3 })} keyboardType="numeric" /></View>
              </View>
              <View style={styles.row2}>
                <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="SpO₂ (%)" value={draft.spo2} onChangeText={(spo2) => setDraft({ ...draft, spo2 })} keyboardType="numeric" /></View>
                <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="Lactate" value={draft.lactate} onChangeText={(lactate) => setDraft({ ...draft, lactate })} keyboardType="numeric" /></View>
              </View>
              <Field colors={colors} scaledFont={scaledFont} label="FiO₂ at ABG" value={draft.fio2} onChangeText={(fio2) => setDraft({ ...draft, fio2 })} keyboardType="numeric" placeholder="0.21–1.0" />
              <View style={[styles.calcCard, { borderColor: pf.color, backgroundColor: `${pf.color}14` }]}>
                <Text style={[styles.calcTitle, { color: pf.color, fontSize: scaledFont(13) }]}>P/F Ratio: {pf.value ?? "—"}</Text>
                <Text style={[styles.calcSub, { color: colors.textMuted, fontSize: scaledFont(11) }]}>{pf.label}</Text>
              </View>
              <View style={[styles.calcCard, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}>
                <Text style={[styles.calcTitle, { color: colors.text, fontSize: scaledFont(13) }]}>ABG interpretation</Text>
                <Text style={[styles.calcSub, { color: colors.textMuted, fontSize: scaledFont(11) }]}>{abgSuggestion(draft)}</Text>
              </View>
            </ExpPanel>

            <ExpPanel colors={colors} scaledFont={scaledFont} isDark={isDark} title="Microbiology" icon={<Sparkles color="#0D9488" size={14} />} accent="#0D9488" isOpen={openPanel === "micro"} onToggle={() => togglePanel("micro")} images={getPanelImages("micro")} onAddImage={() => void addPanelImage("micro")} onRemoveImage={(uri) => removePanelImage("micro", uri)}>
              {draft.cultures.map((c) => (
                <View key={c.id} style={[styles.customLabRow, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}>
                  <Text style={[styles.fieldLabel, { color: colors.text, fontSize: scaledFont(13), fontWeight: "700" as const }]}>Source</Text>
                  <View style={styles.chipsWrap}>
                    {CULTURE_SOURCES.map((src) => (
                      <Chip colors={colors} scaledFont={scaledFont} key={src} label={src} active={c.source === src} onPress={() => setDraft({ ...draft, cultures: draft.cultures.map((x) => (x.id === c.id ? { ...x, source: src } : x)) })} />
                    ))}
                  </View>
                  <Field colors={colors} scaledFont={scaledFont} label="Organism" value={c.organism} onChangeText={(organism) => setDraft({ ...draft, cultures: draft.cultures.map((x) => (x.id === c.id ? { ...x, organism } : x)) })} />
                  <Field colors={colors} scaledFont={scaledFont} label="Result / notes" value={c.result} onChangeText={(result) => setDraft({ ...draft, cultures: draft.cultures.map((x) => (x.id === c.id ? { ...x, result } : x)) })} multiline />
                  <TouchableOpacity onPress={() => setDraft({ ...draft, cultures: draft.cultures.filter((x) => x.id !== c.id) })} style={styles.removeBtn}>
                    <Trash2 color="#EF4444" size={14} />
                    <Text style={{ color: "#EF4444", fontWeight: "900" as const, fontSize: 11 }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={() => setDraft({ ...draft, cultures: [...draft.cultures, { id: localId(), source: "Blood", organism: "", result: "" }] })} style={[styles.addRowBtn, { borderColor: colors.border }]}>
                <Plus color="#0D9488" size={14} />
                <Text style={[styles.voiceText, { color: "#0D9488", fontSize: scaledFont(12) }]}>Add culture</Text>
              </TouchableOpacity>
              <Field colors={colors} scaledFont={scaledFont} label="Gram stain" value={draft.gramStain} onChangeText={(gramStain) => setDraft({ ...draft, gramStain })} />
              <Field colors={colors} scaledFont={scaledFont} label="Sensitivity / resistance" value={draft.sensitivity} onChangeText={(sensitivity) => setDraft({ ...draft, sensitivity })} multiline />
              <Text style={[styles.fieldLabel, { color: colors.text, fontSize: scaledFont(13), fontWeight: "700" as const }]}>Serology</Text>
              {draft.serology.map((s) => (
                <View key={s.id} style={[styles.customLabRow, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}>
                  <View style={styles.chipsWrap}>
                    {SEROLOGY_TESTS.map((t) => (
                      <Chip colors={colors} scaledFont={scaledFont} key={t} label={t} active={s.test === t} onPress={() => setDraft({ ...draft, serology: draft.serology.map((x) => (x.id === s.id ? { ...x, test: t } : x)) })} />
                    ))}
                  </View>
                  <Field colors={colors} scaledFont={scaledFont} label="Result" value={s.result} onChangeText={(result) => setDraft({ ...draft, serology: draft.serology.map((x) => (x.id === s.id ? { ...x, result } : x)) })} placeholder="Positive / Negative / titer" />
                  <TouchableOpacity onPress={() => setDraft({ ...draft, serology: draft.serology.filter((x) => x.id !== s.id) })} style={styles.removeBtn}>
                    <Trash2 color="#EF4444" size={14} />
                    <Text style={{ color: "#EF4444", fontWeight: "900" as const, fontSize: 11 }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={() => setDraft({ ...draft, serology: [...draft.serology, { id: localId(), test: "COVID", result: "" }] })} style={[styles.addRowBtn, { borderColor: colors.border }]}>
                <Plus color="#8B5CF6" size={14} />
                <Text style={[styles.voiceText, { color: "#8B5CF6", fontSize: scaledFont(12) }]}>Add serology test</Text>
              </TouchableOpacity>
            </ExpPanel>

            <ExpPanel colors={colors} scaledFont={scaledFont} isDark={isDark} title="PFTs" icon={<BookMarked color="#0D9488" size={14} />} accent="#0D9488" isOpen={openPanel === "pft"} onToggle={() => togglePanel("pft")} images={getPanelImages("pft")} onAddImage={() => void addPanelImage("pft")} onRemoveImage={(uri) => removePanelImage("pft", uri)}>
              <Field colors={colors} scaledFont={scaledFont} label="PFT summary / linked interpretation" value={draft.pftSummary} onChangeText={(pftSummary) => setDraft({ ...draft, pftSummary })} multiline placeholder="Paste interpretation or note a linked PulmoLab PFT result." />
              <TouchableOpacity onPress={() => router.push("/pft" as never)} style={[styles.addRowBtn, { borderColor: colors.border }]}>
                <BookMarked color="#0D9488" size={14} />
                <Text style={[styles.voiceText, { color: "#0D9488", fontSize: scaledFont(12) }]}>Open PFT interpreter</Text>
              </TouchableOpacity>
            </ExpPanel>

            <ExpPanel colors={colors} scaledFont={scaledFont} isDark={isDark} title="ECG findings" icon={<HeartPulse color="#3B82F6" size={14} />} accent="#3B82F6" isOpen={openPanel === "ecg"} onToggle={() => togglePanel("ecg")} images={getPanelImages("ecg")} onAddImage={() => void addPanelImage("ecg")} onRemoveImage={(uri) => removePanelImage("ecg", uri)}>
              <Field colors={colors} scaledFont={scaledFont} label="ECG comments / notes" value={draft.ecgFindings} onChangeText={(ecgFindings) => setDraft({ ...draft, ecgFindings })} multiline placeholder="Rate, rhythm, axis, intervals, ischemia, strain pattern, etc." />
            </ExpPanel>

            <ExpPanel colors={colors} scaledFont={scaledFont} isDark={isDark} title="Echo findings" icon={<HeartPulse color="#F97316" size={14} />} accent="#F97316" isOpen={openPanel === "echo"} onToggle={() => togglePanel("echo")} images={getPanelImages("echo")} onAddImage={() => void addPanelImage("echo")} onRemoveImage={(uri) => removePanelImage("echo", uri)}>
              <Field colors={colors} scaledFont={scaledFont} label="Echo comments / notes" value={draft.echoFindings} onChangeText={(echoFindings) => setDraft({ ...draft, echoFindings })} multiline placeholder="LV/RV function, valves, RVSP, pericardial findings, etc." />
            </ExpPanel>

            <ExpPanel colors={colors} scaledFont={scaledFont} isDark={isDark} title="Pleural fluid analysis" icon={<Gauge color="#F59E0B" size={14} />} accent="#F59E0B" isOpen={openPanel === "pleural"} onToggle={() => togglePanel("pleural")} images={getPanelImages("pleural")} onAddImage={() => void addPanelImage("pleural")} onRemoveImage={(uri) => removePanelImage("pleural", uri)}>
              <View style={styles.row2}>
                <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="Pleural pH" value={draft.pleuralPh} onChangeText={(pleuralPh) => setDraft({ ...draft, pleuralPh })} keyboardType="numeric" /></View>
                <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="Pleural LDH" value={draft.pleuralLdh} onChangeText={(pleuralLdh) => setDraft({ ...draft, pleuralLdh })} keyboardType="numeric" /></View>
              </View>
              <View style={styles.row2}>
                <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="Serum LDH" value={draft.serumLdh} onChangeText={(serumLdh) => setDraft({ ...draft, serumLdh })} keyboardType="numeric" /></View>
                <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="Pleural protein" value={draft.pleuralProtein} onChangeText={(pleuralProtein) => setDraft({ ...draft, pleuralProtein })} keyboardType="numeric" /></View>
              </View>
              <View style={styles.row2}>
                <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="Serum protein" value={draft.serumProtein} onChangeText={(serumProtein) => setDraft({ ...draft, serumProtein })} keyboardType="numeric" /></View>
                <View style={styles.flexOne}><Field colors={colors} scaledFont={scaledFont} label="Pleural glucose" value={draft.pleuralGlucose} onChangeText={(pleuralGlucose) => setDraft({ ...draft, pleuralGlucose })} keyboardType="numeric" /></View>
              </View>
              <Field colors={colors} scaledFont={scaledFont} label="Pleural cells" value={draft.pleuralCells} onChangeText={(pleuralCells) => setDraft({ ...draft, pleuralCells })} placeholder="Differential count" />
              <View style={[styles.calcCard, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}>
                <Text style={[styles.calcTitle, { color: colors.text, fontSize: scaledFont(13) }]}>Light's criteria</Text>
                <Text style={[styles.calcSub, { color: colors.textMuted, fontSize: scaledFont(11) }]}>{lightsCriteria(draft)}</Text>
              </View>
            </ExpPanel>

            <ExpPanel colors={colors} scaledFont={scaledFont} isDark={isDark} title="Bronchoscopy report" icon={<Stethoscope color="#10B981" size={14} />} accent="#10B981" isOpen={openPanel === "broncho"} onToggle={() => togglePanel("broncho")} images={getPanelImages("broncho")} onAddImage={() => void addPanelImage("broncho")} onRemoveImage={(uri) => removePanelImage("broncho", uri)}>
              <Field colors={colors} scaledFont={scaledFont} label="Bronchoscopy comments / notes" value={draft.bronchoscopyReport} onChangeText={(bronchoscopyReport) => setDraft({ ...draft, bronchoscopyReport })} multiline placeholder="Findings, sampling done, complications, etc." />
            </ExpPanel>

            <ExpPanel colors={colors} scaledFont={scaledFont} isDark={isDark} title="Lung biopsy result" icon={<FileText color="#EF4444" size={14} />} accent="#EF4444" isOpen={openPanel === "biopsy"} onToggle={() => togglePanel("biopsy")} images={getPanelImages("biopsy")} onAddImage={() => void addPanelImage("biopsy")} onRemoveImage={(uri) => removePanelImage("biopsy", uri)}>
              <Field colors={colors} scaledFont={scaledFont} label="Biopsy comments / pathology" value={draft.biopsyResult} onChangeText={(biopsyResult) => setDraft({ ...draft, biopsyResult })} multiline placeholder="Histology, immunostains, molecular results, etc." />
            </ExpPanel>
          </ExpSection>
          </View>

          <View onLayout={(e) => { sectionYRef.current["D"] = e.nativeEvent.layout.y; }}>
          <ExpSection colors={colors} scaledFont={scaledFont} title="D. Imaging & Media" icon={<ImageIcon color="#8B5CF6" size={18} />} isOpen={openMainSection === "D"} onToggle={() => toggleMain("D")}>
            <View style={[styles.uploadZone, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}>
              <UploadCloud color="#8B5CF6" size={26} />
              <Text style={[styles.uploadTitle, { color: colors.text, fontSize: scaledFont(13) }]}>Attach images inside each investigation panel</Text>
              <Text style={[styles.uploadSub, { color: colors.textMuted, fontSize: scaledFont(11) }]}>Use the panels in section C to attach X-Ray, CT, bronchoscopy, ECG, or pathology images.</Text>
            </View>
            <View style={styles.mediaActions}>
              <ActionPill colors={colors} scaledFont={scaledFont} icon={<Camera color="#3B82F6" size={14} />} text="Image viewer" onPress={() => void pickGeneralMedia("image")} />
              <ActionPill colors={colors} scaledFont={scaledFont} icon={<Video color="#0D9488" size={14} />} text="CT video" onPress={() => void pickGeneralMedia("video")} />
              <ActionPill colors={colors} scaledFont={scaledFont} icon={<FileText color="#F59E0B" size={14} />} text="PDF report" onPress={() => void pickGeneralMedia("pdf")} />
            </View>
            {generalMedia.length ? (
              <View style={styles.panelImageRow}>
                {generalMedia.map((m) => (
                  <View key={m.uri} style={styles.thumbWrap}>
                    {m.type === "image" ? (
                      <Image source={{ uri: m.uri }} style={styles.thumb} />
                    ) : (
                      <View style={[styles.thumb, { backgroundColor: colors.bgElevated, alignItems: "center", justifyContent: "center" }]}>
                        {m.type === "video" ? <Video color={"#0D9488"} size={22} /> : <FileText color={"#F59E0B"} size={22} />}
                        <Text style={{ color: colors.textMuted, fontSize: 9, marginTop: 2 }} numberOfLines={1}>{m.name ?? m.type.toUpperCase()}</Text>
                      </View>
                    )}
                    <TouchableOpacity onPress={() => setGeneralMedia((prev) => prev.filter((x) => x.uri !== m.uri))} style={styles.thumbClose}>
                      <X color="#fff" size={12} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}
          </ExpSection>
          </View>

          <View onLayout={(e) => { sectionYRef.current["E"] = e.nativeEvent.layout.y; }}>
          <ExpSection colors={colors} scaledFont={scaledFont} title="E. Assessment, Management & Teaching" icon={<BookMarked color="#0D9488" size={18} />} isOpen={openMainSection === "E"} onToggle={() => toggleMain("E")}>
            <Field colors={colors} scaledFont={scaledFont} label="My Differential diagnosis" value={draft.finalDiagnosis} onChangeText={(finalDiagnosis) => setDraft({ ...draft, finalDiagnosis })} multiline placeholder="List your differential diagnoses" />
            <Field colors={colors} scaledFont={scaledFont} label="My top diagnosis" value={draft.topDiagnosis ?? ""} onChangeText={(topDiagnosis) => setDraft({ ...draft, topDiagnosis })} placeholder="Your single most likely diagnosis" />
            <Field colors={colors} scaledFont={scaledFont} label="Management & Outcome" value={draft.managementPlan} onChangeText={(managementPlan) => setDraft({ ...draft, managementPlan })} multiline placeholder="Final plan of treatment, follow-up schedule, escalation, referrals, monitoring..." />
            <Field colors={colors} scaledFont={scaledFont} label="Key learning point" value={draft.learningPoint} onChangeText={(learningPoint) => setDraft({ ...draft, learningPoint })} multiline />
          </ExpSection>
          </View>

          <TouchableOpacity onPress={handlePublish} activeOpacity={0.88} style={[styles.publishBtn, { backgroundColor: PURPLE }]}>
            <Share2 color="#fff" size={18} />
            <Text style={styles.publishBtnText}>Share for 2nd Opinion</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  // === Detail view (Case View Screen) ===
  const renderDetail = () => {
    if (!selectedCase) return null;
    const c = selectedCase;
    const cp = (c.clinical_presentation ?? {}) as Record<string, unknown>;
    const vitals = (cp.vitals ?? {}) as Record<string, string>;
    const labsData = (c.labs ?? {}) as Record<string, unknown>;
    const abgData = (c.abg ?? {}) as Record<string, string>;
    const micro = (c.microbiology ?? {}) as Record<string, unknown>;
    const pleural = (micro.pleural ?? {}) as Record<string, string>;
    const mgmtData = (c.management ?? {}) as { plan?: string; learning_point?: string; top_diagnosis?: string };
    const panelImages = (cp.panel_images ?? {}) as Record<string, string[]>;
    const generalM = (cp.general_media ?? []) as GeneralMediaItem[];
    const customLabs = (labsData.custom_labs as CustomLab[]) ?? [];
    const cultures = (micro.cultures as CultureEntry[]) ?? [];
    const serology = (micro.serology as SerologyEntry[]) ?? [];
    const tline = (cp.timeline as TimelineEntry[]) ?? [];
    const symptoms = (cp.symptoms as string[]) ?? [];

    const sectionTitle = (n: number, label: string) => (
      <View style={styles.sectionTitleRow}>
        <View style={[styles.sectionNumBubble, { backgroundColor: PURPLE }]}>
          <Text style={styles.sectionNumText}>{n}</Text>
        </View>
        <Text style={[styles.sectionTitleText, { color: colors.text, fontSize: scaledFont(14) }]}>{label}</Text>
      </View>
    );

    // Build patient profile narrative
    const profileParts: string[] = [];
    if (c.patient_age) profileParts.push(`A ${c.patient_age}-year-old`);
    if (c.patient_gender) profileParts.push(c.patient_gender === "Male" ? "male" : "female");
    profileParts.push("patient");
    let narrative = profileParts.join(" ");
    if (cp.occupation) narrative += `, ${cp.occupation as string}`;
    if (c.smoking_status) narrative += `, ${c.smoking_status.toLowerCase()}`;
    const co = (c.comorbidities ?? []).filter(Boolean);
    if (co.length) narrative += `, known case of ${co.join(", ")}`;
    const cc = (cp.chief_complaint as string) ?? "";
    const dur = (cp.duration as string) ?? "";
    if (cc) narrative += `, presented with ${cc.toLowerCase()}`;
    if (dur) narrative += ` for ${dur}`;
    narrative += ".";

    // Clinical Presentation narrative
    const sympList = symptoms.length ? symptoms.join(", ") : cc;
    const cpNarrative = `The patient presented with ${dur ? `a ${dur} history of ` : ""}${cc || "the chief complaint"}${sympList && sympList !== cc ? `, reporting ${sympList.toLowerCase()}` : ""}.`;

    // Imaging tabs: panels with images + general media grouped
    const PANEL_LABELS: Record<string, string> = {
      autoimmune: "Autoimmune", abg: "ABG", micro: "Microbiology", pft: "PFT",
      ecg: "ECG", echo: "Echo", pleural: "Pleural", broncho: "Bronchoscopy", biopsy: "Biopsy",
    };
    const imagingCats: { key: string; label: string; items: { uri: string; caption?: string; type: "image" | "video" | "pdf" }[] }[] = [];
    Object.entries(panelImages).forEach(([k, uris]) => {
      if (uris && uris.length) {
        imagingCats.push({
          key: k,
          label: PANEL_LABELS[k] ?? k,
          items: uris.map((u) => ({ uri: u, type: "image", caption: PANEL_LABELS[k] ?? k })),
        });
      }
    });
    if (generalM.length) {
      imagingCats.push({
        key: "general",
        label: "Other",
        items: generalM.map((g) => ({ uri: g.uri, type: g.type, caption: g.name })),
      });
    }
    if (imagingCats.length && !imagingTab) {
      // pick first
    }
    const activeTabKey = imagingTab && imagingCats.find((x) => x.key === imagingTab) ? imagingTab : (imagingCats[0]?.key ?? "");
    const activeCat = imagingCats.find((x) => x.key === activeTabKey);

    // ABG
    const pfNum = c.pf_ratio ?? pfBadge(abgData.pao2 ?? "", abgData.fio2 ?? "").value;
    const abgInterp = abgInterpretation(abgData);

    // Differentials
    const diffs = c.differentials ?? [];

    const isOwner = c.user_id === user?.id;
    const topLevelComments = comments.filter((cm) => !cm.parent_comment_id);
    const repliesByParent = new Map<string, SecondOpinionComment[]>();
    comments
      .filter((cm) => cm.parent_comment_id)
      .forEach((cm) => {
        const arr = repliesByParent.get(cm.parent_comment_id as string) ?? [];
        arr.push(cm);
        repliesByParent.set(cm.parent_comment_id as string, arr);
      });

    // labs to display
    const labRows: { key: LabKey; raw: string }[] = [];
    (Object.keys(LAB_META) as LabKey[]).forEach((k) => {
      const raw = (labsData[k] as string) ?? "";
      if (raw && String(raw).trim() !== "") labRows.push({ key: k, raw: String(raw) });
    });

    let sectionCounter = 0;
    const nextN = () => ++sectionCounter;
    void nextN;

    return (
      <KeyboardAvoidingView style={styles.screenFill} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={80}>
        <ScrollView contentContainerStyle={[styles.detailScroll, { paddingBottom: 120 }]} showsVerticalScrollIndicator={false}>
          {/* Title card with key question */}
          <View style={[styles.titleCard, { backgroundColor: `${PURPLE}12`, borderColor: PURPLE }]}>
            <View style={styles.questionLabelRow}>
              <Sparkles color={PURPLE} size={14} />
              <Text style={[styles.questionLabel, { color: PURPLE, fontSize: scaledFont(10) }]}>2ND OPINION QUESTION</Text>
              <View style={styles.flexOne} />
              <StatusBadge status={c.status} />
            </View>
            <Text style={[styles.titleQuestion, { color: colors.text, fontSize: scaledFont(18) }]}>“{c.key_question}”
            </Text>
            <View style={styles.titleAuthorRow}>
              <View style={[styles.smallAvatar, { backgroundColor: PURPLE }]}>
                <Text style={styles.smallAvatarText}>{(c.author_name ?? "U").charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={[styles.titleAuthor, { color: colors.text, fontSize: scaledFont(12) }]} numberOfLines={1}>
                {c.author_name ?? "Anonymous"} · <Text style={{ color: colors.textMuted }}>{relativeTime(c.created_at)}</Text>
              </Text>
              {c.visibility === "private" ? (
                <View style={[styles.privateBadge, { backgroundColor: "rgba(139,92,246,0.16)" }]}>
                  <Lock color={PURPLE} size={10} />
                  <Text style={[styles.privateBadgeText, { color: PURPLE, fontSize: scaledFont(9) }]}>PRIVATE</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* SECTION 1: PATIENT PROFILE */}
          <View style={[styles.caseSection, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            {sectionTitle(1, "Patient Profile")}
            <Text style={[styles.narrativeText, { color: colors.text, fontSize: scaledFont(13) }]}>{narrative}</Text>
            {cp.hospital ? (
              <Text style={[styles.metaLine, { color: colors.textMuted, fontSize: scaledFont(11) }]}>Hospital: {cp.hospital as string}</Text>
            ) : null}
          </View>

          {/* SECTION 2: CLINICAL PRESENTATION */}
          {(cc || cp.history || tline.length || vitals.bp || vitals.hr) ? (
            <View style={[styles.caseSection, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              {sectionTitle(2, "Clinical Presentation")}
              <Text style={[styles.narrativeText, { color: colors.text, fontSize: scaledFont(13) }]}>{cpNarrative}</Text>
              {cc ? (
                <View style={styles.subSection}>
                  <Text style={[styles.subSectionTitle, { color: colors.text, fontSize: scaledFont(13) }]}>Chief Complaint</Text>
                  <Text style={[styles.subSectionBody, { color: colors.text, fontSize: scaledFont(13) }]}>{cc}{dur ? ` · ${dur}` : ""}</Text>
                </View>
              ) : null}
              {cp.history ? (
                <View style={styles.subSection}>
                  <Text style={[styles.subSectionTitle, { color: colors.text, fontSize: scaledFont(13) }]}>History of Present Illness</Text>
                  <Text style={[styles.subSectionBody, { color: colors.text, fontSize: scaledFont(13) }]}>{cp.history as string}</Text>
                </View>
              ) : null}
              {tline.length ? (
                <View style={styles.subSection}>
                  <Text style={[styles.subSectionTitle, { color: colors.text, fontSize: scaledFont(13) }]}>Timeline of Events</Text>
                  <View style={styles.timelineWrap}>
                    {tline.map((t, i) => (
                      <View key={t.id} style={styles.timelineItem}>
                        <View style={styles.timelineLeft}>
                          <View style={[styles.timelineDotBig, { backgroundColor: PURPLE }]} />
                          {i < tline.length - 1 ? <View style={[styles.timelineLine, { backgroundColor: `${PURPLE}55` }]} /> : null}
                        </View>
                        <View style={styles.timelineContent}>
                          <Text style={[styles.timelineDate, { color: PURPLE, fontSize: scaledFont(12) }]}>{t.date || `Step ${i + 1}`}</Text>
                          <Text style={[styles.timelineEvent, { color: colors.text, fontSize: scaledFont(13) }]}>{t.event}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              {(vitals.gcs || vitals.bp || vitals.hr || vitals.rr || vitals.spo2_air || vitals.spo2_o2) ? (
                <View style={styles.subSection}>
                  <Text style={[styles.subSectionTitle, { color: colors.text, fontSize: scaledFont(13) }]}>Physical Examination</Text>
                  <View style={[styles.vitalsCard, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
                    <View style={styles.vitalsRow}>
                      {vitals.gcs ? <VitalCell colors={colors} scaledFont={scaledFont} label="GCS" value={vitals.gcs} /> : null}
                      {vitals.bp ? <VitalCell colors={colors} scaledFont={scaledFont} label="BP" value={vitals.bp} /> : null}
                      {vitals.hr ? <VitalCell colors={colors} scaledFont={scaledFont} label="HR" value={vitals.hr} /> : null}
                      {vitals.rr ? <VitalCell colors={colors} scaledFont={scaledFont} label="RR" value={vitals.rr} /> : null}
                      {vitals.spo2_air ? <VitalCell colors={colors} scaledFont={scaledFont} label="SpO₂ RA" value={`${vitals.spo2_air}%`} /> : null}
                      {vitals.spo2_o2 ? <VitalCell colors={colors} scaledFont={scaledFont} label={`SpO₂ ${vitals.o2_device ?? "O₂"}`} value={`${vitals.spo2_o2}%`} /> : null}
                    </View>
                  </View>
                  {cp.exam ? (
                    <Text style={[styles.subSectionBody, { color: colors.text, fontSize: scaledFont(13), marginTop: 8 }]}>{cp.exam as string}</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {/* SECTION 3: INVESTIGATIONS */}
          {(labRows.length || customLabs.length || abgData.ph || cultures.length || serology.length || pleural.ph || micro.pft_summary || micro.ecg || micro.echo || micro.bronchoscopy || micro.biopsy) ? (
            <View style={[styles.caseSection, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              {sectionTitle(3, "Investigations")}
              {labRows.length || customLabs.length ? (
                <View style={styles.subSection}>
                  <Text style={[styles.subSectionTitle, { color: colors.text, fontSize: scaledFont(13) }]}>Laboratory Results</Text>
                  <View style={[styles.labTable, { borderColor: colors.border }]}>
                    <View style={[styles.labRowHeader, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
                      <Text style={[styles.labColParam, { color: colors.textMuted, fontSize: scaledFont(11) }]}>Parameter</Text>
                      <Text style={[styles.labColVal, { color: colors.textMuted, fontSize: scaledFont(11) }]}>Value</Text>
                      <Text style={[styles.labColStatus, { color: colors.textMuted, fontSize: scaledFont(11) }]}>Status</Text>
                    </View>
                    {labRows.map((row) => {
                      const status = getLabStatus(row.key, row.raw);
                      const meta = LAB_META[row.key];
                      const color = labStatusColor(status);
                      return (
                        <View key={row.key} style={[styles.labRow, { borderColor: colors.border }]}>
                          <Text style={[styles.labColParam, { color: colors.text, fontSize: scaledFont(12) }]}>{meta.label}</Text>
                          <Text style={[styles.labColVal, { color: colors.text, fontSize: scaledFont(12) }]}>{row.raw}<Text style={{ color: colors.textMuted, fontSize: scaledFont(10) }}>{` ${meta.unit}`}</Text></Text>
                          <View style={styles.labColStatus}>
                            <View style={[styles.labStatusPill, { backgroundColor: `${color}22` }]}>
                              {status === "high" ? <TrendingUp color={color} size={11} /> : status === "low" ? <TrendingDown color={color} size={11} /> : <CheckCircle2 color={color} size={11} />}
                              <Text style={[styles.labStatusText, { color, fontSize: scaledFont(10) }]}>{status?.toUpperCase() ?? "—"}</Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                    {customLabs.map((lab) => (
                      <View key={lab.id} style={[styles.labRow, { borderColor: colors.border }]}>
                        <Text style={[styles.labColParam, { color: colors.text, fontSize: scaledFont(12) }]}>{lab.name || "—"}</Text>
                        <Text style={[styles.labColVal, { color: colors.text, fontSize: scaledFont(12) }]}>{lab.value}<Text style={{ color: colors.textMuted, fontSize: scaledFont(10) }}>{lab.unit ? ` ${lab.unit}` : ""}</Text></Text>
                        <Text style={[styles.labColStatus, { color: colors.textMuted, fontSize: scaledFont(10) }]}>{lab.normalRange || "—"}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {(abgData.ph || abgData.paco2 || abgData.pao2 || abgData.hco3) ? (
                <View style={[styles.abgCard, { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "#EF4444" }]}>
                  <View style={styles.abgHeaderRow}>
                    <Activity color="#EF4444" size={16} />
                    <Text style={[styles.abgHeader, { color: "#EF4444", fontSize: scaledFont(12) }]}>ARTERIAL BLOOD GAS</Text>
                  </View>
                  <View style={styles.abgGrid}>
                    {abgData.ph ? <ABGCell colors={colors} scaledFont={scaledFont} label="pH" value={abgData.ph} normal={Number(abgData.ph) >= 7.35 && Number(abgData.ph) <= 7.45} /> : null}
                    {abgData.paco2 ? <ABGCell colors={colors} scaledFont={scaledFont} label="PaCO₂" value={abgData.paco2} normal={Number(abgData.paco2) >= 35 && Number(abgData.paco2) <= 45} /> : null}
                    {abgData.pao2 ? <ABGCell colors={colors} scaledFont={scaledFont} label="PaO₂" value={abgData.pao2} normal={Number(abgData.pao2) >= 80} /> : null}
                    {abgData.hco3 ? <ABGCell colors={colors} scaledFont={scaledFont} label="HCO₃" value={abgData.hco3} normal={Number(abgData.hco3) >= 22 && Number(abgData.hco3) <= 26} /> : null}
                    {abgData.spo2 ? <ABGCell colors={colors} scaledFont={scaledFont} label="SpO₂" value={`${abgData.spo2}%`} normal={Number(abgData.spo2) >= 92} /> : null}
                    {abgData.fio2 ? <ABGCell colors={colors} scaledFont={scaledFont} label="FiO₂" value={abgData.fio2} normal={true} /> : null}
                    {abgData.lactate ? <ABGCell colors={colors} scaledFont={scaledFont} label="Lactate" value={abgData.lactate} normal={Number(abgData.lactate) < 2} /> : null}
                  </View>
                  {pfNum ? (
                    <View style={[styles.pfBanner, { backgroundColor: "rgba(239,68,68,0.16)" }]}>
                      <Text style={[styles.pfBannerText, { color: "#EF4444", fontSize: scaledFont(12) }]}>P/F Ratio: {pfNum} · {pfSeverity(pfNum)}</Text>
                    </View>
                  ) : null}
                  {abgInterp ? (
                    <Text style={[styles.abgInterpText, { color: colors.text, fontSize: scaledFont(12) }]}>
                      <Text style={{ fontWeight: "800" as const }}>Interpretation: </Text>{abgInterp}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {(cultures.length || micro.gram_stain || micro.sensitivity || serology.length) ? (
                <View style={styles.subSection}>
                  <Text style={[styles.subSectionTitle, { color: colors.text, fontSize: scaledFont(13) }]}>Microbiology</Text>
                  {cultures.map((cu) => {
                    const isNeg = (cu.result ?? "").toLowerCase().includes("negative");
                    const color = isNeg ? "#10B981" : "#F97316";
                    return (
                      <View key={cu.id} style={[styles.microCard, { borderColor: color, backgroundColor: `${color}10` }]}>
                        <Text style={[styles.microTitle, { color: colors.text, fontSize: scaledFont(12) }]}>{cu.source} culture</Text>
                        <Text style={[styles.microBody, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>{cu.organism || "—"}{cu.result ? ` — ${cu.result}` : ""}</Text>
                      </View>
                    );
                  })}
                  {serology.map((s) => {
                    const pos = (s.result ?? "").toLowerCase().includes("positive");
                    const color = pos ? "#EF4444" : "#10B981";
                    return (
                      <View key={s.id} style={[styles.microCard, { borderColor: color, backgroundColor: `${color}10` }]}>
                        <Text style={[styles.microTitle, { color: colors.text, fontSize: scaledFont(12) }]}>{s.test}</Text>
                        <Text style={[styles.microBody, { color, fontSize: scaledFont(12) }]}>{s.result || "—"}</Text>
                      </View>
                    );
                  })}
                  {micro.gram_stain ? (
                    <Text style={[styles.subSectionBody, { color: colors.text, fontSize: scaledFont(12) }]}>
                      <Text style={{ fontWeight: "800" as const }}>Gram stain: </Text>{micro.gram_stain as string}
                    </Text>
                  ) : null}
                  {micro.sensitivity ? (
                    <Text style={[styles.subSectionBody, { color: colors.text, fontSize: scaledFont(12) }]}>
                      <Text style={{ fontWeight: "800" as const }}>Sensitivity: </Text>{micro.sensitivity as string}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {(pleural.ph || pleural.protein || pleural.ldh) ? (
                <View style={styles.subSection}>
                  <Text style={[styles.subSectionTitle, { color: colors.text, fontSize: scaledFont(13) }]}>Pleural Fluid</Text>
                  {(() => {
                    const pp = Number(pleural.protein), sp = Number(pleural.serum_protein);
                    const pl = Number(pleural.ldh), sl = Number(pleural.serum_ldh);
                    const ok = [pp, sp, pl, sl].every((x) => Number.isFinite(x) && x > 0);
                    if (!ok) return null;
                    const isEx = pp / sp > 0.5 || pl / sl > 0.6;
                    const color = isEx ? "#F97316" : "#3B82F6";
                    return (
                      <View style={[styles.lightBadge, { backgroundColor: `${color}22`, borderColor: color }]}>
                        <Text style={[styles.lightBadgeText, { color, fontSize: scaledFont(12) }]}>{isEx ? "EXUDATE" : "TRANSUDATE"} (Light's criteria)</Text>
                      </View>
                    );
                  })()}
                  <View style={styles.snapshotGrid}>
                    {pleural.ph ? <Stat colors={colors} scaledFont={scaledFont} label="pH" value={pleural.ph} /> : null}
                    {pleural.glucose ? <Stat colors={colors} scaledFont={scaledFont} label="Glucose" value={pleural.glucose} /> : null}
                    {pleural.protein ? <Stat colors={colors} scaledFont={scaledFont} label="Protein" value={pleural.protein} /> : null}
                    {pleural.ldh ? <Stat colors={colors} scaledFont={scaledFont} label="LDH" value={pleural.ldh} /> : null}
                  </View>
                </View>
              ) : null}

              {(micro.pft_summary || micro.ecg || micro.echo || micro.bronchoscopy || micro.biopsy) ? (
                <View style={styles.subSection}>
                  {micro.pft_summary ? <LabeledBlock colors={colors} scaledFont={scaledFont} label="PFTs" body={micro.pft_summary as string} /> : null}
                  {micro.ecg ? <LabeledBlock colors={colors} scaledFont={scaledFont} label="ECG" body={micro.ecg as string} /> : null}
                  {micro.echo ? <LabeledBlock colors={colors} scaledFont={scaledFont} label="Echo" body={micro.echo as string} /> : null}
                  {micro.bronchoscopy ? <LabeledBlock colors={colors} scaledFont={scaledFont} label="Bronchoscopy" body={micro.bronchoscopy as string} /> : null}
                  {micro.biopsy ? <LabeledBlock colors={colors} scaledFont={scaledFont} label="Biopsy / Pathology" body={micro.biopsy as string} /> : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {/* SECTION 4: IMAGING & MEDIA */}
          {imagingCats.length ? (
            <View style={[styles.caseSection, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              {sectionTitle(4, "Imaging & Media")}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
                {imagingCats.map((cat) => {
                  const active = activeTabKey === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      onPress={() => { haptic(); setImagingTab(cat.key); }}
                      activeOpacity={0.85}
                      style={[styles.imgTab, { backgroundColor: active ? PURPLE : colors.bgElevated, borderColor: active ? PURPLE : colors.border }]}
                    >
                      <Text style={[styles.imgTabText, { color: active ? "#fff" : colors.textSecondary, fontSize: scaledFont(11) }]}>
                        {cat.label} · {cat.items.length}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {activeCat ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbsScroll}>
                  {activeCat.items.map((it, idx) => {
                    if (it.type === "pdf") {
                      return (
                        <TouchableOpacity
                          key={it.uri}
                          activeOpacity={0.85}
                          onPress={() => { void openPdf(it.uri); }}
                          style={[styles.pdfCard, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}
                        >
                          <FileText color="#F59E0B" size={28} />
                          <Text style={[styles.pdfName, { color: colors.text, fontSize: scaledFont(11) }]} numberOfLines={2}>{it.caption ?? "PDF"}</Text>
                        </TouchableOpacity>
                      );
                    }
                    return (
                      <TouchableOpacity
                        key={it.uri}
                        activeOpacity={0.88}
                        onPress={() => {
                          if (it.type === "video") {
                            openVideoPlayer(it.uri, it.caption);
                          } else {
                            openImageViewer(activeCat.items.filter((x) => x.type === "image").map((x) => ({ uri: x.uri, caption: x.caption })), Math.max(0, activeCat.items.filter((x) => x.type === "image").findIndex((x) => x.uri === it.uri)));
                          }
                        }}
                        style={[styles.bigThumbWrap, { borderColor: colors.border }]}
                      >
                        {it.type === "video" ? (
                          <View style={[styles.videoPlaceholder, { backgroundColor: "#000" }]}>
                            <Video color="#fff" size={30} />
                            <View style={styles.videoPlayBadge}><Text style={styles.videoPlayBadgeText}>▶</Text></View>
                          </View>
                        ) : (
                          <Image source={{ uri: it.uri }} style={styles.bigThumb} />
                        )}
                        {it.caption ? (
                          <Text style={[styles.thumbCaption, { color: colors.textMuted, fontSize: scaledFont(10) }]} numberOfLines={1}>{it.caption}</Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : null}
            </View>
          ) : null}

          {/* SECTION 5: CLINICAL ASSESSMENT */}
          {(diffs.length || c.final_impression || mgmtData.top_diagnosis) ? (
            <View style={[styles.caseSection, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              {sectionTitle(5, "Clinical Assessment")}
              {(c.final_impression || mgmtData.top_diagnosis) ? (
                <View style={styles.subSection}>
                  <Text style={[styles.subSectionTitle, { color: colors.text, fontSize: scaledFont(13) }]}>My Differential Diagnosis</Text>
                  <Text style={[styles.subSectionBody, { color: colors.text, fontSize: scaledFont(13) }]}>{c.final_impression || "—"}</Text>
                </View>
              ) : null}
              {mgmtData.top_diagnosis ? (
                <View style={[styles.topDxCard, { backgroundColor: `${PURPLE}1A`, borderColor: PURPLE }]}>
                  <Text style={[styles.topDxLabel, { color: PURPLE, fontSize: scaledFont(10) }]}>MY TOP DIAGNOSIS</Text>
                  <Text style={[styles.topDxValue, { color: colors.text, fontSize: scaledFont(15) }]}>{mgmtData.top_diagnosis}</Text>
                </View>
              ) : null}
              {diffs.length ? (
                <View style={styles.subSection}>
                  <Text style={[styles.subSectionTitle, { color: colors.text, fontSize: scaledFont(13) }]}>Ranked Differentials</Text>
                  {diffs.map((d) => (
                    <View key={`d-${d.rank}`} style={[styles.diffCard, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}>
                      <View style={[styles.diffRank, { backgroundColor: PURPLE }]}>
                        <Text style={styles.diffRankText}>{d.rank}</Text>
                      </View>
                      <View style={styles.flexOne}>
                        <Text style={[styles.diffDx, { color: colors.text, fontSize: scaledFont(13) }]}>{d.diagnosis}</Text>
                        {d.reasoning ? <Text style={[styles.diffReason, { color: colors.textMuted, fontSize: scaledFont(11) }]}>{d.reasoning}</Text> : null}
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {/* SECTION 6: MANAGEMENT & OUTCOME */}
          {(mgmtData.plan || mgmtData.learning_point) ? (
            <View style={[styles.caseSection, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              {sectionTitle(6, "Management & Outcome")}
              {mgmtData.plan ? (
                <Text style={[styles.narrativeText, { color: colors.text, fontSize: scaledFont(13) }]}>{mgmtData.plan}</Text>
              ) : null}
              {mgmtData.learning_point ? (
                <View style={[styles.learningCard, { backgroundColor: `${PURPLE}14`, borderColor: PURPLE }]}>
                  <ClipboardList color={PURPLE} size={14} />
                  <View style={styles.flexOne}>
                    <Text style={[styles.learningLabel, { color: PURPLE, fontSize: scaledFont(10) }]}>KEY LEARNING POINT</Text>
                    <Text style={[styles.learningBody, { color: colors.text, fontSize: scaledFont(12) }]}>{mgmtData.learning_point}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.commentsHeader}>
            <MessageCircle color={colors.textMuted} size={16} />
            <Text style={[styles.commentsTitle, { color: colors.text, fontSize: scaledFont(13) }]}>
              Discussion ({comments.length})
            </Text>
          </View>

          {loadingComments ? (
            <ActivityIndicator color={PURPLE} style={{ marginVertical: 20 }} />
          ) : topLevelComments.length === 0 ? (
            <View style={[styles.commentEmpty, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.commentEmptyText, { color: colors.textMuted, fontSize: scaledFont(12) }]}>
                No comments yet. Be the first to share your opinion.
              </Text>
            </View>
          ) : (
            topLevelComments.map((cm) => (
              <View key={cm.id}>
                {renderCommentCard(cm, false, isOwner, c.user_id)}
                {(repliesByParent.get(cm.id) ?? []).map((rep) => renderCommentCard(rep, true, isOwner, c.user_id))}
              </View>
            ))
          )}
        </ScrollView>

        <View style={[styles.commentInputBar, { backgroundColor: colors.bgCard, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
          {replyTo ? (
            <View style={styles.replyChip}>
              <Text style={[styles.replyChipText, { color: PURPLE, fontSize: scaledFont(11) }]} numberOfLines={1}>
                Replying to {replyTo.author_name}
              </Text>
              <TouchableOpacity onPress={() => setReplyTo(null)}>
                <X color={PURPLE} size={14} />
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.commentInputRow}>
            <View style={[styles.smallAvatar, { backgroundColor: PURPLE }]}>
              <Text style={styles.smallAvatarText}>{(user?.fullName ?? "U").charAt(0).toUpperCase()}</Text>
            </View>
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder={isAuthenticated ? "Write your opinion…" : "Sign in to comment"}
              placeholderTextColor={colors.textDim}
              editable={isAuthenticated && !posting}
              multiline
              maxLength={1000}
              style={[styles.commentInput, { backgroundColor: colors.bgElevated, color: colors.text, fontSize: scaledFont(13) }]}
            />
            <TouchableOpacity
              onPress={() => {
                if (!isAuthenticated) {
                  router.push("/login" as never);
                  return;
                }
                void handleSubmitComment();
              }}
              disabled={posting || !commentText.trim()}
              style={[styles.sendBtn, { backgroundColor: commentText.trim() ? PURPLE : colors.bgElevated }]}
            >
              {posting ? <ActivityIndicator color="#fff" size="small" /> : <Send color={commentText.trim() ? "#fff" : colors.textMuted} size={16} />}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  };

  const renderCommentCard = (cm: SecondOpinionComment, isReply: boolean, ownerView: boolean, caseOwnerId: string) => {
    const isCaseOwner = cm.user_id === caseOwnerId;
    const isMine = cm.user_id === user?.id;
    return (
      <View
        key={cm.id}
        style={[
          styles.commentCard,
          isReply && styles.commentReply,
          { backgroundColor: colors.bgCard, borderColor: colors.border },
        ]}
      >
        <View style={styles.commentHeaderRow}>
          <View style={[styles.smallAvatar, { backgroundColor: roleColor(cm.author_role) }]}>
            <Text style={styles.smallAvatarText}>{(cm.author_name ?? "U").charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.flexOne}>
            <View style={styles.commentNameRow}>
              <Text style={[styles.commentName, { color: colors.text, fontSize: scaledFont(12) }]} numberOfLines={1}>
                {cm.author_name ?? "User"}
              </Text>
              {isCaseOwner ? (
                <View style={[styles.ownerPill, { backgroundColor: `${PURPLE}26` }]}>
                  <Text style={[styles.ownerPillText, { color: PURPLE, fontSize: scaledFont(9) }]}>CASE OWNER</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.commentTime, { color: colors.textMuted, fontSize: scaledFont(10) }]}>
              {relativeTime(cm.created_at)}{cm.is_edited ? " · edited" : ""}
            </Text>
          </View>
          {isMine ? (
            <TouchableOpacity onPress={() => handleDeleteComment(cm)} style={styles.iconBtnSm}>
              <Trash2 color="#EF4444" size={14} />
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={[styles.commentBody, { color: colors.textSecondary, fontSize: scaledFont(13) }]}>{cm.content}</Text>
        <View style={styles.commentActionsRow}>
          <TouchableOpacity
            onPress={() => handleToggleHelpful(cm)}
            disabled={isMine}
            style={[styles.commentAction, cm.helpful_by_me && { backgroundColor: `${PURPLE}1A` }]}
          >
            <ThumbsUp color={cm.helpful_by_me ? PURPLE : colors.textMuted} size={13} fill={cm.helpful_by_me ? PURPLE : "transparent"} />
            <Text style={[styles.commentActionText, { color: cm.helpful_by_me ? PURPLE : colors.textMuted, fontSize: scaledFont(11) }]}>
              Helpful ({cm.helpful_count})
            </Text>
          </TouchableOpacity>
          {!isReply ? (
            <TouchableOpacity onPress={() => setReplyTo(cm)} style={styles.commentAction}>
              <MessageCircle color={colors.textMuted} size={13} />
              <Text style={[styles.commentActionText, { color: colors.textMuted, fontSize: scaledFont(11) }]}>Reply</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  // === Modals ===
  const renderPrivacyModal = () => (
    <Modal visible={showPrivacyModal} transparent animationType="fade" onRequestClose={() => setShowPrivacyModal(false)}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={[styles.modalIcon, { backgroundColor: "rgba(239,68,68,0.16)" }]}>
            <ShieldAlert color="#EF4444" size={28} />
          </View>
          <Text style={[styles.modalTitle, { color: colors.text, fontSize: scaledFont(16) }]}>Privacy Confirmation</Text>
          <Text style={[styles.modalBody, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>
            I confirm this case contains NO patient-identifying information in compliance with PulmoLab privacy policy.
          </Text>
          <View style={styles.modalRules}>
            {["No patient name", "No hospital or facility", "No file ID", "No nationality or location"].map((r) => (
              <View key={r} style={styles.modalRuleRow}>
                <CheckCircle2 color="#10B981" size={13} />
                <Text style={[styles.modalRuleText, { color: colors.textSecondary, fontSize: scaledFont(11) }]}>{r}</Text>
              </View>
            ))}
          </View>
          <View style={styles.modalActions}>
            <TouchableOpacity onPress={() => setShowPrivacyModal(false)} style={[styles.modalBtn, { backgroundColor: colors.bgElevated }]}>
              <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmAndPublish} style={[styles.modalBtn, { backgroundColor: PURPLE }]}>
              <Text style={[styles.modalBtnText, { color: "#fff" }]}>I Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderInviteSheet = () => (
    <Modal visible={showInviteSheet} transparent animationType="slide" onRequestClose={() => setShowInviteSheet(false)}>
      <View style={styles.sheetOverlay}>
        <View style={[styles.sheetCard, { backgroundColor: colors.bgCard, borderColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.text, fontSize: scaledFont(15) }]}>Invite users</Text>
            <TouchableOpacity onPress={() => setShowInviteSheet(false)}>
              <X color={colors.textMuted} size={20} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={handleScanContacts} style={[styles.scanBtn, { borderColor: PURPLE }]} activeOpacity={0.85}>
            <UserPlus color={PURPLE} size={16} />
            <Text style={[styles.scanBtnText, { color: PURPLE, fontSize: scaledFont(12) }]}>Find from phone contacts</Text>
          </TouchableOpacity>
          <View style={[styles.searchRow, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
            <Search color={colors.textMuted} size={14} />
            <TextInput
              value={inviteSearch}
              onChangeText={runInviteSearch}
              placeholder="Search by name, phone, or email"
              placeholderTextColor={colors.textDim}
              style={[styles.searchInput, { color: colors.text, fontSize: scaledFont(12) }]}
            />
          </View>
          {invited.length ? (
            <View style={styles.invitedChipsWrap}>
              {invited.map((u) => (
                <TouchableOpacity key={`inv-${u.id}`} onPress={() => toggleInvitee(u)} style={[styles.invitedChip, { backgroundColor: `${PURPLE}26` }]}>
                  <Text style={[styles.invitedChipText, { color: PURPLE, fontSize: scaledFont(11) }]} numberOfLines={1}>
                    {u.full_name}
                  </Text>
                  <X color={PURPLE} size={11} />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <ScrollView style={{ maxHeight: 320 }}>
            {searchingInvite ? (
              <ActivityIndicator color={PURPLE} style={{ marginVertical: 24 }} />
            ) : inviteResults.length === 0 ? (
              <Text style={[styles.muted, { color: colors.textMuted, fontSize: scaledFont(11) }]}>
                {inviteSearch ? "No matches found." : "Search for users by name or phone, or scan your contacts."}
              </Text>
            ) : (
              inviteResults.map((u) => {
                const selected = !!invited.find((p) => p.id === u.id);
                return (
                  <TouchableOpacity
                    key={u.id}
                    onPress={() => toggleInvitee(u)}
                    style={[styles.userRow, { borderBottomColor: colors.border, backgroundColor: selected ? `${PURPLE}10` : "transparent" }]}
                  >
                    <View style={[styles.smallAvatar, { backgroundColor: PURPLE }]}>
                      <Text style={styles.smallAvatarText}>{u.full_name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.flexOne}>
                      <Text style={[styles.userName, { color: colors.text, fontSize: scaledFont(13) }]}>{u.full_name}</Text>
                      <Text style={[styles.userSub, { color: colors.textMuted, fontSize: scaledFont(11) }]} numberOfLines={1}>
                        {u.phone ?? u.email}
                      </Text>
                    </View>
                    {selected ? <CheckCircle2 color={PURPLE} size={18} /> : <Plus color={colors.textMuted} size={18} />}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
          <TouchableOpacity onPress={() => setShowInviteSheet(false)} style={[styles.doneBtn, { backgroundColor: PURPLE }]}>
            <Text style={styles.doneBtnText}>Done · {invited.length} invited</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderShareSheet = () => (
    <Modal visible={showShareSheet} transparent animationType="slide" onRequestClose={() => setShowShareSheet(false)}>
      <TouchableOpacity activeOpacity={1} onPress={() => setShowShareSheet(false)} style={styles.sheetOverlay}>
        <View style={[styles.sheetCard, { backgroundColor: colors.bgCard, borderColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.text, fontSize: scaledFont(15) }]}>Share case</Text>
            <TouchableOpacity onPress={() => setShowShareSheet(false)}>
              <X color={colors.textMuted} size={20} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => selectedCase && void handleShareLink(selectedCase)}
            style={[styles.shareRow, { borderColor: colors.border }]}
          >
            <Share2 color={PURPLE} size={18} />
            <View style={styles.flexOne}>
              <Text style={[styles.shareTitle, { color: colors.text, fontSize: scaledFont(13) }]}>Share link / message</Text>
              <Text style={[styles.shareSub, { color: colors.textMuted, fontSize: scaledFont(11) }]}>Open the system share sheet</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => selectedCase && void handleCopySummary(selectedCase)}
            style={[styles.shareRow, { borderColor: colors.border }]}
          >
            <Copy color={PURPLE} size={18} />
            <View style={styles.flexOne}>
              <Text style={[styles.shareTitle, { color: colors.text, fontSize: scaledFont(13) }]}>Copy summary</Text>
              <Text style={[styles.shareSub, { color: colors.textMuted, fontSize: scaledFont(11) }]}>Copy a formatted case summary</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setShowShareSheet(false); Alert.alert("PDF export", "PDF export will be available in a future update."); }}
            style={[styles.shareRow, { borderColor: colors.border }]}
          >
            <FileText color={PURPLE} size={18} />
            <View style={styles.flexOne}>
              <Text style={[styles.shareTitle, { color: colors.text, fontSize: scaledFont(13) }]}>Export as PDF</Text>
              <Text style={[styles.shareSub, { color: colors.textMuted, fontSize: scaledFont(11) }]}>Coming soon</Text>
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderImageViewer = () => (
    <Modal visible={viewerOpen} transparent animationType="fade" onRequestClose={() => setViewerOpen(false)}>
      <View style={styles.viewerOverlay}>
        <View style={[styles.viewerTopBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => setViewerOpen(false)} style={styles.viewerIconBtn} hitSlop={8}>
            <X color="#fff" size={22} />
          </TouchableOpacity>
          <Text style={styles.viewerCounter}>
            {viewerImages.length ? `${viewerIndex + 1} / ${viewerImages.length}` : ""}
          </Text>
          <View style={styles.viewerActionsRow}>
            <TouchableOpacity
              onPress={async () => {
                try {
                  const cur = viewerImages[viewerIndex];
                  if (!cur) return;
                  const { Share } = await import("react-native");
                  await Share.share({ url: cur.uri, message: cur.caption ?? "Case image" });
                } catch (err) { console.log("[viewer share]", err); }
              }}
              style={styles.viewerIconBtn}
              hitSlop={8}
            >
              <Share2 color="#fff" size={18} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => Alert.alert("Download", "Saving images locally will be available in a future update.")}
              style={styles.viewerIconBtn}
              hitSlop={8}
            >
              <Download color="#fff" size={18} />
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width);
            setViewerIndex(idx);
          }}
          contentOffset={Platform.OS === "ios" ? undefined : undefined}
          style={styles.viewerScroll}
        >
          {viewerImages.map((img) => (
            <View key={img.uri} style={styles.viewerPage}>
              <Image source={{ uri: img.uri }} style={styles.viewerImg} resizeMode="contain" />
            </View>
          ))}
        </ScrollView>
        {viewerImages[viewerIndex]?.caption ? (
          <View style={[styles.viewerCaptionWrap, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.viewerCaption}>{viewerImages[viewerIndex]?.caption}</Text>
          </View>
        ) : null}
        {viewerImages.length > 1 ? (
          <>
            <TouchableOpacity
              style={[styles.viewerNav, styles.viewerNavLeft]}
              onPress={() => setViewerIndex((i) => Math.max(0, i - 1))}
              disabled={viewerIndex === 0}
            >
              <ChevronLeft color="#fff" size={26} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewerNav, styles.viewerNavRight]}
              onPress={() => setViewerIndex((i) => Math.min(viewerImages.length - 1, i + 1))}
              disabled={viewerIndex === viewerImages.length - 1}
            >
              <ChevronRight color="#fff" size={26} />
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </Modal>
  );

  const renderVideoViewer = () => (
    <Modal visible={videoOpen} transparent animationType="fade" onRequestClose={() => setVideoOpen(false)}>
      <View style={styles.viewerOverlay}>
        <View style={[styles.viewerTopBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => setVideoOpen(false)} style={styles.viewerIconBtn} hitSlop={8}>
            <X color="#fff" size={22} />
          </TouchableOpacity>
          <Text style={styles.viewerCounter} numberOfLines={1}>{videoCaption || "Video"}</Text>
          <View style={styles.viewerActionsRow}>
            <TouchableOpacity
              onPress={() => { if (videoUri) { void WebBrowser.openBrowserAsync(videoUri); } }}
              style={styles.viewerIconBtn}
              hitSlop={8}
            >
              <Download color="#fff" size={18} />
            </TouchableOpacity>
          </View>
        </View>
        {videoUri ? <CaseVideoPlayer uri={videoUri} /> : null}
      </View>
    </Modal>
  );

  const renderOwnerMenu = () => (
    <Modal visible={showOwnerMenu} transparent animationType="fade" onRequestClose={() => setShowOwnerMenu(false)}>
      <TouchableOpacity activeOpacity={1} onPress={() => setShowOwnerMenu(false)} style={styles.menuOverlay}>
        <View style={[styles.menuCard, { backgroundColor: colors.bgCard, borderColor: colors.border, top: insets.top + 60 }]}>
          <TouchableOpacity onPress={() => handleUpdateStatus("resolved")} style={styles.menuItem}>
            <CheckCircle2 color="#10B981" size={16} />
            <Text style={[styles.menuItemText, { color: colors.text }]}>Mark as Resolved</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleUpdateStatus("follow_up")} style={styles.menuItem}>
            <Filter color="#3B82F6" size={16} />
            <Text style={[styles.menuItemText, { color: colors.text }]}>Mark as Follow-up</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleUpdateStatus("open")} style={styles.menuItem}>
            <MessageCircle color="#F59E0B" size={16} />
            <Text style={[styles.menuItemText, { color: colors.text }]}>Reopen</Text>
          </TouchableOpacity>
          <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity onPress={handleDeleteCase} style={styles.menuItem}>
            <Trash2 color="#EF4444" size={16} />
            <Text style={[styles.menuItemText, { color: "#EF4444" }]}>Delete case</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      {renderHeader()}
      <Animated.View style={[styles.screenFill, { opacity: fadeAnim }]}>
        {mode === "feed" ? renderFeed() : mode === "create" ? renderCreate() : renderDetail()}
      </Animated.View>
      {renderPrivacyModal()}
      {renderInviteSheet()}
      {renderOwnerMenu()}
      {renderShareSheet()}
      {renderImageViewer()}
      {renderVideoViewer()}
    </View>
  );
}

const styles = StyleSheet.create({
  screenFill: { flex: 1 },
  centerFlex: { flex: 1, alignItems: "center", justifyContent: "center" },
  flexOne: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  iconBtnSm: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerDot: { width: 8, height: 8, borderRadius: 4 },
  headerTitle: { fontWeight: "800" as const, letterSpacing: -0.3 },
  headerSub: { marginTop: 2 },
  headerCta: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },

  privacyBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  privacyText: { flex: 1, lineHeight: 16 },

  feedToolbar: { paddingTop: 8, paddingBottom: 6 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    marginHorizontal: 16,
  },
  searchInput: { flex: 1, padding: 0 },
  filterScrollView: { marginTop: 8 },
  filterScroll: { paddingHorizontal: 16, paddingVertical: 2, gap: 6, alignItems: "center" as const },
  filterChip: {
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  filterChipText: { fontWeight: "600" as const, fontSize: 12, letterSpacing: 0.1 },

  listContent: { paddingHorizontal: 16, paddingTop: 6, gap: 10 },
  caseCard: {
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden" as const,
    marginBottom: 10,
  },
  caseAccent: { width: 4 },
  caseCardInner: { flex: 1, padding: 14 },
  caseTopRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontWeight: "800" as const, letterSpacing: 0.5 },
  privateBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  privateBadgeText: { fontWeight: "800" as const },
  timeText: {},
  questionText: { fontWeight: "700" as const, lineHeight: 19, marginBottom: 6 },
  snapshotText: { marginBottom: 4 },
  impressionText: { marginBottom: 10 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "800" as const, fontSize: 12 },
  authorName: { fontWeight: "600" as const },
  metricsRow: { flexDirection: "row", gap: 12 },
  metric: { flexDirection: "row", alignItems: "center", gap: 4 },
  metricText: {},

  emptyWrap: { alignItems: "center", paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16, gap: 10 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontWeight: "700" as const },
  emptySub: { textAlign: "center" as const, lineHeight: 18 },
  emptyCta: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  emptyCtaText: { color: "#fff", fontWeight: "700" as const, fontSize: 13 },

  // Create
  createScroll: { padding: 16 },
  sectionCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  sectionCardTitle: { fontWeight: "700" as const, marginBottom: 10 },
  fieldWrap: { marginBottom: 10 },
  fieldLabel: { fontWeight: "600" as const, marginBottom: 6 },
  subLabel: { marginTop: 4, marginBottom: 4, fontWeight: "600" as const, letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 42,
  },
  inputMulti: { minHeight: 80 },
  rowGap: { gap: 4 },
  row2: { flexDirection: "row", gap: 10 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap" as const, gap: 6, marginTop: 4, marginBottom: 4 },
  optChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  optChipText: { fontWeight: "600" as const },
  visibilityRow: { flexDirection: "row", gap: 10 },
  visCard: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12, alignItems: "flex-start", gap: 6 },
  visIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  visTitle: { fontWeight: "700" as const },
  visSub: {},
  inviteSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
  },
  inviteSummaryText: { flex: 1, fontWeight: "600" as const },
  computedBox: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 42,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  computedText: { fontWeight: "800" as const },
  publishBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 4,
  },
  publishBtnText: { color: "#fff", fontWeight: "800" as const, fontSize: 14 },

  // Detail
  detailScroll: { padding: 16 },
  detailHeader: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  detailHeaderTop: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  ownerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarLg: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarLgText: { color: "#fff", fontWeight: "800" as const, fontSize: 16 },
  ownerName: { fontWeight: "700" as const },
  ownerSub: { marginTop: 2 },
  questionCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  questionLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  questionLabel: { fontWeight: "800" as const, letterSpacing: 1 },
  questionMain: { fontWeight: "600" as const, lineHeight: 21 },
  detailSection: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  detailTitle: { fontWeight: "700" as const, marginBottom: 10 },
  detailBody: { lineHeight: 18, marginTop: 6 },
  snapshotGrid: { flexDirection: "row", flexWrap: "wrap" as const, gap: 8 },
  statCell: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, minWidth: 70 },
  statLabel: { fontWeight: "600" as const, letterSpacing: 0.5, marginBottom: 2 },
  statValue: { fontWeight: "800" as const },
  tagPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },
  tagPillText: { fontWeight: "600" as const },
  diffRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  diffRank: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  diffRankText: { color: "#fff", fontWeight: "800" as const, fontSize: 11 },
  diffText: { flex: 1, fontWeight: "600" as const },

  commentsHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, marginBottom: 10 },
  commentsTitle: { fontWeight: "700" as const },
  commentEmpty: { borderWidth: 1, borderRadius: 12, padding: 16, alignItems: "center" },
  commentEmptyText: { textAlign: "center" as const },
  commentCard: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
  commentReply: { marginLeft: 28 },
  commentHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  commentNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  commentName: { fontWeight: "700" as const },
  commentTime: { marginTop: 1 },
  ownerPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  ownerPillText: { fontWeight: "800" as const, letterSpacing: 0.5 },
  smallAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  smallAvatarText: { color: "#fff", fontWeight: "800" as const, fontSize: 11 },
  commentBody: { lineHeight: 19, marginBottom: 8 },
  commentActionsRow: { flexDirection: "row", gap: 10 },
  commentAction: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  commentActionText: { fontWeight: "600" as const },

  commentInputBar: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  commentInputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  commentInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 110,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  replyChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start" as const,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(139,92,246,0.16)",
    borderRadius: 10,
    marginBottom: 6,
  },
  replyChipText: { fontWeight: "600" as const, maxWidth: 200 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  modalCard: { width: "100%" as const, borderWidth: 1, borderRadius: 20, padding: 24, alignItems: "center" },
  modalIcon: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  modalTitle: { fontWeight: "800" as const, marginBottom: 8, textAlign: "center" as const },
  modalBody: { textAlign: "center" as const, lineHeight: 19, marginBottom: 14 },
  modalRules: { width: "100%" as const, gap: 8, marginBottom: 18 },
  modalRuleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  modalRuleText: {},
  modalActions: { flexDirection: "row", gap: 10, width: "100%" as const },
  modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  modalBtnText: { fontWeight: "700" as const, fontSize: 13 },

  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheetCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 16, gap: 10 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  sheetTitle: { fontWeight: "800" as const },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderStyle: "dashed" as const,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: "center",
  },
  scanBtnText: { fontWeight: "700" as const },
  invitedChipsWrap: { flexDirection: "row", flexWrap: "wrap" as const, gap: 6 },
  invitedChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, maxWidth: 180 },
  invitedChipText: { fontWeight: "700" as const, maxWidth: 130 },
  muted: { textAlign: "center" as const, padding: 14 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 4 },
  userName: { fontWeight: "700" as const },
  userSub: { marginTop: 2 },
  doneBtn: { paddingVertical: 13, borderRadius: 12, alignItems: "center", marginTop: 6 },
  doneBtnText: { color: "#fff", fontWeight: "800" as const, fontSize: 13 },

  menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },
  menuCard: {
    position: "absolute" as const,
    right: 12,
    borderWidth: 1,
    borderRadius: 14,
    width: 220,
    paddingVertical: 4,
  },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  menuItemText: { fontWeight: "600" as const, fontSize: 13 },
  menuDivider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },

  // Expandable form sections & panels
  expSectionCard: { borderWidth: 1, borderRadius: 14, marginBottom: 12, overflow: "hidden" as const },
  expSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  expSectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  expSectionTitle: { fontWeight: "800" as const, letterSpacing: -0.2 },
  expSectionBody: { paddingHorizontal: 14, paddingBottom: 14 },
  chevOpen: { transform: [{ rotate: "90deg" }] },
  panel: { borderWidth: 1, borderRadius: 12, marginBottom: 10, overflow: "hidden" as const },
  panelHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10 },
  panelIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  panelTitle: { flex: 1, fontWeight: "700" as const },
  panelBody: { paddingHorizontal: 10, paddingBottom: 10, paddingTop: 2 },
  panelImageRow: { flexDirection: "row", flexWrap: "wrap" as const, gap: 8, marginTop: 6 },
  thumbWrap: { width: 62, height: 62, borderRadius: 10, overflow: "hidden" as const, position: "relative" as const },
  thumb: { width: "100%" as const, height: "100%" as const },
  thumbClose: { position: "absolute" as const, top: 2, right: 2, backgroundColor: "rgba(0,0,0,0.55)", width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  addThumb: { width: 62, height: 62, borderRadius: 10, borderWidth: 1, borderStyle: "dashed" as const, alignItems: "center", justifyContent: "center", gap: 2 },
  addThumbText: { fontWeight: "800" as const },
  segmented: { flexDirection: "row", gap: 6 },
  segment: { flex: 1, minHeight: 42, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  voiceText: { fontWeight: "700" as const },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 8 },
  timelineDot: { width: 10, height: 10, borderRadius: 5 },
  addRowBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderStyle: "dashed" as const, borderRadius: 10, height: 38, marginTop: 4, marginBottom: 10 },
  customLabRow: { borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 8 },
  removeBtn: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-end", paddingHorizontal: 6, paddingVertical: 4 },
  calcCard: { borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 8, marginBottom: 4 },
  calcTitle: { fontWeight: "800" as const },
  calcSub: { marginTop: 4, lineHeight: 16, fontWeight: "600" as const },
  uploadZone: { borderWidth: 1, borderStyle: "dashed" as const, borderRadius: 14, padding: 16, alignItems: "center", gap: 6 },
  uploadTitle: { textAlign: "center" as const, fontWeight: "800" as const },
  uploadSub: { textAlign: "center" as const, lineHeight: 16 },
  mediaActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  actionPill: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 8, alignItems: "center", gap: 4 },
  actionText: { fontWeight: "700" as const, textAlign: "center" as const },

  // CaseView (read-only)
  headerActions: { flexDirection: "row", alignItems: "center" },
  titleCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 },
  titleQuestion: { fontWeight: "800" as const, lineHeight: 24, marginTop: 8, marginBottom: 12, letterSpacing: -0.3 },
  titleAuthorRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  titleAuthor: { flex: 1, fontWeight: "600" as const },
  caseSection: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  sectionNumBubble: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  sectionNumText: { color: "#fff", fontWeight: "800" as const, fontSize: 12 },
  sectionTitleText: { fontWeight: "800" as const, letterSpacing: -0.3 },
  narrativeText: { lineHeight: 21, fontWeight: "500" as const },
  metaLine: { marginTop: 8, fontWeight: "600" as const },
  subSection: { marginTop: 12 },
  subSectionTitle: { fontWeight: "800" as const, marginBottom: 6 },
  subSectionBody: { lineHeight: 20 },
  timelineWrap: { marginTop: 8 },
  timelineItem: { flexDirection: "row", gap: 12, minHeight: 50 },
  timelineLeft: { width: 14, alignItems: "center" },
  timelineDotBig: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  timelineLine: { width: 2, flex: 1, marginTop: 2 },
  timelineContent: { flex: 1, paddingBottom: 14 },
  timelineDate: { fontWeight: "800" as const, letterSpacing: 0.3 },
  timelineEvent: { marginTop: 2, fontWeight: "600" as const, lineHeight: 19 },
  vitalsCard: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 6 },
  vitalsRow: { flexDirection: "row", flexWrap: "wrap" as const, gap: 12 },
  vitalCell: { minWidth: 70 },
  vitalLabel: { fontWeight: "700" as const, letterSpacing: 0.5, marginBottom: 2 },
  vitalValue: { fontWeight: "800" as const },
  labTable: { borderWidth: 1, borderRadius: 12, overflow: "hidden" as const, marginTop: 6 },
  labRowHeader: { flexDirection: "row", paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1 },
  labRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  labColParam: { flex: 1.1, fontWeight: "700" as const },
  labColVal: { flex: 1.2, fontWeight: "700" as const },
  labColStatus: { flex: 1, alignItems: "flex-start" as const },
  labStatusPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8 },
  labStatusText: { fontWeight: "800" as const, letterSpacing: 0.5 },
  abgCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 12 },
  abgHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  abgHeader: { fontWeight: "800" as const, letterSpacing: 1 },
  abgGrid: { flexDirection: "row", flexWrap: "wrap" as const, gap: 8 },
  abgCell: { minWidth: 70, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  abgCellLabel: { fontWeight: "700" as const, letterSpacing: 0.5, marginBottom: 2 },
  abgCellValue: { fontWeight: "800" as const },
  pfBanner: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignSelf: "flex-start" as const },
  pfBannerText: { fontWeight: "800" as const, letterSpacing: 0.3 },
  abgInterpText: { marginTop: 10, lineHeight: 19 },
  microCard: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 6 },
  microTitle: { fontWeight: "800" as const, marginBottom: 2 },
  microBody: { fontWeight: "600" as const, lineHeight: 18 },
  lightBadge: { alignSelf: "flex-start" as const, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 8 },
  lightBadgeText: { fontWeight: "800" as const, letterSpacing: 0.5 },
  labeledBlock: { marginBottom: 10 },
  labeledLabel: { fontWeight: "800" as const, marginBottom: 4 },
  labeledBody: { lineHeight: 19 },
  tabsScroll: { gap: 6, paddingBottom: 4 },
  imgTab: { paddingHorizontal: 12, height: 30, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  imgTabText: { fontWeight: "700" as const, letterSpacing: 0.2 },
  thumbsScroll: { gap: 10, paddingVertical: 10 },
  bigThumbWrap: { width: 160, borderWidth: 1, borderRadius: 12, overflow: "hidden" as const, paddingBottom: 6 },
  bigThumb: { width: "100%" as const, height: 120 },
  videoPlaceholder: { width: "100%" as const, height: 120, alignItems: "center", justifyContent: "center" },
  videoPlayBadge: { position: "absolute" as const, width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  videoPlayBadgeText: { color: "#fff", fontSize: 14, marginLeft: 2 },
  thumbCaption: { paddingHorizontal: 8, paddingTop: 6, fontWeight: "600" as const },
  pdfCard: { width: 140, height: 130, borderWidth: 1, borderRadius: 12, padding: 12, alignItems: "center", justifyContent: "center", gap: 8 },
  pdfName: { textAlign: "center" as const, fontWeight: "700" as const },
  topDxCard: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 6, marginBottom: 4 },
  topDxLabel: { fontWeight: "800" as const, letterSpacing: 1, marginBottom: 4 },
  topDxValue: { fontWeight: "800" as const, lineHeight: 22 },
  diffCard: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 6 },
  diffDx: { fontWeight: "700" as const },
  diffReason: { marginTop: 2, lineHeight: 16 },
  learningCard: { flexDirection: "row", gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 10 },
  learningLabel: { fontWeight: "800" as const, letterSpacing: 1, marginBottom: 4 },
  learningBody: { lineHeight: 18, fontWeight: "600" as const },

  // Share sheet
  shareRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  shareTitle: { fontWeight: "700" as const },
  shareSub: { marginTop: 2 },

  // Image viewer
  viewerOverlay: { flex: 1, backgroundColor: "#000" },
  viewerTopBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 8 },
  viewerIconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" },
  viewerCounter: { flex: 1, textAlign: "center" as const, color: "#fff", fontWeight: "700" as const },
  viewerActionsRow: { flexDirection: "row", gap: 8 },
  viewerScroll: { flex: 1 },
  viewerPage: { width: require("react-native").Dimensions.get("window").width, alignItems: "center", justifyContent: "center" },
  viewerImg: { width: "100%" as const, height: "100%" as const },
  viewerCaptionWrap: { paddingHorizontal: 24, paddingTop: 8, backgroundColor: "rgba(0,0,0,0.6)" },
  viewerCaption: { color: "#fff", fontWeight: "600" as const, textAlign: "center" as const },
  viewerNav: { position: "absolute" as const, top: "45%" as const, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  viewerNavLeft: { left: 8 },
  viewerNavRight: { right: 8 },
});
