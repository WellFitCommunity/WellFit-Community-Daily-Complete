/**
 * Community Moments — Reaction Bar
 *
 * A row of large, tappable emoji reactions shown UNDER each post. Members tap
 * an emoji to react (and tap again to remove it). Shows a running count.
 * Senior-friendly: 56px+ tap targets, high-contrast selected state, clear
 * aria labels.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React from 'react';
import { useBranding } from '../../BrandingContext';
import { REACTION_EMOJIS, REACTION_LABELS } from './types';

interface MomentReactionsProps {
  counts: Record<string, number>; // emoji -> count
  mine: string[]; // emojis the current user reacted with
  onToggle: (emoji: string) => void;
  disabled?: boolean; // true when no signed-in user
}

const MomentReactions: React.FC<MomentReactionsProps> = ({ counts, mine, onToggle, disabled }) => {
  const { branding } = useBranding();

  return (
    <div
      className="w-full mt-4 pt-4 border-t-2 border-gray-100 flex flex-wrap gap-2 justify-center"
      role="group"
      aria-label="React to this moment"
    >
      {REACTION_EMOJIS.map((emoji) => {
        const count = counts[emoji] || 0;
        const reacted = mine.includes(emoji);
        const label = REACTION_LABELS[emoji] || 'React';
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => !disabled && onToggle(emoji)}
            disabled={disabled}
            aria-pressed={reacted}
            aria-label={`${label}${count > 0 ? `, ${count} so far` : ''}${reacted ? ' (you reacted)' : ''}`}
            title={label}
            className={`min-h-[56px] min-w-[64px] px-4 py-2 rounded-full border-2 flex items-center gap-2 text-2xl font-bold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
              reacted ? 'shadow-md' : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
            style={
              reacted
                ? {
                    backgroundColor: `${branding.primaryColor}1a`, // ~10% tint
                    borderColor: branding.primaryColor,
                    color: branding.primaryColor,
                  }
                : undefined
            }
          >
            <span aria-hidden="true">{emoji}</span>
            {count > 0 && <span className="text-xl text-gray-700">{count}</span>}
          </button>
        );
      })}
    </div>
  );
};

export default MomentReactions;
