// ============================================================================
// Physician Celebration Modal - Clinical Excellence Celebration
// ============================================================================
// Purpose: Fun, animated celebration for physician achievements
// Features: Medical-themed animations, doctor slang, achievement recognition
// ============================================================================

import React, { useEffect, useState } from 'react';

export type PhysicianAchievementType =
  | 'documentation'
  | 'revenue'
  | 'patient_satisfaction'
  | 'coding_accuracy'
  | 'ccm_goal'
  | 'wellness_module'
  | 'diagnosis'
  | 'daily_checkin';

interface PhysicianCelebrationModalProps {
  onClose: () => void;
  achievementType: PhysicianAchievementType;
  achievementDetails?: string;
  metricValue?: number;
}

export const PhysicianCelebrationModal: React.FC<PhysicianCelebrationModalProps> = ({
  onClose,
  achievementType,
  achievementDetails,
  metricValue,
}) => {
  const [showConfetti, setShowConfetti] = useState(true);
  const [animationPhase, setAnimationPhase] = useState<'entrance' | 'celebration' | 'exit'>('entrance');

  // Achievement-specific celebrations
  const celebrationConfig = {
    documentation: {
      phrases: [
        { text: "Chart Wizard! 🧙‍⚕️", emoji: "📋" },
        { text: "Documentation Ninja! 🥷", emoji: "✍️" },
        { text: "That's what I call clinical excellence!", emoji: "⭐" },
        { text: "Chart game STRONG, Doc! 💪", emoji: "📊" },
        { text: "Efficiency goals: ACHIEVED! ✓", emoji: "🎯" },
      ],
      confettiColors: ['#4A90E2', '#7B68EE', '#50C878', '#FFD700'],
      icon: '📋',
    },
    revenue: {
      phrases: [
        { text: "Revenue Rockstar! 💰", emoji: "🎸" },
        { text: "Cha-ching! Money moves! 💸", emoji: "💵" },
        { text: "That's billable excellence! 🏆", emoji: "📈" },
        { text: "Financial wellness unlocked! 🔓", emoji: "💎" },
        { text: "Show me the money! You did! 💰", emoji: "🤑" },
      ],
      confettiColors: ['#FFD700', '#FFA500', '#32CD32', '#00CED1'],
      icon: '💰',
    },
    patient_satisfaction: {
      phrases: [
        { text: "Patient Hero! ❤️", emoji: "🦸" },
        { text: "5-Star Healer Energy! ⭐", emoji: "🌟" },
        { text: "Compassion + Competence = You! 💙", emoji: "🩺" },
        { text: "Making a difference, one patient at a time!", emoji: "❤️" },
        { text: "Your patients love you! And we see why! 🎉", emoji: "👏" },
      ],
      confettiColors: ['#FF69B4', '#FF1493', '#DC143C', '#FFA07A'],
      icon: '❤️',
    },
    coding_accuracy: {
      phrases: [
        { text: "Code Master! 🎯", emoji: "💻" },
        { text: "ICD-10 Expert Status: Achieved! 🏅", emoji: "🎖️" },
        { text: "CPT Codes on POINT! 🔥", emoji: "✨" },
        { text: "Zero denials, all thrills! 🎊", emoji: "✓" },
        { text: "Billing precision = Chef's kiss! 👨‍🍳", emoji: "😘" },
      ],
      confettiColors: ['#9370DB', '#BA55D3', '#8A2BE2', '#9932CC'],
      icon: '🎯',
    },
    ccm_goal: {
      phrases: [
        { text: "CCM Champion! 🏆", emoji: "⏱️" },
        { text: "Chronic Care Master! 💪", emoji: "📅" },
        { text: "Time tracking = On fleek! ✓", emoji: "⌚" },
        { text: "20 minutes never looked so good! ⭐", emoji: "🎯" },
        { text: "CCM goals: CRUSHED! 💥", emoji: "🔥" },
      ],
      confettiColors: ['#20B2AA', '#48D1CC', '#00CED1', '#40E0D0'],
      icon: '⏱️',
    },
    wellness_module: {
      phrases: [
        { text: "Wellness Warrior! 🧘", emoji: "💚" },
        { text: "Self-care is healthcare! ✨", emoji: "🌟" },
        { text: "Investing in YOU! Smart move, Doc! 🎓", emoji: "📚" },
        { text: "Can't pour from empty cup - and you know it! ☕", emoji: "💪" },
        { text: "Personal growth unlocked! 🔓", emoji: "🌱" },
      ],
      confettiColors: ['#90EE90', '#98FB98', '#00FA9A', '#00FF7F'],
      icon: '🧘',
    },
    diagnosis: {
      phrases: [
        { text: "Diagnostic Genius! 🧠", emoji: "🔬" },
        { text: "Clinical acumen on POINT! 🎯", emoji: "💡" },
        { text: "That's why they call you DOCTOR! 🩺", emoji: "👨‍⚕️" },
        { text: "Sherlock Holmes MD! 🔍", emoji: "🕵️" },
        { text: "Differential diagnosis? More like DEFINITIVE! ✓", emoji: "✨" },
      ],
      confettiColors: ['#FF6347', '#FF4500', '#DC143C', '#B22222'],
      icon: '🧠',
    },
    daily_checkin: {
      phrases: [
        { text: "Self-awareness: Leveled up! 📊", emoji: "🎯" },
        { text: "Taking care of yourself = Taking care of patients! 💚", emoji: "✨" },
        { text: "Wellness check: COMPLETE! ✓", emoji: "📋" },
        { text: "One day at a time, Doc! You got this! 💪", emoji: "🌟" },
        { text: "Tracking your wellbeing = Pro move! 🏆", emoji: "👏" },
      ],
      confettiColors: ['#87CEEB', '#00BFFF', '#1E90FF', '#4169E1'],
      icon: '📊',
    },
  };

  const config = celebrationConfig[achievementType];
  const [celebration] = useState(
    config.phrases[Math.floor(Math.random() * config.phrases.length)]
  );

  // Medical-themed confetti
  const medicalEmojis = ['💊', '💉', '🩺', '📋', '🏥', '⚕️', '💊', '🔬', '🧬'];
  const [confettiPieces] = useState(() =>
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 2 + Math.random() * 1,
      rotation: Math.random() * 360,
      color: config.confettiColors[Math.floor(Math.random() * config.confettiColors.length)],
      emoji: i % 3 === 0 ? medicalEmojis[Math.floor(Math.random() * medicalEmojis.length)] : null,
    }))
  );

  useEffect(() => {
    // Entrance animation
    const timer1 = setTimeout(() => {
      setAnimationPhase('celebration');
    }, 500);

    // Auto-close confetti
    const timer2 = setTimeout(() => {
      setShowConfetti(false);
    }, 4000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-100 flex items-center justify-center p-4">
      {/* Medical Confetti */}
      {showConfetti && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {confettiPieces.map((piece) => (
            <div
              key={piece.id}
              className="absolute animate-confetti-fall"
              style={{
                left: `${piece.left}%`,
                top: '-20px',
                animationDelay: `${piece.delay}s`,
                animationDuration: `${piece.duration}s`,
                transform: `rotate(${piece.rotation}deg)`,
                fontSize: piece.emoji ? '24px' : '12px',
              }}
            >
              {piece.emoji || (
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: piece.color }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Main celebration card */}
      <div
        className={`bg-linear-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-2xl max-w-2xl w-full p-8 relative transform transition-all duration-500 ${
          animationPhase === 'entrance' ? 'scale-75 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl leading-none"
        >
          ×
        </button>

        {/* Main content */}
        <div className="text-center mb-6">
          {/* Big celebration emoji with pulse animation */}
          <div className="text-8xl mb-4 animate-pulse-scale">
            {config.icon}
          </div>

          {/* Celebration text */}
          <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-indigo-600 mb-2">
            {celebration.text}
          </h2>

          {achievementDetails && (
            <p className="text-lg text-gray-700 font-medium mt-3">
              {achievementDetails}
            </p>
          )}

          {metricValue !== undefined && (
            <div className="mt-4 inline-block px-6 py-3 bg-linear-to-r from-blue-100 to-indigo-100 rounded-full">
              <span className="text-3xl font-bold text-blue-700">{metricValue}</span>
              <span className="text-sm text-gray-600 ml-2">
                {achievementType === 'revenue' && '💰'}
                {achievementType === 'patient_satisfaction' && '⭐'}
                {achievementType === 'ccm_goal' && 'min'}
              </span>
            </div>
          )}
        </div>

        {/* Doctor avatars high-fiving - CULTURALLY DIVERSE */}
        <div className="relative h-64 mb-6 flex items-center justify-center">
          <div className="flex items-center gap-12">
            {/* Left doctor avatar - Randomly selected diverse representation */}
            <div
              className={`text-center transition-transform duration-700 ${
                animationPhase === 'celebration' ? 'translate-x-6' : ''
              }`}
            >
              <div className="text-7xl mb-2">
                {['🧑🏻‍⚕️', '🧑🏼‍⚕️', '🧑🏽‍⚕️', '🧑🏾‍⚕️', '🧑🏿‍⚕️', '👨🏻‍⚕️', '👨🏼‍⚕️', '👨🏽‍⚕️', '👨🏾‍⚕️', '👨🏿‍⚕️', '👩🏻‍⚕️', '👩🏼‍⚕️', '👩🏽‍⚕️', '👩🏾‍⚕️', '👩🏿‍⚕️'][Math.floor(Math.random() * 15)]}
              </div>
              <div className="text-sm font-medium text-gray-600">You</div>
            </div>

            {/* High-five effect */}
            {animationPhase === 'celebration' && (
              <div className="absolute animate-high-five-spark">
                <div className="text-6xl">{celebration.emoji}</div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-4xl">💥</div>
                </div>
              </div>
            )}

            {/* Right doctor avatar - Different diverse representation */}
            <div
              className={`text-center transition-transform duration-700 ${
                animationPhase === 'celebration' ? '-translate-x-6' : ''
              }`}
            >
              <div className="text-7xl mb-2 scale-x-[-1]">
                {['🧑🏻‍⚕️', '🧑🏼‍⚕️', '🧑🏽‍⚕️', '🧑🏾‍⚕️', '🧑🏿‍⚕️', '👨🏻‍⚕️', '👨🏼‍⚕️', '👨🏽‍⚕️', '👨🏾‍⚕️', '👨🏿‍⚕️', '👩🏻‍⚕️', '👩🏼‍⚕️', '👩🏽‍⚕️', '👩🏾‍⚕️', '👩🏿‍⚕️'][Math.floor(Math.random() * 15)]}
              </div>
              <div className="text-sm font-medium text-gray-600">Your Team</div>
            </div>
          </div>
        </div>

        {/* Achievement badges */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 text-center shadow-xs">
            <div className="text-3xl mb-1">🏆</div>
            <div className="text-xs text-gray-600">Excellence</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center shadow-xs">
            <div className="text-3xl mb-1">💪</div>
            <div className="text-xs text-gray-600">Commitment</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center shadow-xs">
            <div className="text-3xl mb-1">✨</div>
            <div className="text-xs text-gray-600">Impact</div>
          </div>
        </div>

        {/* Encouragement message */}
        <div className="bg-linear-to-r from-blue-100 to-indigo-100 rounded-lg p-4 mb-6">
          <p className="text-center text-gray-800 font-medium">
            {achievementType === 'wellness_module' && (
              <>
                💚 Every moment you invest in yourself strengthens your ability to care for others.
                <span className="block mt-2 text-blue-700">
                  You're not just a great doctor—you're taking care of the doctor, too!
                </span>
              </>
            )}
            {achievementType === 'revenue' && (
              <>
                💰 Financial wellness creates sustainability for quality patient care.
                <span className="block mt-2 text-blue-700">
                  Doing well by doing good—that's the balance!
                </span>
              </>
            )}
            {achievementType === 'patient_satisfaction' && (
              <>
                ❤️ Your patients feel heard, cared for, and valued.
                <span className="block mt-2 text-blue-700">
                  That's the art and science of medicine in perfect harmony!
                </span>
              </>
            )}
            {achievementType === 'documentation' && (
              <>
                📋 Accurate, timely documentation = Better outcomes for everyone.
                <span className="block mt-2 text-blue-700">
                  The unsung hero work that keeps healthcare running!
                </span>
              </>
            )}
            {achievementType === 'daily_checkin' && (
              <>
                💚 Awareness is the first step to resilience.
                <span className="block mt-2 text-blue-700">
                  You're building sustainable habits for a long, fulfilling career!
                </span>
              </>
            )}
            {(achievementType === 'coding_accuracy' || achievementType === 'ccm_goal') && (
              <>
                🎯 Precision, accuracy, and attention to detail—that's excellence!
                <span className="block mt-2 text-blue-700">
                  Your work quality speaks volumes about your commitment!
                </span>
              </>
            )}
            {achievementType === 'diagnosis' && (
              <>
                🧠 Clinical reasoning at its finest—this is why you trained so hard!
                <span className="block mt-2 text-blue-700">
                  Your patients are lucky to have your expertise!
                </span>
              </>
            )}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-linear-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105"
          >
            Keep Going, Doc! 🚀
          </button>
        </div>

        {/* Motivational quote */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 italic">
            "The best doctor gives the least medicines." - But you give the most care! 💙
          </p>
        </div>
      </div>

      {/* Custom CSS for animations */}
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

        @keyframes pulse-scale {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.15);
          }
        }

        @keyframes high-five-spark {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.5);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 0.8;
          }
        }

        .animate-confetti-fall {
          animation: confetti-fall linear forwards;
        }

        .animate-pulse-scale {
          animation: pulse-scale 2s ease-in-out infinite;
        }

        .animate-high-five-spark {
          animation: high-five-spark 0.7s ease-out;
        }
      `}</style>
    </div>
  );
};

export default PhysicianCelebrationModal;
