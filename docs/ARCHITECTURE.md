# WellFit-Community-Daily-Complete: Unified Architecture Document

> **Version:** 1.0.0
> **Last Updated:** January 2026
> **Maintainer:** Envision VirtualEdge Group

---

## Table of Contents

1. [Executive Overview](#1-executive-overview)
2. [Directory Structure](#2-directory-structure)
3. [Core Architecture Patterns](#3-core-architecture-patterns)
4. [Component Architecture](#4-component-architecture)
5. [Service Layer](#5-service-layer)
6. [State Management](#6-state-management)
7. [Database Architecture](#7-database-architecture)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [AI Service Integration](#9-ai-service-integration)
10. [Security & HIPAA Compliance](#10-security--hipaa-compliance)
11. [Multi-Tenancy](#11-multi-tenancy)
12. [Design System](#12-design-system)
13. [API & Integrations](#13-api--integrations)
14. [Build & Deployment](#14-build--deployment)
15. [Testing Strategy](#15-testing-strategy)
16. [Feature Modules](#16-feature-modules)
17. [Technology Stack](#17-technology-stack)
18. [Guardian Agent & Guardian Eyes](#18-guardian-agent--guardian-eyes)
19. [BLE & Remote Patient Monitoring](#19-ble--remote-patient-monitoring)
20. [Dual PHI Encryption Systems](#20-dual-phi-encryption-systems)

---

## 1. Executive Overview

### 1.1 Project Identity

| Attribute | Value |
|-----------|-------|
| **Project Name** | WellFit-Community-Daily-Complete |
| **Type** | White-label multi-tenant SaaS healthcare application |
| **Architecture** | React 19 + Vite + TypeScript + Supabase (PostgreSQL 17) |
| **Target Users** | Seniors, caregivers, healthcare providers, clinicians |

### 1.2 Dual Product Architecture

This codebase contains **two separate white-label products**:

| Product | Purpose | Users |
|---------|---------|-------|
| **WellFit** | Community engagement platform | Seniors, caregivers, community organizations |
| **Envision Atlus** | Clinical care management engine | Healthcare providers, clinicians, case managers |

**Deployment Options:**
- WellFit Only (license code `9xxx`)
- Envision Atlus Only (license code `8xxx`)
- Both Together (license code `0xxx`)

### 1.3 Key Metrics

| Metric | Value |
|--------|-------|
| Test Suites | 138 |
| Total Tests | 3,101 |
| Service Modules | 118 |
| Edge Functions | 117 |
| AI Skills | 77+ |
| Components | 60+ feature modules |

---

## 2. Directory Structure

### 2.1 Root Layout

```
/workspaces/WellFit-Community-Daily-Complete/
├── src/                    # Application source code
├── supabase/               # Database & Edge Functions
├── docs/                   # Feature documentation
├── public/                 # Static assets
├── package.json            # Dependencies
├── vite.config.ts          # Build configuration
├── tsconfig.json           # TypeScript configuration
└── CLAUDE.md              # Development standards (CRITICAL)
```

### 2.2 Source Directory (`src/`)

| Directory | Purpose |
|-----------|---------|
| `components/` | React UI components (60+ feature modules) |
| `services/` | Business logic layer (118 services) |
| `contexts/` | React Context providers (9 contexts) |
| `hooks/` | Custom React hooks (20+ hooks) |
| `lib/` | Core libraries (Supabase client, auth) |
| `pages/` | Route-level page components |
| `routes/` | Routing configuration |
| `types/` | TypeScript type definitions (20+ files) |
| `utils/` | Utility functions |
| `adapters/` | External service adapters |
| `config/` | Application configuration |
| `theme/` | Envision Atlus design tokens |
| `i18n/` | Internationalization |
| `test-utils/` | Testing utilities |

### 2.3 Supabase Directory

| Directory | Purpose |
|-----------|---------|
| `functions/` | 117 Deno Edge Functions |
| `functions/ai-*` | 77+ Claude-powered AI skills |
| `functions/_shared/` | Shared utilities (CORS, auth) |
| `migrations/` | PostgreSQL schema migrations |

---

## 3. Core Architecture Patterns

### 3.1 Application Initialization

```
Entry Point: src/index.tsx

Initialization Stack:
┌─────────────────────────────────┐
│  validateOrFail()               │ ← Environment validation
├─────────────────────────────────┤
│  AuthProvider                   │ ← User authentication
├─────────────────────────────────┤
│  AdminAuthProvider              │ ← Admin authentication
├─────────────────────────────────┤
│  LanguageProvider               │ ← i18n context
├─────────────────────────────────┤
│  DemoModeProvider               │ ← Demo mode toggle
├─────────────────────────────────┤
│  QueryClientProvider            │ ← React Query
├─────────────────────────────────┤
│  ErrorBoundary                  │ ← Global error handling
├─────────────────────────────────┤
│  RouterProvider                 │ ← React Router v7
└─────────────────────────────────┘
```

### 3.2 Application Shell (`App.tsx`)

The Shell component orchestrates:

1. **Performance Monitoring** - App performance metrics
2. **Guardian Agent** - Self-healing system monitoring
3. **Branding System** - Dynamic tenant branding
4. **Theme Initialization** - Light/dark mode
5. **Browser History Protection** - Auth route guards
6. **Idle Timeout** - 15-minute HIPAA logout
7. **Offline Indicator** - Network status

### 3.3 Routing Architecture

**File:** `src/routes/routeConfig.ts`

**Route Categories:**

| Category | Auth Required | Example Routes |
|----------|--------------|----------------|
| `public` | None | `/login`, `/register`, `/terms` |
| `protected` | User | `/dashboard`, `/health`, `/activities` |
| `admin` | Admin | `/admin/*` |
| `superAdmin` | Super Admin | `/super-admin/*` |
| `clinical` | Clinical Staff | `/clinical/*`, `/physician/*` |
| `caregiver` | PIN-based | `/caregiver/*` |

**Route Configuration Pattern:**

```typescript
interface RouteConfig {
  path: string;
  component: string;           // Lazy import key
  auth?: 'none' | 'user' | 'admin' | 'superAdmin';
  roles?: string[];            // Required roles
  featureFlag?: string;        // Feature gate
  category: RouteCategory;
}
```

**Code Splitting:** All routes use `React.lazy()` for on-demand loading.

---

## 4. Component Architecture

### 4.1 Feature-Based Organization

```
src/components/
├── admin/                 # Admin dashboards
├── auth/                  # Authentication UI
├── billing/               # Financial components
├── careCoordination/      # Care team coordination
├── clinical/              # Clinical staff dashboards
├── envision-atlus/        # Design system (19 components)
├── guardian/              # Guardian Agent UI
├── layout/                # Header, footer, nav
├── patient/               # Patient-facing features
├── patient-avatar/        # Avatar visualization
├── physician/             # Physician UI
├── nurse/                 # Nurse dashboards
├── ui/                    # Base UI components
├── voice/                 # Voice command UI
└── [40+ more modules]
```

### 4.2 Component File Pattern

```
ComponentName/
├── ComponentName.tsx          # Main component
├── ComponentName.types.ts     # TypeScript interfaces (optional)
└── __tests__/
    └── ComponentName.test.tsx # Tests (REQUIRED)
```

### 4.3 Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `PatientDashboard.tsx` |
| Hooks | camelCase + `use` prefix | `usePatientData.ts` |
| Services | camelCase + `Service` suffix | `patientService.ts` |
| Types | PascalCase | `PatientTypes.ts` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRIES` |

---

## 5. Service Layer

### 5.1 ServiceResult Pattern

**File:** `src/services/_base/ServiceResult.ts`

All services return a standardized result:

```typescript
type ServiceResult<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: ServiceError }

// Usage
async function getPatient(id: string): Promise<ServiceResult<Patient>> {
  try {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return failure('DATABASE_ERROR', error.message);
    return success(data);
  } catch (err: unknown) {
    return failure('UNKNOWN_ERROR', 'Failed to get patient', err);
  }
}
```

### 5.2 Service Categories

| Category | Count | Key Services |
|----------|-------|--------------|
| AI/Claude | 8+ | `claudeService`, `claudeCareAssistant`, `aiTransparencyService` |
| Authentication | 4+ | `authService`, `loginSecurityService`, `passkeyService` |
| Clinical | 15+ | `diagnoseService`, `medicationService`, `soapNoteService` |
| Care Coordination | 8+ | `careCoordinationService`, `handoffService`, `referralService` |
| Billing | 6+ | `billingService`, `feeScheduleService`, `unifiedBillingService` |
| FHIR | 8+ | `fhirMappingService`, `fhirResourceService` |
| Patient | 8+ | `patientService`, `patientAvatarService` |
| Wearables | 4+ | `wearableService`, device adapters |

### 5.3 Core Services

| Service | Purpose |
|---------|---------|
| `auditLogger.ts` | HIPAA-compliant audit logging |
| `errorReporter.ts` | Centralized error tracking |
| `performanceMonitoring.ts` | Performance metrics |
| `tenantDetection.ts` | Multi-tenant identification |
| `tenantBrandingService.ts` | Tenant-specific branding |

---

## 6. State Management

### 6.1 State Management Strategy

```
┌────────────────────────────────────────────────┐
│              React Context API                  │
│  (Auth, Admin, Patient, Branding, Language)    │
├────────────────────────────────────────────────┤
│           TanStack React Query                  │
│       (Server state, caching, mutations)       │
├────────────────────────────────────────────────┤
│              Local Storage                      │
│       (Persistence, user preferences)          │
└────────────────────────────────────────────────┘
```

### 6.2 Context Providers

| Context | Purpose | Key Data |
|---------|---------|----------|
| `AuthContext` | User authentication | Session, user, admin status |
| `AdminAuthContext` | Admin authentication | Admin session, PIN, roles |
| `PatientContext` | Selected patient | Patient ID, demographics |
| `BrandingContext` | Tenant branding | Logo, colors, app name |
| `LanguageContext` | Internationalization | Language, translations |
| `DemoModeContext` | Demo mode | Demo enabled flag |
| `SessionTimeoutContext` | Session timeout | Remaining time, warning |
| `VoiceActionContext` | Voice commands | Listening status |

### 6.3 React Query Configuration

**File:** `src/lib/queryClient.ts`

```typescript
// Default configuration
staleTime: 5 minutes
gcTime: 10 minutes
retry: 2 attempts (exponential backoff, max 30s)
refetchOnWindowFocus: true

// Cache time presets
cacheTime.realtime = 30 seconds    // Vitals, real-time data
cacheTime.frequent = 5 minutes     // Frequently updated
cacheTime.stable = 10 minutes      // Stable metadata
cacheTime.static = 1 hour          // Reference data
cacheTime.never = 0                // PHI, sensitive data
```

---

## 7. Database Architecture

### 7.1 Technology Stack

| Component | Technology |
|-----------|-----------|
| Database | PostgreSQL 17 |
| Platform | Supabase |
| Security | Row-Level Security (RLS) |
| Real-time | Supabase Realtime |
| Search | Full-text search |

### 7.2 Core Tables (100+)

| Table | Purpose |
|-------|---------|
| `auth.users` | Supabase authentication |
| `profiles` | Extended user profiles |
| `patients` | Patient demographics |
| `encounters` | Clinical encounters |
| `fhir_observations` | Vitals and labs |
| `fhir_conditions` | Diagnoses |
| `fhir_medication_requests` | Medications |
| `care_plans` | AI-generated care plans |
| `audit_logs` | HIPAA audit trail |
| `ai_skills` | AI skill registry |

### 7.3 RLS Pattern

```sql
-- Users see only their own data
CREATE POLICY user_isolation ON patient_data
  FOR SELECT USING (auth.uid() = user_id);

-- Tenant isolation
CREATE POLICY tenant_isolation ON clinical_data
  FOR ALL USING (tenant_id = current_setting('app.tenant_id'));
```

### 7.4 Migration Workflow

```bash
# Create migration
npm run db:new-migration

# Apply to remote
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push
```

---

## 8. Authentication & Authorization

### 8.1 Authentication Methods

| Method | Use Case | Implementation |
|--------|----------|----------------|
| Email/Password | Admin/provider login | Supabase Auth |
| Phone OTP | Senior/staff login | SMS via Twilio |
| Passkey | Biometric auth | WebAuthn/FIDO2 |
| Admin PIN | Quick admin access | 4-6 digit PIN |

### 8.2 Session Management

```typescript
// Storage: localStorage (survives navigation)
// JWT: Managed by Supabase SDK
// Server expiry: 30-minute refresh window
// Client timeout: 15 minutes (HIPAA)
```

### 8.3 Permission Model

```
┌─────────────────────────────────────────┐
│           Module Access Check           │
│  useModuleAccess(moduleName)            │
├─────────────────────────────────────────┤
│  isEntitled → Organization paid for it  │
│  isEnabled  → Admin turned it on        │
│  hasAccess  → Both entitled AND enabled │
└─────────────────────────────────────────┘
```

### 8.4 Role Hierarchy

```
super_admin
    └── admin
        ├── physician
        ├── nurse
        ├── case_manager
        ├── community_health_worker
        └── caregiver (PIN-based)
```

---

## 9. AI Service Integration

### 9.1 Overview

- **77+ AI Skills** powered by Claude (Anthropic)
- Edge Functions for server-side AI processing
- Cost tracking and budget management
- Intelligent model routing

### 9.2 Model Selection

| Model | Use Case | Cost (per 1K tokens) |
|-------|----------|---------------------|
| Haiku 3.5 | Fast tasks, UI personalization | $0.0001 / $0.0005 |
| Sonnet 4.5 | Balanced accuracy/cost | $0.003 / $0.015 |
| Opus 4.5 | Critical decisions | $0.015 / $0.075 |

### 9.3 AI Skill Categories

| Category | Count | Examples |
|----------|-------|----------|
| Patient Education | 5+ | Care plans, medication instructions |
| Prediction | 8+ | Fall risk, readmission, adherence |
| Documentation | 7+ | SOAP notes, discharge summaries |
| Reconciliation | 3+ | Medication reconciliation |
| Detection | 5+ | Contraindications, anomalies |
| Analysis | 4+ | Chat summarization |

### 9.4 Edge Function Pattern

```typescript
// supabase/functions/ai-care-plan-generator/index.ts
serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions(req);

  const { patientId, planType } = await req.json();

  // Fetch patient data
  const { data: conditions } = await supabase
    .from('fhir_conditions')
    .select('*')
    .eq('patient_id', patientId);

  // Call Claude
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    messages: [{ role: 'user', content: prompt }]
  });

  // Save result
  await supabase.from('care_plans').insert(carePlan);

  return new Response(JSON.stringify(result), {
    headers: corsHeaders
  });
});
```

### 9.5 Cost Management

```typescript
// Daily budget: $25/user
// Monthly budget: $350/user
// Warnings at 80%, 90% thresholds
// Rate limiting: 60 requests/min/user
```

---

## 10. Security & HIPAA Compliance

### 10.1 HIPAA Requirements

| Requirement | Implementation |
|-------------|----------------|
| No client-side PHI | All PHI server-side only |
| Audit logging | All PHI access logged |
| Session timeout | 15-minute inactivity logout |
| Data isolation | Row-Level Security (RLS) |
| Encryption | TLS + PHI encryption utilities |

### 10.2 Audit Logging

**File:** `src/services/auditLogger.ts`

```typescript
// Audit categories
auditLogger.auth('LOGIN_SUCCESS', true, { userId });
auditLogger.phi('PATIENT_RECORD_ACCESSED', { patientId });
auditLogger.clinical('CARE_PLAN_CREATED', { planId });
auditLogger.error('OPERATION_FAILED', error);
```

### 10.3 Input Validation

| File | Purpose |
|------|---------|
| `inputValidator.ts` | General input validation |
| `passwordValidator.ts` | Password policies |
| `phoneValidator.ts` | Phone number validation |
| `sanitize.ts` | XSS prevention |

---

## 11. Multi-Tenancy

### 11.1 Tenant Detection

**File:** `src/services/tenantDetection.ts`

```
Hostname → Tenant Mapping:
houston.thewellfitcommunity.org → "houston"
miami.thewellfitcommunity.org   → "miami"
localhost                       → default (WellFit)
```

### 11.2 Branding Configuration

```typescript
interface BrandingConfig {
  appName: string;        // "WellFit Houston"
  logoUrl: string;        // Tenant logo
  primaryColor: string;   // Brand color
  secondaryColor: string; // Accent color
  gradient: string;       // CSS gradient
  customFooter?: string;  // Optional footer
}
```

### 11.3 Tenant ID Convention

```
Format: {ORG}-{LICENSE}{SEQUENCE}

License Codes:
  0xxx → Both products (WellFit + Envision Atlus)
  8xxx → Envision Atlus only
  9xxx → WellFit only

Example: VG-0002 (VirtualEdge Group, both products, #2)
```

---

## 12. Design System

### 12.1 Envision Atlus Components

**Location:** `src/components/envision-atlus/`

| Component | Purpose |
|-----------|---------|
| `EACard` | Container/panel |
| `EAButton` | Styled buttons |
| `EABadge` | Status indicators |
| `EAMetricCard` | KPI displays |
| `EAAlert` | Notifications |
| `EATabs` | Tab navigation |
| `EARiskIndicator` | Risk level displays |
| `EAPageLayout` | Page wrapper |
| `EAPatientBanner` | Patient display |
| `EABreadcrumbs` | Navigation |

### 12.2 Theme Colors

```css
--ea-primary: #00857a;       /* Teal */
--ea-primary-light: #33bfb7;
--ea-background: slate-900;
--ea-surface: slate-800;
```

### 12.3 Accessibility Standards

- **WCAG 2.1 AA** compliance
- **Minimum font:** 16px (prefer 18px+)
- **Touch targets:** 44x44px minimum
- **Contrast ratio:** 4.5:1 minimum
- **Keyboard navigation** fully supported

---

## 13. API & Integrations

### 13.1 Supabase Client

**File:** `src/lib/supabaseClient.ts`

```typescript
const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: localStorage,
  },
});
```

### 13.2 FHIR R4 Integration

**Supported Resources:**
- Patient, Observation, Condition
- Medication, MedicationRequest
- CarePlan, Encounter
- AllergyIntolerance, Procedure
- DiagnosticReport, Immunization, Goal

**Services:**
- `fhirResourceService.ts`
- `fhirMappingService.ts`
- `fhirQuestionnaireService.ts`

### 13.3 HL7 Integration

- HL7 v2 message parsing
- X12 transaction support
- Edge functions for receive/send

### 13.4 SMART on FHIR

- OAuth 2.0 authorization flow
- Token management
- EHR launch context

### 13.5 Telehealth (Daily.co)

- Video room creation
- Patient token generation
- Appointment notifications

### 13.6 Wearable Adapters

| Platform | Adapter File |
|----------|--------------|
| Apple Health | `appleHealthAdapter.ts` |
| Fitbit | `fitbitAdapter.ts` |
| Garmin | `garminAdapter.ts` |
| Samsung Health | `samsungHealthAdapter.ts` |
| Oura Ring | `ouraAdapter.ts` |

---

## 14. Build & Deployment

### 14.1 Build Configuration

**Build Tool:** Vite 7.3.0

**Bundle Strategy:**
```typescript
// Vendor chunking for optimal caching
vendor-react     // React, ReactDOM
vendor-router    // React Router
vendor-supabase  // Supabase client
vendor-tanstack  // TanStack Query
vendor-forms     // react-hook-form, Zod
vendor-ui        // lucide-react, framer-motion
vendor-ai        // Anthropic SDK
```

### 14.2 Commands

```bash
# Development
npm run dev           # Start dev server (port 3000)

# Build
npm run build         # Production build
npm run preview       # Preview production

# Quality
npm run lint          # ESLint check
npm run typecheck     # TypeScript check
npm test              # Run all tests
```

### 14.3 Environment Variables

```env
VITE_SUPABASE_URL=<supabase-url>
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_ANTHROPIC_API_KEY=<claude-key>
VITE_HCAPTCHA_SITE_KEY=<hcaptcha-key>
```

---

## 15. Testing Strategy

### 15.1 Test Framework

| Tool | Purpose |
|------|---------|
| Vitest | Test runner |
| React Testing Library | Component testing |
| MSW | API mocking |

### 15.2 Test Coverage

| Metric | Value |
|--------|-------|
| Test Suites | 138 |
| Total Tests | 3,101 |
| Pass Rate | 100% (required) |

### 15.3 Test Organization

```
src/__tests__/
├── integration/    # API integration tests
├── smoke/         # Smoke tests
└── security/      # Security tests

src/components/*/__tests__/
└── ComponentName.test.tsx
```

### 15.4 Test Commands

```bash
npm test                # All tests
npm run test:unit       # Unit tests
npm run test:integration # Integration tests
npm run test:coverage   # Coverage report
```

---

## 16. Feature Modules

### 16.1 Core Features

| Feature | Route | Description |
|---------|-------|-------------|
| Dashboard | `/dashboard` | Main user dashboard |
| Health Records | `/health/*` | Vitals, conditions, medications |
| Care Coordination | `/care-coordination` | Team coordination |
| Questionnaires | `/questionnaire-analytics` | SMART questionnaires |
| Referrals | `/referrals` | Referral management |

### 16.2 Clinical Features

| Feature | Route | Description |
|---------|-------|-------------|
| Physician Dashboard | `/physician` | Physician workflow |
| Nurse Dashboard | `/nurse` | Nurse workflow |
| Care Plans | `/care-plans` | AI care plans |
| SOAP Notes | `/soap-notes` | Clinical documentation |

### 16.3 Specialty Modules

| Feature | Route | Description |
|---------|-------|-------------|
| NeuroSuite | `/neuro-suite` | Stroke, Dementia, Parkinson's |
| Physical Therapy | `/physical-therapy` | PT assessments |
| Mental Health | `/mental-health` | Behavioral health |
| Dental Health | `/dental-health` | Dental care |

### 16.4 Admin Features

| Feature | Route | Description |
|---------|-------|-------------|
| Admin Dashboard | `/admin` | Admin overview |
| User Management | `/admin/users` | User administration |
| Billing | `/admin/billing` | Revenue management |
| FHIR Dashboard | `/admin/fhir` | FHIR integration |

---

## 17. Technology Stack

### 17.1 Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19 | UI framework |
| Vite | 7.3.0 | Build tool |
| TypeScript | 5.6.3 | Type safety |
| Tailwind CSS | 4.1.18 | Styling |
| React Router | 7.11.0 | Routing |
| TanStack Query | 5.x | Data fetching |

### 17.2 Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Supabase | - | BaaS platform |
| PostgreSQL | 17 | Database |
| Deno | - | Edge functions |

### 17.3 Integrations

| Technology | Purpose |
|------------|---------|
| Anthropic Claude | AI services |
| Daily.co | Video telehealth |
| Twilio | SMS/voice |
| Firebase | Push notifications |

---

## 18. Guardian Agent & Guardian Eyes

### 18.1 Overview

The Guardian Agent is a **production-grade autonomous self-healing system** designed for HIPAA/SOC 2 healthcare environments. It provides continuous monitoring, automatic issue detection, and intelligent remediation.

**Location:** `src/services/guardian-agent/`

### 18.2 Core Components

| Component | File | Purpose |
|-----------|------|---------|
| **Agent Brain** | `AgentBrain.ts` | Core AI decision engine with pattern recognition |
| **Monitoring System** | `MonitoringSystem.ts` | Real-time health monitoring (5-second intervals) |
| **Healing Engine** | `HealingEngine.ts` | Executes 13 distinct healing strategies |
| **Security Scanner** | `SecurityScanner.ts` | Proactive vulnerability detection |
| **Learning System** | `LearningSystem.ts` | Adaptive ML for pattern optimization |
| **Error Signature Library** | `ErrorSignatureLibrary.ts` | 30+ healthcare-specific error signatures |

### 18.3 Monitoring Capabilities

```
┌─────────────────────────────────────────────────┐
│           GUARDIAN EYES MONITORING              │
├─────────────────────────────────────────────────┤
│  Performance Observer  │ Slow ops, navigation   │
│  Error Monitoring      │ Global errors, promises│
│  API Monitoring        │ Fetch proxy intercept  │
│  Health Checks         │ Memory, error rates    │
│  Resource Monitoring   │ Memory leaks, exhaust  │
│  Security Events       │ Real-time via Supabase │
└─────────────────────────────────────────────────┘
```

**Anomaly Types Detected:**
- Performance degradation
- Error rate spikes
- Security vulnerabilities
- Memory leaks
- Service availability issues

### 18.4 Self-Healing Strategies

| Strategy | Autonomous | Description |
|----------|------------|-------------|
| `retry_with_backoff` | ✅ | Exponential backoff for transient failures |
| `circuit_breaker` | ✅ | Prevents cascade failures |
| `fallback_to_cache` | ✅ | Uses cached data when service unavailable |
| `graceful_degradation` | ✅ | Disables non-critical features |
| `state_rollback` | ✅ | Reverts to last known good state |
| `resource_cleanup` | ✅ | Cleans memory leaks |
| `session_recovery` | ✅ | Refreshes authentication tokens |
| `dependency_isolation` | ✅ | Bulkhead pattern isolation |
| `data_reconciliation` | ✅ | Ensures data consistency |
| `auto_patch` | ⚠️ | Code fixes (requires approval) |
| `configuration_reset` | ⚠️ | Config changes (requires approval) |
| `security_lockdown` | ⚠️ | Blocks suspicious activity |
| `emergency_shutdown` | ⚠️ | Graceful critical shutdown |

### 18.5 6-Layer Security Architecture

```
Layer 1: Token-Based Authentication (TokenAuth.ts)
         └─ JWT scoped tokens, 2-5 min TTL, JTI replay protection

Layer 2: Schema Validation (SchemaValidator.ts)
         └─ Zod-based validation, FHIR compliance, prevents AI hallucination

Layer 3: Tool Registry (ToolRegistry.ts)
         └─ Capability-based security, checksum validation, version pinning

Layer 4: Execution Sandbox (ExecutionSandbox.ts)
         └─ Network isolation, file system isolation, concurrency limits

Layer 5: PHI Encryption (PHIEncryption.ts)
         └─ AES-256-GCM field-level encryption, per-tenant keys

Layer 6: Propose Workflow (ProposeWorkflow.ts)
         └─ All code changes via GitHub PR, zero direct modifications
```

### 18.6 Guardian Eyes Real-Time Monitoring

**File:** `src/services/guardian-agent/RealtimeSecurityMonitor.ts`

- Listens to Supabase Realtime: `security_alerts`, `security_events`
- Live notification system with callbacks
- SOC 2 compliance dashboard
- Multi-channel alerts: email, Slack, SMS, PagerDuty

### 18.7 Approval Workflow

**File:** `src/services/guardianApprovalService.ts`

```
Issue Detection → Sandbox Testing → Review Ticket → Admin Approval → Conditional Merge
```

**Dashboard:** `/admin/guardian`

### 18.8 Performance Metrics

| Metric | Target |
|--------|--------|
| Detection Time | < 100ms |
| Healing Time | < 5 seconds |
| Success Rate | > 90% |
| False Positives | < 5% |
| Memory Overhead | < 10MB |
| CPU Overhead | < 1% |

---

## 19. BLE & Remote Patient Monitoring

### 19.1 Overview

Complete Web Bluetooth API integration for medical vital sign devices, supporting the **Mercy Methodist pilot** and enterprise RPM deployments.

### 19.2 Vital Capture Modes

| Mode | Description | Privacy |
|------|-------------|---------|
| **Manual Entry** | Senior-friendly form input | N/A |
| **Live Camera Scan** | Tesseract.js OCR on video | No storage |
| **Photo Capture** | 24-hour temporary storage | Auto-delete |
| **Web Bluetooth BLE** | Direct device connection | In-browser |

### 19.3 BLE Service Implementation

**File:** `src/components/vitals/useBluetooth.ts`

**Bluetooth SIG Standard UUIDs:**

| Service | UUID | Purpose |
|---------|------|---------|
| Blood Pressure | 0x1810 | BP monitors |
| Glucose | 0x1808 | Glucometers |
| Heart Rate | 0x180D | HR monitors |
| Weight Scale | 0x181D | Smart scales |
| Health Thermometer | 0x1809 | Thermometers |
| Battery Service | 0x180F | Battery level |

**Features:**
- IEEE 11073 SFLOAT parsing
- kPa to mmHg conversion
- mol/L to mg/dL conversion
- 30-second measurement timeout
- Notification/indication handling

### 19.4 Wearable Device Adapters

**Location:** `src/adapters/wearables/implementations/`

| Adapter | Devices | Certifications |
|---------|---------|----------------|
| **iHealth** | BP5, BP7, Core scales, Gluco+ | FDA 510(k), CE |
| **Fitbit** | Charge, Versa, Sense, Inspire | - |
| **Garmin** | Forerunner, Fenix, Venu | - |
| **Withings** | BPM Connect, Body+, Thermo | FDA, CE |
| **Apple HealthKit** | Apple Watch Series 4+ | - |
| **Samsung Health** | Galaxy Watch | - |
| **Amazfit** | GTR, GTS, Band series | - |

### 19.5 Critical Vital Thresholds

| Vital | Normal Range | Low Alert | High Alert |
|-------|--------------|-----------|------------|
| Systolic BP | 90-140 mmHg | < 90 | > 180 |
| Diastolic BP | 60-90 mmHg | < 60 | > 120 |
| Heart Rate | 60-100 bpm | < 50 | > 120 |
| SpO2 | 95-100% | < 88% | - |
| Temperature | 97-99°F | < 95°F | > 103°F |
| Glucose | 70-140 mg/dL | < 54 | > 400 |

### 19.6 Wearable Service Capabilities

**File:** `src/services/wearableService.ts`

```typescript
// Device Management
connectDevice(userId, deviceType, authToken)
disconnectDevice(userId, deviceType)
getConnectedDevices(userId)

// Vital Signs
storeVitalSign(userId, vitalData)
detectAbnormalVital(vital) → triggers sendVitalAlert()
getVitalsTrend(userId, vitalType, days)

// Fall Detection
processFallDetection(userId, fallData)
sendFallAlert(userId, fallEvent)
updateFallResponse(fallId, response)

// Gait Analysis (11 parameters)
storeGaitAnalysis(userId, gaitData)
  → step_count, cadence, stride_length
  → gait_speed, postural_sway
  → tremor_detected, tremor_frequency
  → freezing_episodes, double_support_time
```

### 19.7 Database Schema

**Migration:** `20251209200000_web_vital_capture_system.sql`

```sql
-- Vital capture source tracking
ALTER TABLE check_ins ADD COLUMN source TEXT;
-- Values: manual, camera_scan, camera_photo, ble_web,
--         caregiver_app, vendor_api, import

-- Temporary image storage (24-hour TTL)
CREATE TABLE temp_image_jobs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  status TEXT, -- pending_ocr, processing, processed, failed
  extracted_data JSONB,
  expires_at TIMESTAMPTZ
);
```

### 19.8 Edge Function: Photo OCR

**File:** `supabase/functions/process-vital-image/index.ts`

- Server-side OCR for uploaded vital images
- Validates against physiological ranges
- Updates job status workflow
- Auto-cleanup of expired images

---

## 20. Dual PHI Encryption Systems

### 20.1 Overview

Two complementary encryption systems for HIPAA compliance:

| System | Purpose | Algorithm | Key Storage |
|--------|---------|-----------|-------------|
| **WellFit Community** | Handoff/patient data | AES-256 | Supabase Secrets |
| **Envision Atlus** | Clinical/FHIR data | AES-256 | Supabase Vault |

### 20.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT APPLICATIONS                       │
├─────────────────────────────────────────────────────────────┤
│  phiEncryptionClient.ts    │    secureStorage.ts            │
│  (Server-side calls)       │    (Browser sessionStorage)    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    EDGE FUNCTIONS                            │
├─────────────────────────────────────────────────────────────┤
│  phi-encrypt/index.ts      │    phiDeidentifier.ts          │
│  (Encrypt/decrypt API)     │    (HIPAA Safe Harbor)         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER                            │
├──────────────────────────┬──────────────────────────────────┤
│   WELLFIT COMMUNITY      │      ENVISION ATLUS (CLINICAL)   │
├──────────────────────────┼──────────────────────────────────┤
│  encrypt_phi_text()      │   encrypt_phi_text(..., TRUE)    │
│  decrypt_phi_text()      │   decrypt_phi_text(..., TRUE)    │
│                          │                                   │
│  Key: Supabase Secrets   │   Key: Supabase Vault            │
│  app.settings.PHI_KEY    │   vault.decrypted_secrets        │
└──────────────────────────┴──────────────────────────────────┘
```

### 20.3 Database Functions

**encrypt_phi_text()**
```sql
CREATE FUNCTION encrypt_phi_text(
  data TEXT,
  use_clinical_key BOOLEAN DEFAULT FALSE
) RETURNS TEXT
```

**decrypt_phi_text()**
```sql
CREATE FUNCTION decrypt_phi_text(
  encrypted_data TEXT,
  use_clinical_key BOOLEAN DEFAULT FALSE
) RETURNS TEXT
-- Raises [PHI_ENCRYPTION_FAILED] on error (fail-safe design)
```

### 20.4 Encrypted Fields

**WellFit Community:**
- Patient names (handoff packets)
- Dates of birth (handoff packets)
- Medication photos (CHW service)
- Check-in emotional state/vitals
- Risk assessment notes

**Envision Atlus (Clinical):**

| Table | Encrypted Field |
|-------|-----------------|
| `billing_providers` | `ein_encrypted` |
| `facilities` | `tax_id_encrypted` |
| `hc_organization` | `tax_id_encrypted` |
| `hc_provider_group` | `tax_id_encrypted` |
| `profiles` | `dob_encrypted` |
| `senior_demographics` | `date_of_birth_encrypted` |
| `patient_referrals` | `patient_dob_encrypted` |
| `hc_staff` | `date_of_birth_encrypted` |
| `fhir_practitioners` | `birth_date_encrypted` |

### 20.5 Auto-Encryption Triggers

```sql
-- Automatic encryption on INSERT/UPDATE
CREATE TRIGGER encrypt_tax_id_on_change
  BEFORE INSERT OR UPDATE ON billing_providers
  FOR EACH ROW EXECUTE FUNCTION encrypt_tax_id_on_change();

CREATE TRIGGER encrypt_dob_on_change
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION encrypt_dob_on_change();
```

### 20.6 Decrypted Views

Controlled access to decrypted PHI with RLS:

| View | Decrypted Field |
|------|-----------------|
| `billing_providers_decrypted` | `ein_decrypted` |
| `facilities_decrypted` | `tax_id_decrypted` |
| `profiles_decrypted` | `dob_decrypted` |
| `senior_demographics_decrypted` | `date_of_birth_decrypted` |
| `patient_referrals_decrypted` | `patient_dob_decrypted` |

### 20.7 Client-Side Utilities

**phiEncryptionClient.ts:**
```typescript
encryptPHI(plaintext, patientId) → Promise<string>
decryptPHI(encryptedData, patientId) → Promise<string>
validateEncryption() → Promise<boolean>
```

**secureStorage.ts (Browser):**
```typescript
// AES-GCM with PBKDF2 (100,000 iterations)
secureStorage.setItem(key, value)
secureStorage.getItem(key)
```

### 20.8 PHI De-Identification

**File:** `supabase/functions/_shared/phiDeidentifier.ts`

**HIPAA Safe Harbor § 164.514 Compliance:**

| Pattern | Detection |
|---------|-----------|
| Names | Full names, labeled names, possessives |
| Geographic | Addresses, ZIP codes, city/state |
| Dates | DOB, full dates, exact ages |
| Identifiers | MRN, SSN, account numbers |
| Contact | Phone, email, fax |
| Digital | URLs, IP addresses |

**Redaction Levels:**
- `standard` - Common PHI patterns
- `strict` - Medical terms included
- `paranoid` - Maximum coverage

### 20.9 Key Management

```
Development:
  VITE_PHI_ENCRYPTION_KEY (browser - dev only)

Production - WellFit:
  Supabase Secrets → PHI_ENCRYPTION_KEY
  Session config → app.settings.PHI_ENCRYPTION_KEY

Production - Envision Atlus:
  Supabase Vault → vault.decrypted_secrets
  Key name → app.encryption_key
```

### 20.10 HIPAA Compliance

| Requirement | Implementation |
|-------------|----------------|
| § 164.312(a)(2)(iv) | AES-256 encryption at rest |
| Encryption in Transit | HTTPS/TLS required |
| Access Control | Auth required for encrypt/decrypt |
| Audit Trail | All operations logged |
| Fail-Safe | Exceptions on failure (not NULL) |

---

## Appendix A: Architectural Principles

From `CLAUDE.md`:

1. **Anthropic-Quality Engineering** - Seasoned, stable, careful coding
2. **No Shortcuts** - No workarounds, hacks, or temporary fixes
3. **ServiceResult Pattern** - Never throw exceptions, return results
4. **Type Safety** - Avoid `any`, prefer `unknown` with type guards
5. **HIPAA Compliance** - No PHI client-side, audit everything
6. **100% Test Pass Rate** - All tests must pass
7. **Zero Technical Debt** - Proper solutions only
8. **Surgical Precision** - Only modify what's necessary
9. **Accessibility First** - WCAG 2.1 AA compliance
10. **Multi-Tenant Ready** - White-label architecture

---

## Appendix B: Related Documentation

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | Development standards |
| `docs/REFERRAL_SYSTEM.md` | Referral system design |
| `docs/CAREGIVER_SUITE.md` | Caregiver PIN access |
| `docs/REGISTRATION_FLOWS.md` | Registration flows |
| `docs/ENVISION_ATLUS_DESIGN.md` | Design system |
| `docs/FEATURE_DASHBOARDS.md` | Dashboard configuration |
| `docs/VOICE_COMMANDS.md` | Voice command system |
| `docs/PATIENT_AVATAR.md` | Patient avatar system |

---

*This document is auto-generated and should be updated when architectural changes occur.*
