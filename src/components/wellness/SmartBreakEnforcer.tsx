// ============================================================================
// Smart Break Enforcer
// ============================================================================
// Purpose: Kindly remind providers to take breaks based on activity patterns
// Design: Non-intrusive but persistent, tracks break adherence
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../../services/auditLogger';

interface SmartBreakEnforcerProps {
  userId?: string;
  enabled?: boolean;
  breakIntervalMinutes?: number; // Default 120 (2 hours)
  onBreakTaken?: () => void;
}

interface BreakState {
  lastBreakTime: Date | null;
  minutesSinceBreak: number;
  patientsSeenSinceBreak: number;
  shouldRemind: boolean;
  reminderLevel: 'gentle' | 'moderate' | 'urgent';
}

export const SmartBreakEnforcer: React.FC<SmartBreakEnforcerProps> = ({
  userId,
  enabled = true,
  breakIntervalMinutes = 120,
  onBreakTaken,
}) => {
  const [breakState, setBreakState] = useState<BreakState>({
    lastBreakTime: null,
    minutesSinceBreak: 0,
    patientsSeenSinceBreak: 0,
    shouldRemind: false,
    reminderLevel: 'gentle',
  });
  const [dismissed, setDismissed] = useState(false);
  const [showFullReminder, setShowFullReminder] = useState(false);

  // Calculate break state
  const calculateBreakState = useCallback(async () => {
    if (!userId || !enabled) return;

    try {
      // Get last break log from today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: breakLogs } = await supabase
        .from('provider_daily_checkins')
        .select('created_at, missed_break')
        .eq('user_id', userId)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      // Get sessions since last break to count patients
      const { data: sessions } = await supabase
        .from('scribe_sessions')
        .select('id, created_at')
        .eq('provider_id', userId)
        .gte('created_at', today.toISOString());

      const lastBreak = breakLogs?.[0]?.created_at ? new Date(breakLogs[0].created_at) : null;
      const now = new Date();

      let minutesSinceBreak = 0;
      if (lastBreak) {
        minutesSinceBreak = Math.floor((now.getTime() - lastBreak.getTime()) / (1000 * 60));
      } else {
        // If no break logged today, assume working since shift start (8am or first session)
        const shiftStart = new Date(today);
        shiftStart.setHours(8, 0, 0, 0);
        const firstSession = sessions?.[0]?.created_at ? new Date(sessions[0].created_at) : shiftStart;
        const effectiveStart = firstSession < shiftStart ? firstSession : shiftStart;
        minutesSinceBreak = Math.floor((now.getTime() - effectiveStart.getTime()) / (1000 * 60));
      }

      // Count patients (sessions) since last break
      const patientsSeenSinceBreak = lastBreak
        ? sessions?.filter(s => new Date(s.created_at) > lastBreak).length || 0
        : sessions?.length || 0;

      // Determine if reminder should show
      const shouldRemind = minutesSinceBreak >= breakIntervalMinutes;

      // Determine urgency level
      let reminderLevel: 'gentle' | 'moderate' | 'urgent' = 'gentle';
      if (minutesSinceBreak >= breakIntervalMinutes * 2) {
        reminderLevel = 'urgent';
      } else if (minutesSinceBreak >= breakIntervalMinutes * 1.5) {
        reminderLevel = 'moderate';
      }

      setBreakState({
        lastBreakTime: lastBreak,
        minutesSinceBreak,
        patientsSeenSinceBreak,
        shouldRemind,
        reminderLevel,
      });
    } catch (error) {
      auditLogger.error('BREAK_ENFORCER_CALC_FAILED', error instanceof Error ? error : new Error('Calc failed'));
    }
  }, [userId, enabled, breakIntervalMinutes]);

  // Check break state periodically
  useEffect(() => {
    calculateBreakState();
    const interval = setInterval(calculateBreakState, 5 * 60 * 1000); // Every 5 minutes
    return () => clearInterval(interval);
  }, [calculateBreakState]);

  // Log break taken
  const handleBreakTaken = async () => {
    if (!userId) return;

    try {
      // Update today's check-in with break taken
      const today = new Date().toISOString().split('T')[0];

      await supabase
        .from('provider_daily_checkins')
        .upsert({
          user_id: userId,
          checkin_date: today,
          missed_break: false,
        }, {
          onConflict: 'user_id,checkin_date',
        });

      auditLogger.info('PROVIDER_BREAK_TAKEN', {
        userId,
        minutesSinceLastBreak: breakState.minutesSinceBreak,
        patientsSeenSinceBreak: breakState.patientsSeenSinceBreak,
      });

      setDismissed(true);
      setShowFullReminder(false);
      onBreakTaken?.();

      // Reset state
      setBreakState(prev => ({
        ...prev,
        lastBreakTime: new Date(),
        minutesSinceBreak: 0,
        patientsSeenSinceBreak: 0,
        shouldRemind: false,
      }));
    } catch (error) {
      auditLogger.error('BREAK_LOG_FAILED', error instanceof Error ? error : new Error('Log failed'));
    }
  };

  // Snooze reminder
  const handleSnooze = () => {
    setDismissed(true);
    // Un-dismiss after 30 minutes
    setTimeout(() => setDismissed(false), 30 * 60 * 1000);
  };

  // Don't show if not enabled, dismissed, or no reminder needed
  if (!enabled || dismissed || !breakState.shouldRemind) {
    return null;
  }

  // Format time
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} minutes`;
    if (mins === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${hours}h ${mins}m`;
  };

  // Get urgency styles
  const getUrgencyStyles = () => {
    switch (breakState.reminderLevel) {
      case 'urgent':
        return {
          bg: 'from-red-50 to-orange-50',
          border: 'border-red-300',
          accent: 'bg-red-500',
          text: 'text-red-700',
        };
      case 'moderate':
        return {
          bg: 'from-amber-50 to-yellow-50',
          border: 'border-amber-300',
          accent: 'bg-amber-500',
          text: 'text-amber-700',
        };
      default:
        return {
          bg: 'from-blue-50 to-cyan-50',
          border: 'border-blue-300',
          accent: 'bg-blue-500',
          text: 'text-blue-700',
        };
    }
  };

  const styles = getUrgencyStyles();

  // Minimized reminder bar
  if (!showFullReminder) {
    return (
      <div
        className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-gradient-to-r ${styles.bg} rounded-lg shadow-lg border ${styles.border} p-3 cursor-pointer hover:shadow-xl transition-all z-40`}
        onClick={() => setShowFullReminder(true)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${styles.accent} animate-pulse`}></div>
          <div className="flex-1">
            <p className={`text-sm font-medium ${styles.text}`}>
              {breakState.reminderLevel === 'urgent'
                ? `${formatTime(breakState.minutesSinceBreak)} without a break`
                : 'Time for a quick break?'}
            </p>
          </div>
          <span className="text-xl">☕</span>
        </div>
      </div>
    );
  }

  // Full reminder modal
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className={`bg-gradient-to-br ${styles.bg} rounded-2xl p-6 max-w-md mx-4 shadow-2xl border-2 ${styles.border}`}>
        <div className="text-center mb-4">
          <div className="text-5xl mb-3">
            {breakState.reminderLevel === 'urgent' ? '⚠️' : '☕'}
          </div>
          <h3 className="text-xl font-bold text-gray-900">
            {breakState.reminderLevel === 'urgent'
              ? 'You Really Need a Break'
              : 'Break Reminder'}
          </h3>
        </div>

        <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {formatTime(breakState.minutesSinceBreak)}
              </div>
              <div className="text-xs text-gray-600">Since last break</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {breakState.patientsSeenSinceBreak}
              </div>
              <div className="text-xs text-gray-600">Patients seen</div>
            </div>
          </div>
        </div>

        <p className={`text-sm ${styles.text} text-center mb-4`}>
          {breakState.reminderLevel === 'urgent'
            ? 'Your patients need you at your best. Please take care of yourself.'
            : 'A short break can help you stay sharp and present with your patients.'}
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleBreakTaken}
            className={`flex-1 ${styles.accent} text-white py-3 px-4 rounded-lg font-semibold hover:opacity-90 transition-all`}
          >
            Take Break Now
          </button>
          <button
            onClick={handleSnooze}
            className="flex-1 bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-300 transition-all"
          >
            Snooze 30m
          </button>
        </div>

        <button
          onClick={() => {
            setDismissed(true);
            handleBreakTaken();
          }}
          className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700"
        >
          I just took a break
        </button>
      </div>
    </div>
  );
};

export default SmartBreakEnforcer;
