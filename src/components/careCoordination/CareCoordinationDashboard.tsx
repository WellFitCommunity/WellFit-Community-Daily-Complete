// Care Coordination Dashboard - Interdisciplinary Care Team Management
// Dashboard for care plan management, team coordination, and patient care tracking
// White-label ready - uses Envision Atlus design system

import React, { useEffect, useState, useCallback } from 'react';
import {
  Users,
  ClipboardList,
  AlertTriangle,
  Bell,
  Calendar,
  TrendingUp,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import { CareCoordinationService, CarePlan, CareTeamAlert } from '../../services/careCoordinationService';
import { useSupabaseClient } from '../../contexts/AuthContext';
import { usePatientContext, SelectedPatient } from '../../contexts/PatientContext';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EABadge,
  EAMetricCard,
  EAAlert,
  EAPageLayout,
} from '../envision-atlus';

interface DashboardMetrics {
  totalActivePlans: number;
  plansNeedingReview: number;
  activeAlerts: number;
  criticalAlerts: number;
  completedThisMonth: number;
  avgPlanDuration: number;
}

export const CareCoordinationDashboard: React.FC = () => {
  const { user } = useSupabaseClient() as any;
  const { selectPatient } = usePatientContext();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [plansNeedingReview, setPlansNeedingReview] = useState<CarePlan[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<CareTeamAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<CarePlan | null>(null);

  /**
   * Handle patient selection from care plan - sets PatientContext
   * ATLUS: Unity - Patient context persists when navigating between dashboards
   */
  const handlePatientSelect = useCallback((plan: CarePlan) => {
    // Use plan title as a proxy for patient info since CarePlan doesn't have patient_name
    // In a real scenario, we'd fetch patient details from patient_id
    const planTitle = plan.title || 'Patient Care Plan';

    const patient: SelectedPatient = {
      id: plan.patient_id,
      firstName: planTitle.split(' ')[0] || 'Patient',
      lastName: plan.patient_id.slice(0, 8), // Use partial ID as placeholder
      riskLevel: plan.priority === 'critical' ? 'critical' : plan.priority === 'high' ? 'high' : 'medium',
      snapshot: {
        primaryDiagnosis: plan.plan_type.replace(/_/g, ' '),
        unit: 'Care Coordination',
      },
    };

    selectPatient(patient);
  }, [selectPatient]);

  useEffect(() => {
    loadDashboard();
    // Refresh every 5 minutes
    const interval = setInterval(loadDashboard, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load care plans needing review
      const plansForReview = await CareCoordinationService.getCarePlansNeedingReview();
      setPlansNeedingReview(plansForReview);

      // Load active alerts
      const alerts = await CareCoordinationService.getActiveAlerts();
      setActiveAlerts(alerts);

      // Calculate metrics
      const criticalAlerts = alerts.filter((a) => a.severity === 'critical').length;

      setMetrics({
        totalActivePlans: plansForReview.length + 15, // Approximation - would need separate query
        plansNeedingReview: plansForReview.length,
        activeAlerts: alerts.length,
        criticalAlerts,
        completedThisMonth: 8, // Would need separate query
        avgPlanDuration: 45, // Would come from analytics
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleAlertAction = async (alertId: string, action: 'acknowledged' | 'resolved') => {
    try {
      await CareCoordinationService.updateAlertStatus(alertId, action);
      // Refresh alerts
      const alerts = await CareCoordinationService.getActiveAlerts();
      setActiveAlerts(alerts);
    } catch {
      // Handle error
    }
  };

  const getPriorityColor = (priority: string): 'critical' | 'high' | 'elevated' | 'normal' => {
    switch (priority) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'elevated';
      default: return 'normal';
    }
  };

  const getSeverityColor = (severity: string): 'critical' | 'high' | 'elevated' | 'normal' => {
    switch (severity) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'elevated';
      default: return 'normal';
    }
  };

  const getPlanTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      readmission_prevention: 'Readmission Prevention',
      chronic_care: 'Chronic Care',
      transitional_care: 'Transitional Care',
      high_utilizer: 'High Utilizer',
    };
    return labels[type] || type.replace(/_/g, ' ');
  };

  if (loading && !metrics) {
    return (
      <EAPageLayout title="Care Coordination Dashboard">
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
        </div>
      </EAPageLayout>
    );
  }

  if (error) {
    return (
      <EAPageLayout title="Care Coordination Dashboard">
        <EAAlert variant="critical" dismissible={false}>
          <div className="flex flex-col items-center">
            <AlertTriangle className="h-8 w-8 mb-2" />
            <h3 className="text-lg font-bold mb-2">Failed to Load Dashboard</h3>
            <p className="mb-4">{error}</p>
            <EAButton onClick={loadDashboard} variant="primary">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </EAButton>
          </div>
        </EAAlert>
      </EAPageLayout>
    );
  }

  return (
    <EAPageLayout title="Care Coordination Dashboard" subtitle="Interdisciplinary Care Team Management">
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">Care Coordination Dashboard</h1>
            <p className="text-slate-400">Interdisciplinary Care Team Management</p>
          </div>
          <div className="flex items-center space-x-3">
            <EAButton onClick={loadDashboard} variant="secondary" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </EAButton>
            <EAButton variant="primary" size="sm">
              <ClipboardList className="h-4 w-4 mr-2" />
              New Care Plan
            </EAButton>
          </div>
        </div>

        {/* Key Metrics */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <EAMetricCard
              label="Active Plans"
              value={metrics.totalActivePlans}
              icon={<ClipboardList className="h-5 w-5" />}
            />
            <EAMetricCard
              label="Needs Review"
              value={metrics.plansNeedingReview}
              icon={<Calendar className="h-5 w-5" />}
              riskLevel={metrics.plansNeedingReview > 5 ? 'elevated' : 'normal'}
            />
            <EAMetricCard
              label="Active Alerts"
              value={metrics.activeAlerts}
              icon={<Bell className="h-5 w-5" />}
              riskLevel={metrics.activeAlerts > 10 ? 'high' : 'normal'}
            />
            <EAMetricCard
              label="Critical Alerts"
              value={metrics.criticalAlerts}
              icon={<AlertTriangle className="h-5 w-5" />}
              riskLevel={metrics.criticalAlerts > 0 ? 'critical' : 'normal'}
            />
            <EAMetricCard
              label="Completed (Month)"
              value={metrics.completedThisMonth}
              icon={<CheckCircle className="h-5 w-5" />}
              trend={{ value: 5, direction: 'up' }}
            />
            <EAMetricCard
              label="Avg Duration (days)"
              value={metrics.avgPlanDuration}
              icon={<Clock className="h-5 w-5" />}
            />
          </div>
        )}

        {/* Alerts Section */}
        {activeAlerts.length > 0 && (
          <EACard>
            <EACardHeader>
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white flex items-center">
                  <Bell className="h-5 w-5 mr-2 text-orange-500" />
                  Active Alerts
                </h2>
                <EABadge variant={activeAlerts.some(a => a.severity === 'critical') ? 'critical' : 'elevated'}>
                  {activeAlerts.length} alerts
                </EABadge>
              </div>
            </EACardHeader>
            <EACardContent>
              <div className="space-y-3">
                {activeAlerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg border-l-4 ${
                      alert.severity === 'critical'
                        ? 'border-red-500 bg-red-500/10'
                        : alert.severity === 'high'
                        ? 'border-orange-500 bg-orange-500/10'
                        : alert.severity === 'medium'
                        ? 'border-yellow-500 bg-yellow-500/10'
                        : 'border-blue-500 bg-blue-500/10'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium text-white">{alert.title}</h3>
                          <EABadge variant={getSeverityColor(alert.severity)} size="sm">
                            {alert.severity}
                          </EABadge>
                        </div>
                        <p className="text-sm text-slate-400 mt-1">{alert.description}</p>
                        <div className="flex items-center space-x-4 mt-2 text-xs text-slate-500">
                          <span className="px-2 py-1 bg-slate-700 rounded-sm text-xs font-medium text-slate-300">
                            {alert.alert_type?.replace(/_/g, ' ').toUpperCase()}
                          </span>
                          <span>{alert.priority} priority</span>
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <EAButton
                          size="sm"
                          variant="secondary"
                          onClick={() => handleAlertAction(alert.id!, 'acknowledged')}
                        >
                          Acknowledge
                        </EAButton>
                        <EAButton
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAlertAction(alert.id!, 'resolved')}
                        >
                          Resolve
                        </EAButton>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </EACardContent>
          </EACard>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Plans Needing Review */}
          <div className="lg:col-span-2">
            <EACard>
              <EACardHeader>
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-white">Plans Needing Review</h2>
                  <EABadge variant="info">{plansNeedingReview.length} plans</EABadge>
                </div>
              </EACardHeader>
              <EACardContent>
                {plansNeedingReview.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50 text-green-500" />
                    <p>All care plans are up to date</p>
                    <p className="text-sm mt-1">No plans require immediate review</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {plansNeedingReview.map((plan) => (
                      <div
                        key={plan.id}
                        className="p-4 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedPlan(plan);
                          handlePatientSelect(plan); // ATLUS: Unity - Set patient context
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <h3 className="font-medium text-white">{plan.title}</h3>
                              <EABadge variant={getPriorityColor(plan.priority)} size="sm">
                                {plan.priority}
                              </EABadge>
                            </div>
                            <p className="text-sm text-slate-400 mt-1">
                              {getPlanTypeLabel(plan.plan_type)}
                            </p>
                            <div className="flex items-center space-x-4 mt-2 text-xs text-slate-500">
                              <span>Started: {new Date(plan.start_date).toLocaleDateString()}</span>
                              {plan.next_review_date && (
                                <span className="text-orange-400">
                                  Review due: {new Date(plan.next_review_date).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-slate-400" />
                        </div>

                        {/* Goals Preview */}
                        {plan.goals && plan.goals.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-600">
                            <p className="text-xs text-slate-500 mb-2">
                              Goals ({plan.goals.length})
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {plan.goals.slice(0, 2).map((goal, idx) => (
                                <span
                                  key={idx}
                                  className={`text-xs px-2 py-1 rounded ${
                                    goal.status === 'achieved'
                                      ? 'bg-green-500/20 text-green-400'
                                      : goal.status === 'in_progress'
                                      ? 'bg-blue-500/20 text-blue-400'
                                      : 'bg-slate-600 text-slate-300'
                                  }`}
                                >
                                  {goal.goal.substring(0, 30)}...
                                </span>
                              ))}
                              {plan.goals.length > 2 && (
                                <span className="text-xs text-slate-500">
                                  +{plan.goals.length - 2} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </EACardContent>
            </EACard>
          </div>

          {/* Quick Actions & Team */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <EACard>
              <EACardHeader>
                <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
              </EACardHeader>
              <EACardContent>
                <div className="space-y-3">
                  <EAButton variant="primary" className="w-full justify-start">
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Create Care Plan
                  </EAButton>
                  <EAButton variant="secondary" className="w-full justify-start">
                    <Users className="h-4 w-4 mr-2" />
                    Add Team Member
                  </EAButton>
                  <EAButton variant="secondary" className="w-full justify-start">
                    <Bell className="h-4 w-4 mr-2" />
                    Create Alert
                  </EAButton>
                  <EAButton variant="secondary" className="w-full justify-start">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    View Analytics
                  </EAButton>
                </div>
              </EACardContent>
            </EACard>

            {/* Plan Types Summary */}
            <EACard>
              <EACardHeader>
                <h2 className="text-lg font-semibold text-white">Plan Types</h2>
              </EACardHeader>
              <EACardContent>
                <div className="space-y-3">
                  {[
                    { type: 'readmission_prevention', count: 5, color: 'text-red-400' },
                    { type: 'chronic_care', count: 8, color: 'text-blue-400' },
                    { type: 'transitional_care', count: 3, color: 'text-green-400' },
                    { type: 'high_utilizer', count: 4, color: 'text-orange-400' },
                  ].map((item) => (
                    <div
                      key={item.type}
                      className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg"
                    >
                      <span className="text-slate-300">{getPlanTypeLabel(item.type)}</span>
                      <span className={`font-bold ${item.color}`}>{item.count}</span>
                    </div>
                  ))}
                </div>
              </EACardContent>
            </EACard>
          </div>
        </div>

        {/* Plan Detail Modal */}
        {selectedPlan && (
          <PlanDetailModal
            plan={selectedPlan}
            onClose={() => setSelectedPlan(null)}
            onUpdate={loadDashboard}
          />
        )}
      </div>
    </EAPageLayout>
  );
};

// Plan Detail Modal
interface PlanDetailModalProps {
  plan: CarePlan;
  onClose: () => void;
  onUpdate: () => void;
}

const PlanDetailModal: React.FC<PlanDetailModalProps> = ({ plan, onClose, onUpdate }) => {
  const getPriorityColor = (priority: string): 'critical' | 'high' | 'elevated' | 'normal' => {
    switch (priority) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'elevated';
      default: return 'normal';
    }
  };

  const handleCompletePlan = async () => {
    try {
      await CareCoordinationService.completeCarePlan(plan.id!, 'Plan completed successfully');
      onUpdate();
      onClose();
    } catch {
      // Handle error
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto border border-slate-700">
        {/* Header */}
        <div className="p-6 border-b border-slate-700 flex justify-between items-center sticky top-0 bg-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white">{plan.title}</h2>
            <div className="flex items-center space-x-2 mt-1">
              <EABadge variant={getPriorityColor(plan.priority)} size="sm">
                {plan.priority} priority
              </EABadge>
              <span className="text-slate-400">|</span>
              <span className="text-sm text-slate-400">{plan.status}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-2xl"
          >
            &times;
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Goals */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Goals</h3>
            {plan.goals && plan.goals.length > 0 ? (
              <div className="space-y-3">
                {plan.goals.map((goal, idx) => (
                  <div key={idx} className="bg-slate-700/50 p-4 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-white">{goal.goal}</p>
                        <p className="text-sm text-slate-400 mt-1">
                          Target: {goal.target} | Timeframe: {goal.timeframe}
                        </p>
                      </div>
                      <EABadge
                        variant={
                          goal.status === 'achieved'
                            ? 'normal'
                            : goal.status === 'in_progress'
                            ? 'info'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        {goal.status || 'not_started'}
                      </EABadge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400">No goals defined</p>
            )}
          </div>

          {/* Interventions */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Interventions</h3>
            {plan.interventions && plan.interventions.length > 0 ? (
              <div className="space-y-3">
                {plan.interventions.map((intervention, idx) => (
                  <div key={idx} className="bg-slate-700/50 p-4 rounded-lg">
                    <p className="font-medium text-white">{intervention.intervention}</p>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-slate-400">
                      <span>Frequency: {intervention.frequency}</span>
                      <span>|</span>
                      <span>Responsible: {intervention.responsible}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400">No interventions defined</p>
            )}
          </div>

          {/* Barriers */}
          {plan.barriers && plan.barriers.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Barriers & Solutions</h3>
              <div className="space-y-3">
                {plan.barriers.map((barrier, idx) => (
                  <div key={idx} className="bg-slate-700/50 p-4 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <XCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-white">{barrier.barrier}</p>
                        <p className="text-sm text-green-400 mt-1">Solution: {barrier.solution}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Care Team */}
          {plan.care_team_members && plan.care_team_members.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Care Team</h3>
              <div className="grid grid-cols-2 gap-3">
                {plan.care_team_members.map((member, idx) => (
                  <div key={idx} className="bg-slate-700/50 p-3 rounded-lg flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-full bg-teal-500/20 flex items-center justify-center">
                      <Users className="h-5 w-5 text-teal-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{member.name}</p>
                      <p className="text-xs text-slate-400">{member.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-3 pt-4 border-t border-slate-700">
            <EAButton variant="primary" className="flex-1">
              Update Plan
            </EAButton>
            <EAButton variant="secondary" className="flex-1">
              Add Note
            </EAButton>
            <EAButton variant="accent" className="flex-1" onClick={handleCompletePlan}>
              Complete Plan
            </EAButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CareCoordinationDashboard;
