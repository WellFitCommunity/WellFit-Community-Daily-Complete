// ============================================================================
// Physician Wellness Hub - Burnout Prevention Dashboard
// ============================================================================
// Purpose: At-a-glance burnout risk, stress trends, quick actions for physicians
// Features: Risk badge, check-in prompt, wellness modules, achievement badges
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useUser } from '../../contexts/AuthContext';
import { getDashboardStats, getMyCheckins } from '../../services/resilienceHubService';
import type {
  ResilienceHubDashboardStats,
  BurnoutRiskLevel,
  ProviderDailyCheckin,
} from '../../types/nurseos';
import PhysicianDailyCheckin from './PhysicianDailyCheckin';
import BurnoutAssessmentForm from '../nurseos/BurnoutAssessmentForm';
import ResilienceLibrary from '../nurseos/ResilienceLibrary';
import ResourceLibrary from '../nurseos/ResourceLibrary';
import { PhysicianCelebrationModal } from './PhysicianCelebrationModal';
import type { PhysicianAchievementType } from './PhysicianCelebrationModal';

export const PhysicianWellnessHub: React.FC = () => {
  const user = useUser();

  const [stats, setStats] = useState<ResilienceHubDashboardStats | null>(null);
  const [recentCheckins, setRecentCheckins] = useState<ProviderDailyCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [showBurnoutAssessment, setShowBurnoutAssessment] = useState(false);
  const [showModuleLibrary, setShowModuleLibrary] = useState(false);
  const [showResourceLibrary, setShowResourceLibrary] = useState(false);

  // Celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{
    type: PhysicianAchievementType;
    details?: string;
    value?: number;
  } | null>(null);

  // Load dashboard data
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [dashboardStats, checkins] = await Promise.all([
        getDashboardStats(),
        getMyCheckins(
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          new Date().toISOString()
        ),
      ]);

      setStats(dashboardStats);
      setRecentCheckins(checkins);
    } catch (err) {

      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  // Get risk badge color
  const getRiskBadgeColor = (risk: BurnoutRiskLevel): string => {
    switch (risk) {
      case 'critical':
        return 'bg-red-600 text-white';
      case 'high':
        return 'bg-orange-500 text-white';
      case 'moderate':
        return 'bg-yellow-500 text-gray-900';
      case 'low':
        return 'bg-green-500 text-white';
      default:
        return 'bg-gray-400 text-white';
    }
  };

  // Get stress trend icon
  const getStressTrendIcon = (trend: string): string => {
    switch (trend) {
      case 'improving':
        return '📉 Improving';
      case 'worsening':
        return '📈 Increasing';
      default:
        return '➡️ Stable';
    }
  };

  // Handle successful check-in
  const handleCheckinSuccess = () => {
    setShowCheckinModal(false);
    loadDashboardData();

    // Show celebration
    setCelebrationData({
      type: 'daily_checkin',
      details: 'Daily wellness check complete!',
    });
    setShowCelebration(true);
  };

  if (loading) {
    return (
      <div className="physician-wellness-hub p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-32 bg-gray-200 rounded mb-4"></div>
        <div className="h-48 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="physician-wellness-hub p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Failed to load Wellness Hub</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={loadDashboardData}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const riskLabels = {
    unknown: 'Not Assessed',
    low: 'Low Risk',
    moderate: 'Moderate Risk',
    high: 'High Risk',
    critical: 'Critical Risk',
  };

  const riskMessages = {
    unknown: 'Take a burnout assessment to get your risk level.',
    low: 'Great! Keep up the self-care practices.',
    moderate: 'Consider increasing self-care activities.',
    high: 'High stress detected. Please prioritize self-care.',
    critical: '⚠️ Critical level. Please reach out for support immediately.',
  };

  return (
    <div className="physician-wellness-hub">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-1">
          🩺 Physician Wellness Hub
        </h2>
        <p className="text-gray-600">
          Your wellness checkpoint — because healing starts with the healer.
        </p>
      </div>

      {/* Burnout Risk Badge */}
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            <span
              className={`inline-block px-6 py-3 rounded-full text-lg font-bold uppercase tracking-wide ${getRiskBadgeColor(
                stats.current_burnout_risk
              )}`}
            >
              {riskLabels[stats.current_burnout_risk as keyof typeof riskLabels] || riskLabels.unknown}
            </span>
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-2">
              {riskMessages[stats.current_burnout_risk as keyof typeof riskMessages] || riskMessages.unknown}
            </p>
            {stats.current_burnout_risk === 'unknown' && (
              <button
                onClick={() => setShowBurnoutAssessment(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
              >
                Take Assessment Now (5 min)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Intervention Alert */}
      {stats.intervention_needed && (
        <div className="mb-6 bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0 text-2xl mr-3">⚠️</div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-orange-900 mb-1">
                Wellness Check Recommended
              </h3>
              <p className="text-orange-800 mb-3">
                Your recent stress levels suggest you may benefit from additional support.
              </p>
              <div className="flex gap-3">
                <a
                  href="tel:988"
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
                >
                  Call 988 Lifeline
                </a>
                <button
                  onClick={() => setShowResourceLibrary(true)}
                  className="px-4 py-2 border border-orange-600 text-orange-700 rounded-lg hover:bg-orange-50 font-medium"
                >
                  View Resources
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daily Check-In Prompt */}
      {!stats.has_checked_in_today && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-900 mb-1">
                Haven't checked in today?
              </h3>
              <p className="text-blue-700">
                Take 60 seconds to log how you're feeling. It helps track your wellness trends.
              </p>
            </div>
            <button
              onClick={() => setShowCheckinModal(true)}
              className="ml-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-md hover:shadow-lg transition-shadow"
            >
              Quick Check-In
            </button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Stress Trend */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="text-sm font-medium text-gray-600 mb-2">
            Stress Trend (7 days)
          </h4>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-800">
              {stats.avg_stress_7_days ? stats.avg_stress_7_days.toFixed(1) : 'N/A'}
            </span>
            <span className="text-lg text-gray-500">/10</span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {getStressTrendIcon(stats.stress_trend)}
          </p>
        </div>

        {/* Modules Completed */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="text-sm font-medium text-gray-600 mb-2">
            Wellness Modules
          </h4>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-green-600">
              {stats.modules_completed}
            </span>
            <span className="text-lg text-gray-500">completed</span>
          </div>
          {stats.modules_in_progress > 0 && (
            <p className="text-sm text-gray-600 mt-1">
              {stats.modules_in_progress} in progress
            </p>
          )}
        </div>

        {/* Support Circles */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="text-sm font-medium text-gray-600 mb-2">
            Peer Support
          </h4>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-purple-600">
              {stats.my_support_circles}
            </span>
            <span className="text-lg text-gray-500">circles</span>
          </div>
          {stats.my_support_circles === 0 && (
            <p className="text-sm text-gray-600 mt-1">Not in any circles yet</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <button
            onClick={() => setShowCheckinModal(true)}
            className="px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
          >
            <div className="text-2xl mb-1">📝</div>
            <div className="font-medium text-gray-800">Daily Check-In</div>
            <div className="text-xs text-gray-600">Log your wellness</div>
          </button>

          <button
            onClick={() => setShowBurnoutAssessment(true)}
            className="px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
          >
            <div className="text-2xl mb-1">🔍</div>
            <div className="font-medium text-gray-800">Burnout Assessment</div>
            <div className="text-xs text-gray-600">MBI questionnaire</div>
          </button>

          <button
            onClick={() => alert('Coming Soon: 30-day wellness trends with interactive charts')}
            className="px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
          >
            <div className="text-2xl mb-1">📊</div>
            <div className="font-medium text-gray-800">View Trends</div>
            <div className="text-xs text-gray-600">30-day overview</div>
          </button>

          <button
            onClick={() => setShowModuleLibrary(true)}
            className="px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
          >
            <div className="text-2xl mb-1">🎓</div>
            <div className="font-medium text-gray-800">Wellness Modules</div>
            <div className="text-xs text-gray-600">Evidence-based</div>
          </button>

          <button
            onClick={() => setShowResourceLibrary(true)}
            className="px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
          >
            <div className="text-2xl mb-1">📚</div>
            <div className="font-medium text-gray-800">Resource Library</div>
            <div className="text-xs text-gray-600">Apps, articles, hotlines</div>
          </button>
        </div>
      </div>

      {/* Recent Check-Ins Preview */}
      {recentCheckins.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Recent Check-Ins (Last 7 Days)
          </h3>
          <div className="space-y-2">
            {recentCheckins.slice(0, 7).map((checkin) => (
              <div
                key={checkin.id}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {checkin.stress_level >= 7 ? '🔴' : checkin.stress_level >= 5 ? '🟡' : '🟢'}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-gray-800">
                      {new Date(checkin.checkin_date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                    <div className="text-xs text-gray-600">
                      Stress: {checkin.stress_level}/10 | Energy: {checkin.energy_level}/10 | Mood: {checkin.mood_rating}/10
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showCheckinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <PhysicianDailyCheckin
            onSuccess={handleCheckinSuccess}
            onClose={() => setShowCheckinModal(false)}
          />
        </div>
      )}

      {showBurnoutAssessment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <BurnoutAssessmentForm
            onSuccess={() => {
              setShowBurnoutAssessment(false);
              loadDashboardData();
            }}
            onClose={() => setShowBurnoutAssessment(false)}
          />
        </div>
      )}

      {showModuleLibrary && (
        <ResilienceLibrary onClose={() => setShowModuleLibrary(false)} />
      )}

      {showResourceLibrary && (
        <ResourceLibrary onClose={() => setShowResourceLibrary(false)} />
      )}

      {/* Celebration Modal */}
      {showCelebration && celebrationData && (
        <PhysicianCelebrationModal
          achievementType={celebrationData.type}
          achievementDetails={celebrationData.details}
          metricValue={celebrationData.value}
          onClose={() => {
            setShowCelebration(false);
            setCelebrationData(null);
          }}
        />
      )}
    </div>
  );
};

export default PhysicianWellnessHub;
