/**
 * ClockInOutWidget
 *
 * The main time clock interface with a big friendly button.
 * Shows current status, today's hours, and weekly summary.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Play, Square, TrendingUp, Calendar, Zap, Award } from 'lucide-react';
import { EACard, EACardHeader, EACardContent } from '../envision-atlus';
import { CelebrationOverlay } from './CelebrationOverlay';
import { TimeClockService } from '../../services/timeClockService';
import type { TodayEntry, WeeklySummary, TimeClockStreak } from '../../types/timeClock';

interface ClockInOutWidgetProps {
  userId: string;
  tenantId: string;
  onStatusChange?: (status: 'clocked_in' | 'clocked_out') => void;
}

export const ClockInOutWidget: React.FC<ClockInOutWidgetProps> = ({
  userId,
  tenantId,
  onStatusChange,
}) => {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [todayEntry, setTodayEntry] = useState<TodayEntry | null>(null);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [streak, setStreak] = useState<TimeClockStreak | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [workTime, setWorkTime] = useState<string>('0h 0m');
  const [error, setError] = useState<string | null>(null);

  // Celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState('');

  // Clock out message state
  const [showClockOutMessage, setShowClockOutMessage] = useState(false);
  const [clockOutMessage, setClockOutMessage] = useState('');
  const [clockOutHours, setClockOutHours] = useState('');

  const isClockedIn = todayEntry?.status === 'clocked_in';

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [todayResult, weeklyResult, streakResult] = await Promise.all([
        TimeClockService.getTodayEntry(userId, tenantId),
        TimeClockService.getWeeklySummary(userId, tenantId),
        TimeClockService.getStreak(userId, tenantId),
      ]);

      if (todayResult.success) {
        setTodayEntry(todayResult.data);
      }
      if (weeklyResult.success) {
        setWeeklySummary(weeklyResult.data);
      }
      if (streakResult.success) {
        setStreak(streakResult.data);
      }
    } catch (err) {
      setError('Failed to load time clock data');
    } finally {
      setLoading(false);
    }
  }, [userId, tenantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Update work time if clocked in
  useEffect(() => {
    if (isClockedIn && todayEntry?.clock_in_time) {
      const timer = setInterval(() => {
        const result = TimeClockService.calculateCurrentWorkTime(todayEntry.clock_in_time);
        setWorkTime(result.formatted);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isClockedIn, todayEntry?.clock_in_time]);

  // Handle clock in
  const handleClockIn = async () => {
    try {
      setProcessing(true);
      setError(null);

      const result = await TimeClockService.clockIn(userId, tenantId);

      if (!result.success) {
        setError(result.error.message);
        return;
      }

      // Show celebration if on time
      if (result.data.was_on_time) {
        const message = TimeClockService.getCelebrationMessage(
          true,
          result.data.current_streak,
          streak?.best_streak || 0
        );
        setCelebrationMessage(message);
        setShowCelebration(true);
      }

      // Reload data
      await loadData();
      onStatusChange?.('clocked_in');
    } catch (err) {
      setError('Failed to clock in');
    } finally {
      setProcessing(false);
    }
  };

  // Handle clock out
  const handleClockOut = async () => {
    if (!todayEntry?.id) return;

    try {
      setProcessing(true);
      setError(null);

      const result = await TimeClockService.clockOut(todayEntry.id);

      if (!result.success) {
        setError(result.error.message);
        return;
      }

      // Show clock out message with hours worked
      const message = TimeClockService.getClockOutMessage(result.data.total_hours);
      setClockOutMessage(message);
      setClockOutHours(TimeClockService.formatHours(result.data.total_minutes));
      setShowClockOutMessage(true);

      // Reload data
      await loadData();
      onStatusChange?.('clocked_out');

      // Hide message after 5 seconds
      setTimeout(() => setShowClockOutMessage(false), 5000);
    } catch (err) {
      setError('Failed to clock out');
    } finally {
      setProcessing(false);
    }
  };

  // Format time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <EACard>
        <EACardContent className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
        </EACardContent>
      </EACard>
    );
  }

  return (
    <>
      {/* Celebration Overlay */}
      <CelebrationOverlay
        show={showCelebration}
        message={celebrationMessage}
        streak={streak?.current_streak || 0}
        onComplete={() => setShowCelebration(false)}
      />

      <EACard variant="elevated" data-testid="clock-widget">
        <EACardHeader icon={<Clock className="h-5 w-5" />}>
          Time Clock
        </EACardHeader>

        <EACardContent className="space-y-6">
          {/* Current Time */}
          <div className="text-center py-4" data-testid="current-time">
            <p className="text-4xl font-mono font-bold text-white">
              {formatTime(currentTime)}
            </p>
            <p className="text-slate-400 mt-1">{formatDate(currentTime)}</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 text-red-300 text-sm text-center">
              {error}
            </div>
          )}

          {/* Clock In/Out Button */}
          <div className="flex justify-center">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={isClockedIn ? handleClockOut : handleClockIn}
              disabled={processing}
              className={`
                w-48 h-48 rounded-full flex flex-col items-center justify-center
                transition-all duration-300 shadow-lg
                ${isClockedIn
                  ? 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-400 hover:to-red-500'
                  : 'bg-gradient-to-br from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500'
                }
                ${processing ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}
                border-4 border-white/10
              `}
              data-testid="clock-button"
            >
              {processing ? (
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/30 border-t-white" />
              ) : (
                <>
                  {isClockedIn ? (
                    <Square className="h-16 w-16 text-white mb-2" />
                  ) : (
                    <Play className="h-16 w-16 text-white mb-2 ml-2" />
                  )}
                  <span className="text-white text-xl font-bold">
                    {isClockedIn ? 'Clock Out' : 'Clock In'}
                  </span>
                </>
              )}
            </motion.button>
          </div>

          {/* Clock Out Message */}
          <AnimatePresence>
            {showClockOutMessage && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-teal-500/20 border border-teal-500/30 rounded-lg p-4 text-center"
                data-testid="clock-out-message"
              >
                <p className="text-teal-300 font-medium mb-2">{clockOutMessage}</p>
                <p className="text-white text-2xl font-bold">
                  Today: {clockOutHours}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Status Cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* Today's Hours */}
            <div className="bg-slate-800/50 rounded-lg p-4" data-testid="today-hours">
              <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                <Calendar className="h-4 w-4" />
                Today
              </div>
              <p className="text-2xl font-bold text-white">
                {isClockedIn ? workTime : todayEntry?.total_hours
                  ? TimeClockService.formatHours(todayEntry.total_minutes || 0)
                  : '0h 0m'
                }
              </p>
              {isClockedIn && (
                <p className="text-xs text-teal-400 mt-1">Currently working</p>
              )}
            </div>

            {/* Weekly Hours */}
            <div className="bg-slate-800/50 rounded-lg p-4" data-testid="weekly-hours">
              <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                <TrendingUp className="h-4 w-4" />
                This Week
              </div>
              <p className="text-2xl font-bold text-white">
                {weeklySummary
                  ? TimeClockService.formatHours(weeklySummary.total_minutes)
                  : '0h 0m'
                }
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {weeklySummary?.total_entries || 0} days
              </p>
            </div>
          </div>

          {/* Streak & Stats */}
          {streak && streak.current_streak > 0 && (
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-400" />
                  <span className="text-amber-300 font-medium">
                    {streak.current_streak} Day Streak!
                  </span>
                </div>
                {streak.best_streak > 0 && streak.current_streak < streak.best_streak && (
                  <div className="flex items-center gap-1 text-slate-400 text-sm">
                    <Award className="h-4 w-4" />
                    Best: {streak.best_streak}
                  </div>
                )}
              </div>
              {streak.current_streak >= streak.best_streak && streak.best_streak > 0 && (
                <p className="text-amber-400 text-sm mt-2">
                  You're at your personal best!
                </p>
              )}
            </div>
          )}

          {/* Clocked In Info */}
          {isClockedIn && todayEntry && (
            <div className="text-center text-sm text-slate-400">
              Clocked in at{' '}
              <span className="text-white">
                {new Date(todayEntry.clock_in_time).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              {todayEntry.was_on_time && (
                <span className="ml-2 text-teal-400">On time!</span>
              )}
            </div>
          )}
        </EACardContent>
      </EACard>
    </>
  );
};

export default ClockInOutWidget;
