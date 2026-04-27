# Nephrology Module Build Tracker

> **Last Updated:** 2026-04-27
> **Owner:** Maria (AI System Director)
> **Reviewer:** Akima (CCO)
> **Pilot Driver:** Nephrology clinic on Acumen Epic Connect
> **Estimated Effort:** ~52–60 hours across 13 sessions
> **Build Reference:** Mirror cardiology pattern — `card_*` tables (`supabase/migrations/20260210000000_cardiology_module.sql`), `src/types/cardiology.ts` (578 lines), `src/services/cardiology/cardiologyService.ts` (565 lines), `src/services/fhir/cardiology/`, `src/components/cardiology/`. Every architectural decision below was made by mirroring cardiology — when in doubt, look at cardiology and copy the pattern.

---

## How to Read This

| Symbol | Meaning |
|--------|---------|
| BUILT | Exists in codebase, functional |
| PARTIAL | Infrastructure exists, gaps remain |
| MISSING | Not built yet |

---

## Why Nephrology, Why Now

| Factor | Detail |
|--------|--------|
| **Customer signal** | Pilot clinic identified — uses Acumen Epic Connect (Epic-powered nephrology EHR by Fresenius). Established internal sponsor at the clinic. |
| **Integration path** | Acumen = Epic underneath. Existing `src/adapters/implementations/EpicFHIRAdapter.ts` (645 lines) + `src/services/fhirBulkExportService.ts` (466 lines) + `supabase/functions/smart-authorize/` + `smart-token/` = most plumbing already built. |
| **Regulatory tailwind** | Cures Act + ONC Information Blocking Rule compels Acumen/Fresenius to provide standardized FHIR API access. Clinic owns its data — no Fresenius approval needed beyond enabling FHIR client. |
| **Data density** | Dialysis = ~150 treatments/year/patient. Compass Riley's reasoning engine has dense longitudinal context. |
| **Vertical fit** | KDIGO guidelines map to existing `guidelineReferenceEngine`. Renal dosing maps to contraindication detector. ESRD billing = clear revenue (CPT 90935-90999). |

**Timeline target:** 6-8 weeks to first physician encounter scribed end-to-end. **1 month is possible** if BAA + Fresenius FHIR provisioning move in parallel and clinic actively pushes Fresenius support.

---

## Pilot Path — Acumen Epic Connect Integration (Parallel Track)

| Gate | Owner | Best Case | Realistic | Notes |
|------|-------|-----------|-----------|-------|
| BAA executed with clinic | Maria + clinic legal | 1-2 weeks | 2-3 weeks | Standard template path |
| Fresenius enables Epic FHIR client for our tenant | Clinic IT (NOT us) | 1-2 weeks | 2-4 weeks | **Critical path bottleneck** |
| OAuth client credentials provisioned | Fresenius | overlaps | 1 week | System-level scope, not user |
| First successful FHIR pull (Patient + Conditions) | Us | 1 week | 1-2 weeks | First-time Epic-quirks debugging |
| Data lands in patient context spine, Compass Riley reads it | Us | 1 week | 1-2 weeks | Validate against `EpicFHIRAdapter` |
| First real physician encounter scribed + DocumentReference written back | Us + clinic | 1 week | 1-2 weeks | Write scope negotiation |

**Single biggest lever:** clinic-side ownership of the Fresenius ticket and follow-up.

---

## Cross-Session Discipline (Read Before Every Session)

### File Path Convention (mandatory — mirror cardiology exactly)

| Artifact | Path |
|----------|------|
| Migration | `supabase/migrations/<YYYYMMDDHHMMSS>_nephrology_module.sql` (single migration creates all tables in Session 1; subsequent sessions add tables via additive migrations only) |
| Types | `src/types/nephrology.ts` |
| Core service | `src/services/nephrology/nephrologyService.ts` |
| Service barrel | `src/services/nephrology/index.ts` |
| Service tests | `src/services/nephrology/__tests__/nephrologyService.test.ts` |
| FHIR codes | `src/services/fhir/nephrology/codes.ts` |
| FHIR helpers | `src/services/fhir/nephrology/helpers.ts` |
| FHIR types | `src/services/fhir/nephrology/types.ts` |
| FHIR Observation builder | `src/services/fhir/nephrology/NephrologyObservationService.ts` |
| FHIR barrel | `src/services/fhir/nephrology/index.ts` |
| UI dashboard | `src/components/nephrology/NephrologyDashboard.tsx` |
| UI overview tab | `src/components/nephrology/NephrologyOverview.tsx` |
| UI alerts | `src/components/nephrology/NephrologyAlerts.tsx` |
| UI form pattern | `src/components/nephrology/<FormName>Form.tsx` (one per data entry form) |
| UI tests | `src/components/nephrology/__tests__/<Component>.test.tsx` |
| UI barrel | `src/components/nephrology/index.ts` |
| Edge function | `supabase/functions/nephrology-<verb>-<noun>/index.ts` |
| Route | `src/App.tsx` — `/kidney-care` lazy-loaded |
| Feature flag | `nephrology` in tenant module config + `VITE_FEATURE_NEPHROLOGY` env var |

### Mandatory DB Column Convention (every `neph_*` table)

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
patient_id uuid NOT NULL REFERENCES auth.users(id),
tenant_id uuid NOT NULL REFERENCES tenants(id),
created_at timestamptz NOT NULL DEFAULT now(),
updated_at timestamptz NOT NULL DEFAULT now(),
-- domain columns here
```

Plus indexes (always): `idx_<table>_patient`, `idx_<table>_tenant`, plus a date index where applicable.

### Mandatory RLS Policy Template (every `neph_*` table)

```sql
ALTER TABLE public.neph_<table_name> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - select" ON public.neph_<table_name>
  FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY "Tenant isolation - insert" ON public.neph_<table_name>
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "Tenant isolation - update" ON public.neph_<table_name>
  FOR UPDATE USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "Tenant isolation - delete (admin only)" ON public.neph_<table_name>
  FOR DELETE USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());
```

### Mandatory `updated_at` Trigger (every mutable table)

```sql
CREATE TRIGGER update_neph_<table>_updated_at
  BEFORE UPDATE ON public.neph_<table>
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Service Method Signatures (every service must follow `ServiceResult<T>`)

```typescript
async createX(input: CreateXRequest): Promise<ServiceResult<X>>;
async getX(id: string): Promise<ServiceResult<X>>;
async listXForPatient(patientId: string, options?: ListOptions): Promise<ServiceResult<X[]>>;
async updateX(id: string, input: UpdateXRequest): Promise<ServiceResult<X>>;
async deleteX(id: string): Promise<ServiceResult<void>>;
```

### Test Count Targets (per session — match or exceed cardiology density)

| Session | Minimum tests | Coverage Required |
|---------|---------------|-------------------|
| Foundation | 5 | service CRUD smoke tests |
| Each form session | 12-15 | render, validation, submit success, submit error, edge cases (null, boundary values), helper functions |
| Each edge function session | 8 per function | auth (no JWT, invalid JWT), input validation, success path, DB error, FHIR generation, audit log, alert dispatch, role gating |
| Each AI service session | 10 per skill | input validation, model invocation, structured output parsing, error path, audit log, cost tracking |

### Verification Checkpoint (run BEFORE marking session DONE)

```bash
bash scripts/typecheck-changed.sh && npm run lint && npm test
```

Report counts in the session completion entry: `✅ typecheck: 0 / lint: 0 / tests: X passed`.

### Definition of DONE (every session)

A session is DONE only when ALL apply:
1. All files in the session's "Files to create/modify" table exist with the specified line counts (±15%)
2. Migration pushed: `npx supabase db push` succeeded
3. RLS verified: tested as authenticated non-admin user, queries are tenant-scoped
4. Tests pass: count ≥ minimum target listed
5. Lint clean: 0 new warnings
6. Typecheck clean (scoped): 0 errors in changed files
7. Route accessible (if UI): manually verified at `/kidney-care` or session-specific subroute
8. Acceptance criteria checked off (each session lists its own)
9. Tracker updated with commit hash + date + verification counts

---

## Foundation Specification (Built in Session 1, used by all subsequent sessions)

### Database — Migration `2026MMDDHHMMSS_nephrology_module.sql` (creates all 9 tables)

**Order of CREATE TABLE statements matters** (foreign keys cascade):

1. `neph_ckd_registry` (parent — others FK to it)
2. `neph_renal_labs` (FK → registry)
3. `neph_dialysis_treatments` (FK → registry)
4. `neph_dialysis_adequacy` (FK → registry)
5. `neph_vascular_access` (FK → registry)
6. `neph_anemia_management` (FK → registry)
7. `neph_ckd_mbd` (FK → registry)
8. `neph_pd_treatments` (FK → registry)
9. `neph_transplant_workup` (FK → registry)

#### Table 1: `neph_ckd_registry`

```sql
CREATE TABLE IF NOT EXISTS neph_ckd_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  ckd_stage text NOT NULL CHECK (ckd_stage IN ('G1','G2','G3a','G3b','G4','G5','G5D')),
  albuminuria_category text CHECK (albuminuria_category IN ('A1','A2','A3')),
  primary_etiology text NOT NULL CHECK (primary_etiology IN (
    'diabetic_nephropathy','hypertensive_nephrosclerosis','glomerulonephritis',
    'polycystic_kidney_disease','obstructive_uropathy','tubulointerstitial',
    'vascular','autoimmune','drug_induced','unknown','other'
  )),
  secondary_etiologies text[] NOT NULL DEFAULT '{}',
  comorbidities text[] NOT NULL DEFAULT '{}',
  diagnosis_date date NOT NULL,
  esrd_start_date date,
  modality text CHECK (modality IN ('not_on_rrt','hemodialysis','peritoneal_dialysis','transplant','conservative_care')),
  primary_nephrologist_id uuid,
  transplant_candidacy text CHECK (transplant_candidacy IN ('eligible','listed','transplanted','contraindicated','not_evaluated')),
  baseline_egfr numeric(5,2) CHECK (baseline_egfr >= 0 AND baseline_egfr <= 200),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','transferred','deceased')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_neph_registry_patient ON neph_ckd_registry(patient_id);
CREATE INDEX idx_neph_registry_tenant ON neph_ckd_registry(tenant_id);
CREATE INDEX idx_neph_registry_stage ON neph_ckd_registry(ckd_stage);
CREATE INDEX idx_neph_registry_modality ON neph_ckd_registry(modality);
CREATE INDEX idx_neph_registry_status ON neph_ckd_registry(status);
```

#### Table 2: `neph_renal_labs`

```sql
CREATE TABLE IF NOT EXISTS neph_renal_labs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  registry_id uuid NOT NULL REFERENCES neph_ckd_registry(id),
  collected_date timestamptz NOT NULL DEFAULT now(),
  -- BMP
  sodium_meq_l numeric(4,1) CHECK (sodium_meq_l >= 100 AND sodium_meq_l <= 180),
  potassium_meq_l numeric(3,1) CHECK (potassium_meq_l >= 1.0 AND potassium_meq_l <= 10.0),
  chloride_meq_l numeric(4,1),
  bicarbonate_meq_l numeric(4,1) CHECK (bicarbonate_meq_l >= 5 AND bicarbonate_meq_l <= 50),
  bun_mg_dl numeric(5,1),
  creatinine_mg_dl numeric(4,2) NOT NULL CHECK (creatinine_mg_dl >= 0.1 AND creatinine_mg_dl <= 30),
  glucose_mg_dl numeric(5,1),
  -- Calculated
  egfr_ml_min numeric(5,2) NOT NULL CHECK (egfr_ml_min >= 0 AND egfr_ml_min <= 200),
  egfr_formula text NOT NULL DEFAULT 'ckd_epi_2021' CHECK (egfr_formula IN ('ckd_epi_2021','mdrd','cockcroft_gault')),
  -- Mineral / Bone
  calcium_mg_dl numeric(4,2),
  ionized_calcium_mg_dl numeric(4,2),
  phosphorus_mg_dl numeric(4,2),
  magnesium_mg_dl numeric(4,2),
  pth_intact_pg_ml numeric(6,1),
  vitamin_d_25oh_ng_ml numeric(5,1),
  -- Anemia panel
  hemoglobin_g_dl numeric(4,2),
  hematocrit_percent numeric(4,1),
  ferritin_ng_ml numeric(6,1),
  iron_saturation_percent numeric(4,1),
  transferrin_mg_dl numeric(5,1),
  -- Other
  albumin_g_dl numeric(3,2),
  upcr_mg_g numeric(7,1), -- urinary protein/creatinine ratio
  uacr_mg_g numeric(7,1), -- urinary albumin/creatinine ratio
  -- Critical flags (computed at insert via trigger or service)
  has_critical_value boolean NOT NULL DEFAULT false,
  critical_flags text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_neph_labs_patient ON neph_renal_labs(patient_id);
CREATE INDEX idx_neph_labs_tenant ON neph_renal_labs(tenant_id);
CREATE INDEX idx_neph_labs_registry ON neph_renal_labs(registry_id);
CREATE INDEX idx_neph_labs_date ON neph_renal_labs(collected_date DESC);
CREATE INDEX idx_neph_labs_critical ON neph_renal_labs(has_critical_value) WHERE has_critical_value = true;
```

#### Table 3: `neph_dialysis_treatments`

```sql
CREATE TABLE IF NOT EXISTS neph_dialysis_treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  registry_id uuid NOT NULL REFERENCES neph_ckd_registry(id),
  treatment_date timestamptz NOT NULL,
  modality text NOT NULL CHECK (modality IN ('hd','hdf','sled','crrt')),
  scheduled boolean NOT NULL DEFAULT true,
  attended boolean NOT NULL DEFAULT true,
  duration_min integer CHECK (duration_min >= 0 AND duration_min <= 720),
  pre_weight_kg numeric(5,2),
  post_weight_kg numeric(5,2),
  dry_weight_kg numeric(5,2),
  uf_goal_l numeric(4,2),
  uf_actual_l numeric(4,2),
  pre_bp_systolic integer,
  pre_bp_diastolic integer,
  post_bp_systolic integer,
  post_bp_diastolic integer,
  pre_hr integer,
  post_hr integer,
  dialyzer text,
  blood_flow_ml_min integer,
  dialysate_flow_ml_min integer,
  dialysate_composition jsonb DEFAULT '{}', -- K, Ca, HCO3, Na
  anticoagulation text,
  anticoagulation_dose text,
  vascular_access_used uuid REFERENCES neph_vascular_access(id),
  complications text[] NOT NULL DEFAULT '{}',
  symptomatic_hypotension boolean NOT NULL DEFAULT false,
  cramps boolean NOT NULL DEFAULT false,
  nurse_notes text,
  md_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_neph_dx_patient ON neph_dialysis_treatments(patient_id);
CREATE INDEX idx_neph_dx_tenant ON neph_dialysis_treatments(tenant_id);
CREATE INDEX idx_neph_dx_registry ON neph_dialysis_treatments(registry_id);
CREATE INDEX idx_neph_dx_date ON neph_dialysis_treatments(treatment_date DESC);
CREATE INDEX idx_neph_dx_missed ON neph_dialysis_treatments(scheduled, attended) WHERE scheduled = true AND attended = false;
```

> **Note:** `neph_vascular_access` is created BEFORE `neph_dialysis_treatments` in migration order so the FK above resolves. If you hit a circular reference, drop the FK constraint and add it via `ALTER TABLE` after both tables exist.

#### Table 4: `neph_dialysis_adequacy`

```sql
CREATE TABLE IF NOT EXISTS neph_dialysis_adequacy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  registry_id uuid NOT NULL REFERENCES neph_ckd_registry(id),
  measured_date date NOT NULL,
  modality text NOT NULL CHECK (modality IN ('hd','pd')),
  -- HD adequacy
  spkt_v numeric(4,2), -- single-pool Kt/V (Daugirdas II)
  ekt_v numeric(4,2),  -- equilibrated Kt/V
  urr_percent numeric(4,1), -- urea reduction ratio
  npcr_g_kg_day numeric(4,2), -- normalized protein catabolic rate
  rrf_ml_min numeric(4,2), -- residual renal function
  -- PD adequacy (weekly)
  weekly_kt_v numeric(4,2),
  weekly_ccr_l_week numeric(5,1), -- creatinine clearance weekly
  -- Targets and flags
  meets_target boolean NOT NULL DEFAULT false,
  target_basis text NOT NULL DEFAULT 'kdoqi_2015',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_neph_adequacy_patient ON neph_dialysis_adequacy(patient_id);
CREATE INDEX idx_neph_adequacy_tenant ON neph_dialysis_adequacy(tenant_id);
CREATE INDEX idx_neph_adequacy_registry ON neph_dialysis_adequacy(registry_id);
CREATE INDEX idx_neph_adequacy_date ON neph_dialysis_adequacy(measured_date DESC);
CREATE INDEX idx_neph_adequacy_below_target ON neph_dialysis_adequacy(meets_target) WHERE meets_target = false;
```

#### Table 5: `neph_vascular_access`

```sql
CREATE TABLE IF NOT EXISTS neph_vascular_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  registry_id uuid NOT NULL REFERENCES neph_ckd_registry(id),
  access_type text NOT NULL CHECK (access_type IN (
    'avf','avg','tunneled_catheter','non_tunneled_catheter','pd_catheter'
  )),
  side text CHECK (side IN ('left','right')),
  location text, -- 'forearm','upper_arm','chest','femoral','jugular'
  creation_date date,
  first_cannulation_date date,
  surgeon text,
  status text NOT NULL DEFAULT 'maturing' CHECK (status IN (
    'maturing','active','at_risk','clotted','abandoned','removed'
  )),
  has_active_infection boolean NOT NULL DEFAULT false,
  last_infection_date date,
  intervention_count integer NOT NULL DEFAULT 0, -- declots, angioplasties
  last_intervention_date date,
  recent_qa_ml_min integer, -- access flow
  recent_recirculation_percent numeric(4,1),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_neph_access_patient ON neph_vascular_access(patient_id);
CREATE INDEX idx_neph_access_tenant ON neph_vascular_access(tenant_id);
CREATE INDEX idx_neph_access_registry ON neph_vascular_access(registry_id);
CREATE INDEX idx_neph_access_status ON neph_vascular_access(status);
CREATE INDEX idx_neph_access_infection ON neph_vascular_access(has_active_infection) WHERE has_active_infection = true;
```

#### Table 6: `neph_anemia_management`

```sql
CREATE TABLE IF NOT EXISTS neph_anemia_management (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  registry_id uuid NOT NULL REFERENCES neph_ckd_registry(id),
  recorded_date date NOT NULL,
  esa_agent text CHECK (esa_agent IN (
    'epoetin_alfa','epoetin_alfa_biosimilar','darbepoetin','methoxy_peg_epoetin','none'
  )),
  esa_dose_units numeric(7,1),
  esa_frequency text, -- 'qhd','tiw','qweek','q2week','q4week'
  esa_route text CHECK (esa_route IN ('iv','sc','none')),
  iron_agent text CHECK (iron_agent IN (
    'iron_sucrose','ferric_gluconate','ferric_carboxymaltose','iron_sucrose_oral','none'
  )),
  iron_dose_mg numeric(6,1),
  iron_frequency text,
  hgb_target_low numeric(3,1) NOT NULL DEFAULT 10.0,
  hgb_target_high numeric(3,1) NOT NULL DEFAULT 11.5,
  current_hgb numeric(4,2),
  current_ferritin numeric(6,1),
  current_iron_sat numeric(4,1),
  meets_hgb_target boolean,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_neph_anemia_patient ON neph_anemia_management(patient_id);
CREATE INDEX idx_neph_anemia_tenant ON neph_anemia_management(tenant_id);
CREATE INDEX idx_neph_anemia_registry ON neph_anemia_management(registry_id);
CREATE INDEX idx_neph_anemia_date ON neph_anemia_management(recorded_date DESC);
```

#### Table 7: `neph_ckd_mbd`

```sql
CREATE TABLE IF NOT EXISTS neph_ckd_mbd (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  registry_id uuid NOT NULL REFERENCES neph_ckd_registry(id),
  recorded_date date NOT NULL,
  phosphate_binders text[] NOT NULL DEFAULT '{}', -- 'calcium_acetate','sevelamer_carbonate','sevelamer_hcl','lanthanum','ferric_citrate','sucroferric_oxyhydroxide'
  binder_doses jsonb DEFAULT '{}',
  vitamin_d_analog text CHECK (vitamin_d_analog IN (
    'calcitriol','paricalcitol','doxercalciferol','none'
  )),
  vitamin_d_dose_mcg numeric(5,2),
  calcimimetic text CHECK (calcimimetic IN ('cinacalcet','etelcalcetide','none')),
  calcimimetic_dose_mg numeric(5,2),
  parathyroidectomy_history boolean NOT NULL DEFAULT false,
  parathyroidectomy_date date,
  current_calcium numeric(4,2),
  current_phosphorus numeric(4,2),
  current_pth numeric(6,1),
  meets_kdigo_targets jsonb DEFAULT '{}', -- {ca: bool, phos: bool, pth: bool}
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_neph_mbd_patient ON neph_ckd_mbd(patient_id);
CREATE INDEX idx_neph_mbd_tenant ON neph_ckd_mbd(tenant_id);
CREATE INDEX idx_neph_mbd_registry ON neph_ckd_mbd(registry_id);
CREATE INDEX idx_neph_mbd_date ON neph_ckd_mbd(recorded_date DESC);
```

#### Table 8: `neph_pd_treatments`

```sql
CREATE TABLE IF NOT EXISTS neph_pd_treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  registry_id uuid NOT NULL REFERENCES neph_ckd_registry(id),
  log_date date NOT NULL,
  pd_modality text NOT NULL CHECK (pd_modality IN ('capd','ccpd','apd','nipd','tpd')),
  exchange_volume_ml integer,
  exchanges_per_day integer,
  dwell_time_min integer,
  dextrose_concentration text[] NOT NULL DEFAULT '{}', -- '1.5%','2.5%','4.25%'
  uses_icodextrin boolean NOT NULL DEFAULT false,
  daily_uf_ml integer,
  has_peritonitis boolean NOT NULL DEFAULT false,
  peritonitis_organism text,
  has_exit_site_infection boolean NOT NULL DEFAULT false,
  catheter_dysfunction boolean NOT NULL DEFAULT false,
  pet_result text CHECK (pet_result IN ('high','high_average','low_average','low','not_done')),
  weekly_kt_v numeric(4,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_neph_pd_patient ON neph_pd_treatments(patient_id);
CREATE INDEX idx_neph_pd_tenant ON neph_pd_treatments(tenant_id);
CREATE INDEX idx_neph_pd_registry ON neph_pd_treatments(registry_id);
CREATE INDEX idx_neph_pd_date ON neph_pd_treatments(log_date DESC);
CREATE INDEX idx_neph_pd_peritonitis ON neph_pd_treatments(has_peritonitis) WHERE has_peritonitis = true;
```

#### Table 9: `neph_transplant_workup`

```sql
CREATE TABLE IF NOT EXISTS neph_transplant_workup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  registry_id uuid NOT NULL REFERENCES neph_ckd_registry(id),
  candidacy_status text NOT NULL CHECK (candidacy_status IN (
    'not_evaluated','in_workup','eligible','listed','transplanted','contraindicated','removed_from_list'
  )),
  blood_type text CHECK (blood_type IN ('A','B','AB','O')),
  rh_factor text CHECK (rh_factor IN ('positive','negative')),
  pra_class_i_percent numeric(4,1),
  pra_class_ii_percent numeric(4,1),
  cpra_percent numeric(4,1),
  hla_typing jsonb DEFAULT '{}',
  donor_evaluation_status text CHECK (donor_evaluation_status IN (
    'none','living_related_workup','living_unrelated_workup','deceased_donor_listing'
  )),
  cardiac_clearance boolean NOT NULL DEFAULT false,
  cardiac_clearance_date date,
  cancer_screening_complete boolean NOT NULL DEFAULT false,
  infection_screening_complete boolean NOT NULL DEFAULT false,
  dental_clearance boolean NOT NULL DEFAULT false,
  psychosocial_clearance boolean NOT NULL DEFAULT false,
  listed_date date,
  unos_id text,
  transplant_date date,
  transplant_type text CHECK (transplant_type IN ('living_related','living_unrelated','deceased','combined')),
  contraindications text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_neph_tx_patient ON neph_transplant_workup(patient_id);
CREATE INDEX idx_neph_tx_tenant ON neph_transplant_workup(tenant_id);
CREATE INDEX idx_neph_tx_registry ON neph_transplant_workup(registry_id);
CREATE INDEX idx_neph_tx_status ON neph_transplant_workup(candidacy_status);
```

### Types File — `src/types/nephrology.ts` (target ~600 lines)

Required ENUMS (must match DB CHECK constraints exactly):
- `CKDStage` = `'G1'|'G2'|'G3a'|'G3b'|'G4'|'G5'|'G5D'`
- `AlbuminuriaCategory` = `'A1'|'A2'|'A3'`
- `CKDEtiology` = (11 values from registry CHECK)
- `RenalReplacementModality` = (5 values from registry CHECK)
- `TransplantCandidacy` = (5 values from registry CHECK)
- `DialysisModality` = `'hd'|'hdf'|'sled'|'crrt'`
- `PDModality` = `'capd'|'ccpd'|'apd'|'nipd'|'tpd'`
- `VascularAccessType` = (5 values)
- `VascularAccessStatus` = (6 values)
- `ESAAgent`, `IronAgent`, `VitaminDAnalog`, `Calcimimetic`, `PhosphateBinder`
- `BloodType`, `RhFactor`, `DonorEvaluationStatus`, `TransplantType`
- `eGFRFormula` = `'ckd_epi_2021'|'mdrd'|'cockcroft_gault'`
- `PETResult` = `'high'|'high_average'|'low_average'|'low'|'not_done'`
- `KDIGORiskCategory` = `'low'|'moderate'|'high'|'very_high'` (computed)

Required INTERFACES (mirror DB row shapes):
- `CKDRegistry`, `RenalLab`, `DialysisTreatment`, `DialysisAdequacy`, `VascularAccess`, `AnemiaManagement`, `CKDMBD`, `PDTreatment`, `TransplantWorkup`
- `CreateXRequest` and `UpdateXRequest` for each (omit `id`, `created_at`, `updated_at`, allow optional fields)

Required CLINICAL HELPERS (with these exact signatures):
```typescript
// CKD-EPI 2021 race-free equation. Returns mL/min/1.73m².
export function calculateEGFR_CKDEPI_2021(
  creatinine_mg_dl: number,
  age_years: number,
  is_female: boolean
): number;

// KDIGO heat map classification from eGFR + albuminuria
export function classifyKDIGORisk(
  ckdStage: CKDStage,
  albuminuriaCategory: AlbuminuriaCategory
): KDIGORiskCategory;

// Daugirdas II single-pool Kt/V calculation
export function calculateSPKtV(
  preBUN: number,
  postBUN: number,
  ufVolume_l: number,
  postWeight_kg: number,
  durationMin: number
): number;

// Urea Reduction Ratio
export function calculateURR(preBUN: number, postBUN: number): number;

// Critical lab value flagger — returns array of flag strings for any critical values
export function flagCriticalRenalLabs(lab: RenalLab): string[];

// KDIGO mineral bone targets check
export function meetsKDIGOMineralTargets(
  calcium: number,
  phosphorus: number,
  pth: number,
  modality: RenalReplacementModality
): { ca: boolean; phos: boolean; pth: boolean };

// Anemia target check (KDIGO: Hgb 10.0-11.5 g/dL on ESA)
export function meetsAnemiaTarget(hgb: number, onESA: boolean): boolean;

// IDWG calculation as percent of dry weight
export function calculateIDWGPercent(
  preWeight_kg: number,
  dryWeight_kg: number
): number;
```

Required CONSTANTS:
- `KDIGO_MINERAL_TARGETS` (Ca 8.4-10.2, Phos 3.5-5.5 dialysis / 2.5-4.5 non-dialysis, PTH 150-600 dialysis / 35-110 non-dialysis)
- `KDOQI_ADEQUACY_TARGETS` (HD spKt/V ≥ 1.2, PD weekly Kt/V ≥ 1.7)
- `ANEMIA_TARGETS` (Hgb 10.0-11.5 on ESA, ferritin > 200 dialysis / > 100 non-dialysis, TSAT > 20%)
- `CRITICAL_LAB_THRESHOLDS` (K+ > 5.5, K+ > 6.5 critical, HCO3 < 18, phos > 6.5, Hgb < 8, etc.)

### FHIR Codes File — `src/services/fhir/nephrology/codes.ts`

Required LOINC codes:
```typescript
export const NEPHROLOGY_LOINC_CODES = {
  // Kidney function
  EGFR: '98979-8',                    // GFR/1.73 sq M.predicted by Creatinine-based CKD-EPI 2021 formula
  CREATININE_SERUM: '2160-0',
  BUN: '3094-0',
  CREATININE_CLEARANCE: '2164-2',
  // Electrolytes
  POTASSIUM: '2823-3',
  SODIUM: '2951-2',
  CHLORIDE: '2075-0',
  BICARBONATE: '1963-8',
  // Mineral / Bone
  CALCIUM_TOTAL: '17861-6',
  CALCIUM_IONIZED: '1994-3',
  PHOSPHORUS: '2777-1',
  MAGNESIUM: '2601-3',
  PTH_INTACT: '14866-2',
  VITAMIN_D_25OH: '14635-1',
  // Anemia
  HEMOGLOBIN: '718-7',
  HEMATOCRIT: '4544-3',
  FERRITIN: '2276-4',
  IRON_SATURATION: '2502-3',
  TRANSFERRIN: '3034-6',
  // Dialysis adequacy
  KT_V_SINGLE_POOL: '50546-1',
  KT_V_EQUILIBRATED: '70989-2',
  URR: '51081-8',
  NPCR: '69411-0',
  // Urinary
  UPCR: '2890-2',
  UACR: '9318-7',
  // Other
  ALBUMIN_SERUM: '1751-7',
};
```

Required SNOMED codes:
```typescript
export const NEPHROLOGY_SNOMED_CODES = {
  // Conditions
  CKD_STAGE_1: '431855005',
  CKD_STAGE_2: '431856006',
  CKD_STAGE_3A: '700378005',
  CKD_STAGE_3B: '700379002',
  CKD_STAGE_4: '431857002',
  CKD_STAGE_5: '433146000',
  ESRD: '46177005',
  // Etiologies
  DIABETIC_NEPHROPATHY: '127013003',
  HYPERTENSIVE_NEPHROSCLEROSIS: '197605004',
  GLOMERULONEPHRITIS: '36171008',
  POLYCYSTIC_KIDNEY_DISEASE: '82525005',
  // Procedures
  HEMODIALYSIS: '302497006',
  PERITONEAL_DIALYSIS: '71192002',
  CAPD: '180273006',
  CCPD: '180275004',
  // Access
  AVF_CREATION: '233575001',
  AVG_CREATION: '233576000',
  TUNNELED_CATHETER: '443316001',
  // Complications
  HYPERKALEMIA: '14140009',
  ACUTE_KIDNEY_INJURY: '14669001',
  CATHETER_INFECTION: '432011002',
  PERITONITIS: '48661000',
  // Transplant
  KIDNEY_TRANSPLANT: '70536003',
};
```

Required ICD-10 codes (for FHIR Condition resources):
- `N18.1` (CKD G1), `N18.2` (G2), `N18.30` (G3 unspec), `N18.31` (G3a), `N18.32` (G3b), `N18.4` (G4), `N18.5` (G5), `N18.6` (ESRD), `N18.9` (CKD unspec)
- `Z99.2` (Dependence on dialysis)
- `Z94.0` (Kidney transplant status)
- `T82.7XXA` (Infection due to vascular dialysis catheter)

### Alert Types Specification (10 — implement in Sessions 7-8)

| # | Alert Code | Severity | Trigger Condition | Source Table |
|---|-----------|----------|-------------------|--------------|
| 1 | `HYPERKALEMIA_CRITICAL` | critical | `potassium_meq_l > 6.5` | `neph_renal_labs` |
| 2 | `HYPERKALEMIA_HIGH` | high | `potassium_meq_l > 5.5 AND <= 6.5` | `neph_renal_labs` |
| 3 | `AKI_ON_CKD` | critical | New `creatinine_mg_dl >= 1.5 * baseline OR eGFR drop > 25% from prior` | `neph_renal_labs` |
| 4 | `VASCULAR_ACCESS_INFECTION` | critical | `has_active_infection = true` (any access) | `neph_vascular_access` |
| 5 | `SEVERE_ACIDOSIS` | high | `bicarbonate_meq_l < 18` | `neph_renal_labs` |
| 6 | `HYPERPHOSPHATEMIA` | high | `phosphorus_mg_dl > 6.5` | `neph_renal_labs` |
| 7 | `SEVERE_SHPT` | high | `pth_intact_pg_ml > 600` | `neph_renal_labs` |
| 8 | `MISSED_DIALYSIS` | high | `scheduled = true AND attended = false` | `neph_dialysis_treatments` |
| 9 | `UNDER_DIALYSIS_HD` | high | `modality = 'hd' AND spkt_v < 1.2` | `neph_dialysis_adequacy` |
| 10 | `UNDER_DIALYSIS_PD` | high | `modality = 'pd' AND weekly_kt_v < 1.7` | `neph_dialysis_adequacy` |

### Route + Feature Flag Wiring

In `src/App.tsx` (lazy-loaded route):
```tsx
const NephrologyDashboard = React.lazy(() => import('./components/nephrology/NephrologyDashboard'));
// inside <Routes>:
<Route path="/kidney-care" element={
  <FeatureFlagGuard flag="nephrology" fallback={<Navigate to="/" />}>
    <NephrologyDashboard />
  </FeatureFlagGuard>
} />
```

In `src/components/admin/sections/`: add Nephrology section that links to `/kidney-care` when flag is on.

In tenant module config: add `nephrology` boolean column or entry (mirror cardiology).

In `.env`: add `VITE_FEATURE_NEPHROLOGY=true` for dev/staging.

---

# Phase 1 — Data Entry Forms

## Session 1: Foundation + CKD Registry + Renal Labs Form

### Inputs
- Cardiology module (reference pattern, do not modify)
- This tracker

### Files to Create
| File | Target Lines | Notes |
|------|--------------|-------|
| `supabase/migrations/<TS>_nephrology_module.sql` | ~500 | All 9 tables + RLS + triggers |
| `src/types/nephrology.ts` | ~600 | All enums + interfaces + helpers |
| `src/services/nephrology/nephrologyService.ts` | ~550 | CRUD for registry + labs (other tables stubbed for Sessions 2-5) |
| `src/services/nephrology/index.ts` | <30 | Barrel |
| `src/services/nephrology/__tests__/nephrologyService.test.ts` | ~250 | 12 minimum tests |
| `src/services/fhir/nephrology/codes.ts` | ~100 | LOINC + SNOMED + ICD-10 |
| `src/services/fhir/nephrology/helpers.ts` | ~150 | `interpretEGFR`, `interpretKtV`, etc. |
| `src/services/fhir/nephrology/types.ts` | ~80 | FHIR Observation/Condition shapes |
| `src/services/fhir/nephrology/NephrologyObservationService.ts` | ~250 | Build Observations from labs |
| `src/services/fhir/nephrology/index.ts` | <30 | Barrel |
| `src/components/nephrology/NephrologyDashboard.tsx` | ~450 | 6 tabs, alerts banner, action buttons |
| `src/components/nephrology/NephrologyOverview.tsx` | ~200 | Overview tab content |
| `src/components/nephrology/NephrologyAlerts.tsx` | ~80 | Alert banner |
| `src/components/nephrology/CKDRegistryForm.tsx` | ~320 | Registry form (see fields below) |
| `src/components/nephrology/RenalLabsForm.tsx` | ~360 | Labs form (see fields below) |
| `src/components/nephrology/__tests__/NephrologyDashboard.test.tsx` | ~180 | 12 tests |
| `src/components/nephrology/__tests__/CKDRegistryForm.test.tsx` | ~200 | 13 tests |
| `src/components/nephrology/__tests__/RenalLabsForm.test.tsx` | ~220 | 14 tests |
| `src/components/nephrology/index.ts` | <30 | Barrel |
| `src/App.tsx` | +5 lines | Add `/kidney-care` route + lazy import |

### CKDRegistryForm Field Spec

| Field | Type | Validation | Notes |
|-------|------|-----------|-------|
| CKD Stage | dropdown (CKDStage enum) | required | Show eGFR range hint per stage |
| Albuminuria Category | dropdown (A1/A2/A3) | optional | Show ACR range hint |
| Primary Etiology | dropdown (11 values) | required | |
| Secondary Etiologies | multi-select chip | optional | |
| Comorbidities | multi-select chip | optional | DM, HTN, CHF, CAD, AFib, etc. |
| Diagnosis Date | date | required, ≤ today | |
| ESRD Start Date | date | ≥ diagnosis_date | optional |
| Modality | dropdown (5 values) | required | |
| Primary Nephrologist | text | optional | |
| Transplant Candidacy | dropdown (5 values) | optional | |
| Baseline eGFR | numeric | 0-200 | optional, auto-fills from latest labs if available |
| Status | dropdown (4 values) | required | default `active` |
| Notes | textarea | optional | |

KDIGO heat map preview shown when stage + albuminuria are selected (displays risk category in colored badge).

### RenalLabsForm Field Spec

Grouped sections: BMP / Mineral & Bone / Anemia Panel / Urinary / Other. Each numeric field shows reference range. Auto-flags critical values via `flagCriticalRenalLabs()` and shows red alert banner above submit button. eGFR auto-calculates from creatinine + age + sex via `calculateEGFR_CKDEPI_2021()` (auto-pulled from `profiles.dob` and sex when available — fall back to manual entry).

### Acceptance Criteria
- [ ] Migration pushed: `npx supabase db push` returns 0 errors
- [ ] All 9 `neph_*` tables exist (verify with `\dt neph_*` in psql or Supabase Studio)
- [ ] RLS enabled on all 9 tables; tenant isolation verified by signing in as non-admin user
- [ ] `src/types/nephrology.ts` compiles, all enums match DB CHECK constraints
- [ ] `nephrologyService.createCKDRegistry(input)` returns `success(registry)` with all fields populated
- [ ] `nephrologyService.recordRenalLabs(input)` auto-computes eGFR and flags critical values
- [ ] FHIR Observation generated for each lab analyte with correct LOINC code
- [ ] Route `/kidney-care` accessible; renders dashboard shell with 6 tab placeholders
- [ ] CKDRegistryForm: filling all required fields, submitting → registry appears in dashboard
- [ ] RenalLabsForm: entering K+ = 6.8 → critical flag `HYPERKALEMIA_CRITICAL` appears before submit
- [ ] All tests pass; minimum 51 tests added (12 service + 12 dashboard + 13 registry + 14 labs)
- [ ] `bash scripts/typecheck-changed.sh` = 0 errors
- [ ] `npm run lint` = 0 new warnings
- [ ] Visual verification by Maria: forms render, KDIGO heat map preview works, critical-value flagging displays

### Dependencies
- None (greenfield foundation)

### Reference Pattern
- Migration: `supabase/migrations/20260210000000_cardiology_module.sql`
- Types: `src/types/cardiology.ts`
- Service: `src/services/cardiology/cardiologyService.ts`
- FHIR: `src/services/fhir/cardiology/`
- Dashboard: `src/components/cardiology/CardiologyDashboard.tsx`
- Form: `src/components/cardiology/CardiacRegistryForm.tsx` (closest analog)

### Estimated Effort
~6 hours (foundation is heavier than typical session)

---

## Session 2: HD Treatment + Adequacy Forms

### Inputs
- Session 1 complete (registry exists, FK target available)

### Files to Create
| File | Target Lines | Notes |
|------|--------------|-------|
| `src/components/nephrology/HDTreatmentForm.tsx` | ~420 | 3x/week treatment log |
| `src/components/nephrology/AdequacyForm.tsx` | ~280 | Kt/V + URR entry |
| `src/components/nephrology/__tests__/HDTreatmentForm.test.tsx` | ~240 | 14 tests |
| `src/components/nephrology/__tests__/AdequacyForm.test.tsx` | ~200 | 12 tests |
| `src/services/nephrology/nephrologyService.ts` | +200 lines | Add `recordDialysisTreatment`, `recordAdequacy`, `listTreatments`, `listAdequacy` |
| `src/services/nephrology/__tests__/nephrologyService.test.ts` | +150 lines | +8 tests |
| `src/components/nephrology/NephrologyDashboard.tsx` | +60 lines | Wire HD + Adequacy buttons + Dialysis tab |

### HDTreatmentForm Field Spec

Vitals Pre / Vitals Intra / Vitals Post sections. Auto-calculates IDWG (interdialytic weight gain) when pre-weight + dry-weight provided. Auto-flags `MISSED_DIALYSIS` if `attended = false`. Auto-flags `symptomatic_hypotension` from intra-treatment BP < 90 systolic.

### AdequacyForm Field Spec

Modality toggle (HD / PD). For HD: pre-BUN, post-BUN, UF volume, post-weight, duration → auto-computes spKt/V via Daugirdas II + URR. For PD: weekly Kt/V + weekly creatinine clearance entry. Auto-flags `UNDER_DIALYSIS_*` when below KDOQI target. KDOQI target reference card shown.

### Acceptance Criteria
- [ ] HDTreatmentForm: missed treatment flag fires when scheduled=true, attended=false
- [ ] HDTreatmentForm: IDWG auto-calculated and displayed
- [ ] AdequacyForm (HD): entering pre/post BUN auto-computes spKt/V correctly per Daugirdas II
- [ ] AdequacyForm: spKt/V < 1.2 → `UNDER_DIALYSIS_HD` flag visible
- [ ] FHIR Observation generated for spKt/V (LOINC `50546-1`) and URR (LOINC `51081-8`)
- [ ] Dashboard "Dialysis" tab shows last 30 days of treatments
- [ ] All tests pass; minimum 34 tests added
- [ ] `bash scripts/typecheck-changed.sh` = 0 errors
- [ ] `npm run lint` = 0 new warnings
- [ ] Visual verification: forms render, calculations correct, treatment list paginated

### Dependencies
- Session 1 complete

### Reference Pattern
- Form analog: `src/components/cardiology/HeartFailureAssessmentForm.tsx`
- Calculation pattern: cardiology `interpretBNP()` helper (similar shape to `calculateSPKtV()`)

### Estimated Effort
~4 hours

---

## Session 3: Vascular Access Tracking

### Files to Create
| File | Target Lines | Notes |
|------|--------------|-------|
| `src/components/nephrology/VascularAccessForm.tsx` | ~340 | Document access |
| `src/components/nephrology/AccessSurveillanceForm.tsx` | ~220 | Per-treatment surveillance |
| `src/components/nephrology/AccessInfectionForm.tsx` | ~280 | Infection event tracking |
| `src/components/nephrology/__tests__/VascularAccessForm.test.tsx` | ~200 | 12 tests |
| `src/components/nephrology/__tests__/AccessSurveillanceForm.test.tsx` | ~180 | 10 tests |
| `src/components/nephrology/__tests__/AccessInfectionForm.test.tsx` | ~210 | 13 tests |
| `src/services/nephrology/nephrologyService.ts` | +180 lines | Access CRUD + status updates |
| Dashboard | +50 lines | Vascular Access tab |

### VascularAccessForm Field Spec

Type (5 values, with description hover), side (L/R), location (varies by type), creation date, first cannulation date (AVF only), surgeon, status (with auto-progression logic: `maturing` → `active` after first_cannulation_date set), thrill/bruit assessment (radio), infiltration history toggle, recent interventions list.

### AccessInfectionForm Field Spec

Signs checklist (erythema, pain, drainage, fever), blood culture results (organism, sensitivity), antibiotic regimen (multi-select common: vanco, cefepime, gent, etc.), intervention (lock therapy, exchange, removal). On submit: triggers `VASCULAR_ACCESS_INFECTION` critical alert + sets `has_active_infection = true` on access record.

### Acceptance Criteria
- [ ] All three forms render and submit successfully
- [ ] Access status auto-advances `maturing` → `active` when first cannulation date is set
- [ ] Infection form on submit sets `has_active_infection = true` + dispatches critical alert
- [ ] Dashboard Vascular Access tab shows access list with status badges
- [ ] All tests pass; minimum 35 tests added
- [ ] Verification checkpoint clean

### Dependencies
- Session 1 complete

### Reference Pattern
- Form analog: `src/components/cardiology/DeviceMonitoringForm.tsx`

### Estimated Effort
~4 hours

---

## Session 4: Anemia Management + CKD-MBD Forms

### Files to Create
| File | Target Lines | Notes |
|------|--------------|-------|
| `src/components/nephrology/AnemiaManagementForm.tsx` | ~360 | ESA + iron tracking |
| `src/components/nephrology/CKDMBDForm.tsx` | ~400 | Phos binders, vit D, calcimimetics |
| `src/components/nephrology/__tests__/AnemiaManagementForm.test.tsx` | ~220 | 13 tests |
| `src/components/nephrology/__tests__/CKDMBDForm.test.tsx` | ~240 | 14 tests |
| `src/services/nephrology/nephrologyService.ts` | +180 lines | Anemia + MBD CRUD |
| Dashboard | +50 lines | Anemia + MBD tab content |

### AnemiaManagementForm Field Spec

Current Hgb / ferritin / TSAT auto-pulled from latest labs; ESA agent dropdown with dose ranges (e.g., epoetin alfa: 50-300 units/kg/week); auto-suggest dose adjustment per KDIGO trend (Hgb falling > 1 g/dL/month or rising > 1 g/dL/2 weeks → suggest ±25% adjustment). Iron supplementation: agent + dose + frequency. KDIGO target reference (Hgb 10.0-11.5 on ESA, ferritin > 200, TSAT > 20%).

### CKDMBDForm Field Spec

Current Ca / Phos / PTH auto-pulled. Phosphate binders multi-select with dose entry per binder. Vitamin D analog dropdown + dose. Calcimimetic dropdown + dose. Parathyroidectomy history toggle + date. KDIGO target check displayed: Ca/Phos/PTH each get green/yellow/red indicator.

### Acceptance Criteria
- [ ] AnemiaManagementForm: latest labs auto-pulled into form
- [ ] Dose adjustment suggestions reflect KDIGO Hgb trends
- [ ] CKDMBDForm: KDIGO target check displays correct color per analyte
- [ ] All tests pass; minimum 27 tests added
- [ ] Verification checkpoint clean

### Dependencies
- Sessions 1, 2 complete

### Reference Pattern
- Form analog: `src/components/cardiology/HeartFailureAssessmentForm.tsx`

### Estimated Effort
~4 hours

---

## Session 5: PD Treatment + Transplant Workup Forms

### Files to Create
| File | Target Lines | Notes |
|------|--------------|-------|
| `src/components/nephrology/PDTreatmentForm.tsx` | ~360 | PD prescription + complications |
| `src/components/nephrology/TransplantWorkupForm.tsx` | ~420 | Listing + clearance tracker |
| `src/components/nephrology/__tests__/PDTreatmentForm.test.tsx` | ~210 | 13 tests |
| `src/components/nephrology/__tests__/TransplantWorkupForm.test.tsx` | ~240 | 15 tests |
| `src/services/nephrology/nephrologyService.ts` | +180 lines | PD + transplant CRUD |
| Dashboard | +50 lines | Transplant tab content |

### PDTreatmentForm Field Spec

Modality (CAPD/CCPD/APD/NIPD/TPD), exchange volume, exchanges/day, dwell time, dextrose concentration multi-select (1.5%/2.5%/4.25%), icodextrin toggle, daily UF, peritonitis toggle (if true: organism, antibiotic regimen), exit-site infection toggle, catheter dysfunction toggle, PET result, weekly Kt/V. Peritonitis triggers critical alert.

### TransplantWorkupForm Field Spec

Candidacy status workflow (linear progression: not_evaluated → in_workup → eligible → listed → transplanted). Clearance checklist (5 items: cardiac, cancer, infection, dental, psychosocial) — listing requires all 5. Blood type + Rh + PRA. Living donor evaluation tracker. Listed date + UNOS ID. Transplant date + type when status = transplanted.

### Acceptance Criteria
- [ ] PD peritonitis triggers critical alert
- [ ] Transplant form blocks "listed" status until all 5 clearances complete
- [ ] Dashboard Transplant tab shows pipeline (workup → listed → transplanted) with counts
- [ ] All tests pass; minimum 28 tests added
- [ ] Verification checkpoint clean

### Dependencies
- Session 1 complete

### Estimated Effort
~4 hours

---

## Session 6: Nephrology Office Dashboard + Home BP Integration

### Files to Create
| File | Target Lines | Notes |
|------|--------------|-------|
| `src/components/nephrology/NephrologyOfficeDashboard.tsx` | ~480 | Aggregated physician view |
| `src/components/nephrology/HomeVitalsPanel.tsx` | ~280 | BP/weight from check_ins + wearables |
| `src/components/nephrology/IDWGTracker.tsx` | ~180 | Interdialytic weight gain alerts |
| `src/components/nephrology/VolumeStatusEstimator.tsx` | ~220 | Aggregated volume assessment |
| `src/services/nephrology/nephrologyOfficeService.ts` | ~320 | Aggregation logic |
| `src/services/nephrology/__tests__/nephrologyOfficeService.test.ts` | ~200 | 12 tests |
| Component tests | 4 files, ~700 total | 12 tests each |
| `src/App.tsx` | +5 lines | Add `/nephrology-office` route |

### Patient Priority Sort Order

Sorted descending by computed priority score:
1. Active critical alerts (hyperkalemia, AKI, access infection, peritonitis): score +100
2. Missed treatments in last 7 days: score +50 per missed
3. Below adequacy target on most recent measurement: score +30
4. Above-target IDWG (>5%): score +20
5. Below Hgb target: score +10
6. KDIGO red zone (G4-G5 or A3): score +15

### Acceptance Criteria
- [ ] `/nephrology-office` route accessible
- [ ] Patient priority list correctly orders patients by computed score
- [ ] Home BP / weight from `check_ins` displayed alongside in-clinic readings
- [ ] IDWG > 5% triggers visible warning
- [ ] All tests pass; minimum 60 tests added
- [ ] Verification checkpoint clean
- [ ] Visual verification by Maria

### Dependencies
- Sessions 1-5 complete

### Reference Pattern
- Office dashboard analog: `src/components/admin/PhysicianOfficeDashboard.tsx` (if exists) or general physician/nurse office dashboards in admin/

### Estimated Effort
~5 hours (heavier than Phase 1 average — aggregation logic is non-trivial)

---

# Phase 2 — Edge Functions

## Session 7: Core Nephrology Edge Functions

### Files to Create
| Edge Function | Path | Target Lines | Min Tests |
|---------------|------|--------------|-----------|
| Create CKD registry | `supabase/functions/nephrology-create-registry/index.ts` | ~280 | 8 |
| Record renal labs | `supabase/functions/nephrology-record-labs/index.ts` | ~340 | 8 |
| Record dialysis treatment | `supabase/functions/nephrology-record-dialysis/index.ts` | ~320 | 8 |
| Record adequacy | `supabase/functions/nephrology-record-adequacy/index.ts` | ~280 | 8 |

### Mandatory Edge Function Pattern (per `.claude/rules/adversarial-audit-lessons.md` rule 2)

Every function must:
1. Verify Bearer token via `supabase.auth.getUser(token)` — return 401 on missing/invalid
2. Look up caller's profile via `profiles.user_id = user.id` (NOT `id` — see rule 8 of adversarial audit lessons)
3. Check role gating (clinician or admin role) — return 403 if not authorized
4. Validate input via Zod schema
5. Scope all queries to caller's `tenant_id`
6. Generate FHIR Observation/Condition/Procedure as applicable
7. Insert audit log entry (`audit_logs` with `actor_user_id = auth.uid()`)
8. Evaluate alert conditions and dispatch via `nephrology-alert-dispatch` (Session 8)
9. Return `success(record)` or `failure(code, message)`

### Acceptance Criteria
- [ ] All 4 edge functions deployed: `npx supabase functions deploy nephrology-create-registry nephrology-record-labs nephrology-record-dialysis nephrology-record-adequacy`
- [ ] Each function: invoking with no JWT returns 401
- [ ] Each function: invoking as wrong tenant returns 403 / empty result (RLS-enforced)
- [ ] Each function: successful invocation creates DB row + FHIR resource + audit log
- [ ] Each function: insertion of K+ = 6.8 (via labs function) creates `HYPERKALEMIA_CRITICAL` alert record
- [ ] All tests pass; minimum 32 tests added
- [ ] Verification checkpoint clean

### Dependencies
- Phase 1 complete (forms call these functions)

### Reference Pattern
- Edge function analog: `supabase/functions/create-checkin/index.ts` (for tenant-scoped create with audit + alerts)

### Estimated Effort
~5 hours

---

## Session 8: Access + Anemia + MBD + Alert Dispatch

### Files to Create
| Edge Function | Path | Target Lines | Min Tests |
|---------------|------|--------------|-----------|
| Record vascular access | `supabase/functions/nephrology-record-access/index.ts` | ~280 | 8 |
| Record anemia | `supabase/functions/nephrology-record-anemia/index.ts` | ~280 | 8 |
| Record CKD-MBD | `supabase/functions/nephrology-record-mbd/index.ts` | ~280 | 8 |
| Alert dispatcher | `supabase/functions/nephrology-alert-dispatch/index.ts` | ~420 | 12 |

### Alert Dispatcher Spec

Receives event (record type + record id + tenant_id), evaluates against the 10 alert types, creates `security_alerts` or domain-specific alert rows, sends notifications via existing notification stack (`send-sms`, `send-email`, `send-push-notification` for critical/high), respects `communication_silence_window`. Idempotent (don't double-fire on retry).

### Acceptance Criteria
- [ ] All 4 functions deployed
- [ ] Alert dispatcher correctly evaluates all 10 alert types
- [ ] Critical alerts trigger SMS + email + push to designated care team
- [ ] Idempotency: dispatching the same alert twice creates only one notification
- [ ] All tests pass; minimum 36 tests added
- [ ] Verification checkpoint clean

### Dependencies
- Session 7 complete

### Estimated Effort
~5 hours

---

# Phase 3 — AI Services

## Session 9: AI CKD Progression Predictor + AKI Risk Analyzer

### Files to Create
| Edge Function | Path | Target Lines | Min Tests |
|---------------|------|--------------|-----------|
| CKD progression predictor | `supabase/functions/ai-ckd-progression-predictor/index.ts` | ~360 | 10 |
| AKI risk analyzer | `supabase/functions/ai-aki-risk-analyzer/index.ts` | ~340 | 10 |

### `ai_skills` Table Entries (registered via migration)

```sql
INSERT INTO ai_skills (skill_key, skill_number, description, patient_description, model, is_active, ...) VALUES
('ckd_progression_predictor', <next>, 'Predicts eGFR decline trajectory from longitudinal labs',
 'Estimates how your kidney function may change over time so your doctor can plan ahead',
 'claude-sonnet-4-5-20250929', true, ...),
('aki_risk_analyzer', <next>, 'Pre-procedural AKI risk from baseline + exposures',
 'Checks your risk of kidney injury before procedures so your team can take precautions',
 'claude-sonnet-4-5-20250929', true, ...);
```

### Structured Output Schemas (required per Rule #16)

CKD progression predictor returns:
```json
{
  "predicted_egfr_6mo": 32.5,
  "predicted_egfr_12mo": 28.0,
  "predicted_egfr_24mo": 22.1,
  "time_to_dialysis_estimate_months": 18,
  "trajectory": "rapid_decline | stable | slow_decline",
  "confidence": "low | moderate | high",
  "key_drivers": ["uncontrolled_dm", "high_uacr", "rising_creatinine"],
  "kdigo_risk_category": "low | moderate | high | very_high",
  "reasoning_summary": "..."
}
```

### Acceptance Criteria
- [ ] Both functions deployed
- [ ] `ai_skills` rows present and active
- [ ] Structured output schema enforced (no free-text parsing)
- [ ] Cost tracking logs to `claude_usage_logs`
- [ ] All tests pass; minimum 20 tests added
- [ ] Verification checkpoint clean

### Dependencies
- Phase 2 complete (data flows so AI has input)

### Reference Pattern
- AI service analog: `supabase/functions/ai-readmission-predictor/index.ts`

### Estimated Effort
~4 hours

---

## Session 10: AI Adequacy Advisor + ESA Optimizer + Patient Summary

### Files to Create
| Edge Function | Path | Target Lines | Min Tests |
|---------------|------|--------------|-----------|
| Dialysis adequacy advisor | `supabase/functions/ai-dialysis-adequacy-advisor/index.ts` | ~340 | 10 |
| ESA dosing optimizer | `supabase/functions/ai-esa-dosing-optimizer/index.ts` | ~360 | 10 |
| Nephrology patient summary | `supabase/functions/ai-nephrology-patient-summary/index.ts` | ~320 | 10 |

### Acceptance Criteria
- [ ] All 3 deployed and registered in `ai_skills`
- [ ] Each returns structured JSON matching its schema
- [ ] Each logs cost to `claude_usage_logs`
- [ ] All tests pass; minimum 30 tests added
- [ ] Verification checkpoint clean

### Dependencies
- Sessions 7-9 complete

### Estimated Effort
~4 hours

---

# Phase 4 — Acumen Epic Connect Integration + Advanced

## Session 11: Acumen Bi-directional FHIR Sync — PILOT GO-LIVE GATE

### Files to Create / Modify
| File | Action | Target Lines |
|------|--------|--------------|
| `src/services/fhir/nephrology/AcumenSyncAdapter.ts` | CREATE | ~480 |
| `src/services/fhir/nephrology/AcumenFlowsheetParser.ts` | CREATE | ~360 |
| `src/services/fhirSyncIntegration.ts` | MODIFY | +120 lines |
| `supabase/functions/nephrology-acumen-bulk-import/index.ts` | CREATE | ~420 |
| `supabase/functions/nephrology-acumen-incremental-sync/index.ts` | CREATE | ~360 |
| `supabase/functions/nephrology-acumen-writeback-soap/index.ts` | CREATE | ~340 |
| `supabase/migrations/<TS>_acumen_tenant_config.sql` | CREATE | ~80 |

### Configuration Steps (operational, not code)

1. Add tenant entry to `fhir_connections` with Acumen Epic OAuth endpoints
2. Provision OAuth client credentials (system + user scope) in Supabase secrets
3. Configure `EpicFHIRAdapter` for the tenant
4. Set bulk export schedule (initial backfill + nightly incremental)
5. Configure DocumentReference write-back permissions per Acumen tenant grant

### Acceptance Criteria
- [ ] Initial bulk export from Acumen sandbox completes — Patient, Condition, MedicationRequest, AllergyIntolerance, Observation resources land in `fhir_*` tables
- [ ] `ehr_patient_mappings` populated with Acumen MRN ↔ Atlus patient_id
- [ ] Compass Riley reasoning pipeline reads grounding context from imported FHIR data (verify in `compass-riley/reasoningPipeline.ts` debug output)
- [ ] DocumentReference write-back: a Compass Riley SOAP note appears in Acumen tenant under physician's authorship
- [ ] Reasoning audit attached to DocumentReference as a Provenance resource
- [ ] Dialysis flowsheet Observations parsed correctly into `neph_dialysis_treatments`
- [ ] All tests pass; minimum 40 tests added
- [ ] Verification checkpoint clean
- [ ] **End-to-end smoke test:** physician records visit on a real or test patient → Compass Riley produces SOAP → SOAP appears in Acumen
- [ ] Maria + Akima sign off

### Dependencies
- BAA executed
- Fresenius FHIR client provisioned
- OAuth credentials in hand
- Phase 1-2 complete (data targets exist)

### Reference Pattern
- Adapter pattern: `src/adapters/implementations/EpicFHIRAdapter.ts`
- Sync pattern: `src/services/fhirSyncIntegration.ts`
- Bulk export: `src/services/fhirBulkExportService.ts`

### Estimated Effort
~8 hours engineering + external waiting time. **Do not start until external gates clear.**

---

## Session 12: KDIGO Guidelines + Dialysis Flowsheet Parser + Nephrology Consult Prompts

### Files to Create / Modify
| File | Action | Target Lines |
|------|--------|--------------|
| `supabase/functions/_shared/guidelineReferenceEngine.ts` | MODIFY | +400 lines (add KDIGO content) |
| `supabase/functions/_shared/clinicalGroundingRules.ts` | MODIFY | +200 lines (renal-specific rules) |
| `supabase/functions/_shared/consultationPromptGenerators.ts` | MODIFY | +180 lines (nephrology consult templates) |
| `src/services/drugInteractionService.ts` | MODIFY | +250 lines (renal dosing rules) |
| `src/services/fhir/nephrology/AcumenFlowsheetParser.ts` | EXTEND | +200 lines (more flowsheet types) |
| `src/services/_renalDosing/renalDoseAdjustments.ts` | CREATE | ~480 lines |
| `src/services/_renalDosing/__tests__/renalDoseAdjustments.test.ts` | CREATE | ~280 lines |

### KDIGO Guidelines to Encode

| Guideline | Reference Year | Key Recommendations |
|-----------|---------------|--------------------|
| CKD evaluation & management | 2024 | eGFR + UACR risk stratification, BP targets, RAAS blockade |
| Acute kidney injury | 2012 (under revision) | Staging, prevention, treatment |
| BP in CKD | 2021 | Target SBP < 120 if tolerated; ACEi/ARB for proteinuric CKD |
| Anemia in CKD | 2012 | Hgb target 10.0-11.5 on ESA; iron sufficiency |
| CKD-MBD | 2017 update | Phos < 5.5 dialysis; PTH 2-9x ULN dialysis |
| Diabetes in CKD | 2022 | SGLT2i preferred for DKD; finerenone for residual albuminuria |
| Lipid management in CKD | 2013 | Statin for adults ≥ 50 with CKD G3-G5 not on dialysis |
| Glomerular diseases | 2021 | Disease-specific recommendations |
| Hep C in CKD | 2022 | DAA selection by eGFR |
| Live kidney donor evaluation | 2017 | Eligibility framework |

### Renal Dose Adjustment Rules

Encode adjustments for: NSAIDs (avoid), gadolinium-based contrast (avoid eGFR < 30), iodinated contrast (caution + hydration), metformin (hold eGFR < 30), ACEi/ARB (titrate), DOACs (apixaban/dabigatran/rivaroxaban dose by CrCl), antibiotics (vancomycin, aminoglycosides, beta-lactams), antifungals, opioids (avoid morphine, codeine; favor fentanyl, methadone).

### Acceptance Criteria
- [ ] `guidelineReferenceEngine` returns KDIGO content when patient context indicates CKD/AKI/dialysis
- [ ] Compass Riley scribing a nephrology visit surfaces relevant KDIGO recommendations during reasoning
- [ ] `drugInteractionService.checkRenalDosing(med, eGFR)` returns adjustment recommendations
- [ ] Acumen flowsheet parser handles dialysis-specific Observation profiles
- [ ] Nephrology consult prompts generate transplant referral / pre-op clearance / urgent HD initiation SBAR templates
- [ ] All tests pass; minimum 35 tests added
- [ ] Verification checkpoint clean

### Dependencies
- Session 11 complete (data flowing)

### Estimated Effort
~6 hours

---

## Session 13: ESRD Billing + Patient Education + Transplant Workflow

### Files to Create / Modify
| File | Action | Target Lines |
|------|--------|--------------|
| `src/services/billing/esrdBillingService.ts` | CREATE | ~440 |
| `src/services/billing/__tests__/esrdBillingService.test.ts` | CREATE | ~280 |
| `src/components/nephrology/MCPVisitTracker.tsx` | CREATE | ~280 (Monthly Capitation Payment) |
| `src/components/nephrology/PatientEducationLibrary.tsx` | CREATE | ~360 |
| `src/components/nephrology/TransplantPipeline.tsx` | CREATE | ~340 |
| `supabase/migrations/<TS>_esrd_billing_codes.sql` | CREATE | ~100 |

### CPT Codes to Encode (`esrdBillingService.ts`)

```typescript
export const ESRD_CPT_CODES = {
  // Hemodialysis (per treatment)
  HD_INITIATION: '90935',        // 1 evaluation
  HD_REPEAT_EVALUATIONS: '90937', // > 1 evaluation
  HD_RELATED_SERVICES: '90999',   // Unlisted dialysis procedure
  // Peritoneal dialysis
  PD_RELATED: '90945',
  PD_REPEAT_EVAL: '90947',
  // Monthly Capitation (MCP) - billed monthly
  MCP_AGE_LT_2: '90951',  // 4+ MD visits/month
  MCP_AGE_2_11: '90954',
  MCP_AGE_12_19: '90957',
  MCP_AGE_GE_20: '90960', // 4+ visits/mo
  MCP_AGE_GE_20_2_3: '90961', // 2-3 visits/mo
  MCP_AGE_GE_20_1: '90962',   // 1 visit/mo
  MCP_HOME_DIALYSIS: '90965',
  // Self-care training
  HD_TRAINING: '90989',
  PD_TRAINING: '90993',
  // Vascular access
  AVF_CREATION: '36821',
  AVG_CREATION: '36825',
  CATHETER_PLACEMENT: '36556',
};
```

### Acceptance Criteria
- [ ] MCP visit tracker correctly counts MD visits per patient per month and selects appropriate MCP code
- [ ] Billing service auto-suggests CPT codes per recorded treatment
- [ ] Patient education library has at least 8 multilingual modules (English + Spanish at minimum)
- [ ] Transplant pipeline visualization shows workup → listed → transplanted with clearance progress
- [ ] All tests pass; minimum 30 tests added
- [ ] Verification checkpoint clean

### Dependencies
- Phases 1-2 complete

### Estimated Effort
~5 hours

---

# Overall Summary

| Phase | Sessions | Status | What It Delivers |
|-------|----------|--------|------------------|
| Foundation + Phase 1: Data Entry | 1-6 | MISSING | DB, types, service, FHIR, dashboard, all clinical forms, office dashboard |
| Phase 2: Edge Functions | 7-8 | MISSING | API layer + alert dispatch |
| Phase 3: AI Services | 9-10 | MISSING | CKD/AKI predictors, adequacy advisor, ESA optimizer, patient summary |
| Phase 4: Acumen + Advanced | 11-13 | MISSING | Acumen sync (pilot go-live), KDIGO content, ESRD billing |

**MVP for pilot demo (Phases 1-2 + Session 11):** 9 sessions
**Full Production (all phases):** 13 sessions

---

# Build Priority

| Priority | Session | What | Why First |
|----------|---------|------|-----------|
| P1 | Session 1 | Foundation + CKD Registry + Renal Labs | Greenfield foundation; nothing else can build without it |
| P2 | Session 2 | HD Treatment + Adequacy | Most patients are dialysis-dependent; safety-critical |
| P3 | Session 3 | Vascular Access | Access infection is #1 dialysis hospitalization driver |
| P4 | Session 4 | Anemia + CKD-MBD | Long-term complication management; revenue (ESAs, binders) |
| P5 | Session 5 | PD + Transplant Workup | Underserved patients; transplant is the goal |
| P6 | Session 6 | Office Dashboard + Home BP | Aggregated physician view + RPM integration |
| P7 | Session 7 | Core edge functions | API layer for forms |
| P8 | Session 8 | Alert dispatch + remaining edge functions | Complete edge function coverage |
| **P9** | **Session 11** | **Acumen FHIR Sync (Pilot Activation)** | **Pilot go-live gate — start IF external gates have cleared** |
| P10 | Session 9 | AI CKD/AKI predictors | Decision support layer |
| P11 | Session 10 | AI adequacy/ESA/summary | Workflow optimization |
| P12 | Session 12 | KDIGO content + flowsheet parser + renal dosing | Compass Riley nephrology depth |
| P13 | Session 13 | ESRD billing + transplant + education | Revenue + patient engagement |

> Session 11 is sequenced ahead of AI Phase 3 because pilot go-live gates the demo. If Fresenius FHIR provisioning is still pending when Phase 2 finishes, fall through to Phase 3 (AI services) and return to Session 11 when external gates clear.

---

# Open Questions for the Clinic Stakeholder Conversation

1. Who at the clinic owns this internally? Confirm both administrative and clinical sponsorship.
2. Does the clinic have a non-prod Acumen environment for sandbox testing?
3. What FHIR resources matter most to ground Compass Riley on — meds, dialysis flowsheets, last 90 days of labs?
4. Will Fresenius/Acumen permit DocumentReference write-back under the clinic's tenant?
5. Patient panel size — how many active patients? (Drives initial backfill scope.)
6. Pilot scope — full clinic or a single nephrologist's panel first?

---

# Session Completion Log

> Each session, append:
> - Date completed
> - Commit hash
> - Verification counts: `typecheck X / lint Y / tests Z`
> - Any deviations from spec (with reason)
> - Maria + Akima sign-off date

| Session | Status | Date | Commit | Counts | Notes |
|---------|--------|------|--------|--------|-------|
| 1 | PENDING | — | — | — | — |
| 2 | PENDING | — | — | — | — |
| 3 | PENDING | — | — | — | — |
| 4 | PENDING | — | — | — | — |
| 5 | PENDING | — | — | — | — |
| 6 | PENDING | — | — | — | — |
| 7 | PENDING | — | — | — | — |
| 8 | PENDING | — | — | — | — |
| 9 | PENDING | — | — | — | — |
| 10 | PENDING | — | — | — | — |
| 11 | PENDING | — | — | — | — |
| 12 | PENDING | — | — | — | — |
| 13 | PENDING | — | — | — | — |
