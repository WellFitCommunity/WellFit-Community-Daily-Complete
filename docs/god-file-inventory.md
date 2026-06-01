# God File Inventory — Files Over 600 Lines

> **Generated:** 2026-05-29 via `find + wc` (live scan, not a stale snapshot).
> **Rule:** CLAUDE.md Commandment #12 — 600-line max per file.
> **Excludes:** test files (`__tests__`, `*.test.*`) and the auto-generated `src/types/database.generated.ts` (62k lines, not hand-maintained).
> **Companion:** `docs/trackers/god-file-decomposition-tracker.md` (the workplan + cadence).

## Summary

| Bucket | Count | Decomposition effort |
|--------|------:|----------------------|
| 600–799 lines | 129 | Easiest — extract one cohesive sub-module |
| 800–999 lines | 40 | Service + 2–3 helper modules |
| 1000–1499 lines | 7 | Real architectural decomposition |
| 1500+ lines | 0 | (none) |
| **TOTAL** | **176** | — |

By surface: **157** in `src/` · **19** in `supabase/functions/`. (Was 181/162 before 5 Tier-1 services — `readmissionRiskPredictor.ts`, `healthcareIntegrationsService.ts`, `hospitalWorkforceService.ts`, `antimicrobialSurveillanceService.ts`, `epcsService.ts` — were decomposed.)

**Already decomposed (2026-05-29, no longer in this list):** `bulk-export/index.ts` (868→175), `ccda-export/index.ts` (836→6 modules), `src/services/ai/readmissionRiskPredictor.ts` (1340→487, 5 modules in `readmission-predictor/`).

## Priority guide

- **🔴 1000+ lines** — highest priority, real architectural splits.
- **🟠 800–999 lines** — medium; tackle opportunistically when touching the file.
- **🟢 600–799 lines** — lowest; one sub-module extraction each, do when nearby.

## Full inventory (largest first)

| # | Lines | Tier | Surface | File |
|--:|------:|:----:|:-------:|------|
| ~~1~~ | ~~1340~~ | ✅ | src | ~~`src/services/ai/readmissionRiskPredictor.ts`~~ — DONE 2026-05-29 (→487, 5 modules) |
| ~~2~~ | ~~1258~~ | ✅ | src | ~~`src/services/healthcareIntegrationsService.ts`~~ — DONE 2026-06-01 (→93, 4 domain modules) |
| ~~3~~ | ~~1217~~ | ✅ | src | ~~`src/services/hospitalWorkforceService.ts`~~ — DONE 2026-06-01 (→151, 6 modules) |
| ~~4~~ | ~~1147~~ | ✅ | src | ~~`src/services/publicHealth/antimicrobialSurveillanceService.ts`~~ — DONE 2026-06-01 (→78, 4 modules) |
| ~~5~~ | ~~1134~~ | ✅ | src | ~~`src/services/epcsService.ts`~~ — DONE 2026-06-01 (→94, 7 modules) |
| 6 | 1119 | 🔴 | src | `src/services/publicHealth/ecrService.ts` |
| 7 | 1110 | 🔴 | src | `src/components/admin/TemplateMaker.tsx` |
| 8 | 1100 | 🔴 | src | `src/services/claudeService.ts` |
| 9 | 1081 | 🔴 | src | `src/services/fhirInteroperabilityIntegrator.ts` |
| 10 | 1017 | 🔴 | src | `src/services/mcp/mcpHL7X12Client.ts` |
| 11 | 1010 | 🔴 | src | `src/services/mpiMatchingService.ts` |
| 12 | 1004 | 🔴 | edge | `supabase/functions/ai-treatment-pathway/index.ts` |
| 13 | 997 | 🟠 | src | `src/services/publicHealth/immunizationRegistryService.ts` |
| 14 | 973 | 🟠 | src | `src/services/fhirSyncIntegration.ts` |
| 15 | 971 | 🟠 | src | `src/pages/EnvisionLoginPage.tsx` |
| 16 | 967 | 🟠 | src | `src/services/guardian-agent/ExecutionSandbox.ts` |
| 17 | 967 | 🟠 | src | `src/components/admin/UsersList.tsx` |
| 18 | 962 | 🟠 | edge | `supabase/functions/ai-progress-note-synthesizer/index.ts` |
| 19 | 958 | 🟠 | edge | `supabase/functions/ai-infection-risk-predictor/index.ts` |
| 20 | 955 | 🟠 | src | `src/components/physician/PhysicianPanel.tsx` |
| 21 | 953 | 🟠 | src | `src/services/pdmpService.ts` |
| 22 | 951 | 🟠 | src | `src/services/ai/fallRiskPredictorService.ts` |
| 23 | 945 | 🟠 | src | `src/services/ai/ccmEligibilityScorer.ts` |
| 24 | 936 | 🟠 | src | `src/components/vitals/VitalCapture.tsx` |
| 25 | 935 | 🟠 | src | `src/services/publicHealth/syndromicSurveillanceService.ts` |
| 26 | 931 | 🟠 | src | `src/components/migration/EnterpriseMigrationDashboard.tsx` |
| 27 | 929 | 🟠 | src | `src/services/dentalHealthService.ts` |
| 28 | 916 | 🟠 | src | `src/services/medicationTrackingService.ts` |
| 29 | 908 | 🟠 | src | `src/services/mpiMergeService.ts` |
| 30 | 892 | 🟠 | src | `src/pages/LoginPage.tsx` |
| 31 | 888 | 🟠 | src | `src/services/parkinsonsService.ts` |
| 32 | 886 | 🟠 | src | `src/components/migration/MigrationFeedbackSurvey.tsx` |
| 33 | 876 | 🟠 | src | `src/hooks/useFhirData.ts` |
| 34 | 875 | 🟠 | src | `src/services/sdohBillingService.ts` |
| 35 | 867 | 🟠 | edge | `supabase/functions/ai-missed-checkin-escalation/index.ts` |
| 36 | 867 | 🟠 | src | `src/services/neuroSuiteService.ts` |
| 37 | 863 | 🟠 | src | `src/services/guardian-agent/AgentBrain.ts` |
| 38 | 860 | 🟠 | src | `src/services/guardian-agent/SchemaValidator.ts` |
| 39 | 850 | 🟠 | src | `src/services/mentalHealthService.ts` |
| 40 | 848 | 🟠 | src | `src/routes/routeConfig.ts` |
| 41 | 846 | 🟠 | src | `src/components/handoff/AdminTransferLogs.tsx` |
| 42 | 841 | 🟠 | src | `src/services/unifiedBillingService.ts` |
| 43 | 838 | 🟠 | src | `src/services/ai/fieldVisitOptimizerService.ts` |
| 44 | 833 | 🟠 | src | `src/components/dashboard/SeniorCommunityDashboard.tsx` |
| 45 | 832 | 🟠 | src | `src/services/claudeCareAssistant.ts` |
| 46 | 826 | 🟠 | src | `src/services/dischargeToWellnessBridge.ts` |
| 47 | 815 | 🟠 | edge | `supabase/functions/pdf-health-summary/index.ts` |
| 48 | 815 | 🟠 | src | `src/services/chwService.ts` |
| 49 | 811 | 🟠 | src | `src/services/ai/batchInference.ts` |
| 50 | 807 | 🟠 | edge | `supabase/functions/ai-fall-risk-predictor/index.ts` |
| 51 | 807 | 🟠 | src | `src/services/notificationService.ts` |
| 52 | 807 | 🟠 | src | `src/components/admin/PatientMergeWizard.tsx` |
| 53 | 797 | 🟢 | src | `src/components/ems/ERIncomingPatientBoard.tsx` |
| 54 | 796 | 🟢 | src | `src/components/billing/BillingReviewDashboard.tsx` |
| 55 | 794 | 🟢 | src | `src/components/telehealth/AppointmentAnalyticsDashboard.tsx` |
| 56 | 793 | 🟢 | edge | `supabase/functions/ai-care-escalation-scorer/index.ts` |
| 57 | 788 | 🟢 | src | `src/services/wearableService.ts` |
| 58 | 787 | 🟢 | src | `src/pages/AdminLoginPage.tsx` |
| 59 | 786 | 🟢 | src | `src/services/lawEnforcementService.ts` |
| 60 | 786 | 🟢 | src | `src/services/guardian-agent/TokenAuth.ts` |
| 61 | 785 | 🟢 | src | `src/services/superAdminService.ts` |
| 62 | 781 | 🟢 | src | `src/services/mcp/mcpClearinghouseClient.ts` |
| 63 | 781 | 🟢 | src | `src/components/telehealth/TelehealthScheduler.tsx` |
| 64 | 779 | 🟢 | src | `src/services/specialist-workflow-engine/offline-sync/FHIRMapper.ts` |
| 65 | 777 | 🟢 | src | `src/components/dental/DentalHealthDashboard.tsx` |
| 66 | 774 | 🟢 | src | `src/services/mcp/mcpFHIRClient.ts` |
| 67 | 768 | 🟢 | src | `src/services/noShowDetectionService.ts` |
| 68 | 763 | 🟢 | src | `src/services/workflowPreferences.ts` |
| 69 | 761 | 🟢 | src | `src/services/consentManagementService.ts` |
| 70 | 760 | 🟢 | src | `src/services/alertNotificationService.ts` |
| 71 | 758 | 🟢 | src | `src/utils/offlineStorage.ts` |
| 72 | 757 | 🟢 | src | `src/services/x12997Parser.ts` |
| 73 | 753 | 🟢 | src | `src/services/ai/dischargeSummaryService.ts` |
| 74 | 752 | 🟢 | src | `src/types/sdohIndicators.ts` |
| 75 | 752 | 🟢 | src | `src/services/patientFriendlyAVSService.ts` |
| 76 | 751 | 🟢 | src | `src/components/handoff/LiteSenderFormSteps.tsx` |
| 77 | 750 | 🟢 | edge | `supabase/functions/_shared/promptABTesting.ts` |
| 78 | 748 | 🟢 | src | `src/components/admin/ReportsSection.tsx` |
| 79 | 744 | 🟢 | src | `src/services/ai/billingCodeSuggester.ts` |
| 80 | 741 | 🟢 | src | `src/types/tenantModules.ts` |
| 81 | 741 | 🟢 | src | `src/services/voiceSearchService.ts` |
| 82 | 739 | 🟢 | src | `src/services/ai/treatmentPathwayService.ts` |
| 83 | 738 | 🟢 | src | `src/services/guardian-agent/ToolRegistry.ts` |
| 84 | 737 | 🟢 | src | `src/components/migration/MappingReviewUI.tsx` |
| 85 | 736 | 🟢 | src | `src/services/deviceService.ts` |
| 86 | 732 | 🟢 | src | `src/components/admin/FacilityManagementPanel.tsx` |
| 87 | 731 | 🟢 | edge | `supabase/functions/smart-authorize/index.ts` |
| 88 | 730 | 🟢 | src | `src/types/neuroSuite.ts` |
| 89 | 730 | 🟢 | src | `src/services/betaProgramService.ts` |
| 90 | 730 | 🟢 | src | `src/services/ai/appointmentPrepInstructionsService.ts` |
| 91 | 729 | 🟢 | src | `src/components/superAdmin/TenantManagementPanel.tsx` |
| 92 | 728 | 🟢 | src | `src/services/guardian-agent/PHIEncryption.ts` |
| 93 | 726 | 🟢 | src | `src/services/migration-engine/MappingIntelligence.ts` |
| 94 | 726 | 🟢 | src | `src/services/communicationSilenceWindowService.ts` |
| 95 | 725 | 🟢 | src | `src/components/atlas/FrequentFlyerDashboard.tsx` |
| 96 | 722 | 🟢 | src | `src/services/ai/accuracyTrackingService.ts` |
| 97 | 718 | 🟢 | src | `src/services/holisticRiskAssessment.ts` |
| 98 | 717 | 🟢 | src | `src/services/handoffService.ts` |
| 99 | 715 | 🟢 | src | `src/services/specialist-workflow-engine/offline-sync/EnterpriseOfflineDataSync.ts` |
| 100 | 715 | 🟢 | src | `src/services/physicalTherapyService.ts` |
| 101 | 712 | 🟢 | src | `src/components/admin/BulkEnrollmentPanel.tsx` |
| 102 | 711 | 🟢 | src | `src/components/superAdmin/TenantCreationWizard.tsx` |
| 103 | 709 | 🟢 | src | `src/services/x12997Service.ts` |
| 104 | 707 | 🟢 | edge | `supabase/functions/bed-optimizer/index.ts` |
| 105 | 707 | 🟢 | src | `src/services/ai/sdohPassiveDetector.ts` |
| 106 | 707 | 🟢 | src | `src/components/mental-health/MentalHealthDashboard.tsx` |
| 107 | 705 | 🟢 | src | `src/services/ai/progressNoteSynthesizerService.ts` |
| 108 | 700 | 🟢 | src | `src/components/referrals/ReferralsDashboard.tsx` |
| 109 | 699 | 🟢 | edge | `supabase/functions/ai-fhir-semantic-mapper/index.ts` |
| 110 | 695 | 🟢 | src | `src/components/admin/FHIRConflictResolution.tsx` |
| 111 | 694 | 🟢 | src | `src/services/transferCenterService.ts` |
| 112 | 694 | 🟢 | src | `src/components/superAdmin/SuperAdminTenantModuleConfig.tsx` |
| 113 | 693 | 🟢 | src | `src/components/patient/MedicationRequestManager.tsx` |
| 114 | 690 | 🟢 | src | `src/components/admin/RiskAssessmentForm.tsx` |
| 115 | 689 | 🟢 | edge | `supabase/functions/user-data-management/index.ts` |
| 116 | 688 | 🟢 | src | `src/services/specialist-workflow-engine/offline-sync/types.ts` |
| 117 | 683 | 🟢 | src | `src/components/neuro/NeuroSuiteDashboard.tsx` |
| 118 | 678 | 🟢 | src | `src/pages/AIHelpPage.tsx` |
| 119 | 678 | 🟢 | src | `src/components/ai/AIRevenueDashboard.tsx` |
| 120 | 677 | 🟢 | src | `src/components/lawEnforcement/ConstableDispatchDashboard.tsx` |
| 121 | 676 | 🟢 | src | `src/services/offlineAudioService.ts` |
| 122 | 672 | 🟢 | src | `src/services/bedManagementService.ts` |
| 123 | 671 | 🟢 | src | `src/pages/SettingsPage.tsx` |
| 124 | 670 | 🟢 | src | `src/components/vitals/useCameraScan.ts` |
| 125 | 669 | 🟢 | src | `src/services/ai/welfareCheckDispatcher.ts` |
| 126 | 668 | 🟢 | src | `src/components/lawEnforcement/SeniorEmergencyInfoForm.tsx` |
| 127 | 667 | 🟢 | src | `src/services/guardian-agent/AISystemRecorder.ts` |
| 128 | 664 | 🟢 | src | `src/components/chw/CHWVitalsCapture.tsx` |
| 129 | 662 | 🟢 | src | `src/services/guardianFlowEngine.ts` |
| 130 | 660 | 🟢 | src | `src/services/ai/readmissionModelConfig.ts` |
| 131 | 659 | 🟢 | edge | `supabase/functions/ai-patient-qa-bot/index.ts` |
| 132 | 659 | 🟢 | src | `src/components/search/GlobalSearchBar.tsx` |
| 133 | 657 | 🟢 | src | `src/services/ai/emergencyAccessIntelligence.ts` |
| 134 | 657 | 🟢 | src | `src/components/neuro-suite/MemoryClinicDashboard.tsx` |
| 135 | 656 | 🟢 | src | `src/services/medicationLabelReader.ts` |
| 136 | 655 | 🟢 | src | `src/types/patientContext.ts` |
| 137 | 650 | 🟢 | src | `src/components/handoff/ReceivingDashboard.tsx` |
| 138 | 649 | 🟢 | src | `src/services/pillIdentifierService.ts` |
| 139 | 648 | 🟢 | edge | `supabase/functions/ai-referral-letter/index.ts` |
| 140 | 646 | 🟢 | src | `src/services/securityAutomationService.ts` |
| 141 | 645 | 🟢 | src | `src/adapters/implementations/EpicFHIRAdapter.ts` |
| 142 | 643 | 🟢 | src | `src/components/patient/PillIdentifier.tsx` |
| 143 | 642 | 🟢 | src | `src/services/ai/billingOptimizationEngineService.ts` |
| 144 | 641 | 🟢 | src | `src/components/admin/HospitalAdapterManagementPanel.tsx` |
| 145 | 640 | 🟢 | src | `src/services/sensitiveDataService.ts` |
| 146 | 639 | 🟢 | src | `src/services/ai/readmission/explainability.ts` |
| 147 | 639 | 🟢 | src | `src/components/billing/SDOHCoderAssist.tsx` |
| 148 | 638 | 🟢 | src | `src/components/physicalTherapy/PhysicalTherapyDashboard.tsx` |
| 149 | 637 | 🟢 | src | `src/pages/HospitalTransferPortal.tsx` |
| 150 | 635 | 🟢 | src | `src/pages/SeniorViewPage.tsx` |
| 151 | 634 | 🟢 | src | `src/components/careCoordination/CareCoordinationDashboard.tsx` |
| 152 | 631 | 🟢 | src | `src/services/ai/clinicalGuidelineMatcherService.ts` |
| 153 | 630 | 🟢 | edge | `supabase/functions/ai-schedule-optimizer/index.ts` |
| 154 | 630 | 🟢 | src | `src/services/ai/optimizedPrompts.ts` |
| 155 | 630 | 🟢 | src | `src/i18n/translations.ts` |
| 156 | 628 | 🟢 | src | `src/services/readmissionTrackingService.ts` |
| 157 | 628 | 🟢 | src | `src/components/questionnaires/QuestionnaireAnalyticsDashboard.tsx` |
| 158 | 627 | 🟢 | edge | `supabase/functions/_shared/phiDeidentifier.ts` |
| 159 | 627 | 🟢 | src | `src/services/migration-engine/IntelligentMigrationService.ts` |
| 160 | 626 | 🟢 | src | `src/components/admin/TenantConfigHistory.tsx` |
| 161 | 624 | 🟢 | src | `src/components/ai/HealthcareAlgorithmsDashboard.tsx` |
| 162 | 622 | 🟢 | edge | `supabase/functions/mcp-drg-grouper-server/drgGrouperHandlers.ts` |
| 163 | 622 | 🟢 | src | `src/services/guardian-agent/AuditLogger.ts` |
| 164 | 622 | 🟢 | src | `src/i18n/resilienceHubTranslations.ts` |
| 165 | 621 | 🟢 | src | `src/services/evsService.ts` |
| 166 | 619 | 🟢 | src | `src/services/fhirSecurityService.ts` |
| 167 | 618 | 🟢 | src | `src/services/rolloutService.ts` |
| 168 | 616 | 🟢 | src | `src/services/ai/medicationInstructionsService.ts` |
| 169 | 613 | 🟢 | src | `src/hooks/useFHIRIntegration.ts` |
| 170 | 612 | 🟢 | src | `src/services/specialist-workflow-engine/offline-sync/ConflictResolution.ts` |
| 171 | 611 | 🟢 | src | `src/components/patient/ImmunizationEntry.tsx` |
| 172 | 607 | 🟢 | edge | `supabase/functions/mcp-medical-coding-server/drgGrouperHandlers.ts` |
| 173 | 607 | 🟢 | src | `src/services/seniorDataService.ts` |
| 174 | 605 | 🟢 | src | `src/services/patientOutreachService.ts` |
| 175 | 604 | 🟢 | src | `src/services/guardian-agent/GuardianAlertService.ts` |
| 176 | 604 | 🟢 | src | `src/hooks/useRealtimeSubscription.ts` |
| 177 | 602 | 🟢 | edge | `supabase/functions/ai-medication-reconciliation/index.ts` |
| 178 | 602 | 🟢 | src | `src/components/patient/WearableDashboard.tsx` |
| 179 | 601 | 🟢 | src | `src/components/patient/FhirAiPatientDashboard.tsx` |
| 180 | 601 | 🟢 | src | `src/components/admin/StaffFinancialSavingsTracker.tsx` |
| 181 | 601 | 🟢 | src | `src/components/admin/BedManagementPanel.tsx` |
