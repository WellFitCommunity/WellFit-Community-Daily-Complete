# Patent Specification — Intelligent Healthcare Data Migration with DNA Fingerprinting

> **Applicant:** Envision Virtual Edge Group LLC
> **Contact:** maria@wellfitcommunity.com
> **Prepared:** 2026-03-10
> **Classification:** Healthcare Information Technology, Machine Learning, Data Migration, Pattern Recognition
> **Confidential — Attorney-Client Work Product

---

## Title of Invention

**System and Method for Intelligent Healthcare Data Migration Using Data DNA Fingerprinting, Healthcare-Specific Pattern Recognition, and Self-Learning Field Mapping with AI-Assisted Fallback**

---

## Field of the Invention

This invention relates to healthcare data interoperability and migration systems, and more particularly to a method and system for automatically analyzing, fingerprinting, and mapping healthcare data from heterogeneous source systems to a unified target schema using pattern recognition, statistical similarity matching, machine learning from human feedback, and AI-assisted field mapping.

---

## Background of the Invention

### Problems in Existing Healthcare Data Migration

Healthcare data migration — the process of moving patient records, clinical data, and administrative information from one Electronic Health Record (EHR) system to another — is one of the most expensive and error-prone operations in healthcare IT.

1. **Manual Field Mapping** — Current practice requires consulting teams ($200,000-$500,000+ per engagement) to manually examine source data structures, identify field meanings, and create mapping rules to the target system. This process is repeated from scratch for every migration, even when the source system type (e.g., Epic, Cerner) has been encountered before.

2. **No Institutional Memory** — When a healthcare organization completes a migration from Epic System A, the knowledge of how Epic fields map to the target schema is lost. When the next Epic migration begins, consultants start from zero. There is no mechanism to learn from prior migrations.

3. **Generic Tools Cannot Read Healthcare Data** — Enterprise ETL tools (Informatica, Talend, Fivetran, Azure Data Factory) perform data transformation but have no awareness of healthcare-specific data patterns. A column containing LOINC observation codes, NPI provider numbers, or ICD-10 diagnosis codes is treated identically to any string column. This means clinical data semantics are invisible to the migration tool.

4. **Healthcare Integration Engines Are Not Migration Engines** — Healthcare-specific tools (Rhapsody, Mirth Connect, Health Gorilla) perform message transformation (HL7 → FHIR, X12 → JSON) but do not learn from past transformations. Each interface is configured manually. They solve the format problem but not the mapping intelligence problem.

5. **Source System Detection Is Manual** — Consultants must be told which EHR system the data came from. Column naming conventions differ between Epic (`PAT_MRN_ID`), Cerner (`PERSON_ID`), MEDITECH (`Pat.Num`), and others, but no automated system detects the source system from the data itself.

6. **No Confidence Estimation** — Existing migration tools either map a field or don't. There is no mechanism to express "I am 87% confident this column maps to patient.date_of_birth" and route low-confidence mappings to human review while auto-applying high-confidence ones.

### What Is Needed

A system that:
- Automatically analyzes incoming healthcare data to detect clinical patterns (LOINC, ICD-10, CPT, NPI, etc.)
- Creates a unique structural fingerprint ("DNA") of each dataset for similarity matching
- Remembers every successful migration and applies learned mappings to future migrations
- Auto-detects the source EHR system from column naming conventions
- Routes high-confidence mappings automatically and low-confidence mappings to AI assistance
- Learns from human corrections to improve future mapping accuracy
- Operates in a multi-tenant environment with organization-scoped learning

---

## Summary of the Invention

The present invention provides an **intelligent healthcare data migration system** comprising:

1. **A Data DNA Fingerprinting Engine** — Generates unique structural signatures for healthcare datasets by analyzing column patterns, data types, statistical distributions, and healthcare-specific code formats. Each signature includes a deterministic structure hash and a normalized pattern frequency vector enabling cosine similarity matching against previously migrated datasets.

2. **A Healthcare-Specific Pattern Recognition System** — Detects 40+ healthcare data patterns including clinical codes (LOINC, SNOMED CT, ICD-10, CPT, HCPCS, NDC, RxNorm), healthcare identifiers (NPI with Luhn validation, SSN, MRN), FHIR resource types and references, and standard data formats (dates, names, addresses, phone numbers). Patterns are prioritized with clinical codes checked first.

3. **A Self-Learning Mapping Intelligence Engine** — Stores successful field mappings with confidence scores that increase with each confirmed use and decrease with each correction. High-confidence mappings are applied automatically. Low-confidence mappings trigger AI-assisted suggestions with response caching. Confidence is capped at 0.95 — the system never claims certainty.

4. **An AI-Assisted Hybrid Mapping System** — When learned mappings have insufficient confidence, the system consults a large language model (LLM) with source column context (name, sample values, detected patterns, target schema). AI responses are cached for identical patterns to minimize cost. AI confidence is independently capped.

5. **A SMART on FHIR Application Fingerprinting and Authorization System** — Registers and tracks third-party healthcare applications with bipartite authorization tracking (separate tables for apps, authorizations, and tokens), enabling per-patient app management, fine-grained revocation, and adoption analytics.

---

## Detailed Description of the Invention

### I. Data DNA Fingerprinting Engine

#### A. Column-Level DNA Analysis

For each column in a source dataset, the system generates a Column DNA profile:

| Attribute | How It's Computed | Purpose |
|-----------|------------------|---------|
| `originalName` | Preserved from source | Audit trail |
| `normalizedName` | Lowercase, stripped of prefixes/suffixes, underscore-separated | Cross-system name matching |
| `primaryPattern` | Highest-priority pattern matching >50% of values | Semantic classification |
| `detectedPatterns` | All patterns matching any values, ranked by confidence | Disambiguation |
| `patternConfidence` | Percentage of non-null values matching the primary pattern | Reliability indicator |
| `sampleValues` | First 5 non-null values | Human review context |
| `nullPercentage` | Proportion of null/empty values | Data quality signal |
| `uniquePercentage` | Proportion of distinct values | Cardinality signal (identifier vs category) |
| `avgLength` | Mean character length of non-null values | Format consistency signal |
| `dataTypeInferred` | Derived from value analysis: string, number, boolean, date, mixed | Type mapping |

#### B. Dataset-Level DNA Generation

From the collection of Column DNA profiles, the system generates a Dataset DNA:

1. **Structure Hash** — A deterministic hash computed from the sorted list of (normalizedColumnName, primaryPattern) pairs. Two datasets with identical column names and detected patterns produce identical structure hashes, enabling exact-match lookups in constant time.

2. **Signature Vector** — A normalized vector where each dimension corresponds to a healthcare data pattern (NPI, LOINC, ICD10, CPT, EMAIL, DATE, etc.). The value in each dimension is the proportion of columns in the dataset that exhibit that pattern. This vector enables cosine similarity comparison between datasets of different sizes and column counts.

3. **DNA Identifier** — A unique 16-character identifier incorporating a timestamp component, enabling temporal ordering of DNA records.

#### C. Similarity Matching

When a new dataset arrives, the system:

1. Generates the dataset's DNA (structure hash + signature vector)
2. Checks for exact structure hash matches in the `migration_source_dna` table (O(1) lookup)
3. If no exact match, computes cosine similarity between the new signature vector and all stored vectors
4. Returns datasets above a configurable similarity threshold (default: 0.7)
5. Extracts learned mappings from the most similar prior migration

**Cosine Similarity Formula:**

```
similarity(A, B) = (A · B) / (||A|| × ||B||)
```

Where A and B are the signature vectors of two datasets. A similarity of 1.0 indicates identical pattern distributions; 0.0 indicates completely different structures.

**Practical Application:** When Hospital B migrates from Epic and the system has previously migrated Hospital A from Epic, the signature vectors will have high similarity (both datasets contain NPI columns, ICD-10 columns, date columns in similar proportions). The system retrieves Hospital A's learned mappings and applies them to Hospital B's migration — without any manual configuration.

### II. Healthcare-Specific Pattern Recognition System

#### A. Pattern Definitions

The system recognizes 40+ healthcare-specific data patterns, organized by priority:

**Priority 1 — Healthcare Identifiers:**

| Pattern | Detection Method | Validation |
|---------|-----------------|------------|
| `NPI` | 10-digit numeric string | Luhn check digit algorithm |
| `SSN` | 3-2-4 digit format with optional dashes | Format validation only (never stored) |
| `ID_UUID` | RFC 4122 UUID format | Regex validation |

**Priority 2 — Clinical Codes:**

| Pattern | Format | Standard |
|---------|--------|----------|
| `LOINC` | 1-5 digits, hyphen, single check digit (e.g., `12345-6`) | Logical Observation Identifiers Names and Codes |
| `SNOMED_CT` | 6-18 digit numeric identifier | Systematized Nomenclature of Medicine Clinical Terms |
| `ICD10` | Letter + 2 digits, optional decimal + 1-4 digits (e.g., `I21.11`) | International Classification of Diseases, 10th Revision |
| `CPT` | 5-digit numeric code | Current Procedural Terminology |
| `HCPCS` | Letter + 4 digits (e.g., `J0135`) | Healthcare Common Procedure Coding System |
| `NDC` | 10-11 digits in 4-4-2, 5-3-2, or 5-4-1 format | National Drug Code |
| `RXNORM` | Numeric RxNorm Concept Unique Identifier | RxNorm medication terminology |
| `FHIR_RESOURCE_TYPE` | One of 145 FHIR R4 resource type names | HL7 FHIR Standard |
| `FHIR_REFERENCE` | ResourceType/identifier format | FHIR resource references |

**Priority 3 — Standard Patterns:**

| Pattern | Detection |
|---------|-----------|
| `EMAIL` | RFC 5322 format |
| `PHONE` | 10-digit with optional formatting |
| `DATE` | Multiple formats (MM/DD/YYYY, YYYY-MM-DD, etc.) |
| `DATE_ISO` | ISO 8601 format |
| `NAME_FULL` | Two or more capitalized words |
| `NAME_FIRST` / `NAME_LAST` | Single capitalized word in name context |
| `STATE_CODE` | 2-letter US state abbreviation |
| `ZIP` | 5-digit or 5+4 format |
| `CURRENCY` | Dollar sign or decimal with 2 places |
| `PERCENTAGE` | Numeric with percent sign |
| `BOOLEAN` | true/false, yes/no, 0/1, Y/N |

#### B. Detection Algorithm

For each column:

1. Sample N values (configurable, default 100) from the column
2. For each sampled value, test against all pattern definitions in priority order
3. A pattern is "detected" if its regex matches the value
4. Calculate confidence: `matchingValues / totalNonNullValues`
5. The primary pattern is the highest-priority pattern with confidence exceeding the minimum threshold
6. All detected patterns are stored for disambiguation

**Priority ordering ensures clinical codes are identified first.** A column containing values like `12345-6` could match both LOINC (priority 2) and a generic numeric pattern (priority 3). The priority system correctly classifies it as LOINC.

#### C. Source System Auto-Detection

The pattern detector examines column naming conventions to auto-detect the source EHR system:

| Source System | Column Name Patterns | Example |
|--------------|---------------------|---------|
| Epic | `PAT_MRN_ID`, `PAT_ENC_CSN_ID`, `HSP_ACCOUNT_ID` | `PAT_MRN_ID` → Epic |
| Cerner | `PERSON_ID`, `ENCNTR_ID`, `NOMENCLATURE_ID` | `PERSON_ID` → Cerner |
| MEDITECH | `Pat.Num`, `Acct.No`, `Phy.ID` | `Pat.Num` → MEDITECH |
| Athenahealth | `patient_id`, `encounter_id` (lowercase_snake) | `patient_id` → Athena |
| Allscripts | `PatientID`, `EncounterID` (PascalCase) | `PatientID` → Allscripts |

The detected source system is stored in the DNA record and used to weight learned mappings from the same source system higher than mappings from different systems.

### III. Self-Learning Mapping Intelligence Engine

#### A. Mapping Candidate Generation

When a source column needs mapping to a target schema, the system generates candidates from three sources, weighted and combined:

| Source | Weight | Description |
|--------|--------|-------------|
| **Pattern Match** | 0.3 | Target columns that accept the same data pattern (e.g., NPI column → `billing_providers.npi`) |
| **Name Similarity** | 0.4 | Fuzzy string matching between normalized source and target column names |
| **Learned Mapping Bonus** | 0.5 | Confidence boost from prior successful mappings of the same pattern |

**Combined Score:** `patternScore × 0.3 + nameScore × 0.4 + learnedBonus × 0.5`

Up to 3 alternative mappings are returned per source column, ranked by combined score. The minimum candidate score threshold is configurable (default: 0.2).

#### B. Confidence Lifecycle

Each learned mapping has a confidence score that evolves over time:

```
Initial confidence: Based on pattern match + name similarity (typically 0.3-0.7)

User accepts mapping:
  new_confidence = old_confidence + 0.05 (capped at 1.0)
  success_count += 1

User corrects mapping:
  wrong_mapping.confidence -= 0.1 (floored at 0.0)
  wrong_mapping.failure_count += 1
  correct_mapping = new learned mapping with confidence 0.7 (user-validated)

Confidence routing:
  >= 0.6: Apply automatically (no AI needed)
  < 0.6:  Route to AI-assisted mapping
  < 0.2:  Flag for mandatory human review
```

#### C. Persistence

Learned mappings are stored in the `migration_learned_mappings` table:

| Field | Purpose |
|-------|---------|
| `source_column_normalized` | Normalized source column name |
| `source_patterns` | Detected patterns (array) |
| `source_system` | Detected source EHR system |
| `target_table` | Target database table |
| `target_column` | Target column name |
| `transform_function` | Optional transformation (e.g., date format conversion) |
| `confidence` | Current confidence score (0.0-1.0) |
| `success_count` | Number of times this mapping was accepted |
| `failure_count` | Number of times this mapping was corrected |
| `organization_id` | Tenant scope (multi-tenant isolation) |

**Upsert Logic:** When a mapping is confirmed, the system uses an atomic upsert operation that either creates a new mapping or updates an existing one. The upsert recalculates confidence as:

```
new_confidence = (old_success_count × old_confidence + new_confidence) / (old_success_count + 1)
```

This weighted average ensures that a mapping confirmed 50 times is not easily destabilized by a single correction.

### IV. AI-Assisted Hybrid Mapping System

#### A. AI Trigger Condition

AI assistance is invoked when:
- No learned mapping exists with confidence >= 0.6, AND
- Pattern matching + name similarity produce a combined score below the confidence threshold

#### B. AI Context Payload

The system sends to the AI model:

```json
{
  "source_column": {
    "name": "PAT_MRN_ID",
    "normalized_name": "pat_mrn_id",
    "detected_patterns": ["ID_ALPHANUMERIC"],
    "sample_values": ["MRN-001234", "MRN-005678", "MRN-009012"],
    "null_percentage": 0.02,
    "unique_percentage": 0.99
  },
  "target_schema": {
    "tables": ["patients", "profiles", "ehr_patient_mappings"],
    "columns": {
      "patients.mrn": "VARCHAR(50)",
      "profiles.user_id": "UUID",
      "ehr_patient_mappings.source_mrn": "VARCHAR(100)"
    }
  },
  "source_system_detected": "EPIC"
}
```

#### C. AI Response Processing

The AI returns a structured mapping suggestion with reasoning:

```json
{
  "target_table": "ehr_patient_mappings",
  "target_column": "source_mrn",
  "confidence": 0.88,
  "reasoning": "PAT_MRN_ID is Epic's Medical Record Number field. Maps to ehr_patient_mappings.source_mrn which stores source system MRNs for cross-referencing.",
  "transform": "strip_prefix('MRN-')"
}
```

#### D. AI Governance Controls

| Control | Implementation |
|---------|---------------|
| **Confidence capping** | AI-suggested confidence is capped at 0.95 — the system never claims certainty for AI-generated mappings |
| **Response caching** | AI responses are cached by (source_patterns + target_schema) hash. Identical pattern combinations reuse cached responses without additional AI cost |
| **Token limits** | Maximum 2,000 tokens per AI request to control cost |
| **Fallback** | If AI is unavailable or returns an error, the system proceeds with pattern + name similarity scores only |

### V. Migration Execution Engine

#### A. Batch Processing

Migrations execute in configurable batches (default: 500 records):

1. **Dry Run** — Execute all transformations and validations without writing to the database. Returns error count, error types, and sample failures for review.
2. **Processing** — Apply mappings and transformations, insert records in batches, log errors per row.
3. **Completion** — Record final statistics (success count, error count, error types) and update learned mappings based on results.

#### B. Status Lifecycle

```
PENDING → PROCESSING → COMPLETED
                     → FAILED (with error details)
         DRY_RUN (non-destructive validation)
```

#### C. Error Tracking

Every migration error is logged individually:

| Field | Purpose |
|-------|---------|
| `row_number` | Source row that failed |
| `source_column` | Column that caused the error |
| `source_value` | The problematic value |
| `target_table` / `target_column` | Where it was mapped |
| `error_type` | Classification (type_mismatch, validation_failed, constraint_violation, etc.) |
| `error_message` | Human-readable explanation |

Error patterns are analyzed to detect systematic issues (e.g., "85% of failures are date format mismatches in column admission_date").

#### D. Post-Migration Learning

After migration completes:

1. For each successful mapping: increment `success_count`, boost confidence
2. For each failed mapping: increment `failure_count`, reduce confidence
3. Store the source DNA record with `success_rate` for future similarity lookups
4. High success-rate DNA records are weighted higher in future similarity matches

### VI. SMART on FHIR Application Fingerprinting System

#### A. Bipartite Authorization Architecture

Unlike standard OAuth implementations that combine authorization and token state, the system uses three independent tables:

| Table | Purpose | Lifecycle |
|-------|---------|-----------|
| `smart_registered_apps` | App identity and approval status | Created once per app, persists indefinitely |
| `smart_authorizations` | Per-patient app grants | Created when patient consents, updated on scope changes, never deleted (audit trail) |
| `smart_access_tokens` | Active bearer tokens | Created on auth code exchange, expired/revoked as needed |

**Why This Matters:**

- **Patient transparency** — A patient can query `smart_authorizations` to see every app they've ever connected, with timestamps and current status
- **Granular revocation** — Revoking App A's access (deleting its tokens) does not affect App B's authorization record
- **Adoption analytics** — `total_authorizations` and `active_authorizations` on the app record enable per-app analytics without joining token tables
- **Audit preservation** — Even after token revocation, the authorization record persists for compliance audits

#### B. Application Fingerprinting

Each registered application receives a unique fingerprint comprising:

| Attribute | Purpose |
|-----------|---------|
| `client_id` | Unique identifier (generated, not user-chosen) |
| `client_name` | Human-readable app name |
| `app_type` | Classification: `patient`, `provider`, `system`, `research` |
| `is_confidential` | Whether app can keep a secret (server-side vs browser) |
| `scopes_allowed` | OAuth scopes this app may request |
| `redirect_uris` | Allowed callback URIs (strict matching) |
| `token_endpoint_auth_method` | Authentication method for token exchange |

**Two-Tier Access Control:**
1. Admin registers the app → status: `pending`
2. Admin approves the app → status: `approved`
3. Only approved apps are visible to patients for connection

#### C. OAuth 2.0 + PKCE Flow

**Registration:**
1. Admin submits app details via registration form
2. Server generates `client_id` using `generate_smart_client_id()` function
3. For confidential clients: generates `client_secret` and stores SHA-256 hash
4. Secret displayed once to admin (display-once pattern)
5. App stored with `status: pending` until admin approval

**Authorization:**
1. Patient initiates connection from their health portal
2. App redirects to `smart-authorize` endpoint with: `client_id`, `redirect_uri`, `scope`, `code_challenge` (PKCE), `code_challenge_method`
3. System verifies app is `approved`, `redirect_uri` is in allowed list
4. Patient reviews requested scopes and consents
5. Server generates `authorization_code` with 10-minute expiry
6. Redirects to app's `redirect_uri` with code

**Token Exchange:**
1. App sends: `code`, `client_id`, `code_verifier` (PKCE proof)
2. Server validates: code not expired, PKCE verifier matches challenge, client_id matches
3. For confidential clients: also validates `client_secret`
4. Returns: `access_token`, `token_type: bearer`, `expires_in`, optional `refresh_token` (30-day lifetime)

**Resource Access:**
1. App includes `Authorization: Bearer <access_token>` on FHIR API requests
2. Server validates token, checks scopes against requested resource
3. Access logged to `smart_audit_log` with IP, user agent, resource accessed

**Revocation:**
1. Patient clicks "Disconnect" for an app
2. All active tokens for that app + patient are invalidated
3. Authorization record updated with `revoked_at` timestamp (not deleted)
4. App's `active_authorizations` counter decremented

#### D. Audit Trail

Every SMART operation is logged to `smart_audit_log`:

| Event Type | What's Logged |
|-----------|--------------|
| `app_registered` | App details, registering admin |
| `app_approved` | Approving admin, timestamp |
| `authorization_granted` | Patient ID, app ID, scopes granted |
| `token_issued` | Token type, expiry, scopes |
| `token_refreshed` | Refresh token used, new token issued |
| `resource_accessed` | Resource type, patient ID, app ID |
| `access_denied` | Reason (expired, revoked, insufficient scope) |
| `app_revoked` | Revoking user, timestamp |

Each entry includes: IP address, user agent, request correlation ID for forensic analysis.

### VII. Multi-Tenant Architecture

Both systems (migration engine and SMART fingerprinting) operate in a multi-tenant environment:

- **Migration engine** — `organization_id` on all tables. Learned mappings are scoped per organization. Hospital A's Epic mappings are not visible to Hospital B (unless explicitly shared).
- **SMART system** — Apps can be registered per tenant or globally. Authorizations are always per-patient within a tenant.
- **Row-Level Security** — All tables have RLS policies enforcing organization/tenant isolation. Queries automatically filter by the caller's tenant from their JWT.

---

## Claims

### Independent Claims

**Claim 1.** A computer-implemented method for intelligent healthcare data migration, comprising:
- receiving a source dataset from a healthcare information system;
- analyzing each column of the source dataset by sampling values and testing against a prioritized set of healthcare-specific pattern definitions including clinical codes (LOINC, SNOMED CT, ICD-10, CPT, HCPCS, NDC, RxNorm), healthcare identifiers (NPI with Luhn check digit validation), FHIR resource types, and standard data formats;
- generating a Data DNA fingerprint for the source dataset comprising a deterministic structure hash of column names and detected patterns and a normalized pattern frequency signature vector;
- comparing the signature vector against stored vectors from prior migrations using cosine similarity to identify structurally similar datasets;
- retrieving learned field mappings from prior similar migrations and applying them with stored confidence scores;
- routing mappings with confidence below a configurable threshold to an AI-assisted mapping system that receives source column context and target schema and returns mapping suggestions with reasoning;
- capping AI-suggested confidence at a maximum value below 1.0;
- executing the migration in configurable batches with per-row error tracking;
- updating learned mapping confidence scores based on migration results: incrementing confidence for successful mappings and decrementing for failed mappings;
- storing the source dataset's DNA fingerprint with success rate for future similarity matching.

**Claim 2.** A computer-implemented method for detecting healthcare data patterns in arbitrary source datasets, comprising:
- sampling a configurable number of values from each column of a source dataset;
- testing each sampled value against a prioritized ordered set of pattern definitions, where healthcare clinical codes (LOINC, SNOMED CT, ICD-10, CPT) are tested before general patterns (date, email, phone);
- for NPI (National Provider Identifier) patterns, performing Luhn check digit validation to distinguish true NPIs from arbitrary 10-digit numbers;
- calculating pattern confidence as the proportion of non-null values matching each detected pattern;
- selecting the highest-priority pattern exceeding a minimum confidence threshold as the primary pattern for each column;
- auto-detecting the source EHR system (Epic, Cerner, MEDITECH, Athenahealth, Allscripts) from column naming conventions;
- storing all detected patterns per column for disambiguation in downstream mapping.

**Claim 3.** A computer-implemented method for self-learning field mapping in healthcare data migration, comprising:
- maintaining a database of learned mappings, each comprising a source column pattern, source system identifier, target table and column, confidence score, success count, and failure count;
- for each source column in a new migration, generating mapping candidates by combining pattern match scores, name similarity scores, and learned mapping confidence bonuses using configurable weights;
- when a mapping is accepted by a user, atomically incrementing the confidence score using a weighted average that prevents destabilization of well-established mappings by single events;
- when a mapping is corrected by a user, decrementing the incorrect mapping's confidence and creating a new learned mapping at elevated confidence for the user-provided correction;
- routing mappings below a confidence threshold to AI-assisted suggestion with response caching by pattern and schema hash;
- scoping all learned mappings by organization identifier for multi-tenant isolation.

**Claim 4.** A computer-implemented system for healthcare application authorization with bipartite tracking, comprising:
- a registered applications table storing application identity, type classification, allowed OAuth scopes, allowed redirect URIs, approval status, and adoption counters;
- an authorizations table storing per-patient application grants independently from tokens, with grant timestamps, scope records, and revocation timestamps;
- an access tokens table storing bearer tokens with expiry, scope, and usage tracking;
- wherein revoking an application's tokens updates the authorization record with a revocation timestamp but does not delete the authorization record, preserving the audit trail;
- wherein per-application adoption analytics are derived from authorization counters without joining token tables;
- a two-tier access control wherein applications must be approved by an administrator before patients can initiate authorization.

### Dependent Claims

**Claim 5.** The method of Claim 1, wherein the structure hash is computed as a deterministic hash of the sorted list of normalized column names paired with their primary detected patterns, enabling constant-time exact-match lookups against previously migrated datasets.

**Claim 6.** The method of Claim 1, wherein AI-assisted mapping responses are cached by a hash of the source column's detected patterns combined with the target schema definition, such that identical pattern-schema combinations reuse cached responses without additional AI invocation.

**Claim 7.** The method of Claim 2, wherein source EHR system detection is performed by matching column naming conventions against known patterns for each EHR vendor, and the detected source system is used to weight learned mappings from the same source system higher than mappings from different source systems.

**Claim 8.** The method of Claim 3, wherein the weighted average confidence update formula prevents well-established mappings (those with high success counts) from being destabilized by single correction events, using the formula: `new_confidence = (old_success_count × old_confidence + event_confidence) / (old_success_count + 1)`.

**Claim 9.** The method of Claim 1, further comprising a dry run mode wherein all transformations and validations are executed without writing to the target database, returning error counts, error types, and sample failures for review before committing the migration.

**Claim 10.** The system of Claim 4, further comprising an audit log recording every application lifecycle event (registration, approval, authorization grant, token issuance, token refresh, resource access, access denial, revocation) with IP address, user agent, and request correlation identifier for forensic analysis.

**Claim 11.** The method of Claim 1, wherein post-migration analysis detects systematic error patterns across failed rows and identifies the predominant error type and affected column, enabling targeted data cleanup before re-migration.

**Claim 12.** The method of Claim 2, further comprising FHIR URI detection wherein clinical codes embedded in FHIR reference format (e.g., `http://loinc.org|12345-6`, `http://hl7.org/fhir/sid/icd-10-cm|I21.11`) are detected and the embedded code is extracted for pattern classification.

---

## Abstract

A system and method for intelligent healthcare data migration using Data DNA fingerprinting. The system analyzes incoming healthcare datasets by detecting 40+ healthcare-specific data patterns (LOINC, SNOMED CT, ICD-10, CPT, NPI with Luhn validation) and generates a unique structural fingerprint comprising a deterministic hash and a normalized pattern frequency vector. Cosine similarity matching against previously migrated datasets enables retrieval and application of learned field mappings. A self-learning engine updates mapping confidence scores based on user acceptance or correction of suggested mappings, using weighted averages that protect well-established mappings from single-event destabilization. When confidence is insufficient, an AI-assisted mapping system provides suggestions with response caching and confidence capping. The system auto-detects the source EHR system from column naming conventions and scopes all learning per organization for multi-tenant isolation. A companion SMART on FHIR application fingerprinting system uses bipartite authorization tracking to manage third-party healthcare application access with per-patient granularity, adoption analytics, and complete audit trails.

---

## Inventor Notes

### Prior Art Differentiation

| Existing System | What It Does | What It Lacks |
|----------------|-------------|---------------|
| Informatica / Talend / Fivetran | Enterprise ETL | No healthcare pattern recognition, no clinical code awareness, no learning from prior migrations |
| Rhapsody / Mirth Connect | Healthcare message transformation | Transforms formats (HL7→FHIR) but doesn't learn mapping intelligence, no DNA fingerprinting |
| Health Gorilla / Redox | Healthcare data exchange | Data transport, not migration intelligence. No field mapping, no similarity matching |
| AWS Glue / Azure Data Factory | Cloud ETL | Generic schema inference. No healthcare patterns, no LOINC/SNOMED/ICD-10 detection |
| Epic Care Link / Cerner Bridge | EHR-specific migration | Proprietary to one vendor. No cross-vendor learning, no open standard |
| Google Healthcare API DICOM/FHIR | Healthcare cloud storage | Storage and format conversion. No migration intelligence, no field mapping |
| Manual consulting ($200-500K) | Human expertise | No institutional memory. Knowledge leaves when consultants leave. |

### Key Differentiators

1. **Healthcare-specific pattern recognition** — The only migration system that natively understands LOINC, SNOMED, ICD-10, CPT, HCPCS, NDC, RxNorm, NPI, and FHIR resource types
2. **Data DNA fingerprinting** — Unique structural signatures enabling dataset similarity matching across migrations, organizations, and time
3. **Self-learning confidence system** — Mappings improve with each migration, asymptotically approaching (but never reaching) certainty
4. **AI-assisted hybrid approach** — Uses AI only when learned mappings are insufficient, with caching to minimize cost
5. **Source system auto-detection** — Identifies Epic, Cerner, MEDITECH, Athena, and Allscripts from column names alone
6. **Multi-tenant learning isolation** — Organization A's mappings are invisible to Organization B unless explicitly shared
7. **Bipartite SMART authorization** — Separates app identity, patient authorization, and token lifecycle for granular management

---

*This document is prepared for patent counsel review. Technical implementation details are available in the referenced source code repository. All described functionality is implemented and operational.*
