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
- [Platform Technical Assessment](business/PLATFORM_ASSESSMENT.md) - Independent codebase assessment of MCP servers, AI skills, and strategic positioning
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

---

<!-- AUTO-INDEX:START -->

## Complete File Index (auto-generated)

> Generated by `scripts/generate-docs-index.mjs` — do not edit by hand.
> Run `npm run docs:index` after adding or moving a doc.
> Covers **244** documents across **27** categories.

### (root)

- [28 Reasons to Be Proud of This System](28-REASONS-TO-BE-PROUD.md)
- [Not All Claude Agents Are Created Equal](AI_AGENT_QUALITY_VARIANCE.md)
- [Building With AI: The Class They Don't Teach](AI_CODING_CLASS_CURRICULUM.md)
- [Building With AI: The Class They Don't Teach](AI_CODING_CLASS_LESSON_PLANS.md)
- [Building With AI: The Class They Don't Teach](AI_CODING_CLASS_SYLLABUS.md)
- [AI Component Reference — Envision Atlus Design System](AI_COMPONENT_REFERENCE.md)
- [AI Coding Mistakes — JavaScript](AI_JAVASCRIPT_MISTAKES.md)
- [AI Coding Mistakes — Python](AI_PYTHON_MISTAKES.md)
- [AI Systems Director Assessment — Envision ATLUS I.H.I.S.](AI_SYSTEMS_DIRECTOR_ASSESSMENT.md)
- [A Non-Engineer Built Enterprise Healthcare Software with Claude Code](ANTHROPIC_OUTREACH_ALEX_ALBERT.md)
- [The Autonomous AI Development System](AUTONOMOUS_AI_DEVELOPMENT_SYSTEM.md)
- [Claude Code Insights — 2026-06-03 (Full Report)](CLAUDE_CODE_INSIGHTS_2026-06-03.md)
- [Claude Code Insights Report](CLAUDE_CODE_INSIGHTS_REPORT.md)
- [Stedi Clearinghouse — Setup Checklist for Maria](CLEARINGHOUSE_STEDI_SETUP.md)
- [Clinical Safety & Revenue Build Tracker](CLINICAL_REVENUE_BUILD_TRACKER.md)
- [Clinical Validation Hooks Architecture](CLINICAL_VALIDATION_HOOKS_ARCHITECTURE.md)
- [Deep Congruency Audit — Envision ATLUS I.H.I.S.](DEEP_CONGRUENCY_AUDIT_2026-02-21.md)
- [Developer Onboarding Guide](DEVELOPER_ONBOARDING.md)
- [Envision ATLUS I.H.I.S. — Comprehensive Feature Catalog](FEATURE_CATALOG.md)
- [Envision ATLUS I.H.I.S. — Investor Feature Brief](FEATURE_CATALOG_INVESTOR.md)
- [Envision ATLUS I.H.I.S. -- Feature List](FEATURE_LIST.md)
- [Envision ATLUS I.H.I.S. — Product Overview](FEATURE_LIST_ONE_PAGE.md)
- [Go-to-Market Playbook — Envision ATLUS I.H.I.S.](GO_TO_MARKET_PLAYBOOK.md)
- [Job Fit Notes — Maria](JOB_FIT_NOTES.md)
- [MCP Ecosystem Findings Report — 2026-03-10](MCP_ECOSYSTEM_FINDINGS_2026-03-10.md)
- [MCP Server Ecosystem Audit](MCP_SERVER_AUDIT.md)
- [Monetization Paths — Honest Analysis (2026-05-20)](MONETIZATION_PATHS.md)
- [Project State — Envision ATLUS I.H.I.S.](PROJECT_STATE.md)
- [Project State — Historical Archive](PROJECT_STATE_HISTORY.md)
- [Rural Health Transformation Program (RHTP) — Strategic Opportunity (2026-05-20)](RHTP_OPPORTUNITY.md)
- [Rural America Positioning — Evidence Audit (2026-05-20)](RURAL_AMERICA_POSITIONING.md)
- [Skills Assessment — What You Have, What's Outdated, What's Missing](SKILLS_ASSESSMENT_2026-02-28.md)
- [Envision ATLUS I.H.I.S. — Software Audit Report](SOFTWARE_AUDIT_REPORT.md)
- [Envision ATLUS I.H.I.S. — System Assessment](SYSTEM_ASSESSMENT_2026-03-27.md)
- [Envision ATLUS I.H.I.S. — System Readiness Assessment](SYSTEM_READINESS_ASSESSMENT_2026-02-28.md)
- [Test Coverage Scale Readiness Tracker](TEST_COVERAGE_SCALE_TRACKER.md)
- [Texas Market Reconnaissance — Honest Assessment (2026-05-20)](TEXAS_MARKET_RECON.md)
- [TODO: Unified Patient Chart Navigator](TODO_CHART_NAVIGATION_FIX.md)
- [Envision ATLUS I.H.I.S. — Top 24 Features](TOP_24_FEATURES.md)
- [Envision ATLUS I.H.I.S. -- User Manual](USER_MANUAL.md)
- [Vision](VISION.md)
- [God File Inventory — Files Over 600 Lines](god-file-inventory.md)
- [System Analysis — Gap Closure (One Page)](system-analysis-gap-closure-2026-06-09.md)

### architecture

- [AI Development Methodology](architecture/AI_DEVELOPMENT_METHODOLOGY.md)
- [AI-First Architecture](architecture/AI_FIRST_ARCHITECTURE.md)
- [API Reference](architecture/API_REFERENCE.md)
- [Envision Atlus Design System](architecture/ENVISION_ATLUS_DESIGN.md)
- [Governance Boundary Map](architecture/GOVERNANCE_BOUNDARY_MAP.md)
- [Governance Knowledge Map](architecture/GOVERNANCE_KNOWLEDGE_MAP.md)
- [AI Governance Methodology — Analysis & Value Assessment](architecture/GOVERNANCE_METHODOLOGY_ANALYSIS.md)
- [MCP Server Architecture — Envision ATLUS I.H.I.S.](architecture/MCP_SERVER_ARCHITECTURE.md)
- [Multi-Vertical Boundary Model](architecture/MULTI_VERTICAL_BOUNDARY_MODEL.md)

### audits

- [ChatGPT Architecture Audit — Findings vs. Reality](audits/CHATGPT_ARCHITECTURE_AUDIT_2026-03-12.md)

### business

- [AI Director Monetization Strategy](business/AI_DIRECTOR_MONETIZATION_STRATEGY.md)
- [AI-Powered Clinical Decision Support Outreach Materials](business/AI_EMR_OUTREACH_MATERIALS.md)
- [Platform Technical Assessment](business/PLATFORM_ASSESSMENT.md)
- [Revenue Opportunities for Envision VirtualEdge Group LLC](business/REVENUE_OPPORTUNITIES_2026.md)

### certification

- [Code Specifications: ONC Certification Modules](certification/CODE_SPECS_CERTIFICATION_MODULES.md)

### clinical

- [Caregiver Suite (Family Access)](clinical/CAREGIVER_SUITE.md) — _owner: Clinical · review: needs-review · updated: 2026-02-04_
- [🚑 EMS Prehospital Handoff System - COMPLETE](clinical/EMS_SYSTEM_COMPLETE.md) — _owner: Clinical · review: needs-review · updated: 2026-02-04_
- [FHIR Interoperability Integration Guide](clinical/FHIR_INTEROPERABILITY_GUIDE.md) — _owner: Clinical · review: needs-review · updated: 2026-02-04_
- [🏥 HIPAA Compliance for WellFit Offline Mode](clinical/HIPAA_COMPLIANCE.md) — _owner: Clinical · review: needs-review · updated: 2026-02-04_
- [HIPAA Security Compliance Scan Report](clinical/HIPAA_SECURITY_SCAN_2026-02-03.md) — _owner: Clinical · review: needs-review · updated: 2026-02-04_
- [Patient Avatar Visualization System v2](clinical/PATIENT_AVATAR.md) — _owner: Clinical · review: needs-review · updated: 2026-02-04_
- [Canonical Patient Context Spine](clinical/PATIENT_CONTEXT_SPINE.md) — _owner: Clinical · review: needs-review · updated: 2026-02-04_

### compliance

- [42 CFR Part 2 Sensitive-Data Subsystem — Compliance Decisions for Review](compliance/42_CFR_PART2_REVIEW_ITEMS.md) — _owner: Compliance · review: needs-review · updated: 2026-06-07_
- [Access Control Matrix](compliance/ACCESS_CONTROL_MATRIX.md) — _owner: Compliance · review: needs-review · updated: 2026-02-06_
- [AI Decision Audit Chain -- Causal Traceability Specification](compliance/AI_DECISION_AUDIT_CHAIN.md) — _owner: Compliance · review: needs-review · updated: 2026-03-12_
- [Anti-Kickback Statute & Stark Law Compliance](compliance/ANTI_KICKBACK_STARK_COMPLIANCE.md) — _owner: Compliance · review: needs-review · updated: 2026-02-10_
- [Change Management Policy](compliance/CHANGE_MANAGEMENT_POLICY.md) — _owner: Compliance · review: needs-review · updated: 2026-02-10_
- [Current HIPAA/SOC 2 Compliance Status - What You Already Have](compliance/COMPLIANCE_STATUS_CURRENT.md) — _owner: Compliance · review: needs-review · updated: 2026-02-04_
- [Data Governance Specification](compliance/DATA_GOVERNANCE.md) — _owner: Compliance · review: needs-review · updated: 2026-03-12_
- [Data Retention Policy](compliance/DATA_RETENTION_POLICY.md) — _owner: Compliance · review: needs-review · updated: 2026-02-06_
- [Disaster Recovery Plan](compliance/DISASTER_RECOVERY_PLAN.md) — _owner: Compliance · review: needs-review · updated: 2026-02-06_
- [FDA Clinical Decision Support (CDS) Classification](compliance/FDA_CDS_CLASSIFICATION.md) — _owner: Compliance · review: needs-review · updated: 2026-02-10_
- [HIPAA Security Risk Assessment](compliance/HIPAA_RISK_ASSESSMENT.md) — _owner: Compliance · review: needs-review · updated: 2026-02-06_
- [Incident Response Plan (IRP)](compliance/INCIDENT_RESPONSE_PLAN.md) — _owner: Compliance · review: needs-review · updated: 2026-02-10_
- [Information Blocking Policy](compliance/INFORMATION_BLOCKING_POLICY.md) — _owner: Compliance · review: needs-review · updated: 2026-02-10_
- [Logging Implementation - Final Assessment](compliance/LOGGING_FINAL_ASSESSMENT.md) — _owner: Compliance · review: needs-review · updated: 2026-02-04_
- [NIST SP 800-30 Risk Assessment](compliance/NIST_SP_800_30_RISK_ASSESSMENT.md) — _owner: Compliance · review: needs-review · updated: 2026-02-10_
- [ONC 170.315 Certification Evidence Matrix](compliance/ONC_170.315_CERTIFICATION_MATRIX.md) — _owner: Compliance · review: needs-review · updated: 2026-06-02_
- [PHI Data Flow Diagram](compliance/PHI_DATA_FLOW.md) — _owner: Compliance · review: needs-review · updated: 2026-02-06_
- [Regulatory Gap Tracker](compliance/REGULATORY_GAP_TRACKER.md) — _owner: Compliance · review: needs-review · updated: 2026-02-10_
- [Service Level Agreement (SLA)](compliance/SERVICE_LEVEL_AGREEMENT.md) — _owner: Compliance · review: needs-review · updated: 2026-02-06_
- [SOC 2 Compliance Audit Report - FHIR Backend Integration](compliance/SOC2_FHIR_COMPLIANCE_AUDIT.md) — _owner: Compliance · review: needs-review · updated: 2026-02-04_
- [WCAG 2.1 AA Accessibility Audit](compliance/WCAG_21_AA_AUDIT.md) — _owner: Compliance · review: needs-review · updated: 2026-02-10_
- [Information Security Policy](compliance/soc2-policies/01_information_security_policy.md) — _owner: Compliance · review: needs-review · updated: 2026-04-21_
- [Access Control Policy](compliance/soc2-policies/02_access_control_policy.md) — _owner: Compliance · review: needs-review · updated: 2026-04-21_
- [Incident Response Policy](compliance/soc2-policies/03_incident_response_policy.md) — _owner: Compliance · review: needs-review · updated: 2026-04-21_
- [Business Continuity & Disaster Recovery Policy](compliance/soc2-policies/04_business_continuity_disaster_recovery_policy.md) — _owner: Compliance · review: needs-review · updated: 2026-04-21_
- [Data Classification & Retention Policy](compliance/soc2-policies/05_data_classification_retention_policy.md) — _owner: Compliance · review: needs-review · updated: 2026-04-21_
- [Change Management Policy](compliance/soc2-policies/06_change_management_policy.md) — _owner: Compliance · review: needs-review · updated: 2026-04-21_
- [Vendor Risk Management Policy](compliance/soc2-policies/07_vendor_risk_management_policy.md) — _owner: Compliance · review: needs-review · updated: 2026-04-21_
- [Acceptable Use Policy](compliance/soc2-policies/08_acceptable_use_policy.md) — _owner: Compliance · review: needs-review · updated: 2026-04-21_

### conversations

- [Session Handoff — 2026-04-21](conversations/2026-04-21-session-handoff.md)
- [Conversation — SOC 2 Readiness, Anthropic Outreach, and a Year of Reflection](conversations/2026-04-21-soc2-readiness-and-reflection.md)

### database

- [Database Migration Guide](database/MIGRATION_GUIDE.md)
- [Multi-Tenancy Guide](database/MULTITENANCY.md)
- [Question Tables Usage Strategy](database/RECOMMENDED_TABLE_USAGE.md)
- [WellFit Multi-Tenant Setup Guide](database/TENANT_SETUP.md)

### demo

- [Anthology Fund Demo Video Script](demo/ANTHOLOGY_FUND_DEMO_SCRIPT.md)
- [Demo Readiness Report](demo/DEMO_READINESS.md)
- [Hospital Demo - Discharge-to-Wellness Bridge](demo/HOSPITAL_DEMO_GUIDE.md)

### dental-module

- [Dental Module Billing & Reimbursement Integration Guide](dental-module/BILLING_INTEGRATION_GUIDE.md)
- [Dental Health Module: Evaluation & Impact Measurement Plan](dental-module/EVALUATION_AND_IMPACT_PLAN.md)
- [Dental Health Module: Grant Justification & Funder Positioning](dental-module/GRANT_JUSTIFICATION.md)
- [Letter of Support Template: Dental Health Module](dental-module/LETTER_OF_SUPPORT_TEMPLATE.md)
- [Dental Health Module: Sustainability Plan](dental-module/SUSTAINABILITY_PLAN.md)

### features

- [AI Dashboard Integration Summary](features/ai-dashboard.md)
- [Authentication System](features/authentication.md)
- [Setting Up the Emergency Alert Trigger](features/emergency-alerts.md)
- [AI-Enhanced FHIR Integration for WellFit Community](features/fhir-ai.md)
- [🧠 FHIR Form Builder - User Guide](features/fhir-form-builder.md)
- [Frequent Flyer Readmission Prevention System](features/frequent-flyer-system.md)
- [WellFit Community Healthcare Metric System](features/metric-system.md)
- [Navigate to your project root](features/patient-handoff.md)
- [WellFit Holistic Risk Assessment Framework](features/risk-framework.md)

### governance

- [ENVISION Atlus — IP Attestation Registry](governance/IP_ATTESTATIONS.md)

### grants

- [2026 Funding Opportunities for WellFit/Envision Atlus](grants/2026_FUNDING_OPPORTUNITIES.md)
- [AHRQ R21/R33 Pilot Site & Academic Partner Prospects](grants/AHRQ_PILOT_PROSPECTS.md)
- [AHRQ PA-24-266: Using Innovative Digital Healthcare Solutions](grants/AHRQ_R21_R33_APPLICATION.md)
- [AHRQ R21/R33 Application Executive Summary](grants/AHRQ_R21_R33_EXECUTIVE_SUMMARY.md)
- [CMS ACCESS Model Application](grants/CMS_ACCESS_MODEL_APPLICATION.md)
- [CMS ACCESS Model Application - Executive Summary](grants/CMS_ACCESS_MODEL_EXECUTIVE_SUMMARY.md)
- [Envision Atlus & Combined Platform Grant Opportunities](grants/ENVISION_ATLUS_GRANTS.md)
- [Letters of Support](grants/LETTERS_OF_SUPPORT.md)
- [NIH PAR-25-170 Capability Mapping](grants/NIH_PAR-25-170_CAPABILITY_MAPPING.md)
- [NIH PAR-25-170 Grant Application - Executive Summary](grants/NIH_PAR-25-170_EXECUTIVE_SUMMARY.md)
- [NIH Grant Application: PAR-25-170](grants/NIH_PAR-25-170_GRANT_APPLICATION.md)
- [Rural Partner Prospect Tracking](grants/PROSPECT_TRACKING.md)
- [Rural Health Grants & Funding Opportunities 2026](grants/RURAL_HEALTH_GRANTS_2026.md)
- [Rural Healthcare Partnership Grants for 2026](grants/RURAL_HEALTH_PARTNERSHIP_GRANTS.md)
- [Rural Partner Outreach Materials](grants/RURAL_PARTNER_OUTREACH.md)
- [Texas Rural Health Prospect List](grants/TEXAS_PROSPECT_LIST.md)
- [USDA Distance Learning and Telemedicine (DLT) Grant Application](grants/USDA_DLT_GRANT_APPLICATION.md)
- [WellFit Community Daily Complete Platform](grants/WellFit-Grant-Funding-Assessment-2025.md)

### guides

- [How to Build a WebAuthn/Passkey Biometric Login System](guides/PASSKEY_BIOMETRIC_BUILD_GUIDE.md)
- [Amazfit — Setup Guide](guides/device-setup/amazfit-setup.md)
- [Apple Watch — Setup Guide](guides/device-setup/apple-healthkit-setup.md)
- [Bluetooth Medical Devices — Setup Guide](guides/device-setup/ble-medical-devices.md)
- [Fitbit — Setup Guide](guides/device-setup/fitbit-setup.md)
- [Garmin — Setup Guide](guides/device-setup/garmin-setup.md)
- [iHealth — Setup Guide](guides/device-setup/ihealth-setup.md)
- [Samsung Galaxy Watch — Setup Guide](guides/device-setup/samsung-health-setup.md)
- [Withings — Setup Guide](guides/device-setup/withings-setup.md)

### insights

- [Claude Code Insights Report — 2026-04-21](insights/CLAUDE_CODE_INSIGHTS_2026-04-21.md)

### methodology

- [MCP Protocol-Level Governance](methodology/MCP_PROTOCOL_GOVERNANCE.md)
- [Methodology Distribution Plan](methodology/METHODOLOGY_DISTRIBUTION_PLAN.md)

### migrations

- [Legacy JWT Key Cutover Plan](migrations/legacy-jwt-key-cutover.md)

### nurseos

- [ADR-001: Emotional Resilience Hub Architecture](nurseos/ADR-001-resilience-hub-architecture.md)
- [Burnout Assessment Guide](nurseos/BURNOUT_ASSESSMENT_GUIDE.md)
- [Cultural Competence Commitment - WellFit Resilience Hub](nurseos/CULTURAL_COMPETENCE_COMMITMENT.md)
- [✅ Resilience Hub - Database Deployment COMPLETE](nurseos/DEPLOYMENT_COMPLETE.md)
- [NurseOS Emotional Resilience Hub - Executive Summary](nurseos/EXECUTIVE_SUMMARY.md)
- [Emotional Resilience Hub - Implementation Roadmap](nurseos/IMPLEMENTATION_ROADMAP.md)
- [Multilingual Support - Resilience Hub](nurseos/MULTILINGUAL_SUPPORT.md)
- [NurseOS Dual Product Line Strategy](nurseos/PRODUCT_LINE_STRATEGY.md)
- [Quick Start Guide - Build Emotional Resilience Hub NOW](nurseos/QUICK_START_GUIDE.md)
- [ZERO TECH DEBT CHECKLIST ⚠️](nurseos/ZERO_TECH_DEBT_CHECKLIST.md)
- [NurseOS Target Audience Decision Document](nurseos/target-audience-decision.md)
- [TypeScript Types Specification - NurseOS Resilience Hub](nurseos/typescript-types-spec.md)

### operations

- [Incident Playbooks](operations/INCIDENT_PLAYBOOKS.md)

### outreach

- [Anthropic Outreach Package](outreach/ANTHROPIC_OUTREACH_PACKAGE.md)
- [Florida Rural Health Transformation (RHT) Vendor Outreach](outreach/FLORIDA_RHT_VENDOR_OUTREACH.md)
- [Texas Rural Health Transformation (RHT) Vendor Outreach](outreach/TEXAS_RHT_VENDOR_OUTREACH.md)
- [Envision VirtualEdge Group](outreach/attachments/CAPABILITY_STATEMENT.md)

### patent

- [Patent Specification — AI-Governed Clinical Orchestration System](patent/PATENT_SPECIFICATION_MCP_ORCHESTRATION.md)
- [Patent Specification — Intelligent Healthcare Data Migration with DNA Fingerprinting](patent/PATENT_SPECIFICATION_MIGRATION_ENGINE.md)
- [System Assessment — Claude Opus 4.6](patent/SYSTEM_ASSESSMENT_CLAUDE_OPUS.md)

### plans

- [Predictive Bed Management System - Architecture Plan](plans/PREDICTIVE_BED_MANAGEMENT.md)
- [Passkey/Biometric Login Fix — Implementation Plan](plans/passkey-biometric-login-fix-plan.md)

### product

- [Claude Care Assistant - Quick Start Guide](product/CLAUDE_CARE_ASSISTANT_QUICK_START.md)
- [AI-Powered DRG Grouper — Product Strategy](product/DRG_GROUPER_STRATEGY.md)
- [Epic App Orchard Application - WellFit Community](product/EPIC_APP_ORCHARD_APPLICATION.md)
- [Epic Integration Guide for WellFit Community](product/EPIC_INTEGRATION_GUIDE.md)
- [Feature Dashboards Reference](product/FEATURE_DASHBOARDS.md)
- [WellFit + Envision Atlus Platform Feature Highlights](product/PLATFORM_FEATURE_HIGHLIGHTS.md)
- [External Referral & Reporting System](product/REFERRAL_SYSTEM.md)
- [Registration Flows](product/REGISTRATION_FLOWS.md)
- [Voice Command Infrastructure (ATLUS: Intuitive Technology)](product/VOICE_COMMANDS.md)

### security

- [HIPAA Security Compliance Scan Results](security/HIPAA_SECURITY_SCAN_RESULTS.md)
- [Multi-Tenant Isolation Security Analysis](security/MULTI_TENANT_SECURITY_ANALYSIS.md)
- [Security Overview](security/OVERVIEW.md)
- [Security Policy](security/SECURITY.md)
- [Software Bill of Materials (SBOM) Summary](security/sbom-summary.md)

### security-audits

- [Adversarial Audit Report — 2026-04-20](security-audits/ADVERSARIAL_AUDIT_2026-04-20.md)
- [Claude for Healthcare Enhancement Audit Report](security-audits/CLAUDE_HEALTHCARE_AUDIT_2026-01-16.md)
- [Claude for Healthcare Audit Report — February 2026](security-audits/CLAUDE_HEALTHCARE_AUDIT_2026-02-08.md)
- [Claude for Healthcare — Gap](security-audits/CLAUDE_HEALTHCARE_TRACKER_2026-02.md)
- [HIPAA Security Compliance Scan Report](security-audits/HIPAA_SECURITY_SCAN_2026-01-09.md)
- [HIPAA Security Compliance Scan — 2026-04-11](security-audits/HIPAA_SECURITY_SCAN_2026-04-11.md)

### trackers

- [Adversarial Audit Remediation Tracker](trackers/adversarial-audit-tracker.md)
- [Patient Avatar Improvement Tracker](trackers/avatar-improvement-tracker.md)
- [BLE / RPM / Wearable Device Tracker](trackers/ble-rpm-wearable-tracker.md)
- [Cardiology Module Build Tracker](trackers/cardiology-module-tracker.md)
- [ChatGPT Audit Gaps Tracker](trackers/chatgpt-audit-gaps-tracker.md)
- [Claude-in-Claude Triage Intelligence Tracker](trackers/claude-in-claude-triage-tracker.md)
- [Claude Self-Audit Remediation Tracker (2026-05-20)](trackers/claude-self-audit-2026-05-20-tracker.md)
- [Clinical-Logic Adversarial Audit — 2026-06-01](trackers/clinical-logic-adversarial-audit-2026-06-01.md)
- [Clinical Validation Hooks Tracker](trackers/clinical-validation-hooks-tracker.md)
- [Compass Riley — Ambient Learning & Physician Intuition Engine](trackers/compass-riley-ambient-learning-tracker.md)
- [Compass Riley — Clinical Reasoning Hardening Tracker](trackers/compass-riley-reasoning-tracker.md)
- [Compass Riley V2 — Chain of Thought / Tree of Thought Reasoning Modes](trackers/compass-riley-v2-reasoning-modes-tracker.md)
- [Cultural Competency MCP Server — Tracker](trackers/cultural-competency-mcp-tracker.md)
- [DB-Reference Drift Triage — `table::` half (second pass)](trackers/db-reference-drift-table-pass-tracker.md)
- [DB-Reference Drift Triage Tracker — `rpc::` half](trackers/db-reference-drift-triage-tracker.md)
- [Edge-Function `verify_jwt` Reconciliation + Health-Check Sweep](trackers/edge-function-verify-jwt-reconciliation-tracker.md)
- [Edge-Function SDK Hygiene Tracker](trackers/edge-sdk-hygiene-tracker.md)
- [Engineering-Quality Findings — 2026-06-07](trackers/engineering-quality-findings-2026-06-07.md)
- [Envision Admin Panel Hardening Tracker](trackers/envision-admin-panel-hardening-tracker.md)
- [Tracker — Equity & Population-Health Analytics Query System](trackers/equity-analytics-query-system-tracker.md)
- [Failing Edge Functions — Boot-Crash Repair](trackers/failing-edge-functions-repair-tracker.md)
- [God File Decomposition Tracker](trackers/god-file-decomposition-tracker.md)
- [God-File Refactor Findings Tracker](trackers/god-file-refactor-findings-tracker.md)
- [Guardian Agent & Guardian Eyes — Audit & Hardening Tracker](trackers/guardian-agent-audit-tracker.md)
- [Guardian ↔ Behavioral-Anomaly Integration Tracker](trackers/guardian-anomaly-integration-tracker.md)
- [Guardian Overnight SMS Alert Delivery — Finish at Laptop](trackers/guardian-sms-alert-delivery-tracker.md)
- [Guardian Agent & Guardian Eyes — Gap Closure Tracker](trackers/guardian-system-tracker.md)
- [Labor & Delivery Module — Build Tracker](trackers/ld-module-tracker.md)
- [Live Integration Testing Tracker](trackers/live-integration-testing-tracker.md)
- [MCP Blind Spots & Remediation Tracker](trackers/mcp-blind-spots-tracker.md)
- [MCP Chain Completion Tracker — Final Gaps](trackers/mcp-chain-completion-tracker.md)
- [MCP Completion Tracker — Full Ecosystem Wiring](trackers/mcp-completion-tracker.md)
- [MCP Hardening Tracker](trackers/mcp-hardening-tracker.md)
- [MCP Infrastructure Repair Tracker](trackers/mcp-infrastructure-repair-tracker.md)
- [MCP Production Readiness Tracker](trackers/mcp-production-readiness-tracker.md)
- [MCP Server Compliance & Hardening Tracker](trackers/mcp-server-compliance-tracker.md)
- [Migration System Hardening Tracker](trackers/migration-system-hardening-tracker.md)
- [Nephrology Module Build Tracker](trackers/nephrology-module-tracker.md)
- [Nurse Handoff & Documentation Build Tracker](trackers/nurse-handoff-documentation-tracker.md)
- [NurseOS Intelligent Panel — Completion Tracker](trackers/nurseos-completion-tracker.md)
- [ONC 170.315 Certification Gap Tracker](trackers/onc-certification-tracker.md)
- [Oncology Module Build Tracker](trackers/oncology-module-tracker.md)
- [Optometry Vertical Readiness Tracker](trackers/optometry-vertical-readiness-tracker.md)
- [Passkey/Biometric Login Fix — Tracker](trackers/passkey-biometric-fix-tracker.md)
- [Patient Context Service Adoption Tracker](trackers/patient-context-adoption-tracker.md)
- [Python AI/ML Integration — Concerted, Governed, Reversible](trackers/python-ai-integration-tracker.md)
- [Security-Scan Findings — 2026-06-09](trackers/security-scan-findings-2026-06-09.md)
- [SOC 2 Readiness Tracker — Policy & Evidence Gap Closure](trackers/soc2-readiness-tracker.md)
- [System Gaps Tracker](trackers/system-gaps-tracker.md)
- [Tech Debt Elimination Tracker](trackers/tech-debt-elimination-tracker.md)
- [Tenant Admin Panel Improvement Tracker](trackers/tenant-admin-panel-tracker.md)
- [Tenant Branding Migration Tracker](trackers/tenant-branding-tracker.md)
- [Unconnected Clinical Panels — Review & Approval](trackers/unconnected-clinical-panels-review-2026-06-12.md)

<!-- AUTO-INDEX:END -->
