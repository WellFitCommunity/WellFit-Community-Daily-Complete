import React, { useState, useEffect } from 'react';
import ERIncomingPatientBoard from '../components/ems/ERIncomingPatientBoard';
import AdminHeader from '../components/admin/AdminHeader';
import RequireAdminAuth from '../components/auth/RequireAdminAuth';
import { supabase } from '../lib/supabaseClient';

/**
 * ER Dashboard Page
 *
 * Emergency Room command center for physicians and providers.
 * Key features:
 * - Real-time EMS incoming patient board
 * - Provider sign-off workflow (MD/DO/PA/NP required)
 * - Coordinated response for critical cases
 * - Bed availability integration
 *
 * This is separate from NursePanel because:
 * - Physicians/providers must sign off on incoming patients
 * - Different workflow than nursing tasks
 * - ER-specific metrics and alerts
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */
const ERDashboardPage: React.FC = () => {
  const [hospitalName, setHospitalName] = useState('Emergency Department');
  const [stats, setStats] = useState({
    incomingPatients: 0,
    criticalIncoming: 0,
    awaitingSignoff: 0,
  });

  // Load hospital name from tenant via current auth session
  useEffect(() => {
    const loadHospitalInfo = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) return;
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('user_id', user.id)
          .single();

        if (profile?.tenant_id) {
          const { data: tenant } = await supabase
            .from('tenants')
            .select('name')
            .eq('id', profile.tenant_id)
            .single();
          if (tenant?.name) {
            setHospitalName(tenant.name);
          }
        }
      } catch {
        // Keep default
      }
    };
    loadHospitalInfo();
  }, []);

  // Load stats
  useEffect(() => {
    const loadStats = async () => {
      try {
        const { count: incomingCount } = await supabase
          .from('ems_handoffs')
          .select('id', { count: 'exact', head: true })
          .in('status', ['submitted', 'acknowledged', 'en_route']);

        const { count: criticalCount } = await supabase
          .from('ems_handoffs')
          .select('id', { count: 'exact', head: true })
          .in('status', ['submitted', 'acknowledged', 'en_route'])
          .or('is_stemi.eq.true,is_stroke.eq.true,is_trauma.eq.true,is_sepsis.eq.true');

        const { count: awaitingCount } = await supabase
          .from('ems_handoffs')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'arrived')
          .is('provider_signoff_at', null);

        setStats({
          incomingPatients: incomingCount || 0,
          criticalIncoming: criticalCount || 0,
          awaitingSignoff: awaitingCount || 0,
        });
      } catch {
        // Stats will show zeros
      }
    };
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'nurse', 'physician', 'nurse_practitioner', 'physician_assistant', 'clinical_supervisor', 'department_head']}>
      <div className="min-h-screen bg-gray-50">
        <AdminHeader title="ER Command Center" showRiskAssessment={false} />

        {/* ER Stats Strip */}
        <div className="bg-red-700 text-white border-b border-red-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🚑</span>
                <span className="text-sm text-red-200 font-medium">{hospitalName}</span>
              </div>
              <div className="flex items-center gap-8 ml-auto">
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats.incomingPatients}</div>
                  <div className="text-xs text-red-200">Incoming</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-300">{stats.criticalIncoming}</div>
                  <div className="text-xs text-red-200">Critical</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-300">{stats.awaitingSignoff}</div>
                  <div className="text-xs text-red-200">Need Sign-off</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Provider Sign-off Alert Banner */}
        {stats.awaitingSignoff > 0 && (
          <div className="bg-linear-to-r from-orange-500 to-red-500 text-white py-3 px-4">
            <div className="max-w-7xl mx-auto flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <span className="font-bold">{stats.awaitingSignoff} Patient(s) Awaiting Provider Sign-off</span>
                <span className="ml-2 text-orange-100">- Physician/PA/NP acceptance required</span>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Instructions Card */}
          <div className="mb-6 bg-blue-50 border-2 border-blue-200 rounded-xl p-6 shadow-xs">
            <div className="flex items-start gap-4">
              <div className="text-3xl">ℹ️</div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-blue-900 mb-2">
                  ER Charge Nurse Dashboard
                </h2>
                <div className="text-blue-800 space-y-2">
                  <p>
                    <strong>Purpose:</strong> Monitor all incoming patients from ambulances in real-time.
                    This view is designed for large displays in the ER charge nurse station.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <p className="font-semibold mb-1">🔴 Critical Alerts:</p>
                      <ul className="text-sm space-y-1 ml-4">
                        <li>• STEMI (Heart Attack) - Door-to-balloon &lt;90 min</li>
                        <li>• Stroke - Door-to-CT &lt;25 min, tPA &lt;60 min</li>
                        <li>• Trauma - Activate trauma team</li>
                        <li>• Sepsis - Early antibiotics critical</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-1">📋 Workflow:</p>
                      <ul className="text-sm space-y-1 ml-4">
                        <li>• Monitor incoming ambulances and ETAs</li>
                        <li>• Prepare team/bed based on chief complaint</li>
                        <li>• Activate alerts (STEMI, Stroke, Trauma)</li>
                        <li>• Complete handoff when patient arrives</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Incoming Patient Board */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-6">
            <ERIncomingPatientBoard hospitalName={hospitalName} />
          </div>
        </main>
      </div>
    </RequireAdminAuth>
  );
};

export default ERDashboardPage;
