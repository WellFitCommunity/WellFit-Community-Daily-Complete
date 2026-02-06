# WellFit Community Daily

A white-label multi-tenant healthcare platform containing **two separate products** that can be used independently or together:

| Product | Purpose | Target Users |
|---------|---------|--------------|
| **WellFit** | Community engagement platform | Seniors, caregivers, community orgs |
| **Envision Atlus** | Clinical care management engine | Healthcare providers, clinicians |

**This application is deployed exclusively on Vercel.**

> **🫀 Offline Mode Available:** WellFit works completely offline - perfect for rural areas with unreliable internet. See [Offline Guide](docs/OFFLINE_GUIDE.md).

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19 | UI framework |
| **Vite** | Latest | Build tool & dev server |
| **TypeScript** | 5.x | Type safety |
| **Tailwind CSS** | 4.1.18 | Styling |
| **Supabase** | PostgreSQL 17 | Database, Auth, Edge Functions |
| **Deno** | Latest | Edge Functions runtime |

**Test Coverage:** 7,490 tests across 306 suites (100% pass rate)

## 📚 Documentation

- **[Deployment Guide](docs/DEPLOYMENT_GUIDE.md)** - Complete Vercel deployment instructions
- **[Offline Mode Guide](docs/OFFLINE_GUIDE.md)** - Offline functionality for rural healthcare
- **[Feature Documentation](docs/features/)** - Individual feature guides
- **[Security & Compliance](docs/security/)** - HIPAA, SOC2, security documentation
- **[Database Setup](docs/database/)** - Migrations, multi-tenancy, tenant setup
- **[All Documentation](docs/)** - Full documentation index

## Project Structure

The frontend codebase is organized as follows:

*   `/index.html`: Vite entry point (root level, not in `/public`)
*   `src/main.tsx`: Application bootstrap
*   `src/App.tsx`: Main application component with routing.
*   `src/components/`: Contains reusable UI components, organized into subdirectories:
    *   `auth/`: Authentication-related components.
    *   `admin/`: Components for the admin panel.
    *   `dashboard/`: Widgets and elements for the user dashboard.
    *   `envision-atlus/`: Shared UI component library (EA design system).
    *   `features/`: Components related to specific application features.
    *   `layout/`: Structural components like Header, Footer, DemoBanner.
    *   `patient-avatar/`: Patient Avatar Visualization System.
    *   `ui/`: Generic, highly reusable UI elements (e.g., Card, PageLayout).
*   `src/pages/`: Top-level components that act as views for different routes (e.g., `DashboardPage.tsx`, `WelcomePage.tsx`).
*   `src/contexts/`: React context providers (e.g., `DemoModeContext.tsx`).
*   `src/data/`: Static data like recipes, trivia questions.
*   `src/lib/`: Core library initializations, like `supabaseClient.ts`.
*   `src/services/`: Service layer with `ServiceResult<T>` pattern.
*   `src/hooks/`: Custom React hooks.
*   `src/utils/`: General utility functions.
*   `src/scripts/`: Standalone scripts (e.g., data import scripts).
*   `api/`: Vercel serverless functions for backend tasks requiring secure API key handling.
*   `supabase/functions/`: Supabase Edge Functions (Deno runtime).
*   `supabase/functions/_shared/`: Shared utilities for Edge Functions (CORS, auth, etc.).

## Key Features

*   Self-Reporting View for seniors to log daily health metrics.
*   Dashboard for users to see an overview of meals, activities, and other information.
*   Admin Panel for staff/doctors to:
    *   View user data and reports.
    *   Manage users and API keys.
    *   Export data.
*   Secure data handling with Supabase.
*   Push notifications for reminders and alerts.

## Getting Started (Local Development)

### Prerequisites

*   Node.js (v18 or later recommended)
*   npm (comes with Node.js) or yarn
*   Supabase CLI (if you need to manage local Supabase instance or apply migrations) - [Installation Guide](https://supabase.com/docs/guides/cli)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    # yarn install
    ```
3.  **Set up local environment variables:**
    Create a `.env` file in the project root. This file is for local development ONLY and should not be committed to Git. For Vercel deployment, environment variables must be set in the Vercel project settings.

    Copy the example below and replace the placeholder values with your actual keys:

    ```env
    # Client-Side Variables (Vite uses VITE_ prefix, NOT REACT_APP_)
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    VITE_HCAPTCHA_SITE_KEY=your_hcaptcha_site_key
    VITE_ANTHROPIC_API_KEY=your_claude_ai_api_key

    # Supabase Keys (Edge Functions & Server-Side)
    # New format keys (preferred)
    SB_PUBLISHABLE_API_KEY=sb_publishable_*
    SB_SECRET_KEY=sb_secret_*
    SB_SERVICE_ROLE_KEY=your_service_role_jwt  # Legacy JWT format

    # Legacy format (still supported)
    SUPABASE_URL=your_supabase_url
    SUPABASE_ANON_KEY=your_supabase_anon_key
    SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

    # Email (MailerSend)
    MAILERSEND_API_KEY=your_mailersend_api_key
    MAILERSEND_FROM_EMAIL=noreply@yourdomain.com

    # SMS (Twilio)
    TWILIO_ACCOUNT_SID=your_twilio_account_sid
    TWILIO_AUTH_TOKEN=your_twilio_auth_token
    TWILIO_PHONE_NUMBER=your_twilio_phone_number

    # Internal Security
    INTERNAL_API_KEY=your_secure_internal_api_key
    ADMIN_PANEL_PIN=your_admin_panel_pin
    ```

    **Environment Variable Notes:**

    *   **Vite requires `VITE_` prefix** for client-side variables (not `REACT_APP_`)
    *   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`: Required for client-side Supabase auth
    *   `SB_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY`: For admin-level backend operations (use with caution)
    *   Edge Functions should prefer JWT format keys (`SB_ANON_KEY`) for user token validation

### Running the Development Server

```bash
npm run dev
```

This starts the Vite development server on `http://localhost:5173`.

### Development Commands

```bash
npm run dev        # Start Vite dev server
npm run build      # Production build
npm run lint       # Run ESLint
npm run typecheck  # Run TypeScript type checking
npm test           # Run Vitest tests (7,490 tests)
```

### Working with Supabase

**Database:** PostgreSQL 17 via Supabase (fully migrated December 2025)

```bash
# Login to Supabase CLI
npx supabase login

# Link to project
npx supabase link --project-ref xkybsjnvuohpqpbkikyn

# Push migrations to remote database
npx supabase db push

# Deploy Edge Functions
npx supabase functions deploy <function-name>
```

**Local Development (Optional):**
```bash
supabase start          # Start local Supabase
supabase db reset       # Reset and apply all migrations
```

## Deployment

This application is configured for deployment on **Vercel**.

**For complete deployment instructions, see [Deployment Guide](docs/DEPLOYMENT_GUIDE.md).**

Quick steps:
1.  Connect your Git repository to Vercel.
2.  Configure the Environment Variables listed above in your Vercel project settings.
3.  Vercel will build and deploy automatically on pushes to the main branch.

## HIPAA Compliance

This is a healthcare application with strict PHI (Protected Health Information) requirements:

- **Never expose PHI to the browser** - all PHI must remain server-side
- Use patient IDs/tokens for client-side operations, never names, SSN, DOB, etc.
- Use the audit logger for all logging - **never use console.log**
- All security-sensitive operations must be logged via the audit system

## Architecture

- **Multi-tenant**: Multiple organizations share the codebase with their own domains
- **White-label**: Each tenant can customize branding via `useBranding()` hook
- **RLS Security**: Row Level Security isolates tenant data in Supabase
- **Explicit CORS**: Tenant domains configured via `ALLOWED_ORIGINS` env var (no wildcards)

### Tenant ID Convention

Tenant codes follow the format: `{ORG}-{LICENSE}{SEQUENCE}`

| Digit | License Type | Example |
|-------|--------------|---------|
| `0` | Both Products | `VG-0002` |
| `8` | Envision Atlus Only | `HH-8001` |
| `9` | WellFit Only | `MC-9001` |

**Default Testing Tenant:** `WF-0001` (UUID: `2b902657-6a20-4435-a78a-576f397517ca`)

## React 19 Patterns

This project uses React 19 (migrated December 2025). Key differences:

| Do This | Not This |
|---------|----------|
| `import.meta.env.VITE_*` | `process.env.REACT_APP_*` |
| Pass `ref` as prop directly | Use `forwardRef()` wrapper |
| Use `use()` hook for promises | `useEffect` + state for data fetching |

## Feature Flags

```env
VITE_FEATURE_PHYSICAL_THERAPY=true
VITE_FEATURE_CARE_COORDINATION=true
VITE_FEATURE_REFERRAL_MANAGEMENT=true
VITE_FEATURE_QUESTIONNAIRE_ANALYTICS=true
VITE_FEATURE_NEURO_SUITE=true
```

Use `useModuleAccess(moduleName)` hook to check feature access.
