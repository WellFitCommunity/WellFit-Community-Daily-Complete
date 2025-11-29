// ============================================================================
// Celebration Moments System
// ============================================================================
// Purpose: Celebrate provider achievements and milestones
// Design: Positive reinforcement, not gamification overload
// Triggers: Streaks, SOAP notes, billing captures, training completions
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../../services/auditLogger';

interface CelebrationMomentsProps {
  userId?: string;
  onClose?: () => void;
}

interface Milestone {
  id: string;
  type: 'streak' | 'soap_notes' | 'billing' | 'training' | 'time_saved';
  title: string;
  description: string;
  emoji: string;
  value: number;
  achieved: boolean;
  achievedAt?: string;
  impact?: string;
}

interface CelebrationState {
  showCelebration: boolean;
  currentMilestone: Milestone | null;
  recentMilestones: Milestone[];
}

// Milestone definitions
const MILESTONE_DEFINITIONS = {
  streak: [
    { threshold: 3, title: '3-Day Streak!', emoji: '🔥', description: 'Three days of checking in!' },
    { threshold: 7, title: 'Week Warrior!', emoji: '🏆', description: 'A full week of wellness check-ins!' },
    { threshold: 14, title: 'Fortnight Focus!', emoji: '💪', description: 'Two weeks of consistent self-care!' },
    { threshold: 30, title: 'Monthly Master!', emoji: '🌟', description: 'A whole month of prioritizing yourself!' },
    { threshold: 60, title: 'Wellness Champion!', emoji: '👑', description: 'Two months of dedication!' },
    { threshold: 100, title: 'Century Club!', emoji: '💯', description: '100 days of checking in!' },
  ],
  soap_notes: [
    { threshold: 10, title: 'First 10 Notes!', emoji: '📝', description: '10 SOAP notes with Riley!' },
    { threshold: 50, title: 'Documentation Pro!', emoji: '📋', description: '50 notes auto-generated!' },
    { threshold: 100, title: 'Century of Notes!', emoji: '💯', description: '100 SOAP notes!' },
    { threshold: 500, title: 'Documentation Legend!', emoji: '🏅', description: '500 notes - amazing!' },
  ],
  time_saved: [
    { threshold: 60, title: 'First Hour Saved!', emoji: '⏰', description: '1 hour of documentation time saved!' },
    { threshold: 300, title: '5 Hours Back!', emoji: '🕐', description: '5 hours saved - that\'s a half day!' },
    { threshold: 600, title: '10 Hours Freedom!', emoji: '🗓️', description: '10 hours - more than a full workday!' },
    { threshold: 1500, title: '25 Hours Reclaimed!', emoji: '🎉', description: '25 hours back in your life!' },
  ],
  training: [
    { threshold: 1, title: 'First Module Done!', emoji: '🎓', description: 'You completed your first resilience module!' },
    { threshold: 5, title: 'Eager Learner!', emoji: '📚', description: '5 training modules completed!' },
    { threshold: 10, title: 'Knowledge Seeker!', emoji: '🧠', description: '10 modules - building resilience!' },
  ],
};

export const CelebrationMoments: React.FC<CelebrationMomentsProps> = ({
  userId,
  onClose,
}) => {
  const [state, setState] = useState<CelebrationState>({
    showCelebration: false,
    currentMilestone: null,
    recentMilestones: [],
  });
  const [confetti, setConfetti] = useState(false);

  // Check for new milestones
  const checkMilestones = useCallback(async () => {
    if (!userId) return;

    try {
      // Get current stats
      const [
        { data: checkins },
        { data: sessions },
        { data: completions },
      ] = await Promise.all([
        supabase
          .from('provider_daily_checkins')
          .select('checkin_date')
          .eq('user_id', userId)
          .order('checkin_date', { ascending: false }),
        supabase
          .from('scribe_sessions')
          .select('id, recording_duration_seconds, ai_note_subjective')
          .eq('provider_id', userId),
        supabase
          .from('provider_training_completions')
          .select('id')
          .eq('user_id', userId)
          .eq('completion_percentage', 100),
      ]);

      // Calculate streak
      let streak = 0;
      if (checkins && checkins.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let currentDate = today;

        for (const checkin of checkins) {
          const checkinDate = new Date(checkin.checkin_date);
          checkinDate.setHours(0, 0, 0, 0);

          const diffDays = Math.floor((currentDate.getTime() - checkinDate.getTime()) / (24 * 60 * 60 * 1000));

          if (diffDays <= 1) {
            streak++;
            currentDate = checkinDate;
          } else {
            break;
          }
        }
      }

      // Count SOAP notes and time saved
      const soapNotes = sessions?.filter(s => s.ai_note_subjective)?.length || 0;
      const _totalSeconds = sessions?.reduce((sum, s) => sum + (s.recording_duration_seconds || 0), 0) || 0;
      const timeSavedMinutes = Math.round(soapNotes * 12); // ~12 min saved per note

      // Count training completions
      const trainingCompleted = completions?.length || 0;

      // Check which milestones are newly achieved
      const achievedMilestones: Milestone[] = [];

      // Check streak milestones
      for (const m of MILESTONE_DEFINITIONS.streak) {
        if (streak >= m.threshold) {
          achievedMilestones.push({
            id: `streak-${m.threshold}`,
            type: 'streak',
            title: m.title,
            description: m.description,
            emoji: m.emoji,
            value: streak,
            achieved: true,
          });
        }
      }

      // Check SOAP note milestones
      for (const m of MILESTONE_DEFINITIONS.soap_notes) {
        if (soapNotes >= m.threshold) {
          achievedMilestones.push({
            id: `soap-${m.threshold}`,
            type: 'soap_notes',
            title: m.title,
            description: m.description,
            emoji: m.emoji,
            value: soapNotes,
            achieved: true,
            impact: `Approximately ${Math.round(soapNotes * 12 / 60)} hours of documentation saved`,
          });
        }
      }

      // Check time saved milestones
      for (const m of MILESTONE_DEFINITIONS.time_saved) {
        if (timeSavedMinutes >= m.threshold) {
          achievedMilestones.push({
            id: `time-${m.threshold}`,
            type: 'time_saved',
            title: m.title,
            description: m.description,
            emoji: m.emoji,
            value: timeSavedMinutes,
            achieved: true,
          });
        }
      }

      // Check training milestones
      for (const m of MILESTONE_DEFINITIONS.training) {
        if (trainingCompleted >= m.threshold) {
          achievedMilestones.push({
            id: `training-${m.threshold}`,
            type: 'training',
            title: m.title,
            description: m.description,
            emoji: m.emoji,
            value: trainingCompleted,
            achieved: true,
          });
        }
      }

      // Get previously shown milestones from localStorage
      const shownMilestones = JSON.parse(localStorage.getItem(`milestones-${userId}`) || '[]');
      const newMilestones = achievedMilestones.filter(m => !shownMilestones.includes(m.id));

      if (newMilestones.length > 0) {
        // Show the highest new milestone
        const highestNew = newMilestones[newMilestones.length - 1];
        setState({
          showCelebration: true,
          currentMilestone: highestNew,
          recentMilestones: achievedMilestones.slice(-5),
        });
        setConfetti(true);

        // Mark as shown
        localStorage.setItem(
          `milestones-${userId}`,
          JSON.stringify([...shownMilestones, ...newMilestones.map(m => m.id)])
        );

        // Log achievement
        auditLogger.info('MILESTONE_ACHIEVED', {
          milestoneId: highestNew.id,
          type: highestNew.type,
          value: highestNew.value,
        });
      }
    } catch (error) {
      auditLogger.error('MILESTONE_CHECK_FAILED', error instanceof Error ? error : new Error('Check failed'));
    }
  }, [userId]);

  useEffect(() => {
    checkMilestones();
  }, [checkMilestones]);

  // Handle close
  const handleClose = () => {
    setState(prev => ({ ...prev, showCelebration: false }));
    setConfetti(false);
    onClose?.();
  };

  // Format time
  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  };

  if (!state.showCelebration || !state.currentMilestone) {
    return null;
  }

  const milestone = state.currentMilestone;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn">
      {/* Confetti effect */}
      {confetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-20px',
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            >
              {['🎉', '🎊', '✨', '⭐', '🌟'][Math.floor(Math.random() * 5)]}
            </div>
          ))}
        </div>
      )}

      <div className="bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 rounded-2xl p-8 max-w-md mx-4 shadow-2xl border-2 border-yellow-300 text-center transform animate-bounce-once">
        {/* Milestone emoji */}
        <div className="text-7xl mb-4 animate-pulse">{milestone.emoji}</div>

        {/* Title */}
        <h2 className="text-3xl font-bold text-gray-900 mb-2">{milestone.title}</h2>

        {/* Description */}
        <p className="text-lg text-gray-700 mb-4">{milestone.description}</p>

        {/* Impact */}
        {milestone.impact && (
          <div className="bg-white rounded-lg p-4 mb-4 border border-yellow-200">
            <p className="text-gray-700">{milestone.impact}</p>
          </div>
        )}

        {/* Type-specific details */}
        {milestone.type === 'streak' && (
          <div className="bg-orange-100 rounded-lg p-4 mb-4 border border-orange-300">
            <p className="text-orange-800 font-medium">
              🔥 {milestone.value} day streak!
            </p>
            <p className="text-sm text-orange-700 mt-1">
              Keep it going - your wellbeing matters!
            </p>
          </div>
        )}

        {milestone.type === 'soap_notes' && (
          <div className="bg-blue-100 rounded-lg p-4 mb-4 border border-blue-300">
            <p className="text-blue-800 font-medium">
              📝 {milestone.value} SOAP notes generated!
            </p>
            <p className="text-sm text-blue-700 mt-1">
              That's approximately {formatTime(milestone.value * 12)} you didn't spend on paperwork.
            </p>
          </div>
        )}

        {milestone.type === 'time_saved' && (
          <div className="bg-green-100 rounded-lg p-4 mb-4 border border-green-300">
            <p className="text-green-800 font-medium">
              ⏰ {formatTime(milestone.value)} saved!
            </p>
            <p className="text-sm text-green-700 mt-1">
              That's more time with your family, hobbies, or just resting.
            </p>
          </div>
        )}

        {/* Motivational message */}
        <p className="text-gray-600 text-sm mb-6">
          {milestone.type === 'streak' && "Your consistency is inspiring!"}
          {milestone.type === 'soap_notes' && "You're mastering efficient documentation!"}
          {milestone.type === 'time_saved' && "You're reclaiming your time!"}
          {milestone.type === 'training' && "You're investing in your resilience!"}
        </p>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 bg-yellow-500 text-white py-3 px-6 rounded-lg font-bold text-lg hover:bg-yellow-600 transition-all"
          >
            Awesome!
          </button>
          <button
            onClick={() => {
              handleClose();
              window.location.href = '/achievements';
            }}
            className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-300 transition-all"
          >
            See All
          </button>
        </div>
      </div>

      {/* CSS for confetti animation */}
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-20px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti-fall 3s ease-out forwards;
          font-size: 24px;
        }
        @keyframes bounce-once {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .animate-bounce-once {
          animation: bounce-once 0.5s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default CelebrationMoments;
