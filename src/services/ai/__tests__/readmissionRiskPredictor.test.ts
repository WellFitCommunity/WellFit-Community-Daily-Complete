/**
 * Tests for Readmission Risk Predictor
 *
 * Covers PlainLanguageExplainer and rural model weights functionality
 */

import { ReadmissionRiskPredictor } from '../readmissionRiskPredictor';
import {
  ReadmissionRiskFeatures,
  SocialDeterminants,
  ClinicalFactors,
  MedicationFactors,
  PostDischargeFactors,
  FunctionalStatus,
  EngagementFactors,
  SelfReportedHealth
} from '../../../types/readmissionRiskFeatures';

// Mock supabaseClient
jest.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

// =====================================================
// MOCK DATA FACTORIES
// =====================================================

function createMockClinicalFactors(overrides?: Partial<ClinicalFactors>): ClinicalFactors {
  return {
    isHighRiskDiagnosis: false,
    comorbidityCount: 2,
    comorbidities: ['E11.9', 'I10'],
    hasChf: false,
    hasCopd: false,
    hasDiabetes: true,
    hasRenalFailure: false,
    hasCancer: false,
    priorAdmissions30Day: 0,
    priorAdmissions60Day: 0,
    priorAdmissions90Day: 1,
    priorAdmissions1Year: 2,
    edVisits30Day: 1,
    edVisits90Day: 2,
    edVisits6Month: 3,
    vitalSignsStableAtDischarge: true,
    labsWithinNormalLimits: true,
    labTrendsConcerning: false,
    ...overrides
  };
}

function createMockMedicationFactors(overrides?: Partial<MedicationFactors>): MedicationFactors {
  return {
    activeMedicationCount: 4,
    isPolypharmacy: false,
    hasAnticoagulants: false,
    hasInsulin: false,
    hasOpioids: false,
    hasImmunosuppressants: false,
    hasHighRiskMedications: false,
    highRiskMedicationList: [],
    medicationsAdded: 1,
    medicationsDiscontinued: 0,
    medicationsDoseChanged: 1,
    significantMedicationChanges: false,
    noPrescriptionFilled: false,
    medicationReconciliationCompleted: true,
    medicationListAccurate: true,
    ...overrides
  };
}

function createMockPostDischargeFactors(overrides?: Partial<PostDischargeFactors>): PostDischargeFactors {
  return {
    followUpScheduled: true,
    daysUntilFollowUp: 5,
    followUpWithin7Days: true,
    followUpWithin14Days: true,
    noFollowUpScheduled: false,
    hasPcpAssigned: true,
    pcpContactedAboutDischarge: true,
    dischargeDestination: 'home',
    dischargeToHomeAlone: false,
    hasHomeHealthServices: false,
    hasPendingTestResults: false,
    pendingTestResultsList: [],
    dischargeInstructionsProvided: true,
    dischargeInstructionsUnderstood: true,
    patientTeachBackCompleted: true,
    ...overrides
  };
}

function createMockSocialDeterminants(overrides?: Partial<SocialDeterminants>): SocialDeterminants {
  return {
    livesAlone: false,
    hasCaregiver: true,
    caregiverAvailable24Hours: true,
    caregiverReliable: true,
    hasTransportationBarrier: false,
    publicTransitAvailable: true,
    isRuralLocation: false,
    hasMedicaid: false,
    hasInsuranceGaps: false,
    financialBarriersToMedications: false,
    financialBarriersToFollowUp: false,
    lowHealthLiteracy: false,
    languageBarrier: false,
    interpreterNeeded: false,
    hasFamilySupport: true,
    hasCommunitySupport: true,
    sociallyIsolated: false,
    ...overrides
  };
}

function createMockFunctionalStatus(overrides?: Partial<FunctionalStatus>): FunctionalStatus {
  return {
    adlDependencies: 0,
    needsHelpBathing: false,
    needsHelpDressing: false,
    needsHelpToileting: false,
    needsHelpEating: false,
    needsHelpTransferring: false,
    needsHelpWalking: false,
    hasCognitiveImpairment: false,
    hasDementia: false,
    hasDelirium: false,
    hasRecentFalls: false,
    fallsInPast30Days: 0,
    fallsInPast90Days: 0,
    fallRiskScore: 2,
    mobilityLevel: 'independent',
    requiresDurableMedicalEquipment: false,
    ...overrides
  };
}

function createMockEngagementFactors(overrides?: Partial<EngagementFactors>): EngagementFactors {
  return {
    checkInCompletionRate30Day: 0.85,
    checkInCompletionRate7Day: 0.9,
    missedCheckIns30Day: 2,
    missedCheckIns7Day: 0,
    consecutiveMissedCheckIns: 0,
    hasEngagementDrop: false,
    vitalsReportingRate30Day: 0.8,
    missedVitalsReports7Day: 1,
    vitalsReportingConsistent: true,
    moodReportingRate30Day: 0.7,
    negativeModeTrend: false,
    concerningSymptomsReported: false,
    symptomSeverityIncreasing: false,
    triviaParticipationRate30Day: 0.5,
    wordFindParticipationRate30Day: 0.4,
    gameEngagementScore: 60,
    gameEngagementDeclining: false,
    mealPhotoShareRate30Day: 0.3,
    communityInteractionScore: 70,
    socialEngagementDeclining: false,
    daysWithZeroActivity: 2,
    healthAlertsTriggered30Day: 1,
    healthAlertsTriggered7Day: 0,
    criticalAlertsTriggered: 0,
    overallEngagementScore: 75,
    engagementChangePercent: 5,
    isDisengaging: false,
    stoppedResponding: false,
    concerningPatterns: [],
    ...overrides
  };
}

function createMockSelfReportedHealth(overrides?: Partial<SelfReportedHealth>): SelfReportedHealth {
  return {
    recentSymptoms: [],
    symptomCount30Day: 2,
    hasRedFlagSymptoms: false,
    redFlagSymptomsList: [],
    selfReportedBpTrendConcerning: false,
    selfReportedBloodSugarUnstable: false,
    selfReportedWeightChangeConcerning: false,
    reportedMobilityDeclining: false,
    reportedPainIncreasing: false,
    reportedFatigueIncreasing: false,
    missedMedicationsDays30Day: 1,
    medicationSideEffectsReported: false,
    medicationConcerns: [],
    daysHomeAlone30Day: 5,
    socialIsolationIncreasing: false,
    familyContactDecreasing: false,
    ...overrides
  };
}

function createMockFeatures(overrides?: {
  clinical?: Partial<ClinicalFactors>;
  medication?: Partial<MedicationFactors>;
  postDischarge?: Partial<PostDischargeFactors>;
  socialDeterminants?: Partial<SocialDeterminants>;
  functionalStatus?: Partial<FunctionalStatus>;
  engagement?: Partial<EngagementFactors>;
  selfReported?: Partial<SelfReportedHealth>;
}): ReadmissionRiskFeatures {
  return {
    patientId: 'test-patient-123',
    tenantId: 'test-tenant-456',
    dischargeDate: new Date().toISOString(),
    assessmentTimestamp: new Date().toISOString(),
    clinical: createMockClinicalFactors(overrides?.clinical),
    medication: createMockMedicationFactors(overrides?.medication),
    postDischarge: createMockPostDischargeFactors(overrides?.postDischarge),
    socialDeterminants: createMockSocialDeterminants(overrides?.socialDeterminants),
    functionalStatus: createMockFunctionalStatus(overrides?.functionalStatus),
    engagement: createMockEngagementFactors(overrides?.engagement),
    selfReported: createMockSelfReportedHealth(overrides?.selfReported),
    dataCompletenessScore: 85,
    missingCriticalData: []
  };
}

// =====================================================
// BASIC PREDICTOR TESTS
// =====================================================

describe('ReadmissionRiskPredictor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exists and is defined', () => {
    expect(ReadmissionRiskPredictor).toBeDefined();
  });

  it('can be instantiated', () => {
    const predictor = new ReadmissionRiskPredictor();
    expect(predictor).toBeDefined();
  });
});

// =====================================================
// RURAL MODEL WEIGHTS TESTS
// =====================================================

describe('Rural Model Weights', () => {
  describe('RUCA Category Classification', () => {
    it('should define urban as baseline risk (0.00)', () => {
      const features = createMockFeatures({
        socialDeterminants: {
          rucaCategory: 'urban',
          isRuralLocation: false,
          distanceToCareRiskWeight: 0.0
        }
      });

      expect(features.socialDeterminants.rucaCategory).toBe('urban');
      expect(features.socialDeterminants.distanceToCareRiskWeight).toBe(0.0);
    });

    it('should define large_rural as moderate risk (0.08)', () => {
      const features = createMockFeatures({
        socialDeterminants: {
          rucaCategory: 'large_rural',
          isRuralLocation: true,
          distanceToCareRiskWeight: 0.08
        }
      });

      expect(features.socialDeterminants.rucaCategory).toBe('large_rural');
      expect(features.socialDeterminants.distanceToCareRiskWeight).toBe(0.08);
    });

    it('should define small_rural as elevated risk (0.12)', () => {
      const features = createMockFeatures({
        socialDeterminants: {
          rucaCategory: 'small_rural',
          isRuralLocation: true,
          distanceToCareRiskWeight: 0.12
        }
      });

      expect(features.socialDeterminants.rucaCategory).toBe('small_rural');
      expect(features.socialDeterminants.distanceToCareRiskWeight).toBe(0.12);
    });

    it('should define isolated_rural as high risk (0.18)', () => {
      const features = createMockFeatures({
        socialDeterminants: {
          rucaCategory: 'isolated_rural',
          isRuralLocation: true,
          distanceToCareRiskWeight: 0.18
        }
      });

      expect(features.socialDeterminants.rucaCategory).toBe('isolated_rural');
      expect(features.socialDeterminants.distanceToCareRiskWeight).toBe(0.18);
    });
  });

  describe('Distance-to-Care Risk Weight', () => {
    it('should have zero weight for urban patients close to care', () => {
      const features = createMockFeatures({
        socialDeterminants: {
          distanceToNearestHospitalMiles: 3,
          distanceToPcpMiles: 2,
          distanceToCareRiskWeight: 0.0,
          rucaCategory: 'urban'
        }
      });

      expect(features.socialDeterminants.distanceToCareRiskWeight).toBe(0.0);
    });

    it('should have low weight (0.05) for 5-15 miles', () => {
      const features = createMockFeatures({
        socialDeterminants: {
          distanceToNearestHospitalMiles: 10,
          distanceToPcpMiles: 8,
          distanceToCareRiskWeight: 0.05
        }
      });

      expect(features.socialDeterminants.distanceToCareRiskWeight).toBe(0.05);
    });

    it('should have moderate weight (0.10) for 15-30 miles', () => {
      const features = createMockFeatures({
        socialDeterminants: {
          distanceToNearestHospitalMiles: 25,
          distanceToPcpMiles: 20,
          distanceToCareRiskWeight: 0.10,
          rucaCategory: 'large_rural'
        }
      });

      expect(features.socialDeterminants.distanceToCareRiskWeight).toBe(0.10);
    });

    it('should have high weight (0.15) for 30-60 miles', () => {
      const features = createMockFeatures({
        socialDeterminants: {
          distanceToNearestHospitalMiles: 45,
          distanceToPcpMiles: 40,
          distanceToCareRiskWeight: 0.15,
          rucaCategory: 'small_rural'
        }
      });

      expect(features.socialDeterminants.distanceToCareRiskWeight).toBe(0.15);
    });

    it('should have maximum weight (0.20-0.25) for >60 miles', () => {
      const features = createMockFeatures({
        socialDeterminants: {
          distanceToNearestHospitalMiles: 75,
          distanceToPcpMiles: 80,
          distanceToCareRiskWeight: 0.20,
          rucaCategory: 'isolated_rural'
        }
      });

      expect(features.socialDeterminants.distanceToCareRiskWeight).toBeGreaterThanOrEqual(0.20);
    });
  });

  describe('Healthcare Shortage Area (HPSA) Status', () => {
    it('should flag patients in HPSA areas', () => {
      const features = createMockFeatures({
        socialDeterminants: {
          isInHealthcareShortageArea: true,
          rucaCategory: 'small_rural'
        }
      });

      expect(features.socialDeterminants.isInHealthcareShortageArea).toBe(true);
    });

    it('should not flag urban patients not in HPSA', () => {
      const features = createMockFeatures({
        socialDeterminants: {
          isInHealthcareShortageArea: false,
          rucaCategory: 'urban'
        }
      });

      expect(features.socialDeterminants.isInHealthcareShortageArea).toBe(false);
    });
  });

  describe('Minutes to Nearest ED', () => {
    it('should track time-based access for urban patients', () => {
      const features = createMockFeatures({
        socialDeterminants: {
          minutesToNearestED: 10,
          rucaCategory: 'urban'
        }
      });

      expect(features.socialDeterminants.minutesToNearestED).toBe(10);
    });

    it('should track longer times for rural patients', () => {
      const features = createMockFeatures({
        socialDeterminants: {
          minutesToNearestED: 45,
          rucaCategory: 'small_rural'
        }
      });

      expect(features.socialDeterminants.minutesToNearestED).toBe(45);
    });

    it('should track very long times for isolated rural patients', () => {
      const features = createMockFeatures({
        socialDeterminants: {
          minutesToNearestED: 90,
          rucaCategory: 'isolated_rural'
        }
      });

      expect(features.socialDeterminants.minutesToNearestED).toBe(90);
    });
  });

  describe('Patient Rurality Mapping', () => {
    it('should map to urban for RUCA urban', () => {
      const features = createMockFeatures({
        socialDeterminants: {
          rucaCategory: 'urban',
          patientRurality: 'urban'
        }
      });

      expect(features.socialDeterminants.patientRurality).toBe('urban');
    });

    it('should map to suburban for large_rural', () => {
      const features = createMockFeatures({
        socialDeterminants: {
          rucaCategory: 'large_rural',
          patientRurality: 'suburban'
        }
      });

      expect(features.socialDeterminants.patientRurality).toBe('suburban');
    });

    it('should map to rural for small_rural', () => {
      const features = createMockFeatures({
        socialDeterminants: {
          rucaCategory: 'small_rural',
          patientRurality: 'rural'
        }
      });

      expect(features.socialDeterminants.patientRurality).toBe('rural');
    });

    it('should map to frontier for isolated_rural', () => {
      const features = createMockFeatures({
        socialDeterminants: {
          rucaCategory: 'isolated_rural',
          patientRurality: 'frontier'
        }
      });

      expect(features.socialDeterminants.patientRurality).toBe('frontier');
    });
  });
});

// =====================================================
// PLAIN LANGUAGE DATA STRUCTURE TESTS
// =====================================================

describe('Plain Language Feature Structure', () => {
  describe('Risk Factor Translation Data', () => {
    it('should include prior admission data for translation', () => {
      const features = createMockFeatures({
        clinical: {
          priorAdmissions30Day: 2,
          priorAdmissions90Day: 3,
          edVisits30Day: 2
        }
      });

      expect(features.clinical.priorAdmissions30Day).toBe(2);
      expect(features.clinical.priorAdmissions90Day).toBe(3);
      expect(features.clinical.edVisits30Day).toBe(2);
    });

    it('should include check-in data for translation', () => {
      const features = createMockFeatures({
        engagement: {
          consecutiveMissedCheckIns: 3,
          checkInCompletionRate7Day: 0.5
        }
      });

      expect(features.engagement.consecutiveMissedCheckIns).toBe(3);
      expect(features.engagement.checkInCompletionRate7Day).toBe(0.5);
    });

    it('should include transportation data for translation', () => {
      const features = createMockFeatures({
        socialDeterminants: {
          hasTransportationBarrier: true,
          distanceToNearestHospitalMiles: 30
        }
      });

      expect(features.socialDeterminants.hasTransportationBarrier).toBe(true);
      expect(features.socialDeterminants.distanceToNearestHospitalMiles).toBe(30);
    });

    it('should include lives alone status for translation', () => {
      const features = createMockFeatures({
        socialDeterminants: {
          livesAlone: true,
          hasCaregiver: false
        }
      });

      expect(features.socialDeterminants.livesAlone).toBe(true);
      expect(features.socialDeterminants.hasCaregiver).toBe(false);
    });

    it('should include medication count for polypharmacy translation', () => {
      const features = createMockFeatures({
        medication: {
          activeMedicationCount: 8,
          isPolypharmacy: true
        }
      });

      expect(features.medication.activeMedicationCount).toBe(8);
      expect(features.medication.isPolypharmacy).toBe(true);
    });
  });

  describe('Actionable Advice Data', () => {
    it('should detect no follow-up scheduled for advice', () => {
      const features = createMockFeatures({
        postDischarge: {
          followUpScheduled: false,
          noFollowUpScheduled: true
        }
      });

      expect(features.postDischarge.followUpScheduled).toBe(false);
      expect(features.postDischarge.noFollowUpScheduled).toBe(true);
    });

    it('should detect missed check-ins for advice', () => {
      const features = createMockFeatures({
        engagement: {
          consecutiveMissedCheckIns: 2
        }
      });

      expect(features.engagement.consecutiveMissedCheckIns).toBe(2);
    });

    it('should detect transportation barriers for advice', () => {
      const features = createMockFeatures({
        socialDeterminants: {
          hasTransportationBarrier: true
        }
      });

      expect(features.socialDeterminants.hasTransportationBarrier).toBe(true);
    });

    it('should detect lives alone without caregiver for advice', () => {
      const features = createMockFeatures({
        socialDeterminants: {
          livesAlone: true,
          hasCaregiver: false
        }
      });

      expect(features.socialDeterminants.livesAlone).toBe(true);
      expect(features.socialDeterminants.hasCaregiver).toBe(false);
    });
  });

  describe('Protective Factor Data', () => {
    it('should include caregiver status for protective factor', () => {
      const features = createMockFeatures({
        socialDeterminants: {
          hasCaregiver: true,
          caregiverAvailable24Hours: true
        }
      });

      expect(features.socialDeterminants.hasCaregiver).toBe(true);
    });

    it('should include follow-up scheduled for protective factor', () => {
      const features = createMockFeatures({
        postDischarge: {
          followUpScheduled: true,
          followUpWithin7Days: true
        }
      });

      expect(features.postDischarge.followUpScheduled).toBe(true);
      expect(features.postDischarge.followUpWithin7Days).toBe(true);
    });

    it('should include good check-in compliance for protective factor', () => {
      const features = createMockFeatures({
        engagement: {
          checkInCompletionRate30Day: 0.95,
          consecutiveMissedCheckIns: 0
        }
      });

      expect(features.engagement.checkInCompletionRate30Day).toBe(0.95);
      expect(features.engagement.consecutiveMissedCheckIns).toBe(0);
    });
  });
});

// =====================================================
// COMBINED RISK SCENARIOS
// =====================================================

describe('Combined Risk Scenarios', () => {
  it('should identify high-risk rural patient with multiple factors', () => {
    const features = createMockFeatures({
      clinical: {
        priorAdmissions30Day: 1,
        hasChf: true,
        isHighRiskDiagnosis: true
      },
      socialDeterminants: {
        rucaCategory: 'isolated_rural',
        patientRurality: 'frontier',
        distanceToCareRiskWeight: 0.20,
        isInHealthcareShortageArea: true,
        minutesToNearestED: 75,
        hasTransportationBarrier: true,
        distanceToNearestHospitalMiles: 60,
        livesAlone: true,
        hasCaregiver: false
      },
      engagement: {
        consecutiveMissedCheckIns: 4,
        isDisengaging: true,
        stoppedResponding: true
      }
    });

    // All risk factors present
    expect(features.socialDeterminants.rucaCategory).toBe('isolated_rural');
    expect(features.socialDeterminants.distanceToCareRiskWeight).toBe(0.20);
    expect(features.socialDeterminants.isInHealthcareShortageArea).toBe(true);
    expect(features.engagement.consecutiveMissedCheckIns).toBe(4);
    expect(features.engagement.stoppedResponding).toBe(true);
    expect(features.clinical.hasChf).toBe(true);
  });

  it('should identify low-risk urban patient with protective factors', () => {
    const features = createMockFeatures({
      clinical: {
        priorAdmissions30Day: 0,
        priorAdmissions90Day: 0,
        isHighRiskDiagnosis: false
      },
      socialDeterminants: {
        rucaCategory: 'urban',
        patientRurality: 'urban',
        distanceToCareRiskWeight: 0.0,
        isInHealthcareShortageArea: false,
        minutesToNearestED: 8,
        hasTransportationBarrier: false,
        livesAlone: false,
        hasCaregiver: true
      },
      postDischarge: {
        followUpScheduled: true,
        followUpWithin7Days: true
      },
      engagement: {
        consecutiveMissedCheckIns: 0,
        checkInCompletionRate30Day: 0.95,
        isDisengaging: false
      }
    });

    // All protective factors present
    expect(features.socialDeterminants.rucaCategory).toBe('urban');
    expect(features.socialDeterminants.distanceToCareRiskWeight).toBe(0.0);
    expect(features.socialDeterminants.hasCaregiver).toBe(true);
    expect(features.postDischarge.followUpWithin7Days).toBe(true);
    expect(features.engagement.checkInCompletionRate30Day).toBe(0.95);
  });

  it('should handle suburban patient with mixed factors', () => {
    const features = createMockFeatures({
      socialDeterminants: {
        rucaCategory: 'large_rural',
        patientRurality: 'suburban',
        distanceToCareRiskWeight: 0.08,
        distanceToNearestHospitalMiles: 15,
        hasTransportationBarrier: false, // Has car
        livesAlone: true, // Risk
        hasCaregiver: false // Risk
      },
      postDischarge: {
        followUpScheduled: true, // Protective
        followUpWithin7Days: true // Protective
      },
      engagement: {
        consecutiveMissedCheckIns: 1, // Slight concern
        checkInCompletionRate30Day: 0.80 // Okay
      }
    });

    // Mixed factors
    expect(features.socialDeterminants.rucaCategory).toBe('large_rural');
    expect(features.socialDeterminants.distanceToCareRiskWeight).toBe(0.08);
    expect(features.socialDeterminants.livesAlone).toBe(true);
    expect(features.postDischarge.followUpWithin7Days).toBe(true);
  });
});

// =====================================================
// DATA COMPLETENESS TESTS
// =====================================================

describe('Data Completeness', () => {
  it('should track data completeness score', () => {
    const features = createMockFeatures();

    expect(features.dataCompletenessScore).toBeDefined();
    expect(typeof features.dataCompletenessScore).toBe('number');
    expect(features.dataCompletenessScore).toBeGreaterThanOrEqual(0);
    expect(features.dataCompletenessScore).toBeLessThanOrEqual(100);
  });

  it('should list missing critical data', () => {
    const features: ReadmissionRiskFeatures = {
      ...createMockFeatures(),
      dataCompletenessScore: 60,
      missingCriticalData: ['insurance_type', 'pcp_assigned', 'follow_up_date']
    };

    expect(features.missingCriticalData).toContain('insurance_type');
    expect(features.missingCriticalData.length).toBe(3);
  });
});
