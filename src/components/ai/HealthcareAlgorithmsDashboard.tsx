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
 *
 * Design: Envision Atlus Clinical Design System
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Radio,
  Activity,
  Building2,
  Code,
  AlertTriangle,
  Phone,
  Calendar,
  Mail,
  Heart,
  Users,
  Pill,
  Home,
} from 'lucide-react';
import { auditLogger } from '../../services/auditLogger';
import { calculateSilenceWindowScore } from '../../services/communicationSilenceWindowService';
import {
  calculateReadmissionRisk,
  type PatientRiskFactors,
} from '../../services/readmissionRiskPredictionService';
import type {
  SilenceWindowInput,
  SilenceWindowResult,
} from '../../types/communicationSilenceWindow';

// Envision Atlus Design System
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EABadge,
  EAMetricCard,
  EAAlert,
  EASlider,
  EASelect,
  EASelectTrigger,
  EASelectContent,
  EASelectItem,
  EASelectValue,
  EAPageLayout,
  EARiskIndicator,
  getRiskStyles,
} from '../envision-atlus';

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
  mode = 'demo',
  showBackButton = false,
  onBack,
}) => {
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

  // Log dashboard access
  useEffect(() => {
    auditLogger.info('HEALTHCARE_ALGORITHMS_DASHBOARD_VIEWED', {
      mode,
      patientId: patientId || 'demo',
    });
  }, [mode, patientId]);

  // Calculate scores whenever inputs change
  const calculateScores = useCallback(() => {
    try {
      const silenceInput: SilenceWindowInput = {
        patientId: patientId || 'demo-patient',
        daysSinceLastContact: silenceDemo.lastContact,
        missedOutreachCalls: silenceDemo.missedCalls,
        missedAppointments: silenceDemo.missedAppts,
        unreadMessages: silenceDemo.unreadMessages,
      };

      const silence = calculateSilenceWindowScore(silenceInput);
      setSilenceResult(silence);

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

  useEffect(() => {
    calculateScores();
  }, [calculateScores]);

  return (
    <EAPageLayout
      title="Healthcare AI Algorithms"
      subtitle="Predictive Intelligence for Clinical Decision Support"
      badge={
        mode === 'demo' ? (
          <EABadge variant="info" size="sm">Demo Mode</EABadge>
        ) : undefined
      }
      backButton={showBackButton && onBack ? { onClick: onBack } : undefined}
    >
      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-slate-800/50 border border-slate-700 rounded-lg p-1 mb-6">
          <TabsTrigger
            value="silence"
            className="flex items-center gap-2 rounded-md data-[state=active]:bg-[#00857a] data-[state=active]:text-white text-slate-400"
          >
            <Radio className="h-4 w-4" />
            <span className="hidden sm:inline">Communication</span> Silence Window
          </TabsTrigger>
          <TabsTrigger
            value="readmission"
            className="flex items-center gap-2 rounded-md data-[state=active]:bg-[#00857a] data-[state=active]:text-white text-slate-400"
          >
            <Building2 className="h-4 w-4" />
            Readmissions Prediction
          </TabsTrigger>
          <TabsTrigger
            value="code"
            className="flex items-center gap-2 rounded-md data-[state=active]:bg-[#00857a] data-[state=active]:text-white text-slate-400"
          >
            <Code className="h-4 w-4" />
            Algorithm Code
          </TabsTrigger>
        </TabsList>

        {/* ===== COMMUNICATION SILENCE WINDOW TAB ===== */}
        <TabsContent value="silence" className="space-y-6">
          <EACard variant="highlight">
            <EACardHeader icon={<Radio className="h-5 w-5" />}>
              <h2 className="text-xl font-semibold text-white">Communication Silence Window Algorithm</h2>
              <p className="text-sm text-slate-400 mt-1">
                A novel predictive factor that detects engagement gaps indicating elevated readmission risk.
              </p>
            </EACardHeader>
            <EACardContent className="space-y-6">
              {/* Input Controls with Icons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Calendar className="h-4 w-4 text-[#00857a]" />
                    <span className="text-sm">Days Since Last Contact</span>
                  </div>
                  <EASlider
                    label=""
                    value={[silenceDemo.lastContact]}
                    onValueChange={([v]) => setSilenceDemo({ ...silenceDemo, lastContact: v })}
                    min={0}
                    max={30}
                    step={1}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Phone className="h-4 w-4 text-[#00857a]" />
                    <span className="text-sm">Missed Outreach Calls</span>
                  </div>
                  <EASlider
                    label=""
                    value={[silenceDemo.missedCalls]}
                    onValueChange={([v]) => setSilenceDemo({ ...silenceDemo, missedCalls: v })}
                    min={0}
                    max={5}
                    step={1}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Activity className="h-4 w-4 text-[#00857a]" />
                    <span className="text-sm">Missed Appointments</span>
                  </div>
                  <EASlider
                    label=""
                    value={[silenceDemo.missedAppts]}
                    onValueChange={([v]) => setSilenceDemo({ ...silenceDemo, missedAppts: v })}
                    min={0}
                    max={3}
                    step={1}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Mail className="h-4 w-4 text-[#00857a]" />
                    <span className="text-sm">Unread Messages</span>
                  </div>
                  <EASlider
                    label=""
                    value={[silenceDemo.unreadMessages]}
                    onValueChange={([v]) => setSilenceDemo({ ...silenceDemo, unreadMessages: v })}
                    min={0}
                    max={10}
                    step={1}
                  />
                </div>
              </div>

              {/* Reset Button */}
              <div className="flex justify-end">
                <EAButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setSilenceDemo({ lastContact: 14, missedCalls: 2, missedAppts: 1, unreadMessages: 5 })}
                >
                  Reset Demo Values
                </EAButton>
              </div>

              {/* Results Display */}
              {silenceResult && (
                <div className="bg-slate-900 rounded-lg p-6 mt-6 border border-slate-700">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-lg font-medium text-white">Silence Window Score</span>
                    <div className="flex items-center gap-4">
                      <span className="text-4xl font-bold text-[#00857a]">{silenceResult.score}</span>
                      <EARiskIndicator level={silenceResult.riskLevel} size="lg" />
                    </div>
                  </div>

                  {/* Score Breakdown */}
                  <div className="space-y-4">
                    <EARiskIndicator
                      level={silenceResult.components.dayScore > 60 ? 'high' : silenceResult.components.dayScore > 30 ? 'elevated' : 'normal'}
                      variant="bar"
                      label="Days Since Contact (35%)"
                      score={Math.round(silenceResult.components.dayScore)}
                    />
                    <EARiskIndicator
                      level={silenceResult.components.callScore > 60 ? 'high' : silenceResult.components.callScore > 30 ? 'elevated' : 'normal'}
                      variant="bar"
                      label="Missed Calls (25%)"
                      score={Math.round(silenceResult.components.callScore)}
                    />
                    <EARiskIndicator
                      level={silenceResult.components.apptScore > 60 ? 'high' : silenceResult.components.apptScore > 30 ? 'elevated' : 'normal'}
                      variant="bar"
                      label="Missed Appointments (25%)"
                      score={Math.round(silenceResult.components.apptScore)}
                    />
                    <EARiskIndicator
                      level={silenceResult.components.msgScore > 60 ? 'high' : silenceResult.components.msgScore > 30 ? 'elevated' : 'normal'}
                      variant="bar"
                      label="Unread Messages (15%)"
                      score={Math.round(silenceResult.components.msgScore)}
                    />
                  </div>

                  {/* Alert */}
                  {silenceResult.alertTriggered && (
                    <EAAlert variant="warning" title="Alert Triggered" className="mt-6">
                      Recommend immediate care team outreach. Patient showing signs of disengagement.
                    </EAAlert>
                  )}
                </div>
              )}
            </EACardContent>
          </EACard>
        </TabsContent>

        {/* ===== READMISSIONS PREDICTION TAB ===== */}
        <TabsContent value="readmission" className="space-y-6">
          <EACard variant="highlight">
            <EACardHeader icon={<Building2 className="h-5 w-5" />}>
              <h2 className="text-xl font-semibold text-white">AI Readmissions Risk Prediction</h2>
              <p className="text-sm text-slate-400 mt-1">
                Multi-factor model integrating clinical, behavioral, and social determinants.
              </p>
            </EACardHeader>
            <EACardContent className="space-y-6">
              {/* Patient Inputs with Icons */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Users className="h-4 w-4 text-[#00857a]" />
                    <span className="text-sm">Age</span>
                  </div>
                  <EASlider
                    label=""
                    value={[patientDemo.age]}
                    onValueChange={([v]) => setPatientDemo({ ...patientDemo, age: v })}
                    min={18}
                    max={95}
                    step={1}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Building2 className="h-4 w-4 text-[#00857a]" />
                    <span className="text-sm">Prior Admissions (12mo)</span>
                  </div>
                  <EASlider
                    label=""
                    value={[patientDemo.priorAdmissions]}
                    onValueChange={([v]) => setPatientDemo({ ...patientDemo, priorAdmissions: v })}
                    min={0}
                    max={5}
                    step={1}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Heart className="h-4 w-4 text-[#00857a]" />
                    <span className="text-sm">Chronic Conditions</span>
                  </div>
                  <EASlider
                    label=""
                    value={[patientDemo.chronicConditions]}
                    onValueChange={([v]) => setPatientDemo({ ...patientDemo, chronicConditions: v })}
                    min={0}
                    max={6}
                    step={1}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Pill className="h-4 w-4 text-[#00857a]" />
                    <span className="text-sm">Medication Compliance %</span>
                  </div>
                  <EASlider
                    label=""
                    value={[patientDemo.medicationCompliance]}
                    onValueChange={([v]) => setPatientDemo({ ...patientDemo, medicationCompliance: v })}
                    min={0}
                    max={100}
                    step={5}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Users className="h-4 w-4 text-[#00857a]" />
                    <span className="text-sm">Social Support</span>
                  </div>
                  <EASelect
                    value={patientDemo.socialSupport}
                    onValueChange={(v) => setPatientDemo({ ...patientDemo, socialSupport: v as 'high' | 'medium' | 'low' })}
                  >
                    <EASelectTrigger>
                      <EASelectValue />
                    </EASelectTrigger>
                    <EASelectContent>
                      <EASelectItem value="high">High</EASelectItem>
                      <EASelectItem value="medium">Medium</EASelectItem>
                      <EASelectItem value="low">Low</EASelectItem>
                    </EASelectContent>
                  </EASelect>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Home className="h-4 w-4 text-[#00857a]" />
                    <span className="text-sm">Discharge Destination</span>
                  </div>
                  <EASelect
                    value={patientDemo.dischargeType}
                    onValueChange={(v) => setPatientDemo({ ...patientDemo, dischargeType: v as 'home' | 'snf' | 'ltac' | 'rehab' | 'home_health' })}
                  >
                    <EASelectTrigger>
                      <EASelectValue />
                    </EASelectTrigger>
                    <EASelectContent>
                      <EASelectItem value="home">Home</EASelectItem>
                      <EASelectItem value="home_health">Home Health</EASelectItem>
                      <EASelectItem value="snf">Skilled Nursing</EASelectItem>
                      <EASelectItem value="rehab">Rehab</EASelectItem>
                      <EASelectItem value="ltac">LTAC</EASelectItem>
                    </EASelectContent>
                  </EASelect>
                </div>
              </div>

              {/* Risk Results */}
              {readmissionResult && silenceResult && (() => {
                // Use getRiskStyles to get dynamic styling for the risk category
                const riskStyles = getRiskStyles(readmissionResult.riskCategory);
                return (
                <div className={`bg-slate-900 rounded-lg p-6 mt-6 ${riskStyles.border || 'border border-slate-700'}`}>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      {(readmissionResult.riskCategory === 'High' || readmissionResult.riskCategory === 'Critical') && (
                        <AlertTriangle className={`h-5 w-5 ${riskStyles.text || 'text-red-500'}`} />
                      )}
                      <span className="text-lg font-medium text-white">30-Day Readmission Risk</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-4xl font-bold ${riskStyles.text || 'text-[#00857a]'}`}>{readmissionResult.totalRiskScore}%</span>
                      <EARiskIndicator level={readmissionResult.riskCategory} size="lg" />
                    </div>
                  </div>

                  {/* Factor Categories */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <EAMetricCard
                      label="Clinical Score"
                      value={readmissionResult.clinicalScore}
                      sublabel="Age, History, Conditions"
                    />
                    <EAMetricCard
                      label="Behavioral Score"
                      value={readmissionResult.behavioralScore}
                      sublabel="Includes Silence Window"
                      riskLevel={silenceResult.riskLevel === 'critical' ? 'high' : silenceResult.riskLevel}
                    />
                    <EAMetricCard
                      label="Social Score"
                      value={readmissionResult.socialScore}
                      sublabel="Support, Destination"
                    />
                  </div>

                  {/* Silence Window Impact */}
                  <EAAlert variant="info" className="mb-6">
                    <strong>Communication Silence Window Impact:</strong> Current score of{' '}
                    <span className="font-bold text-[#33bfb7]">{silenceResult.score}</span> contributes{' '}
                    <span className="font-bold text-[#33bfb7]">{Math.round(silenceResult.score * 0.35)}</span> points
                    to overall risk (35% weight in behavioral factors)
                  </EAAlert>

                  {/* Interventions */}
                  {readmissionResult.interventionRecommended && (
                    <EAAlert variant="warning" title="Intervention Recommended">
                      <ul className="mt-2 ml-4 list-disc space-y-1">
                        {readmissionResult.recommendedInterventions.map((intervention, idx) => (
                          <li key={idx} className={intervention.priority === 'critical' ? 'text-red-300' : ''}>
                            {intervention.intervention}
                            {intervention.targetFactors.includes('communication_silence') && (
                              <EABadge variant="info" size="sm" className="ml-2">Silence Window</EABadge>
                            )}
                          </li>
                        ))}
                      </ul>
                    </EAAlert>
                  )}
                </div>
                );
              })()}
            </EACardContent>
          </EACard>
        </TabsContent>

        {/* ===== CODE TAB ===== */}
        <TabsContent value="code" className="space-y-6">
          <EACard>
            <EACardHeader icon={<Code className="h-5 w-5" />}>
              <h2 className="text-xl font-semibold text-white">Algorithm Implementation (TypeScript)</h2>
            </EACardHeader>
            <EACardContent className="space-y-6">
              {/* Silence Window Algorithm */}
              <div>
                <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                  <Radio className="h-4 w-4 text-[#00857a]" />
                  Communication Silence Window Algorithm
                </h3>
                <pre className="bg-slate-900 border border-slate-700 rounded-lg p-4 overflow-x-auto text-sm">
                  <code className="text-[#33bfb7]">{`// Communication Silence Window Algorithm
// Patent Pending - WellFit Community / Envision VirtualEdge Group LLC

interface SilenceWindowInput {
  daysSinceLastContact: number;
  missedOutreachCalls: number;
  missedAppointments: number;
  unreadMessages: number;
}

const WEIGHTS = {
  daysSinceContact: 0.35,   // Primary indicator
  missedCalls: 0.25,        // Active avoidance signal
  missedAppointments: 0.25, // Strong predictor
  unreadMessages: 0.15      // Passive disengagement
};

function calculateSilenceWindowScore(input: SilenceWindowInput) {
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

              {/* Readmission Risk Model */}
              <div>
                <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#00857a]" />
                  Readmissions Risk Prediction Model
                </h3>
                <pre className="bg-slate-900 border border-slate-700 rounded-lg p-4 overflow-x-auto text-sm">
                  <code className="text-[#66cfc9]">{`// AI Readmissions Risk Prediction Model
// Integrates Communication Silence Window as novel predictor

function predictReadmissionRisk(patient, silenceWindow) {
  // Clinical Factors (40% total weight)
  const clinicalScore =
    (patient.age >= 75 ? 15 : patient.age >= 65 ? 10 : 5) +
    Math.min(patient.priorAdmissions * 8, 25) +
    Math.min(patient.chronicConditions * 5, 20);

  // Behavioral Factors (35% total weight)
  // Communication Silence Window is KEY differentiator
  const behavioralScore =
    ((100 - patient.medicationCompliance) * 0.25) +
    (silenceWindow.score * 0.35);

  // Social Determinants (25% total weight)
  const socialMap = { low: 15, medium: 8, high: 2 };
  const destMap = { home: 5, snf: 10, ltac: 15 };
  const socialScore =
    socialMap[patient.socialSupport] +
    destMap[patient.discharge];

  const totalRisk = Math.min(
    clinicalScore + behavioralScore + socialScore,
    100
  );

  return {
    riskScore: Math.round(totalRisk),
    riskCategory: totalRisk >= 70 ? 'Critical'
                : totalRisk >= 40 ? 'High'
                : totalRisk >= 20 ? 'Moderate'
                : 'Low',
    interventionRecommended: totalRisk >= 40
  };
}`}</code>
                </pre>
              </div>
            </EACardContent>
          </EACard>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="mt-8 text-center text-slate-500 text-sm">
        <p>&copy; 2024 Envision VirtualEdge Group LLC — WellFit Community Platform</p>
        <p className="mt-1">Communication Silence Window&trade; — Patent Pending</p>
      </div>
    </EAPageLayout>
  );
};

export default HealthcareAlgorithmsDashboard;
