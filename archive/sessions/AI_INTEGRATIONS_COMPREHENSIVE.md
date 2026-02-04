# WellFit Community - Comprehensive AI Integration Documentation

## Executive Summary

WellFit Community Daily Complete implements a sophisticated, multi-layered AI integration system using Claude/Anthropic services. The system is production-ready, HIPAA-compliant, and purpose-built for healthcare delivery with autonomous self-healing, real-time medical transcription, AI-powered billing optimization, and intelligent personalization.

---

## 1. CLAUDE API INTEGRATIONS & THEIR PURPOSES

### 1.1 Core Claude Service (Client-Side)
**File**: `src/services/claudeService.ts` (1,044 lines)

**Purpose**: Main entry point for Claude AI operations with enterprise-grade features.

**Key Features**:
- Singleton pattern for memory efficiency
- Lazy SDK loading (saves ~400KB initial bundle)
- Comprehensive rate limiting (60 requests/minute per user)
- Cost tracking with daily ($50) and monthly ($500) budget limits
- Circuit breaker pattern for API resilience
- Support for multiple Claude models with automatic model selection

**Models Supported**:
- `claude-haiku-4-5-20251001` - LATEST: Ultra-fast, cheapest ($0.0001 input, $0.0005 output per 1K tokens)
- `claude-sonnet-4-5-20250929` - Revenue-critical accuracy ($0.003 input, $0.015 output per 1K tokens)
- `claude-opus-4-1` - Reserved for complex reasoning ($0.015 input, $0.075 output)
- Legacy models (Haiku 3, Sonnet 3.5) for backwards compatibility

**Request Types Handled**:
1. **Health Questions**: Senior-friendly guidance with simple language (8th grade level)
2. **Medical Analytics**: Population health analysis for admins
3. **FHIR Analysis**: Structured healthcare data interpretation (summary, risk assessment, care gaps)
4. **Risk Assessment**: Functional assessment analysis with conservative bias
5. **Clinical Notes**: Professional note generation for medical records
6. **Health Suggestions**: Personalized wellness tips for seniors

**Cost Management**:
- Estimates cost before each request
- Prevents budget overruns
- Tracks daily and monthly spending per user
- Provides spending summaries for reporting

**Error Handling**:
- `ClaudeServiceError`: Main exception class with code, status, and request ID
- `ClaudeInitializationError`: Specific initialization failures
- Health checks validate API connectivity
- Test connection utility for debugging

---

### 1.2 Claude Edge Service (Secure Server-Side)
**File**: `src/services/claudeEdgeService.ts` (134 lines)

**Purpose**: Secure server-side wrapper for Claude API calls via Supabase Edge Functions.

**Key Features**:
- Uses Supabase singleton client (NO new client creation)
- Invokes `claude-chat` Edge Function for security
- Supports multi-turn conversations
- Text completion helper with sensible defaults
- Connection testing with minimal overhead

**Default Models**:
- Chat: `claude-sonnet-4-5-20250929` 
- Completion: `claude-haiku-4-5-20251001`

**Key Methods**:
```
chat(request: ClaudeChatRequest): Promise<ClaudeChatResponse>
complete(prompt: string, options?: {model?, max_tokens?, system?}): Promise<string>
testConnection(): Promise<{success, message}>
getStatus(): {initialized, mode}
```

---

### 1.3 Claude Care Assistant (Translation & Admin Automation)
**File**: `src/services/claudeCareAssistant.ts` (832 lines)

**Purpose**: Unified AI assistant for multi-language translation, role-specific admin task automation, and cross-role collaboration.

**Sub-Component 1: Translation Engine**
- Checks translation cache first (60-80% cache hit rate expected)
- Uses Claude Haiku 4.5 for translation (fast, cost-effective)
- Parses cultural notes from AI response
- Caches results for 60-second validity
- Extracts translation confidence scores (0.0-1.0)

**Translation Supported**:
- Multi-language pairs (English ↔ Spanish, Mandarin, Vietnamese, etc.)
- Medical terminology preservation
- Cultural context awareness
- Health literacy level adjustment
- Religious/cultural considerations

**Sub-Component 2: Administrative Task Automation**
- Load templates from database
- Validate role-based permissions
- Build prompt from template + input data
- Use role-appropriate Claude model
- Save execution to history for learning

**Task Types**:
- Template ID-based execution
- Support for {field_name} and {{field_name}} placeholder formats
- Output format validation
- Professional/concise medical terminology enforcement

**Sub-Component 3: Voice Input Integration**
- Converts audio Blob to base64
- Calls realtime_medical_transcription edge function
- Applies provider-specific voice corrections via VoiceLearningService
- Analyzes transcription to suggest task template
- Saves session for ML learning

**Sub-Component 4: Cross-Role Collaboration**
- Care context sharing between roles
- Example: Nurse identifies discharge need → tags case manager
- De-identified context entries
- Active/inactive status tracking with validity dates

**Database Tables Used**:
- `claude_translation_cache` - Translation cache with usage stats
- `claude_admin_task_templates` - Role-specific task templates
- `claude_admin_task_history` - Execution history for learning
- `claude_care_context` - Cross-role collaboration context
- `claude_voice_input_sessions` - Voice session tracking

---

## 2. SMART SCRIBE REAL-TIME TRANSCRIPTION SYSTEM

### 2.1 Real-Time Medical Transcription Edge Function
**File**: `supabase/functions/realtime_medical_transcription/index.ts` (461 lines)

**Architecture**:
```
Browser (Audio) 
    ↓ (WSS over access_token)
Edge Function WebSocket Server
    ↓ (relays audio)
Deepgram API (nova-2-medical model)
    ↓ (returns transcripts)
Claude Sonnet 4.5 (every 10 seconds)
    ↓ (analyzes for codes)
WebSocket Response to Browser
```

**Key Features**:

1. **WebSocket Authentication**:
   - Requires access_token in URL query params
   - Validates token via `admin.auth.getUser(access_token)`
   - Returns 401 Unauthorized if missing

2. **Deepgram Configuration** (Medical-Grade):
   - Model: `nova-2-medical` (specialized for medical terminology)
   - Language: English US
   - Encoding: Opus (high fidelity)
   - Sample rate: 16kHz
   - Features: Smart formatting, punctuation, diarization, interim results
   - Endpointing: 300ms silence detection

3. **PHI Redaction** (HIPAA Compliance):
   ```
   - Email addresses → [REDACTED]
   - SSN (xxx-xx-xxxx) → [REDACTED]
   - Phone numbers → [REDACTED]
   - Common PHI lines (MRN, Patient, Address, DOB) → [REDACTED]
   ```

4. **Periodic Claude Analysis** (Every 10 seconds):
   - Uses Claude Sonnet 4.5 (revenue-critical accuracy)
   - Analyzes de-identified transcripts
   - Generates:
     - SOAP Note (Subjective, Objective, Assessment, Plan)
     - Billing Codes (CPT, ICD-10, HCPCS)
     - HPI (History of Present Illness)
     - ROS (Review of Systems)
     - Conversational coaching suggestions
   - Cost: ~$0.003 per 1K input + $0.015 per 1K output tokens

5. **Conversational AI Features**:
   - Loads provider-specific preferences
   - Personalizes interaction style (formality_level, humor_level, etc.)
   - Tracks interaction count for relationship building
   - Analyzes time of day (morning/afternoon/evening/night)

6. **Learning Integration**:
   - Saves to `scribe_interaction_history`
   - Calls RPC `learn_from_interaction` for ML training
   - Tracks provider preferences evolution
   - Records suggestion acceptance/rejection

**Audit Logging** (HIPAA):
All calls logged to `claude_api_audit` table with:
- request_id (UUID)
- user_id
- request_type: 'transcription'
- model: 'claude-sonnet-4-5-20250929'
- input/output tokens
- cost calculation
- response_time_ms
- success/error_code
- phi_scrubbed: true

**Response Format** (WebSocket):
```json
{
  "type": "code_suggestion",
  "conversational_note": "Brief friendly comment (1-2 sentences)",
  "codes": [
    {
      "code": "99214",
      "type": "CPT",
      "description": "Office/outpatient visit...",
      "reimbursement": 164.00,
      "confidence": 0.92,
      "reasoning": "...",
      "missingDocumentation": "..."
    }
  ],
  "revenueIncrease": 164.00,
  "complianceRisk": "low",
  "suggestions": ["..."],
  "soapNote": {
    "subjective": "...",
    "objective": "...",
    "assessment": "...",
    "plan": "...",
    "hpi": "...",
    "ros": "..."
  }
}
```

---

## 3. GUARDIAN AGENT IMPLEMENTATION

### 3.1 Guardian Agent Architecture
**Main File**: `src/services/guardian-agent/GuardianAgent.ts` (150+ lines)

**Core Concept**: Autonomous self-healing agent that monitors, detects, and fixes healthcare system issues without manual intervention.

**Architecture Components**:
1. **AgentBrain** - Cognitive engine for decision-making
2. **MonitoringSystem** - Continuous system surveillance
3. **SecurityScanner** - Security vulnerability detection
4. **HealingEngine** - Autonomous issue resolution
5. **LearningSystem** - ML-based pattern recognition
6. **ErrorSignatureLibrary** - Pre-defined error patterns

**Singleton Pattern**:
```typescript
const agent = GuardianAgent.getInstance({
  autoHealEnabled: true,
  requireApprovalForCritical: false,  // Fully autonomous
  maxConcurrentHealings: 5,
  learningEnabled: true,
  monitoringIntervalMs: 5000,
  securityScanIntervalMs: 60000,
  hipaaComplianceMode: true
});

agent.start();  // Begins continuous monitoring
```

**Configuration**:
- Auto-heal enabled by default
- No approval required for critical issues (FULLY AUTONOMOUS)
- Max 5 concurrent healing operations
- Learning from patterns enabled
- HIPAA compliance mode enforced
- Monitoring every 5 seconds
- Security scans every 60 seconds

### 3.2 Error Categories Detected
**File**: `src/services/guardian-agent/types.ts`

```
Type Mismatches         → Null reference errors
API Failures           → State corruption
Security Vulnerabilities → Performance degradation
Memory Leaks           → Database inconsistencies
Authentication Failures → Authorization breaches
PHI Exposure Risks     → Infinite loops
Race Conditions        → Deadlocks
Cascade Failures       → Dependency failures
Configuration Errors   → Network partitions
Data Corruption        → HIPAA violations
```

**Severity Levels**:
- Critical → Immediate auto-healing
- High → Auto-healing with logging
- Medium → Healing proposed for approval
- Low → Logged for review
- Info → Monitoring data

### 3.3 Healing Strategies
Available automated responses:

1. **retry_with_backoff** - Exponential backoff retry
2. **circuit_breaker** - Fail fast on cascade
3. **fallback_to_cache** - Use cached data
4. **graceful_degradation** - Reduce functionality
5. **state_rollback** - Revert to last known good state
6. **auto_patch** - Apply code fixes via PR
7. **dependency_isolation** - Isolate failing components
8. **resource_cleanup** - Free memory/connections
9. **configuration_reset** - Reset to defaults
10. **session_recovery** - Recover user sessions
11. **data_reconciliation** - Fix data inconsistencies
12. **security_lockdown** - Activate security mode
13. **emergency_shutdown** - Last resort shutdown

### 3.4 Guardian Agent Edge Function
**File**: `supabase/functions/guardian-agent/index.ts` (303 lines)

**Endpoints**:

1. **monitor** - Runs system monitoring checks
   - Detects failed login attempts (>5 in 1 hour → HIGH severity alert)
   - Checks database errors
   - Monitors unusual PHI access patterns (>50 records accessed → CRITICAL)
   - Detects slow queries (>1000ms → LOW severity)
   - Batch inserts alerts to `security_alerts` table

2. **record** - Guardian Eyes snapshot recording
   - Records system state snapshots
   - Creates immediate alerts for critical events
   - Logs to `guardian_eyes_recordings` table

3. **analyze** - Pattern analysis on recent recordings
   - Groups recordings by component
   - Detects repeated errors (>3 occurrences)
   - Identifies security anomalies

4. **heal** - Auto-healing execution
   - Retrieves alert from database
   - Executes healing action based on alert category
   - Clears cache for performance issues
   - Can block IPs for security issues
   - Restarts database connection pools
   - Updates alert status to 'resolved'

**Monitoring Checks**:
```
Query: auth_logs (event_type='login_failed', last 1 hour)
Query: system_errors (last 1 hour)
Query: phi_access_logs (last 1 hour)
RPC: get_slow_queries(threshold_ms: 1000)
```

### 3.5 Guardian Agent PR Service
**File**: `supabase/functions/guardian-pr-service/index.ts` (547 lines)

**Purpose**: Fully automated pull request creation for Guardian-detected issues.

**Workflow**:
1. Get base branch SHA from GitHub API
2. Create new branch from base (`guardian-agent/{issue-id}`)
3. Batch fetch file SHAs for updates/deletes
4. Create commits for each code change
5. Create PR with detailed description
6. Add labels (`guardian-agent`, `severity:{level}`, `auto-generated`)
7. Request reviews from specified users
8. Log to `audit_logs` table

**PR Description Template**:
```markdown
## Guardian Agent Auto-Fix
> This PR was automatically generated by the Guardian Agent.
> Please review carefully before merging.

### Issue Detected
- **Category**: [category]
- **Severity**: [critical/high/medium/low]
- **Description**: [issue]

### Affected Resources
- [resource list]

### Healing Action
- **Strategy**: [strategy]
- **Description**: [description]

### Changes Made
- `[operation]` [file_path]

### Testing Checklist
- [ ] Automated tests pass
- [ ] Manual testing completed
- [ ] No unintended side effects
- [ ] Security implications reviewed
```

**Audit Logging**:
All PR operations logged to `audit_logs`:
- `GUARDIAN_PR_CREATED` - Successful PR creation
- `GUARDIAN_PR_FAILED` - PR creation failure
- `GUARDIAN_PR_MERGED` - PR merged successfully

### 3.6 Guardian Agent API Edge Function
**File**: `supabase/functions/guardian-agent-api/index.ts` (232 lines)

**Actions**:

1. **security_scan** - Manual security scan
   - Logs to `audit_logs` (SECURITY_SCAN_INITIATED)
   - Returns scanId and timestamp

2. **audit_log** - Log custom events
   - event_type (required)
   - severity (optional, default MEDIUM)
   - description (required)
   - requires_investigation (optional)

3. **monitor_health** - System health check
   - Tests database connectivity
   - Checks API availability
   - Logs HEALTH_CHECK event
   - Returns status: 'healthy' or 'degraded'

---

## 4. AI-POWERED BILLING CODE SUGGESTIONS

### 4.1 Medical Coding Suggestion Edge Function
**File**: `supabase/functions/coding-suggest/index.ts` (293 lines)

**Purpose**: Uses Claude Sonnet 4.5 (revenue-critical model) to suggest accurate medical codes.

**Input De-identification**:
```
Patient names, SSN, dates, addresses, MRN, insurance ID → [REDACTED]
Age → Converted to bands (0-17, 18-29, 30-44, 45-64, 65+)
```

**Model**: Claude Sonnet 4.5 (best accuracy for revenue)
- Max tokens: 1024
- Temperature: Not specified (uses API default)
- Retry: 3 attempts with 500ms backoff
- Timeout: 45 seconds

**Coding Output**:
```json
{
  "cpt": [
    {
      "code": "99214",
      "modifiers": ["25"],
      "rationale": "Detailed history, detailed exam, moderate complexity MDM"
    }
  ],
  "hcpcs": [
    {
      "code": "J1234",
      "modifiers": [],
      "rationale": "Injectable medication"
    }
  ],
  "icd10": [
    {
      "code": "E11.65",
      "rationale": "Type 2 diabetes with hyperglycemia",
      "principal": true
    }
  ],
  "notes": "Document time spent counseling if >50% of visit",
  "confidence": 0.95
}
```

**HIPAA Audit Logging**:
- request_id (UUID)
- user_id
- request_type: 'medical_coding'
- model: 'claude-sonnet-4-5-20250929'
- input_tokens, output_tokens, cost
- response_time_ms
- success flag
- phi_scrubbed: true (always)
- metadata: encounter_id, confidence, code counts

**Cost Calculation**:
- Input: $3 per 1M tokens
- Output: $15 per 1M tokens
- Example: 500 input + 300 output tokens = ~$0.0065 cost

**Fallback Behavior**:
- JSON parse failures → Return minimal response with confidence: 10
- API errors → Return empty codes with error details
- Returns valid JSON always (never partial responses)

### 4.2 SDOH-Aware Coding Suggestion
**File**: `supabase/functions/sdoh-coding-suggest/index.ts` (457 lines)

**Purpose**: Enhanced medical coding focused on Social Determinants of Health (SDOH) and Chronic Care Management (CCM) billing.

**Context Analysis**:
1. Encounter data (diagnoses, procedures)
2. Patient demographics (age, chronic conditions)
3. Recent check-ins (housing, food security, transportation)
4. Existing SDOH assessments
5. Clinical notes

**SDOH Z-Codes Identified**:
- Z59.0: Homelessness
- Z59.1: Inadequate housing
- Z59.3: Food insecurity
- Z59.8: Transportation problems
- Z60.2: Social isolation
- Z59.6: Low income

**CCM Eligibility Tiers**:
- **Standard CCM (99490)**: 2+ chronic conditions, 20+ minutes
- **Complex CCM (99487)**: Multiple conditions + SDOH factors, 60+ minutes
- **Non-eligible**: Insufficient complexity

**Output Structure**:
```json
{
  "medicalCodes": {
    "icd10": [
      {
        "code": "E11.9",
        "rationale": "Type 2 diabetes without complications",
        "principal": true,
        "category": "medical"
      },
      {
        "code": "Z59.3",
        "rationale": "Food insecurity identified in check-in",
        "principal": false,
        "category": "sdoh"
      }
    ]
  },
  "procedureCodes": {
    "cpt": [
      {
        "code": "99490",
        "modifiers": [],
        "rationale": "Chronic care management - basic level",
        "timeRequired": 20,
        "sdohJustification": "Patient has 2 chronic conditions and housing concerns"
      }
    ]
  },
  "sdohAssessment": {
    "overallComplexityScore": 7,
    "ccmEligible": true,
    "ccmTier": "standard",
    "identifiedFactors": ["food insecurity", "housing instability"]
  },
  "ccmRecommendation": {
    "eligible": true,
    "tier": "standard",
    "justification": "...",
    "expectedReimbursement": 42.50,
    "requiredDocumentation": ["Time spent", "Problems addressed"]
  },
  "auditReadiness": {
    "score": 92,
    "missingElements": [],
    "recommendations": ["Add HPI length of time"]
  },
  "confidence": 0.92,
  "notes": "..."
}
```

**Processing**:
- Fetches encounter with related procedures, diagnoses, clinical notes
- Gets 5 most recent check-ins for SDOH analysis
- Queries SDOH assessments from patient record
- Calls Claude with comprehensive context
- Parses JSON response (handles markdown formatting)
- Validates and enhances output

**Audit Logging**:
- Logs to `claude_api_audit` (same as coding-suggest)
- Includes encounter_id, ccm_eligible, sdoh_factors_count

---

## 5. NATURAL LANGUAGE PROCESSING FOR CLINICAL NOTES

### 5.1 Clinical Note Processing
**Integrated with Real-Time Transcription** (realtime_medical_transcription/index.ts)

**Features**:
1. **SOAP Note Generation**:
   - Subjective: Chief complaint + HPI (OLDCARTS format)
   - Objective: Vital signs, physical exam, labs/imaging
   - Assessment: Diagnoses with clinical reasoning (includes ICD-10 codes)
   - Plan: Medications (with dosing), procedures, referrals, follow-up

2. **HPI (History of Present Illness)**:
   - OLDCARTS elements: Onset, Location, Duration, Character
   - Alleviating/Aggravating factors, Radiation, Timing, Severity
   - Narrative suitable for medical chart
   - 3-5 sentences, physician-style documentation

3. **ROS (Review of Systems)**:
   - Pertinent positive and negative findings
   - Format: "Constitutional: denies fever. Cardiovascular: endorses dyspnea."
   - 2-4 sentences

4. **Professional Terminology**:
   - Uses medical terminology appropriate for EHR
   - Physician-style documentation
   - EHR-ready quality
   - Concise yet thorough

**Prompt Template**:
```
You are an experienced medical scribe. Analyze encounter transcript and generate:
1. Complete SOAP Note - Professional EHR documentation
2. Billing Codes - Accurate CPT, ICD-10, HCPCS codes
3. Conversational Coaching - Helpful provider suggestions

REQUIREMENTS:
- SOAP note must be complete, professional, EHR-ready
- Use proper medical terminology and standard abbreviations
- Assessment must include ICD-10 diagnoses
- Plan must be specific (include doses, frequencies, quantities)
- HPI must address OLDCARTS when mentioned
- Be thorough but concise
- If transcript <50 words, generate minimal SOAP note
- Never make up clinical details not in transcript
```

---

## 6. RATE LIMITING & COST CONTROLS

### 6.1 Rate Limiter Implementation
**In claudeService.ts** (Lines 38-81)

```typescript
class RateLimiter {
  maxRequests: 60
  windowMs: 60000  // 1 minute
  
  canMakeRequest(userId: string): boolean
  getRemainingRequests(userId: string): number
  getResetTime(userId: string): Date
}
```

**Per-User Rate Limits**:
- 60 requests per 60-second window
- Tracked by user ID
- Old requests purged from tracking
- Returns remaining requests count
- Provides reset time

### 6.2 Cost Tracker Implementation
**In claudeService.ts** (Lines 84-165)

```typescript
class CostTracker {
  dailyLimit: $50 per user
  monthlyLimit: $500 per user
  
  calculateCost(model, inputTokens, outputTokens): number
  estimateCost(model, inputText, expectedOutputTokens): number
  canAffordRequest(userId, estimatedCost): boolean
  recordSpending(userId, cost): void
  getCostInfo(userId): CostInfo
  resetDailySpend(): void
  getSpendingSummary(): {totalDaily, totalMonthly, userCount}
}
```

**Model Pricing** (as of 2025):
| Model | Input (per 1K tokens) | Output (per 1K tokens) |
|-------|----------------------|------------------------|
| Haiku 4.5 | $0.0001 | $0.0005 |
| Sonnet 4.5 | $0.003 | $0.015 |
| Opus 4.1 | $0.015 | $0.075 |

**Budget Alerts**:
- Triggered at 80% monthly spend
- Logged via auditLogger
- Prevents overages at 100%

**Daily Reset**:
- Call `resetDailySpend()` via cron job
- Clears daily counters (monthly persists)

---

## 7. MODEL SELECTION LOGIC

### 7.1 Intelligent Model Router
**File**: `src/services/intelligentModelRouter.ts` (139 lines)

**Routing Strategy**:

1. **Haiku 4.5** (Fast, Cheap) for:
   - UI Personalization → Subsecond response
   - Usage Pattern Analysis → Real-time dashboards
   - Dashboard Prediction → ~$0.0001 per request
   - General Analytics → Expected response time: <500ms

2. **Sonnet 4.5** (Accurate, Premium) for:
   - Medical Billing → Money-critical accuracy
   - Revenue Optimization → Wrong codes = lost revenue
   - Claims Processing → Compliance-critical
   - CPT/ICD Coding → ~$0.005 per request
   - FHIR Analysis → Clinical accuracy matters
   - Risk Assessment → Lives depend on accuracy
   - Clinical Notes → Legal document
   - Medication Guidance → Safety-critical
   - Health Insights → Patient safety

3. **Opus 4.1** (Reserved):
   - Complex multi-step reasoning
   - Future use cases

**Cost Estimation for Daily Usage**:
```
Example: 1000 personalization + 100 billing + 50 clinical requests/day
- Haiku: 1000 × $0.0001 = $0.10/day
- Sonnet: 150 × $0.005 = $0.75/day
- Total: ~$0.85/day = ~$25/month per active user
```

**Request Type Mapping**:
```
RequestType.UI_PERSONALIZATION        → Haiku 4.5
RequestType.USAGE_PATTERN_ANALYSIS    → Haiku 4.5
RequestType.DASHBOARD_PREDICTION      → Haiku 4.5
RequestType.ANALYTICS                 → Haiku 4.5

RequestType.MEDICAL_BILLING           → Sonnet 4.5
RequestType.REVENUE_OPTIMIZATION      → Sonnet 4.5
RequestType.CLAIMS_PROCESSING         → Sonnet 4.5
RequestType.CPT_ICD_CODING            → Sonnet 4.5

RequestType.FHIR_ANALYSIS            → Sonnet 4.5
RequestType.RISK_ASSESSMENT          → Sonnet 4.5
RequestType.CLINICAL_NOTES           → Sonnet 4.5
RequestType.MEDICATION_GUIDANCE      → Sonnet 4.5
RequestType.HEALTH_INSIGHTS          → Sonnet 4.5
```

---

## 8. AI PERSONALIZATION & DASHBOARDS

### 8.1 Dashboard Personalization AI Service
**File**: `src/services/dashboardPersonalizationAI.ts` (422 lines)

**Purpose**: Uses Claude Haiku 4.5 to analyze user behavior and intelligently personalize admin dashboard layout.

**User Behavior Tracking**:
- Track section opens (section ID, name, action, timestamp, role)
- Frequency score (% of total opens)
- Top 5 most-used sections in last 30 days
- Usage patterns by time of day

**AI Analysis Prompt**:
```
Predict what this {role} user will need RIGHT NOW based on:
- Current time (morning/afternoon/evening)
- Top 5 most-used sections (with frequency %)
- Open count history

Provide:
1. What section they'll probably open first
2. What workflow they're likely doing
3. Time-based patterns
4. Format: JSON with predictions, workflow_suggestion, time_based_tip
```

**Personalization Output**:
```json
{
  "topSections": ["section-1", "section-2", "section-3"],
  "collapsedSections": ["section-4", "section-5"],
  "quickActions": ["action-1", "action-2"],
  "welcomeMessage": "Good afternoon! You usually start with patient engagement.",
  "suggestions": [
    "You frequently use: Patient Engagement",
    "Common workflow: Patient Engagement → Patient Handoff",
    "Morning users typically check patient engagement first"
  ]
}
```

**HIPAA Compliance**:
1. **PHI Sanitization**:
   - Section names must be de-identified
   - Rejects names containing:
     - Email addresses
     - SSN patterns
     - Phone numbers
     - Patient names ("Patient: John")
     - Professional titles ("Dr. Smith")

2. **Audit Logging** (claude_usage_logs):
   - user_id
   - request_id (UUID)
   - request_type: 'dashboard_prediction'
   - model: 'claude-haiku-4-5'
   - input_tokens, output_tokens
   - cost: calculated
   - response_time_ms
   - success: true/false
   - error_message (if failed)

**Cost Calculation**:
- Haiku input: $0.25 per 1M tokens
- Haiku output: $1.25 per 1M tokens
- Typical call: ~100 input + 200 output = ~$0.00035

**Default Layouts** (Fallback):
- Admin: Patient engagement, user management primary sections
- Billing staff: Revenue dashboard, claims submission, billing
- Nurse: Patient engagement, patient handoff

### 8.2 Claude Personalization Edge Function
**File**: `supabase/functions/claude-personalization/index.ts` (206 lines)

**Purpose**: Server-side personalization prompt execution with HIPAA compliance.

**Features**:
1. Scrubs PHI from prompts before sending to Claude
2. Logs usage to `claude_usage_logs` table
3. Calculates costs dynamically
4. Returns content + model + usage + responseTime

**HIPAA PHI Redaction** (Consistent):
- Emails, phones, SSN → [REDACTED]
- Addresses → [ADDRESS]
- Dates → [DATE]
- Patient identifiers → [REDACTED]

**Cost Calculation**:
```
Haiku: $0.80 per 1M input + $4.00 per 1M output
Sonnet: $3.00 per 1M input + $15.00 per 1M output
```

**Error Handling**:
- Missing fields → 400 (bad request)
- Missing ANTHROPIC_API_KEY → 500 (server error)
- Claude API errors → Logged and returned
- Detailed error response with hint for debugging

---

## 9. INTEGRATION SUMMARY

### 9.1 Request Flow Example: Patient Health Guidance

```
Senior Patient Question
    ↓
claudeService.generateSeniorHealthGuidance(question, context)
    ↓
Validate environment + API key
    ↓
Rate limit check (60/min per user)
    ↓
Select model → Haiku 4.5 (fast, cheap)
    ↓
Cost estimation: ~$0.0002
    ↓
Budget check: Can afford? ($50 daily limit)
    ↓
Create prompt with health context
    ↓
Circuit breaker → Call Claude API
    ↓
Parse response + calculate actual cost
    ↓
Record spending
    ↓
Return response with token usage + cost
```

### 9.2 Request Flow Example: Medical Billing Code Suggestion

```
Provider Encounter Data
    ↓
coding-suggest Edge Function
    ↓
Validate encounter.id
    ↓
Deep de-identify encounter data
    ↓
Convert DOB → age band
    ↓
Call Claude Sonnet 4.5 API
    ↓
Parse JSON response (with retry logic)
    ↓
Log to claude_api_audit (HIPAA audit)
    ↓
Calculate cost: $3K input + $15K output per 1M tokens
    ↓
Insert to coding_audits table (legacy)
    ↓
Return: CPT, HCPCS, ICD-10, confidence, notes
```

### 9.3 Request Flow Example: Real-Time SOAP Note Generation

```
Patient → Provider's Microphone
    ↓
Browser: WebSocket (WSS) with JWT access_token
    ↓
realtime_medical_transcription Edge Function
    ↓
Validate token + upgrade to WebSocket
    ↓
Open connection to Deepgram (nova-2-medical)
    ↓
Browser → Deepgram: Stream audio
    ↓
Deepgram → Edge Function: Interim + final transcripts
    ↓
Edge Function → Browser: Display interim transcripts
    ↓
Every 10 seconds: Analyze accumulated transcript
    ↓
De-identify transcript (remove PHI)
    ↓
Call Claude Sonnet 4.5 (conversational prompt)
    ↓
Sonnet returns SOAP note + codes + suggestions (JSON)
    ↓
Log to claude_api_audit (HIPAA)
    ↓
Browser WebSocket: Send code suggestions + SOAP note
    ↓
Browser: Display to provider in real-time
```

---

## 10. SECURITY & COMPLIANCE

### 10.1 HIPAA Compliance Measures

1. **PHI De-identification** (Defensive):
   - Client-side: Section name sanitization
   - Edge Functions: Deep de-identification before Claude
   - Consistent regex patterns across services
   - Age bands instead of full DOB

2. **Audit Logging** (Mandatory):
   - Every Claude API call logged to database
   - Includes: user_id, request_type, model, tokens, cost, response_time
   - Success/failure tracking
   - Error codes and messages
   - PHI scrubbed flag (always true)
   - Request ID for traceability

3. **Access Control**:
   - Edge Functions verify JWT access tokens
   - Supabase RLS (Row Level Security) on audit tables
   - User-specific data filtering

4. **Encryption**:
   - HTTPS/WSS for all communications
   - API keys in Supabase secrets (not in code)
   - Supabase connection uses service keys for backend

### 10.2 Error Safety

1. **Circuit Breaker**:
   - Opens after 5 consecutive failures
   - Prevents cascade failures
   - 60-second timeout before retry

2. **Rate Limiting**:
   - Per-user 60 req/min prevents abuse
   - Budget limits prevent runaway costs

3. **Graceful Degradation**:
   - AI unavailable → Return sensible defaults
   - Translation cache failure → Return NULL (non-fatal)
   - Personalization failure → Return default layout

4. **Retry Logic**:
   - Medical coding: 3 retries with backoff
   - SDOH coding: Implicit via API error handling
   - Transcription: Implicit WebSocket reliability

---

## 11. CONFIGURATION & ENVIRONMENT

### Required Environment Variables

```bash
# Anthropic
REACT_APP_ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_API_KEY=sk-ant-...  # Edge Functions

# Deepgram (Medical Transcription)
DEEPGRAM_API_KEY=...

# Supabase
REACT_APP_SUPABASE_URL=https://...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=eyJh...
SUPABASE_ANON_KEY=eyJh...

# GitHub (Guardian PR Service)
GITHUB_TOKEN=ghp_...
GITHUB_OWNER=your-org
GITHUB_REPO=wellfit-community

# Timeouts
REACT_APP_CLAUDE_TIMEOUT=30000  # 30 seconds
```

---

## 12. PERFORMANCE CHARACTERISTICS

### Expected Response Times
| Operation | Model | Time | Cost |
|-----------|-------|------|------|
| Health question | Haiku 4.5 | <1s | <$0.0002 |
| Dashboard personalization | Haiku 4.5 | <500ms | <$0.0004 |
| Medical coding | Sonnet 4.5 | 2-5s | $0.005-0.010 |
| SDOH analysis | Sonnet 4.5 | 3-8s | $0.010-0.020 |
| SOAP generation | Sonnet 4.5 | 2-4s | $0.005-0.015 |
| Translation | Haiku 4.5 | <500ms | <$0.0005 |

### Daily Cost Estimates (100 active users)
- 500 personalization calls: $0.05
- 100 health questions: $0.02
- 50 billing suggestions: $0.25
- 20 SOAP notes: $0.15
- 30 SDOH analyses: $0.45
- **Daily Total: ~$0.92/100 users = $0.0092/user/day**
- **Monthly: ~$0.27/user**

---

## 13. KEY TAKEAWAYS

1. **Multi-Model Strategy**: Haiku for speed/cost, Sonnet for accuracy, Opus reserved
2. **Real-Time AI**: Medical transcription with 10-second analysis windows
3. **Fully Autonomous Healing**: Guardian Agent requires no human approval
4. **Revenue-Focused**: Billing codes use highest-accuracy model
5. **HIPAA-First Design**: All PHI handling server-side, aggressive de-identification
6. **Cost-Conscious**: Budget limits, rate limiting, smart model selection
7. **Learning-Capable**: Systems track interactions for continuous improvement
8. **Production-Ready**: Circuit breakers, retries, comprehensive error handling

