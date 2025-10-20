// ============================================================================
// Celebration Modal - Module Completion Celebration
// ============================================================================
// Purpose: Fun, animated celebration when nurses complete training modules
// Features: Gen Z slang, high-five animations, confetti, positive reinforcement
// ============================================================================

import React, { useEffect, useState } from 'react';

interface CelebrationModalProps {
  onClose: () => void;
  moduleName: string;
  wasHelpful: boolean;
}

export const CelebrationModal: React.FC<CelebrationModalProps> = ({
  onClose,
  moduleName,
  wasHelpful,
}) => {
  const [showConfetti, setShowConfetti] = useState(true);
  const [animationPhase, setAnimationPhase] = useState<'entrance' | 'highfive' | 'exit'>('entrance');

  // Gen Z slang phrases (positive, workplace appropriate)
  const celebrations = [
    { text: "You ATE that! 🔥", emoji: "💪" },
    { text: "No cap, you're crushing it! 🎯", emoji: "⭐" },
    { text: "Main character energy! ✨", emoji: "👑" },
    { text: "Absolutely slaying! 💅", emoji: "🌟" },
    { text: "Living rent free in excellence! 🏆", emoji: "🎉" },
    { text: "That's the tea! ☕", emoji: "💯" },
    { text: "Periodt! You did THAT! 💯", emoji: "🔥" },
    { text: "Chef's kiss! *mwah* 👨‍🍳", emoji: "😘" },
    { text: "Understood the assignment! ✓", emoji: "📝" },
    { text: "Big W! You're unstoppable! 🚀", emoji: "🏅" },
  ];

  const [celebration] = useState(
    celebrations[Math.floor(Math.random() * celebrations.length)]
  );

  // Confetti particles
  const [confettiPieces] = useState(() =>
    Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 2 + Math.random() * 1,
      rotation: Math.random() * 360,
      color: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'][Math.floor(Math.random() * 6)],
    }))
  );

  useEffect(() => {
    // Entrance animation
    const timer1 = setTimeout(() => {
      setAnimationPhase('highfive');
    }, 500);

    // Auto-close confetti
    const timer2 = setTimeout(() => {
      setShowConfetti(false);
    }, 3000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-[100] flex items-center justify-center p-4">
      {/* Confetti */}
      {showConfetti && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {confettiPieces.map((piece) => (
            <div
              key={piece.id}
              className="absolute w-3 h-3 rounded-full animate-confetti-fall"
              style={{
                left: `${piece.left}%`,
                top: '-20px',
                backgroundColor: piece.color,
                animationDelay: `${piece.delay}s`,
                animationDuration: `${piece.duration}s`,
                transform: `rotate(${piece.rotation}deg)`,
              }}
            />
          ))}
        </div>
      )}

      {/* Main celebration card */}
      <div
        className={`bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl shadow-2xl max-w-2xl w-full p-8 relative transform transition-all duration-500 ${
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
            {celebration.emoji}
          </div>

          {/* Celebration text */}
          <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 mb-2">
            {celebration.text}
          </h2>

          <p className="text-xl text-gray-700 font-medium">
            Module completed: <span className="text-purple-600">{moduleName}</span>
          </p>
        </div>

        {/* High-five animation section - CULTURALLY DIVERSE */}
        <div className="relative h-64 mb-6 flex items-center justify-center">
          <div className="flex items-center gap-12">
            {/* Left nurse avatar - Randomly selected diverse representation */}
            <div
              className={`text-center transition-transform duration-700 ${
                animationPhase === 'highfive' ? 'translate-x-6' : ''
              }`}
            >
              <div className="text-7xl mb-2">
                {['🧑🏻‍⚕️', '🧑🏼‍⚕️', '🧑🏽‍⚕️', '🧑🏾‍⚕️', '🧑🏿‍⚕️', '👨🏻‍⚕️', '👨🏼‍⚕️', '👨🏽‍⚕️', '👨🏾‍⚕️', '👨🏿‍⚕️', '👩🏻‍⚕️', '👩🏼‍⚕️', '👩🏽‍⚕️', '👩🏾‍⚕️', '👩🏿‍⚕️'][Math.floor(Math.random() * 15)]}
              </div>
              <div className="text-sm font-medium text-gray-600">You</div>
            </div>

            {/* High-five effect */}
            {animationPhase === 'highfive' && (
              <div className="absolute animate-high-five-spark">
                <div className="text-6xl">✨</div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-4xl">💥</div>
                </div>
              </div>
            )}

            {/* Right nurse avatar - Different diverse representation */}
            <div
              className={`text-center transition-transform duration-700 ${
                animationPhase === 'highfive' ? '-translate-x-6' : ''
              }`}
            >
              <div className="text-7xl mb-2 scale-x-[-1]">
                {['🧑🏻‍⚕️', '🧑🏼‍⚕️', '🧑🏽‍⚕️', '🧑🏾‍⚕️', '🧑🏿‍⚕️', '👨🏻‍⚕️', '👨🏼‍⚕️', '👨🏽‍⚕️', '👨🏾‍⚕️', '👨🏿‍⚕️', '👩🏻‍⚕️', '👩🏼‍⚕️', '👩🏽‍⚕️', '👩🏾‍⚕️', '👩🏿‍⚕️'][Math.floor(Math.random() * 15)]}
              </div>
              <div className="text-sm font-medium text-gray-600">Your Team</div>
            </div>
          </div>
        </div>

        {/* Stats/badges */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 text-center shadow-sm">
            <div className="text-3xl mb-1">🏆</div>
            <div className="text-xs text-gray-600">Growth</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center shadow-sm">
            <div className="text-3xl mb-1">💪</div>
            <div className="text-xs text-gray-600">Resilience</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center shadow-sm">
            <div className="text-3xl mb-1">✨</div>
            <div className="text-xs text-gray-600">Self-Care</div>
          </div>
        </div>

        {/* Encouragement message */}
        <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-lg p-4 mb-6">
          <p className="text-center text-gray-800 font-medium">
            {wasHelpful ? (
              <>
                💚 Amazing! Every module you complete builds stronger resilience.
                <span className="block mt-2 text-purple-700">
                  You're investing in yourself, and that's powerful!
                </span>
              </>
            ) : (
              <>
                Thanks for the honest feedback!
                <span className="block mt-2 text-purple-700">
                  We appreciate you taking the time—your input helps us improve.
                </span>
              </>
            )}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 transition-all transform hover:scale-105"
          >
            Keep Going! 🚀
          </button>
        </div>

        {/* Motivational quote */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 italic">
            "Self-care isn't selfish. You can't pour from an empty cup."
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
            transform: scale(1.1);
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

export default CelebrationModal;
