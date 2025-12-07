/**
 * AI Accuracy Dashboard
 *
 * Purpose: Monitor AI prediction accuracy across all skills with human oversight
 *
 * Features:
 * - Real-time accuracy metrics by skill
 * - Trend analysis over configurable time periods
 * - Cost tracking per skill
 * - A/B experiment results
 * - Prompt version history with accuracy comparison
 *
 * This dashboard enables evidence-based prompt optimization with
 * human-in-the-loop oversight as recommended for healthcare AI.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient } from '../../contexts/AuthContext';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EABadge,
  EAMetricCard,
  EAAlert,
  EASelect,
  EASelectTrigger,
  EASelectContent,
  EASelectItem,
  EASelectValue,
  EATabs
} from '../envision-atlus';

// Types
interface SkillMetrics {
  skillName: string;
  totalPredictions: number;
  predictionsWithOutcome: number;
  accuracyRate: number | null;
  avgConfidence: number | null;
  totalCostUsd: number;
  trend: 'up' | 'down' | 'stable';
}

interface ExperimentSummary {
  id: string;
  experimentName: string;
  skillName: string;
  status: 'draft' | 'running' | 'completed' | 'cancelled';
  controlPredictions: number;
  treatmentPredictions: number;
  winner: string | null;
  isSignificant: boolean;
}

interface PromptVersionSummary {
  id: string;
  skillName: string;
  versionNumber: number;
  isActive: boolean;
  totalUses: number;
  accuracyRate: number | null;
  createdAt: string;
}

// Skill display names
const SKILL_DISPLAY_NAMES: Record<string, string> = {
  readmission_risk: 'Readmission Risk',
  billing_codes: 'Billing Code Suggester',
  sdoh_detection: 'SDOH Detection',
  welfare_check: 'Welfare Check',
  shift_handoff: 'Shift Handoff',
  emergency_briefing: 'Emergency Briefing',
  ccm_eligibility: 'CCM Eligibility'
};

// Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount);
}

// Format percentage
function formatPercent(value: number | null): string {
  if (value === null) return 'N/A';
  return `${(value * 100).toFixed(1)}%`;
}

// Component
export default function AIAccuracyDashboard() {
  const supabase = useSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<number>(30);
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Data state
  const [skillMetrics, setSkillMetrics] = useState<SkillMetrics[]>([]);
  const [experiments, setExperiments] = useState<ExperimentSummary[]>([]);
  const [promptVersions, setPromptVersions] = useState<PromptVersionSummary[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  // Aggregate metrics
  const [totalPredictions, setTotalPredictions] = useState(0);
  const [overallAccuracy, setOverallAccuracy] = useState<number | null>(null);
  const [totalCost, setTotalCost] = useState(0);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Load accuracy dashboard data
      const { data: dashboardData, error: dashboardError } = await supabase.rpc(
        'get_accuracy_dashboard',
        { p_tenant_id: null, p_days: days }
      );

      if (dashboardError) throw dashboardError;

      // Transform to SkillMetrics
      const metrics: SkillMetrics[] = (dashboardData || []).map((row: Record<string, unknown>) => ({
        skillName: row.skill_name as string,
        totalPredictions: row.total_predictions as number,
        predictionsWithOutcome: 0,
        accuracyRate: row.accuracy_rate as number | null,
        avgConfidence: row.avg_confidence as number | null,
        totalCostUsd: row.total_cost as number,
        trend: 'stable' as const
      }));

      setSkillMetrics(metrics);

      // Calculate aggregates
      const totPred = metrics.reduce((sum, m) => sum + m.totalPredictions, 0);
      setTotalPredictions(totPred);

      const withAccuracy = metrics.filter(m => m.accuracyRate !== null);
      if (withAccuracy.length > 0) {
        const avgAcc = withAccuracy.reduce((sum, m) => sum + (m.accuracyRate || 0), 0) / withAccuracy.length;
        setOverallAccuracy(avgAcc);
      } else {
        setOverallAccuracy(null);
      }

      setTotalCost(metrics.reduce((sum, m) => sum + m.totalCostUsd, 0));

      // Load experiments
      const { data: expData, error: expError } = await supabase
        .from('ai_prompt_experiments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!expError && expData) {
        setExperiments(expData.map(e => ({
          id: e.id,
          experimentName: e.experiment_name,
          skillName: e.skill_name,
          status: e.status,
          controlPredictions: e.control_predictions || 0,
          treatmentPredictions: e.treatment_predictions || 0,
          winner: e.winner,
          isSignificant: e.is_significant || false
        })));
      }

      // Load prompt versions
      const { data: promptData, error: promptError } = await supabase
        .from('ai_prompt_versions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!promptError && promptData) {
        setPromptVersions(promptData.map(p => ({
          id: p.id,
          skillName: p.skill_name,
          versionNumber: p.version_number,
          isActive: p.is_active,
          totalUses: p.total_uses || 0,
          accuracyRate: p.accuracy_rate,
          createdAt: p.created_at
        })));
      }

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [supabase, days]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Get accuracy badge color
  const getAccuracyColor = (rate: number | null): 'success' | 'warning' | 'danger' | 'secondary' => {
    if (rate === null) return 'secondary';
    if (rate >= 0.85) return 'success';
    if (rate >= 0.70) return 'warning';
    return 'danger';
  };

  // Render loading state
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-700 rounded w-1/3 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-slate-700 rounded" />
            ))}
          </div>
          <div className="h-64 bg-slate-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Accuracy Dashboard</h1>
          <p className="text-slate-400 mt-1">
            Monitor prediction accuracy and optimize AI skills with human oversight
          </p>
        </div>

        <div className="flex items-center gap-4">
          <EASelect value={days.toString()} onValueChange={(value) => setDays(parseInt(value, 10))}>
            <EASelectTrigger className="w-40">
              <EASelectValue placeholder="Select period" />
            </EASelectTrigger>
            <EASelectContent>
              <EASelectItem value="7">Last 7 days</EASelectItem>
              <EASelectItem value="30">Last 30 days</EASelectItem>
              <EASelectItem value="90">Last 90 days</EASelectItem>
            </EASelectContent>
          </EASelect>
          <EAButton variant="secondary" onClick={loadData}>
            Refresh
          </EAButton>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <EAAlert variant="danger">
          {error}
        </EAAlert>
      )}

      {/* Summary metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <EAMetricCard
          title="Total Predictions"
          value={totalPredictions.toLocaleString()}
          subtitle={`Last ${days} days`}
        />
        <EAMetricCard
          title="Overall Accuracy"
          value={formatPercent(overallAccuracy)}
          subtitle="Across all skills"
          trend={overallAccuracy !== null && overallAccuracy >= 0.80 ? 'up' : undefined}
        />
        <EAMetricCard
          title="Active Skills"
          value={skillMetrics.filter(s => s.totalPredictions > 0).length.toString()}
          subtitle="With predictions"
        />
        <EAMetricCard
          title="Total AI Cost"
          value={formatCurrency(totalCost)}
          subtitle={`Last ${days} days`}
        />
      </div>

      {/* Tabs */}
      <EATabs
        tabs={[
          { id: 'overview', label: 'Skill Overview' },
          { id: 'experiments', label: 'A/B Experiments' },
          { id: 'prompts', label: 'Prompt Versions' }
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {skillMetrics.length === 0 ? (
            <EACard>
              <EACardContent className="text-center py-8">
                <p className="text-slate-400">No predictions recorded yet</p>
                <p className="text-sm text-slate-500 mt-2">
                  Predictions will appear here once AI skills are used
                </p>
              </EACardContent>
            </EACard>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {skillMetrics.map((skill) => (
                <EACard key={skill.skillName}>
                  <EACardHeader className="flex items-center justify-between">
                    <h3 className="font-medium text-white">
                      {SKILL_DISPLAY_NAMES[skill.skillName] || skill.skillName}
                    </h3>
                    <EABadge variant={getAccuracyColor(skill.accuracyRate)}>
                      {formatPercent(skill.accuracyRate)} accuracy
                    </EABadge>
                  </EACardHeader>
                  <EACardContent>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-slate-400">Predictions</p>
                        <p className="text-lg font-medium text-white">
                          {skill.totalPredictions.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Avg Confidence</p>
                        <p className="text-lg font-medium text-white">
                          {formatPercent(skill.avgConfidence)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Cost</p>
                        <p className="text-lg font-medium text-white">
                          {formatCurrency(skill.totalCostUsd)}
                        </p>
                      </div>
                    </div>

                    {/* Accuracy bar */}
                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Accuracy</span>
                        <span>{formatPercent(skill.accuracyRate)}</span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            skill.accuracyRate === null
                              ? 'bg-slate-600'
                              : skill.accuracyRate >= 0.85
                              ? 'bg-green-500'
                              : skill.accuracyRate >= 0.70
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${(skill.accuracyRate || 0) * 100}%` }}
                        />
                      </div>
                    </div>
                  </EACardContent>
                </EACard>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'experiments' && (
        <EACard>
          <EACardHeader>
            <h3 className="font-medium text-white">A/B Test Experiments</h3>
            <p className="text-sm text-slate-400 mt-1">
              Compare prompt variations with statistical significance
            </p>
          </EACardHeader>
          <EACardContent>
            {experiments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-400">No experiments created yet</p>
                <p className="text-sm text-slate-500 mt-2">
                  Create experiments to test new prompt variations
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-700">
                      <th className="pb-3 pr-4">Experiment</th>
                      <th className="pb-3 pr-4">Skill</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3 pr-4">Control</th>
                      <th className="pb-3 pr-4">Treatment</th>
                      <th className="pb-3">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {experiments.map((exp) => (
                      <tr key={exp.id} className="border-b border-slate-700/50">
                        <td className="py-3 pr-4 font-medium text-white">
                          {exp.experimentName}
                        </td>
                        <td className="py-3 pr-4 text-slate-300">
                          {SKILL_DISPLAY_NAMES[exp.skillName] || exp.skillName}
                        </td>
                        <td className="py-3 pr-4">
                          <EABadge
                            variant={
                              exp.status === 'running' ? 'info' :
                              exp.status === 'completed' ? 'success' :
                              exp.status === 'cancelled' ? 'danger' :
                              'secondary'
                            }
                          >
                            {exp.status}
                          </EABadge>
                        </td>
                        <td className="py-3 pr-4 text-slate-300">
                          {exp.controlPredictions} predictions
                        </td>
                        <td className="py-3 pr-4 text-slate-300">
                          {exp.treatmentPredictions} predictions
                        </td>
                        <td className="py-3">
                          {exp.status === 'completed' ? (
                            <span className={`font-medium ${
                              exp.winner === 'treatment' ? 'text-green-400' :
                              exp.winner === 'control' ? 'text-blue-400' :
                              'text-slate-400'
                            }`}>
                              {exp.winner === 'treatment' ? 'Treatment wins' :
                               exp.winner === 'control' ? 'Control wins' :
                               'No difference'}
                              {exp.isSignificant && ' (p<0.05)'}
                            </span>
                          ) : (
                            <span className="text-slate-500">Pending</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </EACardContent>
        </EACard>
      )}

      {activeTab === 'prompts' && (
        <EACard>
          <EACardHeader>
            <h3 className="font-medium text-white">Prompt Version History</h3>
            <p className="text-sm text-slate-400 mt-1">
              Track prompt iterations and their accuracy over time
            </p>
          </EACardHeader>
          <EACardContent>
            {promptVersions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-400">No prompt versions recorded yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-700">
                      <th className="pb-3 pr-4">Skill</th>
                      <th className="pb-3 pr-4">Version</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3 pr-4">Uses</th>
                      <th className="pb-3 pr-4">Accuracy</th>
                      <th className="pb-3">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {promptVersions.map((prompt) => (
                      <tr key={prompt.id} className="border-b border-slate-700/50">
                        <td className="py-3 pr-4 font-medium text-white">
                          {SKILL_DISPLAY_NAMES[prompt.skillName] || prompt.skillName}
                        </td>
                        <td className="py-3 pr-4 text-slate-300">
                          v{prompt.versionNumber}
                        </td>
                        <td className="py-3 pr-4">
                          {prompt.isActive ? (
                            <EABadge variant="success">Active</EABadge>
                          ) : (
                            <EABadge variant="secondary">Inactive</EABadge>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-slate-300">
                          {prompt.totalUses.toLocaleString()}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`font-medium ${
                            prompt.accuracyRate === null ? 'text-slate-500' :
                            prompt.accuracyRate >= 0.85 ? 'text-green-400' :
                            prompt.accuracyRate >= 0.70 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {formatPercent(prompt.accuracyRate)}
                          </span>
                        </td>
                        <td className="py-3 text-slate-400">
                          {new Date(prompt.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </EACardContent>
        </EACard>
      )}

      {/* Human oversight reminder */}
      <EAAlert variant="info">
        <strong>Human Oversight Active:</strong> All AI predictions are tracked for accuracy.
        Provider reviews of predictions (accept/modify/reject) are automatically recorded
        to continuously improve prompt quality through evidence-based optimization.
      </EAAlert>
    </div>
  );
}
