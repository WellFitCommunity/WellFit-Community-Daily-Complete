# WellFit Community - UX/UI Quick Reference Guide

## System Overview
- **Type**: Enterprise Healthcare Engagement Platform
- **Primary Audience**: Seniors + Healthcare Providers
- **Tech Stack**: React 18 + TypeScript + Tailwind CSS + Supabase + Claude AI
- **Scale**: 40+ pages, 55 component categories, 159 services, 13+ user roles
- **Compliance**: HIPAA, FHIR R4, SOC2, Multi-tenant

---

## Key User Roles & Dashboards

### Patient-Facing
| Role | Dashboard | Key Features |
|------|-----------|--------------|
| Senior Patient | SeniorCommunityDashboard | Daily check-ins, games, community gallery |
| Caregiver | CaregiverDashboard | Patient monitoring, PIN-protected access |

### Provider-Facing
| Role | Dashboard | Key Features |
|------|-----------|--------------|
| Physician | PhysicianPanel | Patient summary, smart scribe, telehealth, revenue tracking |
| Nurse | NursePanel | Shift handoff, vitals entry, patient enrollment |
| Case Manager | CaseManagerPanel | Care coordination, referrals, risk assessment |
| Social Worker | SocialWorkerPanel | SDOH assessment, resource connection |
| CHW (Kiosk) | KioskCheckIn | Bilingual patient lookup, vitals, meds, SDOH |
| Specialist | SpecialistDashboard | Specialty-specific workflows (neuro, PT, mental health) |

### Admin
| Role | Dashboard | Key Features |
|------|-----------|--------------|
| Super Admin | IntelligentAdminPanel | System config, multi-tenant, compliance |
| Hospital Admin | AdminPanel | Patient enrollment, reporting, billing |

---

## Critical Healthcare Workflows

### 1. Daily Patient Check-In
- **Location**: `/check-in`
- **Features**: Emotional tracking (emoji), vitals (HR/SpO2/BP/glucose), crisis detection
- **AI**: Automated abnormal value flagging
- **Security**: HIPAA-compliant (no localStorage PHI)
- **UX Issue**: No voice input for mobility-limited seniors

### 2. Telehealth Appointments
- **Location**: `/telehealth-appointments`
- **Components**: TelehealthScheduler, TelehealthConsultation, TelehealthLobby
- **Platform**: Daily.co video API
- **UX Issue**: Missing pre-visit tech readiness check

### 3. Physician Patient Review
- **Location**: `/physician-dashboard`
- **View**: Patient summary cards with vitals trends, conditions, meds, SDOH score
- **Actions**: Risk assessment, care plan entry, smart scribe, lab ordering
- **UX Issues**: 
  - Dense information layout; critical alerts not highlighted
  - No quick action buttons (order lab, adjust med, etc.)
  - Requires scrolling to see full patient picture

### 4. FHIR Data Management
- **Service**: FhirResourceService.ts (refactored from 95KB to modular 22-file structure)
- **Resources**: Condition, Medication, Observation, CarePlan, Encounter, etc.
- **Integrations**: Epic, Cerner, Meditech FHIR adapters
- **Features**: Questionnaire builder, bulk export/import, bidirectional sync

### 5. Smart Scribe (Ambient AI Healthcare Assistant)
- **Location**: RealTimeSmartScribe.tsx
- **Core Innovation**: **Always listening, learning, and adapting** to each provider's unique style
- **Riley - Conversational AI Assistant**:
  - **Conversational interface**: Natural language interaction, not just transcription
  - **Real-time coaching & guidance**: Offers suggestions during patient encounters
  - **10-level coaching slider**: Adjusts how conversational Riley is (from silent to highly engaged)
  - **Personality**: Warm, professional, helpful healthcare companion
  - **Context-aware**: Understands clinical conversations and offers relevant insights
- **Ambient Learning**:
  - Learns provider's accent, speech patterns, and common verbiage
  - Adapts to workflow preferences and documentation style
  - Continuous improvement from provider corrections
  - Creates personalized voice profiles per provider
- **Features**:
  - Real-time voice-to-text transcription
  - AI billing code suggestions (CPT/ICD10/HCPCS)
  - Automated SOAP note generation
  - Revenue impact calculator
- **AI Model**: Claude Sonnet 4.5 for maximum clinical and billing accuracy
- **UX Issue**: Ambient learning progress not visible; providers don't see how much the system has learned their style or know when it's fully adapted

### 6. Wearable Integration
- **Service**: WearableService.ts
- **Devices**: Apple Watch, Fitbit, Garmin, Samsung Health, Withings, Amazfit
- **Data**: Vitals (HR/SpO2/temp), activity, sleep, fall detection, gait analysis
- **UX Issue**: Wearable enrollment UI not visible; backend OAuth flow only

### 7. Neurological Specialty (NeuroSuite)
- **Location**: `/neuro-suite/*`
- **Assessments**: MoCA (cognitive), CDR (dementia staging), Zarit (caregiver burden), NIHSS (stroke)
- **Purpose**: Dementia screening, stroke recovery, caregiver support
- **Feature**: Real-time score calculation

### 8. Discharge Planning & Readmission Prevention
- **Service**: DischargeToWellnessBridge.ts + DischargePlanningService.ts
- **Flow**: Hospital discharge → auto-enrollment → 30-day intensive monitoring → escalation protocols
- **Purpose**: Prevent unnecessary readmissions

### 9. CHW Kiosk Check-In
- **Location**: `/chw-kiosk`
- **Auth**: No password; language (EN/ES) → name/DOB/SSN4/PIN → privacy → service selection
- **Services**: Vitals, medication photo, SDOH assessment, telehealth scheduling
- **Security**: 2-min inactivity auto-logout, 5 failed attempts/5 min rate limit
- **UX Issue**: No progress bar for multi-step workflow

---

## AI & Automation Systems

### Claude AI Integration (Smart Model Routing)
- **Service**: claudeService.ts
- **Intelligent Model Selection by Use Case**:
  - **Sonnet 4.5**:
    - Smart Scribe (Riley) for doctors/PAs/NPs - conversational healthcare assistant
    - Medical billing code generation and optimization
    - Complex clinical decisions and chart reviews
  - **Haiku 4.5**:
    - Dashboard personalization (intuitive workflow learning)
    - Real-time UI adaptations (cost-optimized for high-frequency operations)
  - **MCP (Model Context Protocol)**: Used with billing to reduce API costs
- **Features**: Smart routing, rate limiting (60 req/min), cost monitoring, automatic model selection
- **Cost Optimization**: Haiku for frequent/simple tasks, Sonnet for critical/complex tasks
- **UX Issue**: AI cost limits and model selection logic not exposed to users

### Guardian Agent (Self-Healing System)
- **Service**: GuardianAgent.ts
- **Purpose**: Background system that automatically detects and fixes bugs/errors
- **Features**: Continuous health monitoring, automatic error correction, HIPAA verification, Guardian Eyes recording
- **User Impact**: Operates silently in background; does NOT provide advice to users
- **UX Issue**: Auto-corrections logged for admins only; clinical users have no visibility into self-healing actions

### Dashboard Personalization (Intuitive AI - Haiku 4.5)
- **Service**: DashboardPersonalizationAI.ts
- **AI Model**: Claude Haiku 4.5 (cost-optimized for high-frequency learning operations)
- **Core Intelligence**: **Backend learns individual workflow patterns per user and role**
- **How It Works**:
  - **Role-Adaptive**: If doctor views patient chart first → surfaces charts. If nurse checks labs first → surfaces labs
  - **Individual Learning**: Each professional gets personalized dashboard based on their unique workflow
  - **Pattern Recognition**: Tracks what each user accesses first, most frequently, and at what times
  - **Auto-Optimization**: Reorders sections, auto-expands frequently used areas, collapses rarely used sections
  - **Time-of-Day Awareness**: Morning vs. afternoon workflow differences detected and adapted
- **Why Haiku**: High-frequency operations (every dashboard load) require cost-effective model
- **Result**: Every user sees their most-needed information surfaced automatically
- **UX Issue**: Learning happens silently; users don't know the system is adapting to them specifically

### Risk Stratification
- **Services**: 
  - HolisticRiskAssessment.ts (comprehensive scoring)
  - ReadmissionTrackingService.ts (hospital readmission prediction)
  - ResilienceHubService.ts (recovery potential)
- **Inputs**: Clinical conditions, SDOH factors, behavioral health, healthcare utilization

### Automated Systems
1. **CCM Autopilot**: Patient eligibility → CPT code assignment → billing document generation
2. **Drug Interaction Detection**: Automatic checking on med addition/change
3. **Medication Reconciliation**: Patient-reported vs. prescribed comparison
4. **Outreach**: Missed check-in alerts, appointment reminders, adherence nudges, risk escalation
5. **SDOH Matching**: Assessment → resource recommendation → facilitation
6. **Referral Routing**: Need detection → specialist routing → appointment scheduling

---

## Component Library Structure

### Design System
- **Colors**: #003865 (primary blue), #8cc63f (secondary green) + multi-tenant overrides
- **Typography**: Tailwind defaults; senior components use 16px+ text
- **Spacing**: 4px base Tailwind scale
- **Framework**: Tailwind CSS (utility-first)
- **Missing**: Centralized token file, form component library docs, WCAG guidelines

### Component Categories (55 directories)
```
/ui - Base components (button, card, alert, badge, tabs, skeleton)
/layout - Header, Footer, Page wrappers
/auth - RequireAuth, RequireAdminAuth wrappers
/admin - 30+ admin-specific components
/patient - Patient health tools
/physician - Provider workspace
/nurse - Care coordination
/chw - Community health worker tools
/telehealth - Video visit components
/neuro, /neuro-suite - Neurological specialty
/physical-therapy, /mental-health - Specialty workflows
/billing - Revenue cycle management
/ems, /handoff, /discharge - Transitions of care
/smart, /claude-care - AI-powered features
```

### State Management Patterns
- **Auth**: AuthContext (user session)
- **Branding**: BrandingContext (multi-tenant theming)
- **Admin Auth**: AdminAuthContext (staff session)
- **No global UI state**: Preferences likely stored per component

---

## Design Issues & Recommendations

### Critical (High Impact)
1. **Cognitive Overload**: Provider dashboards show too much data
   - Solution: Smart triage, auto-collapse non-critical, color-code severity
2. **AI Transparency**: Smart Scribe suggestions lack confidence indicators for providers
   - Solution: Add confidence scores, color-code suggestions (green/yellow/red), "Explain" buttons for AI recommendations
3. **Inconsistent Loading**: Some views show spinners; others silent
   - Solution: Skeleton screens, toast notifications, progress indicators
4. **No Onboarding**: New users unsure how to use system
   - Solution: Interactive tutorial, role-specific guides, help tooltips
5. **Form Abandonment**: Long registration forms with no progress tracking
   - Solution: Multi-step progress bar, auto-save, resume later

### Moderate (Medium Impact)
6. **Patient Summary**: Critical info not distinguished from routine
   - Solution: Color-code severity, use icons, collapsible sections
7. **Wearable Setup**: Hidden from UI; backend-only integration
   - Solution: Connected devices page, setup wizard, sync status
8. **No Voice Input**: Seniors with mobility limitations can't use check-in
   - Solution: Voice-to-text check-ins, voice navigation
9. **Medication UX**: Pill identifier works but requires manual upload
   - Solution: Pharmacy integration, "Take Photo" button, visual confirmation
10. **Smart Scribe Learning Opacity**: Ambient learning progress not visible to providers
    - Solution: Voice profile maturity indicator, learning milestones, accuracy metrics dashboard
11. **Telehealth Gaps**: No pre-visit tech check or readiness assessment
    - Solution: Tech test, permissions check, internet speed test, setup guide

### Minor (Low Impact, Better UX)
12. **Intuitive Dashboard Learning Not Visible**: System learns individual workflows and adapts, but silently
    - Missing: Personalized greeting by name, daily motivational quotes, "Personalized for You" indicators
13. **Generic Error Messages**: "Failed to load" doesn't help users
14. **No Offline**: Sudden internet loss = no access
15. **Mobile Responsiveness**: Untested; likely poor on phones
16. **No a11y Audit**: WCAG 2.1 compliance status unknown

---

## Key Integrations

### EHR Systems (Universal Adapter Pattern)
- Epic FHIR API
- Cerner FHIR API
- Meditech FHIR API
- Generic FHIR systems

### Wearables (Device-Specific Adapters)
- Apple HealthKit
- Fitbit Cloud
- Garmin Health
- Samsung Health
- Withings Cloud
- Amazfit API

### Third-Party Services
- **Twilio**: SMS/voice notifications
- **Daily.co**: Telehealth video
- **Drug Database API**: Interaction checking
- **MCP Framework**: Data standardization

---

## Data Models & Compliance

### Key Tables (Supabase PostgreSQL)
- `profiles` - User demographics, verification, consent
- `check_ins` - Daily vitals, mood, crisis flags
- `encounters` - Visit records (FHIR-mapped)
- `fhir_observations` - Clinical observations
- `wearable_connections` - Device OAuth tokens
- `handoff_packets` - Care transition documents
- `audit_logs` - PHI access tracking

### Security Features
- **RLS Policies**: Row-level security per user role
- **PHI Encryption**: Encrypted fields for sensitive data
- **Audit Logging**: User ID, action, timestamp, IP, change details
- **MFA**: Multi-factor authentication enforcement
- **Session Timeout**: Admin session management

### Compliance
- **HIPAA**: 2-year audit retention, PHI access logging, encryption
- **FHIR**: R4 compliance, semantic interoperability
- **SOC2**: Detailed audit dashboards, incident response tracking
- **Multi-Tenant**: Isolated data per organization

---

## Performance & Monitoring

### Optimization Strategies
- **Code Splitting**: React.lazy + Suspense for all pages
- **Service Layer**: Business logic separated from UI
- **Type Safety**: TypeScript strict mode prevents runtime errors
- **Caching**: Service worker for offline-first approaches (future)

### Monitoring
- **Performance**: Page load times, API latencies, database queries
- **Errors**: Guardian Agent continuous health monitoring
- **Usage**: Dashboard section access patterns, engagement tracking
- **Security**: PHI access logging, unusual activity detection

---

## Recommendations Priority Matrix

| Issue | Impact | Effort | Priority |
|-------|--------|--------|----------|
| Provider dashboard cognitive overload | High | Medium | 1 |
| AI transparency layer | High | Medium | 2 |
| Consistent loading states | High | Low | 3 |
| Onboarding tutorial | High | Medium | 4 |
| Form abandonment (progress) | High | Low | 5 |
| Patient summary hierarchy | Medium | Low | 6 |
| Wearable setup wizard | Medium | Medium | 7 |
| Voice input for seniors | Medium | High | 8 |
| Telehealth pre-visit check | Medium | Medium | 9 |
| Mobile responsiveness | Medium | High | 10 |
| WCAG a11y compliance | Medium | High | 11 |

---

## Design System Maturity Assessment

**Current**: 6/10
- ✅ Tailwind CSS framework
- ✅ Multi-tenant branding
- ✅ Role-based layouts
- ❌ No token file
- ❌ No form library
- ❌ No a11y guidelines
- ❌ Limited documentation

**Recommended**:
1. Create design token JSON file (colors, typography, spacing)
2. Build comprehensive component library documentation
3. Implement WCAG 2.1 AA accessibility standards
4. Create healthcare-specific UI patterns (clinical forms, vitals entry, alerts)

---

## File Structure Reference

```
src/
├── components/ (55 directories, 300+ components)
├── pages/ (40+ pages for routing)
├── services/ (159 service files)
│   ├── claudeService.ts - AI integration
│   ├── fhirResourceService.ts - FHIR R4 (refactored)
│   ├── wearableService.ts - Device integration
│   ├── handoffService.ts - Care transitions
│   ├── guardianAgentClient.ts - Self-healing system
│   └── (140+ specialized services)
├── types/ (TypeScript definitions)
├── adapters/ (EHR & wearable adapters)
├── contexts/ (Auth, branding, state)
├── hooks/ (React custom hooks)
├── App.tsx (Main router with 40+ routes)
├── branding.config.ts (Multi-tenant theming)
└── (Config files)

supabase/
├── migrations/ (208 PostgreSQL schema files)
├── functions/ (Edge functions for backend logic)
└── (Database & auth config)
```

---

## Key Metrics to Track

### User Engagement
- Daily check-in completion rate (target: >80%)
- Telehealth appointment no-show rate
- Community moments uploads per week
- Game play frequency

### Provider Efficiency
- Time spent per patient review
- Smart scribe acceptance rate (AI code accuracy)
- Referral-to-appointment conversion time
- Patient summary card scrolling patterns

### System Health
- Page load times (target: <2s)
- API response latencies (target: <200ms)
- Error rates by service
- PHI access audit trail completeness

### Compliance
- MFA enrollment rate (target: 100%)
- SOC2 audit findings (target: zero critical)
- Data breach incidents (target: zero)
- Access control violations

---

Generated: 2025-11-05 | Version 1.0 | WellFit UX/UI Comprehensive Evaluation
