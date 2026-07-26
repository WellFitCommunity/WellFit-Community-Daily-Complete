/**
 * CHW Dashboard Page
 *
 * Unified command center for Community Health Workers.
 * Connects WellFit Community engagement with clinical care,
 * reducing hospital readmissions through community touchpoints.
 *
 * Key workflows:
 * - Field vitals capture during home/community visits
 * - SDOH (Social Determinants of Health) assessments
 * - Medication photo reconciliation
 * - Telehealth appointment facilitation
 * - Kiosk monitoring for community locations
 *
 * This dashboard shows the "bridge" between community and clinical care
 * that Methodist will see value in - reducing readmissions via CHW touchpoints.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../lib/supabaseClient';
import AdminHeader from '../components/admin/AdminHeader';
import RequireAdminAuth from '../components/auth/RequireAdminAuth';
import NurseQuestionManager from '../components/admin/NurseQuestionManager';
import RiskAssessmentManager from '../components/admin/RiskAssessmentManager';
import { chwService } from '../services/chwService';
import { auditLogger } from '../services/auditLogger';

interface CHWStats {
  totalVisitsToday: number;
  vitalsRecorded: number;
  sdohAssessments: number;
  pendingSync: number;
  openAlerts: number;
}

interface ScheduledVisit {
  id: string;
  patient_id: string;
  patient_name: string;
  visit_type: string;
  scheduled_at: string | null;
}

const CHWDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<CHWStats>({
    totalVisitsToday: 0,
    vitalsRecorded: 0,
    sdohAssessments: 0,
    pendingSync: 0,
    openAlerts: 0,
  });
  const [scheduledVisits, setScheduledVisits] = useState<ScheduledVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Online status tracking
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load stats — all counts are CHW-scoped (field_visits / specialist_* tables),
  // not proxies over unrelated community tables.
  const loadStats = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const [visitsRes, vitalsRes, sdohRes, alertsRes, syncStatus] = await Promise.all([
        supabase
          .from('field_visits')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', todayISO),
        supabase
          .from('field_visits')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', todayISO)
          .gte('current_step', 2),
        supabase
          .from('specialist_assessments')
          .select('id', { count: 'exact', head: true })
          .eq('assessment_type', 'SDOH_PRAPARE')
          .gte('created_at', todayISO),
        supabase
          .from('specialist_alerts')
          .select('id', { count: 'exact', head: true })
          .eq('resolved', false),
        chwService.getSyncStatus(),
      ]);

      const pending = syncStatus.pending;
      setStats({
        totalVisitsToday: visitsRes.count ?? 0,
        vitalsRecorded: vitalsRes.count ?? 0,
        sdohAssessments: sdohRes.count ?? 0,
        openAlerts: alertsRes.count ?? 0,
        pendingSync:
          pending.visits + pending.assessments + pending.photos + pending.alerts,
      });

      // Today's scheduled visits (real rows, not demo fixtures)
      const { data: visits, error: visitsError } = await supabase
        .from('field_visits')
        .select('id, patient_id, visit_type, scheduled_at')
        .eq('status', 'scheduled')
        .gte('scheduled_at', todayISO)
        .order('scheduled_at', { ascending: true })
        .limit(20);

      if (visitsError) throw new Error(visitsError.message);

      const patientIds = [...new Set((visits ?? []).map((v) => v.patient_id))];
      let nameByPatient = new Map<string, string>();
      if (patientIds.length > 0) {
        // Separate query rather than an embed: field_visits carries multiple
        // patient_id relationships, so PostgREST embedding is ambiguous.
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', patientIds);
        nameByPatient = new Map(
          (profiles ?? []).map((p) => [
            p.user_id,
            [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown patient',
          ])
        );
      }

      setScheduledVisits(
        (visits ?? []).map((v) => ({
          id: v.id,
          patient_id: v.patient_id,
          patient_name: nameByPatient.get(v.patient_id) ?? 'Unknown patient',
          visit_type: v.visit_type,
          scheduled_at: v.scheduled_at,
        }))
      );
    } catch (err: unknown) {
      await auditLogger.error(
        'CHW_DASHBOARD_STATS_LOAD_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { page: 'CHWDashboardPage' }
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const quickActions = [
    {
      id: 'vitals',
      title: 'Capture Vitals',
      description: 'Record BP, pulse, temp, O2, weight',
      icon: '💓',
      path: '/chw/vitals-capture',
      color: 'bg-red-500',
      hoverColor: 'hover:bg-red-600',
    },
    {
      id: 'sdoh',
      title: 'SDOH Assessment',
      description: 'Social determinants screening',
      icon: '📋',
      path: '/chw/sdoh-assessment',
      color: 'bg-purple-500',
      hoverColor: 'hover:bg-purple-600',
    },
    {
      id: 'medication',
      title: 'Medication Photo',
      description: 'Capture pill bottles for reconciliation',
      icon: '💊',
      path: '/chw/medication-photo',
      color: 'bg-blue-500',
      hoverColor: 'hover:bg-blue-600',
    },
    {
      id: 'telehealth',
      title: 'Telehealth Lobby',
      description: 'Help patient join virtual visit',
      icon: '📹',
      path: '/chw/telehealth-lobby',
      color: 'bg-green-500',
      hoverColor: 'hover:bg-green-600',
    },
    {
      id: 'telehealth-visits',
      title: "Today's Telehealth Visits",
      description: 'Start a scheduled video visit',
      icon: '🩺',
      path: '/provider/telehealth',
      color: 'bg-teal-500',
      hoverColor: 'hover:bg-teal-600',
    },
    {
      id: 'public-health',
      title: 'Public Health Reporting',
      description: 'Immunization registry, surveillance, eCR',
      icon: '🌐',
      path: '/public-health',
      color: 'bg-indigo-500',
      hoverColor: 'hover:bg-indigo-600',
    },
  ];

  return (
    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'nurse', 'community_health_worker', 'chw', 'case_manager']}>
      <div className="min-h-screen bg-gray-50">
        <AdminHeader title="CHW Command Center" showRiskAssessment={false} />

        {/* Connection Status Strip */}
        <div className="bg-slate-800 border-b border-slate-700 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                isOnline ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                <span className="font-medium">{isOnline ? 'Online' : 'Offline'}</span>
              </div>
              {stats.pendingSync > 0 && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-300 text-sm">
                  <span className="font-medium">{stats.pendingSync} pending sync</span>
                </div>
              )}
              <button
                onClick={() => navigate('/chw/kiosk-dashboard')}
                className="ml-auto px-3 py-1 bg-teal-600 hover:bg-teal-500 text-white text-sm rounded-lg transition-colors"
              >
                Kiosk Status
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4" />
              <p className="text-gray-500">Loading CHW Dashboard...</p>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            {/* Today's Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <span className="text-2xl">📊</span>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{stats.totalVisitsToday}</div>
                    <div className="text-sm text-gray-500">Visits Today</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/10 rounded-lg">
                    <span className="text-2xl">💓</span>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{stats.vitalsRecorded}</div>
                    <div className="text-sm text-gray-500">Vitals Captured</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <span className="text-2xl">📋</span>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{stats.sdohAssessments}</div>
                    <div className="text-sm text-gray-500">SDOH Screens</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-orange-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <span className="text-2xl">⚠️</span>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-600">{stats.openAlerts}</div>
                    <div className="text-sm text-gray-500">Open Alerts</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span>⚡</span> Quick Actions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {quickActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => navigate(action.path)}
                    className={`${action.color} ${action.hoverColor} text-white p-4 rounded-xl transition-all transform hover:scale-105 text-left`}
                  >
                    <div className="text-3xl mb-2">{action.icon}</div>
                    <div className="font-semibold">{action.title}</div>
                    <div className="text-sm opacity-90">{action.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Scheduled Visits */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span>📅</span> Today's Scheduled Visits
                </h2>
                <span className="text-sm text-gray-500">{scheduledVisits.length} scheduled</span>
              </div>
              <div className="space-y-3">
                {scheduledVisits.length === 0 && (
                  <p className="text-sm text-gray-500">No visits scheduled for today.</p>
                )}
                {scheduledVisits.map((visit) => (
                  <div
                    key={visit.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-600 font-medium">
                        {visit.patient_name
                          .split(' ')
                          .map((part) => part[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div>
                        <div className="text-gray-900 font-medium">{visit.patient_name}</div>
                        <div className="text-sm text-gray-500">{visit.visit_type}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-900">
                        {visit.scheduled_at
                          ? new Date(visit.scheduled_at).toLocaleTimeString([], {
                              hour: 'numeric',
                              minute: '2-digit',
                            })
                          : 'Unscheduled'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Patient Questions Manager - CHWs respond to member questions */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span>🤖</span> AI Patient Questions Manager
              </h2>
              <p className="text-gray-500 text-sm mb-4">
                Respond to community member questions with AI-assisted suggestions
              </p>
              <NurseQuestionManager />
            </div>

            {/* Risk Assessment Manager */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span>📋</span> Risk Assessment
              </h2>
              <p className="text-gray-500 text-sm mb-4">
                Complete and review patient risk assessments for care planning
              </p>
              <RiskAssessmentManager />
            </div>

            {/* Connection to WellFit */}
            <div className="bg-purple-50 rounded-xl border border-purple-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <span>🔗</span> WellFit Community Integration
                  </h2>
                  <p className="text-purple-700 text-sm mt-1">
                    CHW visits sync with WellFit app for continuous patient engagement
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate('/community-readmission')}
                    className="px-4 py-2 bg-[#003087] hover:bg-[#002266] text-white rounded-lg transition-colors border border-blue-400/30 flex items-center gap-2"
                  >
                    <span>❤️</span>
                    Readmission Prevention
                  </button>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
                  >
                    View Community Dashboard
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </RequireAdminAuth>
  );
};

export default CHWDashboardPage;
