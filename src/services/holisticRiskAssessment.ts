// services/holisticRiskAssessment.ts
// Holistic Risk Assessment System - God's vision for comprehensive senior care
// Integrates ALL dimensions of wellbeing to identify at-risk patients

import { SupabaseClient } from '@supabase/supabase-js';
import { logPhiAccess } from './phiAccessLogger';

/**
 * HOLISTIC RISK DIMENSIONS
 * Each scored 0-10 (10 = highest risk)
 *
 * 1. Engagement Score (behavioral activity)
 * 2. Vitals Risk Score (BP, blood sugar, oxygen, weight trends)
 * 3. Mental/Emotional Health Score (mood, stress, anxiety patterns)
 * 4. Social Isolation Score (interaction frequency, loneliness indicators)
 * 5. Physical Activity Score (exercise, mobility, energy levels)
 * 6. Medication Adherence Score (compliance, missed doses)
 * 7. Clinical Risk Score (from formal risk assessment by provider)
 *
 * COMPOSITE RISK = Average of all 7 scores
 */

export interface HolisticRiskScores {
  // Individual dimension scores (0-10, 10 = highest risk)
  engagement_risk: number;          // From activity tracking (inverted from engagement score)
  vitals_risk: number;              // From self-reported vitals trends
  mental_health_risk: number;       // From mood, stress, anxiety self-reports
  social_isolation_risk: number;    // From social engagement patterns
  physical_activity_risk: number;   // From exercise/activity self-reports
  medication_adherence_risk: number; // From medication tracking
  clinical_risk: number;            // From provider risk assessment

  // Composite & metadata
  composite_risk_score: number;     // Average of all 7 (0-10)
  risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  confidence: number;               // 0-100% based on data completeness
  last_calculated: string;

  // Supporting data counts (for confidence scoring)
  data_points: {
    check_ins_30d: number;
    games_30d: number;
    self_reports_30d: number;
    vitals_readings_30d: number;
    mood_entries_30d: number;
    social_interactions_30d: number;
    activity_logs_30d: number;
  };
}

/**
 * Calculate engagement risk score (inverse of engagement score)
 * Low engagement = HIGH RISK
 * Includes ALL activities: check-ins, self-reports, games, questions, community, meals
 */
export async function calculateEngagementRisk(
  supabase: SupabaseClient,
  userId: string
): Promise<{ score: number; dataPoints: number }> {
  try {
    // Get comprehensive engagement data from view
    const { data, error } = await supabase
      .from('patient_engagement_scores')
      .select('engagement_score, check_ins_30d, check_ins_7d, self_reports_30d, self_reports_7d, trivia_games_30d, word_games_30d, questions_asked_30d, community_photos_30d, physical_activity_reports_30d, social_engagement_reports_30d, no_activity_7days')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return { score: 5.0, dataPoints: 0 }; // Default moderate risk if no data
    }

    const engagementScore = data.engagement_score || 0;

    // Count all activities from the comprehensive view
    const totalActivities = (
      (data.check_ins_30d || 0) +
      (data.self_reports_30d || 0) +
      (data.trivia_games_30d || 0) +
      (data.word_games_30d || 0) +
      (data.questions_asked_30d || 0) +
      (data.community_photos_30d || 0) +
      (data.physical_activity_reports_30d || 0) +
      (data.social_engagement_reports_30d || 0)
    );

    // Invert engagement score to risk (0-100 engagement → 10-0 risk)
    // 0-19 engagement (CRITICAL) → 9-10 risk
    // 20-39 engagement (LOW) → 7-8.9 risk
    // 40-69 engagement (MEDIUM) → 4-6.9 risk
    // 70-100 engagement (HIGH) → 0-3.9 risk
    let riskScore = engagementScore >= 70 ? 2.0 :
                    engagementScore >= 40 ? 5.0 :
                    engagementScore >= 20 ? 7.5 :
                    9.5; // CRITICAL

    // Additional risk factor: No activity in last 7 days is a red flag
    if (data.no_activity_7days) {
      riskScore = Math.min(10, riskScore + 2.0); // Boost risk if completely inactive
    }

    return { score: riskScore, dataPoints: totalActivities };
  } catch (err) {

    return { score: 5.0, dataPoints: 0 };
  }
}

/**
 * Calculate vitals risk score from self-reported health metrics AND check-ins
 * Analyzes BP, blood sugar, oxygen, weight trends from both sources
 */
export async function calculateVitalsRisk(
  supabase: SupabaseClient,
  userId: string
): Promise<{ score: number; dataPoints: number }> {
  try {
    // Fetch from BOTH self_reports AND check_ins tables
    const [selfReportsResult, checkInsResult] = await Promise.all([
      supabase
        .from('self_reports')
        .select('bp_systolic, bp_diastolic, blood_sugar, blood_oxygen, weight, spo2, created_at')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false }),
      supabase
        .from('check_ins')
        .select('bp_systolic, bp_diastolic, glucose_mg_dl, pulse_oximeter, heart_rate, created_at')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
    ]);

    // Merge and normalize data from both sources
    const allVitals = [
      ...(selfReportsResult.data || []).map(r => ({
        bp_systolic: r.bp_systolic,
        bp_diastolic: r.bp_diastolic,
        blood_sugar: r.blood_sugar,
        blood_oxygen: r.blood_oxygen || r.spo2,
        weight: r.weight,
        created_at: r.created_at
      })),
      ...(checkInsResult.data || []).map(r => ({
        bp_systolic: r.bp_systolic,
        bp_diastolic: r.bp_diastolic,
        blood_sugar: r.glucose_mg_dl,
        blood_oxygen: r.pulse_oximeter,
        weight: undefined, // check_ins don't track weight
        created_at: r.created_at
      }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (allVitals.length === 0) {
      return { score: 5.0, dataPoints: 0 }; // Default if no data
    }

    const data = allVitals;

    let riskScore = 0;
    let riskFactors = 0;

    // Check most recent vitals
    const latest = data[0];

    // Blood Pressure Risk (Systolic > 140 or < 90, Diastolic > 90 or < 60)
    if (latest.bp_systolic) {
      if (latest.bp_systolic >= 180 || latest.bp_systolic < 80) {
        riskScore += 3; // Critical
        riskFactors++;
      } else if (latest.bp_systolic >= 140 || latest.bp_systolic < 90) {
        riskScore += 2; // High
        riskFactors++;
      } else if (latest.bp_systolic >= 130) {
        riskScore += 1; // Elevated
        riskFactors++;
      } else {
        riskFactors++;
      }
    }

    if (latest.bp_diastolic) {
      if (latest.bp_diastolic >= 120 || latest.bp_diastolic < 50) {
        riskScore += 3;
        riskFactors++;
      } else if (latest.bp_diastolic >= 90 || latest.bp_diastolic < 60) {
        riskScore += 2;
        riskFactors++;
      } else if (latest.bp_diastolic >= 80) {
        riskScore += 1;
        riskFactors++;
      } else {
        riskFactors++;
      }
    }

    // Blood Sugar Risk (> 180 or < 70)
    if (latest.blood_sugar) {
      if (latest.blood_sugar >= 250 || latest.blood_sugar < 60) {
        riskScore += 3; // Critical
        riskFactors++;
      } else if (latest.blood_sugar >= 180 || latest.blood_sugar < 70) {
        riskScore += 2; // High
        riskFactors++;
      } else if (latest.blood_sugar >= 140) {
        riskScore += 1; // Elevated
        riskFactors++;
      } else {
        riskFactors++;
      }
    }

    // Blood Oxygen Risk (< 92% is concerning)
    const oxygen = latest.blood_oxygen;
    if (oxygen) {
      if (oxygen < 88) {
        riskScore += 3; // Critical
        riskFactors++;
      } else if (oxygen < 92) {
        riskScore += 2; // High
        riskFactors++;
      } else if (oxygen < 95) {
        riskScore += 1; // Mild concern
        riskFactors++;
      } else {
        riskFactors++;
      }
    }

    // Weight trend analysis (if multiple readings)
    if (data.length >= 3) {
      const weights = data.slice(0, 3).filter(r => r.weight).map(r => r.weight!);
      if (weights.length >= 2) {
        const weightChange = Math.abs(weights[0] - weights[weights.length - 1]);
        const percentChange = (weightChange / weights[weights.length - 1]) * 100;

        if (percentChange >= 5) { // 5%+ weight change in 30 days
          riskScore += 2;
          riskFactors++;
        } else if (percentChange >= 3) {
          riskScore += 1;
          riskFactors++;
        } else {
          riskFactors++;
        }
      }
    }

    // Normalize to 0-10 scale
    const normalizedScore = riskFactors > 0 ? (riskScore / riskFactors) * 3.33 : 5.0;
    return { score: Math.min(10, normalizedScore), dataPoints: data.length };
  } catch (err) {

    return { score: 5.0, dataPoints: 0 };
  }
}

/**
 * Calculate mental/emotional health risk from mood patterns
 * Analyzes self-reported mood, stress, anxiety AND check-in emotional states
 */
export async function calculateMentalHealthRisk(
  supabase: SupabaseClient,
  userId: string
): Promise<{ score: number; dataPoints: number }> {
  try {
    // Fetch from BOTH self_reports AND check_ins tables
    const [selfReportsResult, checkInsResult] = await Promise.all([
      supabase
        .from('self_reports')
        .select('mood, symptoms, created_at')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false }),
      supabase
        .from('check_ins')
        .select('emotional_state, notes, created_at')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
    ]);

    // Merge data from both sources
    const allMoodData = [
      ...(selfReportsResult.data || []).map(r => ({
        mood: r.mood,
        symptoms: r.symptoms,
        created_at: r.created_at
      })),
      ...(checkInsResult.data || []).map(r => ({
        mood: r.emotional_state, // Map emotional_state to mood
        symptoms: r.notes, // Use notes as additional symptom context
        created_at: r.created_at
      }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (allMoodData.length === 0) {
      return { score: 5.0, dataPoints: 0 };
    }

    const data = allMoodData;

    let riskScore = 0;
    let moodCount = 0;

    // Mood risk scoring
    const moodRiskMap: Record<string, number> = {
      'Great': 0,
      'Good': 1,
      'Okay': 3,
      'Not Great': 5,
      'Sad': 7,
      'Anxious': 8,
      'Tired': 4,
      'Stressed': 7
    };

    data.forEach((report) => {
      if (report.mood) {
        const mood = report.mood.trim();
        const moodRisk = moodRiskMap[mood] !== undefined ? moodRiskMap[mood] : 3;
        riskScore += moodRisk;
        moodCount++;
      }
    });

    // Check for concerning symptom patterns
    const concerningSymptoms = ['depressed', 'hopeless', 'suicidal', 'anxious', 'panic', 'overwhelmed', 'crying'];
    const symptomsText = data.map(r => (r.symptoms || '').toLowerCase()).join(' ');
    const hasConCerningSymptoms = concerningSymptoms.some(symptom => symptomsText.includes(symptom));

    if (hasConCerningSymptoms) {
      riskScore += 30; // Significant flag
    }

    // Normalize to 0-10
    const averageRisk = moodCount > 0 ? riskScore / moodCount : 5.0;
    return { score: Math.min(10, averageRisk), dataPoints: data.length };
  } catch (err) {

    return { score: 5.0, dataPoints: 0 };
  }
}

/**
 * Calculate social isolation risk
 * Analyzes social engagement patterns and loneliness indicators
 */
export async function calculateSocialIsolationRisk(
  supabase: SupabaseClient,
  userId: string
): Promise<{ score: number; dataPoints: number }> {
  try {
    const { data, error } = await supabase
      .from('self_reports')
      .select('social_engagement, created_at')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      return { score: 7.0, dataPoints: 0 }; // Default higher risk if no data (concerning)
    }

    let isolationScore = 0;
    let interactionCount = 0;

    // Social engagement risk scoring (lower = more isolated = higher risk)
    const socialRiskMap: Record<string, number> = {
      'Spent time with family': 0,
      'Called/texted friends': 1,
      'Attended social event': 0,
      'Volunteered': 0,
      'Went to religious service': 1,
      'Participated in group activity': 0,
      'Had visitors': 1,
      'Went out with others': 0,
      'Stayed home alone': 9,
      'Connected online/video call': 2
    };

    data.forEach((report) => {
      if (report.social_engagement) {
        const engagement = report.social_engagement.trim();
        const engagementRisk = socialRiskMap[engagement] !== undefined ? socialRiskMap[engagement] : 5;
        isolationScore += engagementRisk;
        interactionCount++;
      }
    });

    // Frequency analysis - infrequent reporting is itself a risk factor
    const daysTracked = data.length;
    if (daysTracked < 5) {
      isolationScore += 3; // Barely tracking = potential isolation
    }

    // Check for pattern of staying home alone
    const stayedAloneCount = data.filter(r =>
      r.social_engagement && r.social_engagement.includes('Stayed home alone')
    ).length;

    if (stayedAloneCount >= data.length * 0.7) { // 70%+ alone
      isolationScore += 3; // Chronic isolation pattern
    }

    // Normalize to 0-10
    const averageRisk = interactionCount > 0 ? isolationScore / interactionCount : 7.0;
    return { score: Math.min(10, averageRisk), dataPoints: data.length };
  } catch (err) {

    return { score: 7.0, dataPoints: 0 };
  }
}

/**
 * Calculate physical activity risk
 * Analyzes exercise patterns and mobility
 */
export async function calculatePhysicalActivityRisk(
  supabase: SupabaseClient,
  userId: string
): Promise<{ score: number; dataPoints: number }> {
  try {
    const { data, error } = await supabase
      .from('self_reports')
      .select('physical_activity, activity_description, created_at')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false});

    if (error || !data || data.length === 0) {
      return { score: 6.0, dataPoints: 0 }; // Moderate-high risk if no data
    }

    let activityScore = 0;
    let activityCount = 0;

    // Physical activity risk scoring (sedentary = high risk)
    const activityRiskMap: Record<string, number> = {
      'Walking': 1,
      'Gym/Fitness Center': 0,
      'YMCA': 0,
      'Swimming': 0,
      'Yoga/Stretching': 1,
      'Dancing': 0,
      'Gardening': 2,
      'Housework': 3,
      'Resting/No Activity': 10
    };

    data.forEach((report) => {
      if (report.physical_activity) {
        const activity = report.physical_activity.trim();
        const risk = activityRiskMap[activity] !== undefined ? activityRiskMap[activity] : 5;
        activityScore += risk;
        activityCount++;
      }
    });

    // Check for sedentary pattern
    const sedentaryCount = data.filter(r =>
      r.physical_activity && (
        r.physical_activity.includes('Resting') ||
        r.physical_activity.includes('No Activity')
      )
    ).length;

    if (sedentaryCount >= data.length * 0.5) { // 50%+ sedentary
      activityScore += 15; // Major risk factor
    }

    // Normalize to 0-10
    const averageRisk = activityCount > 0 ? activityScore / activityCount : 6.0;
    return { score: Math.min(10, averageRisk), dataPoints: data.length };
  } catch (err) {

    return { score: 6.0, dataPoints: 0 };
  }
}

/**
 * Calculate medication adherence risk
 * TODO: Integrate with medication tracking when available
 */
export async function calculateMedicationAdherenceRisk(
  supabase: SupabaseClient,
  userId: string
): Promise<{ score: number; dataPoints: number }> {
  try {
    // Check for medication adherence data
    // This will integrate with medication tracking system
    // For now, check self-report symptoms for medication-related concerns

    const { data, error } = await supabase
      .from('self_reports')
      .select('symptoms, created_at')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (error || !data) {
      return { score: 5.0, dataPoints: 0 };
    }

    // Check for medication non-compliance indicators
    const symptomsText = data.map(r => (r.symptoms || '').toLowerCase()).join(' ');
    const nonComplianceKeywords = ['forgot medication', 'missed dose', 'ran out', 'side effects', 'stopped taking'];

    const hasNonCompliance = nonComplianceKeywords.some(keyword => symptomsText.includes(keyword));

    if (hasNonCompliance) {
      return { score: 8.0, dataPoints: data.length }; // High risk if mentions non-adherence
    }

    return { score: 3.0, dataPoints: data.length }; // Default low risk if no concerns mentioned
  } catch (err) {

    return { score: 5.0, dataPoints: 0 };
  }
}

/**
 * Get clinical risk score from provider assessment
 */
export async function getClinicalRiskScore(
  supabase: SupabaseClient,
  userId: string
): Promise<{ score: number; dataPoints: number }> {
  try {
    const { data, error } = await supabase
      .from('risk_assessments')
      .select('overall_score, risk_level, created_at')
      .eq('patient_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return { score: 5.0, dataPoints: 0 }; // Default moderate if no assessment
    }

    // overall_score from risk assessment is already 0-10
    return { score: data.overall_score || 5.0, dataPoints: 1 };
  } catch (err) {

    return { score: 5.0, dataPoints: 0 };
  }
}

/**
 * Calculate comprehensive holistic risk assessment
 * Integrates all 7 dimensions of senior wellbeing
 */
export async function calculateHolisticRiskAssessment(
  supabase: SupabaseClient,
  userId: string
): Promise<HolisticRiskScores> {
  try {
    // HIPAA §164.312(b): Log PHI access for risk assessment
    await logPhiAccess({
      phiType: 'assessment',
      phiResourceId: `risk_assessment_${userId}`,
      patientId: userId,
      accessType: 'view',
      accessMethod: 'API',
      purpose: 'treatment',
    });

    // Calculate all dimension scores in parallel
    const [
      engagement,
      vitals,
      mentalHealth,
      socialIsolation,
      physicalActivity,
      medicationAdherence,
      clinical
    ] = await Promise.all([
      calculateEngagementRisk(supabase, userId),
      calculateVitalsRisk(supabase, userId),
      calculateMentalHealthRisk(supabase, userId),
      calculateSocialIsolationRisk(supabase, userId),
      calculatePhysicalActivityRisk(supabase, userId),
      calculateMedicationAdherenceRisk(supabase, userId),
      getClinicalRiskScore(supabase, userId)
    ]);

    // Calculate composite risk (average of all dimensions)
    const scores = [
      engagement.score,
      vitals.score,
      mentalHealth.score,
      socialIsolation.score,
      physicalActivity.score,
      medicationAdherence.score,
      clinical.score
    ];

    const compositeScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

    // Determine risk level based on composite score
    let riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
    let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

    if (compositeScore >= 8) {
      riskLevel = 'CRITICAL';
      priority = 'URGENT';
    } else if (compositeScore >= 6) {
      riskLevel = 'HIGH';
      priority = 'HIGH';
    } else if (compositeScore >= 4) {
      riskLevel = 'MODERATE';
      priority = 'MEDIUM';
    } else {
      riskLevel = 'LOW';
      priority = 'LOW';
    }

    // Calculate confidence based on data completeness
    const totalDataPoints = Object.values({
      engagement: engagement.dataPoints,
      vitals: vitals.dataPoints,
      mentalHealth: mentalHealth.dataPoints,
      socialIsolation: socialIsolation.dataPoints,
      physicalActivity: physicalActivity.dataPoints,
      medicationAdherence: medicationAdherence.dataPoints,
      clinical: clinical.dataPoints
    }).reduce((sum, points) => sum + points, 0);

    // Confidence: more data = higher confidence (max 100%)
    const confidence = Math.min(100, (totalDataPoints / 50) * 100);

    return {
      engagement_risk: engagement.score,
      vitals_risk: vitals.score,
      mental_health_risk: mentalHealth.score,
      social_isolation_risk: socialIsolation.score,
      physical_activity_risk: physicalActivity.score,
      medication_adherence_risk: medicationAdherence.score,
      clinical_risk: clinical.score,

      composite_risk_score: compositeScore,
      risk_level: riskLevel,
      priority: priority,
      confidence: confidence,
      last_calculated: new Date().toISOString(),

      data_points: {
        check_ins_30d: engagement.dataPoints,
        games_30d: engagement.dataPoints,
        self_reports_30d: vitals.dataPoints + mentalHealth.dataPoints,
        vitals_readings_30d: vitals.dataPoints,
        mood_entries_30d: mentalHealth.dataPoints,
        social_interactions_30d: socialIsolation.dataPoints,
        activity_logs_30d: physicalActivity.dataPoints
      }
    };
  } catch (err) {

    throw err;
  }
}
