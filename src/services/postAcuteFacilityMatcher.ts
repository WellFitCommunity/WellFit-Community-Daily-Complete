// Post-Acute Facility Matcher - AI-Powered Placement Recommendations
// Uses Claude AI to recommend optimal post-acute care settings
// Matches patients to SNFs, Rehabs, Home Health based on clinical needs

import { supabase } from '../lib/supabaseClient';
import { getErrorMessage } from '../lib/getErrorMessage';
import { claudeService } from './claudeService';
import { UserRole, RequestType, ClaudeRequestContext } from '../types/claude';
import type { PostAcuteFacility } from './dischargePlanningService';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PatientPostAcuteNeeds {
  patient_id: string;
  age: number;
  primary_diagnosis: string;
  secondary_diagnoses?: string[];

  // Functional status
  adl_score: number; // Activities of Daily Living (0-100, lower = more dependent)
  mobility_level: 'ambulatory' | 'walker' | 'wheelchair' | 'bedbound';
  cognitive_status: 'intact' | 'mild_impairment' | 'moderate_impairment' | 'severe_impairment';

  // Clinical factors
  requires_iv_therapy: boolean;
  requires_wound_care: boolean;
  requires_physical_therapy: boolean;
  requires_occupational_therapy: boolean;
  requires_speech_therapy: boolean;
  requires_skilled_nursing: boolean;
  requires_24hr_monitoring: boolean;

  // Social factors
  has_caregiver_at_home: boolean;
  home_environment_safe: boolean;
  insurance_type: 'medicare' | 'medicaid' | 'commercial' | 'self_pay';

  // Geographic
  preferred_zip_code?: string;
  max_distance_miles?: number;
}

export interface PostAcuteRecommendation {
  recommended_setting:
    | 'home'
    | 'home_with_home_health'
    | 'skilled_nursing'
    | 'inpatient_rehab'
    | 'long_term_acute_care';
  confidence_score: number; // 0-100
  rationale: string;
  care_needs_summary: string;
  estimated_length_of_stay_days?: number;

  // Facility matches (if not home)
  matched_facilities: Array<{
    facility: PostAcuteFacility;
    match_score: number; // 0-100
    match_reasons: string[];
    concerns?: string[];
  }>;

  // Alternative recommendations
  alternative_settings?: Array<{
    setting: string;
    rationale: string;
  }>;
}

// ============================================================================
// POST-ACUTE FACILITY MATCHER SERVICE
// ============================================================================

export class PostAcuteFacilityMatcher {
  /**
   * Get AI-powered recommendation for post-acute placement
   */
  static async recommendPostAcuteSetting(needs: PatientPostAcuteNeeds): Promise<PostAcuteRecommendation> {
    try {
      // Get AI recommendation for setting
      const aiRecommendation = await this.getAIRecommendation(needs);

      // If recommendation is facility-based, find matching facilities
      let matchedFacilities: PostAcuteRecommendation['matched_facilities'] = [];

      if (aiRecommendation.recommended_setting !== 'home') {
        const facilityType = this.mapSettingToFacilityType(aiRecommendation.recommended_setting);
        if (facilityType) {
          matchedFacilities = await this.findMatchingFacilities(needs, facilityType);
        }
      }

      return {
        ...aiRecommendation,
        matched_facilities: matchedFacilities,
      };
    } catch (err: unknown) {
      throw new Error(`Failed to generate recommendation: ${getErrorMessage(err)}`);
    }
  }

  /**
   * Use Claude AI to analyze patient needs and recommend setting
   */
  private static async getAIRecommendation(
    needs: PatientPostAcuteNeeds
  ): Promise<Omit<PostAcuteRecommendation, 'matched_facilities'>> {
    try {
      const context: ClaudeRequestContext = {
        userId: 'post-acute-matcher',
        userRole: UserRole.ADMIN,
        requestId: `post-acute-${needs.patient_id}`,
        timestamp: new Date(),
        requestType: RequestType.RISK_ASSESSMENT,
      };

      const prompt = `Analyze this patient's post-acute care needs and recommend the most appropriate care setting.

PATIENT PROFILE:
- Age: ${needs.age} years old
- Primary Diagnosis: ${needs.primary_diagnosis}
${needs.secondary_diagnoses?.length ? `- Secondary Diagnoses: ${needs.secondary_diagnoses.join(', ')}` : ''}

FUNCTIONAL STATUS:
- ADL Score: ${needs.adl_score}/100 (0=fully dependent, 100=independent)
- Mobility: ${needs.mobility_level}
- Cognitive Status: ${needs.cognitive_status}

CLINICAL NEEDS:
- IV Therapy: ${needs.requires_iv_therapy ? 'Yes' : 'No'}
- Wound Care: ${needs.requires_wound_care ? 'Yes' : 'No'}
- Physical Therapy: ${needs.requires_physical_therapy ? 'Yes' : 'No'}
- Occupational Therapy: ${needs.requires_occupational_therapy ? 'Yes' : 'No'}
- Speech Therapy: ${needs.requires_speech_therapy ? 'Yes' : 'No'}
- Skilled Nursing: ${needs.requires_skilled_nursing ? 'Yes' : 'No'}
- 24-Hour Monitoring: ${needs.requires_24hr_monitoring ? 'Yes' : 'No'}

SOCIAL FACTORS:
- Caregiver at Home: ${needs.has_caregiver_at_home ? 'Yes' : 'No'}
- Safe Home Environment: ${needs.home_environment_safe ? 'Yes' : 'No'}
- Insurance: ${needs.insurance_type}

POST-ACUTE SETTING OPTIONS:
1. HOME - Patient can manage at home independently
2. HOME_WITH_HOME_HEALTH - Needs intermittent skilled nursing/therapy at home
3. SKILLED_NURSING - Needs 24-hour nursing care (SNF)
4. INPATIENT_REHAB - Needs intensive rehabilitation (3+ hours/day)
5. LONG_TERM_ACUTE_CARE - Medically complex, needs hospital-level care

Based on Medicare/Medicaid guidelines:
- Inpatient Rehab: Must tolerate 3+ hours therapy/day, have rehab potential
- Skilled Nursing: Needs daily skilled care (not custodial)
- Home Health: Homebound status, needs intermittent skilled care
- Home: Safe, independent, minimal ongoing needs

Provide your recommendation in this JSON format:
{
  "recommended_setting": "home|home_with_home_health|skilled_nursing|inpatient_rehab|long_term_acute_care",
  "confidence_score": 0-100,
  "rationale": "2-3 sentence explanation based on patient needs and Medicare criteria",
  "care_needs_summary": "Brief summary of required care services",
  "estimated_length_of_stay_days": number (null if home),
  "alternative_settings": [
    {
      "setting": "alternative option",
      "rationale": "why this could work"
    }
  ]
}

Be evidence-based and follow Medicare/Medicaid eligibility criteria.`;

      const aiResponse = await claudeService.generateMedicalAnalytics(prompt, [], context);

      // Parse AI response
      let recommendation;
      try {
        const jsonMatch = aiResponse.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          recommendation = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in AI response');
        }
      } catch (_parseError: unknown) {
        recommendation = this.getFallbackRecommendation(needs);
      }

      return recommendation;
    } catch (_err: unknown) {
      return this.getFallbackRecommendation(needs);
    }
  }

  /**
   * Find matching facilities based on patient needs and geographic preferences
   */
  private static async findMatchingFacilities(
    needs: PatientPostAcuteNeeds,
    facilityType: PostAcuteFacility['facility_type']
  ): Promise<PostAcuteRecommendation['matched_facilities']> {
    try {
      // Search for facilities
      let query = supabase
        .from('post_acute_facilities')
        .select('*')
        .eq('facility_type', facilityType)
        .eq('active', true);

      // Filter by insurance acceptance
      if (needs.insurance_type === 'medicare') {
        query = query.eq('accepts_medicare', true);
      } else if (needs.insurance_type === 'medicaid') {
        query = query.eq('accepts_medicaid', true);
      }

      // Geographic filter
      if (needs.preferred_zip_code) {
        query = query.eq('facility_zip', needs.preferred_zip_code);
      }

      // Prefer facilities with available beds
      query = query.order('available_beds', { ascending: false });
      query = query.order('cms_star_rating', { ascending: false });
      query = query.limit(10);

      const { data: facilities, error } = await query;

      if (error) throw error;

      if (!facilities || facilities.length === 0) {
        return [];
      }

      // Score each facility
      const matchedFacilities = facilities.map((facility) => {
        const matchResult = this.scoreFacilityMatch(facility, needs);
        return {
          facility,
          match_score: matchResult.score,
          match_reasons: matchResult.reasons,
          concerns: matchResult.concerns,
        };
      });

      // Sort by match score
      matchedFacilities.sort((a, b) => b.match_score - a.match_score);

      return matchedFacilities;
    } catch (_err: unknown) {
      return [];
    }
  }

  /**
   * Score how well a facility matches patient needs
   */
  private static scoreFacilityMatch(
    facility: PostAcuteFacility,
    needs: PatientPostAcuteNeeds
  ): { score: number; reasons: string[]; concerns: string[] } {
    let score = 50; // Base score
    const reasons: string[] = [];
    const concerns: string[] = [];

    // Available beds (critical)
    if (facility.available_beds && facility.available_beds > 0) {
      score += 20;
      reasons.push(`${facility.available_beds} beds available`);
    } else {
      score -= 30;
      concerns.push('No available beds currently');
    }

    // CMS Star Rating
    if (facility.cms_star_rating) {
      if (facility.cms_star_rating >= 4.5) {
        score += 15;
        reasons.push(`Excellent ${facility.cms_star_rating}-star CMS rating`);
      } else if (facility.cms_star_rating >= 3.5) {
        score += 10;
        reasons.push(`Good ${facility.cms_star_rating}-star CMS rating`);
      } else if (facility.cms_star_rating < 2.5) {
        score -= 10;
        concerns.push(`Low ${facility.cms_star_rating}-star CMS rating`);
      }
    }

    // Insurance acceptance
    const insuranceAccepted =
      (needs.insurance_type === 'medicare' && facility.accepts_medicare) ||
      (needs.insurance_type === 'medicaid' && facility.accepts_medicaid);

    if (insuranceAccepted) {
      score += 10;
      reasons.push(`Accepts ${needs.insurance_type}`);
    } else {
      score -= 20;
      concerns.push(`May not accept ${needs.insurance_type}`);
    }

    // Preferred provider
    if (facility.is_preferred_provider) {
      score += 10;
      reasons.push('Preferred network provider');
    }

    // Specialty matching
    if (facility.specialties && facility.specialties.length > 0) {
      // Check if specialties match patient needs
      const needsCardiacCare =
        needs.primary_diagnosis.toLowerCase().includes('cardiac') ||
        needs.primary_diagnosis.toLowerCase().includes('heart');
      const needsOrthoCare =
        needs.primary_diagnosis.toLowerCase().includes('fracture') ||
        needs.primary_diagnosis.toLowerCase().includes('joint') ||
        needs.mobility_level === 'walker';
      const needsStrokeCare =
        needs.primary_diagnosis.toLowerCase().includes('stroke') ||
        needs.primary_diagnosis.toLowerCase().includes('cva');

      if (needsCardiacCare && facility.specialties.includes('cardiac_care')) {
        score += 15;
        reasons.push('Specializes in cardiac care');
      }
      if (needsOrthoCare && facility.specialties.includes('orthopedic')) {
        score += 15;
        reasons.push('Specializes in orthopedic care');
      }
      if (needsStrokeCare && facility.specialties.includes('stroke')) {
        score += 15;
        reasons.push('Specializes in stroke rehabilitation');
      }
    }

    // Cap score at 100
    score = Math.min(Math.max(score, 0), 100);

    return { score, reasons, concerns };
  }

  /**
   * Map recommended setting to facility type
   */
  private static mapSettingToFacilityType(setting: string): PostAcuteFacility['facility_type'] | null {
    switch (setting) {
      case 'skilled_nursing':
        return 'skilled_nursing';
      case 'inpatient_rehab':
        return 'inpatient_rehab';
      case 'long_term_acute_care':
        return 'long_term_acute_care';
      case 'home_with_home_health':
        return 'home_health_agency';
      default:
        return null;
    }
  }

  /**
   * Fallback recommendation when AI fails (rules-based)
   */
  private static getFallbackRecommendation(needs: PatientPostAcuteNeeds): Omit<PostAcuteRecommendation, 'matched_facilities'> {
    // Rules-based logic

    // Long-term acute care criteria
    if (needs.requires_24hr_monitoring && needs.requires_iv_therapy) {
      return {
        recommended_setting: 'long_term_acute_care',
        confidence_score: 70,
        rationale: 'Patient requires hospital-level care with 24-hour monitoring and IV therapy.',
        care_needs_summary: 'Complex medical needs requiring LTAC facility',
        estimated_length_of_stay_days: 30,
      };
    }

    // Inpatient rehab criteria
    if (
      needs.adl_score < 60 &&
      (needs.requires_physical_therapy || needs.requires_occupational_therapy) &&
      needs.mobility_level !== 'bedbound'
    ) {
      return {
        recommended_setting: 'inpatient_rehab',
        confidence_score: 75,
        rationale: 'Patient has rehabilitation potential and can tolerate intensive therapy.',
        care_needs_summary: 'Intensive rehabilitation therapy (3+ hours/day)',
        estimated_length_of_stay_days: 21,
      };
    }

    // Skilled nursing criteria
    if (needs.adl_score < 70 || needs.requires_skilled_nursing || needs.requires_wound_care || !needs.has_caregiver_at_home) {
      return {
        recommended_setting: 'skilled_nursing',
        confidence_score: 80,
        rationale: 'Patient requires daily skilled nursing care and assistance with ADLs.',
        care_needs_summary: 'Skilled nursing and therapy services',
        estimated_length_of_stay_days: 14,
      };
    }

    // Home health criteria
    if (
      needs.has_caregiver_at_home &&
      needs.home_environment_safe &&
      (needs.requires_physical_therapy || needs.requires_skilled_nursing)
    ) {
      return {
        recommended_setting: 'home_with_home_health',
        confidence_score: 85,
        rationale: 'Patient has support at home and can benefit from intermittent home health services.',
        care_needs_summary: 'Home health nursing and therapy visits',
      };
    }

    // Home (independent)
    return {
      recommended_setting: 'home',
      confidence_score: 75,
      rationale: 'Patient is relatively independent and has adequate support at home.',
      care_needs_summary: 'Outpatient follow-up care',
    };
  }

  /**
   * Get detailed facility information
   */
  static async getFacilityDetails(facilityId: string): Promise<PostAcuteFacility> {
    const { data, error } = await supabase.from('post_acute_facilities').select('*').eq('id', facilityId).single();

    if (error) throw new Error(`Failed to get facility: ${error.message}`);
    return data;
  }

  /**
   * Update facility bed availability
   */
  static async updateFacilityBeds(facilityId: string, availableBeds: number): Promise<void> {
    const { error } = await supabase
      .from('post_acute_facilities')
      .update({
        available_beds: availableBeds,
        last_bed_count_update: new Date().toISOString(),
      })
      .eq('id', facilityId);

    if (error) throw new Error(`Failed to update facility beds: ${error.message}`);
  }
}

export default PostAcuteFacilityMatcher;
