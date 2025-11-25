// ============================================================================
// Compassion Battery Indicator
// ============================================================================
// Purpose: Visualize compassion fatigue as a "battery" that depletes
// Design: Makes invisible emotional drain VISIBLE and actionable
// ============================================================================

import React, { useState } from 'react';

interface CompassionBatteryProps {
  level: number; // 1-10 (10 = full, 1 = depleted)
  missedBreak?: boolean;
  difficultCalls?: number;
  showRechargeOptions?: boolean;
}

export const CompassionBattery: React.FC<CompassionBatteryProps> = ({
  level,
  missedBreak = false,
  difficultCalls = 0,
  showRechargeOptions = true,
}) => {
  const [showOptions, setShowOptions] = useState(false);

  // Normalize to 0-100 percentage
  const percentage = Math.min(Math.max(level * 10, 0), 100);

  // Get battery color based on level
  const getBatteryColor = () => {
    if (percentage >= 70) return 'from-green-400 to-emerald-500';
    if (percentage >= 40) return 'from-yellow-400 to-amber-500';
    if (percentage >= 20) return 'from-orange-400 to-red-500';
    return 'from-red-500 to-red-700';
  };

  // Get status text
  const getStatusText = () => {
    if (percentage >= 70) return 'Feeling good';
    if (percentage >= 40) return 'Getting tired';
    if (percentage >= 20) return 'Running low';
    return 'Need to recharge';
  };

  // Get emoji
  const getEmoji = () => {
    if (percentage >= 70) return '💚';
    if (percentage >= 40) return '💛';
    if (percentage >= 20) return '🧡';
    return '❤️';
  };

  // Recharge options
  const rechargeOptions = [
    {
      emoji: '🎧',
      label: '5-min meditation',
      action: () => window.location.href = '/resilience/modules?category=mindfulness',
    },
    {
      emoji: '📱',
      label: 'Text a peer',
      action: () => window.location.href = '/resilience/circles',
    },
    {
      emoji: '☕',
      label: 'Take a break',
      action: () => {
        // Log break taken
        setShowOptions(false);
      },
    },
    {
      emoji: '🌬️',
      label: 'Deep breaths',
      action: () => {
        // Show breathing exercise
        window.location.href = '/resilience/breathe';
      },
    },
  ];

  return (
    <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl p-4 border border-pink-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{getEmoji()}</span>
          <h4 className="font-semibold text-gray-900">Compassion Battery</h4>
        </div>
        <span className="text-sm font-medium text-gray-600">{percentage}%</span>
      </div>

      {/* Battery Visual */}
      <div className="relative mb-3">
        <div className="h-8 bg-gray-200 rounded-lg overflow-hidden border-2 border-gray-300">
          <div
            className={`h-full bg-gradient-to-r ${getBatteryColor()} transition-all duration-500 rounded-lg`}
            style={{ width: `${percentage}%` }}
          >
            {/* Battery segments */}
            <div className="h-full flex gap-1 p-1">
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-sm ${
                    i < level ? 'bg-white/30' : 'bg-transparent'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
        {/* Battery cap */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 -mr-1 w-2 h-4 bg-gray-300 rounded-r border-2 border-l-0 border-gray-300"></div>
      </div>

      {/* Status */}
      <div className="flex items-center justify-between text-sm mb-3">
        <span className="text-gray-700">{getStatusText()}</span>
        {missedBreak && (
          <span className="text-orange-600 text-xs flex items-center gap-1">
            <span>⚠️</span> Missed break
          </span>
        )}
      </div>

      {/* Drain factors */}
      {difficultCalls > 0 && (
        <div className="text-xs text-gray-500 mb-3">
          Today: {difficultCalls} difficult {difficultCalls === 1 ? 'interaction' : 'interactions'}
          <span className="text-pink-600"> (drains faster)</span>
        </div>
      )}

      {/* Recharge button/options */}
      {showRechargeOptions && percentage < 70 && (
        <>
          {!showOptions ? (
            <button
              onClick={() => setShowOptions(true)}
              className="w-full py-2 bg-pink-100 text-pink-700 rounded-lg text-sm font-medium hover:bg-pink-200 transition-all border border-pink-300"
            >
              ⚡ Quick Recharge Options
            </button>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {rechargeOptions.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={option.action}
                    className="p-2 bg-white rounded-lg border border-pink-200 hover:border-pink-400 transition-all text-left"
                  >
                    <span className="text-lg">{option.emoji}</span>
                    <span className="text-xs text-gray-700 block">{option.label}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowOptions(false)}
                className="w-full text-xs text-gray-500 hover:text-gray-700"
              >
                Hide options
              </button>
            </div>
          )}
        </>
      )}

      {/* Critical warning */}
      {percentage < 20 && (
        <div className="mt-3 p-2 bg-red-100 rounded-lg border border-red-300 text-center">
          <p className="text-xs text-red-700 font-medium">
            Your compassion tank is low. Consider taking a moment before your next patient.
          </p>
        </div>
      )}
    </div>
  );
};

export default CompassionBattery;
