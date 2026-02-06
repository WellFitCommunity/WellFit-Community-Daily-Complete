# WellFit / Envision Atlus Documentation

Complete documentation index for the WellFit Community and Envision Atlus platforms.

---

## For Developers

### Getting Started
- [Developer Onboarding](DEVELOPER_ONBOARDING.md) - Environment setup, architecture overview, first-task walkthrough

### Architecture
- [API Reference](architecture/API_REFERENCE.md) - 10 MCP servers, 130+ Edge Functions, authentication, protocols
- [AI-First Architecture](architecture/AI_FIRST_ARCHITECTURE.md) - AI-first design paradigm & MCP server architecture
- [AI Development Methodology](architecture/AI_DEVELOPMENT_METHODOLOGY.md) - How to build software with AI (patterns, counter-measures, governance)
- [Envision Atlus Design System](architecture/ENVISION_ATLUS_DESIGN.md) - EA design system components

### Database
- [Migration Guide](database/MIGRATION_GUIDE.md) - Database migrations
- [Multi-Tenancy](database/MULTITENANCY.md) - Multi-tenant database setup
- [Tenant Setup](database/TENANT_SETUP.md) - Setting up new tenants
- [Table Usage](database/RECOMMENDED_TABLE_USAGE.md) - Database table guidelines

### Features
- [AI Dashboard](features/ai-dashboard.md) - AI insights dashboard
- [Authentication](features/authentication.md) - Passkey & biometric auth
- [Emergency Alerts](features/emergency-alerts.md) - Emergency alert system
- [FHIR AI](features/fhir-ai.md) - FHIR AI integration
- [FHIR Form Builder](features/fhir-form-builder.md) - Dynamic form system
- [Frequent Flyer System](features/frequent-flyer-system.md) - High-risk patient monitoring
- [Metric System](features/metric-system.md) - Health metrics tracking
- [Patient Handoff](features/patient-handoff.md) - Care transition system
- [Risk Framework](features/risk-framework.md) - Holistic risk assessment

### Testing
- See `docs/testing/` for test plans and QA guides

---

## For Clinical / Product

### Clinical Features
- [HIPAA Compliance](clinical/HIPAA_COMPLIANCE.md) - HIPAA compliance documentation
- [HIPAA Security Scan (2026-02-03)](clinical/HIPAA_SECURITY_SCAN_2026-02-03.md) - Latest security scan results
- [FHIR Interoperability Guide](clinical/FHIR_INTEROPERABILITY_GUIDE.md) - FHIR R4 integration guide
- [Patient Avatar](clinical/PATIENT_AVATAR.md) - Patient avatar visualization system
- [Patient Context Spine](clinical/PATIENT_CONTEXT_SPINE.md) - Canonical patient data access
- [Caregiver Suite](clinical/CAREGIVER_SUITE.md) - Family caregiver PIN-based access
- [EMS System](clinical/EMS_SYSTEM_COMPLETE.md) - Emergency Medical Services integration

### Product Features
- [Registration Flows](product/REGISTRATION_FLOWS.md) - Three registration flows
- [Feature Dashboards](product/FEATURE_DASHBOARDS.md) - Feature dashboard routes & config
- [Voice Commands](product/VOICE_COMMANDS.md) - Voice command infrastructure
- [Referral System](product/REFERRAL_SYSTEM.md) - External referral & reporting system
- [Epic Integration Guide](product/EPIC_INTEGRATION_GUIDE.md) - Epic EHR integration
- [Epic App Orchard Application](product/EPIC_APP_ORCHARD_APPLICATION.md) - App Orchard submission
- [Claude Care Assistant](product/CLAUDE_CARE_ASSISTANT_QUICK_START.md) - AI care assistant quick start

---

## For Compliance & Security

### Compliance
- [HIPAA Risk Assessment](compliance/HIPAA_RISK_ASSESSMENT.md) - Formal risk assessment per 45 CFR 164.308(a)(1)
- [PHI Data Flow](compliance/PHI_DATA_FLOW.md) - PHI entry, processing, storage, and transmission map
- [Access Control Matrix](compliance/ACCESS_CONTROL_MATRIX.md) - 25 roles mapped to data access permissions
- [Data Retention Policy](compliance/DATA_RETENTION_POLICY.md) - Retention periods for all data categories
- [Disaster Recovery Plan](compliance/DISASTER_RECOVERY_PLAN.md) - RTO/RPO targets, recovery procedures, communication plan
- [Service Level Agreement](compliance/SERVICE_LEVEL_AGREEMENT.md) - Uptime commitments, support tiers, SLA credits
- [Compliance Status (Current)](compliance/COMPLIANCE_STATUS_CURRENT.md) - Current compliance status
- [SOC2/FHIR Compliance Audit](compliance/SOC2_FHIR_COMPLIANCE_AUDIT.md) - SOC2 + FHIR audit
- [Logging Final Assessment](compliance/LOGGING_FINAL_ASSESSMENT.md) - Audit logging assessment

### Security
- [Security Overview](security/OVERVIEW.md) - Complete security documentation
- [Security Policy](security/SECURITY.md) - Security policy
- [Multi-Tenant Security](security/MULTI_TENANT_SECURITY_ANALYSIS.md) - Tenant isolation analysis
- [HIPAA Security Scan Results](security/HIPAA_SECURITY_SCAN_RESULTS.md) - Scan results
- [SBOM Summary](security/sbom-summary.md) - Software bill of materials
- Security Audits: see `docs/security-audits/`

### Governance
- [IP Attestations](governance/IP_ATTESTATIONS.md) - Intellectual property attestations

---

## For Business & Operations

### Demo Materials
- [Demo Readiness](demo/DEMO_READINESS.md) - Demo readiness checklist
- [Methodist Demo Guide](demo/METHODIST_DEMO_GUIDE.md) - Methodist Hospital demo guide
- [Anthology Fund Demo Script](demo/ANTHOLOGY_FUND_DEMO_SCRIPT.md) - Anthology Fund demo walkthrough

### Business Strategy
- See `docs/business/` for monetization strategy and outreach materials

### Grants & Funding
- [Grants Index](grants/README.md) - Complete grants documentation index
- See `docs/grants/` for all grant applications and funding opportunities

### Certification
- [Code Specs Certification](certification/CODE_SPECS_CERTIFICATION_MODULES.md) - Certification modules

### NurseOS
- [NurseOS Index](nurseos/README.md) - NurseOS resilience hub documentation
- See `docs/nurseos/` for deployment, roadmap, and product strategy

### Dental Module
- [Dental Module Index](dental-module/README.md) - Dental module documentation
- See `docs/dental-module/` for billing, grants, and sustainability

### Outreach
- See `docs/outreach/` for vendor outreach and capability statements

### Deployment
- See `docs/deployment/` for deployment guides and procedures

### Plans
- [Predictive Bed Management](plans/PREDICTIVE_BED_MANAGEMENT.md) - Bed management planning

---

## Archive

Historical documents, session summaries, completed assessments, and resolved fixes are in the [archive/](../archive/) folder. Files were moved (not deleted) to preserve git history. See [archive/README.md](../archive/README.md) for the archive structure.
