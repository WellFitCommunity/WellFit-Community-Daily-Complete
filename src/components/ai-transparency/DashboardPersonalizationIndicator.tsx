import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

interface PersonalizationMetrics {
  total_interactions: number;
  adaptation_score: number;
  most_used_features: string[];
  workflow_patterns_detected: number;
  last_personalization_update: string;
}

interface DashboardPersonalizationIndicatorProps {
  variant?: 'compact' | 'detailed';
  showAdaptationDetails?: boolean;
}

export const DashboardPersonalizationIndicator: React.FC<DashboardPersonalizationIndicatorProps> = ({
  variant = 'compact',
  showAdaptationDetails = false,
}) => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<PersonalizationMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchPersonalizationMetrics = useCallback(async () => {
    if (!user) return;

    try {
      // Get total interaction count
      const { count: totalInteractions, error: countError } = await supabase
        .from('dashboard_personalization_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (countError) throw countError;

      // Get most used features
      const { data: featureData, error: featureError } = await supabase
        .from('dashboard_personalization_events')
        .select('feature_clicked, click_count')
        .eq('user_id', user.id)
        .order('click_count', { ascending: false })
        .limit(5);

      if (featureError) throw featureError;

      // Get workflow patterns count
      const { count: patternsCount, error: patternsError } = await supabase
        .from('dashboard_personalization_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('workflow_pattern_detected', 'is', null);

      if (patternsError) throw patternsError;

      // Get last update
      const { data: lastEvent, error: lastEventError } = await supabase
        .from('dashboard_personalization_events')
        .select('created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lastEventError && lastEventError.code !== 'PGRST116') throw lastEventError;

      // Calculate adaptation score (0-100)
      const adaptationScore = Math.min(
        100,
        Math.floor(
          ((totalInteractions || 0) / 100) * 40 + // 40 points for interactions
            ((patternsCount || 0) / 20) * 30 + // 30 points for patterns detected
            ((featureData?.length || 0) / 5) * 30 // 30 points for feature usage variety
        )
      );

      setMetrics({
        total_interactions: totalInteractions || 0,
        adaptation_score: adaptationScore,
        most_used_features: featureData?.map((f: any) => f.feature_clicked) || [],
        workflow_patterns_detected: patternsCount || 0,
        last_personalization_update: lastEvent?.created_at || new Date().toISOString(),
      });
    } catch (error) {
      // Error handled silently - indicator will show as learning state
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPersonalizationMetrics();
  }, [fetchPersonalizationMetrics]);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-16 bg-linear-to-r from-indigo-100 to-purple-100 rounded-xl"></div>
      </div>
    );
  }

  if (!metrics || metrics.total_interactions === 0) {
    return (
      <div className="bg-linear-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-200">
        <div className="flex items-center space-x-3">
          <div className="text-3xl">🤖</div>
          <div>
            <p className="font-semibold text-gray-800">AI Learning Your Workflow</p>
            <p className="text-sm text-gray-600">Your dashboard will adapt to your usage patterns</p>
          </div>
        </div>
      </div>
    );
  }

  const getAdaptationLevel = (score: number): 'learning' | 'adapting' | 'personalized' => {
    if (score >= 75) return 'personalized';
    if (score >= 40) return 'adapting';
    return 'learning';
  };

  const getAdaptationConfig = (level: 'learning' | 'adapting' | 'personalized') => {
    switch (level) {
      case 'personalized':
        return {
          label: 'Fully Personalized',
          icon: '⚡',
          gradient: 'from-green-400 to-emerald-500',
          bgGradient: 'from-green-50 to-emerald-50',
          borderColor: 'border-green-300',
          textColor: 'text-green-700',
        };
      case 'adapting':
        return {
          label: 'Adapting',
          icon: '🔄',
          gradient: 'from-blue-400 to-cyan-500',
          bgGradient: 'from-blue-50 to-cyan-50',
          borderColor: 'border-blue-300',
          textColor: 'text-blue-700',
        };
      default:
        return {
          label: 'Learning',
          icon: '🧠',
          gradient: 'from-purple-400 to-pink-500',
          bgGradient: 'from-purple-50 to-pink-50',
          borderColor: 'border-purple-300',
          textColor: 'text-purple-700',
        };
    }
  };

  const level = getAdaptationLevel(metrics.adaptation_score);
  const config = getAdaptationConfig(level);

  if (variant === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className={`
          bg-linear-to-br ${config.bgGradient}
          rounded-xl p-4 border ${config.borderColor}
          shadow-md hover:shadow-lg transition-all duration-300
          cursor-pointer
        `}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <motion.div
              animate={{
                rotate: level === 'adapting' ? [0, 360] : [0, 10, -10, 0],
              }}
              transition={{
                duration: level === 'adapting' ? 2 : 1.5,
                repeat: Infinity,
                repeatDelay: level === 'adapting' ? 0 : 2,
              }}
              className="text-2xl"
            >
              {config.icon}
            </motion.div>
            <div>
              <p className={`text-sm font-semibold ${config.textColor}`}>Dashboard Personalization</p>
              <p className="text-xs text-gray-600">{config.label}</p>
            </div>
          </div>

          {/* Mini Progress Ring */}
          <div className="relative w-12 h-12">
            <svg className="transform -rotate-90 w-12 h-12">
              <circle
                cx="24"
                cy="24"
                r="20"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                className="text-gray-200"
              />
              <motion.circle
                cx="24"
                cy="24"
                r="20"
                stroke="url(#gradient-compact)"
                strokeWidth="3"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 20}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 20 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 20 * (1 - metrics.adaptation_score / 100) }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="gradient-compact" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" className={config.gradient.split(' ')[0].replace('from-', '')} />
                  <stop offset="100%" className={config.gradient.split(' ')[2].replace('to-', '')} />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-gray-800">{metrics.adaptation_score}%</span>
            </div>
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && showAdaptationDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-4 pt-4 border-t border-gray-300 space-y-2"
          >
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-gray-800">{metrics.total_interactions}</p>
                <p className="text-xs text-gray-600">Interactions</p>
              </div>
              <div className="bg-white/50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-gray-800">{metrics.workflow_patterns_detected}</p>
                <p className="text-xs text-gray-600">Patterns</p>
              </div>
            </div>

            {metrics.most_used_features.length > 0 && (
              <div className="bg-white/50 rounded-lg p-2">
                <p className="text-xs font-semibold text-gray-700 mb-1">Most Used:</p>
                <div className="flex flex-wrap gap-1">
                  {metrics.most_used_features.slice(0, 3).map((feature, idx) => (
                    <span
                      key={idx}
                      className={`text-xs px-2 py-1 rounded-full bg-linear-to-r ${config.gradient} text-white`}
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-gray-500 text-center">
              Last updated: {new Date(metrics.last_personalization_update).toLocaleTimeString()}
            </p>
          </motion.div>
        )}
      </motion.div>
    );
  }

  // Detailed variant
  return (
    <div className={`bg-linear-to-br ${config.bgGradient} rounded-2xl p-6 border ${config.borderColor} shadow-xl`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <motion.div
            animate={{
              rotate: level === 'adapting' ? [0, 360] : [0, 10, -10, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: level === 'adapting' ? 3 : 2,
              repeat: Infinity,
              repeatDelay: level === 'adapting' ? 0 : 2,
            }}
            className="text-5xl"
          >
            {config.icon}
          </motion.div>
          <div>
            <h3 className="text-2xl font-bold text-gray-800">Dashboard Personalization</h3>
            <p className={`text-sm font-semibold ${config.textColor}`}>{config.label}</p>
          </div>
        </div>

        <div className="text-center">
          <p className={`text-4xl font-bold bg-linear-to-r ${config.gradient} bg-clip-text text-transparent`}>
            {metrics.adaptation_score}%
          </p>
          <p className="text-xs text-gray-600">Adaptation Score</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${metrics.adaptation_score}%` }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            className={`h-full bg-linear-to-r ${config.gradient}`}
          ></motion.div>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Learning (0-39%)</span>
          <span>Adapting (40-74%)</span>
          <span>Personalized (75-100%)</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white/70 backdrop-blur-xs rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-gray-800">{metrics.total_interactions}</p>
          <p className="text-sm text-gray-600 mt-1">Total Interactions</p>
        </div>
        <div className="bg-white/70 backdrop-blur-xs rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-gray-800">{metrics.workflow_patterns_detected}</p>
          <p className="text-sm text-gray-600 mt-1">Patterns Detected</p>
        </div>
      </div>

      {/* Most Used Features */}
      {metrics.most_used_features.length > 0 && (
        <div className="bg-white/70 backdrop-blur-xs rounded-xl p-4 mb-4">
          <p className="font-semibold text-gray-800 mb-3">Your Most Used Features:</p>
          <div className="space-y-2">
            {metrics.most_used_features.map((feature, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{feature}</span>
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${100 - idx * 20}%` }}
                      transition={{ delay: idx * 0.1, duration: 0.8 }}
                      className={`h-full bg-linear-to-r ${config.gradient}`}
                    ></motion.div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendation */}
      {level === 'learning' && (
        <div className="bg-purple-100 border-l-4 border-purple-500 p-3 rounded-sm">
          <p className="text-sm text-purple-800">
            <span className="font-semibold">🧠 Keep Using:</span> The more you use WellFit, the better it adapts to
            your workflow!
          </p>
        </div>
      )}

      {level === 'adapting' && (
        <div className="bg-blue-100 border-l-4 border-blue-500 p-3 rounded-sm">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">🔄 Almost There:</span> Your dashboard is learning your patterns. Keep
            going!
          </p>
        </div>
      )}

      {level === 'personalized' && (
        <div className="bg-green-100 border-l-4 border-green-500 p-3 rounded-sm">
          <p className="text-sm text-green-800">
            <span className="font-semibold">⚡ Fully Personalized:</span> Your dashboard is optimized for your unique
            workflow!
          </p>
        </div>
      )}

      <p className="text-xs text-gray-500 text-center mt-4">
        Last updated: {new Date(metrics.last_personalization_update).toLocaleString()}
      </p>
    </div>
  );
};
