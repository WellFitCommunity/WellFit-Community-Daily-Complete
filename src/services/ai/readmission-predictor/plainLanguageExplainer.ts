/**
 * Plain Language Explanation Generator
 *
 * Extracted verbatim from readmissionRiskPredictor.ts during god-file
 * decomposition (CLAUDE.md Commandment #12). Behavior-preserving move only.
 *
 * Generates patient-friendly explanations at 6th grade reading level
 * Uses simple words and connects risk factors to actionable understanding
 */

import type { ReadmissionRiskFeatures } from '../../../types/readmissionRiskFeatures';
import type { RiskFactor, ProtectiveFactor } from './types';

export class PlainLanguageExplainer {
  /**
   * Generate a plain-language summary of the risk prediction
   * Target: Flesch-Kincaid Grade 6 or lower
   */
  static generateExplanation(
    riskCategory: string,
    riskFactors: RiskFactor[],
    protectiveFactors: ProtectiveFactor[],
    features: ReadmissionRiskFeatures
  ): string {
    const parts: string[] = [];

    // Opening - state the risk level in simple terms
    const riskLevelText = this.getRiskLevelText(riskCategory);
    parts.push(riskLevelText);

    // Top 3 risk factors in plain language
    const topRisks = riskFactors.slice(0, 3);
    if (topRisks.length > 0) {
      const riskReasons = topRisks
        .map(rf => this.translateRiskFactor(rf, features))
        .filter(Boolean);

      if (riskReasons.length === 1) {
        parts.push(`The main concern is ${riskReasons[0]}.`);
      } else if (riskReasons.length === 2) {
        parts.push(`This is because ${riskReasons[0]} AND ${riskReasons[1]}.`);
      } else if (riskReasons.length >= 3) {
        parts.push(`This is because ${riskReasons[0]}, ${riskReasons[1]}, and ${riskReasons[2]}.`);
      }
    }

    // Highlight protective factors (hope/positive framing)
    if (protectiveFactors.length > 0) {
      const goodNews = this.translateProtectiveFactor(protectiveFactors[0]);
      if (goodNews) {
        parts.push(`Good news: ${goodNews}`);
      }
    }

    // Add actionable next step
    parts.push(this.getActionableAdvice(riskCategory, features));

    return parts.join(' ');
  }

  private static getRiskLevelText(riskCategory: string): string {
    switch (riskCategory) {
      case 'critical':
        return 'Your risk of going back to the hospital is VERY HIGH.';
      case 'high':
        return 'Your risk of going back to the hospital is HIGH.';
      case 'moderate':
        return 'Your risk of going back to the hospital is MEDIUM.';
      case 'low':
        return 'Your risk of going back to the hospital is LOW. Great job!';
      default:
        return 'We checked your risk of going back to the hospital.';
    }
  }

  private static translateRiskFactor(rf: RiskFactor, features: ReadmissionRiskFeatures): string {
    const factor = rf.factor.toLowerCase();

    // Prior admissions
    if (factor.includes('readmission') || factor.includes('prior admission')) {
      const count = features.clinical.priorAdmissions30Day || features.clinical.priorAdmissions90Day;
      if (count > 0) {
        return `you were in the hospital ${count} time${count > 1 ? 's' : ''} recently`;
      }
      return 'you have been in the hospital before';
    }

    // Check-in compliance
    if (factor.includes('check-in') || factor.includes('missed')) {
      if (features.engagement.consecutiveMissedCheckIns >= 3) {
        return `you missed ${features.engagement.consecutiveMissedCheckIns} check-ins in a row`;
      }
      return 'some daily check-ins were missed';
    }

    // Transportation
    if (factor.includes('transportation')) {
      if (features.socialDeterminants.distanceToNearestHospitalMiles) {
        return `it is hard to get to the doctor (${features.socialDeterminants.distanceToNearestHospitalMiles} miles away)`;
      }
      return 'it is hard to get to your doctor visits';
    }

    // Rural/isolation
    if (factor.includes('rural') || factor.includes('isolation')) {
      return 'you live far from medical help';
    }

    // Lives alone
    if (factor.includes('lives alone') || factor.includes('alone')) {
      return 'you live alone without help at home';
    }

    // Follow-up
    if (factor.includes('follow-up') || factor.includes('no appointment')) {
      return 'you do not have a doctor visit set up yet';
    }

    // Medication
    if (factor.includes('medication') || factor.includes('polypharmacy')) {
      if (features.medication.activeMedicationCount >= 5) {
        return `you take ${features.medication.activeMedicationCount} medicines which can be hard to manage`;
      }
      return 'your medicines need close attention';
    }

    // High-risk conditions
    if (factor.includes('chf') || factor.includes('heart failure')) {
      return 'your heart condition needs careful watching';
    }
    if (factor.includes('copd') || factor.includes('breathing')) {
      return 'your breathing condition needs careful watching';
    }
    if (factor.includes('diabetes')) {
      return 'your blood sugar needs careful watching';
    }

    // Engagement/mood
    if (factor.includes('engagement') || factor.includes('disengaging')) {
      return 'you have been less active with your health lately';
    }
    if (factor.includes('mood')) {
      return 'you have been feeling down lately';
    }

    // Generic fallback - simplify the AI's language
    return rf.factor.toLowerCase()
      .replace('utilization history', 'past hospital visits')
      .replace('social determinants', 'life circumstances')
      .replace('clinical', 'health')
      .replace('adherence', 'following your plan');
  }

  private static translateProtectiveFactor(pf: ProtectiveFactor): string {
    const factor = pf.factor.toLowerCase();

    if (factor.includes('family') || factor.includes('caregiver')) {
      return 'You have family or friends who can help you.';
    }
    if (factor.includes('follow-up') || factor.includes('appointment')) {
      return 'You have a doctor visit coming up soon.';
    }
    if (factor.includes('check-in') || factor.includes('compliance')) {
      return 'You have been doing your daily check-ins.';
    }
    if (factor.includes('support')) {
      return 'You have good support at home.';
    }
    if (factor.includes('medication')) {
      return 'You are taking your medicines as planned.';
    }

    return `${pf.factor} helps protect you.`;
  }

  private static getActionableAdvice(riskCategory: string, features: ReadmissionRiskFeatures): string {
    // Prioritize the most actionable advice based on features
    if (!features.postDischarge.followUpScheduled) {
      return 'Please call your doctor to set up a visit in the next 7 days.';
    }

    if (features.engagement.consecutiveMissedCheckIns >= 2) {
      return 'Please do your daily check-in today - it helps us help you.';
    }

    if (features.socialDeterminants.hasTransportationBarrier) {
      return 'Talk to your care team about getting rides to your appointments.';
    }

    if (features.socialDeterminants.livesAlone && !features.socialDeterminants.hasCaregiver) {
      return 'Consider asking a family member or friend to check on you this week.';
    }

    if (riskCategory === 'critical' || riskCategory === 'high') {
      return 'Your care team will reach out to help you stay healthy at home.';
    }

    return 'Keep doing your check-ins and take your medicines as planned.';
  }
}
