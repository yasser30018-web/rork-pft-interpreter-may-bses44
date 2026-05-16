import type { SectionConfig, PatternInfo, FVCurveInfo, CombinedPattern, FVCurveType } from "@/types/pft";

export const INITIAL_VALUES = {
  fev1fvc: "",
  fvc: "",
  fev1: "",
  fef2575: "",
  pef: "",
  svc: "",
  fet: "",
  bdFev1: "",
  bdFvc: "",
  tlc: "",
  rv: "",
  rvtlc: "",
  frc: "",
  ic: "",
  erv: "",
  dlco: "",
  dlcova: "",
};

export const FIELDS: SectionConfig[] = [
  {
    section: "Spirometry",
    icon: "wind",
    fields: [
      { key: "fev1fvc", label: "FEV1/FVC Ratio", unit: "%", placeholder: "e.g. 72", hint: "Normal >70%", critical: true, mandatory: true },
      { key: "fvc", label: "FVC", unit: "% pred.", placeholder: "e.g. 85", hint: "Normal >80%", mandatory: true },
      { key: "fev1", label: "FEV1", unit: "% pred.", placeholder: "e.g. 78", hint: "Normal >80%, used for severity", mandatory: true },
      { key: "fef2575", label: "FEF25-75 (MMEF)", unit: "% pred.", placeholder: "e.g. 65", hint: "Sensitive: small airway disease" },
      { key: "pef", label: "PEF", unit: "% pred.", placeholder: "e.g. 88", hint: "Effort-dependent" },
      { key: "svc", label: "SVC (Slow VC)", unit: "% pred.", placeholder: "e.g. 90", hint: "SVC > FVC = air trapping" },
      { key: "fet", label: "FET", unit: "seconds", placeholder: "e.g. 7", hint: ">6 sec for valid study" },
    ],
  },
  {
    section: "BD Response",
    icon: "syringe",
    fields: [
      { key: "bdFev1", label: "Post-BD FEV1 change", unit: "% increase", placeholder: "e.g. 14", hint: "Significant: >12% AND >200mL" },
      { key: "bdFvc", label: "Post-BD FVC change", unit: "% increase", placeholder: "e.g. 8", hint: "Significant: >12% AND >200mL" },
    ],
  },
  {
    section: "Lung Volumes",
    icon: "activity",
    fields: [
      { key: "tlc", label: "TLC", unit: "% pred.", placeholder: "e.g. 95", hint: "Essential for restriction diagnosis", critical: true, mandatory: true },
      { key: "rv", label: "RV", unit: "% pred.", placeholder: "e.g. 130", hint: "High = air trapping" },
      { key: "rvtlc", label: "RV/TLC Ratio", unit: "%", placeholder: "e.g. 38", hint: "<35% normal; high = air trapping" },
      { key: "frc", label: "FRC", unit: "% pred.", placeholder: "e.g. 105", hint: "High = hyperinflation (emphysema)" },
      { key: "ic", label: "IC", unit: "% pred.", placeholder: "e.g. 95", hint: "Low in obstruction; monitors BD benefit" },
      { key: "erv", label: "ERV", unit: "% pred.", placeholder: "e.g. 85", hint: "Isolated low = obesity" },
    ],
  },
  {
    section: "Gas Transfer",
    icon: "droplets",
    fields: [
      { key: "dlco", label: "DLCO", unit: "% pred.", placeholder: "e.g. 82", hint: "Normal 75-120%; KEY gas exchange marker", critical: true },
      { key: "dlcova", label: "DLCO/VA (KCO)", unit: "% pred.", placeholder: "e.g. 88", hint: "Low = parenchymal/vascular disease" },
    ],
  },
];

export const PATTERN_INFO: Record<string, PatternInfo> = {
  obstructive: { label: "Obstructive Pattern", color: "#3b82f6", icon: "wind", desc: "FEV1/FVC < 0.70 with airflow limitation" },
  restrictive: { label: "Restrictive Pattern", color: "#f97316", icon: "trending-down", desc: "TLC < 80% with preserved or elevated FEV1/FVC" },
  mixed: { label: "Mixed Pattern", color: "#ec4899", icon: "zap", desc: "Combined obstruction (low FEV1/FVC) + restriction (low TLC)" },
  possible_restrictive: { label: "Possible Restriction", color: "#f59e0b", icon: "alert-triangle", desc: "Low FVC + normal FEV1/FVC. Confirm with TLC." },
  pseudorestriction: { label: "Pseudorestriction", color: "#14b8a6", icon: "search", desc: "Low FVC + normal TLC. Consider obesity or mild asthma." },
  possible_obstructive_volumes: { label: "Possible Obstruction", color: "#6366f1", icon: "cloud", desc: "Normal spirometry but elevated TLC/RV — early obstruction" },
  possible_restrictive_volumes: { label: "Possible Restriction", color: "#f59e0b", icon: "alert-triangle", desc: "Normal spirometry but low TLC — confirm with full PFT" },
  normal: { label: "Normal Pattern", color: "#22c55e", icon: "check-circle", desc: "All parameters within normal limits" },
  empty: { label: "Enter values to interpret", color: "#4b5563", icon: "clipboard", desc: "Add spirometry values to begin" },
};

export const FV_CURVES: Record<string, FVCurveInfo> = {
  normal: { desc: "Normal FV curve", shape: "M 20,80 L 30,20 Q 50,15 60,18 L 140,70 Q 155,78 160,80", color: "#22c55e" },
  scooped: { desc: "Scooped/concave — Obstruction", shape: "M 20,80 L 30,30 Q 45,25 50,28 Q 90,50 120,68 Q 140,76 160,80", color: "#3b82f6" },
  dog_leg: { desc: "Dog-leg — Emphysema", shape: "M 20,80 L 28,35 Q 40,28 45,32 Q 65,50 90,65 Q 120,75 160,80", color: "#ef4444" },
  witchs_hat: { desc: "Witch's hat — Restriction", shape: "M 50,80 L 60,18 Q 70,14 75,17 L 110,70 Q 118,78 120,80", color: "#f97316" },
  parallel_small: { desc: "Small parallel — Chest wall", shape: "M 40,80 L 48,30 Q 62,24 67,27 L 120,70 Q 128,78 132,80", color: "#8b5cf6" },
  subtle_concave: { desc: "Subtle concavity — Early obstruction", shape: "M 20,80 L 30,22 Q 48,17 55,20 Q 95,42 130,68 Q 148,77 160,80", color: "#6366f1" },
};

export const SEVERITY_SCALE = [
  { label: "Mild", range: ">70%", color: "#22c55e" },
  { label: "Moderate", range: "60-69%", color: "#84cc16" },
  { label: "Mod. Severe", range: "50-59%", color: "#f59e0b" },
  { label: "Severe", range: "35-49%", color: "#f97316" },
  { label: "Very Severe", range: "<35%", color: "#ef4444" },
];
