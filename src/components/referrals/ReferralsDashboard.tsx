// Referrals Dashboard - External Referral Management System
// Dashboard for managing hospital referrals to WellFit Community
// Supports: referral tracking, engagement reports, alerts
// White-label ready - uses Envision Atlus design system

import React, { useEffect, useState, useCallback } from 'react';
import {
  Building2,
  Users,
  FileText,
  AlertTriangle,
  Bell,
  TrendingUp,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  ExternalLink,
  Mail,
} from 'lucide-react';
import { useSupabaseClient } from '../../contexts/AuthContext';
import { usePatientContext, SelectedPatient } from '../../contexts/PatientContext';
import { useKeyboardShortcutsContextSafe } from '../envision-atlus/EAKeyboardShortcutsProvider';
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

// Types for referral system
interface ReferralSource {
  id: string;
  organization_name: string;
  organization_type: 'hospital' | 'clinic' | 'community_org' | 'physician_office';
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  subscription_tier: 'basic' | 'standard' | 'premium' | 'enterprise';
  active: boolean;
  created_at: string;
}

interface PatientReferral {
  id: string;
  source_id: string;
  source_name?: string;
  patient_phone: string;
  patient_first_name: string;
  patient_last_name: string;
  referral_reason: string;
  priority: 'routine' | 'urgent' | 'emergency';
  status: 'pending' | 'accepted' | 'linked' | 'active' | 'completed' | 'declined';
  linked_user_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface ReferralAlert {
  id: string;
  referral_id: string;
  patient_name: string;
  alert_type: 'missed_checkin' | 'mood_decline' | 'sdoh_flag' | 'engagement_drop' | 'health_concern';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  created_at: string;
  acknowledged: boolean;
}

interface DashboardMetrics {
  totalReferralSources: number;
  activeSources: number;
  pendingReferrals: number;
  activePatients: number;
  alertsToday: number;
  engagementRate: number;
}

// Database row type for patient referrals with joined source data
interface PatientReferralRow extends PatientReferral {
  external_referral_sources?: {
    organization_name: string;
  } | null;
}

export const ReferralsDashboard: React.FC = () => {
  const supabase = useSupabaseClient();
  const { selectPatient } = usePatientContext();
  const keyboardShortcuts = useKeyboardShortcutsContextSafe();

  // ATLUS: Technology - Filter state synced with keyboard shortcuts (Shift+H/C/A)
  const [priorityFilter, setPriorityFilter] = useState<'high' | 'critical' | 'all'>('all');

  // ATLUS: Technology - Sync filter with keyboard shortcuts
  useEffect(() => {
    if (keyboardShortcuts?.currentFilter) {
      setPriorityFilter(keyboardShortcuts.currentFilter);
    }
  }, [keyboardShortcuts?.currentFilter]);

  // Filter referrals based on priority filter
  const getFilteredReferrals = useCallback((referrals: PatientReferral[]) => {
    if (priorityFilter === 'all') return referrals;
    if (priorityFilter === 'critical') {
      return referrals.filter(r => r.priority === 'emergency');
    }
    if (priorityFilter === 'high') {
      return referrals.filter(r => r.priority === 'emergency' || r.priority === 'urgent');
    }
    return referrals;
  }, [priorityFilter]);

  /**
   * Handle patient selection - sets PatientContext for cross-dashboard persistence
   * ATLUS: Unity - Patient context persists when navigating between dashboards
   */
  const handlePatientSelect = useCallback((referral: PatientReferral) => {
    // Map priority to risk level
    const riskLevel = referral.priority === 'emergency' ? 'critical'
      : referral.priority === 'urgent' ? 'high'
      : 'low' as const;

    const selectedPatient: SelectedPatient = {
      id: referral.linked_user_id || referral.id, // Use linked user ID if available, else referral ID
      firstName: referral.patient_first_name,
      lastName: referral.patient_last_name,
      riskLevel,
      snapshot: {
        primaryDiagnosis: referral.referral_reason,
        unit: 'Referrals',
      },
    };

    selectPatient(selectedPatient);
  }, [selectPatient]);

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [referralSources, setReferralSources] = useState<ReferralSource[]>([]);
  const [pendingReferrals, setPendingReferrals] = useState<PatientReferral[]>([]);
  const [activeReferrals, setActiveReferrals] = useState<PatientReferral[]>([]);
  const [alerts, setAlerts] = useState<ReferralAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [_selectedSource, setSelectedSource] = useState<ReferralSource | null>(null);

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
      // Load referral sources
      const { data: sources, error: sourcesError } = await supabase
        .from('external_referral_sources')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (sourcesError) throw sourcesError;
      setReferralSources(sources || []);

      // Load pending referrals
      const { data: pending, error: pendingError } = await supabase
        .from('patient_referrals')
        .select(`
          *,
          external_referral_sources(organization_name)
        `)
        .in('status', ['pending', 'accepted'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (pendingError) throw pendingError;
      const formattedPending = (pending || []).map((r: PatientReferralRow) => ({
        ...r,
        source_name: r.external_referral_sources?.organization_name,
      }));
      setPendingReferrals(formattedPending);

      // Load active referrals
      const { data: active, error: activeError } = await supabase
        .from('patient_referrals')
        .select(`
          *,
          external_referral_sources(organization_name)
        `)
        .in('status', ['linked', 'active'])
        .order('updated_at', { ascending: false })
        .limit(50);

      if (activeError) throw activeError;
      const formattedActive = (active || []).map((r: PatientReferralRow) => ({
        ...r,
        source_name: r.external_referral_sources?.organization_name,
      }));
      setActiveReferrals(formattedActive);

      // Load referral alerts
      const { data: alertsData, error: alertsError } = await supabase
        .from('referral_alerts')
        .select('*')
        .eq('acknowledged', false)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!alertsError && alertsData) {
        setAlerts(alertsData);
      }

      // Calculate metrics
      const activeSources = (sources || []).filter((s: ReferralSource) => s.active).length;

      setMetrics({
        totalReferralSources: (sources || []).length,
        activeSources,
        pendingReferrals: formattedPending.length,
        activePatients: formattedActive.length,
        alertsToday: (alertsData || []).length,
        engagementRate: 78, // Would be calculated from engagement data
      });
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptReferral = async (referralId: string) => {
    try {
      await supabase
        .from('patient_referrals')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', referralId);
      loadDashboard();
    } catch {
      // Handle error
    }
  };

  const handleDeclineReferral = async (referralId: string) => {
    try {
      await supabase
        .from('patient_referrals')
        .update({ status: 'declined', updated_at: new Date().toISOString() })
        .eq('id', referralId);
      loadDashboard();
    } catch {
      // Handle error
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await supabase
        .from('referral_alerts')
        .update({ acknowledged: true })
        .eq('id', alertId);
      setAlerts(alerts.filter(a => a.id !== alertId));
    } catch {
      // Handle error
    }
  };

  const getStatusBadgeVariant = (status: string): 'normal' | 'elevated' | 'high' | 'critical' | 'info' | 'neutral' => {
    switch (status) {
      case 'active': return 'normal';
      case 'linked': return 'info';
      case 'pending': return 'elevated';
      case 'completed': return 'normal';
      case 'declined': return 'neutral';
      default: return 'neutral';
    }
  };

  const getPriorityBadgeVariant = (priority: string): 'normal' | 'elevated' | 'high' | 'critical' => {
    switch (priority) {
      case 'emergency': return 'critical';
      case 'urgent': return 'high';
      default: return 'normal';
    }
  };

  const getAlertSeverityVariant = (severity: string): 'normal' | 'elevated' | 'high' | 'critical' => {
    switch (severity) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'elevated';
      default: return 'normal';
    }
  };

  const getTierLabel = (tier: string): string => {
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  };

  if (loading && !metrics) {
    return (
      <EAPageLayout title="Referrals Dashboard">
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
        </div>
      </EAPageLayout>
    );
  }

  if (error) {
    return (
      <EAPageLayout title="Referrals Dashboard">
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
    <EAPageLayout title="Referrals Dashboard" subtitle="External Referral Management & Engagement Tracking">
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">Referrals Dashboard</h1>
            <p className="text-slate-400">External Referral Management & Engagement Tracking</p>
            {/* ATLUS: Technology - Filter indicator and controls (Shift+H/C/A) */}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-slate-500 font-medium">Filter:</span>
              <button
                onClick={() => setPriorityFilter('all')}
                className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                  priorityFilter === 'all'
                    ? 'bg-teal-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                All (Shift+A)
              </button>
              <button
                onClick={() => setPriorityFilter('high')}
                className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                  priorityFilter === 'high'
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Urgent+ (Shift+H)
              </button>
              <button
                onClick={() => setPriorityFilter('critical')}
                className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                  priorityFilter === 'critical'
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Emergency (Shift+C)
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <EAButton onClick={loadDashboard} variant="secondary" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </EAButton>
            <EAButton variant="primary" size="sm">
              <Building2 className="h-4 w-4 mr-2" />
              Add Referral Source
            </EAButton>
          </div>
        </div>

        {/* Key Metrics */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <EAMetricCard
              label="Referral Sources"
              value={metrics.totalReferralSources}
              icon={<Building2 className="h-5 w-5" />}
            />
            <EAMetricCard
              label="Active Sources"
              value={metrics.activeSources}
              icon={<CheckCircle className="h-5 w-5" />}
            />
            <EAMetricCard
              label="Pending Referrals"
              value={metrics.pendingReferrals}
              icon={<Clock className="h-5 w-5" />}
              riskLevel={metrics.pendingReferrals > 10 ? 'elevated' : 'normal'}
            />
            <EAMetricCard
              label="Active Patients"
              value={metrics.activePatients}
              icon={<Users className="h-5 w-5" />}
            />
            <EAMetricCard
              label="Alerts Today"
              value={metrics.alertsToday}
              icon={<Bell className="h-5 w-5" />}
              riskLevel={metrics.alertsToday > 5 ? 'high' : 'normal'}
            />
            <EAMetricCard
              label="Engagement Rate"
              value={`${metrics.engagementRate}%`}
              icon={<TrendingUp className="h-5 w-5" />}
              trend={{ value: 5, direction: 'up' }}
            />
          </div>
        )}

        {/* Alerts Section */}
        {alerts.length > 0 && (
          <EACard>
            <EACardHeader>
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white flex items-center">
                  <Bell className="h-5 w-5 mr-2 text-orange-500" />
                  Referral Alerts
                </h2>
                <EABadge variant="elevated">{alerts.length} alerts</EABadge>
              </div>
            </EACardHeader>
            <EACardContent>
              <div className="space-y-3">
                {alerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg border-l-4 ${
                      alert.severity === 'critical'
                        ? 'border-red-500 bg-red-500/10'
                        : alert.severity === 'high'
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-yellow-500 bg-yellow-500/10'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium text-white">{alert.patient_name}</h3>
                          <EABadge variant={getAlertSeverityVariant(alert.severity)} size="sm">
                            {alert.severity}
                          </EABadge>
                        </div>
                        <p className="text-sm text-slate-400 mt-1">{alert.message}</p>
                        <span className="text-xs text-slate-500 mt-2 inline-block">
                          {alert.alert_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <EAButton
                        size="sm"
                        variant="secondary"
                        onClick={() => handleAcknowledgeAlert(alert.id)}
                      >
                        Acknowledge
                      </EAButton>
                    </div>
                  </div>
                ))}
              </div>
            </EACardContent>
          </EACard>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending Referrals */}
          <EACard>
            <EACardHeader>
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white">Pending Referrals</h2>
                <EABadge variant="info">{pendingReferrals.length}</EABadge>
              </div>
            </EACardHeader>
            <EACardContent>
              {pendingReferrals.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50 text-green-500" />
                  <p>No pending referrals</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {getFilteredReferrals(pendingReferrals).slice(0, 5).map((referral) => (
                    <div
                      key={referral.id}
                      className="p-4 bg-slate-700/50 rounded-lg"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <button
                              className="font-medium text-white hover:text-teal-400 transition-colors"
                              onClick={() => handlePatientSelect(referral)}
                            >
                              {referral.patient_first_name} {referral.patient_last_name}
                            </button>
                            <EABadge variant={getPriorityBadgeVariant(referral.priority)} size="sm">
                              {referral.priority}
                            </EABadge>
                          </div>
                          <p className="text-sm text-slate-400 mt-1">
                            From: {referral.source_name || 'Unknown'}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Reason: {referral.referral_reason}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <EAButton
                            size="sm"
                            variant="primary"
                            onClick={() => handleAcceptReferral(referral.id)}
                          >
                            Accept
                          </EAButton>
                          <EAButton
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeclineReferral(referral.id)}
                          >
                            <XCircle className="h-4 w-4" />
                          </EAButton>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </EACardContent>
          </EACard>

          {/* Active Referred Patients */}
          <EACard>
            <EACardHeader>
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white">Active Referred Patients</h2>
                <EABadge variant="normal">{activeReferrals.length}</EABadge>
              </div>
            </EACardHeader>
            <EACardContent>
              {activeReferrals.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No active referred patients</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {getFilteredReferrals(activeReferrals).slice(0, 5).map((referral) => (
                    <div
                      key={referral.id}
                      className="p-4 bg-slate-700/50 rounded-lg"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <button
                              className="font-medium text-white hover:text-teal-400 transition-colors"
                              onClick={() => handlePatientSelect(referral)}
                            >
                              {referral.patient_first_name} {referral.patient_last_name}
                            </button>
                            <EABadge variant={getStatusBadgeVariant(referral.status)} size="sm">
                              {referral.status}
                            </EABadge>
                          </div>
                          <p className="text-sm text-slate-400 mt-1">
                            Referred by: {referral.source_name || 'Unknown'}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Since: {new Date(referral.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <EAButton size="sm" variant="secondary">
                          <FileText className="h-4 w-4 mr-1" />
                          Report
                        </EAButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </EACardContent>
          </EACard>
        </div>

        {/* Referral Sources */}
        <EACard>
          <EACardHeader>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">Referral Sources</h2>
              <EAButton variant="secondary" size="sm">
                <Building2 className="h-4 w-4 mr-2" />
                Add Source
              </EAButton>
            </div>
          </EACardHeader>
          <EACardContent>
            {referralSources.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No referral sources configured</p>
                <p className="text-sm mt-1">Add hospitals and clinics to receive patient referrals</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Organization</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Contact</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Tier</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {referralSources.map((source) => (
                      <tr key={source.id} className="hover:bg-slate-700/50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{source.organization_name}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">
                          {source.organization_type.replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-white">{source.contact_name}</div>
                          <div className="text-xs text-slate-400 flex items-center mt-1">
                            <Mail className="h-3 w-3 mr-1" />
                            {source.contact_email}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <EABadge
                            variant={
                              source.subscription_tier === 'enterprise'
                                ? 'info'
                                : source.subscription_tier === 'premium'
                                ? 'normal'
                                : 'neutral'
                            }
                            size="sm"
                          >
                            {getTierLabel(source.subscription_tier)}
                          </EABadge>
                        </td>
                        <td className="px-4 py-3">
                          {source.active ? (
                            <span className="flex items-center text-green-400 text-sm">
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Active
                            </span>
                          ) : (
                            <span className="flex items-center text-slate-400 text-sm">
                              <XCircle className="h-4 w-4 mr-1" />
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <EAButton size="sm" variant="ghost" onClick={() => setSelectedSource(source)}>
                            <ExternalLink className="h-4 w-4" />
                          </EAButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </EACardContent>
        </EACard>
      </div>
    </EAPageLayout>
  );
};

export default ReferralsDashboard;
