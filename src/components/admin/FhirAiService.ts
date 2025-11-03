// AI-Enhanced FHIR Service for WellFit Community
// Provides intelligent analytics, predictive insights, and automated recommendations

interface HealthRiskAssessment {
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  riskScore: number; // 0-100
  riskFactors: string[];
  recommendations: string[];
  priority: number; // 1-5, where 5 is highest priority
  lastAssessed: string;
  trendDirection: 'IMPROVING' | 'STABLE' | 'DECLINING';
}

interface VitalsTrend {
  metric: 'bp_systolic' | 'bp_diastolic' | 'heart_rate' | 'glucose_mg_dl' | 'pulse_oximeter';
  current: number;
  previous: number;
  trend: 'RISING' | 'FALLING' | 'STABLE';
  changePercent: number;
  isAbnormal: boolean;
  normalRange: { min: number; max: number };
  recommendation?: string;
}

interface PatientInsight {
  patientId: string;
  patientName: string;
  overallHealthScore: number; // 0-100
  riskAssessment: HealthRiskAssessment;
  vitalsTrends: VitalsTrend[];
  adherenceScore: number; // 0-100, based on check-in frequency
  lastCheckIn: string;
  emergencyAlerts: EmergencyAlert[];
  predictedOutcomes: PredictedOutcome[];
  careRecommendations: CareRecommendation[];
}

interface EmergencyAlert {
  id: string;
  severity: 'WARNING' | 'URGENT' | 'CRITICAL';
  type: 'VITAL_ANOMALY' | 'MISSED_CHECKINS' | 'RISK_ESCALATION' | 'EMERGENCY_CONTACT';
  message: string;
  timestamp: string;
  actionRequired: boolean;
  suggestedActions: string[];
}

interface PredictedOutcome {
  condition: string;
  probability: number; // 0-100
  timeframe: string; // e.g., "30 days", "3 months"
  confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  basedOn: string[];
}

interface CareRecommendation {
  category: 'MEDICATION' | 'LIFESTYLE' | 'MONITORING' | 'FOLLOW_UP' | 'INTERVENTION';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  recommendation: string;
  reasoning: string;
  estimatedImpact: string;
  timeline: string;
}

interface PopulationInsights {
  totalPatients: number;
  activePatients: number;
  highRiskPatients: number;
  averageHealthScore: number;
  trendingConcerns: string[];
  populationMetrics: {
    averageAge: number;
    riskDistribution: { low: number; moderate: number; high: number; critical: number };
    commonConditions: Array<{ condition: string; prevalence: number }>;
    adherenceRate: number;
  };
  recommendations: PopulationRecommendation[];
  predictiveAnalytics: PopulationPrediction[];
}

interface PopulationRecommendation {
  type: 'RESOURCE_ALLOCATION' | 'INTERVENTION_PROGRAM' | 'POLICY_CHANGE' | 'TRAINING';
  recommendation: string;
  expectedImpact: string;
  implementationEffort: 'LOW' | 'MEDIUM' | 'HIGH';
  priority: number;
}

interface PopulationPrediction {
  metric: string;
  prediction: string;
  timeframe: string;
  confidence: number;
  factorsInfluencing: string[];
}

interface AiConfiguration {
  riskThresholds: {
    bloodPressure: { systolic: { high: number; critical: number }; diastolic: { high: number; critical: number } };
    heartRate: { low: number; high: number; critical: number };
    glucose: { low: number; high: number; critical: number };
    oxygenSaturation: { low: number; critical: number };
  };
  adherenceSettings: {
    missedCheckInThreshold: number; // days
    lowAdherenceThreshold: number; // percentage
  };
  alertSettings: {
    enablePredictiveAlerts: boolean;
    alertCooldownPeriod: number; // hours
    emergencyContactThreshold: number; // hours for critical alerts
  };
}

// Type definitions for aggregation
interface DailyHealthLog {
  date: string;
  readings: any[];
  aggregates: DailyAggregates;
}

interface DailyAggregates {
  bloodPressure: { systolic: number | null; diastolic: number | null; count: number };
  heartRate: { avg: number | null; min: number | null; max: number | null; count: number };
  bloodSugar: { avg: number | null; min: number | null; max: number | null; count: number };
  bloodOxygen: { avg: number | null; min: number | null; max: number | null; count: number };
  weight: { avg: number | null; count: number };
  mood: { predominant: string | null; entries: string[] };
  physicalActivity: { entries: string[] };
  socialEngagement: { entries: string[] };
  symptoms: { entries: string[] };
}

interface WeeklyHealthSummary {
  weekStart: string;
  weekEnd: string;
  daysWithData: number;
  totalReadings: number;
  aggregates: DailyAggregates;
  trends: WeeklyTrends;
}

interface WeeklyTrends {
  bloodPressure: 'RISING' | 'FALLING' | 'STABLE';
  heartRate: 'RISING' | 'FALLING' | 'STABLE';
  bloodSugar: 'RISING' | 'FALLING' | 'STABLE';
  bloodOxygen: 'RISING' | 'FALLING' | 'STABLE';
  weight: 'RISING' | 'FALLING' | 'STABLE';
  mood: 'RISING' | 'FALLING' | 'STABLE';
}

interface HealthStatistics {
  dailyLogs: DailyHealthLog[];
  weeklyAverages: WeeklyHealthSummary[];
  overallStats: OverallStatistics;
  lastUpdated: string;
  dataPoints: number;
}

interface OverallStatistics {
  totalReadings: number;
  dateRange: { start: string | null; end: string | null };
  averages: DailyAggregates;
  complianceRate: number;
}

export type {
  HealthRiskAssessment,
  VitalsTrend,
  PatientInsight,
  EmergencyAlert,
  PredictedOutcome,
  CareRecommendation,
  PopulationInsights,
  DailyHealthLog,
  DailyAggregates,
  WeeklyHealthSummary,
  WeeklyTrends,
  HealthStatistics,
  OverallStatistics
};

export class FhirAiService {
  private config: AiConfiguration;

  constructor() {
    this.config = this.getDefaultConfiguration();
  }

  // AI-powered patient risk assessment
  async assessPatientRisk(patientData: any): Promise<HealthRiskAssessment> {
    const vitals = patientData.vitals || [];
    const checkIns = patientData.checkIns || [];
    const profile = patientData.profile;

    let riskScore = 0;
    const riskFactors: string[] = [];
    const recommendations: string[] = [];

    // Analyze latest vitals
    const latestVitals = vitals[0];
    if (latestVitals) {
      const bpRisk = this.assessBloodPressureRisk(latestVitals.bp_systolic, latestVitals.bp_diastolic);
      const hrRisk = this.assessHeartRateRisk(latestVitals.heart_rate);
      // FIX: Handle both field names for glucose (blood_sugar from self_reports, glucose_mg_dl from check_ins)
      const glucoseRisk = this.assessGlucoseRisk(latestVitals.glucose_mg_dl || latestVitals.blood_sugar);
      // FIX: Handle multiple field names for oxygen (pulse_oximeter, spo2, blood_oxygen)
      const oxygenRisk = this.assessOxygenSaturationRisk(latestVitals.pulse_oximeter || latestVitals.spo2 || latestVitals.blood_oxygen);

      riskScore += bpRisk.score + hrRisk.score + glucoseRisk.score + oxygenRisk.score;
      riskFactors.push(...bpRisk.factors, ...hrRisk.factors, ...glucoseRisk.factors, ...oxygenRisk.factors);
      recommendations.push(...bpRisk.recommendations, ...hrRisk.recommendations, ...glucoseRisk.recommendations, ...oxygenRisk.recommendations);
    }

    // Analyze check-in patterns
    const adherenceRisk = this.assessAdherenceRisk(checkIns);
    riskScore += adherenceRisk.score;
    riskFactors.push(...adherenceRisk.factors);
    recommendations.push(...adherenceRisk.recommendations);

    // Analyze trends
    const trendRisk = this.analyzeTrends(vitals);
    riskScore += trendRisk.score;
    riskFactors.push(...trendRisk.factors);
    recommendations.push(...trendRisk.recommendations);

    // Calculate overall risk level
    let riskLevel: HealthRiskAssessment['riskLevel'];
    if (riskScore >= 80) riskLevel = 'CRITICAL';
    else if (riskScore >= 60) riskLevel = 'HIGH';
    else if (riskScore >= 40) riskLevel = 'MODERATE';
    else riskLevel = 'LOW';

    // Determine trend direction
    const trendDirection = this.calculateTrendDirection(vitals);

    return {
      riskLevel,
      riskScore: Math.min(100, riskScore),
      riskFactors: [...new Set(riskFactors)], // Remove duplicates
      recommendations: [...new Set(recommendations)],
      priority: this.calculatePriority(riskLevel, riskFactors.length),
      lastAssessed: new Date().toISOString(),
      trendDirection
    };
  }

  // Generate comprehensive patient insights
  async generatePatientInsights(patientId: string, patientData: any): Promise<PatientInsight> {
    const riskAssessment = await this.assessPatientRisk(patientData);
    const vitalsTrends = this.analyzeVitalsTrends(patientData.vitals || []);
    const adherenceScore = this.calculateAdherenceScore(patientData.checkIns || []);
    const emergencyAlerts = this.detectEmergencyConditions(patientData);
    const predictedOutcomes = this.generatePredictedOutcomes(patientData, riskAssessment);
    const careRecommendations = this.generateCareRecommendations(riskAssessment, vitalsTrends);

    return {
      patientId,
      patientName: `${patientData.profile?.first_name || ''} ${patientData.profile?.last_name || ''}`.trim(),
      overallHealthScore: this.calculateOverallHealthScore(riskAssessment, adherenceScore, vitalsTrends),
      riskAssessment,
      vitalsTrends,
      adherenceScore,
      lastCheckIn: patientData.checkIns?.[0]?.created_at || 'Never',
      emergencyAlerts,
      predictedOutcomes,
      careRecommendations
    };
  }

  // Population-level AI analytics
  async generatePopulationInsights(populationData: any[]): Promise<PopulationInsights> {
    const totalPatients = populationData.length;
    const activePatients = populationData.filter(p =>
      p.checkIns?.length > 0 &&
      new Date(p.checkIns[0].created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ).length;

    const riskAssessments = await Promise.all(
      populationData.map(p => this.assessPatientRisk(p))
    );

    const highRiskPatients = riskAssessments.filter(r => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL').length;
    const averageHealthScore = this.calculatePopulationHealthScore(populationData);

    const riskDistribution = {
      low: riskAssessments.filter(r => r.riskLevel === 'LOW').length,
      moderate: riskAssessments.filter(r => r.riskLevel === 'MODERATE').length,
      high: riskAssessments.filter(r => r.riskLevel === 'HIGH').length,
      critical: riskAssessments.filter(r => r.riskLevel === 'CRITICAL').length
    };

    const trendingConcerns = this.identifyTrendingConcerns(riskAssessments);
    const commonConditions = this.analyzeCommonConditions(populationData);
    const adherenceRate = this.calculatePopulationAdherence(populationData);

    return {
      totalPatients,
      activePatients,
      highRiskPatients,
      averageHealthScore,
      trendingConcerns,
      populationMetrics: {
        averageAge: this.calculateAverageAge(populationData),
        riskDistribution,
        commonConditions,
        adherenceRate
      },
      recommendations: this.generatePopulationRecommendations(riskDistribution, adherenceRate, trendingConcerns),
      predictiveAnalytics: this.generatePopulationPredictions(populationData, riskAssessments)
    };
  }

  // Real-time monitoring and alerts
  async monitorPatientInRealTime(patientData: any): Promise<EmergencyAlert[]> {
    const alerts: EmergencyAlert[] = [];
    const latestVitals = patientData.vitals?.[0];
    const checkIns = patientData.checkIns || [];

    // Critical vital signs
    if (latestVitals) {
      if (latestVitals.bp_systolic > this.config.riskThresholds.bloodPressure.systolic.critical ||
          latestVitals.bp_diastolic > this.config.riskThresholds.bloodPressure.diastolic.critical) {
        alerts.push(this.createEmergencyAlert(
          'CRITICAL',
          'VITAL_ANOMALY',
          'Critical blood pressure reading detected',
          ['Contact emergency services', 'Notify primary physician', 'Alert emergency contact']
        ));
      }

      if (latestVitals.heart_rate > this.config.riskThresholds.heartRate.critical ||
          latestVitals.heart_rate < this.config.riskThresholds.heartRate.low) {
        alerts.push(this.createEmergencyAlert(
          'CRITICAL',
          'VITAL_ANOMALY',
          'Critical heart rate detected',
          ['Immediate medical attention required', 'Contact emergency services']
        ));
      }

      if (latestVitals.pulse_oximeter < this.config.riskThresholds.oxygenSaturation.critical) {
        alerts.push(this.createEmergencyAlert(
          'CRITICAL',
          'VITAL_ANOMALY',
          'Critical oxygen saturation level',
          ['Immediate oxygen therapy may be needed', 'Contact emergency services']
        ));
      }
    }

    // Missed check-ins
    const daysSinceLastCheckIn = checkIns.length > 0 ?
      (Date.now() - new Date(checkIns[0].created_at).getTime()) / (1000 * 60 * 60 * 24) : 999;

    if (daysSinceLastCheckIn > this.config.adherenceSettings.missedCheckInThreshold) {
      alerts.push(this.createEmergencyAlert(
        'WARNING',
        'MISSED_CHECKINS',
        `No check-in for ${Math.floor(daysSinceLastCheckIn)} days`,
        ['Contact patient', 'Check on patient welfare', 'Review care plan']
      ));
    }

    return alerts;
  }

  // Predictive modeling
  private generatePredictedOutcomes(patientData: any, riskAssessment: HealthRiskAssessment): PredictedOutcome[] {
    const outcomes: PredictedOutcome[] = [];
    const vitals = patientData.vitals || [];
    const riskFactors = riskAssessment.riskFactors;

    // Cardiovascular risk prediction
    if (riskFactors.some(f => f.includes('blood pressure') || f.includes('heart rate'))) {
      outcomes.push({
        condition: 'Cardiovascular Event',
        probability: this.calculateCardiovascularRisk(vitals, riskAssessment.riskScore),
        timeframe: '6 months',
        confidenceLevel: 'MEDIUM',
        basedOn: ['Blood pressure trends', 'Heart rate patterns', 'Risk score']
      });
    }

    // Diabetes complications
    if (riskFactors.some(f => f.includes('glucose'))) {
      outcomes.push({
        condition: 'Diabetes Complications',
        probability: this.calculateDiabetesRisk(vitals, riskAssessment.riskScore),
        timeframe: '3 months',
        confidenceLevel: 'HIGH',
        basedOn: ['Glucose level trends', 'Overall health score']
      });
    }

    // Hospital readmission risk
    if (riskAssessment.riskLevel === 'HIGH' || riskAssessment.riskLevel === 'CRITICAL') {
      outcomes.push({
        condition: 'Hospital Readmission',
        probability: Math.min(85, riskAssessment.riskScore + 15),
        timeframe: '30 days',
        confidenceLevel: 'HIGH',
        basedOn: ['High risk score', 'Multiple risk factors', 'Recent vital trends']
      });
    }

    return outcomes;
  }

  // Care recommendations engine
  private generateCareRecommendations(riskAssessment: HealthRiskAssessment, vitalsTrends: VitalsTrend[]): CareRecommendation[] {
    const recommendations: CareRecommendation[] = [];

    // High-priority interventions for critical patients
    if (riskAssessment.riskLevel === 'CRITICAL') {
      recommendations.push({
        category: 'INTERVENTION',
        priority: 'URGENT',
        recommendation: 'Immediate clinical assessment and intervention required',
        reasoning: 'Critical risk level detected with multiple concerning factors',
        estimatedImpact: 'Potentially life-saving',
        timeline: 'Within 24 hours'
      });
    }

    // Medication adjustments based on vitals
    const bpTrend = vitalsTrends.find(t => t.metric === 'bp_systolic');
    if (bpTrend?.isAbnormal) {
      recommendations.push({
        category: 'MEDICATION',
        priority: bpTrend.current > 180 ? 'URGENT' : 'HIGH',
        recommendation: 'Review and adjust antihypertensive medications',
        reasoning: `Blood pressure ${bpTrend.trend.toLowerCase()} with current reading of ${bpTrend.current}`,
        estimatedImpact: 'Reduced cardiovascular risk',
        timeline: bpTrend.current > 180 ? 'Within 48 hours' : 'Within 1 week'
      });
    }

    // Lifestyle recommendations
    if (riskAssessment.riskFactors.some(f => f.includes('sedentary') || f.includes('activity'))) {
      recommendations.push({
        category: 'LIFESTYLE',
        priority: 'MEDIUM',
        recommendation: 'Implement structured physical activity program',
        reasoning: 'Low activity levels contributing to overall risk',
        estimatedImpact: 'Improved cardiovascular health and overall well-being',
        timeline: 'Start within 2 weeks'
      });
    }

    // Enhanced monitoring
    if (riskAssessment.riskLevel === 'HIGH') {
      recommendations.push({
        category: 'MONITORING',
        priority: 'HIGH',
        recommendation: 'Increase monitoring frequency to daily check-ins',
        reasoning: 'High risk status requires closer observation',
        estimatedImpact: 'Early detection of health changes',
        timeline: 'Implement immediately'
      });
    }

    return recommendations;
  }

  // Utility methods for risk assessment
  private assessBloodPressureRisk(systolic?: number, diastolic?: number): { score: number; factors: string[]; recommendations: string[] } {
    if (!systolic || !diastolic) return { score: 0, factors: [], recommendations: [] };

    const factors: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    if (systolic >= 180 || diastolic >= 120) {
      score += 30;
      factors.push('Hypertensive crisis - critical blood pressure');
      recommendations.push('Immediate emergency medical attention required');
    } else if (systolic >= 140 || diastolic >= 90) {
      score += 20;
      factors.push('Stage 2 hypertension detected');
      recommendations.push('Medication review and lifestyle modifications needed');
    } else if (systolic >= 130 || diastolic >= 80) {
      score += 10;
      factors.push('Stage 1 hypertension detected');
      recommendations.push('Lifestyle modifications and possible medication initiation');
    }

    return { score, factors, recommendations };
  }

  private assessHeartRateRisk(heartRate?: number): { score: number; factors: string[]; recommendations: string[] } {
    if (!heartRate) return { score: 0, factors: [], recommendations: [] };

    const factors: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    if (heartRate > 120 || heartRate < 50) {
      score += 25;
      factors.push(`${heartRate > 120 ? 'Severe tachycardia' : 'Severe bradycardia'} detected`);
      recommendations.push('Immediate cardiac evaluation required');
    } else if (heartRate > 100 || heartRate < 60) {
      score += 10;
      factors.push(`${heartRate > 100 ? 'Mild tachycardia' : 'Mild bradycardia'} detected`);
      recommendations.push('Monitor heart rate trends and consider cardiology consultation');
    }

    return { score, factors, recommendations };
  }

  private assessGlucoseRisk(glucose?: number): { score: number; factors: string[]; recommendations: string[] } {
    if (!glucose) return { score: 0, factors: [], recommendations: [] };

    const factors: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    if (glucose > 400 || glucose < 50) {
      score += 30;
      factors.push(`${glucose > 400 ? 'Severe hyperglycemia' : 'Severe hypoglycemia'} detected`);
      recommendations.push('Immediate medical intervention required');
    } else if (glucose > 250 || glucose < 70) {
      score += 15;
      factors.push(`${glucose > 250 ? 'Significant hyperglycemia' : 'Hypoglycemia'} detected`);
      recommendations.push('Diabetes management review and medication adjustment needed');
    } else if (glucose > 180) {
      score += 8;
      factors.push('Elevated blood glucose levels');
      recommendations.push('Dietary review and possible medication adjustment');
    }

    return { score, factors, recommendations };
  }

  private assessOxygenSaturationRisk(oxygen?: number): { score: number; factors: string[]; recommendations: string[] } {
    if (!oxygen) return { score: 0, factors: [], recommendations: [] };

    const factors: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    if (oxygen < 88) {
      score += 30;
      factors.push('Critical oxygen saturation level');
      recommendations.push('Immediate oxygen therapy and emergency care required');
    } else if (oxygen < 92) {
      score += 15;
      factors.push('Low oxygen saturation');
      recommendations.push('Respiratory assessment and possible oxygen supplementation needed');
    } else if (oxygen < 95) {
      score += 8;
      factors.push('Borderline low oxygen saturation');
      recommendations.push('Monitor respiratory status closely');
    }

    return { score, factors, recommendations };
  }

  private assessAdherenceRisk(checkIns: any[]): { score: number; factors: string[]; recommendations: string[] } {
    const factors: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    if (checkIns.length === 0) {
      score += 20;
      factors.push('No check-in history available');
      recommendations.push('Establish regular check-in routine');
      return { score, factors, recommendations };
    }

    // Calculate check-in frequency over last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentCheckIns = checkIns.filter(c => new Date(c.created_at) > thirtyDaysAgo);
    const adherenceRate = (recentCheckIns.length / 30) * 100;

    if (adherenceRate < 30) {
      score += 15;
      factors.push('Very low check-in adherence');
      recommendations.push('Patient engagement program and adherence support needed');
    } else if (adherenceRate < 60) {
      score += 8;
      factors.push('Low check-in adherence');
      recommendations.push('Improve patient engagement and simplify check-in process');
    }

    // Check for recent gaps
    const daysSinceLastCheckIn = (Date.now() - new Date(checkIns[0].created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastCheckIn > 7) {
      score += 10;
      factors.push(`${Math.floor(daysSinceLastCheckIn)} days since last check-in`);
      recommendations.push('Contact patient to ensure continued engagement');
    }

    return { score, factors, recommendations };
  }

  private analyzeTrends(vitals: any[]): { score: number; factors: string[]; recommendations: string[] } {
    const factors: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    if (vitals.length < 2) return { score, factors, recommendations };

    // Analyze blood pressure trends
    const bpTrend = this.calculateVitalTrend(vitals, 'bp_systolic');
    if (bpTrend.changePercent > 20) {
      score += bpTrend.trend === 'RISING' ? 15 : 5;
      factors.push(`Blood pressure ${bpTrend.trend.toLowerCase()} by ${bpTrend.changePercent.toFixed(1)}%`);
      recommendations.push(bpTrend.trend === 'RISING' ? 'Blood pressure management intervention needed' : 'Monitor blood pressure improvements');
    }

    // Analyze heart rate trends
    const hrTrend = this.calculateVitalTrend(vitals, 'heart_rate');
    if (hrTrend.changePercent > 15) {
      score += 8;
      factors.push(`Heart rate ${hrTrend.trend.toLowerCase()} by ${hrTrend.changePercent.toFixed(1)}%`);
      recommendations.push('Cardiac monitoring and evaluation recommended');
    }

    return { score, factors, recommendations };
  }

  private calculateVitalTrend(vitals: any[], metric: string): VitalsTrend {
    // FIX: Handle field name variations between self_reports and check_ins
    const getVitalValue = (vital: any, metricName: string): number => {
      if (metricName === 'glucose_mg_dl') {
        return vital?.glucose_mg_dl || vital?.blood_sugar || 0;
      }
      if (metricName === 'pulse_oximeter') {
        return vital?.pulse_oximeter || vital?.spo2 || vital?.blood_oxygen || 0;
      }
      return vital?.[metricName] || 0;
    };

    const current = getVitalValue(vitals[0], metric);
    const previous = getVitalValue(vitals[1], metric) || current;

    const changePercent = previous !== 0 ? ((current - previous) / previous) * 100 : 0;
    let trend: VitalsTrend['trend'] = 'STABLE';

    if (Math.abs(changePercent) > 5) {
      trend = changePercent > 0 ? 'RISING' : 'FALLING';
    }

    const normalRanges = {
      bp_systolic: { min: 90, max: 120 },
      bp_diastolic: { min: 60, max: 80 },
      heart_rate: { min: 60, max: 100 },
      glucose_mg_dl: { min: 70, max: 140 },
      pulse_oximeter: { min: 95, max: 100 }
    };

    const normalRange = normalRanges[metric as keyof typeof normalRanges] || { min: 0, max: 100 };
    const isAbnormal = current < normalRange.min || current > normalRange.max;

    return {
      metric: metric as VitalsTrend['metric'],
      current,
      previous,
      trend,
      changePercent: Math.abs(changePercent),
      isAbnormal,
      normalRange,
      recommendation: isAbnormal ? this.getVitalRecommendation(metric, current, normalRange) : undefined
    };
  }

  private getVitalRecommendation(metric: string, value: number, normalRange: { min: number; max: number }): string {
    const recommendations: Record<string, Record<string, string>> = {
      bp_systolic: {
        high: 'Consider antihypertensive medication adjustment',
        low: 'Monitor for hypotension symptoms'
      },
      heart_rate: {
        high: 'Evaluate for tachycardia causes',
        low: 'Assess for bradycardia complications'
      },
      glucose_mg_dl: {
        high: 'Review diabetes management plan',
        low: 'Address hypoglycemia risk factors'
      }
    };

    const status = value > normalRange.max ? 'high' : 'low';
    return recommendations[metric]?.[status] || 'Consult healthcare provider';
  }

  private analyzeVitalsTrends(vitals: any[]): VitalsTrend[] {
    const metrics: Array<VitalsTrend['metric']> = ['bp_systolic', 'bp_diastolic', 'heart_rate', 'glucose_mg_dl', 'pulse_oximeter'];
    return metrics.map(metric => this.calculateVitalTrend(vitals, metric));
  }

  private calculateAdherenceScore(checkIns: any[]): number {
    if (checkIns.length === 0) return 0;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentCheckIns = checkIns.filter(c => new Date(c.created_at) > thirtyDaysAgo);

    // Expected check-ins (daily) vs actual
    const expectedCheckIns = 30;
    const actualCheckIns = recentCheckIns.length;

    const baseScore = Math.min(100, (actualCheckIns / expectedCheckIns) * 100);

    // Bonus for consistency (reduce score for large gaps)
    const gaps = this.calculateCheckInGaps(recentCheckIns);
    const gapPenalty = gaps.filter(gap => gap > 3).length * 5; // 5% penalty per gap > 3 days

    return Math.max(0, baseScore - gapPenalty);
  }

  private calculateCheckInGaps(checkIns: any[]): number[] {
    if (checkIns.length < 2) return [];

    const gaps: number[] = [];
    for (let i = 0; i < checkIns.length - 1; i++) {
      const gap = (new Date(checkIns[i].created_at).getTime() - new Date(checkIns[i + 1].created_at).getTime()) / (1000 * 60 * 60 * 24);
      gaps.push(gap);
    }
    return gaps;
  }

  private detectEmergencyConditions(patientData: any): EmergencyAlert[] {
    const alerts: EmergencyAlert[] = [];
    const latestVitals = patientData.vitals?.[0];

    if (latestVitals?.is_emergency) {
      alerts.push(this.createEmergencyAlert(
        'CRITICAL',
        'EMERGENCY_CONTACT',
        'Patient has indicated emergency status',
        ['Contact emergency services immediately', 'Notify emergency contact', 'Initiate emergency protocol']
      ));
    }

    return alerts;
  }

  private createEmergencyAlert(
    severity: EmergencyAlert['severity'],
    type: EmergencyAlert['type'],
    message: string,
    suggestedActions: string[]
  ): EmergencyAlert {
    return {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      severity,
      type,
      message,
      timestamp: new Date().toISOString(),
      actionRequired: severity === 'CRITICAL' || severity === 'URGENT',
      suggestedActions
    };
  }

  private calculateOverallHealthScore(
    riskAssessment: HealthRiskAssessment,
    adherenceScore: number,
    vitalsTrends: VitalsTrend[]
  ): number {
    // Invert risk score (high risk = low health score)
    const healthFromRisk = 100 - riskAssessment.riskScore;

    // Weight: 50% risk assessment, 30% adherence, 20% vital trends
    const vitalsScore = this.calculateVitalsHealthScore(vitalsTrends);

    return Math.round(
      (healthFromRisk * 0.5) +
      (adherenceScore * 0.3) +
      (vitalsScore * 0.2)
    );
  }

  private calculateVitalsHealthScore(vitalsTrends: VitalsTrend[]): number {
    const abnormalCount = vitalsTrends.filter(t => t.isAbnormal).length;
    const totalVitals = vitalsTrends.length;

    if (totalVitals === 0) return 50; // Neutral score if no vitals

    const normalPercentage = ((totalVitals - abnormalCount) / totalVitals) * 100;
    return normalPercentage;
  }

  private calculateTrendDirection(vitals: any[]): HealthRiskAssessment['trendDirection'] {
    if (vitals.length < 3) return 'STABLE';

    // Simple trend analysis based on overall vital signs improvement/deterioration
    const recentVitals = vitals.slice(0, 3);
    let improvementScore = 0;

    for (let i = 0; i < recentVitals.length - 1; i++) {
      const current = recentVitals[i];
      const previous = recentVitals[i + 1];

      // Compare key vitals (simplified scoring)
      if (current.bp_systolic && previous.bp_systolic) {
        if (current.bp_systolic < previous.bp_systolic && current.bp_systolic <= 120) improvementScore++;
        else if (current.bp_systolic > previous.bp_systolic && current.bp_systolic > 140) improvementScore--;
      }

      if (current.heart_rate && previous.heart_rate) {
        const inNormalRange = current.heart_rate >= 60 && current.heart_rate <= 100;
        const wasInNormalRange = previous.heart_rate >= 60 && previous.heart_rate <= 100;
        if (inNormalRange && !wasInNormalRange) improvementScore++;
        else if (!inNormalRange && wasInNormalRange) improvementScore--;
      }
    }

    if (improvementScore > 0) return 'IMPROVING';
    if (improvementScore < 0) return 'DECLINING';
    return 'STABLE';
  }

  private calculatePriority(riskLevel: HealthRiskAssessment['riskLevel'], riskFactorCount: number): number {
    const basePriority = {
      'CRITICAL': 5,
      'HIGH': 4,
      'MODERATE': 3,
      'LOW': 2
    }[riskLevel];

    // Increase priority for multiple risk factors
    const factorBonus = Math.min(1, Math.floor(riskFactorCount / 3));
    return Math.min(5, basePriority + factorBonus);
  }

  private calculateCardiovascularRisk(vitals: any[], riskScore: number): number {
    // Simplified cardiovascular risk model
    let cvRisk = riskScore * 0.6; // Base on overall risk

    // Add specific cardiovascular factors
    const latestVitals = vitals[0];
    if (latestVitals?.bp_systolic > 140) cvRisk += 15;
    if (latestVitals?.heart_rate > 100) cvRisk += 10;

    return Math.min(95, cvRisk);
  }

  private calculateDiabetesRisk(vitals: any[], riskScore: number): number {
    // Simplified diabetes complications risk model
    let diabetesRisk = riskScore * 0.7;

    const latestVitals = vitals[0];
    if (latestVitals?.glucose_mg_dl > 250) diabetesRisk += 20;
    else if (latestVitals?.glucose_mg_dl > 180) diabetesRisk += 10;

    return Math.min(90, diabetesRisk);
  }

  private calculatePopulationHealthScore(populationData: any[]): number {
    if (populationData.length === 0) return 0;

    // Calculate average health score across population
    const healthScores = populationData.map(patient => {
      // Simplified health score calculation for population view
      const latestVitals = patient.vitals?.[0];
      let score = 70; // Base score

      if (latestVitals) {
        if (latestVitals.bp_systolic > 140) score -= 10;
        if (latestVitals.heart_rate > 100 || latestVitals.heart_rate < 60) score -= 8;
        if (latestVitals.glucose_mg_dl > 180) score -= 12;
        if (latestVitals.pulse_oximeter < 95) score -= 15;
      }

      // Adherence bonus
      const checkInCount = patient.checkIns?.length || 0;
      if (checkInCount > 20) score += 10;
      else if (checkInCount > 10) score += 5;

      return Math.max(0, Math.min(100, score));
    });

    return Math.round(healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length);
  }

  private identifyTrendingConcerns(riskAssessments: HealthRiskAssessment[]): string[] {
    const concerns: Record<string, number> = {};

    riskAssessments.forEach(assessment => {
      assessment.riskFactors.forEach(factor => {
        concerns[factor] = (concerns[factor] || 0) + 1;
      });
    });

    // Return top 5 most common concerns
    return Object.entries(concerns)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([concern]) => concern);
  }

  private analyzeCommonConditions(populationData: any[]): Array<{ condition: string; prevalence: number }> {
    const conditionCounts: Record<string, number> = {};
    const totalPatients = populationData.length;

    populationData.forEach(patient => {
      const vitals = patient.vitals?.[0];
      if (vitals) {
        if (vitals.bp_systolic > 140) conditionCounts['Hypertension'] = (conditionCounts['Hypertension'] || 0) + 1;
        if (vitals.glucose_mg_dl > 126) conditionCounts['Diabetes'] = (conditionCounts['Diabetes'] || 0) + 1;
        if (vitals.heart_rate > 100) conditionCounts['Tachycardia'] = (conditionCounts['Tachycardia'] || 0) + 1;
      }
    });

    return Object.entries(conditionCounts).map(([condition, count]) => ({
      condition,
      prevalence: Math.round((count / totalPatients) * 100)
    }));
  }

  private calculatePopulationAdherence(populationData: any[]): number {
    if (populationData.length === 0) return 0;

    const adherenceScores = populationData.map(patient => this.calculateAdherenceScore(patient.checkIns || []));
    return Math.round(adherenceScores.reduce((sum, score) => sum + score, 0) / adherenceScores.length);
  }

  private calculateAverageAge(populationData: any[]): number {
    const patientsWithAge = populationData.filter(p => p.profile?.dob);
    if (patientsWithAge.length === 0) return 0;

    const ages = patientsWithAge.map(p => {
      const birthDate = new Date(p.profile.dob);
      const today = new Date();
      return today.getFullYear() - birthDate.getFullYear();
    });

    return Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length);
  }

  private generatePopulationRecommendations(
    riskDistribution: any,
    adherenceRate: number,
    trendingConcerns: string[]
  ): PopulationRecommendation[] {
    const recommendations: PopulationRecommendation[] = [];

    // High-risk patient management
    if (riskDistribution.high + riskDistribution.critical > riskDistribution.low) {
      recommendations.push({
        type: 'RESOURCE_ALLOCATION',
        recommendation: 'Increase clinical staff allocation for high-risk patient management',
        expectedImpact: 'Reduced emergency incidents and improved patient outcomes',
        implementationEffort: 'HIGH',
        priority: 5
      });
    }

    // Adherence improvement
    if (adherenceRate < 70) {
      recommendations.push({
        type: 'INTERVENTION_PROGRAM',
        recommendation: 'Implement patient engagement and adherence improvement program',
        expectedImpact: 'Increased check-in compliance and better health monitoring',
        implementationEffort: 'MEDIUM',
        priority: 4
      });
    }

    // Address trending concerns
    if (trendingConcerns.some(concern => concern.includes('blood pressure'))) {
      recommendations.push({
        type: 'POLICY_CHANGE',
        recommendation: 'Develop population-wide hypertension management protocol',
        expectedImpact: 'Reduced cardiovascular events across patient population',
        implementationEffort: 'MEDIUM',
        priority: 4
      });
    }

    return recommendations;
  }

  private generatePopulationPredictions(populationData: any[], riskAssessments: HealthRiskAssessment[]): PopulationPrediction[] {
    const predictions: PopulationPrediction[] = [];

    const highRiskPercentage = (riskAssessments.filter(r => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL').length / riskAssessments.length) * 100;

    predictions.push({
      metric: 'High-risk patient percentage',
      prediction: `Expected to ${highRiskPercentage > 25 ? 'increase' : 'remain stable'} at ${Math.round(highRiskPercentage)}%`,
      timeframe: '3 months',
      confidence: 75,
      factorsInfluencing: ['Current trend patterns', 'Seasonal variations', 'Intervention effectiveness']
    });

    const averageAge = this.calculateAverageAge(populationData);
    if (averageAge > 65) {
      predictions.push({
        metric: 'Emergency incidents',
        prediction: 'Likely to increase by 15-20% due to aging population',
        timeframe: '6 months',
        confidence: 70,
        factorsInfluencing: ['Population age demographics', 'Chronic condition prevalence', 'Seasonal factors']
      });
    }

    return predictions;
  }

  private getDefaultConfiguration(): AiConfiguration {
    return {
      riskThresholds: {
        bloodPressure: {
          systolic: { high: 140, critical: 180 },
          diastolic: { high: 90, critical: 120 }
        },
        heartRate: { low: 50, high: 100, critical: 120 },
        glucose: { low: 70, high: 180, critical: 250 },
        oxygenSaturation: { low: 95, critical: 88 }
      },
      adherenceSettings: {
        missedCheckInThreshold: 3,
        lowAdherenceThreshold: 60
      },
      alertSettings: {
        enablePredictiveAlerts: true,
        alertCooldownPeriod: 4,
        emergencyContactThreshold: 1
      }
    };
  }

  // Configuration management
  updateConfiguration(newConfig: Partial<AiConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfiguration(): AiConfiguration {
    return { ...this.config };
  }

  // Production-grade daily and weekly aggregation methods
  /**
   * Compute daily health logs by aggregating all vitals from self_reports and check_ins for each day
   * @param healthData Array of health entries (self_reports, check_ins, etc.)
   * @returns Map of date strings to aggregated daily statistics
   */
  computeDailyHealthLogs(healthData: any[]): Map<string, DailyHealthLog> {
    const dailyLogs = new Map<string, DailyHealthLog>();

    // Group data by date
    for (const entry of healthData) {
      const dateStr = this.getDateString(entry.created_at);

      if (!dailyLogs.has(dateStr)) {
        dailyLogs.set(dateStr, {
          date: dateStr,
          readings: [],
          aggregates: this.getEmptyAggregates()
        });
      }

      const log = dailyLogs.get(dateStr);
      if (log) {
        log.readings.push(entry);
      }
    }

    // Calculate aggregates for each day
    for (const [, log] of dailyLogs) {
      log.aggregates = this.calculateDailyAggregates(log.readings);
    }

    return dailyLogs;
  }

  /**
   * Compute weekly averages from daily logs
   * @param dailyLogs Map of daily health logs
   * @returns Array of weekly statistics
   */
  computeWeeklyAverages(dailyLogs: Map<string, DailyHealthLog>): WeeklyHealthSummary[] {
    const weeklySummaries: WeeklyHealthSummary[] = [];
    const sortedDates = Array.from(dailyLogs.keys()).sort();

    // Group dates into weeks (7-day periods)
    let weekStart = 0;
    while (weekStart < sortedDates.length) {
      const weekEnd = Math.min(weekStart + 7, sortedDates.length);
      const weekDates = sortedDates.slice(weekStart, weekEnd);

      const weeklyData = weekDates.map(date => dailyLogs.get(date)).filter((log): log is DailyHealthLog => log !== undefined);
      const weekSummary = this.calculateWeeklySummary(weeklyData, weekDates[0], weekDates[weekDates.length - 1]);

      weeklySummaries.push(weekSummary);
      weekStart = weekEnd;
    }

    return weeklySummaries;
  }

  /**
   * Get comprehensive health statistics for a patient
   * @param healthData Array of all health entries
   * @returns Structured daily and weekly statistics
   */
  async computeHealthStatistics(healthData: any[]): Promise<HealthStatistics> {
    const dailyLogs = this.computeDailyHealthLogs(healthData);
    const weeklyAverages = this.computeWeeklyAverages(dailyLogs);

    // Compute overall statistics
    const allReadings = Array.from(dailyLogs.values()).flatMap(log => log.readings);
    const overallStats = this.calculateOverallStatistics(allReadings);

    return {
      dailyLogs: Array.from(dailyLogs.values()).sort((a, b) => b.date.localeCompare(a.date)),
      weeklyAverages: weeklyAverages.reverse(), // Most recent first
      overallStats,
      lastUpdated: new Date().toISOString(),
      dataPoints: allReadings.length
    };
  }

  // Helper methods for aggregation
  private getDateString(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  private getEmptyAggregates(): DailyAggregates {
    return {
      bloodPressure: { systolic: null, diastolic: null, count: 0 },
      heartRate: { avg: null, min: null, max: null, count: 0 },
      bloodSugar: { avg: null, min: null, max: null, count: 0 },
      bloodOxygen: { avg: null, min: null, max: null, count: 0 },
      weight: { avg: null, count: 0 },
      mood: { predominant: null, entries: [] },
      physicalActivity: { entries: [] },
      socialEngagement: { entries: [] },
      symptoms: { entries: [] }
    };
  }

  private calculateDailyAggregates(readings: any[]): DailyAggregates {
    const aggregates = this.getEmptyAggregates();

    // Arrays to collect numeric values
    const bpSystolic: number[] = [];
    const bpDiastolic: number[] = [];
    const heartRates: number[] = [];
    const bloodSugars: number[] = [];
    const bloodOxygens: number[] = [];
    const weights: number[] = [];
    const moods: string[] = [];

    // Collect all values - FIX: Handle field name variations from both self_reports and check_ins
    for (const reading of readings) {
      // Blood pressure
      if (reading.bp_systolic != null) bpSystolic.push(reading.bp_systolic);
      if (reading.bp_diastolic != null) bpDiastolic.push(reading.bp_diastolic);

      // Heart rate
      if (reading.heart_rate != null) heartRates.push(reading.heart_rate);

      // Blood sugar - handle both field names
      if (reading.blood_sugar != null) bloodSugars.push(reading.blood_sugar);
      if (reading.glucose_mg_dl != null) bloodSugars.push(reading.glucose_mg_dl);

      // Blood oxygen - handle all three field names
      if (reading.blood_oxygen != null) bloodOxygens.push(reading.blood_oxygen);
      if (reading.spo2 != null) bloodOxygens.push(reading.spo2);
      if (reading.pulse_oximeter != null) bloodOxygens.push(reading.pulse_oximeter);

      // Weight
      if (reading.weight != null) weights.push(reading.weight);

      // Mood
      if (reading.mood) moods.push(reading.mood);

      // Activities
      if (reading.physical_activity) aggregates.physicalActivity.entries.push(reading.physical_activity);
      if (reading.social_engagement) aggregates.socialEngagement.entries.push(reading.social_engagement);

      // Symptoms and notes
      if (reading.symptoms) aggregates.symptoms.entries.push(reading.symptoms);
      if (reading.activity_description) aggregates.symptoms.entries.push(reading.activity_description);
    }

    // Calculate blood pressure
    if (bpSystolic.length > 0 && bpDiastolic.length > 0) {
      aggregates.bloodPressure.systolic = Math.round(this.average(bpSystolic));
      aggregates.bloodPressure.diastolic = Math.round(this.average(bpDiastolic));
      aggregates.bloodPressure.count = Math.min(bpSystolic.length, bpDiastolic.length);
    }

    // Calculate heart rate
    if (heartRates.length > 0) {
      aggregates.heartRate.avg = Math.round(this.average(heartRates));
      aggregates.heartRate.min = Math.min(...heartRates);
      aggregates.heartRate.max = Math.max(...heartRates);
      aggregates.heartRate.count = heartRates.length;
    }

    // Calculate blood sugar
    if (bloodSugars.length > 0) {
      aggregates.bloodSugar.avg = Math.round(this.average(bloodSugars));
      aggregates.bloodSugar.min = Math.min(...bloodSugars);
      aggregates.bloodSugar.max = Math.max(...bloodSugars);
      aggregates.bloodSugar.count = bloodSugars.length;
    }

    // Calculate blood oxygen
    if (bloodOxygens.length > 0) {
      aggregates.bloodOxygen.avg = Math.round(this.average(bloodOxygens));
      aggregates.bloodOxygen.min = Math.min(...bloodOxygens);
      aggregates.bloodOxygen.max = Math.max(...bloodOxygens);
      aggregates.bloodOxygen.count = bloodOxygens.length;
    }

    // Calculate weight
    if (weights.length > 0) {
      aggregates.weight.avg = parseFloat(this.average(weights).toFixed(1));
      aggregates.weight.count = weights.length;
    }

    // Calculate mood
    if (moods.length > 0) {
      aggregates.mood.predominant = this.getMostFrequent(moods);
      aggregates.mood.entries = moods;
    }

    return aggregates;
  }

  private calculateWeeklySummary(weeklyData: DailyHealthLog[], startDate: string, endDate: string): WeeklyHealthSummary {
    // Flatten all readings from the week
    const allReadings = weeklyData.flatMap(day => day.readings);

    // Calculate weekly aggregates
    const weeklyAggregates = this.calculateDailyAggregates(allReadings);

    // Calculate trends
    const trends = this.calculateWeeklyTrends(weeklyData);

    return {
      weekStart: startDate,
      weekEnd: endDate,
      daysWithData: weeklyData.filter(day => day.readings.length > 0).length,
      totalReadings: allReadings.length,
      aggregates: weeklyAggregates,
      trends
    };
  }

  private calculateWeeklyTrends(weeklyData: DailyHealthLog[]): WeeklyTrends {
    const daysWithData = weeklyData.filter(day => day.readings.length > 0);

    if (daysWithData.length < 2) {
      return {
        bloodPressure: 'STABLE',
        heartRate: 'STABLE',
        bloodSugar: 'STABLE',
        bloodOxygen: 'STABLE',
        weight: 'STABLE',
        mood: 'STABLE'
      };
    }

    const firstDay = daysWithData[0].aggregates;
    const lastDay = daysWithData[daysWithData.length - 1].aggregates;

    return {
      bloodPressure: this.calculateTrend(firstDay.bloodPressure?.systolic, lastDay.bloodPressure?.systolic),
      heartRate: this.calculateTrend(firstDay.heartRate?.avg, lastDay.heartRate?.avg),
      bloodSugar: this.calculateTrend(firstDay.bloodSugar?.avg, lastDay.bloodSugar?.avg),
      bloodOxygen: this.calculateTrend(firstDay.bloodOxygen?.avg, lastDay.bloodOxygen?.avg),
      weight: this.calculateTrend(firstDay.weight?.avg, lastDay.weight?.avg),
      mood: 'STABLE' // Mood trend would require more complex analysis
    };
  }

  private calculateOverallStatistics(allReadings: any[]): OverallStatistics {
    const aggregates = this.calculateDailyAggregates(allReadings);

    return {
      totalReadings: allReadings.length,
      dateRange: {
        start: allReadings.length > 0 ? this.getDateString(allReadings[allReadings.length - 1].created_at) : null,
        end: allReadings.length > 0 ? this.getDateString(allReadings[0].created_at) : null
      },
      averages: aggregates,
      complianceRate: this.calculateComplianceRate(allReadings)
    };
  }

  private calculateComplianceRate(readings: any[]): number {
    if (readings.length === 0) return 0;

    const dates = new Set(readings.map(r => this.getDateString(r.created_at)));
    const daysSinceFirst = this.daysBetween(
      readings[readings.length - 1].created_at,
      readings[0].created_at
    );

    if (daysSinceFirst === 0) return 100;

    return Math.round((dates.size / daysSinceFirst) * 100);
  }

  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  private getMostFrequent(items: string[]): string | null {
    if (items.length === 0) return null;

    const frequency = new Map<string, number>();
    for (const item of items) {
      frequency.set(item, (frequency.get(item) || 0) + 1);
    }

    let maxCount = 0;
    let mostFrequent = items[0];
    for (const [item, count] of frequency) {
      if (count > maxCount) {
        maxCount = count;
        mostFrequent = item;
      }
    }

    return mostFrequent;
  }

  private calculateTrend(first: number | null | undefined, last: number | null | undefined): 'RISING' | 'FALLING' | 'STABLE' {
    if (first == null || last == null) return 'STABLE';

    const change = ((last - first) / first) * 100;

    if (change > 5) return 'RISING';
    if (change < -5) return 'FALLING';
    return 'STABLE';
  }

  private daysBetween(date1: string, date2: string): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

export default FhirAiService;