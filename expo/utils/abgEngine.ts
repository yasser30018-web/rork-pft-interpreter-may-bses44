import type {
  ABGInput,
  PHAssessment,
  PrimaryDisorder,
  CompAssessment,
  CorrAGResult,
  DeltaResult,
  OxyAssessment,
  CritAlert,
  StepItem,
  DDxItem,
  DDxCategory,
  ABGResult,
} from '@/types/abg';

const rv = (v: number, d: number = 1): number => Math.round(v * 10 ** d) / 10 ** d;
const cl = (v: number, mn: number, mx: number): number => Math.min(Math.max(v, mn), mx);

function assessPH(pH: number): PHAssessment {
  if (pH < 7.20) return { label: 'Critical Acidaemia', dir: 'acid', critical: true };
  if (pH < 7.35) return { label: 'Acidaemia', dir: 'acid', critical: false };
  if (pH > 7.60) return { label: 'Critical Alkalaemia', dir: 'alkaline', critical: true };
  if (pH > 7.45) return { label: 'Alkalaemia', dir: 'alkaline', critical: false };
  return { label: 'Normal pH', dir: 'normal', critical: false };
}

function identifyPrimary(pH: number, PaCO2: number, HCO3: number): PrimaryDisorder {
  const acid = pH < 7.35;
  const alk = pH > 7.45;
  const hiCO2 = PaCO2 > 45;
  const loCO2 = PaCO2 < 35;
  const loHCO3 = HCO3 < 22;
  const hiHCO3 = HCO3 > 26;

  if (acid) {
    if (hiCO2 && loHCO3) return { disorder: 'MIXED_ACIDOSIS', label: 'Mixed Respiratory & Metabolic Acidosis', comp: 'mixed' };
    if (hiCO2) return { disorder: 'RESP_ACIDOSIS', label: 'Respiratory Acidosis', comp: 'respiratory' };
    if (loHCO3) return { disorder: 'MET_ACIDOSIS', label: 'Metabolic Acidosis', comp: 'metabolic' };
    return { disorder: 'ACID_UNCLEAR', label: 'Acidosis — pattern unclear', comp: 'unknown' };
  }
  if (alk) {
    if (loCO2 && hiHCO3) return { disorder: 'MIXED_ALKALOSIS', label: 'Mixed Respiratory & Metabolic Alkalosis', comp: 'mixed' };
    if (loCO2) return { disorder: 'RESP_ALKALOSIS', label: 'Respiratory Alkalosis', comp: 'respiratory' };
    if (hiHCO3) return { disorder: 'MET_ALKALOSIS', label: 'Metabolic Alkalosis', comp: 'metabolic' };
    return { disorder: 'ALK_UNCLEAR', label: 'Alkalosis — pattern unclear', comp: 'unknown' };
  }
  if (hiCO2 && hiHCO3) return { disorder: 'COMP_RESP_ACID_MIX', label: 'Compensated Resp. Acidosis / Mixed Resp.Acid+Met.Alk', comp: 'mixed_or_comp' };
  if (loCO2 && loHCO3) return { disorder: 'COMP_RESP_ALK_MIX', label: 'Compensated Resp. Alkalosis / Mixed Resp.Alk+Met.Acid', comp: 'mixed_or_comp' };
  if (loHCO3) return { disorder: 'COMP_MET_ACID', label: 'Compensated Metabolic Acidosis', comp: 'metabolic' };
  if (hiHCO3) return { disorder: 'COMP_MET_ALK', label: 'Compensated Metabolic Alkalosis', comp: 'metabolic' };
  return { disorder: 'NORMAL', label: 'No Primary Acid-Base Disorder', comp: 'none' };
}

function assessComp(disorder: string, pH: number, PaCO2: number, HCO3: number): CompAssessment {
  const dCO2 = PaCO2 - 40;
  const dHCO3 = HCO3 - 24;

  if (disorder === 'MET_ACIDOSIS' || disorder === 'COMP_MET_ACID') {
    const lo = rv((1.5 * HCO3) + 8 - 2);
    const hi = rv((1.5 * HCO3) + 8 + 2);
    const exp = { lo, hi, formula: "Winter's: PaCO2 = (1.5 × HCO3) + 8 ± 2" };
    if (PaCO2 >= lo && PaCO2 <= hi) return { status: 'OK', label: "Appropriate respiratory compensation (Winter's formula met)", exp, note: '' };
    if (PaCO2 > hi) return { status: 'INAD', label: 'Inadequate — PaCO2 higher than expected', exp, note: 'Consider co-existing respiratory acidosis' };
    return { status: 'EXCESS', label: 'Excessive — PaCO2 lower than expected', exp, note: 'Consider co-existing respiratory alkalosis' };
  }

  if (disorder === 'MET_ALKALOSIS' || disorder === 'COMP_MET_ALK') {
    const ex = rv(40 + 0.6 * dHCO3);
    const exp = { formula: 'PaCO2 = 40 + 0.6 × (ΔHCO3)', range: `${ex - 2}–${ex + 2}`, ex };
    if (Math.abs(PaCO2 - ex) <= 3) return { status: 'OK', label: 'Appropriate respiratory compensation', exp, note: '' };
    if (PaCO2 < ex - 3) return { status: 'INAD', label: 'Inadequate compensation', exp, note: 'Consider co-existing respiratory alkalosis' };
    return { status: 'EXCESS', label: 'Excessive compensation', exp, note: 'Consider co-existing respiratory acidosis' };
  }

  if (disorder === 'RESP_ACIDOSIS') {
    const eA = { lo: rv(24 + (dCO2 / 10) - 3), hi: rv(24 + (dCO2 / 10) + 3) };
    const eC = { lo: rv(24 + 3.5 * (dCO2 / 10) - 3), hi: rv(24 + 3.5 * (dCO2 / 10) + 3) };
    const exp = { formula: 'Acute: ΔHCO3 = ΔPaCO2/10 ± 3 | Chronic: ΔHCO3 = 3.5×(ΔPaCO2/10)', acute: eA, chronic: eC };
    if (HCO3 >= 22 && HCO3 <= 26) return { status: 'NONE', label: 'No renal compensation — likely acute (<12h)', exp, note: '' };
    if (HCO3 >= eA.lo && HCO3 <= eA.hi) return { status: 'ACUTE', label: 'Acute renal compensation — appropriate', exp, note: '' };
    if (HCO3 >= eC.lo && HCO3 <= eC.hi) return { status: 'CHRONIC', label: 'Chronic renal compensation — 3–5 days', exp, note: '' };
    if (HCO3 > eC.hi) return { status: 'EXCESS', label: 'HCO3 exceeds expected chronic compensation', exp, note: 'Consider co-existing metabolic alkalosis' };
    return { status: 'INAD', label: 'HCO3 below expected compensation', exp, note: 'Consider co-existing metabolic acidosis' };
  }

  if (disorder === 'RESP_ALKALOSIS') {
    const eA = { lo: rv(24 - 2 * (Math.abs(dCO2) / 10) - 3), hi: rv(24 - 2 * (Math.abs(dCO2) / 10) + 3) };
    const eC = { lo: rv(24 - 5 * (Math.abs(dCO2) / 10) - 3), hi: rv(24 - 5 * (Math.abs(dCO2) / 10) + 3) };
    const exp = { formula: 'Acute: ΔHCO3 = 2×(ΔPaCO2/10) | Chronic: ΔHCO3 = 5×(ΔPaCO2/10)', acute: eA, chronic: eC };
    if (HCO3 >= 22 && HCO3 <= 26) return { status: 'NONE', label: 'No renal compensation — likely acute', exp, note: '' };
    if (HCO3 >= eA.lo && HCO3 <= eA.hi) return { status: 'ACUTE', label: 'Acute renal compensation — appropriate', exp, note: '' };
    if (HCO3 >= eC.lo && HCO3 <= eC.hi) return { status: 'CHRONIC', label: 'Chronic renal compensation — days to weeks', exp, note: '' };
    if (HCO3 < eC.lo) return { status: 'EXCESS', label: 'HCO3 lower than expected', exp, note: 'Consider co-existing metabolic acidosis' };
    return { status: 'INAD', label: 'HCO3 higher than expected compensation', exp, note: 'Consider co-existing metabolic alkalosis' };
  }

  return { status: 'N/A', label: 'Compensation not applicable', exp: {}, note: '' };
}

function calcAG(Na: number, Cl: number, HCO3: number): number {
  return rv(Na - (Cl + HCO3));
}

function calcCorrAG(ag: number, albumin: number): CorrAGResult {
  const drop = cl(4.0 - albumin, 0, 4.0);
  const corr = rv(2.5 * drop);
  return { corrAG: rv(ag + corr), corr, normalAG: rv(12 - corr) };
}

function calcDelta(ag: number, normalAG: number, HCO3: number): DeltaResult {
  const dAG = rv(ag - normalAG);
  const dHCO3 = rv(24 - HCO3);
  if (dHCO3 === 0) return { dAG, dHCO3, ratio: null, interp: 'Delta ratio undefined', mixed: null };
  const ratio = rv(dAG / dHCO3, 2);
  if (ratio < 1.0) return { dAG, dHCO3, ratio, interp: `Ratio ${ratio} (<1.0): co-existing NAGMA detected`, mixed: 'HAGMA + NAGMA' };
  if (ratio > 2.0) return { dAG, dHCO3, ratio, interp: `Ratio ${ratio} (>2.0): co-existing Metabolic Alkalosis`, mixed: 'HAGMA + metabolic alkalosis' };
  return { dAG, dHCO3, ratio, interp: `Ratio ${ratio} (1.0–2.0): uncomplicated HAGMA`, mixed: null };
}

function assessOxy(PaO2: number, SaO2: number, FiO2: number = 0.21): OxyAssessment {
  const PF = FiO2 > 0 ? rv(PaO2 / FiO2) : null;
  let status: string, label: string, ARDS: string | null = null, critical = false;

  if (PaO2 < 40) { status = 'CRITICAL'; label = 'Critical hypoxaemia (<40 mmHg)'; critical = true; }
  else if (PaO2 < 60) { status = 'FAILURE'; label = 'Hypoxaemic respiratory failure (PaO2 <60 mmHg)'; critical = true; }
  else if (PaO2 < 80) { status = 'HYPO'; label = 'Hypoxaemia (PaO2 60–79 mmHg)'; }
  else if (PaO2 < 90) { status = 'LOWN'; label = 'Low-normal oxygenation (80–89 mmHg)'; }
  else { status = 'NORMAL'; label = 'Normal oxygenation (≥90 mmHg)'; }

  if (PF !== null) {
    if (PF <= 100) { ARDS = 'Severe ARDS (P/F ≤100)'; critical = true; }
    else if (PF <= 200) { ARDS = 'Moderate ARDS (P/F 100–200)'; critical = true; }
    else if (PF <= 300) { ARDS = 'Mild ARDS / Lung Injury (P/F 200–300)'; }
  }

  if (SaO2 < 88) critical = true;

  return { status, label, PF, ARDS, critical };
}

function detectCrits(inp: ABGInput, oxy: OxyAssessment): CritAlert[] {
  const a: CritAlert[] = [];
  if (inp.pH < 7.20) a.push({ t: 'C', m: `pH ${inp.pH} — Severe acidaemia. Risk of cardiac arrhythmia and cardiovascular collapse.` });
  if (inp.pH > 7.60) a.push({ t: 'C', m: `pH ${inp.pH} — Severe alkalaemia. Risk of seizures, tetany, coronary vasospasm.` });
  if (inp.PaCO2 > 70) a.push({ t: 'C', m: `PaCO2 ${inp.PaCO2} mmHg — Severe hypercapnia. CO2 narcosis risk. Urgent airway assessment.` });
  if (inp.PaCO2 < 20) a.push({ t: 'C', m: `PaCO2 ${inp.PaCO2} mmHg — Extreme hyperventilation. Cerebral vasoconstriction risk.` });
  if (inp.PaO2 < 60) a.push({ t: 'C', m: `PaO2 ${inp.PaO2} mmHg — Hypoxaemic respiratory failure. Supplemental O2 required urgently.` });
  if (inp.HCO3 < 10) a.push({ t: 'C', m: `HCO3 ${inp.HCO3} mEq/L — Critically low buffer reserve. Exclude toxic ingestion.` });
  if (oxy.ARDS && oxy.ARDS.startsWith('Severe')) a.push({ t: 'C', m: `${oxy.ARDS} — Prone positioning, high PEEP, consider ECMO.` });
  else if (oxy.ARDS && oxy.ARDS.startsWith('Moderate')) a.push({ t: 'W', m: `${oxy.ARDS} — Lung-protective ventilation, prone positioning.` });
  if (inp.pH >= 7.20 && inp.pH < 7.35 && !a.find(x => x.m.includes('pH'))) a.push({ t: 'W', m: `pH ${inp.pH} — Acidaemia. Identify and treat primary disorder.` });
  return a;
}

const DDX: Record<string, DDxItem[]> = {
  RESP_ACIDOSIS: [
    { c: 'Airway obstruction (upper/lower)', d: 'COPD, asthma, other obstructive lung disease', s: 'ATS Table 2' },
    { c: 'CNS / nervous system depression', d: 'Opioids, sedatives, CNS injury, cerebral herniation', s: 'ATS Table 2' },
    { c: 'Sleep-disordered breathing', d: 'OSA (obstructive sleep apnea), OHS (obesity hypoventilation)', s: 'ATS Table 2' },
    { c: 'Neuromuscular impairment', d: 'Guillain-Barré, myasthenia gravis, ALS, phrenic nerve palsy', s: 'ATS Table 2' },
    { c: 'Chest wall / ventilatory restriction', d: 'Kyphoscoliosis, flail chest, massive effusion, severe obesity', s: 'ATS Table 2' },
    { c: 'Increased CO2 production', d: 'Shivering, rigors, seizures, malignant hyperthermia, hypermetabolism', s: 'ATS Table 2' },
    { c: 'Severe parenchymal lung disease', d: 'Late-stage pulmonary fibrosis, severe pneumonia', s: 'ERS Table 4' },
    { c: 'Incorrect mechanical ventilation', d: 'Inadequate minute ventilation settings', s: 'ATS Table 2' },
  ],
  RESP_ALKALOSIS: [
    { c: 'CNS stimulation', d: 'Fever, pain, anxiety, CVA, cerebral oedema, brain trauma, CNS infection', s: 'ATS Table 3' },
    { c: 'Hypoxaemia / tissue hypoxia', d: 'Lung disease, severe anaemia, low FiO2, high altitude', s: 'ATS Table 3' },
    { c: 'Chest receptor stimulation', d: 'Pulmonary oedema, pleural effusion, pneumonia, pneumothorax, PE', s: 'ATS Table 3' },
    { c: 'Drugs and hormones', d: 'Salicylates, catecholamines, progesterone, medroxyprogesterone', s: 'ATS Table 3' },
    { c: 'Systemic conditions', d: 'Pregnancy, liver failure, sepsis (early), hyperthyroidism', s: 'ATS Table 3' },
    { c: 'Over-ventilation (mechanical)', d: 'Incorrect ventilator settings — iatrogenic hyperventilation', s: 'ATS Table 3' },
  ],
  HAGMA: [
    { c: 'Lactic acidosis — Type A', d: 'Septic shock, cardiogenic shock, mesenteric ischaemia — most common overall', s: 'ATS Table 5 + ERS' },
    { c: 'Lactic acidosis — Type B', d: 'Metformin toxicity, NRTIs, thiamine deficiency, malignancy', s: 'ATS Table 5' },
    { c: 'Diabetic ketoacidosis (DKA)', d: 'Most common ketoacidosis; glucose >14 mmol/L, ketonuria', s: 'ATS Table 5 + ERS' },
    { c: 'Alcoholic ketoacidosis', d: 'Heavy alcohol use, fasting, dehydration', s: 'ATS Table 5' },
    { c: 'Starvation ketoacidosis', d: 'Prolonged fasting, severe malnutrition', s: 'ATS Table 5' },
    { c: 'Uraemic acidosis (renal failure)', d: 'Advanced CKD (GFR <20); retained organic anions', s: 'ATS Table 5' },
    { c: 'Toxic alcohols', d: 'Methanol (formate), ethylene glycol (oxalate, glycolate); check osmolal gap', s: 'ATS Table 5' },
    { c: 'Salicylate (aspirin) toxicity', d: 'Often mixed HAGMA + respiratory alkalosis; tinnitus, hyperpnoea', s: 'ATS Table 5 + ERS' },
    { c: 'Pyroglutamic acidosis (5-oxoproline)', d: 'Chronic paracetamol + sepsis/malnutrition; often missed', s: 'ATS Table 5' },
    { c: 'D-lactic acidosis', d: 'Short-bowel syndrome; normal L-lactate, elevated D-lactate', s: 'ATS Table 5' },
  ],
  NAGMA: [
    { c: 'GI bicarbonate loss — diarrhoea', d: 'Most common NAGMA cause; secretory diarrhoea, fistulae', s: 'ATS Table 5' },
    { c: 'Renal tubular acidosis (RTA)', d: 'Type 1 (distal), Type 2 (proximal), Type 4 (hyperkalaemic)', s: 'ATS Table 5 + ERS' },
    { c: 'Ureteral diversion', d: 'Ileal conduit, ureterosigmoidostomy — Cl/HCO3 exchange', s: 'ATS Table 5' },
    { c: 'Early CKD', d: 'Moderate renal impairment before AG rises', s: 'ATS Table 5' },
    { c: 'Carbonic anhydrase inhibitors', d: 'Acetazolamide, topiramate — proximal HCO3 wasting', s: 'ATS Table 5' },
    { c: 'NS resuscitation (dilutional)', d: 'Large-volume 0.9% NaCl infusion → hyperchloraemic acidosis', s: 'ATS Table 5' },
  ],
  MET_ALKALOSIS: [
    { c: 'Vomiting / NG suction', d: 'Loss of gastric HCl; hypochloraemic, hypokalaemic', s: 'ATS Table 4' },
    { c: 'Diuretic use (loop/thiazide)', d: 'Contraction alkalosis; Cl-responsive', s: 'ATS Table 4' },
    { c: 'Post-hypercapnic alkalosis', d: 'Rapid correction of chronic respiratory acidosis', s: 'ATS Table 4' },
    { c: 'Hyperaldosteronism', d: "Primary (Conn's) or secondary (CHF, cirrhosis); Cl-resistant", s: 'ATS Table 4' },
    { c: "Cushing's syndrome / exogenous steroids", d: 'Mineralocorticoid effect; hypokalaemia', s: 'ATS Table 4' },
    { c: 'Alkali administration', d: 'NaHCO3, citrate (massive transfusion), antacids', s: 'ATS Table 4' },
    { c: 'Severe hypokalaemia', d: 'Intracellular shift of H+ → maintains alkalosis', s: 'ATS Table 4' },
    { c: "Bartter's / Gitelman's syndromes", d: 'Inherited tubular disorders mimicking diuretics', s: 'ATS Table 4' },
  ],
};

function selectDDx(disorder: string, agElev: boolean, deltaMixed: string | null): DDxCategory[] {
  const ddx: DDxCategory[] = [];

  if (disorder.includes('RESP_ACIDOSIS') || disorder.includes('MIXED_ACIDOSIS'))
    ddx.push({ cat: 'Respiratory Acidosis', col: '#FFA502', items: DDX.RESP_ACIDOSIS });
  if (disorder.includes('RESP_ALKALOSIS') || disorder.includes('MIXED_ALKALOSIS'))
    ddx.push({ cat: 'Respiratory Alkalosis', col: '#3B82F6', items: DDX.RESP_ALKALOSIS });

  const isMA = disorder.includes('MET_ACIDOSIS') || disorder === 'COMP_MET_ACID' || disorder === 'MIXED_ACIDOSIS' || disorder === 'COMP_RESP_ALK_MIX';
  if (isMA) {
    if (agElev) ddx.push({ cat: 'High AG Metabolic Acidosis (HAGMA)', col: '#FF4757', items: DDX.HAGMA });
    else ddx.push({ cat: 'Normal AG Metabolic Acidosis (NAGMA)', col: '#FF4757', items: DDX.NAGMA });
    if (deltaMixed === 'HAGMA + NAGMA') ddx.push({ cat: 'Co-existing NAGMA', col: '#FFA502', items: DDX.NAGMA });
    if (deltaMixed === 'HAGMA + metabolic alkalosis') ddx.push({ cat: 'Co-existing Metabolic Alkalosis', col: '#8B5CF6', items: DDX.MET_ALKALOSIS });
  }

  if (disorder.includes('MET_ALKALOSIS') || disorder.includes('MIXED_ALKALOSIS'))
    ddx.push({ cat: 'Metabolic Alkalosis', col: '#8B5CF6', items: DDX.MET_ALKALOSIS });

  if (disorder === 'COMP_RESP_ALK_MIX') {
    ddx.push({ cat: 'Respiratory Alkalosis (possible)', col: '#3B82F6', items: DDX.RESP_ALKALOSIS });
    ddx.push({ cat: 'Metabolic Acidosis (co-existing)', col: '#FF4757', items: DDX.NAGMA });
  }

  return ddx;
}

export function runABGEngine(inp: ABGInput): ABGResult {
  const FiO2 = (inp.FiO2 || 21) / 100;
  const phR = assessPH(inp.pH);
  const prim = identifyPrimary(inp.pH, inp.PaCO2, inp.HCO3);
  const comp = assessComp(prim.disorder, inp.pH, inp.PaCO2, inp.HCO3);
  const AG = calcAG(inp.Na, inp.Cl, inp.HCO3);
  const corrR = calcCorrAG(AG, inp.albumin);
  const agElev = corrR.corrAG > corrR.normalAG + 2;
  const isMA = prim.disorder.includes('MET_ACIDOSIS') || prim.disorder === 'COMP_MET_ACID' || prim.disorder === 'MIXED_ACIDOSIS' || prim.disorder === 'COMP_RESP_ALK_MIX';
  const delta = isMA && agElev ? calcDelta(corrR.corrAG, corrR.normalAG, inp.HCO3) : null;
  const oxy = assessOxy(inp.PaO2, inp.SaO2, FiO2);
  const crits = detectCrits(inp, oxy);
  const ddx = selectDDx(prim.disorder, agElev, delta?.mixed ?? null);

  const compShort = ['OK', 'ACUTE', 'CHRONIC'].includes(comp.status)
    ? 'Compensated'
    : comp.status === 'NONE'
      ? 'Uncompensated'
      : 'Partially Compensated';

  const steps: StepItem[] = [
    {
      n: 1,
      title: 'Internal Consistency',
      finding: `[H+] = ${rv(24 * inp.PaCO2 / inp.HCO3)} nmol/L`,
      detail: `[H+] = 24 × PaCO2 / HCO3 = 24 × ${inp.PaCO2} / ${inp.HCO3}. Should correlate with pH ${inp.pH}.`,
    },
    {
      n: 2,
      title: 'pH Assessment',
      finding: phR.label,
      detail: `pH ${inp.pH} — Normal 7.35–7.45 (ATS) / 7.38–7.42 (ERS).${phR.critical ? ' ⚠ CRITICAL VALUE.' : ''}`,
    },
    {
      n: 3,
      title: 'Primary Disorder',
      finding: prim.label,
      detail: `PaCO2 ${inp.PaCO2} mmHg (ref 35–45) | HCO3 ${inp.HCO3} mEq/L (ref 22–26). Respiratory: pH & PaCO2 move in opposite directions. Metabolic: pH & PaCO2 move in the same direction.`,
    },
    {
      n: 4,
      title: 'Compensation',
      finding: comp.label,
      detail: `${comp.exp?.formula || ''}${comp.note ? ' — ' + comp.note : ''}${comp.exp?.lo ? ' | Expected PaCO2: ' + comp.exp.lo + '–' + comp.exp.hi + ' mmHg (actual: ' + inp.PaCO2 + ')' : ''}${comp.exp?.acute ? ' | Expected HCO3 acute: ' + comp.exp.acute.lo + '–' + comp.exp.acute.hi + ' / chronic: ' + (comp.exp.chronic?.lo ?? '') + '–' + (comp.exp.chronic?.hi ?? '') + ' mEq/L (actual: ' + inp.HCO3 + ')' : ''}`,
    },
    {
      n: 5,
      title: 'Anion Gap',
      finding: `Measured: ${AG} | Corrected: ${corrR.corrAG} | ${agElev ? 'ELEVATED' : 'Normal'}`,
      detail: `AG = Na(${inp.Na}) − [Cl(${inp.Cl}) + HCO3(${inp.HCO3})] = ${AG}. Albumin correction: +${corrR.corr} mEq/L → Corrected AG: ${corrR.corrAG}. Normal AG (adjusted): ${corrR.normalAG} ± 2.`,
    },
    {
      n: 6,
      title: 'Delta Ratio (Δ/Δ)',
      finding: delta ? delta.interp : 'Not applicable (no elevated AG metabolic acidosis)',
      detail: delta
        ? `ΔAG = ${delta.dAG} | ΔHCO3 = ${delta.dHCO3} | Ratio = ${delta.ratio ?? 'N/A'}. <1.0 = co-existing NAGMA, 1.0–2.0 = pure HAGMA, >2.0 = co-existing met. alkalosis.`
        : 'Delta ratio only calculated when elevated AG metabolic acidosis is present.',
    },
    {
      n: 7,
      title: 'Oxygenation',
      finding: oxy.label,
      detail: `PaO2 ${inp.PaO2} mmHg | SaO2 ${inp.SaO2}% | FiO2 ${inp.FiO2}%${oxy.PF ? ' | P/F ratio: ' + oxy.PF : ''}${oxy.ARDS ? ' | ' + oxy.ARDS : ''}`,
    },
  ];

  return { phR, prim, comp, AG, corrR, agElev, delta, oxy, crits, ddx, compShort, steps, inp };
}

export const REF_RANGES = [
  { name: 'pH', normal: '7.35 – 7.45', crit: '<7.20 or >7.60', src: 'ATS + ERS' },
  { name: 'PaCO2', normal: '35 – 45 mmHg', crit: '>70 or <20 mmHg', src: 'ATS + ERS' },
  { name: 'HCO3⁻', normal: '22 – 26 mEq/L', crit: '<10 mEq/L', src: 'ATS + ERS' },
  { name: 'PaO2 (healthy)', normal: '90 – 95 mmHg', crit: '<60 = resp. failure', src: 'ERS Step 1' },
  { name: 'SaO2', normal: '95 – 100%', crit: '<88% critical', src: 'ERS Step 1' },
  { name: 'Albumin', normal: '3.5 – 5.5 g/dL (35 – 55 g/L)', crit: '<2.0 g/dL', src: 'Clinical' },
  { name: 'Anion Gap', normal: '12 ± 2 mEq/L', crit: '>14 corrected', src: 'ATS Step 5' },
  { name: 'PA-aO2 (young)', normal: '<15 mmHg', crit: '>20 mmHg (elderly)', src: 'ERS Step 1' },
  { name: 'Osmolal Gap', normal: '<10 mOsm/kg', crit: '>10 = toxic alcohol', src: 'ATS Step 5' },
  { name: 'P/F Ratio', normal: '>300 mmHg', crit: '≤200 = ARDS', src: 'ERS Table 2' },
];

export const FORMULAS = [
  { n: "Winter's formula", f: 'PaCO2 = (1.5 × HCO3) + 8 ± 2' },
  { n: 'Met. alkalosis compensation', f: 'PaCO2 = 40 + 0.6 × (ΔHCO3)' },
  { n: 'Acute resp. acidosis comp.', f: 'ΔHCO3 = ΔPaCO2/10 ± 3' },
  { n: 'Chronic resp. acidosis comp.', f: 'ΔHCO3 = 3.5 × (ΔPaCO2/10)' },
  { n: 'Acute resp. alkalosis comp.', f: 'ΔHCO3 = 2 × (ΔPaCO2/10)' },
  { n: 'Chronic resp. alkalosis comp.', f: 'ΔHCO3 = 5–7 × (ΔPaCO2/10)' },
  { n: 'Anion Gap', f: 'AG = Na⁺ − (Cl⁻ + HCO3⁻)' },
  { n: 'Albumin-corrected AG', f: '−2.5 mEq/L per 1 g/dL ↓ albumin' },
  { n: 'Delta Ratio (Δ/Δ)', f: 'ΔAG / ΔHCO3 → 1.0–2.0 = pure HAGMA' },
  { n: 'Osmolal Gap', f: 'Measured − (2[Na] + glucose/18 + BUN/2.8)' },
  { n: 'PA-aO2', f: '[(PB − PH2O) × FiO2 − PaCO2/R] − PaO2' },
  { n: 'Rule of 130', f: 'PaO2 + PaCO2 ≈ 130 mmHg (sea level, FiO2 21%)' },
];

export const MIXED_PATTERNS = [
  { p: 'Resp. Acidosis + Met. Acidosis', pH: '↓↓', HCO3: '↓', CO2: '↑', ex: 'Cardiac arrest, intoxications, multi-organ failure' },
  { p: 'Resp. Alkalosis + Met. Alkalosis', pH: '↑↑', HCO3: '↑', CO2: '↓', ex: 'Cirrhosis + diuretics, pregnancy + vomiting, over-ventilated COPD' },
  { p: 'Resp. Acidosis + Met. Alkalosis', pH: '~N', HCO3: '↑', CO2: '↑', ex: 'COPD + diuretics, vomiting, NG suction; severe hypokalaemia' },
  { p: 'Resp. Alkalosis + Met. Acidosis', pH: '~N', HCO3: '↓', CO2: '↓', ex: 'Sepsis, salicylate toxicity, renal failure + CHF/pneumonia' },
];
