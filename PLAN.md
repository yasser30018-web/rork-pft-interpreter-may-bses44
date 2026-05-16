# PulmoLab — Clinical Pulmonary Tools App

**Features**
- Dashboard with 4 main tools: PFT Interpretation, ABG Analysis, Pulmo Tools, Sources
- Enter pulmonary function test values across 4 categories: Spirometry, Bronchodilator Response, Lung Volumes, and Gas Transfer (DLCO)
- Live pattern detection updates as you type (Obstructive, Restrictive, Mixed, Normal, etc.)
- Full interpretation with severity grading (Mild → Very Severe) based on FEV1
- Differential diagnosis cards ranked by probability with supporting evidence and clinical notes
- Expected Flow-Volume curve visualization (SVG) matching the detected pattern
- Bronchodilator response analysis
- Clinical pearls and warnings
- Severity reference scale
- One-tap reset to clear all values
- PDF upload, viewing, and persistent storage in Sources section
- ABG Analysis: Full ABG interpreter with pH assessment, primary disorder identification, compensation analysis (Winter's formula), anion gap + albumin-corrected AG, delta ratio, oxygenation/ARDS assessment, critical alerts, step-by-step reasoning, and differential diagnosis (HAGMA/NAGMA/respiratory/metabolic)
- Other Pulmo Tools: 6MWT Calculator, BODE Index, mMRC Scale, Wells Score, A-a Gradient, O2 Delivery (coming soon)
- Log Book module: clinical cases, procedure tracking, search, offline drafts, embedded calculators, media upload placeholders, competency dashboard, Supabase schema helpers

**Design**
- Clean white/light theme with teal/emerald accent colors and dark text
- Card-based dashboard with animated entrance effects
- Contextual color coding (green for normal, red for severe, amber for moderate, teal for accent)
- Card-based layout with subtle borders and translucent colored backgrounds
- Smooth animations and haptic feedback throughout
- Clean medical instrument aesthetic
- Log Book follows PulmoLab dark/light theme with blue case cards, teal procedure cards, collapsible clinical sections, high-contrast badges, and large mobile tap targets

**Screens**
- **Dashboard**: 4 icon cards (PFT Interpretation, ABG Analysis, Pulmo Tools, Sources) with animated entrance, accent color lines, and professional layout
- **PFT Interpretation**: Sectioned form with tabs, live preview, full interpretation with pattern banner, FV curve SVG, BD response, clinical pearls, differential diagnosis, severity table
- **ABG Analysis**: Full ABG interpreter with input form, quick-fill clinical examples (DKA, COPD, Salicylate, Met. Alk., ARDS, Sepsis), pH gauge, critical alerts, primary disorder banner with badges, 3 sub-tabs (Summary, Reasoning, DDx), Reference tab with normal ranges, formulas, and mixed disorder patterns
- **Pulmo Tools**: List of clinical calculators and scoring systems (coming soon)
- **Sources**: PDF upload via document picker, persistent library with view/delete, file metadata display
- **Log Book**: Landing screen, Interesting Clinical Cases list/form, Clinical Procedures list/form, competency dashboard, recent activity, smart search, local autosave draft flow

**App Icon**
- Dark background with a stylized lung/airflow graphic in teal and cyan tones, with "PulmoLab" branding — clean and medical-looking
