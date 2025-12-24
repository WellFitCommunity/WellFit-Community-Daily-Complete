// ============================================================================
// Wellness Command Center - Unified Provider Wellness Dashboard
// ============================================================================
// Purpose: Single dashboard showing emotional state, documentation status,
//          resilience progress, and proactive intervention nudges
// Design: "Your Wellness Today" - makes the invisible visible
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ResilienceHubService } from '../../services/resilienceHubService';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../../services/auditLogger';
import type { ResilienceHubDashboardStats, BurnoutRiskLevel } from '../../types/nurseos';

// Sub-components
import { CompassionBattery } from './CompassionBattery';
import { DocumentationDebtVisualizer } from './DocumentationDebtVisualizer';
import { ProactiveNudge } from './ProactiveNudge';

interface WellnessCommandCenterProps {
  userName?: string;
  userRole?: string;
  showCompact?: boolean;
}

interface QuickAction {
  id: string;
  icon: string;
  label: string;
  description: string;
  action: () => void;
  highlight?: boolean;
}

export const WellnessCommandCenter: React.FC<WellnessCommandCenterProps> = ({
  userName,
  userRole,
  showCompact = false,
}) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<ResilienceHubDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayCheckin, setTodayCheckin] = useState<{
    stress_level: number;
    energy_level: number;
    mood_rating: number;
    compassion_fatigue_level?: number;
    missed_break?: boolean;
  } | null>(null);
  const [showNudge, setShowNudge] = useState(false);
  const [nudgeType, setNudgeType] = useState<'break' | 'stress' | 'intervention' | null>(null);

  // Fetch dashboard stats
  const loadStats = useCallback(async () => {
    if (!user) return;

    try {
      const dashboardStats = await ResilienceHubService.getDashboardStats();
      setStats(dashboardStats);

      // Check if intervention nudge should show
      if (dashboardStats.intervention_needed) {
        setNudgeType('intervention');
        setShowNudge(true);
      } else if (dashboardStats.avg_stress_7_days && dashboardStats.avg_stress_7_days > 7) {
        setNudgeType('stress');
        setShowNudge(true);
      }

      // Fetch today's check-in for mood display
      const today = new Date().toISOString().split('T')[0];
      const { data: checkins } = await supabase
        .from('provider_daily_checkins')
        .select('stress_level, energy_level, mood_rating, compassion_fatigue_level, missed_break')
        .eq('user_id', user.id)
        .eq('checkin_date', today)
        .maybeSingle();

      if (checkins) {
        setTodayCheckin(checkins);
      }
    } catch (error) {
      auditLogger.error('WELLNESS_COMMAND_CENTER_LOAD_FAILED', error instanceof Error ? error : new Error('Load failed'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Get risk badge color
  const getRiskBadgeStyle = (risk: BurnoutRiskLevel) => {
    switch (risk) {
      case 'low':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'moderate':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300 animate-pulse';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // Get mood emoji
  const getMoodEmoji = (rating: number) => {
    if (rating >= 8) return '😊';
    if (rating >= 6) return '🙂';
    if (rating >= 4) return '😐';
    if (rating >= 2) return '😔';
    return '😰';
  };

  // Get energy bar color
  const getEnergyColor = (level: number) => {
    if (level >= 7) return 'bg-green-500';
    if (level >= 4) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Quick actions
  const quickActions: QuickAction[] = [
    {
      id: 'checkin',
      icon: '📝',
      label: 'Daily Check-in',
      description: stats?.has_checked_in_today ? 'Done today!' : 'How are you?',
      action: () => window.location.href = '/resilience/checkin',
      highlight: !stats?.has_checked_in_today,
    },
    {
      id: 'scribe',
      icon: '🧭',
      label: 'Riley Scribe',
      description: 'Start recording',
      action: () => window.location.href = '/smart-scribe',
    },
    {
      id: 'breathe',
      icon: '🧘',
      label: '5-Min Break',
      description: 'Guided breathing',
      action: () => window.location.href = '/resilience/modules?category=mindfulness',
    },
    {
      id: 'circle',
      icon: '👥',
      label: 'Peer Circle',
      description: `${stats?.my_support_circles || 0} circles`,
      action: () => window.location.href = '/resilience/circles',
    },
  ];

  if (loading) {
    return (
      <div className="bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-6 shadow-lg border-2 border-blue-200 animate-pulse">
        <div className="h-8 bg-blue-200 rounded-sm w-48 mb-4"></div>
        <div className="grid grid-cols-3 gap-4">
          <div className="h-24 bg-blue-200 rounded-xl"></div>
          <div className="h-24 bg-blue-200 rounded-xl"></div>
          <div className="h-24 bg-blue-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  // Compact view for sidebar/widget
  if (showCompact) {
    return (
      <div className="bg-linear-to-br from-blue-50 to-indigo-50 rounded-xl p-4 shadow-md border border-blue-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-900">Your Wellness</h3>
          {stats && (
            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getRiskBadgeStyle(stats.current_burnout_risk)}`}>
              {stats.current_burnout_risk === 'unknown' ? 'Check in!' : stats.current_burnout_risk}
            </span>
          )}
        </div>

        {todayCheckin ? (
          <div className="flex items-center gap-4 text-sm">
            <span>{getMoodEmoji(todayCheckin.mood_rating)} Mood: {todayCheckin.mood_rating}/10</span>
            <span>Stress: {todayCheckin.stress_level}/10</span>
          </div>
        ) : (
          <p className="text-sm text-blue-700">
            <button onClick={() => window.location.href = '/resilience/checkin'} className="underline hover:no-underline">
              Start your check-in
            </button>
          </p>
        )}

        {stats && stats.check_in_streak_days > 0 && (
          <div className="mt-2 text-xs text-orange-600 font-medium">
            🔥 {stats.check_in_streak_days} day streak!
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-6 shadow-xl border-2 border-blue-200">
      {/* Proactive Nudge Modal */}
      {showNudge && nudgeType && (
        <ProactiveNudge
          type={nudgeType}
          onDismiss={() => setShowNudge(false)}
          onAction={() => {
            setShowNudge(false);
            if (nudgeType === 'intervention') {
              window.location.href = '/resilience/support';
            } else if (nudgeType === 'stress') {
              window.location.href = '/resilience/modules?category=stress_management';
            }
          }}
          stats={stats}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Your Wellness Today
          </h2>
          <p className="text-sm text-gray-600">
            {userName ? `Hey ${userName}!` : 'Welcome back!'} Let's check in.
          </p>
        </div>

        {/* Risk Badge */}
        {stats && (
          <div className={`px-4 py-2 rounded-full border-2 font-semibold ${getRiskBadgeStyle(stats.current_burnout_risk)}`}>
            {stats.current_burnout_risk === 'unknown' ? (
              <span>📋 Take Assessment</span>
            ) : stats.current_burnout_risk === 'low' ? (
              <span>💚 Thriving</span>
            ) : stats.current_burnout_risk === 'moderate' ? (
              <span>💛 Monitor</span>
            ) : stats.current_burnout_risk === 'high' ? (
              <span>🧡 High Alert</span>
            ) : (
              <span>❤️ Get Support</span>
            )}
          </div>
        )}
      </div>

      {/* Today's Emotional State */}
      {todayCheckin ? (
        <div className="bg-white rounded-xl p-5 mb-6 border border-gray-200 shadow-xs">
          <div className="grid grid-cols-3 gap-6">
            {/* Mood */}
            <div className="text-center">
              <div className="text-4xl mb-2">{getMoodEmoji(todayCheckin.mood_rating)}</div>
              <div className="text-sm text-gray-600">Mood</div>
              <div className="text-lg font-bold text-gray-900">{todayCheckin.mood_rating}/10</div>
            </div>

            {/* Energy */}
            <div className="text-center">
              <div className="text-4xl mb-2">⚡</div>
              <div className="text-sm text-gray-600">Energy</div>
              <div className="flex items-center justify-center gap-1 mt-1">
                {[...Array(10)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-4 rounded-xs ${
                      i < todayCheckin.energy_level ? getEnergyColor(todayCheckin.energy_level) : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Stress */}
            <div className="text-center">
              <div className="text-4xl mb-2">😰</div>
              <div className="text-sm text-gray-600">Stress</div>
              <div className="text-lg font-bold text-gray-900">{todayCheckin.stress_level}/10</div>
            </div>
          </div>

          {/* Streak */}
          {stats && stats.check_in_streak_days > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-center gap-2">
              <span className="text-orange-500 text-xl">🔥</span>
              <span className="font-bold text-gray-900">{stats.check_in_streak_days} day streak!</span>
              <span className="text-sm text-gray-600">Keep it going!</span>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl p-6 mb-6 border-2 border-dashed border-blue-300 text-center">
          <div className="text-4xl mb-3">📝</div>
          <h3 className="font-bold text-gray-900 mb-2">How are you feeling today?</h3>
          <p className="text-sm text-gray-600 mb-4">
            A quick 2-minute check-in helps you track your wellbeing over time.
          </p>
          <button
            onClick={() => window.location.href = '/resilience/checkin'}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all"
          >
            Start Check-in
          </button>
        </div>
      )}

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {quickActions.map((action) => (
          <button
            key={action.id}
            onClick={action.action}
            className={`p-4 rounded-xl border-2 transition-all hover:shadow-md ${
              action.highlight
                ? 'bg-blue-100 border-blue-400 hover:border-blue-500'
                : 'bg-white border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="text-2xl mb-2">{action.icon}</div>
            <div className="font-semibold text-gray-900 text-sm">{action.label}</div>
            <div className="text-xs text-gray-600">{action.description}</div>
          </button>
        ))}
      </div>

      {/* Compassion Battery & Documentation Debt */}
      <div className="grid grid-cols-2 gap-4">
        <CompassionBattery
          level={todayCheckin?.compassion_fatigue_level ? 10 - todayCheckin.compassion_fatigue_level : 7}
          missedBreak={todayCheckin?.missed_break}
        />
        <DocumentationDebtVisualizer userId={user?.id} />
      </div>

      {/* Resilience Progress */}
      {stats && (stats.modules_completed > 0 || stats.modules_in_progress > 0) && (
        <div className="mt-6 bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-gray-900">Resilience Training</h4>
              <p className="text-sm text-gray-600">
                {stats.modules_completed} completed · {stats.modules_in_progress} in progress
              </p>
            </div>
            <button
              onClick={() => window.location.href = '/resilience/modules'}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-all"
            >
              Continue Learning
            </button>
          </div>
        </div>
      )}

      {/* Stress Trend */}
      {stats && stats.avg_stress_7_days && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-gray-600">7-day stress trend:</span>
          <span className={`font-semibold ${
            stats.stress_trend === 'improving' ? 'text-green-600' :
            stats.stress_trend === 'worsening' ? 'text-red-600' : 'text-gray-600'
          }`}>
            {stats.stress_trend === 'improving' && '↓ Improving'}
            {stats.stress_trend === 'worsening' && '↑ Rising'}
            {stats.stress_trend === 'stable' && '→ Stable'}
            {' '}({stats.avg_stress_7_days.toFixed(1)} avg)
          </span>
        </div>
      )}
    </div>
  );
};

export default WellnessCommandCenter;
