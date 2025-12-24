// ============================================================================
// Voice Learning Progress Indicator
// ============================================================================
// Purpose: Show providers Riley is learning their voice patterns
// Design: Encouraging, shows improvement over time
// ============================================================================

import React, { useState, useEffect } from 'react';
import { VoiceLearningService, ProviderVoiceProfile } from '../../services/voiceLearningService';

interface VoiceLearningProgressProps {
  providerId?: string;
  showDetailed?: boolean;
  compact?: boolean;
}

export const VoiceLearningProgress: React.FC<VoiceLearningProgressProps> = ({
  providerId,
  showDetailed = false,
  compact = false,
}) => {
  const [profile, setProfile] = useState<ProviderVoiceProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      if (!providerId) {
        setLoading(false);
        return;
      }

      try {
        const data = await VoiceLearningService.loadVoiceProfile(providerId);
        setProfile(data);
      } catch {
        // Silent fail
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [providerId]);

  if (loading) {
    return compact ? null : (
      <div className="animate-pulse bg-gray-100 rounded-lg p-3 h-16"></div>
    );
  }

  // No profile yet - encourage first use
  if (!profile || profile.totalSessions === 0) {
    if (compact) return null;

    return (
      <div className="bg-linear-to-r from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-200">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎓</span>
          <div>
            <h4 className="font-semibold text-gray-900 text-sm">Riley is ready to learn!</h4>
            <p className="text-xs text-gray-600">
              Start recording and Riley will learn your voice patterns over time.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate improvement
  const improvement = profile.accuracyCurrent - profile.accuracyBaseline;
  const improvementPercent = profile.accuracyBaseline > 0
    ? Math.round((improvement / profile.accuracyBaseline) * 100)
    : 0;

  // Get maturity level
  const getMaturityLevel = () => {
    if (profile.totalSessions >= 50 && profile.corrections.length >= 20) {
      return { level: 'Expert', emoji: '🏆', color: 'text-amber-600', bg: 'bg-amber-50' };
    }
    if (profile.totalSessions >= 20 && profile.corrections.length >= 10) {
      return { level: 'Proficient', emoji: '⭐', color: 'text-blue-600', bg: 'bg-blue-50' };
    }
    if (profile.totalSessions >= 5) {
      return { level: 'Learning', emoji: '📚', color: 'text-green-600', bg: 'bg-green-50' };
    }
    return { level: 'Getting Started', emoji: '🌱', color: 'text-purple-600', bg: 'bg-purple-50' };
  };

  const maturity = getMaturityLevel();

  // Top corrections learned
  const topCorrections = [...profile.corrections]
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 3);

  // Compact view
  if (compact) {
    return (
      <div className={`${maturity.bg} rounded-lg px-3 py-2 flex items-center gap-2`}>
        <span>{maturity.emoji}</span>
        <span className={`text-sm font-medium ${maturity.color}`}>
          {profile.corrections.length} corrections learned
        </span>
        {improvementPercent > 0 && (
          <span className="text-xs text-green-600">+{improvementPercent}%</span>
        )}
      </div>
    );
  }

  return (
    <div className={`${maturity.bg} rounded-xl p-4 border border-gray-200`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{maturity.emoji}</span>
          <div>
            <h4 className="font-semibold text-gray-900">Riley's Learning Progress</h4>
            <p className={`text-xs ${maturity.color} font-medium`}>{maturity.level}</p>
          </div>
        </div>
        {improvementPercent > 0 && (
          <div className="text-right">
            <div className="text-lg font-bold text-green-600">+{improvementPercent}%</div>
            <div className="text-xs text-gray-500">accuracy gain</div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center bg-white rounded-lg p-2 border border-gray-100">
          <div className="text-xl font-bold text-gray-900">{profile.totalSessions}</div>
          <div className="text-xs text-gray-500">Sessions</div>
        </div>
        <div className="text-center bg-white rounded-lg p-2 border border-gray-100">
          <div className="text-xl font-bold text-gray-900">{profile.corrections.length}</div>
          <div className="text-xs text-gray-500">Corrections</div>
        </div>
        <div className="text-center bg-white rounded-lg p-2 border border-gray-100">
          <div className="text-xl font-bold text-gray-900">
            {Math.round(profile.accuracyCurrent * 100) || '—'}%
          </div>
          <div className="text-xs text-gray-500">Accuracy</div>
        </div>
      </div>

      {/* Top corrections learned */}
      {showDetailed && topCorrections.length > 0 && (
        <div className="border-t border-gray-200 pt-3">
          <h5 className="text-xs font-medium text-gray-500 mb-2">Top Corrections Learned:</h5>
          <div className="space-y-1">
            {topCorrections.map((c, idx) => (
              <div key={idx} className="flex items-center text-xs bg-white rounded-sm px-2 py-1">
                <span className="text-red-400 line-through mr-2">{c.heard}</span>
                <span className="text-gray-400 mr-2">→</span>
                <span className="text-green-600 font-medium">{c.correct}</span>
                <span className="ml-auto text-gray-400">×{c.frequency}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress bar to next level */}
      {maturity.level !== 'Expert' && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progress to next level</span>
            <span>
              {maturity.level === 'Getting Started' && `${profile.totalSessions}/5 sessions`}
              {maturity.level === 'Learning' && `${profile.totalSessions}/20 sessions`}
              {maturity.level === 'Proficient' && `${profile.totalSessions}/50 sessions`}
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${maturity.color.replace('text-', 'bg-')} rounded-full transition-all`}
              style={{
                width: `${Math.min(
                  100,
                  maturity.level === 'Getting Started'
                    ? (profile.totalSessions / 5) * 100
                    : maturity.level === 'Learning'
                    ? (profile.totalSessions / 20) * 100
                    : (profile.totalSessions / 50) * 100
                )}%`,
              }}
            ></div>
          </div>
        </div>
      )}

      {/* Encouragement */}
      <p className="text-xs text-gray-500 mt-3 text-center">
        {maturity.level === 'Getting Started' && "Keep using Riley - they're learning your voice!"}
        {maturity.level === 'Learning' && "Great progress! Riley is getting better at understanding you."}
        {maturity.level === 'Proficient' && "Riley knows your voice well. Accuracy is improving!"}
        {maturity.level === 'Expert' && "Riley has mastered your voice patterns!"}
      </p>
    </div>
  );
};

export default VoiceLearningProgress;
