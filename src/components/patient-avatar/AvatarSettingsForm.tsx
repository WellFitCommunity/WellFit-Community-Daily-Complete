/**
 * AvatarSettingsForm - Visual settings for patient avatar customization
 *
 * Provides skin tone picker and gender presentation selector with live preview.
 */

import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { SkinTone, GenderPresentation } from '../../types/patientAvatar';
import { SKIN_TONE_COLORS, SKIN_TONES, SKIN_TONE_LABELS } from './constants/skinTones';
import { AvatarBody } from './AvatarBody';

interface AvatarSettingsFormProps {
  currentSkinTone: SkinTone;
  currentGender: GenderPresentation;
  onSkinToneChange: (skinTone: SkinTone) => void;
  onGenderChange: (gender: GenderPresentation) => void;
  disabled?: boolean;
  showPreview?: boolean;
  className?: string;
}

/**
 * Gender option configuration
 */
const GENDER_OPTIONS: { value: GenderPresentation; label: string; icon: string }[] = [
  { value: 'male', label: 'Male', icon: '♂' },
  { value: 'female', label: 'Female', icon: '♀' },
  { value: 'neutral', label: 'Neutral', icon: '⚥' },
];

/**
 * AvatarSettingsForm Component
 */
export const AvatarSettingsForm: React.FC<AvatarSettingsFormProps> = ({
  currentSkinTone,
  currentGender,
  onSkinToneChange,
  onGenderChange,
  disabled = false,
  showPreview = true,
  className,
}) => {
  const [previewView, setPreviewView] = useState<'front' | 'back'>('front');

  return (
    <div className={cn('avatar-settings-form', className)}>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Settings Panel */}
        <div className="flex-1 space-y-6">
          {/* Skin Tone Picker */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Skin Tone
            </label>
            <div className="flex flex-wrap gap-3">
              {SKIN_TONES.map((tone) => (
                <button
                  key={tone}
                  type="button"
                  onClick={() => !disabled && onSkinToneChange(tone)}
                  disabled={disabled}
                  className={cn(
                    'relative w-12 h-12 rounded-full transition-all duration-200',
                    'border-2 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00857a]',
                    currentSkinTone === tone
                      ? 'border-[#00857a] ring-2 ring-[#00857a]/50 scale-110'
                      : 'border-slate-600 hover:border-slate-400',
                    disabled && 'opacity-50 cursor-not-allowed hover:scale-100'
                  )}
                  style={{ backgroundColor: SKIN_TONE_COLORS[tone] }}
                  title={SKIN_TONE_LABELS[tone]}
                  aria-label={`Select ${SKIN_TONE_LABELS[tone]} skin tone`}
                  aria-pressed={currentSkinTone === tone}
                >
                  {currentSkinTone === tone && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-white drop-shadow-lg"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Selected: {SKIN_TONE_LABELS[currentSkinTone]}
            </p>
          </div>

          {/* Gender Presentation Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Body Silhouette
            </label>
            <div className="flex gap-2">
              {GENDER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => !disabled && onGenderChange(option.value)}
                  disabled={disabled}
                  className={cn(
                    'flex-1 py-3 px-4 rounded-lg transition-all duration-200',
                    'border-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00857a]',
                    currentGender === option.value
                      ? 'bg-[#00857a]/20 border-[#00857a] text-[#33bfb7]'
                      : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-300',
                    disabled && 'opacity-50 cursor-not-allowed'
                  )}
                  aria-pressed={currentGender === option.value}
                >
                  <span className="text-2xl mb-1 block">{option.icon}</span>
                  <span className="text-sm font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Preview */}
        {showPreview && (
          <div className="flex-shrink-0">
            <label className="block text-sm font-medium text-slate-300 mb-3 text-center">
              Preview
            </label>
            <div className="relative bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              {/* View Toggle */}
              <div className="absolute top-2 right-2 flex gap-1">
                <button
                  type="button"
                  onClick={() => setPreviewView('front')}
                  className={cn(
                    'px-2 py-1 text-xs rounded transition-colors',
                    previewView === 'front'
                      ? 'bg-[#00857a] text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  )}
                >
                  Front
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewView('back')}
                  className={cn(
                    'px-2 py-1 text-xs rounded transition-colors',
                    previewView === 'back'
                      ? 'bg-[#00857a] text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  )}
                >
                  Back
                </button>
              </div>

              {/* Avatar Preview */}
              <div className="w-[120px] h-[180px] mx-auto mt-6">
                <AvatarBody
                  skinTone={currentSkinTone}
                  genderPresentation={currentGender}
                  view={previewView}
                  size="thumbnail"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AvatarSettingsForm;
