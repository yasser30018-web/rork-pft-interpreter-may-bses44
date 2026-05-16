import type { PFTValues, PFTResult, DifferentialDiagnosis, DLCOStatus } from "@/types/pft";

export function interpretPFT(v: PFTValues): PFTResult {
  const r: PFTResult = {
    spirometry: null,
    lungVolumes: null,
    dlco: null,
    pattern: null,
    severity: null,
    bdResponse: null,
    differentials: [],
    pearls: [],
    fvCurve: null,
    warnings: [],
  };

  const hasSpiro = v.fev1fvc !== "" && v.fvc !== "" && v.fev1 !== "";
  if (hasSpiro) {
    const ratio = parseFloat(v.fev1fvc);
    const fvc = parseFloat(v.fvc);
    const fev1 = parseFloat(v.fev1);

    if (ratio < 70) {
      r.spirometry = "obstructive";
    } else if (fvc < 80) {
      r.spirometry = "possible_restrictive";
    } else {
      r.spirometry = "normal";
    }

    if (fev1 >= 70) r.severity = { label: "Mild", color: "#16a34a", bg: "#f0fdf4" };
    else if (fev1 >= 60) r.severity = { label: "Moderate", color: "#65a30d", bg: "#f7fee7" };
    else if (fev1 >= 50) r.severity = { label: "Moderately Severe", color: "#d97706", bg: "#fffbeb" };
    else if (fev1 >= 35) r.severity = { label: "Severe", color: "#ea580c", bg: "#fff7ed" };
    else if (fev1 < 35) r.severity = { label: "Very Severe", color: "#dc2626", bg: "#fef2f2" };
  }

  const hasTLC = v.tlc !== "";
  if (hasTLC) {
    const tlc = parseFloat(v.tlc);
    if (tlc < 80) r.lungVolumes = "low";
    else if (tlc > 120) r.lungVolumes = "high";
    else r.lungVolumes = "normal";
  }

  if (v.bdFev1 !== "" || v.bdFvc !== "") {
    const bd1 = parseFloat(v.bdFev1) || 0;
    const bd2 = parseFloat(v.bdFvc) || 0;
    if (bd1 > 12 || bd2 > 12) r.bdResponse = "significant";
    else r.bdResponse = "not_significant";
  }

  if (r.spirometry === "obstructive") {
    if (r.lungVolumes === "low") r.pattern = "mixed";
    else r.pattern = "obstructive";
  } else if (r.spirometry === "possible_restrictive") {
    if (r.lungVolumes === "low") r.pattern = "restrictive";
    else if (r.lungVolumes === "high") r.pattern = "mixed";
    else if (r.lungVolumes === "normal") r.pattern = "pseudorestriction";
    else r.pattern = "possible_restrictive";
  } else if (r.spirometry === "normal") {
    if (r.lungVolumes === "high") r.pattern = "possible_obstructive_volumes";
    else if (r.lungVolumes === "low") r.pattern = "possible_restrictive_volumes";
    else r.pattern = "normal";
  }

  const dlcoVal = v.dlco !== "" ? parseFloat(v.dlco) : null;
  const dlcoVA = v.dlcova !== "" ? parseFloat(v.dlcova) : null;
  let dlcoStatus: DLCOStatus = null;
  if (dlcoVal !== null) {
    if (dlcoVal < 75) dlcoStatus = "low";
    else if (dlcoVal > 120) dlcoStatus = "high";
    else dlcoStatus = "normal";
  }
  r.dlco = dlcoStatus;

  const diffs: DifferentialDiagnosis[] = [];
  const pearls: string[] = [];

  if (r.pattern === "obstructive" || r.pattern === "mixed") {
    const tlcVal = v.tlc !== "" ? parseFloat(v.tlc) : null;
    const rvVal = v.rv !== "" ? parseFloat(v.rv) : null;

    const emphysemaScore = (dlcoStatus === "low" ? 2 : 0) +
      (tlcVal !== null && tlcVal > 120 ? 2 : 0) +
      (rvVal !== null && rvVal > 140 ? 1 : 0) +
      (r.bdResponse === "not_significant" ? 1 : 0);
    const asthmaScore = (dlcoStatus === "normal" || dlcoStatus === "high" ? 2 : 0) +
      (r.bdResponse === "significant" ? 3 : 0) +
      (tlcVal !== null && tlcVal <= 120 ? 1 : 0);

    if (emphysemaScore >= 3) {
      diffs.push({
        dx: "Emphysema / COPD",
        prob: "High",
        color: "#ef4444",
        evidence: [
          ...(dlcoStatus === "low" ? ["DLCO reduced"] : []),
          ...(tlcVal !== null && tlcVal > 120 ? ["TLC elevated"] : []),
          ...(rvVal !== null && rvVal > 140 ? ["RV markedly elevated"] : []),
          ...(r.bdResponse === "not_significant" ? ["Minimal BD response"] : []),
        ],
        notes: "Dog-leg FV curve expected. Consider HRCT for emphysema quantification.",
      });
    }
    if (asthmaScore >= 3) {
      diffs.push({
        dx: "Bronchial Asthma",
        prob: asthmaScore >= 5 ? "High" : "Moderate",
        color: "#f59e0b",
        evidence: [
          ...(r.bdResponse === "significant" ? ["Significant BD response"] : []),
          ...(dlcoStatus === "normal" || dlcoStatus === "high" ? ["DLCO normal/elevated"] : []),
          ...(tlcVal !== null && tlcVal <= 120 ? ["TLC not elevated"] : []),
        ],
        notes: "Consider methacholine challenge if BD response absent but asthma suspected.",
      });
    }
    if (!emphysemaScore && !asthmaScore) {
      diffs.push({
        dx: "Obstructive Airways Disease (NOS)",
        prob: "Confirm",
        color: "#6366f1",
        evidence: ["FEV1/FVC < 70% confirmed"],
        notes: "Differentiate asthma vs emphysema with DLCO, TLC, and BD response.",
      });
    }
    diffs.push({
      dx: "Bronchiectasis",
      prob: "Consider",
      color: "#8b5cf6",
      evidence: ["Obstructive pattern", "Variable BD response"],
      notes: "Check for purulent sputum, CT chest for dilated bronchi.",
    });
    diffs.push({
      dx: "Cystic Fibrosis",
      prob: "Consider if young",
      color: "#a78bfa",
      evidence: ["Progressive obstructive defect", "Air trapping"],
      notes: "Young patient: check sweat chloride, CFTR genotype.",
    });

    if (r.pattern === "mixed") {
      diffs.unshift({
        dx: "Mixed Obstructive + Restrictive",
        prob: "High",
        color: "#ec4899",
        evidence: [
          "Low FEV1/FVC (obstruction)",
          "Low TLC (restriction)",
        ],
        notes: "Consider COPD + Pulmonary Fibrosis (Combined Pulmonary Fibrosis & Emphysema). DLCO severely reduced is the key clue.",
      });
      diffs.push({
        dx: "Sarcoidosis",
        prob: "Consider",
        color: "#06b6d4",
        evidence: ["Can present as mixed pattern"],
        notes: "Check ACE, bilateral hilar lymphadenopathy on CXR/CT.",
      });
    }
  }

  if (r.pattern === "restrictive" || r.pattern === "possible_restrictive") {
    const dlcoLow = dlcoStatus === "low";
    const dlcoVALow = dlcoVA !== null && dlcoVA < 75;
    const rvHigh = v.rv !== "" && parseFloat(v.rv) > 120;

    if (dlcoLow && dlcoVALow) {
      diffs.push({
        dx: "Interstitial Lung Disease (IPF / ILD)",
        prob: "High",
        color: "#ef4444",
        evidence: [
          "DLCO reduced",
          "DLCO/VA reduced",
          ...(r.pattern === "restrictive" ? ["TLC low (confirmed restriction)"] : []),
        ],
        notes: "Witch's hat FV curve. PEF may be normal or elevated due to increased elastic recoil. HRCT for fibrosis pattern.",
      });
      diffs.push({
        dx: "Hypersensitivity Pneumonitis (HP)",
        prob: "Consider",
        color: "#f97316",
        evidence: ["Restrictive pattern", "DLCO/VA reduced"],
        notes: "Occupational/exposure history. Acute and chronic forms differ in PFT.",
      });
      diffs.push({
        dx: "CTD-Associated ILD",
        prob: "Consider",
        color: "#f59e0b",
        evidence: ["Restrictive + low DLCO/VA"],
        notes: "Monitor FVC trajectory (>10% decline/year = significant). Screen for PAH.",
      });
      diffs.push({
        dx: "Sarcoidosis",
        prob: "Consider",
        color: "#06b6d4",
        evidence: ["Restrictive or mixed pattern", "DLCO reduced"],
        notes: "ACE level, bilateral hilar LN, biopsy.",
      });
    }

    if (!dlcoLow || (dlcoLow && dlcoVA !== null && dlcoVA >= 75)) {
      diffs.push({
        dx: "Neuromuscular Disease (ALS / Myopathy)",
        prob: "Consider",
        color: "#8b5cf6",
        evidence: [
          "DLCO normal (lung parenchyma intact)",
          ...(rvHigh ? ["RV elevated (weak expiratory muscles)"] : []),
        ],
        notes: "Check MIP/MEP. Convex FV curve. Supine FVC drop >30% = diaphragm paralysis.",
      });
      diffs.push({
        dx: "Kyphoscoliosis / Musculoskeletal",
        prob: "Consider",
        color: "#06b6d4",
        evidence: ["DLCO/VA normal", "Parallel FV curve to predicted"],
        notes: "RV/TLC ratio elevated. Check MIP/MEP (mildly reduced).",
      });
      diffs.push({
        dx: "Obesity / Morbid Obesity",
        prob: "Consider",
        color: "#14b8a6",
        evidence: ["ERV very low", "DLCO normal or elevated"],
        notes: "ERV is hallmark. IC/ERV >6:1. BMI >35 supports. Consider pseudorestriction.",
      });
    }

    diffs.push({
      dx: "Post Lobectomy / Pneumonectomy",
      prob: "If history present",
      color: "#64748b",
      evidence: ["Proportional reduction FVC/TLC/FEV1"],
      notes: "DLCO low but DLCO/VA normal/high (remaining lung intact). Review surgical history.",
    });
  }

  if (r.pattern === "normal" || r.pattern === "pseudorestriction") {
    if (dlcoStatus === "low") {
      diffs.push({
        dx: "Pulmonary Arterial Hypertension (PAH)",
        prob: "High priority",
        color: "#ef4444",
        evidence: ["Isolated DLCO reduction", "Normal spirometry/volumes"],
        notes: "Echo mandatory. Right heart catheterization for confirmation.",
      });
      diffs.push({
        dx: "Early ILD / Subclinical Emphysema",
        prob: "Consider",
        color: "#f97316",
        evidence: ["DLCO drops before volumes change"],
        notes: "HRCT chest. Follow-up PFTs every 6-12 months.",
      });
      diffs.push({
        dx: "Pulmonary Embolism (chronic)",
        prob: "Consider",
        color: "#8b5cf6",
        evidence: ["VQ mismatch reduces DLCO"],
        notes: "Check D-dimer, V/Q scan, CT-PA.",
      });
      diffs.push({
        dx: "Anemia",
        prob: "Exclude first",
        color: "#22c55e",
        evidence: ["DLCO corrects to normal with Hgb correction"],
        notes: "Always correct DLCO for hemoglobin. If corrects to normal, anemia is the cause.",
      });
    } else if (dlcoStatus === "high") {
      diffs.push({
        dx: "Alveolar Hemorrhage",
        prob: "Consider",
        color: "#ef4444",
        evidence: ["DLCO paradoxically elevated"],
        notes: "Blood in alveoli takes up CO. Check for hemoptysis, DAH syndrome.",
      });
      diffs.push({
        dx: "Polycythemia / Asthma / Early CHF",
        prob: "Consider",
        color: "#06b6d4",
        evidence: ["Increased Hgb or capillary recruitment"],
        notes: "Check CBC, Echo. Left-to-right shunts also raise DLCO.",
      });
    }
    if (r.pattern === "pseudorestriction") {
      diffs.push({
        dx: "Pseudorestriction (Obesity or Mild Asthma)",
        prob: "Likely",
        color: "#14b8a6",
        evidence: ["Low FVC but normal TLC", "Normal DLCO/VA"],
        notes: "IC/ERV >6:1 confirms obesity. Significant BD response or positive challenge confirms asthma.",
      });
    }
  }

  const pattern = r.pattern;
  if (pattern === "obstructive" && dlcoStatus === "low") r.fvCurve = "dog_leg";
  else if (pattern === "obstructive") r.fvCurve = "scooped";
  else if (pattern === "restrictive" && dlcoStatus === "low") r.fvCurve = "witchs_hat";
  else if (pattern === "restrictive") r.fvCurve = "parallel_small";
  else if (pattern === "possible_obstructive_volumes") r.fvCurve = "subtle_concave";
  else if (pattern === "normal") r.fvCurve = "normal";

  if (v.svc !== "" && v.fvc !== "") {
    const svc = parseFloat(v.svc);
    const fvc = parseFloat(v.fvc);
    if (svc - fvc > 0.15 * fvc) pearls.push("SVC significantly > FVC — Air Trapping confirmed");
  }
  if (v.erv !== "" && parseFloat(v.erv) < 50) pearls.push("Very low ERV — Consider obesity (isolated finding)");
  if (r.bdResponse === "significant") pearls.push("Significant BD response — Strongly suggests asthma");
  if (r.bdResponse === "not_significant") pearls.push("No BD response — does NOT exclude asthma (variable responsiveness)");
  if (dlcoStatus === "low" && r.pattern === "normal") pearls.push("Isolated DLCO reduction — Investigate PAH, early ILD, PE, Anemia");
  if (dlcoStatus === "high") pearls.push("High DLCO — Consider alveolar hemorrhage, polycythemia, early CHF, L-R shunt");
  if (r.pattern === "mixed") pearls.push("Mixed pattern: DLCO severely reduced + preserved FVC — suspect COPD + Fibrosis (CPFE syndrome)");
  if (v.tlc !== "" && parseFloat(v.tlc) < 80 && v.fvc !== "" && parseFloat(v.fvc) >= 80) {
    pearls.push("TLC low but FVC normal — Lab error? Reassess. Normal FVC generally excludes restriction.");
  }

  r.differentials = diffs;
  r.pearls = pearls;
  return r;
}
