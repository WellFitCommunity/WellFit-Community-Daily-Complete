// ============================================================================
// Proactive Intervention Nudges
// ============================================================================
// Purpose: Kindly interrupt providers when they need support
// Types: Break reminder, Stress intervention, Critical support
// Design: Non-judgmental, action-oriented, easy to dismiss
// ============================================================================

import React, { useState } from 'react';
import type { ResilienceHubDashboardStats } from '../../types/nurseos';

interface ProactiveNudgeProps {
  type: 'break' | 'stress' | 'intervention';
  onDismiss: () => void;
  onAction: () => void;
  stats?: ResilienceHubDashboardStats | null;
  hoursWithoutBreak?: number;
  patientsSeenToday?: number;
}

export const ProactiveNudge: React.FC<ProactiveNudgeProps> = ({
  type,
  onDismiss,
  onAction,
  stats,
  hoursWithoutBreak,
  patientsSeenToday,
}) => {
  const [snoozed, setSnoozed] = useState(false);

  if (snoozed) return null;

  // Break reminder nudge
  if (type === 'break') {
    return (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 animate-fadeIn">
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 max-w-md mx-4 shadow-2xl border-2 border-blue-300">
          <div className="text-center mb-4">
            <div className="text-5xl mb-3">☕</div>
            <h3 className="text-xl font-bold text-gray-900">Time for a Quick Break</h3>
          </div>

          <p className="text-gray-700 text-center mb-4">
            You've been going strong for {hoursWithoutBreak || 4}+ hours
            {patientsSeenToday && ` and seen ${patientsSeenToday} patients`}.
          </p>

          <div className="bg-white rounded-lg p-4 mb-4 border border-blue-200">
            <p className="text-sm text-gray-600 text-center">
              Your next appointment isn't for 12 minutes. That's enough time for:
            </p>
            <div className="flex justify-center gap-4 mt-3">
              <span className="text-2xl" title="Bathroom">🚽</span>
              <span className="text-2xl" title="Water">💧</span>
              <span className="text-2xl" title="Stretch">🧘</span>
              <span className="text-2xl" title="Fresh air">🌬️</span>
            </div>
          </div>

          <p className="text-sm text-blue-700 text-center mb-4 font-medium">
            Your patients need you at your best.
          </p>

          <div className="flex gap-3">
            <button
              onClick={onAction}
              className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-all"
            >
              Take 5 Minutes
            </button>
            <button
              onClick={() => {
                setSnoozed(true);
                setTimeout(onDismiss, 30 * 60 * 1000); // Snooze for 30 min
              }}
              className="flex-1 bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-300 transition-all"
            >
              Snooze 30m
            </button>
          </div>

          <button
            onClick={onDismiss}
            className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700"
          >
            I just took a break
          </button>
        </div>
      </div>
    );
  }

  // Stress intervention nudge
  if (type === 'stress') {
    return (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 animate-fadeIn">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 max-w-md mx-4 shadow-2xl border-2 border-amber-300">
          <div className="text-center mb-4">
            <div className="text-5xl mb-3">💛</div>
            <h3 className="text-xl font-bold text-gray-900">Checking In</h3>
          </div>

          <p className="text-gray-700 text-center mb-4">
            I notice your stress has been elevated this week
            {stats?.avg_stress_7_days && ` (averaging ${stats.avg_stress_7_days.toFixed(1)}/10)`}.
          </p>

          <div className="bg-white rounded-lg p-4 mb-4 border border-amber-200">
            <p className="text-sm text-gray-700 text-center">
              Would you like a 5-minute guided breathing exercise before your next patient?
            </p>
            <div className="text-center mt-3">
              <span className="text-3xl">🧘</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onAction}
              className="flex-1 bg-amber-500 text-white py-3 px-4 rounded-lg font-semibold hover:bg-amber-600 transition-all"
            >
              Yes, Show Me
            </button>
            <button
              onClick={onDismiss}
              className="flex-1 bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-300 transition-all"
            >
              Maybe Later
            </button>
          </div>

          <button
            onClick={onDismiss}
            className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700"
          >
            I'm managing okay
          </button>
        </div>
      </div>
    );
  }

  // Critical intervention nudge
  if (type === 'intervention') {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fadeIn">
        <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-2xl p-6 max-w-md mx-4 shadow-2xl border-2 border-red-300">
          <div className="text-center mb-4">
            <div className="text-5xl mb-3">❤️</div>
            <h3 className="text-xl font-bold text-gray-900">We're Here For You</h3>
          </div>

          <p className="text-gray-700 text-center mb-4">
            Based on your recent check-ins, you might benefit from some extra support right now.
            <span className="block mt-2 font-medium">That's completely okay.</span>
          </p>

          <div className="bg-white rounded-lg p-4 mb-4 border border-red-200">
            <p className="text-sm text-gray-700 text-center mb-3">
              Your peer support circle meets tomorrow at 2pm. Want me to block some time on your calendar?
            </p>
            <div className="text-xs text-gray-500 text-center">
              Or I can connect you with other resources.
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onAction}
              className="flex-1 bg-red-500 text-white py-3 px-4 rounded-lg font-semibold hover:bg-red-600 transition-all"
            >
              Block Time
            </button>
            <button
              onClick={() => window.location.href = '/resilience/resources'}
              className="flex-1 bg-pink-200 text-pink-800 py-3 px-4 rounded-lg font-medium hover:bg-pink-300 transition-all"
            >
              View Resources
            </button>
          </div>

          <button
            onClick={onDismiss}
            className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700"
          >
            Remind me tomorrow
          </button>

          <div className="mt-4 pt-4 border-t border-red-200 text-center">
            <p className="text-xs text-gray-500">
              If you're in crisis, please call the National Suicide Prevention Lifeline:
              <br />
              <a href="tel:988" className="font-bold text-red-600 hover:underline">988</a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default ProactiveNudge;
