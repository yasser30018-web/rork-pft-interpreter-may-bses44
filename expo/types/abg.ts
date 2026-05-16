export interface ABGInput {
  pH: number;
  PaCO2: number;
  HCO3: number;
  PaO2: number;
  SaO2: number;
  Na: number;
  K: number;
  Cl: number;
  albumin: number;
  FiO2: number;
}

export interface ABGFields {
  pH: string;
  PaCO2: string;
  HCO3: string;
  PaO2: string;
  SaO2: string;
  Na: string;
  K: string;
  Cl: string;
  albumin: string;
  FiO2: string;
}

export interface PHAssessment {
  label: string;
  dir: 'acid' | 'alkaline' | 'normal';
  critical: boolean;
}

export interface PrimaryDisorder {
  disorder: string;
  label: string;
  comp: string;
}

export interface CompExpected {
  formula?: string;
  lo?: number;
  hi?: number;
  range?: string;
  ex?: number;
  acute?: { lo: number; hi: number };
  chronic?: { lo: number; hi: number };
}

export interface CompAssessment {
  status: string;
  label: string;
  exp: CompExpected;
  note: string;
}

export interface CorrAGResult {
  corrAG: number;
  corr: number;
  normalAG: number;
}

export interface DeltaResult {
  dAG: number;
  dHCO3: number;
  ratio: number | null;
  interp: string;
  mixed: string | null;
}

export interface OxyAssessment {
  status: string;
  label: string;
  PF: number | null;
  ARDS: string | null;
  critical: boolean;
}

export interface CritAlert {
  t: 'C' | 'W';
  m: string;
}

export interface StepItem {
  n: number;
  title: string;
  finding: string;
  detail: string;
}

export interface DDxItem {
  c: string;
  d: string;
  s: string;
}

export interface DDxCategory {
  cat: string;
  col: string;
  items: DDxItem[];
}

export interface ABGResult {
  phR: PHAssessment;
  prim: PrimaryDisorder;
  comp: CompAssessment;
  AG: number;
  corrR: CorrAGResult;
  agElev: boolean;
  delta: DeltaResult | null;
  oxy: OxyAssessment;
  crits: CritAlert[];
  ddx: DDxCategory[];
  compShort: string;
  steps: StepItem[];
  inp: ABGInput;
}

export interface ABGExample {
  label: string;
  icon: string;
  desc: string;
  v: ABGFields;
}

export const DEFAULT_FIELDS: ABGFields = {
  pH: '',
  PaCO2: '',
  HCO3: '',
  PaO2: '',
  SaO2: '',
  Na: '',
  K: '',
  Cl: '',
  albumin: '',
  FiO2: '21',
};

export const ABG_EXAMPLES: ABGExample[] = [
  { label: 'DKA', icon: '🩸', desc: 'HAGMA, met. acidosis', v: { pH: '7.15', PaCO2: '23', HCO3: '10', PaO2: '85', SaO2: '96', Na: '140', K: '5.5', Cl: '100', albumin: '4.0', FiO2: '21' } },
  { label: 'COPD', icon: '🫁', desc: 'Acute resp. acidosis', v: { pH: '7.22', PaCO2: '72', HCO3: '28', PaO2: '52', SaO2: '86', Na: '140', K: '4.0', Cl: '100', albumin: '4.0', FiO2: '28' } },
  { label: 'Salicylate', icon: '💊', desc: 'Mixed alk + acid', v: { pH: '7.40', PaCO2: '20', HCO3: '12', PaO2: '90', SaO2: '97', Na: '140', K: '3.8', Cl: '104', albumin: '4.0', FiO2: '21' } },
  { label: 'Met. Alk.', icon: '💉', desc: 'Vomiting + diuretics', v: { pH: '7.55', PaCO2: '48', HCO3: '40', PaO2: '88', SaO2: '96', Na: '138', K: '2.8', Cl: '88', albumin: '3.5', FiO2: '21' } },
  { label: 'ARDS', icon: '🏥', desc: 'Severe hypoxaemia', v: { pH: '7.38', PaCO2: '33', HCO3: '19', PaO2: '58', SaO2: '89', Na: '141', K: '4.1', Cl: '105', albumin: '2.5', FiO2: '80' } },
  { label: 'Sepsis', icon: '⚡', desc: 'Lactic acidosis', v: { pH: '7.18', PaCO2: '22', HCO3: '8', PaO2: '70', SaO2: '93', Na: '139', K: '5.2', Cl: '105', albumin: '2.0', FiO2: '40' } },
];
