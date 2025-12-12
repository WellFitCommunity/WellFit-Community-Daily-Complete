/**
 * Readmission Risk Feature Extractor
 *
 * Extracts comprehensive evidence-based features for readmission risk prediction
 * Implements clinical guidelines and CMS quality measures
 *
 * HIPAA Compliance: Server-side only, uses patient IDs not PHI
 */

import { supabase } from '../../lib/supabaseClient';
import type {
  ReadmissionRiskFeatures,
  ClinicalFactors,
  MedicationFactors,
  PostDischargeFactors,
  SocialDeterminants,
  FunctionalStatus,
  EngagementFactors,
  SelfReportedHealth
} from '../../types/readmissionRiskFeatures';
import type { DischargeContext } from './readmissionRiskPredictor';

export class ReadmissionFeatureExtractor {
  /**
   * Extract all comprehensive features for a patient at discharge
   */
  async extractFeatures(context: DischargeContext): Promise<ReadmissionRiskFeatures> {
    const [
      clinical,
      medication,
      postDischarge,
      socialDeterminants,
      functionalStatus,
      engagement,
      selfReported
    ] = await Promise.all([
      this.extractClinicalFactors(context),
      this.extractMedicationFactors(context),
      this.extractPostDischargeFactors(context),
      this.extractSocialDeterminants(context),
      this.extractFunctionalStatus(context),
      this.extractEngagementFactors(context),
      this.extractSelfReportedHealth(context)
    ]);

    // Calculate data completeness
    const { completeness, missingCritical } = this.calculateDataCompleteness({
      clinical,
      medication,
      postDischarge,
      socialDeterminants,
      functionalStatus,
      engagement,
      selfReported
    });

    return {
      patientId: context.patientId,
      tenantId: context.tenantId,
      dischargeDate: context.dischargeDate,
      assessmentTimestamp: new Date().toISOString(),
      clinical,
      medication,
      postDischarge,
      socialDeterminants,
      functionalStatus,
      engagement,
      selfReported,
      dataCompletenessScore: completeness,
      missingCriticalData: missingCritical
    };
  }

  /**
   * Extract clinical factors - strongest predictors
   */
  private async extractClinicalFactors(context: DischargeContext): Promise<ClinicalFactors> {
    const patientId = context.patientId;

    // Get prior admissions (strongest predictor)
    const priorAdmissions = await this.getPriorAdmissions(patientId);

    // Get ED visits
    const edVisits = await this.getEdVisits(patientId);

    // Get comorbidities from FHIR conditions
    const comorbidities = await this.getComorbidities(patientId);

    // Get vital signs at discharge
    const vitals = await this.getDischargeVitals(patientId, context.dischargeDate);

    // Get lab results
    const labs = await this.getRecentLabs(patientId, context.dischargeDate);

    // Categorize length of stay
    const losCategory = this.categorizeLengthOfStay(context.lengthOfStay);

    // Check if diagnosis is high-risk
    const highRiskDiagnoses = ['CHF', 'COPD', 'diabetes', 'renal_failure'];
    const isHighRisk = context.primaryDiagnosisCode ?
      this.checkHighRiskDiagnosis(context.primaryDiagnosisCode) : false;

    return {
      primaryDiagnosisCode: context.primaryDiagnosisCode,
      primaryDiagnosisDescription: context.primaryDiagnosisDescription,
      primaryDiagnosisCategory: this.categorizeDiagnosis(context.primaryDiagnosisCode),
      isHighRiskDiagnosis: isHighRisk,

      comorbidityCount: comorbidities.length,
      comorbidities: comorbidities.map(c => c.code),
      hasChf: comorbidities.some(c => c.category === 'CHF'),
      hasCopd: comorbidities.some(c => c.category === 'COPD'),
      hasDiabetes: comorbidities.some(c => c.category === 'diabetes'),
      hasRenalFailure: comorbidities.some(c => c.category === 'renal_failure'),
      hasCancer: comorbidities.some(c => c.category === 'cancer'),

      priorAdmissions30Day: priorAdmissions.count30Day,
      priorAdmissions60Day: priorAdmissions.count60Day,
      priorAdmissions90Day: priorAdmissions.count90Day,
      priorAdmissions1Year: priorAdmissions.count1Year,

      edVisits30Day: edVisits.count30Day,
      edVisits90Day: edVisits.count90Day,
      edVisits6Month: edVisits.count6Month,

      lengthOfStayDays: context.lengthOfStay,
      lengthOfStayCategory: losCategory,

      vitalSignsStableAtDischarge: vitals.stable,
      systolicBpAtDischarge: vitals.systolic,
      diastolicBpAtDischarge: vitals.diastolic,
      heartRateAtDischarge: vitals.heartRate,
      oxygenSaturationAtDischarge: vitals.oxygenSat,
      temperatureAtDischarge: vitals.temperature,

      labsWithinNormalLimits: labs.allNormal,
      eGfr: labs.eGfr,
      hemoglobin: labs.hemoglobin,
      sodiumLevel: labs.sodium,
      glucoseLevel: labs.glucose,
      labTrendsConcerning: labs.trendsConcerning
    };
  }

  /**
   * Extract medication factors - polypharmacy and high-risk medications
   */
  private async extractMedicationFactors(context: DischargeContext): Promise<MedicationFactors> {
    const patientId = context.patientId;

    // Get active medications at discharge
    const { data: medications } = await supabase
      .from('fhir_medication_requests')
      .select('*')
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .gte('authored_on', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    const activeMeds = medications || [];
    const medCount = activeMeds.length;

    // Identify high-risk medication classes
    const highRiskClasses = {
      anticoagulants: ['warfarin', 'heparin', 'enoxaparin', 'rivaroxaban', 'apixaban'],
      insulin: ['insulin'],
      opioids: ['oxycodone', 'hydrocodone', 'morphine', 'fentanyl', 'tramadol'],
      immunosuppressants: ['prednisone', 'tacrolimus', 'cyclosporine']
    };

    const hasAnticoagulants = activeMeds.some(m =>
      this.medicationMatchesClass(m, highRiskClasses.anticoagulants)
    );
    const hasInsulin = activeMeds.some(m =>
      this.medicationMatchesClass(m, highRiskClasses.insulin)
    );
    const hasOpioids = activeMeds.some(m =>
      this.medicationMatchesClass(m, highRiskClasses.opioids)
    );
    const hasImmunosuppressants = activeMeds.some(m =>
      this.medicationMatchesClass(m, highRiskClasses.immunosuppressants)
    );

    const highRiskMedList: string[] = [];
    if (hasAnticoagulants) highRiskMedList.push('anticoagulants');
    if (hasInsulin) highRiskMedList.push('insulin');
    if (hasOpioids) highRiskMedList.push('opioids');
    if (hasImmunosuppressants) highRiskMedList.push('immunosuppressants');

    // Check medication changes during admission
    const medChanges = await this.getMedicationChanges(patientId, context.dischargeDate);

    // Check prescription fill timing
    const prescriptionFill = await this.getPrescriptionFillStatus(patientId, context.dischargeDate);

    return {
      activeMedicationCount: medCount,
      isPolypharmacy: medCount >= 5,

      hasAnticoagulants,
      hasInsulin,
      hasOpioids,
      hasImmunosuppressants,
      hasHighRiskMedications: highRiskMedList.length > 0,
      highRiskMedicationList: highRiskMedList,

      medicationsAdded: medChanges.added,
      medicationsDiscontinued: medChanges.discontinued,
      medicationsDoseChanged: medChanges.doseChanged,
      significantMedicationChanges: (medChanges.added + medChanges.discontinued + medChanges.doseChanged) >= 3,

      prescriptionFilledWithin3Days: prescriptionFill.filledWithin3Days,
      daysUntilPrescriptionFill: prescriptionFill.daysUntilFill,
      noPrescriptionFilled: !prescriptionFill.anyFilled,

      medicationReconciliationCompleted: medChanges.reconciliationCompleted,
      medicationListAccurate: medChanges.listAccurate
    };
  }

  /**
   * Extract post-discharge factors - follow-up timing and setup
   */
  private async extractPostDischargeFactors(context: DischargeContext): Promise<PostDischargeFactors> {
    const patientId = context.patientId;

    // Check for scheduled follow-up appointments
    const followUp = await this.getFollowUpAppointment(patientId, context.dischargeDate);

    // Check PCP assignment
    const pcp = await this.getPcpAssignment(patientId);

    // Check pending test results
    const pendingTests = await this.getPendingTestResults(patientId, context.dischargeDate);

    // Check discharge instructions
    const dischargeInstructions = await this.getDischargeInstructions(patientId, context.dischargeDate);

    const dischargeToHomeAlone = context.dischargeDisposition === 'home' &&
      !(await this.hasHomeSupport(patientId));

    return {
      followUpScheduled: followUp.scheduled,
      daysUntilFollowUp: followUp.daysUntil,
      followUpWithin7Days: followUp.daysUntil ? followUp.daysUntil <= 7 : false,
      followUpWithin14Days: followUp.daysUntil ? followUp.daysUntil <= 14 : false,
      noFollowUpScheduled: !followUp.scheduled,

      hasPcpAssigned: pcp.assigned,
      pcpContactedAboutDischarge: pcp.contacted,

      dischargeDestination: context.dischargeDisposition,
      dischargeToHomeAlone,
      hasHomeHealthServices: context.dischargeDisposition === 'home_health',

      hasPendingTestResults: pendingTests.hasPending,
      pendingTestResultsList: pendingTests.testsList,

      dischargeInstructionsProvided: dischargeInstructions.provided,
      dischargeInstructionsUnderstood: dischargeInstructions.understood,
      patientTeachBackCompleted: dischargeInstructions.teachBackCompleted
    };
  }

  /**
   * Extract social determinants - critical for rural populations
   * ENHANCED with RUCA-based rural classification and distance-to-care weighting
   */
  private async extractSocialDeterminants(context: DischargeContext): Promise<SocialDeterminants> {
    const patientId = context.patientId;

    // Get SDOH assessment data
    const { data: sdohData } = await supabase
      .from('sdoh_indicators')
      .select('*')
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(20);

    const sdohIndicators = sdohData || [];

    // Extract specific SDOH factors
    const transportation = sdohIndicators.find(s => s.category === 'transportation');
    const housing = sdohIndicators.find(s => s.category === 'housing');
    const insurance = sdohIndicators.find(s => s.category === 'insurance');
    const healthLiteracy = sdohIndicators.find(s => s.category === 'health_literacy');
    const socialSupport = sdohIndicators.find(s => s.category === 'social_support');

    // Get patient profile for additional context
    const { data: profile } = await supabase
      .from('profiles')
      .select('address_city, address_state, address_zip')
      .eq('id', patientId)
      .single();

    // Determine rural status with RUCA-based classification
    const ruralStatus = await this.checkRuralStatus(profile?.address_zip);

    // Calculate distance-to-care risk weight (for rural model weighting)
    const distanceToHospital = transportation?.details?.distance_to_hospital;
    const distanceToPcp = transportation?.details?.distance_to_pcp;
    const distanceToCareRiskWeight = this.calculateDistanceToCareRiskWeight(
      distanceToHospital,
      distanceToPcp,
      ruralStatus.rucaCategory
    );

    // Check HPSA status (Healthcare Professional Shortage Area)
    const isInHPSA = await this.checkHPSAStatus(profile?.address_zip);

    // Calculate estimated minutes to ED (rough estimate: 1 mile = 1.5-2 min in rural areas)
    const minutesToED = distanceToHospital
      ? Math.round(distanceToHospital * (ruralStatus.isRural ? 2 : 1.5))
      : undefined;

    return {
      livesAlone: housing?.details?.lives_alone || false,
      hasCaregiver: socialSupport?.details?.has_caregiver || false,
      caregiverAvailable24Hours: socialSupport?.details?.caregiver_24hr || false,
      caregiverReliable: socialSupport?.details?.caregiver_reliable || false,

      hasTransportationBarrier: transportation?.risk_level === 'high' || transportation?.risk_level === 'critical',
      distanceToNearestHospitalMiles: distanceToHospital,
      distanceToPcpMiles: distanceToPcp,
      publicTransitAvailable: transportation?.details?.public_transit || false,

      // Enhanced rural classification
      isRuralLocation: ruralStatus.isRural,
      ruralIsolationScore: this.calculateRuralIsolationScore(transportation, ruralStatus.isRural, ruralStatus.rucaCategory),
      rucaCategory: ruralStatus.rucaCategory,
      distanceToCareRiskWeight,
      patientRurality: ruralStatus.patientRurality,
      isInHealthcareShortageArea: isInHPSA,
      minutesToNearestED: minutesToED,

      insuranceType: this.categorizeInsurance(insurance?.details?.type),
      hasMedicaid: insurance?.details?.type === 'medicaid' || insurance?.details?.type === 'dual_eligible',
      hasInsuranceGaps: insurance?.risk_level === 'high' || insurance?.risk_level === 'critical',
      financialBarriersToMedications: insurance?.details?.medication_cost_barrier || false,
      financialBarriersToFollowUp: insurance?.details?.visit_cost_barrier || false,

      healthLiteracyLevel: this.categorizeHealthLiteracy(healthLiteracy?.details?.level),
      lowHealthLiteracy: healthLiteracy?.risk_level === 'high' || healthLiteracy?.risk_level === 'critical',
      languageBarrier: healthLiteracy?.details?.language_barrier || false,
      interpreterNeeded: healthLiteracy?.details?.interpreter_needed || false,

      socialSupportScore: socialSupport?.score || 0,
      hasFamilySupport: socialSupport?.details?.family_support || false,
      hasCommunitySupport: socialSupport?.details?.community_support || false,
      sociallyIsolated: socialSupport?.risk_level === 'high' || socialSupport?.risk_level === 'critical'
    };
  }

  /**
   * Check if ZIP code is in a Healthcare Professional Shortage Area (HPSA)
   * HPSA status increases readmission risk due to limited access to care
   */
  private async checkHPSAStatus(zipCode?: string): Promise<boolean> {
    if (!zipCode) return false;

    // Try to get HPSA status from database
    const { data } = await supabase
      .from('hpsa_designations')
      .select('designation_type')
      .eq('zip_code', zipCode.substring(0, 5))
      .eq('status', 'active')
      .limit(1)
      .single();

    return !!data?.designation_type;
  }

  /**
   * Extract functional status - ADLs, cognition, falls
   */
  private async extractFunctionalStatus(context: DischargeContext): Promise<FunctionalStatus> {
    const patientId = context.patientId;

    // Get most recent risk assessment with functional data
    const { data: riskAssessment } = await supabase
      .from('risk_assessments')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Get fall history
    const { data: falls } = await supabase
      .from('patient_daily_check_ins')
      .select('*')
      .eq('patient_id', patientId)
      .contains('concern_flags', ['fall'])
      .gte('check_in_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('check_in_date', { ascending: false });

    const fallsList = falls || [];
    const fallsLast30Days = fallsList.filter(f =>
      new Date(f.check_in_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ).length;
    const fallsLast90Days = fallsList.length;

    // Extract ADL data from risk assessment
    const adlFields = [
      'bathing_ability',
      'walking_ability',
      'toilet_transfer',
      'meal_preparation',
      'medication_management'
    ];

    let adlDependencies = 0;
    adlFields.forEach(field => {
      const value = riskAssessment?.[field];
      if (value && (value.includes('needs_help') || value.includes('dependent'))) {
        adlDependencies++;
      }
    });

    return {
      adlDependencies,
      needsHelpBathing: riskAssessment?.bathing_ability?.includes('needs_help') || false,
      needsHelpDressing: riskAssessment?.dressing_ability?.includes('needs_help') || false,
      needsHelpToileting: riskAssessment?.toilet_transfer?.includes('needs_help') || false,
      needsHelpEating: riskAssessment?.eating_ability?.includes('needs_help') || false,
      needsHelpTransferring: riskAssessment?.sitting_ability?.includes('needs_help') || false,
      needsHelpWalking: riskAssessment?.walking_ability?.includes('needs_help') || false,

      hasCognitiveImpairment: riskAssessment?.cognitive_risk_score > 6,
      cognitiveImpairmentSeverity: this.categorizeCognitiveSeverity(riskAssessment?.cognitive_risk_score),
      hasDementia: riskAssessment?.risk_factors?.includes('dementia') || false,
      hasDelirium: riskAssessment?.risk_factors?.includes('delirium') || false,

      hasRecentFalls: fallsLast90Days > 0,
      fallsInPast30Days: fallsLast30Days,
      fallsInPast90Days: fallsLast90Days,
      fallRiskScore: this.calculateFallRiskScore(fallsLast90Days, riskAssessment),

      mobilityLevel: this.categorizeMobility(riskAssessment?.walking_ability),
      requiresDurableMedicalEquipment: riskAssessment?.risk_factors?.includes('dme_needed') || false
    };
  }

  /**
   * Extract engagement factors - WellFit's unique early warning system
   * Leverages check-ins, games, and social activities
   */
  private async extractEngagementFactors(context: DischargeContext): Promise<EngagementFactors> {
    const patientId = context.patientId;
    const now = Date.now();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    // Get all check-ins for last 30 days
    const { data: checkIns } = await supabase
      .from('patient_daily_check_ins')
      .select('*')
      .eq('patient_id', patientId)
      .gte('check_in_date', thirtyDaysAgo.toISOString())
      .order('check_in_date', { ascending: false });

    const allCheckIns = checkIns || [];
    const last7DaysCheckIns = allCheckIns.filter(c =>
      new Date(c.check_in_date) >= sevenDaysAgo
    );

    // Calculate check-in completion rates
    const completed30Day = allCheckIns.filter(c => c.status === 'completed').length;
    const completed7Day = last7DaysCheckIns.filter(c => c.status === 'completed').length;
    const checkInRate30Day = allCheckIns.length > 0 ? completed30Day / 30 : 0;
    const checkInRate7Day = last7DaysCheckIns.length > 0 ? completed7Day / 7 : 0;

    const missedCheckIns30 = allCheckIns.filter(c => c.status === 'missed').length;
    const missedCheckIns7 = last7DaysCheckIns.filter(c => c.status === 'missed').length;

    // Calculate consecutive missed check-ins
    let consecutiveMissed = 0;
    for (const checkIn of allCheckIns) {
      if (checkIn.status === 'missed') {
        consecutiveMissed++;
      } else if (checkIn.status === 'completed') {
        break;
      }
    }

    // Detect engagement drop (compare last 7 days to previous 23 days)
    const previous23Days = allCheckIns.filter(c =>
      new Date(c.check_in_date) < sevenDaysAgo
    );
    const previousRate = previous23Days.length > 0 ?
      previous23Days.filter(c => c.status === 'completed').length / 23 : 0;
    const engagementDrop = (previousRate - checkInRate7Day) > 0.3; // 30% drop

    // Vitals reporting from check-ins
    const vitalsReported30 = allCheckIns.filter(c =>
      c.responses?.blood_pressure || c.responses?.blood_sugar || c.responses?.weight
    ).length;
    const vitalsRate30Day = allCheckIns.length > 0 ? vitalsReported30 / 30 : 0;
    const missedVitals7 = 7 - last7DaysCheckIns.filter(c =>
      c.responses?.blood_pressure || c.responses?.blood_sugar
    ).length;

    // Mood reporting and trends
    const moodReported30 = allCheckIns.filter(c => c.responses?.mood).length;
    const moodRate30Day = allCheckIns.length > 0 ? moodReported30 / 30 : 0;

    const negativeMoods = ['sad', 'anxious', 'not great', 'stressed', 'tired'];
    const negativeMoodCount = allCheckIns.filter(c =>
      negativeMoods.some(mood => c.responses?.mood?.toLowerCase().includes(mood))
    ).length;
    const negativeModeTrend = negativeMoodCount > (allCheckIns.length * 0.4); // >40% negative

    // Concerning symptoms
    const redFlagKeywords = ['chest pain', 'shortness of breath', 'sob', 'severe pain', 'bleeding', 'confusion'];
    const concerningSymptoms = allCheckIns.some(c =>
      redFlagKeywords.some(keyword =>
        c.responses?.symptoms?.toLowerCase().includes(keyword)
      )
    );

    // Game participation - get from engagement tracking
    const { data: gameStats } = await supabase
      .from('patient_engagement_metrics')
      .select('*')
      .eq('patient_id', patientId)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: false });

    const games = gameStats || [];
    const triviaPlayed = games.filter(g => g.trivia_played).length;
    const wordFindPlayed = games.filter(g => g.word_find_played).length;

    const triviaRate = games.length > 0 ? triviaPlayed / 30 : 0;
    const wordFindRate = games.length > 0 ? wordFindPlayed / 30 : 0;

    // Overall game engagement score (0-100)
    const gameEngagement = Math.round(((triviaRate + wordFindRate) / 2) * 100);
    const gameEngagementDeclining = games.length >= 14 && (
      gameEngagement < (games.slice(0, 7).reduce((sum, g) => sum + (g.engagement_score || 0), 0) / 7) * 0.7
    );

    // Social engagement
    const mealPhotos = games.filter(g => g.meal_photo_shared).length;
    const mealPhotoRate = games.length > 0 ? mealPhotos / 30 : 0;

    const communityInteractions = games.reduce((sum, g) => sum + (g.community_interactions || 0), 0);
    const communityScore = Math.min(communityInteractions * 2, 100); // Scale to 100

    const socialEngagementDeclining = games.length >= 14 && (
      communityScore < (games.slice(0, 7).reduce((sum, g) => sum + ((g.community_interactions || 0) * 2), 0) / 7) * 0.7
    );

    // Days with zero activity
    const daysWithZeroActivity = 30 - new Set(games.map(g => g.date)).size;

    // Health alerts triggered
    const alertsTriggered30 = allCheckIns.filter(c => c.alert_triggered).length;
    const alertsTriggered7 = last7DaysCheckIns.filter(c => c.alert_triggered).length;
    const criticalAlerts = allCheckIns.filter(c => c.alert_severity === 'critical').length;

    // Overall engagement score
    const overallEngagement = games.length > 0 ?
      Math.round(games.reduce((sum, g) => sum + (g.overall_engagement_score || 0), 0) / games.length) :
      Math.round((checkInRate30Day + triviaRate + wordFindRate) / 3 * 100);

    // Calculate engagement change
    const recentEngagement = games.slice(0, 7).reduce((sum, g) => sum + (g.overall_engagement_score || 0), 0) / 7;
    const previousEngagement = games.slice(7, 30).reduce((sum, g) => sum + (g.overall_engagement_score || 0), 0) / 23;
    const engagementChange = previousEngagement > 0 ?
      ((recentEngagement - previousEngagement) / previousEngagement) * 100 : 0;

    // Disengagement flags
    const isDisengaging = engagementChange < -30 || consecutiveMissed >= 3 || daysWithZeroActivity > 10;
    const stoppedResponding = consecutiveMissed >= 3;

    // Concerning patterns
    const concerningPatterns: string[] = [];
    if (negativeModeTrend) concerningPatterns.push('declining_mood');
    if (missedVitals7 > 4) concerningPatterns.push('missed_vitals');
    if (gameEngagementDeclining) concerningPatterns.push('no_games');
    if (daysWithZeroActivity > 7) concerningPatterns.push('zero_activity');
    if (criticalAlerts > 0) concerningPatterns.push('critical_alerts');

    return {
      checkInCompletionRate30Day: checkInRate30Day,
      checkInCompletionRate7Day: checkInRate7Day,
      missedCheckIns30Day: missedCheckIns30,
      missedCheckIns7Day: missedCheckIns7,
      consecutiveMissedCheckIns: consecutiveMissed,
      hasEngagementDrop: engagementDrop,

      vitalsReportingRate30Day: vitalsRate30Day,
      missedVitalsReports7Day: missedVitals7,
      vitalsReportingConsistent: vitalsRate30Day > 0.7,

      moodReportingRate30Day: moodRate30Day,
      negativeModeTrend,
      concerningSymptomsReported: concerningSymptoms,
      symptomSeverityIncreasing: false, // Would need trend analysis

      triviaParticipationRate30Day: triviaRate,
      wordFindParticipationRate30Day: wordFindRate,
      gameEngagementScore: gameEngagement,
      gameEngagementDeclining,

      mealPhotoShareRate30Day: mealPhotoRate,
      communityInteractionScore: communityScore,
      socialEngagementDeclining,
      daysWithZeroActivity,

      healthAlertsTriggered30Day: alertsTriggered30,
      healthAlertsTriggered7Day: alertsTriggered7,
      criticalAlertsTriggered: criticalAlerts,

      overallEngagementScore: overallEngagement,
      engagementChangePercent: engagementChange,
      isDisengaging,

      stoppedResponding,
      concerningPatterns
    };
  }

  /**
   * Extract self-reported health status from check-ins
   * Patient perspective complements clinical data
   */
  private async extractSelfReportedHealth(context: DischargeContext): Promise<SelfReportedHealth> {
    const patientId = context.patientId;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get check-ins with health responses
    const { data: checkIns } = await supabase
      .from('patient_daily_check_ins')
      .select('*')
      .eq('patient_id', patientId)
      .gte('check_in_date', thirtyDaysAgo.toISOString())
      .order('check_in_date', { ascending: false });

    const allCheckIns = checkIns || [];

    // Extract symptoms
    const symptoms = allCheckIns
      .filter(c => c.responses?.symptoms)
      .map(c => c.responses.symptoms);

    const redFlagKeywords = [
      'chest pain', 'shortness of breath', 'sob', 'severe pain',
      'bleeding', 'confusion', 'dizzy', 'faint', 'unconscious'
    ];

    const redFlagSymptoms = symptoms.filter(s =>
      redFlagKeywords.some(keyword => s.toLowerCase().includes(keyword))
    );

    // Vital trends from self-reports
    const bpReadings = allCheckIns
      .filter(c => c.responses?.blood_pressure)
      .map(c => {
        const bp = c.responses.blood_pressure.split('/');
        return { systolic: parseInt(bp[0]), diastolic: parseInt(bp[1]) };
      });

    const bpTrendConcerning = bpReadings.some(bp =>
      bp.systolic > 160 || bp.systolic < 90 || bp.diastolic > 100
    );

    const bloodSugarReadings = allCheckIns
      .filter(c => c.responses?.blood_sugar)
      .map(c => parseInt(c.responses.blood_sugar));

    const bsTrendConcerning = bloodSugarReadings.some(bs =>
      bs > 250 || bs < 70
    );

    const weightReadings = allCheckIns
      .filter(c => c.responses?.weight)
      .map(c => parseFloat(c.responses.weight));

    const weightChangeConcerning = weightReadings.length >= 2 &&
      Math.abs(weightReadings[0] - weightReadings[weightReadings.length - 1]) > (weightReadings[weightReadings.length - 1] * 0.05);

    // Functional changes
    const mobilityComplaints = symptoms.filter(s =>
      s.toLowerCase().includes('walking') ||
      s.toLowerCase().includes('mobility') ||
      s.toLowerCase().includes('weakness')
    );

    const painComplaints = symptoms.filter(s =>
      s.toLowerCase().includes('pain') ||
      s.toLowerCase().includes('ache') ||
      s.toLowerCase().includes('sore')
    );

    const fatigueComplaints = symptoms.filter(s =>
      s.toLowerCase().includes('tired') ||
      s.toLowerCase().includes('fatigue') ||
      s.toLowerCase().includes('exhausted')
    );

    // Medication adherence
    const medRelatedResponses = allCheckIns.filter(c =>
      c.responses?.medications_taken === false ||
      c.responses?.forgot_medication === true ||
      c.concern_flags?.includes('medication_non_adherence')
    );

    const missedMedsDays = medRelatedResponses.length;

    const sideEffectsReported = symptoms.some(s =>
      s.toLowerCase().includes('side effect') ||
      s.toLowerCase().includes('nausea') ||
      s.toLowerCase().includes('dizzy from')
    );

    // Social activity patterns
    const socialResponses = allCheckIns
      .filter(c => c.responses?.social_activity)
      .map(c => c.responses.social_activity);

    const daysHomeAlone = socialResponses.filter(s =>
      s.toLowerCase().includes('stayed home alone') ||
      s.toLowerCase().includes('no visitors')
    ).length;

    const socialIsolationIncreasing = daysHomeAlone > 15; // >50% of days

    const familyContact = socialResponses.filter(s =>
      s.toLowerCase().includes('family') ||
      s.toLowerCase().includes('children') ||
      s.toLowerCase().includes('spouse')
    ).length;

    const familyContactDecreasing = familyContact < 8; // <2x per week

    return {
      recentSymptoms: symptoms,
      symptomCount30Day: symptoms.length,
      hasRedFlagSymptoms: redFlagSymptoms.length > 0,
      redFlagSymptomsList: redFlagSymptoms,

      selfReportedBpTrendConcerning: bpTrendConcerning,
      selfReportedBloodSugarUnstable: bsTrendConcerning,
      selfReportedWeightChangeConcerning: weightChangeConcerning,

      reportedMobilityDeclining: mobilityComplaints.length > 3,
      reportedPainIncreasing: painComplaints.length > 5,
      reportedFatigueIncreasing: fatigueComplaints.length > 5,

      missedMedicationsDays30Day: missedMedsDays,
      medicationSideEffectsReported: sideEffectsReported,
      medicationConcerns: medRelatedResponses.map(r => r.responses?.medication_concern || '').filter(Boolean),

      daysHomeAlone30Day: daysHomeAlone,
      socialIsolationIncreasing,
      familyContactDecreasing
    };
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  private async getPriorAdmissions(patientId: string) {
    const { data } = await supabase
      .from('patient_readmissions')
      .select('admission_date')
      .eq('patient_id', patientId)
      .order('admission_date', { ascending: false })
      .limit(50);

    const admissions = data || [];
    const now = Date.now();

    return {
      count30Day: admissions.filter(a => new Date(a.admission_date).getTime() > now - 30 * 24 * 60 * 60 * 1000).length,
      count60Day: admissions.filter(a => new Date(a.admission_date).getTime() > now - 60 * 24 * 60 * 60 * 1000).length,
      count90Day: admissions.filter(a => new Date(a.admission_date).getTime() > now - 90 * 24 * 60 * 60 * 1000).length,
      count1Year: admissions.filter(a => new Date(a.admission_date).getTime() > now - 365 * 24 * 60 * 60 * 1000).length
    };
  }

  private async getEdVisits(patientId: string) {
    const { data } = await supabase
      .from('patient_readmissions')
      .select('admission_date, facility_type')
      .eq('patient_id', patientId)
      .eq('facility_type', 'er')
      .order('admission_date', { ascending: false })
      .limit(50);

    const visits = data || [];
    const now = Date.now();

    return {
      count30Day: visits.filter(v => new Date(v.admission_date).getTime() > now - 30 * 24 * 60 * 60 * 1000).length,
      count90Day: visits.filter(v => new Date(v.admission_date).getTime() > now - 90 * 24 * 60 * 60 * 1000).length,
      count6Month: visits.filter(v => new Date(v.admission_date).getTime() > now - 180 * 24 * 60 * 60 * 1000).length
    };
  }

  private async getComorbidities(patientId: string) {
    const { data } = await supabase
      .from('fhir_conditions')
      .select('code, display, clinical_status')
      .eq('patient_id', patientId)
      .eq('clinical_status', 'active');

    return (data || []).map(condition => ({
      code: condition.code,
      display: condition.display,
      category: this.categorizeCondition(condition.code)
    }));
  }

  private categorizeCondition(code: string): string {
    // ICD-10 code mapping to categories
    if (code?.startsWith('I50')) return 'CHF';
    if (code?.startsWith('J44') || code?.startsWith('J45')) return 'COPD';
    if (code?.startsWith('E11') || code?.startsWith('E10')) return 'diabetes';
    if (code?.startsWith('N18')) return 'renal_failure';
    if (code?.startsWith('C')) return 'cancer';
    return 'other';
  }

  private categorizeDiagnosis(code?: string): 'CHF' | 'COPD' | 'diabetes' | 'renal_failure' | 'pneumonia' | 'stroke' | 'sepsis' | 'other' {
    if (!code) return 'other';
    if (code.startsWith('I50')) return 'CHF';
    if (code.startsWith('J44') || code.startsWith('J45')) return 'COPD';
    if (code.startsWith('E11') || code.startsWith('E10')) return 'diabetes';
    if (code.startsWith('N18')) return 'renal_failure';
    if (code.startsWith('J18')) return 'pneumonia';
    if (code.startsWith('I63')) return 'stroke';
    if (code.startsWith('A41')) return 'sepsis';
    return 'other';
  }

  private checkHighRiskDiagnosis(code: string): boolean {
    const highRiskPrefixes = ['I50', 'J44', 'J45', 'E11', 'E10', 'N18'];
    return highRiskPrefixes.some(prefix => code.startsWith(prefix));
  }

  private categorizeLengthOfStay(days?: number): 'too_short' | 'normal' | 'extended' | 'prolonged' {
    if (!days) return 'normal';
    if (days < 2) return 'too_short'; // Risk factor
    if (days <= 5) return 'normal';
    if (days <= 10) return 'extended';
    return 'prolonged'; // Risk factor
  }

  private async getDischargeVitals(patientId: string, dischargeDate: string) {
    // Get vitals from 24 hours before discharge
    const { data } = await supabase
      .from('fhir_observations')
      .select('*')
      .eq('patient_id', patientId)
      .gte('effective_date_time', new Date(new Date(dischargeDate).getTime() - 24 * 60 * 60 * 1000).toISOString())
      .lte('effective_date_time', dischargeDate)
      .order('effective_date_time', { ascending: false });

    const vitals = data || [];

    const systolic = vitals.find(v => v.code === '8480-6')?.value_quantity?.value;
    const diastolic = vitals.find(v => v.code === '8462-4')?.value_quantity?.value;
    const heartRate = vitals.find(v => v.code === '8867-4')?.value_quantity?.value;
    const oxygenSat = vitals.find(v => v.code === '2708-6')?.value_quantity?.value;
    const temperature = vitals.find(v => v.code === '8310-5')?.value_quantity?.value;

    // Check stability
    const stable =
      (!systolic || (systolic >= 90 && systolic <= 160)) &&
      (!diastolic || (diastolic >= 60 && diastolic <= 100)) &&
      (!heartRate || (heartRate >= 60 && heartRate <= 100)) &&
      (!oxygenSat || oxygenSat >= 92);

    return { stable, systolic, diastolic, heartRate, oxygenSat, temperature };
  }

  private async getRecentLabs(patientId: string, dischargeDate: string) {
    const { data } = await supabase
      .from('fhir_observations')
      .select('*')
      .eq('patient_id', patientId)
      .gte('effective_date_time', new Date(new Date(dischargeDate).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .lte('effective_date_time', dischargeDate)
      .order('effective_date_time', { ascending: false });

    const labs = data || [];

    const eGfr = labs.find(l => l.code === '48642-3')?.value_quantity?.value;
    const hemoglobin = labs.find(l => l.code === '718-7')?.value_quantity?.value;
    const sodium = labs.find(l => l.code === '2951-2')?.value_quantity?.value;
    const glucose = labs.find(l => l.code === '2339-0')?.value_quantity?.value;

    const allNormal =
      (!eGfr || eGfr >= 60) &&
      (!hemoglobin || (hemoglobin >= 12 && hemoglobin <= 17)) &&
      (!sodium || (sodium >= 135 && sodium <= 145)) &&
      (!glucose || (glucose >= 70 && glucose <= 140));

    const trendsConcerning =
      (eGfr && eGfr < 30) ||
      (hemoglobin && hemoglobin < 10) ||
      (sodium && (sodium < 130 || sodium > 150)) ||
      (glucose && (glucose < 60 || glucose > 200));

    return { allNormal, trendsConcerning, eGfr, hemoglobin, sodium, glucose };
  }

  private medicationMatchesClass(med: any, classKeywords: string[]): boolean {
    const medName = med.medication_display?.toLowerCase() || '';
    return classKeywords.some(keyword => medName.includes(keyword));
  }

  private async getMedicationChanges(patientId: string, dischargeDate: string) {
    // This would compare medications before and after admission
    // For now, return placeholder data
    return {
      added: 0,
      discontinued: 0,
      doseChanged: 0,
      reconciliationCompleted: true,
      listAccurate: true
    };
  }

  private async getPrescriptionFillStatus(patientId: string, dischargeDate: string) {
    // This would integrate with pharmacy data
    // For now, return placeholder data
    return {
      filledWithin3Days: undefined,
      daysUntilFill: undefined,
      anyFilled: true
    };
  }

  private async getFollowUpAppointment(patientId: string, dischargeDate: string) {
    const { data } = await supabase
      .from('fhir_appointments')
      .select('*')
      .eq('patient_id', patientId)
      .gte('start', dischargeDate)
      .order('start', { ascending: true })
      .limit(1)
      .single();

    if (!data) {
      return { scheduled: false, daysUntil: undefined };
    }

    const daysUntil = Math.floor(
      (new Date(data.start).getTime() - new Date(dischargeDate).getTime()) / (24 * 60 * 60 * 1000)
    );

    return { scheduled: true, daysUntil };
  }

  private async getPcpAssignment(patientId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('primary_care_provider_id')
      .eq('id', patientId)
      .single();

    return {
      assigned: !!data?.primary_care_provider_id,
      contacted: false // Would need discharge notification tracking
    };
  }

  private async getPendingTestResults(patientId: string, dischargeDate: string) {
    const { data } = await supabase
      .from('fhir_diagnostic_reports')
      .select('*')
      .eq('patient_id', patientId)
      .eq('status', 'pending')
      .lte('effective_date_time', dischargeDate);

    const pending = data || [];

    return {
      hasPending: pending.length > 0,
      testsList: pending.map(t => t.code_display || 'Unknown test')
    };
  }

  private async getDischargeInstructions(patientId: string, dischargeDate: string) {
    // This would check discharge documentation
    // For now, return placeholder data
    return {
      provided: true,
      understood: true,
      teachBackCompleted: false
    };
  }

  private async hasHomeSupport(patientId: string): Promise<boolean> {
    const { data } = await supabase
      .from('sdoh_indicators')
      .select('*')
      .eq('patient_id', patientId)
      .eq('category', 'social_support')
      .eq('status', 'active')
      .single();

    return data?.details?.has_caregiver || data?.details?.family_support || false;
  }

  /**
   * Check rural status using RUCA (Rural-Urban Commuting Area) codes
   * Returns detailed rural classification for risk weighting
   */
  private async checkRuralStatus(zipCode?: string): Promise<{
    isRural: boolean;
    rucaCategory: 'urban' | 'large_rural' | 'small_rural' | 'isolated_rural';
    patientRurality: 'urban' | 'suburban' | 'rural' | 'frontier';
  }> {
    if (!zipCode) {
      return { isRural: false, rucaCategory: 'urban', patientRurality: 'urban' };
    }

    // Try to get RUCA classification from database
    const { data: ruralData } = await supabase
      .from('zip_ruca_codes')
      .select('ruca_code, ruca_category')
      .eq('zip_code', zipCode.substring(0, 5))
      .limit(1)
      .single();

    if (ruralData?.ruca_code) {
      const ruca = ruralData.ruca_code;
      if (ruca <= 3) {
        return { isRural: false, rucaCategory: 'urban', patientRurality: 'urban' };
      } else if (ruca <= 6) {
        return { isRural: true, rucaCategory: 'large_rural', patientRurality: 'suburban' };
      } else if (ruca <= 9) {
        return { isRural: true, rucaCategory: 'small_rural', patientRurality: 'rural' };
      } else {
        return { isRural: true, rucaCategory: 'isolated_rural', patientRurality: 'frontier' };
      }
    }

    // Fallback: Estimate rurality from first 3 digits of ZIP (regional patterns)
    // In production, this would use a proper RUCA lookup table
    const zip3 = zipCode.substring(0, 3);

    // Example: Some rural ZIP code prefixes (this is simplified)
    const ruralPrefixes = ['592', '593', '594', '595', '596', '597', '598', '599', // Montana
                          '693', '694', '695', '696', '697', // North Dakota
                          '570', '571', '572', '573', '574', '575', '576', '577']; // South Dakota
    const frontierPrefixes = ['592', '593', '697']; // Very remote areas

    if (frontierPrefixes.includes(zip3)) {
      return { isRural: true, rucaCategory: 'isolated_rural', patientRurality: 'frontier' };
    } else if (ruralPrefixes.includes(zip3)) {
      return { isRural: true, rucaCategory: 'small_rural', patientRurality: 'rural' };
    }

    return { isRural: false, rucaCategory: 'urban', patientRurality: 'urban' };
  }

  /**
   * Calculate distance-to-care risk weight
   * Higher distances contribute more to readmission risk
   * Based on research showing 15+ miles to care increases risk significantly
   */
  private calculateDistanceToCareRiskWeight(
    distanceToHospital?: number,
    distanceToPcp?: number,
    rucaCategory?: string
  ): number {
    let weight = 0;

    // Hospital distance factor (most critical for readmissions)
    if (distanceToHospital !== undefined) {
      if (distanceToHospital > 60) {
        weight += 0.20; // Very high risk - over 1 hour drive
      } else if (distanceToHospital > 30) {
        weight += 0.15; // High risk - 30-60 min drive
      } else if (distanceToHospital > 15) {
        weight += 0.10; // Moderate risk
      } else if (distanceToHospital > 5) {
        weight += 0.05; // Slight risk
      }
    }

    // PCP distance factor (important for follow-up)
    if (distanceToPcp !== undefined) {
      if (distanceToPcp > 30) {
        weight += 0.08;
      } else if (distanceToPcp > 15) {
        weight += 0.05;
      }
    }

    // RUCA category multiplier for rural areas
    if (rucaCategory === 'isolated_rural') {
      weight *= 1.3; // 30% increase for frontier areas
    } else if (rucaCategory === 'small_rural') {
      weight *= 1.15; // 15% increase for small rural
    }

    // Cap at 0.25 (25% contribution to total risk)
    return Math.min(weight, 0.25);
  }

  private calculateRuralIsolationScore(
    transportation: any,
    isRural: boolean,
    rucaCategory?: string
  ): number {
    if (!isRural) return 0;

    let score = 0;

    // Base score by RUCA category
    switch (rucaCategory) {
      case 'isolated_rural':
        score = 8;
        break;
      case 'small_rural':
        score = 6;
        break;
      case 'large_rural':
        score = 4;
        break;
      default:
        score = 3;
    }

    // Distance factors
    if (transportation?.details?.distance_to_hospital > 60) score += 2;
    else if (transportation?.details?.distance_to_hospital > 30) score += 1;

    if (transportation?.details?.distance_to_pcp > 30) score += 1;

    // Infrastructure factors
    if (!transportation?.details?.public_transit) score += 1;

    return Math.min(score, 10);
  }

  private categorizeInsurance(type?: string): 'medicare' | 'medicaid' | 'commercial' | 'uninsured' | 'dual_eligible' {
    if (!type) return 'uninsured';
    if (type.includes('dual')) return 'dual_eligible';
    if (type.includes('medicaid')) return 'medicaid';
    if (type.includes('medicare')) return 'medicare';
    if (type.includes('commercial') || type.includes('private')) return 'commercial';
    return 'uninsured';
  }

  private categorizeHealthLiteracy(level?: string): 'adequate' | 'marginal' | 'low' {
    if (!level) return 'marginal';
    if (level.includes('adequate')) return 'adequate';
    if (level.includes('low')) return 'low';
    return 'marginal';
  }

  private categorizeCognitiveSeverity(score?: number): 'mild' | 'moderate' | 'severe' | undefined {
    if (!score) return undefined;
    if (score < 4) return undefined;
    if (score < 7) return 'mild';
    if (score < 9) return 'moderate';
    return 'severe';
  }

  private categorizeMobility(walkingAbility?: string): 'independent' | 'cane' | 'walker' | 'wheelchair' | 'bedbound' {
    if (!walkingAbility) return 'independent';
    if (walkingAbility.includes('bedbound')) return 'bedbound';
    if (walkingAbility.includes('wheelchair')) return 'wheelchair';
    if (walkingAbility.includes('walker')) return 'walker';
    if (walkingAbility.includes('cane')) return 'cane';
    return 'independent';
  }

  private calculateFallRiskScore(fallsCount: number, riskAssessment: any): number {
    let score = Math.min(fallsCount * 2, 6); // 2 points per fall, max 6

    if (riskAssessment) {
      if (riskAssessment.mobility_risk_score > 7) score += 2;
      if (riskAssessment.cognitive_risk_score > 6) score += 1;
      if (riskAssessment.walking_ability?.includes('walker') || riskAssessment.walking_ability?.includes('wheelchair')) score += 1;
    }

    return Math.min(score, 10);
  }

  /**
   * Calculate data completeness score
   * Critical for prediction confidence
   */
  private calculateDataCompleteness(features: any): { completeness: number; missingCritical: string[] } {
    const critical = [
      { key: 'clinical.priorAdmissions30Day', weight: 5 },
      { key: 'clinical.comorbidityCount', weight: 5 },
      { key: 'postDischarge.followUpScheduled', weight: 4 },
      { key: 'socialDeterminants.livesAlone', weight: 3 },
      { key: 'medication.activeMedicationCount', weight: 3 }
    ];

    let totalWeight = 0;
    let presentWeight = 0;
    const missing: string[] = [];

    critical.forEach(item => {
      totalWeight += item.weight;
      const value = this.getNestedValue(features, item.key);
      if (value !== undefined && value !== null) {
        presentWeight += item.weight;
      } else {
        missing.push(item.key);
      }
    });

    const completeness = Math.round((presentWeight / totalWeight) * 100);

    return { completeness, missingCritical: missing };
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

export const featureExtractor = new ReadmissionFeatureExtractor();
