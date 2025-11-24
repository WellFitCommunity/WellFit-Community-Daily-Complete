/**
 * Healthcare Algorithms Dashboard
 *
 * Patent Pending - WellFit Community / Envision VirtualEdge Group LLC
 *
 * Production-grade AI algorithms dashboard featuring:
 * - Communication Silence Window Algorithm (novel)
 * - AI Readmissions Risk Prediction Model
 *
 * HIPAA Compliance:
 * - All data uses patient IDs/tokens, never PHI in browser
 * - All operations logged via audit system
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Slider } from '../ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Radio,
  Activity,
  Building2,
  Code,
  AlertTriangle,
  TrendingUp,
  Phone,
  Calendar,
  Mail,
  Shield,
  Heart,
  Users,
  Pill,
  Home,
} from 'lucide-react';
import { auditLogger } from '../../services/auditLogger';
import { logPhiAccess } from '../../services/phiAccessLogger';
import {
  calculateSilenceWindowScore,
  calculateReadmissionRiskContribution,
} from '../../services/communicationSilenceWindowService';
import {
  calculateReadmissionRisk,
  type PatientRiskFactors,
} from '../../services/readmissionRiskPredictionService';
import type {
  SilenceWindowInput,
  SilenceWindowResult,
  SilenceWindowWeights,
  DEFAULT_SILENCE_WINDOW_WEIGHTS,
} from '../../types/communicationSilenceWindow';

// =====================================================
// TYPES
// =====================================================

interface HealthcareAlgorithmsDashboardProps {
  patientId?: string;
  tenantId?: string;
  mode?: 'demo' | 'live';
  showBackButton?: boolean;
  onBack?: () => void;
}

type TabValue = 'silence' | 'readmission' | 'code';

// =====================================================
// COMPONENT
// =====================================================

export const HealthcareAlgorithmsDashboard: React.FC<HealthcareAlgorithmsDashboardProps> = ({
  patientId,
  tenantId,
  mode = 'demo',
  showBackButton = false,
  onBack,
}) => {
  const supabase = useSupabaseClient();
  const user = useUser();

  // Active tab
  const [activeTab, setActiveTab] = useState<TabValue>('silence');

  // Silence Window Demo State
  const [silenceDemo, setSilenceDemo] = useState({
    lastContact: 14,
    missedCalls: 2,
    missedAppts: 1,
    unreadMessages: 5,
  });

  // Patient Risk Demo State
  const [patientDemo, setPatientDemo] = useState({
    age: 72,
    priorAdmissions: 2,
    chronicConditions: 3,
    medicationCompliance: 65,
    socialSupport: 'low' as 'high' | 'medium' | 'low',
    dischargeType: 'home' as 'home' | 'snf' | 'ltac' | 'rehab' | 'home_health',
  });

  // Calculated Results
  const [silenceResult, setSilenceResult] = useState<SilenceWindowResult | null>(null);
  const [readmissionResult, setReadmissionResult] = useState<ReturnType<typeof calculateReadmissionRisk> | null>(null);

  // Loading/Error State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Log dashboard access
  useEffect(() => {
    auditLogger.info('HEALTHCARE_ALGORITHMS_DASHBOARD_VIEWED', {
      mode,
      patientId: patientId || 'demo',
    });
  }, [mode, patientId]);

  // Calculate scores whenever inputs change
  useEffect(() => {
    calculateScores();
  }, [silenceDemo, patientDemo]);

  const calculateScores = useCallback(() => {
    try {
      // Calculate Silence Window Score
      const silenceInput: SilenceWindowInput = {
        patientId: patientId || 'demo-patient',
        daysSinceLastContact: silenceDemo.lastContact,
        missedOutreachCalls: silenceDemo.missedCalls,
        missedAppointments: silenceDemo.missedAppts,
        unreadMessages: silenceDemo.unreadMessages,
      };

      const silence = calculateSilenceWindowScore(silenceInput);
      setSilenceResult(silence);

      // Calculate Readmission Risk with Silence Window
      const patientFactors: PatientRiskFactors = {
        patientId: patientId || 'demo-patient',
        age: patientDemo.age,
        priorAdmissions12Months: patientDemo.priorAdmissions,
        chronicConditionCount: patientDemo.chronicConditions,
        medicationCompliancePercent: patientDemo.medicationCompliance,
        socialSupportLevel: patientDemo.socialSupport,
        dischargeDestination: patientDemo.dischargeType,
      };

      const readmission = calculateReadmissionRisk(patientFactors, silence);
      setReadmissionResult(readmission);
    } catch (err) {
      auditLogger.error('HEALTHCARE_ALGORITHMS_CALCULATION_ERROR', err as Error);
    }
  }, [silenceDemo, patientDemo, patientId]);

  // Risk color helper
  const getRiskColor = (level: string) => {
    const levelLower = level.toLowerCase();
    if (levelLower === 'critical' || levelLower === 'high') {
      return 'bg-red-500';
    }
    if (levelLower === 'elevated' || levelLower === 'moderate') {
      return 'bg-yellow-500';
    }
    return 'bg-green-500';
  };

  const getRiskBorderColor = (level: string) => {
    const levelLower = level.toLowerCase();
    if (levelLower === 'critical' || levelLower === 'high') {
      return 'border-red-500/50';
    }
    if (levelLower === 'elevated' || levelLower === 'moderate') {
      return 'border-yellow-500/50';
    }
    return 'border-green-500/50';
  };

  const getRiskBgColor = (level: string) => {
    const levelLower = level.toLowerCase();
    if (levelLower === 'critical' || levelLower === 'high') {
      return 'bg-red-500/20';
    }
    if (levelLower === 'elevated' || levelLower === 'moderate') {
      return 'bg-yellow-500/20';
    }
    return 'bg-green-500/20';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          {showBackButton && onBack && (
            <Button
              variant="ghost"
              onClick={onBack}
              className="absolute left-6 top-6 text-slate-400 hover:text-white"
            >
              Back
            </Button>
          )}
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            WellFit Community AI Algorithms
          </h1>
          <p className="text-slate-400 mt-2">Predictive Healthcare Intelligence</p>
          {mode === 'demo' && (
            <Badge variant="outline" className="mt-2 border-cyan-500/50 text-cyan-400">
              Demo Mode
            </Badge>
          )}
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-700/50 mb-6">
            <TabsTrigger
              value="silence"
              className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white flex items-center gap-2"
            >
              <Radio className="h-4 w-4" />
              Communication Silence Window
            </TabsTrigger>
            <TabsTrigger
              value="readmission"
              className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white flex items-center gap-2"
            >
              <Building2 className="h-4 w-4" />
              Readmissions Prediction
            </TabsTrigger>
            <TabsTrigger
              value="code"
              className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white flex items-center gap-2"
            >
              <Code className="h-4 w-4" />
              Algorithm Code
            </TabsTrigger>
          </TabsList>

          {/* Communication Silence Window Tab */}
          <TabsContent value="silence" className="space-y-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-xl text-cyan-400 flex items-center gap-2">
                  <Radio className="h-5 w-5" />
                  Communication Silence Window Algorithm
                </CardTitle>
                <p className="text-slate-400 text-sm mt-2">
                  A novel predictive factor that detects engagement gaps indicating elevated readmission risk.
                  This proprietary algorithm monitors patient communication patterns to trigger proactive interventions.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Input Controls */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-slate-400">
                      <Calendar className="h-4 w-4" />
                      Days Since Last Contact: <span className="text-white font-medium">{silenceDemo.lastContact}</span>
                    </label>
                    <Slider
                      value={[silenceDemo.lastContact]}
                      onValueChange={([v]) => setSilenceDemo({ ...silenceDemo, lastContact: v })}
                      min={0}
                      max={30}
                      step={1}
                      className="accent-cyan-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-slate-400">
                      <Phone className="h-4 w-4" />
                      Missed Outreach Calls: <span className="text-white font-medium">{silenceDemo.missedCalls}</span>
                    </label>
                    <Slider
                      value={[silenceDemo.missedCalls]}
                      onValueChange={([v]) => setSilenceDemo({ ...silenceDemo, missedCalls: v })}
                      min={0}
                      max={5}
                      step={1}
                      className="accent-cyan-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-slate-400">
                      <Calendar className="h-4 w-4" />
                      Missed Appointments: <span className="text-white font-medium">{silenceDemo.missedAppts}</span>
                    </label>
                    <Slider
                      value={[silenceDemo.missedAppts]}
                      onValueChange={([v]) => setSilenceDemo({ ...silenceDemo, missedAppts: v })}
                      min={0}
                      max={3}
                      step={1}
                      className="accent-cyan-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-slate-400">
                      <Mail className="h-4 w-4" />
                      Unread Messages: <span className="text-white font-medium">{silenceDemo.unreadMessages}</span>
                    </label>
                    <Slider
                      value={[silenceDemo.unreadMessages]}
                      onValueChange={([v]) => setSilenceDemo({ ...silenceDemo, unreadMessages: v })}
                      min={0}
                      max={10}
                      step={1}
                      className="accent-cyan-500"
                    />
                  </div>
                </div>

                {/* Results Display */}
                {silenceResult && (
                  <div className="bg-slate-900 rounded-lg p-6 mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-lg font-medium">Silence Window Score</span>
                      <div className="flex items-center gap-3">
                        <span className="text-3xl font-bold text-cyan-400">{silenceResult.score}</span>
                        <Badge className={`${getRiskColor(silenceResult.riskLevel)} text-white px-3 py-1`}>
                          {silenceResult.riskLevel.toUpperCase()}
                        </Badge>
                      </div>
                    </div>

                    {/* Score Breakdown */}
                    <div className="space-y-4">
                      {/* Days Since Contact */}
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-400">Days Since Contact (35%)</span>
                          <span>{Math.round(silenceResult.components.dayScore)}/100</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div
                            className="bg-cyan-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${silenceResult.components.dayScore}%` }}
                          />
                        </div>
                      </div>

                      {/* Missed Calls */}
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-400">Missed Calls (25%)</span>
                          <span>{Math.round(silenceResult.components.callScore)}/100</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${silenceResult.components.callScore}%` }}
                          />
                        </div>
                      </div>

                      {/* Missed Appointments */}
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-400">Missed Appointments (25%)</span>
                          <span>{Math.round(silenceResult.components.apptScore)}/100</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div
                            className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${silenceResult.components.apptScore}%` }}
                          />
                        </div>
                      </div>

                      {/* Unread Messages */}
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-400">Unread Messages (15%)</span>
                          <span>{Math.round(silenceResult.components.msgScore)}/100</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div
                            className="bg-pink-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${silenceResult.components.msgScore}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Alert Triggered */}
                    {silenceResult.alertTriggered && (
                      <Alert className={`mt-4 ${getRiskBgColor(silenceResult.riskLevel)} ${getRiskBorderColor(silenceResult.riskLevel)}`}>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-white">
                          <span className="font-medium text-yellow-400">Alert Triggered:</span>
                          <span className="ml-2">Recommend immediate care team outreach</span>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Readmissions Prediction Tab */}
          <TabsContent value="readmission" className="space-y-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-xl text-cyan-400 flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  AI Readmissions Risk Prediction Model
                </CardTitle>
                <p className="text-slate-400 text-sm mt-2">
                  Multi-factor predictive model integrating clinical, behavioral, and social determinants.
                  Features the novel Communication Silence Window as a key behavioral predictor.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Patient Inputs */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-slate-400">
                      <Heart className="h-4 w-4" />
                      Age: <span className="text-white font-medium">{patientDemo.age}</span>
                    </label>
                    <Slider
                      value={[patientDemo.age]}
                      onValueChange={([v]) => setPatientDemo({ ...patientDemo, age: v })}
                      min={18}
                      max={95}
                      step={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-slate-400">
                      <Building2 className="h-4 w-4" />
                      Prior Admissions (12mo): <span className="text-white font-medium">{patientDemo.priorAdmissions}</span>
                    </label>
                    <Slider
                      value={[patientDemo.priorAdmissions]}
                      onValueChange={([v]) => setPatientDemo({ ...patientDemo, priorAdmissions: v })}
                      min={0}
                      max={5}
                      step={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-slate-400">
                      <Activity className="h-4 w-4" />
                      Chronic Conditions: <span className="text-white font-medium">{patientDemo.chronicConditions}</span>
                    </label>
                    <Slider
                      value={[patientDemo.chronicConditions]}
                      onValueChange={([v]) => setPatientDemo({ ...patientDemo, chronicConditions: v })}
                      min={0}
                      max={6}
                      step={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-slate-400">
                      <Pill className="h-4 w-4" />
                      Medication Compliance: <span className="text-white font-medium">{patientDemo.medicationCompliance}%</span>
                    </label>
                    <Slider
                      value={[patientDemo.medicationCompliance]}
                      onValueChange={([v]) => setPatientDemo({ ...patientDemo, medicationCompliance: v })}
                      min={0}
                      max={100}
                      step={5}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-slate-400">
                      <Users className="h-4 w-4" />
                      Social Support
                    </label>
                    <Select
                      value={patientDemo.socialSupport}
                      onValueChange={(v) => setPatientDemo({ ...patientDemo, socialSupport: v as 'high' | 'medium' | 'low' })}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-slate-400">
                      <Home className="h-4 w-4" />
                      Discharge Destination
                    </label>
                    <Select
                      value={patientDemo.dischargeType}
                      onValueChange={(v) => setPatientDemo({ ...patientDemo, dischargeType: v as 'home' | 'snf' | 'ltac' | 'rehab' | 'home_health' })}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="home">Home</SelectItem>
                        <SelectItem value="home_health">Home Health</SelectItem>
                        <SelectItem value="snf">Skilled Nursing</SelectItem>
                        <SelectItem value="rehab">Rehab</SelectItem>
                        <SelectItem value="ltac">LTAC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Risk Results */}
                {readmissionResult && silenceResult && (
                  <div className="bg-slate-900 rounded-lg p-6 mt-6">
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-lg font-medium">30-Day Readmission Risk</span>
                      <div className="flex items-center gap-3">
                        <span className="text-4xl font-bold text-cyan-400">{readmissionResult.totalRiskScore}%</span>
                        <Badge className={`${getRiskColor(readmissionResult.riskCategory)} text-white px-3 py-1`}>
                          {readmissionResult.riskCategory} Risk
                        </Badge>
                      </div>
                    </div>

                    {/* Factor Categories */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-slate-800 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-blue-400">{readmissionResult.clinicalScore}</div>
                        <div className="text-sm text-slate-400">Clinical Score</div>
                        <div className="text-xs text-slate-500 mt-1">Age, History, Conditions</div>
                      </div>
                      <div className="bg-slate-800 rounded-lg p-4 text-center border-2 border-cyan-500/50">
                        <div className="text-2xl font-bold text-cyan-400">{readmissionResult.behavioralScore}</div>
                        <div className="text-sm text-slate-400">Behavioral Score</div>
                        <div className="text-xs text-cyan-400 mt-1 flex items-center justify-center gap-1">
                          <Radio className="h-3 w-3" />
                          Includes Silence Window
                        </div>
                      </div>
                      <div className="bg-slate-800 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-purple-400">{readmissionResult.socialScore}</div>
                        <div className="text-sm text-slate-400">Social Score</div>
                        <div className="text-xs text-slate-500 mt-1">Support, Destination</div>
                      </div>
                    </div>

                    {/* Silence Window Integration Highlight */}
                    <Alert className="bg-cyan-500/10 border-cyan-500/30">
                      <Radio className="h-4 w-4 text-cyan-400" />
                      <AlertDescription>
                        <span className="text-cyan-400 font-semibold">Communication Silence Window Impact:</span>
                        <span className="text-slate-300 ml-2">
                          Current silence score of <span className="text-cyan-400 font-bold">{silenceResult.score}</span> contributes
                          <span className="text-cyan-400 font-bold"> {Math.round(silenceResult.score * 0.35)}</span> points
                          to overall risk (35% weight in behavioral factors)
                        </span>
                      </AlertDescription>
                    </Alert>

                    {/* Intervention Recommendations */}
                    {readmissionResult.interventionRecommended && (
                      <Alert className={`mt-4 ${getRiskBgColor(readmissionResult.riskCategory)} ${getRiskBorderColor(readmissionResult.riskCategory)}`}>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <span className="text-red-400 font-medium">Intervention Recommended:</span>
                          <ul className="text-slate-300 mt-2 ml-4 list-disc space-y-1">
                            {readmissionResult.recommendedInterventions.map((intervention, idx) => (
                              <li key={idx} className={intervention.priority === 'critical' || intervention.priority === 'high' ? 'text-red-300' : silenceResult.alertTriggered && intervention.targetFactors.includes('communication_silence') ? 'text-cyan-400' : ''}>
                                {intervention.intervention}
                                {intervention.targetFactors.includes('communication_silence') && (
                                  <span className="text-cyan-400 text-xs ml-2">(Silence Window)</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Code Tab */}
          <TabsContent value="code" className="space-y-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-xl text-cyan-400 flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Algorithm Implementation (TypeScript)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Silence Window Algorithm */}
                <div>
                  <h3 className="text-lg font-medium text-white mb-3">Communication Silence Window Algorithm</h3>
                  <pre className="bg-slate-900 rounded-lg p-4 overflow-x-auto text-sm">
                    <code className="text-green-400">{`// Communication Silence Window Algorithm
// Patent Pending - WellFit Community / Envision VirtualEdge Group LLC

interface SilenceWindowInput {
  daysSinceLastContact: number;
  missedOutreachCalls: number;
  missedAppointments: number;
  unreadMessages: number;
}

interface SilenceWindowResult {
  score: number;           // 0-100
  riskLevel: 'normal' | 'elevated' | 'critical';
  alertTriggered: boolean;
  components: Record<string, number>;
}

function calculateSilenceWindowScore(
  input: SilenceWindowInput
): SilenceWindowResult {
  // Configurable weights based on clinical validation
  const WEIGHTS = {
    daysSinceContact: 0.35,  // Primary indicator
    missedCalls: 0.25,       // Active avoidance signal
    missedAppointments: 0.25, // Strong predictor
    unreadMessages: 0.15     // Passive disengagement
  };

  // Normalize to 0-100 scale with clinical thresholds
  const normalize = (value: number, max: number): number =>
    Math.min((value / max) * 100, 100);

  const components = {
    dayScore: normalize(input.daysSinceLastContact, 30),
    callScore: normalize(input.missedOutreachCalls, 5),
    apptScore: normalize(input.missedAppointments, 3),
    msgScore: normalize(input.unreadMessages, 10)
  };

  const weightedScore =
    (components.dayScore * WEIGHTS.daysSinceContact) +
    (components.callScore * WEIGHTS.missedCalls) +
    (components.apptScore * WEIGHTS.missedAppointments) +
    (components.msgScore * WEIGHTS.unreadMessages);

  return {
    score: Math.round(weightedScore),
    riskLevel: weightedScore >= 70 ? 'critical'
             : weightedScore >= 40 ? 'elevated'
             : 'normal',
    alertTriggered: weightedScore >= 40,
    components
  };
}`}</code>
                  </pre>
                </div>

                {/* Readmissions Risk Model */}
                <div>
                  <h3 className="text-lg font-medium text-white mb-3">Readmissions Risk Prediction Model</h3>
                  <pre className="bg-slate-900 rounded-lg p-4 overflow-x-auto text-sm">
                    <code className="text-blue-400">{`// AI Readmissions Risk Prediction Model
// Integrates Communication Silence Window as novel predictor

interface PatientRiskFactors {
  // Clinical Factors
  age: number;
  priorAdmissions12Months: number;
  chronicConditionCount: number;

  // Behavioral Factors
  medicationCompliancePercent: number;
  communicationSilenceScore: number; // From Silence Window algo

  // Social Determinants
  socialSupportLevel: 'high' | 'medium' | 'low';
  dischargeDestination: 'home' | 'snf' | 'ltac';
}

interface RiskPredictionResult {
  riskScore: number;        // 0-100
  riskCategory: 'Low' | 'Moderate' | 'High' | 'Critical';
  clinicalContribution: number;
  behavioralContribution: number;
  socialContribution: number;
  interventionRecommended: boolean;
  recommendedActions: string[];
}

function predictReadmissionRisk(
  patient: PatientRiskFactors
): RiskPredictionResult {
  // Clinical Factors (40% total weight)
  const clinicalScore =
    (patient.age >= 75 ? 15 : patient.age >= 65 ? 10 : 5) +
    Math.min(patient.priorAdmissions12Months * 8, 25) +
    Math.min(patient.chronicConditionCount * 5, 20);

  // Behavioral Factors (35% total weight)
  // Communication Silence Window is KEY differentiator
  const behavioralScore =
    ((100 - patient.medicationCompliancePercent) * 0.25) +
    (patient.communicationSilenceScore * 0.35);

  // Social Determinants (25% total weight)
  const socialMap = { low: 15, medium: 8, high: 2 };
  const destMap = { home: 5, snf: 10, ltac: 15 };
  const socialScore =
    socialMap[patient.socialSupportLevel] +
    destMap[patient.dischargeDestination];

  const totalRisk = Math.min(
    clinicalScore + behavioralScore + socialScore,
    100
  );

  const actions: string[] = [];
  if (totalRisk >= 40) {
    actions.push('Schedule care coordinator follow-up');
    actions.push('Activate TCM protocol');
  }
  if (patient.communicationSilenceScore >= 40) {
    actions.push('PRIORITY: Address communication gap');
  }

  return {
    riskScore: Math.round(totalRisk),
    riskCategory: totalRisk >= 70 ? 'Critical'
                : totalRisk >= 40 ? 'High'
                : totalRisk >= 20 ? 'Moderate'
                : 'Low',
    clinicalContribution: Math.round(clinicalScore),
    behavioralContribution: Math.round(behavioralScore),
    socialContribution: Math.round(socialScore),
    interventionRecommended: totalRisk >= 40,
    recommendedActions: actions
  };
}`}</code>
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="mt-8 text-center text-slate-500 text-sm">
          <p>&copy; 2024 Envision VirtualEdge Group LLC — WellFit Community Platform</p>
          <p className="mt-1">Communication Silence Window&trade; — Patent Pending</p>
        </div>
      </div>
    </div>
  );
};

export default HealthcareAlgorithmsDashboard;
