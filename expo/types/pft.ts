export interface PFTValues {
  fev1fvc: string;
  fvc: string;
  fev1: string;
  fef2575: string;
  pef: string;
  svc: string;
  fet: string;
  bdFev1: string;
  bdFvc: string;
  tlc: string;
  rv: string;
  rvtlc: string;
  frc: string;
  ic: string;
  erv: string;
  dlco: string;
  dlcova: string;
}

export interface SeverityInfo {
  label: string;
  color: string;
  bg: string;
}

export interface DifferentialDiagnosis {
  dx: string;
  prob: string;
  color: string;
  evidence: string[];
  notes: string;
}

export interface PatternInfo {
  label: string;
  color: string;
  icon: string;
  desc: string;
}

export interface FVCurveInfo {
  desc: string;
  shape: string;
  color: string;
}

export type SpirometryPattern = "obstructive" | "possible_restrictive" | "normal" | null;
export type LungVolumePattern = "low" | "high" | "normal" | null;
export type BDResponse = "significant" | "not_significant" | null;
export type CombinedPattern =
  | "obstructive"
  | "restrictive"
  | "mixed"
  | "possible_restrictive"
  | "pseudorestriction"
  | "possible_obstructive_volumes"
  | "possible_restrictive_volumes"
  | "normal"
  | null;
export type DLCOStatus = "low" | "high" | "normal" | null;
export type FVCurveType = "dog_leg" | "scooped" | "witchs_hat" | "parallel_small" | "subtle_concave" | "normal" | null;

export interface PFTResult {
  spirometry: SpirometryPattern;
  lungVolumes: LungVolumePattern;
  dlco: DLCOStatus;
  pattern: CombinedPattern;
  severity: SeverityInfo | null;
  bdResponse: BDResponse;
  differentials: DifferentialDiagnosis[];
  pearls: string[];
  fvCurve: FVCurveType;
  warnings: string[];
}

export interface FieldConfig {
  key: keyof PFTValues;
  label: string;
  unit: string;
  placeholder: string;
  hint: string;
  critical?: boolean;
  mandatory?: boolean;
}

export interface SectionConfig {
  section: string;
  icon: string;
  fields: FieldConfig[];
}
