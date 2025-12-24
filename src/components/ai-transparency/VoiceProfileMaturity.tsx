import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

interface VoiceProfile {
  maturity_score: number;
  accent_adaptation_score: number;
  terminology_adaptation_score: number;
  workflow_adaptation_score: number;
  status: 'training' | 'maturing' | 'fully_adapted';
  total_sessions: number;
  total_corrections: number;
  total_transcription_time_seconds: number;
  fully_adapted_at: string | null;
}

interface VoiceProfileMaturityProps {
  variant?: 'compact' | 'detailed';
  showDetails?: boolean;
}

export const VoiceProfileMaturity: React.FC<VoiceProfileMaturityProps> = ({
  variant = 'compact',
  showDetails = false,
}) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<VoiceProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // Initialize expanded state from showDetails prop
  const [expanded, setExpanded] = useState(showDetails);

  const fetchVoiceProfile = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('voice_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setProfile(data);
    } catch {
      // Error handled silently - profile will show as not started
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchVoiceProfile();
  }, [fetchVoiceProfile]);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-20 bg-linear-to-r from-purple-100 to-pink-100 rounded-xl"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-linear-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
        <div className="flex items-center space-x-3">
          <div className="text-3xl">🎤</div>
          <div>
            <p className="font-semibold text-gray-800">Start Using Riley</p>
            <p className="text-sm text-gray-600">Begin a Smart Scribe session to train your voice profile</p>
          </div>
        </div>
      </div>
    );
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'fully_adapted':
        return {
          label: 'Fully Adapted',
          icon: '⭐',
          gradient: 'from-green-400 to-emerald-500',
          bgGradient: 'from-green-50 to-emerald-50',
          borderColor: 'border-green-300',
          textColor: 'text-green-700',
        };
      case 'maturing':
        return {
          label: 'Maturing',
          icon: '🌱',
          gradient: 'from-blue-400 to-cyan-500',
          bgGradient: 'from-blue-50 to-cyan-50',
          borderColor: 'border-blue-300',
          textColor: 'text-blue-700',
        };
      default:
        return {
          label: 'Training',
          icon: '🎯',
          gradient: 'from-purple-400 to-pink-500',
          bgGradient: 'from-purple-50 to-pink-50',
          borderColor: 'border-purple-300',
          textColor: 'text-purple-700',
        };
    }
  };

  const statusConfig = getStatusConfig(profile.status);

  const ScoreBar: React.FC<{ label: string; score: number; color: string }> = ({ label, score, color }) => (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="font-bold text-gray-900">{score}%</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className={`h-full bg-linear-to-r ${color}`}
        ></motion.div>
      </div>
    </div>
  );

  if (variant === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className={`
          bg-linear-to-br ${statusConfig.bgGradient}
          rounded-xl p-4 border ${statusConfig.borderColor}
          shadow-lg hover:shadow-xl transition-all duration-300
          cursor-pointer
        `}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 3,
              }}
              className="text-3xl"
            >
              {statusConfig.icon}
            </motion.div>
            <div>
              <p className={`text-sm font-semibold ${statusConfig.textColor}`}>Riley Voice Profile</p>
              <p className="text-xs text-gray-600">{statusConfig.label}</p>
            </div>
          </div>

          {/* Circular Progress */}
          <div className="relative w-16 h-16">
            <svg className="transform -rotate-90 w-16 h-16">
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                className="text-gray-200"
              />
              <motion.circle
                cx="32"
                cy="32"
                r="28"
                stroke="url(#gradient)"
                strokeWidth="4"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 28}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 28 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 28 * (1 - profile.maturity_score / 100) }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" className={`${statusConfig.gradient.split(' ')[0].replace('from-', '')}`} />
                  <stop offset="100%" className={`${statusConfig.gradient.split(' ')[2].replace('to-', '')}`} />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-gray-800">{profile.maturity_score}%</span>
            </div>
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-4 pt-4 border-t border-gray-300 space-y-3"
          >
            <ScoreBar label="Accent Adaptation" score={profile.accent_adaptation_score} color="from-purple-400 to-pink-500" />
            <ScoreBar label="Terminology" score={profile.terminology_adaptation_score} color="from-blue-400 to-cyan-500" />
            <ScoreBar label="Workflow" score={profile.workflow_adaptation_score} color="from-green-400 to-emerald-500" />

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-white/50 rounded-lg p-2 text-center">
                <p className="text-2xl font-bold text-gray-800">{profile.total_sessions}</p>
                <p className="text-xs text-gray-600">Sessions</p>
              </div>
              <div className="bg-white/50 rounded-lg p-2 text-center">
                <p className="text-2xl font-bold text-gray-800">{profile.total_corrections}</p>
                <p className="text-xs text-gray-600">Corrections</p>
              </div>
            </div>

            {profile.fully_adapted_at && (
              <div className="bg-green-100 rounded-lg p-2 text-center">
                <p className="text-xs font-semibold text-green-800">
                  Fully adapted on {new Date(profile.fully_adapted_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    );
  }

  // Detailed variant
  return (
    <div className={`bg-linear-to-br ${statusConfig.bgGradient} rounded-2xl p-6 border ${statusConfig.borderColor} shadow-xl`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <motion.div
            animate={{
              rotate: [0, 10, -10, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 3,
            }}
            className="text-5xl"
          >
            {statusConfig.icon}
          </motion.div>
          <div>
            <h3 className="text-2xl font-bold text-gray-800">Riley Voice Profile</h3>
            <p className={`text-sm font-semibold ${statusConfig.textColor}`}>{statusConfig.label}</p>
          </div>
        </div>

        <div className="text-center">
          <p className="text-4xl font-bold bg-linear-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            {profile.maturity_score}%
          </p>
          <p className="text-xs text-gray-600">Overall Maturity</p>
        </div>
      </div>

      <div className="space-y-4">
        <ScoreBar label="Accent Adaptation" score={profile.accent_adaptation_score} color="from-purple-400 to-pink-500" />
        <ScoreBar label="Medical Terminology" score={profile.terminology_adaptation_score} color="from-blue-400 to-cyan-500" />
        <ScoreBar label="Workflow Patterns" score={profile.workflow_adaptation_score} color="from-green-400 to-emerald-500" />
      </div>

      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="bg-white/70 backdrop-blur-xs rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-gray-800">{profile.total_sessions}</p>
          <p className="text-sm text-gray-600 mt-1">Total Sessions</p>
        </div>
        <div className="bg-white/70 backdrop-blur-xs rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-gray-800">{profile.total_corrections}</p>
          <p className="text-sm text-gray-600 mt-1">Corrections Made</p>
        </div>
        <div className="bg-white/70 backdrop-blur-xs rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-gray-800">
            {Math.floor(profile.total_transcription_time_seconds / 3600)}h
          </p>
          <p className="text-sm text-gray-600 mt-1">Training Time</p>
        </div>
      </div>

      {profile.fully_adapted_at && (
        <div className="mt-6 bg-linear-to-r from-green-400 to-emerald-500 rounded-xl p-4 text-center">
          <p className="text-white font-bold">
            🎉 Fully adapted on {new Date(profile.fully_adapted_at).toLocaleDateString()}!
          </p>
        </div>
      )}
    </div>
  );
};
