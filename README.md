# WellFit Community + Envision Atlus

[![CI/CD](https://github.com/WellFitCommunity/WellFit-Community-Daily-Complete/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/WellFitCommunity/WellFit-Community-Daily-Complete/actions/workflows/ci-cd.yml)
[![Security Scan](https://github.com/WellFitCommunity/WellFit-Community-Daily-Complete/actions/workflows/security-scan.yml/badge.svg)](https://github.com/WellFitCommunity/WellFit-Community-Daily-Complete/actions/workflows/security-scan.yml)
[![Tests](https://img.shields.io/badge/tests-7%2C490%20passed-brightgreen)]()
[![License](https://img.shields.io/badge/license-Proprietary-blue)]()
[![HIPAA](https://img.shields.io/badge/HIPAA-compliant-green)]()
[![TypeScript](https://img.shields.io/badge/any%20types-0-brightgreen)]()

A HIPAA-compliant, white-label healthcare platform built for community health organizations and clinical care teams.

| Product | Purpose | Target Users |
|---------|---------|--------------|
| **WellFit** | Community wellness and engagement | Seniors, caregivers, community orgs |
| **Envision Atlus** | Clinical care management engine | Healthcare providers, clinicians |

Both products can be deployed independently or together under a single multi-tenant architecture.

---

## Architecture

```
                          +------------------+
                          |   Vercel (CDN)   |
                          |  React 19 + Vite |
                          +--------+---------+
                                   |
                    +--------------+--------------+
                    |                             |
          +---------+--------+         +---------+--------+
          |    WellFit UI    |         | Envision Atlus UI|
          | (Community App)  |         | (Clinical App)   |
          +---------+--------+         +---------+--------+
                    |                             |
                    +--------------+--------------+
                                   |
                    +--------------+--------------+
                    |   Supabase Edge Functions   |
                    |   (Deno Runtime + CORS)     |
                    +--------------+--------------+
                                   |
              +--------------------+--------------------+
              |                    |                    |
    +---------+------+  +---------+------+  +---------+------+
    | PostgreSQL 17  |  |  10 MCP Servers |  |  Claude AI     |
    | (RLS per tenant)|  | FHIR, HL7, NPI |  | 40+ AI Skills  |
    +----------------+  | CMS, Claims    |  +----------------+
                        +----------------+
```

**Key design decisions:**
- **Multi-tenant**: RLS isolates tenant data at the database level
- **White-label**: Each tenant customizes branding via `useBranding()` hook
- **Explicit CORS**: Tenant domains configured via `ALLOWED_ORIGINS` env var (no wildcards)
- **Offline-first**: PWA support for rural areas with unreliable internet ([Offline Guide](docs/OFFLINE_GUIDE.md))

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19 | UI framework (ref-as-prop, `use()` hook) |
| Vite | Latest | Build tool and dev server |
| TypeScript | 5.x | Type safety (zero `any` types) |
| Tailwind CSS | 4.1.18 | Styling |
| Supabase | PostgreSQL 17 | Database, Auth, Edge Functions, RLS |
| Deno | Latest | Edge Functions runtime |
| Claude AI | Opus/Sonnet/Haiku | 40+ clinical AI services |

---

## Quality

| Metric | Value |
|--------|-------|
| Tests | 7,490 across 306 suites |
| Pass rate | 100% |
| `any` types | 0 (eliminated 1,400+ in Jan 2026) |
| Lint warnings | 0 (eliminated 1,671 in Jan 2026) |
| OWASP Top 10 | 9/10 categories compliant |
| SOC 2 | Implementation ready |
| HIPAA | Compliant (audit logging, PHI server-side only) |

---

## Key Features

### WellFit (Community)
- Senior daily check-in and self-reporting
- Voice commands and push notifications
- Meal planning, activities, social engagement
- Emergency alerts with offline support
- Physical therapy and neuro suite modules
- Caregiver access with PIN-based authentication

### Envision Atlus (Clinical)
- FHIR R4 interoperability (Epic integration ready)
- Patient Avatar visualization system
- SHIELD welfare check dispatch (law enforcement integration)
- Readmission risk prediction
- Care coordination and referral management
- Shift handoff system
- Dental health module with CDT billing
- NurseOS burnout prevention
- 40+ AI-powered clinical services

---

## Documentation

| Audience | Start Here |
|----------|------------|
| **Developers** | [Architecture](docs/architecture/AI_FIRST_ARCHITECTURE.md) / [Contributing](CONTRIBUTING.md) |
| **Clinical/Product** | [Patient Context Spine](docs/clinical/PATIENT_CONTEXT_SPINE.md) / [FHIR Guide](docs/clinical/FHIR_INTEROPERABILITY_GUIDE.md) |
| **Compliance** | [Security Policy](SECURITY.md) / [HIPAA](docs/clinical/HIPAA_COMPLIANCE.md) / [SOC2 Audit](docs/compliance/SOC2_FHIR_COMPLIANCE_AUDIT.md) |
| **Business** | [Demo Guide](docs/demo/METHODIST_DEMO_GUIDE.md) / [Grants](docs/grants/README.md) |
| **Full Index** | **[docs/README.md](docs/README.md)** |

---

## Getting Started

### Prerequisites

- Node.js v18+
- npm
- Supabase CLI ([install](https://supabase.com/docs/guides/cli))

### Installation

```bash
git clone <repository-url>
cd WellFit-Community-Daily-Complete
npm install
```

### Environment Variables

Create a `.env` file in the project root (local development only; use Vercel settings for production):

```env
# Client-Side (Vite requires VITE_ prefix)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_HCAPTCHA_SITE_KEY=your_hcaptcha_site_key
VITE_ANTHROPIC_API_KEY=your_claude_ai_api_key

# Server-Side (Edge Functions)
SB_PUBLISHABLE_API_KEY=sb_publishable_*
SB_SECRET_KEY=sb_secret_*
SB_SERVICE_ROLE_KEY=your_service_role_jwt

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

### Development Commands

```bash
npm run dev        # Start Vite dev server (localhost:5173)
npm run build      # Production build
npm run lint       # Run ESLint
npm run typecheck  # Run TypeScript type checking
npm test           # Run Vitest (7,490 tests)
```

### Supabase

```bash
npx supabase login
npx supabase link --project-ref xkybsjnvuohpqpbkikyn
npx supabase db push              # Push migrations
npx supabase functions deploy      # Deploy Edge Functions
```

---

## Deployment

Deployed on **Vercel**. See [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) for full instructions.

1. Connect Git repository to Vercel
2. Configure environment variables in Vercel project settings
3. Pushes to `main` trigger automatic builds

---

## Tenant Configuration

Tenant codes follow the format `{ORG}-{LICENSE}{SEQUENCE}`:

| License Digit | Type | Example |
|---------------|------|---------|
| `0` | Both Products | `VG-0002` |
| `8` | Envision Atlus Only | `HH-8001` |
| `9` | WellFit Only | `MC-9001` |

**Default Testing Tenant:** `WF-0001` (UUID: `2b902657-6a20-4435-a78a-576f397517ca`)

---

## Security

- HIPAA-compliant audit logging (zero `console.log` in production)
- Row Level Security on all tenant data
- Content Security Policy + security headers
- Explicit CORS allowlists (no wildcards)
- Automated vulnerability scanning via GitHub Actions
- Responsible disclosure: security@thewellfitcommunity.org

See [SECURITY.md](SECURITY.md) for full policy and incident response plan.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for code standards, PR process, and review criteria.

---

## License

Proprietary. Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.

See [LICENSE](LICENSE) for terms.

---

## Links

- [Changelog](CHANGELOG.md)
- [Security Policy](SECURITY.md)
- [Full Documentation Index](docs/README.md)
- Contact: maria@wellfitcommunity.com
