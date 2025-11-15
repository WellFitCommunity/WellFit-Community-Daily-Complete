/**
 * Learning Indicator - Visual Feedback for Smart Admin Learning
 *
 * Shows real-time feedback when the system learns from user behavior
 * Provides immediate visual response to make learning feel responsive and intentional
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, TrendingUp, Check, Sparkles } from 'lucide-react';

export interface LearningEvent {
  type: 'section_opened' | 'pattern_detected' | 'preference_saved' | 'suggestion_generated';
  message: string;
  timestamp: Date;
}

interface LearningIndicatorProps {
  events: LearningEvent[];
  learningScore: number; // 0-100
  totalInteractions: number;
}

export const LearningIndicator: React.FC<LearningIndicatorProps> = ({
  events,
  learningScore,
  totalInteractions
}) => {
  const [showLatest, setShowLatest] = useState(false);
  const [latestEvent, setLatestEvent] = useState<LearningEvent | null>(null);

  useEffect(() => {
    if (events.length > 0) {
      const latest = events[events.length - 1];
      setLatestEvent(latest);
      setShowLatest(true);

      // Auto-hide after 3 seconds
      const timer = setTimeout(() => setShowLatest(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [events]);

  const getIcon = (type: LearningEvent['type']) => {
    switch (type) {
      case 'section_opened':
        return <TrendingUp className="w-4 h-4" />;
      case 'pattern_detected':
        return <Brain className="w-4 h-4" />;
      case 'preference_saved':
        return <Check className="w-4 h-4" />;
      case 'suggestion_generated':
        return <Sparkles className="w-4 h-4" />;
    }
  };

  const getColor = (type: LearningEvent['type']) => {
    switch (type) {
      case 'section_opened':
        return 'bg-blue-500';
      case 'pattern_detected':
        return 'bg-purple-500';
      case 'preference_saved':
        return 'bg-green-500';
      case 'suggestion_generated':
        return 'bg-amber-500';
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-3">
      {/* Learning Progress Badge */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 max-w-xs"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Brain className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-900">Learning Your Patterns</div>
            <div className="text-xs text-gray-500">{totalInteractions} interactions tracked</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${learningScore}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
          />
        </div>
        <div className="text-xs text-gray-600 mt-1 text-right">{learningScore}% learned</div>
      </motion.div>

      {/* Latest Event Toast */}
      <AnimatePresence>
        {showLatest && latestEvent && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 max-w-xs"
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 ${getColor(latestEvent.type)} rounded-lg text-white`}>
                {getIcon(latestEvent.type)}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">
                  {latestEvent.message}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Just now
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Compact Learning Badge - Shows in section header
 */
interface LearningBadgeProps {
  sectionId: string;
  frequencyScore: number; // 0-100
  isTopSection: boolean;
}

export const LearningBadge: React.FC<LearningBadgeProps> = ({
  sectionId,
  frequencyScore,
  isTopSection
}) => {
  if (frequencyScore < 30) return null; // Don't show for rarely used sections

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="flex items-center gap-1"
    >
      {isTopSection && (
        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Top Choice
        </span>
      )}
      {frequencyScore >= 70 && !isTopSection && (
        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          Frequently Used
        </span>
      )}
    </motion.div>
  );
};

/**
 * Section Reorder Animation Wrapper
 */
interface AnimatedSectionProps {
  children: React.ReactNode;
  sectionId: string;
  index: number;
}

export const AnimatedSection: React.FC<AnimatedSectionProps> = ({
  children,
  sectionId,
  index
}) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{
        layout: { duration: 0.3, ease: 'easeInOut' },
        opacity: { duration: 0.2 },
        y: { duration: 0.2 }
      }}
      layoutId={sectionId}
    >
      {children}
    </motion.div>
  );
};

/**
 * Smart Suggestion Card - Actionable suggestions from learning
 */
interface SmartSuggestionCardProps {
  suggestion: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const SmartSuggestionCard: React.FC<SmartSuggestionCardProps> = ({
  suggestion,
  actionLabel,
  onAction,
  icon
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4 cursor-pointer"
      onClick={onAction}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
          {icon || <Brain className="w-5 h-5" />}
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-800 font-medium">{suggestion}</p>
          {actionLabel && (
            <button className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1">
              {actionLabel} →
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/**
 * Learning Milestone Celebration
 */
interface MilestoneCelebrationProps {
  milestone: string;
  show: boolean;
  onClose: () => void;
}

export const MilestoneCelebration: React.FC<MilestoneCelebrationProps> = ({
  milestone,
  show,
  onClose
}) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onClose, 4000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 100 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: 100 }}
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
        >
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{
              duration: 0.5,
              repeat: 2
            }}
            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl shadow-2xl p-8 pointer-events-auto max-w-md"
          >
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="inline-block mb-4"
              >
                <Sparkles className="w-16 h-16" />
              </motion.div>
              <h2 className="text-2xl font-bold mb-2">Achievement Unlocked!</h2>
              <p className="text-lg opacity-90">{milestone}</p>
              <button
                onClick={onClose}
                className="mt-4 px-6 py-2 bg-white text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
              >
                Awesome!
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
