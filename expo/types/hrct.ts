export type ImageType = "cxr" | "hrct" | "ctpa";
export type Gender = "male" | "female";
export type SmokingStatus = "non" | "ex" | "active";

export interface ClinicalContext {
  age?: string;
  gender?: Gender;
  smoking?: SmokingStatus;
  history?: string;
  symptoms?: string[];
  suspicion?: string;
}

export interface PrimaryPattern {
  pattern: string;
  subtype?: string;
  description: string;
  distribution?: string;
  severity?: "mild" | "moderate" | "severe";
}

export interface SecondaryFinding {
  finding: string;
  description: string;
  significance?: string;
}

export interface UIPClassification {
  applicable: boolean;
  category: string;
  reasoning?: string;
}

export interface DDxItem {
  rank: number;
  diagnosis: string;
  probability: "High" | "Moderate" | "Low";
  supporting_features?: string[];
  against_features?: string[];
}

export interface HRCTAnalysis {
  image_quality?: string;
  quality_notes?: string;
  primary_patterns?: PrimaryPattern[];
  secondary_findings?: SecondaryFinding[];
  uip_classification?: UIPClassification;
  overall_impression?: string;
  severity_overall?: string;
  differential_diagnosis?: DDxItem[];
  pattern_based_algorithm?: string;
  additional_imaging_recommended?: string[];
  clinical_correlation?: string[];
  urgent?: boolean;
  urgent_reason?: string;
  disclaimer?: string;
}

export interface HRCTHistoryItem {
  id: string;
  imageUri: string;
  imageType: ImageType;
  context: ClinicalContext;
  result: HRCTAnalysis;
  createdAt: number;
}
