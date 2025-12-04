// ============================================================================
// Handoff Celebration - Joy at the End of Every Shift! 🎉
// ============================================================================
// Purpose: Memorable, delightful animation when handoff is accepted
// Design: Diverse dancing healthcare workers celebrating shift completion
// Why: "Hey, I didn't see the dance - what did we miss?" - Memory anchor!
// ============================================================================

import React, { useEffect, useState } from 'react';

interface HandoffCelebrationProps {
  onClose: () => void;
  nurseWhoAccepted?: string;
  bypassUsed?: boolean; // Was emergency bypass used?
  bypassNumber?: number; // Which bypass number (1, 2, 3...)?
  // Epic comparison metrics
  timeSavedMinutes?: number; // Minutes saved vs Epic benchmark (30 min)
  efficiencyPercent?: number; // % faster than Epic
  patientCount?: number; // Number of patients in handoff
}

export const HandoffCelebration: React.FC<HandoffCelebrationProps> = ({
  onClose,
  nurseWhoAccepted,
  bypassUsed = false,
  bypassNumber = 0,
  timeSavedMinutes,
  efficiencyPercent,
  patientCount,
}) => {
  const [showConfetti] = useState(true);
  const [bounceIndex, setBounceIndex] = useState(0);

  // Dancing healthcare workers (diverse representation)
  const dancers = [
    { emoji: '💃🏾', name: 'Dr. Maria', skin: 'dark', style: 'salsa' },
    { emoji: '🕺🏻', name: 'Nurse Alex', skin: 'light', style: 'disco' },
    { emoji: '👯‍♀️', name: 'RN Lisa & Kim', skin: 'asian', style: 'bunny-hop' },
    { emoji: '🧑🏽‍⚕️', name: 'PA Jordan', skin: 'medium', style: 'moonwalk' },
    { emoji: '👨🏿‍⚕️', name: 'Dr. James', skin: 'dark', style: 'shoulder-shimmy' },
  ];

  // Confetti colors (healthcare themed)
  const confettiColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  useEffect(() => {
    // Animate dancers bouncing in sequence
    const bounceInterval = setInterval(() => {
      setBounceIndex(prev => (prev + 1) % dancers.length);
    }, 300);

    // Auto-close after 4 seconds
    const closeTimer = setTimeout(() => {
      onClose();
    }, 4000);

    return () => {
      clearInterval(bounceInterval);
      clearTimeout(closeTimer);
    };
  }, [onClose, dancers.length]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
      {/* Confetti Rain */}
      {showConfetti && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti-fall"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-${Math.random() * 20}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: confettiColors[Math.floor(Math.random() * confettiColors.length)],
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Celebration Card */}
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl mx-4 text-center relative overflow-hidden animate-scale-in">
        {/* Gradient background shimmer */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 opacity-50"></div>

        {/* Content */}
        <div className="relative z-10">
          {/* Success Icon */}
          <div className="mb-4 animate-bounce-slow">
            <span className="text-6xl">🎉</span>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            Handoff Accepted!
          </h2>

          {/* Subtitle */}
          <p className="text-lg text-gray-600 mb-6">
            {nurseWhoAccepted ? `${nurseWhoAccepted} received the handoff` : 'Successfully transferred care'}
          </p>

          {/* Dancing Healthcare Workers */}
          <div className="flex justify-center items-end gap-4 mb-6 h-32">
            {dancers.map((dancer, index) => (
              <div
                key={index}
                className={`flex flex-col items-center transition-all duration-300 ${
                  bounceIndex === index ? 'animate-dance-bounce scale-125' : ''
                }`}
              >
                <div
                  className={`text-5xl transform ${
                    bounceIndex === index ? 'rotate-12' : ''
                  }`}
                  style={{
                    animation: bounceIndex === index ? 'wiggle 0.5s ease-in-out' : 'none',
                  }}
                >
                  {dancer.emoji}
                </div>
                <div className="text-xs text-gray-500 mt-1 font-medium">
                  {dancer.name}
                </div>
              </div>
            ))}
          </div>

          {/* Fun message */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800 font-medium">
              ✨ <strong>Great job!</strong> Your handoff was complete and thorough.
            </p>
            <p className="text-xs text-blue-600 mt-1">
              (If you didn't see the dance, something was missed! 😉)
            </p>
          </div>

          {/* Bypass Notice (if bypass was used) */}
          {bypassUsed && (
            <div className={`border-2 rounded-lg p-4 mb-4 ${
              bypassNumber >= 3
                ? 'bg-red-50 border-red-500'
                : 'bg-orange-50 border-orange-500'
            }`}>
              <div className="flex items-start gap-2">
                <span className="text-xl">{bypassNumber >= 3 ? '🚨' : '⚠️'}</span>
                <div className="flex-1">
                  <p className={`text-sm font-bold ${
                    bypassNumber >= 3 ? 'text-red-900' : 'text-orange-900'
                  }`}>
                    Emergency Override Was Used
                  </p>
                  <p className={`text-xs mt-1 ${
                    bypassNumber >= 3 ? 'text-red-700' : 'text-orange-700'
                  }`}>
                    This bypass has been logged for review.
                  </p>
                  <p className={`text-xs mt-1 font-medium ${
                    bypassNumber >= 3 ? 'text-red-800' : 'text-orange-800'
                  }`}>
                    {bypassNumber >= 3
                      ? `⚠️ Your manager has been notified (Bypass #${bypassNumber} this week)`
                      : `Bypass #${bypassNumber} of 3 allowed per week`
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Time Savings vs Epic - THE KEY METRIC */}
          {timeSavedMinutes !== undefined && timeSavedMinutes > 0 && (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-500 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl">⚡</span>
                <div className="text-center">
                  <div className="text-3xl font-bold text-emerald-700">
                    {timeSavedMinutes} min saved
                  </div>
                  <div className="text-sm text-emerald-600 font-medium">
                    vs Epic benchmark (30 min handoff)
                  </div>
                </div>
                <span className="text-3xl">⚡</span>
              </div>
              <div className="mt-2 text-center">
                <span className="inline-block bg-emerald-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                  {efficiencyPercent}% faster than Epic
                </span>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="bg-green-50 rounded-lg p-2">
              <div className="text-xl font-bold text-green-700">✓</div>
              <div className="text-xs text-green-600">All Reviewed</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-2">
              <div className="text-xl font-bold text-purple-700">{patientCount || '—'}</div>
              <div className="text-xs text-purple-600">Patients</div>
            </div>
            <div className="bg-teal-50 rounded-lg p-2">
              <div className="text-xl font-bold text-teal-700">80%</div>
              <div className="text-xs text-teal-600">AI Assisted</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-2">
              <div className="text-xl font-bold text-orange-700">🤝</div>
              <div className="text-xs text-orange-600">Care Transferred</div>
            </div>
          </div>

          {/* Close button (subtle) */}
          <button
            onClick={onClose}
            className="mt-6 text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Close (or wait 4 seconds)
          </button>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }

        @keyframes scale-in {
          0% {
            transform: scale(0.8);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-20px);
          }
        }

        @keyframes dance-bounce {
          0%, 100% {
            transform: translateY(0) scale(1);
          }
          25% {
            transform: translateY(-30px) scale(1.1) rotate(-10deg);
          }
          50% {
            transform: translateY(-15px) scale(1.05) rotate(10deg);
          }
          75% {
            transform: translateY(-25px) scale(1.1) rotate(-5deg);
          }
        }

        @keyframes wiggle {
          0%, 100% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(-15deg);
          }
          75% {
            transform: rotate(15deg);
          }
        }

        .animate-confetti-fall {
          animation: confetti-fall linear forwards;
        }

        .animate-scale-in {
          animation: scale-in 0.5s ease-out;
        }

        .animate-bounce-slow {
          animation: bounce-slow 2s infinite;
        }

        .animate-dance-bounce {
          animation: dance-bounce 0.6s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default HandoffCelebration;
