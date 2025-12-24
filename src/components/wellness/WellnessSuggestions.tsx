/**
 * Wellness Suggestions Component
 *
 * Shows encouraging suggestions when seniors report feeling down.
 * Triggered by moods: "Not Great", "Sad", "Anxious", "Tired", "Stressed"
 *
 * These are gentle, non-clinical suggestions for self-care.
 * For clinical concerns, users should speak with their healthcare provider.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect } from 'react';
import { Phone, TreePine, BookOpen, Tv2, SunMedium, Heart, X, ChevronRight } from 'lucide-react';

// Moods that trigger wellness suggestions
const DOWN_MOODS = ['Not Great', 'Sad', 'Anxious', 'Tired', 'Stressed'];

interface WellnessSuggestion {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: string;
  actionUrl?: string;
}

const WELLNESS_SUGGESTIONS: WellnessSuggestion[] = [
  {
    id: 'call-friend',
    icon: <Phone className="w-8 h-8" />,
    title: 'Call a Friend or Family Member',
    description: 'Sometimes a friendly voice is all we need. Reach out to someone who cares about you.',
    action: 'Open Contacts',
    actionUrl: 'tel:',
  },
  {
    id: 'take-walk',
    icon: <TreePine className="w-8 h-8" />,
    title: 'Take a Walk Outside',
    description: 'Fresh air and gentle movement can lift your spirits. Even a short walk around the block helps.',
  },
  {
    id: 'read-book',
    icon: <BookOpen className="w-8 h-8" />,
    title: 'Read a Good Book',
    description: 'Lose yourself in a story. Reading can be a wonderful escape and mental refresher.',
  },
  {
    id: 'turn-off-news',
    icon: <Tv2 className="w-8 h-8" />,
    title: 'Turn Off the News',
    description: 'Too much news can be overwhelming. Give yourself permission to take a break from current events.',
  },
  {
    id: 'watch-comedy',
    icon: <SunMedium className="w-8 h-8" />,
    title: 'Watch Something Funny',
    description: 'Laughter really is good medicine! Put on a comedy show or a funny movie.',
  },
  {
    id: 'positive-thoughts',
    icon: <Heart className="w-8 h-8" />,
    title: 'Think on Positive Things',
    description: 'Take a moment to reflect on things you\'re grateful for. Small blessings add up.',
  },
];

interface WellnessSuggestionsProps {
  mood: string;
  onClose?: () => void;
  className?: string;
}

export const WellnessSuggestions: React.FC<WellnessSuggestionsProps> = ({
  mood,
  onClose,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);

  // Check if mood warrants showing suggestions
  const shouldShow = DOWN_MOODS.includes(mood);

  useEffect(() => {
    if (shouldShow) {
      // Small delay for smooth appearance
      const timer = setTimeout(() => setIsVisible(true), 300);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [shouldShow, mood]);

  if (!shouldShow || !isVisible) {
    return null;
  }

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  const getMoodMessage = () => {
    switch (mood) {
      case 'Sad':
        return 'We\'re sorry you\'re feeling sad. Here are some gentle suggestions that might help:';
      case 'Anxious':
        return 'Feeling anxious can be tough. Here are some calming activities to try:';
      case 'Tired':
        return 'When you\'re feeling tired, self-care matters most. Consider these options:';
      case 'Stressed':
        return 'Stress happens to everyone. Here are some ways to find relief:';
      case 'Not Great':
      default:
        return 'We hope you feel better soon. Here are some suggestions that might help:';
    }
  };

  return (
    <div
      className={`bg-linear-to-br from-blue-50 to-green-50 rounded-xl border-2 border-blue-200 shadow-lg overflow-hidden ${className}`}
      role="region"
      aria-label="Wellness suggestions"
    >
      {/* Header */}
      <div className="bg-linear-to-r from-[#003865] to-[#0056a4] p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden="true">💙</span>
            <div>
              <h3 className="text-xl font-bold">We Care About You</h3>
              <p className="text-sm text-blue-100">{getMoodMessage()}</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white/20 rounded-full transition"
              aria-label="Close wellness suggestions"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Suggestions Grid */}
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {WELLNESS_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion.id}
              onClick={() => {
                setSelectedSuggestion(suggestion.id);
                if (suggestion.actionUrl) {
                  // For phone, just trigger dialer
                  window.location.href = suggestion.actionUrl;
                }
              }}
              className={`p-4 rounded-lg text-left transition-all duration-200 hover:scale-102 hover:shadow-md ${
                selectedSuggestion === suggestion.id
                  ? 'bg-[#8cc63f] text-white shadow-md'
                  : 'bg-white hover:bg-green-50 text-gray-800'
              }`}
              aria-label={suggestion.title}
            >
              <div className="flex items-start gap-4">
                <div className={`shrink-0 p-2 rounded-lg ${
                  selectedSuggestion === suggestion.id
                    ? 'bg-white/20'
                    : 'bg-[#003865] text-white'
                }`}>
                  {suggestion.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-lg mb-1">{suggestion.title}</h4>
                  <p className={`text-sm leading-relaxed ${
                    selectedSuggestion === suggestion.id ? 'text-white/90' : 'text-gray-600'
                  }`}>
                    {suggestion.description}
                  </p>
                  {suggestion.action && (
                    <div className="mt-2 flex items-center gap-1 text-sm font-medium">
                      <span>{suggestion.action}</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Encouraging Footer */}
        <div className="mt-6 p-4 bg-white rounded-lg border border-green-200 text-center">
          <p className="text-gray-700 text-lg">
            <span className="text-2xl mr-2" aria-hidden="true">🌟</span>
            Remember: It's okay to not feel okay sometimes. You're not alone, and brighter days are ahead.
          </p>
        </div>

        {/* Crisis Resources Note */}
        <p className="mt-4 text-center text-sm text-gray-500">
          If you're experiencing a crisis or need immediate help, please call or text{' '}
          <a href="tel:988" className="text-blue-600 font-semibold hover:underline">988</a>
          {' '}(Suicide & Crisis Lifeline) available 24/7.
        </p>
      </div>
    </div>
  );
};

/**
 * Hook to determine if wellness suggestions should be shown
 */
export function useWellnessSuggestions(mood: string) {
  return {
    shouldShow: DOWN_MOODS.includes(mood),
    isDownMood: DOWN_MOODS.includes(mood),
    downMoods: DOWN_MOODS,
  };
}

export default WellnessSuggestions;
