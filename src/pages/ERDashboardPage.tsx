import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ERIncomingPatientBoard from '../components/ems/ERIncomingPatientBoard';
import { useUser } from '../contexts/AuthContext';
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
  const navigate = useNavigate();
  const user = useUser();
  const [hospitalName, setHospitalName] = useState('Emergency Department');
  const [isEditingHospital, setIsEditingHospital] = useState(false);
  const [stats, setStats] = useState({
    incomingPatients: 0,
    criticalIncoming: 0,
    awaitingSignoff: 0,
  });

  // Load hospital name from tenant
  useEffect(() => {
    const loadHospitalInfo = async () => {
      if (!user?.id) return;
      try {
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
  }, [user?.id]);

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-linear-to-r from-red-600 to-red-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-4xl">🚑</div>
              <div>
                <h1 className="text-2xl font-bold">ER Command Center</h1>
                <p className="text-red-100 text-sm">
                  {hospitalName} - Real-time EMS handoffs
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="hidden md:flex items-center gap-6">
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

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/community-readmission')}
                className="flex items-center gap-2 px-4 py-2 bg-[#003087] rounded-lg hover:bg-[#002266] transition-colors border border-blue-400/30"
                title="View Readmission Prevention Dashboard"
              >
                <span>❤️</span>
                <span className="font-medium">Readmission</span>
              </button>
              <button
                onClick={() => navigate('/bed-management')}
                className="flex items-center gap-2 px-4 py-2 bg-red-800 rounded-lg hover:bg-red-900 transition-colors"
              >
                <span>🛏️</span>
                <span className="font-medium">Beds</span>
              </button>
              {isEditingHospital ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={hospitalName}
                    onChange={(e) => setHospitalName(e.target.value)}
                    className="px-3 py-2 rounded-lg border-2 border-white text-gray-900 font-medium w-40"
                    placeholder="Hospital Name"
                  />
                  <button
                    onClick={() => setIsEditingHospital(false)}
                    className="px-3 py-2 bg-white text-red-600 rounded-lg font-medium hover:bg-red-50"
                  >
                    ✓
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditingHospital(true)}
                  className="p-2 bg-red-800 rounded-lg hover:bg-red-900 transition-colors"
                  title="Edit Hospital Name"
                >
                  ⚙️
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Provider Sign-off Alert Banner */}
      {stats.awaitingSignoff > 0 && (
        <div className="bg-linear-to-r from-orange-500 to-red-500 text-white py-3 px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <span className="font-bold">{stats.awaitingSignoff} Patient(s) Awaiting Provider Sign-off</span>
                <span className="ml-2 text-orange-100">- Physician/PA/NP acceptance required</span>
              </div>
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

      {/* Footer */}
      <footer className="mt-12 border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-6">
              <span>🔄 Auto-refreshes every 30 seconds</span>
              <span>📡 Real-time updates via WebSocket</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded-sm">
                SOC2 Compliant
              </span>
              <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded-sm">
                HIPAA Secure
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ERDashboardPage;
