# Component Taxonomy

This document organizes the WellFit Community components by domain and purpose.

## Component Categories

### Core UI (`/ui`, `/shared`, `/layout`)
Reusable UI primitives and layouts:
- `ui/` - Base UI components (buttons, cards, modals)
- `shared/` - Shared components across features
- `layout/` - Page layouts and navigation

### Authentication & Security (`/auth`, `/security`)
- `auth/` - Login, registration, PIN entry
- `security/` - MFA, passkey setup, session management
- `PasskeySetup.tsx` - WebAuthn passkey configuration
- `HCaptchaWidget.tsx` - Bot protection

### Dashboard & Landing (`/dashboard`, `/features`)
- `dashboard/` - Main user dashboards
- `features/` - Feature cards and module access

### Clinical Modules

#### Primary Care
- `patient/` - Patient-facing components
- `HealthHistory.tsx` - Patient health records
- `HealthInsightsWidget.tsx` - Health analytics
- `PulseOximeter.tsx` - Vital signs input

#### Mental Health & Neuro
- `mental-health/` - PHQ-9, GAD-7, behavioral health
- `neuro/` - Cognitive assessments
- `neuro-suite/` - Memory clinic, stroke assessment

#### Dental
- `dental/` - Dental health tracking and assessments

#### SDOH (Social Determinants of Health)
- `sdoh/` - Social needs screening, SDOH tracking

### Care Team Modules

#### Nursing
- `nurse/` - Nurse-specific workflows
- `nurseos/` - NurseOS Clarity and Shield modules
- `handoff/` - Shift handoff documentation

#### Community Health Workers
- `chw/` - CHW dashboard, home visits, field work

#### Physicians
- `physician/` - Physician workflows and dashboards

#### Social Workers
- `social-worker/` - Social worker assessments

#### Case Management
- `case-manager/` - Case management workflows

#### Specialists
- `specialist/` - Specialist workflow engine

### AI & Intelligence (`/ai`, `/ai-transparency`, `/claude-care`)
- `ai/` - AI-powered features
- `ai-transparency/` - AI decision transparency
- `claude-care/` - Claude AI assistant integration

### Telehealth (`/telehealth`, `/smart`)
- `telehealth/` - Video visits, remote care
- `smart/` - SMART on FHIR components

### Administrative (`/admin`, `/superAdmin`)
- `admin/` - Tenant admin panels
- `superAdmin/` - Super admin controls

### Billing & Revenue (`/billing`, `/atlas`)
- `billing/` - Billing workflows, CPT codes
- `atlas/` - Atlas Revenue integration

### Emergency Services (`/ems`, `/lawEnforcement`)
- `ems/` - EMS metrics and coordination
- `lawEnforcement/` - Law enforcement integration

### Care Transitions (`/discharge`)
- `discharge/` - Hospital discharge, post-acute care

### Community & Engagement
- `CommunityMoments.tsx` - Social features
- `TriviaGame.tsx` - Engagement games
- `CheckInTracker.tsx` - Daily check-ins
- `WhatsNewSeniorModal.tsx` - Feature announcements

### Utilities
- `ErrorBoundary.tsx` - Error handling
- `GuardianErrorBoundary.tsx` - Guardian-specific errors
- `OfflineIndicator.tsx` - Network status
- `LanguageSelector.tsx` - i18n support
- `NotFoundPage.tsx` - 404 handling
- `debug/` - Development tools
- `system/` - System status components

## Module Access Pattern

All feature components should check module access before rendering:

```tsx
import { useModuleAccess } from '../../hooks/useModuleAccess';

function FeatureComponent() {
  const { canAccess, loading, denialReason } = useModuleAccess('feature_enabled');

  if (loading) return <LoadingSpinner />;
  if (!canAccess) return <UpgradePrompt reason={denialReason} />;

  return <FeatureContent />;
}
```

## File Naming Conventions

- **Pages**: `*Page.tsx` (e.g., `DashboardPage.tsx`)
- **Panels**: `*Panel.tsx` (e.g., `AdminPanel.tsx`)
- **Cards**: `*Card.tsx` (e.g., `HealthCard.tsx`)
- **Modals**: `*Modal.tsx` (e.g., `WhatsNewModal.tsx`)
- **Forms**: `*Form.tsx` (e.g., `RegistrationForm.tsx`)
- **Lists**: `*List.tsx` (e.g., `PatientList.tsx`)
- **Widgets**: `*Widget.tsx` (e.g., `HealthInsightsWidget.tsx`)

## Future Organization

When adding new components:
1. Check if an appropriate domain folder exists
2. Use the module access hook for feature-gated content
3. Follow the naming conventions above
4. Add tests in the corresponding `__tests__/` folder
