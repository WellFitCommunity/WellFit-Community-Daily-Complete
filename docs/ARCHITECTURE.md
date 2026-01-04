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
