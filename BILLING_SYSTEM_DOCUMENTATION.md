# WellFit Community - Comprehensive Billing & Claims Processing System Documentation

## Executive Summary

WellFit Community implements a sophisticated, production-grade billing and claims processing system with 3,259 lines of TypeScript service code, integrated SDOH (Social Determinants of Health) assessment, automated CCM (Chronic Care Management) billing, and intelligent decision tree logic for claim validation and code generation.

---

## 1. BILLING WORKFLOW: FROM ENCOUNTER TO CLAIM SUBMISSION

### 1.1 End-to-End Process Flow

```
ENCOUNTER CREATED
    ↓
RETRIEVE ENCOUNTER DATA (procedures, diagnoses, patient, provider)
    ↓
VALIDATE INPUT & PREREQUISITES
    ↓
LOAD SCRIBE SESSION DATA (if available from AI assistant)
    ↓
DECISION TREE ANALYSIS (eligibility → service classification → CPT lookup → E/M level → modifiers → fee lookup)
    ↓
AI CODING SUGGESTIONS (SDOH-enhanced if enabled)
    ↓
SDOH ASSESSMENT (complexity scoring, Z-codes, CCM eligibility)
    ↓
RECONCILE CODING SOURCES (prioritize: decision tree > AI > SDOH)
    ↓
VALIDATE BILLING COMPLIANCE (medical necessity checks, SDOH documentation)
    ↓
CREATE CLAIM RECORD
    ↓
CREATE CLAIM LINES (procedure codes with modifiers, charge amounts, diagnosis pointers)
    ↓
GENERATE X12 EDI (837P format)
    ↓
SUBMIT TO CLEARINGHOUSE (optional auto-submit)
    ↓
TRACK CLAIM STATUS (generated → submitted → accepted → paid)
```

### 1.2 Key Service: UnifiedBillingService

**File**: `/src/services/unifiedBillingService.ts` (841 lines)

**Entry Point**: `processBillingWorkflow(input: BillingWorkflowInput)`

**Workflow Steps**:
1. **Validate Input** - Verify all required fields and entities exist
2. **Retrieve Scribe Data** - Load AI-generated codes from scribe sessions if available
3. **Decision Tree Analysis** - Process encounter through 6-node decision tree
4. **AI Coding Suggestions** - Get SDOH-enhanced suggestions from Claude
5. **SDOH Assessment** - Calculate complexity score and CCM eligibility
6. **Finalize Coding** - Reconcile and merge all coding sources
7. **Validate Compliance** - Check medical necessity and billing rules
8. **Create Claim** - Insert claim record in database
9. **Create Claim Lines** - Generate line items with CPT/HCPCS codes
10. **Generate X12** - Build EDI 837P format (optional auto-submit)

**Financial Tracking**:
- Calculates total charges from all procedure codes
- Estimates reimbursement (80% default rate)
- Flags claims requiring manual review
- Provides audit readiness scoring

**HIPAA Compliance**:
- Logs PHI access for each workflow (§164.312(b))
- Records workflow start, completion, and failures in audit log
- Attributes all actions to calling user ID
- Captures IP address and user agent for security

---

## 2. CPT AND ICD-10 CODE GENERATION

### 2.1 Code Tables (Database Schema)

**CPT Codes** (`code_cpt` table):
- 5-digit codes (e.g., "99213" for office visit)
- Short and long descriptions
- Status tracking (active/inactive)
- Effective date ranges
- Indexed by status for query performance

**ICD-10 Codes** (`code_icd10` table):
- Format: Letter + 2 digits + optional dot + up to 4 characters
- Examples: "Z59.0" (homelessness), "I10" (hypertension)
- Billable flag (prevents use of parent codes)
- Chapter classification (e.g., "Mental disorders")
- Status and effective dates

**HCPCS Codes** (`code_hcpcs` table):
- Format: Letter + 4 digits (e.g., "J1100" for injection codes)
- Descriptions and status

**Modifiers** (`code_modifiers` table):
- 2-character alphanumeric codes
- Examples: "25" (distinct procedure), "59" (distinct procedural service)
- Reimbursement impact tracking

### 2.2 Code Generation Flow

#### Option A: Decision Tree-Based (BillingDecisionTreeService)

**NODE C: Procedure CPT Lookup**
```typescript
static async lookupProcedureCPT(
  description: string,
  providedCode?: string
): Promise<ProcedureLookupResult>
```

Logic:
1. If provider supplied CPT code → validate against `code_cpt` table
2. Else → search `code_cpt` table using full-text search on long_desc
3. Match procedure description to billable CPT code
4. Detect unlisted procedures (99XXX codes) → flag for manual review

**Example**: "Physical therapy evaluation" → CPT "97161" (PT evaluation, low complexity)

**NODE D: E/M Level Determination**
```typescript
static async evaluateEMLevel(
  input: DecisionTreeInput,
  documentation: EMDocumentationElements
): Promise<EMEvaluationResult>
```

**E/M Code Selection Algorithm**:
1. **Time-based coding** (if >50% time on counseling/coordination):
   - <20 min → Level 1 (99201/99211)
   - 20-30 min → Level 2 (99202/99212)
   - 30-40 min → Level 3 (99203/99213)
   - 40-60 min → Level 4 (99204/99214)
   - >60 min → Level 5 (99205/99215)

2. **MDM-based coding** (default method):
   - Evaluates: number of diagnoses, data review, risk assessment
   - MDM Score: 40-100
   - New vs established patient (99201-5 vs 99211-5)

3. **Documentation scoring**:
   - Checks for HPI, ROS, PFSH, exam detail, MDM completeness
   - Scores 0-100%
   - Flags missing elements requiring completion

**Example**: 
- 35-minute office visit
- 3 diagnoses (diabetes, hypertension, back pain)
- Moderate data review
- → E/M Level 3 (99213/99203)

#### Option B: AI Coding Suggestions (SDOHBillingService)

Claude-powered analysis via `analyzeEncounter()`:
1. Retrieve encounter with related clinical data
2. Get SDOH assessment for patient
3. Query Claude with encounter context
4. Returns structured suggestions with confidence scores
5. Enhanced with SDOH codes and CCM recommendations

**Output Format**:
```typescript
EnhancedCodingSuggestion {
  medicalCodes: {
    icd10: [{ code, rationale, principal, category }]
  },
  procedureCodes: {
    cpt: [{ code, modifiers, rationale, timeRequired }],
    hcpcs: [{ code, modifiers, rationale }]
  },
  confidence: 85
}
```

### 2.3 Code Reconciliation Logic

**Priority Order** (when multiple sources suggest codes):
1. **Decision Tree Result** (highest priority - validated through 6-node logic)
2. **AI Suggestions** (SDOH-enhanced, high confidence)
3. **SDOH Codes** (Z-codes for social determinants)
4. **Default Fallback** (conservative, commonly billable codes)

---

## 3. 837P CLAIM FILE GENERATION

### 3.1 Supabase Edge Function: generate-837p

**File**: `/supabase/functions/generate-837p/index.ts` (497 lines)

**Deno Runtime**: Uses Deno HTTP server with Supabase JS client

**Access Control**:
- JWT authentication required (Bearer token)
- CORS whitelist via `ALLOWED_ORIGINS` environment variable
- Admin client (service role) for data access, user client for attribution

### 3.2 X12 837P Structure

**ISA (Interchange Control Header)**
```
ISA*00*          *00*          *ZZ*SUBMITTERID    *ZZ*RECEIVERID     *YYMMDD*HHMM*^*00501*000000001*0*P*:~
```
Components:
- Sender: Provider submitter ID or "WELLFIT"
- Receiver: Payer receiver ID or clearinghouse ID
- Timestamp: Current date/time in YYMMDD/HHMM format
- Control numbers: ISA sequence (auto-incremented)
- Interchange version: 005010 (current standard)

**GS (Functional Group Header)**
```
GS*HC*APPID*RECEIVER*YYMMDD*HHMM*GSCONTROL*X*005010X222A1~
```
- HC = Healthcare claim
- Version: 005010X222A1 (837P for professional claims)

**ST (Transaction Set Header)**
```
ST*837*STCONTROL*005010X222A1~
```
- Transaction type: 837 (professional claim)
- Control number: 4-digit sequence

**Key Segments**:

| Segment | Purpose | Example |
|---------|---------|---------|
| BHT | Beginning of Hierarchical Claim | BHT*0019*00*REF123*YYMMDD*HHMM*TH |
| NM1 (41) | Submitter (provider) | NM1*41*2*ORGANIZATION NAME*...*46*SUBMITTERID |
| NM1 (40) | Receiver (payer) | NM1*40*2*PAYER NAME*...*46*RECEIVERID |
| HL (1) | Billing Provider Level | HL*1**20*1 |
| PRV | Provider Specialty | PRV*BI*PXC*TAXONOMYCODE |
| NM1 (85) | Billing Provider Details | NM1*85*2*ORG NAME*...*XX*NPI |
| HL (2) | Patient/Subscriber Level | HL*2*1*22*0 |
| SBR | Subscriber | SBR*P*...*RELATIONSHIP |
| NM1 (IL) | Insurance Level (patient) | NM1*IL*1*LASTNAME*FIRSTNAME*...*MI*MEMBERID |
| CLM | Claim | CLM*CLAIMID*TOTALCHARGE*...*FREQUENCYCODE |
| DTP | Date - Service Period | DTP*434*D8*YYMMDD |
| HI | Health Insurance | HI*BK:ICDCODE*BF:ICDCODE2 |
| LX | Service Line Number | LX*1 |
| SV1 | Service Line Detail | SV1*HC:CPTCODE:MOD1:MOD2*CHARGE*UN*UNITS |

**Diagnosis Ordering**:
- BK = Primary diagnosis (sequence 1)
- BF = Secondary diagnoses (sequence 2+)
- ICD-10 codes stored without dots (e.g., "Z590" not "Z59.0")

**Service Lines (SV1)**:
```
SV1*HC:99213*150.00*UN*1~
```
- HC: Healthcare code qualifier
- CPT Code: 99213
- Modifiers: Optional `:MOD1:MOD2:MOD3:MOD4`
- Charge amount: Decimal format
- Unit: UN (units)
- Quantity: Default 1

### 3.3 Control Number Management

**Three-tier control number system** (for compliance):

1. **ISA Control Number** (9 digits):
   - Incremented via `x12_isa_seq` sequence
   - Unique per interchange
   - Reset monthly/yearly per payer requirements

2. **GS Control Number** (9 digits):
   - Incremented via `x12_gs_seq` sequence
   - Unique per functional group

3. **ST Control Number** (4 digits):
   - Incremented via `x12_st_seq` sequence
   - Unique per transaction

**RPC Function**:
```sql
CREATE FUNCTION next_seq(seq text) RETURNS bigint
```
Safely increments PostgreSQL sequence, returns unique values for concurrent calls.

### 3.4 Data Validation & Sanitization

**Field Sanitization**:
```typescript
function safeText(s?: string | null) {
  return (s ?? "").replace(/[~*\^\|\\]/g, "").trim();
}
```
Removes X12 separator characters that would corrupt the file.

**Safe Defaults**:
- Missing organization → "WELLFIT COMMUNITY"
- Missing NPI → "0000000000" (invalid, requires manual correction)
- Missing DOB → "19800101"
- Missing address → Empty fields (optional in 837P)

### 3.5 X12 Output & Claim Storage

**X12 Format**:
- Segments separated by `~`
- Fields separated by `*`
- Final segment: `~` terminator
- Plain text UTF-8 encoding

**Claim Record Storage**:
```sql
INSERT INTO claims (encounter_id, x12_content, claim_type, status, control_number, segment_count, created_by, created_at)
VALUES (enc.id, x12_text, '837P', 'generated', stCtrl, segCount, currentUser.id, now())
```

**Audit Logging**:
- Success: `CLAIMS_GENERATION_SUCCESS` event
- Failure: `CLAIMS_GENERATION_FAILED` event
- Metadata: encounter ID, provider ID, payer ID, control number, segment count, procedure count, diagnosis count, processing time

---

## 4. CCM (CHRONIC CARE MANAGEMENT) BILLING AUTOMATION

### 4.1 CCM Billing Codes & Requirements

**Standard CCM** (Medicare 2024 rates):

| Code | Description | Time Required | Base Reimbursement |
|------|-------------|----------------|-------------------|
| 99490 | First 20 minutes | 20 min | $64.72 |
| 99491 | Each additional 20 minutes | 20 min | $58.34 |

**Complex CCM** (for SDOH complexity):

| Code | Description | Time Required | Base Reimbursement | SDOH Required |
|------|-------------|----------------|-------------------|---------------|
| 99487 | First 60 minutes | 60 min | $145.60 | Yes |
| 99489 | Each additional 30 minutes | 30 min | $69.72 | No |

**Eligibility Requirements**:
1. Patient consent for CCM services
2. Comprehensive care plan established
3. Patient access to care team 24/7
4. Electronic health record system in use
5. For 99487/99489: Multiple chronic conditions + SDOH factors

### 4.2 Time Tracking & Billing Logic

**CCMAutopilotService**: `/src/services/ccmAutopilotService.ts` (209 lines)

**Activity Sources**:
1. **Check-ins**: Each check-in = 5 minutes (assumed)
2. **Scribe sessions**: Duration extracted from `recording_duration_seconds`
3. **Portal messages**: Billable communication logged

**Monthly Aggregation**:
```typescript
getEligiblePatients(month?: Date): Promise<CCMEligiblePatient[]>
```

1. Query all check-ins for the month
2. Query all scribe sessions for the month
3. Aggregate by patient
4. Calculate total billable minutes
5. Determine applicable code:
   - 20-39 minutes → 99490 (first 20 min)
   - 40+ minutes → 99491 (each additional 20 min)
   - 60+ minutes → 99487 (complex CCM first 60 min)
   - 90+ minutes → 99489 (each additional 30 min)

**Example Calculation**:
```
Patient: John Smith
Month: November 2024

Activity Log:
- Nov 5: Check-in (5 min)
- Nov 8: Scribe session (25 min)
- Nov 15: Check-in (5 min)
- Nov 20: Portal message (5 min)
- Nov 27: Scribe session (15 min)

Total: 55 minutes

Billable Codes:
- 99490: 1 × $64.72 = $64.72 (first 20 min)
- 99491: 1 × $58.34 = $58.34 (next 20 min)
- Remaining 15 min: Insufficient for second 99491

Total CCM Revenue: $123.06
```

### 4.3 Auto-Loading from Scribe Sessions

When scribe session data is available, UnifiedBillingService auto-populates:

1. **CPT Codes** from `scribe_session.suggested_cpt_codes`
2. **ICD-10 Codes** from `scribe_session.suggested_icd10_codes`
3. **Auto-add 99490** if `is_ccm_eligible=true` AND `clinical_time_minutes >= 20`
4. **Auto-add 99491/99439** if `clinical_time_minutes >= 40`

**Audit Trail**:
```
BILLING_SCRIBE_CODES_LOADED: 3 CPT codes
BILLING_SCRIBE_DIAGNOSES_LOADED: 5 ICD-10 codes
CCM_CODE_AUTO_ADDED: 99490 (40 minutes)
```

### 4.4 CCM Billing Compliance Checks

**SDOHBillingService.checkCCMCompliance()**:

| Check | Requirement | Failure Action |
|-------|-------------|----------------|
| Minimum time | ≥ 20 billable minutes | Flag for manual review |
| Activity types | Must have assessment + care_coordination | Flag missing types |
| Documentation | Each activity has description ≥ 10 chars | Warning if poor docs |
| CCM code conflicts | Cannot bill both 99490 and 99487 same month | Error - fix coding |

---

## 5. FEE SCHEDULES AND PAYMENT TRACKING

### 5.1 Fee Schedule Database Structure

**Table: `fee_schedules`**
```sql
id (UUID primary key)
name (text) - e.g., "Medicare 2024", "Aetna Commercial 2024"
payer_id (FK to billing_payers)
provider_id (FK to billing_providers)
effective_from (date)
effective_to (date, nullable for open-ended)
notes (text)
created_by (UUID) - attribution
created_at, updated_at (audit)
```

**Table: `fee_schedule_items` (10,000+ rows typical)**
```sql
id (UUID primary key)
fee_schedule_id (FK)
code_system (CPT | HCPCS)
code (text) - e.g., "99213"
modifier1-4 (text, nullable) - for code-specific variants
price (numeric 12,2) - e.g., 125.50
unit (text) - UN (units) default
created_at, updated_at

UNIQUE (fee_schedule_id, code_system, code, modifier1-4)
```

**Index Strategy**:
- `idx_fsi_fee_schedule` - bulk lookup by schedule
- `idx_fsi_code` - CPT code search

### 5.2 Fee Lookup & Application

**BillingService.lookupFee()**:
```typescript
static async lookupFee(
  scheduleId: string,
  codeSystem: 'CPT' | 'HCPCS',
  code: string,
  modifiers?: string[]
): Promise<number | null>
```

**Lookup Logic**:
1. Query `fee_schedule_items` for exact match:
   - Schedule ID
   - Code system (CPT/HCPCS)
   - Code (exact match, e.g., "99213")
   - Modifiers (if provided, match all 4 modifier fields)
2. Return price if found
3. Return `null` if not found (requires chargemaster fallback)

**Modifier Handling**:
- Up to 4 modifiers per code
- Modifiers must match exactly (including null values)
- Example: CPT 99213 with modifier 25 (distinct procedure) = different price than without modifier

**Example**:
```
Schedule: Medicare 2024
CPT Code: 99213
Modifiers: None
Price: $123.45 ✓

CPT Code: 99213
Modifiers: 25 (distinct procedure)
Price: $154.32 ✓ (higher due to additional work)
```

### 5.3 Payment Tracking

**Claims Workflow Status**:
```
generated → submitted → accepted → rejected (with denial reason)
                            ↓
                        rejected → appeal → resubmitted
                            ↓
                          paid
```

**Table: `claim_status_history`**
```sql
id (UUID primary key)
claim_id (FK)
from_status (text, nullable)
to_status (text)
note (text) - reason for status change
payload (JSONB) - additional data (denial code, appeal info, etc.)
created_by (UUID)
created_at
```

**Financial Tracking**:
```typescript
{
  claim: {
    total_charge: 125.50,      // Billed amount
    expected_reimbursement: 100.40,  // Based on fee schedule
    actual_payment: null        // Updated when paid
  },
  status_history: [
    { to_status: "generated", note: "Claim created" },
    { to_status: "submitted", note: "Sent to clearinghouse" },
    { to_status: "accepted", note: "Payer accepted" },
    { to_status: "paid", payload: { amount: 100.40, date: "2024-11-15" }}
  ]
}
```

### 5.4 Clearinghouse Integration

**Table: `clearinghouse_batches`**
```sql
id (UUID primary key)
batch_ref (text) - reference number
status (created | submitted | acknowledged | rejected | completed)
file_content (text) - full X12 file
response_payload (JSONB) - clearinghouse response
submitted_at (timestamptz)
created_by, created_at, updated_at
```

**Table: `clearinghouse_batch_items`**
```sql
id (UUID primary key)
batch_id (FK)
claim_id (FK)
st_control_number (text) - ST02 segment value
status (queued | sent | ack | err)
note (text) - error message if applicable
created_at, updated_at
```

**Batch Workflow**:
1. `createBatch()` - Create batch record
2. `addClaimToBatch()` - Add claims to batch (status: queued)
3. `generateX12Claim()` - Generate 837P for each claim
4. Concatenate all 837P transactions into single file
5. Submit to clearinghouse via SFTP/API
6. `updateBatchStatus(submitted)` - Mark submitted
7. Monitor for ACK response
8. Update individual claim statuses based on clearinghouse response

---

## 6. INTEGRATION WITH CLEARINGHOUSES

### 6.1 Clearinghouse Protocol

**Supported Methods**:
- SFTP upload (primary)
- API submission (via clearinghouse partner)
- Email delivery (fallback)

**X12 837P File Format**:
- Single file per batch
- Multiple claims in one file (multiple ST-SE segments)
- UTF-8 encoding
- CRLF or LF line endings (clearinghouse-specific)

**Payer Configuration**:
```typescript
BillingPayer {
  name: "Aetna Insurance",
  receiver_id: "AETNAID123",      // For direct payer submission
  clearinghouse_id: "CLEARID456", // For clearinghouse routing
  payer_id: "AETNA001"            // Internal payer code
}
```

### 6.2 Response Processing

**Clearinghouse Response Types**:

1. **997 Functional Acknowledgment**:
   - Confirms receipt of X12 file
   - Reports parsing errors
   - Updates `clearinghouse_batches.status = acknowledged`

2. **835 Remittance Advice**:
   - Payment notification
   - Lists accepted/denied claims
   - Payment date and amount
   - Stores in separate `remittances` table

3. **999 Implementation Acknowledgment**:
   - Detailed syntax errors
   - Segment/field validation errors

### 6.3 Batch Submission Example

```typescript
// Step 1: Create batch
const batch = await BillingService.createBatch("BATCH_NOV_2024");

// Step 2: Add claims to batch
await BillingService.addClaimToBatch(batch.id, claim1.id, "ST01");
await BillingService.addClaimToBatch(batch.id, claim2.id, "ST02");

// Step 3: Generate X12 for each claim
const x12Claim1 = await BillingService.generateX12Claim(enc1.id, provider.id);
const x12Claim2 = await BillingService.generateX12Claim(enc2.id, provider.id);

// Step 4: Combine into single file
const batchFile = [x12Claim1, x12Claim2].join("~") + "~";

// Step 5: Submit to clearinghouse
await submitToClearinghouse(payer.clearinghouse_id, batchFile);

// Step 6: Update batch status
await BillingService.updateBatchStatus(batch.id, "submitted");
```

---

## 7. SDOH (SOCIAL DETERMINANTS OF HEALTH) BILLING CODES

### 7.1 SDOH Z-Code Mapping

**Table: Z-Code Classifications** (in `sdohBilling.ts`):

| Z-Code | Category | Description | Complexity Weight | CCM Impact |
|--------|----------|-------------|-------------------|------------|
| Z59.0 | Housing | Homelessness | 3 | High |
| Z59.1 | Housing | Inadequate housing | 2 | Medium |
| Z59.3 | Nutrition | Food insecurity | 2 | High |
| Z59.6 | Financial | Low income | 2 | Medium |
| Z59.8 | Transportation | Transportation barriers | 2 | Medium |
| Z60.2 | Social | Problems related to living alone | 1 | Medium |

**Complexity Score Calculation**:
```
Score = Σ(Base Weight × Severity Multiplier)

Severity Multipliers:
- Mild: 1.0
- Moderate: 1.5
- Severe: 2.0

Example:
- Homelessness (Z59.0): 3 × 1.5 = 4.5
- Food insecurity (Z59.3): 2 × 1.5 = 3.0
- Social isolation (Z60.2): 1 × 1.5 = 1.5
Total Score: 9.0 (Complex CCM eligible)
```

### 7.2 SDOH Assessment Process

**SDOHBillingService.assessSDOHComplexity()**:

1. **Data Collection**:
   - Query patient's recent check-ins (last 5)
   - Extract SDOH indicators from check-in responses
   - Look for housing situation, food security, transportation barriers, social isolation

2. **Factor Analysis**:
   ```typescript
   SDOHFactor {
     zCode: string,             // e.g., "Z59.0"
     description: string,        // e.g., "Homelessness"
     severity: 'mild' | 'moderate' | 'severe',
     impact: 'low' | 'medium' | 'high',
     documented: boolean,        // Was this captured in documentation?
     source: string             // e.g., "patient_checkin"
   }
   ```

3. **Complexity Scoring**: Calculate total complexity score

4. **CCM Tier Assignment**:
   - Score < 2: Non-eligible for CCM
   - Score 2-3: Standard CCM (99490/99491)
   - Score >= 4 with SDOH factors: Complex CCM (99487/99489)

5. **Store Assessment**: Save to `sdoh_assessments` table for audit trail

### 7.3 SDOH Documentation Requirements

**For Standard CCM (99490/99491)**:
- Patient consent for CCM services
- Comprehensive care plan
- Patient access to care team 24/7
- Electronic health record system

**For Complex CCM (99487/99489)**:
- All standard requirements PLUS:
- SDOH assessment documentation (with Z-codes)
- Complex care coordination notes
- Multiple chronic condition documentation (≥2)
- Care team communication logs

**Audit Readiness Scoring**:
- Clinical documentation: 20 points
- SDOH documentation: 15 points
- CCM requirements: 5 points each
- Code combination compliance: 10 points
- Score < 80: Flag for review before submission

### 7.4 Integration with Coding Suggestions

**EnhancedCodingSuggestion** includes SDOH analysis:
```typescript
{
  medicalCodes: {
    icd10: [
      { code: "I10", rationale: "Hypertension", principal: true, category: "medical" },
      { code: "Z59.0", rationale: "Homelessness", principal: false, category: "sdoh" },
      { code: "Z59.3", rationale: "Food insecurity", principal: false, category: "sdoh" }
    ]
  },
  ccmRecommendation: {
    eligible: true,
    tier: "complex",
    justification: "Multiple SDOH factors present (homelessness, food insecurity)",
    expectedReimbursement: 145.60,  // 99487 rate
    requiredDocumentation: [
      "Patient consent for CCM services",
      "Comprehensive care plan",
      "SDOH assessment documentation",
      "Complex care coordination notes"
    ]
  }
}
```

---

## 8. BILLING DECISION TREE LOGIC

### 8.1 6-Node Decision Tree Architecture

```
                            ENCOUNTER INPUT
                                  ↓
                    ┌─────────────────────────────┐
                    │  NODE A: ELIGIBILITY CHECK  │
                    │  Is patient eligible?       │
                    │  Is auth required? Obtained?│
                    └──────────────┬──────────────┘
                                   ↓ (if eligible)
                    ┌─────────────────────────────┐
                    │ NODE B: SERVICE CLASSIFY    │
                    │ Procedural or E/M?          │
                    └──────────┬──────────────────┘
                               ↓
                ┌──────────────────────────────────┐
                │   IF PROCEDURAL:                 │
                │  NODE C: CPT LOOKUP              │
                │  Match procedure to CPT code    │
                └──────────┬───────────────────────┘
                           ↓
            ┌──────────────────────────────────┐
            │ IF E/M:                          │
            │ NODE D: E/M LEVEL DETERMINATION │
            │ Determine level 1-5              │
            └──────────┬───────────────────────┘
                       ↓ (both paths merge)
                ┌──────────────────────────────┐
                │ NODE E: MODIFIER LOGIC       │
                │ Detect special circumstances │
                │ Apply 25, 50, 59, 95, etc.   │
                └──────────┬───────────────────┘
                           ↓
                ┌──────────────────────────────┐
                │ NODE F: FEE SCHEDULE LOOKUP  │
                │ Determine billable amount    │
                └──────────┬───────────────────┘
                           ↓
                  ┌────────────────────────┐
                  │ GENERATE CLAIM LINE    │
                  │ CPT + modifiers +      │
                  │ ICD-10 codes +         │
                  │ charge amount          │
                  └────────────────────────┘
```

### 8.2 NODE A: Eligibility & Authorization

**Logic**:
```typescript
validateEligibility(patientId, payerId)
```

Checks:
1. Patient exists in system
2. Insurance policy is active (not terminated/pending)
3. Payer matches patient's insurance
4. Coverage effective date ≤ service date ≤ termination date

**Result**:
```typescript
EligibilityCheckResult {
  eligible: boolean,
  authorized: boolean,
  authorizationRequired: boolean,
  authorizationNumber?: string,
  coverageDetails?: CoverageDetails,
  denialReason?: string
}
```

**Denial Reasons**:
- "Patient not found in system"
- "Insurance policy is not active"
- "Payer mismatch with patient insurance"
- "Prior authorization required but not obtained"

### 8.3 NODE B: Service Classification

**Logic**:
```typescript
classifyService(input: DecisionTreeInput)
```

Rules:
1. If encounter_type is `['surgery', 'procedure', 'lab', 'radiology']` → **Procedural** (95% confidence)
2. Else if procedures documented with CPT codes → **Procedural** (90% confidence)
3. Else if encounter_type is `['office_visit', 'telehealth', 'consultation', 'emergency']` → **E/M** (95% confidence)
4. Else → **Unknown** (50% confidence) → Manual review required

**Output**:
```typescript
ServiceClassification {
  classificationType: 'procedural' | 'evaluation_management' | 'both' | 'unknown',
  confidence: 50-95,
  rationale: string
}
```

### 8.4 NODE C: Procedure CPT Lookup

**For Procedural Services**:
```typescript
lookupProcedureCPT(description: string, providedCode?: string)
```

Logic:
1. If provider supplied CPT → Validate in `code_cpt` table (status = 'active')
2. Else → Full-text search on procedure description
3. Return matching CPT code and description
4. Flag if "unlisted procedure" codes (99XXX) → Manual review

**Result**:
```typescript
ProcedureLookupResult {
  found: boolean,
  cptCode?: string,
  cptDescription?: string,
  requiresModifier?: boolean,
  suggestedModifiers?: string[],
  isUnlistedProcedure?: boolean
}
```

### 8.5 NODE D: E/M Level Determination

**For E/M Services**:
```typescript
evaluateEMLevel(input: DecisionTreeInput, documentation: EMDocumentationElements)
```

**Three Components** (2023 CMS Rules):

1. **History Component**:
   - HPI (History of Present Illness)
   - ROS (Review of Systems)
   - PFSH (Past, Family, Social History)

2. **Examination Component**:
   - Problem-focused (single organ/system)
   - Expanded (1-2 organ systems)
   - Detailed (3+ organ systems)
   - Comprehensive (full exam)

3. **Medical Decision Making** (most complex):
   - Number of diagnoses/problems: 1 = 1 pt, 2 = 2 pts, 3+ = 3 pts
   - Data reviewed: minimal (1), limited (2), moderate (3), extensive (4)
   - Risk: minimal (1), low (2), moderate (3), high (4)
   - Total MDM score: 40-100

**Level Selection Algorithm**:
```
IF time-based coding (>50% counseling time):
  time < 20 min → Level 1
  time 20-29 min → Level 2
  time 30-39 min → Level 3
  time 40-59 min → Level 4
  time >= 60 min → Level 5

ELSE (MDM-based):
  mdm_score 40-50 → Level 2
  mdm_score 51-75 → Level 3
  mdm_score 76-80 → Level 4
  mdm_score >= 81 → Level 5
```

**CPT Code Assignment**:
```
New Patient: 99201, 99202, 99203, 99204, 99205
Established: 99211, 99212, 99213, 99214, 99215
```

**Result**:
```typescript
EMEvaluationResult {
  levelDetermined: boolean,
  emLevel?: 1-5,
  emCode?: string,  // e.g., "99213"
  newPatient?: boolean,
  timeBasedCoding: boolean,
  mdmBasedCoding: boolean,
  documentationScore: 0-100,
  missingElements?: string[]
}
```

### 8.6 NODE E: Modifier Determination

**Logic**:
```typescript
determineModifiers(cptCode: string, circumstances: string[])
```

**Common Modifiers Applied**:

| Modifier | Circumstances | Impact |
|----------|---------------|--------|
| 25 | Significant, separately identifiable E/M on same day | Increase reimbursement |
| 50 | Bilateral procedure | 100% of fee (not 150%) |
| 59 | Distinct procedural service | Avoid bundling/denial |
| 76 | Repeat procedure by same provider | Increase reimbursement |
| 77 | Repeat procedure by different provider | Increase reimbursement |
| 91 | Repeat clinical laboratory test | Increase reimbursement |
| 95 | Telehealth service | Payer-specific reimbursement |
| XU, XS, XE, XP | Reduced units/services | Decrease charge amount |

**Result**:
```typescript
ModifierDecision {
  modifiersApplied: string[],
  modifierRationale: Record<string, string>,
  specialCircumstances: string[]
}
```

### 8.7 NODE F: Fee Schedule Lookup

**Logic**:
```typescript
lookupFee(cptCode: string, payerId: string, providerId: string)
```

Lookup Priority:
1. **Contracted Rate** (fee schedule for payer-provider combination) → Most common
2. **Chargemaster Rate** (provider's standard charges) → Fallback
3. **Medicare Rate** (from RBRVS calculations) → Fallback
4. **Default Rate** ($100) → Last resort

**Result**:
```typescript
FeeScheduleResult {
  feeFound: boolean,
  contractedRate?: number,
  chargemasterRate?: number,
  appliedRate: number,
  rateSource: 'contracted' | 'chargemaster' | 'default' | 'medicare',
  allowedAmount?: number
}
```

### 8.8 Medical Necessity Validation

**Logic**:
```typescript
validateMedicalNecessity(cptCode: string, icd10Codes: string[])
```

Rules Engine:
1. Query `coding_rules` table for CPT code
2. Check required ICD-10 patterns (e.g., CPT 70450 requires "R25.*" for tremor)
3. Check excluded ICD-10 patterns (contraindications)
4. Validate age restrictions (e.g., services for pediatrics)
5. Check frequency limits (per day, month, year)

**Result**:
```typescript
MedicalNecessityCheck {
  isValid: boolean,
  validCombinations: Array<{
    cpt: string,
    icd10: string,
    valid: boolean,
    reason?: string
  }>,
  ncdReference?: string,  // National Coverage Determination
  lcdReference?: string   // Local Coverage Determination
}
```

### 8.9 80/20 Fast Path Logic

**For High-Volume Scenarios**:

Common scenarios configured with auto-approval:
- Routine office visit (45% of claims)
- Telehealth visit (25% of claims)
- Follow-up visits
- Preventive care

**When Enabled** (`enable80_20FastPath: true`):
1. Match encounter against common scenarios
2. If confidence > auto-approve threshold (90%) → Skip detailed node evaluation
3. Use default CPT/ICD-10 codes
4. Complete workflow 70% faster

**Example**:
```
Encounter: Office visit, established patient, routine exam
Match: "routine_office_visit" (99213, Z00.00)
Confidence: 92% > 90% threshold
Action: Auto-approve, skip nodes C-F
Result: 40ms processing vs 200ms for full tree
```

---

## Summary Table: Key Metrics & Thresholds

| Component | Metric | Value | Reference |
|-----------|--------|-------|-----------|
| **CCM Billing** | Min billable time | 20 min | Medicare rule |
| | Complex CCM threshold | ≥4 complexity score | Internal |
| | Monthly revenue (99490) | $64.72 | 2024 Medicare |
| **E/M Coding** | Time-based threshold | 50% counseling | CMS rules |
| | Max E/M level | 5 | Professional scale |
| **X12 Control** | ISA sequence | 9 digits | X12 standard |
| | ST sequence | 4 digits | X12 standard |
| **Fee Schedule** | Max items per schedule | 10,000+ | Typical |
| | Modifier combinations | 4 max | X12 limit |
| **SDOH** | Homelessness weight | 3 | Highest impact |
| | Complex threshold | 2 factors present | Internal |
| **Decision Tree** | Auto-approve confidence | 90% | Safety margin |
| | Manual review threshold | <70% | Conservative |
| **Processing** | 837P generation time | <500ms | Target SLA |
| | Batch submission | 1,000+ claims | Typical |

---

## File Manifest

### Service Layer (3,259 lines total)
- `/src/services/billingService.ts` - Core CRUD operations (436 lines)
- `/src/services/ccmAutopilotService.ts` - CCM automation (209 lines)
- `/src/services/sdohBillingService.ts` - SDOH analysis & coding (847 lines)
- `/src/services/billingDecisionTreeService.ts` - 6-node decision logic (926 lines)
- `/src/services/unifiedBillingService.ts` - Workflow orchestration (841 lines)

### Type Definitions
- `/src/types/billing.ts` - Core billing types
- `/src/types/billingDecisionTree.ts` - Decision tree types
- `/src/types/sdohBilling.ts` - SDOH types

### Utilities
- `/src/utils/billingUtils.ts` - Validation, formatting, helpers

### Edge Function
- `/supabase/functions/generate-837p/index.ts` - X12 837P generation (497 lines)

### Database Migrations
- `/supabase/migrations/2025092832322_billing_core.sql` - Core schema
- `/supabase/migrations/20251015120000_claude_billing_monitoring.sql` - Monitoring
- `/supabase/migrations/20251025200004_unified_billing_dashboard.sql` - Dashboard views
- `/supabase/migrations/20251026120000_billing_review_workflow.sql` - Review workflow

### Tests
- `/src/services/__tests__/billingService.test.ts`
- `/src/services/__tests__/sdohBillingService.test.ts`
- `/src/services/__tests__/unifiedBillingService.integration.test.ts`

---

## Next Steps & Enhancements

1. **Claim Status Monitoring**: Real-time clearinghouse response tracking
2. **Denial Management**: Automated appeals and resubmission logic
3. **Analytics Dashboard**: Claims metrics, denial rates, reimbursement trends
4. **Performance Optimization**: Cache fee schedules, batch code lookups
5. **Multi-Clearinghouse Support**: Load-balancing and failover
6. **HIPAA Audit Reports**: Monthly access logs and compliance certifications

